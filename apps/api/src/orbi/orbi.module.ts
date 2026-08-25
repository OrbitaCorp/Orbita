import { Module } from '@nestjs/common';
import { OrbiController } from './orbi.controller';
import { GroqAdapter } from './llm/groq.adapter';
import { LLM_ADAPTER } from './llm/llm-adapter.interface';
import { ConversationService } from './conversation/conversation.service';
import { ContextBuilderService } from './context/context-builder.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { NavigationTool } from './tools/definitions/navigation.tool';
import { ListProductsTool, CreateProductTool, GenerateDescriptionTool } from './tools/definitions/product.tools';
import { ProductsModule } from '../products/products.module';
import { ProductsService } from '../products/products.service';
import { ProductAiService } from '../products/product-ai.service';

@Module({
  imports: [ProductsModule],
  controllers: [OrbiController],
  providers: [
    { provide: LLM_ADAPTER, useClass: GroqAdapter },
    ConversationService,
    ContextBuilderService,
    ToolRegistryService,
  ],
})
export class OrbiModule {
  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly productsService: ProductsService,
    private readonly productAiService: ProductAiService,
  ) {
    this.toolRegistry.register(new NavigationTool());
    this.toolRegistry.register(new ListProductsTool(this.productsService));
    this.toolRegistry.register(new CreateProductTool(this.productsService));
    this.toolRegistry.register(new GenerateDescriptionTool(this.productAiService));
  }
}
