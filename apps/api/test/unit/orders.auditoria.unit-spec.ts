import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OrdersService } from '../../src/orders/orders.service';
import { CreateOrderDto } from '../../src/orders/dto/create-order.dto';
import { FindOrdersQueryDto } from '../../src/orders/dto/find-orders-query.dto';
import { CheckoutDto } from '../../src/storefront/dto/checkout.dto';

// Auditoría interna 2026-09-10, ítem `api.orders`.
//
// Lo central ya estaba bien (totales del servidor, máquina de estados, POS
// solo desde el panel, seguimiento de invitado por UUID + email); esto lo
// fija con tests. Lo que se arregló: topes en el alta (panel y checkout
// público: una cantidad enorme desbordaba el Int, 500 desde internet) y la
// búsqueda del listado con un número largo (otro 500).

const BIZ = 'biz-1';
const VAR = '11111111-1111-4111-8111-111111111111';

function pedidos(prisma: Record<string, unknown> = {}) {
  return new OrdersService(prisma as any, {} as any, {} as any, { emit: jest.fn() } as any);
}

describe('Alta de pedidos: lo que el cliente no puede decidir', () => {
  it('el checkout público no puede crear una venta presencial (POS)', async () => {
    await expect(
      pedidos().create(BIZ, { channel: 'POS', items: [{ variantId: VAR, quantity: 1 }], paymentMethod: 'CASH' }, { publicCheckout: true }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('no se acepta un precio editado a mano ni un ítem libre', async () => {
    await expect(pedidos().create(BIZ, { channel: 'ONLINE', items: [{ variantId: VAR, quantity: 1, editedPrice: 1 }] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(pedidos().create(BIZ, { channel: 'ONLINE', items: [{ variantId: VAR, quantity: 1, isConcept: true }] })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Máquina de estados', () => {
  function conPedido(order: Record<string, unknown>) {
    const prisma = { order: { findFirst: jest.fn().mockResolvedValue({ id: 'o-1', items: [], customer: null, onlineOrderDetails: null, business: { name: 'T', subdomain: 't' }, ...order }) } };
    return pedidos(prisma);
  }

  it.each([
    ['ONLINE', 'DELIVERED', 'PENDING'],
    ['ONLINE', 'SHIPPED', 'CANCELLED'],
    ['ONLINE', 'PENDING', 'COMPLETED'],
    ['ONLINE', 'CANCELLED', 'CONFIRMED'],
    ['POS', 'COMPLETED', 'CANCELLED'],
  ])('%s: de %s a %s se rechaza', async (channel, desde, hacia) => {
    await expect(conPedido({ channel, status: desde }).updateStatus(BIZ, 'm-1', 'o-1', hacia as any)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('un pedido de otro negocio da 404', async () => {
    const svc = pedidos({ order: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(svc.updateStatus(BIZ, 'm-1', 'o-ajeno', 'CONFIRMED')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Seguimiento de invitado', () => {
  function seguimiento(order: Record<string, unknown> | null) {
    const svc = pedidos({ order: { findFirst: jest.fn().mockResolvedValue(order) } });
    const detalle = jest.spyOn(svc, 'findOne').mockResolvedValue({ id: 'o-1' } as any);
    return { svc, detalle };
  }

  it('con el email del comprador (sin importar mayúsculas) devuelve el pedido', async () => {
    const { svc, detalle } = seguimiento({ id: 'o-1', customerId: null, onlineOrderDetails: { buyerEmail: 'Ana@Mail.com' } });
    await svc.findOneForTracking(BIZ, 'o-1', { email: ' ana@mail.com ' });
    expect(detalle).toHaveBeenCalledWith(BIZ, 'o-1');
  });

  it.each([
    ['otro email', { id: 'o-1', customerId: null, onlineOrderDetails: { buyerEmail: 'ana@mail.com' } }, { email: 'otra@mail.com' }],
    ['sin email', { id: 'o-1', customerId: null, onlineOrderDetails: { buyerEmail: 'ana@mail.com' } }, {}],
    ['pedido de un cliente registrado, sin su sesión', { id: 'o-1', customerId: 'c-1', onlineOrderDetails: null }, { email: 'ana@mail.com' }],
    ['id inexistente', null, { email: 'ana@mail.com' }],
  ])('%s: el mismo 404 y no se muestra nada', async (_c, order, ctx) => {
    const { svc, detalle } = seguimiento(order);
    await expect(svc.findOneForTracking(BIZ, 'o-1', ctx)).rejects.toBeInstanceOf(NotFoundException);
    expect(detalle).not.toHaveBeenCalled();
  });
});

describe('Listado del panel', () => {
  it('buscar un número largo no lo usa como número de pedido (desbordaba el Int, 500)', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      order: { findMany, count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockResolvedValue([[], 0, []]),
    };
    await pedidos(prisma).findAll(BIZ, { search: '20304050607' });
    expect(findMany.mock.calls[0][0].where.OR).not.toContainEqual({ orderNumber: 20304050607 });
    await pedidos(prisma).findAll(BIZ, { search: '#42' });
    expect(findMany.mock.calls[1][0].where.OR).toContainEqual({ orderNumber: 42 });
  });
});

describe('Topes del alta (panel y checkout público)', () => {
  const props = async (cls: any, body: object) => (await validate(plainToInstance(cls, body))).map((e) => e.property);
  const comprador = { name: 'Ana', email: 'ana@mail.com', phone: '1155556666', dni: '30111222' };

  it('checkout: una cantidad enorme o cien y un renglones se rechazan', async () => {
    const base = { buyer: comprador, shippingMethod: 'PICKUP', paymentMethod: 'CASH' };
    expect(await props(CheckoutDto, { ...base, items: [{ variantId: VAR, quantity: 3 }] })).toEqual([]);
    expect(await props(CheckoutDto, { ...base, items: [{ variantId: VAR, quantity: 3_000_000_000 }] })).toContain('items');
    expect(await props(CheckoutDto, { ...base, items: Array.from({ length: 101 }, () => ({ variantId: VAR, quantity: 1 })) })).toContain('items');
    expect(await props(CheckoutDto, { ...base, items: [{ variantId: VAR, quantity: 1 }], couponCode: 'x'.repeat(51) })).toContain('couponCode');
    expect(await props(CheckoutDto, { ...base, items: [{ variantId: VAR, quantity: 1 }], shippingAddress: { street: 'x'.repeat(201), provincia: 'BA', city: 'CABA', zip: '1000' } })).toContain('shippingAddress');
  });

  it('panel: mismos topes, y la búsqueda del listado también', async () => {
    const base = { channel: 'ONLINE', buyer: { name: 'Ana' } };
    expect(await props(CreateOrderDto, { ...base, items: [{ variantId: VAR, quantity: 2 }] })).toEqual([]);
    expect(await props(CreateOrderDto, { ...base, items: [{ variantId: VAR, quantity: 20_000 }] })).toContain('items');
    expect(await props(CreateOrderDto, { ...base, items: [{ variantId: VAR, quantity: 1 }], notes: 'x'.repeat(2001) })).toContain('notes');
    expect(await props(FindOrdersQueryDto, { search: 'x'.repeat(101) })).toContain('search');
  });
});
