import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ReviewsService } from '../../src/reviews/reviews.service';

// Unit test de la regla clave de RBT-632: SOLO puede reseñar quien compró el
// producto y el pedido ya se entregó. Mockea Prisma — no toca la base.

function svcCon(overrides: { order?: any; orderItem?: any; conEventEmitter?: boolean } = {}) {
  const prisma = {
    order: { findFirst: jest.fn().mockResolvedValue(overrides.order ?? null) },
    orderItem: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(overrides.orderItem ?? null),
    },
    review: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'rev-1', productId: 'prod-1', orderId: 'order-1', text: 'Buenísimo',
        status: 'VISIBLE', hiddenReason: null, isVerified: true, createdAt: new Date(),
        customer: { firstName: 'María', lastName: 'González' },
      }),
    },
    product: { findUnique: jest.fn().mockResolvedValue({ name: 'Remera azul' }) },
  };
  const eventEmitter = { emit: jest.fn() };
  const svc = new ReviewsService(prisma as any, undefined, overrides.conEventEmitter ? (eventEmitter as any) : undefined);
  return { svc, prisma, eventEmitter };
}

describe('ReviewsService — elegibilidad y alta (unit)', () => {
  it('create() rechaza si el pedido no existe o no está entregado', async () => {
    const { svc } = svcCon({ order: null });
    await expect(
      svc.create('biz-1', 'cust-1', { orderId: 'order-1', productId: 'prod-1', text: 'texto' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create() rechaza si el producto no pertenece a ese pedido', async () => {
    const { svc } = svcCon({ order: { id: 'order-1' }, orderItem: null });
    await expect(
      svc.create('biz-1', 'cust-1', { orderId: 'order-1', productId: 'prod-otro', text: 'texto' } as any),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('create() acepta y devuelve el nombre público truncado ("Nombre I.")', async () => {
    const { svc, prisma } = svcCon({ order: { id: 'order-1' }, orderItem: { id: 'item-1' } });
    const result = await svc.create('biz-1', 'cust-1', { orderId: 'order-1', productId: 'prod-1', text: 'Buenísimo' } as any);
    expect(result.customerName).toBe('María G.');
    expect(result.isVerified).toBe(true);
    expect(prisma.review.create.mock.calls[0][0].data.isVerified).toBe(true);
  });

  it('eligibleFor() no elegible si no hay pedidos entregados con ese producto', async () => {
    const { svc, prisma } = svcCon();
    prisma.orderItem.findFirst.mockResolvedValue(null);
    const result = await svc.eligibleFor('biz-1', 'cust-1', 'prod-1');
    expect(result).toEqual({ eligible: false, orderId: null });
  });

  it('eligibleFor() elegible cuando hay un pedido entregado y todavía no reseñó el producto', async () => {
    const { svc, prisma } = svcCon();
    prisma.review.findUnique.mockResolvedValue(null); // todavía no reseñó este producto
    prisma.orderItem.findFirst.mockResolvedValue({ orderId: 'order-1' });
    const result = await svc.eligibleFor('biz-1', 'cust-1', 'prod-1');
    expect(result).toEqual({ eligible: true, orderId: 'order-1' });
  });

  // Una sola reseña por cliente y producto (ver @@unique([customerId,
  // productId]) en el schema): ya no importa si compró el producto en OTRO
  // pedido más — sigue sin ser elegible.
  it('eligibleFor() no elegible si ya reseñó este producto, aunque haya otro pedido entregado sin reseñar', async () => {
    const { svc, prisma } = svcCon();
    prisma.review.findUnique.mockResolvedValue({ id: 'rev-1' }); // ya reseñó este producto
    prisma.orderItem.findFirst.mockResolvedValue({ orderId: 'order-2' }); // otra compra del mismo producto
    const result = await svc.eligibleFor('biz-1', 'cust-1', 'prod-1');
    expect(result).toEqual({ eligible: false, orderId: null });
    // Ni hace falta ir a buscar pedidos si ya sabemos que no es elegible.
    expect(prisma.orderItem.findFirst).not.toHaveBeenCalled();
  });

  // Aviso configurable al dueño (resena_nueva, ver notifications.service.ts)
  // — hallazgo de la auditoría de mails: no había NINGÚN aviso de reseñas
  // nuevas. Sin rating en el modelo, avisa de CUALQUIER reseña nueva (no
  // solo negativas) — el dueño decide al leerla.
  it('create() avisa resena_nueva con el nombre público y el producto', async () => {
    const { svc, eventEmitter } = svcCon({ order: { id: 'order-1' }, orderItem: { id: 'item-1' }, conEventEmitter: true });
    await svc.create('biz-1', 'cust-1', { orderId: 'order-1', productId: 'prod-1', text: 'Buenísimo' } as any);
    expect(eventEmitter.emit).toHaveBeenCalledWith('notification.resena_nueva', {
      businessId: 'biz-1', customerName: 'María G.', productName: 'Remera azul', reviewId: 'rev-1',
    });
  });

  it('create() sin eventEmitter (specs viejos) no explota y no consulta el producto', async () => {
    const { svc, prisma } = svcCon({ order: { id: 'order-1' }, orderItem: { id: 'item-1' } });
    await svc.create('biz-1', 'cust-1', { orderId: 'order-1', productId: 'prod-1', text: 'Buenísimo' } as any);
    expect(prisma.product.findUnique).not.toHaveBeenCalled();
  });
});
