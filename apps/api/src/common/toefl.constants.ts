/**
 * TOEFL iBT structure (format in force since January 21, 2026).
 *
 * Task types, item counts and module structure follow the public practice
 * test supplied by the user and ETS public descriptions. Times are
 * *approximations* of the published section durations (Reading ≈ 27–30 min,
 * Listening ≈ 25–29 min, Writing ≈ 23 min, Speaking ≈ 8 min) and are
 * configurable here. No ETS item content is reproduced anywhere in this repo.
 *
 * This file is dependency-free on purpose so it can be unit-tested in isolation.
 */

export type SectionName = 'READING' | 'LISTENING' | 'SPEAKING' | 'WRITING';

export type TaskKind =
  | 'COMPLETE_WORDS'
  | 'DAILY_LIFE'
  | 'ACADEMIC_PASSAGE'
  | 'CHOOSE_RESPONSE'
  | 'CONVERSATION'
  | 'ANNOUNCEMENT'
  | 'ACADEMIC_TALK'
  | 'BUILD_SENTENCE'
  | 'WRITE_EMAIL'
  | 'ACADEMIC_DISCUSSION'
  | 'LISTEN_REPEAT'
  | 'INTERVIEW';

export type Difficulty = 'easy' | 'standard' | 'hard';
export type Variant = 'core' | 'easy' | 'hard';

export type QuestionTypeName =
  | 'READING_COMPLETE_WORDS'
  | 'READING_MAIN_PURPOSE'
  | 'READING_DETAIL'
  | 'READING_FACTUAL'
  | 'READING_NEGATIVE_FACTUAL'
  | 'READING_VOCABULARY'
  | 'READING_INFERENCE'
  | 'READING_RHETORICAL_PURPOSE'
  | 'READING_PARAGRAPH_RELATIONSHIP'
  | 'LISTENING_CHOOSE_RESPONSE'
  | 'LISTENING_MAIN_IDEA'
  | 'LISTENING_DETAIL'
  | 'LISTENING_FUNCTION'
  | 'LISTENING_ATTITUDE'
  | 'LISTENING_INFERENCE'
  | 'LISTENING_PREDICTION'
  | 'WRITING_BUILD_SENTENCE'
  | 'WRITING_EMAIL'
  | 'WRITING_ACADEMIC_DISCUSSION'
  | 'SPEAKING_LISTEN_REPEAT'
  | 'SPEAKING_INTERVIEW';

export interface TaskSpec {
  kind: TaskKind;
  /** One entry per stimulus; the number is how many questions it carries. */
  questionCounts: number[];
  /** Per-question clock (seconds), where the real test shows one. */
  perQuestionSec?: number;
  /** Clock for the whole task (seconds), where the real test shows one. */
  taskSec?: number;
  title: string;
  instructions: string;
}

export interface ModuleBlueprint {
  section: SectionName;
  module: number;
  /** Hard ceiling for the module (server-authoritative deadline). */
  timeLimitSec: number;
  tasks: TaskSpec[];
}

const R_TASKS: TaskSpec[] = [
  {
    kind: 'COMPLETE_WORDS',
    questionCounts: [10],
    title: 'Complete the Words',
    instructions: 'Fill in the missing letters in the paragraph.',
  },
  {
    kind: 'DAILY_LIFE',
    questionCounts: [2, 3],
    title: 'Read in Daily Life',
    instructions: 'Read the text and answer the questions.',
  },
  {
    kind: 'ACADEMIC_PASSAGE',
    questionCounts: [5],
    title: 'Read an Academic Passage',
    instructions: 'Read the passage and answer the questions.',
  },
];

const L_TASKS: TaskSpec[] = [
  {
    kind: 'CHOOSE_RESPONSE',
    questionCounts: [1, 1, 1, 1, 1, 1, 1, 1],
    perQuestionSec: 20,
    title: 'Listen and Choose a Response',
    instructions: 'Choose the best response.',
  },
  {
    kind: 'CONVERSATION',
    questionCounts: [2, 2],
    perQuestionSec: 30,
    title: 'Conversations',
    instructions: 'Listen to the conversation, then answer the questions.',
  },
  {
    kind: 'ANNOUNCEMENT',
    questionCounts: [2],
    perQuestionSec: 30,
    title: 'Announcement',
    instructions: 'Listen to the announcement, then answer the questions.',
  },
  {
    kind: 'ACADEMIC_TALK',
    questionCounts: [4],
    perQuestionSec: 40,
    title: 'Academic Talk',
    instructions: 'Listen to the talk, then answer the questions.',
  },
];

