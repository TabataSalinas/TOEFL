import { computeSpeechMetrics, countFillers, countRepetitions, paceScore, segmentsFromWords, timeComplianceScore } from './speech-metrics';

const FLUENT =
  'I usually prefer studying alone because I can concentrate better and finish my work early which gives me more free time for sports and friends in the evening.';

describe('speech metrics', () => {
  it('measures pace, pauses and time use for a fluent answer', () => {
    const m = computeSpeechMetrics({ transcript: FLUENT, durationSec: 15, targetSec: 45, speechSegments: [{ start: 0.5, end: 7 }, { start: 7.4, end: 14.5 }] });
    expect(m.wordCount).toBeGreaterThan(25);
    expect(m.wordsPerMinute).toBeGreaterThan(100);
    expect(m.longPauseCount).toBe(0);
    expect(m.scores.fluency).toBeGreaterThanOrEqual(4.5);
    expect(m.remainingSec).toBeGreaterThan(25);
    expect(m.pauseDataAvailable).toBe(true);
  });

  it('penalises long pauses, silences, fillers and repetitions', () => {
    const hes = computeSpeechMetrics({
      transcript: 'um I think uh I think that um studying is is good',
      durationSec: 40,
      targetSec: 45,
      speechSegments: [{ start: 5, end: 8 }, { start: 12, end: 14 }, { start: 19, end: 21 }, { start: 27, end: 29 }],
    });
    expect(hes.longPauseCount).toBe(3);
    expect(hes.longSilenceCount).toBeGreaterThanOrEqual(2);
    expect(hes.fillers.count).toBeGreaterThanOrEqual(3);
    expect(hes.repetitions).toBe(1);
    expect(hes.scores.fluency).toBeLessThan(3);
    expect(hes.startLatencySec).toBe(5);
  });

  it('derives pauses from ASR word timings when no VAD segments exist', () => {
    const m = computeSpeechMetrics({
      transcript: 'a b c d',
      durationSec: 10,
      targetSec: 20,
      words: [{ word: 'a', start: 0, end: 0.3 }, { word: 'b', start: 0.4, end: 0.7 }, { word: 'c', start: 3, end: 3.3 }, { word: 'd', start: 3.4, end: 3.7 }],
    });
    expect(m.longPauseCount).toBe(1);
    expect(segmentsFromWords([{ word: 'a', start: 0, end: 1 }, { word: 'b', start: 1.1, end: 2 }])).toHaveLength(1);
  });

  it('reports unknown pause data honestly', () => {
    const m = computeSpeechMetrics({ transcript: 'hello there my friend', durationSec: 5, targetSec: 12 });
    expect(m.pauseDataAvailable).toBe(false);
    expect(m.pauseCount).toBeNull();
  });

  it('counts fillers and repetitions', () => {
    expect(countFillers('Um, you know, I mean, it was, like, good').count).toBeGreaterThanOrEqual(4);
    expect(countRepetitions('the the cat sat sat')).toBe(2);
  });

  it('scores pace and time compliance', () => {
    expect(paceScore(140)).toBe(5);
    expect(paceScore(70)).toBe(2);
    expect(paceScore(230)).toBeLessThan(4);
    expect(timeComplianceScore(0.9)).toBe(5);
    expect(timeComplianceScore(0.2)).toBe(1);
    expect(timeComplianceScore(0)).toBe(0);
  });

  it('caps fluency for near-empty answers', () => {
    const m = computeSpeechMetrics({ transcript: 'yes', durationSec: 10, targetSec: 45, speechSegments: [{ start: 1, end: 1.5 }] });
    expect(m.scores.fluency).toBeLessThanOrEqual(1.5);
  });
});
