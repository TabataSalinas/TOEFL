import { Global, Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { MockAiProvider } from './providers/mock.provider';

@Global()
@Module({
  providers: [MockAiProvider, AiService],
  exports: [AiService],
})
export class AiModule {}
