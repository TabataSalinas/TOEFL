import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttemptsService } from './attempts.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { StartAttemptDto, SubmitAnswersDto } from './dto/attempt.dto';
import { SectionName } from '../common/toefl.constants';

const SECTIONS: SectionName[] = ['READING', 'LISTENING', 'WRITING', 'SPEAKING'];
function parseSection(value: string): SectionName {
  const s = value.toUpperCase() as SectionName;
  if (!SECTIONS.includes(s)) throw new BadRequestException(`section must be one of ${SECTIONS.join(', ')}`);
  return s;
}

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
  @ApiOperation({ summary: 'Attempt state (per-section status, module and timers). Closes overdue modules.' })
  state(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.attempts.getAttemptState(user.userId, id);
  }

  @Post(':id/sections/:section/start')
  @ApiOperation({ summary: 'Start/resume the current module and receive its content (no answers)' })
  startSection(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('section') section: string) {
    return this.attempts.startSection(user.userId, id, parseSection(section));
  }

  @Post(':id/sections/:section/answers')
  @ApiOperation({ summary: 'Save answers (before the deadline); locked answers cannot change' })
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('section') section: string, @Body() dto: SubmitAnswersDto) {
    return this.attempts.submitAnswers(user.userId, id, parseSection(section), dto);
  }

  @Post(':id/sections/:section/finish')
  @ApiOperation({ summary: 'Finish the current module: grade it and route the next adaptive module' })
  finish(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('section') section: string) {
    return this.attempts.finishSection(user.userId, id, parseSection(section));
  }

  @Post(':id/abandon')
  @ApiOperation({ summary: 'Abandon an attempt' })
  abandon(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.attempts.abandon(user.userId, id);
  }
}
