import { Module } from '@nestjs/common';
import { WritingService } from './writing.service';
import { ScoringModule } from '../scoring/scoring.module';

@Module({
  imports: [ScoringModule],
  providers: [WritingService],
  exports: [WritingService],
})
export class WritingModule {}
