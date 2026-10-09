import { ForbiddenException, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import sharp from 'sharp';
import { InstagramService } from '../../src/instagram/instagram.service';
import { InstagramPublicacionesService } from '../../src/instagram/instagram-publicaciones.service';

// Publicaciones del kit de difusión. Cubre lo que si falla se nota tarde y a la vista de los seguidores:
// que no se publique sin el permiso ni de un producto ajeno o sin publicar, que la foto llegue a Instagram
// como JPEG cuadrado, que se borre el temporal, y que un error de permiso no corte la conexión.

const BIZ = 'biz-1';
const IG_CUENTA = '17841400000000000';

function config(extra: Record<string, string> = {}) {
  const valores: Record<string, string> = { INSTAGRAM_APP_ID: '1', INSTAGRAM_APP_SECRET: 's', INSTAGRAM_TOKEN_KEY: 'k', JWT_SECRET: 'j', ...extra };
  return { get: (k: string) => valores[k] } as any;
}

function respuesta(json: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => json } as any;
}

describe('InstagramService.publicarImagen (unit)', () => {
  const crear = (scopes: string | null, estadoContenedor: string[] = ['FINISHED']) => {
    const prisma: any = {
      instagramConnection: {
        findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE', scopes }),
        update: jest.fn().mockResolvedValue({}),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ ig_user_id: IG_CUENTA, access_token: 'tok' }]),
    };
    const svc = new InstagramService(prisma, config());
    jest.spyOn(svc as any, 'pausa').mockResolvedValue(undefined);
    const estados = [...estadoContenedor];
    const fetchMock = jest.fn().mockImplementation(async (url: string, init?: any) => {
      if (url.includes('/media_publish')) return respuesta({ id: 'media-9' });
      if (url.includes('fields=status_code')) return respuesta({ status_code: estados.shift() ?? 'IN_PROGRESS' });
      if (url.includes('fields=permalink')) return respuesta({ permalink: 'https://www.instagram.com/p/abc/' });
      if (url.endsWith('/media')) return respuesta({ id: 'cont-1' });
      throw new Error(`url inesperada ${url} ${init?.method}`);
    });
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock as any);
    return { svc, prisma, fetchMock };
  };
  afterEach(() => jest.restoreAllMocks());

  it('sin el permiso de publicar no llama a Instagram', async () => {
    const { svc, fetchMock } = crear('instagram_business_basic,instagram_business_manage_messages');
    await expect(svc.publicarImagen(BIZ, 'https://x/f.jpg', 'hola')).rejects.toBeInstanceOf(ForbiddenException);
    expect(fetchMock).not.toHaveBeenCalled();
    const sinScopes = crear(null);
    await expect(sinScopes.svc.publicarImagen(BIZ, 'https://x/f.jpg', 'hola')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('crea el contenedor con la imagen y el texto, espera que esté listo y publica', async () => {
    const { svc, fetchMock } = crear('instagram_business_basic,instagram_business_content_publish', ['IN_PROGRESS', 'FINISHED']);
    const r = await svc.publicarImagen(BIZ, 'https://cdn/f.jpg', 'Remera lisa');
    expect(r).toEqual({ mediaId: 'media-9', permalink: 'https://www.instagram.com/p/abc/' });
    const creacion = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/media'));
    expect(JSON.parse(creacion![1].body)).toEqual({ image_url: 'https://cdn/f.jpg', caption: 'Remera lisa' });
    expect(creacion![1].headers.Authorization).toBe('Bearer tok');
    const publicacion = fetchMock.mock.calls.find(([u]) => String(u).includes('/media_publish'));
    expect(JSON.parse(publicacion![1].body)).toEqual({ creation_id: 'cont-1' });
  });

  it('si Instagram no puede procesar la imagen, no publica', async () => {
    const { svc, fetchMock } = crear('instagram_business_content_publish', ['ERROR']);
    await expect(svc.publicarImagen(BIZ, 'https://cdn/f.jpg', 'x')).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/media_publish'))).toBe(false);
  });

  it('si el contenedor nunca queda listo, avisa y no publica', async () => {
    const { svc } = crear('instagram_business_content_publish', []);
    await expect(svc.publicarImagen(BIZ, 'https://cdn/f.jpg', 'x')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('el token vencido (190) corta la conexión; un error de permiso NO', async () => {
    const vencido = crear('instagram_business_content_publish');
    (global.fetch as jest.Mock).mockImplementationOnce(async () => respuesta({ error: { message: 'Invalid OAuth access token', code: 190, type: 'OAuthException' } }, false, 400));
    await expect(vencido.svc.publicarImagen(BIZ, 'https://cdn/f.jpg', 'x')).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(vencido.prisma.instagramConnection.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'DISCONNECTED', accessToken: '' } }));

    const sinPermiso = crear('instagram_business_content_publish');
    (global.fetch as jest.Mock).mockImplementationOnce(async () => respuesta({ error: { message: 'Permission denied', code: 10, type: 'OAuthException' } }, false, 400));
    await expect(sinPermiso.svc.publicarImagen(BIZ, 'https://cdn/f.jpg', 'x')).rejects.toThrow();
    expect(sinPermiso.prisma.instagramConnection.update).not.toHaveBeenCalled();
  });
});

describe('InstagramPublicacionesService (unit)', () => {
  const producto = (extra: Record<string, unknown> = {}) => ({
    id: 'p-1',
    name: 'Remera lisa',
    status: 'PUBLISHED',
    images: [
      { url: 'https://cdn.supabase.co/otra.webp', isPrimary: false, position: 1, optionValueId: null },
      { url: 'https://cdn.supabase.co/principal.webp', isPrimary: true, position: 0, optionValueId: null },
    ],
    ...extra,
  });

  async function crear(prod: unknown, publicarImagen?: jest.Mock) {
    const png = await sharp({ create: { width: 40, height: 20, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 0.5 } } }).png().toBuffer();
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) } as any);
    const prisma: any = {
      product: { findFirst: jest.fn().mockResolvedValue(prod) },
      instagramPost: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'post-1', ...data, createdAt: new Date() })),
      },
    };
    const storage = {
      upload: jest.fn().mockResolvedValue({ error: null }),
      getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.supabase.co/tmp.jpg' } }),
      remove: jest.fn().mockResolvedValue({}),
    };
    const supabase: any = { adminClient: { storage: { from: jest.fn().mockReturnValue(storage) } } };
    const ig: any = {
      asegurarHabilitado: jest.fn().mockResolvedValue(undefined),
      publicarImagen: publicarImagen ?? jest.fn().mockResolvedValue({ mediaId: 'media-9', permalink: 'https://www.instagram.com/p/abc/' }),
    };
    return { svc: new InstagramPublicacionesService(prisma, supabase, ig), prisma, storage, ig };
  }
  afterEach(() => jest.restoreAllMocks());

  it('busca el producto en ESE negocio y no publica uno ajeno, inexistente o sin publicar', async () => {
    const ajeno = await crear(null);
    await expect(ajeno.svc.publicarProducto('biz-1', 'm-1', 'p-1', 'hola')).rejects.toBeInstanceOf(NotFoundException);
    expect(ajeno.prisma.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p-1', businessId: 'biz-1' } }));
    const borrador = await crear(producto({ status: 'DRAFT' }));
    await expect(borrador.svc.publicarProducto('biz-1', 'm-1', 'p-1', 'hola')).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(borrador.ig.publicarImagen).not.toHaveBeenCalled();
  });

  it('un producto sin fotos no se publica', async () => {
    const { svc, ig } = await crear(producto({ images: [] }));
    await expect(svc.publicarProducto('biz-1', 'm-1', 'p-1', 'hola')).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(ig.publicarImagen).not.toHaveBeenCalled();
  });

  it('manda a Instagram un JPEG cuadrado de 1080 px de la foto principal, guarda el historial y borra el temporal', async () => {
    const { svc, prisma, storage, ig } = await crear(producto());
    const post = await svc.publicarProducto('biz-1', 'm-1', 'p-1', 'Remera lisa $15.000');
    expect((global.fetch as jest.Mock).mock.calls[0][0].toString()).toBe('https://cdn.supabase.co/principal.webp');
    const [ruta, jpeg, opciones] = storage.upload.mock.calls[0];
    expect(ruta).toMatch(/^biz-1\/instagram\/.+\.jpg$/);
    expect(opciones.contentType).toBe('image/jpeg');
    const meta = await sharp(jpeg).metadata();
    expect(meta.format).toBe('jpeg');
    expect([meta.width, meta.height]).toEqual([1080, 1080]);
    expect(ig.publicarImagen).toHaveBeenCalledWith('biz-1', 'https://cdn.supabase.co/tmp.jpg', 'Remera lisa $15.000');
    expect(prisma.instagramPost.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ businessId: 'biz-1', productId: 'p-1', productName: 'Remera lisa', memberId: 'm-1', igMediaId: 'media-9' }) }));
    expect(post.permalink).toBe('https://www.instagram.com/p/abc/');
    expect(storage.remove).toHaveBeenCalledWith([ruta]);
  });

  it('si Instagram falla no queda historial y el temporal igual se borra', async () => {
    const { svc, prisma, storage } = await crear(producto(), jest.fn().mockRejectedValue(new UnprocessableEntityException('no pudo')));
    await expect(svc.publicarProducto('biz-1', 'm-1', 'p-1', 'hola')).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.instagramPost.create).not.toHaveBeenCalled();
    expect(storage.remove).toHaveBeenCalledTimes(1);
  });

  it('solo baja fotos de direcciones https públicas', async () => {
    for (const url of ['http://cdn.com/f.webp', 'https://localhost/f.webp', 'https://10.0.0.5/f.webp', 'https://servicio.internal/f.webp']) {
      const { svc, ig } = await crear(producto({ images: [{ url, isPrimary: true, position: 0, optionValueId: null }] }));
      await expect(svc.publicarProducto('biz-1', 'm-1', 'p-1', 'hola')).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(ig.publicarImagen).not.toHaveBeenCalled();
    }
  });

  it('el historial se pide solo de ese negocio', async () => {
    const { svc, prisma } = await crear(producto());
    await svc.listar('biz-1');
    expect(prisma.instagramPost.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'biz-1' }, take: 30 }));
  });
});
