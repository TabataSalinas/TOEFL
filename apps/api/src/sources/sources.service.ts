import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroundingDoc } from '../ai/ai.types';

/**
 * Open-license grounding sources.
 *
 * Facts are fetched ONLY to give the item writer accurate material; the generated
 * passage is written in original words. License + URL are stored with every
 * document and attached to the passage (`sourceRefs`) for attribution.
 *
 * Providers: Wikipedia (CC BY-SA 4.0). More are documented in docs/CONTENT_SOURCES.md
 * (OpenStax CC BY 4.0, NASA / USGS / NOAA public domain, Project Gutenberg PD).
 * Wikimedia requires a descriptive User-Agent — set CONTACT_EMAIL in the environment.
 */
@Injectable()
export class SourcesService {
  private readonly logger = new Logger(SourcesService.name);

  constructor(private readonly prisma: PrismaService) {}

  get enabled(): boolean {
    return process.env.SOURCES_ENABLED === 'true';
  }

  private userAgent(): string {
    const contact = process.env.CONTACT_EMAIL ?? 'unset@example.invalid';
    return `ToeflAiPrep/0.2 (personal study tool; contact: ${contact})`;
  }

  private async getJson(url: string): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': this.userAgent(), Accept: 'application/json' }, signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /** Return up to `max` grounding documents about `topic` (cached in the DB). */
  async groundingFor(topic: string, max = 1): Promise<GroundingDoc[]> {
    if (!this.enabled) return [];
    try {
      const cached = await this.prisma.sourceDocument.findMany({ where: { topic }, take: max });
      if (cached.length) return cached.map((d) => this.toDoc(d));

      const search = await this.getJson(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&srlimit=1&format=json`,
      );
      const title: string | undefined = search?.query?.search?.[0]?.title;
      if (!title) return [];
      const ext = await this.getJson(
        `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exchars=2500&titles=${encodeURIComponent(title)}&format=json`,
      );
      const page = Object.values(ext?.query?.pages ?? {})[0] as { extract?: string } | undefined;
      const text = page?.extract?.trim();
      if (!text || text.length < 300) return [];
      const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
      const saved = await this.prisma.sourceDocument.upsert({
        where: { url },
        update: { text, topic },
        create: { provider: 'wikipedia', title, url, license: 'CC BY-SA 4.0', topic, text },
      });
      return [this.toDoc(saved)];
    } catch (err) {
      this.logger.warn(`Grounding for "${topic}" unavailable: ${(err as Error).message}`);
      return [];
    }
  }

  private toDoc(d: { provider: string; title: string; url: string; license: string; text: string }): GroundingDoc {
    return { provider: d.provider, title: d.title, url: d.url, license: d.license, text: d.text };
  }
}
