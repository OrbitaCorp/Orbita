import { Module } from '@nestjs/common';
import { OrbiController } from './orbi.controller';
import { GroqAdapter } from './llm/groq.adapter';
import { LLM_ADAPTER } from './llm/llm-adapter.interface';
import { ConversationService } from './conversation/conversation.service';

@Module({
  controllers: [OrbiController],
  providers: [
    { provide: LLM_ADAPTER, useClass: GroqAdapter },
    ConversationService,
  ],
})
export class OrbiModule {}
