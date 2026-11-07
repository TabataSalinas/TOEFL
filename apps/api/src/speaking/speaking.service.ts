import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { RagService } from '../rag/rag.service';
import { StorageService } from '../storage/storage.service';
import { ScoringService } from '../scoring/scoring.service';
import { SPEAKING_WEIGHTS } from '../common/toefl.constants';
import { alignWords, repeatScore } from './align';
import { Segment, SpeechMetrics, WordTiming, computeSpeechMetrics } from './speech-metrics';
import { heuristicSpeechLanguage } from './speaking.heuristics';
import { RawRating, aggregateRatings, ratingConfidence } from '../writing/writing.aggregate';
import { WritingError } from '../writing/writing.heuristics';
import { ratio5 } from '../scoring/scoring.util';
import { wordCount } from '../content/text-utils';

const json = (v: unknown) => v as unknown as Prisma.InputJsonValue;
const clamp5 = (n: number) => Math.max(0, Math.min(5, n));
const half = (n: number) => Math.round(n * 2) / 2;

export const INTERVIEW_RATER_DIMS = ['grammar', 'vocabulary', 'coherence', 'topic_development'];
const INTERVIEW_WEIGHTS: Record<string, number> = {
  grammar: 0.15, vocabulary: 0.15, coherence: 0.15, topic_development: 0.2, fluency: 0.2, pace: 0.05, clarity: 0.1,
};

export interface UploadInput {
  questionId: string;
  durationSec: number;
  mimeType: string;
  clientTranscript?: string;
  clientConfidence?: number;
  speechSegments?: Segment[];
}

export interface DimensionResult {
  score: number | null;
  rationale: string;
  source: 'audio' | 'llm' | 'heuristic' | 'asr-proxy';
}

export interface InterviewAnalysis {
  type: 'INTERVIEW';
  overall: number;
  dimensions: Record<string, DimensionResult>;
  errors: WritingError[];
  strengths: string[];
  improvements: Array<{ priority: number; advice: string }>;
  justification: string;
  method: 'llm' | 'heuristic';
  confidence: number;
  citations: Array<{ id: string; title: string; kind: string }>;
  notes: string[];
}

export interface RepeatAnalysis {
  type: 'LISTEN_REPEAT';
  overall: number;
  target: string;
  heard: string;
  accuracy: number;
  missing: string[];
  substitutions: Array<{ expected: string; heard: string }>;
  extra: string[];
  confidence: number;
  notes: string[];
}

@Injectable()
export class SpeakingService {
  private readonly logger = new Logger(SpeakingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly rag: RagService,
    private readonly storage: StorageService,
    private readonly scoring: ScoringService,
  ) {}

  // ───────────────────────────── Upload & analysis ─────────────────────────────

