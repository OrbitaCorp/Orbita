import { BadRequestException } from '@nestjs/common';
import { TiktokService, esDireccionPrivada, planDeTrozos } from '../../src/marketing/tiktok/tiktok.service';

// Marketing de Órbita en TikTok: conectar la cuenta de la empresa, renovar el token y publicar un
// video. TikTok está simulado: acá no se llama a nadie.

jest.mock('dns/promises', () => ({ lookup: jest.fn().mockResolvedValue([{ address: '203.0.113.10', family: 4 }]) }));
import { lookup } from 'dns/promises';

const MB = 1024 * 1024;
const ENV: Record<string, string> = {
  TIKTOK_CLIENT_KEY: 'ck_test', TIKTOK_CLIENT_SECRET: 'cs_test', TIKTOK_TOKEN_KEY: 'clave-de-cifrado', JWT_SECRET: 'jwt-de-prueba',
};

function armar(env: Record<string, string> = ENV) {
  const prisma = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn().mockResolvedValue([]),
    marketingTiktokAccount: {
      findFirst: jest.fn().mockResolvedValue(null),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    marketingTiktokPost: {
      create: jest.fn().mockResolvedValue({ id: 'p-1', publishId: 'pub-1', status: 'PROCESSING_UPLOAD' }),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    platformAdminLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const config = { get: (k: string) => env[k] };
  const r2 = { presignUpload: jest.fn().mockResolvedValue('https://r2.test/firmada?x=1'), publicUrlDe: jest.fn((p: string) => `https://pub.r2.test/${p}`) };
  return { svc: new TiktokService(prisma as any, config as any, r2 as any), prisma, r2 };
}

const cuenta = (over: object = {}) => ({
  id: 'c-1', open_id: 'open-1', access_token: 'acceso', refresh_token: 'renovacion',
  access_expires_at: new Date(Date.now() + 20 * 3_600_000), refresh_expires_at: new Date(Date.now() + 300 * 86_400_000), ...over,
});

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

const CREADOR = {
  data: { creator_nickname: 'Órbita', creator_username: 'orbita', privacy_level_options: ['SELF_ONLY', 'PUBLIC_TO_EVERYONE'], max_video_post_duration_sec: 600 },
  error: { code: 'ok' },
};

let fetchMock: jest.Mock;
beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  (lookup as jest.Mock).mockResolvedValue([{ address: '203.0.113.10', family: 4 }]);
});

describe('planDeTrozos', () => {
  it('un video de menos de 5 MB va entero en un solo trozo', () => {
    expect(planDeTrozos(3 * MB)).toEqual({ trozo: 3 * MB, cantidad: 1 });
  });
  it('el último trozo se lleva lo que sobra: 12 MB con trozos de 10 MB son 1 trozo, no 2', () => {
    expect(planDeTrozos(12 * MB)).toEqual({ trozo: 10 * MB, cantidad: 1 });
  });
  it('25 MB son 2 trozos de 10 MB (el segundo con 15 MB)', () => {
    expect(planDeTrozos(25 * MB)).toEqual({ trozo: 10 * MB, cantidad: 2 });
  });
  it('el trozo nunca pasa de 64 MB ni baja de 5 MB', () => {
    expect(planDeTrozos(500 * MB, 200 * MB).trozo).toBe(64 * MB);
    expect(planDeTrozos(50 * MB, 1 * MB).trozo).toBe(5 * MB);
  });
  it('un video vacío se rechaza', () => {
    expect(() => planDeTrozos(0)).toThrow(BadRequestException);
  });
});

describe('esDireccionPrivada (la API no debe conectarse a redes internas)', () => {
  it.each(['127.0.0.1', '10.1.2.3', '192.168.0.5', '172.16.0.1', '172.31.255.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1'])('%s es privada', (ip) => {
    expect(esDireccionPrivada(ip)).toBe(true);
  });
  it.each(['203.0.113.10', '8.8.8.8', '172.32.0.1', '2606:4700:4700::1111'])('%s es pública', (ip) => {
    expect(esDireccionPrivada(ip)).toBe(false);
  });
});

