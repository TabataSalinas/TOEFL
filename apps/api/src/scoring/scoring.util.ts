import { Prisma } from '@prisma/client';

/** Normalize an answer value (string | string[]) to a sorted uppercased array. */
export function normalizeAnswer(v: Prisma.JsonValue | null | undefined): string[] {
  if (v == null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((x) => String(x).trim().toUpperCase()).sort();
}

/** True when a response matches the correct answer (order-independent). */
export function isAnswerCorrect(
  response: Prisma.JsonValue | null | undefined,
  correct: Prisma.JsonValue | null | undefined,
): boolean {
  const r = normalizeAnswer(response);
  const c = normalizeAnswer(correct);
  if (c.length === 0) return false;
  return r.length === c.length && r.every((v, i) => v === c[i]);
}

/** Map raw correct/total to a 0..30 scaled score. */
export function rawToScaled(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 30);
}

/** Confidence of a single section estimate, based on item count. */
export function sectionConfidence(total: number): number {
  if (total <= 0) return 0;
  return Math.min(0.95, 0.3 + total * 0.03);
}
