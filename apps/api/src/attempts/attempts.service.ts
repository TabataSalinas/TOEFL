import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SectionAttempt } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';
import { ExamBuilderService } from '../exams/exam-builder.service';
import { WritingService } from '../writing/writing.service';
import { SpeakingService } from '../speaking/speaking.service';
import { MediaService } from '../media/media.service';
import { TutorService } from '../tutor/tutor.service';
import {
  FULL_EXAM_SECTION_ORDER,
  SectionName,
  Variant,
  moduleCount,
  routeModule2,
} from '../common/toefl.constants';
import { StartAttemptDto, SubmitAnswersDto } from './dto/attempt.dto';
import { buildSteps, serveQuestion, servePassage } from './serve';

const GRACE_MS = 5_000;
const CLOSED = ['COMPLETED', 'EXPIRED'];
const json = (v: unknown) => v as unknown as Prisma.InputJsonValue;

/**
 * Exam-mode orchestration. Rules that make practice realistic:
 *  - Questions are served WITHOUT answers/explanations; listening text is not shown.
 *  - Every module has a server-side deadline; late saves are rejected and overdue
 *    modules are closed automatically (even if the browser is gone).
 *  - Full exams follow the real order (Reading → Listening → Writing → Speaking).
 *  - Reading/Listening are adaptive: module 2 difficulty depends on module 1 accuracy.
 *  - Answers can be locked (Listening: no going back), and cannot change once locked.
 */
@Injectable()
export class AttemptsService {
  private readonly logger = new Logger(AttemptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
    private readonly builder: ExamBuilderService,
    private readonly writing: WritingService,
    private readonly speaking: SpeakingService,
    private readonly media: MediaService,
    private readonly tutor: TutorService,
  ) {}

  // ───────────────────────────── Lifecycle ─────────────────────────────

