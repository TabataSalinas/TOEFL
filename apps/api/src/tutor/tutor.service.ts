import { Injectable, NotFoundException } from '@nestjs/common';

type Section = 'READING' | 'LISTENING' | 'SPEAKING' | 'WRITING';

import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ReportsService, SkillRow } from '../reports/reports.service';

export type SkillAccuracy = SkillRow;

interface Recommendation {
  exercise: string;
  resources: string[];
}

interface PlanItemStatus {
  status: string;
  skillTag: string;
}

/** Exercise + resource suggestions per skill / rubric dimension (generic fallback below). */
const RECOMMENDATIONS: Record<string, Recommendation> = {
  'complete-words': {
    exercise:
      'Read short paragraphs daily and predict damaged words from context; review word families and common suffixes (-tion, -ment, -able).',
    resources: [
      'Paragraph cloze practice in the official ETS free TOEFL iBT practice materials',
      'Academic Word List flashcards (Coxhead AWL)',
    ],
  },

  'main-purpose': {
    exercise:
      'After reading an email or notice, state its purpose in one sentence before looking at the options.',
    resources: [
      'Official ETS free practice test (Read in Daily Life)',
      'Real emails/notices from your own university site',
    ],
  },

  'factual-detail': {
    exercise:
      'Skim for key nouns and numbers; underline the sentence that proves your answer.',
    resources: [
      'Official ETS free practice test',
      'Simple English Wikipedia articles with a self-made quiz',
    ],
  },

  'negative-factual': {
    exercise:
      'Check each option against the text and eliminate the three that ARE stated; practise EXCEPT/NOT questions in sets of 10.',
    resources: ['Official ETS free practice test (Read an Academic Passage)'],
  },

  vocabulary: {
    exercise:
      'Guess meaning from context first, then confirm; keep a notebook of academic words with example sentences.',
    resources: [
      'Academic Word List (Coxhead)',
      'Cambridge Dictionary examples',
      'Anki deck of AWL',
    ],
  },

  inference: {
    exercise:
      'Ask "what must be true given this text?" and reject options that go beyond the passage.',
    resources: [
      'Official ETS free practice test',
      'Articles from VOA Learning English with comprehension questions',
    ],
  },

  'paragraph-relationship': {
    exercise:
      'Write a 6-word summary of each paragraph, then name the relationship (cause, example, contrast, solution).',
    resources: ['Purdue OWL — paragraph structure and transitions'],
  },

  'rhetorical-purpose': {
    exercise:
      'For each detail in a passage, ask "why did the author include this?" (example, contrast, evidence).',
    resources: ['Purdue OWL — rhetorical modes'],
  },

  'response-selection': {
    exercise:
      'Shadow short everyday dialogues; focus on replies that answer indirectly, and notice sound-alike distractors.',
    resources: [
      'BBC Learning English — 6 Minute English',
      'English Central / YouGlish for natural phrases',
    ],
  },

  'main-idea': {
    exercise:
      'After each lecture, summarise it in one sentence without notes; compare with the transcript.',
    resources: [
      'TED-Ed talks with transcripts',
      'University open lectures (MIT OpenCourseWare)',
    ],
  },

  detail: {
    exercise:
      'Practise note-taking with abbreviations while listening to 3-minute lectures once only.',
    resources: ['MIT OpenCourseWare lectures', 'VOA Learning English'],
  },

  function: {
    exercise:
      'Ask why the speaker mentions each example: to illustrate, contrast, correct or give evidence.',
    resources: ['TED-Ed talks with transcripts'],
  },

  prediction: {
    exercise:
      'Pause recordings before the end and predict the next topic from discourse markers ("Next time…", "Now let’s turn to…").',
    resources: ['MIT OpenCourseWare lectures'],
  },

  'implied-meaning': {
    exercise:
      'Practise tone and implication: rewrite what a speaker "really means" for 10 sentences a day.',
    resources: ['BBC Learning English — English at Work'],
  },

  'build-sentence': {
    exercise:
      'Practise embedded questions, perfect tenses and word order with 10 scrambled sentences per day; say each aloud.',
    resources: [
      'English Grammar in Use (Murphy)',
      'Purdue OWL — sentence structure',
    ],
  },

  'write-email': {
    exercise:
      'Write one 80–110 word email per day with a greeting, three developed points and a closing; time yourself (7 minutes).',
    resources: ['Purdue OWL — professional emails'],
  },

  'academic-discussion': {
    exercise:
      'Answer a debate question in 10 minutes: opinion, two reasons with examples, and a reference to a classmate.',
    resources: [
      'The Economist/NYT Student Opinion prompts for topics',
      'Purdue OWL — argumentative writing',
    ],
  },

  'email:grammar_accuracy': {
    exercise:
      'Keep an error log from your corrected emails and rewrite the sentences correctly.',
    resources: [
      'English Grammar in Use (Murphy)',
      'Grammarly/LanguageTool for self-checking',
    ],
  },

  'discussion:language_use': {
    exercise:
      'Upgrade 5 simple sentences per day with academic phrasing and varied structures.',
    resources: ['Academic Phrasebank (University of Manchester)'],
  },

  'discussion:development_support': {
    exercise:
      'For every reason you give, add "For instance, …" plus a specific example.',
    resources: ['Academic Phrasebank (University of Manchester)'],
  },

  'listen-repeat': {
    exercise:
      'Shadow 10 sentences a day (listen, pause, repeat) and record yourself; compare stress and rhythm.',
    resources: [
      'YouGlish',
      'BBC Learning English pronunciation',
    ],
  },

  interview: {
    exercise:
      'Answer one interview question daily for 45 seconds: point, reason, example, short conclusion.',
    resources: [
      "Record yourself and review with this platform's Recordings page",
    ],
  },

  'speaking:fluency': {
    exercise:
      'Do 45-second non-stop talks; when stuck, use bridge phrases instead of silence.',
    resources: ['Record → transcribe → count pauses with this platform'],
  },

  'speaking:pace': {
    exercise:
      'Read a paragraph aloud with a metronome around 140 words/min, then speak freely at the same pace.',
    resources: [
      'Online metronome',
      'TED talks (~150 wpm)',
    ],
  },

  'speaking:grammar': {
    exercise:
      'Transcribe one answer and correct it in writing; then re-record using the corrected sentences.',
    resources: ['English Grammar in Use (Murphy)'],
  },

  'speaking:vocabulary': {
    exercise:
      'Prepare 5 topic-specific word sets (study, commuting, shopping…) with collocations and use them in answers.',
    resources: [
      'Cambridge Dictionary collocations',
      'Oxford Collocations',
    ],
  },

  'speaking:topic_development': {
    exercise:
      'Use a point–reason–example–wrap-up template and practise it on 10 different questions.',
    resources: ["This platform's Interview bank"],
  },

  'speaking:coherence': {
    exercise:
      'Practise connectors (first, because, for example, however) in every answer.',
    resources: ['Academic Phrasebank (University of Manchester)'],
  },
};

