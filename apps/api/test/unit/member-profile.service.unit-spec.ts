import { BadRequestException } from '@nestjs/common';
import { MemberProfileService } from '../../src/member-profile/member-profile.service';

// Unit test de "Mi perfil" del panel (RBT-646). Mockea Prisma — no toca la base.

function svcCon(overrides: { existente?: any } = {}) {
  const member = {
    id: 'm-1', name: 'Ana', email: 'ana@negocio.test', emailVerified: true,
    themePreference: 'SYSTEM', role: { name: 'owner' },
  };
  const prisma = {
    member: {
      findUnique: jest.fn().mockResolvedValue(member),
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
    const { svc } = svcCon({ existente: { id: 'm-2' } });
    await expect(
      svc.updateProfile('m-1', 'biz-1', { email: 'ocupado@negocio.test' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updateProfile() cambia el email y resetea emailVerified', async () => {
    const { svc, prisma } = svcCon({ existente: null });
    const result = await svc.updateProfile('m-1', 'biz-1', { email: 'nuevo@negocio.test' });
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
});
