import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CancellationRequestStatus, RefundApiStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { OrdersService } from '../orders/orders.service';
import { MercadopagoService } from '../mercadopago/mercadopago.service';
import { FindCancellationsQueryDto } from './dto/find-cancellations-query.dto';
import { RejectCancellationDto } from './dto/reject-cancellation.dto';

// Cancelación PEDIDA por el cliente, sobre un pedido que ya no se puede
// autocancelar solo (ver OrdersService.cancelByCustomer — PENDING sigue
// autocancelándose directo, sin pasar por acá: nunca hay plata de Mercado
// Pago ya cobrada de por medio en ese estado).
//
// El circuito completo:
// 1. El cliente pide cancelar un pedido CONFIRMED/PREPARING → nace la
//    solicitud PENDING, avisa en Postventa. El pedido en sí NO cambia de
//    estado todavía — sigue su curso normal hasta que el negocio resuelve.
// 2. El negocio la RECHAZA → el pedido sigue como está, se le explica al
//    cliente por qué.
// 3. El negocio la ACEPTA → ahí sí se cancela de verdad (reingresa stock si
//    corresponde, mismo mecanismo que OrdersService.updateStatus ya usa
//    para cualquier cancelación). Si el pedido se había pagado con Mercado
//    Pago, además se intenta el reembolso real vía la API de MP — con
//    efectivo/transferencia, igual que siempre: el negocio lo devuelve a
//    mano, por fuera de Órbita.
const CANCELABLES_POR_SOLICITUD = ['CONFIRMED', 'PREPARING'] as const;

type OrdenResumida = {
  orderNumber: number;
  customerId: string | null;
  customer: { firstName: string; lastName: string | null; email: string | null } | null;
  onlineOrderDetails: { buyerName: string; buyerEmail: string | null } | null;
};

const INCLUDE_ORDEN = {
  order: {
    select: {
      orderNumber: true,
      customerId: true,
      customer: { select: { firstName: true, lastName: true, email: true } },
      onlineOrderDetails: { select: { buyerName: true, buyerEmail: true } },
    },
  },
} as const;

@Injectable()
export class CancellationsService {
  private readonly logger = new Logger(CancellationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly eventEmitter: EventEmitter2,
    private readonly orders: OrdersService,
    private readonly mercadopago: MercadopagoService,
  ) {}

  private nombreCliente(o: OrdenResumida): string | null {
    if (o.customer) return `${o.customer.firstName}${o.customer.lastName ? ' ' + o.customer.lastName : ''}`;
    return o.onlineOrderDetails?.buyerName ?? null;
  }

  private emailCliente(o: OrdenResumida): string | null {
    return o.customer?.email ?? o.onlineOrderDetails?.buyerEmail ?? null;
  }

  private aSolicitud(r: {
    id: string; orderId: string; reason: string; status: CancellationRequestStatus;
    refundStatus: RefundApiStatus | null; createdAt: Date;
    order: OrdenResumida;
  }) {
    return {
      id: r.id,
      orderId: r.orderId,
      orderNumber: r.order.orderNumber,
      reason: r.reason,
      status: r.status,
      refundStatus: r.refundStatus,
      createdAt: r.createdAt,
      customerName: this.nombreCliente(r.order),
      customerEmail: this.emailCliente(r.order),
    };
  }

  // ── El cliente pide cancelar (storefront) ─────────────────────────────────
  // PENDING sigue siendo autocancelación directa (comportamiento de
  // siempre); CONFIRMED/PREPARING pasan a generar una solicitud que el
  // negocio tiene que resolver. Cualquier otro estado (SHIPPED en adelante,
  // CANCELLED) se rechaza — de ahí en más se resuelve como devolución.
  async requestOrCancel(businessId: string, customerId: string, orderId: string, reason?: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, businessId, customerId, deletedAt: null },
      select: { id: true, status: true, orderNumber: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    if (order.status === 'PENDING') {
      return this.orders.cancelByCustomer(businessId, customerId, orderId, reason);
    }

    if (!CANCELABLES_POR_SOLICITUD.includes(order.status as (typeof CANCELABLES_POR_SOLICITUD)[number])) {
      throw new UnprocessableEntityException(
        order.status === 'CANCELLED'
          ? 'Este pedido ya está cancelado.'
          : `Este pedido ya está "${order.status}" — de ahí en más, cualquier problema se resuelve como devolución.`,
      );
    }
    if (!reason?.trim()) {
      throw new UnprocessableEntityException('Contanos el motivo de la cancelación.');
    }

    // Una sola solicitud sin resolver a la vez por pedido — si ya hay una
    // PENDING, no tiene sentido acumular otra.
    const yaPendiente = await this.prisma.cancellationRequest.findFirst({
      where: { orderId, businessId, status: 'PENDING' },
    });
    if (yaPendiente) {
      throw new UnprocessableEntityException('Ya pediste cancelar este pedido — está esperando que la tienda lo revise.');
    }

    const solicitud = await this.prisma.cancellationRequest.create({
      data: { businessId, orderId, customerId, reason: reason.trim() },
      include: INCLUDE_ORDEN,
    });

    this.eventEmitter.emit('notification.cancelacion_pedida', {
      businessId,
      orderNumber: order.orderNumber,
      cancellationRequestId: solicitud.id,
    });

    // Devuelve el pedido (no la solicitud): mismo contrato que ya usaba
    // meCancelOrder() para el caso PENDING — el frontend no tiene que
    // distinguir la forma de la respuesta según qué pasó.
    return this.orders.findOneForCustomer(businessId, customerId, orderId);
  }

