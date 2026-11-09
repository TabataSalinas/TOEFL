import { Module } from '@nestjs/common';
import { SpeakingService } from './speaking.service';
import { SpeakingController } from './speaking.controller';
import { ScoringModule } from '../scoring/scoring.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [ScoringModule, StorageModule],
  controllers: [SpeakingController],
  providers: [SpeakingService],
  exports: [SpeakingService],
})
export class SpeakingModule {}