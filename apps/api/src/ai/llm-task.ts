import {
  GenerateTaskParams,
  GeneratedQuestion,
  GeneratedStimulus,
} from './ai.types';
import { QuestionTypeName, TaskKind } from '../common/toefl.constants';
import { buildCTest } from '../content/ctest';
import { toQuestion, validateBuildItem } from '../content/build-sentence';
import { mulberry32, randomSeed } from '../content/text-utils';
import {
  DAILY_LIFE_GENRES,
  DAILY_LIFE_SCENARIOS,
  ANNOUNCEMENT_SCENARIOS,
  CONVERSATION_SCENARIOS,
  EMAIL_SCENARIOS,
  INTERVIEW_THEMES,
  sampleAcademicTopic,
  sampleFrom,
  sampleMany,
} from '../content/topics';

const LETTERS = ['A', 'B', 'C', 'D'];

export const ALLOWED_TYPES: Partial<Record<TaskKind, QuestionTypeName[]>> = {
  DAILY_LIFE: ['READING_MAIN_PURPOSE', 'READING_DETAIL', 'READING_INFERENCE'],
  ACADEMIC_PASSAGE: [
    'READING_VOCABULARY',
    'READING_FACTUAL',
    'READING_NEGATIVE_FACTUAL',
    'READING_PARAGRAPH_RELATIONSHIP',
    'READING_RHETORICAL_PURPOSE',
    'READING_INFERENCE',
  ],
  CHOOSE_RESPONSE: ['LISTENING_CHOOSE_RESPONSE'],
  CONVERSATION: ['LISTENING_MAIN_IDEA', 'LISTENING_DETAIL', 'LISTENING_FUNCTION', 'LISTENING_INFERENCE', 'LISTENING_PREDICTION'],
  ANNOUNCEMENT: ['LISTENING_MAIN_IDEA', 'LISTENING_DETAIL', 'LISTENING_FUNCTION', 'LISTENING_PREDICTION'],
  ACADEMIC_TALK: ['LISTENING_MAIN_IDEA', 'LISTENING_DETAIL', 'LISTENING_FUNCTION', 'LISTENING_INFERENCE', 'LISTENING_ATTITUDE', 'LISTENING_PREDICTION'],
};

const DEFAULT_TYPE: Partial<Record<TaskKind, QuestionTypeName>> = {
  DAILY_LIFE: 'READING_DETAIL',
  ACADEMIC_PASSAGE: 'READING_FACTUAL',
  CHOOSE_RESPONSE: 'LISTENING_CHOOSE_RESPONSE',
  CONVERSATION: 'LISTENING_DETAIL',
  ANNOUNCEMENT: 'LISTENING_DETAIL',
  ACADEMIC_TALK: 'LISTENING_DETAIL',
};

const PER_Q_SEC: Partial<Record<TaskKind, number>> = {
  CHOOSE_RESPONSE: 20,
  CONVERSATION: 30,
  ANNOUNCEMENT: 30,
  ACADEMIC_TALK: 40,
};

const LEVEL: Record<string, string> = {
  easy: 'CEFR B1: common vocabulary, explicit information, simple inferences.',
  standard: 'CEFR B2: academic-leaning vocabulary, some implicit information.',
  hard: 'CEFR C1: abstract vocabulary, subtle inference, plausible distractors that require careful reading.',
};

export const SYSTEM_PROMPT = [
  'You are a senior item writer for an English-proficiency exam modeled on the 2026 TOEFL iBT format.',
  'Write ORIGINAL content only. Never reproduce, closely paraphrase, or imitate specific copyrighted test items.',
  'Use neutral international English, no slang. Be factually accurate.',
  'Multiple-choice rules: exactly 4 options of similar length; exactly ONE clearly correct option supported by the text;',
  'distractors must be plausible but wrong (misreading, over-generalisation, opposite, unmentioned); never use "all of the above".',
  'Return ONLY valid JSON that matches the requested schema. No markdown.',
].join(' ');

