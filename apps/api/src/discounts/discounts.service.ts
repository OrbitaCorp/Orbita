import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FindDiscountsQueryDto } from './dto/find-discounts-query.dto';
import { UpsertDiscountDto } from './dto/upsert-discount.dto';
import { EvaluateDiscountsDto, CartItemInput } from './dto/evaluate-discounts.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { CartItemForEngine, EligibleDiscount, evaluateCart } from './discount-engine';
import { estadoDe, whereDeEstado, resumenesDeAlcance } from './discount-status.util';

// (RBT-613 / RBT-614) Descuentos del panel + motor de evaluación.
//
// Alcance: este service maneja DESCUENTOS, o sea filas de `discounts` con
// `code = null`. Los cupones (code ≠ null) son RBT-615/616 y van aparte, aunque
// compartan tabla. Todo query filtra por `code: null` además de `businessId`
// para que un cupón nunca se cuele en el listado del tab "Descuentos".
//
// Solo los 4 tipos "triviales" de V1 (ver `discount-engine.ts`). Los 3 avanzados
// los rechaza `UpsertDiscountDto` con 400, como pide el ticket RBT-613.

@Injectable()
export class DiscountsService {
  constructor(private readonly prisma: PrismaService) {}

  // Estado derivado, filtro SQL de estado y resumen de alcance viven en
  // discount-status.util.ts (compartidos con CouponsService).

