import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SkillRow {
  skillTag: string;
  section: string;
  correct: number;
  total: number;
  accuracy: number;
  /** items = graded questions; rubric = 0–5 rubric dimensions (Writing/Speaking). */
  source: 'items' | 'rubric';
}

type Stat = { correct?: number; total?: number; accuracy?: number; score?: number; max?: number };

const asOptions = (o: unknown): Array<{ id: string; text: string }> => (Array.isArray(o) ? (o as Array<{ id: string; text: string }>) : []);

/**
 * Post-exam reporting. Answers, explanations and listening transcripts are exposed
 * only for COMPLETED attempts — never during an exam.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAttemptReport(userId: string, attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: true,
        scoreReport: { include: { sectionScores: true } },
        sectionAttempts: { include: { answers: true, essays: true, recordings: true, sectionScore: true } },
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId) throw new ForbiddenException('Not your attempt');
    if (attempt.status === 'IN_PROGRESS') throw new ForbiddenException('The report is available when the attempt is finished');

    const summary = (attempt.scoreReport?.sectionSummary ?? {}) as Record<string, { scaled: number; band: number; confidence: number; path: string | null }>;
    const sectionNames = [...new Set(attempt.sectionAttempts.map((s) => s.section))];
    const order = ['READING', 'LISTENING', 'WRITING', 'SPEAKING'];
    sectionNames.sort((a, b) => order.indexOf(a) - order.indexOf(b));

    const sections = [];
    for (const section of sectionNames) {
      const mods = attempt.sectionAttempts.filter((s) => s.section === section).sort((a, b) => a.module - b.module);
      const modules = [];
      const breakdown: Record<string, Stat> = {};
      for (const m of mods) {
        if (!m.examSectionId) continue;
        const [examSection, passages, questions] = await Promise.all([
          this.prisma.examSection.findUnique({ where: { id: m.examSectionId } }),
          this.prisma.passage.findMany({ where: { examSectionId: m.examSectionId }, orderBy: { order: 'asc' } }),
          this.prisma.question.findMany({ where: { examSectionId: m.examSectionId }, orderBy: { order: 'asc' } }),
        ]);
        const answers = new Map(m.answers.map((a) => [a.questionId, a]));
        const passageById = new Map(passages.map((p) => [p.id, p]));
        const items = questions
          .filter((q) => q.points > 0)
          .map((q) => {
            const a = answers.get(q.id);
            const p = q.passageId ? passageById.get(q.passageId) : undefined;
            return {
              questionId: q.id,
              passageId: q.passageId,
              taskKind: q.taskKind,
              type: q.type,
              skillTag: q.skillTag,
              prompt: q.prompt,
              options: asOptions(q.options),
              meta: q.meta,
              yourAnswer: a?.response ?? null,
              correctAnswer: q.correctAnswer,
              isCorrect: a?.isCorrect ?? false,
              explanation: q.explanation,
              timeSpentSec: a?.timeSpentSec ?? 0,
              passageTitle: p?.title ?? null,
            };
          });
        const correct = items.filter((i) => i.isCorrect).length;
        modules.push({
          module: m.module,
          variant: examSection?.variant ?? 'core',
          status: m.status,
          timeSpentSec: m.timeSpentSec,
          correct,
          total: items.length,
          accuracy: items.length ? correct / items.length : 0,
          avgTimePerQuestionSec: items.length ? Math.round(items.reduce((s, i) => s + i.timeSpentSec, 0) / items.length) : 0,
          // Stimuli are revealed after the exam (including listening transcripts).
          passages: passages.map((p) => ({ id: p.id, kind: p.kind, title: p.title, body: p.body, meta: p.meta, sourceRefs: p.sourceRefs })),
          items,
        });
        const sb = (m.sectionScore?.skillBreakdown ?? {}) as Record<string, Stat>;
        for (const [k, v] of Object.entries(sb)) {
          const prev = breakdown[k];
          breakdown[k] = prev && v.total != null
            ? { correct: (prev.correct ?? 0) + (v.correct ?? 0), total: (prev.total ?? 0) + (v.total ?? 0), accuracy: ((prev.correct ?? 0) + (v.correct ?? 0)) / Math.max(1, (prev.total ?? 0) + (v.total ?? 0)) }
            : v;
        }
      }

      const essays = mods.flatMap((m) => m.essays).map((e) => ({ id: e.id, taskType: e.taskType, content: e.content, wordCount: e.wordCount, score: e.score, feedback: e.feedback }));
      const recordings = mods.flatMap((m) => m.recordings).map((r) => ({
        id: r.id, questionId: r.questionId, durationSec: r.durationSec, transcript: r.transcript, transcriptSource: r.transcriptSource, score: r.score, metrics: r.metrics, analysis: r.analysis,
      }));
      if (recordings.length) {
        const qs = await this.prisma.question.findMany({ where: { id: { in: recordings.map((r) => r.questionId) } }, select: { id: true, type: true, prompt: true, order: true, correctAnswer: true } });
        const qMap = new Map(qs.map((q) => [q.id, q]));
        recordings.sort((a, b) => (qMap.get(a.questionId)?.order ?? 0) - (qMap.get(b.questionId)?.order ?? 0));
        recordings.forEach((r) => Object.assign(r, { type: qMap.get(r.questionId)?.type, prompt: qMap.get(r.questionId)?.prompt, target: qMap.get(r.questionId)?.type === 'SPEAKING_LISTEN_REPEAT' ? qMap.get(r.questionId)?.correctAnswer : undefined }));
      }
      const sum = summary[section];
      sections.push({
        section,
        status: mods[mods.length - 1].status,
        timeSpentSec: mods.reduce((a, m) => a + m.timeSpentSec, 0),
        scaledScore: sum?.scaled ?? null,
        band: sum?.band ?? null,
        confidence: sum?.confidence ?? null,
        path: sum?.path ?? null,
        skillBreakdown: breakdown,
        hardestSkills: this.hardestSkills(breakdown),
        modules,
        essays,
        recordings,
      });
    }

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

  /** Score evolution and per-section series for charts + attempt comparison. */
  async getProgress(userId: string) {
    const attempts = await this.prisma.examAttempt.findMany({
      where: { userId, status: 'COMPLETED' },
      orderBy: { completedAt: 'asc' },
      include: { exam: { select: { title: true, kind: true } }, scoreReport: true },
    });
    const timeline = attempts
      .filter((a) => a.scoreReport)
      .map((a) => {
        const sum = (a.scoreReport!.sectionSummary ?? {}) as Record<string, { scaled: number }>;
        return {
          attemptId: a.id,
          date: a.completedAt,
          title: a.exam.title,
          kind: a.kind,
          total: a.scoreReport!.totalScore,
          band: a.scoreReport!.totalBand,
          confidence: a.scoreReport!.confidence,
          sections: Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, v.scaled])),
        };
      });
    const full = timeline.filter((t) => t.kind === 'FULL');
    const series = full.length >= 2 ? full : timeline;
    return {
      attempts: timeline.length,
      timeline,
      best: timeline.reduce((max, t) => (t.total > max ? t.total : max), 0),
      latest: timeline.at(-1)?.total ?? null,
      trend: this.trend(series.map((t) => t.total)),
      /** Latest vs previous full attempt, per section. */
      comparison: full.length >= 2 ? this.compare(full[full.length - 2], full[full.length - 1]) : null,
    };
  }

  private compare(prev: { total: number; sections: Record<string, number>; date: Date | null }, cur: { total: number; sections: Record<string, number>; date: Date | null }) {
    const sections: Record<string, { previous: number; current: number; delta: number }> = {};
    for (const s of new Set([...Object.keys(prev.sections), ...Object.keys(cur.sections)])) {
      const p = prev.sections[s] ?? 0;
      const c = cur.sections[s] ?? 0;
      sections[s] = { previous: p, current: c, delta: c - p };
    }
    return { total: { previous: prev.total, current: cur.total, delta: cur.total - prev.total }, sections };
  }

  /**
   * Accuracy by skill across attempts: item-level skills from graded answers plus
   * rubric dimensions (0–5 → 0..1) from Writing/Speaking.
   */
  async getSkillAccuracy(userId: string) {
    const answers = await this.prisma.answer.findMany({
      where: { sectionAttempt: { examAttempt: { userId, status: 'COMPLETED' } }, isCorrect: { not: null } },
      include: { question: { select: { skillTag: true, section: true, taskKind: true } } },
    });
    const map = new Map<string, { section: string; correct: number; total: number; source: 'items' | 'rubric' }>();
    for (const a of answers) {
      const key = a.question.skillTag ?? 'general';
      const e = map.get(key) ?? { section: a.question.section, correct: 0, total: 0, source: 'items' as const };
      e.total += 1;
      if (a.isCorrect) e.correct += 1;
      map.set(key, e);
    }

    const productive = await this.prisma.sectionScore.findMany({
      where: { section: { in: ['WRITING', 'SPEAKING'] }, sectionAttempt: { examAttempt: { userId, status: 'COMPLETED' } } },
    });
    const rubric = new Map<string, { section: string; sum: number; n: number }>();
    for (const ps of productive) {
      for (const [k, v] of Object.entries((ps.skillBreakdown ?? {}) as Record<string, Stat>)) {
        if (v.score == null || v.max == null || (!k.includes(':') && k !== 'write-email' && k !== 'academic-discussion' && k !== 'listen-repeat' && k !== 'interview')) continue;
        const r = rubric.get(k) ?? { section: ps.section, sum: 0, n: 0 };
        r.sum += v.score / v.max;
        r.n += 1;
        rubric.set(k, r);
      }
    }
    const out: SkillRow[] = [...map.entries()].map(([skillTag, v]) => ({
      skillTag,
      section: v.section,
      correct: v.correct,
      total: v.total,
      accuracy: v.total ? Math.round((v.correct / v.total) * 100) / 100 : 0,
      source: 'items',
    }));
    for (const [skillTag, r] of rubric) {
      out.push({ skillTag, section: r.section, correct: 0, total: r.n, accuracy: Math.round((r.sum / r.n) * 100) / 100, source: 'rubric' });
    }
    return out.sort((a, b) => a.accuracy - b.accuracy);
  }

  /** Average answer time per task type (for “tiempo promedio de respuesta”). */
  async getTimings(userId: string) {
    const answers = await this.prisma.answer.findMany({
      where: { sectionAttempt: { examAttempt: { userId, status: 'COMPLETED' } }, timeSpentSec: { gt: 0 } },
      include: { question: { select: { taskKind: true } } },
    });
    const map = new Map<string, { sum: number; n: number }>();
    for (const a of answers) {
      const k = a.question.taskKind ?? 'other';
      const e = map.get(k) ?? { sum: 0, n: 0 };
      e.sum += a.timeSpentSec;
      e.n += 1;
      map.set(k, e);
    }
    return [...map.entries()].map(([taskKind, e]) => ({ taskKind, avgSec: Math.round(e.sum / e.n), samples: e.n }));
  }

  private hardestSkills(breakdown: Record<string, Stat>): string[] {
    return Object.entries(breakdown)
      .filter(([k, v]) => !k.startsWith('task:') && typeof v.accuracy === 'number' && v.accuracy < 0.6)
      .sort((a, b) => (a[1].accuracy ?? 0) - (b[1].accuracy ?? 0))
      .map(([k]) => k)
      .slice(0, 3);
  }

  private trend(values: number[]): 'improving' | 'declining' | 'stable' | 'n/a' {
    if (values.length < 2) return 'n/a';
    const first = values[0];
    const last = values.at(-1) as number;
    if (last - first >= 3) return 'improving';
    if (first - last >= 3) return 'declining';
    return 'stable';
  }
}
