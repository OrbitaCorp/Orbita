import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappMediosService } from './whatsapp-medios.service';
import { WhatsappService } from './whatsapp.service';
import { WhatsappBotService } from './whatsapp-bot.service';
import { StorefrontModule } from '../storefront/storefront.module';
import { llmAdapterDelBotProvider } from '../orbi/llm/llm-adapter.provider';

@Module({
  imports: [StorefrontModule], // Orbi lee el catálogo y los datos de la tienda con el mismo servicio que la tienda pública
  controllers: [WhatsappController, WhatsappWebhookController],
  // llmAdapterDelBotProvider: Groq → Workers AI (Cloudflare) → Gemini, del más barato al más caro.
  providers: [WhatsappService, WhatsappMediosService, WhatsappBotService, llmAdapterDelBotProvider],
  exports: [WhatsappService, WhatsappBotService], // ConversationsService responde por WhatsApp; la bandeja enciende y apaga Orbi por chat
})
export class WhatsappModule {}
