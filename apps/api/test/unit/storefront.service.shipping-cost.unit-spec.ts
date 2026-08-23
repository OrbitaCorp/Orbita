import { StorefrontService } from '../../src/storefront/storefront.service';

// Unit test del cálculo de costo de envío (RBT-669 + pedido de segmentación
// de Envíos, 2026-08-22): antes `shippingBase`/`freeShippingFrom` existían en
// BusinessConfig pero nada los usaba de verdad en el checkout — el total
// nunca incluía envío. Mockea Prisma (solo `productVariant.findMany`, que es
// lo único que toca esta función) — no toca la base.

function svcCon(variantes: { id: string; price: number }[] = []) {
  const prisma = {
    productVariant: {
      findMany: jest.fn().mockResolvedValue(variantes.map((v) => ({ id: v.id, price: v.price }))),
    },
  };
  const svc = new StorefrontService(prisma as any, {} as any, {} as any);
  return { svc, prisma };
}

const ITEMS = [{ variantId: 'v1', quantity: 2 }]; // 2 unidades

describe('StorefrontService.resolveShippingCost (unit)', () => {
  it('retiro en local (no domicilio) → sin costo de envío', async () => {
    const { svc } = svcCon();
    const r = await svc.resolveShippingCost('biz-1', false, 'CORREO_ARGENTINO', ITEMS, {
      shippingBase: null, freeShippingFrom: null, carrierShippingCosts: null,
    } as any);
    expect(r).toBeUndefined();
  });

  it('domicilio sin shippingBase ni costo por transportista → sin costo (el negocio no configuró nada)', async () => {
    const { svc } = svcCon();
    const r = await svc.resolveShippingCost('biz-1', true, 'CORREO_ARGENTINO', ITEMS, {
      shippingBase: null, freeShippingFrom: null, carrierShippingCosts: null,
    } as any);
    expect(r).toBeUndefined();
  });

  it('domicilio con shippingBase general, sin costo por transportista → usa el general', async () => {
    const { svc } = svcCon();
    const r = await svc.resolveShippingCost('biz-1', true, 'CORREO_ARGENTINO', ITEMS, {
      shippingBase: { toString: () => '1500' } as any, freeShippingFrom: null, carrierShippingCosts: null,
    } as any);
    expect(r).toBe(1500);
  });

  it('costo específico del transportista elegido pisa el general', async () => {
    const { svc } = svcCon();
    const r = await svc.resolveShippingCost('biz-1', true, 'OCA', ITEMS, {
      shippingBase: { toString: () => '1500' } as any, freeShippingFrom: null,
      carrierShippingCosts: { OCA: 900 },
    } as any);
    expect(r).toBe(900);
  });

  it('otro transportista sin costo propio sigue usando el general aunque haya overrides para otros', async () => {
    const { svc } = svcCon();
    const r = await svc.resolveShippingCost('biz-1', true, 'ANDREANI', ITEMS, {
      shippingBase: { toString: () => '1500' } as any, freeShippingFrom: null,
      carrierShippingCosts: { OCA: 900 },
    } as any);
    expect(r).toBe(1500);
  });

  it('subtotal por debajo de "envío gratis desde" → cobra el costo base', async () => {
    const { svc, prisma } = svcCon([{ id: 'v1', price: 1000 }]); // subtotal = 1000 * 2 = 2000
    const r = await svc.resolveShippingCost('biz-1', true, 'CORREO_ARGENTINO', ITEMS, {
      shippingBase: { toString: () => '1500' } as any, freeShippingFrom: { toString: () => '5000' } as any,
      carrierShippingCosts: null,
    } as any);
    expect(r).toBe(1500);
    expect(prisma.productVariant.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['v1'] } },
      select: { id: true, price: true },
    });
  });

  it('subtotal igual o por encima de "envío gratis desde" → envío $0', async () => {
    const { svc } = svcCon([{ id: 'v1', price: 3000 }]); // subtotal = 3000 * 2 = 6000
    const r = await svc.resolveShippingCost('biz-1', true, 'CORREO_ARGENTINO', ITEMS, {
      shippingBase: { toString: () => '1500' } as any, freeShippingFrom: { toString: () => '5000' } as any,
      carrierShippingCosts: null,
    } as any);
    expect(r).toBe(0);
  });

  it('"envío gratis desde" también aplica al costo específico del transportista', async () => {
    const { svc } = svcCon([{ id: 'v1', price: 3000 }]); // subtotal = 6000
    const r = await svc.resolveShippingCost('biz-1', true, 'OCA', ITEMS, {
      shippingBase: { toString: () => '1500' } as any, freeShippingFrom: { toString: () => '5000' } as any,
      carrierShippingCosts: { OCA: 900 },
    } as any);
    expect(r).toBe(0);
  });
});
