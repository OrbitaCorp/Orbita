import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Helpers compartidos entre descuentos (code = null) y cupones (code ≠ null):
// ambos derivan el estado igual y resumen el "alcance" igual. Se extrajeron acá
// para no duplicar ~120 líneas entre DiscountsService y CouponsService.

export type EstadoDiscount = 'activo' | 'inactivo' | 'programado' | 'expirado' | 'agotado';

// Estado derivado — NO es columna: se calcula de isActive + fechas + usos al
// leer, para que un programado "se active solo" al llegar la fecha sin ningún
// job. 'agotado' cuando llegó al límite de usos (el motor ya lo excluye igual);
// la fecha manda: si además está vencido, gana 'expirado'.
export function estadoDe(
  d: { isActive: boolean; startDate: Date; endDate: Date | null; maxUsesTotal: number | null; usesConsumed: number },
  now: Date,
): EstadoDiscount {
  if (!d.isActive) return 'inactivo';
  if (d.startDate > now) return 'programado';
  if (d.endDate && d.endDate < now) return 'expirado';
  if (d.maxUsesTotal != null && d.usesConsumed >= d.maxUsesTotal) return 'agotado';
  return 'activo';
}

// El mismo criterio, pero como filtro SQL — así el estado se filtra en la base y
// la paginación/`total` quedan correctos. 'agotado' NO se traduce acá (requiere
// comparar dos columnas): los DTOs de filtro no lo aceptan.
export function whereDeEstado(estado: EstadoDiscount, now: Date): Prisma.DiscountWhereInput {
  if (estado === 'inactivo') return { isActive: false };
  if (estado === 'programado') return { isActive: true, startDate: { gt: now } };
  if (estado === 'expirado') return { isActive: true, endDate: { lt: now } };
  return {
    isActive: true,
    startDate: { lte: now },
    OR: [{ endDate: null }, { endDate: { gte: now } }],
  };
}

// Resumen de la columna "Alcance". OJO: `DiscountProduct.productId` guarda un id
// de PRODUCTO o de VARIANTE según `productLevel` (el schema no tiene relación, es
// un id crudo), así que se resuelven los nombres con lookups batcheados.
export async function resumenesDeAlcance(
  prisma: PrismaService,
  businessId: string,
  filas: Array<{
    id: string;
    scope: string;
    productLevel: string | null;
    products: Array<{ productId: string }>;
    categories: Array<{ categoryId: string }>;
  }>,
): Promise<Map<string, string>> {
  const productIds = new Set<string>();
  const variantIds = new Set<string>();
  const categoryIds = new Set<string>();

  for (const f of filas) {
    for (const c of f.categories) categoryIds.add(c.categoryId);
    for (const p of f.products) {
      if (f.productLevel === 'variante') variantIds.add(p.productId);
      else productIds.add(p.productId);
    }
  }

  const [productos, variantes, categorias] = await Promise.all([
    productIds.size
      ? prisma.product.findMany({
          where: { id: { in: [...productIds] }, businessId },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    variantIds.size
      ? prisma.productVariant.findMany({
          where: { id: { in: [...variantIds] }, product: { businessId } },
          select: { id: true, sku: true, product: { select: { name: true } } },
        })
      : Promise.resolve([]),
    categoryIds.size
      ? prisma.category.findMany({
          where: { id: { in: [...categoryIds] }, businessId },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const nombreProducto = new Map(productos.map((p) => [p.id, p.name]));
  const nombreVariante = new Map(variantes.map((v) => [v.id, v.sku ? `${v.product.name} (${v.sku})` : v.product.name]));
  const nombreCategoria = new Map(categorias.map((c) => [c.id, c.name]));

  // Hasta 2 nombres + "+N" — el resto va en el tooltip del frontend.
  const resumir = (nombres: string[]): string => {
    const visibles = nombres.slice(0, 2).join(', ');
    const resto = nombres.length - 2;
    return resto > 0 ? `${visibles} +${resto}` : visibles;
  };

  const out = new Map<string, string>();
  for (const f of filas) {
    if (f.scope === 'TICKET') {
      out.set(f.id, 'Ticket completo');
      continue;
    }
    if (f.scope === 'CATEGORY') {
      const nombres = f.categories.map((c) => nombreCategoria.get(c.categoryId)).filter((n): n is string => !!n);
      out.set(f.id, nombres.length ? resumir(nombres) : 'Sin categorías');
      continue;
    }
    const mapa = f.productLevel === 'variante' ? nombreVariante : nombreProducto;
    const nombres = f.products.map((p) => mapa.get(p.productId)).filter((n): n is string => !!n);
    out.set(f.id, nombres.length ? resumir(nombres) : 'Sin productos');
  }
  return out;
}
