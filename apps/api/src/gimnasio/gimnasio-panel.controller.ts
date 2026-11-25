import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { reservaDto } from '../reservas/reservas.types';
import { GimnasioService } from './gimnasio.service';
import { AltaAlumnoDto, AsignarPlanDto, CambiarAlumnoDto, DefinirPagoDto, GuardarPlanesDto, ReservarConPlanDto } from './dto/gimnasio.dto';
import { planDto } from './gimnasio.types';

// El panel de Gimnasio: lo que no es una reserva. Usa los tres permisos de
// reservas (no suma otros):
// - reservas.view: ver los planes y los alumnos.
// - reservas.manage: dar de alta a un alumno, asignarle o renovarle un plan,
//   anotarlo en una clase diciendo cómo se paga.
// - reservas.config: los planes y sus precios.
// businessId sale SIEMPRE del token (assertMemberContext), nunca de la URL.
const ID = new ParseUUIDPipe({ version: '4' });

@Controller('gimnasio')
export class GimnasioPanelController {
  constructor(private readonly gimnasio: GimnasioService) {}

  // ─── Planes ───────────────────────────────────────────────────────────────

  @Get('planes')
  @RequirePermission('reservas.view')
  async planes(@CurrentBusiness() ctx: AuthContext) {
    const m = assertMemberContext(ctx);
    return (await this.gimnasio.planes(m.businessId)).map(planDto);
  }

  /** La lista entera, como queda: lo que no viene se quita. Todo o nada. */
  @Put('planes')
  @RequirePermission('reservas.config')
  async guardarPlanes(@CurrentBusiness() ctx: AuthContext, @Body() dto: GuardarPlanesDto) {
    const m = assertMemberContext(ctx);
    return (await this.gimnasio.guardarPlanes(m.businessId, m.memberId, dto)).map(planDto);
  }

  // ─── Alumnos ──────────────────────────────────────────────────────────────

  @Get('alumnos')
  @RequirePermission('reservas.view')
  alumnos(@CurrentBusiness() ctx: AuthContext) {
    const m = assertMemberContext(ctx);
    return this.gimnasio.alumnos(m.businessId);
  }

  /** Da de alta a un alumno (si ya lo era, devuelve el mismo). Con `planId`, arranca con ese plan. */
  @Post('alumnos')
  @RequirePermission('reservas.manage')
  alta(@CurrentBusiness() ctx: AuthContext, @Body() dto: AltaAlumnoDto) {
    const m = assertMemberContext(ctx);
    return this.gimnasio.alta(m.businessId, m.memberId, dto);
  }

  @Patch('alumnos/:id')
  @RequirePermission('reservas.manage')
  cambiarAlumno(@CurrentBusiness() ctx: AuthContext, @Param('id', ID) id: string, @Body() dto: CambiarAlumnoDto) {
    const m = assertMemberContext(ctx);
    return this.gimnasio.cambiarAlumno(m.businessId, m.memberId, id, dto);
  }

  /** Le asigna o le renueva un plan. Renovar la misma membresía antes de que venza la continúa: no pierde días. */
  @Post('alumnos/:id/plan')
  @RequirePermission('reservas.manage')
  asignarPlan(@CurrentBusiness() ctx: AuthContext, @Param('id', ID) id: string, @Body() dto: AsignarPlanDto) {
    const m = assertMemberContext(ctx);
    return this.gimnasio.asignarPlan(m.businessId, m.memberId, id, dto.planId);
  }

  /** Quita un plan asignado por error. Los lugares que ya se pagaron con él siguen reservados. */
  @Delete('alumnos/:id/planes/:suscripcionId')
  @RequirePermission('reservas.manage')
  quitarPlan(@CurrentBusiness() ctx: AuthContext, @Param('id', ID) id: string, @Param('suscripcionId', ID) suscripcionId: string) {
    const m = assertMemberContext(ctx);
    return this.gimnasio.quitarPlan(m.businessId, m.memberId, id, suscripcionId);
  }

  // ─── Anotar con plan ──────────────────────────────────────────────────────

  /** Anota a alguien en una clase diciendo cómo se paga: con su plan, aparte o con la clase de prueba. */
  @Post('reservas')
  @RequirePermission('reservas.manage')
  async reservar(@CurrentBusiness() ctx: AuthContext, @Body() dto: ReservarConPlanDto) {
    const m = assertMemberContext(ctx);
    const { reserva, pago } = await this.gimnasio.reservar(m.businessId, m.memberId, dto);
    return { reserva: reservaDto(reserva, { panel: true }), pago };
  }

  /** Dice (o corrige) cómo se paga un lugar ya reservado: el de quien pasó de la espera o reservó desde el sitio. */
  @Post('reservas/:id/pago')
  @RequirePermission('reservas.manage')
  async definirPago(@CurrentBusiness() ctx: AuthContext, @Param('id', ID) id: string, @Body() dto: DefinirPagoDto) {
    const m = assertMemberContext(ctx);
    const { reserva, pago } = await this.gimnasio.definirPago(m.businessId, m.memberId, id, dto);
    return { reserva: reservaDto(reserva, { panel: true }), pago };
  }
}
