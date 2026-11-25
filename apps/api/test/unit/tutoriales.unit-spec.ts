import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TutorialesService } from '../../src/marketing/videos/tutoriales.service';
import { idDeYoutube } from '../../src/marketing/videos/youtube';

// La lista de tutoriales (qué hay y qué falta): se lee agrupada con un resumen y se actualiza por id o por título, con el
// estado EN_REVISION reservado para el sistema. Cada tutorial es de un módulo: la lista se filtra por módulo, el panel de
// Tienda recibe solo lo suyo y el responsable de cada módulo nuevo carga su lista (crear). Lo cargado se corrige (título,
// grupo, módulo) y todo lo que toca un título o un lugar corre con el candado de la lista. Base simulada.

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
  // La tabla, sobre las filas en memoria. Se arma dos veces, cada una con sus espías: la que se ve desde afuera (prisma) y
  // la de adentro de una transacción (tx). Así los casos pueden afirmar qué corrió con el candado tomado.
  const tabla = () => ({
    // Como Prisma: filtra y, si se pide orden, ordena por grupo y dentro del grupo (sin mirar el módulo).
    findMany: jest.fn(async ({ where, orderBy }: { where?: Fila; orderBy?: unknown } = {}) => {
      const r = filas.filter((f) => cumple(f, where));
      return orderBy ? r.sort((a, b) => a.grupoOrden - b.grupoOrden || a.orden - b.orden) : r;
    }),
    groupBy: jest.fn(async ({ where }: { where?: Fila } = {}) => ['FALTA', 'EN_PROCESO', 'EN_REVISION', 'HECHO'].map((estado) => ({ estado, _count: { _all: filas.filter((f) => cumple(f, where) && f.estado === estado).length } })).filter((g) => g._count._all > 0)),
    // Como Prisma, cada lectura devuelve un objeto nuevo: lo leído antes de un update no cambia con él.
    findUnique: jest.fn(async ({ where }: { where: Fila }) => { const f = filas.find((x) => x.id === where.id); return f ? { ...f } : null; }),
    update: jest.fn(async ({ where, data }: { where: Fila; data: Fila }) => { const f = filas.find((x) => x.id === where.id)!; Object.assign(f, data); return { ...f }; }),
    create: jest.fn(async ({ data }: { data: Fila }) => { const f: Fila = { id: `nuevo-${filas.length}`, asignadoA: null, youtubeId: null, updatedAt: new Date(), ...data }; filas.push(f); return f; }),
  });
  // El título se busca con SQL: `lower("titulo") = lower($1)`, una comparación exacta sin distinguir mayúsculas, donde «%» y
  // «_» son caracteres como cualquier otro. El título llega como parámetro; cualquier otra consulta es un error del caso.
  const porTitulo = () => jest.fn(async (sql: readonly string[], ...parametros: unknown[]) => {
    if (!sql.join('?').includes('lower("titulo") = lower(?)')) throw new Error(`Consulta inesperada: ${sql.join('?')}`);
    return filas.filter((f) => f.titulo.toLowerCase() === String(parametros[0]).toLowerCase()).slice(0, 1).map((f) => ({ id: f.id as string }));
  });
  const tx = { marketingTutorial: tabla(), $queryRaw: porTitulo(), $executeRaw: jest.fn(async (_sql: readonly string[]) => 1) };
  const prisma = {
    marketingTutorial: tabla(),
    $queryRaw: porTitulo(),
    $transaction: jest.fn(async (accion: (t: typeof tx) => Promise<unknown>) => accion(tx)),
    marketingVideo: { findMany: jest.fn(async () => videos) },
    platformAdminLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return { svc: new TutorialesService(prisma as never), prisma, tx, filas };
}

