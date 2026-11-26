import { Module } from '@nestjs/common';
import { CostsModule } from '../platform/costs/costs.module';
import { AtencionOrbiModule } from '../orbi/atencion/atencion.module';
import { InstagramBotService } from './instagram-bot.service';
import { InstagramAdminController } from './instagram-admin.controller';
import { InstagramAjustesService } from './instagram-ajustes.service';
import { InstagramBandejaService } from './instagram-bandeja.service';
import { InstagramComentariosService } from './instagram-comentarios.service';
import { InstagramController } from './instagram.controller';
import { InstagramMediosService } from './instagram-medios.service';
import { InstagramEstadisticasService } from './instagram-estadisticas.service';
import { InstagramOrbiService } from './instagram-orbi.service';
import { InstagramPublicacionesService } from './instagram-publicaciones.service';
import { InstagramWebhookController } from './instagram-webhook.controller';
import { InstagramService } from './instagram.service';
import { InstagramImportacionController } from './instagram-importacion.controller';
import { InstagramImportacionService } from './instagram-importacion.service';
import { InternalCronSecretGuard } from '../internal-cron/internal-cron-secret.guard';
import { InstagramRuteoService } from './instagram-ruteo.service';

@Module({
  imports: [CostsModule, AtencionOrbiModule], // AtencionOrbiModule: Orbi atiende los mensajes directos (lo mismo que en WhatsApp)
  controllers: [InstagramController, InstagramWebhookController, InstagramAdminController, InstagramImportacionController],
  providers: [InstagramService, InstagramPublicacionesService, InstagramMediosService, InstagramComentariosService, InstagramEstadisticasService, InstagramBandejaService, InstagramOrbiService, InstagramAjustesService, InstagramBotService, InstagramRuteoService, InstagramImportacionService, InternalCronSecretGuard],
  exports: [InstagramService, InstagramPublicacionesService, InstagramComentariosService, InstagramMediosService, InstagramEstadisticasService, InstagramRuteoService, AtencionOrbiModule], // InstagramRuteoService y la IA del bot (AtencionOrbiModule): el bot de ventas de la empresa; ConversationsService responde por Instagram; el cron renueva los tokens; el super panel (Marketing) usa el resto
})
export class InstagramModule {}
