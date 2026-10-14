import { BadRequestException } from '@nestjs/common';
import { TiktokService } from '../../src/marketing/tiktok/tiktok.service';

// Marketing → TikTok: lo que ya está publicado en la cuenta y sus números. TikTok está simulado.

const ENV: Record<string, string> = {
  TIKTOK_CLIENT_KEY: 'ck_test', TIKTOK_CLIENT_SECRET: 'cs_test', TIKTOK_TOKEN_KEY: 'clave-de-cifrado', JWT_SECRET: 'jwt-de-prueba',
};

const cuentaDescifrada = () => ({
  id: 'c-1', open_id: 'open-1', access_token: 'acceso', refresh_token: 'renovacion',
  access_expires_at: new Date(Date.now() + 20 * 3_600_000), refresh_expires_at: new Date(Date.now() + 300 * 86_400_000),
});

function armar(scopes: string | null) {
  const prisma = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn().mockResolvedValue(scopes === null ? [] : [cuentaDescifrada()]),
    marketingTiktokAccount: { findFirst: jest.fn().mockResolvedValue(scopes === null ? null : { scopes }) },
    platformAdminLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const config = { get: (k: string) => ENV[k] };
  return new TiktokService(prisma as any, config as any, {} as any);
}

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

const VIDEOS = {
  data: { videos: [{ id: '73', title: 'Una tienda, 18 plantillas', cover_image_url: 'https://c/1.jpg', share_url: 'https://tiktok.com/@orbita/video/73', create_time: 1_760_000_000, duration: 21, like_count: 40, comment_count: 5, share_count: 2, view_count: 900 }] },
  error: { code: 'ok' },
};
const PERFIL = { data: { user: { follower_count: 120, following_count: 8, likes_count: 640, video_count: 11 } }, error: { code: 'ok' } };

let fetchMock: jest.Mock;
beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('contenido de la cuenta de TikTok (videos y números)', () => {
  it('trae los videos con sus números y el total de la cuenta', async () => {
    const svc = armar('user.info.basic,video.publish,video.upload,video.list,user.info.stats');
    fetchMock.mockImplementation(async (url: string | URL) => (String(url).includes('/video/list/') ? json(VIDEOS) : json(PERFIL)));
    const r = await svc.contenidoDeLaCuenta();
    expect(r.faltan).toEqual([]);
    expect(r.perfil).toEqual({ seguidores: 120, siguiendo: 8, likes: 640, videos: 11 });
    expect(r.videos?.[0]).toMatchObject({
      id: '73', titulo: 'Una tienda, 18 plantillas', vistas: 900, likes: 40, comentarios: 5, compartidos: 2, duracionSeg: 21,
      enlace: 'https://tiktok.com/@orbita/video/73',
    });
    expect(r.videos?.[0].fecha).toBe(new Date(1_760_000_000 * 1000).toISOString());
  });

  it('si a la conexión le faltan permisos, no llama a TikTok y dice cuáles faltan', async () => {
    const svc = armar('user.info.basic,video.publish,video.upload');
    const r = await svc.contenidoDeLaCuenta();
    expect(r).toEqual({ videos: null, perfil: null, faltan: ['video.list', 'user.info.stats'] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('con un solo permiso, trae esa parte y avisa de la otra', async () => {
    const svc = armar('user.info.basic,video.publish,video.upload,video.list');
    fetchMock.mockResolvedValue(json(VIDEOS));
    const r = await svc.contenidoDeLaCuenta();
    expect(r.videos).toHaveLength(1);
    expect(r.perfil).toBeNull();
    expect(r.faltan).toEqual(['user.info.stats']);
  });

  it('sin la cuenta conectada falla con BadRequest', async () => {
    await expect(armar(null).contenidoDeLaCuenta()).rejects.toBeInstanceOf(BadRequestException);
  });
});
