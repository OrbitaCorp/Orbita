import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from '../../src/auth/auth.service';
import { MembersService } from '../../src/members/members.service';
import { MemberProfileService } from '../../src/member-profile/member-profile.service';
import {
  TEMP_PASSWORD_HORAS_DEFAULT,
  contrasenaTemporalVencida,
  tempPasswordHoras,
  vencimientoContrasenaTemporal,
} from '../../src/common/utils/contrasena-temporal';

// Hallazgo MEDIA `contrasena-temporal-reseteo` (auditoría interna 09/09).
//
// La temporal que el dueño le genera a un empleado desde Equipo vuelve en la
// respuesta y viaja por mail: quien la generó la conoce. Antes no vencía
// nunca. Ahora: se emite con vencimiento (TEMP_PASSWORD_HORAS, default 72 h),
// el login la rechaza vencida con el MISMO 401 genérico que una contraseña
// incorrecta (sin enumeración), y cambiarla limpia la marca y la fecha. Las
// temporales anteriores a la columna (fecha null) siguen entrando.
//
// Mockea Prisma: no toca la base. argon2 real en login y reseteo.

jest.setTimeout(30_000);

const CONFIG = { getOrThrow: () => 'test-secret-de-al-menos-32-caracteres', get: () => undefined } as any;
const HORA = 60 * 60 * 1000;
const ayer = () => new Date(Date.now() - 24 * HORA);
const manana = () => new Date(Date.now() + 24 * HORA);

describe('TEMP_PASSWORD_HORAS', () => {
  const original = process.env.TEMP_PASSWORD_HORAS;
  afterEach(() => {
    if (original === undefined) delete process.env.TEMP_PASSWORD_HORAS;
    else process.env.TEMP_PASSWORD_HORAS = original;
  });

  it('sin la variable, 72 h', () => {
    delete process.env.TEMP_PASSWORD_HORAS;
    expect(tempPasswordHoras()).toBe(72);
    expect(TEMP_PASSWORD_HORAS_DEFAULT).toBe(72);
  });

  it.each([['5', 5], ['24', 24], ['1.9', 1]])('con %s → %i h', (valor, esperado) => {
    process.env.TEMP_PASSWORD_HORAS = valor;
    expect(tempPasswordHoras()).toBe(esperado);
  });

  it.each([['0'], ['-3'], ['abc'], ['']])('con %j (inválido) cae al default, nunca a "no vence"', (valor) => {
    process.env.TEMP_PASSWORD_HORAS = valor;
    expect(tempPasswordHoras()).toBe(72);
  });

  it('el mínimo es 1 h', () => {
    process.env.TEMP_PASSWORD_HORAS = '0.2';
    expect(tempPasswordHoras()).toBe(1);
  });

  it('vencimientoContrasenaTemporal = ahora + horas', () => {
    process.env.TEMP_PASSWORD_HORAS = '5';
    const desde = new Date('2026-09-15T12:00:00.000Z');
    expect(vencimientoContrasenaTemporal(desde).toISOString()).toBe('2026-09-15T17:00:00.000Z');
  });
});

describe('contrasenaTemporalVencida', () => {
  it('sin marca de temporal nunca está vencida, aunque tenga fecha vieja', () => {
    expect(contrasenaTemporalVencida({ hasTempPassword: false, tempPasswordExpiresAt: ayer() })).toBe(false);
  });
  it('temporal sin fecha (anterior a la columna) no vence: compatibilidad', () => {
    expect(contrasenaTemporalVencida({ hasTempPassword: true, tempPasswordExpiresAt: null })).toBe(false);
  });
  it('temporal con fecha futura está vigente; con fecha pasada, vencida', () => {
    expect(contrasenaTemporalVencida({ hasTempPassword: true, tempPasswordExpiresAt: manana() })).toBe(false);
    expect(contrasenaTemporalVencida({ hasTempPassword: true, tempPasswordExpiresAt: ayer() })).toBe(true);
  });
});

