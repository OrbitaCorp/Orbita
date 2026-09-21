import { Module } from '@nestjs/common';
import { ImageStudioController } from './image-studio.controller';
import { ImageStudioService } from './image-studio.service';
import { BackgroundRemovalModule } from '../background-removal/background-removal.module';
import { CloudflareImagesModule } from '../cloudflare/cloudflare-images.module';
import { BusinessesModule } from '../businesses/businesses.module';

@Module({
  // BusinessesModule: hasActiveAddon() para el gate de "Avanzado" — mismo
  // motivo que games/social-proof/promo-modal/two-for-one/countdown.
  imports: [BackgroundRemovalModule, CloudflareImagesModule, BusinessesModule],
  controllers: [ImageStudioController],
  providers: [ImageStudioService],
})
export class ImageStudioModule {}
