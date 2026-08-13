import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlatformService } from '../../src/platform/platform.service';

// Unit test de PlatformService.grantComp (RBT-651) -- cubre el fix de
// contrato: CONTRATO_API.md:1737 pide "la Subscription", no el negocio
// completo (que era lo que devolvía antes del fix).

function makePrisma(business: unknown, upsertResult: unknown) {
  const tx = {
    subscription: { upsert: jest.fn().mockResolvedValue(upsertResult) },
    platformAdminLog: { create: jest.fn() },
  };
  return {
    business: { findUnique: jest.fn().mockResolvedValue(business) },
    $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
    _tx: tx,
  };
}

const upsertedSub = {
  businessId: 'biz1', status: 'ACTIVE', origin: 'COMP', plan: 'standard',
  amount: { toString: () => '0' } as any, currency: 'ARS',
  currentPeriodStart: new Date('2026-08-12'), currentPeriodEnd: new Date('2026-11-12'),
  grantReason: 'cliente fundador',
};

describe('PlatformService.grantComp (unit)', () => {
  it('devuelve el shape de Subscription (no el negocio completo)', async () => {
    const prisma = makePrisma({ id: 'biz1' }, upsertedSub);
    const svc = new PlatformService(prisma as any);

    const res = await svc.grantComp('admin1', 'biz1', { currentPeriodEnd: '2026-11-12T00:00:00.000Z', grantReason: 'cliente fundador' });

    expect(res).toEqual({
      businessId: 'biz1',
      status: 'ACTIVE',
      origin: 'COMP',
      plan: 'standard',
      amount: 0,
      currency: 'ARS',
      currentPeriodStart: upsertedSub.currentPeriodStart,
      currentPeriodEnd: upsertedSub.currentPeriodEnd,
      grantReason: 'cliente fundador',
    });
  });

  it('registra la acción en platformAdminLog con adminId, motivo y fecha', async () => {
    const prisma = makePrisma({ id: 'biz1' }, upsertedSub);
    const svc = new PlatformService(prisma as any);

    await svc.grantComp('admin1', 'biz1', { currentPeriodEnd: '2026-11-12T00:00:00.000Z', grantReason: 'canje' });

    expect(prisma._tx.platformAdminLog.create).toHaveBeenCalledWith({
      data: {
        adminId: 'admin1', action: 'grant_comp', targetType: 'subscription', targetId: 'biz1',
        details: { grantReason: 'canje', currentPeriodEnd: '2026-11-12T00:00:00.000Z' },
      },
    });
  });

  it('rechaza con 400 si currentPeriodEnd no es una fecha válida', async () => {
    const prisma = makePrisma({ id: 'biz1' }, upsertedSub);
    const svc = new PlatformService(prisma as any);

    await expect(svc.grantComp('admin1', 'biz1', { currentPeriodEnd: 'no-es-fecha', grantReason: 'x' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza con 404 si el negocio no existe', async () => {
    const prisma = makePrisma(null, upsertedSub);
    const svc = new PlatformService(prisma as any);

    await expect(svc.grantComp('admin1', 'nope', { currentPeriodEnd: '2026-11-12T00:00:00.000Z', grantReason: 'x' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
