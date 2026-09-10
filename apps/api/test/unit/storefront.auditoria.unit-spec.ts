import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { StorefrontService } from '../../src/storefront/storefront.service';
import { StorefrontProductsQueryDto } from '../../src/storefront/dto/storefront-products-query.dto';
import { ValidateCartDto } from '../../src/storefront/dto/validate-cart.dto';

// Auditoría interna 2026-09-10, ítem `api.storefront`.
//
// El frontend esconde las tiendas nunca publicadas o pausadas, pero la API
// servía igual su catálogo (productos, precios, stock, categorías, cupones)
// a quien lo pidiera por el slug.

const UUID = '8b1f0f1e-3b8a-4f7e-9d6e-1f2a3b4c5d6e';

function tienda(estado: { isActive: boolean; isPaused: boolean }) {
  const prisma = {
    business: { findUnique: jest.fn().mockResolvedValue({ id: 'biz-1', name: 'T', subdomain: 't', mode: 'FULL', ...estado }) },
    storefrontConfig: { findUnique: jest.fn().mockResolvedValue(null) },
    businessConfig: { findUnique: jest.fn().mockResolvedValue(null) },
    branch: { findFirst: jest.fn().mockResolvedValue(null) },
    category: { findMany: jest.fn().mockResolvedValue([]) },
    discount: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { svc: new StorefrontService(prisma as any, {} as any, {} as any), prisma };
}

describe('Catálogo de una tienda no publicada o pausada', () => {
  it.each([
    ['nunca publicada', { isActive: false, isPaused: false }],
    ['pausada o suspendida', { isActive: true, isPaused: true }],
  ])('%s: productos, detalle, categorías, cupones, links y carrito dan 404', async (_c, estado) => {
    const { svc, prisma } = tienda(estado);
    await expect(svc.listProducts('t', {})).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.getProduct('t', UUID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.listCategories('t')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.listCoupons('t')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.exclusiveDiscount('t', 'PROMO')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.discountLanding('t', UUID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.validateCart('t', [{ variantId: UUID, quantity: 1 }])).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.category.findMany).not.toHaveBeenCalled();
  });

  it('la config sigue respondiendo (el frontend la usa para mostrar "tienda pausada")', async () => {
    const { svc } = tienda({ isActive: true, isPaused: true });
    const cfg = await svc.getConfig('t');
    expect(cfg.business).toMatchObject({ isActive: true, isPaused: true });
  });

  it('una tienda publicada y en línea sirve su catálogo', async () => {
    const { svc, prisma } = tienda({ isActive: true, isPaused: false });
    await expect(svc.listCategories('t')).resolves.toEqual([]);
    expect(prisma.category.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'biz-1', isActive: true } }));
  });

  it('el resto de los negocios que resuelven por slug (seguimiento, arrepentimiento) no pasan por el filtro', async () => {
    const { svc } = tienda({ isActive: true, isPaused: true });
    await expect(svc.resolveBusinessId('t')).resolves.toBe('biz-1');
  });
});

describe('DTOs públicos', () => {
  const errores = async (cls: any, body: object) => (await validate(plainToInstance(cls, body))).map((e) => e.property);

  it('la búsqueda y el código de descuento tienen tope', async () => {
    expect(await errores(StorefrontProductsQueryDto, { search: 'x'.repeat(101) })).toContain('search');
    expect(await errores(StorefrontProductsQueryDto, { discountCode: 'x'.repeat(65) })).toContain('discountCode');
    expect(await errores(StorefrontProductsQueryDto, { search: 'remera' })).toEqual([]);
  });

  it('el carrito tiene los mismos topes que el checkout', async () => {
    expect(await errores(ValidateCartDto, { items: [{ variantId: UUID, quantity: 1_000_000 }] })).toContain('items');
    expect(await errores(ValidateCartDto, { items: Array.from({ length: 101 }, () => ({ variantId: UUID, quantity: 1 })) })).toContain('items');
    expect(await errores(ValidateCartDto, { items: [{ variantId: UUID, quantity: 2 }], couponCode: 'x'.repeat(65) })).toContain('couponCode');
  });
});
