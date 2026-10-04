import { Body, Controller, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { SoloSuperadmin } from '../../common/decorators/platform-role.decorator';
import { PlatformAdminContext } from '../../common/types/auth-context.type';
import { LecturaConversacionesService } from './lectura-conversaciones.service';
import { AbrirConversacionDto } from './dto/abrir-conversacion.dto';

interface RequestWithAdmin {
  user: PlatformAdminContext;
}

/**
 * Abrir el texto de una conversación de Orbi (spec 2026-10-03 D10). Solo el
 * superadmin, con motivo, y apagado por defecto (ORBI_LECTURA_CONVERSACIONES).
 */
@UseGuards(PlatformAdminGuard)
@SoloSuperadmin()
@Controller('platform/orbi/conversaciones')
export class ConversacionesPlataformaController {
  constructor(private readonly lectura: LecturaConversacionesService) {}

  @Post(':id/abrir')
  @HttpCode(200)
  abrir(@Req() req: RequestWithAdmin, @Param('id') id: string, @Body() dto: AbrirConversacionDto) {
    return this.lectura.abrir(id, req.user.adminId, dto);
  }
}
