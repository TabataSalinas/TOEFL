import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * End-to-end flow against a real PostgreSQL (DATABASE_URL). Uses the offline content bank
 * (no OPENAI_API_KEY needed). Run with:  npm run test:e2e --workspace @toefl/api
 */
describe('TOEFL API (e2e)', () => {
  let app: INestApplication;
  let token: string;
  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    delete process.env.OPENAI_API_KEY;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    const reg = await http().post('/api/auth/register').send({ email: `e2e_${Date.now()}@toefl.local`, password: 'E2ePass123!', name: 'E2E' });
    token = reg.body.accessToken;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('health is public and protected routes require a token', async () => {
    expect((await http().get('/api/health')).status).toBe(200);
    expect((await http().get('/api/users/me')).status).toBe(401);
  });

  it('serves a Reading module without answers, routes the adaptive module 2, and reveals answers only in the report', async () => {
    const exam = await http().post('/api/exams/generate').set(auth()).send({ kind: 'SECTION', section: 'READING' });
    expect(exam.status).toBe(201);
    expect(JSON.stringify(exam.body)).not.toContain('correctAnswer');

    const detail = await http().get(`/api/exams/${exam.body.id}`).set(auth());
    expect(JSON.stringify(detail.body)).not.toContain('correctAnswer');
    expect(JSON.stringify(detail.body)).not.toContain('explanation');

    const attempt = await http().post('/api/attempts').set(auth()).send({ examId: exam.body.id });
    expect(attempt.status).toBe(201);
    const attemptId = attempt.body.id as string;

    const m1 = await http().post(`/api/attempts/${attemptId}/sections/READING/start`).set(auth());
    expect(m1.status).toBe(201);
    expect(m1.body.module).toBe(1);
    expect(m1.body.questions.length).toBe(20);
    const served = JSON.stringify(m1.body);
    expect(served).not.toContain('correctAnswer');
    expect(served).not.toContain('"explanation"');

    // Answer everything with "A" (and the blanks with "x") and finish module 1.
    const answers = m1.body.questions.map((q: { id: string; type: string }) => ({
      questionId: q.id,
      response: q.type === 'READING_COMPLETE_WORDS' ? 'x' : 'A',
    }));
    expect((await http().post(`/api/attempts/${attemptId}/sections/READING/answers`).set(auth()).send({ answers })).status).toBe(201);
    const fin1 = await http().post(`/api/attempts/${attemptId}/sections/READING/finish`).set(auth());
    expect(fin1.status).toBe(201);
    expect(fin1.body.nextModule).toBe(2);

    // Report is not available while the attempt is in progress.
    expect((await http().get(`/api/reports/attempts/${attemptId}`).set(auth())).status).toBe(403);

    const m2 = await http().post(`/api/attempts/${attemptId}/sections/READING/start`).set(auth());
    expect(m2.body.module).toBe(2);
    expect(m2.body.questions.length).toBe(20);
    const fin2 = await http().post(`/api/attempts/${attemptId}/sections/READING/finish`).set(auth());
    expect(fin2.body.status).toBe('COMPLETED');

    const report = await http().get(`/api/reports/attempts/${attemptId}`).set(auth());
    expect(report.status).toBe(200);
    expect(report.body.scoreReport.totalScore).toBeGreaterThanOrEqual(0);
    expect(report.body.sections[0].modules).toHaveLength(2);
    expect(report.body.sections[0].modules[0].items[0].correctAnswer).toBeDefined();
  }, 60_000);

  it('locked Listening answers cannot be changed', async () => {
    const exam = await http().post('/api/exams/generate').set(auth()).send({ kind: 'SECTION', section: 'LISTENING' });
    const attempt = await http().post('/api/attempts').set(auth()).send({ examId: exam.body.id });
    const id = attempt.body.id as string;
    const m1 = await http().post(`/api/attempts/${id}/sections/LISTENING/start`).set(auth());
    expect(m1.body.passages.every((p: { body: unknown }) => p.body === null)).toBe(true); // transcript hidden
    const qid = m1.body.questions[0].id as string;
    await http().post(`/api/attempts/${id}/sections/LISTENING/answers`).set(auth()).send({ answers: [{ questionId: qid, response: 'A', lock: true }] });
    const again = await http().post(`/api/attempts/${id}/sections/LISTENING/answers`).set(auth()).send({ answers: [{ questionId: qid, response: 'B' }] });
    expect(again.body.ignored).toBe(1);
  }, 60_000);

  it('enforces the official section order in full exams', async () => {
    const exam = await http().post('/api/exams/generate').set(auth()).send({ kind: 'FULL' });
    const attempt = await http().post('/api/attempts').set(auth()).send({ examId: exam.body.id });
    const res = await http().post(`/api/attempts/${attempt.body.id}/sections/SPEAKING/start`).set(auth());
    expect(res.status).toBe(400);
  }, 90_000);

  it('exposes rubrics to consult', async () => {
    const res = await http().get('/api/rag/chunks?taskType=WRITE_EMAIL&kind=rubric').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
  });
});