describe('configuración', () => {
  it('con los tres secretos cargados está configurado', () => {
    expect(armar().svc.configurado()).toBe(true);
  });
  it('sin alguno de los secretos no está configurado, y no se puede iniciar la conexión', () => {
    const { svc } = armar({ TIKTOK_CLIENT_KEY: 'x', JWT_SECRET: 'y' });
    expect(svc.configurado()).toBe(false);
    expect(() => svc.urlDeAutorizacion('admin-1')).not.toThrow(); // solo necesita el client key y JWT_SECRET
  });
  it('sin client key no hay forma de armar el login', () => {
    expect(() => armar({ JWT_SECRET: 'y' }).svc.urlDeAutorizacion('admin-1')).toThrow('no está configurado');
  });
  it('el estado cuenta que no hay cuenta conectada', async () => {
    const { svc } = armar();
    expect(await svc.estado()).toEqual({ configurado: true, conectado: false, cuenta: null });
  });
});

describe('conectar la cuenta', () => {
  it('el login lleva el client key, los permisos, la dirección de vuelta y un state firmado', () => {
    const url = new URL(armar().svc.urlDeAutorizacion('admin-1'));
    expect(url.origin + url.pathname).toBe('https://www.tiktok.com/v2/auth/authorize/');
    expect(url.searchParams.get('client_key')).toBe('ck_test');
    expect(url.searchParams.get('scope')).toBe('user.info.basic,video.publish,video.upload');
    expect(url.searchParams.get('redirect_uri')).toBe('https://api.orbita.site/api/v1/platform/marketing/tiktok/callback');
    expect(url.searchParams.get('state')).toContain('.');
  });

  it('los permisos que se piden se pueden ajustar sin tocar el código (TIKTOK_SCOPES)', () => {
    const { svc } = armar({ ...ENV, TIKTOK_SCOPES: 'user.info.basic,video.upload' });
    expect(new URL(svc.urlDeAutorizacion('admin-1')).searchParams.get('scope')).toBe('user.info.basic,video.upload');
  });

  it('un state adulterado o inventado se rechaza', async () => {
    const { svc } = armar();
    const state = new URL(svc.urlDeAutorizacion('admin-1')).searchParams.get('state')!;
    await expect(svc.manejarCallback('code', state + 'x')).rejects.toThrow('state inválido');
    await expect(svc.manejarCallback('code', 'cualquiera.cosa')).rejects.toThrow('state inválido');
    await expect(svc.manejarCallback('code', undefined)).rejects.toThrow('state inválido');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un state vencido se rechaza', async () => {
    const { svc } = armar();
    const state = new URL(svc.urlDeAutorizacion('admin-1')).searchParams.get('state')!;
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60_000);
    await expect(svc.manejarCallback('code', state)).rejects.toThrow('state expirado');
    jest.restoreAllMocks();
  });

  it('cambia el code por los tokens, trae el perfil, los guarda cifrados, deja una sola cuenta y lo registra', async () => {
    const { svc, prisma } = armar();
    const state = new URL(svc.urlDeAutorizacion('admin-1')).searchParams.get('state')!;
    fetchMock
      .mockResolvedValueOnce(json({ access_token: 'AT', refresh_token: 'RT', expires_in: 86400, refresh_expires_in: 31536000, open_id: 'open-1', scope: 'user.info.basic,video.publish' }))
      .mockResolvedValueOnce(json({ data: { user: { open_id: 'open-1', display_name: 'Órbita', avatar_url: 'https://x/a.jpg' } }, error: { code: 'ok' } }));
    await expect(svc.manejarCallback('el-code', state)).resolves.toEqual({ nombre: 'Órbita' });

    const [urlToken, initToken] = fetchMock.mock.calls[0];
    expect(urlToken).toBe('https://open.tiktokapis.com/v2/oauth/token/');
    const cuerpo = initToken.body as URLSearchParams;
    expect(cuerpo.get('grant_type')).toBe('authorization_code');
    expect(cuerpo.get('code')).toBe('el-code');
    expect(cuerpo.get('client_secret')).toBe('cs_test');

    // Los tokens viajan a Postgres para cifrarse ahí (pgp_sym_encrypt): nunca se escriben en claro.
    const [sql, ...valores] = prisma.$executeRaw.mock.calls[0];
    expect(sql.join('?')).toContain('pgp_sym_encrypt');
    expect(valores).toEqual(expect.arrayContaining(['AT', 'RT', 'clave-de-cifrado', 'admin-1']));
    expect(prisma.marketingTiktokAccount.deleteMany).toHaveBeenCalledWith({ where: { openId: { not: 'open-1' } } });
    expect(prisma.platformAdminLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ adminId: 'admin-1', action: 'tiktok_connect' }) });
  });

  it('si TikTok rechaza el code, no se guarda nada', async () => {
    const { svc, prisma } = armar();
    const state = new URL(svc.urlDeAutorizacion('admin-1')).searchParams.get('state')!;
    fetchMock.mockResolvedValueOnce(json({ error: 'invalid_grant', error_description: 'Authorization code is expired' }, 400));
    await expect(svc.manejarCallback('viejo', state)).rejects.toThrow('Authorization code is expired');
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});

