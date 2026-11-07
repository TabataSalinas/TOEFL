import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Section } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Post-exam reporting. Only exposes correct answers and explanations for
 * COMPLETED attempts — never during an in-progress exam.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Full detailed report for a completed attempt. */
  async getAttemptReport(userId: string, attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: true,
        scoreReport: { include: { sectionScores: true } },
        sectionAttempts: {
          include: {
            answers: { include: { question: { include: { passage: true } } } },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId) throw new ForbiddenException('Not your attempt');

    const sections = attempt.sectionAttempts.map((sa) => {
      const score = attempt.scoreReport?.sectionScores.find(
        (s) => s.sectionAttemptId === sa.id,
      );
      const items = sa.answers.map((a) => ({
        questionId: a.questionId,
        prompt: a.question.prompt,
        type: a.question.type,
        skillTag: a.question.skillTag,
        yourAnswer: a.response,
        correctAnswer: a.question.correctAnswer, // revealed post-exam
        isCorrect: a.isCorrect,
        explanation: a.question.explanation,
        timeSpentSec: a.timeSpentSec,
        passageTitle: a.question.passage?.title ?? null,
      }));
      const answered = items.length;
      const correct = items.filter((i) => i.isCorrect).length;
      const avgTime =
        answered > 0
          ? Math.round(items.reduce((s, i) => s + i.timeSpentSec, 0) / answered)
          : 0;

      return {
        section: sa.section,
        status: sa.status,
        timeSpentSec: sa.timeSpentSec,
        scaledScore: score?.scaledScore ?? null,
        band: score?.band ?? null,
        confidence: score?.confidence ?? null,
        rawCorrect: score?.rawCorrect ?? correct,
        rawTotal: score?.rawTotal ?? answered,
        skillBreakdown: score?.skillBreakdown ?? null,
        avgTimePerQuestionSec: avgTime,
        hardestSkills: this.hardestSkills(score?.skillBreakdown),
        items,
      };
    });

    return {
      attemptId: attempt.id,
      examTitle: attempt.exam.title,
      kind: attempt.kind,
      status: attempt.status,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      scoreReport: attempt.scoreReport
        ? {
            totalScore: attempt.scoreReport.totalScore,
            totalBand: attempt.scoreReport.totalBand,
            confidence: attempt.scoreReport.confidence,
            methodology: attempt.scoreReport.methodology,
          }
        : null,
      sections,
    };
  }

  /** Score evolution across attempts for charts. */
  async getProgress(userId: string) {
    const attempts = await this.prisma.examAttempt.findMany({
      where: { userId, status: 'COMPLETED' },
      orderBy: { completedAt: 'asc' },
      include: {
        exam: { select: { title: true, kind: true } },
        scoreReport: { include: { sectionScores: true } },
      },
    });

    const timeline = attempts
      .filter((a) => a.scoreReport)
      .map((a) => ({
        attemptId: a.id,
        date: a.completedAt,
        title: a.exam.title,
        kind: a.kind,
        total: a.scoreReport!.totalScore,
        band: a.scoreReport!.totalBand,
        confidence: a.scoreReport!.confidence,
        sections: Object.fromEntries(
          a.scoreReport!.sectionScores.map((s) => [s.section, s.scaledScore]),
        ),
      }));

    return {
      attempts: timeline.length,
      timeline,
      best: timeline.reduce(
        (max, t) => (t.total > max ? t.total : max),
        0,
      ),
      latest: timeline.at(-1)?.total ?? null,
      trend: this.trend(timeline.map((t) => t.total)),
    };
  }

  /** Accuracy aggregated by question type/skill across all attempts. */
  async getSkillAccuracy(userId: string) {
    const answers = await this.prisma.answer.findMany({
      where: {
        sectionAttempt: { examAttempt: { userId, status: 'COMPLETED' } },
        isCorrect: { not: null },
      },
      include: { question: { select: { skillTag: true, section: true, type: true } } },
    });

    const map = new Map<
      string,
      { section: Section; correct: number; total: number }
    >();
    for (const a of answers) {
      const key = a.question.skillTag ?? 'general';
      const entry = map.get(key) ?? {
        section: a.question.section,
        correct: 0,
        total: 0,
      };
      entry.total += 1;
      if (a.isCorrect) entry.correct += 1;
      map.set(key, entry);
    }

    return [...map.entries()]
      .map(([skillTag, v]) => ({
        skillTag,
        section: v.section,
        correct: v.correct,
        total: v.total,
        accuracy: v.total ? Math.round((v.correct / v.total) * 100) / 100 : 0,
      }))
      .sort((a, b) => a.accuracy - b.accuracy);
  }

  // ── helpers ───────────────────────────────────────────────────────────
  private hardestSkills(breakdown: unknown): string[] {
    if (!breakdown || typeof breakdown !== 'object') return [];
    const entries = Object.entries(
      breakdown as Record<string, { accuracy: number }>,
    );
    return entries
      .filter(([, v]) => v.accuracy < 0.6)
      .sort((a, b) => a[1].accuracy - b[1].accuracy)
      .map(([k]) => k)
      .slice(0, 3);
  }

  private trend(values: number[]): 'improving' | 'declining' | 'stable' | 'n/a' {
    if (values.length < 2) return 'n/a';
    const first = values[0];
    const last = values.at(-1)!;
    if (last - first >= 3) return 'improving';
    if (first - last >= 3) return 'declining';
    return 'stable';
  }
}
