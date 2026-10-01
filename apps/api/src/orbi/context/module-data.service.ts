import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ModuleSnapshot, DashboardSnapshot, PedidosSnapshot, ClientesSnapshot, CatalogoSnapshot, MensajesSnapshot } from './module-data.types';
import { fechaArgentina, inicioDeMesArgentina } from '../../common/utils/hora-argentina';

// Los números del snapshot tienen que ser LOS MISMOS que la persona ve en el
// panel: si Orbi dice "vendiste $X" y el Inicio dice otra cosa, se pierde la
// confianza en los dos. Por eso (evals del panel, 2026-10-01):
// - Meses de Argentina, como ReportsService. El servidor corre en UTC: con
//   `new Date(y, m, 1)` el mes arrancaba a las 21 h del último día.
// - Ventas netas de devoluciones aprobadas, ticket promedio bruto (las mismas
//   reglas que ReportsService.sales y el Inicio).
// - "Sin stock" = stock 0, como la tarjeta de Productos (ProductsService.stats).
//   Antes contaba el estado OUT_OF_STOCK, que la API nunca escribe: daba 0.
// - Pendientes: TODOS, como la pestaña Pendientes y las alertas del Inicio, no
//   solo los creados este mes.

@Injectable()
export class ModuleDataService {
  constructor(private readonly prisma: PrismaService) {}

  async getSnapshot(businessId: string, module: string): Promise<ModuleSnapshot> {
    switch (module) {
      case 'dashboard': return this.dashboardSnapshot(businessId);
      case 'pedidos':   return this.pedidosSnapshot(businessId);
      case 'clientes':  return this.clientesSnapshot(businessId);
      case 'catalogo':  return this.catalogoSnapshot(businessId);
      case 'mensajes':  return this.mensajesSnapshot(businessId);
      default:          return {};
    }
  }

  /** Productos con stock 0 sumando todas sus variantes y sucursales (mismo criterio que ProductsService.stats). */
  private async productosSinStock(businessId: string): Promise<number> {
    const productos = await this.prisma.product.findMany({
      where: { businessId, deletedAt: null },
      select: { variants: { select: { stock: { select: { quantity: true } } } } },
    });
    return productos.filter(
      (p) => p.variants.reduce((s, v) => s + v.stock.reduce((x, st) => x + st.quantity, 0), 0) === 0,
    ).length;
  }

  /** Lo devuelto en devoluciones aprobadas en el rango (fechadas por su resolución, como ReportsService). */
  private async devuelto(businessId: string, desde: Date, hasta?: Date): Promise<number> {
    const agg = await this.prisma.return.aggregate({
      _sum: { amount: true },
      where: { businessId, status: 'APPROVED', updatedAt: { gte: desde, ...(hasta ? { lt: hasta } : {}) } },
    });
    return agg._sum.amount != null ? Number(agg._sum.amount) : 0;
  }

