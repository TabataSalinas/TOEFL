import { fleschKincaidGrade, jaccard, maxSimilarity, mulberry32, shingles, shuffle, splitSentences, words } from './text-utils';

describe('text utils', () => {
  it('tokenizes words with apostrophes', () => {
    expect(words("I'm sure it's fine.")).toEqual(["i'm", 'sure', "it's", 'fine']);
  });

  it('splits sentences', () => {
    expect(splitSentences('It works. Does it? Yes! Fine.')).toHaveLength(4);
  });

  it('seeded RNG and shuffle are deterministic', () => {
    expect(mulberry32(5)()).toBe(mulberry32(5)());
    expect(shuffle([1, 2, 3, 4, 5], mulberry32(7))).toEqual(shuffle([1, 2, 3, 4, 5], mulberry32(7)));
  });

  it('readability increases with complexity', () => {
    const easy = 'The cat sat on the mat. It was a sunny day.';
    const hard = 'Evapotranspiration substantially redistributes atmospheric thermal energy throughout metropolitan environments.';
    expect(fleschKincaidGrade(hard)).toBeGreaterThan(fleschKincaidGrade(easy));
  });

  it('near-duplicate detection', () => {
    const a = 'Cities are often several degrees warmer than the rural areas surrounding them because of dark materials.';
    expect(maxSimilarity(a, [a])).toBe(1);
    expect(maxSimilarity(a, ['Completely different content about tides and the moon and the sea.'])).toBeLessThan(0.1);
    expect(jaccard(shingles('a b c d e'), shingles('a b c d e'))).toBe(1);
  });
});
