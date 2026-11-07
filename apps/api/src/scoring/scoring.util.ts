import { checkBuildSentence } from '../content/build-sentence';
import { checkCTestAnswer } from '../content/ctest';

type Json = unknown;

/** Normalize an answer value (string | string[]) to a sorted uppercased array. */
export function normalizeAnswer(v: Json): string[] {
  if (v == null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((x) => String(x).trim().toUpperCase()).sort();
}

/** True when a multiple-choice response matches the key (order-independent). */
export function isAnswerCorrect(response: Json, correct: Json): boolean {
  const r = normalizeAnswer(response);
  const c = normalizeAnswer(correct);
  if (c.length === 0) return false;
  return r.length === c.length && r.every((v, i) => v === c[i]);
}

/** Grade one response according to the question type. */
export function gradeResponse(type: string, response: Json, key: Json): boolean {
  if (response == null) return false;
  switch (type) {
    case 'READING_COMPLETE_WORDS':
      return checkCTestAnswer(response, key);
    case 'WRITING_BUILD_SENTENCE':
      return checkBuildSentence(response, key);
    default:
      return isAnswerCorrect(response, key);
  }
}

/** Map raw correct/total to a 0..30 scaled score. */
export function rawToScaled(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 30);
}

/** Confidence of a single section/module estimate, based on item count. */
export function sectionConfidence(total: number): number {
  if (total <= 0) return 0;
  return Math.min(0.95, 0.3 + total * 0.03);
}

export interface SkillStat {
  correct: number;
  total: number;
  accuracy: number;
}

export function accumulate(map: Map<string, { correct: number; total: number }>, key: string, ok: boolean): void {
  const s = map.get(key) ?? { correct: 0, total: 0 };
  s.total += 1;
  if (ok) s.correct += 1;
  map.set(key, s);
}

export function toBreakdown(map: Map<string, { correct: number; total: number }>): Record<string, SkillStat> {
  return Object.fromEntries(
    [...map.entries()].map(([k, s]) => [k, { correct: s.correct, total: s.total, accuracy: s.total ? s.correct / s.total : 0 }]),
  );
}

/** Convert a 0–5 rubric score to a 0..1 ratio. */
export const ratio5 = (score: number): number => Math.max(0, Math.min(1, score / 5));
