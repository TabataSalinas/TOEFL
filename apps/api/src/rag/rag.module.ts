import { Global, Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';

@Global()
@Module({
  controllers: [RagController],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