  async start(userId: string, dto: StartAttemptDto) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: dto.examId },
      include: { sections: { where: { module: 1 }, orderBy: { order: 'asc' } } },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    const attempt = await this.prisma.examAttempt.create({
      data: {
        userId,
        examId: exam.id,
        kind: exam.kind,
        sectionAttempts: {
          create: exam.sections.map((s) => ({ section: s.section, examSectionId: s.id, module: 1, status: 'NOT_STARTED' as const })),
        },
      },
    });
    return this.getAttemptState(userId, attempt.id);
  }

  async getAttemptState(userId: string, attemptId: string) {
    await this.loadAttempt(userId, attemptId);
    await this.expireOverdue(attemptId);
    const attempt = await this.loadAttempt(userId, attemptId);
    const now = Date.now();
    const bySection = new Map<string, SectionAttempt[]>();
    for (const sa of attempt.sectionAttempts) bySection.set(sa.section, [...(bySection.get(sa.section) ?? []), sa]);

    const sections = [...bySection.entries()]
      .map(([section, mods]) => {
        mods.sort((a, b) => a.module - b.module);
        const current = mods.find((m) => m.status === 'IN_PROGRESS') ?? mods.find((m) => m.status === 'NOT_STARTED') ?? mods[mods.length - 1];
        const allClosed = mods.every((m) => CLOSED.includes(m.status));
        const status = allClosed ? mods[mods.length - 1].status : mods.some((m) => m.status !== 'NOT_STARTED') ? 'IN_PROGRESS' : 'NOT_STARTED';
        return {
          sectionAttemptId: current.id,
          section,
          status,
          module: current.module,
          moduleCount: moduleCount(section as SectionName),
          startedAt: current.startedAt,
          deadlineAt: current.deadlineAt,
          remainingSec: current.deadlineAt && current.status === 'IN_PROGRESS' ? Math.max(0, Math.floor((current.deadlineAt.getTime() - now) / 1000)) : null,
          timeSpentSec: mods.reduce((a, m) => a + m.timeSpentSec, 0),
        };
      })
      .sort((a, b) => FULL_EXAM_SECTION_ORDER.indexOf(a.section as SectionName) - FULL_EXAM_SECTION_ORDER.indexOf(b.section as SectionName));

    return {
      id: attempt.id,
      examId: attempt.examId,
      kind: attempt.kind,
      status: attempt.status,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      sections,
    };
  }

  /** Begin (or resume) the current module of a section and serve its content. */
  async startSection(userId: string, attemptId: string, section: SectionName) {
    await this.expireOverdue(attemptId);
    const attempt = await this.loadAttempt(userId, attemptId);
    if (attempt.status !== 'IN_PROGRESS') throw new BadRequestException('Attempt is not in progress');

    const mods = attempt.sectionAttempts.filter((s) => s.section === section).sort((a, b) => a.module - b.module);
    if (mods.length === 0) throw new NotFoundException('Section not part of this attempt');
    const sa = mods.find((m) => m.status === 'IN_PROGRESS') ?? mods.find((m) => m.status === 'NOT_STARTED');
    if (!sa || !sa.examSectionId) throw new BadRequestException('Section already completed');

    // Real order for full exams.
    if (attempt.kind === 'FULL') {
      const idx = FULL_EXAM_SECTION_ORDER.indexOf(section);
      for (const prev of FULL_EXAM_SECTION_ORDER.slice(0, idx)) {
        const prevMods = attempt.sectionAttempts.filter((s) => s.section === prev);
        if (prevMods.length === 0 || !prevMods.every((m) => CLOSED.includes(m.status))) {
          throw new BadRequestException(`Finish the ${prev.toLowerCase()} section first (sections follow the official order).`);
        }
      }
    }

    const examSection = await this.prisma.examSection.findUnique({ where: { id: sa.examSectionId } });
    if (!examSection) throw new NotFoundException('Exam section missing');

    let current = sa;
    if (sa.status === 'NOT_STARTED') {
      const startedAt = new Date();
      current = await this.prisma.sectionAttempt.update({
        where: { id: sa.id },
        data: { status: 'IN_PROGRESS', startedAt, deadlineAt: new Date(startedAt.getTime() + examSection.timeLimitSec * 1000) },
      });
    }

    const [passages, questions] = await Promise.all([
      this.prisma.passage.findMany({ where: { examSectionId: examSection.id }, orderBy: { order: 'asc' } }),
      this.prisma.question.findMany({ where: { examSectionId: examSection.id }, orderBy: { order: 'asc' } }),
    ]);

    // Server-side audio (cached TTS) when configured; failures fall back to the browser.
    try {
      if (section === 'LISTENING') await this.media.ensurePassageAudio(passages.map((p) => p.id));
      if (section === 'SPEAKING') {
        await this.media.ensureQuestionAudio(questions.filter((q) => q.type === 'SPEAKING_LISTEN_REPEAT').map((q) => q.id), 'Trainer');
        await this.media.ensureQuestionAudio(questions.filter((q) => q.type === 'SPEAKING_INTERVIEW').map((q) => q.id), 'Interviewer');
      }
    } catch (err) {
      this.logger.warn(`Audio preparation failed: ${(err as Error).message}`);
    }
    const [freshPassages, freshQuestions] =
      section === 'LISTENING' || section === 'SPEAKING'
        ? await Promise.all([
            this.prisma.passage.findMany({ where: { examSectionId: examSection.id }, orderBy: { order: 'asc' } }),
            this.prisma.question.findMany({ where: { examSectionId: examSection.id }, orderBy: { order: 'asc' } }),
          ])
        : [passages, questions];

    const saved = await this.prisma.answer.findMany({ where: { sectionAttemptId: current.id } });

    return {
      sectionAttemptId: current.id,
      section,
      module: current.module,
      moduleCount: moduleCount(section),
      instructions: examSection.instructions,
      timeLimitSec: examSection.timeLimitSec,
      startedAt: current.startedAt,
      deadlineAt: current.deadlineAt,
      steps: buildSteps(freshPassages, freshQuestions),
      passages: freshPassages.map(servePassage),
      questions: freshQuestions.map(serveQuestion),
      // Resume support: previously saved answers (never correctness).
      savedAnswers: saved.map((a) => ({ questionId: a.questionId, response: a.response, locked: a.locked })),
    };
  }

  /** Save answers during a module (idempotent). Rejected after the deadline. */
  async submitAnswers(userId: string, attemptId: string, section: SectionName, dto: SubmitAnswersDto) {
    const attempt = await this.loadAttempt(userId, attemptId);
    const sa = attempt.sectionAttempts.find((s) => s.section === section && s.status === 'IN_PROGRESS');
    if (!sa || !sa.examSectionId) throw new BadRequestException('Section is not accepting answers');
    if (sa.deadlineAt && sa.deadlineAt.getTime() + GRACE_MS < Date.now()) {
      await this.expireOverdue(attemptId);
      throw new ForbiddenException('Section time has expired');
    }

    const valid = new Set((await this.prisma.question.findMany({ where: { examSectionId: sa.examSectionId }, select: { id: true } })).map((q) => q.id));
    const existing = new Map((await this.prisma.answer.findMany({ where: { sectionAttemptId: sa.id } })).map((a) => [a.questionId, a]));

    let saved = 0;
    let ignored = 0;
    for (const a of dto.answers) {
      if (!valid.has(a.questionId)) {
        ignored++;
        continue;
      }
      const prev = existing.get(a.questionId);
      if (prev?.locked) {
        ignored++;
        continue;
      }
      const response = this.cleanResponse(a.response);
      await this.prisma.answer.upsert({
        where: { sectionAttemptId_questionId: { sectionAttemptId: sa.id, questionId: a.questionId } },
        create: {
          sectionAttemptId: sa.id,
          questionId: a.questionId,
          response: response == null ? Prisma.JsonNull : json(response),
          timeSpentSec: a.timeSpentSec ?? 0,
          locked: !!a.lock,
        },
        update: {
          response: response == null ? Prisma.JsonNull : json(response),
          timeSpentSec: a.timeSpentSec ?? prev?.timeSpentSec ?? 0,
          locked: !!a.lock,
        },
      });
      saved++;
    }
    return { saved, ignored };
  }

  private cleanResponse(r: unknown): string | string[] | null {
    if (r == null) return null;
    if (typeof r === 'string') return r.slice(0, 8000);
    if (Array.isArray(r)) return r.slice(0, 30).map((x) => String(x).slice(0, 200));
    return null;
  }

  /** Finish the current module: grade, route the next adaptive module, or close the section. */
  async finishSection(userId: string, attemptId: string, section: SectionName) {
    const attempt = await this.loadAttempt(userId, attemptId);
    const sa = attempt.sectionAttempts.find((s) => s.section === section && s.status === 'IN_PROGRESS');
    if (!sa) {
      const done = attempt.sectionAttempts.filter((s) => s.section === section).every((s) => CLOSED.includes(s.status));
      if (done) return { ...(await this.getAttemptState(userId, attemptId)), nextModule: null };
      throw new BadRequestException('This section has not been started');
    }
    const { nextModule } = await this.closeModule(attempt.id, sa, 'COMPLETED');
    return { ...(await this.getAttemptState(userId, attemptId)), nextModule: nextModule ?? null };
  }

  async abandon(userId: string, attemptId: string) {
    await this.loadAttempt(userId, attemptId);
    return this.prisma.examAttempt.update({ where: { id: attemptId }, data: { status: 'ABANDONED', completedAt: new Date() } });
  }

  async listAttempts(userId: string) {
    return this.prisma.examAttempt.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      include: {
        exam: { select: { title: true, kind: true, section: true } },
        scoreReport: { select: { totalScore: true, totalBand: true } },
      },
    });
  }

  // ───────────────────────────── Internals ─────────────────────────────

  /** Close modules whose deadline has passed (server-authoritative timers). */
  private async expireOverdue(attemptId: string): Promise<void> {
    const overdue = await this.prisma.sectionAttempt.findMany({
      where: { examAttemptId: attemptId, status: 'IN_PROGRESS', deadlineAt: { lt: new Date(Date.now() - GRACE_MS) } },
    });
    for (const sa of overdue) {
      try {
        await this.closeModule(attemptId, sa, 'EXPIRED');
      } catch (err) {
        this.logger.error(`Failed to expire module ${sa.id}: ${(err as Error).message}`);
      }
    }
  }

  private async closeModule(attemptId: string, sa: SectionAttempt, status: 'COMPLETED' | 'EXPIRED'): Promise<{ nextModule?: number }> {
    const examSection = sa.examSectionId ? await this.prisma.examSection.findUnique({ where: { id: sa.examSectionId } }) : null;
    const limit = examSection?.timeLimitSec ?? 0;
    const now = new Date();
    const spent = sa.startedAt ? Math.min(Math.floor((now.getTime() - sa.startedAt.getTime()) / 1000), limit || Number.MAX_SAFE_INTEGER) : 0;

    // Atomic flip: only one caller wins, so grading happens exactly once.
    const flipped = await this.prisma.sectionAttempt.updateMany({
      where: { id: sa.id, status: 'IN_PROGRESS' },
      data: { status, completedAt: now, timeSpentSec: spent },
    });
    if (flipped.count === 0) return {};

    const section = sa.section as SectionName;
    let nextModule: number | undefined;
    try {
      if (section === 'READING' || section === 'LISTENING') {
        const grade = await this.scoring.gradeModule(sa.id);
        if (sa.module < moduleCount(section)) {
          const variant = routeModule2(grade.accuracy);
          await this.createNextModule(attemptId, sa, variant);
          nextModule = sa.module + 1;
        }
      } else if (section === 'WRITING') {
        await this.writing.finalizeSection(sa.id);
      } else {
        await this.speaking.finalizeSection(sa.id);
      }
    } catch (err) {
      this.logger.error(`Finalizing ${section} module ${sa.module} failed: ${(err as Error).message}`);
    }

    const attempt = await this.prisma.examAttempt.findUnique({ where: { id: attemptId } });
    if (attempt) await this.recordStudySession(attempt.userId, section, spent);
    await this.maybeCompleteAttempt(attemptId);
    return { nextModule };
  }

  private async createNextModule(attemptId: string, sa: SectionAttempt, variant: Variant): Promise<void> {
    const attempt = await this.prisma.examAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) return;
    const section = sa.section as SectionName;
    const nextNo = sa.module + 1;
    const first = sa.examSectionId ? await this.prisma.examSection.findUnique({ where: { id: sa.examSectionId } }) : null;

    // Reuse an existing module for the same path (same exam retaken → same content).
    const existing = await this.prisma.examSection.findFirst({ where: { examId: attempt.examId, section, module: nextNo, variant } });
    let nextId = existing?.id;
    if (!nextId) {
      nextId = await this.builder.buildModule({
        examId: attempt.examId,
        userId: attempt.userId,
        section,
        module: nextNo,
        variant,
        order: first?.order ?? 0,
      });
    }
    await this.prisma.sectionAttempt.create({
      data: { examAttemptId: attemptId, section, examSectionId: nextId, module: nextNo, status: 'NOT_STARTED' },
    });
  }

  private async maybeCompleteAttempt(attemptId: string): Promise<void> {
    const attempt = await this.prisma.examAttempt.findUnique({ where: { id: attemptId }, include: { sectionAttempts: true } });
    if (!attempt || attempt.status !== 'IN_PROGRESS') return;
    if (!attempt.sectionAttempts.every((s) => CLOSED.includes(s.status))) return;
    const done = await this.prisma.examAttempt.updateMany({
      where: { id: attemptId, status: 'IN_PROGRESS' },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    if (done.count > 0) {
      await this.scoring.buildScoreReport(attemptId);
      // The coach refreshes the study plan automatically after every finished attempt.
      try {
        await this.tutor.generatePlan(attempt.userId);
      } catch (err) {
        this.logger.warn(`Study plan refresh failed: ${(err as Error).message}`);
      }
    }
  }

  private async loadAttempt(userId: string, attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({ where: { id: attemptId }, include: { sectionAttempts: true } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId) throw new ForbiddenException('Not your attempt');
    return attempt;
  }

  private async recordStudySession(userId: string, section: SectionName, seconds: number): Promise<void> {
    const minutes = Math.max(1, Math.round(seconds / 60));
    await this.prisma.studySession.create({ data: { userId, section, minutes, source: 'exam' } });
    await this.updateStreak(userId);
  }

  private async updateStreak(userId: string): Promise<void> {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) return;
    const today = new Date();
    const key = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    const lastKey = profile.lastStudyDate ? key(profile.lastStudyDate) : null;
    if (lastKey === key(today)) return;
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const current = lastKey === key(yesterday) ? profile.currentStreakDays + 1 : 1;
    await this.prisma.userProfile.update({
      where: { userId },
      data: { currentStreakDays: current, longestStreakDays: Math.max(current, profile.longestStreakDays), lastStudyDate: today },
    });
  }
}
