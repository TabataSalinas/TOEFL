import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { SourcesService } from '../sources/sources.service';
import { GenerateTaskParams, GeneratedStimulus, GroundingDoc } from '../ai/ai.types';
import {
  Difficulty,
  SectionName,
  TaskKind,
  TaskSpec,
  Variant,
  getBlueprint,
} from '../common/toefl.constants';
import { mulberry32, randomSeed, sha1, wordCount } from '../content/text-utils';
import { rebalanceAll, validateStimulus } from '../content/quality';
import { sampleAcademicTopic } from '../content/topics';

export interface History {
  topics: string[];
  bankIds: string[];
  texts: string[];
}

const json = (v: unknown) => v as unknown as Prisma.InputJsonValue;

const VARIANT_DIFFICULTY: Record<Variant, Difficulty> = { core: 'standard', easy: 'easy', hard: 'hard' };

/**
 * Builds one module (Reading/Listening module 1 or 2, Writing, Speaking) of an exam:
 * generates every task in parallel, validates quality, balances answer keys,
 * avoids content the learner has recently seen, and persists everything.
 */
@Injectable()
export class ExamBuilderService {
  private readonly logger = new Logger(ExamBuilderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly sources: SourcesService,
  ) {}

  /** Recently seen topics / bank ids / texts for a learner (last ~8 exams). */
  async history(userId: string): Promise<History> {
    const rows = await this.prisma.passage.findMany({
      where: { examSection: { exam: { attempts: { some: { userId } } } } },
      orderBy: { examSection: { exam: { createdAt: 'desc' } } },
      take: 150,
      select: { topic: true, bankId: true, body: true, kind: true },
    });
    return {
      topics: [...new Set(rows.map((r) => r.topic).filter((t): t is string => !!t))],
      bankIds: [...new Set(rows.map((r) => r.bankId).filter((t): t is string => !!t))],
      texts: rows.filter((r) => r.body && r.body.length > 80).map((r) => r.body),
    };
  }

  async buildModule(args: {
    examId: string;
    userId: string;
    section: SectionName;
    module: number;
    variant: Variant;
    order: number;
    history?: History;
  }): Promise<string> {
    const { examId, userId, section, module, variant, order } = args;
    const bp = getBlueprint(section, module);
    const difficulty = VARIANT_DIFFICULTY[variant];
    const history = args.history ?? (await this.history(userId));
    const seed = randomSeed();

    const tasks = await Promise.all(bp.tasks.map((spec, i) => this.generateTask(spec, difficulty, history, seed + i)));

    return this.persist({
      examId,
      section,
      module,
      variant,
      order,
      timeLimitSec: bp.timeLimitSec,
      tasks: bp.tasks.map((spec, i) => ({ spec, stimuli: tasks[i] })),
    });
  }

  private async generateTask(
    spec: TaskSpec,
    difficulty: Difficulty,
    history: History,
    seed: number,
  ): Promise<GeneratedStimulus[]> {
    const rand = mulberry32(seed);
    const params: GenerateTaskParams = {
      kind: spec.kind,
      difficulty,
      questionCounts: spec.questionCounts,
      avoidTopics: history.topics,
      avoidBankIds: history.bankIds,
      avoidTexts: history.texts.slice(0, 40),
      seed,
    };

    // Open-license grounding for academic content (only with an LLM + network).
    if ((spec.kind === 'ACADEMIC_PASSAGE' || spec.kind === 'ACADEMIC_TALK') && this.sources.enabled && this.ai.hasLlm) {
      params.topics = spec.questionCounts.map(() => sampleAcademicTopic(rand, history.topics).topic);
      const docs: GroundingDoc[] = [];
      for (const t of params.topics) docs.push(...(await this.sources.groundingFor(t, 1)));
      if (docs.length) params.grounding = docs;
    }

    let task = await this.ai.generateTask(params);
    // Safety net: if a (non-LLM) task fails validation, retry once with a new seed.
    const bad = this.problems(spec, task.stimuli);
    if (bad.length) {
      this.logger.warn(`${spec.kind} failed validation (${bad.join(' | ')}); regenerating`);
      task = await this.ai.generateTask({ ...params, seed: seed + 7919, grounding: undefined });
    }
    const balanced = rebalanceAll(task.stimuli, rand);
    return balanced.map((s) => ({
      ...s,
      sourceRefs: s.sourceRefs ?? (params.grounding?.length ? params.grounding.map(({ provider, title, url, license }) => ({ provider, title, url, license })) : undefined),
    }));
  }

  private problems(spec: TaskSpec, stimuli: GeneratedStimulus[]): string[] {
    const out: string[] = [];
    stimuli.forEach((s, i) => {
      const expected = spec.questionCounts[i] ?? spec.questionCounts[0];
      const rep = validateStimulus(spec.kind as TaskKind, s, expected);
      if (!rep.ok) out.push(...rep.problems);
    });
    return out;
  }

  private async persist(args: {
    examId: string;
    section: SectionName;
    module: number;
    variant: Variant;
    order: number;
    timeLimitSec: number;
    tasks: Array<{ spec: TaskSpec; stimuli: GeneratedStimulus[] }>;
  }): Promise<string> {
    return this.prisma.$transaction(
      async (tx) => {
        const examSection = await tx.examSection.create({
          data: {
            examId: args.examId,
            section: args.section,
            order: args.order,
            module: args.module,
            variant: args.variant,
            timeLimitSec: args.timeLimitSec,
            instructions: args.tasks.map((t) => `${t.spec.title}: ${t.spec.instructions}`).join('\n'),
          },
        });

        let passageOrder = 0;
        let questionOrder = 0;
        for (const { spec, stimuli } of args.tasks) {
          for (const s of stimuli) {
            const passage = await tx.passage.create({
              data: {
                examSectionId: examSection.id,
                order: passageOrder++,
                title: s.title,
                body: s.body,
                topic: s.topic,
                kind: s.kind,
                bankId: s.bankId ?? null,
                wordCount: wordCount(s.body),
                contentFingerprint: sha1(s.body + s.questions.map((q) => q.prompt).join('|')),
                sourceRefs: s.sourceRefs ? json(s.sourceRefs) : Prisma.JsonNull,
                meta: json({
                  ...(s.meta ?? {}),
                  taskKind: spec.kind,
                  taskTitle: spec.title,
                  taskInstructions: spec.instructions,
                  taskSec: spec.taskSec,
                  perQuestionSec: spec.perQuestionSec,
                }),
              },
            });
            for (const q of s.questions) {
              await tx.question.create({
                data: {
                  examSectionId: examSection.id,
                  passageId: passage.id,
                  order: questionOrder++,
                  type: q.type,
                  section: args.section,
                  prompt: q.prompt,
                  options: q.options ? json(q.options) : Prisma.JsonNull,
                  correctAnswer: json(q.correctAnswer),
                  explanation: q.explanation,
                  skillTag: q.skillTag,
                  points: q.points,
                  taskKind: spec.kind,
                  meta: q.meta ? json(q.meta) : Prisma.JsonNull,
                  timeLimitSec: q.timeLimitSec ?? spec.perQuestionSec ?? null,
                },
              });
            }
          }
        }
        return examSection.id;
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  }
}
