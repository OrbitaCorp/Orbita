import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../src/auth/auth.service';
import { AppController } from '../../src/app.controller';
import { IS_PUBLIC_KEY } from '../../src/common/decorators/public.decorator';

// Auditoría interna 10/09: hallazgos auth-refresh-reuso y health-guard.

function svcCon(stored: any) {
  const prisma = {
    refreshToken: {
      findUnique: jest.fn().mockResolvedValue(stored),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      create: jest.fn().mockResolvedValue({}),
    },
    business: { findUnique: jest.fn() },
  };
  const config = { getOrThrow: () => 'test-secret-de-al-menos-32-caracteres', get: () => undefined };
  return { svc: new AuthService(prisma as any, {} as any, config as any), prisma };
}

const base = {
  id: 'rt-1',
  userId: 'm-1',
  userType: 'MEMBER',
  businessId: 'b-1',
  expiresAt: new Date(Date.now() + 86_400_000),
};

describe('AuthService.refresh — reuso de un token rotado', () => {
  it('pasada la gracia, revoca todas las sesiones vivas de ese usuario en ese negocio', async () => {
    const hace = new Date(Date.now() - 60_000);
    const { svc, prisma } = svcCon({ ...base, revokedAt: hace, replacedAt: hace });
    await expect(svc.refresh('viejo')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'm-1', userType: 'MEMBER', businessId: 'b-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('dentro de la gracia (pedidos concurrentes) rota normal y no revoca nada', async () => {
    const recien = new Date(Date.now() - 5_000);
    const { svc, prisma } = svcCon({ ...base, revokedAt: recien, replacedAt: recien });
    const r = await svc.refresh('viejo');
    expect(r.refreshToken).toEqual(expect.any(String));
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('un token revocado por logout (sin replacedAt) solo recibe 401: no es reuso', async () => {
    const { svc, prisma } = svcCon({ ...base, revokedAt: new Date(Date.now() - 60_000), replacedAt: null });
    await expect(svc.refresh('viejo')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('un token vivo rota sin revocar la familia', async () => {
    const { svc, prisma } = svcCon({ ...base, revokedAt: null, replacedAt: null });
    await svc.refresh('vivo');
    expect(prisma.refreshToken.update).toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});

describe('/health', () => {
  it('es público y no devuelve datos', () => {
    expect(new Reflector().get(IS_PUBLIC_KEY, AppController)).toBe(true);
    expect(new AppController({} as any).health()).toEqual({ status: 'ok' });
  });
});
