import { splitSentences, words } from '../content/text-utils';

/**
 * Deterministic, rule-based Writing evaluation used when no LLM is configured
 * (or all LLM calls fail). It is intentionally conservative and is reported with
 * LOW confidence: it measures surface features (coverage, length, structure, error
 * patterns, lexical variety), not meaning.
 */
export type WritingTask = 'WRITE_EMAIL' | 'ACADEMIC_DISCUSSION';

export interface WritingError {
  original: string;
  correction: string;
  type: string;
  explanation: string;
}

export interface HeuristicResult {
  dimensions: Record<string, { score: number; rationale: string }>;
  overall: number;
  errors: WritingError[];
  features: Record<string, number>;
}

export const DIMENSIONS: Record<WritingTask, string[]> = {
  WRITE_EMAIL: ['task_fulfillment', 'organization_coherence', 'grammar_accuracy', 'vocabulary_register'],
  ACADEMIC_DISCUSSION: ['contribution_to_discussion', 'development_support', 'coherence_cohesion', 'language_use'],
};

const CONNECTORS = [
  'however', 'therefore', 'moreover', 'furthermore', 'for example', 'for instance', 'in addition', 'as a result', 'because',
  'although', 'while', 'on the other hand', 'in contrast', 'first', 'second', 'finally', 'overall', 'in conclusion', 'such as',
  'since', 'whereas', 'consequently', 'instead', 'in fact', 'that said',
];

const UNCOUNTABLE_PLURALS: Record<string, string> = {
  informations: 'information', advices: 'advice', furnitures: 'furniture', equipments: 'equipment', peoples: 'people',
  knowledges: 'knowledge', homeworks: 'homework', researches: 'research', feedbacks: 'feedback',
};

const CONTRACTIONS: Record<string, string> = {
  dont: "don't", cant: "can't", wont: "won't", didnt: "didn't", doesnt: "doesn't", isnt: "isn't", wasnt: "wasn't",
  im: "I'm", ive: "I've", youre: "you're", thats: "that's", couldnt: "couldn't", shouldnt: "shouldn't",
};

const VOWEL_SOUND_EXCEPTIONS = /^(uni|use|usu|eu|one|once|ubiq|uri)/i;
const SILENT_H = /^(hour|honest|honor|heir)/i;

const clamp = (n: number, lo = 0, hi = 5) => Math.max(lo, Math.min(hi, n));
const half = (n: number) => Math.round(n * 2) / 2;

