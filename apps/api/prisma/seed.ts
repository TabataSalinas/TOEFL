/**
 * Seed script: creates a demo user with goals. Idempotent — safe to re-run.
 * Exams are generated on demand from the app (Practice page), so nothing else is needed.
 *
 * Demo credentials: demo@toefl.local / DemoPass123!
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const startOfWeek = () => {
  const now = new Date();
  const diff = (now.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
};
const startOfMonth = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

async function main() {
  const email = 'demo@toefl.local';
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: await argon2.hash('DemoPass123!'),
      name: 'Demo Student',
      profile: { create: { targetTotalScore: 100, preferredStudyMinutesPerDay: 45, nativeLanguage: 'Spanish' } },
    },
  });

  for (const [period, periodStart, targetMinutes] of [
    ['WEEKLY', startOfWeek(), 300],
    ['MONTHLY', startOfMonth(), 1200],
  ] as const) {
    await prisma.goal.upsert({
      where: { userId_period_periodStart: { userId: user.id, period, periodStart } },
      update: {},
      create: { userId: user.id, period, periodStart, targetMinutes },
    });
  }
  console.log(`Demo user ready: ${email} / DemoPass123!`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
