import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsQueryDto } from './dto/metrics-query.dto';
import { estadoDe } from './discount-status.util';

// (Métricas de descuentos/cupones — RBT-614) Agrega sobre `DiscountRedemption`.
// La redención se escribe al confirmar una venta con descuento (RBT-616 +
// checkout), que hoy es un stub — así que con datos reales esto devuelve todo
// en cero. Eso es correcto: el panel deja de leer un mock y pasa a leer la base
// (vacía). El shape es el que consume el front (MetricasResumen en
// apps/web/.../types/metricas.ts) — mismas keys.

const round2 = (n: number) => Math.round(n * 100) / 100;

const TIPO_LABEL: Record<string, string> = {
  PERCENT_PRODUCT: '% Producto',
  AMOUNT_PRODUCT: '$ Fijo Producto',
  PERCENT_TICKET: '% Ticket',
  AMOUNT_TICKET: '$ Fijo Ticket',
};

// Traduce el `rango` a una ventana [desde, hasta) + la ventana previa de igual
// duración (para la variación % del KPI comparado).
export function ventanaDe(dto: MetricsQueryDto, now: Date): { desde: Date; hasta: Date; desdePrevio: Date; hastaPrevio: Date } {
  const hasta = new Date(now);
  let desde = new Date(now);

  switch (dto.rango) {
    case 'hoy':
      desde = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case '7d':
      desde = new Date(now.getTime() - 7 * 86400000);
      break;
    case '90d':
      desde = new Date(now.getTime() - 90 * 86400000);
      break;
    case '12m':
      desde = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
      break;
    case 'personalizado':
      desde = dto.fechaDesde ? new Date(dto.fechaDesde) : new Date(now.getTime() - 30 * 86400000);
      if (dto.fechaHasta) hasta.setTime(new Date(dto.fechaHasta).getTime());
      break;
    case '30d':
    default:
      desde = new Date(now.getTime() - 30 * 86400000);
      break;
  }

  const duracion = hasta.getTime() - desde.getTime();
  const hastaPrevio = new Date(desde.getTime());
  const desdePrevio = new Date(desde.getTime() - duracion);
  return { desde, hasta, desdePrevio, hastaPrevio };
}

type RedencionConRefs = Prisma.DiscountRedemptionGetPayload<{
  include: {
    discount: { select: { id: true; name: true; code: true; type: true; isActive: true; startDate: true; endDate: true; maxUsesTotal: true; usesConsumed: true } };
    order: { select: { id: true; total: true } };
  };
}>;

@Injectable()
export class DiscountsMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen(businessId: string, dto: MetricsQueryDto) {
    const now = new Date();
    const { desde, hasta, desdePrevio, hastaPrevio } = ventanaDe(dto, now);

    const canal = dto.canal === 'pos' ? 'POS' : dto.canal === 'storefront' ? 'STOREFRONT' : undefined;
    // tipo: descuentos = code null; cupones = code no-null; todos = ambos.
    const discountFilter: Prisma.DiscountWhereInput | undefined =
      dto.tipo === 'descuentos' ? { code: null } : dto.tipo === 'cupones' ? { code: { not: null } } : undefined;

    const baseWhere = (from: Date, to: Date): Prisma.DiscountRedemptionWhereInput => ({
      businessId,
      createdAt: { gte: from, lt: to },
      ...(canal ? { channel: canal as Prisma.DiscountRedemptionWhereInput['channel'] } : {}),
      ...(discountFilter ? { discount: discountFilter } : {}),
    });

    // emitidos (tasa de canje): cupones cuya vigencia solapa la ventana. Cuando
    // el filtro es 'descuentos', la tasa de canje no aplica → 0.
    const emitidosPromise =
      dto.tipo === 'descuentos'
        ? Promise.resolve(0)
        : this.prisma.discount.count({
            where: {
              businessId,
              code: { not: null },
              deletedAt: null,
              startDate: { lte: hasta },
              OR: [{ endDate: null }, { endDate: { gte: desde } }],
            },
          });

    const [redenciones, redencionesPrevias, ordenesVentana, emitidos] = await Promise.all([
      this.prisma.discountRedemption.findMany({
        where: baseWhere(desde, hasta),
        include: {
          discount: { select: { id: true, name: true, code: true, type: true, isActive: true, startDate: true, endDate: true, maxUsesTotal: true, usesConsumed: true } },
          order: { select: { id: true, total: true } },
        },
      }),
      this.prisma.discountRedemption.aggregate({
        where: baseWhere(desdePrevio, hastaPrevio),
        _sum: { amount: true },
      }),
      this.prisma.order.findMany({
        where: { businessId, createdAt: { gte: desde, lt: hasta } },
        select: { id: true, total: true },
      }),
      emitidosPromise,
    ]);

