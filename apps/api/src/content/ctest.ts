/**
 * "Complete the Words" builder (C-test principle).
 *
 * Given ANY paragraph, the first sentence stays intact; afterwards every second
 * eligible word loses its second half. The learner types the missing letters.
 * Because the blanks are produced by code, this task works with any text (AI
 * generated, bank, or open-license), giving effectively unlimited items.
 *
 * Blank token format inside the text:  {{n|prefix|missingLength}}
 */
export interface CTestItem {
  n: number;
  prefix: string;
  /** Missing letters (the expected answer). */
  answer: string;
  /** The complete word. */
  full: string;
}

export interface CTestResult {
  text: string;
  items: CTestItem[];
}

// Words shorter than 4 letters are never damaged: one visible letter is too ambiguous.
const WORD_RE = /(?<![\w'’-])[a-z]{4,}(?![\w'’-])/g;

export function buildCTest(paragraph: string, blanks = 10): CTestResult {
  const clean = paragraph.replace(/\s+/g, ' ').trim();
  const firstEnd = clean.search(/[.!?]["')\]]*\s/);
  const head = firstEnd === -1 ? clean : clean.slice(0, firstEnd + 1);
  const tail = firstEnd === -1 ? '' : clean.slice(firstEnd + 1);

  const items: CTestItem[] = [];
  let eligibleIndex = 0;
  const replaced = tail.replace(WORD_RE, (match: string) => {
    if (items.length >= blanks) return match;
    const take = eligibleIndex % 2 === 0;
    eligibleIndex++;
    if (!take) return match;
    const keep = Math.floor(match.length / 2);
    const item: CTestItem = {
      n: items.length + 1,
      prefix: match.slice(0, keep),
      answer: match.slice(keep),
      full: match,
    };
    items.push(item);
    return `{{${item.n}|${item.prefix}|${item.answer.length}}}`;
  });

  return { text: head + replaced, items };
}

/** Render a C-test text for plain-text displays/tests, e.g. "sh__". */
export function renderCTestPlain(text: string): string {
  return text.replace(/\{\{(\d+)\|([^|]*)\|(\d+)\}\}/g, (_m, _n, prefix, len) => {
    return prefix + '_'.repeat(Number(len));
  });
}

/** Case/space-insensitive comparison of a typed answer with the key. */
export function checkCTestAnswer(response: unknown, key: unknown): boolean {
  const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
  return norm(response) !== '' && norm(response) === norm(key);
}
