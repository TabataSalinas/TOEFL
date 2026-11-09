import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { RagService } from '../rag/rag.service';
import { ScoringService } from '../scoring/scoring.service';
import { WRITING_WEIGHTS } from '../common/toefl.constants';
import { wordCount } from '../content/text-utils';
import { DIMENSIONS, WritingError, WritingTask, heuristicWriting } from './writing.heuristics';
import { RawRating, aggregateRatings, ratingConfidence } from './writing.aggregate';
import { ratio5 } from '../scoring/scoring.util';

export interface WritingFeedback {
  taskType: WritingTask;
  overall: number;
  dimensions: Record<string, { score: number; rationale: string }>;
  errors: WritingError[];
  strengths: string[];
  improvements: Array<{ priority: number; advice: string }>;
  improvedVersion: string | null;
  justification: string;
  wordCount: number;
  method: 'llm' | 'heuristic';
  confidence: number;
  samples: number;
  spread: number;
  citations: Array<{ id: string; title: string; kind: string }>;
  note?: string;
}

export interface WritingContext {
  /** Human-readable task statement given to the rater. */
  prompt: string;
  bullets?: string[];
  studentNames?: string[];
}

const MIN_WORDS: Record<WritingTask, number> = { WRITE_EMAIL: 60, ACADEMIC_DISCUSSION: 100 };

const json = (v: unknown) => v as unknown as Prisma.InputJsonValue;

@Injectable()
export class WritingService {
  private readonly logger = new Logger(WritingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly rag: RagService,
    private readonly scoring: ScoringService,
  ) {}

  /** Evaluate one response against the rubric (LLM + RAG, heuristic fallback). */
  async evaluate(task: WritingTask, ctx: WritingContext, response: string): Promise<WritingFeedback> {
    const text = response.trim();
    const wc = wordCount(text);
    const dims = DIMENSIONS[task];

    if (wc < 5) {
      return {
        taskType: task,
        overall: 0,
        dimensions: Object.fromEntries(dims.map((d) => [d, { score: 0, rationale: 'No scorable response.' }])),
        errors: [],
        strengths: [],
        improvements: [{ priority: 1, advice: 'Write a complete response; even a short draft lets the rater give useful feedback.' }],
        improvedVersion: null,
        justification: 'The response is empty or too short to evaluate, so every dimension scores 0.',
        wordCount: wc,
        method: 'heuristic',
        confidence: 0.9,
        samples: 0,
        spread: 0,
        citations: [],
      };
    }

    const rag = await this.rag.evaluationContext(task, text, 2);

    if (this.ai.hasLlm) {
      const n = Math.max(1, Math.min(3, Number(process.env.EVAL_SAMPLES ?? 2)));
      const system =
        'You are an experienced, strict-but-fair English writing rater. Score ONLY with the supplied rubric and calibrate against the scored examples. ' +
        'Quote the learner exactly when you cite errors. Return JSON only.';
      const user = this.buildUserPrompt(task, ctx, text, wc, rag.text);
      const samples = (
        await Promise.all(Array.from({ length: n }, () => this.ai.completeJson<RawRating>(system, user, { temperature: 0.2, maxTokens: 2200 })))
      ).filter((s): s is RawRating => !!s);
      const agg = aggregateRatings(task, text, samples);
      if (agg) {
        return {
          taskType: task,
          overall: agg.overall,
          dimensions: agg.dimensions,
          errors: agg.errors,
          strengths: agg.strengths,
          improvements: agg.improvements,
          improvedVersion: agg.improvedVersion,
          justification: agg.justification,
          wordCount: wc,
          method: 'llm',
          confidence: ratingConfidence({ method: 'llm', spread: agg.spread, wordCount: wc, minWords: MIN_WORDS[task], samples: agg.samples }),
          samples: agg.samples,
          spread: Math.round(agg.spread * 100) / 100,
          citations: rag.citations,
        };
      }
      this.logger.warn('LLM evaluation unavailable; using heuristic fallback.');
    }

    const h = heuristicWriting(task, text, { bullets: ctx.bullets, studentNames: ctx.studentNames });
    return {
      taskType: task,
      overall: h.overall,
      dimensions: h.dimensions,
      errors: h.errors.slice(0, 10),
      strengths: [],
      improvements: this.heuristicAdvice(task, h.dimensions, wc),
      improvedVersion: null,
      justification: `Heuristic scoring (no LLM rater available): scores come from coverage, length, structure markers, error patterns and lexical variety. Configure OPENAI_API_KEY for rubric-based AI evaluation with corrections and a model rewrite.`,
      wordCount: wc,
      method: 'heuristic',
      confidence: ratingConfidence({ method: 'heuristic', spread: 0, wordCount: wc, minWords: MIN_WORDS[task], samples: 0 }),
      samples: 0,
      spread: 0,
      citations: rag.citations,
      note: 'Heuristic mode — treat as a rough indicator.',
    };
  }

