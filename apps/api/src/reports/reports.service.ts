import { Injectable, NotImplementedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Ventana por defecto del reporte, en días. El panel no expone todavía un
// selector de rango; cuando lo haga, alcanza con pasar `days` por query.
const DIAS_POR_DEFECTO = 30;

// Los pedidos cancelados no cuentan como venta. El resto de los estados sí:
// un pedido pendiente ya reservó la intención de compra y el panel lo muestra.
const ESTADOS_VENDIDOS: Prisma.EnumOrderStatusFilter = { not: 'CANCELLED' };

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Reporte de productos ─────────────────────────────────────────────────
  // Alimenta la pestaña "Reportes de productos" del panel: qué se vende, qué no
  // rota, y qué está por quedarse sin stock.
  async products(businessId: string, days = DIAS_POR_DEFECTO) {
    const desde = new Date();
    desde.setDate(desde.getDate() - days);

    // Se agrupa por variante (es lo que guarda OrderItem) y después se sube a
    // producto, que es la unidad que le interesa al dueño.
    const vendidosPorVariante = await this.prisma.orderItem.groupBy({
      by: ['variantId'],
      where: {
        isConcept: false,
        order: { businessId, deletedAt: null, status: ESTADOS_VENDIDOS, createdAt: { gte: desde } },
      },
      _sum: { quantity: true },
    });

    const variantIds = vendidosPorVariante.map((v) => v.variantId);

    // Importe: unitPrice ya viene congelado en el ítem, así que el total no se
    // recalcula contra el precio actual del producto (que pudo cambiar).
    const items = await this.prisma.orderItem.findMany({
      where: {
        isConcept: false,
        order: { businessId, deletedAt: null, status: ESTADOS_VENDIDOS, createdAt: { gte: desde } },
      },
      select: {
        variantId: true,
        quantity: true,
        unitPrice: true,
        discountAmount: true,
        variant: { select: { productId: true } },
      },
    });

    const acumPorProducto = new Map<string, { unidades: number; importe: number }>();
    for (const it of items) {
      const key = it.variant.productId;
      const previo = acumPorProducto.get(key) ?? { unidades: 0, importe: 0 };
      previo.unidades += it.quantity;
      previo.importe += it.quantity * Number(it.unitPrice) - Number(it.discountAmount);
      acumPorProducto.set(key, previo);
    }

    const productos = await this.prisma.product.findMany({
      where: { businessId, deletedAt: null },
      select: {
        id: true,
        name: true,
        cost: true,
        basePrice: true,
        status: true,
        category: { select: { id: true, name: true } },
        images: { where: { isPrimary: true }, take: 1, select: { url: true } },
        variants: {
          select: {
            id: true,
            sku: true,
            price: true,
            stock: { select: { quantity: true, stockMin: true } },
            // Para poder distinguir en el listado de stock crítico qué talle o
            // color es el que se está quedando sin unidades.
            optionValues: { select: { optionValue: { select: { value: true } } } },
          },
        },
      },
    });

    // Más vendidos
    const masVendidos = productos
      .map((p) => {
        const acum = acumPorProducto.get(p.id) ?? { unidades: 0, importe: 0 };
        return {
          id: p.id,
          name: p.name,
          categoryName: p.category?.name ?? null,
          primaryImageUrl: p.images[0]?.url ?? null,
          unidades: acum.unidades,
          importe: Math.round(acum.importe * 100) / 100,
        };
      })
      .filter((p) => p.unidades > 0)
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 10);

    // Sin rotación: publicados que no vendieron nada en la ventana pero tienen
    // stock disponible (si no hay stock, no vendió porque no había, no por falta
    // de demanda — ese caso ya lo cubre "sin stock" en las métricas de la lista).
    const sinRotacion = productos
      .filter((p) => {
        if (p.status !== 'PUBLISHED') return false;
        if ((acumPorProducto.get(p.id)?.unidades ?? 0) > 0) return false;
        const stock = p.variants.reduce((s, v) => s + v.stock.reduce((x, st) => x + st.quantity, 0), 0);
        return stock > 0;
      })
      .map((p) => ({
        id: p.id,
        name: p.name,
        categoryName: p.category?.name ?? null,
        primaryImageUrl: p.images[0]?.url ?? null,
        stock: p.variants.reduce((s, v) => s + v.stock.reduce((x, st) => x + st.quantity, 0), 0),
      }))
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 10);

    // Stock crítico: alguna variante en o por debajo de su umbral de alerta.
    const stockCritico = productos
      .flatMap((p) =>
        p.variants
          .map((v) => {
            const cantidad = v.stock.reduce((s, st) => s + st.quantity, 0);
            const minimo = v.stock[0]?.stockMin ?? 0;
            return { v, cantidad, minimo };
          })
          .filter(({ cantidad, minimo }) => minimo > 0 && cantidad <= minimo)
          .map(({ v, cantidad, minimo }) => ({
            productId: p.id,
            productName: p.name,
            variantId: v.id,
            sku: v.sku,
            variantLabel:
              v.optionValues.length > 0 ? v.optionValues.map((ov) => ov.optionValue.value).join(' / ') : null,
            primaryImageUrl: p.images[0]?.url ?? null,
            cantidad,
            stockMin: minimo,
          })),
      )
      .sort((a, b) => a.cantidad - b.cantidad)
      .slice(0, 20);

    // Distribución por categoría (productos + valor de inventario a costo).
    const porCategoriaMap = new Map<string, { name: string; productos: number; valor: number }>();
    for (const p of productos) {
      const key = p.category?.id ?? 'sin-categoria';
      const entrada = porCategoriaMap.get(key) ?? {
        name: p.category?.name ?? 'Sin categoría',
        productos: 0,
        valor: 0,
      };
      entrada.productos += 1;
      for (const v of p.variants) {
        const cantidad = v.stock.reduce((s, st) => s + st.quantity, 0);
        const unitario = p.cost !== null ? Number(p.cost) : Number(v.price);
        entrada.valor += cantidad * unitario;
      }
      porCategoriaMap.set(key, entrada);
    }
    const porCategoria = [...porCategoriaMap.entries()]
      .map(([id, c]) => ({ id, name: c.name, productos: c.productos, valor: Math.round(c.valor * 100) / 100 }))
      .sort((a, b) => b.productos - a.productos);

    const unidadesTotales = [...acumPorProducto.values()].reduce((s, a) => s + a.unidades, 0);
    const importeTotal = [...acumPorProducto.values()].reduce((s, a) => s + a.importe, 0);

    return {
      periodoDias: days,
      resumen: {
        productosVendidos: acumPorProducto.size,
        unidadesVendidas: unidadesTotales,
        importeVendido: Math.round(importeTotal * 100) / 100,
        variantesConVenta: variantIds.length,
      },
      masVendidos,
      sinRotacion,
      stockCritico,
      porCategoria,
    };
  }

  // Stub: el resto de los reportes se implementa en un paso posterior.
  private notImplemented(): never {
    void this.prisma;
    throw new NotImplementedException();
  }
}
