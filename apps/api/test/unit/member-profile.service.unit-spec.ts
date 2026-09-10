import { BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { MemberProfileService } from '../../src/member-profile/member-profile.service';

// Unit test de "Mi perfil" del panel (RBT-646). Mockea Prisma — no toca la base.
// Desde la auditoría interna del 10/09 (ítem `api.member-profile`), cambiar el
// email pide la contraseña actual: los casos de cambio de email la mandan.

const CLAVE = 'ClaveActual123';
let hash: string;
beforeAll(async () => { hash = await argon2.hash(CLAVE, { type: argon2.argon2id }); });

function svcCon(overrides: { existente?: any } = {}) {
  const member = {
    id: 'm-1', name: 'Ana', email: 'ana@negocio.test', emailVerified: true,
    themePreference: 'SYSTEM', role: { name: 'owner' },
  };
  const prisma = {
    member: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve({ ...member, passwordHash: hash })),
      findFirst: jest.fn().mockResolvedValue(overrides.existente ?? null),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...member, ...data, role: { name: 'owner' } })),
    },
  };
  const svc = new MemberProfileService(prisma as any);
  return { svc, prisma };
}

describe('MemberProfileService (unit)', () => {
  it('getProfile() devuelve nombre/email/rol/tema, sin datos sensibles', async () => {
    const { svc } = svcCon();
    const result = await svc.getProfile('m-1');
    expect(result).toEqual({
      id: 'm-1', name: 'Ana', email: 'ana@negocio.test', emailVerified: true, role: 'owner', themePreference: 'SYSTEM',
    });
  });

  it('updateProfile() rechaza si el email ya está en uso por otro miembro del mismo negocio', async () => {
    const { svc, prisma } = svcCon({ existente: { id: 'm-2' } });
    await expect(
      svc.updateProfile('m-1', 'biz-1', { email: 'ocupado@negocio.test', currentPassword: CLAVE }),
    ).rejects.toThrow(/ya está en uso/);
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it('updateProfile() cambia el email y resetea emailVerified', async () => {
    const { svc, prisma } = svcCon({ existente: null });
    const result = await svc.updateProfile('m-1', 'biz-1', { email: 'nuevo@negocio.test', currentPassword: CLAVE });
    expect(prisma.member.update.mock.calls[0][0].data).toMatchObject({ email: 'nuevo@negocio.test', emailVerified: false });
    expect(result.email).toBe('nuevo@negocio.test');
  });

  it('updateProfile() solo cambia el nombre si el email no viene en el dto', async () => {
    const { svc, prisma } = svcCon();
    await svc.updateProfile('m-1', 'biz-1', { name: 'Ana María' });
    expect(prisma.member.update.mock.calls[0][0].data).toEqual({ name: 'Ana María' });
    expect(prisma.member.findFirst).not.toHaveBeenCalled();
  });

  it('updateTheme() persiste la preferencia elegida', async () => {
    const { svc, prisma } = svcCon();
    const result = await svc.updateTheme('m-1', 'DARK');
    expect(prisma.member.update.mock.calls[0][0].data).toEqual({ themePreference: 'DARK' });
    expect(result.themePreference).toBe('DARK');
  });

  it('updateProfile() sin contraseña no cambia el email', async () => {
    const { svc, prisma } = svcCon();
    await expect(svc.updateProfile('m-1', 'biz-1', { email: 'nuevo@negocio.test' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.member.update).not.toHaveBeenCalled();
  });
});
