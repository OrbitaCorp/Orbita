import { Module } from '@nestjs/common';
import { VideosService } from './videos.service';

// El núcleo de la cola de videos (registro, aprobación, borrado). La publicación en TikTok e Instagram vive en
// MarketingModule (necesita esas integraciones); el conector MCP de Claude usa este módulo para registrar videos.
@Module({
  providers: [VideosService],
  exports: [VideosService],
})
export class VideosModule {}
