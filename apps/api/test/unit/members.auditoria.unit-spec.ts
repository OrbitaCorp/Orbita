import { UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MembersService } from '../../src/members/members.service';
import { AuthService } from '../../src/auth/auth.service';
import { InviteMemberDto } from '../../src/members/dto/invite-member.dto';
import { UpdateMemberDto } from '../../src/members/dto/update-member.dto';

// Auditoría interna 2026-09-10, ítem `api.members`.
//
// Cuatro huecos de privilegios dentro de un mismo negocio:
// - invitar aceptaba el rol "owner" desde un admin (un admin se fabricaba un
//   dueño propio y con él degradaba al real);
// - el dueño podía degradarse a sí mismo y dejar el negocio sin dueño;
// - un admin le reseteaba la contraseña a otro admin (y la temporal vuelve en
//   la respuesta) y podía renombrar al dueño;
// - la contraseña temporal de una invitación no vencía nunca: el link de
//   aceptar sí (24 h), pero con esa contraseña se entraba igual.

const BIZ = 'biz-1';
const rol = (name: string) => ({ id: `r-${name}`, name });
const miembro = (id: string, roleName: string, extra: Record<string, unknown> = {}) => ({
  id, name: id, email: `${id}@x.com`, role: rol(roleName), status: 'ACTIVE', hasTempPassword: false, lastAccessAt: null, ...extra,
});

function equipo(opts: { objetivo?: unknown; rolNuevo?: unknown; owners?: number } = {}) {
  const prisma = {
    member: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(opts.objetivo ?? null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'm-nuevo', ...data })),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(opts.owners ?? 1),
    },
    role: { findFirst: jest.fn().mockResolvedValue(opts.rolNuevo ?? null) },
    business: { findUnique: jest.fn().mockResolvedValue({ id: BIZ, name: 'Tienda', storefrontConfig: null }) },
    refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  const mail = { sendMemberInvitation: jest.fn(), sendMemberPasswordReset: jest.fn() };
  return { svc: new MembersService(prisma as any, mail as any), prisma, mail };
}

describe('Invitar: solo el dueño crea dueños', () => {
  const dto = { name: 'Nuevo', email: 'nuevo@x.com', roleId: 'r-owner' };

  it('un admin NO puede invitar a alguien como owner', async () => {
    const { svc, prisma, mail } = equipo({ rolNuevo: rol('owner') });
    await expect(svc.invite(BIZ, 'admin', dto)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.member.create).not.toHaveBeenCalled();
    expect(mail.sendMemberInvitation).not.toHaveBeenCalled();
  });

  it('el dueño sí puede invitar a otro owner', async () => {
    const { svc, prisma } = equipo({ rolNuevo: rol('owner') });
    await svc.invite(BIZ, 'owner', dto);
    expect(prisma.member.create).toHaveBeenCalled();
  });

  it('un admin invita empleados normalmente', async () => {
    const { svc, prisma } = equipo({ rolNuevo: rol('empleado') });
    await svc.invite(BIZ, 'admin', { ...dto, roleId: 'r-empleado' });
    expect(prisma.member.create).toHaveBeenCalled();
  });
});

describe('Editar: al dueño solo lo toca el dueño, y el último no se degrada', () => {
  it('un admin NO puede renombrar al owner', async () => {
    const { svc, prisma } = equipo({ objetivo: miembro('m-owner', 'owner') });
    await expect(svc.update(BIZ, 'm-admin', 'admin', 'm-owner', { name: 'Otro' })).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.member.updateMany).not.toHaveBeenCalled();
  });

  it('el owner sí se renombra a sí mismo', async () => {
    const { svc, prisma } = equipo({ objetivo: miembro('m-owner', 'owner') });
    await svc.update(BIZ, 'm-owner', 'owner', 'm-owner', { name: 'Nuevo nombre' });
    expect(prisma.member.updateMany).toHaveBeenCalled();
  });

  it('el ÚNICO owner no puede degradarse (el negocio quedaría sin dueño)', async () => {
    const { svc, prisma } = equipo({ objetivo: miembro('m-owner', 'owner'), rolNuevo: rol('empleado'), owners: 1 });
    await expect(svc.update(BIZ, 'm-owner', 'owner', 'm-owner', { roleId: 'r-empleado' })).rejects.toThrow(/al menos un propietario/);
    expect(prisma.member.count).toHaveBeenCalledWith({ where: { businessId: BIZ, role: { name: 'owner' } } });
    expect(prisma.member.updateMany).not.toHaveBeenCalled();
  });

  it('con dos owners, uno puede pasar a otro rol', async () => {
    const { svc, prisma } = equipo({ objetivo: miembro('m-owner', 'owner'), rolNuevo: rol('empleado'), owners: 2 });
    await svc.update(BIZ, 'm-owner', 'owner', 'm-owner', { roleId: 'r-empleado' });
    expect(prisma.member.updateMany).toHaveBeenCalled();
  });
});

