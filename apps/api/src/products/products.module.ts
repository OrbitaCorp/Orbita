import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductAiService } from './product-ai.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ProductAiService],
})
export class ProductsModule {}
