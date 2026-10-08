import { Module } from '@nestjs/common';
import { CanalesService } from './canales.service';
import { MarketingController } from './marketing.controller';

// Pantalla Marketing del super panel. TikTok tiene su propio módulo (marketing/tiktok).
@Module({
  controllers: [MarketingController],
  providers: [CanalesService],
})
export class MarketingModule {}
