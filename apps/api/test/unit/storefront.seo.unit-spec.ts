import { NotFoundException } from '@nestjs/common';
import { StorefrontService } from '../../src/storefront/storefront.service';

// SEO público de una tienda (getSeo / getSitemap): qué se le pide a Google.
//
// Una tienda aparece en Google solo si está publicada, en línea, no es la demo
// y tiene algo a la venta. Con dominio propio ACTIVO, ese es el canónico.

function tienda(opts: { isActive?: boolean; isPaused?: boolean; isDemo?: boolean; productos?: number; dominio?: string | null; categorias?: unknown[] } = {}) {
  const hayProducto = (opts.productos ?? 1) > 0;
  const prisma = {
    business: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'biz-1', subdomain: 't', deletedAt: null,
        isActive: opts.isActive ?? true, isPaused: opts.isPaused ?? false, isDemo: opts.isDemo ?? false,
      }),
    },
    product: {
      findFirst: jest.fn().mockResolvedValue(hayProducto ? { id: 'p-1' } : null),
      findMany: jest.fn().mockResolvedValue([
        { id: 'p-1', updatedAt: new Date('2026-10-01T10:00:00Z') },
        { id: 'p-2', updatedAt: new Date('2026-09-20T10:00:00Z') },
      ]),
    },
    customDomain: { findFirst: jest.fn().mockResolvedValue(opts.dominio ? { domain: opts.dominio } : null) },
    category: { findMany: jest.fn().mockResolvedValue(opts.categorias ?? []) },
  };
  return { svc: new StorefrontService(prisma as any, {} as any, {} as any), prisma };
}

const cat = (slug: string, productos: number) => ({ slug, updatedAt: new Date('2026-09-01T00:00:00Z'), _count: { products: productos } });

describe('getSeo: ¿aparece en Google?', () => {
  it('una tienda publicada, en línea y con productos es indexable', async () => {
    const { svc } = tienda();
    await expect(svc.getSeo('t')).resolves.toEqual({ indexable: true, primaryDomain: null });
  });

  it.each([
    ['nunca publicada', { isActive: false }],
    ['pausada', { isPaused: true }],
    ['la demo', { isDemo: true }],
    ['sin productos a la venta', { productos: 0 }],
  ])('%s no es indexable', async (_caso, opts) => {
    const { svc } = tienda(opts);
    expect((await svc.getSeo('t')).indexable).toBe(false);
  });

  it('una tienda cerrada ni siquiera busca si tiene productos', async () => {
    const { svc, prisma } = tienda({ isPaused: true });
    await svc.getSeo('t');
    expect(prisma.product.findFirst).not.toHaveBeenCalled();
  });

  it('con dominio propio activo, ese es el canónico', async () => {
    const { svc, prisma } = tienda({ dominio: 'tefaltacalleok.com' });
    expect((await svc.getSeo('t')).primaryDomain).toBe('tefaltacalleok.com');
    // Solo cuenta un dominio ACTIVO y con el DNS verificado: uno "pendiente" no puede ser el canónico.
    expect(prisma.customDomain.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { businessId: 'biz-1', status: 'ACTIVE', dnsVerified: true },
    }));
  });

  it('un slug que no existe da 404', async () => {
    const { svc, prisma } = tienda();
    prisma.business.findUnique.mockResolvedValue(null);
    await expect(svc.getSeo('nada')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('un producto solo cuenta si está a la venta (publicado o agotado) y no borrado', async () => {
    const { svc, prisma } = tienda();
    await svc.getSeo('t');
    expect(prisma.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { businessId: 'biz-1', deletedAt: null, status: { in: ['PUBLISHED', 'OUT_OF_STOCK'] } },
    }));
  });
});

describe('getSitemap', () => {
  it('lista los productos con su fecha de modificación y las categorías con productos', async () => {
    const { svc } = tienda({ categorias: [cat('remeras', 4), cat('vacia', 0)] });
    const s = await svc.getSitemap('t');
    expect(s.indexable).toBe(true);
    expect(s.products).toEqual([
      { id: 'p-1', updatedAt: '2026-10-01T10:00:00.000Z' },
      { id: 'p-2', updatedAt: '2026-09-20T10:00:00.000Z' },
    ]);
    expect(s.categories.map((c) => c.slug)).toEqual(['remeras']);
  });

  it('deja afuera las categorías con el mismo slug (la URL no sabría cuál mostrar)', async () => {
    const { svc } = tienda({ categorias: [cat('remeras', 2), cat('remeras', 3), cat('jeans', 1)] });
    expect((await svc.getSitemap('t')).categories.map((c) => c.slug)).toEqual(['jeans']);
  });

  it('una tienda que no debe indexarse devuelve todo vacío y no consulta el catálogo', async () => {
    const { svc, prisma } = tienda({ isDemo: true });
    const s = await svc.getSitemap('t');
    expect(s).toEqual({ indexable: false, primaryDomain: null, categories: [], products: [] });
    expect(prisma.product.findMany).not.toHaveBeenCalled();
    expect(prisma.category.findMany).not.toHaveBeenCalled();
  });

  it('pide solo productos a la venta, con tope', async () => {
    const { svc, prisma } = tienda();
    await svc.getSitemap('t');
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { businessId: 'biz-1', deletedAt: null, status: { in: ['PUBLISHED', 'OUT_OF_STOCK'] } },
      take: 10_000,
    }));
  });
});
