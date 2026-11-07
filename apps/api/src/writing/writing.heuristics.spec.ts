import { DIMENSIONS, bulletCoverage, detectErrors, heuristicWriting, median } from './writing.heuristics';

const BULLETS = ['Explain what went wrong with the catering.', 'Describe how the guests reacted.', 'Suggest what to do for the next event.'];
const GOOD =
  'Dear Dana,\n\nThank you for recommending the catering company. Unfortunately, the food arrived late and several dishes were cold, so the guests were disappointed. For example, two colleagues left early. For the next event, I suggest we compare several caterers and ask for a tasting beforehand.\n\nBest regards,\nSam';
const BAD = 'dana the food bad. i eat late. other place';

describe('Writing heuristics (no-LLM fallback)', () => {
  it('ranks a developed email above a fragmentary one', () => {
    const good = heuristicWriting('WRITE_EMAIL', GOOD, { bullets: BULLETS });
    const bad = heuristicWriting('WRITE_EMAIL', BAD, { bullets: BULLETS });
    expect(good.overall).toBeGreaterThan(bad.overall + 1);
    expect(Object.keys(good.dimensions)).toEqual(DIMENSIONS.WRITE_EMAIL);
  });

  it('keeps scores inside 0..5 in 0.5 steps', () => {
    for (const text of [GOOD, BAD, 'x'.repeat(5)]) {
      const r = heuristicWriting('WRITE_EMAIL', text, { bullets: BULLETS });
      for (const d of Object.values(r.dimensions)) {
        expect(d.score).toBeGreaterThanOrEqual(0);
        expect(d.score).toBeLessThanOrEqual(5);
        expect(d.score * 2).toBe(Math.round(d.score * 2));
      }
    }
  });

  it('detects common surface errors with a correction', () => {
    const errs = detectErrors('I dont know alot about informations. A apple is on an table. i think so.');
    const types = errs.map((e) => e.type);
    expect(types).toContain('plural/countable');
    expect(types).toContain('article');
    expect(types).toContain('capitalization');
    expect(types).toContain('punctuation');
    expect(errs.every((e) => e.original && e.correction)).toBe(true);
  });

  it('measures bullet coverage', () => {
    expect(bulletCoverage(BULLETS, GOOD)).toBeGreaterThan(0.6);
    expect(bulletCoverage(BULLETS, BAD)).toBeLessThan(0.7);
  });

  it('rewards opinions, reasons, examples and references to classmates in discussions', () => {
    const rich =
      'I agree with Claire that public transportation is the better investment because it moves more people. For example, in my city the new tram reduced traffic. However, Marcus makes a fair point about distant neighborhoods. Therefore, cities should expand bus routes first, which also helps residents without cars and lowers pollution over time. In addition, buses cost less than new highways, so the savings can fund other services.';
    const poor = 'Transport is good.';
    const a = heuristicWriting('ACADEMIC_DISCUSSION', rich, { studentNames: ['Claire', 'Marcus'] });
    const b = heuristicWriting('ACADEMIC_DISCUSSION', poor, { studentNames: ['Claire', 'Marcus'] });
    expect(a.overall).toBeGreaterThanOrEqual(2.5);
    expect(a.overall).toBeGreaterThan(b.overall);
  });

  it('computes medians', () => {
    expect(median([1, 5, 3])).toBe(3);
    expect(median([1, 3])).toBe(2);
  });
});
