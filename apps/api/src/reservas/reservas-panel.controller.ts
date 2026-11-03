import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { ReservasCatalogoService } from './reservas-catalogo.service';
import { DisponibilidadService } from './disponibilidad.service';
import { ReservasService } from './reservas.service';
import { CrearBloqueoDto, ListarBloqueosQueryDto, ListarCatalogoQueryDto, UpsertConfigDto, UpsertRecursoDto, UpsertServicioDto } from './dto/catalogo.dto';
import { ModuloQueryDto } from './dto/comunes.dto';
import {
  CambioDeEstadoDto, CancelarDto, CrearReservaPanelDto, DisponibilidadQueryDto, DisponibilidadRangoQueryDto, ListarEsperaQueryDto, ListarReservasQueryDto,
  NotaInternaDto, RegistrarPagoDto, ReprogramarDto, ResumenQueryDto,
} from './dto/reservas.dto';
import { configDto, recursoDto, reservaDto, servicioDto } from './reservas.types';

// El panel de Turnos, Alquileres y Gimnasio. Tres permisos:
// - reservas.view: ver la agenda, las reservas, los recursos y las reglas.
// - reservas.manage: dar, mover, confirmar, cancelar, cobrar.
// - reservas.config: recursos, servicios, reglas y bloqueos.
// businessId sale SIEMPRE del token (assertMemberContext), nunca de la URL.
@Controller('reservas')
export class ReservasPanelController {
  constructor(
    private readonly catalogo: ReservasCatalogoService,
    private readonly disponibilidad: DisponibilidadService,
    private readonly reservas: ReservasService,
  ) {}

  // ─── Reglas ───────────────────────────────────────────────────────────────

  @Get('config')
  @RequirePermission('reservas.view')
  async config(@CurrentBusiness() ctx: AuthContext, @Query() q: ModuloQueryDto) {
    const m = assertMemberContext(ctx);
    const c = await this.catalogo.config(m.businessId, q.modulo);
    return c ? configDto(c) : null;
  }

  @Put('config')
  @RequirePermission('reservas.config')
  async guardarConfig(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertConfigDto) {
    const m = assertMemberContext(ctx);
    return configDto(await this.catalogo.guardarConfig(m.businessId, m.memberId, dto));
  }

  // ─── Recursos y servicios ─────────────────────────────────────────────────

  @Get('recursos')
  @RequirePermission('reservas.view')
  async recursos(@CurrentBusiness() ctx: AuthContext, @Query() q: ListarCatalogoQueryDto) {
    const m = assertMemberContext(ctx);
    return (await this.catalogo.recursos(m.businessId, q.modulo, q.inactivos === 'true')).map(recursoDto);
  }

  @Post('recursos')
  @RequirePermission('reservas.config')
  async crearRecurso(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertRecursoDto) {
    const m = assertMemberContext(ctx);
    return recursoDto(await this.catalogo.crearRecurso(m.businessId, m.memberId, dto));
  }

  @Put('recursos/:id')
  @RequirePermission('reservas.config')
  async editarRecurso(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpsertRecursoDto) {
    const m = assertMemberContext(ctx);
    return recursoDto(await this.catalogo.editarRecurso(m.businessId, m.memberId, id, dto));
  }

  @Delete('recursos/:id')
  @RequirePermission('reservas.config')
  borrarRecurso(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const m = assertMemberContext(ctx);
    return this.catalogo.borrarRecurso(m.businessId, m.memberId, id);
  }

  @Get('servicios')
  @RequirePermission('reservas.view')
  async servicios(@CurrentBusiness() ctx: AuthContext, @Query() q: ListarCatalogoQueryDto) {
    const m = assertMemberContext(ctx);
    return (await this.catalogo.servicios(m.businessId, q.modulo, q.inactivos === 'true')).map(servicioDto);
  }

