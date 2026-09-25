import { createHash } from 'crypto';
import * as argon2 from 'argon2';
import { AuthService } from '../../src/auth/auth.service';
import { MemberProfileService } from '../../src/member-profile/member-profile.service';
import { MeService } from '../../src/me/me.service';

// Hallazgo BAJA `cambio-clave-sin-cerrar-sesiones` (auditoría interna 09/09).
//
// Cambiar la contraseña tiene que cerrar las demás sesiones de la cuenta
// (si se cambió porque alguien más la sabía, su sesión abierta no puede
// seguir andando), preservando la sesión desde la que se hizo el cambio si
// el BFF manda su refresh token. Mismo criterio en Mi perfil del panel
// (member-profile) y en Mi cuenta de la tienda (me), los dos por
// AuthService.revocarOtrasSesiones. El reset por link cierra TODAS.
//
// Mockea Prisma: no toca la base. argon2 real para el cambio con contraseña
// actual, por eso el timeout largo.

jest.setTimeout(30_000);

const CONFIG = { getOrThrow: () => 'test-secret-de-al-menos-32-caracteres', get: () => undefined } as any;
const hashDe = (token: string) => createHash('sha256').update(token).digest('hex');

function authSobre(prisma: Record<string, unknown>, mail: Record<string, unknown> = {}) {
  const auth = new AuthService(prisma as any, mail as any, CONFIG);
  (auth as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return auth;
}

describe('AuthService.revocarOtrasSesiones', () => {
  function armar(count = 2) {
    const prisma = { refreshToken: { updateMany: jest.fn().mockResolvedValue({ count }) } };
    return { auth: authSobre(prisma), prisma };
  }

  it('con la sesión actual, revoca las vivas del usuario salvo la de ese hash (mismo mecanismo que el reuso: revokedAt)', async () => {
    const { auth, prisma } = armar();
    const cerradas = await auth.revocarOtrasSesiones({ id: 'u-1', userType: 'MEMBER' }, 'token-actual');
    expect(cerradas).toBe(2);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', userType: 'MEMBER', revokedAt: null, tokenHash: { not: hashDe('token-actual') } },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('sin sesión actual, revoca todas las vivas', async () => {
    const { auth, prisma } = armar();
    await auth.revocarOtrasSesiones({ id: 'c-1', userType: 'CUSTOMER' });
    expect(prisma.refreshToken.updateMany.mock.calls[0][0].where).toEqual({ userId: 'c-1', userType: 'CUSTOMER', revokedAt: null });
  });

  it('solo toca las filas del usuario y tipo indicados (no cruza MEMBER con CUSTOMER)', async () => {
    const { auth, prisma } = armar();
    await auth.revocarOtrasSesiones({ id: 'u-1', userType: 'PLATFORM_ADMIN' });
    expect(prisma.refreshToken.updateMany.mock.calls[0][0].where).toMatchObject({ userId: 'u-1', userType: 'PLATFORM_ADMIN' });
  });

  it('revokeAllSessions (Mi cuenta > cerrar en los demás dispositivos) delega en el mismo método', async () => {
    const { auth, prisma } = armar();
    await auth.revokeAllSessions('c-1', 'CUSTOMER', 'token-actual');
    expect(prisma.refreshToken.updateMany.mock.calls[0][0].where).toMatchObject({ userId: 'c-1', userType: 'CUSTOMER', tokenHash: { not: hashDe('token-actual') } });
  });
});

describe('Cambiar la contraseña revoca las otras sesiones (member-profile y me, mismo criterio)', () => {
  const CLAVE = 'ClaveActual123';
  let hash: string;
  beforeAll(async () => { hash = await argon2.hash(CLAVE, { type: argon2.argon2id }); });
  const dto = { currentPassword: CLAVE, newPassword: 'ClaveNueva456' };

  function perfilPanel() {
    const prisma = {
      member: {
        findUnique: jest.fn().mockResolvedValue({ id: 'm-1', email: 'ana@x.com', businessId: 'biz-1', passwordHash: hash }),
        update: jest.fn().mockResolvedValue({}),
      },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      business: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const auth = authSobre(prisma);
    const revocar = jest.spyOn(auth, 'revocarOtrasSesiones');
    return { svc: new MemberProfileService(prisma as any, auth), prisma, revocar };
  }

  function cuentaTienda() {
    const prisma = {
      customer: {
        findUnique: jest.fn().mockResolvedValue({ id: 'c-1', email: 'ana@x.com', businessId: 'biz-1', passwordHash: hash }),
        update: jest.fn().mockResolvedValue({}),
      },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      business: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const auth = authSobre(prisma);
    const revocar = jest.spyOn(auth, 'revocarOtrasSesiones');
    return { svc: new MeService(prisma as any, {} as any, auth), prisma, revocar };
  }

  it('member-profile: pasa el member y la sesión actual a AuthService, que preserva ese hash', async () => {
    const { svc, prisma, revocar } = perfilPanel();
    await svc.changePassword('m-1', dto, 'token-panel');
    expect(revocar).toHaveBeenCalledWith({ id: 'm-1', userType: 'MEMBER' }, 'token-panel');
    expect(prisma.refreshToken.updateMany.mock.calls[0][0].where).toEqual({
      userId: 'm-1', userType: 'MEMBER', revokedAt: null, tokenHash: { not: hashDe('token-panel') },
    });
  });

  it('member-profile: sin sesión actual cierra todas (el panel no puede leer su cookie httpOnly)', async () => {
    const { svc, prisma } = perfilPanel();
    await svc.changePassword('m-1', dto);
    expect(prisma.refreshToken.updateMany.mock.calls[0][0].where).toEqual({ userId: 'm-1', userType: 'MEMBER', revokedAt: null });
  });

  it('me: pasa el customer y la sesión actual a AuthService, que preserva ese hash', async () => {
    const { svc, prisma, revocar } = cuentaTienda();
    await svc.changePassword('c-1', dto, 'token-tienda');
    expect(revocar).toHaveBeenCalledWith({ id: 'c-1', userType: 'CUSTOMER' }, 'token-tienda');
    expect(prisma.refreshToken.updateMany.mock.calls[0][0].where).toEqual({
      userId: 'c-1', userType: 'CUSTOMER', revokedAt: null, tokenHash: { not: hashDe('token-tienda') },
    });
  });

  it('con la contraseña actual equivocada no se revoca nada, en ninguno de los dos', async () => {
    const panel = perfilPanel();
    await expect(panel.svc.changePassword('m-1', { ...dto, currentPassword: 'Otra999999' })).rejects.toThrow('no es correcta');
    expect(panel.revocar).not.toHaveBeenCalled();
    const tienda = cuentaTienda();
    await expect(tienda.svc.changePassword('c-1', { ...dto, currentPassword: 'Otra999999' })).rejects.toThrow('no es correcta');
    expect(tienda.revocar).not.toHaveBeenCalled();
  });
});

describe('Restablecer por link (resetPassword) cierra TODAS las sesiones', () => {
  const codigo = '123456';
  function reset(userType: 'MEMBER' | 'CUSTOMER' | 'PLATFORM_ADMIN') {
    const stored = { id: 'prt-1', email: 'ana@x.com', codeHash: hashDe(codigo), userType, businessId: userType === 'PLATFORM_ADMIN' ? null : 'biz-1', attempts: 0 };
    const prisma = {
      passwordResetToken: { findMany: jest.fn().mockResolvedValue([stored]), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      member: { findFirst: jest.fn().mockResolvedValue({ id: 'm-1', status: 'ACTIVE', invitationTokenExpiresAt: null }), update: jest.fn().mockResolvedValue({}) },
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'c-1' }), update: jest.fn().mockResolvedValue({}) },
      platformAdmin: { findUnique: jest.fn().mockResolvedValue({ id: 'a-1', isActive: true }), update: jest.fn().mockResolvedValue({}) },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
      business: { findUnique: jest.fn().mockResolvedValue({ id: 'biz-1', name: 'Tienda', deletedAt: null, storefrontConfig: null }) },
    };
    const auth = authSobre(prisma, { sendPasswordChanged: jest.fn() });
    return { auth, prisma };
  }

  it.each([
    ['member', 'MEMBER', 'm-1'],
    ['customer', 'CUSTOMER', 'c-1'],
    ['platform admin', 'PLATFORM_ADMIN', 'a-1'],
  ] as const)('%s: sin sesión que preservar, revoca todas las vivas', async (_c, userType, id) => {
    const { auth, prisma } = reset(userType);
    await auth.resetPassword({ email: 'ana@x.com', code: codigo, newPassword: 'ClaveNueva456' } as any);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: id, userType, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('member: además apaga la temporal y su vencimiento', async () => {
    const { auth, prisma } = reset('MEMBER');
    await auth.resetPassword({ email: 'ana@x.com', code: codigo, newPassword: 'ClaveNueva456' } as any);
    expect(prisma.member.update.mock.calls[0][0].data).toMatchObject({ hasTempPassword: false, tempPasswordExpiresAt: null });
  });
});
