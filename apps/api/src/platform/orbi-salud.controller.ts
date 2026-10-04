import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { PlatformAdminContext } from '../common/types/auth-context.type';
import { OrbiSaludService } from '../orbi/salud/orbi-salud.service';
import { PlatformAdminLogService } from './platform-admin-log.service';
import { ActivarMantenimientoDto } from './dto/orbi-mantenimiento.dto';

interface RequestWithAdmin {
  user: PlatformAdminContext;
}

/**
 * Estado y mantenimiento de Orbi (IA) para el panel de plataforma. Los dos
 * roles de admin pueden verlo y rehabilitarlo: el mail de aviso les llega a
 * todos, y quien lo recibe tiene que poder actuar.
 *
 * Rehabilitar NO es un interruptor: hace una llamada real al proveedor y solo
 * reabre si contesta. Si no, Orbi sigue en mantenimiento y se devuelve por qué.
 */
@UseGuards(PlatformAdminGuard)
@Controller('platform/orbi')
export class OrbiSaludController {
  constructor(
    private readonly salud: OrbiSaludService,
    private readonly adminLog: PlatformAdminLogService,
  ) {}

  @Get('estado')
  estado() {
    return this.salud.resumen();
  }

  @Post('rehabilitar')
  @HttpCode(200)
  async rehabilitar(@Req() req: RequestWithAdmin) {
    const r = await this.salud.rehabilitar(req.user.adminId);
    await this.adminLog.orbiMantenimiento({
      adminId: req.user.adminId,
      accion: r.ok ? 'rehabilitado' : 'rehabilitacion_rechazada',
      detalle: r.ok ? undefined : `${r.categoria}: ${r.detalle}`,
    });
    return r;
  }

  @Post('mantenimiento')
  @HttpCode(200)
  async mantenimiento(@Req() req: RequestWithAdmin, @Body() dto: ActivarMantenimientoDto) {
    const activado = await this.salud.activarManual(req.user.adminId, dto.motivo);
    if (activado) await this.adminLog.orbiMantenimiento({ adminId: req.user.adminId, accion: 'activado', detalle: dto.motivo });
    // false = ya estaba en mantenimiento: no es un error, solo no cambió nada.
    return { ok: true, yaEstabaEnMantenimiento: !activado };
  }
}
