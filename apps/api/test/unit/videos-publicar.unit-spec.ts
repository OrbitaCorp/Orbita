import { ConflictException } from '@nestjs/common';
import { VideosPublicarService } from '../../src/marketing/videos/videos-publicar.service';

// Publicar un video aprobado de la cola: solo si está aprobado, con los servicios de TikTok e Instagram simulados.

function armar(estado = 'APROBADO') {
  const video = { id: 'v-1', estado, ruta: 'marketing/videos/a.mp4', caption: 'texto sugerido #orbita' };
  const videos = {
    obtener: jest.fn(async () => video),
    urlPublica: jest.fn((r: string) => `https://pub.r2.dev/${r}`),
    anotarPublicacion: jest.fn(async (_a: string, _i: string, destino: string, ref: string) => ({ id: 'v-1', estado: 'PUBLICADO', publicaciones: [{ destino, id: ref }] })),
  };
  const tiktok = { enviarABorradores: jest.fn(async (_url: string, _admin?: string) => ({ id: 't-1', publishId: 'pub-77', status: 'SEND_TO_USER_INBOX' })) };
  const medios = { subirVideoDelServidor: jest.fn(async () => ({ ref: 'neg-1/subidas/x.mp4', tipo: 'video', url: 'https://sb/x.mp4' })) };
  const publicaciones = { guardarBorrador: jest.fn(async () => ({ id: 'ig-5', status: 'DRAFT' })) };
  const contenido = { negocioId: jest.fn(async () => 'neg-1') };
  const svc = new VideosPublicarService(videos as never, tiktok as never, medios as never, publicaciones as never, contenido as never);
  return { svc, videos, tiktok, medios, publicaciones };
}

describe('publicar un video de la cola', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('no publica nada si el video no está aprobado', async () => {
    for (const estado of ['PENDIENTE', 'SUBIENDO']) {
      const ctx = armar(estado);
      await expect(ctx.svc.enBorradoresDeTiktok('admin-1', 'v-1')).rejects.toBeInstanceOf(ConflictException);
      await expect(ctx.svc.enBorradorDeInstagram('admin-1', 'v-1')).rejects.toBeInstanceOf(ConflictException);
      expect(ctx.tiktok.enviarABorradores).not.toHaveBeenCalled();
      expect(ctx.publicaciones.guardarBorrador).not.toHaveBeenCalled();
    }
  });

  it('TikTok: manda la dirección pública a los borradores y anota la publicación', async () => {
    const ctx = armar();
    const r = await ctx.svc.enBorradoresDeTiktok('admin-1', 'v-1');
    expect(ctx.tiktok.enviarABorradores).toHaveBeenCalledWith('https://pub.r2.dev/marketing/videos/a.mp4', 'admin-1');
    expect(ctx.videos.anotarPublicacion).toHaveBeenCalledWith('admin-1', 'v-1', 'tiktok', 'pub-77');
    expect(r.video.estado).toBe('PUBLICADO');
  });

  it('un video ya publicado se puede mandar también al otro canal', async () => {
    const ctx = armar('PUBLICADO');
    await ctx.svc.enBorradoresDeTiktok('admin-1', 'v-1');
    expect(ctx.tiktok.enviarABorradores).toHaveBeenCalled();
  });

  it('Instagram: baja el video, lo guarda en el almacenamiento de la cuenta y deja un BORRADOR con el texto sugerido (no publica)', async () => {
    const ctx = armar();
    global.fetch = jest.fn(async () => new Response(new Uint8Array([1, 2, 3]))) as never;
    await ctx.svc.enBorradorDeInstagram('admin-1', 'v-1');
    expect(ctx.medios.subirVideoDelServidor).toHaveBeenCalledWith('neg-1', Buffer.from([1, 2, 3]));
    expect(ctx.publicaciones.guardarBorrador).toHaveBeenCalledWith('neg-1', undefined, {
      caption: 'texto sugerido #orbita', formato: 'vertical', items: [{ origen: 'subida', ref: 'neg-1/subidas/x.mp4', tipo: 'video' }],
    });
    expect(ctx.videos.anotarPublicacion).toHaveBeenCalledWith('admin-1', 'v-1', 'instagram', 'ig-5');
  });

  it('Instagram: un texto escrito a mano reemplaza al sugerido, y si no se puede leer el video avisa', async () => {
    const ctx = armar();
    global.fetch = jest.fn(async () => new Response(new Uint8Array([1]))) as never;
    await ctx.svc.enBorradorDeInstagram('admin-1', 'v-1', 'otro texto');
    expect(ctx.publicaciones.guardarBorrador).toHaveBeenCalledWith('neg-1', undefined, expect.objectContaining({ caption: 'otro texto' }));
    global.fetch = jest.fn(async () => new Response('x', { status: 404 })) as never;
    await expect(ctx.svc.enBorradorDeInstagram('admin-1', 'v-1')).rejects.toThrow('No se pudo leer el video');
  });
});
