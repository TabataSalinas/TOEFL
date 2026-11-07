import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { sha1 } from '../content/text-utils';

export interface Turn {
  speaker: string;
  text: string;
}

const VOICES: Record<string, string> = {
  Woman: 'nova',
  Man: 'onyx',
  Professor: 'echo',
  Announcer: 'shimmer',
  Trainer: 'nova',
  Interviewer: 'alloy',
};

/**
 * Server-side text-to-speech with disk cache. When no OpenAI key is configured
 * every method returns null and the browser falls back to its own speech synthesis.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly ai: AiService,
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  private voiceFor(speaker: string, fallback = 'alloy'): string {
    return VOICES[speaker] ?? fallback;
  }

  /** Synthesize (or reuse cached) audio for a text; returns the storage key. */
  async ttsKey(text: string, speaker: string): Promise<string | null> {
    if (!this.ai.hasLlm) return null;
    const voice = this.voiceFor(speaker);
    const key = `tts/${sha1(`${voice}|${text}`)}.mp3`;
    if (await this.storage.exists(key)) return key;
    const audio = await this.ai.speak(text, voice);
    if (!audio) return null;
    await this.storage.save(key, audio);
    return key;
  }

  /** Ensure every passage of a module has audio; stores keys in passage.meta.audio. */
  async ensurePassageAudio(passageIds: string[]): Promise<void> {
    if (!this.ai.hasLlm) return;
    const passages = await this.prisma.passage.findMany({ where: { id: { in: passageIds } } });
    await Promise.all(
      passages.map(async (p) => {
        const meta = (p.meta ?? {}) as { turns?: Turn[]; audio?: string[] };
        if (!meta.turns?.length || meta.audio?.length === meta.turns.length) return;
        const keys = await Promise.all(meta.turns.map((t) => this.ttsKey(t.text, t.speaker)));
        if (keys.some((k) => !k)) return; // partial failure: keep browser fallback
        await this.prisma.passage.update({
          where: { id: p.id },
          data: { meta: { ...meta, audio: keys } as unknown as Prisma.InputJsonValue },
        });
      }),
    );
  }

  /** Same for speaking prompts (Listen and Repeat sentences / interviewer questions). */
  async ensureQuestionAudio(questionIds: string[], speaker: string): Promise<void> {
    if (!this.ai.hasLlm) return;
    const questions = await this.prisma.question.findMany({ where: { id: { in: questionIds } } });
    await Promise.all(
      questions.map(async (q) => {
        const meta = (q.meta ?? {}) as { audioText?: string; audio?: string };
        if (!meta.audioText || meta.audio) return;
        const key = await this.ttsKey(meta.audioText, speaker);
        if (!key) return;
        await this.prisma.question.update({
          where: { id: q.id },
          data: { meta: { ...meta, audio: key } as unknown as Prisma.InputJsonValue },
        });
      }),
    );
  }

  async read(key: string): Promise<Buffer> {
    return this.storage.read(key);
  }

  static urlFor(key: string): string {
    return `/media/${key}`;
  }
}
