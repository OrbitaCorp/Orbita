import { createHash } from 'crypto';
import * as argon2 from 'argon2';
import { MemberProfileService } from '../../src/member-profile/member-profile.service';

// Auditoría interna 10/09, ítem web.panel.perfil: cambiar la contraseña
// cierra las demás sesiones y avisa por mail; con la actual equivocada no
// pasa nada de eso.

jest.setTimeout(30_000);

const CLAVE = 'ClaveActual123';
let hash: string;
beforeAll(async () => { hash = await argon2.hash(CLAVE, { type: argon2.argon2id }); });

function armar(opts: { mailFalla?: boolean } = {}) {
  const prisma = {
    member: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve({ id: 'm-1', email: 'ana@negocio.test', businessId: 'biz-1', passwordHash: hash })),
      update: jest.fn().mockResolvedValue({}),
    },
    refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    business: { findUnique: jest.fn().mockResolvedValue({ name: 'Tienda', storefrontConfig: { storeName: 'Tienda Ana' } }) },
  };
  const mail = {
    sendPasswordChanged: opts.mailFalla ? jest.fn().mockRejectedValue(new Error('Resend caído')) : jest.fn().mockResolvedValue(undefined),
  };
  const svc = new MemberProfileService(prisma as any, mail as any);
  (svc as any).logger = { warn: jest.fn() };
  return { svc, prisma, mail };
}

const dto = { currentPassword: CLAVE, newPassword: 'ClaveNueva456' };

describe('Cambiar la contraseña desde Mi perfil', () => {
  it('cierra todas las sesiones del miembro (el panel no puede mandar la suya)', async () => {
    const { svc, prisma } = armar();
    await svc.changePassword('m-1', dto);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'm-1', userType: 'MEMBER', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('con x-refresh-token preserva esa sesión y cierra las demás', async () => {
    const { svc, prisma } = armar();
    await svc.changePassword('m-1', dto, 'token-de-esta-sesion');
    const hashActual = createHash('sha256').update('token-de-esta-sesion').digest('hex');
    expect(prisma.refreshToken.updateMany.mock.calls[0][0].where).toMatchObject({ tokenHash: { not: hashActual } });
  });

  it('avisa por mail con el nombre de la tienda', async () => {
    const { svc, mail } = armar();
    await svc.changePassword('m-1', dto);
    expect(mail.sendPasswordChanged).toHaveBeenCalledWith('ana@negocio.test', { storeName: 'Tienda Ana' }, { businessId: 'biz-1', memberId: 'm-1' });
  });

  it('si el mail falla, el cambio igual queda hecho', async () => {
    const { svc, prisma } = armar({ mailFalla: true });
    await expect(svc.changePassword('m-1', dto)).resolves.toEqual({ message: 'Contraseña actualizada' });
    expect(prisma.member.update).toHaveBeenCalled();
  });

  it('con la contraseña actual equivocada no cambia nada, no cierra sesiones ni avisa', async () => {
    const { svc, prisma, mail } = armar();
    await expect(svc.changePassword('m-1', { ...dto, currentPassword: 'Otra999999' })).rejects.toThrow('no es correcta');
    expect(prisma.member.update).not.toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(mail.sendPasswordChanged).not.toHaveBeenCalled();
  });
});
