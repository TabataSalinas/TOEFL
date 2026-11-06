import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { QuestionType } from '@prisma/client';
import {
  AiProvider,
  CoachSummaryInput,
  GenerateSectionParams,
  GeneratedSection,
} from '../ai.types';

/**
 * OpenAI-backed provider. Produces original TOEFL-style content via structured
 * JSON output. Throws on failure so the AiService can fall back to the mock
 * provider — the platform never hard-fails because of the AI layer.
 */
@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  }

  async generateSection(
    params: GenerateSectionParams,
  ): Promise<GeneratedSection> {
    const isObjective =
      params.section === 'READING' || params.section === 'LISTENING';

    const system = [
      'You are an expert TOEFL iBT item writer.',
      'Generate ORIGINAL academic content inspired by the structure and style of',
      'the TOEFL iBT. Never reproduce copyrighted ETS material.',
      'Return STRICT JSON only, matching the requested schema.',
    ].join(' ');

    const user = this.buildPrompt(params, isObjective);

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.9,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error('OpenAI returned empty content');

    const parsed = JSON.parse(raw) as GeneratedSection;
    return this.normalize(parsed, params);
  }

  private buildPrompt(
    params: GenerateSectionParams,
    isObjective: boolean,
  ): string {
    const avoid =
      params.avoidTopics && params.avoidTopics.length
        ? `Avoid these recently used topics: ${params.avoidTopics.join(', ')}.`
        : '';

    if (isObjective) {
      return [
        `Create a TOEFL ${params.section} section at "${params.difficulty}" difficulty.`,
        `Generate ${params.passages} ${
          params.section === 'READING' ? 'passages' : 'listening transcripts'
        }, each with ${params.questionsPerPassage} multiple-choice questions.`,
        avoid,
        'Each passage must be 220-320 words, academic in tone, and self-contained.',
        'Each question must have exactly 4 options (ids "A","B","C","D"), one correct answer,',
        'a clear explanation, and a skillTag (e.g. "inference","vocabulary","detail","main-idea").',
        'JSON schema:',
        '{ "section": string, "instructions": string, "passages": [',
        '  { "title": string, "topic": string, "body": string,',
        '    "audioScript": string | null,',
        '    "questions": [ { "type": string, "prompt": string,',
        '      "options": [ {"id": string, "text": string} ],',
        '      "correctAnswer": string, "explanation": string,',
        '      "skillTag": string, "points": number } ] } ] }',
      ].join('\n');
    }

    return [
      `Create a TOEFL ${params.section} section at "${params.difficulty}" difficulty.`,
      'Generate 2 tasks (one independent, one integrated with a short stimulus).',
      avoid,
      'JSON schema:',
      '{ "section": string, "instructions": string, "passages": [],',
      '  "tasks": [ { "type": string, "prompt": string, "skillTag": string,',
      '  "stimulus": string | null } ] }',
    ].join('\n');
  }

  /** Clamp/validate the model output into known enums and shapes. */
  private normalize(
    section: GeneratedSection,
    params: GenerateSectionParams,
  ): GeneratedSection {
    const validTypes = new Set(Object.values(QuestionType));
    const fallbackType: QuestionType =
      params.section === 'READING' ? 'READING_FACTUAL' : 'LISTENING_DETAIL';

    const passages = (section.passages ?? []).map((p) => ({
      title: p.title ?? 'Untitled',
      body: p.body ?? '',
      topic: p.topic ?? 'general',
      audioScript: p.audioScript,
      questions: (p.questions ?? []).map((q) => ({
        type: validTypes.has(q.type) ? q.type : fallbackType,
        prompt: q.prompt ?? '',
        options: q.options ?? [],
        correctAnswer: q.correctAnswer ?? 'A',
        explanation: q.explanation ?? '',
        skillTag: q.skillTag ?? 'general',
        points: q.points ?? 1,
      })),
    }));

    return {
      section: params.section,
      instructions: section.instructions ?? '',
      timeLimitSec: 0,
      passages,
      tasks: section.tasks,
    };
  }

  async generateCoachSummary(input: CoachSummaryInput): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.6,
      messages: [
        {
          role: 'system',
          content:
            'You are a supportive, concrete TOEFL tutor. Give actionable, specific advice in 4-6 sentences.',
        },
        {
          role: 'user',
          content: `Target total: ${input.targetScore}/120. Estimated total: ${input.estimatedTotal}/120. Weakest skills: ${JSON.stringify(input.weakestSkills)}. Strongest: ${JSON.stringify(input.strongestSkills)}. Write a short coaching summary.`,
        },
      ],
    });
    return completion.choices[0]?.message?.content ?? '';
  }
}
