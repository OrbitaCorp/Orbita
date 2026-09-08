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
      },
      product: { count: jest.fn().mockResolvedValue(0) },
      customer: { count: jest.fn().mockResolvedValue(0) },
      conversation: { count: jest.fn().mockResolvedValue(0) },
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
    mockPrisma.product.count
      .mockResolvedValueOnce(25)
      .mockResolvedValueOnce(2);
    mockPrisma.customer.count
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(8);
    mockPrisma.conversation.count.mockResolvedValue(4);

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
    mockPrisma.product.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
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
});
