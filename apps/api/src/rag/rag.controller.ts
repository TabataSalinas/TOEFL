import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RagService } from './rag.service';

@ApiTags('rag')
@ApiBearerAuth()
@Controller('rag')
export class RagController {
  constructor(private readonly rag: RagService) {}

  @Get('chunks')
  @ApiOperation({ summary: 'List rubrics / anchors / guidelines (filter by taskType, kind)' })
  list(@Query('taskType') taskType?: string, @Query('kind') kind?: string) {
    return this.rag.list({ taskType, kind });
  }

  @Get('search')
  @ApiOperation({ summary: 'Hybrid (BM25 + embeddings) search in the knowledge base' })
  search(@Query('q') q = '', @Query('taskType') taskType?: string, @Query('kind') kind?: string) {
    if (!q.trim()) return [];
    return this.rag.retrieve({ query: q, taskType, kinds: kind ? [kind] : undefined, k: 6 });
  }
}