const ultima = (filas: Fila[]) => filas[filas.length - 1];
/** En qué turno se llamó por primera vez a un espía (jest numera todas las llamadas): para afirmar qué fue antes de qué. */
const turno = (espia: jest.Mock) => espia.mock.invocationCallOrder[0];
/** El SQL de la primera consulta cruda que recibió un espía, con «?» donde va cada parámetro. */
const sqlDe = (espia: jest.Mock) => (espia.mock.calls[0][0] as string[]).join('?');
const CANDADO = "SELECT pg_advisory_xact_lock(hashtext('marketing_tutoriales'))";

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
    expect(r).toMatchObject({ modulo: 'gimnasio', grupo: 'Arrancar', grupoNuevo: false, titulo: 'Reservar una clase', estado: 'FALTA', opcional: false, prioridadAlta: false, notas: null, pantallas: ['gimnasio/clases'] });
    expect(ultima(filas)).toMatchObject({ grupoOrden: 1, orden: 3, actualizadoPor: 'admin-1' });
    expect(prisma.platformAdminLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'tutorial_crear', adminId: 'admin-1', targetId: r.id }) });
  });

  it('un grupo nuevo va después del último del módulo (los de Tienda no cuentan), un módulo vacío arranca en 1 y la respuesta avisa que se abrió', async () => {
    const { svc, filas } = armar(GIMNASIO);
    const socios = await svc.crear('admin-1', { titulo: 'Dar de alta un socio', grupo: 'Socios', modulo: 'gimnasio' });
    expect(socios).toMatchObject({ grupo: 'Socios', grupoNuevo: true });
    expect(ultima(filas)).toMatchObject({ modulo: 'gimnasio', grupo: 'Socios', grupoOrden: 3, orden: 1 });
    const alquileres = await svc.crear('admin-1', { titulo: 'Conocé tu panel de Alquileres', grupo: 'Arrancar', modulo: 'alquileres', opcional: true, prioridadAlta: true, notas: ' sobre la demo ' });
    expect(alquileres.grupoNuevo).toBe(true);
    expect(ultima(filas)).toMatchObject({ modulo: 'alquileres', grupo: 'Arrancar', grupoOrden: 1, orden: 1, opcional: true, prioridadAlta: true, notas: 'sobre la demo', estado: 'FALTA' });
  });

  it('el título tiene entre 3 y 120 caracteres y no se repite, ni entre módulos ni cambiando mayúsculas', async () => {
    const { svc, tx } = armar(GIMNASIO);
    await expect(svc.crear('admin-1', { titulo: '  atender UN pedido ', grupo: 'Arrancar', modulo: 'gimnasio' })).rejects.toThrow(/Ya hay un tutorial «Atender un pedido» \(de tienda\)/);
    await expect(svc.crear('admin-1', { titulo: ' ab ', grupo: 'Arrancar', modulo: 'gimnasio' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.crear('admin-1', { titulo: 'x'.repeat(121), grupo: 'Arrancar', modulo: 'gimnasio' })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.marketingTutorial.create).not.toHaveBeenCalled();
    await expect(svc.crear('admin-1', { titulo: 'x'.repeat(120), grupo: 'Arrancar', modulo: 'gimnasio' })).resolves.toMatchObject({ estado: 'FALTA' });
  });

  it('sin grupo o sin módulo no se crea, ni con un módulo que no existe o un sí/no que no es booleano', async () => {
    const { svc, prisma, tx } = armar();
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
    // Lo que se puede rechazar sin mirar la base se rechaza antes de abrir la transacción.
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.marketingTutorial.create).not.toHaveBeenCalled();
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

  it('si igual se cuela un título repetido, la base frena el alta o el cambio con el mismo error claro', async () => {
    const { svc, tx } = armar();
    const repetido = () => new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
    tx.marketingTutorial.create.mockRejectedValueOnce(repetido());
    await expect(svc.crear('admin-1', { titulo: 'Cargar una clase', grupo: 'Clases', modulo: 'gimnasio' })).rejects.toThrow(/Ya hay un tutorial «Cargar una clase»/);
    tx.marketingTutorial.update.mockRejectedValueOnce(repetido());
    await expect(svc.actualizar('admin-1', { tutorial: ID_B, titulo: 'Atender un pedido de mostrador' })).rejects.toThrow(/Ya hay un tutorial «Atender un pedido de mostrador»/);
    // Otro error de la base no se disfraza de título repetido.
    tx.marketingTutorial.update.mockRejectedValueOnce(new Error('se cayó la base'));
    await expect(svc.actualizar('admin-1', { tutorial: ID_B, titulo: 'Atender un pedido de mostrador' })).rejects.toThrow('se cayó la base');
  });

  it('actualizar valida las pantallas con el módulo del tutorial', async () => {
    const { svc, filas } = armar(GIMNASIO);
    await expect(svc.actualizar('admin-1', { tutorial: ID_G, pantallas: ['dashboard'] })).rejects.toThrow(/«gimnasio\/»/);
    await svc.actualizar('admin-1', { tutorial: ID_G, pantallas: ['gimnasio/socios'] });
    expect(filas.find((f) => f.id === ID_G)!.pantallas).toEqual(['gimnasio/socios']);
  });

  it('pasar un tutorial a otro módulo pide pantallas con el prefijo nuevo y lo deja al final de su grupo en ese módulo', async () => {
    const { svc, filas, prisma } = armar(GIMNASIO);
    // Cargado por error en Tienda. Su grupo ya existe en Gimnasio («Clases», con un tutorial): el lugar que le toca allá
    // no es el que tenía acá, así que si no se buscara el lugar nuevo este caso fallaría.
    await svc.crear('admin-1', { titulo: 'Reservar una clase', grupo: 'clases', modulo: 'tienda', pantallas: ['pedidos'] });
    const fila = ultima(filas);
    expect(fila).toMatchObject({ modulo: 'tienda', grupo: 'clases', grupoOrden: 4, orden: 1 });
    await expect(svc.actualizar('admin-1', { tutorial: 'Reservar una clase', modulo: 'gimnasio' })).rejects.toThrow(/mandá también sus pantallas/);
    expect(fila).toMatchObject({ modulo: 'tienda', grupo: 'clases', grupoOrden: 4, orden: 1 });
    const r = await svc.actualizar('admin-1', { tutorial: 'Reservar una clase', modulo: 'gimnasio', pantallas: ['gimnasio/clases'] });
    expect(r).toMatchObject({ modulo: 'gimnasio', grupo: 'Clases', grupoNuevo: false, pantallas: ['gimnasio/clases'] });
    expect(fila).toMatchObject({ modulo: 'gimnasio', grupo: 'Clases', grupoOrden: 2, orden: 2 });
    expect(prisma.platformAdminLog.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ action: 'tutorial_actualizar', details: expect.objectContaining({ moduloAntes: 'tienda', modulo: 'gimnasio' }) }) });
  });

  it('si el grupo no existe en el módulo nuevo se abre al final, y la respuesta lo avisa', async () => {
    const { svc, filas } = armar(GIMNASIO);
    const r = await svc.actualizar('admin-1', { tutorial: ID_A, modulo: 'gimnasio' });
    expect(r).toMatchObject({ modulo: 'gimnasio', grupo: 'Catálogo', grupoNuevo: true });
    expect(filas[0]).toMatchObject({ modulo: 'gimnasio', grupo: 'Catálogo', grupoOrden: 3, orden: 1 });
  });

  it('en Tienda una pantalla no puede llevar el prefijo de otro módulo, ni al cargarla ni al pasar a Tienda con las que ya tenía', async () => {
    const { svc, filas } = armar(GIMNASIO);
    await expect(svc.actualizar('admin-1', { tutorial: ID_B, pantallas: ['pedidos', 'turnos/agenda'] })).rejects.toThrow(/prefijo de otro módulo .*«turnos\/agenda» es de turnos/);
    await expect(svc.crear('admin-1', { titulo: 'Otro de Tienda', grupo: 'Catálogo', modulo: 'tienda', pantallas: ['alquileres/reservas'] })).rejects.toThrow(/«alquileres\/reservas» es de alquileres/);
    expect(filas[1].pantallas).toEqual([]);
    // El de Gimnasio tiene «gimnasio/inicio»: no pasa a Tienda con esa pantalla, ni dejándola ni mandándola de nuevo.
    await expect(svc.actualizar('admin-1', { tutorial: ID_G, modulo: 'tienda' })).rejects.toThrow(/«gimnasio\/inicio» es de gimnasio\. Si cambiás el módulo, mandá también sus pantallas/);
    await expect(svc.actualizar('admin-1', { tutorial: ID_G, modulo: 'tienda', pantallas: ['gimnasio/inicio'] })).rejects.toThrow(/«gimnasio\/inicio» es de gimnasio/);
    expect(filas.find((f) => f.id === ID_G)).toMatchObject({ modulo: 'gimnasio', grupoOrden: 1, orden: 1, pantallas: ['gimnasio/inicio'] });
    const r = await svc.actualizar('admin-1', { tutorial: ID_G, modulo: 'tienda', pantallas: ['dashboard'] });
    expect(r).toMatchObject({ modulo: 'tienda', pantallas: ['dashboard'], grupo: 'Arrancar', grupoNuevo: true });
  });

  it('la pantalla de un módulo puede tener un tramo más que la de Tienda, porque el primero es el módulo', async () => {
    const { svc, filas } = armar(GIMNASIO);
    await svc.actualizar('admin-1', { tutorial: ID_G, pantallas: ['gimnasio/configuracion/equipo/invitar'] });
    expect(filas.find((f) => f.id === ID_G)!.pantallas).toEqual(['gimnasio/configuracion/equipo/invitar']);
    await expect(svc.actualizar('admin-1', { tutorial: ID_G, pantallas: ['gimnasio/configuracion/equipo/invitar/ahora'] })).rejects.toThrow(/no es una pantalla del panel/);
    await svc.actualizar('admin-1', { tutorial: ID_B, pantallas: ['configuracion/equipo/invitar'] });
    expect(filas[1].pantallas).toEqual(['configuracion/equipo/invitar']);
    await expect(svc.actualizar('admin-1', { tutorial: ID_B, pantallas: ['configuracion/equipo/invitar/ahora'] })).rejects.toThrow(/no es una pantalla del panel/);
    await expect(svc.crear('admin-1', { titulo: 'Invitar a un profe', grupo: 'Equipo', modulo: 'gimnasio', pantallas: ['gimnasio/configuracion/equipo/invitar'] })).resolves.toMatchObject({ pantallas: ['gimnasio/configuracion/equipo/invitar'] });
    await expect(svc.crear('admin-1', { titulo: 'Invitar a un vendedor', grupo: 'Equipo', modulo: 'tienda', pantallas: ['panel/configuracion/equipo/invitar'] })).rejects.toThrow(/no es una pantalla del panel/);
  });

  it('crear sin pantallas, o con pantallas: null, lo deja sin ninguna', async () => {
    const { svc } = armar();
    await expect(svc.crear('admin-1', { titulo: 'Cargar una clase', grupo: 'Clases', modulo: 'gimnasio', pantallas: null })).resolves.toMatchObject({ pantallas: [], estado: 'FALTA' });
    await expect(svc.crear('admin-1', { titulo: 'Cargar otra clase', grupo: 'Clases', modulo: 'gimnasio' })).resolves.toMatchObject({ pantallas: [] });
    await expect(svc.crear('admin-1', { titulo: 'Y otra más', grupo: 'Clases', modulo: 'gimnasio', pantallas: 'gimnasio/clases' })).rejects.toThrow(/tiene que ser una lista/);
  });
});

