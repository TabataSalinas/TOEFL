import { GeneratedQuestion, GeneratedStimulus } from '../ai/ai.types';
import { TaskKind } from '../common/toefl.constants';
import { fleschKincaidGrade, maxSimilarity, shuffle, wordCount } from './text-utils';

/** Acceptable body word-count range per task kind. */
export const WORD_RANGES: Partial<Record<TaskKind, [number, number]>> = {
  COMPLETE_WORDS: [55, 120],
  DAILY_LIFE: [35, 190],
  ACADEMIC_PASSAGE: [140, 300],
  CHOOSE_RESPONSE: [3, 30],
  CONVERSATION: [45, 190],
  ANNOUNCEMENT: [35, 140],
  ACADEMIC_TALK: [140, 360],
};

const MCQ_KINDS: TaskKind[] = [
  'DAILY_LIFE',
  'ACADEMIC_PASSAGE',
  'CHOOSE_RESPONSE',
  'CONVERSATION',
  'ANNOUNCEMENT',
  'ACADEMIC_TALK',
];

export interface QualityReport {
  ok: boolean;
  problems: string[];
}

function validateMcq(q: GeneratedQuestion, idx: number): string[] {
  const p: string[] = [];
  const tag = `Q${idx + 1}`;
  if (!q.prompt?.trim()) p.push(`${tag}: empty prompt`);
  if (!q.explanation?.trim()) p.push(`${tag}: missing explanation`);
  const opts = q.options ?? [];
  if (opts.length !== 4) p.push(`${tag}: needs exactly 4 options`);
  const texts = opts.map((o) => o.text.trim().toLowerCase());
  if (new Set(texts).size !== texts.length) p.push(`${tag}: duplicate options`);
  if (texts.some((t) => !t)) p.push(`${tag}: empty option`);
  if (!opts.some((o) => o.id === q.correctAnswer)) p.push(`${tag}: correct answer not among options`);
  const lens = opts.map((o) => o.text.length).filter((n) => n > 0);
  if (lens.length === 4 && Math.max(...lens) / Math.min(...lens) > 6) {
    p.push(`${tag}: option lengths too unbalanced (gives the answer away)`);
  }
  return p;
}

export function validateStimulus(
  kind: TaskKind,
  s: GeneratedStimulus,
  expectedQuestions: number,
  opts: { recentTexts?: string[]; similarityLimit?: number } = {},
): QualityReport {
  const problems: string[] = [];
  const range = WORD_RANGES[kind];
  const wc = wordCount(s.body);
  if (range && (wc < range[0] || wc > range[1])) {
    problems.push(`body has ${wc} words, expected ${range[0]}–${range[1]}`);
  }
  if (s.questions.length !== expectedQuestions) {
    problems.push(`expected ${expectedQuestions} questions, got ${s.questions.length}`);
  }
  if (MCQ_KINDS.includes(kind)) {
    s.questions.forEach((q, i) => problems.push(...validateMcq(q, i)));
  }
  if (kind === 'ACADEMIC_PASSAGE') {
    const g = fleschKincaidGrade(s.body);
    if (g < 8) problems.push(`passage too easy for academic register (FK grade ${g.toFixed(1)})`);
    const paragraphs = s.body.split(/\n\s*\n/).filter(Boolean).length;
    if (paragraphs < 2) problems.push('academic passage needs at least 2 paragraphs');
  }
  if (opts.recentTexts && opts.recentTexts.length) {
    const sim = maxSimilarity(s.body, opts.recentTexts);
    if (sim > (opts.similarityLimit ?? 0.35)) {
      problems.push(`too similar to previously seen content (${sim.toFixed(2)})`);
    }
  }
  return { ok: problems.length === 0, problems };
}

/**
 * LLMs over-use some answer positions (and curated banks may put the key first).
 * Re-place every correct option so the key letters are spread uniformly across the
 * whole set (a shuffled A–D deck is dealt question by question), then shuffle the
 * distractors into the remaining slots.
 */
export function rebalanceAll(stimuli: GeneratedStimulus[], rand: () => number): GeneratedStimulus[] {
  const letters = ['A', 'B', 'C', 'D'];
  let deck: number[] = [];
  const nextSlot = (): number => {
    if (deck.length === 0) deck = shuffle([0, 1, 2, 3], rand);
    return deck.pop() as number;
  };
  return stimuli.map((s) => ({
    ...s,
    questions: s.questions.map((q) => {
      if (!q.options || q.options.length !== 4 || typeof q.correctAnswer !== 'string') return q;
      const correct = q.options.find((o) => o.id === q.correctAnswer);
      if (!correct) return q;
      const distractors = shuffle(
        q.options.filter((o) => o.id !== q.correctAnswer).map((o) => o.text),
        rand,
      );
      const slot = nextSlot();
      const texts: string[] = [];
      let d = 0;
      for (let i = 0; i < 4; i++) texts.push(i === slot ? correct.text : distractors[d++]);
      return {
        ...q,
        options: texts.map((text, i) => ({ id: letters[i], text })),
        correctAnswer: letters[slot],
      };
    }),
  }));
}

/** Distribution of correct-answer letters, handy for tests/diagnostics. */
export function answerDistribution(stimuli: GeneratedStimulus[]): Record<string, number> {
  const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const s of stimuli) {
    for (const q of s.questions) {
      if (typeof q.correctAnswer === 'string' && dist[q.correctAnswer] !== undefined) {
        dist[q.correctAnswer]++;
      }
    }
  }
  return dist;
}
