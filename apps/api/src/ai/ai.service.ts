import { Injectable, Logger } from '@nestjs/common';
import {
  AiProvider,
  CoachSummaryInput,
  GenerateSectionParams,
  GeneratedSection,
} from './ai.types';
import { MockAiProvider } from './providers/mock.provider';
import { OpenAiProvider } from './providers/openai.provider';

/**
 * Facade over the configured AI provider.
 *
 * Resolution order:
 *  1. If AI_PROVIDER=openai AND OPENAI_API_KEY is set -> OpenAI, with automatic
 *     fallback to the mock provider on any error.
 *  2. Otherwise -> deterministic mock provider.
 *
 * This guarantees the platform is always functional, even offline or without a key.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly primary: AiProvider;
  private readonly fallback: MockAiProvider;
  private readonly usingOpenAi: boolean;

  constructor(mock: MockAiProvider) {
    this.fallback = mock;
    const wantOpenAi =
      (process.env.AI_PROVIDER ?? 'openai') === 'openai' &&
      !!process.env.OPENAI_API_KEY;
    this.usingOpenAi = wantOpenAi;
    this.primary = wantOpenAi ? new OpenAiProvider() : mock;
    this.logger.log(
      `AI provider: ${this.primary.name}${wantOpenAi ? ' (fallback: mock)' : ''}`,
    );
  }

  get activeProvider(): string {
    return this.primary.name;
  }

  async generateSection(
    params: GenerateSectionParams,
  ): Promise<GeneratedSection> {
    if (!this.usingOpenAi) return this.fallback.generateSection(params);
    try {
      return await this.primary.generateSection(params);
    } catch (err) {
      this.logger.warn(
        `OpenAI generation failed, falling back to mock: ${(err as Error).message}`,
      );
      return this.fallback.generateSection(params);
    }
  }

  async generateCoachSummary(input: CoachSummaryInput): Promise<string> {
    if (!this.usingOpenAi) return this.fallback.generateCoachSummary(input);
    try {
      return await this.primary.generateCoachSummary(input);
    } catch (err) {
      this.logger.warn(
        `OpenAI coach summary failed, falling back to mock: ${(err as Error).message}`,
      );
      return this.fallback.generateCoachSummary(input);
    }
  }
}
