import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('progress')
  @ApiOperation({ summary: 'Score evolution over time (for charts)' })
  progress(@CurrentUser() user: AuthUser) {
    return this.reports.getProgress(user.userId);
  }

  @Get('skills')
  @ApiOperation({ summary: 'Accuracy by skill/question type across attempts' })
  skills(@CurrentUser() user: AuthUser) {
    return this.reports.getSkillAccuracy(user.userId);
  }

  @Get('attempts/:id')
  @ApiOperation({ summary: 'Detailed report for a completed attempt' })
  attempt(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reports.getAttemptReport(user.userId, id);
  }
}
