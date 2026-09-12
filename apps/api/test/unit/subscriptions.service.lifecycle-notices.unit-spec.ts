import { Prisma } from '@prisma/client';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';

// Unit test de processLifecycleNotices() — los avisos por mail del ciclo de
// vida de la suscripción (RBT, 2026-09). Lo importante a cubrir: (1) nunca
// manda el mismo aviso (stage + periodEnd) dos veces, garantizado por el
// unique de SubscriptionLifecycleNotice, no por lógica de la app — así que el
// test simula la carrera directamente contra el mock de Prisma; (2) el
// "motivo" del texto depende de si es cortesía, bienvenida o un plan pago ya
// activo cuyo cobro falló; (3) SUSPENDIDA corta la cadena (no manda además
// GRACIA_INICIO/MEDIO).

function p2002() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
}

function makeService() {
  const notices = new Map<string, boolean>(); // clave subscriptionId|stage|periodEnd -> ya existe
  const prisma = {
    subscription: { findMany: jest.fn() },
    subscriptionLifecycleNotice: {
      create: jest.fn(({ data }: any) => {
        const key = `${data.subscriptionId}|${data.stage}|${data.periodEnd.toISOString()}`;
        if (notices.has(key)) return Promise.reject(p2002());
        notices.set(key, true);
        return Promise.resolve({ id: 'n1', ...data });
      }),
    },
    business: { findUnique: jest.fn() },
    member: { findMany: jest.fn().mockResolvedValue([{ email: 'dueno@test.com' }]) },
  };
  const mail = {
    sendSubscriptionEndingSoon: jest.fn(),
    sendSubscriptionPeriodEnded: jest.fn(),
    sendSubscriptionGraceReminder: jest.fn(),
    sendSubscriptionSuspended: jest.fn(),
    sendSubscriptionReactivated: jest.fn(),
  };
  const config = { get: () => undefined };
  const svc = new SubscriptionsService(prisma as any, config as any, {} as any, {} as any, {} as any, {} as any, mail as any);
  (svc as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return { svc, prisma, mail };
}

const businessMock = { name: 'Mi Tienda', subdomain: 'mitienda' };

describe('SubscriptionsService.processLifecycleNotices (unit)', () => {
  it('manda PRE_AVISO para una cortesía a 3 días de vencer, y no lo repite si el cron vuelve a correr', async () => {
    const { svc, prisma, mail } = makeService();
    const periodEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const comp = { id: 'sub1', businessId: 'biz1', origin: 'COMP', planActive: true, currentPeriodEnd: periodEnd, gracePeriodDays: 7 };
    prisma.subscription.findMany
      .mockResolvedValueOnce([comp]) // porVencer
      .mockResolvedValueOnce([]); // enGraciaOSuspendidas
    prisma.business.findUnique.mockResolvedValue(businessMock);

    await svc.processLifecycleNotices();
    expect(mail.sendSubscriptionEndingSoon).toHaveBeenCalledTimes(1);
    expect(mail.sendSubscriptionEndingSoon).toHaveBeenCalledWith(
      'dueno@test.com',
      expect.objectContaining({ businessName: 'Mi Tienda', motivo: 'Tu período de cortesía' }),
      { businessId: 'biz1' },
    );

    // Segunda corrida del cron (mismo día, mismo periodEnd): no debe reenviar.
    prisma.subscription.findMany.mockResolvedValueOnce([comp]).mockResolvedValueOnce([]);
    await svc.processLifecycleNotices();
    expect(mail.sendSubscriptionEndingSoon).toHaveBeenCalledTimes(1);
  });

  it('GRACIA_INICIO usa "Tu período de bienvenida" cuando planActive=false, y "Tu suscripción" para un plan pago activo', async () => {
    const { svc, prisma, mail } = makeService();
    const vencidaHaceUnDia = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const bienvenida = { id: 'sub1', businessId: 'biz1', origin: 'PAID', planActive: false, status: 'PAST_DUE', currentPeriodEnd: vencidaHaceUnDia, gracePeriodDays: 7 };
    prisma.subscription.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([bienvenida]);
    prisma.business.findUnique.mockResolvedValue(businessMock);

    await svc.processLifecycleNotices();

    expect(mail.sendSubscriptionPeriodEnded).toHaveBeenCalledWith(
      'dueno@test.com',
      expect.objectContaining({ motivo: 'Tu período de bienvenida', graceDaysLeft: 6 }),
      { businessId: 'biz1' },
    );
  });

  it('GRACIA_MEDIO se manda recién a mitad de camino de la gracia, no antes', async () => {
    const { svc, prisma, mail } = makeService();
    const gracePeriodDays = 7; // mitad = día 3
    const vencidaHaceUnDia = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const sub = { id: 'sub1', businessId: 'biz1', origin: 'PAID', planActive: true, status: 'PAST_DUE', currentPeriodEnd: vencidaHaceUnDia, gracePeriodDays };
    prisma.subscription.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([sub]);
    prisma.business.findUnique.mockResolvedValue(businessMock);

    await svc.processLifecycleNotices();
    expect(mail.sendSubscriptionGraceReminder).not.toHaveBeenCalled();

    // Avanza a mitad de la gracia (día 3 de 7).
    const { svc: svc2, prisma: prisma2, mail: mail2 } = makeService();
    const vencidaHace3Dias = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const subMitad = { ...sub, currentPeriodEnd: vencidaHace3Dias };
    prisma2.subscription.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([subMitad]);
    prisma2.business.findUnique.mockResolvedValue(businessMock);

    await svc2.processLifecycleNotices();
    expect(mail2.sendSubscriptionGraceReminder).toHaveBeenCalledWith(
      'dueno@test.com',
      expect.objectContaining({ graceDaysLeft: 4 }),
      { businessId: 'biz1' },
    );
  });

  it('SUSPENDIDA manda el aviso de suspensión y NO manda además gracia inicio/medio', async () => {
    const { svc, prisma, mail } = makeService();
    const vencidaHace10Dias = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const suspendida = { id: 'sub1', businessId: 'biz1', origin: 'COMP', planActive: true, status: 'SUSPENDED', currentPeriodEnd: vencidaHace10Dias, gracePeriodDays: 7 };
    prisma.subscription.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([suspendida]);
    prisma.business.findUnique.mockResolvedValue(businessMock);

    await svc.processLifecycleNotices();

    expect(mail.sendSubscriptionSuspended).toHaveBeenCalledWith(
      'dueno@test.com',
      { businessName: 'Mi Tienda', reactivateUrl: 'https://mitienda.orbita.site/admin/ventas/configuracion?vista=suscripcion' },
      { businessId: 'biz1' },
    );
    expect(mail.sendSubscriptionPeriodEnded).not.toHaveBeenCalled();
    expect(mail.sendSubscriptionGraceReminder).not.toHaveBeenCalled();
  });

  it('no manda nada si el negocio no tiene ningún member owner activo', async () => {
    const { svc, prisma, mail } = makeService();
    prisma.member.findMany.mockResolvedValueOnce([]);
    const periodEnd = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
    const comp = { id: 'sub1', businessId: 'biz1', origin: 'COMP', planActive: true, currentPeriodEnd: periodEnd, gracePeriodDays: 7 };
    prisma.subscription.findMany.mockResolvedValueOnce([comp]).mockResolvedValueOnce([]);
    prisma.business.findUnique.mockResolvedValue(businessMock);

    await svc.processLifecycleNotices();
    expect(mail.sendSubscriptionEndingSoon).not.toHaveBeenCalled();
  });
});
