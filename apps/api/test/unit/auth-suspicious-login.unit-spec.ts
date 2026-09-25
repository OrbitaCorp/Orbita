import * as argon2 from 'argon2';
import { AuthService } from '../../src/auth/auth.service';

// Hallazgo de la auditoría de mails (25/09), pedido explícito de Ale: alertar
// al member si su cuenta se loguea desde un dispositivo/IP que nunca se le
// había visto. Es una alerta de SEGURIDAD, no una preferencia — no tiene
// toggle en NotificationConfig (ver auth.service.ts, mismo criterio que
// sendPasswordChanged). Mockea Prisma — no toca la base. argon2 real.

const CONFIG = { getOrThrow: () => 'test-secret-de-al-menos-32-caracteres', get: () => undefined } as any;
const NEGOCIO = { id: 'biz-1', name: 'Tienda', subdomain: 'tienda', mode: 'FULL', deletedAt: null };

describe('Alerta de dispositivo nuevo (login de member)', () => {
  const CLAVE = 'ClaveDeSobra123';
  let hash: string;
  beforeAll(async () => {
    hash = await argon2.hash(CLAVE, { type: argon2.argon2id });
  });

  function armar(previos: { deviceInfo: unknown }[]) {
    const member = {
      id: 'm-1', email: 'emp@x.com', name: 'Empleado', businessId: NEGOCIO.id, passwordHash: hash,
      lockedUntil: null, failedLoginAttempts: 0, status: 'ACTIVE', invitationTokenExpiresAt: null,
      hasTempPassword: false, tempPasswordExpiresAt: null,
      role: { name: 'empleado', rolePermissions: [] }, business: NEGOCIO,
    };
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue(NEGOCIO) },
      member: { findFirst: jest.fn().mockResolvedValue(member), update: jest.fn().mockResolvedValue({}) },
      customer: { findFirst: jest.fn().mockResolvedValue(null) },
      refreshToken: { create: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue(previos) },
    };
    const mail = { sendSuspiciousLogin: jest.fn().mockResolvedValue(undefined) };
    const svc = new AuthService(prisma as any, mail as any, CONFIG);
    return { svc, prisma, mail };
  }

  const dto = { email: 'emp@x.com', password: CLAVE } as any;

  it('primera sesión que se le conoce al member → no hay nada contra qué comparar, no alerta', async () => {
    const { svc, prisma, mail } = armar([]);
    await svc.login(dto, 'tienda', { ip: '1.2.3.4', userAgent: 'ChromeNuevo' });
    expect(prisma.refreshToken.findMany).toHaveBeenCalled();
    expect(mail.sendSuspiciousLogin).not.toHaveBeenCalled();
  });

  it('mismo IP que una sesión previa → NO es nuevo, no alerta', async () => {
    const { svc, mail } = armar([{ deviceInfo: { ip: '1.2.3.4', userAgent: 'Otro' } }]);
    await svc.login(dto, 'tienda', { ip: '1.2.3.4', userAgent: 'ChromeNuevo' });
    expect(mail.sendSuspiciousLogin).not.toHaveBeenCalled();
  });

  it('IP y userAgent nunca vistos, habiendo sesiones previas → alerta al member', async () => {
    const { svc, mail } = armar([{ deviceInfo: { ip: '9.9.9.9', userAgent: 'Safari viejo' } }]);
    await svc.login(dto, 'tienda', { ip: '1.2.3.4', userAgent: 'ChromeNuevo' });
    expect(mail.sendSuspiciousLogin).toHaveBeenCalledWith(
      'emp@x.com',
      expect.objectContaining({ memberName: 'Empleado', storeName: 'Tienda', ip: '1.2.3.4' }),
      { businessId: 'biz-1' },
    );
  });

  it('sin deviceInfo (ip/userAgent ausentes) → ni siquiera consulta el historial', async () => {
    const { svc, prisma, mail } = armar([{ deviceInfo: { ip: '9.9.9.9' } }]);
    await svc.login(dto, 'tienda');
    expect(prisma.refreshToken.findMany).not.toHaveBeenCalled();
    expect(mail.sendSuspiciousLogin).not.toHaveBeenCalled();
  });

  it('un mail caído no revienta el login (best-effort)', async () => {
    const { svc, mail } = armar([{ deviceInfo: { ip: '9.9.9.9', userAgent: 'Safari viejo' } }]);
    mail.sendSuspiciousLogin.mockRejectedValue(new Error('Resend caído'));
    await expect(svc.login(dto, 'tienda', { ip: '1.2.3.4', userAgent: 'ChromeNuevo' })).resolves.toMatchObject({ type: 'member' });
  });
});
