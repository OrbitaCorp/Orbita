import { PlatformService } from '../../src/platform/platform.service';

// Unit test de PlatformService.listLogs (RBT-655 — lectura/filtros de
// platform_admin_logs). Prisma mockeado a mano, mismo patrón que el resto de
// la suite: instanciación directa, sin TestingModule de Nest.

function makePrisma() {
  return {
    platformAdminLog: { findMany: jest.fn(), count: jest.fn() },
    business: { findMany: jest.fn() },
    $transaction: jest.fn((arr: Promise<unknown>[]) => Promise.all(arr)),
  };
}

const logRow = (over: Partial<{
  id: string; adminId: string; action: string; targetType: string; targetId: string; details: unknown; createdAt: Date;
}> = {}) => ({
  id: 'log1', adminId: 'admin1', action: 'suspend_business', targetType: 'business', targetId: 'biz1',
  details: null, createdAt: new Date('2026-08-12T10:00:00Z'),
  admin: { name: 'CTO', email: 'cto@orbita-corp.com' },
  ...over,
});

describe('PlatformService.listLogs (unit)', () => {
  it('pagina con defaults (page=1, limit=20) y resuelve el nombre del negocio', async () => {
    const prisma = makePrisma();
    prisma.platformAdminLog.findMany.mockResolvedValue([logRow()]);
    prisma.platformAdminLog.count.mockResolvedValue(1);
    prisma.business.findMany.mockResolvedValue([{ id: 'biz1', name: 'Zapatos Lorena' }]);
    const svc = new PlatformService(prisma as any);

    const res = await svc.listLogs({});

    expect(res).toEqual({
      data: [{
        id: 'log1',
        admin: { id: 'admin1', name: 'CTO', email: 'cto@orbita-corp.com' },
        action: 'suspend_business',
        targetType: 'business',
        targetId: 'biz1',
        businessName: 'Zapatos Lorena',
        details: null,
        createdAt: logRow().createdAt,
      }],
      total: 1,
      page: 1,
      limit: 20,
    });
    expect(prisma.platformAdminLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {}, skip: 0, take: 20,
    }));
  });

  it('arma el where con los tres filtros cuando vienen', async () => {
    const prisma = makePrisma();
    prisma.platformAdminLog.findMany.mockResolvedValue([]);
    prisma.platformAdminLog.count.mockResolvedValue(0);
    prisma.business.findMany.mockResolvedValue([]);
    const svc = new PlatformService(prisma as any);

    await svc.listLogs({ adminId: 'admin1', action: 'grant_comp', businessId: 'biz1', page: 2, limit: 10 });

    expect(prisma.platformAdminLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { adminId: 'admin1', action: 'grant_comp', targetId: 'biz1' },
      skip: 10,
      take: 10,
    }));
  });

  it('no resuelve businessName para logs cuyo target no es negocio/suscripción (ej. admin CRUD)', async () => {
    const prisma = makePrisma();
    prisma.platformAdminLog.findMany.mockResolvedValue([
      logRow({ id: 'log2', action: 'create_admin', targetType: 'platform_admin', targetId: 'admin2' }),
    ]);
    prisma.platformAdminLog.count.mockResolvedValue(1);
    prisma.business.findMany.mockResolvedValue([]);
    const svc = new PlatformService(prisma as any);

    const res = await svc.listLogs({});

    expect(res.data[0].businessName).toBeNull();
    // No consulta business.findMany con IDs si no hay ningún target de tipo negocio/suscripción.
    expect(prisma.business.findMany).not.toHaveBeenCalled();
  });

  it('deduplica IDs de negocio antes de resolver nombres (sin N+1 por fila)', async () => {
    const prisma = makePrisma();
    prisma.platformAdminLog.findMany.mockResolvedValue([
      logRow({ id: 'log1', targetType: 'business', targetId: 'biz1' }),
      logRow({ id: 'log2', targetType: 'subscription', targetId: 'biz1' }),
    ]);
    prisma.platformAdminLog.count.mockResolvedValue(2);
    prisma.business.findMany.mockResolvedValue([{ id: 'biz1', name: 'Zapatos Lorena' }]);
    const svc = new PlatformService(prisma as any);

    await svc.listLogs({});

    expect(prisma.business.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.business.findMany).toHaveBeenCalledWith({ where: { id: { in: ['biz1'] } }, select: { id: true, name: true } });
  });
});
