import { ForbiddenException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { SubscriptionActiveGuard } from '../../src/common/guards/subscription-active.guard';

// Unit test del modo "solo lectura" de una tienda suspendida (RBT, 2026-09).
// Cubre las 5 reglas que definen el guard: bloquea escrituras de un member
// suspendido, deja pasar lecturas (GET) siempre, deja pasar a quien no es
// member (customer/platform_admin — no aplican), y respeta la excepción
// @AllowWhenPaused().

function contextCon(method: string, user: any, allowWhenPaused: boolean | undefined) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(allowWhenPaused) };
  const request = { method, user };
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { reflector, context };
}

describe('SubscriptionActiveGuard (unit)', () => {
  it('bloquea un POST de un member cuya suscripción está SUSPENDED', async () => {
    const prisma = { subscription: { findUnique: jest.fn().mockResolvedValue({ status: 'SUSPENDED' }) } };
    const { reflector, context } = contextCon('POST', { type: 'member', businessId: 'biz1' }, undefined);
    const guard = new SubscriptionActiveGuard(reflector as any, prisma as any);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context)).rejects.toThrow('SUBSCRIPTION_SUSPENDED');
  });

  it('deja pasar un POST de un member cuya suscripción está ACTIVE', async () => {
    const prisma = { subscription: { findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE' }) } };
    const { reflector, context } = contextCon('POST', { type: 'member', businessId: 'biz1' }, undefined);
    const guard = new SubscriptionActiveGuard(reflector as any, prisma as any);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('deja pasar un POST de un member en PAST_DUE (todavía en gracia, no bloquea)', async () => {
    const prisma = { subscription: { findUnique: jest.fn().mockResolvedValue({ status: 'PAST_DUE' }) } };
    const { reflector, context } = contextCon('POST', { type: 'member', businessId: 'biz1' }, undefined);
    const guard = new SubscriptionActiveGuard(reflector as any, prisma as any);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('deja pasar cualquier GET aunque la suscripción esté SUSPENDED (modo "ver todo")', async () => {
    const prisma = { subscription: { findUnique: jest.fn() } };
    const { reflector, context } = contextCon('GET', { type: 'member', businessId: 'biz1' }, undefined);
    const guard = new SubscriptionActiveGuard(reflector as any, prisma as any);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled(); // ni siquiera consulta la base para un GET
  });

  it('deja pasar una ruta marcada @AllowWhenPaused() aunque esté SUSPENDED', async () => {
    const prisma = { subscription: { findUnique: jest.fn().mockResolvedValue({ status: 'SUSPENDED' }) } };
    const { reflector, context } = contextCon('POST', { type: 'member', businessId: 'biz1' }, true);
    const guard = new SubscriptionActiveGuard(reflector as any, prisma as any);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
  });

  it('deja pasar a un customer y a un platform_admin sin consultar nada (no dependen de una suscripción de negocio)', async () => {
    const prisma = { subscription: { findUnique: jest.fn() } };

    const customer = contextCon('POST', { type: 'customer', businessId: 'biz1' }, undefined);
    const guardCustomer = new SubscriptionActiveGuard(customer.reflector as any, prisma as any);
    await expect(guardCustomer.canActivate(customer.context)).resolves.toBe(true);

    const admin = contextCon('POST', { type: 'platform_admin' }, undefined);
    const guardAdmin = new SubscriptionActiveGuard(admin.reflector as any, prisma as any);
    await expect(guardAdmin.canActivate(admin.context)).resolves.toBe(true);

    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
  });

  it('deja pasar una request sin usuario (rutas públicas)', async () => {
    const prisma = { subscription: { findUnique: jest.fn() } };
    const { reflector, context } = contextCon('POST', undefined, undefined);
    const guard = new SubscriptionActiveGuard(reflector as any, prisma as any);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('deja pasar si el negocio no tiene ninguna fila de Subscription (nunca debería pasar en la práctica, pero no debe romper)', async () => {
    const prisma = { subscription: { findUnique: jest.fn().mockResolvedValue(null) } };
    const { reflector, context } = contextCon('POST', { type: 'member', businessId: 'biz1' }, undefined);
    const guard = new SubscriptionActiveGuard(reflector as any, prisma as any);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