  @Post('servicios')
  @RequirePermission('reservas.config')
  async crearServicio(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertServicioDto) {
    const m = assertMemberContext(ctx);
    return servicioDto(await this.catalogo.crearServicio(m.businessId, m.memberId, dto));
  }

  @Put('servicios/:id')
  @RequirePermission('reservas.config')
  async editarServicio(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpsertServicioDto) {
    const m = assertMemberContext(ctx);
    return servicioDto(await this.catalogo.editarServicio(m.businessId, m.memberId, id, dto));
  }

  @Delete('servicios/:id')
  @RequirePermission('reservas.config')
  borrarServicio(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const m = assertMemberContext(ctx);
    return this.catalogo.borrarServicio(m.businessId, m.memberId, id);
  }

  // ─── Bloqueos ─────────────────────────────────────────────────────────────

  @Get('bloqueos')
  @RequirePermission('reservas.view')
  bloqueos(@CurrentBusiness() ctx: AuthContext, @Query() q: ListarBloqueosQueryDto) {
    const m = assertMemberContext(ctx);
    return this.catalogo.bloqueos(m.businessId, q.modulo, q.desde, q.hasta);
  }

  @Post('bloqueos')
  @RequirePermission('reservas.config')
  crearBloqueo(@CurrentBusiness() ctx: AuthContext, @Body() dto: CrearBloqueoDto) {
    const m = assertMemberContext(ctx);
    return this.catalogo.crearBloqueo(m.businessId, m.memberId, dto);
  }

  @Delete('bloqueos/:id')
  @RequirePermission('reservas.config')
  borrarBloqueo(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const m = assertMemberContext(ctx);
    return this.catalogo.borrarBloqueo(m.businessId, m.memberId, id);
  }

  // ─── Disponibilidad ───────────────────────────────────────────────────────

  @Get('disponibilidad')
  @RequirePermission('reservas.view')
  disponibilidadDelDia(@CurrentBusiness() ctx: AuthContext, @Query() q: DisponibilidadQueryDto) {
    const m = assertMemberContext(ctx);
    return this.disponibilidad.delDia(m.businessId, q, 'panel');
  }

  @Get('disponibilidad/rango')
  @RequirePermission('reservas.view')
  disponibilidadRango(@CurrentBusiness() ctx: AuthContext, @Query() q: DisponibilidadRangoQueryDto) {
    const m = assertMemberContext(ctx);
    return this.disponibilidad.rango(m.businessId, q, 'panel');
  }

  @Get('disponibilidad/noches')
  @RequirePermission('reservas.view')
  disponibilidadNoches(@CurrentBusiness() ctx: AuthContext, @Query() q: DisponibilidadRangoQueryDto) {
    const m = assertMemberContext(ctx);
    return this.disponibilidad.noches(m.businessId, q);
  }

  // ─── Reservas ─────────────────────────────────────────────────────────────

  @Get('resumen')
  @RequirePermission('reservas.view')
  resumen(@CurrentBusiness() ctx: AuthContext, @Query() q: ResumenQueryDto) {
    const m = assertMemberContext(ctx);
    return this.reservas.resumen(m.businessId, q.modulo, q.desde, q.hasta);
  }

  @Get('espera')
  @RequirePermission('reservas.view')
  espera(@CurrentBusiness() ctx: AuthContext, @Query() q: ListarEsperaQueryDto) {
    const m = assertMemberContext(ctx);
    return this.reservas.listarEspera(m.businessId, q.modulo, q.recursoId, q.fecha);
  }

  @Delete('espera/:id')
  @RequirePermission('reservas.manage')
  quitarDeEspera(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const m = assertMemberContext(ctx);
    return this.reservas.salirDeEspera(m.businessId, { id }, m.memberId);
  }

  @Get()
  @RequirePermission('reservas.view')
  async listar(@CurrentBusiness() ctx: AuthContext, @Query() q: ListarReservasQueryDto) {
    const m = assertMemberContext(ctx);
    const r = await this.reservas.listar(m.businessId, q);
    return { ...r, data: r.data.map((x) => reservaDto(x, { panel: true })) };
  }

