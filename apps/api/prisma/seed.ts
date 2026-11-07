/**
 * Seed script: creates a demo user and one pre-generated Reading exam so you
 * can explore the app immediately after setup. Idempotent — safe to re-run.
 *
 * Demo credentials: demo@toefl.local / DemoPass123!
 */
import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { MockAiProvider } from '../src/ai/providers/mock.provider';
import { SECTION_BLUEPRINTS } from '../src/common/toefl.constants';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@toefl.local';
  const passwordHash = await argon2.hash('DemoPass123!');

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name: 'Demo Student',
      profile: {
        create: {
          targetTotalScore: 100,
          preferredStudyMinutesPerDay: 45,
          nativeLanguage: 'Spanish',
        },
      },
    },
  });
  console.log(`Demo user ready: ${email} / DemoPass123!`);

  // Weekly + monthly goals
  const startOfWeek = () => {
    const now = new Date();
    const diff = (now.getUTCDay() + 6) % 7;
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  };
  const startOfMonth = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  };
  await prisma.goal.upsert({
    where: {
      userId_period_periodStart: {
        userId: user.id,
        period: 'WEEKLY',
        periodStart: startOfWeek(),
      },
    },
    update: {},
    create: { userId: user.id, period: 'WEEKLY', periodStart: startOfWeek(), targetMinutes: 300 },
  });
  await prisma.goal.upsert({
    where: {
      userId_period_periodStart: {
        userId: user.id,
        period: 'MONTHLY',
        periodStart: startOfMonth(),
      },
    },
    update: {},
    create: { userId: user.id, period: 'MONTHLY', periodStart: startOfMonth(), targetMinutes: 1200 },
  });

  // One ready-to-take Reading exam (via the deterministic mock generator).
  const existing = await prisma.exam.findFirst({ where: { title: 'Seed Reading Practice (standard)' } });
  if (!existing) {
    const mock = new MockAiProvider();
    const bp = SECTION_BLUEPRINTS.READING;
    const generated = await mock.generateSection({
      section: 'READING',
      difficulty: 'standard',
      passages: bp.passages,
      questionsPerPassage: bp.questionsPerPassage,
      seed: 1234,
    });

    const exam = await prisma.exam.create({
      data: {
        kind: 'SECTION',
        title: 'Seed Reading Practice (standard)',
        section: 'READING',
        difficulty: 'standard',
        generatedBy: 'seed',
      },
    });
    const examSection = await prisma.examSection.create({
      data: {
        examId: exam.id,
        section: 'READING',
        order: 0,
        timeLimitSec: bp.timeLimitSec,
        instructions: generated.instructions,
      },
    });
    let order = 0;
    for (let p = 0; p < generated.passages.length; p++) {
      const gp = generated.passages[p];
      const passage = await prisma.passage.create({
        data: {
          examSectionId: examSection.id,
          order: p,
          title: gp.title,
          body: gp.body,
          topic: gp.topic,
          wordCount: gp.body.split(/\s+/).length,
        },
      });
      for (const gq of gp.questions) {
        await prisma.question.create({
          data: {
            examSectionId: examSection.id,
            passageId: passage.id,
            order: order++,
            type: gq.type,
            section: 'READING',
            prompt: gq.prompt,
            options: gq.options as unknown as Prisma.InputJsonValue,
            correctAnswer: gq.correctAnswer,
            explanation: gq.explanation,
            skillTag: gq.skillTag,
            points: gq.points,
          },
        });
      }
    }
    console.log(`Seed exam created: ${exam.id}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
