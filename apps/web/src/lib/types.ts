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

export interface Question {
  id: string;
  passageId: string | null;
  order: number;
  type: string;
  section: Section;
  prompt: string;
  options: Option[] | null;
  points: number;
}

export interface Passage {
  id: string;
  order: number;
  title: string | null;
  body: string;
  audioUrl: string | null;
  topic: string | null;
}

export interface SectionState {
  sectionAttemptId: string;
  section: Section;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';
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
}

export interface SectionPayload {
  sectionAttemptId: string;
  section: Section;
  instructions: string;
  timeLimitSec: number;
  startedAt: string;
  deadlineAt: string;
  passages: Passage[];
  questions: Question[];
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
