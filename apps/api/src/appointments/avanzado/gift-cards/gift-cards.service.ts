import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentGiftCardKind, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import { MemberContext } from '../../../common/types/auth-context.type';
import { fechaArgentina } from '../../../common/utils/hora-argentina';
import type { ConfigAvanzado, GiftCardDto, Paginado } from '../../appointments.types';
import { resolverCliente } from '../comun/clientes';
import { COBRO_ONLINE_TURNOS, CobroOnlineTurnos, sitioDe } from '../comun/cobro-online';
import { LARGO_GIFT_CARD, codigoAleatorio, esUnicoRepetido, normalizarCodigo } from '../comun/codigos';
import { AvanzadoContextoService, Db, exigirPermiso } from '../comun/contexto.service';
import { aNumero, aNumeroONull, centavos } from '../comun/dinero';
import { paginacion } from '../comun/paginado';
import { normalizarTelefonoBasico } from '../comun/telefono';
import { enTransaccion } from '../comun/transacciones';
import { BuyGiftCardDto, EmitGiftCardDto, ListGiftCardsQuery } from './dto/gift-cards.dto';

type ConfigGiftCards = NonNullable<ConfigAvanzado['gift-cards']>;
type GiftCardConServicio = Prisma.AppointmentGiftCardGetPayload<{ include: { service: { select: { name: true } } } }>;

export const MONTO_LIBRE_MIN = 1_000;
export const MONTO_LIBRE_MAX = 10_000_000;
const REINTENTOS_CODIGO = 5;

const aDto = (g: GiftCardConServicio): GiftCardDto => ({
  id: g.id, code: g.code, kind: g.kind, amount: aNumeroONull(g.amount), balance: aNumeroONull(g.balance),
  serviceId: g.serviceId, serviceName: g.service?.name ?? null, style: g.style, recipientName: g.recipientName,
  senderName: g.senderName, message: g.message, paid: !!g.paidAt, redeemedAt: g.redeemedAt?.toISOString() ?? null,
  expiresAt: g.expiresAt?.toISOString() ?? null, voided: !!g.voidedAt,
});

/** `expiresAt` = compra + mesesValidez (0 = no vence). */
export function venceA(desde: Date, meses: number): Date | null {
  if (!meses || meses <= 0) return null;
  const d = new Date(desde);
  d.setUTCMonth(d.getUTCMonth() + meses);
  return d;
}

/** ¿Se puede emitir/comprar una gift card por ese monto? null = sí; si no, el motivo. */
export function errorMonto(config: ConfigGiftCards, amount: number): string | null {
  if (config.montos.includes(amount)) return null;
  if (config.montoLibre) {
    return amount >= MONTO_LIBRE_MIN && amount <= MONTO_LIBRE_MAX ? null : `El monto tiene que estar entre $${MONTO_LIBRE_MIN.toLocaleString('es-AR')} y $${MONTO_LIBRE_MAX.toLocaleString('es-AR')}.`;
  }
  return config.montos.length > 0
    ? `Elegí uno de los montos: ${config.montos.map((m) => `$${m.toLocaleString('es-AR')}`).join(', ')}.`
    : 'Este negocio todavía no cargó montos para las gift cards.';
}

export interface CanjeGiftCard {
  giftCardId: string;
  kind: AppointmentGiftCardKind;
  /** Lo que cubre la gift card del turno: `aPagar` baja en esto. Guardarlo para poder devolverlo al cancelar. */
  descontado: number;
  /** AMOUNT: lo que le queda; SERVICE: 0. */
  saldoRestante: number;
}

/**
 * Gift cards (P4.3). El código es la plata: aleatorio (crypto), de 10
 * caracteres del alfabeto de § 1.5 y único por negocio (`@@unique([businessId,
 * code])` + reintento ante P2002).
 *
 * Para la reserva exporta `usarSaldoGiftCard` / `devolverSaldoGiftCard`. El
 * saldo NUNCA queda negativo: se descuenta con `updateMany` condicionado a
 * `balance >= x`, así dos reservas simultáneas no gastan lo mismo (la segunda
 * no encuentra la fila y se vuelve a calcular con el saldo nuevo).
 */
