import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Section } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { scaledToBand, totalToBand } from '../common/toefl.constants';
import {
  isAnswerCorrect,
  rawToScaled,
  sectionConfidence,
} from './scoring.util';

/**
 * Automatic grading + TOEFL score estimation.
 *
 * Objective sections (Reading/Listening) are graded by comparing the saved
 * response against the stored correct answer. Raw correct counts are mapped to
 * a 0..30 scaled score, then to a 0..120 total and a 1..6 band. A confidence
 * value reflects how much evidence (answered items, sections completed) the
 * estimate is based on.
 */
@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Grade a completed objective section and persist per-answer correctness. */
  async gradeObjectiveSection(sectionAttemptId: string) {
    const sectionAttempt = await this.prisma.sectionAttempt.findUnique({
      where: { id: sectionAttemptId },
      include: { answers: { include: { question: true } } },
    });
    if (!sectionAttempt) return;

    let correct = 0;
    let total = 0;
    const skillStats = new Map<string, { correct: number; total: number }>();

    // Find the exam section for this attempt so we grade every question
    // (unanswered questions count as incorrect).
    const examSection = await this.prisma.examSection.findFirst({
      where: {
        section: sectionAttempt.section,
        exam: {
          attempts: {
            some: { sectionAttempts: { some: { id: sectionAttemptId } } },
          },
        },
      },
      include: { questions: true },
    });
    const sectionQuestions = examSection?.questions ?? [];

    const answerByQuestion = new Map(
      sectionAttempt.answers.map((a) => [a.questionId, a]),
    );

    for (const q of sectionQuestions) {
      if (q.points <= 0) continue; // skip productive tasks
      total += 1;
      const skill = q.skillTag ?? 'general';
      const stat = skillStats.get(skill) ?? { correct: 0, total: 0 };
      stat.total += 1;

      const answer = answerByQuestion.get(q.id);
      const isCorrect = answer
        ? isAnswerCorrect(answer.response, q.correctAnswer)
        : false;

      if (answer) {
        await this.prisma.answer.update({
          where: { id: answer.id },
          data: {
            isCorrect,
            pointsEarned: isCorrect ? q.points : 0,
          },
        });
      }
      if (isCorrect) {
        correct += 1;
        stat.correct += 1;
      }
      skillStats.set(skill, stat);
    }

    const scaled = rawToScaled(correct, total);
    const band = scaledToBand(scaled);
    const confidence = sectionConfidence(total);

    const skillBreakdown = Object.fromEntries(
      [...skillStats.entries()].map(([skill, s]) => [
        skill,
        { correct: s.correct, total: s.total, accuracy: s.total ? s.correct / s.total : 0 },
      ]),
    );

    await this.prisma.sectionScore.upsert({
      where: { sectionAttemptId },
      create: {
        // scoreReportId filled when buildScoreReport runs; temporary placeholder
        scoreReport: {
          connectOrCreate: {
            where: { examAttemptId: sectionAttempt.examAttemptId },
            create: {
              examAttemptId: sectionAttempt.examAttemptId,
              totalScore: 0,
              confidence: 0,
            },
          },
        },
        sectionAttemptId,
        section: sectionAttempt.section,
        rawCorrect: correct,
        rawTotal: total,
        scaledScore: scaled,
        band,
        confidence,
        skillBreakdown: skillBreakdown as unknown as Prisma.InputJsonValue,
      },
      update: {
        rawCorrect: correct,
        rawTotal: total,
        scaledScore: scaled,
        band,
        confidence,
        skillBreakdown: skillBreakdown as unknown as Prisma.InputJsonValue,
      },
    });

    return { correct, total, scaled, band, confidence };
  }

  /** Assemble the overall score report once all sections are complete. */
  async buildScoreReport(examAttemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: examAttemptId },
      include: { sectionAttempts: { include: { sectionScore: true } } },
    });
    if (!attempt) return;

    const report = await this.prisma.scoreReport.upsert({
      where: { examAttemptId },
      create: { examAttemptId, totalScore: 0, confidence: 0 },
      update: {},
    });

    // Collect section scaled scores (0..30). Missing/ungraded -> estimate 0.
    const bySection = new Map<Section, number>();
    const confidences: number[] = [];
    let gradedSections = 0;

    for (const sa of attempt.sectionAttempts) {
      const score = sa.sectionScore;
      if (score) {
        // Link section score to this report.
        await this.prisma.sectionScore.update({
          where: { sectionAttemptId: sa.id },
          data: { scoreReportId: report.id },
        });
        bySection.set(sa.section, score.scaledScore);
        confidences.push(score.confidence);
        if (score.rawTotal > 0) gradedSections += 1;
      }
    }

    // For sections not yet graded (Speaking/Writing in phase 1), estimate using
    // the average of graded sections so the total remains meaningful.
    const gradedValues = [...bySection.values()];
    const avg = gradedValues.length
      ? Math.round(gradedValues.reduce((a, b) => a + b, 0) / gradedValues.length)
      : 0;

    const sections: Section[] = ['READING', 'LISTENING', 'SPEAKING', 'WRITING'];
    const relevantSections =
      attempt.kind === 'FULL'
        ? sections
        : attempt.sectionAttempts.map((s) => s.section);

    let total = 0;
    for (const s of relevantSections) {
      total += bySection.has(s) ? bySection.get(s)! : avg;
    }
    // For single-section attempts, scale the section to a 0..120 projection.
    if (attempt.kind === 'SECTION') {
      total = Math.round((total / 30) * 120);
    }
    total = Math.max(0, Math.min(120, total));

    const confidence = this.totalConfidence(
      gradedSections,
      relevantSections.length,
      attempt.kind === 'FULL',
    );

    const methodology = this.explainMethodology(
      bySection,
      avg,
      total,
      relevantSections,
      attempt.kind,
      confidence,
    );

    await this.prisma.scoreReport.update({
      where: { id: report.id },
      data: {
        totalScore: total,
        totalBand: totalToBand(total),
        confidence,
        methodology,
      },
    });

    return this.getReport(examAttemptId);
  }

  async getReport(examAttemptId: string) {
    return this.prisma.scoreReport.findUnique({
      where: { examAttemptId },
      include: { sectionScores: true },
    });
  }

  // ── scoring math ──────────────────────────────────────────────────────

  private totalConfidence(
    gradedSections: number,
    relevantSections: number,
    isFull: boolean,
  ): number {
    if (relevantSections === 0) return 0;
    const coverage = gradedSections / relevantSections;
    // Full exams with all objective sections graded are most reliable.
    const base = coverage * (isFull ? 0.85 : 0.7);
    return Math.round(Math.max(0.1, Math.min(0.95, base)) * 100) / 100;
  }

  private explainMethodology(
    bySection: Map<Section, number>,
    avg: number,
    total: number,
    sections: Section[],
    kind: string,
    confidence: number,
  ): string {
    const parts: string[] = [];
    parts.push(
      'Each objective section (Reading, Listening) is graded by comparing your answers to the correct keys. Raw accuracy is mapped linearly to a 0–30 scaled score per section.',
    );
    const lines = sections.map((s) => {
      const v = bySection.get(s);
      return v != null
        ? `${s}: ${v}/30 (graded)`
        : `${s}: ~${avg}/30 (estimated from graded sections — automatic scoring for this section arrives in a later phase)`;
    });
    parts.push(`Section scaled scores: ${lines.join('; ')}.`);
    if (kind === 'SECTION') {
      parts.push(
        'Because this was a single-section practice, the total is a projection of that section onto the full 0–120 scale.',
      );
    } else {
      parts.push('The total (0–120) is the sum of the four section scaled scores.');
    }
    parts.push(
      `Estimated total: ${total}/120. Confidence: ${Math.round(confidence * 100)}% — confidence rises as more sections are fully graded and as you answer more items.`,
    );
    return parts.join(' ');
  }
}
