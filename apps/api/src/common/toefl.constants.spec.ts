import {
  scaledToBand,
  totalToBand,
  bandLabel,
  SECTION_BLUEPRINTS,
  FULL_EXAM_SECTION_ORDER,
} from './toefl.constants';

describe('TOEFL scoring conversions', () => {
  it('maps 0..30 scaled to a 1..6 band in 0.5 steps', () => {
    expect(scaledToBand(0)).toBe(1);
    expect(scaledToBand(30)).toBe(6);
    expect(scaledToBand(15)).toBe(3.5);
    // always a multiple of 0.5
    for (let s = 0; s <= 30; s++) {
      const b = scaledToBand(s);
      expect(b * 2).toBe(Math.round(b * 2));
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(6);
    }
  });

  it('clamps out-of-range scaled scores', () => {
    expect(scaledToBand(-5)).toBe(1);
    expect(scaledToBand(99)).toBe(6);
  });

  it('maps 0..120 total to a band', () => {
    expect(totalToBand(0)).toBe(1);
    expect(totalToBand(120)).toBe(6);
    expect(totalToBand(60)).toBe(3.5);
  });

  it('labels bands with CEFR-ish descriptions', () => {
    expect(bandLabel(6)).toContain('Advanced');
    expect(bandLabel(1)).toContain('Beginner');
  });

  it('defines all four section blueprints with positive time limits', () => {
    expect(FULL_EXAM_SECTION_ORDER).toHaveLength(4);
    for (const section of FULL_EXAM_SECTION_ORDER) {
      expect(SECTION_BLUEPRINTS[section].timeLimitSec).toBeGreaterThan(0);
    }
  });
});
