import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class GenerateExamDto {
  @ApiProperty({
    enum: ['FULL', 'SECTION'],
    description: 'FULL = all four sections; SECTION = single section',
  })
  @IsIn(['FULL', 'SECTION'])
  kind!: 'FULL' | 'SECTION';

  @ApiPropertyOptional({
    enum: ['READING', 'LISTENING', 'SPEAKING', 'WRITING'],
    description: 'Required when kind=SECTION',
  })
  @IsOptional()
  @IsIn(['READING', 'LISTENING', 'SPEAKING', 'WRITING'])
  section?: 'READING' | 'LISTENING' | 'SPEAKING' | 'WRITING';

  @ApiPropertyOptional({ enum: ['easy', 'standard', 'hard'] })
  @IsOptional()
  @IsIn(['easy', 'standard', 'hard'])
  difficulty?: 'easy' | 'standard' | 'hard';
}
