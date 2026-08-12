import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ReviewsService } from '../../src/reviews/reviews.service';

// Unit test de la regla clave de RBT-632: SOLO puede reseñar quien compró el
// producto y el pedido ya se entregó. Mockea Prisma — no toca la base.

function svcCon(overrides: { order?: any; orderItem?: any } = {}) {
  const prisma = {
    order: { findFirst: jest.fn().mockResolvedValue(overrides.order ?? null) },
    orderItem: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(overrides.orderItem ?? null),
    },
    review: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({
        id: 'rev-1', productId: 'prod-1', orderId: 'order-1', text: 'Buenísimo',
        status: 'VISIBLE', hiddenReason: null, isVerified: true, createdAt: new Date(),
        customer: { firstName: 'María', lastName: 'González' },
      }),
    },
  };
  const svc = new ReviewsService(prisma as any);
  return { svc, prisma };
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
    prisma.orderItem.findMany.mockResolvedValue([]);
    const result = await svc.eligibleFor('biz-1', 'cust-1', 'prod-1');
    expect(result).toEqual({ eligible: false, orderId: null });
  });

  it('eligibleFor() elegible cuando hay un pedido entregado sin reseñar todavía', async () => {
    const { svc, prisma } = svcCon();
    prisma.orderItem.findMany.mockResolvedValue([{ orderId: 'order-1', order: { createdAt: new Date() } }]);
    prisma.review.findMany.mockResolvedValue([]); // todavía no reseñó ese pedido
    const result = await svc.eligibleFor('biz-1', 'cust-1', 'prod-1');
    expect(result).toEqual({ eligible: true, orderId: 'order-1' });
  });

  it('eligibleFor() no elegible si ya reseñó el único pedido entregado', async () => {
    const { svc, prisma } = svcCon();
    prisma.orderItem.findMany.mockResolvedValue([{ orderId: 'order-1', order: { createdAt: new Date() } }]);
    prisma.review.findMany.mockResolvedValue([{ orderId: 'order-1' }]); // ya reseñado
    const result = await svc.eligibleFor('biz-1', 'cust-1', 'prod-1');
    expect(result).toEqual({ eligible: false, orderId: null });
  });
});
