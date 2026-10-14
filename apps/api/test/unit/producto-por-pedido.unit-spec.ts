import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { OrdersService } from '../../src/orders/orders.service';
import { ProductsService } from '../../src/products/products.service';

// "Se hace por pedido": el producto no lleva stock, se muestra en la tienda y se consulta por WhatsApp. El checkout de la
// tienda NO lo vende (aunque alguien se saltee la pantalla); un pedido que arma el dueño a mano sí puede llevarlo.

const BIZ = 'biz-1';
const VAR = '11111111-1111-4111-8111-111111111111';
const SUC = '22222222-2222-4222-8222-222222222222';

function armarPedidos(byOrder: boolean, stock = 0) {
  const prisma = {
    branch: { findFirst: jest.fn().mockResolvedValue({ id: SUC }) },
    customer: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    productVariant: {
      findMany: jest.fn().mockResolvedValue([{ id: VAR, price: 100, product: { name: 'Mesa de roble', byOrder }, optionValues: [] }]),
    },
    variantStock: { findMany: jest.fn().mockResolvedValue([{ variantId: VAR, quantity: stock }]) },
    businessConfig: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn().mockRejectedValue(new Error('fin del mock')),
  };
  const descuentos = { resolverDescuentosParaOrden: jest.fn().mockResolvedValue({ discountTotal: 0, redenciones: [] }) };
  const svc = new OrdersService(prisma as any, {} as any, descuentos as any, { emit: jest.fn() } as any);
  const crear = (opts?: { publicCheckout?: boolean }, quantity = 1) =>
    svc.create(BIZ, { channel: 'ONLINE', branch_id: SUC, buyer: { name: 'Ana' }, items: [{ variantId: VAR, quantity }] } as any, opts).catch((e) => e);
  return { crear };
}

describe('Pedido con un producto "por pedido"', () => {
  it('el checkout público lo rechaza, con el motivo, aunque alguien se saltee la pantalla de la tienda', async () => {
    const { crear } = armarPedidos(true);
    const e = await crear({ publicCheckout: true });
    expect(e).toBeInstanceOf(UnprocessableEntityException);
    expect(e.message).toMatch(/Mesa de roble.*se hace por pedido.*WhatsApp/);
  });

  it('un pedido armado a mano por el dueño sí lo lleva, sin controlar stock (hay 0 y pide 5)', async () => {
    const { crear } = armarPedidos(true, 0);
    const e = await crear(undefined, 5);
    expect(e.message).toBe('fin del mock'); // pasó todas las validaciones y llegó a la transacción
  });

  it('un producto común sin stock suficiente sigue rechazándose, como siempre', async () => {
    const { crear } = armarPedidos(false, 2);
    const e = await crear(undefined, 5);
    expect(e).toBeInstanceOf(UnprocessableEntityException);
    expect(e.message).toMatch(/No hay stock suficiente/);
  });

  it('un producto común por el checkout público sigue su camino normal', async () => {
    const { crear } = armarPedidos(false, 10);
    // Pasa las validaciones de producto y stock: después falla por otra cosa (el método de pago), no por esto.
    expect((await crear({ publicCheckout: true })).message).not.toMatch(/se hace por pedido|No hay stock/);
  });
});

describe('Producto "por pedido": publicar sin stock', () => {
  const dto = (extra: object = {}) => ({
    name: 'Mesa', categoryId: '8b1f0f1e-3b8a-4f7e-9d6e-1f2a3b4c5d6e', basePrice: 1000, status: 'PUBLISHED', options: [],
    variants: [{ price: 1000, optionValues: [] }], ...extra,
  });
  function armarProductos() {
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue({ mode: 'FULL' }) },
      category: { findFirst: jest.fn().mockResolvedValue({ id: 'cat-1' }) },
      product: { findFirst: jest.fn().mockResolvedValue(null) },
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'br-1' }) },
      $transaction: jest.fn().mockRejectedValue(new Error('llegó a la transacción')),
    };
    return new ProductsService(prisma as any, {} as any, {} as any);
  }

  it('en una tienda con checkout, sin stock no se publica...', async () => {
    await expect(armarProductos().create(BIZ, dto() as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('...salvo que se haga por pedido', async () => {
    await expect(armarProductos().create(BIZ, dto({ byOrder: true }) as any)).rejects.toThrow('llegó a la transacción');
  });
});
