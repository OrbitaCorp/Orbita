import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TutorialesService } from '../../src/marketing/videos/tutoriales.service';
import { idDeYoutube } from '../../src/marketing/videos/youtube';

// La lista de tutoriales (qué hay y qué falta): se lee agrupada con un resumen y se actualiza por id o por título, con el
// estado EN_REVISION reservado para el sistema. Cada tutorial es de un módulo: la lista se filtra por módulo, el panel de
// Tienda recibe solo lo suyo y el responsable de cada módulo nuevo carga su lista (crear). Base simulada.

type Fila = Record<string, any>;
const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const ID_G = '44444444-4444-4444-8444-444444444444';

// Un pedazo de la lista de Gimnasio, para los casos de módulos: dos grupos, y un tutorial con link y pantalla.
const GIMNASIO: Fila[] = [
  { id: ID_G, modulo: 'gimnasio', grupo: 'Arrancar', grupoOrden: 1, orden: 1, titulo: 'Conocé tu panel de Gimnasio', estado: 'HECHO', opcional: false, prioridadAlta: true, notas: null, youtubeId: 'aBcDeFgHiJk', pantallas: ['gimnasio/inicio'], updatedAt: new Date() },
  { id: '55555555-5555-4555-8555-555555555555', modulo: 'gimnasio', grupo: 'Arrancar', grupoOrden: 1, orden: 2, titulo: 'Cargar tus planes', estado: 'FALTA', opcional: false, prioridadAlta: false, notas: null, youtubeId: null, pantallas: [], updatedAt: new Date() },
  { id: '66666666-6666-4666-8666-666666666666', modulo: 'gimnasio', grupo: 'Clases', grupoOrden: 2, orden: 1, titulo: 'Armar la grilla de clases', estado: 'EN_PROCESO', opcional: false, prioridadAlta: false, notas: null, youtubeId: null, pantallas: ['gimnasio/clases'], updatedAt: new Date() },
];

/** Lo que filtra la base simulada: estado, módulo y, para el panel, que tenga link y alguna pantalla. */
const cumple = (f: Fila, w: Fila = {}) =>
  (!w.estado || f.estado === w.estado) &&
  (!w.modulo || f.modulo === w.modulo) &&
  (!w.youtubeId || f.youtubeId != null) &&
  (!w.NOT?.pantallas?.isEmpty || f.pantallas.length > 0);

