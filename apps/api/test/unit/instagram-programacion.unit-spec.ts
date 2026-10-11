import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InstagramPublicacionesService, MIN_ANTICIPACION_MS } from '../../src/instagram/instagram-publicaciones.service';

// Publicaciones programadas y borradores: que una programada salga una sola vez y a su hora, que un archivo de otro
// negocio no se pueda colar, que lo que ya salió no se pueda cambiar, y que un fallo de una no frene a las demás.

const BIZ = 'biz-1';
const HORA = 60 * 60 * 1000;
const dentroDe = (ms: number) => new Date(Date.now() + ms);

const foto = (ref = 'https://cdn.test/a.webp') => ({ origen: 'producto' as const, ref, tipo: 'image' as const });
const subida = (ref = `${BIZ}/subidas/f.jpg`) => ({ origen: 'subida' as const, ref, tipo: 'image' as const });

function armar(opts: { puedePublicar?: boolean; errorAlLanzar?: Error } = {}) {
  const filas = new Map<string, any>();
  let n = 0;
  const cumple = (f: any, where: any): boolean =>
    Object.entries(where).every(([k, v]: [string, any]) => {
      if (v && typeof v === 'object' && 'in' in v) return v.in.includes(f[k]);
      if (v && typeof v === 'object' && 'lte' in v) return f[k] !== null && f[k] <= v.lte;
      return f[k] === v;
    });
  const prisma: any = {
    instagramPost: {
      create: jest.fn().mockImplementation(async ({ data }) => {
        const id = `post-${++n}`;
        const fila = { id, businessId: BIZ, igMediaId: null, permalink: null, error: null, createdAt: new Date(), updatedAt: new Date(), tempPaths: [], childContainerIds: [], containerId: null, ...data };
        filas.set(id, fila);
        return { ...fila };
      }),
      findFirst: jest.fn().mockImplementation(async ({ where }) => {
        const f = [...filas.values()].find((x) => cumple(x, where));
        return f ? { ...f } : null;
      }),
      findMany: jest.fn().mockImplementation(async ({ where }) => [...filas.values()].filter((x) => cumple(x, where)).map((x) => ({ ...x }))),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        const f = filas.get(where.id);
        Object.assign(f, data, { updatedAt: new Date() });
        return { ...f };
      }),
      updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
        const f = [...filas.values()].find((x) => cumple(x, where));
        if (!f) return { count: 0 };
        Object.assign(f, data, { updatedAt: new Date() });
        return { count: 1 };
      }),
      deleteMany: jest.fn().mockImplementation(async ({ where }) => {
        const f = [...filas.values()].find((x) => cumple(x, where));
        if (!f) return { count: 0 };
        filas.delete(f.id);
        return { count: 1 };
      }),
    },
    product: { findFirst: jest.fn().mockResolvedValue({ id: 'p-1', name: 'Remera', status: 'PUBLISHED' }) },
  };
  let contenedores = 0;
  const graph = jest.fn().mockImplementation(async (_b: string, _p: string, ruta: string, init: any = {}) => {
    if (ruta === '{ig}/media') {
      if (opts.errorAlLanzar) throw opts.errorAlLanzar;
      return { id: `c-${++contenedores}` };
    }
    if (ruta === '{ig}/media_publish') return { id: 'media-9' };
    if (init.query?.fields === 'permalink') return { permalink: 'https://www.instagram.com/p/abc/' };
    if (init.query?.fields === 'status_code,status') return { status_code: 'FINISHED' };
    throw new Error(`ruta inesperada ${ruta}`);
  });
  const ig: any = { asegurarHabilitado: jest.fn().mockResolvedValue(undefined), puedePublicar: jest.fn().mockResolvedValue(opts.puedePublicar ?? true), graph };
  const medios: any = {
    validar: jest.fn().mockResolvedValue(undefined),
    vistaDe: jest.fn().mockImplementation((_b: string, i: any) => (i.origen === 'producto' ? i.ref : `https://cdn.test/${i.ref}`)),
    resolver: jest.fn().mockImplementation(async (_b: string, item: any, _f: string, mini: boolean) => ({ tipo: item.tipo, url: `https://tmp.test/${item.ref}`, temporales: [`t-${item.ref}`], miniatura: mini ? 'https://mini.test/m.jpg' : null })),
    limpiar: jest.fn().mockResolvedValue(undefined),
    limpiarSubidas: jest.fn().mockResolvedValue(undefined),
  };
  const svc = new InstagramPublicacionesService(prisma, medios, ig);
  jest.spyOn(svc as any, 'pausa').mockResolvedValue(undefined);
  return { svc, prisma, filas, ig, medios, graph };
}