const MCQ_SCHEMA =
  '{"type": one of the allowed question types, "prompt": string, "options": [4 strings], "answerIndex": 0-3, "explanation": string (why the key is right and why a typical distractor is wrong), "skillTag": short-kebab-case, "highlight": optional word that appears verbatim in the text (vocabulary questions only)}';

function groundingBlock(p: GenerateTaskParams): string {
  if (!p.grounding?.length) return '';
  const docs = p.grounding
    .map((g) => `- ${g.title} (${g.license}, ${g.url}): ${g.text.slice(0, 1200)}`)
    .join('\n');
  return `\nFACT SOURCES — use ONLY as a factual basis; write entirely in your own words; never copy sentences:\n${docs}\n`;
}

function avoidBlock(p: GenerateTaskParams): string {
  return p.avoidTopics.length ? `\nAvoid these recently used topics: ${p.avoidTopics.slice(0, 25).join('; ')}.` : '';
}

/** Build the (system, user) prompt for a task. */
export function buildPrompt(p: GenerateTaskParams): { system: string; user: string } {
  const rand = mulberry32(p.seed ?? randomSeed());
  const level = LEVEL[p.difficulty];
  const counts = p.questionCounts;
  const types = ALLOWED_TYPES[p.kind]?.join(', ') ?? '';
  const common = `Difficulty: ${level}${avoidBlock(p)}${groundingBlock(p)}`;
  let user = '';

  switch (p.kind) {
    case 'COMPLETE_WORDS': {
      const { field, topic } = sampleAcademicTopic(rand, p.avoidTopics);
      user = `Write ONE paragraph of 75–95 words (5–7 sentences) about "${topic}" (${field}). Clear, informative, accessible. The first sentence must be short and self-contained. Avoid numbers, hyphenated words, and rare proper nouns.\n${common}\nJSON: {"topic": string, "paragraph": string}`;
      break;
    }
    case 'DAILY_LIFE': {
      const specs = counts.map((n) => `${n} questions about ${sampleFrom(DAILY_LIFE_GENRES, rand)} concerning ${sampleFrom(DAILY_LIFE_SCENARIOS, rand, p.avoidTopics)}`);
      user = `Create ${counts.length} short everyday reading texts (emails, notices, flyers, or text-message chains), 60–140 words each, as follows: ${specs.map((s, i) => `(${i + 1}) ${s}`).join('; ')}. Include a realistic names/dates/times. Questions types allowed: ${types}; include at least one detail question and one inference question overall.\n${common}\nJSON: {"stimuli":[{"format":"email|notice|flyer|text_chain","title":string,"topic":string,"from":string?,"to":string?,"date":string?,"subject":string?,"body":string,"questions":[${MCQ_SCHEMA}]}]}`;
      break;
    }
    case 'ACADEMIC_PASSAGE': {
      const picks = counts.map((_, i) => (p.topics?.[i] ? { field: 'university course', topic: p.topics[i] } : sampleAcademicTopic(rand, p.avoidTopics)));
      user = `Write ${counts.length} university-level passage(s) of 190–250 words in exactly three paragraphs separated by a blank line. Topics: ${picks.map((t, i) => `(${i + 1}) "${t.topic}" (${t.field}) with ${counts[i]} questions`).join('; ')}. Question types allowed: ${types}. Required mix per passage: one vocabulary-in-context (word appears verbatim; give it in "highlight"), one factual detail, one NEGATIVE factual ("…EXCEPT"), one paragraph-relationship (paragraph 2 vs 3) OR rhetorical purpose, and one inference. Present balanced information, no opinions of the writer unless attributed.\n${common}\nJSON: {"stimuli":[{"title":string,"topic":string,"body":string,"questions":[${MCQ_SCHEMA}]}]}`;
      break;
    }
    case 'CHOOSE_RESPONSE': {
      user = `Write ${counts.length} short spoken lines (6–16 words) a speaker might say in everyday campus or work life (questions, statements, requests, complaints). For each, give 4 candidate replies of 3–10 words; exactly one is the natural, appropriate reply. Distractors should use similar-sounding or related words, answer a different question, or have the wrong tense/person. Vary the speaker ("Man"/"Woman") and function (offer, refusal, suggestion, confirmation, indirect answer).\n${common}\nJSON: {"items":[{"speaker":"Man|Woman","text":string,"options":[4 strings],"answerIndex":0-3,"explanation":string}]}`;
      break;
    }
    case 'CONVERSATION': {
      const specs = counts.map((n) => `${n} questions, scenario: ${sampleFrom(CONVERSATION_SCENARIOS, rand, p.avoidTopics)}`);
      user = `Write ${counts.length} natural conversation(s) between two speakers, 90–150 words each, 6–9 turns, with contractions and fillers like "Well," or "Actually,". ${specs.map((s, i) => `(${i + 1}) ${s}`).join('; ')}. Question types allowed: ${types}. Include one question asking what a speaker implies when saying a quoted line (the quote must appear verbatim), and one asking what happens next when natural.\n${common}\nJSON: {"stimuli":[{"title":string,"topic":string,"turns":[{"speaker":"Man|Woman","text":string}],"questions":[${MCQ_SCHEMA}]}]}`;
      break;
    }
    case 'ANNOUNCEMENT': {
      const sc = counts.map(() => sampleFrom(ANNOUNCEMENT_SCENARIOS, rand, p.avoidTopics));
      user = `Write ${counts.length} spoken announcement(s) of 60–100 words by a single announcer. Scenarios: ${sc.join('; ')}. ${counts.map((n, i) => `(${i + 1}) ${n} questions`).join('; ')}. Question types allowed: ${types}.\n${common}\nJSON: {"stimuli":[{"title":string,"topic":string,"turns":[{"speaker":"Announcer","text":string}],"questions":[${MCQ_SCHEMA}]}]}`;
      break;
    }
    case 'ACADEMIC_TALK': {
      const picks = counts.map((_, i) => (p.topics?.[i] ? { field: 'university course', topic: p.topics[i] } : sampleAcademicTopic(rand, p.avoidTopics)));
      user = `Write ${counts.length} excerpt(s) from a university lecture, spoken by one professor, 190–260 words each, in natural spoken style (rhetorical questions, "Now,", "So,", examples). Topics: ${picks.map((t, i) => `(${i + 1}) "${t.topic}" (${t.field}), ${counts[i]} questions`).join('; ')}. Question types allowed: ${types}. Include main idea, a "why does the professor mention…" function question, a detail, and an inference or prediction question.\n${common}\nJSON: {"stimuli":[{"title":string,"topic":string,"turns":[{"speaker":"Professor","text":string}],"questions":[${MCQ_SCHEMA}]}]}`;
      break;
    }
    case 'BUILD_SENTENCE': {
      user = `Create ${counts[0] ?? 10} "Build a Sentence" items. Each item: a "context" line (a statement or question by Speaker A, 6–12 words) and the target reply split into 5–10 "words" chunks (single words or fixed short phrases) in correct order; the first chunk capitalised. The reply must have ONE natural word order. Vary grammar: embedded questions, present perfect, relative clauses, reported speech, conditionals, modal questions. "end" is "." or "?". Optional "fixed": indices of chunks shown fixed (0–2 per item).\n${common}\nJSON: {"items":[{"context":string,"words":[string],"fixed":[int]?,"end":"."|"?"}]}`;
      break;
    }
    case 'WRITE_EMAIL': {
      user = `Create ONE "Write an Email" task. Scenario seed: ${sampleFrom(EMAIL_SCENARIOS, rand, p.avoidTopics)}. Give a 2–3 sentence scenario in second person, the recipient's first name or title, a subject line, and exactly 3 bullet instructions (explain a problem; describe a reaction/impact; propose a solution/next step).\n${common}\nJSON: {"scenario":string,"to":string,"subject":string,"bullets":[3 strings]}`;
      break;
    }
    case 'ACADEMIC_DISCUSSION': {
      user = `Create ONE "Academic Discussion" task: a professor's post (50–80 words) introducing a debatable issue in a university course (any field) and ending with a direct question, plus TWO student posts (35–60 words each) taking different positions with reasons. Use distinct first names.\n${common}\nJSON: {"field":string,"professor":string,"students":[{"name":string,"post":string},{"name":string,"post":string}]}`;
      break;
    }
    case 'LISTEN_REPEAT': {
      user = `Create ONE "Listen and Repeat" set: a context line describing a campus setting and a speaker (e.g. a guide, librarian, trainer) and exactly ${counts[0] ?? 7} sentences the speaker says, increasing in length: sentence 1 has 4–6 words, the last has 14–17 words. Natural, clear, no tongue-twisters, no numbers.\n${common}\nJSON: {"context":string,"sentences":[string]}`;
      break;
    }
    case 'INTERVIEW': {
      user = `Create ONE "Take an Interview" set on the theme "${sampleFrom(INTERVIEW_THEMES, rand, p.avoidTopics)}". A researcher asks exactly ${counts[0] ?? 4} spoken questions, answered without preparation: (1) personal preference + why (with a greeting), (2) a hypothetical choice between two options, (3) ask for one or two ways to improve something, giving reasons, (4) ask for the positive AND negative effects of a trend, one example of each.\n${common}\nJSON: {"context":string,"questions":[string]}`;
      break;
    }
  }
  return { system: SYSTEM_PROMPT, user };
}

