import { splitSentences, words } from '../content/text-utils';

/**
 * Transcript-only language indicators used when no LLM rater is available.
 * Intentionally coarse (low confidence): grammar/vocabulary/coherence/development.
 */
export interface SpeechLanguageScores {
  grammar: number;
  vocabulary: number;
  coherence: number;
  topic_development: number;
}

const CONNECTORS = ['because', 'for example', 'for instance', 'however', 'also', 'so', 'but', 'first', 'then', 'finally', 'although', 'on the other hand', 'as a result', 'that is why', 'in addition', 'such as'];

const clamp = (n: number) => Math.max(0, Math.min(5, n));
const half = (n: number) => Math.round(n * 2) / 2;

export function heuristicSpeechLanguage(transcript: string, targetSec: number): SpeechLanguageScores {
  const ws = words(transcript);
  const wc = ws.length;
  if (wc < 4) return { grammar: 0.5, vocabulary: 0.5, coherence: 0.5, topic_development: 0.5 };
  const lower = transcript.toLowerCase();
  const expected = (targetSec / 60) * 130; // words a fluent answer would contain
  const coverage = Math.min(1, wc / Math.max(20, expected * 0.8));
  const ttr = new Set(ws.slice(0, 120)).size / Math.min(ws.length, 120);
  const connectors = CONNECTORS.filter((c) => lower.includes(c)).length;
  const examples = /\b(for example|for instance|such as|last (week|year|semester)|when i)\b/.test(lower) ? 1 : 0;
  const sentences = Math.max(1, splitSentences(transcript).length);
  const avgLen = wc / sentences;
  // Without reliable punctuation, use word-length variety as a rough range signal.
  const longWords = ws.filter((w) => w.length >= 7).length / wc;
  return {
    grammar: half(clamp(2 + coverage * 1.5 + Math.min(1, avgLen / 14) * 0.5)),
    vocabulary: half(clamp(1 + ttr * 2.5 + longWords * 5 + coverage * 0.5)),
    coherence: half(clamp(1 + Math.min(2.5, connectors * 0.6) + coverage * 1.2)),
    topic_development: half(clamp(0.8 + coverage * 2.7 + examples * 1)),
  };
}
