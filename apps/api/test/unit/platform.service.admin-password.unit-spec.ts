import { BadRequestException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PlatformService } from '../../src/platform/platform.service';
import { AuthService } from '../../src/auth/auth.service';

// Restablecer la contraseña de un admin de plataforma desde Admins (y salir de la temporal): la genera un
// SUPERADMIN, viaja por mail al correo personal de la persona (NO vuelve en la respuesta), vence, cierra las
// sesiones del admin y al entrar el panel le obliga a elegir una propia. Mockea Prisma y Mail.

function armar(admin: any, opts: { mailOk?: boolean } = {}) {
  const prisma = {
    platformAdmin: {
      findUnique: jest.fn().mockResolvedValue(admin),
      update: jest.fn().mockResolvedValue({}),
    },
    platformAdminLog: { create: jest.fn().mockResolvedValue({}) },
    refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
  };
  const mail = {
    sendPlatformAdminTempPassword: jest.fn().mockResolvedValue(opts.mailOk ?? true),
    sendPasswordChanged: jest.fn().mockResolvedValue(true),
  };
  const config = { get: jest.fn().mockImplementation((k: string) => (k === 'FRONTEND_URL' ? 'https://orbita.site' : undefined)) };
  const svc = new PlatformService(prisma as any, mail as any, {} as any, config as any);
  return { svc, prisma, mail };
}

const MILI = {
  id: 'mili',
  name: 'milagros',
  email: 'milagros@orbita.site',
  role: 'SUPERADMIN',
  isActive: true,
  personalEmail: null,
  passwordHash: null,
};

describe('PlatformService.resetAdminPassword (unit)', () => {
  it('genera una temporal, la guarda cifrada con vencimiento y la manda al correo personal con el correo de la cuenta', async () => {
    const { svc, prisma, mail } = armar(MILI);

    const res = await svc.resetAdminPassword('ceo', 'mili', { personalEmail: 'MiliLucchi2017@Gmail.com ' });

    // Va al correo personal (normalizado), con el correo de la cuenta y la temporal en claro SOLO en el mail.
    expect(mail.sendPlatformAdminTempPassword).toHaveBeenCalledTimes(1);
    const [to, data] = mail.sendPlatformAdminTempPassword.mock.calls[0];
    expect(to).toBe('mililucchi2017@gmail.com');
    expect(data).toMatchObject({ name: 'milagros', email: 'milagros@orbita.site', tempPasswordHoras: 72, loginUrl: 'https://orbita.site/login' });
    expect(data.tempPassword).toMatch(/^[A-Za-z0-9]{12}$/);

    // En la base queda el hash (argon2id) de ESA temporal, marcada como temporal y con vencimiento; y el correo personal guardado.
    const upd = prisma.platformAdmin.update.mock.calls[0][0].data;
    expect(await argon2.verify(upd.passwordHash, data.tempPassword)).toBe(true);
    expect(upd.passwordHash).toContain('argon2id');
    expect(upd).toMatchObject({ hasTempPassword: true, failedLoginAttempts: 0, lockedUntil: null, personalEmail: 'mililucchi2017@gmail.com' });
    expect(upd.tempPasswordExpiresAt.getTime()).toBeGreaterThan(Date.now() + 71 * 3600 * 1000);

    // Sus sesiones abiertas dejan de valer.
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'mili', userType: 'PLATFORM_ADMIN', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });

    // La respuesta y el log NO llevan la contraseña ni el correo entero.
    expect(res).toEqual({ ok: true, enviadoA: 'mi***@gmail.com' });
    const log = prisma.platformAdminLog.create.mock.calls[0][0].data;
    expect(log).toMatchObject({ adminId: 'ceo', action: 'reset_admin_password', targetId: 'mili', details: { enviadoA: 'mi***@gmail.com' } });
    expect(JSON.stringify(log)).not.toContain(data.tempPassword);
    expect(JSON.stringify(res)).not.toContain(data.tempPassword);
  });

  it('sin correo en la petición usa el que la cuenta ya tiene guardado', async () => {
    const { svc, mail } = armar({ ...MILI, personalEmail: 'guardado@gmail.com' });
    await svc.resetAdminPassword('ceo', 'mili', {});
    expect(mail.sendPlatformAdminTempPassword.mock.calls[0][0]).toBe('guardado@gmail.com');
  });

  it('sin correo personal en ningún lado no toca nada: pide cargarlo', async () => {
    const { svc, prisma, mail } = armar(MILI);
    await expect(svc.resetAdminPassword('ceo', 'mili', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.platformAdmin.update).not.toHaveBeenCalled();
    expect(mail.sendPlatformAdminTempPassword).not.toHaveBeenCalled();
  });

  it('no se puede restablecer la propia contraseña desde acá (cerraría la sesión desde la que se opera)', async () => {
    const { svc, prisma } = armar(MILI);
    await expect(svc.resetAdminPassword('mili', 'mili', { personalEmail: 'a@b.com' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.platformAdmin.update).not.toHaveBeenCalled();
  });

  it('rechaza una cuenta inexistente o desactivada, sin tocar nada', async () => {
    const inexistente = armar(null);
    await expect(inexistente.svc.resetAdminPassword('ceo', 'x', { personalEmail: 'a@b.com' })).rejects.toBeInstanceOf(NotFoundException);
    const inactiva = armar({ ...MILI, isActive: false });
    await expect(inactiva.svc.resetAdminPassword('ceo', 'mili', { personalEmail: 'a@b.com' })).rejects.toBeInstanceOf(BadRequestException);
    expect(inactiva.prisma.platformAdmin.update).not.toHaveBeenCalled();
  });

  it('si el mail no sale avisa con error (no deja creer que se mandó) y no registra el envío', async () => {
    const { svc, prisma } = armar(MILI, { mailOk: false });
    await expect(svc.resetAdminPassword('ceo', 'mili', { personalEmail: 'a@b.com' })).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.platformAdminLog.create).not.toHaveBeenCalled();
  });
});

