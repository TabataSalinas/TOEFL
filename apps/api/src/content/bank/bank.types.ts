import { Difficulty, QuestionTypeName, TaskKind } from '../../common/toefl.constants';

export interface BankQuestion {
  type: QuestionTypeName;
  prompt: string;
  /** Four options; `answer` is the index of the correct one. */
  options: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
  explanation: string;
  skillTag: string;
  meta?: Record<string, unknown>;
}

/**
 * Original, curated item (written for this project; NOT ETS material).
 * Used as offline fallback and as style anchors for the LLM.
 */
export interface BankStimulus {
  id: string;
  kind: TaskKind;
  difficulty: Difficulty;
  topic: string;
  title: string;
  body: string;
  meta?: Record<string, unknown>;
  questions: BankQuestion[];
}
