import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FindDiscountsQueryDto } from './dto/find-discounts-query.dto';
import { UpsertDiscountDto } from './dto/upsert-discount.dto';
import { EvaluateDiscountsDto } from './dto/evaluate-discounts.dto';
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

  // ── Motor de evaluación (RBT-613) ──────────────────────────────────────────
  // Sin efectos secundarios (RNF-07): no incrementa usos ni crea redenciones —
  // eso pasa al confirmar la venta.
  async evaluate(businessId: string, dto: EvaluateDiscountsDto) {
    if (!dto.items?.length) throw new BadRequestException('El carrito no tiene ítems.');

    const variantIds = [...new Set(dto.items.map((it) => it.variantId))];
    const variantes = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, product: { businessId, deletedAt: null } },
      select: { id: true, price: true, productId: true, product: { select: { categoryId: true } } },
    });
    const porId = new Map(variantes.map((v) => [v.id, v]));

    // Si un ítem no es de este negocio, se corta: aceptarlo permitiría inflar el
    // subtotal con precios inventados para disparar un descuento con monto mínimo.
    const desconocidas = variantIds.filter((id) => !porId.has(id));
    if (desconocidas.length) {
      throw new BadRequestException('Alguno de los productos del carrito no existe en este negocio.');
    }

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

    const elegibles: EligibleDiscount[] = vigentes.map((d) => ({
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

    // El precio sale de la BASE, no del request: el cliente no define cuánto
    // vale un producto (mismo criterio que `orders.service.ts` al crear pedidos).
    const items: CartItemForEngine[] = dto.items.map((it) => {
      const v = porId.get(it.variantId)!;
      return {
        variantId: it.variantId,
        productId: v.productId,
        categoryId: v.product.categoryId,
        quantity: it.quantity,
        unitPrice: Number(v.price),
      };
    });

    return evaluateCart(items, elegibles);
  }
}