describe('corregir lo cargado', () => {
  it('el título se corrige con las reglas de crear: no repite el de otro (el suyo con otras mayúsculas sí vale) y queda anotado el anterior', async () => {
    const { svc, filas, prisma } = armar(GIMNASIO);
    const r = await svc.actualizar('admin-1', { tutorial: ID_B, titulo: '  Atender   un pedido nuevo ' });
    expect(r).toMatchObject({ id: ID_B, titulo: 'Atender un pedido nuevo', grupo: 'Vender día a día' });
    expect(r).not.toHaveProperty('grupoNuevo');
    // Renombrar no lo mueve.
    expect(filas[1]).toMatchObject({ titulo: 'Atender un pedido nuevo', grupo: 'Vender día a día', grupoOrden: 3, orden: 1, actualizadoPor: 'admin-1' });
    expect(prisma.platformAdminLog.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ action: 'tutorial_actualizar', targetId: ID_B, details: expect.objectContaining({ tituloAntes: 'Atender un pedido', titulo: 'Atender un pedido nuevo' }) }) });

    await expect(svc.actualizar('admin-1', { tutorial: ID_B, titulo: 'CARGAR tus planes' })).rejects.toThrow(/Ya hay un tutorial «Cargar tus planes» \(de gimnasio\)/);
    expect(filas[1].titulo).toBe('Atender un pedido nuevo');
    await expect(svc.actualizar('admin-1', { tutorial: ID_B, titulo: 'ATENDER un pedido nuevo' })).resolves.toMatchObject({ titulo: 'ATENDER un pedido nuevo' });
    for (const malo of [' ab ', 'x'.repeat(121), null, 7]) {
      await expect(svc.actualizar('admin-1', { tutorial: ID_B, titulo: malo })).rejects.toThrow(/entre 3 y 120 caracteres/);
    }
    expect(filas[1].titulo).toBe('ATENDER un pedido nuevo');

    // Si el título no cambia, el registro no inventa un título anterior.
    await svc.actualizar('admin-1', { tutorial: ID_B, estado: 'EN_PROCESO' });
    expect(prisma.platformAdminLog.create.mock.calls.at(-1)![0].data.details).toEqual({ titulo: 'ATENDER un pedido nuevo', antes: 'FALTA', estado: 'EN_PROCESO' });
    await expect(svc.actualizar('admin-1', { tutorial: ID_B })).rejects.toThrow(/No hay nada para cambiar: .*titulo o grupo/);
  });

  it('cambiar de grupo lo manda al final de ese grupo; uno que no existe se abre al final del módulo y la respuesta lo avisa', async () => {
    const { svc, filas, prisma } = armar(GIMNASIO);
    const fila = filas.find((f) => f.id === ID_G)!;
    const r = await svc.actualizar('admin-1', { tutorial: ID_G, grupo: ' clases ' });
    expect(r).toMatchObject({ modulo: 'gimnasio', grupo: 'Clases', grupoNuevo: false });
    expect(fila).toMatchObject({ modulo: 'gimnasio', grupo: 'Clases', grupoOrden: 2, orden: 2 });
    expect(prisma.platformAdminLog.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ details: expect.objectContaining({ grupoAntes: 'Arrancar', grupo: 'Clases' }) }) });

    const abierto = await svc.actualizar('admin-1', { tutorial: ID_G, grupo: 'Socios' });
    expect(abierto).toMatchObject({ grupo: 'Socios', grupoNuevo: true });
    expect(fila).toMatchObject({ modulo: 'gimnasio', grupo: 'Socios', grupoOrden: 3, orden: 1 });

    // El mismo grupo escrito de otra forma no lo mueve ni le cambia el nombre.
    const igual = await svc.actualizar('admin-1', { tutorial: ID_G, grupo: 'SOCIOS' });
    expect(igual).toMatchObject({ grupo: 'Socios' });
    expect(igual).not.toHaveProperty('grupoNuevo');
    expect(fila).toMatchObject({ grupo: 'Socios', grupoOrden: 3, orden: 1 });

    await expect(svc.actualizar('admin-1', { tutorial: ID_G, grupo: '   ' })).rejects.toThrow(/Falta el grupo/);
    await expect(svc.actualizar('admin-1', { tutorial: ID_G, grupo: 'x'.repeat(81) })).rejects.toThrow(/hasta 80 caracteres/);
    expect(fila).toMatchObject({ grupo: 'Socios', grupoOrden: 3, orden: 1 });
  });

  it('con grupo y módulo a la vez va al final de ese grupo en el módulo nuevo', async () => {
    const { svc, filas } = armar(GIMNASIO);
    const r = await svc.actualizar('admin-1', { tutorial: ID_B, modulo: 'gimnasio', grupo: 'Arrancar' });
    expect(r).toMatchObject({ modulo: 'gimnasio', grupo: 'Arrancar', grupoNuevo: false });
    expect(filas[1]).toMatchObject({ modulo: 'gimnasio', grupo: 'Arrancar', grupoOrden: 1, orden: 3 });
  });

  it('los grupos se emparejan sin mirar mayúsculas ni acentos, y queda el nombre como ya estaba guardado', async () => {
    const { svc, filas } = armar(GIMNASIO);
    const r = await svc.crear('admin-1', { titulo: 'Duplicar un producto', grupo: 'CATALOGO', modulo: 'tienda' });
    expect(r).toMatchObject({ grupo: 'Catálogo', grupoNuevo: false });
    expect(ultima(filas)).toMatchObject({ grupo: 'Catálogo', grupoOrden: 2, orden: 2 });
    const movido = await svc.actualizar('admin-1', { tutorial: ID_B, grupo: 'catalogo' });
    expect(movido).toMatchObject({ grupo: 'Catálogo', grupoNuevo: false });
    expect(filas[1]).toMatchObject({ grupo: 'Catálogo', grupoOrden: 2, orden: 3 });
    // Otro nombre, aunque se parezca, abre un grupo: por eso la respuesta lo avisa.
    await expect(svc.crear('admin-1', { titulo: 'Ordenar el catálogo', grupo: 'Catálogos', modulo: 'tienda' })).resolves.toMatchObject({ grupo: 'Catálogos', grupoNuevo: true });
  });
});

