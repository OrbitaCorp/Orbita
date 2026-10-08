import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { CanalesService } from './canales.service';

// Superadmin → Marketing: el estado de los canales de la empresa. Solo lectura; conectar TikTok vive
// en marketing/tiktok y Instagram y WhatsApp se conectan desde la bandeja de mensajes del negocio.
@UseGuards(PlatformAdminGuard)
@Controller('platform/marketing')
export class MarketingController {
  constructor(private readonly canales: CanalesService) {}

  @Get('channels')
  estadoDeLosCanales() {
    return this.canales.canales();
  }
}
