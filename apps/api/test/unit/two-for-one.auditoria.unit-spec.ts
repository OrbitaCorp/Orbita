import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TwoForOneService } from '../../src/two-for-one/two-for-one.service';
import { DiscountsService } from '../../src/discounts/discounts.service';
import { UpsertTwoForOneDto } from '../../src/two-for-one/dto/upsert-two-for-one.dto';

// Auditoría interna 2026-09-10, ítem `api.two-for-one`.
//
// - El estado de la promo estaba duplicado (two_for_one_promos.isActive y el
//   descuento): prenderla, apagarla o borrarla desde Descuentos dejaba al
//   panel de 2x1 mostrando otra cosa que la que aplicaba el motor.
// - /discounts aceptaba crear un BUY_X_PAY_Y sin el paquete Avanzado.

const BIZ = 'biz-1';
const promo = (discountActivo: boolean, promoActiva = true) => ({
  id: 'p-1', businessId: BIZ, discountId: 'd-1', isActive: promoActiva,
  discount: { isActive: discountActivo, minQuantity: 2, value: 1, scope: 'PRODUCT', products: [{ productId: 'x' }], categories: [] },
});

describe('Estado de la promo', () => {
  it('el listado muestra el estado del descuento y no lista promos con el descuento borrado', async () => {
    const prisma = { twoForOnePromo: { findMany: jest.fn().mockResolvedValue([promo(false, true)]) } };
    const svc = new TwoForOneService(prisma as any);
    const [p] = await svc.list(BIZ);
    expect(p.isActive).toBe(false);
    expect(prisma.twoForOnePromo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: BIZ, discount: { deletedAt: null } } }));
  });

  it('toggle da vuelta el estado del descuento (el que mira el motor)', async () => {
    const tx = {
      discount: { update: jest.fn() },
      twoForOnePromo: { update: jest.fn().mockResolvedValue(promo(true)) },
    };
    const prisma = {
      twoForOnePromo: { findFirst: jest.fn().mockResolvedValue(promo(false, true)) },
      $transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb(tx)),
    };
    const svc = new TwoForOneService(prisma as any);
    await svc.toggle(BIZ, 'p-1');
    // La copia decía "activa", pero el descuento estaba apagado: se prende.
    expect(tx.discount.update).toHaveBeenCalledWith({ where: { id: 'd-1' }, data: { isActive: true } });
  });

  it('una promo cuyo descuento se borró desde Descuentos da 404', async () => {
    const prisma = { twoForOnePromo: { findFirst: jest.fn().mockResolvedValue(null) } };
    const svc = new TwoForOneService(prisma as any);
    await expect(svc.remove(BIZ, 'p-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.twoForOnePromo.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p-1', businessId: BIZ, discount: { deletedAt: null } } }));
  });
});

describe('2x1 creado desde Descuentos', () => {
  const dto = { name: '2x1', type: 'BUY_X_PAY_Y', value: 1, minQuantity: 2, scope: 'PRODUCT', productLevel: 'padre', startDate: '2026-09-10', productIds: ['8b1f0f1e-3b8a-4f7e-9d6e-1f2a3b4c5d6e'] };

  it('sin el paquete Avanzado: 403 y no se guarda nada', async () => {
    const prisma = { product: { count: jest.fn() }, discount: { findFirst: jest.fn() }, $transaction: jest.fn() };
    const svc = new DiscountsService(prisma as any, { validarAntesDeGuardar: jest.fn() } as any, { hasActiveAddon: jest.fn().mockResolvedValue(false) } as any);
    await expect(svc.create(BIZ, 'm-1', dto as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('con el paquete sigue adelante', async () => {
    const prisma = { product: { count: jest.fn().mockResolvedValue(1) }, discount: { findFirst: jest.fn().mockResolvedValue({ id: 'dup' }) } };
    const svc = new DiscountsService(prisma as any, { validarAntesDeGuardar: jest.fn() } as any, { hasActiveAddon: jest.fn().mockResolvedValue(true) } as any);
    // Corta en el chequeo de nombre duplicado: alcanza para ver que pasó el del paquete.
    await expect(svc.create(BIZ, 'm-1', dto as any)).rejects.toThrow(/Ya existe un descuento con ese nombre/);
  });
});

describe('DTO', () => {
  const errores = async (body: object) =>
    (await validate(plainToInstance(UpsertTwoForOneDto, { isActive: true, llevaCantidad: 2, pagaCantidad: 1, alcance: 'CATEGORY', categoryIds: [], ...body }))).map((e) => e.property);

  it('"llevá" y "pagá" tienen tope', async () => {
    expect(await errores({})).toEqual([]);
    expect(await errores({ llevaCantidad: 1_000_000 })).toContain('llevaCantidad');
    expect(await errores({ pagaCantidad: 1_000_000 })).toContain('pagaCantidad');
  });
});
