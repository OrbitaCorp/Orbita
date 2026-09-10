import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MemberProfileService } from '../../src/member-profile/member-profile.service';
import { UpdateMemberProfileDto } from '../../src/member-profile/dto/update-member-profile.dto';
import { ChangePasswordDto } from '../../src/member-profile/dto/change-password.dto';

// Auditoría interna 2026-09-10, ítem `api.member-profile`.
//
// Cambiar el email de un member no pedía nada más que la sesión: con una
// sesión robada alcanzaba para ponerse un email propio y, con "olvidé mi
// contraseña", quedarse la cuenta para siempre. Además el email no se
// normalizaba y las contraseñas no tenían tope.

const CLAVE = 'ClaveActual123';
let hash: string;
beforeAll(async () => { hash = await argon2.hash(CLAVE, { type: argon2.argon2id }); });

function perfil(opts: { passwordHash?: string | null; update?: jest.Mock } = {}) {
  const base = { id: 'm-1', name: 'Ana', email: 'ana@negocio.test', emailVerified: true, themePreference: 'SYSTEM', role: { name: 'empleado' } };
  const prisma = {
    member: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve({ ...base, passwordHash: opts.passwordHash === undefined ? hash : opts.passwordHash })),
      findFirst: jest.fn().mockResolvedValue(null),
      update: opts.update ?? jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...base, ...data })),
    },
    // Cambiar la contraseña cierra las demás sesiones (auditoría 10/09, web.panel.perfil).
    refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    business: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  return { svc: new MemberProfileService(prisma as any), prisma };
}

describe('Cambiar el email pide la contraseña actual', () => {
  it.each([
    ['sin contraseña', undefined],
    ['con la contraseña equivocada', 'OtraClave999'],
  ])('%s: 400 y no se escribe nada', async (_caso, currentPassword) => {
    const { svc, prisma } = perfil();
    await expect(svc.updateProfile('m-1', 'biz-1', { email: 'robado@x.com', currentPassword })).rejects.toThrow(/contraseña actual/);
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it('una cuenta sin contraseña propia (solo Google) no puede cambiar el email por acá', async () => {
    const { svc } = perfil({ passwordHash: null });
    await expect(svc.updateProfile('m-1', 'biz-1', { email: 'nuevo@x.com', currentPassword: CLAVE })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('con la contraseña correcta cambia y queda sin verificar', async () => {
    const { svc, prisma } = perfil();
    await svc.updateProfile('m-1', 'biz-1', { email: 'nuevo@x.com', currentPassword: CLAVE });
    expect(prisma.member.update.mock.calls[0][0].data).toEqual({ email: 'nuevo@x.com', emailVerified: false });
  });

  it('el panel manda el MISMO email con el nombre: eso no es un cambio y no pide contraseña', async () => {
    const { svc, prisma } = perfil();
    await svc.updateProfile('m-1', 'biz-1', { name: 'Ana María', email: 'ana@negocio.test' });
    expect(prisma.member.update.mock.calls[0][0].data).toEqual({ name: 'Ana María' });
  });

  it('dos cambios simultáneos al mismo email: el segundo recibe 400, no 500', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
    const { svc } = perfil({ update: jest.fn().mockRejectedValue(p2002) });
    await expect(svc.updateProfile('m-1', 'biz-1', { email: 'nuevo@x.com', currentPassword: CLAVE })).rejects.toThrow(/ya está en uso/);
  });

  it('el perfil se edita siempre por el id del token: el where es solo el memberId recibido', async () => {
    const { svc, prisma } = perfil();
    await svc.updateProfile('m-1', 'biz-1', { name: 'X' });
    expect(prisma.member.update.mock.calls[0][0].where).toEqual({ id: 'm-1' });
  });
});

describe('DTOs de Mi perfil', () => {
  it('el email se normaliza (trim + minúsculas) antes de llegar al service', () => {
    const dto = plainToInstance(UpdateMemberProfileDto, { email: '  Ana@Negocio.TEST ' });
    expect(dto.email).toBe('ana@negocio.test');
  });

  it('nombre obligatorio y con tope; contraseñas con tope de 128', async () => {
    const props = async (cls: any, body: object) => (await validate(plainToInstance(cls, body))).map((e) => e.property);
    expect(await props(UpdateMemberProfileDto, { name: '' })).toContain('name');
    expect(await props(UpdateMemberProfileDto, { name: 'x'.repeat(81) })).toContain('name');
    expect(await props(UpdateMemberProfileDto, { currentPassword: 'x'.repeat(129) })).toContain('currentPassword');
    expect(await props(ChangePasswordDto, { currentPassword: 'x'.repeat(129), newPassword: 'NuevaClave123' })).toContain('currentPassword');
    expect(await props(ChangePasswordDto, { currentPassword: CLAVE, newPassword: 'x'.repeat(129) })).toContain('newPassword');
    expect(await props(ChangePasswordDto, { currentPassword: CLAVE, newPassword: 'NuevaClave123' })).toEqual([]);
  });
});
