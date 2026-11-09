import { words as tokenizeWords } from '../content/text-utils';

export interface Segment {
  start: number;
  end: number;
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export const THRESHOLDS = {
  /** Gaps ≥ this are counted as pauses. */
  pauseSec: 0.5,
  /** Gaps ≥ this are "long pauses" (excessive hesitation). */
  longPauseSec: 1.5,
  /** Gaps ≥ this are "prolonged silences" that break continuity. */
  silenceSec: 3,
};

export interface SpeechMetrics {
  durationSec: number;
  targetSec: number;
  usedSec: number;
  remainingSec: number;
  /** used / target, capped at 1.2 */
  timeUseRatio: number;
  wordCount: number;
  speakingSec: number | null;
  speakingRatio: number | null;
  /** words per minute over the whole recording. */
  wordsPerMinute: number;
  /** words per minute over speaking time only (articulation rate). */
  articulationWpm: number | null;
  pauseDataAvailable: boolean;
  pauseCount: number | null;
  longPauseCount: number | null;
  longSilenceCount: number | null;
  longestPauseSec: number | null;
  startLatencySec: number | null;
  fillers: { count: number; perMinute: number; items: Record<string, number> };
  repetitions: number;
  uniqueWordRatio: number;
  scores: { fluency: number; pace: number; continuity: number; timeCompliance: number };
}

const FILLER_PATTERNS: Array<[string, RegExp]> = [
  ['um', /\b(um+|umm+|erm)\b/gi],
  ['uh', /\b(uh+|er|ah+)\b/gi],
  ['hmm', /\bhm+\b/gi],
  ['you know', /\byou know\b/gi],
  ['I mean', /\bi mean\b/gi],
  ['like (filler)', /(?:^|[,.]\s*)like\b(?=\s*,)|,\s*like\s*,/gi],
  ['sort of / kind of', /\b(sort of|kind of)\b/gi],
];

const clamp = (n: number, lo = 0, hi = 5) => Math.max(lo, Math.min(hi, n));
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function countFillers(transcript: string): { count: number; items: Record<string, number> } {
  const items: Record<string, number> = {};
  let count = 0;
  for (const [label, re] of FILLER_PATTERNS) {
    const m = transcript.match(re);
    if (m && m.length) {
      items[label] = m.length;
      count += m.length;
    }
  }
  return { count, items };
}

export function countRepetitions(transcript: string): number {
  const ws = tokenizeWords(transcript);
  let n = 0;
  for (let i = 1; i < ws.length; i++) if (ws[i] === ws[i - 1] && ws[i].length <= 6) n++;
  return n;
}

/** Merge words closer than `gap` seconds into speech segments. */
export function segmentsFromWords(words: WordTiming[], gap = THRESHOLDS.pauseSec): Segment[] {
  const segs: Segment[] = [];
  for (const w of words) {
    const last = segs[segs.length - 1];
    if (last && w.start - last.end < gap) last.end = Math.max(last.end, w.end);
    else segs.push({ start: w.start, end: w.end });
  }
  return segs;
}

export function paceScore(wpm: number): number {
  if (wpm <= 0) return 0;
  if (wpm >= 120 && wpm <= 170) return 5;
  if (wpm > 170) return wpm <= 190 ? 4.5 : wpm <= 210 ? 3.5 : 2.5;
  if (wpm >= 100) return 4;
  if (wpm >= 80) return 3;
  if (wpm >= 60) return 2;
  return 1;
}

export function timeComplianceScore(ratio: number): number {
  if (ratio >= 0.85) return 5;
  if (ratio >= 0.7) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.3) return 2;
  return ratio > 0 ? 1 : 0;
}

export interface MetricsInput {
  transcript: string;
  durationSec: number;
  targetSec: number;
  /** Voice-activity segments (from the browser) — preferred. */
  speechSegments?: Segment[];
  /** Word timestamps (from ASR) — used when segments are missing. */
  words?: WordTiming[];
}

