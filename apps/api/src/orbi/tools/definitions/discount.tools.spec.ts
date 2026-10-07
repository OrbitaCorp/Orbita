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
const C1 = '44444444-4444-4444-8444-444444444444';
const C2 = '55555555-5555-4555-8555-555555555555';
const LARGO = `Primera línea\nsegunda "línea" ${'z'.repeat(150)}`;

const PRODUCTOS = [
  { id: P1, name: 'Mate de Algarrobo' },
  { id: P2, name: 'Mate Imperial' },
  { id: P3, name: 'Bombilla de Alpaca' },
];
const CATEGORIAS = [
  { id: C1, name: 'Perfumería' },
  { id: C2, name: 'Mates' },
];

function prismaFalso() {
  return {
    product: { findMany: jest.fn().mockResolvedValue(PRODUCTOS) },
    category: { findMany: jest.fn().mockResolvedValue(CATEGORIAS) },
  };
}

function registryCon(...tools: any[]) {
  const r = new ToolRegistryService();
  for (const t of tools) r.register(t);
  return r;
}

describe('CreateDiscountTool — la tarjeta muestra cada valor', () => {
  const tool = new CreateDiscountTool({} as any, prismaFalso() as any);

  it('nombre, valor, tipo, alcance, los productos por su nombre real y fechas', async () => {
    const r = await tool.describirAccion({
      name: 'Promo Invierno', type: 'PERCENT_PRODUCT', value: 15,
      productos: ['mate de algarrobo', 'MATE IMPERIAL', 'bombilla de alpaca'], startDate: '2026-10-01', endDate: '2026-10-31',
    }, ctx);
    expect(r).toContain('"Promo Invierno"');
    expect(r).toContain('15%');
    expect(r).toContain('3 productos: "Mate de Algarrobo", "Mate Imperial", "Bombilla de Alpaca"');
    expect(r).toContain('2026-10-01');
    expect(r).toContain('2026-10-31');
  });

  it('distingue descuento por producto de descuento sobre el total', async () => {
    const base = { name: 'X', value: 10, scope: 'TICKET' };
    const porProducto = await tool.describirAccion({ ...base, type: 'PERCENT_PRODUCT' }, ctx);
    const sobreTotal = await tool.describirAccion({ ...base, type: 'PERCENT_TICKET' }, ctx);
    expect(porProducto).not.toBe(sobreTotal);
  });

  it('por categoría la nombra (como está en la base), y sin fechas dice desde ahora y sin fin', async () => {
    const r = await tool.describirAccion({ name: 'X', type: 'AMOUNT_PRODUCT', value: 500, categorias: ['perfumerias'] }, ctx);
    expect(r).toContain('$500');
    expect(r).toContain('para categorías elegidas, la categoría "Perfumería"');
    expect(r).toContain('desde ahora');
    expect(r).toContain('sin fecha de fin');
  });

  it('condiciones: compra mínima, topes, días y horario', async () => {
    const r = await tool.describirAccion({
      name: 'Tarde', type: 'PERCENT_TICKET', value: 10, minAmount: 30000, maxUsesTotal: 100, maxUsesPerCustomer: 1,
      activeDays: ['Martes', 'jueves'], startTime: '18:00', endTime: '21:00',
    }, ctx);
    expect(r).toContain('compra mínima de $30000');
    expect(r).toContain('hasta 100 usos en total');
    expect(r).toContain('hasta 1 por cliente');
    expect(r).toContain('solo martes, jueves');
    expect(r).toContain('de 18:00 a 21:00');
  });

  it('sin nombre, la tarjeta muestra el que se le va a poner', async () => {
    expect(await tool.describirAccion({ type: 'PERCENT_PRODUCT', value: 15, categorias: ['Perfumería'] }, ctx)).toContain('"15% en Perfumería"');
    expect(await tool.describirAccion({ type: 'AMOUNT_TICKET', value: 2000 }, ctx)).toContain('"$2000 sobre el total"');
  });

  it('un producto que no existe: no hay tarjeta', async () => {
    await expect(tool.describirAccion({ name: 'X', type: 'PERCENT_PRODUCT', value: 10, productos: ['Termo'] }, ctx)).rejects.toThrow('no existe el producto "Termo"');
  });

  it('el nombre sale entre comillas, sin saltos de línea y truncado a 80', async () => {
    const r = await tool.describirAccion({ name: LARGO, type: 'PERCENT_TICKET', value: 10, scope: 'TICKET' }, ctx);
    expect(r).not.toMatch(/[\r\n]/);
    const citado = r.match(/"([^"]*)"/)?.[1] ?? '';
    expect(citado.startsWith('Primera línea segunda')).toBe(true);
    expect(Array.from(citado).length).toBeLessThanOrEqual(80);
  });
});