  // ── Listado (RBT-614) ──────────────────────────────────────────────────────
  async findAll(businessId: string, q: FindDiscountsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const now = new Date();

    const where: Prisma.DiscountWhereInput = { businessId, code: null, deletedAt: null };
    if (q.type) where.type = q.type;
    if (q.search) where.name = { contains: q.search, mode: 'insensitive' };
    if (q.status) Object.assign(where, whereDeEstado(q.status, now));

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.discount.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { products: true, categories: true },
      }),
      this.prisma.discount.count({ where }),
    ]);

    const resumenes = await resumenesDeAlcance(this.prisma, businessId, rows);

    return {
      data: rows.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        value: Number(d.value),
        scope: d.scope,
        application: d.application,
        alcanceResumen: resumenes.get(d.id) ?? '',
        startDate: d.startDate,
        endDate: d.endDate,
        // "Recurrente" en la columna Vigencia cuando el descuento no corre
        // todos los días/todo el día.
        recurrente: d.activeDays.length > 0 || !!d.startTime || !!d.endTime,
        maxUsesTotal: d.maxUsesTotal,
        usesConsumed: d.usesConsumed,
        isActive: d.isActive,
        estado: estadoDe(d, now),
        createdAt: d.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  // ── Detalle ────────────────────────────────────────────────────────────────
  async findOne(businessId: string, id: string) {
    const d = await this.prisma.discount.findFirst({
      where: { id, businessId, code: null, deletedAt: null },
      include: { products: true, categories: true },
    });
    if (!d) throw new NotFoundException('Descuento no encontrado');

    const resumenes = await resumenesDeAlcance(this.prisma, businessId, [d]);

    return {
      id: d.id,
      name: d.name,
      type: d.type,
      value: Number(d.value),
      scope: d.scope,
      productLevel: d.productLevel,
      minQuantity: d.minQuantity,
      minAmount: d.minAmount != null ? Number(d.minAmount) : null,
      application: d.application,
      alcanceResumen: resumenes.get(d.id) ?? '',
      startDate: d.startDate,
      endDate: d.endDate,
      activeDays: d.activeDays,
      startTime: d.startTime,
      endTime: d.endTime,
      recurrente: d.activeDays.length > 0 || !!d.startTime || !!d.endTime,
      maxUsesTotal: d.maxUsesTotal,
      maxUsesPerCustomer: d.maxUsesPerCustomer,
      usesConsumed: d.usesConsumed,
      isActive: d.isActive,
      priority: d.priority,
      linkActive: d.linkActive,
      estado: estadoDe(d, new Date()),
      productIds: d.products.map((p) => p.productId),
      categoryIds: d.categories.map((c) => c.categoryId),
      createdBy: d.createdBy,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }

  // ── Validaciones cruzadas (RF-11) ──────────────────────────────────────────
  // Las que dependen de más de un campo a la vez; las de un solo campo ya las
  // cubre `UpsertDiscountDto` con decoradores.
  private validarReglas(dto: UpsertDiscountDto): void {
    const esPorcentaje = dto.type === 'PERCENT_PRODUCT' || dto.type === 'PERCENT_TICKET';
    if (esPorcentaje && (dto.value <= 0 || dto.value > 100)) {
      throw new BadRequestException('El porcentaje tiene que estar entre 1 y 100.');
    }
    if (!esPorcentaje && dto.value <= 0) {
      throw new BadRequestException('El monto tiene que ser mayor a 0.');
    }
    if (dto.scope === 'TICKET') {
      if (dto.productIds?.length || dto.categoryIds?.length) {
        throw new BadRequestException('Un descuento de ticket no lleva productos ni categorías.');
      }
    } else if (!dto.productIds?.length && !dto.categoryIds?.length) {
      throw new BadRequestException('Elegí al menos un producto o una categoría para este alcance.');
    }
    if (dto.scope === 'PRODUCT' && !dto.productLevel) {
      throw new BadRequestException('Indicá si aplica al producto padre o a una variante específica.');
    }
    if (dto.endDate && new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('La fecha de fin tiene que ser posterior a la de inicio.');
    }
    if (dto.activeDays?.some((d) => d < 0 || d > 6)) {
      throw new BadRequestException('Los días de vigencia van de 0 (domingo) a 6 (sábado).');
    }
  }

  // Un descuento no puede apuntar a productos/categorías de otro negocio (RF-15).
  private async validarPertenencia(businessId: string, dto: UpsertDiscountDto): Promise<void> {
    if (dto.categoryIds?.length) {
      const n = await this.prisma.category.count({ where: { id: { in: dto.categoryIds }, businessId } });
      if (n !== dto.categoryIds.length) {
        throw new BadRequestException('Alguna de las categorías elegidas no existe en tu negocio.');
      }
    }
    if (dto.productIds?.length) {
      const n =
        dto.productLevel === 'variante'
          ? await this.prisma.productVariant.count({
              where: { id: { in: dto.productIds }, product: { businessId, deletedAt: null } },
            })
          : await this.prisma.product.count({
              where: { id: { in: dto.productIds }, businessId, deletedAt: null },
            });
      if (n !== dto.productIds.length) {
        throw new BadRequestException('Alguno de los productos elegidos no existe en tu negocio.');
      }
    }
  }

  // Campos compartidos por create/update (el mapeo DTO → columnas).
  private datosDe(dto: UpsertDiscountDto) {
    return {
      name: dto.name,
      type: dto.type as Prisma.DiscountCreateInput['type'],
      value: new Prisma.Decimal(dto.value),
      scope: dto.scope as Prisma.DiscountCreateInput['scope'],
      productLevel: dto.productLevel ?? null,
      minQuantity: dto.minQuantity ?? null,
      minAmount: dto.minAmount != null ? new Prisma.Decimal(dto.minAmount) : null,
      application: (dto.application as Prisma.DiscountCreateInput['application']) ?? 'AUTOMATIC',
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      activeDays: dto.activeDays ?? [],
      startTime: dto.startTime ?? null,
      endTime: dto.endTime ?? null,
      maxUsesTotal: dto.maxUsesTotal ?? null,
      maxUsesPerCustomer: dto.maxUsesPerCustomer ?? null,
      isPrivate: dto.isPrivate ?? false,
      priority: dto.priority ?? 0,
      linkActive: dto.linkActive ?? false,
    };
  }

  // ── Alta ───────────────────────────────────────────────────────────────────
  async create(businessId: string, memberId: string, dto: UpsertDiscountDto) {
    this.validarReglas(dto);
    await this.validarPertenencia(businessId, dto);

    const duplicado = await this.prisma.discount.findFirst({
      where: { businessId, code: null, name: dto.name, deletedAt: null },
    });
    if (duplicado) throw new BadRequestException('Ya existe un descuento con ese nombre.');

    const creado = await this.prisma.$transaction(async (tx) => {
      const discount = await tx.discount.create({
        data: { businessId, ...this.datosDe(dto), createdBy: memberId },
      });
      if (dto.productIds?.length) {
        await tx.discountProduct.createMany({
          data: dto.productIds.map((productId) => ({ discountId: discount.id, productId })),
        });
      }
      if (dto.categoryIds?.length) {
        await tx.discountCategory.createMany({
          data: dto.categoryIds.map((categoryId) => ({ discountId: discount.id, categoryId })),
        });
      }
      return discount;
    });

    return this.findOne(businessId, creado.id);
  }

  // ── Edición ────────────────────────────────────────────────────────────────
  async update(businessId: string, id: string, dto: UpsertDiscountDto) {
    this.validarReglas(dto);
    await this.validarPertenencia(businessId, dto);

    const existente = await this.prisma.discount.findFirst({
      where: { id, businessId, code: null, deletedAt: null },
    });
    if (!existente) throw new NotFoundException('Descuento no encontrado');

    const duplicado = await this.prisma.discount.findFirst({
      where: { businessId, code: null, name: dto.name, deletedAt: null, id: { not: id } },
    });
    if (duplicado) throw new BadRequestException('Ya existe un descuento con ese nombre.');

    await this.prisma.$transaction(async (tx) => {
      // El where lleva businessId además del id: evita el TOCTUO de actualizar
      // por id "a ciegas" (mismo criterio que se corrigió en Catálogo).
      await tx.discount.updateMany({ where: { id, businessId }, data: this.datosDe(dto) });
      // Reemplazo completo de la selección: más simple y menos propenso a bugs
      // que un diff, y el volumen de filas por descuento es chico.
      await tx.discountProduct.deleteMany({ where: { discountId: id } });
      await tx.discountCategory.deleteMany({ where: { discountId: id } });
      if (dto.productIds?.length) {
        await tx.discountProduct.createMany({
          data: dto.productIds.map((productId) => ({ discountId: id, productId })),
        });
      }
      if (dto.categoryIds?.length) {
        await tx.discountCategory.createMany({
          data: dto.categoryIds.map((categoryId) => ({ discountId: id, categoryId })),
        });
      }
    });

    return this.findOne(businessId, id);
  }

  // ── Activar / desactivar ───────────────────────────────────────────────────
  async toggle(businessId: string, id: string) {
    const existente = await this.prisma.discount.findFirst({
      where: { id, businessId, code: null, deletedAt: null },
      select: { id: true, isActive: true },
    });
    if (!existente) throw new NotFoundException('Descuento no encontrado');

    await this.prisma.discount.updateMany({
      where: { id, businessId },
      data: { isActive: !existente.isActive },
    });
    return this.findOne(businessId, id);
  }

  // ── Baja (RBT-614: "alta, edición y baja") ─────────────────────────────────
  // Soft-delete: el descuento pudo haberse aplicado a ventas históricas
  // (DiscountRedemption lo referencia), así que la fila se conserva.
  async remove(businessId: string, id: string) {
    const existente = await this.prisma.discount.findFirst({
      where: { id, businessId, code: null, deletedAt: null },
      select: { id: true },
    });
    if (!existente) throw new NotFoundException('Descuento no encontrado');

    await this.prisma.discount.updateMany({
      where: { id, businessId },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { ok: true };
  }

  // Resuelve variante → precio/producto/categoría REAL de la base (nunca del
  // request: aceptar un precio del cliente permitiría inflar el subtotal para
  // disparar un descuento/cupón con monto mínimo). Compartido por evaluate()
  // y validateCoupon() (RBT-616).
  private async resolverItemsDelCarrito(businessId: string, items: CartItemInput[]): Promise<CartItemForEngine[]> {
    const variantIds = [...new Set(items.map((it) => it.variantId))];
    const variantes = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, product: { businessId, deletedAt: null } },
      select: { id: true, price: true, productId: true, product: { select: { categoryId: true } } },
    });
    const porId = new Map(variantes.map((v) => [v.id, v]));

    const desconocidas = variantIds.filter((id) => !porId.has(id));
    if (desconocidas.length) {
      throw new BadRequestException('Alguno de los productos del carrito no existe en este negocio.');
    }

    return items.map((it) => {
      const v = porId.get(it.variantId)!;
      return {
        variantId: it.variantId,
        productId: v.productId,
        categoryId: v.product.categoryId,
        quantity: it.quantity,
        unitPrice: Number(v.price),
      };
    });
  }

  // Todos los descuentos AUTOMÁTICOS (sin código) vigentes AHORA MISMO para un
  // negocio — isActive, dentro de startDate/endDate, y (chequeo que no se puede
  // expresar en SQL con Prisma) dentro de activeDays/startTime/endTime y con
  // cupo disponible. Extraído de lo que antes vivía inline en evaluate() (único
  // caller hasta ahora) — el storefront (RBT-613: catálogo/carrito/checkout con
  // descuentos automáticos reales) también lo necesita, así que pasa a ser
  // reutilizable en vez de quedar pegado a ese endpoint.
  private async descuentosAutomaticosVigentes(businessId: string): Promise<EligibleDiscount[]> {
    const now = new Date();
    const diaSemana = now.getDay(); // 0 = domingo, igual que activeDays
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const rows = await this.prisma.discount.findMany({
      where: {
        businessId,
        code: null, // los cupones se validan en /discounts/validate (RBT-616)
        deletedAt: null,
        isActive: true,
        application: 'AUTOMATIC', // los manuales los aplica una persona, no el motor
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: { products: true, categories: true },
      orderBy: { createdAt: 'asc' }, // desempate determinístico en el engine
    });

    const vigentes = rows.filter((d) => {
      if (d.activeDays.length > 0 && !d.activeDays.includes(diaSemana)) return false;
      if (d.startTime && hhmm < d.startTime) return false;
      if (d.endTime && hhmm > d.endTime) return false;
      if (d.maxUsesTotal != null && d.usesConsumed >= d.maxUsesTotal) return false;
      return true;
    });

    return vigentes.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type as EligibleDiscount['type'],
      value: Number(d.value),
      scope: d.scope as EligibleDiscount['scope'],
      productLevel: d.productLevel as EligibleDiscount['productLevel'],
      minAmount: d.minAmount != null ? Number(d.minAmount) : null,
      priority: d.priority,
      productIds: d.products.map((p) => p.productId),
      categoryIds: d.categories.map((c) => c.categoryId),
    }));
  }

  // ── Motor de evaluación (RBT-613) ──────────────────────────────────────────
  // Sin efectos secundarios (RNF-07): no incrementa usos ni crea redenciones —
  // eso pasa al confirmar la venta.
  async evaluate(businessId: string, dto: EvaluateDiscountsDto) {
    if (!dto.items?.length) throw new BadRequestException('El carrito no tiene ítems.');
    const items = await this.resolverItemsDelCarrito(businessId, dto.items);
    const elegibles = await this.descuentosAutomaticosVigentes(businessId);
    return evaluateCart(items, elegibles);
  }

  // ── Descuentos automáticos para el catálogo/detalle del storefront (RBT-613) ──
  // A diferencia de evaluate()/evaluarCarritoAutomatico(), acá el CALLER ya
  // tiene precio/producto/categoría cargados (viene de listProducts()/
  // getProduct(), que ya trajeron las variantes) — no hace falta volver a
  // pegarle a la base por eso. Se evalúa con quantity:1 (el "precio unitario ya
  // descontado" que se muestra en la card/detalle), y se excluyen los de
  // alcance TICKET: sin un carrito real con cantidades no hay subtotal contra
  // el cual aplicarlos, y mostrar un badge de "descuento de ticket" en un solo
  // producto sería engañoso.
  async descuentosDeItems(
    businessId: string,
    items: { variantId: string; productId: string | null; categoryId: string | null; unitPrice: number }[],
  ): Promise<Map<string, { amount: number; discountId: string; discountName: string }>> {
    const mapa = new Map<string, { amount: number; discountId: string; discountName: string }>();
    if (!items.length) return mapa;

    const elegibles = (await this.descuentosAutomaticosVigentes(businessId)).filter((d) => d.scope !== 'TICKET');
    if (!elegibles.length) return mapa;

    const cartItems: CartItemForEngine[] = items.map((it) => ({ ...it, quantity: 1 }));
    const resultado = evaluateCart(cartItems, elegibles);
    for (const d of resultado.itemDiscounts) {
      mapa.set(d.variantId, { amount: d.amount, discountId: d.discountId, discountName: d.discountName });
    }
    return mapa;
  }

  // ── Descuentos automáticos para el carrito real (RBT-613) ─────────────────
  // A diferencia de descuentosDeItems(), acá SÍ hay cantidades reales (el
  // carrito del cliente) — incluye alcance TICKET, que necesita un subtotal de
  // verdad. Usado por StorefrontService.validateCart().
  async evaluarCarritoAutomatico(businessId: string, rawItems: CartItemInput[]) {
    if (!rawItems.length) return evaluateCart([], []);
    const items = await this.resolverItemsDelCarrito(businessId, rawItems);
    const elegibles = await this.descuentosAutomaticosVigentes(businessId);
    return evaluateCart(items, elegibles);
  }

  // Resuelve un código de cupón a un `EligibleDiscount` verificando TODO lo que
  // no depende del carrito (existe/activo/vigente/no agotado/límite por
  // cliente) — extraído de validateCoupon() para poder reutilizarlo en
  // resolverDescuentosParaOrden() sin llamar a evaluateCart() por separado (ver
  // comentario ahí sobre por qué no se puede evaluar el cupón aislado del resto
  // de los descuentos automáticos). Devuelve también la fila cruda del cupón
  // (para el `code`, que `EligibleDiscount` no lleva).
  private async resolverCuponElegible(
    businessId: string,
    code: string,
    customerId: string | undefined,
  ): Promise<
    | { ok: true; elegible: EligibleDiscount; coupon: { id: string; code: string | null; name: string } }
    | { ok: false; reason: string }
  > {
    const now = new Date();
    const coupon = await this.prisma.discount.findFirst({
      where: { businessId, code: code.trim(), deletedAt: null },
      include: { products: true, categories: true },
    });
    if (!coupon) return { ok: false, reason: 'No existe un cupón con ese código.' };
    if (!coupon.isActive) return { ok: false, reason: 'Este cupón está desactivado.' };
    if (coupon.startDate > now) return { ok: false, reason: 'Este cupón todavía no está vigente.' };
    if (coupon.endDate && coupon.endDate < now) return { ok: false, reason: 'Este cupón ya expiró.' };
    if (coupon.maxUsesTotal != null && coupon.usesConsumed >= coupon.maxUsesTotal) {
      return { ok: false, reason: 'Este cupón agotó sus usos disponibles.' };
    }
    // El límite por cliente solo se puede chequear si sabemos quién es (una
    // venta anónima no tiene con qué comparar).
    if (customerId && coupon.maxUsesPerCustomer != null) {
      const usosDelCliente = await this.prisma.discountRedemption.count({
        where: { discountId: coupon.id, customerId },
      });
      if (usosDelCliente >= coupon.maxUsesPerCustomer) {
        return { ok: false, reason: 'Ya usaste este cupón el máximo de veces permitido.' };
      }
    }

    return {
      ok: true,
      coupon: { id: coupon.id, code: coupon.code, name: coupon.name },
      elegible: {
        id: coupon.id,
        name: coupon.name,
        type: coupon.type as EligibleDiscount['type'],
        value: Number(coupon.value),
        scope: coupon.scope as EligibleDiscount['scope'],
        productLevel: coupon.productLevel as EligibleDiscount['productLevel'],
        minAmount: coupon.minAmount != null ? Number(coupon.minAmount) : null,
        priority: coupon.priority,
        productIds: coupon.products.map((p) => p.productId),
        categoryIds: coupon.categories.map((c) => c.categoryId),
      },
    };
  }

  // ── Validar cupón (RBT-616) ────────────────────────────────────────────────
  // Sin efectos secundarios: solo valida y calcula, no canjea (el canje ocurre
  // al crear el pedido — ver resolverDescuentosParaOrden()). Firma y respuesta
  // sin cambios: lo sigue usando POST /discounts/validate tal cual.
  async validateCoupon(businessId: string, dto: ValidateCouponDto) {
    const resuelto = await this.resolverCuponElegible(businessId, dto.code, dto.customerId);
    if (!resuelto.ok) return { valid: false, reason: resuelto.reason };

    if (!dto.items?.length) throw new BadRequestException('El carrito no tiene ítems.');
    const items = await this.resolverItemsDelCarrito(businessId, dto.items);

    if (resuelto.elegible.minAmount != null) {
      const subtotal = items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
      if (subtotal < resuelto.elegible.minAmount) {
        return { valid: false, reason: `El monto mínimo para este cupón es $${resuelto.elegible.minAmount}.` };
      }
    }

    const resultado = evaluateCart(items, [resuelto.elegible]);

    // Un cupón de alcance PRODUCT/CATEGORY que no matchea ningún ítem del
    // carrito da discountTotal:0 — se trata igual que "no aplica", no como un
    // cupón válido que por casualidad descuenta $0.
    if (resultado.discountTotal <= 0) {
      return { valid: false, reason: 'Este cupón no aplica a los productos de tu carrito.' };
    }

    return {
      valid: true,
      discount: {
        id: resuelto.coupon.id,
        code: resuelto.coupon.code!,
        name: resuelto.coupon.name,
        discountTotal: resultado.discountTotal,
        itemDiscounts: resultado.itemDiscounts,
        ticketDiscount: resultado.ticketDiscount,
      },
    };
  }

  // ── Resolver TODOS los descuentos al crear un pedido (RBT-616 + RBT-613) ──
  // Reemplaza a la vieja resolverCuponParaOrden(): antes solo se resolvía el
  // cupón (si había código); ahora también entran los descuentos automáticos
  // vigentes, y TODO se evalúa en una única llamada a evaluateCart() — es
  // clave que sea una sola: si el cupón y un automático se evaluaran por
  // separado y se sumaran los montos, un mismo renglón podría terminar
  // descontado dos veces. Pasándolos juntos, el "mejor descuento gana" del
  // motor arbitra correctamente por ítem y por ticket.
  //
  // Usado por OrdersService.create(). A diferencia de validateCoupon() (que
  // devuelve {valid:false, reason} para que el frontend muestre el motivo sin
  // que sea un error HTTP), acá conviene una excepción si el código no vale:
  // la creación del pedido tiene que abortar.
  async resolverDescuentosParaOrden(
    businessId: string,
    rawItems: CartItemInput[],
    opts: { code?: string; customerId?: string },
  ): Promise<{ discountTotal: number; redenciones: { discountId: string; amount: number }[] }> {
    if (!rawItems.length) return { discountTotal: 0, redenciones: [] };

    const items = await this.resolverItemsDelCarrito(businessId, rawItems);
    const elegibles = await this.descuentosAutomaticosVigentes(businessId);

    if (opts.code) {
      const resuelto = await this.resolverCuponElegible(businessId, opts.code, opts.customerId);
      if (!resuelto.ok) throw new BadRequestException(resuelto.reason);
      if (resuelto.elegible.minAmount != null) {
        const subtotal = items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
        if (subtotal < resuelto.elegible.minAmount) {
          throw new BadRequestException(`El monto mínimo para este cupón es $${resuelto.elegible.minAmount}.`);
        }
      }
      // Mismo chequeo que validateCoupon(): un cupón que no matchea ningún
      // ítem no es "válido pero descuenta $0", es inválido para este carrito.
      const soloCupon = evaluateCart(items, [resuelto.elegible]);
      if (soloCupon.discountTotal <= 0) {
        throw new BadRequestException('Este cupón no aplica a los productos de tu carrito.');
      }
      elegibles.push(resuelto.elegible);
    }

    if (!elegibles.length) return { discountTotal: 0, redenciones: [] };

    const resultado = evaluateCart(items, elegibles);

    // Agrupado por discountId: puede haber más de un descuento automático
    // distinto en el mismo pedido (uno por renglón), además del ticket.
    const porDescuento = new Map<string, number>();
    for (const it of resultado.itemDiscounts) {
      porDescuento.set(it.discountId, (porDescuento.get(it.discountId) ?? 0) + it.amount);
    }
    if (resultado.ticketDiscount) {
      const t = resultado.ticketDiscount;
      porDescuento.set(t.discountId, (porDescuento.get(t.discountId) ?? 0) + t.amount);
    }

    return {
      discountTotal: resultado.discountTotal,
      redenciones: [...porDescuento.entries()].map(([discountId, amount]) => ({ discountId, amount })),
    };
  }
}
