import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  IsDateString,
  IsIn,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Alex Rivera' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 120, example: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  targetTotalScore?: number;

  @ApiPropertyOptional({ example: '2026-06-15T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  testDate?: string;

  @ApiPropertyOptional({ minimum: 5, maximum: 600, example: 45 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  preferredStudyMinutesPerDay?: number;

  @ApiPropertyOptional({ enum: ['light', 'dark', 'system'] })
  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  theme?: string;

  @ApiPropertyOptional({ example: 'Spanish' })
  @IsOptional()
  @IsString()
  nativeLanguage?: string;
}

export class SetGoalDto {
  @ApiProperty({ enum: ['WEEKLY', 'MONTHLY'] })
  @IsIn(['WEEKLY', 'MONTHLY'])
  period!: 'WEEKLY' | 'MONTHLY';

  @ApiProperty({ example: 300, description: 'Target study minutes for the period' })
  @IsInt()
  @Min(0)
  targetMinutes!: number;
}
