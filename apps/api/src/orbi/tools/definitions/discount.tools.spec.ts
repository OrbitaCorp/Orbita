import { BadRequestException } from '@nestjs/common';
import { CreateDiscountTool, CreateCouponTool } from './discount.tools';
import { ToolRegistryService } from '../tool-registry.service';
import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { ToolExecutionContext } from '../tool.interface';

const ctx: ToolExecutionContext = {
  businessId: 'biz-1',
  userId: 'user-1',
  surface: OrbiSurface.PANEL,
  permissions: ['discounts.manage'],
};

const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';
const P3 = '33333333-3333-4333-8333-333333333333';
const LARGO = `Primera línea\nsegunda "línea" ${'z'.repeat(150)}`;

function registryCon(...tools: any[]) {
  const r = new ToolRegistryService();
  for (const t of tools) r.register(t);
  return r;
}

describe('CreateDiscountTool — la tarjeta muestra cada valor', () => {
  const tool = new CreateDiscountTool({} as any);

  it('nombre, valor, tipo, alcance, cantidad de productos y fechas', async () => {
    const r = await tool.describirAccion({
      name: 'Promo Invierno', type: 'PERCENT_PRODUCT', value: 15, scope: 'PRODUCT',
      productIds: [P1, P2, P3], startDate: '2026-10-01', endDate: '2026-10-31',
    });
    expect(r).toContain('"Promo Invierno"');
    expect(r).toContain('15%');
    expect(r).toContain('3 productos');
    expect(r).toContain('2026-10-01');
    expect(r).toContain('2026-10-31');
  });

  it('distingue descuento por producto de descuento sobre el total', async () => {
    const base = { name: 'X', value: 10, scope: 'TICKET' };
    const porProducto = await tool.describirAccion({ ...base, type: 'PERCENT_PRODUCT' });
    const sobreTotal = await tool.describirAccion({ ...base, type: 'PERCENT_TICKET' });
    expect(porProducto).not.toBe(sobreTotal);
  });

  it('por categorías cuenta las categorías, y sin fechas dice desde ahora y sin fin', async () => {
    const r = await tool.describirAccion({
      name: 'X', type: 'AMOUNT_PRODUCT', value: 500, scope: 'CATEGORY', categoryIds: [P1, P2],
    });
    expect(r).toContain('$500');
    expect(r).toContain('2 categorías');
    expect(r).toContain('desde ahora');
    expect(r).toContain('sin fecha de fin');
  });

  it('el nombre sale entre comillas, sin saltos de línea y truncado a 80', async () => {
    const r = await tool.describirAccion({ name: LARGO, type: 'PERCENT_TICKET', value: 10, scope: 'TICKET' });
    expect(r).not.toMatch(/[\r\n]/);
    const citado = r.match(/"([^"]*)"/)?.[1] ?? '';
    expect(citado.startsWith('Primera línea segunda')).toBe(true);
    expect(Array.from(citado).length).toBeLessThanOrEqual(80);
  });
});

describe('CreateCouponTool — la tarjeta muestra cada valor', () => {
  const tool = new CreateCouponTool({} as any);

  it('código, nombre, valor, alcance, cantidad de productos y fechas', async () => {
    const r = await tool.describirAccion({
      code: 'VERANO20', name: 'Cupón de verano', type: 'PERCENT_PRODUCT', value: 20, scope: 'PRODUCT',
      productIds: [P1, P2], startDate: '2026-12-01', endDate: '2027-02-28',
    });
    expect(r).toContain('"VERANO20"');
    expect(r).toContain('"Cupón de verano"');
    expect(r).toContain('20%');
    expect(r).toContain('2 productos');
    expect(r).toContain('2026-12-01');
    expect(r).toContain('2027-02-28');
  });
});

describe('createDiscount y createCoupon — validan con el DTO de su endpoint', () => {
  const pasa = { validarAlta: jest.fn().mockResolvedValue(undefined) };
  const registry = registryCon(new CreateDiscountTool(pasa as any), new CreateCouponTool(pasa as any));
  const descuento = { name: 'Promo', type: 'PERCENT_PRODUCT', value: 10, scope: 'PRODUCT', productIds: [P1] };
  const cupon = { ...descuento, code: 'VERANO20' };

  it('con argumentos válidos se propone', async () => {
    expect(await registry.proponer('createDiscount', descuento, ctx)).toEqual({ resumen: expect.any(String) });
    expect(await registry.proponer('createCoupon', cupon, ctx)).toEqual({ resumen: expect.any(String) });
  });

  it('nombre de más de 120 caracteres: error, sin tarjeta', async () => {
    const nombre = 'n'.repeat(121);
    expect(await registry.proponer('createDiscount', { ...descuento, name: nombre }, ctx)).toEqual({ error: expect.any(String) });
    expect(await registry.proponer('createCoupon', { ...cupon, name: nombre }, ctx)).toEqual({ error: expect.any(String) });
  });

  it('productIds que no son UUID: error', async () => {
    expect(await registry.proponer('createDiscount', { ...descuento, productIds: ['remera-negra'] }, ctx)).toEqual({ error: expect.any(String) });
    expect(await registry.proponer('createCoupon', { ...cupon, productIds: ['remera-negra'] }, ctx)).toEqual({ error: expect.any(String) });
  });

  it('código de cupón con caracteres inválidos o de más de 40: error', async () => {
    expect(await registry.proponer('createCoupon', { ...cupon, code: 'VERANO 20!' }, ctx)).toEqual({ error: expect.any(String) });
    expect(await registry.proponer('createCoupon', { ...cupon, code: 'A'.repeat(41) }, ctx)).toEqual({ error: expect.any(String) });
  });

  it('fecha que no es fecha: error', async () => {
    expect(await registry.proponer('createDiscount', { ...descuento, startDate: 'mañana' }, ctx)).toEqual({ error: expect.any(String) });
  });

  it('un parámetro que la tool no declara: error', async () => {
    expect(await registry.proponer('createCoupon', { ...cupon, maxUsesTotal: 1 }, ctx)).toEqual({ error: expect.stringContaining('maxUsesTotal') });
  });
});


