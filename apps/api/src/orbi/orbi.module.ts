import { Module } from '@nestjs/common';
import { OrbiController } from './orbi.controller';
import { GroqAdapter } from './llm/groq.adapter';
import { LLM_ADAPTER } from './llm/llm-adapter.interface';
import { ConversationService } from './conversation/conversation.service';
import { ContextBuilderService } from './context/context-builder.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { NavigationTool } from './tools/definitions/navigation.tool';

@Module({
  controllers: [OrbiController],
  providers: [
    { provide: LLM_ADAPTER, useClass: GroqAdapter },
    ConversationService,
    ContextBuilderService,
    ToolRegistryService,
  ],
})
export class OrbiModule {
  constructor(private readonly toolRegistry: ToolRegistryService) {
    this.toolRegistry.register(new NavigationTool());
  }
}
