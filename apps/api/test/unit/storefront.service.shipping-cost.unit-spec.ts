import { StorefrontService } from '../../src/storefront/storefront.service';

// Unit test del cálculo de costo de envío (RBT-669 + pedido de segmentación
// de Envíos, 2026-08-22): antes `shippingBase`/`freeShippingFrom` existían en
// BusinessConfig pero nada los usaba de verdad en el checkout — el total
// nunca incluía envío. El costo es SIEMPRE por transportista (sin costo
// general de respaldo, sacado a pedido el 2026-08-23) — un transportista sin
// costo cargado no calcula envío. Mockea Prisma (solo `productVariant.
// findMany`, que es lo único que toca esta función) — no toca la base.

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
      freeShippingFrom: null, carrierShippingCosts: null,
    } as any);
    expect(r).toBeUndefined();
  });

  it('domicilio sin costo cargado para el transportista elegido → sin costo (no configuró nada para ESE)', async () => {
    const { svc } = svcCon();
    const r = await svc.resolveShippingCost('biz-1', true, 'CORREO_ARGENTINO', ITEMS, {
      freeShippingFrom: null, carrierShippingCosts: { OCA: 900 },
    } as any);
    expect(r).toBeUndefined();
  });

  it('domicilio con costo cargado para el transportista elegido → lo usa', async () => {
    const { svc } = svcCon();
    const r = await svc.resolveShippingCost('biz-1', true, 'OCA', ITEMS, {
      freeShippingFrom: null, carrierShippingCosts: { OCA: 900 },
    } as any);
    expect(r).toBe(900);
  });

  it('sin transportista elegido (retiro/no llegó carrier) → sin costo', async () => {
    const { svc } = svcCon();
    const r = await svc.resolveShippingCost('biz-1', true, undefined, ITEMS, {
      freeShippingFrom: null, carrierShippingCosts: { OCA: 900 },
    } as any);
    expect(r).toBeUndefined();
  });

  it('subtotal por debajo de "envío gratis desde" → cobra el costo del transportista', async () => {
    const { svc, prisma } = svcCon([{ id: 'v1', price: 1000 }]); // subtotal = 1000 * 2 = 2000
    const r = await svc.resolveShippingCost('biz-1', true, 'CORREO_ARGENTINO', ITEMS, {
      freeShippingFrom: { toString: () => '5000' } as any,
      carrierShippingCosts: { CORREO_ARGENTINO: 1500 },
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
      freeShippingFrom: { toString: () => '5000' } as any,
      carrierShippingCosts: { CORREO_ARGENTINO: 1500 },
    } as any);
    expect(r).toBe(0);
  });
});
