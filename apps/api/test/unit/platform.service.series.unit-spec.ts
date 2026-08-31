import { NotFoundException } from '@nestjs/common';
import { PlatformService } from '../../src/platform/platform.service';

// Unit test de las series diarias del dashboard de super admin (growthSeries,
// revenueSeries, businessSeries) y de las lecturas de catálogo/reseñas por
// negocio (businessProducts, businessReviews). Prisma mockeado a mano, mismo
// patrón que el resto de la suite de platform.service.

function makePrisma() {
  return {
    business: { findMany: jest.fn(), findUnique: jest.fn() },
    subscription: { findMany: jest.fn() },
    subscriptionPayment: { findMany: jest.fn() },
    order: { findMany: jest.fn() },
    customer: { findMany: jest.fn() },
    product: { findMany: jest.fn() },
    review: { findMany: jest.fn() },
    $transaction: jest.fn((arr: Promise<unknown>[]) => Promise.all(arr)),
  };
}

const dAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const todayKey = () => new Date().toISOString().slice(0, 10);

describe('PlatformService — series del dashboard (unit)', () => {
  describe('growthSeries', () => {
    it('bucketiza negocios y suscripciones pagas por día, con 30 días de default', async () => {
      const prisma = makePrisma();
      prisma.business.findMany.mockResolvedValue([{ createdAt: dAgo(0) }, { createdAt: dAgo(0) }]);
      prisma.subscription.findMany.mockResolvedValue([{ createdAt: dAgo(0) }]);
      const svc = new PlatformService(prisma as any, {} as any, {} as any);

      const res = await svc.growthSeries({});

      expect(res.series).toHaveLength(30);
      const hoy = res.series.find((s) => s.date === todayKey())!;
      expect(hoy.businesses).toBe(2);
      expect(hoy.subscriptions).toBe(1);
      // El resto de los días del rango quedan en cero, no ausentes.
      expect(res.series.every((s) => typeof s.businesses === 'number')).toBe(true);
    });

    it('solo cuenta suscripciones origin=PAID (filtro va en el where, no en el bucket)', async () => {
      const prisma = makePrisma();
      prisma.business.findMany.mockResolvedValue([]);
      prisma.subscription.findMany.mockResolvedValue([]);
      const svc = new PlatformService(prisma as any, {} as any, {} as any);

      await svc.growthSeries({ days: 7 });

      expect(prisma.subscription.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ origin: 'PAID' }),
      }));
    });

    it('respeta el parámetro days (7)', async () => {
      const prisma = makePrisma();
      prisma.business.findMany.mockResolvedValue([]);
      prisma.subscription.findMany.mockResolvedValue([]);
      const svc = new PlatformService(prisma as any, {} as any, {} as any);

      const res = await svc.growthSeries({ days: 7 });

      expect(res.series).toHaveLength(7);
    });
  });

  describe('revenueSeries', () => {
    it('suma pagos aprobados por día de paidAt', async () => {
      const prisma = makePrisma();
      prisma.subscriptionPayment.findMany.mockResolvedValue([
        { amount: { toString: () => '5000' } as any, paidAt: dAgo(0) },
        { amount: { toString: () => '3000' } as any, paidAt: dAgo(0) },
      ]);
      const svc = new PlatformService(prisma as any, {} as any, {} as any);

      const res = await svc.revenueSeries({ days: 7 });

      const hoy = res.series.find((s) => s.date === todayKey())!;
      expect(hoy.amount).toBe(8000);
      expect(prisma.subscriptionPayment.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: 'APPROVED' }),
      }));
    });

    it('ignora pagos sin paidAt (no debería llegar así, pero no debe romper)', async () => {
      const prisma = makePrisma();
      prisma.subscriptionPayment.findMany.mockResolvedValue([{ amount: { toString: () => '100' } as any, paidAt: null }]);
      const svc = new PlatformService(prisma as any, {} as any, {} as any);

      const res = await svc.revenueSeries({ days: 7 });

      expect(res.series.every((s) => s.amount === 0)).toBe(true);
    });
  });

  describe('businessSeries', () => {
    it('tira 404 si el negocio no existe', async () => {
      const prisma = makePrisma();
      prisma.business.findUnique.mockResolvedValue(null);
      const svc = new PlatformService(prisma as any, {} as any, {} as any);

      await expect(svc.businessSeries('nope', {})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('bucketiza pedidos (cantidad + ventas) y clientes nuevos por día', async () => {
      const prisma = makePrisma();
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1' });
      prisma.order.findMany.mockResolvedValue([
        { createdAt: dAgo(0), total: { toString: () => '1000' } as any },
        { createdAt: dAgo(0), total: { toString: () => '500' } as any },
      ]);
      prisma.customer.findMany.mockResolvedValue([{ createdAt: dAgo(0) }]);
      const svc = new PlatformService(prisma as any, {} as any, {} as any);

      const res = await svc.businessSeries('biz1', { days: 7 });

      const hoy = res.series.find((s) => s.date === todayKey())!;
      expect(hoy).toEqual({ date: todayKey(), orders: 2, sales: 1500, newCustomers: 1 });
      expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ businessId: 'biz1', status: { not: 'CANCELLED' }, deletedAt: null }),
      }));
    });
  });

  describe('businessProducts', () => {
    it('tira 404 si el negocio no existe', async () => {
      const prisma = makePrisma();
      prisma.business.findUnique.mockResolvedValue(null);
      const svc = new PlatformService(prisma as any, {} as any, {} as any);

      await expect(svc.businessProducts('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('suma el stock de todas las variantes y sucursales de cada producto', async () => {
      const prisma = makePrisma();
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1' });
      prisma.product.findMany.mockResolvedValue([
        {
          id: 'p1', name: 'Remera', status: 'PUBLISHED', basePrice: { toString: () => '9999' } as any,
          category: { name: 'Remeras' },
          variants: [
            { stock: [{ quantity: 3 }, { quantity: 2 }] },
            { stock: [{ quantity: 5 }] },
          ],
        },
      ]);
      const svc = new PlatformService(prisma as any, {} as any, {} as any);

      const res = await svc.businessProducts('biz1');

      expect(res.data).toEqual([{
        id: 'p1', name: 'Remera', categoryName: 'Remeras', status: 'PUBLISHED', basePrice: 9999, totalStock: 10,
      }]);
    });
  });

  describe('businessReviews', () => {
    it('tira 404 si el negocio no existe', async () => {
      const prisma = makePrisma();
      prisma.business.findUnique.mockResolvedValue(null);
      const svc = new PlatformService(prisma as any, {} as any, {} as any);

      await expect(svc.businessReviews('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('trunca el apellido del cliente a la inicial (mismo criterio que el storefront público)', async () => {
      const prisma = makePrisma();
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1' });
      prisma.review.findMany.mockResolvedValue([{
        id: 'r1', text: 'Excelente producto', status: 'VISIBLE', isVerified: true, createdAt: dAgo(0),
        product: { name: 'Remera' },
        customer: { firstName: 'María', lastName: 'González' },
      }]);
      const svc = new PlatformService(prisma as any, {} as any, {} as any);

      const res = await svc.businessReviews('biz1');

      expect(res.data[0].customerName).toBe('María G.');
      expect(res.data[0].productName).toBe('Remera');
    });

    it('cliente sin apellido no deja un punto colgado', async () => {
      const prisma = makePrisma();
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1' });
      prisma.review.findMany.mockResolvedValue([{
        id: 'r1', text: 'Bien', status: 'VISIBLE', isVerified: true, createdAt: dAgo(0),
        product: { name: 'Remera' },
        customer: { firstName: 'María', lastName: null },
      }]);
      const svc = new PlatformService(prisma as any, {} as any, {} as any);

      const res = await svc.businessReviews('biz1');

      expect(res.data[0].customerName).toBe('María');
    });
  });
});
