import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Section } from '@prisma/client';
import { AttemptsService } from './attempts.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { StartAttemptDto, SubmitAnswersDto } from './dto/attempt.dto';

@ApiTags('attempts')
@ApiBearerAuth()
@Controller('attempts')
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Post()
  @ApiOperation({ summary: 'Start a new attempt for an exam' })
  start(@CurrentUser() user: AuthUser, @Body() dto: StartAttemptDto) {
    return this.attempts.start(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List the user’s attempts (history)' })
  list(@CurrentUser() user: AuthUser) {
    return this.attempts.listAttempts(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get attempt state (per-section status & timers)' })
  state(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.attempts.getAttemptState(user.userId, id);
  }

  @Post(':id/sections/:section/start')
  @ApiOperation({ summary: 'Start a section and receive its questions (no answers)' })
  startSection(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('section') section: Section,
  ) {
    return this.attempts.startSection(user.userId, id, section);
  }

  @Post(':id/sections/:section/answers')
  @ApiOperation({ summary: 'Save answers during the section (before the deadline)' })
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('section') section: Section,
    @Body() dto: SubmitAnswersDto,
  ) {
    return this.attempts.submitAnswers(user.userId, id, section, dto);
  }

  @Post(':id/sections/:section/finish')
  @ApiOperation({ summary: 'Finish a section: grades objective answers' })
  finish(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('section') section: Section,
  ) {
    return this.attempts.finishSection(user.userId, id, section);
  }

  @Post(':id/abandon')
  @ApiOperation({ summary: 'Abandon an attempt' })
  abandon(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.attempts.abandon(user.userId, id);
  }
}
