import { Global, Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { BankProvider } from './providers/bank.provider';

@Global()
@Module({
  providers: [BankProvider, AiService],
  exports: [AiService],
})
export class AiModule {}
