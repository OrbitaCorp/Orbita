import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlatformService, SOLO_REALES } from '../../src/platform/platform.service';

// Negocios de prueba (24/11/2026): siguen funcionando, pero no cuentan en las
// métricas del superadmin y la lista de Negocios los separa de los reales.
// Prisma mockeado a mano, mismo patrón que el resto de platform.service.*.

function makePrisma() {
  const tx = { business: { update: jest.fn() }, platformAdminLog: { create: jest.fn() } };
  return {
    tx,
    business: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) },
    subscription: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]), aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }) },
    subscriptionPayment: { findMany: jest.fn().mockResolvedValue([]) },
    customDomain: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    member: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((arg: unknown) => (typeof arg === 'function' ? (arg as (t: unknown) => unknown)(tx) : Promise.all(arg as Promise<unknown>[]))),
  };
}
const servicio = (prisma: unknown) => new PlatformService(prisma as any, {} as any, {} as any, {} as any);

describe('PlatformService — negocios de prueba', () => {
  it('SOLO_REALES deja afuera los de prueba y la demo pública', () => {
    expect(SOLO_REALES).toEqual({ isTest: false, isDemo: false });
  });

  it('el resumen cuenta solo reales y trae aparte cuántos son de prueba', async () => {
    const prisma = makePrisma();
    prisma.business.count.mockResolvedValue(7);
    await servicio(prisma).overview();

    for (const [arg] of prisma.business.count.mock.calls.slice(0, 5)) expect(arg.where).toMatchObject(SOLO_REALES);
    for (const [arg] of prisma.business.groupBy.mock.calls) expect(arg.where).toEqual(SOLO_REALES);
    for (const [arg] of prisma.subscription.groupBy.mock.calls) expect(arg.where).toEqual({ business: SOLO_REALES });
    expect(prisma.subscription.aggregate.mock.calls[0][0].where).toMatchObject({ origin: 'PAID', business: SOLO_REALES });
    // El último conteo es el de prueba y no lleva el filtro de reales.
    const ultimo = prisma.business.count.mock.calls.at(-1)![0].where;
    expect(ultimo).toEqual({ OR: [{ isTest: true }, { isDemo: true }] });
  });

  it('la lista trae solo reales por defecto, y los de prueba solo cuando se piden', async () => {
    const prisma = makePrisma();
    await servicio(prisma).listBusinesses({});
    expect(prisma.business.findMany.mock.calls[0][0].where).toMatchObject(SOLO_REALES);

    prisma.business.findMany.mockClear();
    await servicio(prisma).listBusinesses({ tipo: 'pruebas', search: 'abc' });
    const where = prisma.business.findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ OR: [{ isTest: true }, { isDemo: true }] });
    // El buscador y "de prueba" no se pisan: cada uno con su OR.
    expect(where.AND[0].OR).toHaveLength(3);

    prisma.business.findMany.mockClear();
    await servicio(prisma).listBusinesses({ tipo: 'todos' });
    expect(prisma.business.findMany.mock.calls[0][0].where).toEqual({});
  });

  it('cada fila dice si es de prueba y la lista informa cuántos hay de cada tipo', async () => {
    const prisma = makePrisma();
    const fila = (isTest: boolean, isDemo: boolean) => ({
      id: 'b', name: 'n', subdomain: 's', industry: 'i', mode: 'FULL', isActive: true, isPaused: false, createdAt: new Date(),
      isTest, isDemo, subscription: null, members: [], customDomains: [], _count: { products: 0, orders: 0, customers: 0 },
    });
    prisma.business.findMany.mockResolvedValue([fila(true, false), fila(false, true), fila(false, false)]);
    prisma.business.count.mockResolvedValueOnce(3).mockResolvedValueOnce(40).mockResolvedValueOnce(5);
    const res = await servicio(prisma).listBusinesses({ tipo: 'todos' });
    expect(res.data.map((r) => r.esPrueba)).toEqual([true, true, false]);
    expect(res.tipos).toEqual({ reales: 40, pruebas: 5 });
  });

  it('las series, suscripciones, dominios y dueños salen solo de reales', async () => {
    const prisma = makePrisma();
    const svc = servicio(prisma);
    await svc.growthSeries({});
    expect(prisma.business.findMany.mock.calls[0][0].where).toMatchObject(SOLO_REALES);
    expect(prisma.subscription.findMany.mock.calls[0][0].where).toMatchObject({ business: SOLO_REALES });
    await svc.revenueSeries({});
    expect(prisma.subscriptionPayment.findMany.mock.calls[0][0].where).toMatchObject({ subscription: { business: SOLO_REALES } });
    await svc.listSubscriptions();
    expect(prisma.subscription.findMany.mock.calls[1][0].where).toEqual({ business: SOLO_REALES });
    await svc.listOwners();
    expect(prisma.member.findMany.mock.calls[0][0].where).toMatchObject({ business: SOLO_REALES });
    await svc.listDomains();
    expect(prisma.customDomain.findMany.mock.calls[0][0].where).toEqual({ business: SOLO_REALES });
  });

  describe('setTest', () => {
    it('marca y desmarca con registro en el log del superadmin', async () => {
      const prisma = makePrisma();
      prisma.business.findUnique.mockResolvedValue({ id: 'b1', isDemo: false });
      const svc = servicio(prisma);

      await expect(svc.setTest('admin1', 'b1', true)).resolves.toEqual({ ok: true });
      expect(prisma.tx.business.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { isTest: true } });
      expect(prisma.tx.platformAdminLog.create).toHaveBeenCalledWith({
        data: { adminId: 'admin1', action: 'mark_business_test', targetType: 'business', targetId: 'b1' },
      });

      await svc.setTest('admin1', 'b1', false);
      expect(prisma.tx.business.update).toHaveBeenLastCalledWith({ where: { id: 'b1' }, data: { isTest: false } });
      expect(prisma.tx.platformAdminLog.create).toHaveBeenLastCalledWith({
        data: { adminId: 'admin1', action: 'unmark_business_test', targetType: 'business', targetId: 'b1' },
      });
    });

    it('un negocio inexistente da 404 y la demo pública no se marca (ya está aparte)', async () => {
      const prisma = makePrisma();
      const svc = servicio(prisma);
      prisma.business.findUnique.mockResolvedValue(null);
      await expect(svc.setTest('admin1', 'nope', true)).rejects.toBeInstanceOf(NotFoundException);
      prisma.business.findUnique.mockResolvedValue({ id: 'demo', isDemo: true });
      await expect(svc.setTest('admin1', 'demo', true)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.tx.business.update).not.toHaveBeenCalled();
    });
  });
});