const GENERIC: Recommendation = {
  exercise:
    'Do focused drills on this skill, review every explanation, and repeat similar items until you reach 80%+.',
  resources: [
    'Official ETS free TOEFL iBT practice test and test-taker resources (ets.org/toefl)',
  ],
};

export interface PlanItemDraft {
  section: Section | null;
  skillTag: string;
  title: string;
  description: string;
  estMinutes: number;
  estPointsGain: number;
}

/** Target accuracy used to estimate the gain from improving a skill. */
const TARGET_ACCURACY = 0.85;

/**
 * Pure planner: distributes the realistic gain across weak skills.
 * A skill's potential is (target − accuracy) × the share of its section
 * (30 points / number of skills in that section, min 3), then scaled
 * so the total never exceeds the gap to the target.
 */
export function planPotentials(
  weak: SkillRow[],
  allSkills: SkillRow[],
  gap: number,
): Array<SkillRow & { gain: number }> {
  const perSection = new Map<string, number>();

  for (const s of allSkills) {
    perSection.set(
      s.section,
      (perSection.get(s.section) ?? 0) + 1,
    );
  }

  const raw = weak.map((w) => ({
    ...w,
    gain:
      Math.max(0, TARGET_ACCURACY - w.accuracy) *
      (30 / Math.max(3, perSection.get(w.section) ?? 3)),
  }));

  const sum = raw.reduce((a, r) => a + r.gain, 0);
  const cap = gap > 0 ? gap : sum;
  const scale = sum > cap && sum > 0 ? cap / sum : 1;

  return raw.map((r) => ({
    ...r,
    gain: Math.round(r.gain * scale * 10) / 10,
  }));
}

