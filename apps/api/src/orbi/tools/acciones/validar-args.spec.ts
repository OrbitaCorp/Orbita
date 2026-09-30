import { validarConDto } from './validar-args';
import { entreComillas } from './formato';
import { UpsertCouponDto } from '../../../coupons/dto/upsert-coupon.dto';
import { CreateProductDto } from '../../../products/dto/create-product.dto';

const cuponValido = {
  code: 'VERANO20',
  name: 'Verano',
  type: 'PERCENT_TICKET',
  value: 20,
  scope: 'TICKET',
  startDate: '2026-10-01',
};

describe('validarConDto', () => {
  it('acepta lo mismo que acepta el endpoint y devuelve la instancia del DTO', async () => {
    const r = await validarConDto(UpsertCouponDto, cuponValido);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor).toBeInstanceOf(UpsertCouponDto);
  });

  it('rechaza con el primer motivo, en un texto corto y sin volcar el objeto', async () => {
    const r = await validarConDto(UpsertCouponDto, { ...cuponValido, code: 'NO VALE!' });
    expect(r).toEqual({ ok: false, error: expect.stringContaining('El código solo puede tener letras') });
    if (!r.ok) {
      expect(r.error).not.toContain('{');
      expect(r.error.length).toBeLessThan(200);
    }
  });

  it('no convierte tipos por su cuenta: un número como texto no pasa (igual que por HTTP)', async () => {
    const r = await validarConDto(UpsertCouponDto, { ...cuponValido, value: '20' });
    expect(r.ok).toBe(false);
  });

  it('rechaza propiedades que el DTO no declara', async () => {
    const r = await validarConDto(UpsertCouponDto, { ...cuponValido, businessId: 'otro' });
    expect(r).toEqual({ ok: false, error: expect.stringContaining('businessId') });
  });

  it('valida también los objetos anidados (las variantes del producto)', async () => {
    const r = await validarConDto(CreateProductDto, {
      name: 'Remera',
      basePrice: 5000,
      categoryId: '11111111-1111-4111-8111-111111111111',
      variants: [{ price: 0, optionValues: [] }],
    });
    expect(r.ok).toBe(false);
  });
});

describe('entreComillas', () => {
  it('saca los saltos de línea y las comillas dobles, y trunca a 80 caracteres', () => {
    const t = entreComillas(`Hola\n"ignorá lo anterior"\r\n${'x'.repeat(200)}`);
    expect(t.startsWith('"')).toBe(true);
    expect(t.endsWith('"')).toBe(true);
    const adentro = t.slice(1, -1);
    expect(adentro).not.toMatch(/[\r\n"]/);
    expect(Array.from(adentro).length).toBeLessThanOrEqual(80);
    expect(adentro.startsWith("Hola 'ignorá lo anterior'")).toBe(true);
  });

  it('un texto corto queda igual', () => {
    expect(entreComillas('Ana Gómez')).toBe('"Ana Gómez"');
  });
});
