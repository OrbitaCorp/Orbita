import { ForbiddenException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
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

  // "Quitar fondo" en fotos de producto está en mantenimiento (24/09/2026, ver
  // el plan "Fondo con IA: pipeline 2D/3D") — a diferencia de los sliders de
  // Apariencia (uploadStorefrontImage en businesses.service.ts), que siguen
  // andando con el modelo local.
  it('quitar fondo está en mantenimiento: 503 sin correr el modelo', async () => {
    delete process.env.FONDO_IA_MANTENIMIENTO; // no depender del .env local (ver fondo-ia-mantenimiento.ts)
    const bg = { removeBackground: jest.fn() };
    const prisma = {
      product: { findFirst: jest.fn().mockResolvedValue({ id: 'p-1', name: 'Remera' }) },
      productImage: { count: jest.fn().mockResolvedValue(0) },
      businessAddon: { findFirst: jest.fn().mockResolvedValue({ id: 'a-1' }) },
    };
    const svc = new ProductsService(prisma as any, {} as any, bg as any);
    await expect(
      svc.addImage(BIZ, 'p-1', { removeBackground: true } as any, { buffer: Buffer.from('x'), mimetype: 'image/png', originalname: 'a.png' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(bg.removeBackground).not.toHaveBeenCalled();
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
    return { svc: new BusinessesService(prisma as any, supabase as any, bg as any, {} as any), bg, upload };
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

// "Quitar fondo" persistente (24/09/2026): la marca y la foto original se
// guardan para poder mostrar el botón "Sin fondo" y volver atrás al EDITAR un
// producto, en fotos principales y de variantes (mismo registro ProductImage).
describe('Fotos de producto: quitar fondo persistente', () => {
  const png = () => sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).png().toBuffer();
  const archivo = async () => ({ buffer: await png(), mimetype: 'image/png', originalname: 'a.png' });
  const URL_BASE = 'https://x.supabase.co/storage/v1/object/public/product-images/';

  beforeEach(() => { process.env.FONDO_IA_MANTENIMIENTO = 'false'; });
  afterEach(() => { delete process.env.FONDO_IA_MANTENIMIENTO; });

  function armar(imagen: Record<string, unknown> | null, tieneAddon = true) {
    let n = 0;
    const upload = jest.fn().mockResolvedValue({ error: null });
    const download = jest.fn(async () => ({ data: new Blob([new Uint8Array(await png())]), error: null }));
    const remove = jest.fn().mockResolvedValue({});
    const prisma = {
      product: { findFirst: jest.fn().mockResolvedValue({ id: 'p-1', name: 'Remera' }) },
      productImage: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _max: { position: 0 } }),
        updateMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(imagen),
        create: jest.fn(async ({ data }: any) => ({ id: 'img-new', position: 1, isPrimary: false, optionValueId: null, hasAiBackground: false, ...data })),
        update: jest.fn(async ({ data }: any) => ({ id: 'img-1', ...imagen, ...data })),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      businessAddon: { findFirst: jest.fn().mockResolvedValue(tieneAddon ? { id: 'a-1' } : null) },
    };
    const supabase = {
      adminClient: {
        storage: { from: () => ({ upload, download, remove, getPublicUrl: () => ({ data: { publicUrl: `${URL_BASE}${BIZ}/p-1/nuevo-${++n}.webp` } }) }) },
      },
    };
    const bg = { removeBackground: jest.fn((b: Buffer) => Promise.resolve(b)) };
    return { svc: new ProductsService(prisma as any, supabase as any, bg as any), prisma, bg, upload, download, remove };
  }

  it('al subir con "Quitar fondo" guarda la marca y la foto original', async () => {
    const { svc, prisma, upload } = armar(null);
    const r = await svc.addImage(BIZ, 'p-1', { removeBackground: true } as any, await archivo());
    expect(upload).toHaveBeenCalledTimes(2); // original + sin fondo
    const data = prisma.productImage.create.mock.calls[0][0].data;
    expect(data.backgroundRemoved).toBe(true);
    expect(data.originalUrl).toContain('nuevo-1');
    expect(data.url).toContain('nuevo-2');
    expect(r.backgroundRemoved).toBe(true);
  });

  it('una foto normal no guarda original ni marca', async () => {
    const { svc, prisma, upload } = armar(null);
    await svc.addImage(BIZ, 'p-1', {} as any, await archivo());
    expect(upload).toHaveBeenCalledTimes(1);
    const data = prisma.productImage.create.mock.calls[0][0].data;
    expect(data.backgroundRemoved).toBe(false);
    expect(data.originalUrl).toBeNull();
  });

  it('quitar el fondo de una foto guardada: procesa, sube y deja el original', async () => {
    const guardada = { id: 'img-1', productId: 'p-1', url: `${URL_BASE}${BIZ}/p-1/orig.webp`, backgroundRemoved: false, originalUrl: null, optionValueId: 'ov-1' };
    const { svc, prisma, bg, download } = armar(guardada);
    const r = await svc.setImageBackground(BIZ, 'p-1', 'img-1', true);
    expect(download).toHaveBeenCalledWith(`${BIZ}/p-1/orig.webp`);
    expect(bg.removeBackground).toHaveBeenCalledTimes(1);
    expect(prisma.productImage.update.mock.calls[0][0].data).toMatchObject({ backgroundRemoved: true, originalUrl: guardada.url });
    expect(r.backgroundRemoved).toBe(true);
    expect(r.url).toContain('nuevo-1');
  });

  it('devolver el fondo: vuelve a la original, sin correr el modelo ni borrar archivos', async () => {
    const guardada = { id: 'img-1', productId: 'p-1', url: `${URL_BASE}${BIZ}/p-1/sinfondo.webp`, backgroundRemoved: true, originalUrl: `${URL_BASE}${BIZ}/p-1/orig.webp` };
    const { svc, prisma, bg, remove } = armar(guardada);
    const r = await svc.setImageBackground(BIZ, 'p-1', 'img-1', false);
    expect(prisma.productImage.update.mock.calls[0][0].data).toEqual({ url: guardada.originalUrl, originalUrl: null, backgroundRemoved: false });
    expect(r).toMatchObject({ url: guardada.originalUrl, backgroundRemoved: false });
    expect(bg.removeBackground).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('sin el paquete Avanzado: 403 y el modelo no corre', async () => {
    const guardada = { id: 'img-1', productId: 'p-1', url: `${URL_BASE}${BIZ}/p-1/orig.webp`, backgroundRemoved: false, originalUrl: null };
    const { svc, bg } = armar(guardada, false);
    await expect(svc.setImageBackground(BIZ, 'p-1', 'img-1', true)).rejects.toBeInstanceOf(ForbiddenException);
    expect(bg.removeBackground).not.toHaveBeenCalled();
  });

  it('una foto que no es de nuestro almacenamiento no se descarga', async () => {
    const guardada = { id: 'img-1', productId: 'p-1', url: 'https://otro.com/foto.jpg', backgroundRemoved: false, originalUrl: null };
    const { svc, download } = armar(guardada);
    await expect(svc.setImageBackground(BIZ, 'p-1', 'img-1', true)).rejects.toThrow();
    expect(download).not.toHaveBeenCalled();
  });

  it('borrar la foto borra también el original', async () => {
    const guardada = { id: 'img-1', productId: 'p-1', url: `${URL_BASE}${BIZ}/p-1/sinfondo.webp`, backgroundRemoved: true, originalUrl: `${URL_BASE}${BIZ}/p-1/orig.webp` };
    const { svc, remove } = armar(guardada);
    await svc.removeImage(BIZ, 'p-1', 'img-1');
    expect(remove).toHaveBeenCalledWith([`${BIZ}/p-1/sinfondo.webp`, `${BIZ}/p-1/orig.webp`]);
  });
});