describe('createDiscount y createCoupon — lo que iba a fallar al confirmar se rechaza ANTES de la tarjeta', () => {
  const nuevoRegistro = () => {
    const discounts = { validarAlta: jest.fn().mockResolvedValue(undefined), create: jest.fn().mockResolvedValue({ id: 'd1', name: 'Promo' }) };
    const coupons = { validarAlta: jest.fn().mockResolvedValue(undefined), create: jest.fn().mockResolvedValue({ id: 'c1', code: 'VERANO20', name: 'Promo' }) };
    const registry = registryCon(new CreateDiscountTool(discounts as any), new CreateCouponTool(coupons as any));
    return { discounts, coupons, registry };
  };
  const porProducto = { name: 'Promo', type: 'PERCENT_PRODUCT', value: 10, scope: 'PRODUCT', productIds: [P1, P2] };
  const porCategoria = { name: 'Promo', type: 'PERCENT_PRODUCT', value: 10, scope: 'CATEGORY', categoryIds: [P3] };

  it('por producto: el service valida con productLevel "padre" y el negocio de la sesión (antes fallaba al confirmar)', async () => {
    const { discounts, coupons, registry } = nuevoRegistro();
    expect(await registry.proponer('createDiscount', porProducto, ctx)).toEqual({ resumen: expect.any(String) });
    expect(discounts.validarAlta).toHaveBeenCalledWith('biz-1', expect.objectContaining({ scope: 'PRODUCT', productIds: [P1, P2], productLevel: 'padre' }));
    expect(await registry.proponer('createCoupon', { ...porProducto, code: 'VERANO20' }, ctx)).toEqual({ resumen: expect.any(String) });
    expect(coupons.validarAlta).toHaveBeenCalledWith('biz-1', expect.objectContaining({ code: 'VERANO20', productLevel: 'padre' }));
  });

  it('lo que se escribe al confirmar lleva el mismo productLevel que se validó', async () => {
    const { discounts } = nuevoRegistro();
    await new CreateDiscountTool(discounts as any).execute(porProducto, ctx);
    expect(discounts.create).toHaveBeenCalledWith('biz-1', 'user-1', expect.objectContaining({ productLevel: 'padre' }));
  });

  it('por categoría o sobre el total: sin productLevel', async () => {
    const { discounts, registry } = nuevoRegistro();
    await registry.proponer('createDiscount', porCategoria, ctx);
    await registry.proponer('createDiscount', { name: 'T', type: 'PERCENT_TICKET', value: 10, scope: 'TICKET' }, ctx);
    for (const [, dto] of discounts.validarAlta.mock.calls) expect(dto.productLevel).toBeUndefined();
  });

  it('el service rechaza (ids de otro negocio, nombre tomado, 100 %): error con su mensaje y sin tarjeta', async () => {
    const { discounts, coupons, registry } = nuevoRegistro();
    discounts.validarAlta.mockRejectedValueOnce(new BadRequestException('Alguna de las categorías elegidas no existe en tu negocio.'));
    expect(await registry.proponer('createDiscount', porCategoria, ctx)).toEqual({ error: 'Alguna de las categorías elegidas no existe en tu negocio.' });
    coupons.validarAlta.mockRejectedValueOnce(new BadRequestException('Ya existe un cupón con ese código.'));
    expect(await registry.proponer('createCoupon', { ...porProducto, code: 'VERANO20' }, ctx)).toEqual({ error: 'Ya existe un cupón con ese código.' });
  });

  it('scope PRODUCT con categoryIds (o CATEGORY con productIds): error sin preguntarle al service', async () => {
    const { discounts, registry } = nuevoRegistro();
    expect(await registry.proponer('createDiscount', { ...porCategoria, scope: 'PRODUCT' }, ctx)).toEqual({ error: expect.stringContaining('scope PRODUCT') });
    expect(await registry.proponer('createDiscount', { ...porProducto, categoryIds: [P3] }, ctx)).toEqual({ error: expect.stringContaining('scope PRODUCT') });
    expect(await registry.proponer('createDiscount', { ...porProducto, scope: 'CATEGORY' }, ctx)).toEqual({ error: expect.stringContaining('scope CATEGORY') });
    expect(discounts.validarAlta).not.toHaveBeenCalled();
  });

  it('la base no responde: "no pude preparar esa acción", sin tarjeta y sin tumbar el chat', async () => {
    const { discounts, registry } = nuevoRegistro();
    discounts.validarAlta.mockRejectedValueOnce(new Error('connection refused'));
    expect(await registry.proponer('createDiscount', porProducto, ctx)).toEqual({ error: expect.stringContaining('No pude preparar esa acción') });
  });

  it('al modelo se le dice que el porcentaje va de 1 a 99 (el service no acepta 100)', () => {
    const { registry } = nuevoRegistro();
    void registry;
    const valor = (t: { parameters: { properties: { value: { description: string } } } }) => t.parameters.properties.value.description;
    expect(valor(new CreateDiscountTool({} as any) as any)).toContain('1-99');
    expect(valor(new CreateCouponTool({} as any) as any)).toContain('1-99');
  });
});
