import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { SoloSuperadmin } from '../../common/decorators/platform-role.decorator';
import { PlatformAdminContext } from '../../common/types/auth-context.type';
import { SeguimientoService } from './seguimiento.service';
import { BorradorSeguimientoDto, EnviarSeguimientoDto, VistaPreviaSeguimientoDto } from './seguimiento.dto';

interface RequestWithAdmin {
  user: PlatformAdminContext;
}

// Superadmin → Seguimiento. Mirar (lista, plantillas, borrador, vista previa)
// lo puede el equipo (SUPERADMIN y OPERATOR; marketing no, son datos de los
// clientes). Escribirle al dueño de una tienda en nombre de Órbita es solo de
// SUPERADMIN.
@UseGuards(PlatformAdminGuard)
@Controller('platform/seguimiento')
export class SeguimientoController {
  constructor(private readonly seguimiento: SeguimientoService) {}

  @Get()
  listar() {
    return this.seguimiento.listar();
  }

  @Get('plantillas')
  plantillas() {
    return this.seguimiento.plantillas();
  }

  @Post('borrador')
  borrador(@Body() dto: BorradorSeguimientoDto) {
    return this.seguimiento.borrador(dto);
  }

  @Post('vista-previa')
  vistaPrevia(@Body() dto: VistaPreviaSeguimientoDto) {
    return this.seguimiento.vistaPrevia(dto);
  }

  @Post('enviar')
  @SoloSuperadmin()
  enviar(@Req() req: RequestWithAdmin, @Body() dto: EnviarSeguimientoDto) {
    return this.seguimiento.enviar(req.user.adminId, dto);
  }
}
