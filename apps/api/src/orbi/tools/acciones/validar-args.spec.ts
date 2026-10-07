import { validarConDto } from './validar-args';
import { entreComillas, limpio } from './formato';
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
    expect(r).toEqual(expect.objectContaining({ ok: false, error: expect.stringContaining('El código solo puede tener letras') }));
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
    expect(r).toEqual(expect.objectContaining({ ok: false, error: expect.stringContaining('businessId') }));
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

  // Un RLO (U+202E) sin cerrar da vuelta cómo se VE todo lo que sigue en la
  // línea, comilla de cierre incluida: la tarjeta podría mostrar algo distinto
  // de lo que se escribe. Los de ancho cero esconden texto a simple vista.
  it('saca los controles bidi, los de ancho cero y los C1 (limpio y entreComillas)', () => {
    const c = (n: number) => String.fromCharCode(n);
    const invisibles = [
      0x202a, 0x202b, 0x202c, 0x202d, 0x202e, // embeddings y overrides
      0x2066, 0x2067, 0x2068, 0x2069, // isolates
      0x200b, 0x200c, 0x200d, 0x200e, 0x200f, // ancho cero y marcas
      0x2060, 0x2061, 0x2062, 0x2063, 0x2064, 0xfeff, // word joiner, invisibles, BOM
      0x0080, 0x0085, 0x009f, // C1
    ];
    const sucio = `Ana${c(0x202e)} de 100% off${invisibles.map(c).join('')} Gómez`;
    for (const t of [limpio(sucio), entreComillas(sucio)]) {
      for (const n of invisibles) {
        expect({ codigo: n.toString(16), presente: t.includes(c(n)) }).toEqual({ codigo: n.toString(16), presente: false });
      }
    }
    expect(limpio(sucio)).toBe('Ana de 100% off Gómez');
    expect(limpio(`Ana${c(0x200b)}Gómez`)).toBe('AnaGómez');
  });

  it('un texto corto queda igual', () => {
    expect(entreComillas('Ana Gómez')).toBe('"Ana Gómez"');
  });
});
