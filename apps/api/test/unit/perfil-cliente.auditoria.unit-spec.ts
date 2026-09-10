import { createHash } from 'crypto';
import * as argon2 from 'argon2';
import { MeService } from '../../src/me/me.service';

// Auditoría interna 10/09, ítem web.cliente.perfil: cambiar la contraseña de
// la cuenta de la tienda cierra las demás sesiones del cliente y avisa por
// mail (mismo criterio que Mi perfil del panel).

jest.setTimeout(30_000);

const CLAVE = 'ClaveActual123';
let hash: string;
beforeAll(async () => { hash = await argon2.hash(CLAVE, { type: argon2.argon2id }); });

function armar(opts: { email?: string | null; mailFalla?: boolean } = {}) {
  const prisma = {
    customer: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve({
        id: 'c-1', businessId: 'biz-1', email: opts.email === undefined ? 'ana@x.com' : opts.email, passwordHash: hash,
      })),
      update: jest.fn().mockResolvedValue({}),
    },
    refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
    business: { findUnique: jest.fn().mockResolvedValue({ name: 'Tienda', storefrontConfig: { storeName: 'Tienda Ana' } }) },
  };
  const mail = {
    sendPasswordChanged: opts.mailFalla ? jest.fn().mockRejectedValue(new Error('Resend caído')) : jest.fn().mockResolvedValue(undefined),
  };
  const svc = new MeService(prisma as any, {} as any, mail as any);
  (svc as any).avisoLogger = { warn: jest.fn() };
  return { svc, prisma, mail };
}

const dto = { currentPassword: CLAVE, newPassword: 'ClaveNueva456' };

describe('Cambiar la contraseña desde Mi cuenta (tienda)', () => {
  it('cierra las sesiones del cliente', async () => {
    const { svc, prisma } = armar();
    await svc.changePassword('c-1', dto);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'c-1', userType: 'CUSTOMER', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('con x-refresh-token preserva esa sesión', async () => {
    const { svc, prisma } = armar();
    await svc.changePassword('c-1', dto, 'token-actual');
    const hashActual = createHash('sha256').update('token-actual').digest('hex');
    expect(prisma.refreshToken.updateMany.mock.calls[0][0].where).toMatchObject({ tokenHash: { not: hashActual } });
  });

  it('avisa por mail con el nombre de la tienda', async () => {
    const { svc, mail } = armar();
    await svc.changePassword('c-1', dto);
    expect(mail.sendPasswordChanged).toHaveBeenCalledWith('ana@x.com', { storeName: 'Tienda Ana' }, { businessId: 'biz-1', customerId: 'c-1' });
  });

  it('sin email cargado no intenta mandar nada; si el mail falla, el cambio queda igual', async () => {
    const sinEmail = armar({ email: null });
    await sinEmail.svc.changePassword('c-1', dto);
    expect(sinEmail.mail.sendPasswordChanged).not.toHaveBeenCalled();

    const conFalla = armar({ mailFalla: true });
    await expect(conFalla.svc.changePassword('c-1', dto)).resolves.toEqual({ message: 'Contraseña actualizada.' });
  });

  it('con la contraseña actual equivocada: 400 y nada más', async () => {
    const { svc, prisma, mail } = armar();
    await expect(svc.changePassword('c-1', { ...dto, currentPassword: 'Otra999999' })).rejects.toThrow('no es correcta');
    expect(prisma.customer.update).not.toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(mail.sendPasswordChanged).not.toHaveBeenCalled();
  });
});
