import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import sharp from 'sharp';
import { ProductsService } from '../../src/products/products.service';
import { BusinessesService } from '../../src/businesses/businesses.service';
import { CreateProductDto } from '../../src/products/dto/create-product.dto';
import { FindProductsQueryDto } from '../../src/products/dto/find-products-query.dto';
import { ReorderImagesDto } from '../../src/products/dto/reorder-images.dto';

// Auditoría interna 2026-09-10, ítem `api.products`.
//
// - El DTO de producto no tenía topes: un solo POST con miles de variantes
//   armaba una transacción enorme contra la base.
// - Las fotos por producto no tenían límite.
// - Quitar el fondo (paquete Avanzado) se revalidaba en las fotos de producto
//   pero no en las imágenes de Apariencia.

const BIZ = 'biz-1';
const CATEGORIA = '8b1f0f1e-3b8a-4f7e-9d6e-1f2a3b4c5d6e';

const variante = (i: number) => ({ price: 1000, optionValues: [`V${i}`], initialStock: 1 });
const producto = (extra: Record<string, unknown> = {}) => ({
  name: 'Remera oversize', categoryId: CATEGORIA, basePrice: 15000, status: 'PUBLISHED',
  options: [{ name: 'Talle', values: ['S', 'M', 'L'] }], variants: [variante(1)], ...extra,
});
const errores = async (cls: any, body: object) => (await validate(plainToInstance(cls, body))).map((e) => e.property);

describe('CreateProductDto: topes', () => {
  it('un producto como el más grande de producción pasa', async () => {
    expect(await errores(CreateProductDto, producto({
      description: 'x'.repeat(402),
      options: [{ name: 'Talle', values: ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'] }, { name: 'Color', values: ['Negro', 'Blanco'] }],
      variants: Array.from({ length: 12 }, (_, i) => variante(i)),
      specs: Array.from({ length: 13 }, (_, i) => ({ label: `L${i}`, value: 'v' })),
    }))).toEqual([]);
  });

  it.each([
    ['name', { name: '' }],
    ['name', { name: 'x'.repeat(151) }],
    ['description', { description: 'x'.repeat(5001) }],
    ['variants', { variants: Array.from({ length: 201 }, (_, i) => variante(i)) }],
    ['options', { options: Array.from({ length: 6 }, (_, i) => ({ name: `O${i}`, values: ['a'] })) }],
    ['options', { options: [{ name: 'Talle', values: Array.from({ length: 51 }, (_, i) => `v${i}`) }] }],
    ['specs', { specs: Array.from({ length: 31 }, (_, i) => ({ label: `L${i}`, value: 'v' })) }],
    ['basePrice', { basePrice: 2e9 }],
    ['variants', { variants: [{ ...variante(1), sku: 'x'.repeat(65) }] }],
    ['variants', { variants: [{ ...variante(1), initialStock: 5e6 }] }],
  ])('rechaza %s fuera de rango', async (campo, extra) => {
    expect(await errores(CreateProductDto, producto(extra))).toContain(campo);
  });

  it('la búsqueda y el reordenado de fotos tienen topes', async () => {
    expect(await errores(FindProductsQueryDto, { search: 'x'.repeat(101) })).toContain('search');
    const item = { id: CATEGORIA, position: 1 };
    expect(await errores(ReorderImagesDto, { items: Array.from({ length: 51 }, () => item) })).toContain('items');
    expect(await errores(ReorderImagesDto, { items: [{ ...item, position: -1 }] })).toContain('items');
    expect(await errores(ReorderImagesDto, { items: [item] })).toEqual([]);
  });
});

describe('Fotos de producto', () => {
  it('con 30 fotos no se sube otra (y no se toca Storage)', async () => {
    const upload = jest.fn();
    const prisma = {
      product: { findFirst: jest.fn().mockResolvedValue({ id: 'p-1', name: 'Remera' }) },
      productImage: { count: jest.fn().mockResolvedValue(30) },
    };
    const supabase = { adminClient: { storage: { from: () => ({ upload }) } } };
    const svc = new ProductsService(prisma as any, supabase as any, {} as any);
    await expect(
      svc.addImage(BIZ, 'p-1', {}, { buffer: Buffer.from('x'), mimetype: 'image/png', originalname: 'a.png' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(upload).not.toHaveBeenCalled();
  });
});

describe('Quitar el fondo en Apariencia exige el paquete Avanzado', () => {
  function apariencia(tieneAddon: boolean) {
    const prisma = { businessAddon: { findFirst: jest.fn().mockResolvedValue(tieneAddon ? { id: 'a-1' } : null) } };
    const upload = jest.fn().mockResolvedValue({ error: null });
    const supabase = {
      adminClient: { storage: { from: () => ({ upload, getPublicUrl: () => ({ data: { publicUrl: 'https://x/y.webp' } }) }) } },
    };
    const bg = { removeBackground: jest.fn((b: Buffer) => Promise.resolve(b)) };
    return { svc: new BusinessesService(prisma as any, supabase as any, bg as any), bg, upload };
  }
  const png = () => sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } }).png().toBuffer();

  it('sin el paquete: 403 ADDON_REQUIRED y el modelo no corre', async () => {
    const { svc, bg, upload } = apariencia(false);
    const err = await svc.uploadStorefrontImage(BIZ, { buffer: await png(), mimetype: 'image/png', originalname: 'a.png' }, true).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as Error).message).toBe('ADDON_REQUIRED:ADVANCED');
    expect(bg.removeBackground).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('con el paquete: quita el fondo y sube', async () => {
    const { svc, bg } = apariencia(true);
    await expect(svc.uploadStorefrontImage(BIZ, { buffer: await png(), mimetype: 'image/png', originalname: 'a.png' }, true)).resolves.toEqual({ url: 'https://x/y.webp' });
    expect(bg.removeBackground).toHaveBeenCalled();
  });

  it('sin pedir quitar el fondo no hace falta el paquete', async () => {
    const { svc, bg } = apariencia(false);
    await expect(svc.uploadStorefrontImage(BIZ, { buffer: await png(), mimetype: 'image/png', originalname: 'a.png' }, false)).resolves.toBeDefined();
    expect(bg.removeBackground).not.toHaveBeenCalled();
  });
});
