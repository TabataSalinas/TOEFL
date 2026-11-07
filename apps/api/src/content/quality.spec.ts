import { answerDistribution, rebalanceAll, validateStimulus } from './quality';
import { GeneratedStimulus } from '../ai/ai.types';
import { mulberry32 } from './text-utils';

const mcq = (correct: string): GeneratedStimulus['questions'][number] => ({
  type: 'READING_FACTUAL',
  prompt: 'What is stated?',
  options: [
    { id: 'A', text: 'First option here' },
    { id: 'B', text: 'Second option here' },
    { id: 'C', text: 'Third option here' },
    { id: 'D', text: 'Fourth option here' },
  ],
  correctAnswer: correct,
  explanation: 'Because.',
  skillTag: 'factual-detail',
  points: 1,
});

const body = Array.from({ length: 70 }, (_, i) => `word${i}`).join(' ');

describe('content quality', () => {
  it('accepts a well-formed daily-life item', () => {
    const s: GeneratedStimulus = { kind: 'daily_life', title: 't', topic: 'x', body, questions: [mcq('A'), mcq('B')] };
    expect(validateStimulus('DAILY_LIFE', s, 2).ok).toBe(true);
  });

  it('rejects wrong question counts, bad keys and duplicate options', () => {
    const dup = mcq('A');
    dup.options![1].text = dup.options![0].text;
    const s: GeneratedStimulus = { kind: 'daily_life', title: 't', topic: 'x', body, questions: [dup, mcq('Z')] };
    const rep = validateStimulus('DAILY_LIFE', s, 3);
    expect(rep.ok).toBe(false);
    expect(rep.problems.join(' ')).toContain('expected 3 questions');
    expect(rep.problems.join(' ')).toContain('duplicate options');
    expect(rep.problems.join(' ')).toContain('correct answer not among options');
  });

  it('rejects out-of-range passage length and near-duplicates', () => {
    const tiny: GeneratedStimulus = { kind: 'academic', title: 't', topic: 'x', body: 'Too short.', questions: [mcq('A')] };
    expect(validateStimulus('ACADEMIC_PASSAGE', tiny, 1).ok).toBe(false);
    const s: GeneratedStimulus = { kind: 'daily_life', title: 't', topic: 'x', body, questions: [mcq('A')] };
    const rep = validateStimulus('DAILY_LIFE', s, 1, { recentTexts: [body] });
    expect(rep.problems.join(' ')).toContain('too similar');
  });

  it('rebalances answer keys uniformly while preserving the correct text', () => {
    const qs = Array.from({ length: 8 }, () => mcq('A'));
    const stim: GeneratedStimulus = { kind: 'daily_life', title: 't', topic: 'x', body, questions: qs };
    const out = rebalanceAll([stim], mulberry32(5));
    const dist = answerDistribution(out);
    expect(dist).toEqual({ A: 2, B: 2, C: 2, D: 2 });
    for (const q of out[0].questions) {
      const correctText = q.options!.find((o) => o.id === q.correctAnswer)!.text;
      expect(correctText).toBe('First option here');
    }
  });
});
