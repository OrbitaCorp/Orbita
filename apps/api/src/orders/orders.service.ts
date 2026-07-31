import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OrderChannel, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { FindOrdersQueryDto } from './dto/find-orders-query.dto';

// (Fase 2 — Alex) El corazón de los pedidos: acá viven las reglas de cómo nace
// un pedido y cómo va cambiando de estado hasta entregarse o cancelarse.
//
// En esta primera tarjeta hago: el detalle de un pedido, el alta básica desde
// el panel (calcula totales y numera solo), y el motor de estados con su
// historial. Lo que falta a propósito (llega en las próximas tarjetas/fases):
// la lista con filtros, el descuento de stock al confirmar, las ventas de
// caja (POS), los cupones y el comprobante. Está anotado en PENDIENTES.md.

// Las reglas del juego: desde cada estado, a cuáles se puede pasar.
// Un pedido online avanza pendiente → confirmado → en preparación → enviado →
// entregado, y se puede cancelar solo mientras no salió del negocio.
// Una venta de caja (POS) nace completada y no se toca más: si hay un
// problema, el día de mañana se resuelve por devoluciones (Fase 4).
const TRANSICIONES: Record<OrderChannel, Partial<Record<OrderStatus, OrderStatus[]>>> = {
  ONLINE: {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PREPARING', 'CANCELLED'],
    PREPARING: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED'],
    DELIVERED: [],
    CANCELLED: [],
  },
  POS: {
    COMPLETED: [],
    CANCELLED: [],
  },
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // ── Lista con filtros ─────────────────────────────────────────────────────
  // La tabla de pedidos del panel: pagina de a 20 y filtra por estado, canal,
  // fechas, sucursal y búsqueda (nombre/email del cliente, nombre del comprador,
  // o directamente el número de pedido si escribís un número). Además devuelve
  // cuántos pedidos hay en cada estado, para los contadores de las pestañas.
  async findAll(businessId: string, q: FindOrdersQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;

    // Filtros comunes (sin el estado): también los usan los contadores.
    const filtros: Prisma.OrderWhereInput = { businessId, deletedAt: null };
    if (q.channel) filtros.channel = q.channel;
    if (q.branch_id) filtros.branchId = q.branch_id;
    if (q.from || q.to) {
      filtros.createdAt = {
        ...(q.from ? { gte: new Date(q.from) } : {}),
        ...(q.to ? { lte: new Date(q.to) } : {}),
      };
    }
    // Si escriben el número con numeral ("#4"), el # se ignora.
    const s = q.search?.trim().replace(/^#/, '');
    if (s) {
      const opciones: Prisma.OrderWhereInput[] = [
        {
          customer: {
            OR: [
              { firstName: { contains: s, mode: 'insensitive' } },
              { lastName: { contains: s, mode: 'insensitive' } },
              { email: { contains: s, mode: 'insensitive' } },
            ],
          },
        },
        { onlineOrderDetails: { buyerName: { contains: s, mode: 'insensitive' } } },
      ];
      if (/^\d+$/.test(s)) opciones.push({ orderNumber: Number(s) });
      filtros.OR = opciones;
    }

    const where: Prisma.OrderWhereInput = q.status ? { ...filtros, status: q.status } : filtros;

    const [rows, total, porEstado] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          customer: { select: { firstName: true, lastName: true, email: true } },
          onlineOrderDetails: { select: { buyerName: true, buyerEmail: true } },
          items: { select: { productName: true, quantity: true, unitPrice: true } },
        },
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.groupBy({ by: ['status'], where: filtros, orderBy: { status: 'asc' }, _count: true }),
    ]);

    const counts: Record<string, number> = {};
    for (const g of porEstado) counts[g.status] = typeof g._count === 'number' ? g._count : 0;

    return {
      data: rows.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        channel: o.channel,
        status: o.status,
        customerId: o.customerId,
        // El nombre que se muestra en la fila: el cliente registrado o, si no
        // hay, el comprador que se cargó a mano en el pedido.
        customerName: o.customer
          ? `${o.customer.firstName}${o.customer.lastName ? ' ' + o.customer.lastName : ''}`
          : (o.onlineOrderDetails?.buyerName ?? null),
        customerEmail: o.customer?.email ?? o.onlineOrderDetails?.buyerEmail ?? null,
        total: Number(o.total),
        itemCount: o.items.reduce((acc, it) => acc + it.quantity, 0),
        items: o.items.map((it) => ({
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
        })),
        createdAt: o.createdAt,
      })),
      total,
      page,
      limit,
      counts,
    };
  }

  // ── Detalle de un pedido ──────────────────────────────────────────────────
  // Devuelve el pedido completo: renglones, pagos, datos de envío, cliente y
  // el historial de estados (la línea de tiempo). Solo pedidos de TU negocio.
  async findOne(businessId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, businessId, deletedAt: null },
      include: {
        items: true,
        payments: true,
        onlineOrderDetails: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    // Los montos salen de la base como texto — acá los devuelvo como número,
    // que es lo que el contrato de la API promete a las pantallas.
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      fiscalNumber: order.fiscalNumber,
      channel: order.channel,
      status: order.status,
      customerId: order.customerId,
      customer: order.customer,
      subtotal: Number(order.subtotal),
      discountTotal: Number(order.discountTotal),
      total: Number(order.total),
      notes: order.notes,
      createdAt: order.createdAt,
      items: order.items.map((it) => ({
        id: it.id,
        variantId: it.variantId,
        productName: it.productName,
        variantLabel: it.variantLabel,
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        editedPrice: it.editedPrice != null ? Number(it.editedPrice) : null,
        discountAmount: Number(it.discountAmount),
        isConcept: it.isConcept,
        notes: it.notes,
      })),
      payments: order.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
      onlineOrderDetails: order.onlineOrderDetails
        ? {
            ...order.onlineOrderDetails,
            shippingCost:
              order.onlineOrderDetails.shippingCost != null
                ? Number(order.onlineOrderDetails.shippingCost)
                : null,
          }
        : undefined,
      statusHistory: order.statusHistory.map((h) => ({ status: h.status, createdAt: h.createdAt })),
    };
  }

  // ── Alta básica de pedido (desde el panel) ────────────────────────────────
  // Crea un pedido manual: elegís cliente y productos, y el sistema congela
  // los precios del momento, calcula los totales y le pone número solo.
  // Nace "pendiente" y arranca su historial. El descuento de stock al
  // confirmar y las validaciones de stock llegan en la tarjeta "Crear pedido
  // manual"; las ventas presenciales (canal POS) no se pueden crear por acá:
  // no existe ningún flujo de venta de mostrador en el sistema. Los ítems
  // libres, el precio editado y los cupones tampoco están implementados
  // todavía — se rechazan con un mensaje claro para que nadie crea que ya andan.
  async create(businessId: string, dto: CreateOrderDto) {
    if (dto.channel === 'POS') {
      throw new UnprocessableEntityException(
        'No hay ningún flujo de venta presencial (POS) disponible. Solo se pueden crear pedidos online.',
      );
    }
    if (!dto.items?.length) throw new BadRequestException('El pedido necesita al menos un producto');
    if (dto.items.some((it) => it.isConcept)) {
      throw new BadRequestException('Los ítems libres (sin producto) no están implementados.');
    }
    if (dto.items.some((it) => it.editedPrice != null)) {
      throw new BadRequestException('Editar el precio a mano no está implementado.');
    }
    if (dto.discountCode) {
      throw new BadRequestException('Los cupones de descuento se aplican en una fase posterior.');
    }
    if (dto.payments?.length) {
      throw new BadRequestException('Los pagos se registran al confirmar el pago online.');
    }

    // La sucursal: si no viene una, uso la principal del negocio.
    const branch = dto.branch_id
      ? await this.prisma.branch.findFirst({ where: { id: dto.branch_id, businessId } })
      : await this.prisma.branch.findFirst({ where: { businessId }, orderBy: { createdAt: 'asc' } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');

    // El cliente es opcional, pero si viene tiene que ser de este negocio.
    const customer = dto.customerId
      ? await this.prisma.customer.findFirst({
          where: { id: dto.customerId, businessId, deletedAt: null },
        })
      : null;
    if (dto.customerId && !customer) throw new NotFoundException('Cliente no encontrado');

    // Para un pedido online necesito saber a quién va: o un cliente con email,
    // o los datos del comprador escritos a mano.
    const buyerName =
      dto.buyer?.name ??
      (customer ? `${customer.firstName}${customer.lastName ? ' ' + customer.lastName : ''}` : null);
    const buyerEmail = dto.buyer?.email ?? customer?.email ?? null;
    if (!buyerName || !buyerEmail) {
      throw new BadRequestException(
        'Indicá un cliente con email, o el nombre y email del comprador.',
      );
    }

    // Busco los productos elegidos EN este negocio y congelo su precio actual.
    // Nunca confío en precios que vengan de afuera.
    const variantIds = [...new Set(dto.items.map((it) => it.variantId))];
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, product: { businessId, deletedAt: null } },
      include: {
        product: { select: { name: true } },
        optionValues: { include: { optionValue: true } },
      },
    });
    const porId = new Map(variants.map((v) => [v.id, v]));
    for (const it of dto.items) {
      if (!porId.has(it.variantId)) {
        throw new NotFoundException('Alguno de los productos elegidos no existe en tu negocio.');
      }
    }

    // Validación de stock (tarjeta "Crear pedido manual"): si el producto tiene
    // stock cargado en la sucursal, no se puede pedir más de lo que hay. Si NO
    // tiene stock cargado, se interpreta como "no controla stock" y pasa.
    // (El flag explícito "vender sin stock" necesita un campo en la base que
    // hoy no existe — anotado en PENDIENTES.md para decidir en equipo.)
    const stockRows = await this.prisma.variantStock.findMany({
      where: { variantId: { in: variantIds }, branchId: branch.id },
    });
    const stockDe = new Map(stockRows.map((r) => [r.variantId, r.quantity]));
    // OJO: sumo las cantidades POR PRODUCTO antes de comparar — si el mismo
    // producto viene repetido en dos renglones, cuenta el total (si no, se
    // podía esquivar el control pidiendo de a pedacitos).
    const pedidoPorVariante = new Map<string, number>();
    for (const it of dto.items) {
      pedidoPorVariante.set(it.variantId, (pedidoPorVariante.get(it.variantId) ?? 0) + it.quantity);
    }
    const faltantes: string[] = [];
    for (const [variantId, cantidad] of pedidoPorVariante) {
      const disponible = stockDe.get(variantId);
      if (disponible !== undefined && disponible < cantidad) {
        const v = porId.get(variantId)!;
        faltantes.push(`${v.product.name}: hay ${disponible}, pediste ${cantidad}`);
      }
    }
    if (faltantes.length) {
      throw new UnprocessableEntityException(`No hay stock suficiente. ${faltantes.join(' · ')}.`);
    }

    const renglones = dto.items.map((it) => {
      const v = porId.get(it.variantId)!;
      return {
        variantId: v.id,
        productName: v.product.name,
        variantLabel:
          v.optionValues.length > 0
            ? v.optionValues.map((ov) => ov.optionValue.value).join(' / ')
            : null,
        quantity: it.quantity,
        unitPrice: v.price,
        notes: it.notes ?? null,
      };
    });

    const subtotal = renglones.reduce((acc, r) => acc + Number(r.unitPrice) * r.quantity, 0);
    const shippingCost = dto.shippingCost ?? null;
    const total = subtotal + (shippingCost ?? 0);

    // Todo junto o nada: el pedido, sus renglones, los datos de envío y la
    // primera marca del historial se guardan en una sola transacción.
    // El número correlativo se calcula adentro; si justo dos pedidos se crean
    // al mismo tiempo y chocan, se reintenta con el número siguiente.
    for (let intento = 0; intento < 3; intento++) {
      try {
        const creado = await this.prisma.$transaction(async (tx) => {
          const ultimo = await tx.order.findFirst({
            where: { businessId },
            orderBy: { orderNumber: 'desc' },
            select: { orderNumber: true },
          });
          const order = await tx.order.create({
            data: {
              businessId,
              branchId: branch.id,
              customerId: customer?.id ?? null,
              orderNumber: (ultimo?.orderNumber ?? 0) + 1,
              channel: 'ONLINE',
              status: 'PENDING',
              subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
              discountTotal: new Prisma.Decimal(0),
              total: new Prisma.Decimal(total.toFixed(2)),
              notes: dto.notes ?? null,
            },
          });
          await tx.orderItem.createMany({
            data: renglones.map((r) => ({ ...r, orderId: order.id })),
          });
          await tx.onlineOrderDetails.create({
            data: {
              orderId: order.id,
              shippingAddressId: dto.shippingAddressId ?? null,
              buyerName,
              buyerEmail,
              buyerPhone: dto.buyer?.phone ?? customer?.phone ?? null,
              shippingCost: shippingCost != null ? new Prisma.Decimal(shippingCost.toFixed(2)) : null,
            },
          });
          await tx.orderStatusHistory.create({ data: { orderId: order.id, status: 'PENDING' } });
          return order;
        });
        return this.findOne(businessId, creado.id);
      } catch (e) {
        // P2002 = se repitió el número de pedido (dos altas al mismo tiempo).
        const esChoque =
          e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
        if (!esChoque || intento === 2) throw e;
      }
    }
    throw new UnprocessableEntityException('No se pudo generar el número de pedido.');
  }

  // ── Cambio de estado ──────────────────────────────────────────────────────
  // Valida que el salto sea uno permitido para el canal del pedido, lo aplica
  // y deja la marca en el historial. Si pasa a "entregado", se disparan los
  // avisos por email al comprador (con tu mail sin configurar los ves como
  // [MAIL STUB] en la consola del backend).
  async updateStatus(businessId: string, memberId: string, id: string, nuevo: OrderStatus) {
    const order = await this.prisma.order.findFirst({
      where: { id, businessId, deletedAt: null },
      include: {
        business: { select: { name: true, subdomain: true } },
        customer: { select: { email: true } },
        onlineOrderDetails: { select: { buyerEmail: true } },
        items: { select: { variantId: true, productName: true, quantity: true, isConcept: true } },
      },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const permitidos = TRANSICIONES[order.channel][order.status] ?? [];
    if (!permitidos.includes(nuevo)) {
      const ayuda =
        order.channel === 'POS'
          ? 'Una venta de caja no cambia de estado: si hubo un problema se resuelve por devoluciones.'
          : permitidos.length
            ? `Desde "${order.status}" solo se puede pasar a: ${permitidos.join(', ')}.`
            : `"${order.status}" es un estado final, no se puede cambiar.`;
      throw new UnprocessableEntityException(`No se puede pasar de ${order.status} a ${nuevo}. ${ayuda}`);
    }

    // Confirmar = comprometerse a entregar: acá se descuenta el stock de verdad
    // (una salida por cada renglón que sea un producto, con su movimiento en el
    // historial de inventario). Si el pedido se cancela DESPUÉS de confirmado,
    // el stock vuelve solo (entrada por cancelación). Todo junto o nada.
    const renglonesConStock = order.items.filter((it) => !it.isConcept);

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: nuevo } });
      await tx.orderStatusHistory.create({ data: { orderId: order.id, status: nuevo } });

      if (nuevo === 'CONFIRMED') {
        // Re-chequeo el stock adentro de la transacción: pudo cambiar entre que
        // se creó el pedido y este click. Sumo por producto (si está repetido
        // en dos renglones, cuenta el total).
        const stockRows = await tx.variantStock.findMany({
          where: { variantId: { in: renglonesConStock.map((it) => it.variantId) }, branchId: order.branchId },
        });
        const stockDe = new Map(stockRows.map((r) => [r.variantId, r]));
        const porVariante = new Map<string, { nombre: string; cantidad: number }>();
        for (const it of renglonesConStock) {
          const prev = porVariante.get(it.variantId);
          porVariante.set(it.variantId, { nombre: it.productName, cantidad: (prev?.cantidad ?? 0) + it.quantity });
        }
        const faltantes: string[] = [];
        for (const [variantId, pedido] of porVariante) {
          const row = stockDe.get(variantId);
          if (row && row.quantity < pedido.cantidad) faltantes.push(`${pedido.nombre}: hay ${row.quantity}, el pedido lleva ${pedido.cantidad}`);
        }
        if (faltantes.length) {
          throw new UnprocessableEntityException(`No se puede confirmar: falta stock. ${faltantes.join(' · ')}.`);
        }

        // Descuento y movimiento por producto (una sola vez por variante).
        for (const [variantId, pedido] of porVariante) {
          const row = stockDe.get(variantId);
          if (row) {
            await tx.variantStock.update({ where: { id: row.id }, data: { quantity: { decrement: pedido.cantidad } } });
          } else {
            // No controlaba stock en esta sucursal: queda registrada la deuda.
            await tx.variantStock.create({ data: { variantId, branchId: order.branchId, quantity: -pedido.cantidad } });
          }
          await tx.stockMovement.create({
            data: {
              businessId, branchId: order.branchId, variantId,
              type: 'SALIDA', quantity: -pedido.cantidad,
              reason: `Venta #${order.orderNumber}`,
              orderId: order.id, createdBy: memberId,
            },
          });
        }
      }

      // Cancelar un pedido que ya había descontado stock (confirmado o en
      // preparación) devuelve las unidades al inventario.
      const yaDescontado = order.status === 'CONFIRMED' || order.status === 'PREPARING';
      if (nuevo === 'CANCELLED' && yaDescontado) {
        const devolver = new Map<string, number>();
        for (const it of renglonesConStock) {
          devolver.set(it.variantId, (devolver.get(it.variantId) ?? 0) + it.quantity);
        }
        for (const [variantId, cantidad] of devolver) {
          await tx.variantStock.upsert({
            where: { variantId_branchId: { variantId, branchId: order.branchId } },
            update: { quantity: { increment: cantidad } },
            create: { variantId, branchId: order.branchId, quantity: cantidad },
          });
          await tx.stockMovement.create({
            data: {
              businessId, branchId: order.branchId, variantId,
              type: 'ENTRADA', quantity: cantidad,
              reason: `Cancelación #${order.orderNumber}`,
              orderId: order.id, createdBy: memberId,
            },
          });
        }
      }
    });

    if (nuevo === 'DELIVERED') {
      // El aviso nunca puede romper el cambio de estado: si el mail falla,
      // queda anotado en el log y listo.
      const destino = order.onlineOrderDetails?.buyerEmail ?? order.customer?.email ?? null;
      if (destino) {
        const frontend = process.env.FRONTEND_URL ?? 'http://localhost:3001';
        const meta = { businessId, customerId: order.customerId ?? undefined };
        try {
          await this.mail.sendOrderDelivered(destino, {
            storeName: order.business.name,
            orderNumber: order.orderNumber,
          }, meta);
          await this.mail.sendReviewRequest(destino, {
            storeName: order.business.name,
            productName: order.items[0]?.productName ?? 'tu compra',
            reviewUrl: `${frontend}/tienda/${order.business.subdomain}/pedido/${order.id}`,
          }, meta);
        } catch (e) {
          this.logger.warn(`No se pudo mandar el aviso de entrega del pedido #${order.orderNumber}: ${e}`);
        }
      }
    }

    return this.findOne(businessId, id);
  }

  // ── Comprobante ───────────────────────────────────────────────────────────
  // Devuelve la dirección del comprobante del pedido (la misma página que ve
  // el cliente en la tienda) y, si me pasan un email, se lo manda con el
  // detalle de la compra. En local sin mail configurado sale como [MAIL STUB].
  async receipt(businessId: string, id: string, email?: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, businessId, deletedAt: null },
      include: {
        business: { select: { name: true, subdomain: true } },
        items: { select: { productName: true, variantLabel: true, quantity: true, unitPrice: true, editedPrice: true } },
      },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const frontend = process.env.FRONTEND_URL ?? 'http://localhost:3001';
    const url = `${frontend}/tienda/${order.business.subdomain}/pedido/${order.id}/comprobante`;

    if (!email) return { url, sent: false };

    await this.mail.sendOrderConfirmation(email, {
      storeName: order.business.name,
      orderNumber: order.orderNumber,
      total: Number(order.total),
      items: order.items.map((it) => ({
        name: `${it.productName}${it.variantLabel ? ` · ${it.variantLabel}` : ''}`,
        quantity: it.quantity,
        price: Number(it.editedPrice ?? it.unitPrice),
      })),
    }, { businessId, customerId: order.customerId ?? undefined });
    return { url, sent: true };
  }
}