    return {
      kpis: this.kpis(redenciones, redencionesPrevias._sum.amount, ordenesVentana, emitidos),
      grafico: this.grafico(redenciones, desde, hasta),
      rendimiento: this.rendimiento(redenciones, now),
    };
  }

  private kpis(
    R: RedencionConRefs[],
    sumPrevio: Prisma.Decimal | null,
    ordenes: { id: string; total: Prisma.Decimal }[],
    emitidos: number,
  ) {
    const revenue = round2(R.reduce((acc, r) => acc + Number(r.amount), 0));
    const revenuePrevio = round2(Number(sumPrevio ?? 0));
    const variacion = revenuePrevio === 0 ? (revenue === 0 ? 0 : 100) : round2(((revenue - revenuePrevio) / revenuePrevio) * 100);

    // Órdenes con descuento = las que tienen al menos una redención.
    const totalPorOrden = new Map<string, number>();
    for (const o of ordenes) totalPorOrden.set(o.id, Number(o.total));
    const ordenesConDesc = new Set(R.map((r) => r.orderId));

    const totalConDesc = round2([...ordenesConDesc].reduce((acc, id) => acc + (totalPorOrden.get(id) ?? 0), 0));
    const cantidadConDesc = ordenesConDesc.size;
    const porcentajeConDesc = ordenes.length === 0 ? 0 : round2((cantidadConDesc / ordenes.length) * 100);

    const ordenesSinDesc = ordenes.filter((o) => !ordenesConDesc.has(o.id));
    const totalSinDesc = ordenesSinDesc.reduce((acc, o) => acc + Number(o.total), 0);
    const ticketConDescuento = cantidadConDesc === 0 ? 0 : round2(totalConDesc / cantidadConDesc);
    const ticketSinDescuento = ordenesSinDesc.length === 0 ? 0 : round2(totalSinDesc / ordenesSinDesc.length);

    // canjeados = cupones distintos que aparecen en las redenciones de la ventana.
    const canjeados = new Set(R.filter((r) => r.discount.code != null).map((r) => r.discount.id)).size;

    return {
      revenueSacrificado: { valor: revenue, valorPrevio: revenuePrevio, variacion },
      ventasConDescuento: { cantidad: cantidadConDesc, total: totalConDesc, porcentaje: porcentajeConDesc },
      ticketPromedio: { conDescuento: ticketConDescuento, sinDescuento: ticketSinDescuento },
      tasaCanje: { emitidos, canjeados, porcentaje: emitidos === 0 ? 0 : round2((canjeados / emitidos) * 100) },
    };
  }

  private grafico(R: RedencionConRefs[], desde: Date, hasta: Date) {
    // Un bucket por día de la ventana. Clave = 'yyyy-mm-dd' en hora local.
    const clave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const fechas: string[] = [];
    const revenuePorDia = new Map<string, number>();
    const usosPorDia = new Map<string, number>();

    const cursor = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
    const fin = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
    // Tope defensivo (evita un loop enorme si la ventana viniera mal): 400 días.
    let guard = 0;
    while (cursor <= fin && guard < 400) {
      const k = clave(cursor);
      fechas.push(k);
      revenuePorDia.set(k, 0);
      usosPorDia.set(k, 0);
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }

    for (const r of R) {
      const k = clave(new Date(r.createdAt));
      if (revenuePorDia.has(k)) {
        revenuePorDia.set(k, revenuePorDia.get(k)! + Number(r.amount));
        usosPorDia.set(k, usosPorDia.get(k)! + 1);
      }
    }

    return {
      fechas,
      revenueSacrificado: fechas.map((k) => round2(revenuePorDia.get(k) ?? 0)),
      usos: fechas.map((k) => usosPorDia.get(k) ?? 0),
    };
  }

  private rendimiento(R: RedencionConRefs[], now: Date) {
    // Agrupa por descuento/cupón.
    const porDiscount = new Map<string, RedencionConRefs[]>();
    for (const r of R) {
      const arr = porDiscount.get(r.discount.id) ?? [];
      arr.push(r);
      porDiscount.set(r.discount.id, arr);
    }

    return [...porDiscount.entries()].map(([id, rs]) => {
      const d = rs[0].discount;
      const usos = rs.length;
      const revenueSacrificado = round2(rs.reduce((acc, r) => acc + Number(r.amount), 0));
      const ordenIds = new Set(rs.map((r) => r.orderId));
      const totalPorOrden = new Map<string, number>();
      for (const r of rs) totalPorOrden.set(r.orderId, Number(r.order.total));
      const revenueConDesc = round2([...ordenIds].reduce((acc, oid) => acc + (totalPorOrden.get(oid) ?? 0), 0));
      const ticketPromedio = ordenIds.size === 0 ? 0 : round2(revenueConDesc / ordenIds.size);

      return {
        id,
        nombre: d.name,
        entidad: (d.code != null ? 'cupon' : 'descuento') as 'cupon' | 'descuento',
        tipoLabel: TIPO_LABEL[d.type] ?? d.type,
        usos,
        revenueSacrificado,
        revenueConDesc,
        ticketPromedio,
        estado: estadoDe(d, now) as string,
      };
    });
  }
}
