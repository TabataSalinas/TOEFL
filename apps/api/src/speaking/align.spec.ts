import { alignWords, repeatScore } from './align';

describe('Listen and Repeat alignment', () => {
  it('finds missing, substituted and extra words', () => {
    const al = alignWords('Welcome to the chemistry lab.', 'welcome to chemistry lab');
    expect(al.missing).toEqual(['the']);
    expect(al.correct).toBe(4);
    const sub = alignWords('The books are on the left', 'the books are on the right');
    expect(sub.substitutions).toEqual([{ expected: 'left', heard: 'right' }]);
    const extra = alignWords('Open the door', 'please open the door');
    expect(extra.extra).toEqual(['please']);
  });

  it('treats contractions as equivalent to their expansions', () => {
    expect(alignWords("I'm happy to help.", 'I am happy to help').accuracy).toBe(1);
  });

  it('maps accuracy to rubric scores', () => {
    expect(repeatScore(1, 5)).toBe(5);
    expect(repeatScore(0.9, 5)).toBe(4);
    expect(repeatScore(0.75, 5)).toBe(3);
    expect(repeatScore(0.55, 5)).toBe(2);
    expect(repeatScore(0.3, 5)).toBe(1);
    expect(repeatScore(0.1, 5)).toBe(0);
    expect(repeatScore(1, 0)).toBe(0);
  });
});
