import { accumulate, gradeResponse, isAnswerCorrect, normalizeAnswer, ratio5, rawToScaled, sectionConfidence, toBreakdown } from './scoring.util';

describe('scoring utils', () => {
  it('matches single-choice case-insensitively and multi-select regardless of order', () => {
    expect(isAnswerCorrect('b', 'B')).toBe(true);
    expect(isAnswerCorrect('A', 'B')).toBe(false);
    expect(isAnswerCorrect(['B', 'A'], ['A', 'B'])).toBe(true);
    expect(isAnswerCorrect(['A'], ['A', 'B'])).toBe(false);
    expect(isAnswerCorrect(null, 'A')).toBe(false);
    expect(normalizeAnswer(['b', 'a'])).toEqual(['A', 'B']);
  });

  it('grades by task type', () => {
    expect(gradeResponse('READING_COMPLETE_WORDS', ' OW ', 'ow')).toBe(true);
    expect(gradeResponse('READING_COMPLETE_WORDS', '', 'ow')).toBe(false);
    expect(gradeResponse('WRITING_BUILD_SENTENCE', ['Do', 'you'], ['do', 'you'])).toBe(true);
    expect(gradeResponse('WRITING_BUILD_SENTENCE', ['you', 'do'], ['do', 'you'])).toBe(false);
    expect(gradeResponse('LISTENING_DETAIL', 'c', 'C')).toBe(true);
    expect(gradeResponse('LISTENING_DETAIL', null, 'C')).toBe(false);
  });

  it('maps raw to scaled and computes confidence', () => {
    expect(rawToScaled(20, 20)).toBe(30);
    expect(rawToScaled(10, 20)).toBe(15);
    expect(rawToScaled(0, 0)).toBe(0);
    expect(sectionConfidence(0)).toBe(0);
    expect(sectionConfidence(10)).toBeCloseTo(0.6, 5);
    expect(sectionConfidence(1000)).toBe(0.95);
  });

  it('accumulates skill statistics', () => {
    const m = new Map<string, { correct: number; total: number }>();
    accumulate(m, 'inference', true);
    accumulate(m, 'inference', false);
    expect(toBreakdown(m).inference).toEqual({ correct: 1, total: 2, accuracy: 0.5 });
    expect(ratio5(2.5)).toBe(0.5);
    expect(ratio5(9)).toBe(1);
  });
});
