import { NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';

// Unit test de las dos lecturas que expone SubscriptionsController al dueño
// del negocio (GET /subscription y GET /subscription/payments) — confirma
// que el shape de respuesta matchea CONTRATO_API.md § Fase 11 (RBT-648).
// Solo mockea Prisma: no toca la base ni el SDK de MercadoPago (estas dos
// lecturas no lo usan).

function svcCon(subscription: any, payments: any[] = [], total = 0) {
  const prisma = {
    subscription: { findUnique: jest.fn().mockResolvedValue(subscription) },
    subscriptionPayment: {
      findMany: jest.fn().mockResolvedValue(payments),
      count: jest.fn().mockResolvedValue(total),
    },
  };
  const noop = {} as any;
  const svc = new SubscriptionsService(prisma as any, noop, noop, noop, noop, noop);
  return { svc, prisma };
}

const sub = {
  id: 'sub-1',
  origin: 'PAID',
  status: 'ACTIVE',
  plan: 'starter',
  amount: { toString: () => '5000' } as any, // Prisma.Decimal — Number() lo castea vía valueOf/toString
  currency: 'ARS',
  currentPeriodStart: new Date('2026-08-01'),
  currentPeriodEnd: new Date('2026-09-01'),
  gracePeriodDays: 4,
  grantReason: null,
};

describe('SubscriptionsService — lecturas (unit)', () => {
  describe('getForBusiness', () => {
    it('devuelve el shape exacto de CONTRATO_API.md', async () => {
      const { svc } = svcCon(sub);
      const result = await svc.getForBusiness('biz-1');
      expect(result).toEqual({
        id: 'sub-1',
        origin: 'PAID',
        status: 'ACTIVE',
        plan: 'starter',
        amount: 5000,
        currency: 'ARS',
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        gracePeriodDays: 4,
        grantReason: null,
      });
    });

    it('tira 404 si el negocio no tiene suscripción', async () => {
      const { svc } = svcCon(null);
      await expect(svc.getForBusiness('biz-sin-sub')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getPayments', () => {
    const pago = {
      id: 'pay-1',
      amount: { toString: () => '5000' } as any,
      status: 'APPROVED',
      periodStart: new Date('2026-08-01'),
      periodEnd: new Date('2026-09-01'),
      paidAt: new Date('2026-08-01'),
      failedReason: null,
    };

    it('devuelve Paginated<SubscriptionPayment> con el shape del contrato', async () => {
      const { svc } = svcCon(sub, [pago], 1);
      const result = await svc.getPayments('biz-1', 1, 20);
      expect(result).toEqual({
        data: [
          {
            id: 'pay-1',
            amount: 5000,
            status: 'APPROVED',
            periodStart: pago.periodStart,
            periodEnd: pago.periodEnd,
            paidAt: pago.paidAt,
            failedReason: null,
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('pagina con skip/take según page y limit', async () => {
      const { svc, prisma } = svcCon(sub, [], 0);
      await svc.getPayments('biz-1', 3, 10);
      expect(prisma.subscriptionPayment.findMany.mock.calls[0][0]).toMatchObject({ skip: 20, take: 10 });
    });

    it('tira 404 si el negocio no tiene suscripción', async () => {
      const { svc } = svcCon(null);
      await expect(svc.getPayments('biz-sin-sub')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
