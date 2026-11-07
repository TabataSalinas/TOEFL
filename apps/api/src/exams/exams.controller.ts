import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExamsService } from './exams.service';
import { GenerateExamDto } from './dto/exam.dto';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@ApiTags('exams')
@ApiBearerAuth()
@Controller('exams')
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a new AI exam (full or single section)' })
  generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateExamDto) {
    return this.exams.generate(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List recently generated exams' })
  list() {
    return this.exams.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Exam blueprint summary (never includes questions or answers)' })
  get(@Param('id') id: string) {
    return this.exams.summary(id);
  }
}
