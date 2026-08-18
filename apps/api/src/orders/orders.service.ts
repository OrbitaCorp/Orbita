import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderChannel, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { DiscountsService } from '../discounts/discounts.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { FindOrdersQueryDto } from './dto/find-orders-query.dto';
import { pickPrimaryImageUrl } from '../common/utils/product-image.util';

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

// Los templates de mail imprimen los montos tal cual llegan (no saben
// formatear), así que se mandan ya escritos en pesos: $12.500 y no 12500.
function fmtPesos(n: number): string {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly discounts: DiscountsService,
    private readonly eventEmitter: EventEmitter2,
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
    if (q.origin) filtros.origin = q.origin;
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

    // (Postventa) returnable=true: solo estados sobre los que tiene sentido
    // una devolución según la regla de producto — entregado o completado.
    if (q.returnable === 'true') filtros.status = { in: ['DELIVERED', 'COMPLETED'] };

    const where: Prisma.OrderWhereInput = q.status ? { ...filtros, status: q.status } : filtros;

    // (Postventa) Con returnable=true la elegibilidad se resuelve ANTES de
    // paginar, para que el total y las páginas cuenten SOLO pedidos con
    // unidades por devolver (filtrar después dejaba páginas vacías y totales
    // mentirosos). Se toman los últimos 500 candidatos —de sobra para el
    // wizard— y se descartan los que ya devolvieron todo (las devoluciones
    // rechazadas no cuentan; los ítems de concepto tampoco: no mueven stock).
    let returnableTotal: number | null = null;
    if (q.returnable === 'true') {
      const candidatos = await this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: { id: true, items: { select: { quantity: true, isConcept: true } } },
      });
      const ids = candidatos.map((o) => o.id);
      const grupos = ids.length
        ? await this.prisma.return.groupBy({
            by: ['orderId'],
            where: { businessId, orderId: { in: ids }, status: { not: 'REJECTED' } },
            _sum: { quantity: true },
          })
        : [];
      const devueltas = new Map(grupos.map((g) => [g.orderId, g._sum.quantity ?? 0]));
      const elegibles = candidatos.filter(
        (o) => o.items.reduce((acc, it) => acc + (it.isConcept ? 0 : it.quantity), 0) > (devueltas.get(o.id) ?? 0),
      );
      returnableTotal = elegibles.length;
      // La consulta de abajo pagina sobre estos ids ya filtrados.
      where.id = { in: elegibles.slice((page - 1) * limit, page * limit).map((o) => o.id) };
    }

    const [rows, total, porEstado] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        // Con returnable, los ids del where ya vienen paginados (arriba).
        skip: returnableTotal !== null ? 0 : (page - 1) * limit,
        take: limit,
        include: {
          customer: { select: { firstName: true, lastName: true, email: true } },
          onlineOrderDetails: { select: { buyerName: true, buyerEmail: true } },
          items: { select: { productName: true, quantity: true, unitPrice: true, isConcept: true } },
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
        origin: o.origin,
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
      total: returnableTotal ?? total,
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
        onlineOrderDetails: { include: { shippingAddress: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const imagenPorVariante = await this.resolverImagenesDeItems(order.items);

    // Los montos salen de la base como texto — acá los devuelvo como número,
    // que es lo que el contrato de la API promete a las pantallas.
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      fiscalNumber: order.fiscalNumber,
      channel: order.channel,
      origin: order.origin,
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
        imgUrl: imagenPorVariante.get(it.variantId) ?? null,
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

  // Resuelve la foto de cada renglón del pedido a partir de su variantId —
  // antes findOne() no traía nada de esto, así que las pantallas que muestran
  // el detalle del pedido (Confirmacion.tsx, Seguimiento.tsx, Comprobante.tsx,
  // el detalle del panel) caían siempre al placeholder de color, incluso con
  // el producto ya publicado y con fotos reales. Mismo criterio de fallback
  // que el resto del storefront (pickPrimaryImageUrl): si el valor de opción
  // de ESA variante (ej. "Negro") tiene foto propia, esa; si no, la principal
  // general del producto.
  //
  // Nunca rompe el detalle del pedido si una variante ya no existe (producto
  // borrado hace tiempo): esos renglones simplemente quedan sin imgUrl.
  private async resolverImagenesDeItems(items: { variantId: string }[]): Promise<Map<string, string | null>> {
    const mapa = new Map<string, string | null>();
    const variantIds = [...new Set(items.map((it) => it.variantId))];
    if (!variantIds.length) return mapa;

    const variantes = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        optionValues: { select: { optionValueId: true } },
        product: {
          select: { images: { select: { url: true, isPrimary: true, optionValueId: true }, orderBy: { position: 'asc' } } },
        },
      },
    });

    for (const v of variantes) {
      const idsOpcion = new Set(v.optionValues.map((ov) => ov.optionValueId));
      const fotoDeVariante = v.product.images.find((img) => img.optionValueId && idsOpcion.has(img.optionValueId));
      mapa.set(v.id, fotoDeVariante?.url ?? pickPrimaryImageUrl(v.product.images));
    }
    return mapa;
  }

  // ── Mis pedidos (storefront, RBT-628) ─────────────────────────────────────
  // Lo que ve el CLIENTE de sus propios pedidos. Scopeado por businessId +
  // customerId del token (assertCustomerContext en el controller): nunca por id
  // a ciegas. El estado se devuelve crudo (enum); la etiqueta/color la arma el
  // frontend, como el resto de las pantallas de pedidos.
  async findAllForCustomer(businessId: string, customerId: string) {
    const rows = await this.prisma.order.findMany({
      where: { businessId, customerId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { items: { select: { quantity: true } } },
    });

    const data = rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      subtotal: Number(o.subtotal),
      discountTotal: Number(o.discountTotal),
      total: Number(o.total),
      itemCount: o.items.reduce((acc, it) => acc + it.quantity, 0),
      createdAt: o.createdAt,
    }));

    // "Total gastado": suma de los pedidos NO cancelados (un pedido cancelado no
    // es plata efectivamente gastada). Decisión documentada en PENDIENTES.md.
    const totalGastado = data
      .filter((d) => d.status !== 'CANCELLED')
      .reduce((acc, d) => acc + d.total, 0);

    return { data, resumen: { cantidadPedidos: data.length, totalGastado } };
  }

  // Detalle de UN pedido del cliente. Verifica pertenencia (businessId +
  // customerId) antes de reusar el shape rico de findOne().
  async findOneForCustomer(businessId: string, customerId: string, id: string) {
    const pedido = await this.prisma.order.findFirst({
      where: { id, businessId, customerId, deletedAt: null },
      select: { id: true },
    });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');
    return this.findOne(businessId, id);
  }

  // Guest checkout (2026-08-14): seguimiento/confirmación público de UN
  // pedido, sin exigir sesión — lo usa el endpoint GET .../orders/:id/tracking
  // del storefront. Un cliente logueado se valida por customerId (como
  // findOneForCustomer); un invitado se valida cruzando el email que manda
  // por query contra el buyerEmail guardado en el pedido — nunca 403, siempre
  // 404 en el mismatch, para no filtrar que el id existe pero es de otro.
  async findOneForTracking(businessId: string, id: string, ctx: { customerId?: string; email?: string }) {
    const order = await this.prisma.order.findFirst({
      where: { id, businessId, deletedAt: null },
      select: { id: true, customerId: true, onlineOrderDetails: { select: { buyerEmail: true } } },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    if (order.customerId) {
      if (order.customerId !== ctx.customerId) throw new NotFoundException('Pedido no encontrado');
    } else {
      const emailPedido = order.onlineOrderDetails?.buyerEmail?.trim().toLowerCase();
      const emailDado = ctx.email?.trim().toLowerCase();
      if (!emailPedido || !emailDado || emailPedido !== emailDado) {
        throw new NotFoundException('Pedido no encontrado');
      }
    }
    return this.findOne(businessId, id);
  }

  // Guest checkout (2026-08-14): resuelve el businessId de un pedido ANÓNIMO
  // (customerId: null) a partir de su id, sin requerir sesión — lo usa
  // MercadopagoController.createMpOrder() para armar la preferencia de pago
  // de un invitado. Order.id es UUID único globalmente, así que no hace
  // falta que el slug viaje. 404 (nunca 403) para cualquier pedido que SÍ
  // tenga customerId — un invitado no puede tocar el pedido de un cliente
  // real ni conociendo/adivinando su id.
  async resolveAnonymousOrderBusinessId(orderId: string): Promise<string> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: null, deletedAt: null },
      select: { businessId: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return order.businessId;
  }

  // Cancelación por el propio cliente (storefront). A propósito NO reusa
  // updateStatus(): ese método pide un memberId real porque lo usa como
  // createdBy de los movimientos de stock, y acá no hay ningún miembro del
  // negocio de por medio. Por eso se restringe a PENDING — el único estado
  // donde cancelar nunca tocó stock (yaDescontado en updateStatus solo es
  // true desde CONFIRMED/PREPARING) — así este método puede ser autosuficiente
  // y no necesita ningún StockMovement ni memberId.
  async cancelByCustomer(businessId: string, customerId: string, id: string, reason?: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, businessId, customerId, deletedAt: null },
      select: { id: true, status: true, notes: true, orderNumber: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.status !== 'PENDING') {
      throw new UnprocessableEntityException(
        order.status === 'CANCELLED'
          ? 'Este pedido ya está cancelado.'
          : `Este pedido ya está "${order.status}" — una vez que la tienda lo confirma, contactala directamente para cancelarlo.`,
      );
    }

    // El motivo no tiene columna propia (no la hay en el modelo) — se agrega
    // a `notes` para que la tienda lo vea en el detalle del pedido, igual que
    // ya se hace con el método de pago elegido en el checkout.
    const notasFinal = reason
      ? [order.notes, `Cancelado por el cliente — motivo: ${reason}.`].filter(Boolean).join('\n')
      : order.notes;

    await this.prisma.$transaction(async (tx) => {
      // Condicionado al estado leído: si dos pestañas cancelan a la vez, la
      // segunda no encuentra fila para actualizar y corta acá sin duplicar
      // el registro en el historial. Mismo patrón que updateStatus().
      const escrito = await tx.order.updateMany({
        where: { id: order.id, businessId, status: 'PENDING' },
        data: { status: 'CANCELLED', notes: notasFinal },
      });
      if (escrito.count === 0) {
        throw new UnprocessableEntityException('El pedido ya cambió de estado — recargá para ver cómo quedó.');
      }
      await tx.orderStatusHistory.create({ data: { orderId: order.id, status: 'CANCELLED' } });
    });

    this.logger.log(`Pedido ${order.id} cancelado por el cliente${reason ? ` — motivo: ${reason}` : ''}.`);
    this.eventEmitter.emit('notification.pedido_cancelado', { businessId, orderNumber: order.orderNumber, orderId: order.id });
    return this.findOneForCustomer(businessId, customerId, id);
  }

  // ── Alta básica de pedido (desde el panel) ────────────────────────────────
  // Crea un pedido manual: elegís cliente y productos, y el sistema congela
  // los precios del momento, calcula los totales y le pone número solo.
  // Nace "pendiente" y arranca su historial. El descuento de stock al
  // confirmar y las validaciones de stock llegan en la tarjeta "Crear pedido
  // manual"; las ventas presenciales (canal POS) no se pueden crear por acá:
  // no existe ningún flujo de venta de mostrador en el sistema. Los ítems
  // libres y el precio editado tampoco están implementados todavía — se
  // rechazan con un mensaje claro para que nadie crea que ya andan. Los
  // cupones (`discountCode`) SÍ están implementados (RBT-616): se validan
  // server-side y el canje se registra en la misma transacción que el pedido.
  // `publicCheckout`: true solo cuando llama StorefrontController.checkout()
  // — endurece la validación de variantes (ver más abajo) sin afectar el alta
  // manual desde el panel, que usa este mismo método.
  async create(businessId: string, dto: CreateOrderDto, opts?: { publicCheckout?: boolean }) {
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

    // Si se pasa una dirección de envío, tiene que ser de ESTE negocio (y del
    // cliente del pedido si hay uno). Sin este chequeo, un id de otra tienda
    // cruzaba el FK y el pedido terminaba mostrando la dirección de un cliente
    // ajeno; un id inexistente reventaba la transacción con un 500.
    //
    // `direccionSnapshot`: lo que se termina guardando en OnlineOrderDetails
    // como texto plano — de la Address guardada (si vino shippingAddressId) o
    // directo del DTO (si vino shippingAddress, el caso de un invitado sin
    // Customer al que colgarle una fila de Address). Nunca las dos a la vez:
    // el controller ya elige una sola forma antes de llamar acá.
    let direccionSnapshot: {
      street: string; floor: string | null; depto: string | null; referencia: string | null;
      provincia: string | null; city: string; zip: string | null;
    } | null = null;
    if (dto.shippingAddressId) {
      const address = await this.prisma.address.findFirst({
        where: {
          id: dto.shippingAddressId,
          customer: { businessId, ...(customer ? { id: customer.id } : {}) },
        },
        select: { street: true, floor: true, depto: true, referencia: true, provincia: true, city: true, zip: true },
      });
      if (!address) throw new NotFoundException('Dirección de envío no encontrada');
      direccionSnapshot = address;
    } else if (dto.shippingAddress) {
      direccionSnapshot = {
        street: dto.shippingAddress.street,
        floor: dto.shippingAddress.floor ?? null,
        depto: dto.shippingAddress.depto ?? null,
        referencia: dto.shippingAddress.referencia ?? null,
        provincia: dto.shippingAddress.provincia ?? null,
        city: dto.shippingAddress.city,
        zip: dto.shippingAddress.zip ?? null,
      };
    }

    // Para un pedido necesito saber a quién va: o un cliente, o los datos
    // del comprador escritos a mano (al menos el nombre).
    const buyerName =
      dto.buyer?.name ??
      (customer ? `${customer.firstName}${customer.lastName ? ' ' + customer.lastName : ''}` : null);
    const buyerEmail = dto.buyer?.email ?? customer?.email ?? null;
    if (!buyerName) {
      throw new BadRequestException(
        'Indicá un cliente o el nombre del comprador.',
      );
    }
    // Una venta anónima (comprador sin registrar) no necesita email: alcanza
    // con el nombre. Si el pedido es de un cliente YA registrado, en cambio,
    // necesitamos poder contactarlo más adelante -- ahí el email sigue siendo
    // obligatorio (y tiene que venir cargado en la ficha del cliente).
    if (dto.customerId && !buyerEmail) {
      throw new BadRequestException(
        'Ese cliente no tiene email cargado — agregaselo o elegí otro.',
      );
    }

    // Busco los productos elegidos EN este negocio y congelo su precio actual.
    // Nunca confío en precios que vengan de afuera.
    //
    // isActive/product.status: SOLO para el checkout público (opts.publicCheckout) —
    // antes ese camino no impedía comprar una variante desactivada
    // ("combinación no ofrecida") ni un producto en DRAFT. El alta manual
    // desde el panel (mismo create(), dueño/staff con orders.manage) sigue
    // sin esta restricción a propósito: puede tener sentido cargar a mano un
    // pedido de un producto que todavía no se publicó. Mismo set de estados
    // que ya usa el storefront para decidir qué muestra (PUBLISHED +
    // OUT_OF_STOCK, ver StorefrontService) — no se restringe más de lo que ya
    // es visible/comprable de cara al público.
    const variantIds = [...new Set(dto.items.map((it) => it.variantId))];
    const variants = await this.prisma.productVariant.findMany({
      where: {
        id: { in: variantIds },
        ...(opts?.publicCheckout ? { isActive: true } : {}),
        product: {
          businessId,
          deletedAt: null,
          ...(opts?.publicCheckout ? { status: { in: ['PUBLISHED', 'OUT_OF_STOCK'] } } : {}),
        },
      },
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

    // Cupón + descuentos automáticos (RBT-616 + RBT-613): se resuelven
    // server-side contra la base (nunca se confía en un monto mandado por el
    // cliente, mismo criterio que con los precios de variante de arriba) y el
    // canje se registra automáticamente acá, al crear el pedido — no al
    // confirmarlo. A diferencia de antes, esto corre SIEMPRE (no solo si hay
    // `discountCode`): los descuentos automáticos aplican haya o no un cupón.
    const { discountTotal, redenciones } = await this.discounts.resolverDescuentosParaOrden(
      businessId,
      dto.items.map((it) => ({ variantId: it.variantId, quantity: it.quantity })),
      { code: dto.discountCode, customerId: customer?.id },
    );

    // Descuento por método de pago (ej: efectivo) — se calcula sobre el
    // subtotal, igual que un cupón porcentual, pero sin pasar por el modelo
    // de Discount (no consume cupo ni queda "canjeado").
    const manualDiscountTotal = dto.manualDiscountPercent
      ? Math.round(subtotal * dto.manualDiscountPercent) / 100
      : 0;

    const total = Math.max(0, subtotal + (shippingCost ?? 0) - discountTotal - manualDiscountTotal);

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
              // El canal es el tipo de flujo (este pedido tiene ciclo de
              // estados, por eso ONLINE); el origen dice quién lo cargó: el
              // wizard del panel → MANUAL, el checkout del storefront →
              // STOREFRONT. Antes esto quedaba hardcodeado a 'MANUAL' sin
              // mirar `opts.publicCheckout` (el comentario original decía
              // que el checkout "caía al default STOREFRONT", pero el código
              // nunca lo hacía) — todo pedido online quedaba mal etiquetado
              // "Manual" en el panel, aunque lo hubiera hecho un cliente real.
              origin: opts?.publicCheckout ? 'STOREFRONT' : 'MANUAL',
              status: 'PENDING',
              subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
              // Guarda el descuento total (cupón + método de pago) — el
              // registro de canje del cupón de abajo usa el monto del cupón
              // solo, así que no se pierde esa distinción para reportes.
              discountTotal: new Prisma.Decimal((discountTotal + manualDiscountTotal).toFixed(2)),
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
              shippingMethod: dto.shippingMethod ?? null,
              shippingAddressId: dto.shippingAddressId ?? null,
              shippingStreet: direccionSnapshot?.street ?? null,
              shippingFloor: direccionSnapshot?.floor ?? null,
              shippingDepto: direccionSnapshot?.depto ?? null,
              shippingReferencia: direccionSnapshot?.referencia ?? null,
              shippingProvincia: direccionSnapshot?.provincia ?? null,
              shippingCity: direccionSnapshot?.city ?? null,
              shippingZip: direccionSnapshot?.zip ?? null,
              buyerName,
              buyerEmail,
              buyerPhone: dto.buyer?.phone ?? customer?.phone ?? null,
              shippingCost: shippingCost != null ? new Prisma.Decimal(shippingCost.toFixed(2)) : null,
            },
          });
          await tx.orderStatusHistory.create({ data: { orderId: order.id, status: 'PENDING' } });

          // Canje de descuentos (RBT-616 + RBT-613): un registro por CADA
          // descuento distinto que contribuyó (puede haber más de uno — ej. un
          // automático en un renglón y otro automático de ticket, o un cupón +
          // un automático en renglones distintos), no uno solo por orden como
          // antes.
          for (const r of redenciones) {
            await tx.discountRedemption.create({
              data: {
                businessId,
                orderId: order.id,
                discountId: r.discountId,
                customerId: customer?.id ?? null,
                channel: 'STOREFRONT', // este endpoint solo crea pedidos ONLINE (ver el reject de POS arriba)
                amount: new Prisma.Decimal(r.amount.toFixed(2)),
              },
            });
            await tx.discount.update({ where: { id: r.discountId }, data: { usesConsumed: { increment: 1 } } });
          }

          return order;
        });
        this.eventEmitter.emit('notification.nuevo_pedido', {
          businessId,
          orderNumber: creado.orderNumber,
          customerName: buyerName,
          total,
          orderId: creado.id,
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
  // y deja la marca en el historial. Los estados que le importan al comprador
  // (confirmado, enviado, entregado y cancelado) le llegan por email; los
  // pasos internos del negocio (en preparación) no lo molestan. Con tu mail
  // sin configurar los ves como [MAIL STUB] en la consola del backend.
  //
  // `memberId` es `null` cuando la confirma un webhook (Mercado Pago) en vez
  // de una persona desde el panel — `created_by` en el stock_movement queda
  // sin dueño humano, que es exactamente lo que pasó (columna ya nullable).
  async updateStatus(businessId: string, memberId: string | null, id: string, nuevo: OrderStatus) {
    const order = await this.prisma.order.findFirst({
      where: { id, businessId, deletedAt: null },
      include: {
        business: { select: { name: true, subdomain: true } },
        customer: { select: { email: true } },
        onlineOrderDetails: { select: { buyerEmail: true } },
        items: { select: { variantId: true, productName: true, variantLabel: true, quantity: true, unitPrice: true, editedPrice: true, isConcept: true } },
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
      // El cambio de estado se escribe CONDICIONADO al estado que se leyó:
      // si dos personas (o un doble click con timeout) disparan la misma
      // transición a la vez, la segunda no encuentra fila para actualizar y
      // corta acá — sin descontar (ni reingresar) el stock dos veces. Es el
      // mismo patrón que ya usan las devoluciones al aprobar/rechazar.
      const escrito = await tx.order.updateMany({
        where: { id: order.id, businessId, status: order.status },
        data: { status: nuevo },
      });
      if (escrito.count === 0) {
        throw new UnprocessableEntityException('El pedido ya cambió de estado — recargá para ver cómo quedó.');
      }
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

        // Descuento y movimiento por producto (una sola vez por variante). El
        // decremento va CONDICIONADO a que siga habiendo stock suficiente
        // (quantity >= cantidad): si otro pedido confirmó en paralelo y dejó la
        // fila corta entre el chequeo de arriba y esta escritura, el updateMany
        // no afecta ninguna fila y se corta (rollback de toda la transacción).
        // Sin esto, dos confirmaciones simultáneas del mismo producto podían
        // sobrevender (ambas leían el mismo stock y descontaban las dos).
        for (const [variantId, pedido] of porVariante) {
          const row = stockDe.get(variantId);
          if (row) {
            const dec = await tx.variantStock.updateMany({
              where: { id: row.id, quantity: { gte: pedido.cantidad } },
              data: { quantity: { decrement: pedido.cantidad } },
            });
            if (dec.count === 0) {
              throw new UnprocessableEntityException(
                `No se puede confirmar: se quedó sin stock de "${pedido.nombre}" mientras confirmabas. Recargá.`,
              );
            }
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

    if (nuevo === 'CANCELLED') {
      this.eventEmitter.emit('notification.pedido_cancelado', {
        businessId,
        orderNumber: order.orderNumber,
        orderId: order.id,
      });
    }

    if (nuevo === 'CONFIRMED') {
      const stockRows = await this.prisma.variantStock.findMany({
        where: { variantId: { in: renglonesConStock.map((it) => it.variantId) }, branchId: order.branchId },
        include: { variant: { include: { product: { select: { name: true } }, optionValues: { include: { optionValue: true } } } } },
      });
      for (const row of stockRows) {
        if (row.quantity <= row.stockMin) {
          const variantLabel = row.variant.optionValues.length > 0
            ? row.variant.optionValues.map((ov) => ov.optionValue.value).join(' / ')
            : null;
          this.eventEmitter.emit('notification.stock_critico', {
            businessId,
            productName: row.variant.product.name,
            variantLabel,
            currentStock: row.quantity,
            variantId: row.variantId,
          });
        }
      }
    }

    // ── Avisos al comprador por email ─────────────────────────────────────
    // Un solo lugar para todos: se manda al email de la compra online o, si
    // no hay, al de la ficha del cliente. El aviso nunca puede romper el
    // cambio de estado: si el mail falla, queda anotado en el log y listo.
    const destino = order.onlineOrderDetails?.buyerEmail ?? order.customer?.email ?? null;
    if (destino) {
      const frontend = process.env.FRONTEND_URL ?? 'http://localhost:3001';
      const meta = { businessId, customerId: order.customerId ?? undefined };
      try {
        if (nuevo === 'CONFIRMED') {
          // Con el detalle completo: es la "factura" informal de la compra.
          await this.mail.sendOrderConfirmation(destino, {
            storeName: order.business.name,
            orderNumber: order.orderNumber,
            total: fmtPesos(Number(order.total)),
            items: order.items.map((it) => ({
              name: `${it.productName}${it.variantLabel ? ` · ${it.variantLabel}` : ''}`,
              quantity: it.quantity,
              price: fmtPesos(Number(it.editedPrice ?? it.unitPrice)),
            })),
          }, meta);
        }
        if (nuevo === 'SHIPPED') {
          // Sin tracking: no hay integración con correos, y un número de
          // guía inventado es peor que ninguno.
          await this.mail.sendOrderShipped(destino, {
            storeName: order.business.name,
            orderNumber: order.orderNumber,
          }, meta);
        }
        if (nuevo === 'CANCELLED') {
          await this.mail.sendOrderCancelled(destino, {
            storeName: order.business.name,
            orderNumber: order.orderNumber,
          }, meta);
        }
        if (nuevo === 'DELIVERED') {
          await this.mail.sendOrderDelivered(destino, {
            storeName: order.business.name,
            orderNumber: order.orderNumber,
          }, meta);
          await this.mail.sendReviewRequest(destino, {
            storeName: order.business.name,
            productName: order.items[0]?.productName ?? 'tu compra',
            reviewUrl: `${frontend}/tienda/${order.business.subdomain}/pedido/${order.id}`,
          }, meta);
        }
      } catch (e) {
        this.logger.warn(`No se pudo mandar el aviso de "${nuevo}" del pedido #${order.orderNumber}: ${e}`);
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

    // sent refleja lo que pasó de verdad: en fase de prueba de Resend (o si el
    // proveedor rechaza el destinatario) sendOrderConfirmation devuelve false y
    // el panel no debe decir "enviado". Un fallo de transporte relanza y sale
    // como 4xx, igual que en sendEmail().
    let sent = false;
    try {
      sent = await this.mail.sendOrderConfirmation(email, {
        storeName: order.business.name,
        orderNumber: order.orderNumber,
        total: fmtPesos(Number(order.total)),
        items: order.items.map((it) => ({
          name: `${it.productName}${it.variantLabel ? ` · ${it.variantLabel}` : ''}`,
          quantity: it.quantity,
          price: fmtPesos(Number(it.editedPrice ?? it.unitPrice)),
        })),
      }, { businessId, customerId: order.customerId ?? undefined });
    } catch (e) {
      this.logger.warn(`Falló el envío del comprobante del pedido ${id}: ${e}`);
      sent = false;
    }
    return { url, sent };
  }

  // ── Email al cliente ──────────────────────────────────────────────────────
  // (Fase 3 — Ale) Le escribe al cliente directo desde el pedido: asunto y
  // cuerpo libres, con el layout de marca de la tienda. El destinatario sale
  // del propio pedido (el cliente registrado o, si no hay, el comprador que
  // se cargó a mano). El envío queda en email_logs con el customerId, que es
  // lo que después alimenta la actividad del cliente.
  async sendEmail(businessId: string, id: string, subject: string, body: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, businessId, deletedAt: null },
      include: {
        customer: { select: { email: true } },
        onlineOrderDetails: { select: { buyerEmail: true } },
      },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const to = order.customer?.email ?? order.onlineOrderDetails?.buyerEmail ?? null;
    if (!to) throw new UnprocessableEntityException('Este pedido no tiene un email de contacto.');

    // sendCustomEmail devuelve false si el proveedor lo rechazó, pero RELANZA
    // ante un fallo de transporte (timeout, red). Los dos casos son lo mismo
    // para quien está mirando la pantalla: el mail no salió.
    let salio = false;
    try {
      salio = await this.mail.sendCustomEmail(to, subject, body.replace(/\n/g, '<br/>'), {
        businessId,
        customerId: order.customerId ?? undefined,
      });
    } catch (e) {
      this.logger.warn(`Falló el envío del email del pedido ${id}: ${e}`);
      salio = false;
    }
    if (!salio) {
      throw new UnprocessableEntityException('No se pudo enviar el email. Probá de nuevo en un rato.');
    }
    return { sent: true, to };
  }
}

