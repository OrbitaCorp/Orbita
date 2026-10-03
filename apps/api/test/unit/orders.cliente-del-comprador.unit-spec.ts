import { Prisma } from '@prisma/client';
import { OrdersService } from '../../src/orders/orders.service';

// Una venta cargada desde el panel con el comprador tipeado a mano (nombre +
// email) tiene que dejar a esa persona en Clientes (Ale, 03/10). Antes el
// pedido guardaba los datos solo como texto y el cliente nunca aparecía.

const BIZ = 'biz-1';
const VAR = '11111111-1111-4111-8111-111111111111';
const SUC = '22222222-2222-4222-8222-222222222222';

// El alta sigue de largo después de resolver el cliente: se corta en el primer
// acceso a la base que este mock no define. Alcanza para mirar qué pasó con el cliente.
function armar(customer: Record<string, jest.Mock>) {
  const emit = jest.fn();
  const prisma = { branch: { findFirst: jest.fn().mockResolvedValue({ id: SUC }) }, customer };
  const svc = new OrdersService(prisma as any, {} as any, {} as any, { emit } as any);
  const crear = (buyer: Record<string, string>, opts?: { publicCheckout?: boolean }) =>
    svc
      .create(BIZ, { channel: 'ONLINE', branch_id: SUC, buyer, items: [{ variantId: VAR, quantity: 1 }] } as any, opts)
      .catch(() => undefined);
  return { crear, emit };
}

describe('Venta del panel con comprador tipeado a mano', () => {
  it('con email nuevo crea el cliente en ese negocio y avisa', async () => {
    const customer = {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'c-1', firstName: 'Ana', lastName: 'Paz Ruiz', email: 'ana@x.com' }),
    };
    const { crear, emit } = armar(customer);
    await crear({ name: '  Ana Paz Ruiz ', email: 'Ana@X.com', phone: '3757 111222' });

    expect(customer.create).toHaveBeenCalledWith({
      data: { businessId: BIZ, firstName: 'Ana', lastName: 'Paz Ruiz', email: 'ana@x.com', phone: '3757 111222', dni: null },
    });
    expect(emit).toHaveBeenCalledWith('notification.cliente_nuevo', { businessId: BIZ, customerName: 'Ana Paz Ruiz', customerId: 'c-1' });
  });

  it('si el email ya es de un cliente del negocio lo reutiliza, sin duplicar', async () => {
    const customer = { findFirst: jest.fn().mockResolvedValue({ id: 'c-9', firstName: 'Ana', email: 'ana@x.com' }), create: jest.fn() };
    const { crear } = armar(customer);
    await crear({ name: 'Ana', email: 'ANA@x.com' });

    expect(customer.findFirst).toHaveBeenCalledWith({
      where: { businessId: BIZ, deletedAt: null, email: { equals: 'ana@x.com', mode: 'insensitive' } },
    });
    expect(customer.create).not.toHaveBeenCalled();
  });

  it('sin email no crea ningún cliente (venta anónima)', async () => {
    const customer = { findFirst: jest.fn(), create: jest.fn() };
    const { crear } = armar(customer);
    await crear({ name: 'Mostrador' });

    expect(customer.findFirst).not.toHaveBeenCalled();
    expect(customer.create).not.toHaveBeenCalled();
  });

  it('el checkout público no crea clientes: al invitado se lo invita a registrarse', async () => {
    const customer = { findFirst: jest.fn(), create: jest.fn() };
    const { crear } = armar(customer);
    await crear({ name: 'Ana', email: 'ana@x.com' }, { publicCheckout: true });

    expect(customer.create).not.toHaveBeenCalled();
  });

  it('si el alta choca con el email (dos ventas a la vez) usa el que quedó creado', async () => {
    const choque = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
    const customer = {
      findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'c-2', firstName: 'Ana', email: 'ana@x.com' }),
      create: jest.fn().mockRejectedValue(choque),
    };
    const { crear, emit } = armar(customer);
    await crear({ name: 'Ana', email: 'ana@x.com' });

    expect(customer.findFirst).toHaveBeenCalledTimes(2);
    expect(emit).not.toHaveBeenCalled();
  });
});
