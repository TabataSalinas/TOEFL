import { Injectable } from '@nestjs/common';
import { GoalPeriod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { bandLabel, totalToBand } from '../common/toefl.constants';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string) {
    const [profile, sessions, attempts, goals] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { userId } }),
      this.prisma.studySession.findMany({ where: { userId } }),
      this.prisma.examAttempt.findMany({
        where: { userId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        include: { scoreReport: true, exam: { select: { title: true } } },
      }),
      this.prisma.goal.findMany({ where: { userId } }),
    ]);

    const totalMinutes = sessions.reduce((s, x) => s + x.minutes, 0);
    const latestScore = attempts.find((a) => a.scoreReport)?.scoreReport
      ?.totalScore;
    const target = profile?.targetTotalScore ?? 100;

    const weekGoal = this.currentGoal(goals, 'WEEKLY');
    const monthGoal = this.currentGoal(goals, 'MONTHLY');
    const weekMinutes = this.minutesSince(sessions, this.startOfWeek());
    const monthMinutes = this.minutesSince(sessions, this.startOfMonth());

    const readiness = this.readiness(latestScore ?? null, target);

    return {
      streak: {
        current: profile?.currentStreakDays ?? 0,
        longest: profile?.longestStreakDays ?? 0,
        lastStudyDate: profile?.lastStudyDate ?? null,
      },
      goals: {
        weekly: weekGoal
          ? {
              targetMinutes: weekGoal.targetMinutes,
              completedMinutes: weekMinutes,
              percent: this.pct(weekMinutes, weekGoal.targetMinutes),
            }
          : null,
        monthly: monthGoal
          ? {
              targetMinutes: monthGoal.targetMinutes,
              completedMinutes: monthMinutes,
              percent: this.pct(monthMinutes, monthGoal.targetMinutes),
            }
          : null,
      },
      totals: {
        totalStudyMinutes: totalMinutes,
        totalAttempts: attempts.length,
      },
      score: {
        latest: latestScore ?? null,
        latestBand: latestScore != null ? totalToBand(latestScore) : null,
        target,
        targetBand: totalToBand(target),
        progressToTargetPercent:
          latestScore != null ? this.pct(latestScore, target) : 0,
      },
      readiness,
      recentAttempts: attempts.slice(0, 5).map((a) => ({
        id: a.id,
        title: a.exam.title,
        date: a.completedAt,
        total: a.scoreReport?.totalScore ?? null,
      })),
    };
  }

  private readiness(latest: number | null, target: number) {
    if (latest == null) {
      return { level: 'Not assessed', label: 'Complete a mock to assess readiness', percent: 0 };
    }
    const percent = this.pct(latest, target);
    let level = 'Building foundations';
    if (percent >= 100) level = 'Exam ready';
    else if (percent >= 85) level = 'Nearly ready';
    else if (percent >= 65) level = 'On track';
    return { level, label: `${bandLabel(totalToBand(latest))}`, percent };
  }

  private currentGoal(
    goals: { period: GoalPeriod; periodStart: Date; targetMinutes: number }[],
    period: GoalPeriod,
  ) {
    const start = period === 'WEEKLY' ? this.startOfWeek() : this.startOfMonth();
    return goals.find(
      (g) =>
        g.period === period &&
        g.periodStart.getTime() === start.getTime(),
    );
  }

  private minutesSince(
    sessions: { minutes: number; occurredAt: Date }[],
    since: Date,
  ): number {
    return sessions
      .filter((s) => s.occurredAt.getTime() >= since.getTime())
      .reduce((sum, s) => sum + s.minutes, 0);
  }

  private startOfWeek(): Date {
    const now = new Date();
    const day = now.getUTCDay();
    const diff = (day + 6) % 7;
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff),
    );
  }

  private startOfMonth(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  private pct(value: number, target: number): number {
    if (target <= 0) return 0;
    return Math.min(100, Math.round((value / target) * 100));
  }
}