  // ── Lista para Postventa ──────────────────────────────────────────────────
  async findAll(businessId: string, q: FindCancellationsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const filtros = { businessId };
    const where = q.status ? { ...filtros, status: q.status as CancellationRequestStatus } : filtros;

    const [rows, total, porEstado] = await this.prisma.$transaction([
      this.prisma.cancellationRequest.findMany({
        where, orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit, take: limit,
        include: INCLUDE_ORDEN,
      }),
      this.prisma.cancellationRequest.count({ where }),
      this.prisma.cancellationRequest.groupBy({ by: ['status'], where: filtros, orderBy: { status: 'asc' }, _count: true }),
    ]);

    const counts: Record<string, number> = {};
    for (const g of porEstado) counts[g.status] = typeof g._count === 'number' ? g._count : 0;

    return { data: rows.map((r) => this.aSolicitud(r)), total, page, limit, counts };
  }

  // ── Aceptar ────────────────────────────────────────────────────────────────
  // 1. Marca la solicitud APPROVED (condicionado a que siga PENDING — mismo
  //    patrón que aprobar una devolución, evita el doble click/dos pestañas).
  // 2. Cancela el pedido de verdad vía OrdersService.updateStatus(), que ya
  //    hace todo lo demás: valida la transición, reingresa stock si
  //    corresponde, deja el historial y le avisa al cliente por mail.
  // 3. Si el pedido tiene un pago APPROVED por Mercado Pago, intenta el
  //    reembolso real por API. Un reembolso fallido NO deshace la
  //    cancelación (el pedido ya está legítimamente cancelado) — queda
  //    marcado FAILED para que el negocio lo revise a mano.
  async approve(businessId: string, memberId: string, id: string) {
    const solicitud = await this.prisma.cancellationRequest.findFirst({
      where: { id, businessId },
      include: { ...INCLUDE_ORDEN, order: { select: { id: true } } },
    });
    if (!solicitud) throw new NotFoundException('Solicitud de cancelación no encontrada');

    const escrito = await this.prisma.cancellationRequest.updateMany({
      where: { id, businessId, status: 'PENDING' },
      data: { status: 'APPROVED' },
    });
    if (escrito.count === 0) {
      throw new UnprocessableEntityException('Esa solicitud ya fue resuelta por otra persona.');
    }

    await this.orders.updateStatus(businessId, memberId, solicitud.orderId, 'CANCELLED');

    // El pago de Mercado Pago (si lo hay) para intentar el reembolso real.
    const pagoMp = await this.prisma.payment.findFirst({
      where: { orderId: solicitud.orderId, businessId, method: 'MERCADOPAGO', status: 'APPROVED' },
      select: { mpPaymentId: true },
    });

    let refundStatus: RefundApiStatus = 'NONE';
    let mpRefundId: string | null = null;
    if (pagoMp?.mpPaymentId) {
      try {
        const refund = await this.mercadopago.refundPayment(businessId, pagoMp.mpPaymentId);
        refundStatus = 'REFUNDED';
        mpRefundId = refund.id;
      } catch (e) {
        refundStatus = 'FAILED';
        this.logger.warn(`No se pudo reembolsar por API el pago ${pagoMp.mpPaymentId} (pedido ${solicitud.orderId}): ${e}`);
      }
    }

    await this.prisma.cancellationRequest.update({
      where: { id },
      data: { refundStatus, mpRefundId },
    });

    if (refundStatus === 'FAILED') {
      this.logger.warn(`Cancelación ${id} aprobada pero el reembolso de Mercado Pago falló — requiere revisión manual.`);
    }

    const actualizada = await this.prisma.cancellationRequest.findFirstOrThrow({ where: { id }, include: INCLUDE_ORDEN });
    return this.aSolicitud(actualizada);
  }

  // ── Rechazar ───────────────────────────────────────────────────────────────
  async reject(businessId: string, id: string, dto: RejectCancellationDto) {
    const solicitud = await this.prisma.cancellationRequest.findFirst({ where: { id, businessId }, include: INCLUDE_ORDEN });
    if (!solicitud) throw new NotFoundException('Solicitud de cancelación no encontrada');

    const escrito = await this.prisma.cancellationRequest.updateMany({
      where: { id, businessId, status: 'PENDING' },
      data: { status: 'REJECTED', rejectionMessage: dto.rejectionMessage?.trim() || null },
    });
    if (escrito.count === 0) {
      throw new UnprocessableEntityException('Esa solicitud ya fue resuelta por otra persona.');
    }

    const destino = this.emailCliente(solicitud.order);
    if (destino) {
      try {
        const cuerpo = dto.rejectionMessage?.trim()
          || 'Revisamos tu pedido de cancelación y no pudimos aprobarlo. Si tenés dudas, respondé este email y lo vemos.';
        await this.mail.sendCustomEmail(
          destino,
          `Sobre tu pedido de cancelación #${solicitud.order.orderNumber}`,
          cuerpo.replace(/\n/g, '<br/>'),
          { businessId, customerId: solicitud.order.customerId ?? undefined },
        );
      } catch (e) {
        this.logger.warn(`No se pudo avisar el rechazo de la cancelación ${id}: ${e}`);
      }
    }

    const actualizada = await this.prisma.cancellationRequest.findFirstOrThrow({ where: { id }, include: INCLUDE_ORDEN });
    return this.aSolicitud(actualizada);
  }
}
