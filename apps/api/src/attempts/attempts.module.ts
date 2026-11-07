import { Module } from '@nestjs/common';
import { AttemptsService } from './attempts.service';
import { AttemptsController } from './attempts.controller';
import { ScoringModule } from '../scoring/scoring.module';
import { ExamsModule } from '../exams/exams.module';
import { WritingModule } from '../writing/writing.module';
import { SpeakingModule } from '../speaking/speaking.module';
import { MediaModule } from '../media/media.module';
import { TutorModule } from '../tutor/tutor.module';

@Module({
  imports: [ScoringModule, ExamsModule, WritingModule, SpeakingModule, MediaModule, TutorModule],
  controllers: [AttemptsController],
  providers: [AttemptsService],
  exports: [AttemptsService],
})
export class AttemptsModule {}
