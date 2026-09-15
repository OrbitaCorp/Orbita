import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import { AuthService } from '../../src/auth/auth.service';
import { PlatformService } from '../../src/platform/platform.service';
import { ACCION_LOG_ADMIN, PlatformAdminLogService } from '../../src/platform/platform-admin-log.service';

// Hallazgo `auditoria-acciones-sin-registro` (MEDIA), parte 3 de 3.
//
// platform_admin_logs solo tenía las acciones de negocio del super panel
// (suspender, ceder cortesía, admins). El login del super admin, el segundo
// factor por mail (RBT-647) y los mails de prueba de la pestaña Testeo
// (RBT-607) no dejaban rastro. Acá se verifica que cada uno registra con la
// acción que corresponde, que en `details` NUNCA viaja la contraseña ni el
// código (solo el id de su fila), y que un insert fallido no rompe el login.
//
// Se usa el PlatformAdminLogService REAL sobre un Prisma mockeado: lo que se
// afirma es lo que llegaría a la tabla, no una llamada intermedia.

const PASSWORD = 'orbitatest1234';
const CODE = '123456';
const ORIGEN = { ip: '190.0.0.1', userAgent: 'jest/1.0' };
const ADMIN = {
  id: 'admin-1',
  name: 'CTO',
  email: 'cto@orbita-corp.com',
  role: 'SUPERADMIN',
  isActive: true,
  failedLoginAttempts: 0,
  lockedUntil: null,
  hasTempPassword: false,
  tempPasswordExpiresAt: null,
};
const CONFIG = {
  getOrThrow: jest.fn().mockReturnValue('test-secret-de-al-menos-32-caracteres'),
  get: jest.fn().mockReturnValue(undefined),
};

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function armar(overrides: { admin?: any; loginCode?: any; insertFalla?: boolean } = {}) {
  const prisma = {
    platformAdmin: {
      findUnique: jest.fn().mockResolvedValue(overrides.admin ?? null),
      update: jest.fn().mockResolvedValue({}),
    },
    platformAdminLoginCode: {
      create: jest.fn().mockResolvedValue({ id: 'code-nuevo' }),
      findFirst: jest.fn().mockResolvedValue(overrides.loginCode ?? null),
      update: jest.fn().mockResolvedValue({}),
    },
    platformAdminLog: {
      create: overrides.insertFalla
        ? jest.fn().mockRejectedValue(new Error('conexión caída'))
        : jest.fn().mockResolvedValue({}),
    },
    member: { findFirst: jest.fn().mockResolvedValue(null) },
    refreshToken: { create: jest.fn().mockResolvedValue({}) },
  };
  const mail = { sendPlatformAdminLoginCode: jest.fn().mockResolvedValue(undefined) };
  const adminLog = new PlatformAdminLogService(prisma as any);
  const auth = new AuthService(prisma as any, mail as any, CONFIG as any, adminLog);
  return { auth, prisma, mail, adminLog };
}

// Filas que llegarían a platform_admin_logs, en orden.
const filas = (prisma: { platformAdminLog: { create: jest.Mock } }) =>
  prisma.platformAdminLog.create.mock.calls.map((c) => c[0].data);

// Ni la contraseña ni el código, en ninguna clave y en ningún valor.
function sinSecretos(data: { details?: Record<string, unknown> }) {
  const texto = JSON.stringify(data.details ?? {});
  expect(texto).not.toContain(PASSWORD);
  expect(texto).not.toContain(CODE);
  expect(Object.keys(data.details ?? {})).not.toEqual(expect.arrayContaining(['password', 'code', 'codigo', 'codeHash']));
}

const codigoVigente = (extra: Record<string, unknown> = {}) => ({
  id: 'code-1',
  codeHash: hashCode(CODE),
  attempts: 0,
  expiresAt: new Date(Date.now() + 60_000),
  usedAt: null,
  ...extra,
});

