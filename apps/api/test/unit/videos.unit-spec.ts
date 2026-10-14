import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MAX_BYTES_VIDEO, MAX_EN_COLA, VideosService } from '../../src/marketing/videos/videos.service';

// La cola de videos de Marketing con la base y R2 simulados. Verifica el ciclo de vida: reservar → subir → registrar →
// aprobar / rechazar (que borra el archivo), los topes, el vencimiento y que un video ajeno no se pueda registrar.

type Fila = Record<string, any>;

function armar(opciones: { tamanio?: number | null } = {}) {
  const filas: Fila[] = [];
  const cumple = (f: Fila, where: Fila): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        if ('in' in v) return v.in.includes(f[k]);
        if ('not' in v) return f[k] !== v.not;
        if ('lt' in v) return f[k] !== null && f[k] !== undefined && f[k] < v.lt;
      }
      return (f[k] ?? null) === v;
    });
  const prisma = {
    marketingVideo: {
      create: async ({ data }: { data: Fila }) => { const f = { id: `v-${filas.length + 1}`, createdAt: new Date(), guion: '', caption: '', controles: [], publicaciones: [], aprobadoAt: null, duracionSeg: null, ...data }; filas.push(f); return f; },
      findUnique: async ({ where }: { where: Fila }) => filas.find((f) => cumple(f, where)) ?? null,
      findMany: async ({ where }: { where?: Fila } = {}) => filas.filter((f) => cumple(f, where ?? {})),
      count: async ({ where }: { where?: Fila } = {}) => filas.filter((f) => cumple(f, where ?? {})).length,
      update: async ({ where, data }: { where: Fila; data: Fila }) => { const f = filas.find((x) => cumple(x, where))!; Object.assign(f, data); return f; },
      delete: async ({ where }: { where: Fila }) => { const i = filas.findIndex((x) => cumple(x, where)); const [f] = filas.splice(i, 1); return f; },
    },
    platformAdminLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const r2 = {
    presignUpload: jest.fn(async (ruta: string) => `https://r2.example/${ruta}?firmado`),
    presignDescarga: jest.fn(async (ruta: string, nombre: string) => `https://r2.example/${ruta}?descarga=${nombre}`),
    tamanioDe: jest.fn(async () => (opciones.tamanio === undefined ? 5_000_000 : opciones.tamanio)),
    eliminar: jest.fn(async (_ruta: string) => undefined),
    publicUrlDe: (ruta: string) => `https://pub.r2.dev/${ruta}`,
  };
  const aviso = { avisar: jest.fn(async (_admin: string, _motivo: string) => ({ enviados: 1, pendientes: 1 })) };
  return { svc: new VideosService(prisma as never, r2 as never, aviso as never), prisma, r2, aviso, filas };
}

const subido = async (ctx: ReturnType<typeof armar>, admin = 'admin-1') => {
  const { videoId } = await ctx.svc.pedirSubida(admin, 5_000_000);
  return videoId;
};

