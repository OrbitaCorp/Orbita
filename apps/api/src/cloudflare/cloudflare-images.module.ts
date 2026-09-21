import { Module } from '@nestjs/common';
import { CloudflareImageService } from './cloudflare-image.service';

@Module({
  providers: [CloudflareImageService],
  exports: [CloudflareImageService],
})
export class CloudflareImagesModule {}
