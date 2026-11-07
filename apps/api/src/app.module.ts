import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ExamsModule } from './exams/exams.module';
import { AttemptsModule } from './attempts/attempts.module';
import { ScoringModule } from './scoring/scoring.module';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TutorModule } from './tutor/tutor.module';
import { HealthModule } from './health/health.module';
import { StorageModule } from './storage/storage.service';
import { RagModule } from './rag/rag.module';
import { MediaModule } from './media/media.module';
import { WritingModule } from './writing/writing.module';
import { SpeakingModule } from './speaking/speaking.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    RedisModule,
    StorageModule,
    AiModule,
    RagModule,
    AuthModule,
    UsersModule,
    ExamsModule,
    AttemptsModule,
    ScoringModule,
    ReportsModule,
    DashboardModule,
    TutorModule,
    MediaModule,
    WritingModule,
    SpeakingModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
