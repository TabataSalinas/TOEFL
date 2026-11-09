import { aggregateRatings, quoteAppears, ratingConfidence, RawRating } from './writing.aggregate';
import { DIMENSIONS } from './writing.heuristics';

const RESPONSE = 'dana the food bad. i eat late. other place';
const sample = (score: number, extraErrors: RawRating['errors'] = []): RawRating => ({
  dimensions: Object.fromEntries(DIMENSIONS.WRITE_EMAIL.map((d) => [d, { score, rationale: `r${score}` }])),
  errors: [{ original: 'food bad', correction: 'the food was bad', type: 'grammar', explanation: 'x' }, ...(extraErrors ?? [])],
  strengths: ['clear'],
  improvements: [{ priority: 1, advice: 'add detail' }],
  improvedVersion: 'Dear Dana, ...',
  justification: 'because',
});

describe('rating aggregation for consistent scoring', () => {
  it('uses the median so one outlier does not move the score', () => {
    const agg = aggregateRatings('WRITE_EMAIL', RESPONSE, [sample(3), sample(3.5), sample(1)])!;
    expect(agg.overall).toBe(3);
    expect(agg.spread).toBeGreaterThan(1.5);
    expect(agg.samples).toBe(3);
  });

  it('drops errors whose quote is not in the response (anti-hallucination)', () => {
    const agg = aggregateRatings('WRITE_EMAIL', RESPONSE, [sample(2, [{ original: 'NOT IN TEXT', correction: 'y', type: 'z', explanation: '' }])])!;
    expect(agg.errors.map((e) => e.original)).toEqual(['food bad']);
    expect(quoteAppears(RESPONSE, 'Food  BAD')).toBe(true);
    expect(quoteAppears(RESPONSE, 'zzz')).toBe(false);
  });

  it('ignores malformed samples and returns null when none are usable', () => {
    expect(aggregateRatings('WRITE_EMAIL', RESPONSE, [{ dimensions: {} }, {}])).toBeNull();
    expect(aggregateRatings('WRITE_EMAIL', RESPONSE, [{ dimensions: {} }, sample(2)])!.samples).toBe(1);
  });

  it('clamps scores and works with custom dimension lists', () => {
    const custom = aggregateRatings(['a', 'b'], 'hello world', [{ dimensions: { a: { score: 9 }, b: { score: -3 } } }])!;
    expect(custom.dimensions.a.score).toBe(5);
    expect(custom.dimensions.b.score).toBe(0);
  });

  it('lowers confidence with disagreement, short text and heuristic mode', () => {
    const steady = ratingConfidence({ method: 'llm', spread: 0, wordCount: 100, minWords: 60, samples: 2 });
    const noisy = ratingConfidence({ method: 'llm', spread: 2, wordCount: 100, minWords: 60, samples: 2 });
    const short = ratingConfidence({ method: 'llm', spread: 0, wordCount: 20, minWords: 60, samples: 2 });
    const heuristic = ratingConfidence({ method: 'heuristic', spread: 0, wordCount: 100, minWords: 60, samples: 0 });
    expect(steady).toBeGreaterThan(noisy);
    expect(steady).toBeGreaterThan(short);
    expect(heuristic).toBeLessThan(0.5);
  });
});
