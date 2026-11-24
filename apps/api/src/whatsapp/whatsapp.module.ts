import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappMediosService } from './whatsapp-medios.service';
import { WhatsappService } from './whatsapp.service';
import { WhatsappBotService } from './whatsapp-bot.service';
import { AtencionOrbiModule } from '../orbi/atencion/atencion.module';

@Module({
  // AtencionOrbiModule: lo de Orbi que es igual en todos los canales (pedidos por chat, la cadena de IA del bot, el
  // catálogo de la tienda y los avisos al dueño).
  imports: [AtencionOrbiModule],
  controllers: [WhatsappController, WhatsappWebhookController],
  providers: [WhatsappService, WhatsappMediosService, WhatsappBotService],
  exports: [WhatsappService, WhatsappBotService], // ConversationsService responde por WhatsApp; la bandeja enciende y apaga Orbi por chat
})
export class WhatsappModule {}