// ───────────────────────────── Parsing ─────────────────────────────

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function str(v: unknown, field: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new Error(`missing field: ${field}`);
  return v.trim();
}

function parseMcq(kind: TaskKind, r: Raw, body: string): GeneratedQuestion {
  const allowed = ALLOWED_TYPES[kind] ?? [];
  const type = (allowed.includes(r.type) ? r.type : DEFAULT_TYPE[kind]) as QuestionTypeName;
  if (!Array.isArray(r.options) || r.options.length !== 4) throw new Error('question needs 4 options');
  const idx = Number(r.answerIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx > 3) throw new Error('bad answerIndex');
  const meta: Record<string, unknown> = {};
  if (type === 'READING_VOCABULARY' && typeof r.highlight === 'string') {
    if (body.toLowerCase().includes(r.highlight.toLowerCase())) meta.highlight = r.highlight;
  }
  return {
    type,
    prompt: str(r.prompt, 'prompt'),
    options: r.options.map((t: unknown, i: number) => ({ id: LETTERS[i], text: str(String(t), 'option') })),
    correctAnswer: LETTERS[idx],
    explanation: str(r.explanation, 'explanation'),
    skillTag: typeof r.skillTag === 'string' && r.skillTag ? r.skillTag : 'general',
    points: 1,
    timeLimitSec: PER_Q_SEC[kind],
    meta: Object.keys(meta).length ? meta : undefined,
  };
}

