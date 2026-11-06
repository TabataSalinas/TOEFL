/**
 * TOEFL iBT structural constants.
 *
 * These reflect the *general structure and timing* of the exam, used to make
 * simulations realistic. No official ETS content is reproduced.
 *
 * The platform supports BOTH score representations:
 *  - Classic scaled scores: 0–30 per section, 0–120 total.
 *  - 2026 banded scale: 1–6 (0.5 increments) per section and total.
 *
 * Section timings below approximate a classic full iBT. They are configurable
 * per generated exam.
 */

import { Section } from '@prisma/client';

export interface SectionBlueprint {
  section: Section;
  /** Approx time limit for the section (seconds). */
  timeLimitSec: number;
  /** Number of passages/stimuli to generate. */
  passages: number;
  /** Questions per passage/stimulus. */
  questionsPerPassage: number;
  /** Short instructions shown before the section. */
  instructions: string;
}

export const SECTION_BLUEPRINTS: Record<Section, SectionBlueprint> = {
  READING: {
    section: 'READING',
    timeLimitSec: 35 * 60,
    passages: 2,
    questionsPerPassage: 10,
    instructions:
      'Read each passage and answer the questions. You may navigate between questions within this section. The timer continues to run.',
  },
  LISTENING: {
    section: 'LISTENING',
    timeLimitSec: 36 * 60,
    passages: 3,
    questionsPerPassage: 5,
    instructions:
      'Listen to each lecture or conversation once, then answer the questions. You cannot replay audio during the exam.',
  },
  SPEAKING: {
    section: 'SPEAKING',
    timeLimitSec: 16 * 60,
    passages: 0,
    questionsPerPassage: 0,
    instructions:
      'You will speak into your microphone to answer each task. Recording starts and stops automatically.',
  },
  WRITING: {
    section: 'WRITING',
    timeLimitSec: 29 * 60,
    passages: 0,
    questionsPerPassage: 0,
    instructions:
      'You will type a response for each task. The timer continues to run.',
  },
};

/** Order in which sections appear in a full exam. */
export const FULL_EXAM_SECTION_ORDER: Section[] = [
  'READING',
  'LISTENING',
  'SPEAKING',
  'WRITING',
];

/**
 * Map a 0..30 scaled score to the 2026 band scale (1..6, 0.5 increments).
 * This is an internal approximation for study feedback, not an official mapping.
 */
export function scaledToBand(scaled: number): number {
  const ratio = Math.max(0, Math.min(30, scaled)) / 30; // 0..1
  const raw = 1 + ratio * 5; // 1..6
  // round to nearest 0.5
  return Math.round(raw * 2) / 2;
}

/** Map a 0..120 total to a 1..6 band (approximation). */
export function totalToBand(total: number): number {
  const ratio = Math.max(0, Math.min(120, total)) / 120;
  const raw = 1 + ratio * 5;
  return Math.round(raw * 2) / 2;
}

/** CEFR-ish label for a band, for human-friendly feedback. */
export function bandLabel(band: number): string {
  if (band >= 5.5) return 'Advanced (C1+)';
  if (band >= 4.5) return 'Upper-Intermediate (B2+)';
  if (band >= 3.5) return 'Intermediate (B1–B2)';
  if (band >= 2.5) return 'Lower-Intermediate (B1)';
  if (band >= 1.5) return 'Elementary (A2)';
  return 'Beginner (A1)';
}
