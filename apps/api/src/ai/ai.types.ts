import { QuestionType, Section } from '@prisma/client';

/** A generated multiple-choice option. */
export interface GeneratedOption {
  id: string; // "A" | "B" | ...
  text: string;
}

/** A generated question (objective, Reading/Listening). */
export interface GeneratedQuestion {
  type: QuestionType;
  prompt: string;
  options: GeneratedOption[];
  correctAnswer: string | string[];
  explanation: string;
  skillTag: string;
  points: number;
}

/** A generated passage/stimulus with its questions. */
export interface GeneratedPassage {
  title: string;
  body: string; // article text or listening transcript
  topic: string;
  /** Script for TTS when generating listening audio (phase 2 synthesizes it). */
  audioScript?: string;
  questions: GeneratedQuestion[];
}

/** A full generated section. */
export interface GeneratedSection {
  section: Section;
  instructions: string;
  timeLimitSec: number;
  passages: GeneratedPassage[];
  /** Productive tasks (Speaking/Writing) have prompts but no options. */
  tasks?: GeneratedProductiveTask[];
}

export interface GeneratedProductiveTask {
  type: QuestionType;
  prompt: string;
  skillTag: string;
  /** Optional reading/listening stimulus for integrated tasks. */
  stimulus?: string;
}

export interface GenerateSectionParams {
  section: Section;
  difficulty: 'easy' | 'standard' | 'hard';
  passages: number;
  questionsPerPassage: number;
  /** Topics already used recently, to avoid repetition. */
  avoidTopics?: string[];
  /** Deterministic seed for the mock provider / reproducibility. */
  seed?: number;
}

/** Feedback for a single answered question (used in reports). */
export interface AnswerExplanation {
  questionId: string;
  isCorrect: boolean;
  explanation: string;
}

/** The pluggable AI provider contract. */
export interface AiProvider {
  readonly name: string;
  generateSection(params: GenerateSectionParams): Promise<GeneratedSection>;
  /** Short natural-language coaching summary from a weakness profile. */
  generateCoachSummary(input: CoachSummaryInput): Promise<string>;
}

export interface CoachSummaryInput {
  targetScore: number;
  estimatedTotal: number;
  weakestSkills: { skillTag: string; accuracy: number; section: Section }[];
  strongestSkills: { skillTag: string; accuracy: number; section: Section }[];
}
