import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductAiService } from './product-ai.service';
import { ProductImageSearchService } from './product-image-search.service';
import { CategoriesModule } from '../categories/categories.module';
import { TagsModule } from '../tags/tags.module';
import { BackgroundRemovalModule } from '../background-removal/background-removal.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { CostsModule } from '../platform/costs/costs.module';

@Module({
  // BusinessesModule: solo para reusar BusinessesService#uploadStorefrontVideo
  // en el upload de video de producto (mismo bucket de assets públicos del
  // negocio que ya usa Apariencia — ver products.controller.ts).
  imports: [CategoriesModule, TagsModule, BackgroundRemovalModule, BusinessesModule, CostsModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductAiService, ProductImageSearchService],
  exports: [ProductsService, ProductAiService, ProductImageSearchService],
})
export class ProductsModule {}
