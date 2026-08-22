import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductAiService } from './product-ai.service';
import { CategoriesModule } from '../categories/categories.module';
import { TagsModule } from '../tags/tags.module';

@Module({
  imports: [CategoriesModule, TagsModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductAiService],
})
export class ProductsModule {}
