import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { SuperadminYMarketing } from '../../common/decorators/platform-role.decorator';
import { PlatformAdminContext } from '../../common/types/auth-context.type';
import { GuardarBotDeVentasDto } from './dto/guardar-bot-de-ventas.dto';
import { InstagramVentasService } from './instagram-ventas.service';

interface RequestWithAdmin {
  user: PlatformAdminContext;
}

// Superadmin → Marketing → Instagram → Respuestas automáticas: el bot de ventas de la cuenta de la empresa. Mismo
// permiso que la bandeja (ver instagram-bandeja.controller.ts): son conversaciones con personas de afuera.
@UseGuards(PlatformAdminGuard)
@SuperadminYMarketing()
@Controller('platform/marketing/instagram')
export class InstagramVentasController {
  constructor(private readonly ventas: InstagramVentasService) {}

  @Get('bot')
  estado() {
    return this.ventas.estado();
  }

  @Put('bot')
  guardar(@Req() req: RequestWithAdmin, @Body() dto: GuardarBotDeVentasDto) {
    return this.ventas.guardar(req.user.adminId, dto);
  }

  // Volver a poner el bot en una charla que estaba en manos del equipo.
  @Post('conversations/:id/bot')
  reactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.ventas.reactivar(id);
  }
}
