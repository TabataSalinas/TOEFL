import { DIMENSIONS, WritingError, WritingTask, median } from './writing.heuristics';

/** Raw (untrusted) LLM rating of one sample. */
export interface RawRating {
  dimensions?: Record<string, { score?: unknown; rationale?: unknown }>;
  errors?: Array<Record<string, unknown>>;
  strengths?: unknown;
  improvements?: unknown;
  improvedVersion?: unknown;
  justification?: unknown;
}

export interface AggregatedRating {
  dimensions: Record<string, { score: number; rationale: string }>;
  overall: number;
  errors: WritingError[];
  strengths: string[];
  improvements: Array<{ priority: number; advice: string }>;
  improvedVersion: string | null;
  justification: string;
  /** Mean spread (max–min) of the dimension scores across samples. */
  spread: number;
  samples: number;
}

const half = (n: number) => Math.round(n * 2) / 2;
const clamp5 = (n: number) => Math.max(0, Math.min(5, n));

/** Does the quoted error text really appear in the response? (anti-hallucination) */
export function quoteAppears(response: string, quote: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const q = norm(quote);
  return q.length >= 2 && norm(response).includes(q);
}

function cleanErrors(raw: RawRating['errors'], response: string): WritingError[] {
  const out: WritingError[] = [];
  for (const e of raw ?? []) {
    const original = String(e.original ?? '').trim();
    const correction = String(e.correction ?? '').trim();
    if (!original || !correction || original === correction) continue;
    if (!quoteAppears(response, original)) continue;
    out.push({
      original,
      correction,
      type: String(e.type ?? 'language'),
      explanation: String(e.explanation ?? ''),
    });
    if (out.length >= 10) break;
  }
  return out;
}

/**
 * Combine several independent ratings into one stable rating:
 * median per dimension (robust to a single outlier), errors validated against the
 * response text, and the disagreement (spread) exposed for the confidence estimate.
 */
export function aggregateRatings(
  task: WritingTask | string[],
  response: string,
  samples: RawRating[],
): AggregatedRating | null {
  const dims = Array.isArray(task) ? task : DIMENSIONS[task];
  const valid = samples.filter((s) => s && s.dimensions && dims.every((d) => s.dimensions && s.dimensions[d] !== undefined));
  if (valid.length === 0) return null;

  const dimensions: AggregatedRating['dimensions'] = {};
  let spreadSum = 0;
  for (const d of dims) {
    const scores = valid.map((s) => clamp5(Number(s.dimensions?.[d]?.score ?? 0)));
    const med = half(median(scores));
    spreadSum += Math.max(...scores) - Math.min(...scores);
    const closest = valid.reduce((best, s) =>
      Math.abs(Number(s.dimensions?.[d]?.score) - med) < Math.abs(Number(best.dimensions?.[d]?.score) - med) ? s : best,
    );
    dimensions[d] = { score: med, rationale: String(closest.dimensions?.[d]?.rationale ?? '') };
  }
  const overall = half(Object.values(dimensions).reduce((a, d) => a + d.score, 0) / dims.length);

  const first = valid[0];
  const errors = valid.flatMap((s) => cleanErrors(s.errors, response));
  const dedup = errors.filter((e, i) => errors.findIndex((x) => x.original.toLowerCase() === e.original.toLowerCase()) === i).slice(0, 10);

  const strengths = (Array.isArray(first.strengths) ? first.strengths : []).map(String).slice(0, 3);
  const improvements = (Array.isArray(first.improvements) ? first.improvements : [])
    .map((x: unknown, i: number) => {
      const o = x as Record<string, unknown>;
      return { priority: Number(o?.priority ?? i + 1), advice: String(o?.advice ?? x) };
    })
    .slice(0, 3);

  return {
    dimensions,
    overall,
    errors: dedup,
    strengths,
    improvements,
    improvedVersion: typeof first.improvedVersion === 'string' && first.improvedVersion.trim() ? first.improvedVersion.trim() : null,
    justification: String(first.justification ?? ''),
    spread: spreadSum / dims.length,
    samples: valid.length,
  };
}

/** Confidence of a Writing/Speaking rating (0..1). */
export function ratingConfidence(opts: { method: 'llm' | 'heuristic'; spread: number; wordCount: number; minWords: number; samples: number }): number {
  if (opts.method === 'heuristic') return 0.35;
  let c = 0.82 - opts.spread * 0.25;
  if (opts.samples < 2) c -= 0.08;
  if (opts.wordCount < opts.minWords * 0.6) c -= 0.15;
  return Math.round(Math.max(0.3, Math.min(0.9, c)) * 100) / 100;
}
