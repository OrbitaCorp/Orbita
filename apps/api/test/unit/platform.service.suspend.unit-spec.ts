import { NotFoundException } from '@nestjs/common';
import { PlatformService } from '../../src/platform/platform.service';

// Unit test de PlatformService.suspendBusiness/reactivateBusiness (RBT-654).
// Cubre el fix de contrato: CONTRATO_API.md pide `{ ok: true }`, no el negocio
// completo (que era lo que devolvía antes del fix).

function makePrisma(business: unknown) {
  const tx = {
    business: { update: jest.fn() },
    subscription: { update: jest.fn() },
    platformAdminLog: { create: jest.fn() },
  };
  return {
    business: { findUnique: jest.fn().mockResolvedValue(business) },
    // Forma callback de $transaction — ejecuta el callback contra el mismo `tx` mockeado.
    $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
    _tx: tx,
  };
}

describe('PlatformService.suspendBusiness / reactivateBusiness (unit)', () => {
  it('suspende: devuelve { ok: true }, marca isPaused, pasa la suscripción a SUSPENDED y loguea', async () => {
    const prisma = makePrisma({ id: 'biz1', subscription: { businessId: 'biz1', status: 'ACTIVE' } });
    const svc = new PlatformService(prisma as any, {} as any, {} as any, {} as any);

    const res = await svc.suspendBusiness('admin1', 'biz1', { reason: 'falta de pago' });

    expect(res).toEqual({ ok: true });
    expect(prisma._tx.business.update).toHaveBeenCalledWith({ where: { id: 'biz1' }, data: { isPaused: true } });
    expect(prisma._tx.subscription.update).toHaveBeenCalledWith({ where: { businessId: 'biz1' }, data: { status: 'SUSPENDED' } });
    expect(prisma._tx.platformAdminLog.create).toHaveBeenCalledWith({
      data: { adminId: 'admin1', action: 'suspend_business', targetType: 'business', targetId: 'biz1', details: { reason: 'falta de pago' } },
    });
  });

  it('suspende sin motivo: details queda undefined (no se guarda un objeto vacío)', async () => {
    const prisma = makePrisma({ id: 'biz1', subscription: null });
    const svc = new PlatformService(prisma as any, {} as any, {} as any, {} as any);

    await svc.suspendBusiness('admin1', 'biz1', {});

    expect(prisma._tx.subscription.update).not.toHaveBeenCalled();
    expect(prisma._tx.platformAdminLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ details: undefined }) }));
  });

  it('suspender un negocio inexistente tira 404', async () => {
    const prisma = makePrisma(null);
    const svc = new PlatformService(prisma as any, {} as any, {} as any, {} as any);

    await expect(svc.suspendBusiness('admin1', 'nope', {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reactiva: devuelve { ok: true }, saca isPaused y solo toca la suscripción si estaba SUSPENDED', async () => {
    const prisma = makePrisma({ id: 'biz1', subscription: { businessId: 'biz1', status: 'SUSPENDED' } });
    const svc = new PlatformService(prisma as any, {} as any, {} as any, {} as any);

    const res = await svc.reactivateBusiness('admin1', 'biz1');

    expect(res).toEqual({ ok: true });
    expect(prisma._tx.business.update).toHaveBeenCalledWith({ where: { id: 'biz1' }, data: { isPaused: false } });
    expect(prisma._tx.subscription.update).toHaveBeenCalledWith({ where: { businessId: 'biz1' }, data: { status: 'ACTIVE' } });
  });

  it('reactivar una suscripción que NO está SUSPENDED (ej. PAST_DUE) no la toca', async () => {
    const prisma = makePrisma({ id: 'biz1', subscription: { businessId: 'biz1', status: 'PAST_DUE' } });
    const svc = new PlatformService(prisma as any, {} as any, {} as any, {} as any);

    await svc.reactivateBusiness('admin1', 'biz1');

    expect(prisma._tx.subscription.update).not.toHaveBeenCalled();
  });
});
