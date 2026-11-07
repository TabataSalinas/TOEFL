import { STOPWORDS, words } from '../content/text-utils';

/** Light stemmer: enough to match "writing/writes/written" style variants. */
export function stem(w: string): string {
  return w
    .replace(/(ing|edly|ed|ly|es|s)$/i, '')
    .replace(/(.)\1$/, '$1');
}

export function tokenize(text: string): string[] {
  return words(text)
    .filter((w) => !STOPWORDS.has(w) && w.length > 1)
    .map(stem);
}

export interface IndexDoc {
  id: string;
  text: string;
}

/** Okapi BM25 over a small in-memory corpus. */
export class Bm25Index {
  private readonly tf: Map<string, Map<string, number>> = new Map();
  private readonly len: Map<string, number> = new Map();
  private readonly df: Map<string, number> = new Map();
  private readonly avgLen: number;

  constructor(
    docs: IndexDoc[],
    private readonly k1 = 1.5,
    private readonly b = 0.75,
  ) {
    let total = 0;
    for (const d of docs) {
      const toks = tokenize(d.text);
      total += toks.length;
      this.len.set(d.id, toks.length);
      const counts = new Map<string, number>();
      for (const t of toks) counts.set(t, (counts.get(t) ?? 0) + 1);
      this.tf.set(d.id, counts);
      for (const t of counts.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    }
    this.avgLen = docs.length ? total / docs.length : 0;
  }

  search(query: string, k = 5): Array<{ id: string; score: number }> {
    const q = tokenize(query);
    const n = this.tf.size;
    const scores: Array<{ id: string; score: number }> = [];
    for (const [id, counts] of this.tf) {
      let score = 0;
      const dl = this.len.get(id) ?? 0;
      for (const term of q) {
        const f = counts.get(term) ?? 0;
        if (!f) continue;
        const df = this.df.get(term) ?? 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        score += (idf * (f * (this.k1 + 1))) / (f + this.k1 * (1 - this.b + (this.b * dl) / (this.avgLen || 1)));
      }
      if (score > 0) scores.push({ id, score });
    }
    return scores.sort((a, b) => b.score - a.score).slice(0, k);
  }
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/** Reciprocal-rank fusion of several ranked id lists. */
export function rrf(lists: string[][], k = 60): Array<{ id: string; score: number }> {
  const acc = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, rank) => acc.set(id, (acc.get(id) ?? 0) + 1 / (k + rank + 1)));
  }
  return [...acc.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
}
