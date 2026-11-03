import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { SoloSuperadmin } from '../common/decorators/platform-role.decorator';
import { InstagramService } from './instagram.service';

// Pedidos de acceso anticipado a Instagram, en el super panel. Verlos lo puede todo el
// equipo; habilitar o quitar el acceso es solo de SUPERADMIN: abre o cierra el login de
// Instagram de un negocio (y hay que haber sumado antes la cuenta como evaluadora en Meta).
@UseGuards(PlatformAdminGuard)
@Controller('platform/instagram')
export class InstagramAdminController {
  constructor(private readonly instagram: InstagramService) {}

  @Get('acceso')
  pedidos() {
    return this.instagram.pedidosDeAcceso();
  }

  @Post('acceso/:businessId/habilitar')
  @SoloSuperadmin()
  habilitar(@Param('businessId') businessId: string) {
    return this.instagram.cambiarHabilitacion(businessId, true);
  }

  @Post('acceso/:businessId/deshabilitar')
  @SoloSuperadmin()
  deshabilitar(@Param('businessId') businessId: string) {
    return this.instagram.cambiarHabilitacion(businessId, false);
  }
}