describe('CreateCouponTool — la tarjeta muestra cada valor', () => {
  const tool = new CreateCouponTool({} as any, prismaFalso() as any);

  it('código, nombre, valor, alcance, productos y fechas', async () => {
    const r = await tool.describirAccion({
      code: 'VERANO20', name: 'Cupón de verano', type: 'PERCENT_PRODUCT', value: 20,
      productos: [P1, 'mate imperial'], startDate: '2026-12-01', endDate: '2027-02-28',
    }, ctx);
    expect(r).toContain('"VERANO20"');
    expect(r).toContain('"Cupón de verano"');
    expect(r).toContain('20%');
    expect(r).toContain('2 productos: "Mate de Algarrobo", "Mate Imperial"');
    expect(r).toContain('2026-12-01');
    expect(r).toContain('2027-02-28');
  });

  it('sin nombre no repite el código', async () => {
    const r = await tool.describirAccion({ code: 'PROMO10', type: 'PERCENT_TICKET', value: 10 }, ctx);
    expect(r).toBe('Crear el cupón "PROMO10" de 10% off sobre el total de la compra, para toda la compra; desde ahora, sin fecha de fin');
  });
});

describe('createDiscount y createCoupon — validan con el DTO de su endpoint', () => {
  const pasa = { validarAlta: jest.fn().mockResolvedValue(undefined) };
  const registry = registryCon(new CreateDiscountTool(pasa as any, prismaFalso() as any), new CreateCouponTool(pasa as any, prismaFalso() as any));
  const descuento = { name: 'Promo', type: 'PERCENT_PRODUCT', value: 10, productos: ['Mate de Algarrobo'] };
  const cupon = { ...descuento, code: 'VERANO20' };

  it('con argumentos válidos se propone', async () => {
    expect(await registry.proponer('createDiscount', descuento, ctx)).toEqual({ resumen: expect.any(String) });
    expect(await registry.proponer('createCoupon', cupon, ctx)).toEqual({ resumen: expect.any(String) });
  });

  it('nombre de más de 120 caracteres: error, sin tarjeta, con el campo para la persona', async () => {
    const nombre = 'n'.repeat(121);
    expect(await registry.proponer('createDiscount', { ...descuento, name: nombre }, ctx)).toEqual(expect.objectContaining({ invalidos: [expect.objectContaining({ campo: 'nombre' })] }));
    expect(await registry.proponer('createCoupon', { ...cupon, name: nombre }, ctx)).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('código de cupón con caracteres inválidos o de más de 40: error', async () => {
    expect(await registry.proponer('createCoupon', { ...cupon, code: 'VERANO 20!' }, ctx)).toEqual(expect.objectContaining({ invalidos: [expect.objectContaining({ campo: 'código' })] }));
    expect(await registry.proponer('createCoupon', { ...cupon, code: 'A'.repeat(41) }, ctx)).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('fecha que no es fecha, u hora que no es HH:MM: error', async () => {
    expect(await registry.proponer('createDiscount', { ...descuento, startDate: 'mañana' }, ctx)).toEqual(expect.objectContaining({ error: expect.any(String) }));
    expect(await registry.proponer('createDiscount', { ...descuento, startTime: '9' }, ctx)).toEqual(expect.objectContaining({ error: expect.stringContaining('HH:MM') }));
  });

  it('un parámetro que la tool no declara: error (un cupón no tiene días)', async () => {
    expect(await registry.proponer('createCoupon', { ...cupon, activeDays: ['lunes'] }, ctx)).toEqual({ error: expect.stringContaining('activeDays') });
  });

  it('un día que no es día: error con los días', async () => {
    const r = await registry.proponer('createDiscount', { ...descuento, activeDays: ['finde'] }, ctx);
    expect(r).toEqual(expect.objectContaining({ invalidos: [expect.objectContaining({ campo: 'días', opciones: expect.arrayContaining(['sabado', 'domingo']) })] }));
  });
});

describe('createDiscount y createCoupon — faltantes y alcance, todo junto', () => {
  const pasa = { validarAlta: jest.fn().mockResolvedValue(undefined) };
  const registry = registryCon(new CreateDiscountTool(pasa as any, prismaFalso() as any), new CreateCouponTool(pasa as any, prismaFalso() as any));

  it('sin nada: tipo, valor y a qué aplica de una (y el código, si es cupón)', async () => {
    const d = await registry.proponer('createDiscount', {}, ctx);
    expect(d).toEqual(expect.objectContaining({ faltan: [expect.stringContaining('tipo'), 'valor'] }));
    const c = await registry.proponer('createCoupon', { type: 'PERCENT_PRODUCT' }, ctx);
    expect(c).toEqual(expect.objectContaining({ faltan: ['código', 'valor', expect.stringContaining('a qué productos o categorías')] }));
    expect((c as { error: string }).error).toContain('UN solo mensaje');
  });

  it('el alcance sale del tipo y de lo elegido: no hace falta scope', async () => {
    await registry.proponer('createDiscount', { type: 'PERCENT_PRODUCT', value: 10, categorias: ['mates'] }, ctx);
    await registry.proponer('createDiscount', { type: 'PERCENT_PRODUCT', value: 10, productos: ['algarrobo'] }, ctx);
    await registry.proponer('createDiscount', { type: 'AMOUNT_TICKET', value: 500 }, ctx);
    const dtos = pasa.validarAlta.mock.calls.map(([, dto]) => dto);
    expect(dtos[0]).toEqual(expect.objectContaining({ scope: 'CATEGORY', categoryIds: [C2], name: '10% en Mates' }));
    expect(dtos[1]).toEqual(expect.objectContaining({ scope: 'PRODUCT', productIds: [P1], productLevel: 'padre' }));
    expect(dtos[2]).toEqual(expect.objectContaining({ scope: 'TICKET', name: '$500 sobre el total' }));
    expect(dtos[2].productIds).toBeUndefined();
  });

  it('sobre el total con productos: error que explica la mezcla', async () => {
    const r = await registry.proponer('createDiscount', { type: 'PERCENT_TICKET', value: 10, categorias: ['Mates'] }, ctx);
    expect(r).toEqual(expect.objectContaining({ invalidos: [expect.objectContaining({ campo: 'a qué aplica', opciones: ['PERCENT_PRODUCT', 'AMOUNT_PRODUCT'] })] }));
  });

  it('por producto con scope TICKET (no descontaría nada): pide el tipo sobre el total', async () => {
    const r = await registry.proponer('createCoupon', { code: 'TODO10', type: 'PERCENT_PRODUCT', value: 10, scope: 'TICKET' }, ctx);
    expect(r).toEqual(expect.objectContaining({ invalidos: [expect.objectContaining({ campo: 'tipo', opciones: ['PERCENT_TICKET', 'AMOUNT_TICKET'] })] }));
  });

  it('productos y categorías a la vez, o un scope que no coincide: error', async () => {
    expect(await registry.proponer('createDiscount', { type: 'PERCENT_PRODUCT', value: 10, productos: ['algarrobo'], categorias: ['Mates'] }, ctx))
      .toEqual(expect.objectContaining({ invalidos: [expect.objectContaining({ motivo: expect.stringContaining('no las dos') })] }));
    expect(await registry.proponer('createDiscount', { type: 'PERCENT_PRODUCT', value: 10, scope: 'PRODUCT', categorias: ['Mates'] }, ctx))
      .toEqual(expect.objectContaining({ invalidos: [expect.objectContaining({ motivo: expect.stringContaining('no coincide') })] }));
  });

  it('nombres que no existen o son ambiguos: todos juntos, con opciones', async () => {
    const r = await registry.proponer('createDiscount', { type: 'PERCENT_PRODUCT', value: 10, productos: ['mate', 'Termo'] }, ctx);
    expect(r).toEqual(expect.objectContaining({
      invalidos: [
        expect.objectContaining({ campo: 'productos', motivo: expect.stringContaining('preguntale cuál'), opciones: ['Mate de Algarrobo', 'Mate Imperial'] }),
        expect.objectContaining({ campo: 'productos', motivo: expect.stringContaining('no existe el producto "Termo"') }),
      ],
    }));
  });
});

describe('createDiscount y createCoupon — lo que iba a fallar al confirmar se rechaza ANTES de la tarjeta', () => {
  const nuevoRegistro = () => {
    const discounts = { validarAlta: jest.fn().mockResolvedValue(undefined), create: jest.fn().mockResolvedValue({ id: 'd1', name: 'Promo' }) };
    const coupons = { validarAlta: jest.fn().mockResolvedValue(undefined), create: jest.fn().mockResolvedValue({ id: 'c1', code: 'VERANO20', name: 'Promo' }) };
    const prisma = prismaFalso();
    const registry = registryCon(new CreateDiscountTool(discounts as any, prisma as any), new CreateCouponTool(coupons as any, prisma as any));
    return { discounts, coupons, registry, prisma };
  };
  const porProducto = { name: 'Promo', type: 'PERCENT_PRODUCT', value: 10, productos: ['Mate de Algarrobo', 'Mate Imperial'] };
  const porCategoria = { name: 'Promo', type: 'PERCENT_PRODUCT', value: 10, categorias: ['Perfumería'] };

  it('por producto: el service valida con productLevel "padre" y el negocio de la sesión (antes fallaba al confirmar)', async () => {
    const { discounts, coupons, registry, prisma } = nuevoRegistro();
    expect(await registry.proponer('createDiscount', porProducto, ctx)).toEqual({ resumen: expect.any(String) });
    expect(discounts.validarAlta).toHaveBeenCalledWith('biz-1', expect.objectContaining({ scope: 'PRODUCT', productIds: [P1, P2], productLevel: 'padre' }));
    expect(await registry.proponer('createCoupon', { ...porProducto, code: 'VERANO20' }, ctx)).toEqual({ resumen: expect.any(String) });
    expect(coupons.validarAlta).toHaveBeenCalledWith('biz-1', expect.objectContaining({ code: 'VERANO20', productLevel: 'padre' }));
    // Los productos se buscan solo en el negocio de la sesión, sin los borrados.
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'biz-1', deletedAt: null } }));
  });

  it('lo que se escribe al confirmar lleva los ids resueltos y el mismo productLevel que se validó', async () => {
    const { discounts } = nuevoRegistro();
    await new CreateDiscountTool(discounts as any, prismaFalso() as any).execute(porProducto, ctx);
    expect(discounts.create).toHaveBeenCalledWith('biz-1', 'user-1', expect.objectContaining({ productIds: [P1, P2], productLevel: 'padre' }));
  });

  it('el cupón sin nombre se guarda con el código como nombre', async () => {
    const { coupons } = nuevoRegistro();
    await new CreateCouponTool(coupons as any, prismaFalso() as any).execute({ code: 'PROMO10', type: 'PERCENT_TICKET', value: 10 }, ctx);
    expect(coupons.create).toHaveBeenCalledWith('biz-1', 'user-1', expect.objectContaining({ code: 'PROMO10', name: 'PROMO10', scope: 'TICKET' }));
  });

  it('por categoría o sobre el total: sin productLevel', async () => {
    const { discounts, registry } = nuevoRegistro();
    await registry.proponer('createDiscount', porCategoria, ctx);
    await registry.proponer('createDiscount', { name: 'T', type: 'PERCENT_TICKET', value: 10, scope: 'TICKET' }, ctx);
    expect(discounts.validarAlta).toHaveBeenCalledTimes(2);
    for (const [, dto] of discounts.validarAlta.mock.calls) expect(dto.productLevel).toBeUndefined();
  });

  it('el service rechaza (nombre tomado, código tomado): error con su mensaje y sin tarjeta', async () => {
    const { discounts, coupons, registry } = nuevoRegistro();
    discounts.validarAlta.mockRejectedValueOnce(new BadRequestException('Ya existe un descuento con ese nombre.'));
    expect(await registry.proponer('createDiscount', porCategoria, ctx)).toEqual({ error: 'Ya existe un descuento con ese nombre.' });
    coupons.validarAlta.mockRejectedValueOnce(new BadRequestException('Ya existe un cupón con ese código.'));
    expect(await registry.proponer('createCoupon', { ...porProducto, code: 'VERANO20' }, ctx)).toEqual({ error: 'Ya existe un cupón con ese código.' });
  });

  it('una mezcla de alcance se rechaza sin preguntarle al service', async () => {
    const { discounts, registry } = nuevoRegistro();
    await registry.proponer('createDiscount', { ...porCategoria, scope: 'PRODUCT' }, ctx);
    await registry.proponer('createDiscount', { ...porProducto, categorias: ['Mates'] }, ctx);
    expect(discounts.validarAlta).not.toHaveBeenCalled();
  });

  it('la base no responde: "no pude preparar esa acción", sin tarjeta y sin tumbar el chat', async () => {
    const { discounts, registry } = nuevoRegistro();
    discounts.validarAlta.mockRejectedValueOnce(new Error('connection refused'));
    expect(await registry.proponer('createDiscount', porProducto, ctx)).toEqual({ error: expect.stringContaining('No pude preparar esa acción') });
  });

  it('al modelo se le dice que el porcentaje va de 1 a 99 (el service no acepta 100) y que van nombres, no ids', () => {
    const props = (t: { parameters: { properties: Record<string, { description: string }> } }) => t.parameters.properties;
    for (const tool of [new CreateDiscountTool({} as any, {} as any), new CreateCouponTool({} as any, {} as any)] as any[]) {
      expect(props(tool).value.description).toContain('1-99');
      expect(props(tool).productos.description).toContain('Nunca un id inventado');
      expect(props(tool).productIds).toBeUndefined();
    }
  });
});
