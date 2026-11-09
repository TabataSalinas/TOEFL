import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  SectionName,
  combineAdaptive,
  moduleCount,
  scaledToBand,
  totalToBand,
} from '../common/toefl.constants';
import { accumulate, gradeResponse, rawToScaled, sectionConfidence, toBreakdown } from './scoring.util';

export interface ModuleGrade {
  correct: number;
  total: number;
  accuracy: number;
  scaled: number;
  skillBreakdown: Record<string, { correct: number; total: number; accuracy: number }>;
}

export interface SectionSummary {
  scaled: number;
  band: number;
  confidence: number;
  path: 'core' | 'easy' | 'hard' | null;
  modules: Array<{ module: number; variant: string; correct: number; total: number; accuracy: number }>;
  graded: boolean;
}

const json = (v: unknown) => v as unknown as Prisma.InputJsonValue;

/**
 * Automatic grading and score estimation.
 *
 *  - Objective items are graded per module (C-test, Build a Sentence and multiple choice).
 *  - Reading/Listening combine both modules; the module-2 difficulty path (easy/hard)
 *    determines the reachable range (see combineAdaptive).
 *  - Writing/Speaking sections are scored by their evaluators and saved here.
 *  - The total (0–120) is the sum of four 0–30 section scores; the 1–6 band is derived.
 * All mappings are internal approximations for study feedback, not ETS equating.
 */
