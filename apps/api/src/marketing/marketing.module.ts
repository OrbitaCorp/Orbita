import { Module } from '@nestjs/common';
import { CanalesService } from './canales.service';
import { MarketingController } from './marketing.controller';
import { InstagramBandejaController } from './instagram-bandeja.controller';
import { InstagramBandejaService } from './instagram-bandeja.service';
import { ConversationsModule } from '../conversations/conversations.module';
import { InstagramModule } from '../instagram/instagram.module';

// Pantalla Marketing del super panel. TikTok tiene su propio módulo (marketing/tiktok).
@Module({
  imports: [ConversationsModule, InstagramModule], // contestar y desconectar Instagram con los mismos servicios del panel
  controllers: [MarketingController, InstagramBandejaController],
  providers: [CanalesService, InstagramBandejaService],
})
export class MarketingModule {}
