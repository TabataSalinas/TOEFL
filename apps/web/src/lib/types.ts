export type Section = 'READING' | 'LISTENING' | 'SPEAKING' | 'WRITING';
export type ExamKind = 'FULL' | 'SECTION';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface Option {
  id: string;
  text: string;
}

export type Meta = Record<string, any>;

export interface Question {
  id: string;
  passageId: string | null;
  order: number;
  type: string;
  taskKind: string | null;
  prompt: string;
  options: Option[] | null;
  points: number;
  timeLimitSec: number | null;
  meta: Meta;
  audioUrl?: string;
}

export interface Passage {
  id: string;
  order: number;
  kind: string | null;
  title: string | null;
  topic: string | null;
  /** null for listening stimuli (audio only). */
  body: string | null;
  meta: Meta;
}

export interface Step {
  id: string;
  kind: string;
  title: string;
  instructions: string;
  passageId: string;
  questionIds: string[];
  timeLimitSec?: number;
}

export interface SectionState {
  sectionAttemptId: string;
  section: Section;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';
  module: number;
  moduleCount: number;
  startedAt: string | null;
  deadlineAt: string | null;
  remainingSec: number | null;
  timeSpentSec: number;
}

export interface AttemptState {
  id: string;
  examId: string;
  kind: ExamKind;
  status: string;
  startedAt: string;
  completedAt: string | null;
  sections: SectionState[];
  nextModule?: number | null;
}

export interface SectionPayload {
  sectionAttemptId: string;
  section: Section;
  module: number;
  moduleCount: number;
  instructions: string;
  timeLimitSec: number;
  startedAt: string;
  deadlineAt: string;
  steps: Step[];
  passages: Passage[];
  questions: Question[];
  savedAnswers: { questionId: string; response: unknown; locked: boolean }[];
}

export interface Dashboard {
  streak: { current: number; longest: number; lastStudyDate: string | null };
  goals: {
    weekly: GoalProgress | null;
    monthly: GoalProgress | null;
  };
  totals: { totalStudyMinutes: number; totalAttempts: number };
  score: {
    latest: number | null;
    latestBand: number | null;
    target: number;
    targetBand: number;
    progressToTargetPercent: number;
  };
  readiness: { level: string; label: string; percent: number };
  recentAttempts: { id: string; title: string; date: string; total: number | null }[];
}

export interface GoalProgress {
  targetMinutes: number;
  completedMinutes: number;
  percent: number;
}