function armar(extra: Fila[] = []) {
  const filas: Fila[] = [
    { id: ID_A, modulo: 'tienda', grupo: 'Catálogo', grupoOrden: 2, orden: 1, titulo: 'Cargar un producto', estado: 'HECHO', opcional: false, prioridadAlta: false, notas: null, youtubeId: null, pantallas: [], updatedAt: new Date() },
    { id: ID_B, modulo: 'tienda', grupo: 'Vender día a día', grupoOrden: 3, orden: 1, titulo: 'Atender un pedido', estado: 'FALTA', opcional: false, prioridadAlta: true, notas: null, youtubeId: null, pantallas: [], updatedAt: new Date() },
    { id: '33333333-3333-4333-8333-333333333333', modulo: 'tienda', grupo: 'Vender día a día', grupoOrden: 3, orden: 2, titulo: 'Pedidos en lote', estado: 'EN_REVISION', opcional: false, prioridadAlta: false, notas: null, youtubeId: null, pantallas: [], updatedAt: new Date() },
    // Copias: los casos cambian filas y GIMNASIO es de todos.
    ...extra.map((f) => ({ ...f, pantallas: [...f.pantallas] })),
  ];
  const videos: Fila[] = [{ id: 'video-1', tutorialId: '33333333-3333-4333-8333-333333333333', estado: 'PENDIENTE' }];
  const prisma = {
    marketingTutorial: {
      // Como Prisma: filtra y, si se pide orden, ordena por grupo y dentro del grupo (sin mirar el módulo).
      findMany: jest.fn(async ({ where, orderBy }: { where?: Fila; orderBy?: unknown } = {}) => {
        const r = filas.filter((f) => cumple(f, where));
        return orderBy ? r.sort((a, b) => a.grupoOrden - b.grupoOrden || a.orden - b.orden) : r;
      }),
      groupBy: jest.fn(async ({ where }: { where?: Fila } = {}) => ['FALTA', 'EN_PROCESO', 'EN_REVISION', 'HECHO'].map((estado) => ({ estado, _count: { _all: filas.filter((f) => cumple(f, where) && f.estado === estado).length } })).filter((g) => g._count._all > 0)),
      // Como Prisma, cada lectura devuelve un objeto nuevo: lo leído antes de un update no cambia con él.
      findUnique: jest.fn(async ({ where }: { where: Fila }) => { const f = filas.find((x) => x.id === where.id); return f ? { ...f } : null; }),
      findFirst: jest.fn(async ({ where }: { where: Fila }) => { const f = filas.find((x) => x.titulo.toLowerCase() === String(where.titulo.equals).toLowerCase()); return f ? { ...f } : null; }),
      update: jest.fn(async ({ where, data }: { where: Fila; data: Fila }) => { const f = filas.find((x) => x.id === where.id)!; Object.assign(f, data); return { ...f }; }),
      create: jest.fn(async ({ data }: { data: Fila }) => { const f: Fila = { id: `nuevo-${filas.length}`, asignadoA: null, youtubeId: null, updatedAt: new Date(), ...data }; filas.push(f); return f; }),
    },
    marketingVideo: { findMany: jest.fn(async () => videos) },
    platformAdminLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return { svc: new TutorialesService(prisma as never), prisma, filas };
}

const ultima = (filas: Fila[]) => filas[filas.length - 1];

describe('lista de tutoriales', () => {
  it('se lee en orden de grupo, con el resumen de cuántos hay en cada estado y el video que espera revisión', async () => {
    const { svc } = armar();
    const r = await svc.listar();
    expect(r.resumen).toEqual({ total: 3, hechos: 1, enRevision: 1, enProceso: 0, faltan: 1 });
    expect(r.tutoriales.map((t) => [t.grupo, t.titulo, t.estado])).toEqual([
      ['Catálogo', 'Cargar un producto', 'HECHO'], ['Vender día a día', 'Atender un pedido', 'FALTA'], ['Vender día a día', 'Pedidos en lote', 'EN_REVISION'],
    ]);
    expect(r.tutoriales[2].videoId).toBe('video-1');
    expect(r.tutoriales[1]).toMatchObject({ prioridadAlta: true, videoId: null });
  });

  it('se puede filtrar por estado, y el resumen sigue contando todo', async () => {
    const { svc } = armar();
    const r = await svc.listar('FALTA');
    expect(r.tutoriales.map((t) => t.titulo)).toEqual(['Atender un pedido']);
    expect(r.resumen.total).toBe(3);
  });

  it('se actualiza por id o por título (sin importar mayúsculas) y queda anotado quién lo hizo', async () => {
    const { svc, filas, prisma } = armar();
    await svc.actualizar('admin-1', { tutorial: 'atender UN pedido', estado: 'EN_PROCESO', notas: ' arranca Alan ' });
    expect(filas[1]).toMatchObject({ estado: 'EN_PROCESO', notas: 'arranca Alan', actualizadoPor: 'admin-1' });
    await svc.actualizar('admin-2', { tutorial: ID_B, estado: 'FALTA' });
    expect(filas[1].estado).toBe('FALTA');
    expect(prisma.platformAdminLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'tutorial_actualizar', adminId: 'admin-2', targetId: ID_B }) });
  });

  it('solo notas también vale, y una nota vacía la borra', async () => {
    const { svc, filas } = armar();
    await svc.actualizar('admin-1', { tutorial: ID_B, notas: 'falta la demo' });
    expect(filas[1]).toMatchObject({ estado: 'FALTA', notas: 'falta la demo' });
    await svc.actualizar('admin-1', { tutorial: ID_B, notas: '' });
    expect(filas[1].notas).toBeNull();
  });

  it('EN_REVISION no se pone a mano (lo decide el sistema), ni un estado inventado, ni sin cambios', async () => {
    const { svc } = armar();
    await expect(svc.actualizar('admin-1', { tutorial: ID_B, estado: 'EN_REVISION' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.actualizar('admin-1', { tutorial: ID_B, estado: 'LISTO' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.actualizar('admin-1', { tutorial: ID_B })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un tutorial que no existe, o sin indicar cuál, se rechaza', async () => {
    const { svc } = armar();
    await expect(svc.actualizar('admin-1', { tutorial: 'No está', estado: 'HECHO' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.actualizar('admin-1', { tutorial: '  ', estado: 'HECHO' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('tutoriales en YouTube', () => {
  it('cargar el link lo deja HECHO con el id del video; vacío lo quita y el estado no cambia', async () => {
    const { svc, filas } = armar();
    const r = await svc.actualizar('admin-1', { tutorial: ID_B, youtube: 'https://youtu.be/dQw4w9WgXcQ?si=abc' });
    expect(r).toMatchObject({ estado: 'HECHO', youtubeId: 'dQw4w9WgXcQ' });
    await svc.actualizar('admin-1', { tutorial: ID_B, youtube: '' });
    expect(filas[1]).toMatchObject({ estado: 'HECHO', youtubeId: null });
  });

  it('con el link se puede mandar otro estado, y un link que no es de YouTube se rechaza', async () => {
    const { svc, filas } = armar();
    await svc.actualizar('admin-1', { tutorial: ID_B, youtube: 'dQw4w9WgXcQ', estado: 'EN_PROCESO' });
    expect(filas[1]).toMatchObject({ estado: 'EN_PROCESO', youtubeId: 'dQw4w9WgXcQ' });
    await expect(svc.actualizar('admin-1', { tutorial: ID_B, youtube: 'https://vimeo.com/123' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('las pantallas se reemplazan enteras, sin repetidas, y se validan', async () => {
    const { svc, filas } = armar();
    await svc.actualizar('admin-1', { tutorial: ID_B, pantallas: ['pedidos', ' Pedidos ', 'configuracion/apariencia'] });
    expect(filas[1].pantallas).toEqual(['pedidos', 'configuracion/apariencia']);
    await expect(svc.actualizar('admin-1', { tutorial: ID_B, pantallas: 'pedidos' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.actualizar('admin-1', { tutorial: ID_B, pantallas: ['../admin'] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.actualizar('admin-1', { tutorial: ID_B, pantallas: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('el panel recibe los que tienen link y pantalla', async () => {
    const { svc, prisma } = armar();
    prisma.marketingTutorial.findMany.mockResolvedValueOnce([{ titulo: 'Atender un pedido', youtubeId: 'dQw4w9WgXcQ', pantallas: ['pedidos'] }]);
    await expect(svc.videosDelPanel()).resolves.toEqual({ videos: [{ titulo: 'Atender un pedido', youtubeId: 'dQw4w9WgXcQ', pantallas: ['pedidos'] }] });
    expect(prisma.marketingTutorial.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { modulo: 'tienda', youtubeId: { not: null }, NOT: { pantallas: { isEmpty: true } } } }));
  });
});

describe('módulos', () => {
  it('cada tutorial dice de qué módulo es y, con todos, primero va Tienda y cada módulo conserva su orden', async () => {
    const { svc } = armar(GIMNASIO);
    const r = await svc.listar();
    expect(r.tutoriales.map((t) => [t.modulo, t.titulo])).toEqual([
      ['tienda', 'Cargar un producto'], ['tienda', 'Atender un pedido'], ['tienda', 'Pedidos en lote'],
      ['gimnasio', 'Conocé tu panel de Gimnasio'], ['gimnasio', 'Cargar tus planes'], ['gimnasio', 'Armar la grilla de clases'],
    ]);
    expect(r.resumen.total).toBe(6);
  });

  it('con módulo, la lista y el resumen son solo de ese módulo', async () => {
    const { svc } = armar(GIMNASIO);
    const gimnasio = await svc.listar(undefined, ' Gimnasio ');
    expect(gimnasio.tutoriales.map((t) => t.titulo)).toEqual(['Conocé tu panel de Gimnasio', 'Cargar tus planes', 'Armar la grilla de clases']);
    expect(gimnasio.resumen).toEqual({ total: 3, hechos: 1, enRevision: 0, enProceso: 1, faltan: 1 });
    const tienda = await svc.listar('FALTA', 'tienda');
    expect(tienda.tutoriales.map((t) => t.titulo)).toEqual(['Atender un pedido']);
    expect(tienda.resumen.total).toBe(3);
    expect((await svc.listar(undefined, 'alquileres')).tutoriales).toEqual([]);
  });

  it('un módulo que no existe es un error, no una lista vacía', async () => {
    const { svc } = armar(GIMNASIO);
    await expect(svc.listar(undefined, 'peluqueria')).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.videosDelPanel('peluqueria')).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.actualizar('admin-1', { tutorial: ID_B, modulo: 'peluqueria' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('el panel de Tienda, sin pedir módulo, recibe solo los de Tienda; el de un módulo, solo los suyos', async () => {
    const { svc, filas } = armar(GIMNASIO);
    Object.assign(filas[0], { youtubeId: 'dQw4w9WgXcQ', pantallas: ['catalogo'] });
    await expect(svc.videosDelPanel()).resolves.toEqual({ videos: [{ titulo: 'Cargar un producto', youtubeId: 'dQw4w9WgXcQ', pantallas: ['catalogo'] }] });
    await expect(svc.videosDelPanel('gimnasio')).resolves.toEqual({ videos: [{ titulo: 'Conocé tu panel de Gimnasio', youtubeId: 'aBcDeFgHiJk', pantallas: ['gimnasio/inicio'] }] });
  });

  it('crear lo deja en FALTA, al final de su grupo y en su módulo (el grupo se reconoce sin importar mayúsculas)', async () => {
    const { svc, filas, prisma } = armar(GIMNASIO);
    const r = await svc.crear('admin-1', { titulo: '  Reservar   una clase ', grupo: 'arrancar', modulo: 'gimnasio', pantallas: ['gimnasio/clases'] });
    expect(r).toMatchObject({ modulo: 'gimnasio', grupo: 'Arrancar', titulo: 'Reservar una clase', estado: 'FALTA', opcional: false, prioridadAlta: false, notas: null, pantallas: ['gimnasio/clases'] });
    expect(ultima(filas)).toMatchObject({ grupoOrden: 1, orden: 3, actualizadoPor: 'admin-1' });
    expect(prisma.platformAdminLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'tutorial_crear', adminId: 'admin-1', targetId: r.id }) });
  });

  it('un grupo nuevo va después del último del módulo (los de Tienda no cuentan) y un módulo vacío arranca en 1', async () => {
    const { svc, filas } = armar(GIMNASIO);
    await svc.crear('admin-1', { titulo: 'Dar de alta un socio', grupo: 'Socios', modulo: 'gimnasio' });
    expect(ultima(filas)).toMatchObject({ modulo: 'gimnasio', grupo: 'Socios', grupoOrden: 3, orden: 1 });
    await svc.crear('admin-1', { titulo: 'Conocé tu panel de Alquileres', grupo: 'Arrancar', modulo: 'alquileres', opcional: true, prioridadAlta: true, notas: ' sobre la demo ' });
    expect(ultima(filas)).toMatchObject({ modulo: 'alquileres', grupo: 'Arrancar', grupoOrden: 1, orden: 1, opcional: true, prioridadAlta: true, notas: 'sobre la demo', estado: 'FALTA' });
  });

  it('el título tiene entre 3 y 120 caracteres y no se repite, ni entre módulos ni cambiando mayúsculas', async () => {
    const { svc, prisma } = armar(GIMNASIO);
    await expect(svc.crear('admin-1', { titulo: '  atender UN pedido ', grupo: 'Arrancar', modulo: 'gimnasio' })).rejects.toThrow(/Ya hay un tutorial «Atender un pedido» \(de tienda\)/);
    await expect(svc.crear('admin-1', { titulo: ' ab ', grupo: 'Arrancar', modulo: 'gimnasio' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.crear('admin-1', { titulo: 'x'.repeat(121), grupo: 'Arrancar', modulo: 'gimnasio' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.marketingTutorial.create).not.toHaveBeenCalled();
    await expect(svc.crear('admin-1', { titulo: 'x'.repeat(120), grupo: 'Arrancar', modulo: 'gimnasio' })).resolves.toMatchObject({ estado: 'FALTA' });
  });

  it('sin grupo o sin módulo no se crea, ni con un módulo que no existe o un sí/no que no es booleano', async () => {
    const { svc, prisma } = armar();
    for (const malo of [
      { titulo: 'Cargar una clase', modulo: 'gimnasio' },
      { titulo: 'Cargar una clase', grupo: '   ', modulo: 'gimnasio' },
      { titulo: 'Cargar una clase', grupo: 'x'.repeat(81), modulo: 'gimnasio' },
      { titulo: 'Cargar una clase', grupo: 'Clases' },
      { titulo: 'Cargar una clase', grupo: 'Clases', modulo: 'peluqueria' },
      { titulo: 'Cargar una clase', grupo: 'Clases', modulo: 'gimnasio', opcional: 'si' },
    ]) {
      await expect(svc.crear('admin-1', malo)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(prisma.marketingTutorial.create).not.toHaveBeenCalled();
  });

  it('fuera de Tienda, cada pantalla empieza con el módulo (tampoco vale la de otro módulo); en Tienda, como siempre', async () => {
    const { svc } = armar();
    await expect(svc.crear('admin-1', { titulo: 'Cargar una clase', grupo: 'Clases', modulo: 'gimnasio', pantallas: ['clases'] })).rejects.toThrow(/«gimnasio\/»/);
    await expect(svc.crear('admin-1', { titulo: 'Cargar una clase', grupo: 'Clases', modulo: 'gimnasio', pantallas: ['turnos/agenda'] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.crear('admin-1', { titulo: 'Cargar una clase', grupo: 'Clases', modulo: 'gimnasio', pantallas: ['gimnasio/../admin'] })).rejects.toBeInstanceOf(BadRequestException);
    const r = await svc.crear('admin-1', { titulo: 'Cargar una clase', grupo: 'Clases', modulo: 'gimnasio', pantallas: ['gimnasio/clases', ' Gimnasio/Clases '] });
    expect(r.pantallas).toEqual(['gimnasio/clases']);
    await expect(svc.crear('admin-1', { titulo: 'Otro de Tienda', grupo: 'Catálogo', modulo: 'tienda', pantallas: ['catalogo'] })).resolves.toMatchObject({ modulo: 'tienda', pantallas: ['catalogo'] });
  });

  it('si dos altas con el mismo título llegan juntas, la base frena la segunda con el mismo error claro', async () => {
    const { svc, prisma } = armar();
    prisma.marketingTutorial.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }));
    await expect(svc.crear('admin-1', { titulo: 'Cargar una clase', grupo: 'Clases', modulo: 'gimnasio' })).rejects.toThrow(/Ya hay un tutorial «Cargar una clase»/);
  });

  it('actualizar valida las pantallas con el módulo del tutorial', async () => {
    const { svc, filas } = armar(GIMNASIO);
    await expect(svc.actualizar('admin-1', { tutorial: ID_G, pantallas: ['dashboard'] })).rejects.toThrow(/«gimnasio\/»/);
    await svc.actualizar('admin-1', { tutorial: ID_G, pantallas: ['gimnasio/socios'] });
    expect(filas.find((f) => f.id === ID_G)!.pantallas).toEqual(['gimnasio/socios']);
  });

  it('pasar un tutorial a otro módulo pide pantallas con el prefijo nuevo y lo deja al final de su grupo en ese módulo', async () => {
    const { svc, filas, prisma } = armar(GIMNASIO);
    filas[1].pantallas = ['pedidos'];
    await expect(svc.actualizar('admin-1', { tutorial: ID_B, modulo: 'gimnasio' })).rejects.toThrow(/mandá también sus pantallas/);
    expect(filas[1].modulo).toBe('tienda');
    const r = await svc.actualizar('admin-1', { tutorial: ID_B, modulo: 'gimnasio', pantallas: ['gimnasio/clases'] });
    expect(r).toMatchObject({ modulo: 'gimnasio', pantallas: ['gimnasio/clases'] });
    expect(filas[1]).toMatchObject({ modulo: 'gimnasio', grupo: 'Vender día a día', grupoOrden: 3, orden: 1 });
    expect(prisma.platformAdminLog.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ action: 'tutorial_actualizar', details: expect.objectContaining({ moduloAntes: 'tienda', modulo: 'gimnasio' }) }) });
  });
});

describe('idDeYoutube', () => {
  const id = 'dQw4w9WgXcQ';
  it.each([
    id, `https://youtu.be/${id}`, `https://www.youtube.com/watch?v=${id}&t=3`, `youtube.com/watch?v=${id}`, `https://m.youtube.com/watch?v=${id}`,
    `https://www.youtube.com/shorts/${id}`, `https://www.youtube.com/embed/${id}`, `https://www.youtube-nocookie.com/embed/${id}`,
  ])('reconoce %s', (link) => expect(idDeYoutube(link)).toBe(id));
  it.each(['', 'hola', 'https://vimeo.com/123456', `https://evil.com/watch?v=${id}`, 'https://youtu.be/corto'])('rechaza «%s»', (malo) => expect(idDeYoutube(malo)).toBeNull());
});