describe('Login con contraseña temporal', () => {
  const CLAVE = 'ClaveTemporal12';
  let hash: string;
  beforeAll(async () => { hash = await argon2.hash(CLAVE, { type: argon2.argon2id }); });

  const NEGOCIO = { id: 'biz-1', name: 'Tienda', subdomain: 'tienda', mode: 'FULL', deletedAt: null };

  function armar(extra: Record<string, unknown>) {
    const member = {
      id: 'm-1', email: 'emp@x.com', name: 'Empleado', businessId: NEGOCIO.id, passwordHash: hash, lockedUntil: null, failedLoginAttempts: 0,
      status: 'ACTIVE', invitationTokenExpiresAt: null, hasTempPassword: false, tempPasswordExpiresAt: null,
      role: { name: 'empleado', rolePermissions: [] }, business: NEGOCIO, ...extra,
    };
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue(NEGOCIO) },
      // findMany: el login sin slug (apex) prueba TODAS las membresías de ese
      // email — ver AuthService.login(). Acá alcanza con envolver la única.
      member: { findFirst: jest.fn().mockResolvedValue(member), findMany: jest.fn().mockResolvedValue([member]), update: jest.fn().mockResolvedValue({}) },
      customer: { findFirst: jest.fn().mockResolvedValue(null) },
      platformAdmin: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    };
    const svc = new AuthService(prisma as any, {} as any, CONFIG);
    const logger = { warn: jest.fn(), log: jest.fn(), error: jest.fn() };
    (svc as any).logger = logger;
    return { svc, prisma, logger };
  }

  const dto = { email: 'emp@x.com', password: CLAVE } as any;
  const caminos: Array<[string, string | undefined]> = [['desde la tienda', 'tienda'], ['desde el apex', undefined]];

  it.each(caminos)('%s: temporal vencida → 401 con el mismo mensaje genérico, sin sesión', async (_c, slug) => {
    const { svc, prisma, logger } = armar({ hasTempPassword: true, tempPasswordExpiresAt: ayer() });
    const err = await svc.login(dto, slug).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnauthorizedException);
    expect((err as UnauthorizedException).message).toBe('Credenciales inválidas');
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    // No se cuenta como intento fallido (la contraseña era la correcta) y no
    // se toca lastAccessAt: el rechazo queda solo en el log, por id.
    expect(prisma.member.update).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('m-1'));
  });

  it.each(caminos)('%s: temporal vigente → entra y la respuesta avisa hasTempPassword', async (_c, slug) => {
    const { svc, prisma } = armar({ hasTempPassword: true, tempPasswordExpiresAt: manana() });
    await expect(svc.login(dto, slug)).resolves.toMatchObject({ type: 'member', member: { id: 'm-1', hasTempPassword: true } });
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it.each(caminos)('%s: temporal sin fecha (anterior a la columna) → entra', async (_c, slug) => {
    const { svc } = armar({ hasTempPassword: true, tempPasswordExpiresAt: null });
    await expect(svc.login(dto, slug)).resolves.toMatchObject({ type: 'member', member: { hasTempPassword: true } });
  });

  it('contraseña propia con una fecha vieja colgada → entra (la fecha sola no vale)', async () => {
    const { svc } = armar({ hasTempPassword: false, tempPasswordExpiresAt: ayer() });
    await expect(svc.login(dto, 'tienda')).resolves.toMatchObject({ type: 'member', member: { hasTempPassword: false } });
  });

  it('con la contraseña mala y la temporal vencida, el 401 es el mismo: no se distingue el caso', async () => {
    const { svc, prisma } = armar({ hasTempPassword: true, tempPasswordExpiresAt: ayer() });
    const err = await svc.login({ ...dto, password: 'Otra999999' }, 'tienda').catch((e: unknown) => e);
    expect((err as UnauthorizedException).message).toBe('Credenciales inválidas');
    // Contraseña mala sí cuenta como intento fallido (comportamiento previo).
    expect(prisma.member.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ failedLoginAttempts: 1 }) }));
  });

  it('platform admin con temporal vencida → 401 genérico, sin código de segundo factor', async () => {
    const admin = { id: 'a-1', email: 'admin@orbita.site', isActive: true, passwordHash: hash, lockedUntil: null, failedLoginAttempts: 0, hasTempPassword: true, tempPasswordExpiresAt: ayer() };
    const prisma = {
      platformAdmin: { findUnique: jest.fn().mockResolvedValue(admin), update: jest.fn().mockResolvedValue({}) },
      member: { findFirst: jest.fn() },
    };
    const mail = { sendPlatformAdminLoginCode: jest.fn() };
    const svc = new AuthService(prisma as any, mail as any, CONFIG);
    (svc as any).logger = { warn: jest.fn(), log: jest.fn(), error: jest.fn() };
    const err = await svc.login({ email: admin.email, password: CLAVE } as any).catch((e: unknown) => e);
    expect((err as UnauthorizedException).message).toBe('Credenciales inválidas');
    expect(mail.sendPlatformAdminLoginCode).not.toHaveBeenCalled();
    expect(prisma.member.findFirst).not.toHaveBeenCalled();
  });
});

