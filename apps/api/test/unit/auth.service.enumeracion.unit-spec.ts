import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from '../../src/auth/auth.service';

// argon2 es un módulo nativo y sus exports no se pueden espiar con
// jest.spyOn ("Cannot redefine property"). Se reemplaza el módulo por
// envoltorios que SÍ llaman a la implementación real: así se puede contar las
// llamadas sin cambiar el comportamiento (el costo real del hash es parte de
// lo que se está probando).
jest.mock('argon2', () => {
  const real = jest.requireActual('argon2');
  return {
    ...real,
    hash: jest.fn((...args: unknown[]) => (real.hash as (...a: unknown[]) => unknown)(...args)),
    verify: jest.fn((...args: unknown[]) => (real.verify as (...a: unknown[]) => unknown)(...args)),
  };
});
const verifyMock = argon2.verify as unknown as jest.Mock;

// Unit test de la defensa contra enumeración de cuentas (auditoría interna
// 2026-09-09, verificación 5 del ítem `api.auth`).
//
// Lo que se protege: que desde afuera NO se pueda averiguar qué emails tienen
// cuenta, ni por el mensaje/status de la respuesta ni por cuánto tarda. Antes
// fallaba de las dos formas: el login cortaba sin llegar a argon2 cuando el
// email no existía (milisegundos contra cientos de milisegundos), y en el
// storefront un email sin cuenta devolvía 403 NO_ACCOUNT_IN_BUSINESS mientras
// que una contraseña incorrecta devolvía 401.
//
// Mockea Prisma/Mail/Config: no toca la base ni manda mail real.

const BUSINESS = { id: 'biz-1', subdomain: 'tienda', name: 'Tienda', mode: 'FULL' };

function svcCon(overrides: { member?: any; customer?: any; business?: any } = {}) {
  const prisma = {
    business: { findUnique: jest.fn().mockResolvedValue(overrides.business ?? BUSINESS) },
    member: { findFirst: jest.fn().mockResolvedValue(overrides.member ?? null), update: jest.fn().mockResolvedValue({}) },
    customer: { findFirst: jest.fn().mockResolvedValue(overrides.customer ?? null), update: jest.fn().mockResolvedValue({}) },
    platformAdmin: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
    passwordResetToken: { create: jest.fn().mockResolvedValue({}) },
    refreshToken: { create: jest.fn().mockResolvedValue({}) },
  };
  const mail = {
    sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    sendPlatformAdminLoginCode: jest.fn().mockResolvedValue(undefined),
  };
  const config = {
    getOrThrow: jest.fn().mockReturnValue('test-secret-de-al-menos-32-caracteres'),
    get: jest.fn().mockReturnValue(undefined),
  };
  const svc = new AuthService(prisma as any, mail as any, config as any);
  return { svc, prisma, mail };
}

describe('AuthService.login — defensa por tiempo (hash señuelo)', () => {
  // El señuelo se verifica igual que un hash real: lo que importa es que
  // argon2.verify SE LLAME también cuando la cuenta no existe, porque ahí está
  // el costo que iguala los tiempos de respuesta.
  beforeEach(() => verifyMock.mockClear());

  it('apex: un email que no existe igual pasa por argon2 antes de rechazar', async () => {
    const { svc } = svcCon({ member: null });
    await expect(svc.login({ email: 'nadie@x.com', password: 'unaClaveLarga1' } as any)).rejects.toThrow(UnauthorizedException);
    expect(verifyMock).toHaveBeenCalled();
  });

  it('apex: un member sin contraseña seteada tampoco se distingue por tiempo', async () => {
    const { svc } = svcCon({ member: { id: 'm1', passwordHash: null, businessId: 'biz-1', lockedUntil: null } });
    await expect(svc.login({ email: 'sin-pass@x.com', password: 'unaClaveLarga1' } as any)).rejects.toThrow(UnauthorizedException);
    expect(verifyMock).toHaveBeenCalled();
  });

  it('tienda: un email sin cuenta en ese negocio igual pasa por argon2', async () => {
    const { svc } = svcCon({ member: null, customer: null });
    await expect(svc.login({ email: 'nadie@x.com', password: 'unaClaveLarga1' } as any, 'tienda')).rejects.toThrow();
    expect(verifyMock).toHaveBeenCalled();
  });
});

