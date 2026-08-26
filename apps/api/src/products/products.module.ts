import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductAiService } from './product-ai.service';
import { CategoriesModule } from '../categories/categories.module';
import { TagsModule } from '../tags/tags.module';
import { BackgroundRemovalModule } from '../background-removal/background-removal.module';

@Module({
  imports: [CategoriesModule, TagsModule, BackgroundRemovalModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductAiService],
  exports: [ProductsService, ProductAiService],
})
export class ProductsModule {}
