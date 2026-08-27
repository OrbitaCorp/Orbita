import { randomUUID } from 'crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GameSession } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Fase 2.2 — la parte jugable del storefront. Modelo de confianza, a
// propósito acotado (documentado en el plan/Jira de esta tarea): no hay
// verificación server-side de la física del juego en sí (el cliente reporta
// cuántos aciertos hizo) — lo que SÍ es server-side y no se puede manipular
// es el TECHO (nunca se paga más que Game.maxPercent, pase lo que pase en
// el body) y que cada sesión se pueda terminar y reclamar una sola vez.
// Igual de acotado que cualquier promo de "girá la ruleta" típica: el premio
// máximo está capado (hoy 15% sugerido), no es una superficie de fraude real.
@Injectable()
export class GamesPlayService {
  constructor(private readonly prisma: PrismaService) {}

  // Público (StorefrontGamesController#active) — para que el storefront
  // sepa si mostrar algún aviso de "hay un juego, andá a jugarlo" en el
  // home. Sin esto, un juego activado en el panel era invisible para
  // cualquiera que no conociera la URL exacta de memoria (bug encontrado
  // 2026-08-27, ver Jira).
  // campaignVersion viaja acá para que el storefront pueda distinguir "vio/
  // declinó el modal de ESTA campaña" de una campaña anterior — se
  // incrementa cada vez que el dueño reactiva el juego o le carga una
  // vigencia nueva (ver GamesService#upsert). Sin esto, un visitante que
  // cerró el modal una vez nunca más se enteraría de una futura
  // reactivación/relanzamiento del mismo juego.
  // Fuera de la vigencia (startDate/endDate) el juego se filtra acá igual
  // que si estuviera inactivo — "vence" solo, sin que el dueño tenga que
  // acordarse de apagarlo el día que termina.
  async listActive(businessId: string) {
    const ahora = new Date();
    const games = await this.prisma.game.findMany({
      where: {
        businessId,
        isActive: true,
        OR: [{ startDate: null }, { startDate: { lte: ahora }, endDate: { gte: ahora } }],
      },
      select: { type: true, name: true, campaignVersion: true },
      orderBy: { createdAt: 'asc' },
    });
    return games;
  }

  async startSession(businessId: string, type: string, customerId: string | null) {
    const game = await this.prisma.game.findUnique({ where: { businessId_type: { businessId, type } } });
    if (!game || !game.isActive || !this.dentroDeVigencia(game)) throw new NotFoundException('Este juego no está disponible');
    const session = await this.prisma.gameSession.create({
      data: { gameId: game.id, businessId, customerId },
    });
    return {
      sessionId: session.id,
      gameName: game.name,
      percentPerWin: Number(game.percentPerWin),
      maxPercent: Number(game.maxPercent),
      // Configurado por el dueño (JuegosConfig.tsx) — antes era un
      // TIEMPO_MAX_MS fijo del lado del frontend.
      timeLimitMs: game.timeLimitSeconds * 1000,
      // Cuántos aciertos hacen falta para llegar al techo — el juego del
      // lado del cliente deja de ofrecer tiros nuevos apenas se llega acá.
      maxAttempts: this.maxAttempts(game),
    };
  }

