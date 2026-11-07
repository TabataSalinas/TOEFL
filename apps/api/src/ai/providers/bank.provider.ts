import { Injectable } from '@nestjs/common';
import {
  AiProvider,
  GenerateTaskParams,
  GeneratedQuestion,
  GeneratedStimulus,
  GeneratedTask,
} from '../ai.types';
import { Difficulty, TaskKind } from '../../common/toefl.constants';
import { BankQuestion, BankStimulus } from '../../content/bank/bank.types';
import {
  ANNOUNCEMENT_BANK,
  CHOOSE_RESPONSE_BANK,
  CONVERSATION_BANK,
  TALK_BANK,
} from '../../content/bank/listening.bank';
import { CTEST_PARAGRAPHS, READING_BANK } from '../../content/bank/reading.bank';
import {
  DISCUSSION_BANK,
  EMAIL_BANK,
  INTERVIEW_BANK,
  REPEAT_BANK,
} from '../../content/bank/productive.bank';
import { buildCTest } from '../../content/ctest';
import { generateBuildSentenceSet } from '../../content/build-sentence';
import { mulberry32, randomSeed, shuffle } from '../../content/text-utils';

const LETTERS = ['A', 'B', 'C', 'D'];

const SAME_KIND_BANK: Partial<Record<TaskKind, BankStimulus[]>> = {
  DAILY_LIFE: READING_BANK.filter((b) => b.kind === 'DAILY_LIFE'),
  ACADEMIC_PASSAGE: READING_BANK.filter((b) => b.kind === 'ACADEMIC_PASSAGE'),
  CHOOSE_RESPONSE: CHOOSE_RESPONSE_BANK,
  CONVERSATION: CONVERSATION_BANK,
  ANNOUNCEMENT: ANNOUNCEMENT_BANK,
  ACADEMIC_TALK: TALK_BANK,
};

const STIMULUS_KIND: Record<string, string> = {
  DAILY_LIFE: 'daily_life',
  ACADEMIC_PASSAGE: 'academic',
  CHOOSE_RESPONSE: 'choose_response',
  CONVERSATION: 'conversation',
  ANNOUNCEMENT: 'announcement',
  ACADEMIC_TALK: 'talk',
};

/** Choose n questions keeping their original order (random subset). */
export function pickQuestionSubset<T>(qs: T[], n: number, rand: () => number): T[] {
  if (n >= qs.length) return qs;
  const idx = shuffle(
    qs.map((_, i) => i),
    rand,
  )
    .slice(0, n)
    .sort((a, b) => a - b);
  return idx.map((i) => qs[i]);
}

function toGeneratedQuestion(q: BankQuestion, kind: TaskKind, timeLimitSec?: number): GeneratedQuestion {
  return {
    type: q.type,
    prompt: q.prompt,
    options: q.options.map((text, i) => ({ id: LETTERS[i], text })),
    correctAnswer: LETTERS[q.answer],
    explanation: q.explanation,
    skillTag: q.skillTag,
    points: 1,
    timeLimitSec,
    meta: q.meta,
  };
}

/** Prefer unseen items whose difficulty matches; fall back gracefully. */
export function pickBankItems(
  list: BankStimulus[],
  count: number,
  difficulty: Difficulty,
  avoidIds: string[],
  rand: () => number,
): BankStimulus[] {
  const avoid = new Set(avoidIds);
  const fit = (d: Difficulty) => (d === difficulty ? 2 : d === 'standard' || difficulty === 'standard' ? 1 : 0);
  const ranked = shuffle(list, rand)
    .map((item) => ({ item, unseen: avoid.has(item.id) ? 0 : 1, fit: fit(item.difficulty) }))
    .sort((a, b) => b.unseen - a.unseen || b.fit - a.fit);
  const out: BankStimulus[] = [];
  for (const r of ranked) {
    out.push(r.item);
    if (out.length === count) break;
  }
  // If the bank is smaller than needed, reuse (cycling) rather than fail.
  let i = 0;
  while (out.length < count && ranked.length) out.push(ranked[i++ % ranked.length].item);
  return out;
}

/**
 * Offline provider backed by the curated, original bank plus code-generated items
 * (C-test, Build a Sentence). It guarantees the platform is fully usable without an
 * API key. Variety is bounded by the bank size; the OpenAI provider is unbounded.
 */
@Injectable()
export class BankProvider implements AiProvider {
  readonly name = 'bank';

  async generateTask(params: GenerateTaskParams): Promise<GeneratedTask> {
    const rand = mulberry32(params.seed ?? randomSeed());
    const stimuli = this.build(params, rand);
    return { kind: params.kind, stimuli, generatedBy: this.name };
  }

  private build(p: GenerateTaskParams, rand: () => number): GeneratedStimulus[] {
    switch (p.kind) {
      case 'COMPLETE_WORDS':
        return this.completeWords(p, rand);
      case 'BUILD_SENTENCE':
        return this.buildSentence(p, rand);
      case 'WRITE_EMAIL':
        return this.writeEmail(p, rand);
      case 'ACADEMIC_DISCUSSION':
        return this.discussion(p, rand);
      case 'LISTEN_REPEAT':
        return this.listenRepeat(p, rand);
      case 'INTERVIEW':
        return this.interview(p, rand);
      default:
        return this.fromBank(p, rand);
    }
  }

