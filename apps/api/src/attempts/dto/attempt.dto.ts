import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StartAttemptDto {
  @ApiProperty({ description: 'Exam id to attempt' })
  @IsString()
  @IsNotEmpty()
  examId!: string;
}

export class SubmitAnswerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  @ApiProperty({
    description: 'Selected option id (string) or ids (array) for the question',
    example: 'B',
  })
  @IsOptional()
  response?: string | string[];

  @ApiProperty({ required: false, example: 25 })
  @IsOptional()
  @IsInt()
  @Min(0)
  timeSpentSec?: number;

  @ApiProperty({ required: false, description: 'Lock the answer (Listening: no going back)' })
  @IsOptional()
  @IsBoolean()
  lock?: boolean;
}

export class SubmitAnswersDto {
  @ApiProperty({ type: [SubmitAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers!: SubmitAnswerDto[];
}
