import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { SuperadminYMarketing } from '../../common/decorators/platform-role.decorator';
import { PlatformAdminContext } from '../../common/types/auth-context.type';
import { ActualizarProspectoDto, ConsultarCuentasDto, GuardarAnalisisDto } from './dto/prospeccion.dto';
import { ProspeccionService } from './prospeccion.service';

interface RequestWithAdmin {
  user: PlatformAdminContext;
}

// Marketing → Prospección del super panel. Es una herramienta del equipo fundador: consulta cuentas por la API de
// Meta (cuenta de la cuota) y guarda a quién se le escribió, así que es solo para SUPERADMIN.
@UseGuards(PlatformAdminGuard)
@SuperadminYMarketing()
@Controller('platform/marketing/prospeccion')
export class ProspeccionController {
  constructor(private readonly prospeccion: ProspeccionService) {}

  @Get('criterio')
  criterio() {
    return this.prospeccion.criterio();
  }

  @Post('lotes')
  consultar(@Req() req: RequestWithAdmin, @Body() dto: ConsultarCuentasDto) {
    return this.prospeccion.consultar(req.user.adminId, dto.usuarios);
  }

  @Get('lotes')
  lotes() {
    return this.prospeccion.listarLotes();
  }

  @Get('lotes/:id')
  lote(@Param('id') id: string) {
    return this.prospeccion.obtenerLote(id);
  }

  @Post('lotes/:id/analisis')
  guardarAnalisis(@Req() req: RequestWithAdmin, @Param('id') id: string, @Body() dto: GuardarAnalisisDto) {
    return this.prospeccion.guardarAnalisis(req.user.adminId, id, dto.analisis);
  }

  @Get('prospectos')
  prospectos(@Query('estado') estado?: string, @Query('nivel') nivel?: string, @Query('q') q?: string, @Query('limite') limite?: string) {
    return this.prospeccion.listarProspectos({ estado, nivel, q, limite: limite ? Number(limite) : undefined });
  }

  @Patch('prospectos/:id')
  actualizar(@Req() req: RequestWithAdmin, @Param('id') id: string, @Body() dto: ActualizarProspectoDto) {
    return this.prospeccion.actualizarProspecto(req.user.adminId, id, dto);
  }
}
