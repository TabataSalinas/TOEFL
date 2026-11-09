import { createHash } from 'crypto';

/** Seeded RNG (mulberry32) so generation is reproducible in tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
}

export function pick<T>(arr: readonly T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

export function shuffle<T>(arr: readonly T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sha1(text: string): string {
  return createHash('sha1').update(text).digest('hex');
}

/** Lowercased word tokens (letters and inner apostrophes). */
export function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+(?:['’][a-z]+)*/g) ?? []) as string[];
}

export function wordCount(text: string): number {
  return words(text).length;
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])["')\]]*\s+(?=[A-Z"“(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const stripped = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = stripped.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** Flesch–Kincaid grade level. */
export function fleschKincaidGrade(text: string): number {
  const ws = words(text);
  const sentences = Math.max(1, splitSentences(text).length);
  if (ws.length === 0) return 0;
  const syllables = ws.reduce((n, w) => n + countSyllables(w), 0);
  return 0.39 * (ws.length / sentences) + 11.8 * (syllables / ws.length) - 15.59;
}

/** Word n-gram shingles used for near-duplicate detection. */
export function shingles(text: string, n = 4): Set<string> {
  const ws = words(text);
  const out = new Set<string>();
  if (ws.length < n) {
    if (ws.length) out.add(ws.join(' '));
    return out;
  }
  for (let i = 0; i <= ws.length - n; i++) out.add(ws.slice(i, i + n).join(' '));
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Highest Jaccard similarity between `text` and any of `others`. */
export function maxSimilarity(text: string, others: string[]): number {
  const s = shingles(text);
  let best = 0;
  for (const o of others) best = Math.max(best, jaccard(s, shingles(o)));
  return best;
}

export const STOPWORDS = new Set(
  'a an the and or but if then of to in on at by for with from as is are was were be been being it its this that these those i you he she we they my your his her our their me him them us not no do does did have has had will would can could should may might must so than too very just about into over after before'.split(
    ' ',
  ),
);