describe('Login del super panel', () => {
  it('con contraseña correcta registra login_ok con via, IP y user-agent, y mfa_code_sent con el id del código', async () => {
    const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
    const { auth, prisma } = armar({ admin: { ...ADMIN, passwordHash } });

    const res = await auth.login({ email: ADMIN.email, password: PASSWORD } as any, undefined, ORIGEN);

    expect(res).toEqual({ type: 'platform_admin_mfa_required', email: ADMIN.email });
    const [login, mfa] = filas(prisma);
    expect(login).toEqual({
      adminId: ADMIN.id,
      action: ACCION_LOG_ADMIN.loginOk,
      targetType: 'platform_admin',
      targetId: ADMIN.id,
      details: { via: 'password', ip: ORIGEN.ip, userAgent: ORIGEN.userAgent },
    });
    expect(mfa).toMatchObject({
      adminId: ADMIN.id,
      action: ACCION_LOG_ADMIN.segundoFactor.enviado,
      details: { codeId: 'code-nuevo', ip: ORIGEN.ip },
    });
    sinSecretos(login);
    sinSecretos(mfa);
  });

  it('con contraseña incorrecta registra login_failed (motivo password, email en minúsculas) sin la contraseña', async () => {
    const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
    const { auth, prisma } = armar({ admin: { ...ADMIN, passwordHash } });

    await expect(auth.login({ email: ADMIN.email, password: 'otra-clave' } as any, undefined, ORIGEN)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(filas(prisma)).toHaveLength(1);
    expect(filas(prisma)[0]).toEqual({
      adminId: ADMIN.id,
      action: ACCION_LOG_ADMIN.loginFallido,
      targetType: 'platform_admin',
      targetId: ADMIN.id,
      details: { email: ADMIN.email, motivo: 'password', ip: ORIGEN.ip, userAgent: ORIGEN.userAgent },
    });
    expect(JSON.stringify(filas(prisma)[0])).not.toContain('otra-clave');
    // El contador de intentos se sigue actualizando como antes.
    expect(prisma.platformAdmin.update).toHaveBeenCalledWith({ where: { id: ADMIN.id }, data: { failedLoginAttempts: 1 } });
  });

  it('con la cuenta bloqueada registra login_failed (motivo bloqueado) y sigue tirando 403', async () => {
    const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
    const { auth, prisma } = armar({ admin: { ...ADMIN, passwordHash, lockedUntil: new Date(Date.now() + 5 * 60_000) } });

    await expect(auth.login({ email: ADMIN.email, password: PASSWORD } as any, undefined, ORIGEN)).rejects.toBeInstanceOf(ForbiddenException);

    expect(filas(prisma)).toEqual([
      expect.objectContaining({ action: ACCION_LOG_ADMIN.loginFallido, details: expect.objectContaining({ motivo: 'bloqueado', ip: ORIGEN.ip }) }),
    ]);
  });

  it('un fallo del insert NO rompe el login: el challenge de MFA sale igual', async () => {
    const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
    const { auth, prisma, mail } = armar({ admin: { ...ADMIN, passwordHash }, insertFalla: true });

    const res = await auth.login({ email: ADMIN.email, password: PASSWORD } as any, undefined, ORIGEN);

    expect(res).toEqual({ type: 'platform_admin_mfa_required', email: ADMIN.email });
    expect(mail.sendPlatformAdminLoginCode).toHaveBeenCalledTimes(1);
    // Se intentó registrar (login_ok + mfa_code_sent) y falló las dos veces sin tirar.
    expect(prisma.platformAdminLog.create).toHaveBeenCalledTimes(2);
  });

  it('sin el service inyectado (specs viejos), el login funciona igual', async () => {
    const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
    const { prisma, mail } = armar({ admin: { ...ADMIN, passwordHash } });
    const auth = new AuthService(prisma as any, mail as any, CONFIG as any);

    const res = await auth.login({ email: ADMIN.email, password: PASSWORD } as any);

    expect(res).toEqual({ type: 'platform_admin_mfa_required', email: ADMIN.email });
    expect(prisma.platformAdminLog.create).not.toHaveBeenCalled();
  });

  it('el login con Google registra login_ok con via google', async () => {
    const { auth, prisma } = armar({ admin: { ...ADMIN, googleId: 'g-1' } });

    const res = await auth.googleLoginApex({ googleId: 'g-1', email: ADMIN.email, name: 'CTO' } as any);

    expect(res).toEqual({ type: 'platform_admin_mfa_required', email: ADMIN.email });
    expect(filas(prisma)[0]).toMatchObject({ action: ACCION_LOG_ADMIN.loginOk, details: { via: 'google' } });
  });
});

describe('Segundo factor del super panel (RBT-647)', () => {
  it('con el código correcto registra mfa_code_verified con el id del código, sin el código', async () => {
    const { auth, prisma } = armar({ admin: ADMIN, loginCode: codigoVigente() });

    const res = await auth.verifyPlatformAdminLoginCode(ADMIN.email, CODE, ORIGEN);

    expect(res.type).toBe('platform_admin');
    expect(filas(prisma)).toEqual([
      {
        adminId: ADMIN.id,
        action: ACCION_LOG_ADMIN.segundoFactor.verificado,
        targetType: 'platform_admin',
        targetId: ADMIN.id,
        details: { codeId: 'code-1', ip: ORIGEN.ip, userAgent: ORIGEN.userAgent },
      },
    ]);
    sinSecretos(filas(prisma)[0]);
  });

  it('con el código incorrecto registra mfa_code_failed (motivo incorrecto) y no filtra el código tipeado', async () => {
    const { auth, prisma } = armar({ admin: ADMIN, loginCode: codigoVigente() });

    await expect(auth.verifyPlatformAdminLoginCode(ADMIN.email, '999999', ORIGEN)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(filas(prisma)).toEqual([
      expect.objectContaining({
        action: ACCION_LOG_ADMIN.segundoFactor.fallido,
        details: { codeId: 'code-1', motivo: 'incorrecto', ip: ORIGEN.ip, userAgent: ORIGEN.userAgent },
      }),
    ]);
    expect(JSON.stringify(filas(prisma))).not.toContain('999999');
  });

  it('con el código vencido registra mfa_code_failed (motivo vencido)', async () => {
    const { auth, prisma } = armar({ admin: ADMIN, loginCode: codigoVigente({ expiresAt: new Date(Date.now() - 1000) }) });

    await expect(auth.verifyPlatformAdminLoginCode(ADMIN.email, CODE)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(filas(prisma)[0]).toMatchObject({ action: ACCION_LOG_ADMIN.segundoFactor.fallido, details: { motivo: 'vencido', codeId: 'code-1' } });
  });

  it('sin ningún código pendiente registra mfa_code_failed (motivo sin_codigo)', async () => {
    const { auth, prisma } = armar({ admin: ADMIN, loginCode: null });

    await expect(auth.verifyPlatformAdminLoginCode(ADMIN.email, CODE)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(filas(prisma)[0]).toMatchObject({ action: ACCION_LOG_ADMIN.segundoFactor.fallido, details: { motivo: 'sin_codigo' } });
  });

  it('el intento que agota el cupo registra mfa_code_blocked, y los siguientes también', async () => {
    // Cuarto fallo sobre un código con 4 intentos: con este llega a 5.
    const { auth, prisma } = armar({ admin: ADMIN, loginCode: codigoVigente({ attempts: 4 }) });
    await expect(auth.verifyPlatformAdminLoginCode(ADMIN.email, '000000', ORIGEN)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(filas(prisma)[0]).toMatchObject({ action: ACCION_LOG_ADMIN.segundoFactor.bloqueado, details: { codeId: 'code-1', ip: ORIGEN.ip } });
    expect(filas(prisma)[0].details).not.toHaveProperty('motivo');

    // Ya bloqueado: aunque el código sea el correcto, no pasa y queda registrado.
    const otro = armar({ admin: ADMIN, loginCode: codigoVigente({ attempts: 5 }) });
    await expect(otro.auth.verifyPlatformAdminLoginCode(ADMIN.email, CODE)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(filas(otro.prisma)[0]).toMatchObject({ action: ACCION_LOG_ADMIN.segundoFactor.bloqueado, details: { codeId: 'code-1' } });
  });

  it('con un admin inactivo registra mfa_code_failed (motivo admin_inactivo); con un mail desconocido no inserta nada', async () => {
    const inactivo = armar({ admin: { ...ADMIN, isActive: false } });
    await expect(inactivo.auth.verifyPlatformAdminLoginCode(ADMIN.email, CODE)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(filas(inactivo.prisma)[0]).toMatchObject({ adminId: ADMIN.id, action: ACCION_LOG_ADMIN.segundoFactor.fallido, details: { motivo: 'admin_inactivo' } });

    // adminId es NOT NULL con FK: sin admin no hay fila (queda en el log del servidor).
    const desconocido = armar({ admin: null });
    await expect(desconocido.auth.verifyPlatformAdminLoginCode('nadie@x.com', CODE)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(desconocido.prisma.platformAdminLog.create).not.toHaveBeenCalled();
  });

  it('un fallo del insert no impide emitir la sesión', async () => {
    const { auth } = armar({ admin: ADMIN, loginCode: codigoVigente(), insertFalla: true });
    const res = await auth.verifyPlatformAdminLoginCode(ADMIN.email, CODE, ORIGEN);
    expect(res.type).toBe('platform_admin');
    expect(res.refreshToken).toEqual(expect.any(String));
  });
});

describe('Mails de prueba de la pestaña Testeo (RBT-607)', () => {
  function plataforma(sendPreview: jest.Mock) {
    const prisma = { platformAdminLog: { create: jest.fn().mockResolvedValue({}) } };
    const adminLog = new PlatformAdminLogService(prisma as any);
    const svc = new PlatformService(prisma as any, { sendPreview } as any, {} as any, {} as any, adminLog);
    return { svc, prisma };
  }

  it('registra send_mail_test con la plantilla, el destinatario (en minúsculas) y si salió', async () => {
    const { svc, prisma } = plataforma(jest.fn().mockResolvedValue(true));

    await expect(svc.sendMailTest('order-confirmation', 'Ale@Orbita-Corp.com', ADMIN.id)).resolves.toEqual({ sent: true });

    expect(filas(prisma)).toEqual([
      {
        adminId: ADMIN.id,
        action: ACCION_LOG_ADMIN.mailPrueba,
        targetType: 'mail_template',
        targetId: 'order-confirmation',
        details: { to: 'ale@orbita-corp.com', sent: true },
      },
    ]);
  });

  it('si Resend rechazó el envío queda sent: false', async () => {
    const { svc, prisma } = plataforma(jest.fn().mockResolvedValue(false));
    await svc.sendMailTest('welcome', 'ale@orbita-corp.com', ADMIN.id);
    expect(filas(prisma)[0]).toMatchObject({ targetId: 'welcome', details: { sent: false } });
  });

  it('si el envío tira, registra sent: false con el error y vuelve a tirar', async () => {
    const { svc, prisma } = plataforma(jest.fn().mockRejectedValue(new Error('Resend caído')));
    await expect(svc.sendMailTest('welcome', 'ale@orbita-corp.com', ADMIN.id)).rejects.toThrow('Resend caído');
    expect(filas(prisma)[0]).toMatchObject({ details: { sent: false, error: 'Resend caído' } });
  });

  it('el mail sale aunque falle el registro', async () => {
    const sendPreview = jest.fn().mockResolvedValue(true);
    const prisma = { platformAdminLog: { create: jest.fn().mockRejectedValue(new Error('conexión caída')) } };
    const svc = new PlatformService(prisma as any, { sendPreview } as any, {} as any, {} as any, new PlatformAdminLogService(prisma as any));
    await expect(svc.sendMailTest('welcome', 'ale@orbita-corp.com', ADMIN.id)).resolves.toEqual({ sent: true });
  });
});

describe('PlatformAdminLogService', () => {
  it('descarta claves sensibles y valores vacíos del detalle, pero conserva codeId', async () => {
    const prisma = { platformAdminLog: { create: jest.fn().mockResolvedValue({}) } };
    const svc = new PlatformAdminLogService(prisma as any);
    // Se fuerza por la puerta pública con claves que nadie debería pasar.
    await svc.mailPrueba({ adminId: ADMIN.id, template: 't', to: 'a@b.com', sent: true, error: '' });
    await (svc as any).registrar({
      adminId: ADMIN.id, action: 'x', targetType: 'y', targetId: 'z',
      details: { password: 'p', code: '1', codigo: '2', token: 't', codeId: 'code-1', vacio: null, ok: 'sí' },
    });
    const [mail, forzado] = filas(prisma);
    expect(mail.details).toEqual({ to: 'a@b.com', sent: true });
    expect(forzado.details).toEqual({ codeId: 'code-1', ok: 'sí' });
  });

  it('sin detalle útil, details queda undefined (no un {} vacío)', async () => {
    const prisma = { platformAdminLog: { create: jest.fn().mockResolvedValue({}) } };
    const svc = new PlatformAdminLogService(prisma as any);
    await svc.segundoFactor({ adminId: ADMIN.id, resultado: 'verificado' });
    expect(filas(prisma)[0].details).toBeUndefined();
  });
});