describe('Emitir una temporal la deja con vencimiento', () => {
  const original = process.env.TEMP_PASSWORD_HORAS;
  afterEach(() => {
    if (original === undefined) delete process.env.TEMP_PASSWORD_HORAS;
    else process.env.TEMP_PASSWORD_HORAS = original;
  });

  function equipo() {
    const empleado = { id: 'm-emp', name: 'Empe', email: 'e@x.com', role: { id: 'r-emp', name: 'empleado' }, status: 'ACTIVE', hasTempPassword: false, lastAccessAt: null };
    const prisma = {
      member: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(empleado),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'm-nuevo', ...data })),
        update: jest.fn().mockResolvedValue({}),
      },
      role: { findFirst: jest.fn().mockResolvedValue({ id: 'r-emp', name: 'empleado' }) },
      business: { findUnique: jest.fn().mockResolvedValue({ id: 'biz-1', name: 'Tienda', storefrontConfig: null }) },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      passwordResetToken: { create: jest.fn().mockResolvedValue({}) },
    };
    const mail = { sendMemberInvitation: jest.fn(), sendMemberPasswordReset: jest.fn() };
    return { svc: new MembersService(prisma as any, mail as any), prisma, mail };
  }

  it('reset desde Equipo: tempPasswordExpiresAt = ahora + 72 h (default) y el mail dice el plazo', async () => {
    delete process.env.TEMP_PASSWORD_HORAS;
    const { svc, prisma, mail } = equipo();
    const antes = Date.now();
    await svc.resetPassword('biz-1', 'm-owner', 'owner', 'm-emp', true);
    const data = prisma.member.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ hasTempPassword: true });
    const vence = (data.tempPasswordExpiresAt as Date).getTime();
    expect(vence).toBeGreaterThanOrEqual(antes + 72 * HORA);
    expect(vence).toBeLessThanOrEqual(Date.now() + 72 * HORA);
    expect(mail.sendMemberPasswordReset).toHaveBeenCalledWith('e@x.com', expect.objectContaining({ tempPasswordHoras: 72 }), expect.anything());
  });

  it('reset desde Equipo respeta TEMP_PASSWORD_HORAS', async () => {
    process.env.TEMP_PASSWORD_HORAS = '5';
    const { svc, prisma, mail } = equipo();
    const antes = Date.now();
    await svc.resetPassword('biz-1', 'm-owner', 'owner', 'm-emp', true);
    const vence = (prisma.member.update.mock.calls[0][0].data.tempPasswordExpiresAt as Date).getTime();
    expect(vence).toBeGreaterThanOrEqual(antes + 5 * HORA);
    expect(vence).toBeLessThanOrEqual(Date.now() + 5 * HORA);
    expect(mail.sendMemberPasswordReset.mock.calls[0][1].tempPasswordHoras).toBe(5);
  });

  it('invitación: la temporal vence junto con el link (24 h)', async () => {
    const { svc, prisma } = equipo();
    await svc.invite('biz-1', 'owner', { name: 'Nuevo', email: 'nuevo@x.com', roleId: 'r-emp' });
    const data = prisma.member.create.mock.calls[0][0].data;
    expect(data.hasTempPassword).toBe(true);
    expect(data.tempPasswordExpiresAt).toEqual(data.invitationTokenExpiresAt);
  });
});

describe('Cambiar la contraseña limpia la temporal y su vencimiento', () => {
  const CLAVE = 'ClaveTemporal12';
  let hash: string;
  beforeAll(async () => { hash = await argon2.hash(CLAVE, { type: argon2.argon2id }); });

  it('Mi perfil (member-profile): hasTempPassword false y tempPasswordExpiresAt null', async () => {
    const prisma = {
      member: {
        findUnique: jest.fn().mockResolvedValue({ id: 'm-1', email: 'e@x.com', businessId: 'biz-1', passwordHash: hash }),
        update: jest.fn().mockResolvedValue({}),
      },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      business: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const auth = new AuthService(prisma as any, {} as any, CONFIG);
    const svc = new MemberProfileService(prisma as any, auth);
    await svc.changePassword('m-1', { currentPassword: CLAVE, newPassword: 'ClaveNueva456' });
    expect(prisma.member.update.mock.calls[0][0].data).toMatchObject({ hasTempPassword: false, tempPasswordExpiresAt: null });
  });

  it('aceptar la invitación: también', async () => {
    const prisma = {
      member: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'm-1', name: 'Nuevo', email: 'n@x.com', businessId: 'biz-1', status: 'PENDING', hasTempPassword: true,
          invitationTokenExpiresAt: manana(), business: { id: 'biz-1', name: 'Tienda', subdomain: 'tienda' },
        }),
        update: jest.fn().mockResolvedValue({ id: 'm-1', name: 'Nuevo', email: 'n@x.com', status: 'ACTIVE' }),
      },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    };
    const auth = new AuthService(prisma as any, {} as any, CONFIG);
    await auth.acceptInvitation({ token: 'tok', newPassword: 'ClaveNueva456' } as any);
    expect(prisma.member.update.mock.calls[0][0].data).toMatchObject({ hasTempPassword: false, tempPasswordExpiresAt: null });
  });
});