describe('títulos: comparación exacta', () => {
  it('el título se busca exacto y sin distinguir mayúsculas: «%» y «_» no son comodines', async () => {
    const { svc, prisma, tx, filas } = armar();
    await svc.crear('admin-1', { titulo: 'abc', grupo: 'Arrancar', modulo: 'gimnasio' });
    // Con el ILIKE de antes, «a_c» y «%» encontraban a «abc».
    await expect(svc.actualizar('admin-1', { tutorial: 'a_c', estado: 'HECHO' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.actualizar('admin-1', { tutorial: '%', estado: 'HECHO' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.crear('admin-1', { titulo: 'a_c', grupo: 'Arrancar', modulo: 'gimnasio' })).resolves.toMatchObject({ titulo: 'a_c' });
    await expect(svc.actualizar('admin-1', { tutorial: 'ABC', titulo: 'a%c' })).resolves.toMatchObject({ titulo: 'a%c' });
    expect(filas.slice(3).map((f) => [f.titulo, f.estado])).toEqual([['a%c', 'FALTA'], ['a_c', 'FALTA']]);

    // El título viaja como parámetro de la consulta, nunca adentro del SQL, y se compara con «=», no con LIKE.
    const consultas = [...prisma.$queryRaw.mock.calls, ...tx.$queryRaw.mock.calls];
    expect(consultas).toHaveLength(6);
    for (const [sql, ...parametros] of consultas) {
      expect(sql.join('?')).toMatch(/WHERE lower\("titulo"\) = lower\(\?\)/);
      expect(sql.join('?')).not.toMatch(/like/i);
      expect(parametros).toHaveLength(1);
    }
    expect(prisma.$queryRaw.mock.calls.map(([, titulo]) => titulo)).toEqual(['a_c', '%']);
    expect(tx.$queryRaw.mock.calls.map(([, titulo]) => titulo)).toEqual(['abc', 'a_c', 'ABC', 'a%c']);
  });
});

describe('el candado de la lista', () => {
  it('crear abre una transacción y toma el candado antes de mirar si el título está repetido, de buscar el lugar y de crear', async () => {
    const { svc, prisma, tx } = armar(GIMNASIO);
    await svc.crear('admin-1', { titulo: 'Reservar una clase', grupo: 'Arrancar', modulo: 'gimnasio' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(sqlDe(tx.$executeRaw)).toBe(CANDADO);
    expect(turno(prisma.$transaction)).toBeLessThan(turno(tx.$executeRaw));
    expect(turno(tx.$executeRaw)).toBeLessThan(turno(tx.$queryRaw));
    expect(turno(tx.$queryRaw)).toBeLessThan(turno(tx.marketingTutorial.findMany));
    expect(turno(tx.marketingTutorial.findMany)).toBeLessThan(turno(tx.marketingTutorial.create));
    // Todo lo que lee y escribe va por la transacción que tiene el candado, no por afuera.
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.marketingTutorial.findMany).not.toHaveBeenCalled();
    expect(prisma.marketingTutorial.create).not.toHaveBeenCalled();
  });

  it('actualizar toma el mismo candado cuando cambia el título, el grupo o el módulo, antes de leer el tutorial y de escribir', async () => {
    for (const cambio of [{ titulo: 'Conocé el panel de Gimnasio' }, { grupo: 'Clases' }, { modulo: 'turnos', pantallas: [] }]) {
      const { svc, prisma, tx } = armar(GIMNASIO);
      await svc.actualizar('admin-1', { tutorial: ID_G, ...cambio });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(sqlDe(tx.$executeRaw)).toBe(CANDADO);
      expect(turno(prisma.$transaction)).toBeLessThan(turno(tx.$executeRaw));
      // Nada de la transacción corre antes que el candado: ni leer el tutorial, ni el título, ni el lugar, ni escribir.
      const loDemas = [tx.$queryRaw, tx.marketingTutorial.findUnique, tx.marketingTutorial.findMany, tx.marketingTutorial.update].flatMap((espia) => espia.mock.invocationCallOrder);
      expect(turno(tx.$executeRaw)).toBeLessThan(Math.min(...loDemas));
      expect(turno(tx.marketingTutorial.findUnique)).toBeLessThan(turno(tx.marketingTutorial.update));
      expect(prisma.marketingTutorial.findUnique).not.toHaveBeenCalled();
      expect(prisma.marketingTutorial.update).not.toHaveBeenCalled();
    }
  });

  it('el que mueve por título también busca el tutorial con el candado tomado', async () => {
    const { svc, prisma, tx } = armar(GIMNASIO);
    await svc.actualizar('admin-1', { tutorial: 'cargar TUS planes', grupo: 'Clases' });
    expect(turno(tx.$executeRaw)).toBeLessThan(turno(tx.$queryRaw));
    expect(turno(tx.$queryRaw)).toBeLessThan(turno(tx.marketingTutorial.findMany));
    expect(turno(tx.marketingTutorial.findMany)).toBeLessThan(turno(tx.marketingTutorial.update));
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('lo que no toca títulos ni lugares (estado, notas, link, pantallas, responsable) no abre transacción', async () => {
    const { svc, prisma, tx } = armar(GIMNASIO);
    await svc.actualizar('admin-1', { tutorial: ID_G, estado: 'EN_PROCESO', notas: 'arranco hoy', youtube: '', pantallas: ['gimnasio/socios'] });
    await svc.actualizar('admin-1', { tutorial: 'cargar TUS planes', asignadoA: 'ALE' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.marketingTutorial.update).toHaveBeenCalledTimes(2);
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
