import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { MediaService } from './media.service';

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get('tts/:file')
  @ApiOperation({ summary: 'Cached synthesized audio (requires auth)' })
  async tts(@Param('file') file: string, @Res() res: Response) {
    if (!/^[a-f0-9]{40}\.mp3$/.test(file)) throw new NotFoundException();
    try {
      const data = await this.media.read(`tts/${file}`);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.send(data);
    } catch {
      throw new NotFoundException();
    }
  }
}
