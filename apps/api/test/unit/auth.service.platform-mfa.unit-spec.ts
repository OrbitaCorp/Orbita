import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import { AuthService } from '../../src/auth/auth.service';

// Unit test del segundo factor de login de platform admin (RBT-647):
// AuthService.login() no debe emitir sesión para un platform_admin hasta que
// se confirme el código de 6 dígitos vía verifyPlatformAdminLoginCode().
// Mockea Prisma/Mail/Config: no toca la base ni manda mail real.

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function svcCon(overrides: { admin?: any; loginCode?: any } = {}) {
  const prisma = {
    platformAdmin: {
      findUnique: jest.fn().mockResolvedValue(overrides.admin ?? null),
      update: jest.fn().mockResolvedValue({}),
    },
    platformAdminLoginCode: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(overrides.loginCode ?? null),
      update: jest.fn().mockResolvedValue({}),
    },
    member: { findFirst: jest.fn().mockResolvedValue(null) },
    refreshToken: { create: jest.fn().mockResolvedValue({}) },
  };
  const mail = { sendPlatformAdminLoginCode: jest.fn().mockResolvedValue(undefined) };
  const config = {
    getOrThrow: jest.fn().mockReturnValue('test-secret'),
    get: jest.fn().mockReturnValue(undefined),
  };
  const svc = new AuthService(prisma as any, mail as any, config as any);
  return { svc, prisma, mail };
}

const ADMIN = {
  id: 'admin-1',
  name: 'CTO',
  email: 'cto@orbita-corp.com',
  role: 'SUPERADMIN',
  isActive: true,
  failedLoginAttempts: 0,
  lockedUntil: null,
};

describe('AuthService — segundo factor de platform admin (unit)', () => {
  describe('login()', () => {
    it('con contraseña correcta, NO emite sesión — devuelve el challenge de MFA', async () => {
      const passwordHash = await argon2.hash('orbitatest1234', { type: argon2.argon2id });
      const { svc, prisma, mail } = svcCon({ admin: { ...ADMIN, passwordHash } });

      const result = await svc.login({ email: ADMIN.email, password: 'orbitatest1234' } as any);

      expect(result).toEqual({ type: 'platform_admin_mfa_required', email: ADMIN.email });
      // Nunca se creó un refresh token — no hay sesión real todavía.
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
      expect(mail.sendPlatformAdminLoginCode).toHaveBeenCalledTimes(1);
      expect(mail.sendPlatformAdminLoginCode.mock.calls[0][0]).toBe(ADMIN.email);
      // El código que se guarda es el mismo que se manda por mail (hasheado).
      const codeEnviado = mail.sendPlatformAdminLoginCode.mock.calls[0][1].code;
      expect(prisma.platformAdminLoginCode.create.mock.calls[0][0].data.codeHash).toBe(hashCode(codeEnviado));
    });
  });

  describe('verifyPlatformAdminLoginCode()', () => {
    it('con el código correcto, emite la sesión real y marca el código usado', async () => {
      const code = '123456';
      const { svc, prisma } = svcCon({
        admin: ADMIN,
        loginCode: { id: 'code-1', codeHash: hashCode(code), attempts: 0, expiresAt: new Date(Date.now() + 60_000), usedAt: null },
      });

      const result = await svc.verifyPlatformAdminLoginCode(ADMIN.email, code);

      expect(result.type).toBe('platform_admin');
      expect(result.token).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(prisma.platformAdminLoginCode.update).toHaveBeenCalledWith({
        where: { id: 'code-1' },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('con el código incorrecto, tira 401 y suma un intento fallido (no emite sesión)', async () => {
      const { svc, prisma } = svcCon({
        admin: ADMIN,
        loginCode: { id: 'code-1', codeHash: hashCode('999999'), attempts: 0, expiresAt: new Date(Date.now() + 60_000), usedAt: null },
      });

      await expect(svc.verifyPlatformAdminLoginCode(ADMIN.email, '111111')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.platformAdminLoginCode.update).toHaveBeenCalledWith({
        where: { id: 'code-1' },
        data: { attempts: { increment: 1 } },
      });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('con el código vencido, tira 401 sin comparar el hash', async () => {
      const { svc } = svcCon({
        admin: ADMIN,
        loginCode: { id: 'code-1', codeHash: hashCode('123456'), attempts: 0, expiresAt: new Date(Date.now() - 1000), usedAt: null },
      });
      await expect(svc.verifyPlatformAdminLoginCode(ADMIN.email, '123456')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('tras agotar los intentos, tira 401 aunque el código sea correcto', async () => {
      const code = '123456';
      const { svc } = svcCon({
        admin: ADMIN,
        loginCode: { id: 'code-1', codeHash: hashCode(code), attempts: 5, expiresAt: new Date(Date.now() + 60_000), usedAt: null },
      });
      await expect(svc.verifyPlatformAdminLoginCode(ADMIN.email, code)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('sin ningún código pendiente, tira 401', async () => {
      const { svc } = svcCon({ admin: ADMIN, loginCode: null });
      await expect(svc.verifyPlatformAdminLoginCode(ADMIN.email, '123456')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('con un admin inactivo, tira 401 sin revelar si el código existía', async () => {
      const { svc } = svcCon({ admin: { ...ADMIN, isActive: false } });
      await expect(svc.verifyPlatformAdminLoginCode(ADMIN.email, '123456')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