  async finishSession(businessId: string, sessionId: string, hits: number, customerId: string | null) {
    const session = await this.prisma.gameSession.findUnique({ where: { id: sessionId }, include: { game: true } });
    if (!session || session.businessId !== businessId) throw new NotFoundException('Sesión no encontrada');
    if (session.status !== 'PLAYING') throw new BadRequestException('Esta sesión ya terminó');

    const maxAttempts = this.maxAttempts(session.game);
    const hitsValidos = Math.max(0, Math.min(Math.floor(hits) || 0, maxAttempts));
    const percent = Math.min(hitsValidos * Number(session.game.percentPerWin), Number(session.game.maxPercent));
    const gano = percent > 0;

    // Si ya estaba logueado como cliente desde que arrancó la sesión, se
    // respeta ese customerId (no lo pisa uno distinto que venga en el
    // request) — solo se completa si arrancó anónima.
    const customerIdFinal = session.customerId ?? customerId;

    const actualizada = await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        hits: hitsValidos,
        discountPercent: gano ? percent : null,
        status: gano ? 'WON' : 'LOST',
        finishedAt: new Date(),
        customerId: customerIdFinal,
      },
    });

    // Ya logueado → reclama de una, sin pasar por Google. Esto es lo más
    // común (cliente que ya tiene cuenta en esta tienda y entra logueado).
    if (gano && customerIdFinal) {
      const { code } = await this.claimInternal(actualizada, customerIdFinal);
      return { status: 'CLAIMED' as const, discountPercent: percent, code };
    }

    return { status: actualizada.status, discountPercent: gano ? percent : null, code: null };
  }

  async claimSession(businessId: string, sessionId: string, customerId: string) {
    const session = await this.prisma.gameSession.findUnique({ where: { id: sessionId } });
    if (!session || session.businessId !== businessId) throw new NotFoundException('Sesión no encontrada');

    // Idempotente: un doble click en "reclamar" no debe tirar error, solo
    // devolver el mismo código ya emitido — pero SOLO a la cuenta que
    // reclamó, nunca a otra (aunque conozca el sessionId).
    if (session.status === 'CLAIMED') {
      if (session.customerId !== customerId) throw new ForbiddenException('Este premio ya fue reclamado por otra cuenta');
      const discount = await this.prisma.discount.findUniqueOrThrow({ where: { id: session.discountId! } });
      return { code: discount.code!, discountPercent: Number(session.discountPercent) };
    }

    if (session.status !== 'WON') throw new BadRequestException('Esta sesión no tiene ningún premio para reclamar');
    if (session.customerId && session.customerId !== customerId) throw new ForbiddenException('Este premio pertenece a otra cuenta');

    return this.claimInternal(session, customerId);
  }

  private maxAttempts(game: { percentPerWin: unknown; maxPercent: unknown }): number {
    const porAcierto = Number(game.percentPerWin);
    if (porAcierto <= 0) return 0;
    return Math.floor(Number(game.maxPercent) / porAcierto);
  }

  // Sin vigencia cargada (startDate/endDate null) = sin límite de fechas,
  // manda isActive solo. Con vigencia cargada, las dos van juntas (validado
  // en GamesService#upsert) — alcanza con chequear una fecha "ahora" contra
  // el rango.
  private dentroDeVigencia(game: { startDate: Date | null; endDate: Date | null }): boolean {
    if (!game.startDate || !game.endDate) return true;
    const ahora = new Date();
    return ahora >= game.startDate && ahora <= game.endDate;
  }

  // Crea el Discount premio — con `code` + `customerId` (no `code: null`) a
  // propósito: descuentosAutomaticosVigentes() en discounts.service.ts no
  // filtra por customerId, así que un descuento personal SIN código se
  // aplicaría de arriba a cualquier cliente que entre a esa tienda. Con
  // código, resolverCuponElegible() (ya existente) hace gratis la
  // restricción "este cupón es de otra cuenta" — ver Discount.customerId,
  // Fase 1 del paquete Avanzado.
  private async claimInternal(session: GameSession, customerId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: session.gameId } });
    const code = `PREMIO-${randomUUID().slice(0, 8).toUpperCase()}`;
    const discount = await this.prisma.discount.create({
      data: {
        businessId: session.businessId,
        name: `Premio: ${game?.name || 'juego'}`,
        code,
        type: 'PERCENT_TICKET',
        scope: 'TICKET',
        value: session.discountPercent!,
        application: 'MANUAL',
        startDate: new Date(),
        maxUsesTotal: 1,
        isPrivate: true,
        isActive: true,
        customerId,
      },
    });
    await this.prisma.gameSession.update({
      where: { id: session.id },
      data: { discountId: discount.id, status: 'CLAIMED', claimedAt: new Date(), customerId },
    });
    return { code };
  }
}
