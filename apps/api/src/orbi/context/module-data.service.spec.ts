import { ModuleDataService } from './module-data.service';

describe('ModuleDataService', () => {
  let service: ModuleDataService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      order: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { total: null }, _count: 0 }),
        groupBy: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      product: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _avg: { basePrice: null } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      return: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }) },
      category: { count: jest.fn().mockResolvedValue(0) },
      customer: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      conversation: { count: jest.fn().mockResolvedValue(0) },
      payment: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    service = new ModuleDataService(mockPrisma);
  });

  it('returns empty object for unknown module', async () => {
    const result = await service.getSnapshot('biz-1', 'nonexistent');
    expect(result).toEqual({});
  });

  it('returns empty object when queries fail', async () => {
    mockPrisma.order.groupBy.mockRejectedValue(new Error('connection lost'));
    mockPrisma.product.count.mockRejectedValue(new Error('connection lost'));
    mockPrisma.customer.count.mockRejectedValue(new Error('connection lost'));
    mockPrisma.conversation.count.mockRejectedValue(new Error('connection lost'));

    const result = await service.getSnapshot('biz-1', 'dashboard');
    expect(result).toEqual({});
  });

  it('returns DashboardSnapshot with correct shape', async () => {
    mockPrisma.order.groupBy
      .mockResolvedValueOnce([
        { status: 'PENDING', _count: 3, _sum: { total: 15000 } },
        { status: 'COMPLETED', _count: 10, _sum: { total: 85000 } },
        { status: 'CANCELLED', _count: 2, _sum: { total: 5000 } },
      ])
      .mockResolvedValueOnce([
        { status: 'COMPLETED', _count: 8, _sum: { total: 70000 } },
      ]);
    mockPrisma.product.count.mockResolvedValueOnce(25);
    // Dos productos con stock 0 (sumando variantes) y uno con stock.
    mockPrisma.product.findMany.mockResolvedValueOnce([
      { variants: [{ stock: [{ quantity: 0 }] }] },
      { variants: [{ stock: [] }, { stock: [{ quantity: 0 }] }] },
      { variants: [{ stock: [{ quantity: 3 }] }] },
    ]);
    mockPrisma.customer.count
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(8);
    mockPrisma.conversation.count.mockResolvedValue(4);
    mockPrisma.order.count.mockResolvedValueOnce(3);

    const result = await service.getSnapshot('biz-1', 'dashboard');

    expect(result).toMatchObject({
      salesThisMonth: { total: 100000, count: 13, avgTicket: expect.any(Number) },
      salesLastMonth: { total: 70000, count: 8 },
      pendingOrders: 3,
      cancelledThisMonth: 2,
      totalProducts: 25,
      outOfStockProducts: 2,
      totalCustomers: 50,
      newCustomersThisMonth: 8,
      unreadMessages: 4,
    });
  });

  it('handles zero orders gracefully', async () => {
    mockPrisma.order.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockPrisma.product.count.mockResolvedValueOnce(0);
    mockPrisma.customer.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockPrisma.conversation.count.mockResolvedValue(0);

    const result = await service.getSnapshot('biz-1', 'dashboard');

    expect(result).toMatchObject({
      salesThisMonth: { total: 0, count: 0, avgTicket: 0 },
      salesLastMonth: { total: 0, count: 0 },
      pendingOrders: 0,
      cancelledThisMonth: 0,
      totalProducts: 0,
      outOfStockProducts: 0,
      totalCustomers: 0,
      newCustomersThisMonth: 0,
      unreadMessages: 0,
    });
  });

  it('returns PedidosSnapshot with correct shape', async () => {
    mockPrisma.order.groupBy.mockResolvedValueOnce([
      { status: 'PENDING', _count: 3 },
      { status: 'COMPLETED', _count: 15 },
      { status: 'CANCELLED', _count: 2 },
    ]);
    const oldDate = new Date();
    oldDate.setHours(oldDate.getHours() - 48);
    mockPrisma.order.findFirst
      .mockResolvedValueOnce({ createdAt: oldDate })
      .mockResolvedValueOnce({ createdAt: new Date('2026-09-07T18:00:00Z') });
    mockPrisma.order.aggregate.mockResolvedValueOnce({
      _sum: { total: 90000 },
      _count: 15,
    });
    mockPrisma.payment.groupBy.mockResolvedValueOnce([
      { method: 'MERCADOPAGO', _count: 10 },
    ]);

    const result = await service.getSnapshot('biz-1', 'pedidos');

    expect(result).toMatchObject({
      countByStatus: { PENDING: 3, COMPLETED: 15, CANCELLED: 2 },
      oldestPendingHours: expect.any(Number),
      avgTicketThisMonth: 6000,
      lastOrderDate: '2026-09-07',
      topPaymentMethod: 'MERCADOPAGO',
    });
    expect((result as any).oldestPendingHours).toBeGreaterThanOrEqual(47);
  });

  it('handles zero orders in pedidos gracefully', async () => {
    mockPrisma.order.groupBy.mockResolvedValueOnce([]);
    mockPrisma.order.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockPrisma.order.aggregate.mockResolvedValueOnce({
      _sum: { total: null },
      _count: 0,
    });
    mockPrisma.payment.groupBy.mockResolvedValueOnce([]);

    const result = await service.getSnapshot('biz-1', 'pedidos');

    expect(result).toMatchObject({
      countByStatus: {},
      oldestPendingHours: null,
      avgTicketThisMonth: 0,
      lastOrderDate: null,
      topPaymentMethod: null,
    });
  });

  it('returns empty object when pedidos queries fail', async () => {
    mockPrisma.order.groupBy.mockRejectedValue(new Error('connection lost'));
    mockPrisma.order.findFirst.mockRejectedValue(new Error('connection lost'));
    mockPrisma.order.aggregate.mockRejectedValue(new Error('connection lost'));
    mockPrisma.payment.groupBy.mockRejectedValue(new Error('connection lost'));

    const result = await service.getSnapshot('biz-1', 'pedidos');
    expect(result).toEqual({});
  });

  it('returns ClientesSnapshot with correct segmentation', async () => {
    mockPrisma.customer.count
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(5);
    mockPrisma.order.groupBy.mockResolvedValueOnce([
      { customerId: 'c1', _count: 12, _sum: { total: 120000 } },
      { customerId: 'c2', _count: 8, _sum: { total: 80000 } },
      { customerId: 'c3', _count: 5, _sum: { total: 50000 } },
      { customerId: 'c4', _count: 3, _sum: { total: 30000 } },
      { customerId: 'c5', _count: 2, _sum: { total: 20000 } },
      { customerId: 'c6', _count: 2, _sum: { total: 15000 } },
      { customerId: 'c7', _count: 2, _sum: { total: 10000 } },
      { customerId: 'c8', _count: 1, _sum: { total: 8000 } },
      { customerId: 'c9', _count: 1, _sum: { total: 5000 } },
      { customerId: 'c10', _count: 1, _sum: { total: 3000 } },
    ]);
    mockPrisma.customer.findUnique.mockResolvedValueOnce({
      firstName: 'María',
      lastName: 'González',
    });

    const result = await service.getSnapshot('biz-1', 'clientes');

    expect(result).toMatchObject({
      totalCustomers: 50,
      newThisMonth: 8,
      segmentation: { vip: 1, recurrent: 6, new: 3, inactive: 5 },
      topCustomerName: 'María González',
    });
  });

  it('handles zero customers gracefully', async () => {
    mockPrisma.customer.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockPrisma.order.groupBy.mockResolvedValueOnce([]);

    const result = await service.getSnapshot('biz-1', 'clientes');

    expect(result).toMatchObject({
      totalCustomers: 0,
      newThisMonth: 0,
      segmentation: { vip: 0, recurrent: 0, new: 0, inactive: 0 },
      topCustomerName: null,
    });
  });

  it('returns empty object when clientes queries fail', async () => {
    mockPrisma.customer.count.mockRejectedValue(new Error('connection lost'));
    mockPrisma.order.groupBy.mockRejectedValue(new Error('connection lost'));

    const result = await service.getSnapshot('biz-1', 'clientes');
    expect(result).toEqual({});
  });

  it('returns CatalogoSnapshot with correct shape', async () => {
    mockPrisma.product.groupBy.mockResolvedValueOnce([
      { status: 'PUBLISHED', _count: 18 },
      { status: 'DRAFT', _count: 5 },
    ]);
    mockPrisma.product.findMany.mockResolvedValueOnce([
      { variants: [{ stock: [{ quantity: 0 }] }] },
      { variants: [{ stock: [{ quantity: 0 }] }] },
      { variants: [{ stock: [] }] },
      { variants: [{ stock: [{ quantity: 1 }] }] },
    ]);
    mockPrisma.product.aggregate.mockResolvedValueOnce({
      _avg: { basePrice: 8500.5 },
    });
    mockPrisma.category.count
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(2);

    const result = await service.getSnapshot('biz-1', 'catalogo');

    expect(result).toMatchObject({
      totalProducts: 23,
      publishedProducts: 18,
      draftProducts: 5,
      outOfStock: 3,
      totalCategories: 6,
      emptyCategories: 2,
      avgPrice: 8500.5,
    });
  });

  it('handles empty catalog gracefully', async () => {
    mockPrisma.product.groupBy.mockResolvedValueOnce([]);
    mockPrisma.product.aggregate.mockResolvedValueOnce({
      _avg: { basePrice: null },
    });
    mockPrisma.category.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const result = await service.getSnapshot('biz-1', 'catalogo');

    expect(result).toMatchObject({
      totalProducts: 0,
      publishedProducts: 0,
      draftProducts: 0,
      outOfStock: 0,
      totalCategories: 0,
      emptyCategories: 0,
      avgPrice: 0,
    });
  });

  it('returns empty object when catalogo queries fail', async () => {
    mockPrisma.product.groupBy.mockRejectedValue(new Error('connection lost'));
    mockPrisma.product.aggregate.mockRejectedValue(new Error('connection lost'));
    mockPrisma.category.count.mockRejectedValue(new Error('connection lost'));

    const result = await service.getSnapshot('biz-1', 'catalogo');
    expect(result).toEqual({});
  });

  it('returns MensajesSnapshot with correct shape', async () => {
    mockPrisma.conversation.count
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(25);

    const result = await service.getSnapshot('biz-1', 'mensajes');

    expect(result).toMatchObject({
      unreadCount: 7,
      totalConversations: 25,
      avgResponseTimeHours: null,
    });
  });

  it('handles zero conversations gracefully', async () => {
    mockPrisma.conversation.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const result = await service.getSnapshot('biz-1', 'mensajes');

    expect(result).toMatchObject({
      unreadCount: 0,
      totalConversations: 0,
      avgResponseTimeHours: null,
    });
  });

  it('returns empty object when mensajes queries fail', async () => {
    mockPrisma.conversation.count.mockRejectedValue(new Error('connection lost'));

    const result = await service.getSnapshot('biz-1', 'mensajes');
    expect(result).toEqual({});
  });
  describe('los mismos números que el panel (evals del panel, 2026-10-01)', () => {
    it('el mes es de Argentina, no del servidor (UTC)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-01T01:00:00.000Z')); // 30/09 22:00 en Argentina
      try {
        await service.getSnapshot('biz-1', 'dashboard');
        const desde = mockPrisma.order.groupBy.mock.calls[0][0].where.createdAt.gte as Date;
        // El mes en curso en Argentina sigue siendo septiembre.
        expect(desde.toISOString()).toBe('2026-09-01T03:00:00.000Z');
      } finally {
        jest.useRealTimers();
      }
    });

    it('las ventas restan las devoluciones aprobadas; el ticket queda bruto', async () => {
      mockPrisma.order.groupBy
        .mockResolvedValueOnce([{ status: 'COMPLETED', _count: 4, _sum: { total: 40000 } }])
        .mockResolvedValueOnce([]);
      mockPrisma.return.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 5000 } })
        .mockResolvedValueOnce({ _sum: { amount: null } });
      const r = await service.getSnapshot('biz-1', 'dashboard') as { salesThisMonth: { total: number; avgTicket: number } };
      expect(r.salesThisMonth).toEqual({ total: 35000, count: 4, avgTicket: 10000 });
      expect(mockPrisma.return.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ businessId: 'biz-1', status: 'APPROVED' }) }));
    });

    it('los pendientes son todos, no solo los de este mes', async () => {
      mockPrisma.order.count.mockResolvedValueOnce(7);
      const r = await service.getSnapshot('biz-1', 'dashboard') as { pendingOrders: number };
      expect(r.pendingOrders).toBe(7);
      expect(mockPrisma.order.count).toHaveBeenCalledWith({ where: { businessId: 'biz-1', deletedAt: null, status: 'PENDING' } });
    });

    it('sin stock = stock 0 sumando variantes, acotado al negocio', async () => {
      mockPrisma.product.findMany.mockResolvedValueOnce([{ variants: [{ stock: [{ quantity: 0 }] }] }]);
      const r = await service.getSnapshot('biz-1', 'dashboard') as { outOfStockProducts: number };
      expect(r.outOfStockProducts).toBe(1);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'biz-1', deletedAt: null } }));
    });
  });
});
