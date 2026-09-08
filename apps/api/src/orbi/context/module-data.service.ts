import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ModuleSnapshot, DashboardSnapshot, PedidosSnapshot } from './module-data.types';

@Injectable()
export class ModuleDataService {
  constructor(private readonly prisma: PrismaService) {}

  async getSnapshot(businessId: string, module: string): Promise<ModuleSnapshot> {
    switch (module) {
      case 'dashboard': return this.dashboardSnapshot(businessId);
      case 'pedidos':   return this.pedidosSnapshot(businessId);
      default:          return {};
    }
  }

  private async dashboardSnapshot(businessId: string): Promise<DashboardSnapshot> {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioMesPasado = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);

    try {
      const [
        orderGroupsThisMonth,
        orderGroupsLastMonth,
        totalProducts,
        outOfStockProducts,
        totalCustomers,
        newCustomersThisMonth,
        unreadMessages,
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
        this.prisma.product.count({ where: { businessId, deletedAt: null } }),
        this.prisma.product.count({ where: { businessId, deletedAt: null, status: 'OUT_OF_STOCK' } }),
        this.prisma.customer.count({ where: { businessId } }),
        this.prisma.customer.count({ where: { businessId, createdAt: { gte: inicioMes } } }),
        this.prisma.conversation.count({ where: { businessId, isUnread: true, isArchived: false } }),
      ]);

      const summarize = (groups: typeof orderGroupsThisMonth) => {
        let count = 0;
        let total = 0;
        let cancelled = 0;
        for (const g of groups) {
          const n = typeof g._count === 'number' ? g._count : 0;
          if (g.status === 'CANCELLED') { cancelled += n; continue; }
          count += n;
          total += g._sum.total != null ? Number(g._sum.total) : 0;
        }
        return { total: Math.round(total * 100) / 100, count, cancelled };
      };

      const thisMonth = summarize(orderGroupsThisMonth);
      const lastMonth = summarize(orderGroupsLastMonth);

      const pending = orderGroupsThisMonth.find(g => g.status === 'PENDING');
      const pendingOrders = pending ? (typeof pending._count === 'number' ? pending._count : 0) : 0;

      return {
        salesThisMonth: {
          total: thisMonth.total,
          count: thisMonth.count,
          avgTicket: thisMonth.count > 0
            ? Math.round((thisMonth.total / thisMonth.count) * 100) / 100
            : 0,
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
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

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

      const lastOrderDate = lastOrder
        ? lastOrder.createdAt.toISOString().split('T')[0]
        : null;

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
}