describe('AuthService.login — la respuesta no revela si el email tiene cuenta', () => {
  async function capturar(fn: () => Promise<unknown>) {
    try {
      await fn();
      return { status: 200, body: undefined as any };
    } catch (e: any) {
      return { status: e.getStatus?.() ?? 500, body: e.getResponse?.() ?? e.message };
    }
  }

  it('tienda: email sin cuenta devuelve 401 genérico, no 403 NO_ACCOUNT_IN_BUSINESS', async () => {
    const { svc } = svcCon({ member: null, customer: null });
    const r = await capturar(() => svc.login({ email: 'nadie@x.com', password: 'unaClaveLarga1' } as any, 'tienda'));
    expect(r.status).toBe(401);
    expect(JSON.stringify(r.body)).not.toMatch(/NO_ACCOUNT_IN_BUSINESS|no ten[eé]s cuenta/i);
  });

  it('tienda: email sin cuenta y contraseña incorrecta dan EXACTAMENTE lo mismo', async () => {
    const hash = await argon2.hash('la-clave-de-verdad');
    const sinCuenta = svcCon({ member: null, customer: null });
    const passMala = svcCon({
      member: null,
      customer: { id: 'c1', passwordHash: hash, lockedUntil: null, failedLoginAttempts: 0 },
    });

    const a = await capturar(() => sinCuenta.svc.login({ email: 'nadie@x.com', password: 'otraClave123' } as any, 'tienda'));
    const b = await capturar(() => passMala.svc.login({ email: 'existe@x.com', password: 'otraClave123' } as any, 'tienda'));

    expect(a.status).toBe(b.status);
    expect(a.body).toEqual(b.body);
  });

  it('la cuenta bloqueada sigue avisando: es el único caso que se distingue, y exige 5 fallos previos', async () => {
    const dentroDe15Min = new Date(Date.now() + 10 * 60 * 1000);
    const { svc } = svcCon({
      member: null,
      customer: { id: 'c1', passwordHash: 'x', lockedUntil: dentroDe15Min, failedLoginAttempts: 5 },
    });
    await expect(svc.login({ email: 'bloqueada@x.com', password: 'unaClaveLarga1' } as any, 'tienda')).rejects.toThrow(ForbiddenException);
  });
});

describe('AuthService.forgotPassword — no espera al envío del mail', () => {
  it('responde aunque el proveedor de mail quede colgado', async () => {
    const { svc, mail, prisma } = svcCon({ member: { id: 'm1', email: 'real@x.com', businessId: 'biz-1' } });
    // Mail que nunca resuelve: si forgotPassword lo esperara, este test
    // colgaría hasta el timeout de jest. Esa espera era justamente el oráculo
    // de tiempo (un email real tardaba lo que tarda el SMTP; uno inexistente,
    // nada).
    mail.sendPasswordReset.mockReturnValue(new Promise(() => {}));

    await expect(svc.forgotPassword({ email: 'real@x.com' } as any, 'tienda')).resolves.toBeUndefined();
    // El código igual quedó guardado antes de devolver.
    expect(prisma.passwordResetToken.create).toHaveBeenCalled();
  });

  it('un fallo del proveedor de mail no se le escapa al cliente como error', async () => {
    const { svc, mail } = svcCon({ member: { id: 'm1', email: 'real@x.com', businessId: 'biz-1' } });
    mail.sendPasswordReset.mockRejectedValue(new Error('SMTP caído'));
    await expect(svc.forgotPassword({ email: 'real@x.com' } as any, 'tienda')).resolves.toBeUndefined();
  });

  it('un email que no existe devuelve lo mismo y no toca la tabla de códigos', async () => {
    const { svc, prisma } = svcCon({ member: null, customer: null });
    await expect(svc.forgotPassword({ email: 'nadie@x.com' } as any, 'tienda')).resolves.toBeUndefined();
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });
});
