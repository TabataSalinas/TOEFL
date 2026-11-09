import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { sha1 } from '../content/text-utils';
import { KNOWLEDGE_SEED } from './knowledge.seed';
import { Bm25Index, cosine, rrf } from './retrieval';

export interface Chunk {
  id: string;
  key: string;
  kind: string;
  taskType: string;
  section: string | null;
  title: string;
  tags: string[];
  content: string;
  embedding: number[] | null;
}

export type PublicChunk = Omit<Chunk, 'embedding'>;

export interface EvaluationContext {
  rubrics: PublicChunk[];
  guidelines: PublicChunk[];
  anchors: PublicChunk[];
  /** Chunks the feedback is grounded on (shown to the learner). */
  citations: Array<{ id: string; title: string; kind: string }>;
  /** Prompt-ready text block. */
  text: string;
}

const strip = (c: Chunk): PublicChunk => {
  const { embedding: _e, ...rest } = c; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
};

/**
 * Retrieval-Augmented Generation for evaluations.
 *
 * - Rubrics and guidelines of the task are ALWAYS injected (deterministic) so every
 *   evaluation uses the same criteria → consistent scores.
 * - Anchor responses (examples with known scores) are retrieved by hybrid search
 *   (BM25 + embeddings when available, fused with reciprocal-rank fusion) so the
 *   model can calibrate against the most similar examples.
 * - The chunks used are returned as citations to ground the feedback.
 */
@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  private chunks: Chunk[] = this.seedAsChunks();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ingest();
    } catch (err) {
      this.logger.warn(`Knowledge ingest skipped, using in-memory seed: ${(err as Error).message}`);
    }
  }

  private seedAsChunks(): Chunk[] {
    return KNOWLEDGE_SEED.map((s) => ({
      id: `seed:${s.key}`,
      key: s.key,
      kind: s.kind,
      taskType: s.taskType,
      section: s.section,
      title: s.title,
      tags: s.tags,
      content: s.content,
      embedding: null,
    }));
  }

  /** Idempotent: upserts seed chunks by content hash, removes stale ones, adds embeddings. */
  async ingest(): Promise<{ total: number; embedded: number }> {
    const hashes: string[] = [];
    for (const s of KNOWLEDGE_SEED) {
      const contentHash = sha1(`${s.key}|${s.content}`);
      hashes.push(contentHash);
      const existing = await this.prisma.knowledgeChunk.findUnique({ where: { contentHash } });
      if (!existing) {
        await this.prisma.knowledgeChunk.create({
          data: {
            contentHash,
            section: s.section,
            kind: s.kind,
            taskType: s.taskType,
            title: s.title,
            content: s.content,
            tags: [...s.tags, 'seed', `key:${s.key}`],
            source: 'project-authored',
          },
        });
      }
    }
    await this.prisma.knowledgeChunk.deleteMany({
      where: { tags: { has: 'seed' }, NOT: { contentHash: { in: hashes } } },
    });

    // Embeddings (only when an LLM backend is configured).
    let embedded = 0;
    if (this.ai.hasLlm) {
      const missing = await this.prisma.knowledgeChunk.findMany({ where: { embedding: { equals: Prisma.DbNull } } });
      if (missing.length) {
        const vectors = await this.ai.embed(missing.map((m) => `${m.title}\n${m.content}`));
        if (vectors) {
          for (let i = 0; i < missing.length; i++) {
            await this.prisma.knowledgeChunk.update({
              where: { id: missing[i].id },
              data: { embedding: vectors[i] as unknown as Prisma.InputJsonValue },
            });
            embedded++;
          }
        }
      }
    }
    await this.reload();
    return { total: hashes.length, embedded };
  }

  private async reload(): Promise<void> {
    const rows = await this.prisma.knowledgeChunk.findMany();
    this.chunks = rows.map((r) => ({
      id: r.id,
      key: (r.tags.find((t) => t.startsWith('key:')) ?? `key:${r.id}`).slice(4),
      kind: r.kind,
      taskType: r.taskType ?? 'GENERAL',
      section: r.section,
      title: r.title ?? '',
      tags: r.tags.filter((t) => t !== 'seed' && !t.startsWith('key:')),
      content: r.content,
      embedding: Array.isArray(r.embedding) ? (r.embedding as number[]) : null,
    }));
  }

  /** Hybrid search over the knowledge base. */
  async retrieve(opts: { query: string; taskType?: string; kinds?: string[]; k?: number }): Promise<PublicChunk[]> {
    const k = opts.k ?? 3;
    const pool = this.chunks.filter(
      (c) =>
        (!opts.taskType || c.taskType === opts.taskType || c.taskType === 'GENERAL') &&
        (!opts.kinds || opts.kinds.includes(c.kind)),
    );
    if (pool.length === 0) return [];

    const lexical = new Bm25Index(pool.map((c) => ({ id: c.id, text: `${c.title} ${c.tags.join(' ')} ${c.content}` })));
    const lists: string[][] = [lexical.search(opts.query, k * 3).map((r) => r.id)];

    if (this.ai.hasLlm && pool.some((c) => c.embedding)) {
      const q = await this.ai.embed([opts.query.slice(0, 6000)]);
      if (q) {
        lists.push(
          pool
            .filter((c) => c.embedding)
            .map((c) => ({ id: c.id, s: cosine(q[0], c.embedding as number[]) }))
            .sort((a, b) => b.s - a.s)
            .slice(0, k * 3)
            .map((r) => r.id),
        );
      }
    }
    const byId = new Map(pool.map((c) => [c.id, c]));
    return rrf(lists)
      .slice(0, k)
      .map((r) => strip(byId.get(r.id) as Chunk));
  }

  /** Deterministic rubric/guideline block + similar anchors for one evaluation. */
  async evaluationContext(taskType: string, responseText: string, anchorCount = 2): Promise<EvaluationContext> {
    const rubrics = this.chunks
      .filter((c) => c.kind === 'rubric' && c.taskType === taskType)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(strip);
    const guidelines = this.chunks
      .filter((c) => c.kind === 'guideline' && (c.taskType === taskType || c.taskType === 'GENERAL'))
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(strip);
    const anchors = anchorCount
      ? await this.retrieve({ query: responseText, taskType, kinds: ['anchor'], k: anchorCount })
      : [];
    const block = (title: string, items: PublicChunk[]) =>
      items.length ? `## ${title}\n${items.map((c) => `### ${c.title}\n${c.content}`).join('\n\n')}` : '';
    const text = [block('RUBRIC', rubrics), block('GUIDELINES', guidelines), block('CALIBRATION EXAMPLES (already scored)', anchors)]
      .filter(Boolean)
      .join('\n\n');
    return {
      rubrics,
      guidelines,
      anchors,
      citations: [...rubrics, ...guidelines, ...anchors].map((c) => ({ id: c.id, title: c.title, kind: c.kind })),
      text,
    };
  }

  list(filter: { taskType?: string; kind?: string }): PublicChunk[] {
    return this.chunks
      .filter((c) => (!filter.taskType || c.taskType === filter.taskType) && (!filter.kind || c.kind === filter.kind))
      .sort((a, b) => a.taskType.localeCompare(b.taskType) || a.key.localeCompare(b.key))
      .map(strip);
  }
}
