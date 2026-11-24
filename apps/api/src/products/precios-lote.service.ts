import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { PreciosLoteDto } from './dto/precios-lote.dto';
import type { FindProductsQueryDto } from './dto/find-products-query.dto';
import { whereDelListado } from './products.service';

export interface CambioDePrecio {
  variantId: string;
  productId: string;
  nombre: string;
  /** "50 ml", "Rojo / M"… — vacío si el producto no tiene variantes. */
  variante: string;
  antes: number;
  despues: number;
}

/** Una fila del Excel de "Actualizar precios": una por variante activa. */
export interface FilaPrecio {
  variantId: string;
  nombre: string;
  variante: string;
  sku: string | null;
  categoria: string | null;
  precio: number;
  stock: number;
  estado: 'PUBLISHED' | 'DRAFT' | 'OUT_OF_STOCK';
}

export interface ResultadoPreciosLote {
  cambios: CambioDePrecio[];
  /** Filas cuyo precio ya era ese: no se tocan. */
  sinCambios: number;
  /** Códigos que no son de una variante de ESTA tienda (borrada, de otro negocio o mal copiados). */
  noEncontradas: string[];
  /** true si se guardó; false en la simulación. */
  aplicado: boolean;
}

const redondear = (n: number) => Math.round(n * 100) / 100;
// Cuántas variantes se escriben por transacción: con miles de filas, una sola
// transacción superaba el timeout y no dejaba nada a medias que ver.
const POR_TANDA = 200;

/**
 * Cambia el precio de muchas variantes de una vez (el Excel exportado con los
 * precios nuevos). Primero se simula —el panel muestra el resumen— y después se
 * aplica con la MISMA lista. Al aplicar, el `basePrice` de cada producto tocado
 * pasa a ser el menor precio de sus variantes activas: es el "desde $X" de la
 * tarjeta y lo que usan el orden y el filtro por precio de la tienda.
 */
@Injectable()
export class PreciosLoteService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  /**
   * Lo que va al Excel: una fila por variante activa de los productos que
   * matchean los filtros del listado, en el orden del catálogo. El código es el
   * id de la variante —lo que después lee `actualizar`—.
   */
  async filas(businessId: string, query: Pick<FindProductsQueryDto, 'search' | 'categoryId' | 'status'>): Promise<FilaPrecio[]> {
    const productos = await this.prisma.product.findMany({
      where: whereDelListado(businessId, query),
      orderBy: { createdAt: 'desc' },
      select: {
        name: true,
        status: true,
        category: { select: { name: true } },
        variants: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, sku: true, price: true,
            stock: { select: { quantity: true } },
            optionValues: { select: { optionValue: { select: { value: true, option: { select: { position: true } } } } } },
          },
        },
      },
    });
    const filas: FilaPrecio[] = [];
    for (const p of productos) {
      for (const v of p.variants) {
        filas.push({
          variantId: v.id,
          nombre: p.name,
          variante: [...v.optionValues]
            .sort((a, b) => a.optionValue.option.position - b.optionValue.option.position)
            .map((ov) => ov.optionValue.value)
            .join(' / '),
          sku: v.sku,
          categoria: p.category?.name ?? null,
          precio: Number(v.price),
          stock: v.stock.reduce((s, st) => s + st.quantity, 0),
          estado: p.status as FilaPrecio['estado'],
        });
      }
    }
    return filas;
  }

  async actualizar(businessId: string, memberId: string | undefined, dto: PreciosLoteDto): Promise<ResultadoPreciosLote> {
    // La última fila manda si el mismo código aparece dos veces.
    const pedidos = new Map<string, number>();
    for (const it of dto.items) pedidos.set(it.variantId, redondear(it.price));

    const variantes = await this.prisma.productVariant.findMany({
      where: { id: { in: [...pedidos.keys()] }, product: { businessId, deletedAt: null } },
      select: {
        id: true,
        price: true,
        productId: true,
        product: { select: { name: true } },
        optionValues: { select: { optionValue: { select: { value: true, option: { select: { position: true } } } } } },
      },
    });
    const encontradas = new Map(variantes.map((v) => [v.id, v]));
    const noEncontradas = [...pedidos.keys()].filter((id) => !encontradas.has(id));

    const cambios: CambioDePrecio[] = [];
    let sinCambios = 0;
    for (const [id, nuevo] of pedidos) {
      const v = encontradas.get(id);
      if (!v) continue;
      const antes = redondear(Number(v.price));
      if (antes === nuevo) { sinCambios++; continue; }
      const variante = [...v.optionValues]
        .sort((a, b) => a.optionValue.option.position - b.optionValue.option.position)
        .map((ov) => ov.optionValue.value)
        .join(' / ');
      cambios.push({ variantId: id, productId: v.productId, nombre: v.product.name, variante, antes, despues: nuevo });
    }

    if (dto.simular) return { cambios, sinCambios, noEncontradas, aplicado: false };
    if (cambios.length === 0) throw new BadRequestException('No hay ningún precio distinto para guardar');

    for (let i = 0; i < cambios.length; i += POR_TANDA) {
      const tanda = cambios.slice(i, i + POR_TANDA);
      await this.prisma.$transaction(
        tanda.map((c) => this.prisma.productVariant.update({ where: { id: c.variantId }, data: { price: new Prisma.Decimal(c.despues.toFixed(2)) } })),
      );
    }

    // "Desde $X" de cada producto tocado = su variante activa más barata.
    const productos = [...new Set(cambios.map((c) => c.productId))];
    const minimos = await this.prisma.productVariant.groupBy({
      by: ['productId'],
      where: { productId: { in: productos }, isActive: true },
      _min: { price: true },
    });
    for (let i = 0; i < minimos.length; i += POR_TANDA) {
      await this.prisma.$transaction(
        minimos
          .slice(i, i + POR_TANDA)
          .filter((m) => m._min.price !== null)
          .map((m) => this.prisma.product.update({ where: { id: m.productId }, data: { basePrice: m._min.price! } })),
      );
    }

    // Auditoría: un registro por producto, como al editarlo a mano.
    const porProducto = new Map<string, CambioDePrecio[]>();
    for (const c of cambios) porProducto.set(c.productId, [...(porProducto.get(c.productId) ?? []), c]);
    for (const [productId, lista] of porProducto) {
      await this.audit?.registrar({
        businessId, memberId, entityType: 'product', entityId: productId, action: 'UPDATE',
        changes: lista.map((c) => ({ field: c.variante ? `variante ${c.variante}: precio (Excel)` : 'precio (Excel)', before: c.antes, after: c.despues })),
      });
    }

    return { cambios, sinCambios, noEncontradas, aplicado: true };
  }
}
