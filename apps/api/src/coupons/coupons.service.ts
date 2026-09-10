import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { escaparHtml } from '../common/utils/html';
import { FindCouponsQueryDto } from './dto/find-coupons-query.dto';
import { UpsertCouponDto } from './dto/upsert-coupon.dto';
import { SendCouponLinkEmailDto } from './dto/send-link-email.dto';
import { estadoDe, whereDeEstado, resumenesDeAlcance, EstadoDiscount, vigenciaDe } from '../discounts/discount-status.util';

// Código de cupón normalizado: sin espacios alrededor y en mayúsculas
// (auditoría interna 10/09, ítem api.coupons). Al 10/09 los 23 cupones de
// producción ya estaban en mayúsculas y sin choques.
function codigoDe(code: string): string {
  return code.trim().toUpperCase();
}

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
  // cliente).
  //
  // El asunto y el cuerpo se arman ACÁ, a partir del cupón (auditoría interna
  // 10/09, ítem api.coupons). Antes los armaba el panel y este endpoint
  // mandaba el HTML que le llegara, con el remitente de Órbita, a cualquier
  // dirección: con una sesión de admin se podía mandar cualquier cosa. Mismo
  // contenido que armaba LinkCompartibleModal.tsx, con todo lo tipeado
  // escapado.
  async sendLinkEmail(businessId: string, dto: SendCouponLinkEmailDto) {
    const [cupon, negocio] = await Promise.all([
      this.prisma.discount.findFirst({
        where: { id: dto.couponId, businessId, code: { not: null }, deletedAt: null },
        select: { code: true, type: true, value: true, scope: true },
      }),
      this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true, subdomain: true } }),
    ]);
    if (!cupon?.code || !negocio) throw new NotFoundException('Cupón no encontrado');

    const url = `https://${negocio.subdomain}.orbita.site/descuentos/${encodeURIComponent(cupon.code)}`;
    const esPorcentaje = cupon.type === 'PERCENT_PRODUCT' || cupon.type === 'PERCENT_TICKET';
    const valor = esPorcentaje ? `${Number(cupon.value)}%` : `$${Number(cupon.value).toLocaleString('es-AR')}`;
    const alcance = cupon.scope === 'TICKET' ? 'en tu compra' : 'en productos seleccionados';
    const nombre = dto.nombreDestino?.trim();
    const saludo = nombre ? `Hola ${escaparHtml(nombre)},` : 'Hola,';
    const link = escaparHtml(url);
    const html = `
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;color:#7C3AED;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Cupón exclusivo</div>
      <div style="font-size:40px;font-weight:800;color:#1E1B4B;line-height:1;">${escaparHtml(valor)} <span style="font-size:20px;font-weight:700;color:#6b7280;">OFF</span></div>
    </div>
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 4px;">${saludo}</p>
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 20px;">
      Te compartimos un cupón especial: <strong>${escaparHtml(`${valor} de descuento ${alcance}`)}</strong>. Copiá el código y pegalo en el checkout para aplicarlo.
    </p>
    <p style="text-align:center;margin:0 0 20px;">
      <a href="${link}" style="display:inline-block;padding:14px 32px;background:#2563EB;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Canjear mi cupón</a>
    </p>
    <p style="font-size:12px;color:#9ca3af;line-height:1.5;margin:0;">
      Si el botón no funciona, copiá y pegá este link: <a href="${link}" style="color:#2563EB;">${link}</a>
    </p>`.trim();

    const salio = await this.mail.sendCustomEmail(dto.to, `¡Tenés un cupón exclusivo en ${negocio.name}!`, html, { businessId });
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
    // Días completos de Argentina, igual que los descuentos (vigenciaDe).
    const { startDate, endDate } = vigenciaDe(dto);
    if (endDate && endDate <= startDate) {
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
      // En mayúsculas: el cliente puede tipearlo como quiera (se busca sin
      // distinguir mayúsculas, ver resolverCuponElegible).
      code: codigoDe(dto.code),
      name: dto.name,
      type: dto.type as Prisma.DiscountCreateInput['type'],
      value: new Prisma.Decimal(dto.value),
      scope: dto.scope as Prisma.DiscountCreateInput['scope'],
      productLevel: dto.productLevel ?? null,
      minAmount: dto.minAmount != null ? new Prisma.Decimal(dto.minAmount) : null,
      application: 'MANUAL' as Prisma.DiscountCreateInput['application'],
      ...vigenciaDe(dto),
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
      where: { businessId, code: { equals: codigoDe(dto.code), mode: 'insensitive' } },
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
      where: { businessId, code: { equals: codigoDe(dto.code), mode: 'insensitive' }, id: { not: id } },
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
