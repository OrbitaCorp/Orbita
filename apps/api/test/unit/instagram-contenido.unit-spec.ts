import { NotFoundException } from '@nestjs/common';
import { InstagramContenidoService } from '../../src/marketing/instagram-contenido.service';

// El contenido de la cuenta de Instagram de la empresa en el super panel: lo que ya está publicado en la cuenta
// (todo, no solo lo subido desde Órbita) con sus números.

const NEGOCIO = { id: 'b-orbita' };

function armar(over: { negocio?: object | null; medios?: object[]; insights?: (ruta: string, metrica: string) => unknown } = {}) {
  const prisma = {
    business: { findFirst: jest.fn().mockResolvedValue(over.negocio === undefined ? NEGOCIO : over.negocio) },
    platformAdminLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const instagram = {
    asegurarHabilitado: jest.fn().mockResolvedValue(undefined),
    graph: jest.fn(async (_b: string, _permiso: string, ruta: string, init?: { query?: Record<string, string> }) => {
      if (ruta === '{ig}/media') return { data: over.medios ?? [] };
      const valor = over.insights?.(ruta, init?.query?.metric ?? '');
      if (valor instanceof Error) throw valor;
      return { data: [{ values: [{ value: valor ?? null }] }] };
    }),
  };
  const config = { get: () => undefined };
  return { svc: new InstagramContenidoService(prisma as any, config as any, instagram as any), prisma, instagram };
}

const medio = (over: object = {}) => ({
  id: '17900000000000001', caption: 'Nueva plantilla', media_type: 'IMAGE', media_product_type: 'FEED',
  media_url: 'https://cdn/x.jpg', permalink: 'https://instagram.com/p/x', timestamp: '2026-10-10T12:00:00+0000', like_count: 12, comments_count: 3, ...over,
});

describe('publicaciones de la cuenta', () => {
  it('lee el negocio de la empresa, exige que Instagram esté habilitado y pide el permiso de estadísticas', async () => {
    const { svc, prisma, instagram } = armar({ medios: [] });
    await svc.publicacionesDeLaCuenta();
    expect(prisma.business.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { subdomain: 'negocio', deletedAt: null } }));
    expect(instagram.asegurarHabilitado).toHaveBeenCalledWith('b-orbita');
    expect(instagram.graph).toHaveBeenCalledWith('b-orbita', 'instagram_business_manage_insights', '{ig}/media', expect.anything());
  });

  it('arma cada publicación con tipo, reel, foto, enlace y números', async () => {
    const { svc } = armar({
      medios: [
        medio(),
        medio({ id: '17900000000000002', media_type: 'VIDEO', media_product_type: 'REELS', thumbnail_url: 'https://cdn/t.jpg', media_url: 'https://cdn/v.mp4' }),
        medio({ id: '17900000000000003', media_type: 'CAROUSEL_ALBUM' }),
      ],
      insights: (_ruta, metrica) => ({ views: 500, reach: 300, saved: 7, shares: 2 })[metrica as 'views'],
    });
    const r = await svc.publicacionesDeLaCuenta();
    expect(r[0]).toMatchObject({ tipo: 'foto', reel: false, texto: 'Nueva plantilla', imagen: 'https://cdn/x.jpg', likes: 12, comentarios: 3, vistas: 500, alcance: 300, guardados: 7, compartidos: 2 });
    expect(r[1]).toMatchObject({ tipo: 'video', reel: true, imagen: 'https://cdn/t.jpg' });
    expect(r[2].tipo).toBe('carrusel');
  });

  it('un número que Instagram no da para esa publicación queda en null y no tira la lista', async () => {
    const { svc } = armar({ medios: [medio()], insights: (_r, metrica) => (metrica === 'saved' ? new Error('no soportado') : 10) });
    const [p] = await svc.publicacionesDeLaCuenta();
    expect(p).toMatchObject({ vistas: 10, alcance: 10, guardados: null, compartidos: 10 });
  });

  it('solo consulta los números de las 12 más nuevas: una llamada por publicación es cara', async () => {
    const medios = Array.from({ length: 24 }, (_, i) => medio({ id: String(17900000000000000 + i) }));
    const { svc, instagram } = armar({ medios, insights: () => 1 });
    const r = await svc.publicacionesDeLaCuenta();
    expect(r).toHaveLength(24);
    expect(r[11].vistas).toBe(1);
    expect(r[12].vistas).toBeNull();
    expect(instagram.graph).toHaveBeenCalledTimes(1 + 12 * 4);
  });

  it('sin el negocio de la empresa falla con NotFound', async () => {
    const { svc } = armar({ negocio: null });
    await expect(svc.publicacionesDeLaCuenta()).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('anotar', () => {
  it('deja quién hizo qué con la cuenta de la empresa, y un fallo del registro no rompe nada', async () => {
    const { svc, prisma } = armar();
    await svc.anotar('admin-1', 'instagram_publish', 'post-1', { items: 2 });
    expect(prisma.platformAdminLog.create).toHaveBeenCalledWith({
      data: { adminId: 'admin-1', action: 'instagram_publish', targetType: 'marketing_instagram', targetId: 'post-1', details: { items: 2 } },
    });
    prisma.platformAdminLog.create.mockRejectedValue(new Error('db'));
    await expect(svc.anotar('admin-1', 'x', 'y')).resolves.toBeUndefined();
  });
});