export const MODULE_BLUEPRINTS: ModuleBlueprint[] = [
  { section: 'READING', module: 1, timeLimitSec: 14 * 60, tasks: R_TASKS },
  { section: 'READING', module: 2, timeLimitSec: 14 * 60, tasks: R_TASKS },
  { section: 'LISTENING', module: 1, timeLimitSec: 14 * 60, tasks: L_TASKS },
  { section: 'LISTENING', module: 2, timeLimitSec: 14 * 60, tasks: L_TASKS },
  {
    section: 'WRITING',
    module: 1,
    timeLimitSec: 23 * 60,
    tasks: [
      {
        kind: 'BUILD_SENTENCE',
        questionCounts: [10],
        taskSec: 6 * 60,
        title: 'Build a Sentence',
        instructions: 'Move the words to create grammatical sentences.',
      },
      {
        kind: 'WRITE_EMAIL',
        questionCounts: [1],
        taskSec: 7 * 60,
        title: 'Write an Email',
        instructions: 'Write an email using the information provided.',
      },
      {
        kind: 'ACADEMIC_DISCUSSION',
        questionCounts: [1],
        taskSec: 10 * 60,
        title: 'Write for an Academic Discussion',
        instructions: 'Contribute to the online discussion (at least 100 words).',
      },
    ],
  },
  {
    section: 'SPEAKING',
    module: 1,
    timeLimitSec: 10 * 60,
    tasks: [
      {
        kind: 'LISTEN_REPEAT',
        questionCounts: [7],
        perQuestionSec: 12,
        title: 'Listen and Repeat',
        instructions: 'Listen and repeat exactly what you hear. Repeat only once.',
      },
      {
        kind: 'INTERVIEW',
        questionCounts: [4],
        perQuestionSec: 45,
        title: 'Take an Interview',
        instructions: 'Answer the interviewer’s questions. No preparation time.',
      },
    ],
  },
];

export function getBlueprint(section: SectionName, module: number): ModuleBlueprint {
  const bp = MODULE_BLUEPRINTS.find((b) => b.section === section && b.module === module);
  if (!bp) throw new Error(`No blueprint for ${section} module ${module}`);
  return bp;
}

/** Number of modules in a section (2 for adaptive sections, otherwise 1). */
export function moduleCount(section: SectionName): number {
  return MODULE_BLUEPRINTS.filter((b) => b.section === section).length;
}

export const FULL_EXAM_SECTION_ORDER: SectionName[] = [
  'READING',
  'LISTENING',
  'WRITING',
  'SPEAKING',
];

/** Task kinds → section. */
export const TASK_SECTION: Record<TaskKind, SectionName> = {
  COMPLETE_WORDS: 'READING',
  DAILY_LIFE: 'READING',
  ACADEMIC_PASSAGE: 'READING',
  CHOOSE_RESPONSE: 'LISTENING',
  CONVERSATION: 'LISTENING',
  ANNOUNCEMENT: 'LISTENING',
  ACADEMIC_TALK: 'LISTENING',
  BUILD_SENTENCE: 'WRITING',
  WRITE_EMAIL: 'WRITING',
  ACADEMIC_DISCUSSION: 'WRITING',
  LISTEN_REPEAT: 'SPEAKING',
  INTERVIEW: 'SPEAKING',
};

// ───────────────────────── Adaptive routing & scoring ─────────────────────────

/** Module-1 accuracy at or above this value routes the test taker to the hard module 2. */
export const ADAPTIVE_THRESHOLD = 0.65;

export function routeModule2(module1Accuracy: number): Variant {
  return module1Accuracy >= ADAPTIVE_THRESHOLD ? 'hard' : 'easy';
}

/**
 * Combine module accuracies into a 0..30 section score.
 * Module 2 counts more (it is the more informative, better-targeted module) and the
 * path sets the achievable range: easy path 0..24, hard path 6..30.
 * Internal approximation for study feedback — NOT an official ETS equating.
 */
export function combineAdaptive(
  acc1: number,
  acc2: number | null,
  variant2: Variant | null,
): number {
  if (acc2 == null || variant2 == null) return Math.round(acc1 * 30);
  const composite = 0.4 * acc1 + 0.6 * acc2;
  return variant2 === 'hard'
    ? Math.round(6 + composite * 24)
    : Math.round(composite * 24);
}

/**
 * Map a 0..30 scaled score to the 2026 band scale (1..6, 0.5 steps).
 * Internal approximation, not an official mapping.
 */
export function scaledToBand(scaled: number): number {
  const ratio = Math.max(0, Math.min(30, scaled)) / 30;
  return Math.round((1 + ratio * 5) * 2) / 2;
}

/** Map a 0..120 total to a 1..6 band (approximation). */
export function totalToBand(total: number): number {
  const ratio = Math.max(0, Math.min(120, total)) / 120;
  return Math.round((1 + ratio * 5) * 2) / 2;
}

/** CEFR-ish label for a band. */
export function bandLabel(band: number): string {
  if (band >= 5.5) return 'Advanced (C1+)';
  if (band >= 4.5) return 'Upper-Intermediate (B2+)';
  if (band >= 3.5) return 'Intermediate (B1–B2)';
  if (band >= 2.5) return 'Lower-Intermediate (B1)';
  if (band >= 1.5) return 'Elementary (A2)';
  return 'Beginner (A1)';
}

/** Weights used to combine Writing components (documented in docs/SCORING.md). */
export const WRITING_WEIGHTS = { buildSentence: 0.2, email: 0.35, discussion: 0.45 };
/** Weights used to combine Speaking components. */
export const SPEAKING_WEIGHTS = { listenRepeat: 0.4, interview: 0.6 };
