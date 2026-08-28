import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertGameDto } from './dto/upsert-game.dto';

// Fase 2.1 del paquete "Avanzado" — solo configuración (ver Game en
// schema.prisma). La mecánica jugable/reclamo/creación del Discount premio
// son Fase 2.2, todavía no existen.
@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  async getForBusiness(businessId: string) {
    const games = await this.prisma.game.findMany({ where: { businessId } });
    return games.map((g) => this.toResponse(g));
  }

  async getOne(businessId: string, type: string) {
    const game = await this.prisma.game.findUnique({ where: { businessId_type: { businessId, type } } });
    if (!game) throw new NotFoundException('Este negocio todavía no configuró este juego');
    return this.toResponse(game);
  }

  async upsert(businessId: string, type: string, dto: UpsertGameDto) {
    if (dto.maxPercent < dto.percentPerWin) {
      throw new BadRequestException('El techo máximo no puede ser menor que el % por acierto');
    }
    // Vigencia: o se cargan las dos fechas, o ninguna — no tiene sentido un
    // "desde" sin "hasta" (quedaría abierto para siempre) ni al revés.
    const startDate = dto.startDate ? new Date(dto.startDate) : null;
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (!!startDate !== !!endDate) {
      throw new BadRequestException('Si cargás una fecha de vigencia, tenés que cargar las dos (desde y hasta)');
    }
    if (startDate && endDate && endDate <= startDate) {
      throw new BadRequestException('La fecha "hasta" tiene que ser posterior a la fecha "desde"');
    }

    // "Relanzar" el juego = pasarlo de inactivo a activo, O cargarle una
    // vigencia distinta de la que tenía. Como es la misma fila de siempre
    // (sin concepto de instancia), esto es lo único que el dueño puede
    // hacer para que cuente como una campaña nueva de cara al visitante —
    // ver campaignVersion en schema.prisma. Por eso hace falta leer el
    // estado anterior antes del upsert (el upsert en sí no sabe si venía de
    // inactivo, ni qué vigencia tenía cargada).
    const existente = await this.prisma.game.findUnique({ where: { businessId_type: { businessId, type } } });
    const reactivando = dto.isActive && existente?.isActive === false;
    const distinta = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) !== (b?.getTime() ?? null);
    const vigenciaNueva = !!existente && (distinta(startDate, existente.startDate) || distinta(endDate, existente.endDate));

    const game = await this.prisma.game.upsert({
      where: { businessId_type: { businessId, type } },
      create: {
        businessId,
        type,
        name: dto.name ?? null,
        isActive: dto.isActive,
        percentPerWin: dto.percentPerWin,
        maxPercent: dto.maxPercent,
        startDate,
        endDate,
        ...(dto.timeLimitSeconds != null ? { timeLimitSeconds: dto.timeLimitSeconds } : {}),
      },
      update: {
        name: dto.name ?? null,
        isActive: dto.isActive,
        percentPerWin: dto.percentPerWin,
        maxPercent: dto.maxPercent,
        startDate,
        endDate,
        ...(dto.timeLimitSeconds != null ? { timeLimitSeconds: dto.timeLimitSeconds } : {}),
        ...(reactivando || vigenciaNueva ? { campaignVersion: { increment: 1 } } : {}),
      },
    });
    return this.toResponse(game);
  }

  // Botón dedicado ("mostrar de nuevo a quienes lo cerraron") — pedido
  // explícito del dueño: relanzar no debería depender de un efecto
  // secundario de apagar/prender o de cargar una vigencia nueva, tiene que
  // ser una acción a propósito. Incrementa campaignVersion SOLO (no toca
  // isActive/vigencia/config) — mismo campo que ya usa #upsert, ver
  // schema.prisma. No afecta a quien ya jugó (yaJugado en el frontend no
  // depende de la versión, a propósito: evita que esto sea una forma de
  // farmear más de un descuento) — solo a quien cerró el aviso sin jugar.
  async relanzar(businessId: string, type: string) {
    const existente = await this.prisma.game.findUnique({ where: { businessId_type: { businessId, type } } });
    if (!existente) throw new NotFoundException('Este negocio todavía no configuró este juego');
    const game = await this.prisma.game.update({
      where: { businessId_type: { businessId, type } },
      data: { campaignVersion: { increment: 1 } },
    });
    return this.toResponse(game);
  }

  // Métricas generales — "cuánta gente jugó, cuánta no" (JuegosConfig.tsx,
  // pestaña Reportes). Ojo con lo que NO se puede medir acá: quién vio el
  // modal y lo cerró sin jugar es un estado 100% del navegador del
  // visitante (localStorage), nunca llega al backend — así que "no jugaron"
  // solo puede referirse a sesiones que SÍ arrancaron (GameSession creada)
  // pero nunca se terminaron (quedaron en PLAYING, ej. cerraron el modal a
  // mitad de un tiro) — no a la gente que nunca llegó a arrancar.
  async getMetrics(businessId: string, type: string) {
    const game = await this.prisma.game.findUnique({ where: { businessId_type: { businessId, type } } });
    if (!game) return { totalSesiones: 0, jugaron: 0, abandonaron: 0, ganaron: 0, perdieron: 0, reclamaron: 0 };
    const conteos = await this.prisma.gameSession.groupBy({
      by: ['status'],
      where: { gameId: game.id },
      _count: { _all: true },
    });
    const porEstado = Object.fromEntries(conteos.map((c) => [c.status, c._count._all])) as Record<string, number>;
    const playing = porEstado.PLAYING ?? 0;
    const won = porEstado.WON ?? 0;
    const lost = porEstado.LOST ?? 0;
    const claimed = porEstado.CLAIMED ?? 0;
    return {
      totalSesiones: playing + won + lost + claimed,
      jugaron: won + lost + claimed, // terminaron la sesión (ganaron o perdieron)
      abandonaron: playing, // arrancaron un tiro y nunca lo terminaron
      ganaron: won + claimed,
      perdieron: lost,
      reclamaron: claimed,
    };
  }

  // Ganadores de un juego — para el reporte del panel (JuegosConfig.tsx).
  // WON = ganó pero todavía no reclamó (visitante anónimo que no volvió a
  // loguearse); CLAIMED = ya tiene el Discount real creado. LOST no importa
  // acá — "control de quién ganó", no de quién jugó.
  async getWinners(businessId: string, type: string) {
    const game = await this.prisma.game.findUnique({ where: { businessId_type: { businessId, type } } });
    if (!game) return [];
    const sesiones = await this.prisma.gameSession.findMany({
      where: { gameId: game.id, status: { in: ['WON', 'CLAIMED'] } },
      include: { customer: { select: { firstName: true, lastName: true, email: true } }, discount: { select: { code: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return sesiones.map((s) => ({
      id: s.id,
      fecha: s.createdAt,
      cliente: s.customer ? `${s.customer.firstName}${s.customer.lastName ? ` ${s.customer.lastName}` : ''}` : null,
      email: s.customer?.email ?? null,
      hits: s.hits,
      discountPercent: s.discountPercent != null ? Number(s.discountPercent) : null,
      status: s.status,
      code: s.discount?.code ?? null,
    }));
  }

  // Decimal de Prisma no serializa directo a JSON — mismo criterio que
  // subscriptions.service.ts (amount: Number(sub.amount)).
  private toResponse(game: {
    id: string;
    type: string;
    name: string | null;
    isActive: boolean;
    percentPerWin: unknown;
    maxPercent: unknown;
    timeLimitSeconds: number;
    campaignVersion: number;
    startDate: Date | null;
    endDate: Date | null;
  }) {
    return {
      id: game.id,
      type: game.type,
      name: game.name,
      isActive: game.isActive,
      percentPerWin: Number(game.percentPerWin),
      maxPercent: Number(game.maxPercent),
      timeLimitSeconds: game.timeLimitSeconds,
      campaignVersion: game.campaignVersion,
      startDate: game.startDate ? game.startDate.toISOString() : null,
      endDate: game.endDate ? game.endDate.toISOString() : null,
    };
  }
}
