/**
 * Word-level alignment between a target sentence and what the recognizer heard
 * (Listen and Repeat). Uses a Levenshtein alignment over normalised tokens.
 */
export interface AlignmentResult {
  target: string[];
  spoken: string[];
  correct: number;
  substitutions: Array<{ expected: string; heard: string }>;
  missing: string[];
  extra: string[];
  /** 0..1: matches minus a light penalty for extra words. */
  accuracy: number;
}

const EXPANSIONS: Array<[RegExp, string]> = [
  [/\bi['’]m\b/g, 'i am'], [/\byou['’]re\b/g, 'you are'], [/\bwe['’]re\b/g, 'we are'], [/\bthey['’]re\b/g, 'they are'],
  [/\bit['’]s\b/g, 'it is'], [/\bthat['’]s\b/g, 'that is'], [/\bthere['’]s\b/g, 'there is'], [/\bcan['’]t\b/g, 'can not'],
  [/\bcannot\b/g, 'can not'], [/\bdon['’]t\b/g, 'do not'], [/\bdoesn['’]t\b/g, 'does not'], [/\bwon['’]t\b/g, 'will not'],
  [/\bi['’]ll\b/g, 'i will'], [/\bwe['’]ll\b/g, 'we will'], [/\byou['’]ll\b/g, 'you will'], [/\bi['’]ve\b/g, 'i have'],
];

export function normalizeForAlignment(text: string): string[] {
  let t = text.toLowerCase();
  for (const [re, rep] of EXPANSIONS) t = t.replace(re, rep);
  return (t.replace(/[^a-z0-9'\s]/g, ' ').match(/[a-z0-9']+/g) ?? []) as string[];
}

export function alignWords(targetText: string, spokenText: string): AlignmentResult {
  const a = normalizeForAlignment(targetText);
  const b = normalizeForAlignment(spokenText);
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  const substitutions: AlignmentResult['substitutions'] = [];
  const missing: string[] = [];
  const extra: string[] = [];
  let correct = 0;
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      if (a[i - 1] === b[j - 1]) correct++;
      else substitutions.unshift({ expected: a[i - 1], heard: b[j - 1] });
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      missing.unshift(a[i - 1]);
      i--;
    } else {
      extra.unshift(b[j - 1]);
      j--;
    }
  }
  const accuracy = n === 0 ? 0 : Math.max(0, (correct - 0.5 * extra.length) / n);
  return { target: a, spoken: b, correct, substitutions, missing, extra, accuracy: Math.round(accuracy * 100) / 100 };
}

/** Rubric mapping (see knowledge base "Listen and Repeat — accuracy mapping"). */
export function repeatScore(accuracy: number, spokenWords: number): number {
  if (spokenWords === 0) return 0;
  if (accuracy >= 0.95) return 5;
  if (accuracy >= 0.85) return 4;
  if (accuracy >= 0.7) return 3;
  if (accuracy >= 0.5) return 2;
  if (accuracy >= 0.25) return 1;
  return 0;
}