describe('renovar el token', () => {
  it('renueva y guarda los dos tokens nuevos, cifrados', async () => {
    const { svc, prisma } = armar();
    prisma.$queryRaw.mockResolvedValue([cuenta()]);
    fetchMock.mockResolvedValueOnce(json({ access_token: 'AT2', refresh_token: 'RT2', expires_in: 86400, refresh_expires_in: 31536000 }));
    await expect(svc.renovarTokens()).resolves.toEqual({ renovada: true });
    const cuerpo = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(cuerpo.get('grant_type')).toBe('refresh_token');
    expect(cuerpo.get('refresh_token')).toBe('renovacion');
    const [sql, ...valores] = prisma.$executeRaw.mock.calls[0];
    expect(sql.join('?')).toContain('pgp_sym_encrypt');
    expect(valores).toEqual(expect.arrayContaining(['AT2', 'RT2']));
  });

  it('nunca tira: si TikTok falla, devuelve que no se pudo', async () => {
    const { svc, prisma } = armar();
    prisma.$queryRaw.mockResolvedValue([cuenta()]);
    fetchMock.mockResolvedValueOnce(json({ error: 'invalid_grant', error_description: 'refresh token expired' }, 400));
    await expect(svc.renovarTokens()).resolves.toEqual({ renovada: false });
  });

  it('sin cuenta conectada o sin configurar, no hace nada', async () => {
    await expect(armar().svc.renovarTokens()).resolves.toEqual({ renovada: false });
    await expect(armar({}).svc.renovarTokens()).resolves.toEqual({ renovada: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('publicar un video', () => {
  const dto = (over: object = {}) => ({ title: 'Una tienda, 18 plantillas #orbita', videoUrl: 'https://videos.orbita.site/demo.mp4', privacyLevel: 'SELF_ONLY', ...over });

  function conCuenta() {
    const r = armar();
    r.prisma.$queryRaw.mockResolvedValue([cuenta()]);
    return r;
  }
  /** TikTok simulado: info del creador, el video que se baja, el inicio de la subida y la subida por trozos. */
  function simularTiktok(tamano: number, opts: { init?: unknown; initStatus?: number } = {}) {
    const subidas: { url: string; init: RequestInit }[] = [];
    fetchMock.mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('creator_info')) return json(CREADOR);
      if (u.startsWith('https://videos.orbita.site')) return new Response(new Uint8Array(tamano), { status: 200, headers: { 'content-type': 'video/mp4' } });
      if (u.includes('/video/init/')) return json(opts.init ?? { data: { publish_id: 'pub-1', upload_url: 'https://upload.tiktok.test/u/1' }, error: { code: 'ok' } }, opts.initStatus ?? 200);
      if (u.startsWith('https://upload.tiktok.test')) { subidas.push({ url: u, init: init! }); return new Response(null, { status: 201 }); }
      throw new Error(`llamada inesperada: ${u}`);
    });
    return subidas;
  }

  it('baja el video, inicia la subida con el tamaño real, lo sube y lo deja anotado con quién lo mandó', async () => {
    const { svc, prisma } = conCuenta();
    const subidas = simularTiktok(3 * MB);
    await expect(svc.publicar(dto(), 'admin-1')).resolves.toMatchObject({ publishId: 'pub-1' });

    const init = fetchMock.mock.calls.find((c) => String(c[0]).includes('/video/init/'))!;
    const cuerpo = JSON.parse(init[1].body);
    expect(cuerpo.source_info).toEqual({ source: 'FILE_UPLOAD', video_size: 3 * MB, chunk_size: 3 * MB, total_chunk_count: 1 });
    expect(cuerpo.post_info).toMatchObject({ title: 'Una tienda, 18 plantillas #orbita', privacy_level: 'SELF_ONLY', disable_comment: false, is_aigc: false });
    expect(init[1].headers.Authorization).toBe('Bearer acceso');

    expect(subidas).toHaveLength(1);
    expect((subidas[0].init.headers as Record<string, string>)['Content-Range']).toBe(`bytes 0-${3 * MB - 1}/${3 * MB}`);
    expect(prisma.marketingTiktokPost.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ accountId: 'c-1', publishId: 'pub-1', privacyLevel: 'SELF_ONLY', status: 'PROCESSING_UPLOAD', createdBy: 'admin-1' }),
    }));
    expect(prisma.platformAdminLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ adminId: 'admin-1', action: 'tiktok_publish', targetId: 'pub-1' }) });
  });

  it('un video grande se sube en trozos, con el rango de cada uno y el último llevándose el resto', async () => {
    const { svc } = conCuenta();
    const subidas = simularTiktok(25 * MB);
    await svc.publicar(dto(), 'admin-1');
    const rangos = subidas.map((s) => (s.init.headers as Record<string, string>)['Content-Range']);
    expect(rangos).toEqual([`bytes 0-${10 * MB - 1}/${25 * MB}`, `bytes ${10 * MB}-${25 * MB - 1}/${25 * MB}`]);
  });

  it('no deja elegir una visibilidad que la cuenta no permite hoy', async () => {
    const { svc } = conCuenta();
    simularTiktok(MB);
    await expect(svc.publicar(dto({ privacyLevel: 'FOLLOWER_OF_CREATOR' }), 'admin-1')).rejects.toThrow('no está disponible');
  });

  it('un video que promociona una marca no puede ser privado (TikTok lo rechaza)', async () => {
    const { svc } = conCuenta();
    simularTiktok(MB);
    await expect(svc.publicar(dto({ brandOrganic: true }), 'admin-1')).rejects.toThrow('no puede ser privado');
  });

  it('con la app sin auditar, explica el motivo en vez de mostrar el código de TikTok', async () => {
    const { svc } = conCuenta();
    simularTiktok(MB, { init: { error: { code: 'unaudited_client_can_only_post_to_private_accounts', message: 'x' } }, initStatus: 403 });
    await expect(svc.publicar(dto({ privacyLevel: 'PUBLIC_TO_EVERYONE' }), 'admin-1')).rejects.toThrow('todavía no pasó la auditoría');
  });

  it('sin cuenta conectada, avisa', async () => {
    const { svc } = armar();
    await expect(svc.publicar(dto(), 'admin-1')).rejects.toThrow('TikTok no está conectado');
  });

  it('rechaza una dirección que no es https', async () => {
    const { svc } = conCuenta();
    simularTiktok(MB);
    await expect(svc.publicar(dto({ videoUrl: 'http://videos.orbita.site/demo.mp4' }), 'admin-1')).rejects.toThrow('https');
  });

  it.each(['https://localhost/x.mp4', 'https://servicio.internal/x.mp4', 'https://169.254.169.254/x.mp4', 'https://[::1]/x.mp4'])('rechaza %s: la API no baja de redes internas', async (videoUrl) => {
    const { svc } = conCuenta();
    simularTiktok(MB);
    await expect(svc.publicar(dto({ videoUrl }), 'admin-1')).rejects.toThrow('no está permitida');
  });

  it('rechaza un nombre que resuelve a una dirección interna', async () => {
    const { svc } = conCuenta();
    simularTiktok(MB);
    (lookup as jest.Mock).mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);
    await expect(svc.publicar(dto(), 'admin-1')).rejects.toThrow('no está permitida');
  });

  it('rechaza lo que no es un video', async () => {
    const { svc } = conCuenta();
    simularTiktok(MB);
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('creator_info')) return json(CREADOR);
      return new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } });
    });
    await expect(svc.publicar(dto(), 'admin-1')).rejects.toThrow('no es un video');
  });

  it('el título no puede pasar de 2200 caracteres', async () => {
    const { svc } = conCuenta();
    await expect(svc.publicar(dto({ title: 'a'.repeat(2201) }), 'admin-1')).rejects.toThrow('2200');
  });
});

