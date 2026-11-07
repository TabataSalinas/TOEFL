import { Logger } from '@nestjs/common';
import OpenAI, { toFile } from 'openai';
import {
  AiProvider,
  GenerateTaskParams,
  GeneratedStimulus,
  GeneratedTask,
  JsonCompletionOptions,
  TranscriptionResult,
} from '../ai.types';
import { buildPrompt, parseLlmTask } from '../llm-task';
import { validateStimulus } from '../../content/quality';
import { TaskKind } from '../../common/toefl.constants';

const VERIFIABLE: TaskKind[] = ['ACADEMIC_PASSAGE', 'ACADEMIC_TALK', 'CONVERSATION', 'DAILY_LIFE'];

/**
 * OpenAI-backed provider: item generation (JSON mode), self-verification of the answer
 * key, embeddings (RAG), speech-to-text (Whisper) and text-to-speech.
 * Failures throw so AiService can fall back to the offline bank.
 */
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly client: OpenAI;
  readonly model: string;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  }

  async completeJson(system: string, user: string, opts: JsonCompletionOptions = {}): Promise<Record<string, unknown>> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      temperature: opts.temperature ?? 0.8,
      max_tokens: opts.maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const content = res.choices[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned empty content');
    return JSON.parse(content) as Record<string, unknown>;
  }

  async generateTask(params: GenerateTaskParams): Promise<GeneratedTask> {
    const { system, user } = buildPrompt(params);
    let feedback = '';
    let lastError: Error = new Error('generation failed');

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const raw = await this.completeJson(system, user + feedback, {
          temperature: attempt === 0 ? 0.9 : 0.6,
          maxTokens: 3500,
        });
        const stimuli = parseLlmTask(params, raw);
        this.assertQuality(params, stimuli);
        if (VERIFIABLE.includes(params.kind) && process.env.AI_VERIFY_KEYS !== 'false') {
          await this.verifyKeys(stimuli);
        }
        return { kind: params.kind, stimuli, generatedBy: this.name };
      } catch (err) {
        lastError = err as Error;
        this.logger.warn(`Attempt ${attempt + 1} for ${params.kind} rejected: ${lastError.message}`);
        feedback = `\n\nYour previous answer was rejected for these reasons: ${lastError.message}. Fix them and return the complete JSON again.`;
      }
    }
    throw lastError;
  }

  private assertQuality(params: GenerateTaskParams, stimuli: GeneratedStimulus[]): void {
    const problems: string[] = [];
    stimuli.forEach((s, i) => {
      const expected = params.questionCounts[i] ?? params.questionCounts[0];
      const rep = validateStimulus(params.kind, s, expected, { recentTexts: params.avoidTexts });
      if (!rep.ok) problems.push(`stimulus ${i + 1}: ${rep.problems.join('; ')}`);
    });
    if (problems.length) throw new Error(problems.join(' | '));
  }

  /** Blind second pass: another call answers the questions; large disagreement rejects the item. */
  private async verifyKeys(stimuli: GeneratedStimulus[]): Promise<void> {
    const payload = stimuli.map((s, si) => ({
      stimulus: si,
      text: s.body,
      questions: s.questions.map((q, qi) => ({ question: qi, prompt: q.prompt, options: (q.options ?? []).map((o) => o.text) })),
    }));
    const res = await this.completeJson(
      'You are a careful test taker. For each question choose the single best option using only the text. Return JSON {"answers":[{"stimulus":int,"question":int,"choice":0-3}]}.',
      JSON.stringify(payload),
      { temperature: 0, maxTokens: 800 },
    );
    const answers = Array.isArray(res.answers) ? (res.answers as Array<{ stimulus: number; question: number; choice: number }>) : [];
    let total = 0;
    let mismatches = 0;
    stimuli.forEach((s, si) =>
      s.questions.forEach((q, qi) => {
        total++;
        const a = answers.find((x) => x.stimulus === si && x.question === qi);
        const keyIdx = ['A', 'B', 'C', 'D'].indexOf(String(q.correctAnswer));
        if (!a || a.choice !== keyIdx) mismatches++;
      }),
    );
    if (total > 0 && mismatches / total > 0.2) {
      throw new Error(`answer-key verification disagreed on ${mismatches}/${total} questions`);
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await this.client.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
      input: texts,
    });
    return res.data.map((d) => d.embedding);
  }

  async transcribe(buffer: Buffer, filename: string, mime: string): Promise<TranscriptionResult> {
    const file = await toFile(buffer, filename, { type: mime });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (await this.client.audio.transcriptions.create({
      file,
      model: process.env.OPENAI_STT_MODEL ?? 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment'],
      language: 'en',
    } as any)) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const segments: Array<{ avg_logprob?: number }> = res.segments ?? [];
    const logprobs = segments.map((s) => s.avg_logprob).filter((x): x is number => typeof x === 'number');
    const confidence = logprobs.length ? Math.exp(logprobs.reduce((a, b) => a + b, 0) / logprobs.length) : null;
    return {
      text: String(res.text ?? '').trim(),
      durationSec: Number(res.duration ?? 0),
      words: ((res.words ?? []) as Array<{ word: string; start: number; end: number }>).map((w) => ({ word: w.word, start: w.start, end: w.end })),
      confidence,
    };
  }

  async speak(text: string, voice: string): Promise<Buffer> {
    const res = await this.client.audio.speech.create({
      model: process.env.OPENAI_TTS_MODEL ?? 'tts-1',
      voice: voice as 'alloy',
      input: text,
    });
    return Buffer.from(await res.arrayBuffer());
  }
}
