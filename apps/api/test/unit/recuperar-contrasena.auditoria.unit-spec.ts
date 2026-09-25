import { createHash } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from '../../src/auth/auth.service';

// Auditoría de "olvidé mi contraseña" (09/2026), los tres tipos de cuenta.
//
// Lo que se protege:
//  - super admin: puede recuperar su contraseña (antes no había forma);
//  - restablecer NUNCA reactiva ni habilita: negocio eliminado, cliente
//    borrado, super admin desactivado o invitación vencida => ni emite el
//    código ni lo acepta;
//  - códigos de distintos negocios del mismo email conviven sin pisarse;
//  - el código se gasta una sola vez aunque lleguen dos pedidos a la vez.
//
// Mockea Prisma/Mail: no toca la base ni manda mail. argon2 real.

jest.setTimeout(30_000);

const CONFIG = { getOrThrow: () => 'test-secret-de-al-menos-32-caracteres', get: () => undefined } as any;
const hashDe = (t: string) => createHash('sha256').update(t).digest('hex');
const FUTURO = new Date(Date.now() + 60 * 60 * 1000);
const PASADO = new Date(Date.now() - 60 * 60 * 1000);
const NEGOCIO = { id: 'biz-1', name: 'Tienda', subdomain: 'tienda', deletedAt: null, storefrontConfig: null };

