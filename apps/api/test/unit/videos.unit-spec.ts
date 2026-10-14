import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MAX_BYTES_TUTORIAL, MAX_BYTES_VIDEO, MAX_EN_COLA, VideosService } from '../../src/marketing/videos/videos.service';

// La cola de videos de Marketing con la base y R2 simulados. Cubre el ciclo de vida (reservar → subir → registrar → aprobar /
// rechazar), los dos tipos (marketing y tutorial), la regla de aprobación según quién subió el video, los comentarios, las
// mejoras y el vínculo con la lista de tutoriales.

type Fila = Record<string, any>;

const ADMINS = [
  { id: 'ceo', email: 'ceo@orbita-corp.com', name: 'Mateo' },
  { id: 'cto', email: 'cto@orbita-corp.com', name: 'Alan' },
  { id: 'cpo', email: 'cpo@orbita-corp.com', name: 'Alexander' },
  { id: 'mili', email: 'milagros@orbita.site', name: 'Milagros' },
  { id: 'otro', email: 'cm@orbita-corp.com', name: '' },
];

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function tabla(filas: Fila[]) {
  const cumple = (f: Fila, where: Fila): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        if ('in' in v) return v.in.includes(f[k]);
        if ('not' in v) return f[k] !== v.not;
        if ('lt' in v) return f[k] !== null && f[k] !== undefined && f[k] < v.lt;
        if ('equals' in v) return String(f[k]).toLowerCase() === String(v.equals).toLowerCase();
      }
      return (f[k] ?? null) === v;
    });
  return {
    filas,
    cumple,
    findUnique: async ({ where }: { where: Fila }) => filas.find((f) => cumple(f, where)) ?? null,
    findFirst: async ({ where }: { where: Fila }) => filas.find((f) => cumple(f, where)) ?? null,
    findMany: async ({ where }: { where?: Fila } = {}) => filas.filter((f) => cumple(f, where ?? {})),
    count: async ({ where }: { where?: Fila } = {}) => filas.filter((f) => cumple(f, where ?? {})).length,
    update: async ({ where, data }: { where: Fila; data: Fila }) => { const f = filas.find((x) => cumple(x, where)); if (!f) throw new Error('no existe'); Object.assign(f, data); return f; },
    updateMany: async ({ where, data }: { where: Fila; data: Fila }) => { const hit = filas.filter((f) => cumple(f, where)); hit.forEach((f) => Object.assign(f, data)); return { count: hit.length }; },
    delete: async ({ where }: { where: Fila }) => { const i = filas.findIndex((x) => cumple(x, where)); const [f] = filas.splice(i, 1); return f; },
  };
}

