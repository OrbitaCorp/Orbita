import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertTwoForOneDto } from './dto/upsert-two-for-one.dto';

type PromoConDiscount = Prisma.TwoForOnePromoGetPayload<{
  include: { discount: { include: { products: true; categories: true } } };
}>;

// "2x1 y 3x2" (paquete Avanzado, RBT-675) — a diferencia de PromoModalService
// (puro anuncio), esto SÍ crea/gestiona un Discount real tipo BUY_X_PAY_Y: el
// dueño configura acá "llevá X, pagá Y" + alcance, y este service arma el
// Discount que discount-engine.ts evalúa de verdad en el carrito (mismo
// patrón que "Juegos con premio": se gestiona sin pasar por el módulo
// genérico de Descuentos). MVP: un solo 2x1 por negocio (businessId único en
// TwoForOnePromo), on/off — no una lista de promos simultáneas.
@Injectable()
export class TwoForOneService {
  constructor(private readonly prisma: PrismaService) {}

  async getForBusiness(businessId: string) {
    const promo = await this.prisma.twoForOnePromo.findUnique({
      where: { businessId },
      include: { discount: { include: { products: true, categories: true } } },
    });
    return promo ? this.toResponse(promo) : null;
  }

  async upsert(businessId: string, memberId: string, dto: UpsertTwoForOneDto) {
    await this.validar(businessId, dto);

    const existente = await this.prisma.twoForOnePromo.findUnique({ where: { businessId } });

    // El nombre del Discount es lo que ve el cliente si algún día se muestra
    // `discountName` en el carrito (ver itemDiscounts en discount-engine.ts)
    // — mismo formato que el badge del catálogo ("3x2"), así el número
    // siempre coincide con lo que ya vio en la card.
    const nombre = `${dto.llevaCantidad}x${dto.pagaCantidad}`;
    const productos = dto.alcance === 'PRODUCT' ? (dto.productIds ?? []) : [];
    const categorias = dto.alcance === 'CATEGORY' ? (dto.categoryIds ?? []) : [];

    const datosDiscount = {
      name: nombre,
      type: 'BUY_X_PAY_Y' as const,
      value: new Prisma.Decimal(dto.pagaCantidad),
      scope: dto.alcance as 'PRODUCT' | 'CATEGORY',
      productLevel: dto.alcance === 'PRODUCT' ? 'padre' : null,
      minQuantity: dto.llevaCantidad,
      application: 'AUTOMATIC' as const,
      isActive: dto.isActive,
      isPrivate: false,
    };

    const promo = await this.prisma.$transaction(async (tx) => {
      let discountId = existente?.discountId;
      if (discountId) {
        await tx.discount.update({
          where: { id: discountId },
          data: {
            ...datosDiscount,
            products: { deleteMany: {}, createMany: { data: productos.map((productId) => ({ productId })) } },
            categories: { deleteMany: {}, createMany: { data: categorias.map((categoryId) => ({ categoryId })) } },
          },
        });
      } else {
        const discount = await tx.discount.create({
          data: {
            ...datosDiscount,
            businessId,
            createdBy: memberId,
            startDate: new Date(),
            products: { createMany: { data: productos.map((productId) => ({ productId })) } },
            categories: { createMany: { data: categorias.map((categoryId) => ({ categoryId })) } },
          },
        });
        discountId = discount.id;
      }

      return tx.twoForOnePromo.upsert({
        where: { businessId },
        create: { businessId, discountId, isActive: dto.isActive },
        update: { isActive: dto.isActive },
        include: { discount: { include: { products: true, categories: true } } },
      });
    });

    return this.toResponse(promo);
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
      isActive: promo.isActive,
      llevaCantidad: promo.discount.minQuantity ?? 0,
      pagaCantidad: Number(promo.discount.value),
      alcance: promo.discount.scope,
      productIds: promo.discount.products.map((p) => p.productId),
      categoryIds: promo.discount.categories.map((c) => c.categoryId),
    };
  }
}