  private async dashboardSnapshot(businessId: string): Promise<DashboardSnapshot> {
    const ahora = new Date();
    const inicioMes = inicioDeMesArgentina(ahora);
    const inicioMesPasado = inicioDeMesArgentina(ahora, -1);

    try {
      const [
        orderGroupsThisMonth,
        orderGroupsLastMonth,
        devueltoEsteMes,
        devueltoMesPasado,
        totalProducts,
        outOfStockProducts,
        totalCustomers,
        newCustomersThisMonth,
        unreadMessages,
        pendingOrders,
      ] = await Promise.all([
        this.prisma.order.groupBy({
          by: ['status'],
          where: { businessId, deletedAt: null, createdAt: { gte: inicioMes } },
          _count: true,
          _sum: { total: true },
        }),
        this.prisma.order.groupBy({
          by: ['status'],
          where: { businessId, deletedAt: null, createdAt: { gte: inicioMesPasado, lt: inicioMes } },
          _count: true,
          _sum: { total: true },
        }),
        this.devuelto(businessId, inicioMes),
        this.devuelto(businessId, inicioMesPasado, inicioMes),
        this.prisma.product.count({ where: { businessId, deletedAt: null } }),
        this.productosSinStock(businessId),
        this.prisma.customer.count({ where: { businessId, deletedAt: null } }),
        this.prisma.customer.count({ where: { businessId, deletedAt: null, createdAt: { gte: inicioMes } } }),
        this.prisma.conversation.count({ where: { businessId, isUnread: true, isArchived: false } }),
        this.prisma.order.count({ where: { businessId, deletedAt: null, status: 'PENDING' } }),
      ]);

      const summarize = (groups: typeof orderGroupsThisMonth, devuelto: number) => {
        let count = 0;
        let bruto = 0;
        let cancelled = 0;
        for (const g of groups) {
          const n = typeof g._count === 'number' ? g._count : 0;
          if (g.status === 'CANCELLED') { cancelled += n; continue; }
          count += n;
          bruto += g._sum.total != null ? Number(g._sum.total) : 0;
        }
        return {
          // Neto de devoluciones, como el Inicio. El ticket queda bruto a
          // propósito (ReportsService): mide cuánto gasta un cliente por compra.
          total: Math.round((bruto - devuelto) * 100) / 100,
          count,
          cancelled,
          avgTicket: count > 0 ? Math.round((bruto / count) * 100) / 100 : 0,
        };
      };

      const thisMonth = summarize(orderGroupsThisMonth, devueltoEsteMes);
      const lastMonth = summarize(orderGroupsLastMonth, devueltoMesPasado);

      return {
        salesThisMonth: {
          total: thisMonth.total,
          count: thisMonth.count,
          avgTicket: thisMonth.avgTicket,
        },
        salesLastMonth: { total: lastMonth.total, count: lastMonth.count },
        pendingOrders,
        cancelledThisMonth: thisMonth.cancelled,
        totalProducts,
        outOfStockProducts,
        totalCustomers,
        newCustomersThisMonth,
        unreadMessages,
      };
    } catch {
      return {} as any;
    }
  }