  private fromBank(p: GenerateTaskParams, rand: () => number): GeneratedStimulus[] {
    const list = SAME_KIND_BANK[p.kind] ?? [];
    const items = pickBankItems(list, p.questionCounts.length, p.difficulty, p.avoidBankIds, rand);
    const perQ: Partial<Record<TaskKind, number>> = {
      CHOOSE_RESPONSE: 20,
      CONVERSATION: 30,
      ANNOUNCEMENT: 30,
      ACADEMIC_TALK: 40,
    };
    return items.map((item, i) => ({
      kind: STIMULUS_KIND[p.kind],
      title: item.title,
      topic: item.topic,
      body: item.body,
      meta: item.meta,
      bankId: item.id,
      questions: pickQuestionSubset(item.questions, p.questionCounts[i], rand).map((q) =>
        toGeneratedQuestion(q, p.kind, perQ[p.kind]),
      ),
    }));
  }

  private completeWords(p: GenerateTaskParams, rand: () => number): GeneratedStimulus[] {
    const avoid = new Set(p.avoidBankIds);
    const order = shuffle(CTEST_PARAGRAPHS, rand).sort(
      (a, b) => Number(avoid.has(a.id)) - Number(avoid.has(b.id)),
    );
    const want = p.questionCounts[0] ?? 10;
    for (const para of order) {
      const ct = buildCTest(para.text, want);
      if (ct.items.length === want) {
        return [
          {
            kind: 'complete_words',
            title: 'Complete the Words',
            topic: para.topic,
            body: ct.text,
            bankId: para.id,
            questions: ct.items.map((it) => ({
              type: 'READING_COMPLETE_WORDS' as const,
              prompt: `Blank ${it.n}`,
              correctAnswer: it.answer,
              explanation: `The complete word is “${it.full}”. Context and the given letters ("${it.prefix}…") point to it.`,
              skillTag: 'complete-words',
              points: 1,
              meta: { n: it.n, prefix: it.prefix, length: it.answer.length },
            })),
          },
        ];
      }
    }
    throw new Error('No bank paragraph yields enough blanks');
  }

  private buildSentence(p: GenerateTaskParams, rand: () => number): GeneratedStimulus[] {
    const n = p.questionCounts[0] ?? 10;
    const set = generateBuildSentenceSet(n, rand, p.avoidTexts ?? []);
    return [
      {
        kind: 'build_sentence',
        title: 'Build a Sentence',
        topic: 'grammar',
        body: '',
        questions: set.map((q) => ({
          type: 'WRITING_BUILD_SENTENCE' as const,
          prompt: q.context,
          correctAnswer: q.answer,
          explanation: `Correct sentence: “${q.sentence}”`,
          skillTag: 'build-sentence',
          points: 1,
          meta: { chunks: q.chunks, layout: q.layout, end: q.end },
        })),
      },
    ];
  }

  private writeEmail(p: GenerateTaskParams, rand: () => number): GeneratedStimulus[] {
    const avoid = new Set(p.avoidBankIds);
    const pool = EMAIL_BANK.filter((e) => !avoid.has(e.id));
    const task = shuffle(pool.length ? pool : EMAIL_BANK, rand)[0];
    return [
      {
        kind: 'email_task',
        title: 'Write an Email',
        topic: 'email',
        body: task.scenario,
        bankId: task.id,
        meta: { to: task.to, subject: task.subject, bullets: task.bullets },
        questions: [
          {
            type: 'WRITING_EMAIL',
            prompt: `Write an email to ${task.to}. In your email, do the following.`,
            correctAnswer: '',
            explanation: 'Open-ended: scored with the Write an Email rubric.',
            skillTag: 'write-email',
            points: 0,
          },
        ],
      },
    ];
  }

  private discussion(p: GenerateTaskParams, rand: () => number): GeneratedStimulus[] {
    const avoid = new Set(p.avoidBankIds);
    const pool = DISCUSSION_BANK.filter((d) => !avoid.has(d.id));
    const task = shuffle(pool.length ? pool : DISCUSSION_BANK, rand)[0];
    return [
      {
        kind: 'discussion',
        title: 'Academic Discussion',
        topic: task.field,
        body: task.professor,
        bankId: task.id,
        meta: { field: task.field, professor: task.professor, students: task.students },
        questions: [
          {
            type: 'WRITING_ACADEMIC_DISCUSSION',
            prompt: 'Write a post responding to the professor’s question.',
            correctAnswer: '',
            explanation: 'Open-ended: scored with the Academic Discussion rubric.',
            skillTag: 'academic-discussion',
            points: 0,
          },
        ],
      },
    ];
  }

  private listenRepeat(p: GenerateTaskParams, rand: () => number): GeneratedStimulus[] {
    const avoid = new Set(p.avoidBankIds);
    const pool = REPEAT_BANK.filter((r) => !avoid.has(r.id));
    const set = shuffle(pool.length ? pool : REPEAT_BANK, rand)[0];
    return [
      {
        kind: 'listen_repeat',
        title: 'Listen and Repeat',
        topic: set.topic,
        body: set.context,
        bankId: set.id,
        meta: { context: set.context },
        questions: set.sentences.slice(0, p.questionCounts[0] ?? 7).map((s, i) => ({
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

  private interview(p: GenerateTaskParams, rand: () => number): GeneratedStimulus[] {
    const avoid = new Set(p.avoidBankIds);
    const pool = INTERVIEW_BANK.filter((r) => !avoid.has(r.id));
    const set = shuffle(pool.length ? pool : INTERVIEW_BANK, rand)[0];
    return [
      {
        kind: 'interview',
        title: 'Take an Interview',
        topic: set.theme,
        body: set.context,
        bankId: set.id,
        meta: { context: set.context },
        questions: set.questions.slice(0, p.questionCounts[0] ?? 4).map((q, i) => ({
          type: 'SPEAKING_INTERVIEW' as const,
          prompt: q,
          correctAnswer: '',
          explanation: 'Open-ended: scored with the Interview rubric.',
          skillTag: 'interview',
          points: 0,
          timeLimitSec: 45,
          meta: { audioText: q, index: i + 1 },
        })),
      },
    ];
  }
}