export function detectErrors(text: string): WritingError[] {
  const errors: WritingError[] = [];
  const push = (e: WritingError) => {
    if (!errors.some((x) => x.original === e.original && x.type === e.type)) errors.push(e);
  };

  for (const m of text.matchAll(/\bi\b(?!['’])/g)) {
    const ctx = text.slice(Math.max(0, (m.index ?? 0) - 12), (m.index ?? 0) + 14).trim();
    push({ original: ctx, correction: ctx.replace(/\bi\b/, 'I'), type: 'capitalization', explanation: 'The pronoun "I" is always capitalized.' });
  }
  for (const m of text.matchAll(/\b(\w+)\s+\1\b/gi)) {
    if (/^(that|had)$/i.test(m[1])) continue;
    push({ original: m[0], correction: m[1], type: 'repeated word', explanation: 'The same word is repeated by mistake.' });
  }
  for (const m of text.matchAll(/\ba\s+([aeiou]\w*)/gi)) {
    if (VOWEL_SOUND_EXCEPTIONS.test(m[1])) continue;
    push({ original: m[0], correction: `an ${m[1]}`, type: 'article', explanation: 'Use "an" before a vowel sound.' });
  }
  for (const m of text.matchAll(/\ban\s+([bcdfgjklmnpqrstvwxz]\w*)/gi)) {
    if (SILENT_H.test(m[1])) continue;
    push({ original: m[0], correction: `a ${m[1]}`, type: 'article', explanation: 'Use "a" before a consonant sound.' });
  }
  for (const [wrong, right] of Object.entries(UNCOUNTABLE_PLURALS)) {
    const re = new RegExp(`\\b${wrong}\\b`, 'i');
    const m = text.match(re);
    if (m) push({ original: m[0], correction: right, type: 'plural/countable', explanation: `"${right}" is uncountable and has no plural form.` });
  }
  for (const [wrong, right] of Object.entries(CONTRACTIONS)) {
    const m = text.match(new RegExp(`\\b${wrong}\\b`, 'i'));
    if (m && !(wrong === 'im' && !/\bim\s+\w/i.test(text))) {
      push({ original: m[0], correction: right, type: 'punctuation', explanation: 'Contractions need an apostrophe.' });
    }
  }
  for (const m of text.matchAll(/[,;:.!?][A-Za-z]/g)) {
    push({ original: m[0], correction: `${m[0][0]} ${m[0][1]}`, type: 'punctuation', explanation: 'Add a space after punctuation.' });
  }
  for (const m of text.matchAll(/\b(more|most)\s+(better|worse|easier|bigger|faster|happier)\b/gi)) {
    push({ original: m[0], correction: m[2], type: 'word choice', explanation: 'Do not combine "more/most" with a comparative form.' });
  }
  for (const s of splitSentences(text)) {
    if (/^[a-z]/.test(s)) {
      push({ original: s.slice(0, 24), correction: s.charAt(0).toUpperCase() + s.slice(1, 24), type: 'capitalization', explanation: 'Start a sentence with a capital letter.' });
    }
  }
  return errors;
}

interface Features {
  wc: number;
  sentences: number;
  paragraphs: number;
  avgSentenceLen: number;
  ttr: number;
  longWordRatio: number;
  connectors: number;
  errorCount: number;
  errorsPer100: number;
}

function features(text: string, errors: WritingError[]): Features {
  const ws = words(text);
  const wc = ws.length;
  const sentences = Math.max(1, splitSentences(text).length);
  const head = ws.slice(0, 120);
  const lower = text.toLowerCase();
  return {
    wc,
    sentences,
    paragraphs: text.split(/\n\s*\n|\n/).filter((p) => p.trim()).length,
    avgSentenceLen: wc / sentences,
    ttr: head.length ? new Set(head).size / head.length : 0,
    longWordRatio: wc ? ws.filter((w) => w.length >= 7).length / wc : 0,
    connectors: CONNECTORS.filter((c) => lower.includes(c)).length,
    errorCount: errors.length,
    errorsPer100: wc ? (errors.length / wc) * 100 : 0,
  };
}

/** Overlap between a bullet instruction and the response (content words). */
export function bulletCoverage(bullets: string[], text: string): number {
  if (bullets.length === 0) return 0.6;
  const resp = new Set(words(text));
  const stop = new Set(['explain', 'describe', 'suggest', 'what', 'the', 'and', 'with', 'about', 'for', 'how', 'your', 'that', 'this', 'what', 'was', 'were', 'have', 'from', 'next']);
  let covered = 0;
  for (const b of bullets) {
    const keys = words(b).filter((w) => w.length > 3 && !stop.has(w));
    if (keys.length === 0) continue;
    const hit = keys.filter((k) => resp.has(k) || [...resp].some((r) => r.startsWith(k.slice(0, 5)))).length;
    if (hit / keys.length >= 0.34) covered++;
  }
  return covered / bullets.length;
}

export function heuristicWriting(
  task: WritingTask,
  text: string,
  ctx: { bullets?: string[]; studentNames?: string[] } = {},
): HeuristicResult {
  const errors = detectErrors(text);
  const f = features(text, errors);
  const lower = text.toLowerCase();
  const dims: HeuristicResult['dimensions'] = {};

  const minWords = task === 'WRITE_EMAIL' ? 60 : 100;
  const lengthFactor = clamp(f.wc / minWords, 0, 1);
  const grammar = clamp(5 - f.errorsPer100 * 0.9) * (0.5 + 0.5 * lengthFactor);
  const lexical = clamp(1.5 + f.ttr * 2.5 + f.longWordRatio * 6) * (0.5 + 0.5 * lengthFactor);

  if (task === 'WRITE_EMAIL') {
    const coverage = bulletCoverage(ctx.bullets ?? [], text);
    const greeting = /^\s*(dear|hi|hello|good (morning|afternoon))\b/i.test(text);
    const closing = /(regards|sincerely|best|thanks|thank you|yours|cheers)[\s,.!]*[\w\s.]{0,30}$/i.test(text.trim());
    dims.task_fulfillment = { score: half(clamp((coverage * 4.2 + 0.4) * (0.4 + 0.6 * lengthFactor))), rationale: `Covers about ${Math.round(coverage * 100)}% of the required points in ${f.wc} words.` };
    dims.organization_coherence = { score: half(clamp(1.2 + (greeting ? 0.8 : 0) + (closing ? 0.8 : 0) + Math.min(1.2, f.connectors * 0.4) + Math.min(1, f.paragraphs * 0.35)) * (0.5 + 0.5 * lengthFactor)), rationale: `Greeting: ${greeting ? 'yes' : 'no'}; closing: ${closing ? 'yes' : 'no'}; ${f.connectors} connector(s); ${f.paragraphs} paragraph(s).` };
    dims.grammar_accuracy = { score: half(grammar), rationale: `${errors.length} detectable error pattern(s), ${f.errorsPer100.toFixed(1)} per 100 words.` };
    dims.vocabulary_register = { score: half(lexical), rationale: `Lexical variety ${(f.ttr * 100).toFixed(0)}%, long-word ratio ${(f.longWordRatio * 100).toFixed(0)}%.` };
  } else {
    const opinion = /\b(i think|i believe|in my opinion|i agree|i disagree|i would argue|i prefer|from my perspective)\b/.test(lower);
    const reasons = (lower.match(/\b(because|since|as a result|therefore|reason|due to)\b/g) ?? []).length;
    const examples = (lower.match(/\b(for example|for instance|such as|in my experience|when i)\b/g) ?? []).length;
    const refers = (ctx.studentNames ?? []).some((n) => lower.includes(n.toLowerCase())) || /\b(as .* (said|mentioned|pointed out)|i agree with|i disagree with|unlike)\b/.test(lower);
    dims.contribution_to_discussion = { score: half(clamp((opinion ? 2.2 : 1) + (refers ? 1.6 : 0) + Math.min(1.2, f.wc / 90)) * (0.5 + 0.5 * lengthFactor)), rationale: `Opinion marker: ${opinion ? 'yes' : 'no'}; refers to classmates: ${refers ? 'yes' : 'no'}.` };
    dims.development_support = { score: half(clamp(0.8 + Math.min(2, reasons * 0.7) + Math.min(1.5, examples * 0.9) + Math.min(0.8, f.wc / 150)) * (0.5 + 0.5 * lengthFactor)), rationale: `${reasons} reason marker(s), ${examples} example marker(s) in ${f.wc} words.` };
    dims.coherence_cohesion = { score: half(clamp(1.2 + Math.min(2.2, f.connectors * 0.5) + Math.min(1, f.avgSentenceLen / 18)) * (0.5 + 0.5 * lengthFactor)), rationale: `${f.connectors} connector(s); average sentence length ${f.avgSentenceLen.toFixed(1)} words.` };
    dims.language_use = { score: half((grammar + lexical) / 2), rationale: `Grammar pattern errors ${f.errorsPer100.toFixed(1)}/100 words; lexical variety ${(f.ttr * 100).toFixed(0)}%.` };
  }

  const vals = Object.values(dims).map((d) => d.score);
  const overall = f.wc < 5 ? 0 : half(vals.reduce((a, b) => a + b, 0) / vals.length);
  return {
    dimensions: dims,
    overall,
    errors,
    features: { words: f.wc, sentences: f.sentences, paragraphs: f.paragraphs, errorsPer100: Number(f.errorsPer100.toFixed(2)), connectors: f.connectors },
  };
}

export const median = (nums: number[]): number => {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
