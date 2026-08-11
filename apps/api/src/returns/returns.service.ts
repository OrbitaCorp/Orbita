import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreditNoteStatus, CreditNoteType, OrderStatus, Prisma, RefundMethod, ReturnStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnDto } from './dto/update-return.dto';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { FindReturnsQueryDto } from './dto/find-returns-query.dto';
import { FindCreditNotesQueryDto } from './dto/find-credit-notes-query.dto';

// (Fase 3 — Ale) Devoluciones y notas de crédito, el circuito completo:
//
// 1. La devolución nace (desde el panel con el wizard, o más adelante desde el
//    storefront) apuntando a un pedido y, si se eligió, a un renglón puntual.
// 2. Al APROBARLA pasan los efectos de verdad, todo en una transacción:
//    - el stock reingresa al inventario (con su movimiento de entrada),
//    - si el método es nota de crédito, la nota se emite sola, vinculada 1:1
//      a la devolución (returnId es único: no puede haber dos).
//    - y se le avisa al cliente por email (fuera de la transacción: un mail
//      caído no puede voltear una aprobación).
// 3. La nota de crédito queda EMITIDA con vencimiento, y se marca APLICADA
//    cuando el cliente la usa como pago.
//
// APPROVED y REJECTED son estados finales: no hay vuelta atrás (si se
// aprobó de más, el camino es un ajuste manual de stock, no "desaprobar").

// Política inicial de vencimiento de las notas: 6 meses desde la emisión.
const MESES_VIGENCIA_NOTA = 6;

// Regla de producto: solo se devuelve lo que el cliente YA TIENE — pedidos
// entregados (o completados, las ventas de caja). Antes se aceptaba desde
// CONFIRMED, pero eso habilitaba un inventario inflado: devolución aprobada
// sobre un pedido confirmado + cancelación posterior = el stock reingresaba
// dos veces (una por la devolución, otra por la cancelación).
const DEVOLVIBLES: OrderStatus[] = ['DELIVERED', 'COMPLETED'];

// Lo que ve el cliente en el email según el método elegido.
const NOMBRE_METODO: Record<RefundMethod, string> = {
  CREDIT_NOTE: 'Nota de crédito (saldo a favor)',
  REFUND: 'Reembolso',
};

type OrdenResumida = {
  orderNumber: number;
  customerId: string | null;
  customer: { firstName: string; lastName: string | null; email: string | null } | null;
  onlineOrderDetails: { buyerName: string; buyerEmail: string | null } | null;
  items: { id: string; productName: string; variantLabel: string | null; quantity: number; isConcept: boolean; variantId: string }[];
};

const INCLUDE_ORDEN = {
  order: {
    select: {
      orderNumber: true,
      branchId: true,
      customerId: true,
      business: { select: { name: true } },
      customer: { select: { firstName: true, lastName: true, email: true } },
      onlineOrderDetails: { select: { buyerName: true, buyerEmail: true } },
      items: { select: { id: true, productName: true, variantLabel: true, quantity: true, isConcept: true, variantId: true } },
    },
  },
} as const;

