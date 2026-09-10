import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CouponsService } from '../../src/coupons/coupons.service';
import { OrdersService } from '../../src/orders/orders.service';
import { DiscountsService } from '../../src/discounts/discounts.service';
import { UpsertCouponDto } from '../../src/coupons/dto/upsert-coupon.dto';

// Auditoría interna 2026-09-10, ítem `api.coupons`.
//
// - Un cupón de un solo uso se podía canjear dos veces con dos pedidos
//   simultáneos (la validación corría fuera de la transacción y el uso se
//   sumaba sin condición).
// - POST /coupons/link-email mandaba el HTML que le llegara, con el remitente
//   de Órbita, a cualquier dirección.
// - Códigos sensibles a mayúsculas, fechas en medianoche UTC, linkRedirect
//   sin validar.

const BIZ = 'biz-1';

describe('Canje de cupones dentro del pedido', () => {
  function canje(opts: { consumido?: number; tope?: number | null; usados?: number } = {}) {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(opts.consumido ?? 1),
      discount: { findUnique: jest.fn().mockResolvedValue({ maxUsesPerCustomer: opts.tope ?? null }) },
      discountRedemption: { count: jest.fn().mockResolvedValue(opts.usados ?? 0), create: jest.fn().mockResolvedValue({}) },
    };
    const svc = new OrdersService({} as any, {} as any, {} as any, { emit: jest.fn() } as any);
    const correr = (customerId: string | null = 'c-1') =>
      (svc as any).canjearDescuentos(tx, { businessId: BIZ, orderId: 'o-1', customerId, channel: 'STOREFRONT' }, [{ discountId: 'd-1', amount: 100 }]);
    return { tx, correr };
  }

  it('el uso se consume condicionado al tope, en la misma sentencia', async () => {
    const { tx, correr } = canje();
    await correr();
    const sql = (tx.$executeRaw.mock.calls[0][0] as string[]).join('?');
    expect(sql).toMatch(/uses_consumed = uses_consumed \+ 1/);
    expect(sql).toMatch(/max_uses_total IS NULL OR uses_consumed < max_uses_total/);
    expect(tx.discountRedemption.create).toHaveBeenCalledWith({ data: expect.objectContaining({ orderId: 'o-1', discountId: 'd-1' }) });
  });

  it('si otro pedido se llevó el último uso, este se revierte entero (no crea la redención)', async () => {
    const { tx, correr } = canje({ consumido: 0 });
    await expect(correr()).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(tx.discountRedemption.create).not.toHaveBeenCalled();
  });

  it('el tope por cliente se cuenta después de bloquear la fila', async () => {
    const { tx, correr } = canje({ tope: 1, usados: 1 });
    await expect(correr()).rejects.toThrow(/máximo de veces/);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.discountRedemption.count.mock.invocationCallOrder[0]);
  });

  it('una compra anónima no cuenta tope por cliente', async () => {
    const { tx, correr } = canje({ tope: 1, usados: 5 });
    await correr(null);
    expect(tx.discountRedemption.count).not.toHaveBeenCalled();
    expect(tx.discountRedemption.create).toHaveBeenCalled();
  });
});

