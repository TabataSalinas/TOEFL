import {
  BUILD_SENTENCE_POOL,
  checkBuildSentence,
  generateBuildSentenceSet,
  toQuestion,
  validateBuildItem,
} from './build-sentence';
import { mulberry32 } from './text-utils';

describe('Build a Sentence', () => {
  it('has a large original pool', () => {
    expect(BUILD_SENTENCE_POOL.length).toBeGreaterThanOrEqual(36);
  });

  it('generates distinct items whose chunks are a permutation of the answer', () => {
    const set = generateBuildSentenceSet(10, mulberry32(3));
    expect(set).toHaveLength(10);
    expect(new Set(set.map((s) => s.context)).size).toBe(10);
    for (const q of set) {
      expect(validateBuildItem(q)).toEqual([]);
      expect(q.chunks.join('|')).not.toBe(q.answer.join('|'));
      expect(q.layout.filter((p) => 'slot' in p)).toHaveLength(q.answer.length);
    }
  });

  it('is deterministic for a fixed seed', () => {
    const a = generateBuildSentenceSet(5, mulberry32(9));
    const b = generateBuildSentenceSet(5, mulberry32(9));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('avoids contexts that were seen', () => {
    const first = generateBuildSentenceSet(10, mulberry32(1));
    const second = generateBuildSentenceSet(10, mulberry32(2), first.map((q) => q.context));
    const overlap = second.filter((q) => first.some((f) => f.context === q.context));
    expect(overlap).toHaveLength(0);
  });

  it('only lower-cases the sentence-initial word', () => {
    const item = { context: 'x', words: ['She', 'has', 'been', 'studying', 'Spanish', 'since', 'last', 'year'], end: '.' as const };
    const q = toQuestion(item, mulberry32(4));
    expect(q.answer[0]).toBe('she');
    expect(q.answer).toContain('Spanish');
  });

  it('grades by order, case-insensitively', () => {
    expect(checkBuildSentence(['do', 'You', 'know'], ['Do', 'you', 'know'])).toBe(true);
    expect(checkBuildSentence(['you', 'do', 'know'], ['do', 'you', 'know'])).toBe(false);
    expect(checkBuildSentence(null, ['a'])).toBe(false);
    expect(checkBuildSentence(['a'], ['a', 'b'])).toBe(false);
  });

  it('flags malformed LLM items', () => {
    const problems = validateBuildItem({ chunks: ['a', 'b'], answer: ['a', 'c'], layout: [{ slot: true }, { slot: true }] });
    expect(problems.length).toBeGreaterThan(0);
  });
});
