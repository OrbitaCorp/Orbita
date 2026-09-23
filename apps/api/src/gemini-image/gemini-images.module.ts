import { Module } from '@nestjs/common';
import { GeminiImageService } from './gemini-image.service';

@Module({
  providers: [GeminiImageService],
  exports: [GeminiImageService],
})
export class GeminiImagesModule {}
