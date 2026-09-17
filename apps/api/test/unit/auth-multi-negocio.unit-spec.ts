import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from '../../src/auth/auth.service';

// Hallazgo real, encontrado 17/09 probando exactamente este escenario (Ale):
// el mismo email puede ser member de VARIOS negocios (ej. dueño de uno y
// vendedor de otro, con contraseñas independientes — aislamiento a propósito,
// ver CLAUDE.md § Auth). El login SIN slug (apex, orbita.site/login — la
// pantalla real de entrada al panel) resolvía la cuenta con `findFirst`, que
// se quedaba con UNA fila cualquiera (Postgres no garantiza el orden sin
// `orderBy`) y probaba la contraseña solo contra ESA: entrar con la
// contraseña CORRECTA del otro negocio tiraba "Credenciales inválidas" según
// qué fila devolviera la base ese día.

const BUSINESS_A = { id: 'biz-a', subdomain: 'tienda-a', name: 'Tienda A', mode: 'FULL' };
const BUSINESS_B = { id: 'biz-b', subdomain: 'tienda-b', name: 'Tienda B', mode: 'FULL' };

function svcCon(members: any[]) {
  const prisma = {
    business: { findUnique: jest.fn() },
    member: {
      findMany: jest.fn().mockResolvedValue(members),
      update: jest.fn().mockResolvedValue({}),
    },
    platformAdmin: { findUnique: jest.fn().mockResolvedValue(null) },
    refreshToken: { create: jest.fn().mockResolvedValue({}) },
  };
  const config = { getOrThrow: jest.fn().mockReturnValue('test-secret-de-al-menos-32-caracteres'), get: jest.fn().mockReturnValue(undefined) };
  const svc = new AuthService(prisma as any, {} as any, config as any);
  return { svc, prisma };
}

async function member(id: string, businessId: string, business: typeof BUSINESS_A, password: string, extra: Record<string, unknown> = {}) {
  return {
    id, email: 'mateo@x.com', name: 'Mateo', businessId,
    passwordHash: await argon2.hash(password),
    lockedUntil: null, failedLoginAttempts: 0, status: 'ACTIVE', invitationTokenExpiresAt: null,
    role: { name: 'owner', rolePermissions: [] }, business,
    hasTempPassword: false, tempPasswordExpiresAt: null,
    ...extra,
  };
}

describe('AuthService.login (apex, sin slug) — el mismo email en varios negocios', () => {
  it('entra con la contraseña del SEGUNDO negocio aunque sea distinta de la del primero', async () => {
    const m1 = await member('m-a', BUSINESS_A.id, BUSINESS_A, 'ClaveDeA12345');
    const m2 = await member('m-b', BUSINESS_B.id, BUSINESS_B, 'ClaveDeB99999');
    const { svc } = svcCon([m1, m2]);

    const res = await svc.login({ email: 'mateo@x.com', password: 'ClaveDeB99999' } as any);
    expect(res).toMatchObject({ type: 'member', business: { id: BUSINESS_B.id } });
  });

  it('entra con la contraseña del PRIMER negocio aunque el segundo aparezca antes en la lista', async () => {
    const m1 = await member('m-a', BUSINESS_A.id, BUSINESS_A, 'ClaveDeA12345');
    const m2 = await member('m-b', BUSINESS_B.id, BUSINESS_B, 'ClaveDeB99999');
    // orden invertido a propósito: simula que Postgres devolvió la otra fila primero
    const { svc } = svcCon([m2, m1]);

    const res = await svc.login({ email: 'mateo@x.com', password: 'ClaveDeA12345' } as any);
    expect(res).toMatchObject({ type: 'member', business: { id: BUSINESS_A.id } });
  });

  it('una contraseña que no coincide con NINGUNO de los dos negocios da 401 genérico', async () => {
    const m1 = await member('m-a', BUSINESS_A.id, BUSINESS_A, 'ClaveDeA12345');
    const m2 = await member('m-b', BUSINESS_B.id, BUSINESS_B, 'ClaveDeB99999');
    const { svc, prisma } = svcCon([m1, m2]);

    const err = await svc.login({ email: 'mateo@x.com', password: 'NingunaDeLasDos' } as any).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnauthorizedException);
    expect((err as Error).message).toBe('Credenciales inválidas');
    // Un intento fallido cuenta contra los DOS negocios — no hay forma de
    // saber a cuál apuntaba, así que los dos acumulan (ver el comentario en
    // AuthService.login()).
    expect(prisma.member.update).toHaveBeenCalledWith({ where: { id: 'm-a' }, data: { failedLoginAttempts: 1 } });
    expect(prisma.member.update).toHaveBeenCalledWith({ where: { id: 'm-b' }, data: { failedLoginAttempts: 1 } });
  });

  it('si el negocio cuya contraseña coincide está bloqueado, gana el bloqueo (no entra igual)', async () => {
    const bloqueado = new Date(Date.now() + 5 * 60 * 1000);
    const m1 = await member('m-a', BUSINESS_A.id, BUSINESS_A, 'ClaveDeA12345', { lockedUntil: bloqueado });
    const { svc } = svcCon([m1]);

    const err = await svc.login({ email: 'mateo@x.com', password: 'ClaveDeA12345' } as any).catch((e: unknown) => e);
    expect((err as Error).message).toMatch(/bloqueada/);
  });
});
