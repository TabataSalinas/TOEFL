import { Injectable, NotFoundException } from '@nestjs/common';
import { GoalPeriod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SetGoalDto, UpdateProfileDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, goals: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const { name, ...profileData } = dto;
    if (name !== undefined) {
      await this.prisma.user.update({ where: { id: userId }, data: { name } });
    }
    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...profileData,
        testDate: profileData.testDate ? new Date(profileData.testDate) : undefined,
      },
      update: {
        ...profileData,
        testDate: profileData.testDate ? new Date(profileData.testDate) : undefined,
      },
    });
    return profile;
  }

  async setGoal(userId: string, dto: SetGoalDto) {
    const periodStart = this.periodStart(dto.period);
    return this.prisma.goal.upsert({
      where: {
        userId_period_periodStart: {
          userId,
          period: dto.period as GoalPeriod,
          periodStart,
        },
      },
      create: {
        userId,
        period: dto.period as GoalPeriod,
        periodStart,
        targetMinutes: dto.targetMinutes,
      },
      update: { targetMinutes: dto.targetMinutes },
    });
  }

  async getGoals(userId: string) {
    return this.prisma.goal.findMany({
      where: { userId },
      orderBy: { periodStart: 'desc' },
    });
  }

  /** Start of the current week (Monday) or month, normalized to UTC midnight. */
  private periodStart(period: 'WEEKLY' | 'MONTHLY'): Date {
    const now = new Date();
    if (period === 'MONTHLY') {
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    }
    const day = now.getUTCDay(); // 0=Sun
    const diff = (day + 6) % 7; // days since Monday
    const monday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff),
    );
    return monday;
  }
}