function turnsToBody(turns: Array<{ speaker: string; text: string }>): string {
  return turns.map((t) => `${t.speaker}: ${t.text}`).join('\n');
}

/** Convert the raw LLM JSON for a task into stimuli. Throws on malformed output. */
export function parseLlmTask(p: GenerateTaskParams, raw: Raw): GeneratedStimulus[] {
  const kind = p.kind;
  switch (kind) {
    case 'COMPLETE_WORDS': {
      const paragraph = str(raw.paragraph, 'paragraph');
      const ct = buildCTest(paragraph, p.questionCounts[0] ?? 10);
      if (ct.items.length < (p.questionCounts[0] ?? 10)) throw new Error('paragraph too short for the blanks');
      return [
        {
          kind: 'complete_words',
          title: 'Complete the Words',
          topic: String(raw.topic ?? 'general'),
          body: ct.text,
          questions: ct.items.map((it) => ({
            type: 'READING_COMPLETE_WORDS' as const,
            prompt: `Blank ${it.n}`,
            correctAnswer: it.answer,
            explanation: `The complete word is “${it.full}”.`,
            skillTag: 'complete-words',
            points: 1,
            meta: { n: it.n, prefix: it.prefix, length: it.answer.length },
          })),
        },
      ];
    }
    case 'DAILY_LIFE':
    case 'ACADEMIC_PASSAGE': {
      const list = Array.isArray(raw.stimuli) ? raw.stimuli : [];
      if (list.length !== p.questionCounts.length) throw new Error('wrong number of stimuli');
      return list.map((s: Raw) => {
        const body = str(s.body, 'body');
        const isDaily = kind === 'DAILY_LIFE';
        return {
          kind: isDaily ? 'daily_life' : 'academic',
          title: str(s.title, 'title'),
          topic: String(s.topic ?? 'general'),
          body,
          meta: isDaily ? { format: s.format ?? 'email', from: s.from, to: s.to, date: s.date, subject: s.subject } : undefined,
          questions: (Array.isArray(s.questions) ? s.questions : []).map((q: Raw) => parseMcq(kind, q, body)),
        };
      });
    }
    case 'CHOOSE_RESPONSE': {
      const items = Array.isArray(raw.items) ? raw.items : [];
      if (items.length !== p.questionCounts.length) throw new Error('wrong number of items');
      return items.map((it: Raw) => {
        const text = str(it.text, 'text');
        const speaker = it.speaker === 'Man' ? 'Man' : 'Woman';
        return {
          kind: 'choose_response',
          title: 'Choose the best response',
          topic: 'daily conversation',
          body: text,
          meta: { speaker, turns: [{ speaker, text }] },
          questions: [parseMcq(kind, { ...it, type: 'LISTENING_CHOOSE_RESPONSE', prompt: 'Choose the best response.' }, text)],
        };
      });
    }
    case 'CONVERSATION':
    case 'ANNOUNCEMENT':
    case 'ACADEMIC_TALK': {
      const list = Array.isArray(raw.stimuli) ? raw.stimuli : [];
      if (list.length !== p.questionCounts.length) throw new Error('wrong number of stimuli');
      const ctx: Record<string, string> = {
        CONVERSATION: 'Listen to a conversation.',
        ANNOUNCEMENT: 'Listen to an announcement.',
        ACADEMIC_TALK: 'Listen to a talk in a class.',
      };
      const stim: Record<string, string> = { CONVERSATION: 'conversation', ANNOUNCEMENT: 'announcement', ACADEMIC_TALK: 'talk' };
      return list.map((s: Raw) => {
        const turns = (Array.isArray(s.turns) ? s.turns : []).map((t: Raw) => ({ speaker: str(t.speaker, 'speaker'), text: str(t.text, 'text') }));
        if (turns.length === 0) throw new Error('no turns');
        const body = turnsToBody(turns);
        return {
          kind: stim[kind],
          title: str(s.title, 'title'),
          topic: String(s.topic ?? 'general'),
          body,
          meta: { context: ctx[kind], turns },
          questions: (Array.isArray(s.questions) ? s.questions : []).map((q: Raw) => parseMcq(kind, q, body)),
        };
      });
    }
    case 'BUILD_SENTENCE': {
      const items = Array.isArray(raw.items) ? raw.items : [];
      const rand = mulberry32(p.seed ?? randomSeed());
      const qs = items.map((it: Raw) => {
        const words = (Array.isArray(it.words) ? it.words : []).map((w: unknown) => String(w).trim()).filter(Boolean);
        const q = toQuestion(
          { context: str(it.context, 'context'), words, fixed: Array.isArray(it.fixed) ? it.fixed.filter((n: unknown) => Number.isInteger(n)) : [], end: it.end === '?' ? '?' : '.' },
          rand,
        );
        const problems = validateBuildItem(q);
        if (problems.length) throw new Error(`build item invalid: ${problems.join(', ')}`);
        return {
          type: 'WRITING_BUILD_SENTENCE' as const,
          prompt: q.context,
          correctAnswer: q.answer,
          explanation: `Correct sentence: “${q.sentence}”`,
          skillTag: 'build-sentence',
          points: 1,
          meta: { chunks: q.chunks, layout: q.layout, end: q.end },
        };
      });
      if (qs.length < (p.questionCounts[0] ?? 10)) throw new Error('not enough build-sentence items');
      return [{ kind: 'build_sentence', title: 'Build a Sentence', topic: 'grammar', body: '', questions: qs.slice(0, p.questionCounts[0] ?? 10) }];
    }
    case 'WRITE_EMAIL': {
      const bullets = Array.isArray(raw.bullets) ? raw.bullets.map(String) : [];
      if (bullets.length !== 3) throw new Error('email needs 3 bullets');
      const to = str(raw.to, 'to');
      return [
        {
          kind: 'email_task',
          title: 'Write an Email',
          topic: 'email',
          body: str(raw.scenario, 'scenario'),
          meta: { to, subject: str(raw.subject, 'subject'), bullets },
          questions: [{ type: 'WRITING_EMAIL', prompt: `Write an email to ${to}. In your email, do the following.`, correctAnswer: '', explanation: 'Open-ended.', skillTag: 'write-email', points: 0 }],
        },
      ];
    }
    case 'ACADEMIC_DISCUSSION': {
      const students = (Array.isArray(raw.students) ? raw.students : []).map((s: Raw) => ({ name: str(s.name, 'name'), post: str(s.post, 'post') }));
      if (students.length !== 2) throw new Error('discussion needs 2 student posts');
      const professor = str(raw.professor, 'professor');
      return [
        {
          kind: 'discussion',
          title: 'Academic Discussion',
          topic: String(raw.field ?? 'general'),
          body: professor,
          meta: { field: raw.field, professor, students },
          questions: [{ type: 'WRITING_ACADEMIC_DISCUSSION', prompt: 'Write a post responding to the professor’s question.', correctAnswer: '', explanation: 'Open-ended.', skillTag: 'academic-discussion', points: 0 }],
        },
      ];
    }
    case 'LISTEN_REPEAT': {
      const sentences = (Array.isArray(raw.sentences) ? raw.sentences : []).map(String).filter(Boolean);
      const n = p.questionCounts[0] ?? 7;
      if (sentences.length < n) throw new Error('not enough sentences');
      const context = str(raw.context, 'context');
      return [
        {
          kind: 'listen_repeat',
          title: 'Listen and Repeat',
          topic: 'campus',
          body: context,
          meta: { context },
          questions: sentences.slice(0, n).map((s: string, i: number) => ({
            type: 'SPEAKING_LISTEN_REPEAT' as const,
            prompt: 'Listen and repeat.',
            correctAnswer: s,
            explanation: `Target sentence: “${s}”`,
            skillTag: 'listen-repeat',
            points: 0,
            timeLimitSec: 12 + Math.floor(i / 3) * 2,
            meta: { audioText: s, index: i + 1 },
          })),
        },
      ];
    }
    case 'INTERVIEW': {
      const qs = (Array.isArray(raw.questions) ? raw.questions : []).map(String).filter(Boolean);
      const n = p.questionCounts[0] ?? 4;
      if (qs.length < n) throw new Error('not enough interview questions');
      const context = str(raw.context, 'context');
      return [
        {
          kind: 'interview',
          title: 'Take an Interview',
          topic: 'interview',
          body: context,
          meta: { context },
          questions: qs.slice(0, n).map((q: string, i: number) => ({
            type: 'SPEAKING_INTERVIEW' as const,
            prompt: q,
            correctAnswer: '',
            explanation: 'Open-ended.',
            skillTag: 'interview',
            points: 0,
            timeLimitSec: 45,
            meta: { audioText: q, index: i + 1 },
          })),
        },
      ];
    }
  }
}
