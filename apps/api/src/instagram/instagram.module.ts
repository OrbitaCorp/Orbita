import { Module } from '@nestjs/common';
import { InstagramAdminController } from './instagram-admin.controller';
import { InstagramComentariosService } from './instagram-comentarios.service';
import { InstagramController } from './instagram.controller';
import { InstagramMediosService } from './instagram-medios.service';
import { InstagramEstadisticasService } from './instagram-estadisticas.service';
import { InstagramPublicacionesService } from './instagram-publicaciones.service';
import { InstagramWebhookController } from './instagram-webhook.controller';
import { InstagramService } from './instagram.service';

@Module({
  controllers: [InstagramController, InstagramWebhookController, InstagramAdminController],
  providers: [InstagramService, InstagramPublicacionesService, InstagramMediosService, InstagramComentariosService, InstagramEstadisticasService],
  exports: [InstagramService], // ConversationsService responde por Instagram; el cron renueva los tokens
})
export class InstagramModule {}