@Injectable()
export class GiftCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: AvanzadoContextoService,
    private readonly audit: AuditService,
    @Inject(COBRO_ONLINE_TURNOS) private readonly cobro: CobroOnlineTurnos,
  ) {}

  // ── Panel ────────────────────────────────────────────────────────────────

  async listar(businessId: string, q: ListGiftCardsQuery): Promise<Paginado<GiftCardDto>> {
    await this.contexto.delNegocio(businessId);
    const { page, limit, skip } = paginacion(q);
    const ahora = new Date();
    const vigente: Prisma.AppointmentGiftCardWhereInput = { paidAt: { not: null }, voidedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: ahora } }] };
    const porEstado: Record<NonNullable<ListGiftCardsQuery['status']>, Prisma.AppointmentGiftCardWhereInput> = {
      active: { AND: [vigente, { OR: [{ kind: 'AMOUNT', balance: { gt: 0 } }, { kind: 'SERVICE', redeemedAt: null }] }] },
      used: { voidedAt: null, OR: [{ kind: 'AMOUNT', balance: { lte: 0 } }, { kind: 'SERVICE', redeemedAt: { not: null } }] },
      expired: { voidedAt: null, expiresAt: { lte: ahora } },
      voided: { voidedAt: { not: null } },
      unpaid: { paidAt: null, voidedAt: null },
    };
    const texto = q.q?.trim();
    const condiciones: Prisma.AppointmentGiftCardWhereInput[] = [];
    if (q.status) condiciones.push(porEstado[q.status]);
    if (texto) {
      condiciones.push({ OR: [
        { code: { contains: normalizarCodigo(texto) } },
        { recipientName: { contains: texto, mode: 'insensitive' } },
        { buyerName: { contains: texto, mode: 'insensitive' } },
      ] });
    }
    const where: Prisma.AppointmentGiftCardWhereInput = { businessId, AND: condiciones };
    const [total, filas] = await Promise.all([
      this.prisma.appointmentGiftCard.count({ where }),
      this.prisma.appointmentGiftCard.findMany({ where, include: { service: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    ]);
    return { data: filas.map(aDto), total, page, limit };
  }

  /** Emitir en el local: nace paga, con su AppointmentPayment GIFT_CARD APPROVED. */
  async emitir(member: MemberContext, dto: EmitGiftCardDto): Promise<GiftCardDto> {
    const { businessId, memberId } = member;
    exigirPermiso(member, 'appointments.cash.charge');
    const negocio = await this.contexto.delNegocio(businessId);
    this.contexto.exigirPrendida(negocio.settings, 'gift-cards');
    const { config } = this.contexto.funcion(negocio.settings, 'gift-cards');
    const { precio, serviceId } = await this.precioDe(businessId, config, dto);
    const ahora = new Date();

    const card = await this.prisma.$transaction(async (tx) => {
      const cliente = dto.customerId ? await resolverCliente(tx, businessId, { customerId: dto.customerId }) : null;
      const g = await this.crearConCodigo(tx, {
        businessId, kind: dto.kind, amount: dto.kind === 'AMOUNT' ? precio : null, balance: dto.kind === 'AMOUNT' ? precio : null,
        serviceId, style: dto.style, recipientName: dto.recipientName ?? null, senderName: dto.senderName ?? null, message: dto.message ?? null,
        customerId: cliente?.id ?? null, buyerName: dto.buyerName ?? cliente?.name ?? null,
        buyerPhone: dto.buyerPhone ? normalizarTelefonoBasico(dto.buyerPhone) : cliente?.phone || null,
        buyerEmail: dto.buyerEmail ?? cliente?.email ?? null, pricePaid: precio, paidAt: ahora, expiresAt: venceA(ahora, config.mesesValidez),
      });
      await tx.appointmentPayment.create({
        data: { businessId, kind: 'GIFT_CARD', giftCardId: g.id, method: dto.method, status: 'APPROVED', amount: precio, paidAt: ahora, registeredByMemberId: memberId },
      });
      return g;
    });
    // El código NO va al registro: es lo que se canjea.
    await this.audit.registrar({
      businessId, memberId, entityType: 'appointment_gift_card', entityId: card.id, action: 'CREATE',
      changes: [{ field: 'kind', before: null, after: card.kind }, { field: 'pricePaid', before: null, after: card.pricePaid }],
    });
    return aDto(card);
  }

  async anular(businessId: string, memberId: string, id: string): Promise<GiftCardDto> {
    await this.contexto.delNegocio(businessId);
    const antes = await this.prisma.appointmentGiftCard.findFirst({ where: { id, businessId } });
    if (!antes) throw new NotFoundException('Esa gift card no existe.');
    if (!antes.voidedAt) {
      const { count } = await this.prisma.appointmentGiftCard.updateMany({ where: { id, businessId, voidedAt: null }, data: { voidedAt: new Date() } });
      if (count > 0) await this.audit.registrar({ businessId, memberId, entityType: 'appointment_gift_card', entityId: id, action: 'DEACTIVATE' });
    }
    const g = await this.prisma.appointmentGiftCard.findFirst({ where: { id, businessId }, include: { service: { select: { name: true } } } });
    return aDto(g!);
  }

  // ── Sitio público ────────────────────────────────────────────────────────

  /** Comprar desde el sitio: la tarjeta nace SIN pagar; `paidAt` lo pone el webhook (AvanzadoPagosService). */
  async comprarPublico(businessId: string, dto: BuyGiftCardDto, customerIdSesion: string | null) {
    const { on, config, negocio } = await this.contexto.activa(businessId, 'gift-cards');
    if (!on || !negocio.isActive || negocio.isPaused) throw new NotFoundException('Este negocio no vende gift cards.');
    const { precio, serviceId, serviceName } = await this.precioDe(businessId, config, dto);
    const paymentId = randomUUID();
    const giftCardId = randomUUID();
    const pref = await this.cobro.crearPreferencia({
      businessId, paymentId, amount: precio,
      title: dto.kind === 'AMOUNT' ? `Gift card $${precio.toLocaleString('es-AR')}` : `Gift card · ${serviceName}`,
      volverA: `${sitioDe(negocio.subdomain)}/gift-card?compra=${giftCardId}`,
    });
    if (!pref) throw new BadRequestException('Este negocio no cobra online. Coordiná el pago con ellos.');

    await this.prisma.$transaction(async (tx) => {
      await this.crearConCodigo(tx, {
        id: giftCardId, businessId, kind: dto.kind, amount: dto.kind === 'AMOUNT' ? precio : null, balance: dto.kind === 'AMOUNT' ? precio : null,
        serviceId, style: dto.style, recipientName: dto.recipientName ?? null, senderName: dto.senderName ?? null, message: dto.message ?? null,
        customerId: customerIdSesion, buyerName: dto.buyerName, buyerPhone: normalizarTelefonoBasico(dto.buyerPhone), buyerEmail: dto.buyerEmail.toLowerCase(),
        pricePaid: precio, paidAt: null, expiresAt: null,
      });
      await tx.appointmentPayment.create({
        data: { id: paymentId, businessId, kind: 'GIFT_CARD', giftCardId, method: 'MERCADOPAGO', status: 'PENDING', amount: precio, mpPreferenceId: pref.preferenceId },
      });
    });
    return { giftCardId, payment: { paymentId, amount: precio, initPoint: pref.initPoint } };
  }

  /** Consultar una gift card por su código (el sitio, antes de canjearla). 404 si no existe, no está paga, está anulada o la función no actúa. */
  async consultarPublico(businessId: string, codigo: string) {
    const { on } = await this.contexto.activa(businessId, 'gift-cards');
    if (!on) throw new NotFoundException('Esa gift card no existe.');
    const g = await this.prisma.appointmentGiftCard.findFirst({
      where: { businessId, code: normalizarCodigo(codigo), paidAt: { not: null }, voidedAt: null },
      include: { service: { select: { name: true } } },
    });
    if (!g) throw new NotFoundException('Esa gift card no existe.');
    return {
      kind: g.kind,
      balance: g.kind === 'AMOUNT' ? aNumero(g.balance) : g.redeemedAt ? 0 : null,
      serviceName: g.service?.name ?? null,
      expiresAt: g.expiresAt?.toISOString() ?? null,
    };
  }

  // ── Para enchufar en la reserva ──────────────────────────────────────────

  /**
   * Canjea una gift card contra un turno (CONTRATO § P4.3). AMOUNT descuenta
   * `min(saldo, aPagar)`; SERVICE exige el mismo servicio, cubre todo y marca
   * `redeemedAt`. Correrlo con el `tx` de la reserva: si el turno no se llega a
   * crear, el descuento se revierte con la transacción. Guardar `giftCardId` y
   * `descontado` (hace falta para devolverlo al cancelar).
   */
  async usarSaldoGiftCard(
    p: { businessId: string; code: string; serviceId: string; aPagar: number },
    tx?: Db,
  ): Promise<CanjeGiftCard> {
    return enTransaccion(this.prisma, tx, async (t) => {
      const { on } = await this.contexto.activa(p.businessId, 'gift-cards', t);
      if (!on) throw new BadRequestException('Este negocio no acepta gift cards ahora.');
      const code = normalizarCodigo(p.code);
      const aPagar = centavos(Math.max(0, p.aPagar));

      for (let intento = 0; intento < 3; intento++) {
        const g = await t.appointmentGiftCard.findFirst({ where: { businessId: p.businessId, code } });
        validarCanjeable(g);
        if (g!.kind === 'SERVICE') {
          if (g!.serviceId !== p.serviceId) throw new BadRequestException('Esa gift card es para otro servicio.');
          const { count } = await t.appointmentGiftCard.updateMany({
            where: { id: g!.id, businessId: p.businessId, kind: 'SERVICE', redeemedAt: null, voidedAt: null },
            data: { redeemedAt: new Date() },
          });
          if (count === 0) throw new ConflictException('Esa gift card ya se usó.');
          return { giftCardId: g!.id, kind: 'SERVICE', descontado: aPagar, saldoRestante: 0 };
        }
        const saldo = aNumero(g!.balance);
        if (saldo <= 0) throw new BadRequestException('Esa gift card no tiene saldo.');
        const x = centavos(Math.min(saldo, aPagar));
        if (x <= 0) return { giftCardId: g!.id, kind: 'AMOUNT', descontado: 0, saldoRestante: saldo };
        const { count } = await t.appointmentGiftCard.updateMany({
          where: { id: g!.id, businessId: p.businessId, kind: 'AMOUNT', voidedAt: null, balance: { gte: x } },
          data: { balance: { decrement: x } },
        });
        if (count > 0) return { giftCardId: g!.id, kind: 'AMOUNT', descontado: x, saldoRestante: centavos(saldo - x) };
        // Otra reserva gastó saldo en el medio: se vuelve a leer y a calcular.
      }
      throw new ConflictException('El saldo de la gift card cambió. Probá de nuevo.');
    });
  }

  /**
   * Cancelación a tiempo (CONTRATO § P4.3): AMOUNT devuelve `monto` al saldo
   * (sin pasarse del valor de emisión); SERVICE vuelve a quedar sin usar.
   */
  async devolverSaldoGiftCard(p: { businessId: string; giftCardId: string; monto: number }, tx?: Db): Promise<{ saldo: number | null }> {
    return enTransaccion(this.prisma, tx, async (t) => {
      for (let intento = 0; intento < 3; intento++) {
        const g = await t.appointmentGiftCard.findFirst({ where: { id: p.giftCardId, businessId: p.businessId } });
        if (!g) throw new NotFoundException('Esa gift card no existe.');
        if (g.kind === 'SERVICE') {
          await t.appointmentGiftCard.updateMany({ where: { id: g.id, businessId: p.businessId }, data: { redeemedAt: null } });
          return { saldo: null };
        }
        const actual = aNumero(g.balance);
        const nuevo = centavos(Math.min(aNumero(g.amount), actual + Math.max(0, p.monto)));
        // Optimista: solo si nadie tocó el saldo desde que se leyó.
        const { count } = await t.appointmentGiftCard.updateMany({ where: { id: g.id, businessId: p.businessId, balance: g.balance }, data: { balance: nuevo } });
        if (count > 0) return { saldo: nuevo };
      }
      throw new ConflictException('El saldo de la gift card cambió. Probá de nuevo.');
    });
  }

  // ── Internos ─────────────────────────────────────────────────────────────

  private async precioDe(businessId: string, config: ConfigGiftCards, dto: { kind: 'AMOUNT' | 'SERVICE'; amount?: number; serviceId?: string }) {
    if (dto.kind === 'AMOUNT') {
      const amount = centavos(dto.amount ?? 0);
      const error = errorMonto(config, amount);
      if (error) throw new BadRequestException(error);
      return { precio: amount, serviceId: null as string | null, serviceName: null as string | null };
    }
    const s = await this.prisma.appointmentService.findFirst({ where: { id: dto.serviceId, businessId, deletedAt: null, isActive: true }, select: { id: true, name: true, price: true } });
    if (!s) throw new BadRequestException('Ese servicio no existe.');
    const precio = aNumero(s.price);
    if (precio <= 0) throw new BadRequestException('Ese servicio no tiene precio: no se puede regalar.');
    return { precio, serviceId: s.id, serviceName: s.name };
  }

  private async crearConCodigo(tx: Prisma.TransactionClient, data: Omit<Prisma.AppointmentGiftCardUncheckedCreateInput, 'code'>): Promise<GiftCardConServicio> {
    for (let i = 0; i < REINTENTOS_CODIGO; i++) {
      // Un SAVEPOINT por intento: un P2002 no aborta la transacción entera.
      await tx.$executeRawUnsafe('SAVEPOINT gift_card_codigo');
      try {
        const g = await tx.appointmentGiftCard.create({ data: { ...data, code: codigoAleatorio(LARGO_GIFT_CARD) }, include: { service: { select: { name: true } } } });
        await tx.$executeRawUnsafe('RELEASE SAVEPOINT gift_card_codigo');
        return g;
      } catch (err) {
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT gift_card_codigo');
        if (!esUnicoRepetido(err)) throw err;
      }
    }
    throw new ConflictException('No se pudo generar el código de la gift card. Probá de nuevo.');
  }
}

function validarCanjeable(g: { paidAt: Date | null; voidedAt: Date | null; expiresAt: Date | null } | null): void {
  if (!g) throw new NotFoundException('Esa gift card no existe.');
  if (g.voidedAt) throw new BadRequestException('Esa gift card fue anulada.');
  if (!g.paidAt) throw new BadRequestException('Esa gift card todavía no está paga.');
  if (g.expiresAt && g.expiresAt.getTime() <= Date.now()) throw new BadRequestException(`Esa gift card venció el ${fechaArgentina(g.expiresAt)}.`);
}
