import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Query, UnprocessableEntityException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { PrismaService } from '../prisma/prisma.service';
import { StorefrontService } from '../storefront/storefront.service';
import { ReservasCatalogoService } from './reservas-catalogo.service';
import { DisponibilidadService } from './disponibilidad.service';
import { ReservasService } from './reservas.service';
import { esToken } from './dominio/codigos';
import { ModuloQueryDto } from './dto/comunes.dto';
import {
  AnotarseEnEsperaDto, CancelarDto, ConfirmarRetenidaDto, DisponibilidadQueryDto, DisponibilidadRangoQueryDto, ReprogramarDto, ReservarDto, RetenerDto,
} from './dto/reservas.dto';
import { configPublicaDto, recursoDto, reservaDto, servicioDto } from './reservas.types';

// El sitio de un negocio (<slug>.orbita.site): ver qué se puede reservar,
// retener un lugar, confirmarlo, y después ver, cancelar o reprogramar la
// propia reserva con el token del enlace personal. Sin login; con sesión de
// cliente (@OptionalAuth) la reserva queda vinculada a su cuenta.
//
// - Las lecturas y las reservas nuevas piden el sitio abierto (publicado y
//   sin pausar), como el catálogo de Tienda.
// - "Mi reserva" (ver, cancelar, reprogramar) funciona aunque el negocio esté
//   pausado: quien ya reservó tiene que poder manejar lo suyo.
// - El token es el secreto: nada se busca por código ni por teléfono.
@Controller('storefront/:slug/reservas')
export class ReservasPublicoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storefront: StorefrontService,
    private readonly catalogo: ReservasCatalogoService,
    private readonly disponibilidad: DisponibilidadService,
    private readonly reservas: ReservasService,
  ) {}

  /** El negocio del slug, si existe y está publicado y sin pausar. */
  private async negocioAbierto(slug: string): Promise<string> {
    const businessId = await this.storefront.resolveBusinessId(slug);
    const b = await this.prisma.business.findUnique({ where: { id: businessId }, select: { isActive: true, isPaused: true } });
    if (!b?.isActive) throw new NotFoundException('Negocio no encontrado');
    if (b.isPaused) throw new UnprocessableEntityException('Este negocio está pausado temporalmente: no se pueden hacer reservas ahora.');
    return businessId;
  }

  /** El cliente logueado en ESTE negocio, si hay; un token de otra tienda se ignora. */
  private clienteDe(ctx: AuthContext | undefined, businessId: string): string | undefined {
    return ctx?.type === 'customer' && ctx.businessId === businessId && !ctx.readOnly ? ctx.customerId : undefined;
  }

  private token(t: string): string {
    if (!esToken(t)) throw new NotFoundException('Esa reserva no existe.');
    return t;
  }

  // ─── Qué hay ──────────────────────────────────────────────────────────────

  @Get('config')
  @Public()
  async config(@Param('slug') slug: string, @Query() q: ModuloQueryDto) {
    const businessId = await this.negocioAbierto(slug);
    const c = await this.catalogo.configOFalla(businessId, q.modulo);
    if (!c.activo) throw new NotFoundException('Las reservas online están pausadas por el momento.');
    return configPublicaDto(c);
  }

  @Get('recursos')
  @Public()
  async recursos(@Param('slug') slug: string, @Query() q: ModuloQueryDto) {
    const businessId = await this.negocioAbierto(slug);
    await this.catalogo.configOFalla(businessId, q.modulo);
    return (await this.catalogo.recursos(businessId, q.modulo)).map((r) => {
      const { memberId: _m, ...publico } = recursoDto(r);
      return publico;
    });
  }

  @Get('servicios')
  @Public()
  async servicios(@Param('slug') slug: string, @Query() q: ModuloQueryDto) {
    const businessId = await this.negocioAbierto(slug);
    await this.catalogo.configOFalla(businessId, q.modulo);
    return (await this.catalogo.servicios(businessId, q.modulo)).filter((s) => s.reservableOnline).map(servicioDto);
  }

  @Get('disponibilidad')
  @Public()
  async disponibilidadDelDia(@Param('slug') slug: string, @Query() q: DisponibilidadQueryDto) {
    const businessId = await this.negocioAbierto(slug);
    const { salvo: _s, ...resto } = q;
    return this.disponibilidad.delDia(businessId, resto, 'publico');
  }

  @Get('disponibilidad/rango')
  @Public()
  async disponibilidadRango(@Param('slug') slug: string, @Query() q: DisponibilidadRangoQueryDto) {
    const businessId = await this.negocioAbierto(slug);
    return this.disponibilidad.rango(businessId, q, 'publico');
  }

  @Get('disponibilidad/noches')
  @Public()
  async disponibilidadNoches(@Param('slug') slug: string, @Query() q: DisponibilidadRangoQueryDto) {
    const businessId = await this.negocioAbierto(slug);
    return this.disponibilidad.noches(businessId, q);
  }

  // ─── Reservar ─────────────────────────────────────────────────────────────

  /** Paso 1: tomar el lugar. Devuelve la reserva RETENIDA con su token y hasta cuándo vale. */
  @Post('retener')
  @OptionalAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async retener(@Param('slug') slug: string, @CurrentBusiness() ctx: AuthContext | undefined, @Body() dto: RetenerDto) {
    const businessId = await this.negocioAbierto(slug);
    const r = await this.reservas.retener(businessId, dto, dto.clave, dto.notas, this.clienteDe(ctx, businessId));
    return { ...reservaDto(r, { panel: false }), token: r.tokenAcceso };
  }

  /** Paso 2: confirmar la retenida con los datos de la persona. */
  @Post('mi/:token/confirmar')
  @OptionalAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async confirmar(@Param('slug') slug: string, @Param('token') token: string, @CurrentBusiness() ctx: AuthContext | undefined, @Body() dto: ConfirmarRetenidaDto) {
    const businessId = await this.negocioAbierto(slug);
    const r = await this.reservas.confirmarRetenida(businessId, this.token(token), dto.cliente, dto.notas, this.clienteDe(ctx, businessId));
    return { ...reservaDto(r, { panel: false }), token: r.tokenAcceso };
  }

  /** En un paso: reservar con los datos ya cargados (nace confirmada o pendiente según el negocio). */
  @Post('reservar')
  @OptionalAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async reservar(@Param('slug') slug: string, @CurrentBusiness() ctx: AuthContext | undefined, @Body() dto: ReservarDto) {
    const businessId = await this.negocioAbierto(slug);
    const r = await this.reservas.reservar(businessId, dto, dto.clave, dto.cliente, dto.notas, this.clienteDe(ctx, businessId));
    return { ...reservaDto(r, { panel: false }), token: r.tokenAcceso };
  }

  // ─── Mi reserva ───────────────────────────────────────────────────────────

  @Get('mi/:token')
  @Public()
  async miReserva(@Param('slug') slug: string, @Param('token') token: string) {
    const businessId = await this.storefront.resolveBusinessId(slug);
    const r = await this.reservas.porTokenOFalla(businessId, this.token(token));
    const [config, recurso, negocio] = await Promise.all([
      this.catalogo.configOFalla(businessId, r.modulo),
      this.prisma.reservaRecurso.findFirst({ where: { id: r.recursoId, businessId }, select: { id: true, nombre: true, tipo: true } }),
      this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
    ]);
    return {
      reserva: reservaDto(r, { panel: false }),
      politica: this.reservas.politica(r, config, new Date()),
      recurso,
      negocio: { nombre: negocio?.name ?? '' },
    };
  }

  @Post('mi/:token/cancelar')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async cancelar(@Param('slug') slug: string, @Param('token') token: string, @Body() dto: CancelarDto) {
    const businessId = await this.storefront.resolveBusinessId(slug);
    const r = await this.reservas.cancelar(businessId, { token: this.token(token) }, { actor: 'CLIENTE', motivo: dto.motivo, version: dto.version });
    return { ...reservaDto(r.reserva, { panel: false }), sena: r.sena };
  }

  @Post('mi/:token/reprogramar')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async reprogramar(@Param('slug') slug: string, @Param('token') token: string, @Body() dto: ReprogramarDto) {
    const businessId = await this.negocioAbierto(slug);
    const { fueraDeHorario: _f, ...cambio } = dto;
    return reservaDto(await this.reservas.reprogramar(businessId, { token: this.token(token) }, cambio, { actor: 'CLIENTE' }), { panel: false });
  }

  // ─── Lista de espera ──────────────────────────────────────────────────────

  @Post('espera')
  @OptionalAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async anotarse(@Param('slug') slug: string, @CurrentBusiness() ctx: AuthContext | undefined, @Body() dto: AnotarseEnEsperaDto) {
    const businessId = await this.negocioAbierto(slug);
    const e = await this.reservas.anotarseEnEspera(businessId, dto, this.clienteDe(ctx, businessId));
    const { posicion } = await this.reservas.posicionEnEspera(businessId, e.tokenAcceso);
    return { id: e.id, token: e.tokenAcceso, estado: e.estado, posicion, inicio: e.inicio.toISOString(), fin: e.fin.toISOString() };
  }

  @Get('espera/:token')
  @Public()
  async miEspera(@Param('slug') slug: string, @Param('token') token: string) {
    const businessId = await this.storefront.resolveBusinessId(slug);
    const { espera, posicion, reserva } = await this.reservas.posicionEnEspera(businessId, this.token(token));
    return {
      id: espera.id, estado: espera.estado, posicion, inicio: espera.inicio.toISOString(), fin: espera.fin.toISOString(),
      reserva: reserva ? { ...reservaDto(reserva, { panel: false }), token: reserva.tokenAcceso } : null,
    };
  }

  @Delete('espera/:token')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async salir(@Param('slug') slug: string, @Param('token') token: string) {
    const businessId = await this.storefront.resolveBusinessId(slug);
    return this.reservas.salirDeEspera(businessId, { token: this.token(token) });
  }
}
