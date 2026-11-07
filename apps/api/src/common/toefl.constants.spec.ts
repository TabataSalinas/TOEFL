import {
  ADAPTIVE_THRESHOLD,
  FULL_EXAM_SECTION_ORDER,
  MODULE_BLUEPRINTS,
  TASK_SECTION,
  bandLabel,
  combineAdaptive,
  getBlueprint,
  moduleCount,
  routeModule2,
  scaledToBand,
  totalToBand,
} from './toefl.constants';

describe('2026 format blueprint', () => {
  it('follows the official section order', () => {
    expect(FULL_EXAM_SECTION_ORDER).toEqual(['READING', 'LISTENING', 'WRITING', 'SPEAKING']);
  });

  it('Reading and Listening have two adaptive modules; Writing and Speaking are linear', () => {
    expect(moduleCount('READING')).toBe(2);
    expect(moduleCount('LISTENING')).toBe(2);
    expect(moduleCount('WRITING')).toBe(1);
    expect(moduleCount('SPEAKING')).toBe(1);
  });

  it('each Reading module has Complete the Words (10), Daily Life (2+3) and an Academic Passage (5)', () => {
    const bp = getBlueprint('READING', 1);
    const items = bp.tasks.flatMap((t) => t.questionCounts).reduce((a, b) => a + b, 0);
    expect(items).toBe(20);
    expect(bp.tasks.map((t) => t.kind)).toEqual(['COMPLETE_WORDS', 'DAILY_LIFE', 'ACADEMIC_PASSAGE']);
  });

  it('Writing is Build a Sentence (10) + Email (7 min) + Discussion (10 min)', () => {
    const bp = getBlueprint('WRITING', 1);
    expect(bp.tasks.map((t) => t.kind)).toEqual(['BUILD_SENTENCE', 'WRITE_EMAIL', 'ACADEMIC_DISCUSSION']);
    expect(bp.tasks[1].taskSec).toBe(420);
    expect(bp.tasks[2].taskSec).toBe(600);
    expect(bp.tasks[0].questionCounts[0]).toBe(10);
  });

  it('Speaking is Listen and Repeat (7) + Interview (4 × 45 s)', () => {
    const bp = getBlueprint('SPEAKING', 1);
    expect(bp.tasks[0].questionCounts[0]).toBe(7);
    expect(bp.tasks[1].questionCounts[0]).toBe(4);
    expect(bp.tasks[1].perQuestionSec).toBe(45);
  });

  it('every task kind maps to a section and every blueprint has a positive limit', () => {
    for (const bp of MODULE_BLUEPRINTS) {
      expect(bp.timeLimitSec).toBeGreaterThan(0);
      for (const t of bp.tasks) expect(TASK_SECTION[t.kind]).toBe(bp.section);
    }
  });

  it('throws for unknown blueprints', () => {
    expect(() => getBlueprint('SPEAKING', 2)).toThrow();
  });
});

describe('adaptive routing and scoring', () => {
  it('routes by module-1 accuracy', () => {
    expect(routeModule2(ADAPTIVE_THRESHOLD)).toBe('hard');
    expect(routeModule2(ADAPTIVE_THRESHOLD - 0.01)).toBe('easy');
  });

  it('easy path is capped at 24 and hard path spans 6..30', () => {
    expect(combineAdaptive(1, 1, 'easy')).toBe(24);
    expect(combineAdaptive(0, 0, 'hard')).toBe(6);
    expect(combineAdaptive(1, 1, 'hard')).toBe(30);
  });

  it('module 2 weighs more than module 1', () => {
    const strongM2 = combineAdaptive(0.5, 1, 'hard');
    const strongM1 = combineAdaptive(1, 0.5, 'hard');
    expect(strongM2).toBeGreaterThan(strongM1);
  });

  it('falls back to module 1 only when module 2 is missing', () => {
    expect(combineAdaptive(0.5, null, null)).toBe(15);
  });

  it('bands are 0.5 steps within 1..6', () => {
    for (let s = 0; s <= 30; s++) {
      const b = scaledToBand(s);
      expect(b * 2).toBe(Math.round(b * 2));
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(6);
    }
    expect(totalToBand(0)).toBe(1);
    expect(totalToBand(120)).toBe(6);
    expect(bandLabel(6)).toContain('Advanced');
  });
});
