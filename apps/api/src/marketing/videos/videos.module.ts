import { Module } from '@nestjs/common';
import { TutorialesService } from './tutoriales.service';
import { VideosAvisoService } from './videos-aviso.service';
import { VideosService } from './videos.service';

// El núcleo de la cola de videos (registro, aprobación, borrado) y la lista de tutoriales. La publicación en TikTok e
// Instagram vive en MarketingModule (necesita esas integraciones); el conector MCP de Claude usa este módulo para registrar
// videos y actualizar la lista.
@Module({
  providers: [VideosService, VideosAvisoService, TutorialesService],
  exports: [VideosService, TutorialesService],
})
export class VideosModule {}