  @Get(':id')
  @RequirePermission('reservas.view')
  async detalle(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const m = assertMemberContext(ctx);
    const r = await this.reservas.porIdOFalla(m.businessId, id);
    const historial = await this.reservas.historial(m.businessId, id);
    return { ...reservaDto(r, { panel: true }), historial };
  }

  @Post()
  @RequirePermission('reservas.manage')
  async crear(@CurrentBusiness() ctx: AuthContext, @Body() dto: CrearReservaPanelDto) {
    const m = assertMemberContext(ctx);
    // Un precio a mano es tocar la plata: lo mismo que configurar precios.
    if (dto.precio !== undefined && m.roleName !== 'owner' && !m.permissions.includes('reservas.config')) {
      throw new ForbiddenException('Permiso requerido: reservas.config');
    }
    const r = await this.reservas.crear(m.businessId, dto, {
      estado: dto.estado ?? 'CONFIRMADA', origen: 'PANEL', actor: 'NEGOCIO', memberId: m.memberId,
      cliente: dto.cliente, clienteId: dto.clienteId, clave: dto.clave, notas: dto.notas, notaInterna: dto.notaInterna,
      fueraDeHorario: dto.fueraDeHorario, precioManual: dto.precio,
    });
    return reservaDto(r, { panel: true });
  }

  @Post(':id/confirmar')
  @RequirePermission('reservas.manage')
  async confirmar(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: CambioDeEstadoDto) {
    const m = assertMemberContext(ctx);
    return reservaDto(await this.reservas.transicionPanel(m.businessId, id, m.memberId, 'CONFIRMADA', dto), { panel: true });
  }

  @Post(':id/completar')
  @RequirePermission('reservas.manage')
  async completar(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: CambioDeEstadoDto) {
    const m = assertMemberContext(ctx);
    return reservaDto(await this.reservas.transicionPanel(m.businessId, id, m.memberId, 'COMPLETADA', dto), { panel: true });
  }

  @Post(':id/ausente')
  @RequirePermission('reservas.manage')
  async ausente(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: CambioDeEstadoDto) {
    const m = assertMemberContext(ctx);
    return reservaDto(await this.reservas.transicionPanel(m.businessId, id, m.memberId, 'AUSENTE', dto), { panel: true });
  }

  @Post(':id/cancelar')
  @RequirePermission('reservas.manage')
  async cancelar(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: CancelarDto) {
    const m = assertMemberContext(ctx);
    const r = await this.reservas.cancelar(m.businessId, { id }, { actor: 'NEGOCIO', memberId: m.memberId, motivo: dto.motivo, mantenerSena: dto.mantenerSena, version: dto.version });
    return { ...reservaDto(r.reserva, { panel: true }), sena: r.sena, promovida: r.promovida ? reservaDto(r.promovida, { panel: true }) : null };
  }

  @Post(':id/reprogramar')
  @RequirePermission('reservas.manage')
  async reprogramar(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: ReprogramarDto) {
    const m = assertMemberContext(ctx);
    return reservaDto(await this.reservas.reprogramar(m.businessId, { id }, dto, { actor: 'NEGOCIO', memberId: m.memberId }), { panel: true });
  }

  @Post(':id/pago')
  @RequirePermission('reservas.manage')
  async pago(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: RegistrarPagoDto) {
    const m = assertMemberContext(ctx);
    return reservaDto(await this.reservas.registrarPago(m.businessId, id, m.memberId, dto), { panel: true });
  }

  @Patch(':id/nota')
  @RequirePermission('reservas.manage')
  async nota(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: NotaInternaDto) {
    const m = assertMemberContext(ctx);
    return reservaDto(await this.reservas.nota(m.businessId, id, m.memberId, dto.notaInterna || null), { panel: true });
  }
}