function armar(opciones: { tamanio?: number | null; env?: Record<string, string> } = {}) {
  const videos = tabla([]);
  const comentarios = tabla([]);
  const tutoriales = tabla([
    { id: '11111111-1111-4111-8111-111111111111', titulo: 'Cargar un producto', estado: 'FALTA' },
    { id: '22222222-2222-4222-8222-222222222222', titulo: 'Atender un pedido', estado: 'EN_PROCESO' },
  ]);
  const admins = tabla(ADMINS.map((a) => ({ ...a })));
  let n = 0;
  const prisma = {
    marketingVideo: {
      ...videos,
      create: async ({ data }: { data: Fila }) => { const f = { id: uid(++n), createdAt: new Date(), guion: '', caption: '', controles: [], publicaciones: [], aprobaciones: [], aprobadoAt: null, duracionSeg: null, tutorialId: null, mejoraDeId: null, ...data }; videos.filas.push(f); return f; },
      findMany: async ({ where }: { where?: Fila } = {}) => videos.filas.filter((f) => videos.cumple(f, where ?? {})).map((f) => ({ ...f, _count: { comentarios: comentarios.filas.filter((c) => c.videoId === f.id).length } })),
    },
    marketingVideoComentario: {
      ...comentarios,
      create: async ({ data }: { data: Fila }) => { const c = { id: uid(++n), createdAt: new Date(), ...data }; comentarios.filas.push(c); return c; },
    },
    marketingTutorial: tutoriales,
    platformAdmin: admins,
    platformAdminLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const r2 = {
    presignUpload: jest.fn(async (ruta: string) => `https://r2.example/${ruta}?firmado`),
    presignDescarga: jest.fn(async (ruta: string, nombre: string) => `https://r2.example/${ruta}?descarga=${nombre}`),
    tamanioDe: jest.fn(async () => (opciones.tamanio === undefined ? 5_000_000 : opciones.tamanio)),
    eliminar: jest.fn(async (_ruta: string) => undefined),
    publicUrlDe: (ruta: string) => `https://pub.r2.dev/${ruta}`,
  };
  const aviso = { avisar: jest.fn(async (_admin: string, _motivo: string, _tipo: string) => ({ enviados: 1, pendientes: 1 })) };
  const env = opciones.env ?? {};
  const svc = new VideosService(prisma as never, r2 as never, aviso as never, { get: (k: string) => env[k] } as never);
  return { svc, prisma, r2, aviso, filas: videos.filas, comentarios: comentarios.filas, tutoriales: tutoriales.filas };
}
type Ctx = ReturnType<typeof armar>;

/** Reserva, "sube" y registra un video; devuelve su id. */
async function nuevo(ctx: Ctx, creador: string, extra: { tipo?: 'MARKETING' | 'TUTORIAL'; titulo?: string; tutorial?: string; mejoraDe?: string } = {}) {
  const { videoId } = await ctx.svc.pedirSubida(creador, 5_000_000, extra.tipo);
  await ctx.svc.registrar(creador, { videoId, titulo: extra.titulo ?? 'Un video', tutorial: extra.tutorial, mejoraDe: extra.mejoraDe });
  return videoId;
}
const reservado = async (ctx: Ctx, admin = 'ceo', tipo?: 'MARKETING' | 'TUTORIAL') => (await ctx.svc.pedirSubida(admin, 5_000_000, tipo)).videoId;
const quien = (id: string) => ADMINS.find((a) => a.id === id)!;

describe('subir y registrar', () => {
  it('reserva el lugar, da una dirección firmada y deja el video en SUBIENDO como MARKETING', async () => {
    const ctx = armar();
    const r = await ctx.svc.pedirSubida('ceo', 5_000_000);
    expect(r.uploadUrl).toMatch(/^https:\/\/r2\.example\/marketing\/videos\/.+\.mp4\?firmado$/);
    expect(ctx.filas[0]).toMatchObject({ estado: 'SUBIENDO', creadoPor: 'ceo', tipo: 'MARKETING', formato: 'REEL_9_16' });
    expect(ctx.filas[0].expiraAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('un tutorial arranca horizontal y admite archivos más grandes; un reel no', async () => {
    const ctx = armar();
    await ctx.svc.pedirSubida('cto', MAX_BYTES_TUTORIAL, 'TUTORIAL');
    expect(ctx.filas[0]).toMatchObject({ tipo: 'TUTORIAL', formato: 'HORIZONTAL_16_9' });
    await expect(ctx.svc.pedirSubida('cto', MAX_BYTES_VIDEO + 1)).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctx.svc.pedirSubida('cto', MAX_BYTES_TUTORIAL + 1, 'TUTORIAL')).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([[0], [-5], ['x'], [undefined]])('un tamaño inválido (%s) se rechaza antes de reservar nada', async (bytes) => {
    const ctx = armar();
    await expect(ctx.svc.pedirSubida('ceo', bytes)).rejects.toBeInstanceOf(BadRequestException);
    expect(ctx.filas).toHaveLength(0);
  });

  it('un tipo inventado se rechaza', async () => {
    await expect(armar().svc.pedirSubida('ceo', 1000, 'PROMO')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('la cola se llena por tipo: marketing lleno no frena a los tutoriales', async () => {
    const ctx = armar();
    for (let i = 0; i < MAX_EN_COLA; i++) await reservado(ctx);
    await expect(ctx.svc.pedirSubida('ceo', 1000)).rejects.toBeInstanceOf(ConflictException);
    await expect(ctx.svc.pedirSubida('ceo', 1000, 'TUTORIAL')).resolves.toBeDefined();
  });

  it('registrar confirma el archivo, lo pasa a PENDIENTE con vencimiento a 7 días (30 si es tutorial) y limpia los textos', async () => {
    const ctx = armar();
    const id = await reservado(ctx);
    const v = await ctx.svc.registrar('ceo', { videoId: id, titulo: ' Reel\u0000 ', guion: 'hola', caption: 'texto', duracionSeg: 31, controles: [{ nombre: 'audio', ok: true, detalle: '-17' }, { nombre: '', ok: true }, 'basura'] });
    expect(v).toMatchObject({ titulo: 'Reel', estado: 'PENDIENTE', tipo: 'MARKETING', bytes: 5_000_000, duracionSeg: 31, comentarios: 0, mejoraDeId: null });
    expect(v.controles).toEqual([{ nombre: 'audio', ok: true, detalle: '-17' }]);
    expect((ctx.filas[0].expiraAt.getTime() - Date.now()) / 86_400_000).toBeCloseTo(7, 0);
    const t = await nuevo(ctx, 'cto', { tipo: 'TUTORIAL' });
    expect((ctx.filas.find((f) => f.id === t)!.expiraAt.getTime() - Date.now()) / 86_400_000).toBeCloseTo(30, 0);
  });

  it('registrar avisa al equipo con el tipo del video; si no se registra, no avisa', async () => {
    const ctx = armar();
    await nuevo(ctx, 'ceo');
    expect(ctx.aviso.avisar).toHaveBeenLastCalledWith('ceo', 'registro', 'MARKETING');
    await nuevo(ctx, 'cto', { tipo: 'TUTORIAL' });
    expect(ctx.aviso.avisar).toHaveBeenLastCalledWith('cto', 'registro', 'TUTORIAL');
    const sin = armar({ tamanio: null });
    const id = await reservado(sin);
    await expect(sin.svc.registrar('ceo', { videoId: id, titulo: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    expect(sin.aviso.avisar).not.toHaveBeenCalled();
    await ctx.svc.avisarTanda('cto', 'TUTORIAL');
    expect(ctx.aviso.avisar).toHaveBeenLastCalledWith('cto', 'tanda', 'TUTORIAL');
  });

  it('un archivo vacío o más grande que el tope de su tipo se descarta (archivo y registro)', async () => {
    for (const tamanio of [0, MAX_BYTES_VIDEO + 1]) {
      const ctx = armar({ tamanio });
      const id = await reservado(ctx);
      await expect(ctx.svc.registrar('ceo', { videoId: id, titulo: 'x' })).rejects.toBeInstanceOf(BadRequestException);
      expect(ctx.r2.eliminar).toHaveBeenCalledTimes(1);
      expect(ctx.filas).toHaveLength(0);
    }
    const tutorial = armar({ tamanio: MAX_BYTES_VIDEO + 1 });
    await expect(nuevo(tutorial, 'cto', { tipo: 'TUTORIAL' })).resolves.toBeDefined();
  });

  it('nadie puede registrar la subida de otra persona ni registrar dos veces', async () => {
    const ctx = armar();
    const id = await reservado(ctx, 'ceo');
    await expect(ctx.svc.registrar('cto', { videoId: id, titulo: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await ctx.svc.registrar('ceo', { videoId: id, titulo: 'x' });
    await expect(ctx.svc.registrar('ceo', { videoId: id, titulo: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('valida título, formato y duración (con más margen para un tutorial)', async () => {
    const ctx = armar();
    const id = await reservado(ctx);
    await expect(ctx.svc.registrar('ceo', { videoId: id, titulo: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctx.svc.registrar('ceo', { videoId: id, titulo: 'x', formato: 'VERTICAL' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctx.svc.registrar('ceo', { videoId: id, titulo: 'x', duracionSeg: 9999 })).rejects.toBeInstanceOf(BadRequestException);
    const t = await reservado(ctx, 'cto', 'TUTORIAL');
    await expect(ctx.svc.registrar('cto', { videoId: t, titulo: 'Tutorial largo', duracionSeg: 1500 })).resolves.toMatchObject({ estado: 'PENDIENTE' });
  });
});

describe('aprobación: depende de quién subió el video', () => {
  it('un socio aprueba el suyo (para verificar lo que hizo Claude) y queda APROBADO sin vencimiento', async () => {
    const ctx = armar();
    const id = await nuevo(ctx, 'cto');
    const v = await ctx.svc.aprobar('cto', id);
    expect(v.estado).toBe('APROBADO');
    expect(ctx.filas[0]).toMatchObject({ aprobadoPor: 'cto', expiraAt: null });
  });

  it.each([['ceo', 'cto'], ['cto', 'ceo'], ['cpo', 'cto'], ['cto', 'cpo'], ['ceo', 'cpo']])('el socio %s NO puede aprobar ni rechazar el video del socio %s', async (otro, dueno) => {
    const ctx = armar();
    const id = await nuevo(ctx, dueno);
    await expect(ctx.svc.aprobar(otro, id)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(ctx.svc.rechazar(otro, id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(ctx.filas[0].estado).toBe('PENDIENTE');
  });

  it('Milagros no aprueba el video de un socio', async () => {
    const ctx = armar();
    const id = await nuevo(ctx, 'cto');
    await expect(ctx.svc.aprobar('mili', id)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lo de Milagros: con el CEO alcanza', async () => {
    const ctx = armar();
    const id = await nuevo(ctx, 'mili');
    expect((await ctx.svc.aprobar('ceo', id)).estado).toBe('APROBADO');
  });

  it('lo de Milagros: el CTO solo no alcanza (queda pendiente); con el CPO también, sí', async () => {
    const ctx = armar();
    const id = await nuevo(ctx, 'mili');
    expect((await ctx.svc.aprobar('cto', id)).estado).toBe('PENDIENTE');
    expect(ctx.filas[0].aprobadoPor).toBeUndefined();
    expect((await ctx.svc.aprobar('cpo', id)).estado).toBe('APROBADO');
  });

  it('lo de Milagros: ella no se aprueba sola ni aprueba otra persona del equipo', async () => {
    const ctx = armar();
    const id = await nuevo(ctx, 'mili');
    await expect(ctx.svc.aprobar('mili', id)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(ctx.svc.aprobar('otro', id)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('nadie aprueba dos veces, ni algo que ya no está pendiente', async () => {
    const ctx = armar();
    const id = await nuevo(ctx, 'mili');
    await ctx.svc.aprobar('cto', id);
    await expect(ctx.svc.aprobar('cto', id)).rejects.toBeInstanceOf(ForbiddenException);
    await ctx.svc.aprobar('ceo', id);
    await expect(ctx.svc.aprobar('cpo', id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('el panel recibe qué puede hacer cada persona, y nunca quién aprobó', async () => {
    const ctx = armar();
    await nuevo(ctx, 'mili', { titulo: 'De Milagros' });
    await ctx.svc.aprobar('cto', ctx.filas[0].id);
    const flags = async (id: string) => { const [v] = await ctx.svc.listar(undefined, undefined, quien(id)); return { aprobar: v.puedeAprobar, rechazar: v.puedeRechazar, yaAprobaste: v.yaAprobaste, tuyo: v.esTuyo }; };
    expect(await flags('ceo')).toEqual({ aprobar: true, rechazar: true, yaAprobaste: false, tuyo: false });
    expect(await flags('cto')).toEqual({ aprobar: false, rechazar: true, yaAprobaste: true, tuyo: false });
    expect(await flags('cpo')).toEqual({ aprobar: true, rechazar: true, yaAprobaste: false, tuyo: false });
    expect(await flags('mili')).toEqual({ aprobar: false, rechazar: true, yaAprobaste: false, tuyo: true });
    expect(await flags('otro')).toEqual({ aprobar: false, rechazar: false, yaAprobaste: false, tuyo: false });
    const [v] = await ctx.svc.listar(undefined, undefined, quien('ceo'));
    expect(JSON.stringify(v)).not.toMatch(/aprobadoPor|aprobaciones|adminId|"cto"/);
  });

  it('al socio se le ofrece aprobar solo lo suyo', async () => {
    const ctx = armar();
    await nuevo(ctx, 'cto');
    const paraCto = (await ctx.svc.listar(undefined, undefined, quien('cto')))[0];
    const paraCeo = (await ctx.svc.listar(undefined, undefined, quien('ceo')))[0];
    expect([paraCto.puedeAprobar, paraCeo.puedeAprobar, paraCeo.puedeRechazar]).toEqual([true, false, false]);
  });

  it('la lista se puede filtrar por tipo', async () => {
    const ctx = armar();
    await nuevo(ctx, 'cto', { titulo: 'Reel' });
    await nuevo(ctx, 'cto', { tipo: 'TUTORIAL', titulo: 'Tutorial' });
    expect((await ctx.svc.listar(undefined, 'MARKETING')).map((v) => v.titulo)).toEqual(['Reel']);
    expect((await ctx.svc.listar(undefined, 'TUTORIAL')).map((v) => v.titulo)).toEqual(['Tutorial']);
    expect(await ctx.svc.listar()).toHaveLength(2);
  });
});

describe('rechazar', () => {
  it('quien lo subió descarta el suyo: se borra el archivo y el registro', async () => {
    const ctx = armar();
    const id = await nuevo(ctx, 'mili');
    const ruta = ctx.filas[0].ruta;
    await ctx.svc.rechazar('mili', id);
    expect(ctx.r2.eliminar).toHaveBeenCalledWith(ruta);
    expect(ctx.filas).toHaveLength(0);
  });

  it('lo de Milagros lo puede rechazar la dirección', async () => {
    const ctx = armar();
    await ctx.svc.rechazar('cpo', await nuevo(ctx, 'mili'));
    expect(ctx.filas).toHaveLength(0);
  });

  it('lo aprobado queda como registro: no se rechaza', async () => {
    const ctx = armar();
    const id = await nuevo(ctx, 'cto');
    await ctx.svc.aprobar('cto', id);
    await expect(ctx.svc.rechazar('cto', id)).rejects.toBeInstanceOf(ConflictException);
    expect(ctx.filas).toHaveLength(1);
  });

  it('si R2 falla al borrar, el registro se queda para poder reintentar', async () => {
    const ctx = armar();
    const id = await nuevo(ctx, 'cto');
    ctx.r2.eliminar.mockRejectedValueOnce(new Error('R2 caído'));
    await expect(ctx.svc.rechazar('cto', id)).rejects.toThrow('R2 caído');
    expect(ctx.filas).toHaveLength(1);
  });
});

describe('comentarios (cualquiera del equipo, en todas las fases)', () => {
  it('cualquiera comenta un video ajeno, con su nombre, y se ve en la lista y en el detalle', async () => {
    const ctx = armar();
    const id = await nuevo(ctx, 'cto');
    await ctx.svc.comentar('ceo', id, ' El gancho es lento\u0000 ');
    await ctx.svc.comentar('otro', id, 'Falta el logo al final');
    const c = await ctx.svc.comentarios(id, 'ceo');
    expect(c.map((x) => [x.autor, x.texto, x.esTuyo])).toEqual([['Mateo', 'El gancho es lento', true], ['cm', 'Falta el logo al final', false]]);
    expect((await ctx.svc.listar())[0].comentarios).toBe(2);
    const d = await ctx.svc.detalle(id);
    expect(d.comentariosDelEquipo.map((x) => x.texto)).toEqual(['El gancho es lento', 'Falta el logo al final']);
    expect(JSON.stringify(d)).not.toMatch(/aprobadoPor|aprobaciones|adminId/);
  });

  it('se puede comentar en una fase aprobada y en una ya pasada a borrador', async () => {
    const ctx = armar();
    const id = await nuevo(ctx, 'cto');
    await ctx.svc.aprobar('cto', id);
    await expect(ctx.svc.comentar('ceo', id, 'Ya aprobado, pero…')).resolves.toBeDefined();
    await ctx.svc.anotarPublicacion('cto', id, 'instagram', 'ig-1');
    await expect(ctx.svc.comentar('cpo', id, 'Ya en borrador')).resolves.toBeDefined();
  });

  it('un comentario vacío o de un video que no existe o a medio subir se rechaza', async () => {
    const ctx = armar();
    const id = await nuevo(ctx, 'cto');
    await expect(ctx.svc.comentar('ceo', id, '   ')).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctx.svc.comentar('ceo', 'no-existe', 'hola')).rejects.toBeInstanceOf(NotFoundException);
    const subiendo = await reservado(ctx);
    await expect(ctx.svc.comentar('ceo', subiendo, 'hola')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cada quien borra solo sus comentarios', async () => {
    const ctx = armar();
    const id = await nuevo(ctx, 'cto');
    const c = await ctx.svc.comentar('ceo', id, 'mío');
    await expect(ctx.svc.eliminarComentario('cto', id, c.id)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(ctx.svc.eliminarComentario('ceo', 'otro-video', c.id)).rejects.toBeInstanceOf(NotFoundException);
    await ctx.svc.eliminarComentario('ceo', id, c.id);
    expect(ctx.comentarios).toHaveLength(0);
  });
});

describe('mejorar un video', () => {
  it('una mejora queda como un video nuevo que apunta al original, que no se toca (también si el original ya está aprobado)', async () => {
    const ctx = armar();
    const original = await nuevo(ctx, 'cto', { titulo: 'Original' });
    await ctx.svc.aprobar('cto', original);
    const mejora = await nuevo(ctx, 'ceo', { titulo: 'Original v2', mejoraDe: original });
    const v = (await ctx.svc.listar()).find((x) => x.id === mejora)!;
    expect(v).toMatchObject({ mejoraDeId: original, estado: 'PENDIENTE' });
    expect(ctx.filas.find((f) => f.id === original)!.estado).toBe('APROBADO');
    expect((await ctx.svc.detalle(original)).mejorasYaRegistradas).toEqual([{ id: mejora, titulo: 'Original v2', estado: 'PENDIENTE' }].map((m) => expect.objectContaining(m)));
  });

  it('lo aprueba quien lo subió (la mejora de un socio la aprueba ese socio, no el dueño del original)', async () => {
    const ctx = armar();
    const original = await nuevo(ctx, 'cto');
    const mejora = await nuevo(ctx, 'ceo', { mejoraDe: original });
    await expect(ctx.svc.aprobar('cto', mejora)).rejects.toBeInstanceOf(ForbiddenException);
    expect((await ctx.svc.aprobar('ceo', mejora)).estado).toBe('APROBADO');
  });

  it('el original tiene que existir y ser del mismo tipo', async () => {
    const ctx = armar();
    const marketing = await nuevo(ctx, 'cto');
    const id = await reservado(ctx, 'ceo', 'TUTORIAL');
    await expect(ctx.svc.registrar('ceo', { videoId: id, titulo: 'x', mejoraDe: marketing })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctx.svc.registrar('ceo', { videoId: id, titulo: 'x', mejoraDe: 'no-es-un-uuid' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctx.svc.registrar('ceo', { videoId: id, titulo: 'x', mejoraDe: '99999999-9999-4999-8999-999999999999' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('tutoriales: vínculo con la lista', () => {
  const CARGAR = '11111111-1111-4111-8111-111111111111';

  it('registrar un tutorial lo deja EN_REVISION; aprobarlo lo marca HECHO', async () => {
    const ctx = armar();
    const id = await nuevo(ctx, 'cto', { tipo: 'TUTORIAL', tutorial: 'Cargar un producto' }); // por título, sin importar mayúsculas
    expect(ctx.filas[0].tutorialId).toBe(CARGAR);
    expect(ctx.tutoriales[0].estado).toBe('EN_REVISION');
    await ctx.svc.aprobar('cto', id);
    expect(ctx.tutoriales[0].estado).toBe('HECHO');
  });

  it('si el video se rechaza, el tutorial vuelve a FALTA; y también si vence', async () => {
    const ctx = armar();
    const id = await nuevo(ctx, 'cto', { tipo: 'TUTORIAL', tutorial: CARGAR });
    await ctx.svc.rechazar('cto', id);
    expect(ctx.tutoriales[0].estado).toBe('FALTA');
    await nuevo(ctx, 'cto', { tipo: 'TUTORIAL', tutorial: CARGAR });
    ctx.filas[0].expiraAt = new Date(Date.now() - 1000);
    await ctx.svc.listar();
    expect(ctx.tutoriales[0].estado).toBe('FALTA');
  });

  it('un tutorial que no existe en la lista, o un video de marketing que quiere cubrir uno, se rechazan', async () => {
    const ctx = armar();
    const t = await reservado(ctx, 'cto', 'TUTORIAL');
    await expect(ctx.svc.registrar('cto', { videoId: t, titulo: 'x', tutorial: 'No está en la lista' })).rejects.toBeInstanceOf(BadRequestException);
    const m = await reservado(ctx, 'cto');
    await expect(ctx.svc.registrar('cto', { videoId: m, titulo: 'x', tutorial: CARGAR })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('vencimientos, descarga y publicaciones', () => {
  it('el listado no muestra las subidas a medias y borra los vencidos', async () => {
    const ctx = armar();
    await nuevo(ctx, 'cto', { titulo: 'viejo' });
    ctx.filas[0].expiraAt = new Date(Date.now() - 1000);
    await nuevo(ctx, 'cto', { titulo: 'nuevo' });
    await reservado(ctx);
    expect((await ctx.svc.listar()).map((v) => v.titulo)).toEqual(['nuevo']);
    expect(ctx.r2.eliminar).toHaveBeenCalledTimes(1);
  });

  it('un aprobado nunca vence', async () => {
    const ctx = armar();
    const id = await nuevo(ctx, 'cto');
    await ctx.svc.aprobar('cto', id);
    expect(await ctx.svc.purgarVencidos()).toBe(0);
    expect(ctx.filas).toHaveLength(1);
  });

  it('la descarga firmada lleva un nombre de archivo limpio; las subidas a medias no se pueden bajar', async () => {
    const ctx = armar();
    const sub = await reservado(ctx);
    await expect(ctx.svc.descarga(sub)).rejects.toBeInstanceOf(NotFoundException);
    const id = await nuevo(ctx, 'cto', { titulo: 'Cómo cargar un producto / ¡rápido!' });
    const d = await ctx.svc.descarga(id);
    expect(d.nombre).toBe('como-cargar-un-producto-rapido.mp4');
    expect(d.url).toContain('descarga=como-cargar-un-producto-rapido.mp4');
  });

  it('anotar una publicación pasa el video a PUBLICADO y conserva las anteriores', async () => {
    const ctx = armar();
    const id = await nuevo(ctx, 'cto');
    await ctx.svc.aprobar('cto', id);
    await ctx.svc.anotarPublicacion('cto', id, 'tiktok', 'pub-1');
    const v = await ctx.svc.anotarPublicacion('cto', id, 'instagram', 'ig-9');
    expect(v.estado).toBe('PUBLICADO');
    expect(v.publicaciones.map((p) => `${p.destino}:${p.id}`)).toEqual(['tiktok:pub-1', 'instagram:ig-9']);
  });
});
