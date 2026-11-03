import { BadRequestException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { InstagramService } from '../../src/instagram/instagram.service';
import { InstagramComentariosService } from '../../src/instagram/instagram-comentarios.service';
import { InstagramEstadisticasService } from '../../src/instagram/instagram-estadisticas.service';

// Comentarios y estadísticas del kit de difusión. Cubre lo que si falla se nota tarde: que cada pantalla exija
// SU permiso, que un token vencido (y solo ese) corte la conexión, que los ids no armen rutas raras, y que una
// métrica caída no tire abajo el resumen.

const BIZ = 'biz-1';
const COMENTAR = 'instagram_business_manage_comments';
const ESTADISTICAS = 'instagram_business_manage_insights';

function respuesta(json: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => json } as any;
}

describe('InstagramService.graph (unit)', () => {
  const crear = (scopes: string | null, fetchImpl?: (url: string, init: any) => Promise<any>) => {
    const prisma: any = {
      instagramConnection: {
        findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE', scopes }),
        update: jest.fn().mockResolvedValue({}),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ ig_user_id: '1784', access_token: 'tok' }]),
    };
    const config: any = { get: (k: string) => ({ INSTAGRAM_TOKEN_KEY: 'k' } as Record<string, string>)[k] };
    const svc = new InstagramService(prisma, config);
    const fetchMock = jest.fn().mockImplementation(fetchImpl ?? (async () => respuesta({ ok: true })));
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock as any);
    return { svc, prisma, fetchMock };
  };
  afterEach(() => jest.restoreAllMocks());

  it('exige el permiso: sin él no llama a Instagram', async () => {
    const { svc, fetchMock } = crear('instagram_business_basic,instagram_business_content_publish');
    await expect(svc.graph(BIZ, COMENTAR, '{ig}/media')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.graph(BIZ, ESTADISTICAS, '{ig}')).rejects.toBeInstanceOf(ForbiddenException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('arma la dirección con el id de la cuenta, el token en el encabezado y el cuerpo en JSON', async () => {
    const { svc, fetchMock } = crear(`instagram_business_basic,${COMENTAR}`);
    await svc.graph(BIZ, COMENTAR, '{ig}/media', { query: { fields: 'id', limit: '5' } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://graph.instagram.com/v23.0/1784/media?fields=id&limit=5');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.method).toBe('GET');

    await svc.graph(BIZ, COMENTAR, '99999/replies', { metodo: 'POST', cuerpo: { message: 'hola' } });
    const [, init2] = fetchMock.mock.calls[1];
    expect(init2.method).toBe('POST');
    expect(init2.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init2.body)).toEqual({ message: 'hola' });
  });

  it('el token vencido (190) corta la conexión; un error de permiso NO', async () => {
    const vencido = crear(COMENTAR, async () => respuesta({ error: { message: 'Invalid OAuth access token', code: 190, type: 'OAuthException' } }, false, 400));
    await expect(vencido.svc.graph(BIZ, COMENTAR, '{ig}/media')).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(vencido.prisma.instagramConnection.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'DISCONNECTED', accessToken: '' } }));

    const sinPermiso = crear(COMENTAR, async () => respuesta({ error: { message: 'Permission denied', code: 10, type: 'OAuthException' } }, false, 400));
    await expect(sinPermiso.svc.graph(BIZ, COMENTAR, '{ig}/media')).rejects.toThrow();
    expect(sinPermiso.prisma.instagramConnection.update).not.toHaveBeenCalled();
  });
});

