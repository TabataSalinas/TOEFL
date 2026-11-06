import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Section } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';
import { StartAttemptDto, SubmitAnswersDto } from './dto/attempt.dto';

/**
 * Exam-mode orchestration. Enforces the rules that make practice realistic:
 *  - Questions are served WITHOUT correct answers or explanations.
 *  - Each section has a hard deadline; late submissions are rejected/expired.
 *  - Sections start and finish explicitly; the timer is server-authoritative.
 *  - Correct answers are only revealed after the section/exam is completed.
 */
@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
  ) {}

  async start(userId: string, dto: StartAttemptDto) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: dto.examId },
      include: { sections: { orderBy: { order: 'asc' } } },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const attempt = await this.prisma.examAttempt.create({
      data: {
        userId,
        examId: exam.id,
        kind: exam.kind,
        sectionAttempts: {
          create: exam.sections.map((s) => ({
            section: s.section,
            status: 'NOT_STARTED',
          })),
        },
      },
      include: { sectionAttempts: true },
    });
    return this.getAttemptState(userId, attempt.id);
  }

  /** Returns attempt state with per-section status and remaining time. */
  async getAttemptState(userId: string, attemptId: string) {
    const attempt = await this.loadAttempt(userId, attemptId);
    const now = Date.now();
    return {
      id: attempt.id,
      examId: attempt.examId,
      kind: attempt.kind,
      status: attempt.status,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      sections: attempt.sectionAttempts
        .map((sa) => {
          const remaining = sa.deadlineAt
            ? Math.max(0, Math.floor((sa.deadlineAt.getTime() - now) / 1000))
            : null;
          return {
            sectionAttemptId: sa.id,
            section: sa.section,
            status: sa.status,
            startedAt: sa.startedAt,
            deadlineAt: sa.deadlineAt,
            remainingSec: remaining,
            timeSpentSec: sa.timeSpentSec,
          };
        })
        .sort((a, b) => this.sectionOrder(a.section) - this.sectionOrder(b.section)),
    };
  }

  /** Begin a section: starts its server-side timer and serves questions (no answers). */
  async startSection(userId: string, attemptId: string, section: Section) {
    const attempt = await this.loadAttempt(userId, attemptId);
    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Attempt is not in progress');
    }
    const sa = attempt.sectionAttempts.find((s) => s.section === section);
    if (!sa) throw new NotFoundException('Section not part of this attempt');
    if (sa.status === 'COMPLETED' || sa.status === 'EXPIRED') {
      throw new BadRequestException(`Section already ${sa.status.toLowerCase()}`);
    }

    const examSection = await this.prisma.examSection.findFirst({
      where: { examId: attempt.examId, section },
    });
    if (!examSection) throw new NotFoundException('Exam section missing');

    let updated = sa;
    if (sa.status === 'NOT_STARTED') {
      const startedAt = new Date();
      const deadlineAt = new Date(
        startedAt.getTime() + examSection.timeLimitSec * 1000,
      );
      updated = await this.prisma.sectionAttempt.update({
        where: { id: sa.id },
        data: { status: 'IN_PROGRESS', startedAt, deadlineAt },
      });
    }

    const questions = await this.serveQuestions(examSection.id);
    return {
      sectionAttemptId: updated.id,
      section,
      instructions: examSection.instructions,
      timeLimitSec: examSection.timeLimitSec,
      startedAt: updated.startedAt,
      deadlineAt: updated.deadlineAt,
      ...questions,
    };
  }

  /** Serve passages + questions with correct answers/explanations stripped. */
  private async serveQuestions(examSectionId: string) {
    const passages = await this.prisma.passage.findMany({
      where: { examSectionId },
      orderBy: { order: 'asc' },
    });
    const questions = await this.prisma.question.findMany({
      where: { examSectionId },
      orderBy: { order: 'asc' },
    });

    return {
      passages: passages.map((p) => ({
        id: p.id,
        order: p.order,
        title: p.title,
        body: p.body,
        audioUrl: p.audioUrl,
        topic: p.topic,
      })),
      questions: questions.map((q) => ({
        id: q.id,
        passageId: q.passageId,
        order: q.order,
        type: q.type,
        section: q.section,
        prompt: q.prompt,
        options: q.options, // options are fine; answer is NOT included
        points: q.points,
      })),
    };
  }

  /** Save answers during the exam (idempotent upsert). Rejects after deadline. */
  async submitAnswers(
    userId: string,
    attemptId: string,
    section: Section,
    dto: SubmitAnswersDto,
  ) {
    const attempt = await this.loadAttempt(userId, attemptId);
    const sa = attempt.sectionAttempts.find((s) => s.section === section);
    if (!sa) throw new NotFoundException('Section not part of this attempt');
    if (sa.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Section is not accepting answers');
    }
    if (sa.deadlineAt && sa.deadlineAt.getTime() < Date.now()) {
      await this.expireSection(sa.id);
      throw new ForbiddenException('Section time has expired');
    }

    for (const a of dto.answers) {
      await this.prisma.answer.upsert({
        where: {
          sectionAttemptId_questionId: {
            sectionAttemptId: sa.id,
            questionId: a.questionId,
          },
        },
        create: {
          sectionAttemptId: sa.id,
          questionId: a.questionId,
          response: (a.response ?? null) as unknown as Prisma.InputJsonValue,
          timeSpentSec: a.timeSpentSec ?? 0,
        },
        update: {
          response: (a.response ?? null) as unknown as Prisma.InputJsonValue,
          timeSpentSec: a.timeSpentSec ?? 0,
        },
      });
    }
    return { saved: dto.answers.length };
  }

  /** Finish a section: grade objective answers; mark complete. */
  async finishSection(userId: string, attemptId: string, section: Section) {
    const attempt = await this.loadAttempt(userId, attemptId);
    const sa = attempt.sectionAttempts.find((s) => s.section === section);
    if (!sa) throw new NotFoundException('Section not part of this attempt');
    if (sa.status === 'COMPLETED') {
      return { status: 'COMPLETED', message: 'Section already completed' };
    }

    const timeSpent = sa.startedAt
      ? Math.floor((Date.now() - sa.startedAt.getTime()) / 1000)
      : 0;

    await this.prisma.sectionAttempt.update({
      where: { id: sa.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        timeSpentSec: Math.min(
          timeSpent,
          sa.deadlineAt && sa.startedAt
            ? Math.floor((sa.deadlineAt.getTime() - sa.startedAt.getTime()) / 1000)
            : timeSpent,
        ),
      },
    });

    // Grade objective sections now; productive sections graded in later phases.
    if (section === 'READING' || section === 'LISTENING') {
      await this.scoring.gradeObjectiveSection(sa.id);
    }

    await this.recordStudySession(userId, section, timeSpent);
    await this.maybeCompleteAttempt(attempt.id);

    return this.getAttemptState(userId, attemptId);
  }

  /** If all sections are done, finalize the attempt and build the score report. */
  private async maybeCompleteAttempt(attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { sectionAttempts: true },
    });
    if (!attempt) return;
    const allDone = attempt.sectionAttempts.every(
      (s) => s.status === 'COMPLETED' || s.status === 'EXPIRED',
    );
    if (allDone && attempt.status === 'IN_PROGRESS') {
      await this.prisma.examAttempt.update({
        where: { id: attemptId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await this.scoring.buildScoreReport(attemptId);
    }
  }

  async abandon(userId: string, attemptId: string) {
    await this.loadAttempt(userId, attemptId);
    return this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: { status: 'ABANDONED', completedAt: new Date() },
    });
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

  // ── helpers ─────────────────────────────────────────────────────────
  private async loadAttempt(userId: string, attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { sectionAttempts: true },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId) throw new ForbiddenException('Not your attempt');
    return attempt;
  }

  private async expireSection(sectionAttemptId: string) {
    await this.prisma.sectionAttempt.update({
      where: { id: sectionAttemptId },
      data: { status: 'EXPIRED', completedAt: new Date() },
    });
  }

  private async recordStudySession(
    userId: string,
    section: Section,
    seconds: number,
  ) {
    const minutes = Math.max(1, Math.round(seconds / 60));
    await this.prisma.studySession.create({
      data: { userId, section, minutes, source: 'exam' },
    });
    await this.updateStreak(userId);
  }

  private async updateStreak(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });
    if (!profile) return;
    const today = new Date();
    const todayKey = this.dayKey(today);
    const lastKey = profile.lastStudyDate
      ? this.dayKey(profile.lastStudyDate)
      : null;
    if (lastKey === todayKey) return; // already counted today

    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const continuing = lastKey === this.dayKey(yesterday);
    const current = continuing ? profile.currentStreakDays + 1 : 1;
    await this.prisma.userProfile.update({
      where: { userId },
      data: {
        currentStreakDays: current,
        longestStreakDays: Math.max(current, profile.longestStreakDays),
        lastStudyDate: today,
      },
    });
  }

  private dayKey(d: Date): string {
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
  }

  private sectionOrder(section: Section): number {
    return ['READING', 'LISTENING', 'SPEAKING', 'WRITING'].indexOf(section);
  }
}