describe('Códigos sin distinguir mayúsculas', () => {
  it('el cupón se busca sin distinguir mayúsculas al validar', async () => {
    const prisma = { discount: { findFirst: jest.fn().mockResolvedValue(null) } };
    const svc = new DiscountsService(prisma as any, {} as any, {} as any);
    await (svc as any).resolverCuponElegible(BIZ, ' promo10 ', undefined);
    expect(prisma.discount.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ businessId: BIZ, code: { equals: 'promo10', mode: 'insensitive' } }),
    }));
  });

  it('al crear se guarda en mayúsculas, con días de Argentina, y el duplicado se busca sin distinguir mayúsculas', async () => {
    const tx = { discount: { create: jest.fn().mockResolvedValue({ id: 'n-1' }) }, discountProduct: { createMany: jest.fn() }, discountCategory: { createMany: jest.fn() } };
    const prisma = {
      discount: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb(tx)),
    };
    const svc = new CouponsService(prisma as any, {} as any);
    jest.spyOn(svc, 'findOne').mockResolvedValue({} as any);
    await svc.create(BIZ, 'm-1', { code: ' promo10 ', name: 'Promo', type: 'PERCENT_TICKET', value: 10, scope: 'TICKET', startDate: '2026-09-10', endDate: '2026-09-12' });
    expect(prisma.discount.findFirst).toHaveBeenCalledWith({ where: { businessId: BIZ, code: { equals: 'PROMO10', mode: 'insensitive' } } });
    const data = tx.discount.create.mock.calls[0][0].data;
    expect(data.code).toBe('PROMO10');
    expect(data.endDate.toISOString()).toBe('2026-09-13T02:59:59.999Z');
  });
});

describe('Mail con el link del cupón', () => {
  function mailCupon(cupon: unknown) {
    const prisma = {
      discount: { findFirst: jest.fn().mockResolvedValue(cupon) },
      business: { findUnique: jest.fn().mockResolvedValue({ name: 'La Tienda', subdomain: 'tienda' }) },
    };
    const mail = { sendCustomEmail: jest.fn().mockResolvedValue(true) };
    return { svc: new CouponsService(prisma as any, mail as any), prisma, mail };
  }

  it('lo arma el servidor a partir del cupón del negocio, con lo tipeado escapado', async () => {
    const { svc, prisma, mail } = mailCupon({ code: 'PROMO10', type: 'PERCENT_TICKET', value: 10, scope: 'TICKET' });
    await svc.sendLinkEmail(BIZ, { couponId: 'c-1', to: 'ana@x.com', nombreDestino: '<img src=x onerror=alert(1)>' });
    expect(prisma.discount.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'c-1', businessId: BIZ }) }));
    const [to, subject, html] = mail.sendCustomEmail.mock.calls[0];
    expect(to).toBe('ana@x.com');
    expect(subject).toBe('¡Tenés un cupón exclusivo en La Tienda!');
    expect(html).toContain('https://tienda.orbita.site/descuentos/PROMO10');
    expect(html).toContain('10% de descuento en tu compra');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('un cupón de otro negocio (o inexistente) da 404 y no sale nada', async () => {
    const { svc, mail } = mailCupon(null);
    await expect(svc.sendLinkEmail(BIZ, { couponId: 'ajeno', to: 'ana@x.com' })).rejects.toBeInstanceOf(NotFoundException);
    expect(mail.sendCustomEmail).not.toHaveBeenCalled();
  });
});

describe('DTO del cupón', () => {
  const base = { code: 'PROMO10', name: 'Promo', type: 'PERCENT_TICKET', value: 10, scope: 'TICKET', startDate: '2026-09-10' };
  const errores = async (body: object) => (await validate(plainToInstance(UpsertCouponDto, { ...base, ...body }))).map((e) => e.property);

  it.each([
    ['una URL completa', 'https://otro-sitio.com'],
    ['una URL sin protocolo', '//otro-sitio.com'],
  ])('linkRedirect no acepta %s', async (_c, linkRedirect) => {
    expect(await errores({ linkRedirect })).toContain('linkRedirect');
  });

  it('linkRedirect acepta una ruta de la tienda', async () => {
    expect(await errores({ linkRedirect: '/categorias/52417efd-67af-46eb-99fa-075de4aa9538' })).toEqual([]);
  });

  it('el código solo lleva letras, números, guion y guion bajo', async () => {
    expect(await errores({ code: 'PROMO 10' })).toContain('code');
    expect(await errores({ code: ' promo-10_a ' })).toEqual([]);
  });

  it('las fechas tienen que ser fechas', async () => {
    expect(await errores({ startDate: 'hoy' })).toContain('startDate');
  });
});
