import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SpeakingService } from './speaking.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { Segment } from './speech-metrics';

function parseSegments(raw: unknown): Segment[] | undefined {
  if (typeof raw !== 'string' || !raw) return undefined;
  try {
    const arr = JSON.parse(raw) as Array<{ start: unknown; end: unknown }>;
    if (!Array.isArray(arr) || arr.length > 600) return undefined;
    const segs = arr
      .map((s) => ({ start: Number(s.start), end: Number(s.end) }))
      .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end >= s.start && s.start >= 0);
    return segs.length ? segs : undefined;
  } catch {
    return undefined;
  }
}

@ApiTags('speaking')
@ApiBearerAuth()
@Controller()
export class SpeakingController {
  constructor(private readonly speaking: SpeakingService) {}

  @Post('attempts/:attemptId/speaking/recordings')
  @ApiOperation({ summary: 'Upload the recording of one speaking answer (transcribed and analysed immediately)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 15 * 1024 * 1024 } }))
  async upload(
    @CurrentUser() user: AuthUser,
    @Param('attemptId') attemptId: string,
    @UploadedFile() file: { buffer: Buffer; size: number; mimetype: string } | undefined,
    @Body() body: Record<string, string>,
  ) {
    if (!file) throw new BadRequestException('Missing "audio" file');
    if (!body.questionId) throw new BadRequestException('questionId is required');
    const duration = Number(body.durationSec);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 120) throw new BadRequestException('Invalid durationSec');
    return this.speaking.saveRecording(
      user.userId,
      attemptId,
      {
        questionId: body.questionId,
        durationSec: duration,
        mimeType: file.mimetype || 'audio/webm',
        clientTranscript: body.clientTranscript?.slice(0, 4000),
        clientConfidence: body.clientConfidence ? Number(body.clientConfidence) : undefined,
        speechSegments: parseSegments(body.speechSegments),
      },
      file,
    );
  }

  @Get('speaking/recordings')
  @ApiOperation({ summary: 'List my previous speaking recordings' })
  list(@CurrentUser() user: AuthUser) {
    return this.speaking.list(user.userId);
  }

  @Get('speaking/recordings/:id')
  @ApiOperation({ summary: 'Recording details: transcript, metrics, rubric analysis' })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.speaking.get(user.userId, id);
  }

  @Get('speaking/recordings/:id/audio')
  @ApiOperation({ summary: 'Stream the recorded audio' })
  async audio(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const { data, mime } = await this.speaking.audio(user.userId, id);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(data);
  }
}