  async saveRecording(userId: string, attemptId: string, input: UploadInput, file: { buffer: Buffer; size: number }) {
    const attempt = await this.prisma.examAttempt.findUnique({ where: { id: attemptId }, include: { sectionAttempts: true } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId) throw new ForbiddenException('Not your attempt');
    const sa = attempt.sectionAttempts.find((s) => s.section === 'SPEAKING' && s.status === 'IN_PROGRESS');
    if (!sa || !sa.examSectionId) throw new BadRequestException('The speaking section is not in progress');
    if (sa.deadlineAt && sa.deadlineAt.getTime() + 15_000 < Date.now()) throw new ForbiddenException('Speaking time has expired');

    const question = await this.prisma.question.findFirst({ where: { id: input.questionId, examSectionId: sa.examSectionId } });
    if (!question) throw new NotFoundException('Question not part of this section');
    if (question.type !== 'SPEAKING_LISTEN_REPEAT' && question.type !== 'SPEAKING_INTERVIEW') {
      throw new BadRequestException('Not a speaking task');
    }
    const dup = await this.prisma.recording.findFirst({ where: { sectionAttemptId: sa.id, questionId: question.id } });
    if (dup) throw new ConflictException('This question already has a recording (answers cannot be redone)');
    if (!file || file.size === 0) throw new BadRequestException('Empty audio');

    const ext = input.mimeType.includes('ogg') ? 'ogg' : input.mimeType.includes('mp4') ? 'm4a' : input.mimeType.includes('wav') ? 'wav' : 'webm';
    const key = `recordings/${userId}/${attemptId}/${question.id}.${ext}`;
    await this.storage.save(key, file.buffer);

    // 1. Speech to text
    const stt = await this.ai.transcribe(file.buffer, `${question.id}.${ext}`, input.mimeType);
    let transcript = '';
    let source: 'whisper' | 'client' | 'none' = 'none';
    let confidence: number | null = null;
    let words: WordTiming[] | undefined;
    if (stt && stt.text) {
      transcript = stt.text;
      source = 'whisper';
      confidence = stt.confidence;
      words = stt.words;
    } else if (input.clientTranscript && input.clientTranscript.trim()) {
      transcript = input.clientTranscript.trim();
      source = 'client';
      confidence = typeof input.clientConfidence === 'number' && input.clientConfidence > 0 ? input.clientConfidence : null;
    }

    // 2. Delivery metrics
    const target = question.timeLimitSec ?? 45;
    const metrics = computeSpeechMetrics({
      transcript,
      durationSec: input.durationSec,
      targetSec: target,
      speechSegments: input.speechSegments,
      words,
    });

    // 3. Evaluation
    let analysis: RepeatAnalysis | InterviewAnalysis;
    let score: number;
    if (question.type === 'SPEAKING_LISTEN_REPEAT') {
      const a = this.evaluateRepeat(String(question.correctAnswer ?? ''), transcript, source, confidence);
      analysis = a;
      score = a.overall;
    } else {
      const a = await this.evaluateInterview(question.prompt, transcript, metrics, confidence, source);
      analysis = a;
      score = a.overall;
    }

    const rec = await this.prisma.recording.create({
      data: {
        sectionAttemptId: sa.id,
        questionId: question.id,
        fileUrl: key,
        durationSec: Math.round(input.durationSec),
        transcript,
        transcriptSource: source,
        mimeType: input.mimeType,
        metrics: json(metrics),
        analysis: json(analysis),
        score,
      },
    });
    return { id: rec.id, questionId: question.id, transcript, source, score, metrics, analysis };
  }

  evaluateRepeat(target: string, transcript: string, source: string, confidence: number | null): RepeatAnalysis {
    const al = alignWords(target, transcript);
    const score = repeatScore(al.accuracy, al.spoken.length);
    const notes: string[] = [];
    if (source === 'none') notes.push('No transcript available: speech recognition was not possible for this recording.');
    if (source === 'client') notes.push('Transcribed in the browser (less accurate than the server recognizer).');
    notes.push('Accuracy is measured with automatic recognition; it is a proxy for intelligibility, not a phoneme-level pronunciation score.');
    return {
      type: 'LISTEN_REPEAT',
      overall: score,
      target,
      heard: transcript,
      accuracy: al.accuracy,
      missing: al.missing,
      substitutions: al.substitutions,
      extra: al.extra,
      confidence: source === 'whisper' ? 0.75 : source === 'client' ? 0.5 : 0.2,
      notes: confidence == null ? notes : [...notes, `Recognizer confidence ≈ ${Math.round(confidence * 100)}%.`],
    };
  }

  async evaluateInterview(
    question: string,
    transcript: string,
    metrics: SpeechMetrics,
    asrConfidence: number | null,
    source: string,
  ): Promise<InterviewAnalysis> {
    const notes: string[] = [];
    const dims: Record<string, DimensionResult> = {};

    // Audio-derived dimensions (computed by code, never by the LLM).
    dims.fluency = {
      score: metrics.scores.fluency,
      source: 'audio',
      rationale: metrics.pauseDataAvailable
        ? `${metrics.longPauseCount} long pause(s) ≥1.5 s, ${metrics.longSilenceCount} silence(s) ≥3 s, ${metrics.fillers.count} filler(s), ${metrics.repetitions} repetition(s).`
        : 'Pause data unavailable; estimated from rate and fillers only.',
    };
    dims.pace = {
      score: metrics.scores.pace,
      source: 'audio',
      rationale: `${metrics.wordsPerMinute} words/min overall${metrics.articulationWpm ? ` (${metrics.articulationWpm} while speaking)` : ''}; comfortable range is about 110–170.`,
    };
    const asrScore = asrConfidence != null ? clamp5(((asrConfidence - 0.5) / 0.45) * 5) : null;
    dims.pronunciation = {
      score: asrScore != null ? half(asrScore) : null,
      source: 'asr-proxy',
      rationale: asrScore != null ? `Proxy from recognizer confidence (${Math.round((asrConfidence as number) * 100)}%): how reliably the words were understood.` : 'Not measured: the recognizer did not report confidence.',
    };
    dims.clarity = {
      score: asrScore != null ? half(0.7 * asrScore + 0.3 * metrics.scores.pace) : null,
      source: 'asr-proxy',
      rationale: asrScore != null ? 'Combines intelligibility (recognizer confidence) with an appropriate speaking rate.' : 'Not measured without recognizer confidence.',
    };
    dims.time_use = {
      score: metrics.scores.timeCompliance,
      source: 'audio',
      rationale: `Used ${metrics.usedSec}s of ${metrics.targetSec}s (${Math.round(metrics.timeUseRatio * 100)}%).`,
    };

    // Language dimensions (LLM + RAG, heuristic fallback).
    const wc = wordCount(transcript);
    let method: 'llm' | 'heuristic' = 'heuristic';
    let errors: WritingError[] = [];
    let strengths: string[] = [];
    let improvements: Array<{ priority: number; advice: string }> = [];
    let justification = '';
    let spread = 0;
    let citations: InterviewAnalysis['citations'] = [];
    let samples = 0;

    if (wc < 4) {
      for (const d of INTERVIEW_RATER_DIMS) dims[d] = { score: 0, source: 'heuristic', rationale: 'No scorable speech.' };
      justification = 'No scorable speech was detected in this answer.';
      notes.push(source === 'none' ? 'No transcript: speech recognition produced no text.' : 'Very short answer.');
    } else {
      const rag = await this.rag.evaluationContext('INTERVIEW', transcript, 2);
      citations = rag.citations;
      let agg = null as ReturnType<typeof aggregateRatings>;
      if (this.ai.hasLlm) {
        const n = Math.max(1, Math.min(3, Number(process.env.EVAL_SAMPLES ?? 2)));
        const system = 'You are an experienced, strict-but-fair English speaking rater. Score ONLY with the rubric, from the transcript. Return JSON only.';
        const user = [
          rag.text,
          '## INTERVIEW QUESTION',
          question,
          `## LEARNER ANSWER (spoken, transcribed, ${wc} words, ${metrics.durationSec}s)`,
          `"""${transcript}"""`,
          '## OUTPUT',
          `Return JSON: {"dimensions": {${INTERVIEW_RATER_DIMS.map((d) => `"${d}": {"score": 0-5 in 0.5 steps, "rationale": string}`).join(', ')}},`,
          '"errors": [{"original": exact quote, "correction": string, "type": string, "explanation": string}] (max 8),',
          '"strengths": [string] (max 3), "improvements": [{"priority": 1-3, "advice": string}] (max 3),',
          '"justification": string (3-4 sentences linking scores to the rubric)}',
        ].join('\n');
        const raws = (await Promise.all(Array.from({ length: n }, () => this.ai.completeJson<RawRating>(system, user, { temperature: 0.2, maxTokens: 1400 })))).filter((r): r is RawRating => !!r);
        agg = aggregateRatings(INTERVIEW_RATER_DIMS, transcript, raws);
      }
      if (agg) {
        method = 'llm';
        for (const d of INTERVIEW_RATER_DIMS) dims[d] = { score: agg.dimensions[d].score, source: 'llm', rationale: agg.dimensions[d].rationale };
        errors = agg.errors;
        strengths = agg.strengths;
        improvements = agg.improvements;
        justification = agg.justification;
        spread = agg.spread;
        samples = agg.samples;
      } else {
        const h = heuristicSpeechLanguage(transcript, metrics.targetSec);
        for (const d of INTERVIEW_RATER_DIMS) {
          dims[d] = { score: (h as unknown as Record<string, number>)[d], source: 'heuristic', rationale: 'Estimated from length, lexical variety and connector use (no LLM rater available).' };
        }
        improvements = this.speakingAdvice(dims, metrics);
        justification = 'Heuristic scoring: language dimensions are rough estimates from the transcript; delivery dimensions are computed from the audio.';
        notes.push('Heuristic language scoring — configure OPENAI_API_KEY for rubric-based evaluation with error feedback.');
      }
    }
    if (source === 'client') notes.push('Transcript produced by the browser recognizer; fillers and pronunciation details are often missing.');
    if (!metrics.pauseDataAvailable) notes.push('No pause data was captured, so fluency is estimated from speaking rate and fillers only.');
    if (metrics.fillers.count === 0 && source !== 'whisper') notes.push('Recognizers usually omit "um/uh", so filler counts may be under-reported.');

    // Weighted overall over the dimensions that were actually measured.
    let wsum = 0;
    let acc = 0;
    for (const [d, w] of Object.entries(INTERVIEW_WEIGHTS)) {
      const s = dims[d]?.score;
      if (typeof s === 'number') {
        wsum += w;
        acc += w * s;
      }
    }
    const overall = wc < 4 ? 0 : half(wsum ? acc / wsum : 0);
    return {
      type: 'INTERVIEW',
      overall,
      dimensions: dims,
      errors,
      strengths,
      improvements: improvements.length ? improvements : this.speakingAdvice(dims, metrics),
      justification,
      method,
      confidence: Math.round(Math.min(0.9, ratingConfidence({ method, spread, wordCount: wc, minWords: 60, samples }) * (source === 'whisper' ? 1 : 0.85)) * 100) / 100,
      citations,
      notes,
    };
  }

  private speakingAdvice(dims: Record<string, DimensionResult>, m: SpeechMetrics) {
    const out: Array<{ priority: number; advice: string }> = [];
    if (m.wordsPerMinute < 100) out.push({ priority: 1, advice: 'Speak more continuously: aim for 110–150 words per minute. Practise answering a question for 45 seconds without stopping.' });
    if ((m.longPauseCount ?? 0) >= 2) out.push({ priority: out.length + 1, advice: 'Reduce long pauses: use short phrases like "Let me think… I would say…" to keep going while you plan.' });
    if (m.fillers.perMinute > 4) out.push({ priority: out.length + 1, advice: 'Replace "um/uh" with a silent breath; pause briefly before the next idea.' });
    if (m.timeUseRatio < 0.7) out.push({ priority: out.length + 1, advice: 'Use the full time: give a reason, then an example, then a short conclusion.' });
    if ((dims.topic_development?.score ?? 5) < 3) out.push({ priority: out.length + 1, advice: 'Develop your idea: state your point, give a reason, and add a concrete example.' });
    return out.slice(0, 3).map((a, i) => ({ ...a, priority: i + 1 }));
  }

  // ───────────────────────────── Section finalization ─────────────────────────────

  async finalizeSection(sectionAttemptId: string): Promise<void> {
    const sa = await this.prisma.sectionAttempt.findUnique({ where: { id: sectionAttemptId }, include: { recordings: true } });
    if (!sa?.examSectionId) return;
    const questions = await this.prisma.question.findMany({ where: { examSectionId: sa.examSectionId }, orderBy: { order: 'asc' } });
    const byQ = new Map(sa.recordings.map((r) => [r.questionId, r]));

    const repeatScores: number[] = [];
    const interviewScores: number[] = [];
    const dimTotals = new Map<string, { sum: number; n: number }>();
    const confidences: number[] = [];

    for (const q of questions) {
      const rec = byQ.get(q.id);
      const score = rec?.score ?? 0;
      if (q.type === 'SPEAKING_LISTEN_REPEAT') repeatScores.push(score);
      else if (q.type === 'SPEAKING_INTERVIEW') {
        interviewScores.push(score);
        const analysis = rec?.analysis as unknown as InterviewAnalysis | null;
        if (analysis) {
          confidences.push(analysis.confidence);
          for (const [d, v] of Object.entries(analysis.dimensions)) {
            if (typeof v.score === 'number') {
              const t = dimTotals.get(d) ?? { sum: 0, n: 0 };
              t.sum += v.score;
              t.n += 1;
              dimTotals.set(d, t);
            }
          }
        }
      }
    }
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const repeatAvg = avg(repeatScores);
    const interviewAvg = avg(interviewScores);
    const scaled = Math.round(30 * (SPEAKING_WEIGHTS.listenRepeat * ratio5(repeatAvg) + SPEAKING_WEIGHTS.interview * ratio5(interviewAvg)));

    const breakdown: Record<string, unknown> = {
      'listen-repeat': { score: Math.round(repeatAvg * 10) / 10, max: 5, accuracy: ratio5(repeatAvg) },
      interview: { score: Math.round(interviewAvg * 10) / 10, max: 5, accuracy: ratio5(interviewAvg) },
    };
    for (const [d, t] of dimTotals) {
      const mean = t.sum / t.n;
      breakdown[`speaking:${d}`] = { score: Math.round(mean * 10) / 10, max: 5, accuracy: ratio5(mean) };
    }
    const sourceConf = sa.recordings.length ? avg(sa.recordings.map((r) => (r.transcriptSource === 'whisper' ? 0.75 : r.transcriptSource === 'client' ? 0.5 : 0.2))) : 0.2;
    const confidence = Math.round((confidences.length ? 0.5 * avg(confidences) + 0.5 * sourceConf : sourceConf) * 100) / 100;

    await this.scoring.saveSectionScore(sectionAttemptId, {
      rawCorrect: sa.recordings.length,
      rawTotal: questions.length,
      scaledScore: scaled,
      confidence,
      skillBreakdown: breakdown,
    });
  }

  // ───────────────────────────── Review ─────────────────────────────

  async list(userId: string) {
    const rows = await this.prisma.recording.findMany({
      where: { sectionAttempt: { examAttempt: { userId } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        sectionAttempt: { select: { examAttemptId: true, examAttempt: { select: { exam: { select: { title: true } } } } } },
      },
    });
    const qIds = rows.map((r) => r.questionId);
    const questions = await this.prisma.question.findMany({ where: { id: { in: qIds } }, select: { id: true, type: true, prompt: true } });
    const qMap = new Map(questions.map((q) => [q.id, q]));
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      attemptId: r.sectionAttempt.examAttemptId,
      examTitle: r.sectionAttempt.examAttempt.exam.title,
      type: qMap.get(r.questionId)?.type ?? null,
      prompt: qMap.get(r.questionId)?.prompt ?? '',
      durationSec: r.durationSec,
      score: r.score,
      transcript: r.transcript,
      metrics: r.metrics,
    }));
  }

  async get(userId: string, id: string) {
    const rec = await this.owned(userId, id);
    const q = await this.prisma.question.findUnique({ where: { id: rec.questionId } });
    return {
      id: rec.id,
      createdAt: rec.createdAt,
      type: q?.type,
      prompt: q?.prompt,
      target: q?.type === 'SPEAKING_LISTEN_REPEAT' ? q.correctAnswer : undefined,
      durationSec: rec.durationSec,
      transcript: rec.transcript,
      transcriptSource: rec.transcriptSource,
      score: rec.score,
      metrics: rec.metrics,
      analysis: rec.analysis,
    };
  }

  async audio(userId: string, id: string): Promise<{ data: Buffer; mime: string }> {
    const rec = await this.owned(userId, id);
    return { data: await this.storage.read(rec.fileUrl), mime: rec.mimeType ?? 'audio/webm' };
  }

  private async owned(userId: string, id: string) {
    const rec = await this.prisma.recording.findUnique({
      where: { id },
      include: { sectionAttempt: { select: { examAttempt: { select: { userId: true } } } } },
    });
    if (!rec) throw new NotFoundException('Recording not found');
    if (rec.sectionAttempt.examAttempt.userId !== userId) throw new ForbiddenException();
    return rec;
  }
}
