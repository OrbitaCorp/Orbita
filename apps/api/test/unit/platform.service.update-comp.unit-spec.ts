import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlatformService } from '../../src/platform/platform.service';

// PlatformService.updateComp: extender o acortar una cortesía ya cedida.

const DIA = 24 * 60 * 60 * 1000;

function armar(sub: Record<string, unknown> | null) {
  const tx = {
    subscription: { update: jest.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ ...sub, ...data })) },
    business: { update: jest.fn() },
    platformAdminLog: { create: jest.fn() },
  };
  const prisma = {
    subscription: { findUnique: jest.fn().mockResolvedValue(sub) },
    $transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb(tx)),
  };
  return { svc: new PlatformService(prisma as any, {} as any, {} as any, {} as any), tx };
}

const cortesia = (o: Record<string, unknown> = {}) => ({
  businessId: 'biz1', origin: 'COMP', status: 'ACTIVE', grantReason: 'cliente fundador',
  currentPeriodStart: new Date(Date.now() - 30 * DIA), currentPeriodEnd: new Date(Date.now() + 60 * DIA),
  ...o,
});

describe('PlatformService.updateComp (unit)', () => {
  it('acorta la fecha y deja el motivo si no se manda otro', async () => {
    const { svc, tx } = armar(cortesia());
    const nueva = new Date(Date.now() + 10 * DIA);
    const res = await svc.updateComp('admin1', 'biz1', { currentPeriodEnd: nueva.toISOString() });
    expect(res.currentPeriodEnd).toEqual(nueva);
    expect(res.grantReason).toBe('cliente fundador');
    expect(tx.subscription.update.mock.calls[0][0].data.status).toBeUndefined();
    expect(tx.platformAdminLog.create.mock.calls[0][0].data.action).toBe('update_comp');
  });

  it('terminarla hoy la deja vencida ahora, para que el barrido le dé la gracia', async () => {
    const { svc, tx } = armar(cortesia());
    const antes = Date.now();
    await svc.updateComp('admin1', 'biz1', { currentPeriodEnd: new Date(antes - 60_000).toISOString() });
    const fin = tx.subscription.update.mock.calls[0][0].data.currentPeriodEnd as Date;
    expect(fin.getTime()).toBeGreaterThanOrEqual(antes);
    expect(fin.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('extender una suspendida la reactiva y despausa la tienda', async () => {
    const { svc, tx } = armar(cortesia({ status: 'SUSPENDED', currentPeriodEnd: new Date(Date.now() - 10 * DIA) }));
    await svc.updateComp('admin1', 'biz1', { currentPeriodEnd: new Date(Date.now() + 30 * DIA).toISOString(), grantReason: 'canje' });
    expect(tx.subscription.update.mock.calls[0][0].data).toMatchObject({ status: 'ACTIVE', grantReason: 'canje' });
    expect(tx.business.update).toHaveBeenCalledWith({ where: { id: 'biz1' }, data: { isPaused: false } });
  });

  it('rechaza una fecha anterior a hoy', async () => {
    const { svc } = armar(cortesia());
    await expect(svc.updateComp('admin1', 'biz1', { currentPeriodEnd: new Date(Date.now() - 3 * DIA).toISOString() }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza si la suscripción es paga o no existe', async () => {
    await expect(armar(cortesia({ origin: 'PAID' })).svc.updateComp('admin1', 'biz1', { currentPeriodEnd: new Date().toISOString() }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(armar(null).svc.updateComp('admin1', 'biz1', { currentPeriodEnd: new Date().toISOString() }))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