describe('InstagramComentariosService (unit)', () => {
  const crear = (graph: jest.Mock) => ({ svc: new InstagramComentariosService({ graph } as any), graph });

  const medio = (id: string, comentarios: number, extra: Record<string, unknown> = {}) => ({
    id, caption: `Publicación ${id}`, permalink: `https://www.instagram.com/p/${id}/`, media_url: `https://cdn/${id}.jpg`, timestamp: '2026-10-08T12:00:00+0000', comments_count: comentarios, ...extra,
  });

  it('trae solo las publicaciones con comentarios, con sus respuestas en orden de conversación', async () => {
    const graph = jest.fn().mockImplementation(async (_b: string, _p: string, ruta: string) => {
      if (ruta === '{ig}/media') return { data: [medio('11111', 0), medio('22222', 2), medio('33333', 1, { thumbnail_url: 'https://cdn/t.jpg' })] };
      if (ruta === '22222/comments') {
        return {
          data: [
            { id: '501', text: 'Qué lindo!', username: 'ana', timestamp: '2026-10-08T13:00:00+0000', like_count: 3, hidden: false, replies: { data: [{ id: '602', text: 'Segunda', username: 'tienda' }, { id: '601', text: 'Primera', username: 'tienda' }] } },
            { id: '502', text: 'spam', username: 'bot', hidden: true },
          ],
        };
      }
      if (ruta === '33333/comments') return { data: [{ id: '503', text: 'Precio?', username: 'luis' }] };
      throw new Error(`ruta inesperada ${ruta}`);
    });
    const { svc } = crear(graph);
    const { publicaciones } = await svc.listar(BIZ);

    expect(publicaciones.map((p) => p.id)).toEqual(['22222', '33333']);
    expect(publicaciones[1].imagen).toBe('https://cdn/t.jpg');
    const [a, b] = publicaciones[0].comentarios;
    expect(a).toMatchObject({ id: '501', usuario: 'ana', texto: 'Qué lindo!', likes: 3, oculto: false });
    expect(a.respuestas.map((r) => r.texto)).toEqual(['Primera', 'Segunda']);
    expect(b).toMatchObject({ usuario: 'bot', oculto: true, likes: 0, respuestas: [] });
    expect(graph.mock.calls.every(([, permiso]) => permiso === COMENTAR)).toBe(true);
  });

  it('si una publicación falla, las otras se muestran; si fallan todas, se informa el error', async () => {
    const parcial = jest.fn().mockImplementation(async (_b: string, _p: string, ruta: string) => {
      if (ruta === '{ig}/media') return { data: [medio('22222', 1), medio('33333', 1)] };
      if (ruta === '22222/comments') throw new Error('caído');
      return { data: [{ id: '503', text: 'Hola', username: 'luis' }] };
    });
    expect((await crear(parcial).svc.listar(BIZ)).publicaciones.map((p) => p.id)).toEqual(['33333']);

    const todas = jest.fn().mockImplementation(async (_b: string, _p: string, ruta: string) => {
      if (ruta === '{ig}/media') return { data: [medio('22222', 1)] };
      throw new ForbiddenException('Falta autorizar los comentarios');
    });
    await expect(crear(todas).svc.listar(BIZ)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('no sigue ids que no sean numéricos', async () => {
    const graph = jest.fn().mockResolvedValue({ data: [medio('../../x', 3)] });
    const r = await crear(graph).svc.listar(BIZ);
    expect(r.publicaciones).toEqual([]);
    expect(graph).toHaveBeenCalledTimes(1);
  });

  it('responder y ocultar validan el id y llaman con el permiso de comentarios', async () => {
    const graph = jest.fn().mockResolvedValue({ id: '700' });
    const { svc } = crear(graph);
    expect(await svc.responder(BIZ, '17881770991003328', 'Gracias!')).toEqual({ id: '700' });
    expect(graph).toHaveBeenLastCalledWith(BIZ, COMENTAR, '17881770991003328/replies', { metodo: 'POST', cuerpo: { message: 'Gracias!' } });
    expect(await svc.ocultar(BIZ, '17881770991003328', true)).toEqual({ id: '17881770991003328', oculto: true });
    expect(graph).toHaveBeenLastCalledWith(BIZ, COMENTAR, '17881770991003328', { metodo: 'POST', query: { hide: 'true' } });
    await svc.ocultar(BIZ, '17881770991003328', false);
    expect(graph).toHaveBeenLastCalledWith(BIZ, COMENTAR, '17881770991003328', { metodo: 'POST', query: { hide: 'false' } });
    for (const malo of ['../../me', '12', '17881770991003328/replies', 'abc']) {
      await expect(svc.responder(BIZ, malo, 'x')).rejects.toBeInstanceOf(BadRequestException);
      await expect(svc.ocultar(BIZ, malo, true)).rejects.toBeInstanceOf(BadRequestException);
    }
  });
});

describe('InstagramEstadisticasService (unit)', () => {
  const ahora = Date.parse('2026-10-09T12:00:00Z');
  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(ahora));
  afterEach(() => jest.restoreAllMocks());

  const publicacion = (id: string, dias: number, likes: number, comentarios: number) => ({
    id, caption: `Post ${id}`, permalink: `https://www.instagram.com/p/${id}/`, media_url: `https://cdn/${id}.jpg`,
    timestamp: new Date(ahora - dias * 86400_000).toISOString(), like_count: likes, comments_count: comentarios,
  });

  const grafo = (metricas: Record<string, number | 'falla'>) =>
    jest.fn().mockImplementation(async (_b: string, _p: string, ruta: string, init?: any) => {
      if (ruta === '{ig}') return { username: 'mitienda', followers_count: 1200, follows_count: 80, media_count: 40 };
      if (ruta === '{ig}/insights') {
        const v = metricas[init.query.metric];
        if (v === 'falla' || v === undefined) throw new Error('métrica no disponible');
        return { data: [{ total_value: { value: v } }] };
      }
      if (ruta === '{ig}/media') {
        return { data: [publicacion('1', 2, 10, 1), publicacion('2', 3, 50, 7), publicacion('3', 40, 999, 99), publicacion('4', 5, 5, 0)] };
      }
      throw new Error(`ruta inesperada ${ruta}`);
    });

  it('arma el resumen: cuenta, las cinco métricas del período y las publicaciones que mejor funcionaron', async () => {
    const graph = grafo({ reach: 3400, views: 9100, total_interactions: 410, accounts_engaged: 250, profile_views: 77 });
    const svc = new InstagramEstadisticasService({ graph } as any);
    const r = await svc.resumen(BIZ, 7);

    expect(r.cuenta).toEqual({ usuario: 'mitienda', seguidores: 1200, siguiendo: 80, publicaciones: 40 });
    expect(r.metricas).toEqual({ alcance: 3400, visualizaciones: 9100, interacciones: 410, cuentasInteractuaron: 250, visitasAlPerfil: 77 });
    // Solo las del período (la de hace 40 días queda afuera aunque tenga más), de mayor a menor movimiento.
    expect(r.destacadas.map((p) => p.id)).toEqual(['2', '1', '4']);
    expect(r.destacadas[0]).toMatchObject({ likes: 50, comentarios: 7, enlace: 'https://www.instagram.com/p/2/' });
    expect(graph.mock.calls.every(([, permiso]) => permiso === ESTADISTICAS)).toBe(true);

    const consulta = graph.mock.calls.find(([, , ruta, init]) => ruta === '{ig}/insights' && init.query.metric === 'reach')![3].query;
    expect(consulta).toMatchObject({ period: 'day', metric_type: 'total_value' });
    expect(Number(consulta.until) - Number(consulta.since)).toBe(7 * 86400);
  });

  it('una métrica que falla o viene vacía queda en null y el resto se muestra', async () => {
    const graph = grafo({ reach: 100, views: 'falla', total_interactions: 5 });
    const r = await new InstagramEstadisticasService({ graph } as any).resumen(BIZ, 28);
    expect(r.metricas).toEqual({ alcance: 100, visualizaciones: null, interacciones: 5, cuentasInteractuaron: null, visitasAlPerfil: null });
    const consulta = graph.mock.calls.find(([, , ruta]) => ruta === '{ig}/insights')![3].query;
    expect(Number(consulta.until) - Number(consulta.since)).toBe(28 * 86400);
  });

  it('si falla la cuenta (permiso, token) se informa en vez de mostrar ceros', async () => {
    const graph = jest.fn().mockRejectedValue(new ForbiddenException('Falta autorizar las estadísticas'));
    await expect(new InstagramEstadisticasService({ graph } as any).resumen(BIZ, 7)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('guarda el resultado unos minutos por negocio y período', async () => {
    const graph = grafo({ reach: 1 });
    const svc = new InstagramEstadisticasService({ graph } as any);
    await svc.resumen(BIZ, 7);
    const llamadas = graph.mock.calls.length;
    await svc.resumen(BIZ, 7);
    expect(graph.mock.calls.length).toBe(llamadas);
    await svc.resumen(BIZ, 28);
    expect(graph.mock.calls.length).toBeGreaterThan(llamadas);
    await svc.resumen('otro-negocio', 7);
    expect(graph.mock.calls.filter(([b]) => b === 'otro-negocio').length).toBeGreaterThan(0);
  });
});
