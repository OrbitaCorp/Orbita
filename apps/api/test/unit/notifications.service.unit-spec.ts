import { NotificationsService } from '../../src/notifications/notifications.service';

// Unit test del motor de despacho (RBT-645): dispatch() es el único entry
// point del módulo — mockea Prisma/Mail, no toca la base. Los endpoints HTTP
// se prueban aparte en notifications.e2e-spec.ts.
function svcCon(matrix: any, members: { email: string }[] = []) {
  const prisma = {
    notificationConfig: { findUnique: jest.fn().mockResolvedValue({ matrix }) },
    notification: { create: jest.fn() },
    member: { findMany: jest.fn().mockResolvedValue(members) },
  };
  const mail = { sendCustomEmail: jest.fn().mockResolvedValue(true) };
  return { svc: new NotificationsService(prisma as any, mail as any), prisma, mail };
}

describe('NotificationsService.dispatch', () => {
  it('evento sin configurar → no hace nada', async () => {
    const { svc, prisma, mail } = svcCon({});
    await svc.dispatch('nuevo_pedido', 'biz-1', { title: 't', body: 'b' });
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(mail.sendCustomEmail).not.toHaveBeenCalled();
  });

  it('canal panel habilitado → persiste la notificación', async () => {
    const { svc, prisma } = svcCon({ nuevo_pedido: { panel: true, email: false, whatsapp: false } });
    await svc.dispatch('nuevo_pedido', 'biz-1', { title: 't', body: 'b' });
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ businessId: 'biz-1', event: 'nuevo_pedido', title: 't' }) }),
    );
  });

  it('canal email habilitado → manda a los members activos', async () => {
    const { svc, mail } = svcCon(
      { nuevo_pedido: { panel: false, email: true, whatsapp: false } },
      [{ email: 'a@test.com' }, { email: 'b@test.com' }],
    );
    await svc.dispatch('nuevo_pedido', 'biz-1', { title: 't', body: 'b' });
    expect(mail.sendCustomEmail).toHaveBeenCalledTimes(2);
  });

  it('canal whatsapp habilitado → no llama a mail ni prisma.notification (stub)', async () => {
    const { svc, prisma, mail } = svcCon({ nuevo_pedido: { panel: false, email: false, whatsapp: true } });
    await svc.dispatch('nuevo_pedido', 'biz-1', { title: 't', body: 'b' });
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(mail.sendCustomEmail).not.toHaveBeenCalled();
  });
});
