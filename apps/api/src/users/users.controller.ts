import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { SetGoalDto, UpdateProfileDto } from './dto/user.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current user, profile and goals' })
  me(@CurrentUser() user: AuthUser) {
    return this.users.getMe(user.userId);
  }

  @Patch('me/profile')
  @ApiOperation({ summary: 'Update profile, target score and preferences' })
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.userId, dto);
  }

  @Get('me/goals')
  @ApiOperation({ summary: 'List study goals' })
  goals(@CurrentUser() user: AuthUser) {
    return this.users.getGoals(user.userId);
  }

  @Post('me/goals')
  @ApiOperation({ summary: 'Set a weekly or monthly study goal' })
  setGoal(@CurrentUser() user: AuthUser, @Body() dto: SetGoalDto) {
    return this.users.setGoal(user.userId, dto);
  }
}