describe('cola de videos', () => {
  it('reserva el lugar, da una dirección firmada y deja el video en SUBIENDO', async () => {
    const ctx = armar();
    const r = await ctx.svc.pedirSubida('admin-1', 5_000_000);
    expect(r.uploadUrl).toMatch(/^https:\/\/r2\.example\/marketing\/videos\/.+\.mp4\?firmado$/);
    expect(ctx.r2.presignUpload).toHaveBeenCalledWith(expect.stringMatching(/^marketing\/videos\//), 'video/mp4');
    expect(ctx.filas[0]).toMatchObject({ estado: 'SUBIENDO', creadoPor: 'admin-1' });
    expect(ctx.filas[0].expiraAt.getTime()).toBeGreaterThan(Date.now());
  });

  it.each([[0], [-5], ['x'], [undefined], [MAX_BYTES_VIDEO + 1]])('un tamaño inválido (%s) se rechaza antes de reservar nada', async (bytes) => {
    const ctx = armar();
    await expect(ctx.svc.pedirSubida('admin-1', bytes)).rejects.toBeInstanceOf(BadRequestException);
    expect(ctx.filas).toHaveLength(0);
  });

  it('con la cola llena no deja reservar más', async () => {
    const ctx = armar();
    for (let i = 0; i < MAX_EN_COLA; i++) await subido(ctx);
    await expect(ctx.svc.pedirSubida('admin-1', 1000)).rejects.toBeInstanceOf(ConflictException);
  });

  it('registrar confirma el archivo, lo pasa a PENDIENTE con vencimiento a 7 días y limpia los textos', async () => {
    const ctx = armar();
    const id = await subido(ctx);
    const v = await ctx.svc.registrar('admin-1', {
      videoId: id, titulo: ' Reel de prueba\u0000 ', guion: 'hola', caption: 'texto #orbita', duracionSeg: 31,
      controles: [{ nombre: 'audio', ok: true, detalle: '-17 LUFS' }, { nombre: '', ok: true }, 'basura'],
    });
    expect(v).toMatchObject({ titulo: 'Reel de prueba', estado: 'PENDIENTE', formato: 'REEL_9_16', bytes: 5_000_000, duracionSeg: 31 });
    expect(v.controles).toEqual([{ nombre: 'audio', ok: true, detalle: '-17 LUFS' }]);
    expect(v.url).toMatch(/^https:\/\/pub\.r2\.dev\/marketing\/videos\//);
    const dias = (ctx.filas[0].expiraAt.getTime() - Date.now()) / 86_400_000;
    expect(dias).toBeGreaterThan(6.9);
    expect(dias).toBeLessThan(7.1);
  });

  it('registrar avisa al equipo por correo; un video que no se registra no avisa; y la tanda se avisa aparte', async () => {
    const ctx = armar()
    const id = await subido(ctx)
    expect(ctx.aviso.avisar).not.toHaveBeenCalled()
    await ctx.svc.registrar('admin-1', { videoId: id, titulo: 'x' })
    expect(ctx.aviso.avisar).toHaveBeenCalledWith('admin-1', 'registro')
    await ctx.svc.avisarTanda('admin-1')
    expect(ctx.aviso.avisar).toHaveBeenLastCalledWith('admin-1', 'tanda')
    const sinArchivo = armar({ tamanio: null })
    const id2 = await subido(sinArchivo)
    await expect(sinArchivo.svc.registrar('admin-1', { videoId: id2, titulo: 'x' })).rejects.toBeInstanceOf(BadRequestException)
    expect(sinArchivo.aviso.avisar).not.toHaveBeenCalled()
  })

  it('si el archivo no llegó a subirse, registrar avisa y la reserva sigue', async () => {
    const ctx = armar({ tamanio: null });
    const id = await subido(ctx);
    await expect(ctx.svc.registrar('admin-1', { videoId: id, titulo: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    expect(ctx.filas[0].estado).toBe('SUBIENDO');
  });

  it('un archivo vacío o más grande que el tope se descarta (archivo y registro)', async () => {
    for (const tamanio of [0, MAX_BYTES_VIDEO + 1]) {
      const ctx = armar({ tamanio });
      const id = await subido(ctx);
      await expect(ctx.svc.registrar('admin-1', { videoId: id, titulo: 'x' })).rejects.toBeInstanceOf(BadRequestException);
      expect(ctx.r2.eliminar).toHaveBeenCalledTimes(1);
      expect(ctx.filas).toHaveLength(0);
    }
  });

  it('nadie puede registrar la subida de otra persona ni registrar dos veces', async () => {
    const ctx = armar();
    const id = await subido(ctx, 'admin-1');
    await expect(ctx.svc.registrar('admin-2', { videoId: id, titulo: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await ctx.svc.registrar('admin-1', { videoId: id, titulo: 'x' });
    await expect(ctx.svc.registrar('admin-1', { videoId: id, titulo: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('valida título, formato y duración', async () => {
    const ctx = armar();
    const id = await subido(ctx);
    await expect(ctx.svc.registrar('admin-1', { videoId: id, titulo: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctx.svc.registrar('admin-1', { videoId: id, titulo: 'x', formato: 'VERTICAL' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctx.svc.registrar('admin-1', { videoId: id, titulo: 'x', duracionSeg: 9999 })).rejects.toBeInstanceOf(BadRequestException);
    expect(ctx.filas[0].estado).toBe('SUBIENDO');
  });

  it('aprobar deja el registro sin vencimiento; solo se aprueba un pendiente', async () => {
    const ctx = armar();
    const id = await subido(ctx);
    await ctx.svc.registrar('admin-1', { videoId: id, titulo: 'x' });
    const v = await ctx.svc.aprobar('admin-2', id);
    expect(v.estado).toBe('APROBADO');
    expect(ctx.filas[0]).toMatchObject({ aprobadoPor: 'admin-2', expiraAt: null });
    await expect(ctx.svc.aprobar('admin-2', id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechazar borra el archivo de R2 y el registro; lo aprobado no se puede rechazar', async () => {
    const ctx = armar();
    const a = await subido(ctx);
    await ctx.svc.registrar('admin-1', { videoId: a, titulo: 'a' });
    const ruta = ctx.filas[0].ruta;
    await ctx.svc.rechazar('admin-2', a);
    expect(ctx.r2.eliminar).toHaveBeenCalledWith(ruta);
    expect(ctx.filas).toHaveLength(0);

    const b = await subido(ctx);
    await ctx.svc.registrar('admin-1', { videoId: b, titulo: 'b' });
    await ctx.svc.aprobar('admin-2', b);
    await expect(ctx.svc.rechazar('admin-2', b)).rejects.toBeInstanceOf(ConflictException);
    expect(ctx.filas).toHaveLength(1);
  });

  it('si R2 falla al borrar, el registro se queda para poder reintentar', async () => {
    const ctx = armar();
    const id = await subido(ctx);
    await ctx.svc.registrar('admin-1', { videoId: id, titulo: 'x' });
    ctx.r2.eliminar.mockRejectedValueOnce(new Error('R2 caído'));
    await expect(ctx.svc.rechazar('admin-2', id)).rejects.toThrow('R2 caído');
    expect(ctx.filas).toHaveLength(1);
  });

  it('el listado no muestra las subidas a medias y borra los vencidos', async () => {
    const ctx = armar();
    const viejo = await subido(ctx);
    await ctx.svc.registrar('admin-1', { videoId: viejo, titulo: 'viejo' });
    ctx.filas[0].expiraAt = new Date(Date.now() - 1000);
    const nuevo = await subido(ctx);
    await ctx.svc.registrar('admin-1', { videoId: nuevo, titulo: 'nuevo' });
    await subido(ctx); // queda SUBIENDO
    const lista = await ctx.svc.listar();
    expect(lista.map((v) => v.titulo)).toEqual(['nuevo']);
    expect(ctx.r2.eliminar).toHaveBeenCalledTimes(1);
  });

  it('un aprobado nunca vence, aunque pase el tiempo', async () => {
    const ctx = armar();
    const id = await subido(ctx);
    await ctx.svc.registrar('admin-1', { videoId: id, titulo: 'x' });
    await ctx.svc.aprobar('admin-1', id);
    expect(await ctx.svc.purgarVencidos()).toBe(0);
    expect(ctx.filas).toHaveLength(1);
  });

  it('la descarga firmada lleva un nombre de archivo limpio; las subidas a medias no se pueden bajar', async () => {
    const ctx = armar();
    const id = await subido(ctx);
    await expect(ctx.svc.descarga(id)).rejects.toBeInstanceOf(NotFoundException);
    await ctx.svc.registrar('admin-1', { videoId: id, titulo: 'Cómo cargar un producto / ¡rápido!' });
    const d = await ctx.svc.descarga(id);
    expect(d.nombre).toBe('como-cargar-un-producto-rapido.mp4');
    expect(d.url).toContain('descarga=como-cargar-un-producto-rapido.mp4');
  });

  it('anotar una publicación pasa el video a PUBLICADO y conserva las anteriores', async () => {
    const ctx = armar();
    const id = await subido(ctx);
    await ctx.svc.registrar('admin-1', { videoId: id, titulo: 'x' });
    await ctx.svc.aprobar('admin-1', id);
    await ctx.svc.anotarPublicacion('admin-1', id, 'tiktok', 'pub-1');
    const v = await ctx.svc.anotarPublicacion('admin-1', id, 'instagram', 'ig-9');
    expect(v.estado).toBe('PUBLICADO');
    expect(v.publicaciones.map((p) => `${p.destino}:${p.id}`)).toEqual(['tiktok:pub-1', 'instagram:ig-9']);
  });
});
