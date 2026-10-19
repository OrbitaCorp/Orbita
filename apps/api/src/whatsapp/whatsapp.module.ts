import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappMediosService } from './whatsapp-medios.service';
import { WhatsappService } from './whatsapp.service';
import { WhatsappBotService } from './whatsapp-bot.service';
import { StorefrontModule } from '../storefront/storefront.module';
import { llmAdapterProvider } from '../orbi/llm/llm-adapter.provider';

@Module({
  imports: [StorefrontModule], // Orbi lee el catálogo y los datos de la tienda con el mismo servicio que la tienda pública
  controllers: [WhatsappController, WhatsappWebhookController],
  // llmAdapterProvider: el mismo modelo (Gemini con respaldo en Groq) que usa Orbi en el panel.
  providers: [WhatsappService, WhatsappMediosService, WhatsappBotService, llmAdapterProvider],
  exports: [WhatsappService, WhatsappBotService], // ConversationsService responde por WhatsApp; la bandeja enciende y apaga Orbi por chat
})
export class WhatsappModule {}