/** All delivery metrics for one spoken answer. Pure and deterministic. */
export function computeSpeechMetrics(input: MetricsInput): SpeechMetrics {
  const duration = Math.max(0.1, input.durationSec);
  const wc = tokenizeWords(input.transcript).length;
  const wpm = (wc / duration) * 60;
  const fillers = countFillers(input.transcript);
  const repetitions = countRepetitions(input.transcript);
  const ws = tokenizeWords(input.transcript);
  const unique = ws.length ? new Set(ws).size / ws.length : 0;

  let segments: Segment[] | null = null;
  if (input.speechSegments && input.speechSegments.length) {
    segments = [...input.speechSegments].sort((a, b) => a.start - b.start);
  } else if (input.words && input.words.length) {
    segments = segmentsFromWords(input.words);
  }

  let speakingSec: number | null = null;
  let pauseCount: number | null = null;
  let longPauseCount: number | null = null;
  let longSilenceCount: number | null = null;
  let longestPause: number | null = null;
  let startLatency: number | null = null;
  let lastSpeechEnd = duration;

  if (segments) {
    speakingSec = segments.reduce((a, s) => a + Math.max(0, s.end - s.start), 0);
    startLatency = Math.max(0, segments[0].start);
    lastSpeechEnd = segments[segments.length - 1].end;
    const gaps: number[] = [];
    for (let i = 1; i < segments.length; i++) gaps.push(segments[i].start - segments[i - 1].end);
    pauseCount = gaps.filter((g) => g >= THRESHOLDS.pauseSec).length;
    longPauseCount = gaps.filter((g) => g >= THRESHOLDS.longPauseSec).length;
    longSilenceCount = gaps.filter((g) => g >= THRESHOLDS.silenceSec).length;
    longestPause = gaps.length ? Math.max(0, ...gaps) : 0;
  }

  // "Used" time = from the start of the recording to the last speech.
  const used = segments ? Math.min(duration, lastSpeechEnd) : duration;
  const timeUseRatio = Math.min(1.2, used / Math.max(1, input.targetSec));
  const speakingRatio = speakingSec != null ? Math.min(1, speakingSec / Math.max(0.1, used)) : null;
  const perMinute = (fillers.count / duration) * 60;

  // Fluency: starts perfect and loses points for observable hesitation.
  let fluency = 5;
  if (longPauseCount != null) fluency -= Math.min(2.5, longPauseCount * 0.6);
  if (longSilenceCount != null) fluency -= Math.min(1.5, longSilenceCount * 0.5);
  fluency -= Math.min(1.5, Math.max(0, perMinute - 2) * 0.15);
  fluency -= Math.min(0.8, repetitions * 0.2);
  if (speakingRatio != null) fluency -= speakingRatio < 0.6 ? 1 : speakingRatio < 0.75 ? 0.5 : 0;
  if (startLatency != null && startLatency > 4) fluency -= 0.5;
  if (wc < 8) fluency = Math.min(fluency, 1.5);

  const articulation = speakingSec && speakingSec > 0 ? (wc / speakingSec) * 60 : null;
  const paceBasis = articulation && articulation > 0 ? Math.min(articulation, wpm * 1.6) : wpm;
  const continuity = speakingRatio != null ? 5 * clamp((speakingRatio - 0.4) / 0.5, 0, 1) : clamp(paceScore(wpm), 0, 5);

  return {
    durationSec: r1(duration),
    targetSec: input.targetSec,
    usedSec: r1(used),
    remainingSec: r1(Math.max(0, input.targetSec - used)),
    timeUseRatio: r2(timeUseRatio),
    wordCount: wc,
    speakingSec: speakingSec != null ? r1(speakingSec) : null,
    speakingRatio: speakingRatio != null ? r2(speakingRatio) : null,
    wordsPerMinute: Math.round(wpm),
    articulationWpm: articulation != null ? Math.round(articulation) : null,
    pauseDataAvailable: !!segments,
    pauseCount,
    longPauseCount,
    longSilenceCount,
    longestPauseSec: longestPause != null ? r1(longestPause) : null,
    startLatencySec: startLatency != null ? r1(startLatency) : null,
    fillers: { count: fillers.count, perMinute: r1(perMinute), items: fillers.items },
    repetitions,
    uniqueWordRatio: r2(unique),
    scores: {
      fluency: r1(clamp(fluency)),
      pace: r1(paceScore(paceBasis)),
      continuity: r1(continuity),
      timeCompliance: timeComplianceScore(timeUseRatio),
    },
  };
}
