import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { TutorService } from './tutor.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

class UpdatePlanItemDto {
  @IsIn(['PENDING', 'IN_PROGRESS', 'DONE', 'SKIPPED'])
  status!: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED';
}

@ApiTags('tutor')
@ApiBearerAuth()
@Controller('tutor')
export class TutorController {
  constructor(private readonly tutor: TutorService) {}

  @Get('analysis')
  @ApiOperation({ summary: 'Coach analysis: weaknesses, strengths, summary, time-to-target' })
  async analyze(@CurrentUser() user: AuthUser): Promise<any> {
    return this.tutor.analyze(user.userId);
  }

  @Post('plan')
  @ApiOperation({ summary: 'Generate/regenerate an adaptive study plan' })
  generatePlan(@CurrentUser() user: AuthUser) {
    return this.tutor.generatePlan(user.userId);
  }

  @Get('plan')
  @ApiOperation({ summary: 'Get the active study plan' })
  getPlan(@CurrentUser() user: AuthUser) {
    return this.tutor.getActivePlan(user.userId);
  }

  @Patch('plan/items/:itemId')
  @ApiOperation({ summary: 'Update a study plan item status' })
  updateItem(
    @CurrentUser() user: AuthUser,
    @Param('itemId') itemId: string,
    @Body() dto: UpdatePlanItemDto,
  ) {
    return this.tutor.updatePlanItemStatus(user.userId, itemId, dto.status);
  }
}
