import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MeService } from '../../src/me/me.service';
import { UpdateMeDto } from '../../src/me/dto/update-me.dto';
import { ChangePasswordDto } from '../../src/me/dto/change-password.dto';

// Auditoría interna 2026-09-10, ítem `api.me`.
//
// La cuenta del cliente de la tienda tenía el mismo hueco que "Mi perfil" del
// panel: cambiar el email solo pedía la sesión, así que con una sesión ajena
// alcanzaba para ponerse un email propio y quedarse con la cuenta vía "olvidé
// mi contraseña". Además, la contraseña actual equivocada respondía 401, que
// el cliente web interpreta como sesión vencida.

const CLAVE = 'ClaveActual123';
let hash: string;
beforeAll(async () => { hash = await argon2.hash(CLAVE, { type: argon2.argon2id }); });

function cuenta(opts: { passwordHash?: string | null; email?: string | null; update?: jest.Mock; otro?: unknown } = {}) {
  const base = {
    id: 'c-1', firstName: 'Ana', lastName: null, email: opts.email === undefined ? 'ana@x.com' : opts.email,
    phone: null, dni: null, birthDate: null, avatarUrl: null, emailVerified: true,
  };
  const prisma = {
    customer: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve({ ...base, passwordHash: opts.passwordHash === undefined ? hash : opts.passwordHash })),
      findFirst: jest.fn().mockResolvedValue(opts.otro ?? null),
      update: opts.update ?? jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...base, ...data })),
    },
  };
  return { svc: new MeService(prisma as any, {} as any), prisma };
}

describe('Cambiar el email de la cuenta de la tienda pide la contraseña', () => {
  it.each([
    ['sin contraseña', undefined],
    ['con la equivocada', 'OtraClave999'],
  ])('%s: 400 y no se escribe nada', async (_c, currentPassword) => {
    const { svc, prisma } = cuenta();
    await expect(svc.updateProfile('c-1', 'biz-1', { email: 'robado@x.com', currentPassword })).rejects.toThrow(/contraseña actual/);
    expect(prisma.customer.update).not.toHaveBeenCalled();
  });

  it('borrar el email (null) también es un cambio y también la pide', async () => {
    const { svc, prisma } = cuenta();
    await expect(svc.updateProfile('c-1', 'biz-1', { email: null as unknown as string })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.customer.update).not.toHaveBeenCalled();
  });

  it('una cuenta que entra solo con Google no cambia el email por acá', async () => {
    const { svc } = cuenta({ passwordHash: null });
    await expect(svc.updateProfile('c-1', 'biz-1', { email: 'nuevo@x.com', currentPassword: CLAVE })).rejects.toThrow(/Google/);
  });

  it('con la contraseña correcta cambia y queda sin verificar', async () => {
    const { svc, prisma } = cuenta();
    await svc.updateProfile('c-1', 'biz-1', { email: 'nuevo@x.com', currentPassword: CLAVE });
    expect(prisma.customer.update.mock.calls[0][0].data).toEqual({ email: 'nuevo@x.com', emailVerified: false });
  });

  it('el perfil manda el mismo email junto con el resto: no es un cambio y no pide nada', async () => {
    const { svc, prisma } = cuenta();
    await svc.updateProfile('c-1', 'biz-1', { firstName: 'Ana María', email: 'ana@x.com', phone: '1155556666' });
    expect(prisma.customer.update.mock.calls[0][0].data).toEqual({ firstName: 'Ana María', phone: '1155556666' });
  });

  it('un email de otra cuenta de la tienda: 400; y la carrera del unique también 400, no 500', async () => {
    const tomado = cuenta({ otro: { id: 'c-2' } });
    await expect(tomado.svc.updateProfile('c-1', 'biz-1', { email: 'otra@x.com', currentPassword: CLAVE })).rejects.toThrow(/ya está en uso/);
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique', { code: 'P2002', clientVersion: 'test' });
    const carrera = cuenta({ update: jest.fn().mockRejectedValue(p2002) });
    await expect(carrera.svc.updateProfile('c-1', 'biz-1', { email: 'otra@x.com', currentPassword: CLAVE })).rejects.toThrow(/ya está en uso/);
  });
});

describe('Cambiar la contraseña', () => {
  it('con la actual equivocada responde 400 (un 401 cierra la sesión en el cliente web)', async () => {
    const { svc, prisma } = cuenta();
    const err = await svc.changePassword('c-1', { currentPassword: 'Mala1234567', newPassword: 'NuevaClave123' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(prisma.customer.update).not.toHaveBeenCalled();
  });

  it('con la correcta la cambia', async () => {
    const { svc, prisma } = cuenta();
    await expect(svc.changePassword('c-1', { currentPassword: CLAVE, newPassword: 'NuevaClave123' })).resolves.toEqual({ message: 'Contraseña actualizada.' });
    expect(prisma.customer.update).toHaveBeenCalled();
  });

  it('GET /me no devuelve el hash ni flags internos', async () => {
    const { svc } = cuenta();
    const perfil = await svc.getProfile('c-1');
    expect(Object.keys(perfil).sort()).toEqual(['avatarUrl', 'birthDate', 'dni', 'email', 'emailVerified', 'firstName', 'id', 'lastName', 'phone']);
  });
});

describe('DTOs de la cuenta', () => {
  const props = async (cls: any, body: object) => (await validate(plainToInstance(cls, body))).map((e) => e.property);

  it('email normalizado, topes y contraseñas hasta 128', async () => {
    expect(plainToInstance(UpdateMeDto, { email: ' Ana@X.com ' }).email).toBe('ana@x.com');
    expect(await props(UpdateMeDto, { firstName: '' })).toContain('firstName');
    expect(await props(UpdateMeDto, { phone: 'x'.repeat(41) })).toContain('phone');
    expect(await props(UpdateMeDto, { dni: 'x'.repeat(31) })).toContain('dni');
    expect(await props(UpdateMeDto, { firstName: 'Ana', lastName: null, email: null, phone: null })).toEqual([]);
    expect(await props(ChangePasswordDto, { currentPassword: 'x'.repeat(129), newPassword: 'NuevaClave123' })).toContain('currentPassword');
    expect(await props(ChangePasswordDto, { currentPassword: CLAVE, newPassword: 'x'.repeat(129) })).toContain('newPassword');
  });
});