@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private nombreCliente(o: OrdenResumida): string | null {
    if (o.customer) return `${o.customer.firstName}${o.customer.lastName ? ' ' + o.customer.lastName : ''}`;
    return o.onlineOrderDetails?.buyerName ?? null;
  }

  private emailCliente(o: OrdenResumida): string | null {
    return o.customer?.email ?? o.onlineOrderDetails?.buyerEmail ?? null;
  }

  // El formato que promete el contrato, más el nombre del cliente y del
  // producto para que la pantalla no tenga que salir a buscarlos (corrección
  // Fase 3 del contrato, igual que los emails del perfil).
  private aReturn(r: {
    id: string; orderId: string; orderItemId: string | null; quantity: number;
    amount: Prisma.Decimal; reason: string; status: ReturnStatus;
    refundMethod: RefundMethod; createdAt: Date;
    order: OrdenResumida;
  }) {
    const item = r.orderItemId ? r.order.items.find((i) => i.id === r.orderItemId) : null;
    return {
      id: r.id,
      orderId: r.orderId,
      orderNumber: r.order.orderNumber,
      orderItemId: r.orderItemId,
      quantity: r.quantity,
      amount: Number(r.amount),
      reason: r.reason,
      status: r.status,
      refundMethod: r.refundMethod,
      createdAt: r.createdAt,
      customerName: this.nombreCliente(r.order),
      customerEmail: this.emailCliente(r.order),
      productName: item ? `${item.productName}${item.variantLabel ? ' · ' + item.variantLabel : ''}` : null,
    };
  }

  // ── Lista con filtros y contadores ────────────────────────────────────────
  async findAll(businessId: string, q: FindReturnsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;

    const filtros: Prisma.ReturnWhereInput = { businessId };
    const where: Prisma.ReturnWhereInput = q.status ? { ...filtros, status: q.status as ReturnStatus } : filtros;

    const [rows, total, porEstado] = await this.prisma.$transaction([
      this.prisma.return.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: INCLUDE_ORDEN,
      }),
      this.prisma.return.count({ where }),
      this.prisma.return.groupBy({ by: ['status'], where: filtros, orderBy: { status: 'asc' }, _count: true }),
    ]);

    const counts: Record<string, number> = {};
    for (const g of porEstado) counts[g.status] = typeof g._count === 'number' ? g._count : 0;

    return { data: rows.map((r) => this.aReturn(r)), total, page, limit, counts };
  }

  // ── Alta (wizard del panel) ───────────────────────────────────────────────
  // Nace PENDIENTE; el wizard del panel la aprueba al toque con el PATCH (así
  // los efectos de la aprobación viven en un solo lugar).
  //
  // Las validaciones miran el ACUMULADO de devoluciones previas del mismo
  // renglón, no solo esta: si no, se podía devolver el mismo producto una y
  // otra vez y el stock terminaba con más unidades de las que salieron.
  async create(businessId: string, dto: CreateReturnDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, businessId, deletedAt: null },
      include: {
        items: {
          select: {
            id: true, productName: true, quantity: true,
            unitPrice: true, editedPrice: true, discountAmount: true, isConcept: true,
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    // Solo se devuelve lo que efectivamente salió del inventario. Un pedido
    // pendiente nunca descontó stock, y uno cancelado ya lo devolvió al
    // cancelarse — reingresar de nuevo inventaría unidades fantasma.
    if (!DEVOLVIBLES.includes(order.status)) {
      throw new UnprocessableEntityException(
        `Solo se pueden devolver pedidos entregados o completados — este está en estado ${order.status}.`,
      );
    }

    // Sin renglón no se sabe qué variante reingresar: el stock quedaría sin
    // actualizar en silencio. El wizard siempre manda el renglón.
    if (!dto.orderItemId) {
      throw new UnprocessableEntityException('Hay que indicar qué producto del pedido se devuelve.');
    }
    const item = order.items.find((i) => i.id === dto.orderItemId);
    if (!item) throw new UnprocessableEntityException('Ese producto no pertenece al pedido.');

    // El tope del monto es lo que se pagó por ESE renglón (precio editado si
    // lo hubo, menos su descuento), no el total del pedido: si no, se podía
    // emitir una nota por $49.000 devolviendo un producto de $1.000.
    const pagadoPorUnidad = Number(item.editedPrice ?? item.unitPrice);
    const descuentoPorUnidad = item.quantity > 0 ? Number(item.discountAmount) / item.quantity : 0;
    const maximo = Math.round(dto.quantity * (pagadoPorUnidad - descuentoPorUnidad) * 100) / 100;
    if (dto.amount > maximo + 0.01) {
      throw new UnprocessableEntityException(
        `El monto supera lo que se pagó por ese producto (máximo $${maximo}).`,
      );
    }

    // El tope "no devolver más unidades de las que lleva el renglón" se valida
    // Y se inserta dentro de una misma transacción Serializable: sin esto, dos
    // altas concurrentes (doble click en el wizard) leían ambas yaDevueltas=0 e
    // insertaban las dos → se reingresaba stock y se emitían notas por el doble.
    const r = await this.prisma.$transaction(
      async (tx) => {
        const previas = await tx.return.aggregate({
          where: { businessId, orderId: dto.orderId, orderItemId: dto.orderItemId, status: { not: 'REJECTED' } },
          _sum: { quantity: true },
        });
        const yaDevueltas = previas._sum.quantity ?? 0;
        if (yaDevueltas + dto.quantity > item.quantity) {
          throw new UnprocessableEntityException(
            yaDevueltas > 0
              ? `De "${item.productName}" ya se devolvieron ${yaDevueltas} de ${item.quantity}: no quedan ${dto.quantity} para devolver.`
              : `No se pueden devolver ${dto.quantity} de "${item.productName}": el pedido lleva ${item.quantity}.`,
          );
        }
        return tx.return.create({
          data: {
            businessId,
            orderId: dto.orderId,
            orderItemId: dto.orderItemId ?? null,
            quantity: dto.quantity,
            amount: dto.amount,
            reason: dto.reason,
            refundMethod: dto.refundMethod as RefundMethod,
          },
          include: INCLUDE_ORDEN,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.aReturn(r);
  }

  // ── Alta desde el storefront (el cliente pide su propia devolución) ──────
  // No confía en ningún monto que mande el cliente: lo calcula acá adentro
  // (cantidad × precio unitario del renglón) y deja que create() haga el
  // resto de las validaciones (estado del pedido, acumulado ya devuelto,
  // tope de monto) como si viniera del panel. Siempre nota de crédito — el
  // cliente no puede pedir un reembolso a su medio de pago original desde
  // acá, eso lo decide la tienda a mano si corresponde.
  async createForCustomer(
    businessId: string,
    customerId: string,
    dto: { orderId: string; orderItemId: string; quantity: number; reason: string },
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, businessId, customerId, deletedAt: null },
      select: { items: { where: { id: dto.orderItemId }, select: { unitPrice: true } } },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    const item = order.items[0];
    if (!item) throw new UnprocessableEntityException('Ese producto no pertenece al pedido.');

    const amount = Math.round(dto.quantity * Number(item.unitPrice) * 100) / 100;
    return this.create(businessId, {
      orderId: dto.orderId,
      orderItemId: dto.orderItemId,
      quantity: dto.quantity,
      amount,
      reason: dto.reason,
      refundMethod: 'CREDIT_NOTE',
    });
  }

  // ── Aprobar / rechazar (y sus efectos) ────────────────────────────────────
  async update(businessId: string, memberId: string, id: string, dto: UpdateReturnDto) {
    const r = await this.prisma.return.findFirst({
      where: { id, businessId },
      include: { ...INCLUDE_ORDEN, creditNote: { select: { id: true } } },
    });
    if (!r) throw new NotFoundException('Devolución no encontrada');

    // APROBADA y RECHAZADA son finales: ni el estado ni el método se tocan
    // después (cambiar el método a posteriori dejaba el registro diciendo
    // "nota de crédito" sin que se hubiera emitido ninguna).
    if ((dto.status || dto.refundMethod) && (r.status === 'APPROVED' || r.status === 'REJECTED')) {
      throw new UnprocessableEntityException(
        `La devolución ya está ${r.status === 'APPROVED' ? 'aprobada' : 'rechazada'} y no se puede cambiar.`,
      );
    }

    const nuevoEstado = dto.status as ReturnStatus | undefined;
    const metodo = (dto.refundMethod as RefundMethod | undefined) ?? r.refundMethod;
    const aprueba = nuevoEstado === 'APPROVED';
    const rechaza = nuevoEstado === 'REJECTED';

    await this.prisma.$transaction(async (tx) => {
      // El cambio de estado se escribe CONDICIONADO al estado previo: si dos
      // personas aprueban la misma devolución a la vez (dos pestañas, un
      // reintento por timeout), la segunda no encuentra fila para actualizar
      // y corta acá — sin duplicar el reingreso de stock ni la nota.
      if (nuevoEstado) {
        const escrito = await tx.return.updateMany({
          where: { id, businessId, status: { in: ['PENDING', 'IN_PROCESS'] } },
          data: { status: nuevoEstado, ...(dto.refundMethod ? { refundMethod: metodo } : {}) },
        });
        if (escrito.count === 0) {
          throw new UnprocessableEntityException('La devolución ya fue resuelta por otra persona.');
        }
      } else if (dto.refundMethod) {
        // Cambiar solo el método también va condicionado a que la devolución
        // siga sin resolver: si otra pestaña la aprobó (emitiendo la nota)
        // entre que se cargó esta y este PATCH, no se pisa el método (evita
        // una devolución APPROVED con método REFUND y una nota ya emitida).
        const escrito = await tx.return.updateMany({
          where: { id, businessId, status: { in: ['PENDING', 'IN_PROCESS'] } },
          data: { refundMethod: metodo },
        });
        if (escrito.count === 0) {
          throw new UnprocessableEntityException('La devolución ya fue resuelta y no se puede cambiar el método.');
        }
      }

      if (aprueba) {
        // 1. El stock reingresa (solo si la devolución apunta a un renglón con
        //    producto real: sin renglón no sabemos qué variante devolver).
        const item = r.orderItemId ? r.order.items.find((i) => i.id === r.orderItemId) : null;
        if (item && !item.isConcept) {
          await tx.variantStock.upsert({
            where: { variantId_branchId: { variantId: item.variantId, branchId: r.order.branchId } },
            update: { quantity: { increment: r.quantity } },
            create: { variantId: item.variantId, branchId: r.order.branchId, quantity: r.quantity },
          });
          await tx.stockMovement.create({
            data: {
              businessId,
              branchId: r.order.branchId,
              variantId: item.variantId,
              type: 'ENTRADA',
              quantity: r.quantity,
              reason: `Devolución #${r.order.orderNumber}`,
              orderId: r.orderId,
              createdBy: memberId,
            },
          });
        }

        // 2. Si la resolución es nota de crédito, se emite sola y queda
        //    vinculada (returnId único: si ya existe, no se duplica).
        if (metodo === 'CREDIT_NOTE' && !r.creditNote) {
          const vence = new Date();
          vence.setMonth(vence.getMonth() + MESES_VIGENCIA_NOTA);
          try {
            await tx.creditNote.create({
              data: {
                businessId,
                orderId: r.orderId,
                returnId: r.id,
                customerId: r.order.customerId,
                amount: r.amount,
                type: 'BALANCE',
                expiresAt: vence,
              },
            });
          } catch (e) {
            // returnId es @unique: si otra ejecución ya emitió la nota de esta
            // devolución, no es un 500 — es que ya estaba hecha.
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
              throw new ConflictException('Esa devolución ya tiene una nota de crédito emitida.');
            }
            throw e;
          }
        }
      }
    });

    // El aviso al cliente va después de la transacción: si el mail falla, la
    // aprobación/rechazo ya quedó firme y solo se pierde el aviso (logueado).
    const destino = this.emailCliente(r.order);
    if (destino && aprueba) {
      try {
        await this.mail.sendReturnApproved(destino, {
          storeName: r.order.business.name,
          orderNumber: r.order.orderNumber,
          refundMethod: NOMBRE_METODO[metodo],
          amount: Number(r.amount),
        }, { businessId, customerId: r.order.customerId ?? undefined });
      } catch (e) {
        this.logger.warn(`No se pudo avisar la aprobación de la devolución ${r.id}: ${e}`);
      }
    }
    if (destino && rechaza) {
      try {
        const cuerpo = dto.rejectionMessage?.trim()
          || 'Revisamos tu solicitud de devolución y no pudimos aprobarla porque no cumple con nuestras políticas. Si tenés dudas, respondé este email y lo vemos.';
        await this.mail.sendCustomEmail(
          destino,
          `Sobre tu devolución del pedido #${r.order.orderNumber}`,
          cuerpo.replace(/\n/g, '<br/>'),
          { businessId, customerId: r.order.customerId ?? undefined },
        );
      } catch (e) {
        this.logger.warn(`No se pudo avisar el rechazo de la devolución ${r.id}: ${e}`);
      }
    }

    const actualizado = await this.prisma.return.findFirst({ where: { id }, include: INCLUDE_ORDEN });
    return this.aReturn(actualizado!);
  }

  // ── Notas de crédito ──────────────────────────────────────────────────────

  private aNota(n: {
    id: string; orderId: string; returnId: string | null; customerId: string | null;
    amount: Prisma.Decimal; type: string; status: CreditNoteStatus;
    expiresAt: Date | null; createdAt: Date;
    order: OrdenResumida;
  }) {
    return {
      id: n.id,
      orderId: n.orderId,
      orderNumber: n.order.orderNumber,
      returnId: n.returnId,
      customerId: n.customerId,
      customerName: this.nombreCliente(n.order),
      customerEmail: this.emailCliente(n.order),
      amount: Number(n.amount),
      type: n.type,
      status: n.status,
      expiresAt: n.expiresAt,
      createdAt: n.createdAt,
    };
  }

  // Lista + los números de la cabecera: total emitido, notas activas (emitidas
  // y sin vencer) y las que vencen dentro de los próximos 7 días.
  async findAllCreditNotes(businessId: string, q: FindCreditNotesQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const ahora = new Date();
    const enSieteDias = new Date(ahora.getTime() + 7 * 86400000);

    const where: Prisma.CreditNoteWhereInput = q.status
      ? { businessId, status: q.status as CreditNoteStatus }
      : { businessId };

    const [rows, total, emitido, activas, porVencer, aplicadas] = await this.prisma.$transaction([
      this.prisma.creditNote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: INCLUDE_ORDEN,
      }),
      this.prisma.creditNote.count({ where }),
      this.prisma.creditNote.aggregate({ where: { businessId }, _sum: { amount: true } }),
      this.prisma.creditNote.count({
        where: { businessId, status: 'ISSUED', OR: [{ expiresAt: null }, { expiresAt: { gt: ahora } }] },
      }),
      this.prisma.creditNote.count({
        where: { businessId, status: 'ISSUED', expiresAt: { gt: ahora, lte: enSieteDias } },
      }),
      this.prisma.creditNote.count({ where: { businessId, status: 'APPLIED' } }),
    ]);

    return {
      data: rows.map((n) => this.aNota(n)),
      total,
      page,
      limit,
      metrics: {
        totalEmitido: emitido._sum.amount != null ? Number(emitido._sum.amount) : 0,
        activas,
        porVencer,
        aplicadas,
      },
    };
  }

  // Emisión manual (la automática sale sola al aprobar una devolución).
  async createCreditNote(businessId: string, dto: CreateCreditNoteDto) {
    const order = await this.prisma.order.findFirst({ where: { id: dto.orderId, businessId, deletedAt: null } });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    // La devolución tiene que ser DE ESE pedido: si no, se podía emitir una
    // nota del pedido A colgada de una devolución del pedido B — y esa
    // devolución quedaba con su returnId ocupado, así que al aprobarse de
    // verdad ya no se le emitía la suya.
    if (dto.returnId) {
      const devolucion = await this.prisma.return.findFirst({
        where: { id: dto.returnId, businessId, orderId: dto.orderId },
      });
      if (!devolucion) throw new NotFoundException('Esa devolución no existe o no es de este pedido.');
      // No colgar una nota de una devolución rechazada: quedaría una nota
      // vigente sobre algo que se rechazó, y su returnId (único) consumido.
      if (devolucion.status === 'REJECTED') {
        throw new UnprocessableEntityException('Esa devolución está rechazada: no se le puede emitir una nota.');
      }
    }
    // El cliente también tiene que ser del negocio (la FK sola no lo valida).
    if (dto.customerId) {
      const cliente = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, businessId, deletedAt: null },
      });
      if (!cliente) throw new NotFoundException('Cliente no encontrado');
    }

    const vence = new Date();
    vence.setMonth(vence.getMonth() + MESES_VIGENCIA_NOTA);
    try {
      // El tope "total emitido ≤ total del pedido" se valida Y se inserta dentro
      // de una misma transacción Serializable: sin esto, dos emisiones
      // simultáneas (doble click) leían ambas el mismo total emitido y se
      // pasaban del total del pedido.
      const n = await this.prisma.$transaction(
        async (tx) => {
          const emitidas = await tx.creditNote.aggregate({
            where: { businessId, orderId: dto.orderId },
            _sum: { amount: true },
          });
          const yaEmitido = emitidas._sum.amount != null ? Number(emitidas._sum.amount) : 0;
          const disponible = Math.round((Number(order.total) - yaEmitido) * 100) / 100;
          if (dto.amount > disponible + 0.01) {
            throw new UnprocessableEntityException(
              yaEmitido > 0
                ? `Ese pedido ya tiene $${yaEmitido} en notas de crédito: quedan $${disponible} disponibles.`
                : `El monto supera el total del pedido ($${disponible}).`,
            );
          }
          return tx.creditNote.create({
            data: {
              businessId,
              orderId: dto.orderId,
              returnId: dto.returnId ?? null,
              customerId: dto.customerId ?? order.customerId,
              amount: dto.amount,
              type: dto.type as CreditNoteType,
              expiresAt: vence,
            },
            include: INCLUDE_ORDEN,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.aNota(n);
    } catch (e) {
      // returnId es @unique: esa devolución ya emitió su nota.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Esa devolución ya tiene una nota de crédito emitida.');
      }
      throw e;
    }
  }

  // Usar el saldo: valida vigencia y la marca aplicada. El modelo no guarda
  // saldo parcial (no hay campo de remanente), así que la nota se aplica
  // entera — si algún día hace falta el uso parcial, pide migración.
  async applyCreditNote(businessId: string, id: string) {
    const n = await this.prisma.creditNote.findFirst({ where: { id, businessId } });
    if (!n) throw new NotFoundException('Nota de crédito no encontrada');

    // Se marca aplicada CONDICIONANDO a que siga emitida y vigente, en una
    // sola escritura: dos clicks simultáneos no pueden aplicarla dos veces,
    // y una que vence entre el chequeo y el guardado tampoco pasa.
    const escrito = await this.prisma.creditNote.updateMany({
      where: {
        id,
        businessId,
        status: 'ISSUED',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      data: { status: 'APPLIED' },
    });
    if (escrito.count === 0) {
      throw new UnprocessableEntityException(
        n.status === 'APPLIED' ? 'Esa nota ya fue aplicada.' : 'La nota está vencida y ya no se puede aplicar.',
      );
    }

    const aplicada = await this.prisma.creditNote.findFirstOrThrow({ where: { id }, include: INCLUDE_ORDEN });
    return this.aNota(aplicada);
  }
}
