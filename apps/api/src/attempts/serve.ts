/**
 * Shapes what the client may see while an exam is in progress. Nothing here ever
 * includes correct answers, explanations or (for audio) the displayed transcript.
 */
export interface DbPassage {
  id: string;
  order: number;
  title: string | null;
  body: string;
  kind: string | null;
  topic: string | null;
  meta: unknown;
}

export interface DbQuestion {
  id: string;
  passageId: string | null;
  order: number;
  type: string;
  taskKind: string | null;
  prompt: string;
  options: unknown;
  points: number;
  timeLimitSec: number | null;
  meta: unknown;
}

const AUDIO_KINDS = new Set(['choose_response', 'conversation', 'announcement', 'talk']);

const mediaUrl = (key: string) => `/media/${key}`;

type Meta = Record<string, unknown>;
const asMeta = (m: unknown): Meta => (m && typeof m === 'object' ? (m as Meta) : {});

export interface ServedPassage {
  id: string;
  order: number;
  kind: string | null;
  title: string | null;
  topic: string | null;
  /** null for listening stimuli: the learner must listen, not read. */
  body: string | null;
  meta: Meta;
}

export function servePassage(p: DbPassage): ServedPassage {
  const meta = asMeta(p.meta);
  if (p.kind && AUDIO_KINDS.has(p.kind)) {
    const turns = Array.isArray(meta.turns) ? (meta.turns as Array<{ speaker: string; text: string }>) : [];
    const audio = Array.isArray(meta.audio) ? (meta.audio as string[]) : null;
    return {
      id: p.id,
      order: p.order,
      kind: p.kind,
      title: p.kind === 'choose_response' ? null : p.title,
      topic: null,
      body: null,
      meta: {
        context: meta.context,
        taskKind: meta.taskKind,
        taskTitle: meta.taskTitle,
        perQuestionSec: meta.perQuestionSec,
        speakers: turns.map((t) => t.speaker),
        // With server audio the text never leaves the server; otherwise the browser
        // synthesizes it (the UI still never displays it).
        audioUrls: audio ? audio.map(mediaUrl) : undefined,
        turns: audio ? undefined : turns,
      },
    };
  }
  if (p.kind === 'listen_repeat' || p.kind === 'interview') {
    return { id: p.id, order: p.order, kind: p.kind, title: p.title, topic: null, body: p.body, meta: { context: meta.context, taskKind: meta.taskKind, taskTitle: meta.taskTitle, taskInstructions: meta.taskInstructions } };
  }
  return { id: p.id, order: p.order, kind: p.kind, title: p.title, topic: null, body: p.body, meta };
}

export interface ServedQuestion {
  id: string;
  passageId: string | null;
  order: number;
  type: string;
  taskKind: string | null;
  prompt: string;
  options: unknown;
  points: number;
  timeLimitSec: number | null;
  meta: Meta;
  audioUrl?: string;
}

export function serveQuestion(q: DbQuestion): ServedQuestion {
  const meta = { ...asMeta(q.meta) };
  const audio = typeof meta.audio === 'string' ? meta.audio : undefined;
  let prompt = q.prompt;
  if (q.type === 'SPEAKING_LISTEN_REPEAT') {
    // The sentence to repeat is never displayed.
    prompt = 'Listen and repeat.';
    if (audio) delete meta.audioText;
  } else if (q.type === 'SPEAKING_INTERVIEW' && audio) {
    delete meta.audioText;
  }
  delete meta.audio;
  return {
    id: q.id,
    passageId: q.passageId,
    order: q.order,
    type: q.type,
    taskKind: q.taskKind,
    prompt,
    options: q.options,
    points: q.points,
    timeLimitSec: q.timeLimitSec,
    meta,
    audioUrl: audio ? mediaUrl(audio) : undefined,
  };
}

export interface Step {
  id: string;
  kind: string;
  title: string;
  instructions: string;
  passageId: string;
  questionIds: string[];
  /** Clock for the whole step (Writing tasks). */
  timeLimitSec?: number;
}

/** One step per stimulus/task, in order. */
export function buildSteps(passages: DbPassage[], questions: DbQuestion[]): Step[] {
  return passages
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((p) => {
      const meta = asMeta(p.meta);
      return {
        id: p.id,
        kind: String(meta.taskKind ?? p.kind ?? 'TASK'),
        title: String(meta.taskTitle ?? p.title ?? ''),
        instructions: String(meta.taskInstructions ?? ''),
        passageId: p.id,
        questionIds: questions.filter((q) => q.passageId === p.id).sort((a, b) => a.order - b.order).map((q) => q.id),
        timeLimitSec: typeof meta.taskSec === 'number' ? (meta.taskSec as number) : undefined,
      };
    });
}