  private buildUserPrompt(task: WritingTask, ctx: WritingContext, text: string, wc: number, ragText: string): string {
    const dims = DIMENSIONS[task];
    return [
      ragText,
      '## TASK GIVEN TO THE LEARNER',
      ctx.prompt,
      `## LEARNER RESPONSE (${wc} words)`,
      `"""${text}"""`,
      '## OUTPUT',
      `Return JSON: {"dimensions": {${dims.map((d) => `"${d}": {"score": number 0-5 in 0.5 steps, "rationale": string (1-2 sentences, quote the response)}`).join(', ')}},`,
      '"errors": [{"original": exact quote from the response, "correction": string, "type": string, "explanation": string}] (max 10, most important first, never invent text),',
      '"strengths": [string] (max 3),',
      '"improvements": [{"priority": 1-3, "advice": string (concrete, practisable)}] (max 3),',
      '"improvedVersion": string (rewrite of the learner response, similar length, keeping their ideas, fixing errors and strengthening weak dimensions),',
      '"justification": string (3-5 sentences linking the scores to the rubric wording)}',
    ].join('\n');
  }

  private heuristicAdvice(task: WritingTask, dims: Record<string, { score: number }>, wc: number) {
    const advice: Array<{ priority: number; advice: string }> = [];
    const sorted = Object.entries(dims).sort((a, b) => a[1].score - b[1].score);
    const tips: Record<string, string> = {
      task_fulfillment: 'Re-read the bullet points and give each one at least two specific sentences.',
      organization_coherence: 'Use a greeting, one paragraph per purpose, and a closing line; add connectors like "however" and "as a result".',
      grammar_accuracy: 'Proofread once for articles, subject–verb agreement and verb tense before submitting.',
      vocabulary_register: 'Replace repeated general words with precise ones and keep a polite, professional tone.',
      contribution_to_discussion: 'State your position in the first sentence and respond to a classmate by name.',
      development_support: 'Give two reasons and support each with a concrete example ("For instance, …").',
      coherence_cohesion: 'Link ideas with transitions (because, however, as a result) instead of only "and".',
      language_use: 'Vary your sentence structures and use more precise academic vocabulary.',
    };
    for (const [d] of sorted.slice(0, 3)) advice.push({ priority: advice.length + 1, advice: tips[d] ?? 'Revise this dimension.' });
    if (wc < MIN_WORDS[task]) advice.unshift({ priority: 1, advice: `Aim for at least ${MIN_WORDS[task]} words so your ideas can be developed.` });
    return advice.slice(0, 3).map((a, i) => ({ ...a, priority: i + 1 }));
  }

  // ───────────────────────── Section finalization ─────────────────────────