const dto = (extra: Record<string, unknown> = {}) => ({ caption: 'Hola', formato: 'cuadrado' as const, items: [foto()], ...extra });

describe('programar', () => {
  it('guarda el plan con su hora, sin crear ningún contenedor en Instagram', async () => {
    const { svc, filas, graph } = armar();
    const cuando = dentroDe(2 * HORA);
    const v = await svc.programar(BIZ, 'm-1', dto({ productId: 'p-1' }), cuando);
    expect(v).toMatchObject({ estado: 'SCHEDULED', programadaPara: cuando, tipo: 'IMAGE', formato: 'cuadrado' });
    expect(v.items).toEqual([{ ...foto(), vista: 'https://cdn.test/a.webp' }]);
    expect([...filas.values()][0].plan).toEqual({ formato: 'cuadrado', items: [foto()] });
    expect(graph).not.toHaveBeenCalled();
  });

  it('rechaza una hora demasiado cercana, una muy lejana y una publicación sin elementos', async () => {
    const { svc } = armar();
    await expect(svc.programar(BIZ, undefined, dto(), dentroDe(MIN_ANTICIPACION_MS - 60_000))).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.programar(BIZ, undefined, dto(), dentroDe(80 * 24 * HORA))).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.programar(BIZ, undefined, dto({ items: [] }), dentroDe(2 * HORA))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('comprueba que cada archivo sea del negocio antes de guardarla', async () => {
    const { svc, medios, filas } = armar();
    medios.validar.mockRejectedValueOnce(new BadRequestException('Archivo inválido.'));
    await expect(svc.programar(BIZ, undefined, dto({ items: [subida('otro/subidas/x.jpg')] }), dentroDe(2 * HORA))).rejects.toBeInstanceOf(BadRequestException);
    expect(filas.size).toBe(0);
  });

  it('un carrusel de varios elementos queda como CAROUSEL', async () => {
    const { svc } = armar();
    const v = await svc.programar(BIZ, undefined, dto({ items: [foto('a'), foto('b'), foto('c')] }), dentroDe(2 * HORA));
    expect(v.tipo).toBe('CAROUSEL');
    expect(v.elementos).toEqual(['image', 'image', 'image']);
  });

  it('con id reprograma esa misma fila; si ya salió, no se puede cambiar', async () => {
    const { svc, filas } = armar();
    const v = await svc.programar(BIZ, undefined, dto(), dentroDe(2 * HORA));
    const nueva = dentroDe(5 * HORA);
    const r = await svc.programar(BIZ, undefined, dto({ id: v.id, caption: 'Otro texto' }), nueva);
    expect(r.id).toBe(v.id);
    expect(filas.size).toBe(1);
    expect(r.caption).toBe('Otro texto');
    filas.get(v.id).status = 'PUBLISHED';
    await expect(svc.programar(BIZ, undefined, dto({ id: v.id }), nueva)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('borradores', () => {
  it('se guardan a medias (sin fotos) y sin hora', async () => {
    const { svc } = armar();
    const v = await svc.guardarBorrador(BIZ, undefined, dto({ items: [], caption: 'Pendiente' }));
    expect(v).toMatchObject({ estado: 'DRAFT', programadaPara: null, caption: 'Pendiente', items: [] });
  });

  it('una programada se puede pasar a borrador; una ya publicada no', async () => {
    const { svc, filas } = armar();
    const p = await svc.programar(BIZ, undefined, dto(), dentroDe(2 * HORA));
    const b = await svc.pasarABorrador(BIZ, p.id);
    expect(b).toMatchObject({ estado: 'DRAFT', programadaPara: null });
    filas.get(p.id).status = 'PUBLISHED';
    await expect(svc.pasarABorrador(BIZ, p.id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('descartar borra la fila y las subidas que tenía, pero solo un borrador o una programada', async () => {
    const { svc, filas, medios } = armar();
    const p = await svc.programar(BIZ, undefined, dto({ items: [subida()] }), dentroDe(2 * HORA));
    await svc.descartar(BIZ, p.id);
    expect(filas.size).toBe(0);
    expect(medios.limpiarSubidas).toHaveBeenCalledWith(BIZ, [subida()]);
    const q = await svc.programar(BIZ, undefined, dto(), dentroDe(2 * HORA));
    filas.get(q.id).status = 'PUBLISHED';
    await expect(svc.descartar(BIZ, q.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('procesarPendientes (el disparo de cada 5 minutos)', () => {
  const vencida = async (svc: InstagramPublicacionesService, filas: Map<string, any>, extra: Record<string, unknown> = {}) => {
    const v = await svc.programar(BIZ, undefined, dto(extra), dentroDe(2 * HORA));
    filas.get(v.id).scheduledAt = new Date(Date.now() - 60_000);
    return v.id;
  };

  it('no toca lo que todavía no llegó a su hora', async () => {
    const { svc, graph } = armar();
    await svc.programar(BIZ, undefined, dto(), dentroDe(2 * HORA));
    await expect(svc.procesarPendientes()).resolves.toMatchObject({ lanzadas: 0 });
    expect(graph).not.toHaveBeenCalled();
  });

  it('lanza la vencida (contenedor en Instagram) y la publica cuando Instagram terminó de procesar', async () => {
    const { svc, filas, graph } = armar();
    const id = await vencida(svc, filas);
    const r = await svc.procesarPendientes();
    expect(r.lanzadas).toBe(1);
    expect(graph).toHaveBeenCalledWith(BIZ, expect.anything(), '{ig}/media', expect.objectContaining({ cuerpo: expect.objectContaining({ image_url: 'https://tmp.test/https://cdn.test/a.webp', caption: 'Hola' }) }));
    // El mismo disparo ya la sigue avanzando: con la foto lista sale.
    expect(filas.get(id)).toMatchObject({ status: 'PUBLISHED', igMediaId: 'media-9' });
  });

  it('dos disparos a la vez no la lanzan dos veces', async () => {
    const { svc, filas, graph } = armar();
    await vencida(svc, filas);
    await Promise.all([svc.procesarPendientes(), svc.procesarPendientes()]);
    const contenedores = graph.mock.calls.filter((c) => c[2] === '{ig}/media');
    expect(contenedores).toHaveLength(1);
  });

  it('si no se puede lanzar queda FAILED con el motivo y las demás siguen', async () => {
    const { svc, filas } = armar({ errorAlLanzar: new BadRequestException('Instagram rechazó el archivo') });
    const a = await vencida(svc, filas);
    const b = await vencida(svc, filas);
    const r = await svc.procesarPendientes();
    expect(r.falladas).toBe(2);
    expect(filas.get(a)).toMatchObject({ status: 'FAILED', error: 'Instagram rechazó el archivo' });
    expect(filas.get(b).status).toBe('FAILED');
  });

  it('sin el permiso de publicar no se lanza: queda FAILED explicando cómo arreglarlo', async () => {
    const { svc, filas, graph, ig } = armar();
    const id = await vencida(svc, filas);
    // Se programó con el permiso; a la hora de publicar, la conexión ya no lo tiene.
    ig.puedePublicar.mockResolvedValue(false);
    await svc.procesarPendientes();
    expect(filas.get(id).status).toBe('FAILED');
    expect(filas.get(id).error).toMatch(/permiso de publicar/);
    expect(graph).not.toHaveBeenCalled();
  });

  it('una programada que se pasó muchas horas de su hora ya no se publica', async () => {
    const { svc, filas, graph } = armar();
    const id = await vencida(svc, filas);
    filas.get(id).scheduledAt = new Date(Date.now() - 8 * HORA);
    await svc.procesarPendientes();
    expect(filas.get(id).status).toBe('FAILED');
    expect(graph).not.toHaveBeenCalled();
  });
});
