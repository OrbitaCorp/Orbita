import { Module } from '@nestjs/common';
import { CostsModule } from '../platform/costs/costs.module';
import { InstagramAdminController } from './instagram-admin.controller';
import { InstagramBandejaService } from './instagram-bandeja.service';
import { InstagramComentariosService } from './instagram-comentarios.service';
import { InstagramController } from './instagram.controller';
import { InstagramMediosService } from './instagram-medios.service';
import { InstagramEstadisticasService } from './instagram-estadisticas.service';
import { InstagramOrbiService } from './instagram-orbi.service';
import { InstagramPublicacionesService } from './instagram-publicaciones.service';
import { InstagramWebhookController } from './instagram-webhook.controller';
import { InstagramService } from './instagram.service';

@Module({
  imports: [CostsModule],
  controllers: [InstagramController, InstagramWebhookController, InstagramAdminController],
  providers: [InstagramService, InstagramPublicacionesService, InstagramMediosService, InstagramComentariosService, InstagramEstadisticasService, InstagramBandejaService, InstagramOrbiService],
  exports: [InstagramService], // ConversationsService responde por Instagram; el cron renueva los tokens
})
export class InstagramModule {}
