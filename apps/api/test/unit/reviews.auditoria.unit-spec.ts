import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReviewsService } from '../../src/reviews/reviews.service';
import { CreateReviewDto } from '../../src/reviews/dto/create-review.dto';
import { HideReviewDto } from '../../src/reviews/dto/hide-review.dto';

// Auditoría interna 2026-09-10, ítem `api.reviews`.
//
// - El texto de la reseña no tenía tope ni exigía contenido (se podía dejar
//   una reseña vacía o de megas).
// - El motivo de ocultar tampoco.
// - El listado público devolvía todas las reseñas de un producto, sin tope.

const BIZ = 'biz-1';
const UUID = '8b1f0f1e-3b8a-4f7e-9d6e-1f2a3b4c5d6e';

describe('DTOs de reseñas', () => {
  const errores = async (cls: any, body: object) => (await validate(plainToInstance(cls, body))).map((e) => e.property);

  it('el texto se recorta, es obligatorio y tiene tope', async () => {
    const base = { productId: UUID, orderId: UUID };
    expect(await errores(CreateReviewDto, { ...base, text: '   ' })).toContain('text');
    expect(await errores(CreateReviewDto, { ...base, text: 'x'.repeat(2001) })).toContain('text');
    const ok = plainToInstance(CreateReviewDto, { ...base, text: '  Muy bueno  ' });
    expect(await validate(ok)).toEqual([]);
    expect(ok.text).toBe('Muy bueno');
  });

  it('el motivo de ocultar es obligatorio y tiene tope', async () => {
    expect(await errores(HideReviewDto, { hiddenReason: '' })).toContain('hiddenReason');
    expect(await errores(HideReviewDto, { hiddenReason: 'x'.repeat(301) })).toContain('hiddenReason');
    expect(await errores(HideReviewDto, { hiddenReason: 'Lenguaje ofensivo' })).toEqual([]);
  });
});

describe('Reseñas', () => {
  it('el listado público trae solo las visibles, las más nuevas y con tope', async () => {
    const prisma = {
      product: { findFirst: jest.fn().mockResolvedValue({ id: 'p-1' }) },
      review: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const svc = new ReviewsService(prisma as any);
    await svc.listForProduct('p-1');
    expect(prisma.review.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { productId: 'p-1', status: 'VISIBLE' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }));
  });

  it('ocultar solo toca reseñas del negocio', async () => {
    const prisma = { review: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    const svc = new ReviewsService(prisma as any);
    await expect(svc.hide(BIZ, 'r-ajena', { hiddenReason: 'spam' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.review.updateMany).toHaveBeenCalledWith({ where: { id: 'r-ajena', businessId: BIZ }, data: { status: 'HIDDEN', hiddenReason: 'spam' } });
  });

  it('solo reseña quien tiene el pedido entregado, con ese producto', async () => {
    const prisma = { order: { findFirst: jest.fn().mockResolvedValue(null) } };
    const svc = new ReviewsService(prisma as any);
    await expect(svc.create(BIZ, 'c-1', { productId: UUID, orderId: UUID, text: 'hola' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: UUID, businessId: BIZ, customerId: 'c-1', status: { in: ['DELIVERED', 'COMPLETED'] } }),
    }));
  });
});