describe('Resetear contraseña: un admin no se lleva la cuenta de otro admin', () => {
  it('admin → otro admin: 422 y no se toca nada', async () => {
    const { svc, prisma } = equipo({ objetivo: miembro('m-admin2', 'admin') });
    await expect(svc.resetPassword(BIZ, 'm-admin', 'admin', 'm-admin2', false)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it.each([
    ['admin → su propia contraseña', 'm-admin', 'admin', miembro('m-admin', 'admin')],
    ['owner → un admin', 'm-owner', 'owner', miembro('m-admin', 'admin')],
    ['admin → un empleado', 'm-admin', 'admin', miembro('m-emp', 'empleado')],
  ])('%s: permitido', async (_caso, actorId, actorRol, objetivo) => {
    const { svc, prisma } = equipo({ objetivo });
    const r = await svc.resetPassword(BIZ, actorId, actorRol, (objetivo as { id: string }).id, false);
    expect(r.tempPassword).toHaveLength(12);
    expect(prisma.member.update).toHaveBeenCalled();
  });

  it('al owner no se le resetea desde acá, ni siquiera el propio owner', async () => {
    const { svc } = equipo({ objetivo: miembro('m-owner', 'owner') });
    await expect(svc.resetPassword(BIZ, 'm-owner', 'owner', 'm-owner', false)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});

describe('DTOs del equipo', () => {
  const errores = async (cls: any, body: object) => (await validate(plainToInstance(cls, body))).map((e) => e.property);

  it('el nombre es obligatorio y tiene tope', async () => {
    const base = { email: 'a@x.com', roleId: '8b1f0f1e-3b8a-4f7e-9d6e-1f2a3b4c5d6e' };
    expect(await errores(InviteMemberDto, { ...base, name: '' })).toContain('name');
    expect(await errores(InviteMemberDto, { ...base, name: 'x'.repeat(81) })).toContain('name');
    expect(await errores(InviteMemberDto, { ...base, name: 'Ana' })).toEqual([]);
    expect(await errores(UpdateMemberDto, { name: '' })).toContain('name');
  });
});

describe('Login de un member invitado', () => {
  let hash: string;
  beforeAll(async () => { hash = await argon2.hash('ClaveTemporal12', { type: argon2.argon2id }); });

  const NEGOCIO = { id: BIZ, subdomain: 'tienda', name: 'Tienda', mode: 'FULL' };
  function login(extra: Record<string, unknown>) {
    const member = {
      id: 'm1', email: 'inv@x.com', name: 'Invitado', businessId: BIZ, passwordHash: hash, lockedUntil: null, failedLoginAttempts: 0,
      status: 'ACTIVE', invitationTokenExpiresAt: null, role: { name: 'empleado', rolePermissions: [] }, business: NEGOCIO, ...extra,
    };
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue(NEGOCIO) },
      member: { findFirst: jest.fn().mockResolvedValue(member), update: jest.fn().mockResolvedValue({}) },
      customer: { findFirst: jest.fn().mockResolvedValue(null) },
      platformAdmin: { findUnique: jest.fn().mockResolvedValue(null) },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    };
    const config = { getOrThrow: () => 'test-secret-de-al-menos-32-caracteres', get: () => undefined };
    return { svc: new AuthService(prisma as any, {} as any, config as any), prisma };
  }
  const ayer = new Date(Date.now() - 86_400_000);
  const manana = new Date(Date.now() + 86_400_000);

  it.each([['desde la tienda', 'tienda'], ['desde el apex', undefined]])('%s: invitación vencida → no entra con la temporal', async (_c, slug) => {
    const { svc, prisma } = login({ status: 'PENDING', invitationTokenExpiresAt: ayer });
    await expect(svc.login({ email: 'inv@x.com', password: 'ClaveTemporal12' } as any, slug)).rejects.toThrow(/invitación venció/);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it.each([['desde la tienda', 'tienda'], ['desde el apex', undefined]])('%s: invitación vigente → entra', async (_c, slug) => {
    const { svc } = login({ status: 'PENDING', invitationTokenExpiresAt: manana });
    await expect(svc.login({ email: 'inv@x.com', password: 'ClaveTemporal12' } as any, slug)).resolves.toMatchObject({ type: 'member' });
  });

  it('un member ACTIVE entra aunque no tenga invitación', async () => {
    const { svc } = login({});
    await expect(svc.login({ email: 'inv@x.com', password: 'ClaveTemporal12' } as any, 'tienda')).resolves.toMatchObject({ type: 'member' });
  });

  it('con la contraseña mala el mensaje es el genérico, no el de la invitación', async () => {
    const { svc } = login({ status: 'PENDING', invitationTokenExpiresAt: ayer });
    const err = await svc.login({ email: 'inv@x.com', password: 'OtraClave1234' } as any, 'tienda').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnauthorizedException);
    expect((err as Error).message).toBe('Credenciales inválidas');
  });
});
