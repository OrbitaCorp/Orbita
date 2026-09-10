import { NotificationsService } from '../../src/notifications/notifications.service';

// Auditoría interna 10/09, ítem api.notifications: el resumen diario cuenta
// el día de Argentina, no el del servidor (UTC), y la lectura/marcado filtra
// siempre por el negocio del token.

function armar() {
  const prisma = {
    notificationConfig: {
      findMany: jest.fn().mockResolvedValue([{ businessId: 'biz', matrix: { resumen_diario: { panel: true, email: false } } }]),
      findUnique: jest.fn().mockResolvedValue({ matrix: { resumen_diario: { panel: true, email: false } } }),
    },
    order: { aggregate: jest.fn().mockResolvedValue({ _sum: { total: 0 }, _count: 0 }) },
    customer: { count: jest.fn().mockResolvedValue(0) },
    variantStock: { findMany: jest.fn().mockResolvedValue([]) },
    notification: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const svc = new NotificationsService(prisma as any, { sendCustomEmail: jest.fn() } as any);
  return { svc, prisma };
}

describe('NotificationsService.resumenDiario: día de Argentina', () => {
  afterEach(() => jest.useRealTimers());

  it.each([
    // 19:00 de Argentina (horario del job): hoy arranca 00:00 AR = 03:00 UTC.
    ['2026-09-10T22:00:00.000Z', '2026-09-10T03:00:00.000Z', '2026-09-09T03:00:00.000Z', '10/9/2026'],
    // 22:30 de Argentina, ya 11/09 en UTC: sigue siendo el 10 en Argentina.
    ['2026-09-11T01:30:00.000Z', '2026-09-10T03:00:00.000Z', '2026-09-09T03:00:00.000Z', '10/9/2026'],
  ])('a las %s cuenta desde %s (ayer desde %s)', async (ahora, desde, ayer, fecha) => {
    jest.useFakeTimers({ now: new Date(ahora), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    const { svc, prisma } = armar();

    await svc.resumenDiario();

    const rangos = prisma.order.aggregate.mock.calls.map((c: any[]) => c[0].where.createdAt);
    expect(rangos[0].gte.toISOString()).toBe(desde);
    expect(rangos[0].lt.toISOString()).toBe(ahora);
    expect(rangos[1].gte.toISOString()).toBe(ayer);
    expect(rangos[1].lt.toISOString()).toBe(desde);
    expect(prisma.customer.count.mock.calls[0][0].where.createdAt.gte.toISOString()).toBe(desde);
    expect(prisma.notification.create.mock.calls[0][0].data.title).toBe(`Resumen del día: ${fecha}`);
  });
});

describe('NotificationsService: aislamiento por negocio', () => {
  it('markRead de una notificación de otro negocio → 404 sin tocar nada', async () => {
    const { svc, prisma } = armar();
    await expect(svc.markRead('biz', '6f1c2d3e-0000-4000-8000-000000000000')).rejects.toThrow('Notificación no encontrada');
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({ where: { id: '6f1c2d3e-0000-4000-8000-000000000000', businessId: 'biz' } });
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('findAll y markAllRead filtran por el businessId recibido', async () => {
    const { svc, prisma } = armar();
    (prisma as any).$transaction = jest.fn().mockResolvedValue([[], 0]);
    (prisma.notification as any).findMany = jest.fn();
    (prisma.notification as any).count = jest.fn();
    await svc.findAll('biz', {});
    await svc.markAllRead('biz');
    expect((prisma.notification as any).findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'biz' } }));
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({ where: { businessId: 'biz', isRead: false }, data: { isRead: true } });
  });
});