  /**
   * Evaluate the open tasks of a finished Writing section, store essays, and save the
   * 0–30 section score (Build a Sentence 20%, Email 35%, Discussion 45%).
   */
  async finalizeSection(sectionAttemptId: string): Promise<void> {
    const sa = await this.prisma.sectionAttempt.findUnique({ where: { id: sectionAttemptId }, include: { answers: true } });
    if (!sa?.examSectionId) return;

    const grade = await this.scoring.gradeModule(sectionAttemptId); // Build a Sentence
    const questions = await this.prisma.question.findMany({
      where: { examSectionId: sa.examSectionId, points: 0 },
      include: { passage: true },
      orderBy: { order: 'asc' },
    });

    const results: Record<string, WritingFeedback> = {};
    await Promise.all(
      questions.map(async (q) => {
        const task = q.type === 'WRITING_EMAIL' ? 'WRITE_EMAIL' : q.type === 'WRITING_ACADEMIC_DISCUSSION' ? 'ACADEMIC_DISCUSSION' : null;
        if (!task) return;
        const answer = sa.answers.find((a) => a.questionId === q.id);
        const text = typeof answer?.response === 'string' ? answer.response : '';
        const meta = (q.passage?.meta ?? {}) as { to?: string; subject?: string; bullets?: string[]; professor?: string; students?: Array<{ name: string; post: string }> };
        const ctx: WritingContext =
          task === 'WRITE_EMAIL'
            ? {
                prompt: `${q.passage?.body ?? ''}\nWrite an email to ${meta.to ?? 'the recipient'} (subject: ${meta.subject ?? ''}). The email must: ${(meta.bullets ?? []).map((b, i) => `(${i + 1}) ${b}`).join(' ')}`,
                bullets: meta.bullets,
              }
            : {
                prompt: `Professor: ${meta.professor ?? ''}\n${(meta.students ?? []).map((s) => `${s.name}: ${s.post}`).join('\n')}\nThe learner must write a post (at least 100 words) that states and supports an opinion and contributes to the discussion in their own words.`,
                studentNames: (meta.students ?? []).map((s) => s.name),
              };
        const feedback = await this.evaluate(task, ctx, text);
        results[task] = feedback;
        await this.prisma.essay.create({
          data: {
            sectionAttemptId,
            questionId: q.id,
            content: text,
            wordCount: feedback.wordCount,
            taskType: task,
            score: feedback.overall,
            feedback: json(feedback),
          },
        });
      }),
    );

    const email = results.WRITE_EMAIL?.overall ?? 0;
    const discussion = results.ACADEMIC_DISCUSSION?.overall ?? 0;
    const bs = grade.accuracy;
    const ratio = WRITING_WEIGHTS.buildSentence * bs + WRITING_WEIGHTS.email * ratio5(email) + WRITING_WEIGHTS.discussion * ratio5(discussion);
    const scaled = Math.round(ratio * 30);

    const breakdown: Record<string, unknown> = {
      'build-sentence': { correct: grade.correct, total: grade.total, accuracy: grade.accuracy },
      'write-email': { score: email, max: 5, accuracy: ratio5(email) },
      'academic-discussion': { score: discussion, max: 5, accuracy: ratio5(discussion) },
    };
    for (const [task, fb] of Object.entries(results)) {
      for (const [dim, v] of Object.entries(fb.dimensions)) {
        breakdown[`${task === 'WRITE_EMAIL' ? 'email' : 'discussion'}:${dim}`] = { score: v.score, max: 5, accuracy: ratio5(v.score) };
      }
    }
    const confs = Object.values(results).map((r) => r.confidence);
    const confidence = confs.length ? (confs.reduce((a, b) => a + b, 0) / confs.length) * 0.85 + 0.15 * 0.8 : 0.3;
    await this.scoring.saveSectionScore(sectionAttemptId, {
      rawCorrect: grade.correct,
      rawTotal: grade.total,
      scaledScore: scaled,
      confidence: Math.round(confidence * 100) / 100,
      skillBreakdown: breakdown,
    });
  }
}
