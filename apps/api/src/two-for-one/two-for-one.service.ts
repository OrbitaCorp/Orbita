import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertTwoForOneDto } from './dto/upsert-two-for-one.dto';

type PromoConDiscount = Prisma.TwoForOnePromoGetPayload<{
  include: { discount: { include: { products: true; categories: true } } };
}>;

// "2x1 y 3x2" (paquete Avanzado, RBT-675) — a diferencia de PromoModalService
// (puro anuncio), esto SÍ crea/gestiona Discounts reales tipo BUY_X_PAY_Y: el
// dueño configura acá "llevá X, pagá Y" + alcance, y este service arma el
// Discount que discount-engine.ts evalúa de verdad en el carrito (mismo
// patrón que "Juegos con premio": se gestiona sin pasar por el módulo
// genérico de Descuentos). Un negocio puede tener VARIAS promos a la vez
// (2026-09-04 — antes era una sola por negocio); el motor resuelve
// solapamientos de alcance entre ellas por createdAt asc (más vieja gana,
// ver computeBuyXPayYDiscounts).
@Injectable()
export class TwoForOneService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string) {
    const promos = await this.prisma.twoForOnePromo.findMany({
      where: { businessId },
      include: { discount: { include: { products: true, categories: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return promos.map((p) => this.toResponse(p));
  }

  async create(businessId: string, memberId: string, dto: UpsertTwoForOneDto) {
    await this.validar(businessId, dto);

    const nombre = `${dto.llevaCantidad}x${dto.pagaCantidad}`;
    const productos = dto.alcance === 'PRODUCT' ? (dto.productIds ?? []) : [];
    const categorias = dto.alcance === 'CATEGORY' ? (dto.categoryIds ?? []) : [];

    const promo = await this.prisma.$transaction(async (tx) => {
      const discount = await tx.discount.create({
        data: {
          name: nombre,
          type: 'BUY_X_PAY_Y',
          value: new Prisma.Decimal(dto.pagaCantidad),
          scope: dto.alcance as 'PRODUCT' | 'CATEGORY',
          productLevel: dto.alcance === 'PRODUCT' ? 'padre' : null,
          minQuantity: dto.llevaCantidad,
          application: 'AUTOMATIC',
          isActive: dto.isActive,
          isPrivate: false,
          businessId,
          createdBy: memberId,
          startDate: new Date(),
          products: { createMany: { data: productos.map((productId) => ({ productId })) } },
          categories: { createMany: { data: categorias.map((categoryId) => ({ categoryId })) } },
        },
      });

      return tx.twoForOnePromo.create({
        data: { businessId, discountId: discount.id, isActive: dto.isActive },
        include: { discount: { include: { products: true, categories: true } } },
      });
    });

    return this.toResponse(promo);
  }

  async update(businessId: string, id: string, dto: UpsertTwoForOneDto) {
    const existente = await this.prisma.twoForOnePromo.findFirst({ where: { id, businessId } });
    if (!existente) throw new NotFoundException('Esa promo no existe');
    await this.validar(businessId, dto);

    const nombre = `${dto.llevaCantidad}x${dto.pagaCantidad}`;
    const productos = dto.alcance === 'PRODUCT' ? (dto.productIds ?? []) : [];
    const categorias = dto.alcance === 'CATEGORY' ? (dto.categoryIds ?? []) : [];

    const promo = await this.prisma.$transaction(async (tx) => {
      await tx.discount.update({
        where: { id: existente.discountId },
        data: {
          name: nombre,
          value: new Prisma.Decimal(dto.pagaCantidad),
          scope: dto.alcance as 'PRODUCT' | 'CATEGORY',
          productLevel: dto.alcance === 'PRODUCT' ? 'padre' : null,
          minQuantity: dto.llevaCantidad,
          isActive: dto.isActive,
          products: { deleteMany: {}, createMany: { data: productos.map((productId) => ({ productId })) } },
          categories: { deleteMany: {}, createMany: { data: categorias.map((categoryId) => ({ categoryId })) } },
        },
      });

      return tx.twoForOnePromo.update({
        where: { id },
        data: { isActive: dto.isActive },
        include: { discount: { include: { products: true, categories: true } } },
      });
    });

    return this.toResponse(promo);
  }

  // Botón de toggle inline del listado — solo prende/apaga, sin tocar el
  // resto de la config (mismo criterio que DiscountsService#toggle).
  async toggle(businessId: string, id: string) {
    const existente = await this.prisma.twoForOnePromo.findFirst({ where: { id, businessId } });
    if (!existente) throw new NotFoundException('Esa promo no existe');
    const nuevoEstado = !existente.isActive;

    const promo = await this.prisma.$transaction(async (tx) => {
      await tx.discount.update({ where: { id: existente.discountId }, data: { isActive: nuevoEstado } });
      return tx.twoForOnePromo.update({
        where: { id },
        data: { isActive: nuevoEstado },
        include: { discount: { include: { products: true, categories: true } } },
      });
    });

    return this.toResponse(promo);
  }

  // Soft-delete del Discount subyacente (mismo criterio que
  // DiscountsService#remove — deletedAt + isActive:false, nunca se borra la
  // fila de verdad) + delete duro de la fila TwoForOnePromo, que no tiene
  // valor propio fuera del vínculo.
  async remove(businessId: string, id: string) {
    const existente = await this.prisma.twoForOnePromo.findFirst({ where: { id, businessId } });
    if (!existente) throw new NotFoundException('Esa promo no existe');

    await this.prisma.$transaction([
      this.prisma.discount.update({
        where: { id: existente.discountId },
        data: { deletedAt: new Date(), isActive: false },
      }),
      this.prisma.twoForOnePromo.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  // Validaciones cruzadas (Y < X, alcance con al menos un producto/categoría
  // elegido) + pertenencia (los ids elegidos son de ESTE negocio) — mismo
  // criterio que DiscountsService#validarReglas/#validarPertenencia.
  private async validar(businessId: string, dto: UpsertTwoForOneDto): Promise<void> {
    if (dto.pagaCantidad >= dto.llevaCantidad) {
      throw new BadRequestException('"Pagá" tiene que ser menor a "Llevá" — si no, no hay descuento.');
    }
    if (dto.alcance === 'PRODUCT') {
      if (!dto.productIds?.length) {
        throw new BadRequestException('Elegí al menos un producto para este 2x1.');
      }
      const n = await this.prisma.product.count({ where: { id: { in: dto.productIds }, businessId, deletedAt: null } });
      if (n !== dto.productIds.length) {
        throw new BadRequestException('Alguno de los productos elegidos no existe en tu negocio.');
      }
    } else {
      if (!dto.categoryIds?.length) {
        throw new BadRequestException('Elegí al menos una categoría para este 2x1.');
      }
      const n = await this.prisma.category.count({ where: { id: { in: dto.categoryIds }, businessId } });
      if (n !== dto.categoryIds.length) {
        throw new BadRequestException('Alguna de las categorías elegidas no existe en tu negocio.');
      }
    }
  }

  private toResponse(promo: PromoConDiscount) {
    return {
      id: promo.id,
      isActive: promo.isActive,
      llevaCantidad: promo.discount.minQuantity ?? 0,
      pagaCantidad: Number(promo.discount.value),
      alcance: promo.discount.scope,
      productIds: promo.discount.products.map((p) => p.productId),
      categoryIds: promo.discount.categories.map((c) => c.categoryId),
    };
  }
}
