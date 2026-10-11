import { BadRequestException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import sharp from 'sharp';
import { InstagramMediosService, MAX_VIDEO_BYTES } from '../../src/instagram/instagram-medios.service';
import { InstagramPublicacionesService } from '../../src/instagram/instagram-publicaciones.service';

// Publicaciones del kit de difusión. Cubre lo que si falla se nota tarde y a la vista de los seguidores: que no se
// publique sin el permiso ni de un producto ajeno o sin publicar, que cada elemento llegue a Instagram con el
// formato que corresponde (foto, video, carrusel), que una publicación no salga dos veces ni quede colgada, que un
// archivo de otro negocio no se pueda colar, y que los temporales se borren siempre.

const BIZ = 'biz-1';
// Al crear, el proceso reintenta INTENTOS veces seguidas; estas son las respuestas de un video que sigue procesándose durante
// todo ese rato y recién después termina.
const PROCESA_Y_TERMINA = [...Array(5).fill('IN_PROGRESS'), 'FINISHED'];

// ─── Un "prisma" con memoria para las publicaciones ──────────────────────────────

function baseDeDatos(extra: Record<string, unknown> = {}) {
  const filas = new Map<string, any>();
  let n = 0;
  const copiar = (f: any) => ({ ...f });
  const coincide = (f: any, where: any) => Object.entries(where).every(([k, v]) => f[k] === v);
  const prisma: any = {
    instagramPost: {
      create: jest.fn().mockImplementation(async ({ data }) => {
        const id = `post-${++n}`;
        const fila = { id, igMediaId: null, permalink: null, error: null, imageUrl: null, createdAt: new Date(), updatedAt: new Date(), ...data };
        filas.set(id, fila);
        return copiar(fila);
      }),
      findFirst: jest.fn().mockImplementation(async ({ where }) => {
        const f = [...filas.values()].find((x) => coincide(x, where));
        return f ? copiar(f) : null;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        const f = filas.get(where.id);
        Object.assign(f, data, { updatedAt: new Date() });
        return copiar(f);
      }),
      updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
        const f = [...filas.values()].find((x) => coincide(x, where));
        if (!f) return { count: 0 };
        Object.assign(f, data, { updatedAt: new Date() });
        return { count: 1 };
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    product: { findFirst: jest.fn().mockResolvedValue({ id: 'p-1', name: 'Remera lisa', status: 'PUBLISHED' }) },
    ...extra,
  };
  return { prisma, filas };
}

// ─── Un "Instagram" que contesta según la ruta ────────────────────────────────────

function fakeInstagram(opts: { estados?: Record<string, string[]>; errorAlPublicar?: Error; puedePublicar?: boolean } = {}) {
  let contenedores = 0;
  const pedidos: { ruta: string; init: any }[] = [];
  const estados = { ...(opts.estados ?? {}) };
  const graph = jest.fn().mockImplementation(async (_biz: string, _permiso: string, ruta: string, init: any = {}) => {
    pedidos.push({ ruta, init });
    if (ruta === '{ig}/media') return { id: `c-${++contenedores}` };
    if (ruta === '{ig}/media_publish') {
      if (opts.errorAlPublicar) throw opts.errorAlPublicar;
      return { id: 'media-9' };
    }
    if (init.query?.fields === 'permalink') return { permalink: 'https://www.instagram.com/p/abc/' };
    if (init.query?.fields === 'status_code,status') {
      const cola = estados[ruta];
      return { status_code: cola && cola.length ? (cola.length > 1 ? cola.shift() : cola[0]) : 'FINISHED' };
    }
    throw new Error(`ruta inesperada ${ruta}`);
  });
  const ig: any = {
    asegurarHabilitado: jest.fn().mockResolvedValue(undefined),
    puedePublicar: jest.fn().mockResolvedValue(opts.puedePublicar ?? true),
    graph,
  };
  return { ig, graph, pedidos };
}

function fakeMedios() {
  let n = 0;
  const medios: any = {
    resolver: jest.fn().mockImplementation(async (_b: string, item: any, _f: string, conMiniatura: boolean) => {
      const i = ++n;
      return { tipo: item.tipo, url: `https://tmp.test/${i}.${item.tipo === 'video' ? 'mp4' : 'jpg'}`, temporales: [`t${i}`], miniatura: conMiniatura ? `https://mini.test/${i}.jpg` : null };
    }),
    limpiar: jest.fn().mockResolvedValue(undefined),
  };
  return medios;
}

const foto = (ref = 'https://cdn.test/a.webp') => ({ origen: 'producto' as const, ref, tipo: 'image' as const });
const video = (ref = `${BIZ}/subidas/v.mp4`) => ({ origen: 'subida' as const, ref, tipo: 'video' as const });
const subida = (ref = `${BIZ}/subidas/f.jpg`) => ({ origen: 'subida' as const, ref, tipo: 'image' as const });

function armar(opts: Parameters<typeof fakeInstagram>[0] = {}, dbExtra: Record<string, unknown> = {}) {
  const { prisma, filas } = baseDeDatos(dbExtra);
  const { ig, graph, pedidos } = fakeInstagram(opts);
  const medios = fakeMedios();
  const svc = new InstagramPublicacionesService(prisma, medios, ig);
  jest.spyOn(svc as any, 'pausa').mockResolvedValue(undefined);
  return { svc, prisma, filas, ig, graph, pedidos, medios };
}

describe('InstagramPublicacionesService (unit)', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('crear: validaciones', () => {
    it('sin el permiso de publicar no sube nada', async () => {
      const { svc, medios, graph } = armar({ puedePublicar: false });
      await expect(svc.crear(BIZ, 'm-1', { caption: 'hola', formato: 'cuadrado', items: [foto()] })).rejects.toBeInstanceOf(ForbiddenException);
      expect(medios.resolver).not.toHaveBeenCalled();
      expect(graph).not.toHaveBeenCalled();
    });

    it('busca el producto en ESE negocio y no publica uno ajeno, inexistente o sin publicar', async () => {
      const ajeno = armar({}, { product: { findFirst: jest.fn().mockResolvedValue(null) } });
      await expect(ajeno.svc.crear(BIZ, 'm-1', { productId: 'p-1', caption: 'x', formato: 'cuadrado', items: [foto()] })).rejects.toBeInstanceOf(NotFoundException);
      expect(ajeno.prisma.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p-1', businessId: BIZ } }));
      const borrador = armar({}, { product: { findFirst: jest.fn().mockResolvedValue({ id: 'p-1', name: 'X', status: 'DRAFT' }) } });
      await expect(borrador.svc.crear(BIZ, 'm-1', { productId: 'p-1', caption: 'x', formato: 'cuadrado', items: [foto()] })).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(borrador.medios.resolver).not.toHaveBeenCalled();
    });

    it('lleva de 1 a 10 elementos', async () => {
      const { svc } = armar();
      await expect(svc.crear(BIZ, 'm-1', { caption: 'x', formato: 'cuadrado', items: [] })).rejects.toBeInstanceOf(BadRequestException);
      const once = Array.from({ length: 11 }, () => foto());
      await expect(svc.crear(BIZ, 'm-1', { caption: 'x', formato: 'cuadrado', items: once })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('no hace falta un producto: alcanza con archivos subidos', async () => {
      const { svc, prisma } = armar();
      const p = await svc.crear(BIZ, 'm-1', { caption: 'Novedades', formato: 'cuadrado', items: [subida()] });
      expect(prisma.product.findFirst).not.toHaveBeenCalled();
      expect(p.productId).toBeNull();
      expect(p.estado).toBe('PUBLISHED');
    });

    it('si falla preparar un archivo, borra los que ya había preparado y no crea nada', async () => {
      const { svc, medios, graph, prisma } = armar();
      medios.resolver.mockImplementationOnce(async () => ({ tipo: 'image', url: 'https://tmp.test/1.jpg', temporales: ['t1'], miniatura: null }));
      medios.resolver.mockImplementationOnce(async () => { throw new UnprocessableEntityException('La segunda no sirve'); });
      await expect(svc.crear(BIZ, 'm-1', { caption: 'x', formato: 'cuadrado', items: [foto(), foto()] })).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(medios.limpiar).toHaveBeenCalledWith(['t1']);
      expect(graph).not.toHaveBeenCalled();
      expect(prisma.instagramPost.create).not.toHaveBeenCalled();
    });
  });

  describe('una foto', () => {
    it('crea el contenedor con la imagen y el texto, y como ya está lista la publica en la misma llamada', async () => {
      const { svc, pedidos, medios, filas } = armar();
      const p = await svc.crear(BIZ, 'm-1', { productId: 'p-1', caption: 'Remera lisa $15.000', formato: 'vertical', items: [foto()] });

      expect(medios.resolver).toHaveBeenCalledWith(BIZ, foto(), 'vertical', true);
      const creacion = pedidos.find((x) => x.ruta === '{ig}/media')!;
      expect(creacion.init.cuerpo).toEqual({ image_url: 'https://tmp.test/1.jpg', caption: 'Remera lisa $15.000' });
      expect(creacion.init.metodo).toBe('POST');
      expect(pedidos.find((x) => x.ruta === '{ig}/media_publish')!.init.cuerpo).toEqual({ creation_id: 'c-1' });
      expect(p).toMatchObject({ estado: 'PUBLISHED', tipo: 'IMAGE', productName: 'Remera lisa', permalink: 'https://www.instagram.com/p/abc/', elementos: ['image'], miniatura: 'https://mini.test/1.jpg' });
      expect(filas.get(p.id).igMediaId).toBe('media-9');
      expect(medios.limpiar).toHaveBeenCalledWith(['t1']);
    });
  });

  describe('un video', () => {
    it('se manda como reel y, si Instagram todavía lo procesa, queda en PROCESSING hasta que se llame a continuar', async () => {
      const { svc, pedidos, medios } = armar({ estados: { 'c-1': ['IN_PROGRESS'] } });
      const p = await svc.crear(BIZ, 'm-1', { caption: 'Mirá esto', formato: 'cuadrado', items: [video()] });

      expect(pedidos.find((x) => x.ruta === '{ig}/media')!.init.cuerpo).toEqual({ media_type: 'REELS', video_url: 'https://tmp.test/1.mp4', share_to_feed: true, caption: 'Mirá esto' });
      expect(p).toMatchObject({ estado: 'PROCESSING', tipo: 'VIDEO', elementos: ['video'], miniatura: null });
      expect(pedidos.some((x) => x.ruta === '{ig}/media_publish')).toBe(false);
      expect(medios.limpiar).not.toHaveBeenCalled();
    });

    it('al terminar de procesar, continuar la publica y borra los temporales', async () => {
      const { svc, medios } = armar({ estados: { 'c-1': [...PROCESA_Y_TERMINA] } });
      const p = await svc.crear(BIZ, 'm-1', { caption: 'x', formato: 'cuadrado', items: [video()] });
      expect(p.estado).toBe('PROCESSING');
      const listo = await svc.continuar(BIZ, p.id);
      expect(listo.estado).toBe('PUBLISHED');
      expect(medios.limpiar).toHaveBeenCalledWith(['t1']);
    });

    it('si Instagram no puede procesar el video, queda FAILED con el motivo y los temporales se borran', async () => {
      const { svc, medios } = armar({ estados: { 'c-1': ['ERROR'] } });
      const p = await svc.crear(BIZ, 'm-1', { caption: 'x', formato: 'cuadrado', items: [video()] });
      expect(p.estado).toBe('FAILED');
      expect(p.error).toMatch(/no pudo procesar/i);
      expect(medios.limpiar).toHaveBeenCalledWith(['t1']);
    });
  });

  describe('un carrusel', () => {
    it('crea un contenedor por elemento (foto o video), arma el carrusel cuando todos están listos y publica', async () => {
      const { svc, pedidos } = armar();
      const p = await svc.crear(BIZ, 'm-1', { caption: 'Colección nueva', formato: 'cuadrado', items: [foto(), subida(), video()] });

      const medioCalls = pedidos.filter((x) => x.ruta === '{ig}/media').map((x) => x.init.cuerpo);
      expect(medioCalls[0]).toEqual({ image_url: 'https://tmp.test/1.jpg', is_carousel_item: true });
      expect(medioCalls[1]).toEqual({ image_url: 'https://tmp.test/2.jpg', is_carousel_item: true });
      expect(medioCalls[2]).toEqual({ media_type: 'VIDEO', video_url: 'https://tmp.test/3.mp4', is_carousel_item: true });
      // El texto va en el carrusel, no en cada elemento.
      expect(medioCalls[3]).toEqual({ media_type: 'CAROUSEL', children: 'c-1,c-2,c-3', caption: 'Colección nueva' });
      expect(pedidos.find((x) => x.ruta === '{ig}/media_publish')!.init.cuerpo).toEqual({ creation_id: 'c-4' });
      expect(p).toMatchObject({ estado: 'PUBLISHED', tipo: 'CAROUSEL', elementos: ['image', 'image', 'video'] });
    });

    it('no arma el carrusel hasta que todos los elementos estén listos', async () => {
      const { svc, pedidos } = armar({ estados: { 'c-2': ['IN_PROGRESS'] } });
      const p = await svc.crear(BIZ, 'm-1', { caption: 'x', formato: 'cuadrado', items: [foto(), video()] });
      expect(p.estado).toBe('PROCESSING');
      expect(pedidos.filter((x) => x.ruta === '{ig}/media' && x.init.cuerpo.media_type === 'CAROUSEL')).toHaveLength(0);
    });

    it('si uno de los elementos falla, toda la publicación falla y se limpian los temporales', async () => {
      const { svc, medios } = armar({ estados: { 'c-2': ['ERROR'] } });
      const p = await svc.crear(BIZ, 'm-1', { caption: 'x', formato: 'cuadrado', items: [foto(), foto()] });
      expect(p.estado).toBe('FAILED');
      expect(medios.limpiar).toHaveBeenCalledWith(['t1', 't2']);
    });
  });

  describe('continuar', () => {
    it('solo ve publicaciones de su negocio', async () => {
      const { svc, prisma } = armar();
      await expect(svc.continuar('otro-negocio', 'post-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.instagramPost.findFirst).toHaveBeenCalledWith({ where: { id: 'post-1', businessId: 'otro-negocio' } });
    });

    it('una publicación ya publicada se devuelve tal cual, sin llamar a Instagram', async () => {
      const { svc, graph } = armar();
      const p = await svc.crear(BIZ, 'm-1', { caption: 'x', formato: 'cuadrado', items: [foto()] });
      const llamadas = graph.mock.calls.length;
      expect((await svc.continuar(BIZ, p.id)).estado).toBe('PUBLISHED');
      expect(graph.mock.calls.length).toBe(llamadas);
    });

    it('con el candado tomado por otra llamada no vuelve a publicar', async () => {
      const { svc, prisma, pedidos } = armar({ estados: { 'c-1': [...PROCESA_Y_TERMINA] } });
      const p = await svc.crear(BIZ, 'm-1', { caption: 'x', formato: 'cuadrado', items: [video()] });
      prisma.instagramPost.updateMany.mockResolvedValueOnce({ count: 0 });
      await svc.continuar(BIZ, p.id);
      expect(pedidos.some((x) => x.ruta === '{ig}/media_publish')).toBe(false);
    });

    it('si Instagram rechaza la publicación (error de 4xx), queda FAILED con el motivo', async () => {
      const { svc, medios } = armar({ errorAlPublicar: new BadRequestException('Instagram respondió con un error: límite diario de publicaciones') });
      const p = await svc.crear(BIZ, 'm-1', { caption: 'x', formato: 'cuadrado', items: [foto()] });
      expect(p.estado).toBe('FAILED');
      expect(p.error).toMatch(/límite diario/);
      expect(medios.limpiar).toHaveBeenCalled();
    });

    it('una publicación que lleva más de 30 minutos procesando se da por fallada', async () => {
      const { svc, filas } = armar({ estados: { 'c-1': ['IN_PROGRESS'] } });
      const p = await svc.crear(BIZ, 'm-1', { caption: 'x', formato: 'cuadrado', items: [video()] });
      filas.get(p.id).createdAt = new Date(Date.now() - 31 * 60 * 1000);
      const r = await svc.continuar(BIZ, p.id);
      expect(r.estado).toBe('FAILED');
      expect(r.error).toMatch(/tardó demasiado/);
    });

    it('si quedó "publicando" hace rato, no se reintenta a ciegas: se avisa que revise Instagram', async () => {
      const { svc, filas, pedidos } = armar({ estados: { 'c-1': ['IN_PROGRESS'] } });
      const p = await svc.crear(BIZ, 'm-1', { caption: 'x', formato: 'cuadrado', items: [video()] });
      Object.assign(filas.get(p.id), { status: 'PUBLISHING', updatedAt: new Date(Date.now() - 5 * 60 * 1000) });
      const r = await svc.continuar(BIZ, p.id);
      expect(r.estado).toBe('FAILED');
      expect(r.error).toMatch(/Revisá tu Instagram/);
      expect(pedidos.some((x) => x.ruta === '{ig}/media_publish')).toBe(false);
    });
  });

  it('el historial se pide solo de ese negocio', async () => {
    const { svc, prisma } = armar();
    await svc.listar(BIZ);
    expect(prisma.instagramPost.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: BIZ }, take: 30 }));
  });
});

// ─── Archivos ──────────────────────────────────────────────────────────────────────

describe('InstagramMediosService (unit)', () => {
  const crear = (prismaExtra: Record<string, unknown> = {}, almacenExtra: Record<string, unknown> = {}) => {
    const almacen = {
      upload: jest.fn().mockResolvedValue({ error: null }),
      getPublicUrl: jest.fn().mockImplementation((ruta: string) => ({ data: { publicUrl: `https://cdn.test/${ruta}` } })),
      createSignedUploadUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'https://firma.test/u', token: 'tok' }, error: null }),
      exists: jest.fn().mockResolvedValue(true),
      download: jest.fn(),
      remove: jest.fn().mockResolvedValue({ error: null }),
      ...almacenExtra,
    };
    const storage = { from: jest.fn().mockReturnValue(almacen), createBucket: jest.fn().mockResolvedValue({ error: null }) };
    const prisma: any = { productImage: { findFirst: jest.fn().mockResolvedValue({ id: 'img-1' }) }, ...prismaExtra };
    const svc = new InstagramMediosService(prisma, { adminClient: { storage } } as any);
    return { svc, prisma, almacen, storage };
  };
  const png = (ancho: number, alto: number) => sharp({ create: { width: ancho, height: alto, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 0.5 } } }).png().toBuffer();
  const archivo = (buffer: Buffer, mimetype = 'image/png'): any => ({ buffer, mimetype, size: buffer.length });
  afterEach(() => jest.restoreAllMocks());

  describe('subirFoto', () => {
    it('guarda un JPEG enderezado en la carpeta del negocio y el bucket se crea una sola vez', async () => {
      const { svc, almacen, storage } = crear();
      const r = await svc.subirFoto(BIZ, archivo(await png(3000, 1500)));
      const [ruta, jpeg, opciones] = almacen.upload.mock.calls[0];
      expect(ruta).toMatch(new RegExp(`^${BIZ}/subidas/.+\\.jpg$`));
      expect(opciones.contentType).toBe('image/jpeg');
      const meta = await sharp(jpeg).metadata();
      expect(meta.format).toBe('jpeg');
      expect(Math.max(meta.width!, meta.height!)).toBe(2048);
      expect(r).toEqual({ ref: ruta, tipo: 'image', url: `https://cdn.test/${ruta}` });
      await svc.subirFoto(BIZ, archivo(await png(100, 100)));
      expect(storage.createBucket).toHaveBeenCalledTimes(1);
      expect(storage.createBucket).toHaveBeenCalledWith('instagram-media', expect.objectContaining({ public: true }));
    });

    it('rechaza lo que no es una foto JPG, PNG o WebP, lo muy pesado y lo que no se puede leer', async () => {
      const { svc } = crear();
      await expect(svc.subirFoto(BIZ, undefined)).rejects.toBeInstanceOf(BadRequestException);
      await expect(svc.subirFoto(BIZ, archivo(Buffer.from('x'), 'application/pdf'))).rejects.toBeInstanceOf(BadRequestException);
      await expect(svc.subirFoto(BIZ, { ...archivo(Buffer.from('x')), size: 11 * 1024 * 1024 })).rejects.toBeInstanceOf(BadRequestException);
      await expect(svc.subirFoto(BIZ, archivo(Buffer.from('no es una imagen')))).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('prepararVideo', () => {
    it('devuelve una dirección firmada para subir directo, en la carpeta del negocio', async () => {
      const { svc, almacen } = crear();
      const r = await svc.prepararVideo(BIZ, 'video/mp4', 20 * 1024 * 1024);
      expect(r.ref).toMatch(new RegExp(`^${BIZ}/subidas/.+\\.mp4$`));
      expect(almacen.createSignedUploadUrl).toHaveBeenCalledWith(r.ref);
      expect(r).toMatchObject({ tipo: 'video', url: `https://cdn.test/${r.ref}`, subida: { url: 'https://firma.test/u', token: 'tok' } });
      expect((await svc.prepararVideo(BIZ, 'video/quicktime', 1000)).ref).toMatch(/\.mov$/);
    });

    it('solo acepta MP4 o MOV y respeta el tope de tamaño', async () => {
      const { svc } = crear();
      await expect(svc.prepararVideo(BIZ, 'video/avi', 1000)).rejects.toBeInstanceOf(BadRequestException);
      await expect(svc.prepararVideo(BIZ, 'video/mp4', MAX_VIDEO_BYTES + 1)).rejects.toBeInstanceOf(BadRequestException);
      await expect(svc.prepararVideo(BIZ, 'video/mp4', 0)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('resolver', () => {
    it('una foto de producto: solo si es de un producto de ESE negocio, y la deja en JPEG del formato elegido', async () => {
      const { svc, prisma, almacen } = crear();
      const original = await png(40, 20);
      jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, arrayBuffer: async () => original.buffer.slice(original.byteOffset, original.byteOffset + original.byteLength) } as any);

      const cuadrada = await svc.resolver(BIZ, foto('https://cdn.test/a.webp'), 'cuadrado', true);
      expect(prisma.productImage.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { url: 'https://cdn.test/a.webp', product: { businessId: BIZ } } }));
      const m1 = await sharp(almacen.upload.mock.calls[0][1]).metadata();
      expect([m1.format, m1.width, m1.height]).toEqual(['jpeg', 1080, 1080]);
      expect(cuadrada).toMatchObject({ tipo: 'image', miniatura: 'https://cdn.test/a.webp' });
      expect(cuadrada.temporales).toHaveLength(1);

      await svc.resolver(BIZ, foto('https://cdn.test/a.webp'), 'vertical', false);
      const m2 = await sharp(almacen.upload.mock.calls[1][1]).metadata();
      expect([m2.width, m2.height]).toEqual([1080, 1350]);
    });

    it('una foto que no es de un producto del negocio no se usa', async () => {
      const { svc } = crear({ productImage: { findFirst: jest.fn().mockResolvedValue(null) } });
      await expect(svc.resolver(BIZ, foto('https://cdn.test/ajena.webp'), 'cuadrado', false)).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('solo baja fotos de direcciones https públicas', async () => {
      const { svc } = crear();
      for (const url of ['http://cdn.com/f.webp', 'https://localhost/f.webp', 'https://10.0.0.5/f.webp', 'https://servicio.internal/f.webp']) {
        await expect(svc.resolver(BIZ, foto(url), 'cuadrado', false)).rejects.toBeInstanceOf(UnprocessableEntityException);
      }
    });

    it('una subida tiene que ser de la carpeta del propio negocio', async () => {
      const { svc } = crear();
      for (const ref of [`otro-negocio/subidas/f.jpg`, `${BIZ}/subidas/../otro/f.jpg`, `${BIZ}/publicaciones/f.jpg`, `${BIZ}/subidas/a/b.jpg`, '../f.jpg']) {
        await expect(svc.resolver(BIZ, subida(ref), 'cuadrado', false)).rejects.toBeInstanceOf(BadRequestException);
        await expect(svc.resolver(BIZ, video(ref), 'cuadrado', false)).rejects.toBeInstanceOf(BadRequestException);
      }
    });

    it('un video subido se manda tal cual; si no terminó de subirse, se avisa', async () => {
      const { svc } = crear();
      const r = await svc.resolver(BIZ, video(), 'cuadrado', false);
      expect(r).toEqual({ tipo: 'video', url: `https://cdn.test/${BIZ}/subidas/v.mp4`, temporales: [`${BIZ}/subidas/v.mp4`], miniatura: null });
      const sinArchivo = crear({}, { exists: jest.fn().mockResolvedValue(false) });
      await expect(sinArchivo.svc.resolver(BIZ, video(), 'cuadrado', false)).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('una foto subida se baja del almacenamiento, se prepara, y guarda una miniatura que no se borra', async () => {
      const original = await png(60, 90);
      const { svc, almacen } = crear({}, { download: jest.fn().mockResolvedValue({ data: { arrayBuffer: async () => original.buffer.slice(original.byteOffset, original.byteOffset + original.byteLength) }, error: null }) });
      const r = await svc.resolver(BIZ, subida(), 'cuadrado', true);
      expect(almacen.download).toHaveBeenCalledWith(`${BIZ}/subidas/f.jpg`);
      expect(r.temporales).toHaveLength(2);
      expect(r.temporales[0]).toBe(`${BIZ}/subidas/f.jpg`);
      expect(r.miniatura).toMatch(new RegExp(`^https://cdn.test/${BIZ}/miniaturas/`));
      expect(r.temporales).not.toContain(r.miniatura);
    });
  });

  it('limpiar borra lo que se le pasa y nunca tira', async () => {
    const { svc, almacen } = crear({}, { remove: jest.fn().mockResolvedValue({ error: { message: 'x' } }) });
    await expect(svc.limpiar(['a', 'b'])).resolves.toBeUndefined();
    expect(almacen.remove).toHaveBeenCalledWith(['a', 'b']);
    await svc.limpiar([]);
    expect(almacen.remove).toHaveBeenCalledTimes(1);
  });
});
