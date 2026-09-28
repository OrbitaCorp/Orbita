import { NotificationsService } from '../../src/notifications/notifications.service';
import { RolesService } from '../../src/roles/roles.service';
import { EVENTOS_AL_EQUIPO } from '../../src/notifications/notification-events';

// Avisos por email repartidos por rol (Equipo → Roles): el propietario recibe
// todo; un rol sin lista guardada también (es lo de antes); un rol con lista
// solo recibe los eventos que tiene tildados.
type Miembro = { email: string; role: { name: string; notificationEvents: string[] | null } };

function svcCon(matrix: unknown, members: Miembro[]) {
  const prisma = {
    notificationConfig: { findUnique: jest.fn().mockResolvedValue({ matrix }) },
    notification: { create: jest.fn() },
    member: { findMany: jest.fn().mockResolvedValue(members) },
  };
  const mail = { sendCustomEmail: jest.fn().mockResolvedValue(true), sendNewOrderToTeam: jest.fn().mockResolvedValue(true) };
  return { svc: new NotificationsService(prisma as never, mail as never), mail };
}

describe('NotificationsService — avisos por email según el rol', () => {
  const miembros: Miembro[] = [
    { email: 'dueno@test.com', role: { name: 'owner', notificationEvents: [] } },
    { email: 'ventas@test.com', role: { name: 'Ventas', notificationEvents: ['nuevo_pedido'] } },
    { email: 'stock@test.com', role: { name: 'Depósito', notificationEvents: ['stock_critico'] } },
    { email: 'sinlista@test.com', role: { name: 'Otro', notificationEvents: null } },
  ];

  it('manda solo a quien tiene ese aviso: propietario, rol que lo tilda y rol sin lista', async () => {
    const { svc, mail } = svcCon({ nuevo_pedido: { panel: false, email: true } }, miembros);
    await svc.dispatch('nuevo_pedido', 'biz-1', { title: 't', body: 'b' });
    const destinos = mail.sendCustomEmail.mock.calls.map((c: unknown[]) => c[0]);
    expect(destinos).toEqual(['dueno@test.com', 'ventas@test.com', 'sinlista@test.com']);
  });

  it('otro evento: el rol de depósito lo recibe y el de ventas no', async () => {
    const { svc, mail } = svcCon({ stock_critico: { panel: false, email: true } }, miembros);
    await svc.dispatch('stock_critico', 'biz-1', { title: 't', body: 'b' });
    const destinos = mail.sendCustomEmail.mock.calls.map((c: unknown[]) => c[0]);
    expect(destinos).toEqual(['dueno@test.com', 'stock@test.com', 'sinlista@test.com']);
  });

  it('nuevo pedido con datos de pedido: usa la plantilla de marca, no el texto plano', async () => {
    const { svc, mail } = svcCon({ nuevo_pedido: { panel: false, email: true } }, [miembros[0]]);
    const pedidoNuevo = {
      storeName: 'Tienda', customerName: 'Ana', orderNumber: 7, total: '$20.000',
      items: [{ name: 'X', quantity: 1, price: '$10.000' }], orderUrl: 'https://x',
    };
    await svc.dispatch('nuevo_pedido', 'biz-1', { title: 't', body: 'b', pedidoNuevo });
    expect(mail.sendNewOrderToTeam).toHaveBeenCalledWith('dueno@test.com', pedidoNuevo, { businessId: 'biz-1' });
    expect(mail.sendCustomEmail).not.toHaveBeenCalled();
  });
});

describe('RolesService — avisos por email de un rol', () => {
  function rolesCon() {
    const creado = { id: 'r1', name: 'Ventas', description: null, color: null, isDefault: false, notificationEvents: null, rolePermissions: [], _count: { members: 0 } };
    const prisma = {
      role: { create: jest.fn().mockResolvedValue(creado), findFirst: jest.fn().mockResolvedValue(null) },
      permission: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return { svc: new RolesService(prisma as never), prisma };
  }
  const base = { name: 'Ventas', permissions: [] as string[] };

  it('una lista con un evento inventado se rechaza', async () => {
    const { svc } = rolesCon();
    await expect(svc.create('biz-1', { ...base, notificationEvents: ['nuevo_pedido', 'inventado'] })).rejects.toThrow('Avisos inválidos: inventado');
  });

  it('una lista parcial se guarda tal cual, sin repetidos', async () => {
    const { svc, prisma } = rolesCon();
    await svc.create('biz-1', { ...base, notificationEvents: ['nuevo_pedido', 'nuevo_pedido', 'stock_critico'] });
    expect(prisma.role.create.mock.calls[0][0].data.notificationEvents).toEqual(['nuevo_pedido', 'stock_critico']);
  });

  it('una lista que cubre todos los eventos del equipo se guarda como "todos" (null)', async () => {
    const { svc, prisma } = rolesCon();
    await svc.create('biz-1', { ...base, notificationEvents: [...EVENTOS_AL_EQUIPO] });
    // Prisma.DbNull, no un array
    expect(Array.isArray(prisma.role.create.mock.calls[0][0].data.notificationEvents)).toBe(false);
  });

  it('el evento del cliente invitado no se puede repartir por rol', async () => {
    const { svc } = rolesCon();
    await expect(svc.create('biz-1', { ...base, notificationEvents: ['invitacion_cuenta_invitado'] })).rejects.toThrow('Avisos inválidos');
  });
});
