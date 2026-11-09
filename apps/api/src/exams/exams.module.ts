import { Module } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { ExamBuilderService } from './exam-builder.service';
import { SourcesModule } from '../sources/sources.module';

@Module({
  imports: [SourcesModule],
  controllers: [ExamsController],
  providers: [ExamsService, ExamBuilderService],
  exports: [ExamsService, ExamBuilderService],
})
export class ExamsModule {}