describe('PlatformService.changeOwnPassword (unit)', () => {
  it('con la temporal correcta guarda la nueva, saca la marca de temporal y avisa por mail', async () => {
    const passwordHash = await argon2.hash('Temporal12345', { type: argon2.argon2id });
    const { svc, prisma, mail } = armar({ ...MILI, passwordHash, hasTempPassword: true, personalEmail: 'mili@gmail.com' });

    const res = await svc.changeOwnPassword('mili', { currentPassword: 'Temporal12345', newPassword: 'MiClaveNueva99' });

    expect(res).toEqual({ message: 'Contraseña actualizada' });
    const upd = prisma.platformAdmin.update.mock.calls[0][0].data;
    expect(await argon2.verify(upd.passwordHash, 'MiClaveNueva99')).toBe(true);
    expect(upd).toMatchObject({ hasTempPassword: false, tempPasswordExpiresAt: null });
    expect(mail.sendPasswordChanged.mock.calls.map((c) => c[0]).sort()).toEqual(['milagros@orbita.site', 'mili@gmail.com']);
  });

  it('con la actual incorrecta no cambia nada', async () => {
    const passwordHash = await argon2.hash('Temporal12345', { type: argon2.argon2id });
    const { svc, prisma } = armar({ ...MILI, passwordHash, hasTempPassword: true });
    await expect(svc.changeOwnPassword('mili', { currentPassword: 'otra', newPassword: 'MiClaveNueva99' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.platformAdmin.update).not.toHaveBeenCalled();
  });

  it('una cuenta que entra solo con Google (sin contraseña) no puede usarlo', async () => {
    const { svc } = armar({ ...MILI, passwordHash: null });
    await expect(svc.changeOwnPassword('mili', { currentPassword: 'x', newPassword: 'MiClaveNueva99' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('PlatformService.listAdmins / createAdmin / updateAdmin — correo personal (unit)', () => {
  it('lista el correo personal y si la contraseña es temporal', async () => {
    const prisma = {
      platformAdmin: {
        findMany: jest.fn().mockResolvedValue([{ ...MILI, personalEmail: 'm@gmail.com', hasTempPassword: true, passwordHash: 'x', googleId: null, jobTitle: null, lastAccessAt: null, createdAt: new Date() }]),
      },
    };
    const svc = new PlatformService(prisma as any, {} as any, {} as any, {} as any);
    const [a] = await svc.listAdmins();
    expect(a).toMatchObject({ personalEmail: 'm@gmail.com', hasTempPassword: true, hasPassword: true });
  });

  it('al editar: correo ausente no se toca; vacío lo borra', async () => {
    const ctx = armar(MILI);
    ctx.prisma.platformAdmin.update.mockResolvedValue({ ...MILI });
    await ctx.svc.updateAdmin('ceo', 'mili', { name: 'milagros', email: MILI.email, role: 'SUPERADMIN' });
    expect(ctx.prisma.platformAdmin.update.mock.calls[0][0].data).not.toHaveProperty('personalEmail');

    await ctx.svc.updateAdmin('ceo', 'mili', { name: 'milagros', email: MILI.email, role: 'SUPERADMIN', personalEmail: '  ' });
    expect(ctx.prisma.platformAdmin.update.mock.calls[1][0].data.personalEmail).toBeNull();

    await ctx.svc.updateAdmin('ceo', 'mili', { name: 'milagros', email: MILI.email, role: 'SUPERADMIN', personalEmail: 'Nuevo@Gmail.com' });
    expect(ctx.prisma.platformAdmin.update.mock.calls[2][0].data.personalEmail).toBe('nuevo@gmail.com');
  });
});

describe('AuthService — el código del segundo factor también va al correo personal (unit)', () => {
  function svcAuth(admin: any, mailFalla = false) {
    const prisma = {
      platformAdmin: { findUnique: jest.fn().mockResolvedValue(admin), update: jest.fn().mockResolvedValue({}) },
      platformAdminLoginCode: { create: jest.fn().mockResolvedValue({}) },
      member: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const mail = {
      sendPlatformAdminLoginCode: jest.fn().mockImplementation(async (to: string) => {
        if (mailFalla && to === admin.personalEmail) throw new Error('boom');
      }),
    };
    const config = { getOrThrow: jest.fn().mockReturnValue('test-secret-de-al-menos-32-caracteres'), get: jest.fn() };
    return { svc: new AuthService(prisma as any, mail as any, config as any), mail };
  }

  const base = { id: 'mili', name: 'milagros', email: 'milagros@orbita.site', role: 'SUPERADMIN', isActive: true, failedLoginAttempts: 0, lockedUntil: null, hasTempPassword: true, tempPasswordExpiresAt: null };

  it('manda el MISMO código al correo de la cuenta y al personal', async () => {
    const passwordHash = await argon2.hash('Temporal12345', { type: argon2.argon2id });
    const { svc, mail } = svcAuth({ ...base, passwordHash, personalEmail: 'mililucchi2017@gmail.com' });

    const res = await svc.login({ email: base.email, password: 'Temporal12345' } as any);

    expect(res).toEqual({ type: 'platform_admin_mfa_required', email: base.email });
    expect(mail.sendPlatformAdminLoginCode.mock.calls.map((c) => c[0])).toEqual(['milagros@orbita.site', 'mililucchi2017@gmail.com']);
    expect(mail.sendPlatformAdminLoginCode.mock.calls[0][1].code).toBe(mail.sendPlatformAdminLoginCode.mock.calls[1][1].code);
  });

  it('sin correo personal sigue yendo solo al de la cuenta; y si el personal falla, el login sigue', async () => {
    const passwordHash = await argon2.hash('Temporal12345', { type: argon2.argon2id });
    const sin = svcAuth({ ...base, passwordHash, personalEmail: null });
    await sin.svc.login({ email: base.email, password: 'Temporal12345' } as any);
    expect(sin.mail.sendPlatformAdminLoginCode).toHaveBeenCalledTimes(1);

    const falla = svcAuth({ ...base, passwordHash, personalEmail: 'x@gmail.com' }, true);
    await expect(falla.svc.login({ email: base.email, password: 'Temporal12345' } as any)).resolves.toEqual({ type: 'platform_admin_mfa_required', email: base.email });
  });
});
