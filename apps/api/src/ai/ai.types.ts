import {
  Difficulty,
  QuestionTypeName,
  SectionName,
  TaskKind,
} from '../common/toefl.constants';

export interface GeneratedOption {
  id: string; // "A".."D"
  text: string;
}

export interface GeneratedQuestion {
  type: QuestionTypeName;
  prompt: string;
  options?: GeneratedOption[];
  /** Option id for MCQ, string for Complete the Words, string[] for Build a Sentence. */
  correctAnswer: string | string[];
  explanation: string;
  skillTag: string;
  points: number;
  timeLimitSec?: number;
  meta?: Record<string, unknown>;
}

export interface SourceRef {
  provider: string;
  title: string;
  url: string;
  license: string;
}

/** One stimulus (passage / dialogue / task) with its questions. */
export interface GeneratedStimulus {
  kind: string;
  title: string;
  topic: string;
  body: string;
  meta?: Record<string, unknown>;
  questions: GeneratedQuestion[];
  bankId?: string;
  sourceRefs?: SourceRef[];
}

export interface GeneratedTask {
  kind: TaskKind;
  stimuli: GeneratedStimulus[];
  generatedBy: string;
}

export interface GroundingDoc {
  provider: string;
  title: string;
  url: string;
  license: string;
  text: string;
}

export interface GenerateTaskParams {
  kind: TaskKind;
  difficulty: Difficulty;
  /** One entry per stimulus: number of questions that stimulus must carry. */
  questionCounts: number[];
  avoidTopics: string[];
  avoidBankIds: string[];
  /** Contexts / bodies seen before (for near-duplicate rejection). */
  avoidTexts?: string[];
  seed?: number;
  /** Explicit topic per stimulus (academic kinds); sampled when omitted. */
  topics?: string[];
  grounding?: GroundingDoc[];
}

export interface AiProvider {
  readonly name: string;
  generateTask(params: GenerateTaskParams): Promise<GeneratedTask>;
}

/** Optional capabilities of an LLM backend. */
export interface JsonCompletionOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface SpeechWord {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptionResult {
  text: string;
  durationSec: number;
  words: SpeechWord[];
  /** 0..1 proxy of recognition confidence (from avg log-probability). */
  confidence: number | null;
}

export interface CoachSummaryInput {
  targetScore: number;
  estimatedTotal: number;
  weakestSkills: { skillTag: string; accuracy: number; section: SectionName }[];
  strongestSkills: { skillTag: string; accuracy: number; section: SectionName }[];
}
