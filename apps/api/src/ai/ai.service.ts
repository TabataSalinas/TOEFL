import { Injectable, Logger } from '@nestjs/common';
import {
  CoachSummaryInput,
  GenerateTaskParams,
  GeneratedTask,
  JsonCompletionOptions,
  TranscriptionResult,
} from './ai.types';
import { BankProvider } from './providers/bank.provider';
import { OpenAiProvider } from './providers/openai.provider';

/**
 * Facade over the AI capabilities.
 *
 * - Item generation: OpenAI when configured (with automatic fall-back to the curated
 *   offline bank on any error); otherwise the bank.
 * - Evaluation / embeddings / STT / TTS: OpenAI only. Methods return `null` when no
 *   LLM is available so callers can switch to deterministic heuristics.
 *
 * The platform therefore never hard-fails because of the AI layer.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai?: OpenAiProvider;

  constructor(private readonly bank: BankProvider) {
    const wantOpenAi = (process.env.AI_PROVIDER ?? 'openai') === 'openai' && !!process.env.OPENAI_API_KEY;
    if (wantOpenAi) this.openai = new OpenAiProvider();
    this.logger.log(`AI provider: ${wantOpenAi ? 'openai (fallback: bank)' : 'bank (offline)'}`);
  }

  get hasLlm(): boolean {
    return !!this.openai;
  }

  get activeProvider(): string {
    return this.openai ? 'openai' : 'bank';
  }

  async generateTask(params: GenerateTaskParams): Promise<GeneratedTask> {
    if (this.openai) {
      try {
        return await this.openai.generateTask(params);
      } catch (err) {
        this.logger.warn(`OpenAI generation of ${params.kind} failed, using bank: ${(err as Error).message}`);
      }
    }
    return this.bank.generateTask(params);
  }

  /** JSON completion; `null` when unavailable or failed (never throws). */
  async completeJson<T = Record<string, unknown>>(
    system: string,
    user: string,
    opts?: JsonCompletionOptions,
  ): Promise<T | null> {
    if (!this.openai) return null;
    try {
      return (await this.openai.completeJson(system, user, opts)) as T;
    } catch (err) {
      this.logger.warn(`completeJson failed: ${(err as Error).message}`);
      return null;
    }
  }

  async embed(texts: string[]): Promise<number[][] | null> {
    if (!this.openai || texts.length === 0) return null;
    try {
      return await this.openai.embed(texts);
    } catch (err) {
      this.logger.warn(`embed failed: ${(err as Error).message}`);
      return null;
    }
  }

  async transcribe(buffer: Buffer, filename: string, mime: string): Promise<TranscriptionResult | null> {
    if (!this.openai) return null;
    try {
      return await this.openai.transcribe(buffer, filename, mime);
    } catch (err) {
      this.logger.warn(`transcribe failed: ${(err as Error).message}`);
      return null;
    }
  }

  async speak(text: string, voice: string): Promise<Buffer | null> {
    if (!this.openai) return null;
    try {
      return await this.openai.speak(text, voice);
    } catch (err) {
      this.logger.warn(`speak failed: ${(err as Error).message}`);
      return null;
    }
  }

  async generateCoachSummary(input: CoachSummaryInput): Promise<string> {
    const fromLlm = await this.completeJson<{ summary?: string }>(
      'You are a supportive, concrete TOEFL tutor. Reply as JSON {"summary": string} with 4-6 specific, actionable sentences.',
      JSON.stringify(input),
      { temperature: 0.5, maxTokens: 400 },
    );
    if (fromLlm?.summary) return fromLlm.summary;
    return templateCoachSummary(input);
  }
}

export function templateCoachSummary(input: CoachSummaryInput): string {
  const gap = input.targetScore - input.estimatedTotal;
  const weak = input.weakestSkills
    .slice(0, 3)
    .map((w) => `${w.skillTag} (${Math.round(w.accuracy * 100)}% in ${w.section.toLowerCase()})`)
    .join(', ');
  const strong = input.strongestSkills
    .slice(0, 2)
    .map((s) => s.skillTag)
    .join(', ');
  return (
    `Your estimated total is ${input.estimatedTotal}/120 and your target is ${input.targetScore}/120 ` +
    `(${gap > 0 ? `a gap of ${gap} points` : 'you are at or above target'}). ` +
    `Your strongest areas are ${strong || 'still developing'}. ` +
    `Focus your next sessions on your weakest skills: ${weak || 'complete a full mock to build a profile'}. ` +
    `Short, frequent practice on these skills will yield the fastest score gains.`
  );
}
