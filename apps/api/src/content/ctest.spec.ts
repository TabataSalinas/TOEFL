import { buildCTest, checkCTestAnswer, renderCTestPlain } from './ctest';

const PARA =
  'The ocean rises and falls twice a day in a pattern known as the tides. The main cause is the gravitational pull of the Moon, which draws the water on the nearest side of Earth toward it. The Sun also has an effect, although it is much weaker because it is so far away. Sailors and fishermen have studied these patterns for centuries so that they can plan safe trips along the coast.';

describe('Complete the Words builder', () => {
  const ct = buildCTest(PARA, 10);

  it('creates the requested number of blanks', () => {
    expect(ct.items).toHaveLength(10);
  });

  it('keeps the first sentence intact', () => {
    expect(ct.text.startsWith('The ocean rises and falls twice a day in a pattern known as the tides.')).toBe(true);
  });

  it('removes the second half of each damaged word and the key restores it', () => {
    for (const it of ct.items) {
      expect(it.prefix + it.answer).toBe(it.full);
      expect(it.prefix.length).toBe(Math.floor(it.full.length / 2));
      expect(it.full.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('puts one token per blank in the text and numbers them sequentially', () => {
    const tokens = ct.text.match(/\{\{\d+\|[^|]*\|\d+\}\}/g) ?? [];
    expect(tokens).toHaveLength(10);
    expect(ct.items.map((i) => i.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('damages every second eligible word, leaving the others readable', () => {
    const plain = renderCTestPlain(ct.text);
    expect(plain).toContain('_');
    expect(plain).toContain('Sailors and fishermen');
  });

  it('returns fewer blanks when the paragraph is too short', () => {
    expect(buildCTest('This is short. Only a few words here.', 10).items.length).toBeLessThan(10);
  });

  it('checks answers case/space-insensitively and rejects blanks', () => {
    expect(checkCTestAnswer(' IN ', 'in')).toBe(true);
    expect(checkCTestAnswer('', 'in')).toBe(false);
    expect(checkCTestAnswer('on', 'in')).toBe(false);
  });
});
