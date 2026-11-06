import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Smoke e2e test. Requires a reachable PostgreSQL (DATABASE_URL). Run with:
 *   npm run test:e2e --workspace @toefl/api
 */
describe('TOEFL API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/health returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('rejects an unauthenticated protected route', async () => {
    const res = await request(app.getHttpServer()).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('registers, logs in, and generates a section exam', async () => {
    const email = `e2e_${Date.now()}@toefl.local`;
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'E2ePass123!', name: 'E2E' });
    expect(reg.status).toBe(201);
    const token = reg.body.accessToken as string;
    expect(token).toBeTruthy();

    const gen = await request(app.getHttpServer())
      .post('/api/exams/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'SECTION', section: 'READING', difficulty: 'standard' });
    expect(gen.status).toBe(201);
    expect(gen.body.sections[0].questions.length).toBeGreaterThan(0);
  });
});
