import {
  isAnswerCorrect,
  normalizeAnswer,
  rawToScaled,
  sectionConfidence,
} from './scoring.util';

describe('scoring utils', () => {
  describe('isAnswerCorrect', () => {
    it('matches single-choice case-insensitively', () => {
      expect(isAnswerCorrect('b', 'B')).toBe(true);
      expect(isAnswerCorrect('A', 'B')).toBe(false);
    });

    it('matches multi-select regardless of order', () => {
      expect(isAnswerCorrect(['B', 'A'], ['A', 'B'])).toBe(true);
      expect(isAnswerCorrect(['A'], ['A', 'B'])).toBe(false);
    });

    it('treats null/empty responses as incorrect', () => {
      expect(isAnswerCorrect(null, 'A')).toBe(false);
      expect(isAnswerCorrect('A', null)).toBe(false);
    });
  });

  describe('normalizeAnswer', () => {
    it('sorts and uppercases', () => {
      expect(normalizeAnswer(['b', 'a'])).toEqual(['A', 'B']);
    });
  });

  describe('rawToScaled', () => {
    it('maps perfect and zero scores', () => {
      expect(rawToScaled(20, 20)).toBe(30);
      expect(rawToScaled(0, 20)).toBe(0);
      expect(rawToScaled(10, 20)).toBe(15);
    });
    it('returns 0 when there are no questions', () => {
      expect(rawToScaled(0, 0)).toBe(0);
    });
  });

  describe('sectionConfidence', () => {
    it('increases with more items and caps at 0.95', () => {
      expect(sectionConfidence(0)).toBe(0);
      expect(sectionConfidence(10)).toBeCloseTo(0.6, 5);
      expect(sectionConfidence(1000)).toBe(0.95);
    });
  });
});
