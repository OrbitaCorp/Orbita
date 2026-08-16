import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { FindCouponsQueryDto } from './dto/find-coupons-query.dto';
import { UpsertCouponDto } from './dto/upsert-coupon.dto';
import { SendCouponLinkEmailDto } from './dto/send-link-email.dto';
import { estadoDe, whereDeEstado, resumenesDeAlcance, EstadoDiscount } from '../discounts/discount-status.util';

// (RBT-615) Cupones del panel. Comparten la tabla `discounts` con los descuentos,
// pero un cupón es una fila con `code ≠ null`. Todo query filtra `code: { not: null }`
// además de `businessId`, para que un descuento nunca se cuele en el listado de
// cupones ni viceversa. Estado derivado y resumen de alcance se comparten con
// DiscountsService vía discount-status.util.ts.
//
// Solo los 4 tipos triviales de V1. El canje real (validar/aplicar + escribir
// DiscountRedemption) es RBT-616, todavía no implementado.

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // Envío libre del link de un cupón exclusivo — mismo patrón que
  // CustomersService.sendEmail() pero SIN validar contra la tabla de
  // clientes (a propósito: puede ser cualquier email, exista o no como
  // cliente). El asunto/cuerpo ya vienen armados del lado del panel (con el
  // link y el código incluidos); acá solo se despacha.
  async sendLinkEmail(businessId: string, dto: SendCouponLinkEmailDto) {
    const salio = await this.mail.sendCustomEmail(dto.to, dto.subject, dto.body, { businessId });
    return { sent: salio };
  }

  // ── Listado ────────────────────────────────────────────────────────────────
  async findAll(businessId: string, q: FindCouponsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const now = new Date();

    const where: Prisma.DiscountWhereInput = { businessId, code: { not: null }, deletedAt: null };
    if (q.type) where.type = q.type as Prisma.DiscountWhereInput['type'];
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { code: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.status) Object.assign(where, whereDeEstado(q.status as EstadoDiscount, now));

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
        code: d.code,
        name: d.name,
        type: d.type,
        value: Number(d.value),
        scope: d.scope,
        alcanceResumen: resumenes.get(d.id) ?? '',
        startDate: d.startDate,
        endDate: d.endDate,
        maxUsesTotal: d.maxUsesTotal,
        maxUsesPerCustomer: d.maxUsesPerCustomer,
        usesConsumed: d.usesConsumed,
        isPrivate: d.isPrivate,
        isActive: d.isActive,
        estado: estadoDe(d, now),
        linkActive: d.linkActive,
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
      where: { id, businessId, code: { not: null }, deletedAt: null },
      include: { products: true, categories: true },
    });
    if (!d) throw new NotFoundException('Cupón no encontrado');

    const resumenes = await resumenesDeAlcance(this.prisma, businessId, [d]);

    return {
      id: d.id,
      code: d.code,
      name: d.name,
      type: d.type,
      value: Number(d.value),
      scope: d.scope,
      productLevel: d.productLevel,
      minAmount: d.minAmount != null ? Number(d.minAmount) : null,
      alcanceResumen: resumenes.get(d.id) ?? '',
      startDate: d.startDate,
      endDate: d.endDate,
      maxUsesTotal: d.maxUsesTotal,
      maxUsesPerCustomer: d.maxUsesPerCustomer,
      usesConsumed: d.usesConsumed,
      isPrivate: d.isPrivate,
      isActive: d.isActive,
      estado: estadoDe(d, new Date()),
      linkActive: d.linkActive,
      linkRedirect: d.linkRedirect,
      productIds: d.products.map((p) => p.productId),
      categoryIds: d.categories.map((c) => c.categoryId),
      createdBy: d.createdBy,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }

  // ── Validaciones cruzadas (RF-11) ──────────────────────────────────────────
  private validarReglas(dto: UpsertCouponDto): void {
    if (!dto.code.trim()) throw new BadRequestException('El código del cupón es obligatorio.');
    const esPorcentaje = dto.type === 'PERCENT_PRODUCT' || dto.type === 'PERCENT_TICKET';
    if (esPorcentaje && (dto.value <= 0 || dto.value > 100)) {
      throw new BadRequestException('El porcentaje tiene que estar entre 1 y 100.');
    }
    if (!esPorcentaje && dto.value <= 0) {
      throw new BadRequestException('El monto tiene que ser mayor a 0.');
    }
    if (dto.scope === 'TICKET') {
      if (dto.productIds?.length || dto.categoryIds?.length) {
        throw new BadRequestException('Un cupón de ticket no lleva productos ni categorías.');
      }
    } else if (!dto.productIds?.length && !dto.categoryIds?.length) {
      throw new BadRequestException('Elegí al menos un producto o una categoría para este alcance.');
    }
    if (dto.scope === 'PRODUCT' && !dto.productLevel) {
      throw new BadRequestException('Indicá si aplica al producto padre o a una variante específica.');
    }
    if (dto.endDate && new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('La fecha de expiración tiene que ser posterior a la de inicio.');
    }
  }

  // Un cupón no puede apuntar a productos/categorías de otro negocio (RF-15).
  private async validarPertenencia(businessId: string, dto: UpsertCouponDto): Promise<void> {
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

  // Mapeo DTO → columnas. `code` presente y `application: MANUAL` (los cupones se
  // aplican por código, no automáticamente — el motor los excluye por code≠null).
  private datosDe(dto: UpsertCouponDto) {
    return {
      code: dto.code.trim(),
      name: dto.name,
      type: dto.type as Prisma.DiscountCreateInput['type'],
      value: new Prisma.Decimal(dto.value),
      scope: dto.scope as Prisma.DiscountCreateInput['scope'],
      productLevel: dto.productLevel ?? null,
      minAmount: dto.minAmount != null ? new Prisma.Decimal(dto.minAmount) : null,
      application: 'MANUAL' as Prisma.DiscountCreateInput['application'],
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      maxUsesTotal: dto.maxUsesTotal ?? null,
      maxUsesPerCustomer: dto.maxUsesPerCustomer ?? null,
      isPrivate: dto.isPrivate ?? false,
      linkActive: dto.linkActive ?? false,
      linkRedirect: dto.linkRedirect ?? null,
    };
  }

  // ── Alta ───────────────────────────────────────────────────────────────────
  async create(businessId: string, memberId: string, dto: UpsertCouponDto) {
    this.validarReglas(dto);
    await this.validarPertenencia(businessId, dto);

    const dupNombre = await this.prisma.discount.findFirst({
      where: { businessId, code: { not: null }, name: dto.name, deletedAt: null },
    });
    if (dupNombre) throw new BadRequestException('Ya existe un cupón con ese nombre.');

    // Código único por negocio. El chequeo NO filtra `deletedAt`: el `@@unique`
    // del schema incluye las filas soft-deleted, así que el código de un cupón
    // dado de baja sigue tomado. Sin este check el create explotaba con un 500
    // (unique constraint) en vez de un 400 legible. (Ver PENDIENTES: si se quiere
    // reusar códigos tras la baja, hace falta un índice único parcial.)
    const dupCodigo = await this.prisma.discount.findFirst({
      where: { businessId, code: dto.code.trim() },
    });
    if (dupCodigo) throw new BadRequestException('Ya existe un cupón con ese código.');

    const creado = await this.prisma.$transaction(async (tx) => {
      const cupon = await tx.discount.create({
        data: { businessId, ...this.datosDe(dto), createdBy: memberId },
      });
      if (dto.productIds?.length) {
        await tx.discountProduct.createMany({
          data: dto.productIds.map((productId) => ({ discountId: cupon.id, productId })),
        });
      }
      if (dto.categoryIds?.length) {
        await tx.discountCategory.createMany({
          data: dto.categoryIds.map((categoryId) => ({ discountId: cupon.id, categoryId })),
        });
      }
      return cupon;
    });

    return this.findOne(businessId, creado.id);
  }

  // ── Edición ────────────────────────────────────────────────────────────────
  async update(businessId: string, id: string, dto: UpsertCouponDto) {
    this.validarReglas(dto);
    await this.validarPertenencia(businessId, dto);

    const existente = await this.prisma.discount.findFirst({
      where: { id, businessId, code: { not: null }, deletedAt: null },
    });
    if (!existente) throw new NotFoundException('Cupón no encontrado');

    const dupNombre = await this.prisma.discount.findFirst({
      where: { businessId, code: { not: null }, name: dto.name, deletedAt: null, id: { not: id } },
    });
    if (dupNombre) throw new BadRequestException('Ya existe un cupón con ese nombre.');

    // Sin filtrar `deletedAt` (ver el comentario en create): el @@unique cubre
    // las filas soft-deleted.
    const dupCodigo = await this.prisma.discount.findFirst({
      where: { businessId, code: dto.code.trim(), id: { not: id } },
    });
    if (dupCodigo) throw new BadRequestException('Ya existe un cupón con ese código.');

    await this.prisma.$transaction(async (tx) => {
      await tx.discount.updateMany({ where: { id, businessId }, data: this.datosDe(dto) });
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
      where: { id, businessId, code: { not: null }, deletedAt: null },
      select: { id: true, isActive: true },
    });
    if (!existente) throw new NotFoundException('Cupón no encontrado');

    await this.prisma.discount.updateMany({
      where: { id, businessId },
      data: { isActive: !existente.isActive },
    });
    return this.findOne(businessId, id);
  }

  // ── Baja (soft-delete) ──────────────────────────────────────────────────────
  // El cupón pudo haberse canjeado en ventas históricas (DiscountRedemption lo
  // referencia), así que la fila se conserva.
  async remove(businessId: string, id: string) {
    const existente = await this.prisma.discount.findFirst({
      where: { id, businessId, code: { not: null }, deletedAt: null },
      select: { id: true },
    });
    if (!existente) throw new NotFoundException('Cupón no encontrado');

    await this.prisma.discount.updateMany({
      where: { id, businessId },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { ok: true };
  }
}