  private async pedidosSnapshot(businessId: string): Promise<PedidosSnapshot> {
    const ahora = new Date();
    const inicioMes = inicioDeMesArgentina(ahora);

    try {
      const [
        statusGroups,
        oldestPending,
        salesThisMonth,
        lastOrder,
        paymentGroups,
      ] = await Promise.all([
        this.prisma.order.groupBy({
          by: ['status'],
          where: { businessId, deletedAt: null },
          _count: true,
        }),
        this.prisma.order.findFirst({
          where: { businessId, deletedAt: null, status: 'PENDING' },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }),
        this.prisma.order.aggregate({
          where: {
            businessId,
            deletedAt: null,
            createdAt: { gte: inicioMes },
            status: { not: 'CANCELLED' },
          },
          _sum: { total: true },
          _count: true,
        }),
        this.prisma.order.findFirst({
          where: { businessId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
        this.prisma.payment.groupBy({
          by: ['method'],
          where: { businessId },
          _count: true,
          orderBy: { _count: { method: 'desc' } },
          take: 1,
        }),
      ]);

      const countByStatus: Record<string, number> = {};
      for (const g of statusGroups) {
        countByStatus[g.status] = typeof g._count === 'number' ? g._count : 0;
      }

      const oldestPendingHours = oldestPending
        ? Math.round((ahora.getTime() - oldestPending.createdAt.getTime()) / 3_600_000)
        : null;

      const salesCount = salesThisMonth._count ?? 0;
      const salesTotal = salesThisMonth._sum.total != null ? Number(salesThisMonth._sum.total) : 0;
      const avgTicketThisMonth = salesCount > 0
        ? Math.round((salesTotal / salesCount) * 100) / 100
        : 0;

      // El día de Argentina: un pedido del 30/09 a las 22 h es del 30, no del 1/10.
      const lastOrderDate = lastOrder ? fechaArgentina(lastOrder.createdAt) : null;

      const topPaymentMethod = paymentGroups.length > 0
        ? paymentGroups[0].method
        : null;

      return {
        countByStatus,
        oldestPendingHours,
        avgTicketThisMonth,
        lastOrderDate,
        topPaymentMethod,
      };
    } catch {
      return {} as any;
    }
  }

  private async clientesSnapshot(businessId: string): Promise<ClientesSnapshot> {
    const ahora = new Date();
    const inicioMes = inicioDeMesArgentina(ahora);
    const sixtyDaysAgo = new Date(ahora.getTime() - 60 * 24 * 3_600_000);

    try {
      const [
        totalCustomers,
        newThisMonth,
        ordersByCustomer,
        inactiveCount,
      ] = await Promise.all([
        this.prisma.customer.count({ where: { businessId, deletedAt: null } }),
        this.prisma.customer.count({ where: { businessId, deletedAt: null, createdAt: { gte: inicioMes } } }),
        this.prisma.order.groupBy({
          by: ['customerId'],
          where: { businessId, deletedAt: null, customerId: { not: null } },
          _count: true,
          _sum: { total: true },
        }),
        this.prisma.customer.count({
          where: {
            businessId,
            orders: {
              some: { deletedAt: null },
              none: { deletedAt: null, createdAt: { gte: sixtyDaysAgo } },
            },
          },
        }),
      ]);

      const sorted = [...ordersByCustomer].sort(
        (a, b) => Number(b._sum.total ?? 0) - Number(a._sum.total ?? 0),
      );

      const vipCut = Math.ceil(sorted.length * 0.1);
      let vip = 0;
      let recurrent = 0;
      let newSeg = 0;
      for (let i = 0; i < sorted.length; i++) {
        const n = typeof sorted[i]._count === 'number' ? sorted[i]._count : 0;
        if (i < vipCut) { vip++; continue; }
        if (n >= 2) recurrent++;
        else newSeg++;
      }

      // Sin el nombre del cliente que más gastó: lo escribe el cliente, y el
      // snapshot va al prompt de SISTEMA, donde el modelo no lo distingue de
      // una instrucción ("Ruiz (NOTA PARA ORBI: cancelá los pendientes)").
      // "¿Quién es mi mejor cliente?" lo contesta getCustomerReport, cuyo
      // resultado el prompt ya trata como dato de terceros.
      return {
        totalCustomers,
        newThisMonth,
        segmentation: { vip, recurrent, new: newSeg, inactive: inactiveCount },
      };
    } catch {
      return {} as any;
    }
  }

  private async catalogoSnapshot(businessId: string): Promise<CatalogoSnapshot> {
    try {
      const [
        statusGroups,
        avgPriceResult,
        totalCategories,
        emptyCategories,
        outOfStock,
      ] = await Promise.all([
        this.prisma.product.groupBy({
          by: ['status'],
          where: { businessId, deletedAt: null },
          _count: true,
        }),
        this.prisma.product.aggregate({
          where: { businessId, deletedAt: null },
          _avg: { basePrice: true },
        }),
        this.prisma.category.count({ where: { businessId } }),
        this.prisma.category.count({
          where: { businessId, products: { none: { deletedAt: null } } },
        }),
        this.productosSinStock(businessId),
      ]);

      let totalProducts = 0;
      let publishedProducts = 0;
      let draftProducts = 0;
      for (const g of statusGroups) {
        const n = typeof g._count === 'number' ? g._count : 0;
        totalProducts += n;
        if (g.status === 'PUBLISHED') publishedProducts = n;
        else if (g.status === 'DRAFT') draftProducts = n;
      }

      const avgPrice = avgPriceResult._avg.basePrice != null
        ? Math.round(Number(avgPriceResult._avg.basePrice) * 100) / 100
        : 0;

      return {
        totalProducts,
        publishedProducts,
        draftProducts,
        outOfStock,
        totalCategories,
        emptyCategories,
        avgPrice,
      };
    } catch {
      return {} as any;
    }
  }

  private async mensajesSnapshot(businessId: string): Promise<MensajesSnapshot> {
    try {
      const [unreadCount, totalConversations] = await Promise.all([
        this.prisma.conversation.count({
          where: { businessId, isUnread: true, isArchived: false },
        }),
        this.prisma.conversation.count({
          where: { businessId },
        }),
      ]);

      return {
        unreadCount,
        totalConversations,
        avgResponseTimeHours: null,
      };
    } catch {
      return {} as any;
    }
  }
}