/**
 * Personal TOEFL coach: weakness profile, natural-language summary,
 * and an adaptive study plan with exercises, resources,
 * estimated point gains and time-to-target.
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
    const skills = await this.reports.getSkillAccuracy(userId);
    const progress = await this.reports.getProgress(userId);
    const estimatedTotal = progress.latest ?? 0;

    const usable = skills.filter(
      (s) => s.total >= 2 || s.source === 'rubric',
    );

    const weakest = usable.slice(0, 5);

    const strongest = [...usable]
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 3);

    const summary = await this.ai.generateCoachSummary({
      targetScore: target,
      estimatedTotal,
      weakestSkills: weakest.map((w) => ({
        skillTag: w.skillTag,
        accuracy: w.accuracy,
        section: w.section as 'READING',
      })),
      strongestSkills: strongest.map((s) => ({
        skillTag: s.skillTag,
        accuracy: s.accuracy,
        section: s.section as 'READING',
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
      allSkills: skills,
      estimatedWeeksToTarget: this.weeksToTarget(
        gap,
        profile?.preferredStudyMinutesPerDay ?? 45,
      ),
    };
  }

  /** Generate (or regenerate) the adaptive study plan from the latest results. */
  async generatePlan(userId: string) {
    const analysis = await this.analyze(userId);
    const previous = await this.getActivePlan(userId);

    const doneBefore = new Set(
      ((previous?.items ?? []) as PlanItemStatus[])
        .filter((i) => i.status === 'DONE')
        .map((i) => i.skillTag),
    );

    await this.prisma.studyPlan.updateMany({
      where: { userId, active: true },
      data: { active: false },
    });

    const drafts = this.buildPlanItems(
      analysis.weakestSkills,
      analysis.allSkills,
      analysis.gap,
    );

    return this.prisma.studyPlan.create({
      data: {
        userId,
        title: `Study plan — target ${analysis.targetScore}/120`,
        summary: analysis.summary,
        targetScore: analysis.targetScore,
        active: true,

        items: {
          create: drafts.map((it, i) => ({
            order: i,
            section: it.section,
            skillTag: it.skillTag,

            title: it.title,

            description: doneBefore.has(it.skillTag)
              ? `You completed this item before, but the skill is still below target — try a harder variation. ${it.description}`
              : it.description,

            estMinutes: it.estMinutes,
            estPointsGain: it.estPointsGain,
          })),
        },
      },

      include: {
        items: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });
  }

  async getActivePlan(userId: string) {
    return this.prisma.studyPlan.findFirst({
      where: {
        userId,
        active: true,
      },

      include: {
        items: {
          orderBy: {
            order: 'asc',
          },
        },
      },
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
      throw new NotFoundException('Plan item not found');
    }

    return this.prisma.studyPlanItem.update({
      where: { id: itemId },
      data: { status },
    });
  }

  // ── helpers ───────────────────────────────────────────────────────────

  buildPlanItems(
    weakest: SkillRow[],
    all: SkillRow[],
    gap: number,
  ): PlanItemDraft[] {
    return planPotentials(weakest, all, gap).map((w) => {
      const rec = RECOMMENDATIONS[w.skillTag] ?? GENERIC;
      const pct = Math.round(w.accuracy * 100);

      return {
        section: w.section as Section,
        skillTag: w.skillTag,

        title: `Improve ${this.humanize(w.skillTag)} (${w.section.toLowerCase()})`,

        description:
          `Current level: ${pct}%${
            w.source === 'rubric'
              ? ' of the rubric maximum'
              : ' accuracy'
          }. Exercise: ${rec.exercise} Resources: ${rec.resources.join('; ')}.`,

        estMinutes:
          30 + Math.round((1 - w.accuracy) * 30),

        estPointsGain: w.gain,
      };
    });
  }

  weeksToTarget(
    gap: number,
    minutesPerDay: number,
  ): number {
    if (gap <= 0) return 0;

    const hoursNeeded = gap * 2.5;
    const hoursPerWeek = (minutesPerDay * 7) / 60;

    return Math.ceil(
      hoursNeeded / Math.max(1, hoursPerWeek),
    );
  }

  private humanize(tag: string): string {
    return tag.replace(/[-\_:]/g, ' ');
  }
}