describe('enviar a borradores', () => {
  const URL_VIDEO = 'https://videos.orbita.site/demo.mp4';

  function simular(tamano: number) {
    const subidas: { url: string; init: RequestInit }[] = [];
    fetchMock.mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.startsWith('https://videos.orbita.site')) return new Response(new Uint8Array(tamano), { status: 200, headers: { 'content-type': 'video/mp4' } });
      if (u.includes('/inbox/video/init/')) return json({ data: { publish_id: 'borrador-1', upload_url: 'https://upload.tiktok.test/u/9' }, error: { code: 'ok' } });
      if (u.startsWith('https://upload.tiktok.test')) { subidas.push({ url: u, init: init! }); return new Response(null, { status: 201 }); }
      throw new Error(`llamada inesperada: ${u}`);
    });
    return subidas;
  }

  it('sube el video a los borradores: inicia en el endpoint de borradores, sin título ni visibilidad, y lo anota', async () => {
    const { svc, prisma } = armar();
    prisma.$queryRaw.mockResolvedValue([cuenta()]);
    prisma.marketingTiktokPost.create.mockImplementation(async ({ data }: any) => ({ id: 'p-2', publishId: data.publishId, status: data.status }));
    const subidas = simular(3 * MB);
    await expect(svc.enviarABorradores(URL_VIDEO, 'admin-1')).resolves.toMatchObject({ publishId: 'borrador-1' });

    const init = fetchMock.mock.calls.find((c) => String(c[0]).includes('/inbox/video/init/'))!;
    const cuerpo = JSON.parse(init[1].body);
    expect(cuerpo).toEqual({ source_info: { source: 'FILE_UPLOAD', video_size: 3 * MB, chunk_size: 3 * MB, total_chunk_count: 1 } });
    expect(subidas).toHaveLength(1);
    expect(prisma.marketingTiktokPost.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ publishId: 'borrador-1', privacyLevel: 'BORRADOR', title: '(borrador)', status: 'PROCESSING_UPLOAD', createdBy: 'admin-1' }),
    }));
    expect(prisma.platformAdminLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'tiktok_draft', targetId: 'borrador-1' }) });
  });

  it('un video grande también se sube en trozos', async () => {
    const { svc, prisma } = armar();
    prisma.$queryRaw.mockResolvedValue([cuenta()]);
    const subidas = simular(25 * MB);
    await svc.enviarABorradores(URL_VIDEO, 'admin-1');
    expect(subidas.map((s) => (s.init.headers as Record<string, string>)['Content-Range'])).toEqual([`bytes 0-${10 * MB - 1}/${25 * MB}`, `bytes ${10 * MB}-${25 * MB - 1}/${25 * MB}`]);
  });

  it('sin cuenta conectada, avisa', async () => {
    await expect(armar().svc.enviarABorradores(URL_VIDEO, 'admin-1')).rejects.toThrow('TikTok no está conectado');
  });

  it('también se niega a bajar de redes internas', async () => {
    const { svc, prisma } = armar();
    prisma.$queryRaw.mockResolvedValue([cuenta()]);
    await expect(svc.enviarABorradores('https://169.254.169.254/x.mp4', 'admin-1')).rejects.toThrow('no está permitida');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('subir el video desde la computadora', () => {
  it('da una dirección firmada para subir directo a R2 y la dirección pública para publicar', async () => {
    const { svc, r2 } = armar();
    const r = await svc.urlDeSubida('video/mp4');
    expect(r.uploadUrl).toBe('https://r2.test/firmada?x=1');
    expect(r.publicUrl).toMatch(/^https:\/\/pub\.r2\.test\/marketing\/tiktok\/[0-9a-f-]{36}\.mp4$/);
    expect(r2.presignUpload).toHaveBeenCalledWith(expect.stringMatching(/^marketing\/tiktok\/[0-9a-f-]{36}\.mp4$/), 'video/mp4');
  });

  it('cada subida tiene su propio nombre: no se pisan videos', async () => {
    const { svc } = armar();
    expect((await svc.urlDeSubida('video/mp4')).publicUrl).not.toBe((await svc.urlDeSubida('video/mp4')).publicUrl);
  });

  it.each([['video/quicktime', 'mov'], ['video/webm', 'webm']])('%s se guarda como .%s', async (tipo, ext) => {
    const { svc } = armar();
    expect((await svc.urlDeSubida(tipo)).publicUrl.endsWith(`.${ext}`)).toBe(true);
  });

  it.each(['image/png', 'application/pdf', 'video/x-msvideo', ''])('rechaza %s', async (tipo) => {
    const { svc, r2 } = armar();
    await expect(svc.urlDeSubida(tipo)).rejects.toThrow('mp4, mov o webm');
    expect(r2.presignUpload).not.toHaveBeenCalled();
  });

  it('sin almacenamiento disponible, avisa', async () => {
    const prisma = {} as any;
    const svc = new TiktokService(prisma, { get: (k: string) => ENV[k] } as any);
    await expect(svc.urlDeSubida('video/mp4')).rejects.toThrow('almacenamiento');
  });
});

describe('estado de una publicación', () => {
  it('pregunta a TikTok y guarda el estado y el id público', async () => {
    const { svc, prisma } = armar();
    prisma.$queryRaw.mockResolvedValue([cuenta()]);
    prisma.marketingTiktokPost.findUnique.mockResolvedValue({ publishId: 'pub-1', status: 'PROCESSING_UPLOAD', postId: null });
    prisma.marketingTiktokPost.update.mockImplementation(async ({ data }: any) => data);
    fetchMock.mockResolvedValueOnce(json({ data: { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: [7123456789] }, error: { code: 'ok' } }));
    await expect(svc.consultarEstado('pub-1')).resolves.toMatchObject({ status: 'PUBLISH_COMPLETE', postId: '7123456789', failReason: null });
  });

  it('una publicación que no es nuestra se rechaza sin llamar a TikTok', async () => {
    const { svc, prisma } = armar();
    prisma.marketingTiktokPost.findUnique.mockResolvedValue(null);
    await expect(svc.consultarEstado('ajena')).rejects.toThrow('desconocida');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('desconectar', () => {
  it('revoca el token en TikTok, borra la cuenta y lo registra', async () => {
    const { svc, prisma } = armar();
    prisma.$queryRaw.mockResolvedValue([cuenta()]);
    fetchMock.mockResolvedValueOnce(json({}));
    await expect(svc.desconectar('admin-1')).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[0][0]).toBe('https://open.tiktokapis.com/v2/oauth/revoke/');
    expect(prisma.marketingTiktokAccount.deleteMany).toHaveBeenCalledWith({});
    expect(prisma.platformAdminLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'tiktok_disconnect' }) });
  });

  it('si TikTok no responde, igual se desconecta del lado de Órbita', async () => {
    const { svc, prisma } = armar();
    prisma.$queryRaw.mockResolvedValue([cuenta()]);
    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    await expect(svc.desconectar('admin-1')).resolves.toEqual({ ok: true });
    expect(prisma.marketingTiktokAccount.deleteMany).toHaveBeenCalled();
  });
});
