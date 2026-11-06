import { Injectable } from '@nestjs/common';
import { Prisma, Section } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ReportsService } from '../reports/reports.service';

interface SkillAccuracy {
  skillTag: string;
  section: Section;
  accuracy: number;
  total: number;
}

/**
 * Personal TOEFL coach. Analyzes the user's historical performance to build a
 * weakness profile, a natural-language coaching summary, and a prioritized,
 * adaptive study plan with estimated point gains and time-to-target.
 */
@Injectable()
export class TutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly reports: ReportsService,
  ) {}

  async analyze(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });
    const target = profile?.targetTotalScore ?? 100;
    const skills = (await this.reports.getSkillAccuracy(userId)) as SkillAccuracy[];
    const progress = await this.reports.getProgress(userId);
    const estimatedTotal = progress.latest ?? 0;

    const weakest = skills.filter((s) => s.total >= 2).slice(0, 5);
    const strongest = [...skills]
      .filter((s) => s.total >= 2)
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 3);

    const summary = await this.ai.generateCoachSummary({
      targetScore: target,
      estimatedTotal,
      weakestSkills: weakest.map((w) => ({
        skillTag: w.skillTag,
        accuracy: w.accuracy,
        section: w.section,
      })),
      strongestSkills: strongest.map((s) => ({
        skillTag: s.skillTag,
        accuracy: s.accuracy,
        section: s.section,
      })),
    });

    const gap = Math.max(0, target - estimatedTotal);
    return {
      estimatedTotal,
      targetScore: target,
      gap,
      summary,
      weakestSkills: weakest,
      strongestSkills: strongest,
      estimatedWeeksToTarget: this.weeksToTarget(
        gap,
        profile?.preferredStudyMinutesPerDay ?? 45,
      ),
    };
  }

  /** Generate (or regenerate) an adaptive study plan from the weakness profile. */
  async generatePlan(userId: string) {
    const analysis = await this.analyze(userId);

    // Deactivate previous plans.
    await this.prisma.studyPlan.updateMany({
      where: { userId, active: true },
      data: { active: false },
    });

    const items = this.buildPlanItems(analysis.weakestSkills, analysis.gap);

    const plan = await this.prisma.studyPlan.create({
      data: {
        userId,
        title: `Study plan — target ${analysis.targetScore}/120`,
        summary: analysis.summary,
        targetScore: analysis.targetScore,
        active: true,
        items: {
          create: items.map((it, i) => ({
            order: i,
            section: it.section,
            skillTag: it.skillTag,
            title: it.title,
            description: it.description,
            estMinutes: it.estMinutes,
            estPointsGain: it.estPointsGain as unknown as Prisma.Decimal | number,
          })),
        },
      },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    return plan;
  }

  async getActivePlan(userId: string) {
    return this.prisma.studyPlan.findFirst({
      where: { userId, active: true },
      include: { items: { orderBy: { order: 'asc' } } },
    });
  }

  async updatePlanItemStatus(
    userId: string,
    itemId: string,
    status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED',
  ) {
    const item = await this.prisma.studyPlanItem.findUnique({
      where: { id: itemId },
      include: { studyPlan: true },
    });
    if (!item || item.studyPlan.userId !== userId) {
      throw new Error('Plan item not found');
    }
    return this.prisma.studyPlanItem.update({
      where: { id: itemId },
      data: { status },
    });
  }

  // ── helpers ───────────────────────────────────────────────────────────
  private buildPlanItems(weakest: SkillAccuracy[], gap: number) {
    // Distribute the point gap across the weakest skills, weighted by how weak.
    const totalWeakness = weakest.reduce((s, w) => s + (1 - w.accuracy), 0) || 1;
    return weakest.map((w) => {
      const share = (1 - w.accuracy) / totalWeakness;
      const estPointsGain = Math.round(gap * share * 10) / 10;
      return {
        section: w.section,
        skillTag: w.skillTag,
        title: `Improve ${this.humanize(w.skillTag)} in ${w.section.toLowerCase()}`,
        description: `Current accuracy is ${Math.round(
          w.accuracy * 100,
        )}%. Do focused drills on ${this.humanize(
          w.skillTag,
        )} questions, review every explanation, and re-attempt similar items until you reach 80%+.`,
        estMinutes: 30 + Math.round((1 - w.accuracy) * 30),
        estPointsGain,
      };
    });
  }

  private weeksToTarget(gap: number, minutesPerDay: number): number {
    if (gap <= 0) return 0;
    // Heuristic: ~1 point per ~2.5 study hours of focused practice.
    const hoursNeeded = gap * 2.5;
    const hoursPerWeek = (minutesPerDay * 7) / 60;
    return Math.ceil(hoursNeeded / Math.max(1, hoursPerWeek));
  }

  private humanize(tag: string): string {
    return tag.replace(/-/g, ' ');
  }
}
