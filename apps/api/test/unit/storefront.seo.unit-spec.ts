import { NotFoundException } from '@nestjs/common';
import { StorefrontService } from '../../src/storefront/storefront.service';

// SEO público de una tienda (getSeo / getSitemap): qué se le pide a Google.
//
// Una tienda aparece en Google solo si está publicada, en línea, no es la demo
// y tiene algo a la venta. Con dominio propio ACTIVO, ese es el canónico.

function tienda(opts: { isActive?: boolean; isPaused?: boolean; isDemo?: boolean; hidden?: boolean; productos?: number; dominio?: string | null; categorias?: unknown[] } = {}) {
  const hayProducto = (opts.productos ?? 1) > 0;
  const prisma = {
    business: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'biz-1', subdomain: 't', deletedAt: null,
        isActive: opts.isActive ?? true, isPaused: opts.isPaused ?? false, isDemo: opts.isDemo ?? false, hiddenFromSearch: opts.hidden ?? false,
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
    ['oculta por moderación (sigue en línea, pero Órbita no la ofrece a Google)', { hidden: true }],
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

describe('getDirectory: el directorio público de tiendas', () => {
  const fila = (over: Record<string, unknown> = {}) => ({
    name: 'Venus Style', subdomain: 'venustyle',
    storefrontConfig: { storeName: null, tagline: 'Ropa deportiva', logoUrl: 'https://x/logo.webp' },
    customDomains: [], ...over,
  });
  const AHORA = new Date('2026-10-06T12:00:00Z');

  /** `ids` son las tiendas que cumplen las guardas (lo que devuelve el groupBy). */
  function directorio(filas: unknown[], ids: string[] = filas.map((_, i) => `b-${i}`)) {
    const prisma = {
      product: { groupBy: jest.fn().mockResolvedValue(ids.map((businessId) => ({ businessId }))) },
      business: { findMany: jest.fn().mockResolvedValue(filas) },
    };
    return { svc: new StorefrontService(prisma as any, {} as any, {} as any), prisma };
  }

  it('pide tiendas en línea y no demo con al menos 3 productos a la venta, con foto y precio, de más de 48 horas', async () => {
    const { svc, prisma } = directorio([fila()]);
    await svc.getDirectory(1, 48, AHORA);
    const arg = prisma.product.groupBy.mock.calls[0][0];
    expect(arg.by).toEqual(['businessId']);
    expect(arg.where).toMatchObject({
      deletedAt: null,
      status: { in: ['PUBLISHED', 'OUT_OF_STOCK'] },
      basePrice: { gt: 0 },
      images: { some: {} },
      business: { isActive: true, isPaused: false, isDemo: false, hiddenFromSearch: false, deletedAt: null },
    });
    // 48 horas antes de "ahora": un producto recién cargado todavía no cuenta.
    expect(arg.where.createdAt).toEqual({ lte: new Date('2026-10-04T12:00:00Z') });
    expect(arg.having).toEqual({ id: { _count: { gte: 3 } } });
  });

  it('muestra solo las tiendas que cumplen (y busca sus datos por id)', async () => {
    const { svc, prisma } = directorio([fila()], ['b-1', 'b-7']);
    const d = await svc.getDirectory(1, 48, AHORA);
    expect(prisma.business.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['b-1', 'b-7'] } });
    expect(d.total).toBe(2);
  });

  it('si ninguna cumple, devuelve vacío sin buscar nada más', async () => {
    const { svc, prisma } = directorio([], []);
    expect(await svc.getDirectory(1, 48, AHORA)).toEqual({ total: 0, page: 1, perPage: 48, stores: [] });
    expect(prisma.business.findMany).not.toHaveBeenCalled();
  });

  it('arma cada tienda con su nombre, su descripción y su dominio propio activo', async () => {
    const { svc } = directorio([
      fila(),
      fila({ name: 'TeFaltaCalle', subdomain: 'tefaltacalle', customDomains: [{ domain: 'tefaltacalleok.com' }], storefrontConfig: { storeName: 'Te Falta Calle', tagline: '  ', logoUrl: null } }),
    ]);
    const d = await svc.getDirectory(1, 48, AHORA);
    expect(d.stores).toEqual([
      { name: 'Venus Style', subdomain: 'venustyle', domain: null, description: 'Ropa deportiva', logoUrl: 'https://x/logo.webp' },
      { name: 'Te Falta Calle', subdomain: 'tefaltacalle', domain: 'tefaltacalleok.com', description: null, logoUrl: null },
    ]);
  });

  it('solo cuenta un dominio propio ACTIVO y con el DNS verificado', async () => {
    const { svc, prisma } = directorio([fila()]);
    await svc.getDirectory(1, 48, AHORA);
    const sel = prisma.business.findMany.mock.calls[0][0].select;
    expect(sel.customDomains.where).toEqual({ status: 'ACTIVE', dnsVerified: true });
    expect(sel.customDomains.take).toBe(1);
  });

  it('pagina con orden estable', async () => {
    const ids = Array.from({ length: 100 }, (_, i) => `b-${i}`);
    const { svc, prisma } = directorio([fila()], ids);
    const d = await svc.getDirectory(3, 48, AHORA);
    expect(prisma.business.findMany.mock.calls[0][0]).toMatchObject({ skip: 96, take: 48, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
    expect(d).toMatchObject({ total: 100, page: 3, perPage: 48 });
  });
});