@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Grade every objective question (points > 0) of a module attempt. */
  async gradeModule(sectionAttemptId: string): Promise<ModuleGrade> {
    const sa = await this.prisma.sectionAttempt.findUnique({
      where: { id: sectionAttemptId },
      include: { answers: true },
    });
    if (!sa || !sa.examSectionId) throw new Error('Section attempt not found');

    const questions = await this.prisma.question.findMany({
      where: { examSectionId: sa.examSectionId, points: { gt: 0 } },
      orderBy: { order: 'asc' },
    });
    const bySkill = new Map<string, { correct: number; total: number }>();
    const byTask = new Map<string, { correct: number; total: number }>();
    const answers = new Map(sa.answers.map((a) => [a.questionId, a]));
    let correct = 0;

    for (const q of questions) {
      const a = answers.get(q.id);
      const ok = a ? gradeResponse(q.type, a.response, q.correctAnswer) : false;
      if (ok) correct++;
      accumulate(bySkill, q.skillTag ?? 'general', ok);
      accumulate(byTask, `task:${q.taskKind ?? q.type}`, ok);
      await this.prisma.answer.upsert({
        where: { sectionAttemptId_questionId: { sectionAttemptId, questionId: q.id } },
        create: {
          sectionAttemptId,
          questionId: q.id,
          response: a?.response == null ? Prisma.JsonNull : json(a.response),
          isCorrect: ok,
          pointsEarned: ok ? q.points : 0,
          locked: true,
        },
        update: { isCorrect: ok, pointsEarned: ok ? q.points : 0, locked: true },
      });
    }

    const total = questions.length;
    const scaled = rawToScaled(correct, total);
    const skillBreakdown = { ...toBreakdown(bySkill), ...toBreakdown(byTask) };
    await this.saveSectionScore(sectionAttemptId, {
      rawCorrect: correct,
      rawTotal: total,
      scaledScore: scaled,
      confidence: sectionConfidence(total),
      skillBreakdown,
    });
    return { correct, total, accuracy: total ? correct / total : 0, scaled, skillBreakdown };
  }

  /** Persist a module/section score (used by Reading/Listening and by the evaluators). */
  async saveSectionScore(
    sectionAttemptId: string,
    data: {
      rawCorrect: number;
      rawTotal: number;
      scaledScore: number;
      confidence: number;
      skillBreakdown: Record<string, unknown>;
    },
  ): Promise<void> {
    const sa = await this.prisma.sectionAttempt.findUnique({ where: { id: sectionAttemptId } });
    if (!sa) throw new Error('Section attempt not found');
    const fields = {
      rawCorrect: data.rawCorrect,
      rawTotal: data.rawTotal,
      scaledScore: data.scaledScore,
      band: scaledToBand(data.scaledScore),
      confidence: data.confidence,
      skillBreakdown: json(data.skillBreakdown),
    };
    await this.prisma.sectionScore.upsert({
      where: { sectionAttemptId },
      create: {
        scoreReport: {
          connectOrCreate: {
            where: { examAttemptId: sa.examAttemptId },
            create: { examAttemptId: sa.examAttemptId, totalScore: 0, confidence: 0 },
          },
        },
        sectionAttempt: { connect: { id: sectionAttemptId } },
        section: sa.section,
        ...fields,
      },
      update: fields,
    });
  }

  /** Assemble the overall report once every section is complete. */
  async buildScoreReport(examAttemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: examAttemptId },
      include: { sectionAttempts: { include: { sectionScore: true } } },
    });
    if (!attempt) return null;

    const report = await this.prisma.scoreReport.upsert({
      where: { examAttemptId },
      create: { examAttemptId, totalScore: 0, confidence: 0 },
      update: {},
    });

    const examSectionIds = attempt.sectionAttempts.map((s) => s.examSectionId).filter((x): x is string => !!x);
    const examSections = await this.prisma.examSection.findMany({ where: { id: { in: examSectionIds } } });
    const variantOf = new Map(examSections.map((e) => [e.id, e.variant]));

    const sections = [...new Set(attempt.sectionAttempts.map((s) => s.section))] as SectionName[];
    const summary: Partial<Record<SectionName, SectionSummary>> = {};

    for (const section of sections) {
      const mods = attempt.sectionAttempts.filter((s) => s.section === section).sort((a, b) => a.module - b.module);
      const modInfo = mods.map((m) => ({
        module: m.module,
        variant: (m.examSectionId && variantOf.get(m.examSectionId)) || 'core',
        correct: m.sectionScore?.rawCorrect ?? 0,
        total: m.sectionScore?.rawTotal ?? 0,
        accuracy: m.sectionScore && m.sectionScore.rawTotal ? m.sectionScore.rawCorrect / m.sectionScore.rawTotal : 0,
        confidence: m.sectionScore?.confidence ?? 0,
        hasScore: !!m.sectionScore,
        scaled: m.sectionScore?.scaledScore ?? 0,
      }));

      let scaled = 0;
      let confidence = 0;
      let path: SectionSummary['path'] = null;
      const graded = modInfo.some((m) => m.hasScore);

      if (section === 'READING' || section === 'LISTENING') {
        const m1 = modInfo.find((m) => m.module === 1);
        const m2 = modInfo.find((m) => m.module === 2);
        if (m1) {
          scaled = combineAdaptive(m1.accuracy, m2 && m2.hasScore ? m2.accuracy : null, m2 ? (m2.variant as 'easy' | 'hard') : null);
          path = m2 ? (m2.variant as 'easy' | 'hard') : 'core';
          const base = [m1, m2].filter((m) => m && m.hasScore).map((m) => m!.confidence);
          const completeness = base.length / moduleCount(section);
          confidence = base.length ? (base.reduce((a, b) => a + b, 0) / base.length) * (0.7 + 0.3 * completeness) : 0;
        }
      } else if (modInfo[0]) {
        scaled = modInfo[0].scaled;
        confidence = modInfo[0].confidence;
      }
      summary[section] = {
        scaled,
        band: scaledToBand(scaled),
        confidence: Math.round(confidence * 100) / 100,
        path,
        modules: modInfo.map(({ module, variant, correct, total, accuracy }) => ({ module, variant, correct, total, accuracy })),
        graded,
      };
    }

    const isFull = attempt.kind === 'FULL';
    const values = Object.values(summary) as SectionSummary[];
    let total: number;
    if (isFull) {
      const gradedVals = values.filter((v) => v.graded).map((v) => v.scaled);
      const avg = gradedVals.length ? gradedVals.reduce((a, b) => a + b, 0) / gradedVals.length : 0;
      total = (['READING', 'LISTENING', 'WRITING', 'SPEAKING'] as SectionName[]).reduce((sum, s) => {
        const v = summary[s];
        return sum + (v && v.graded ? v.scaled : Math.round(avg));
      }, 0);
    } else {
      total = Math.round(((values[0]?.scaled ?? 0) / 30) * 120);
    }
    total = Math.max(0, Math.min(120, total));

    const coverage = isFull ? values.filter((v) => v.graded).length / 4 : 1;
    const meanConf = values.length ? values.reduce((a, v) => a + v.confidence, 0) / values.length : 0;
    const confidence = Math.round(Math.max(0.05, Math.min(0.95, meanConf * coverage * (isFull ? 1 : 0.75))) * 100) / 100;
    const methodology = this.explain(summary, total, isFull, confidence);

    await this.prisma.scoreReport.update({
      where: { id: report.id },
      data: {
        totalScore: total,
        totalBand: totalToBand(total),
        confidence,
        methodology,
        sectionSummary: json(summary),
      },
    });
    return this.getReport(examAttemptId);
  }

  async getReport(examAttemptId: string) {
    return this.prisma.scoreReport.findUnique({ where: { examAttemptId }, include: { sectionScores: true } });
  }

  explain(summary: Partial<Record<SectionName, SectionSummary>>, total: number, isFull: boolean, confidence: number): string {
    const lines: string[] = [];
    for (const [section, s] of Object.entries(summary) as Array<[SectionName, SectionSummary]>) {
      if (section === 'READING' || section === 'LISTENING') {
        const m = s.modules.map((x) => `module ${x.module}${x.module === 2 ? ` (${x.variant})` : ''}: ${x.correct}/${x.total}`).join(', ');
        lines.push(`${section}: ${s.scaled}/30 — ${m}. Module 2 counts 60% and the ${s.path} path ${s.path === 'hard' ? 'allows scores up to 30' : 'caps the score at 24'}.`);
      } else if (section === 'WRITING') {
        lines.push(`WRITING: ${s.scaled}/30 — Build a Sentence 20%, Email 35%, Academic Discussion 45% (rubric 0–5 scores scaled to 0–30).`);
      } else {
        lines.push(`SPEAKING: ${s.scaled}/30 — Listen and Repeat 40%, Interview 60% (rubric 0–5 scores scaled to 0–30).`);
      }
    }
    lines.push(
      isFull
        ? `The total is the sum of the four section scores = ${total}/120 (band ${totalToBand(total)}).`
        : `Single-section practice: the section score is projected onto the 0–120 scale = ${total}/120.`,
    );
    lines.push(
      `Confidence ${Math.round(confidence * 100)}%: depends on the number of graded items, whether both adaptive modules were completed, and (for Writing/Speaking) whether an LLM rater with sampling or the heuristic fallback was used. These are internal estimates, not official ETS scores.`,
    );
    return lines.join(' ');
  }
}
