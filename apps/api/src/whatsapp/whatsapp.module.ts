import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappMediosService } from './whatsapp-medios.service';
import { WhatsappService } from './whatsapp.service';

@Module({
  controllers: [WhatsappController, WhatsappWebhookController],
  providers: [WhatsappService, WhatsappMediosService],
  exports: [WhatsappService], // ConversationsService responde por WhatsApp desde la bandeja
})
export class WhatsappModule {}