function armar(p: {
  business?: any; member?: any; members?: any[]; customer?: any; admin?: any; tokens?: any[]; consumo?: number;
} = {}) {
  const prisma = {
    business: { findUnique: jest.fn().mockResolvedValue(p.business === undefined ? NEGOCIO : p.business) },
    member: {
      findFirst: jest.fn().mockResolvedValue(p.member ?? null),
      findMany: jest.fn().mockResolvedValue(p.members ?? []),
      update: jest.fn().mockResolvedValue({}),
    },
    customer: { findFirst: jest.fn().mockResolvedValue(p.customer ?? null), update: jest.fn().mockResolvedValue({}) },
    platformAdmin: { findUnique: jest.fn().mockResolvedValue(p.admin ?? null), update: jest.fn().mockResolvedValue({}) },
    passwordResetToken: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue(p.tokens ?? []),
      updateMany: jest.fn().mockResolvedValue({ count: p.consumo ?? 1 }),
    },
    refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  const mail = {
    sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    sendPasswordChanged: jest.fn().mockResolvedValue(undefined),
  };
  const adminLog = { contrasenaRestablecida: jest.fn().mockResolvedValue(undefined) };
  const auth = new AuthService(prisma as any, mail as any, CONFIG, adminLog as any);
  (auth as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return { auth, prisma, mail, adminLog };
}

const tokenDe = (over: Record<string, unknown> = {}) => ({
  id: 'prt-1', email: 'ana@x.com', codeHash: hashDe('123456'), userType: 'MEMBER', businessId: 'biz-1', attempts: 0,
  ...over,
});
const DTO = { email: 'ana@x.com', code: '123456', newPassword: 'ClaveNueva456' } as any;

describe('forgotPassword — super admin (apex)', () => {
  it('admin activo con contraseña: emite código PLATFORM_ADMIN sin negocio', async () => {
    const { auth, prisma, mail } = armar({ admin: { id: 'a-1', isActive: true, passwordHash: 'h' } });
    await auth.forgotPassword({ email: 'ana@x.com' } as any);
    expect(prisma.passwordResetToken.create.mock.calls[0][0].data).toMatchObject({ userType: 'PLATFORM_ADMIN', businessId: null });
    expect(mail.sendPasswordReset).toHaveBeenCalled();
    expect(prisma.member.findMany).not.toHaveBeenCalled();
  });

  it('admin DESACTIVADO: no emite nada (y no cae a otra cuenta que no existe)', async () => {
    const { auth, prisma } = armar({ admin: { id: 'a-1', isActive: false, passwordHash: 'h' } });
    await auth.forgotPassword({ email: 'ana@x.com' } as any);
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('admin sin contraseña (solo Google) que además es dueño: se restablece la membresía, como en el login', async () => {
    const m = { id: 'm-1', businessId: 'biz-1', status: 'ACTIVE', invitationTokenExpiresAt: null, business: NEGOCIO };
    const { auth, prisma } = armar({ admin: { id: 'a-1', isActive: true, passwordHash: null }, members: [m] });
    await auth.forgotPassword({ email: 'ana@x.com' } as any);
    expect(prisma.passwordResetToken.create.mock.calls[0][0].data).toMatchObject({ userType: 'MEMBER', businessId: 'biz-1' });
  });
});

describe('forgotPassword — member de varios negocios (apex)', () => {
  it('emite un código por membresía y cada mail dice de qué tienda es', async () => {
    const b2 = { ...NEGOCIO, id: 'biz-2', name: 'Otra' };
    const ms = [
      { id: 'm-1', businessId: 'biz-1', status: 'ACTIVE', invitationTokenExpiresAt: null, business: NEGOCIO },
      { id: 'm-2', businessId: 'biz-2', status: 'ACTIVE', invitationTokenExpiresAt: null, business: b2 },
    ];
    const { auth, prisma, mail } = armar({ members: ms });
    await auth.forgotPassword({ email: 'ana@x.com' } as any);
    expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(2);
    expect(mail.sendPasswordReset.mock.calls.map((c) => c[1].storeName)).toEqual(['Tienda', 'Otra']);
  });

  it('saltea negocios eliminados e invitaciones vencidas', async () => {
    const ms = [
      { id: 'm-1', businessId: 'biz-1', status: 'ACTIVE', invitationTokenExpiresAt: null, business: { ...NEGOCIO, deletedAt: PASADO } },
      { id: 'm-2', businessId: 'biz-2', status: 'PENDING', invitationTokenExpiresAt: PASADO, business: NEGOCIO },
    ];
    const { auth, prisma } = armar({ members: ms });
    await auth.forgotPassword({ email: 'ana@x.com' } as any);
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });
});

describe('forgotPassword — tienda (slug)', () => {
  it('negocio eliminado: no emite', async () => {
    const { auth, prisma } = armar({ business: { ...NEGOCIO, deletedAt: PASADO }, customer: { id: 'c-1' } });
    await auth.forgotPassword({ email: 'ana@x.com' } as any, 'tienda');
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('member PENDING con la invitación vencida: no emite (hay que reinvitar)', async () => {
    const { auth, prisma } = armar({ member: { id: 'm-1', status: 'PENDING', invitationTokenExpiresAt: PASADO } });
    await auth.forgotPassword({ email: 'ana@x.com' } as any, 'tienda');
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('cliente borrado: la búsqueda ya lo excluye y no emite', async () => {
    const { auth, prisma } = armar({ customer: null });
    await auth.forgotPassword({ email: 'ana@x.com' } as any, 'tienda');
    expect(prisma.customer.findFirst.mock.calls[0][0].where).toMatchObject({ deletedAt: null });
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });
});

describe('resetPassword — cuenta inactiva no se habilita', () => {
  it('super admin desactivado: rechaza y no toca la cuenta', async () => {
    const { auth, prisma } = armar({ tokens: [tokenDe({ userType: 'PLATFORM_ADMIN', businessId: null })], admin: { id: 'a-1', isActive: false } });
    await expect(auth.resetPassword(DTO)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.platformAdmin.update).not.toHaveBeenCalled();
  });

  it('super admin activo: cambia contraseña, cierra sesiones y deja registro', async () => {
    const { auth, prisma, adminLog } = armar({ tokens: [tokenDe({ userType: 'PLATFORM_ADMIN', businessId: null })], admin: { id: 'a-1', isActive: true } });
    const r = await auth.resetPassword(DTO);
    expect(r).toEqual({ userType: 'PLATFORM_ADMIN' });
    expect(prisma.platformAdmin.update.mock.calls[0][0].data.passwordHash).toMatch(/^\$argon2id\$/);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    expect(adminLog.contrasenaRestablecida).toHaveBeenCalledWith({ adminId: 'a-1' });
  });

  it('negocio eliminado: rechaza (member y customer)', async () => {
    for (const userType of ['MEMBER', 'CUSTOMER']) {
      const { auth, prisma } = armar({
        tokens: [tokenDe({ userType })], business: { ...NEGOCIO, deletedAt: PASADO },
        member: { id: 'm-1', status: 'ACTIVE' }, customer: { id: 'c-1' },
      });
      await expect(auth.resetPassword(DTO)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.member.update).not.toHaveBeenCalled();
      expect(prisma.customer.update).not.toHaveBeenCalled();
    }
  });

  it('cliente borrado después de pedir el código: rechaza', async () => {
    const { auth, prisma } = armar({ tokens: [tokenDe({ userType: 'CUSTOMER' })], customer: null });
    await expect(auth.resetPassword(DTO)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.customer.update).not.toHaveBeenCalled();
  });

  it('miembro eliminado después de pedir el código: rechaza', async () => {
    const { auth } = armar({ tokens: [tokenDe()], member: null });
    await expect(auth.resetPassword(DTO)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('member PENDING con invitación vencida: rechaza, no se salta el vencimiento', async () => {
    const { auth, prisma } = armar({ tokens: [tokenDe()], member: { id: 'm-1', status: 'PENDING', invitationTokenExpiresAt: PASADO } });
    await expect(auth.resetPassword(DTO)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it('member PENDING con invitación vigente: queda ACTIVE y sin token de invitación (no queda en limbo)', async () => {
    const { auth, prisma } = armar({ tokens: [tokenDe()], member: { id: 'm-1', status: 'PENDING', invitationTokenExpiresAt: FUTURO } });
    await auth.resetPassword(DTO);
    expect(prisma.member.update.mock.calls[0][0].data).toMatchObject({
      status: 'ACTIVE', invitationToken: null, invitationTokenExpiresAt: null, hasTempPassword: false, emailVerified: true,
    });
  });

  it('member ACTIVE: no toca status ni invitación', async () => {
    const { auth, prisma } = armar({ tokens: [tokenDe()], member: { id: 'm-1', status: 'ACTIVE', invitationTokenExpiresAt: null } });
    await auth.resetPassword(DTO);
    const data = prisma.member.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('status');
    expect(data).not.toHaveProperty('invitationToken');
  });
});

describe('códigos — convivencia y un solo uso', () => {
  it('con dos códigos vivos del mismo email (dos negocios) el más viejo también sirve, y restablece SU cuenta', async () => {
    const nuevo = tokenDe({ id: 'prt-2', businessId: 'biz-2', codeHash: hashDe('999999') });
    const viejo = tokenDe({ id: 'prt-1', businessId: 'biz-1', codeHash: hashDe('123456') });
    const { auth, prisma } = armar({ tokens: [nuevo, viejo], member: { id: 'm-1', status: 'ACTIVE', invitationTokenExpiresAt: null } });
    await auth.resetPassword(DTO);
    expect(prisma.business.findUnique.mock.calls[0][0].where).toEqual({ id: 'biz-1' });
    expect(prisma.passwordResetToken.updateMany.mock.calls[0][0].where).toEqual({ id: 'prt-1', usedAt: null });
  });

  it('código equivocado: suma un intento a los vivos y rechaza', async () => {
    const { auth, prisma } = armar({ tokens: [tokenDe(), tokenDe({ id: 'prt-2' })] });
    await expect(auth.resetPassword({ ...DTO, code: '000000' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['prt-1', 'prt-2'] } }, data: { attempts: { increment: 1 } },
    });
  });

  it('sin códigos vivos (vencidos, usados o con 5 intentos): rechaza sin tocar nada', async () => {
    const { auth, prisma } = armar({ tokens: [] });
    await expect(auth.resetPassword(DTO)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.passwordResetToken.findMany.mock.calls[0][0].where).toMatchObject({ usedAt: null, attempts: { lt: 5 } });
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it('carrera: si el código ya lo gastó otro pedido (count 0), NO cambia la contraseña', async () => {
    const { auth, prisma } = armar({ tokens: [tokenDe()], member: { id: 'm-1', status: 'ACTIVE', invitationTokenExpiresAt: null }, consumo: 0 });
    await expect(auth.resetPassword(DTO)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it('al restablecer se invalidan los otros códigos vivos de la misma cuenta', async () => {
    const { auth, prisma } = armar({ tokens: [tokenDe()], member: { id: 'm-1', status: 'ACTIVE', invitationTokenExpiresAt: null } });
    await auth.resetPassword(DTO);
    expect(prisma.passwordResetToken.updateMany.mock.calls[1][0].where).toEqual({
      email: 'ana@x.com', userType: 'MEMBER', businessId: 'biz-1', usedAt: null,
    });
  });
});
