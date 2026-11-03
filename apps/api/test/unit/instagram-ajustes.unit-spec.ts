import {
  ANTIGUEDAD_MAXIMA_MS, ENTRE_AUSENCIAS_MS, InstagramAjustesService, aAjustes, fueraDeHorario, tienePalabraProhibida,
  type AjustesDeInstagram,
} from '../../src/instagram/instagram-ajustes.service';
import { InstagramComentariosService } from '../../src/instagram/instagram-comentarios.service';
import { InstagramService } from '../../src/instagram/instagram.service';

// Respuestas automáticas y moderación: que la bienvenida salga una sola vez, que la ausencia no se repita ni salga
// en horario de atención ni por un mensaje viejo, y que la moderación oculte solo lo que corresponde.

const BIZ = 'biz-1';
const HORARIO = { activa: true, texto: 'Atendemos de 9 a 18', desde: '09:00', hasta: '18:00', dias: [1, 2, 3, 4, 5] };
// Lunes 12 de octubre de 2026 a las 12:00 en Argentina (15:00 UTC).
const LUNES_MEDIODIA = new Date('2026-10-12T15:00:00Z');
const LUNES_NOCHE = new Date('2026-10-12T23:30:00Z'); // 20:30 en Argentina
const SABADO = new Date('2026-10-17T15:00:00Z');

describe('fueraDeHorario', () => {
  it('dentro del horario y del día de atención no está fuera', () => {
    expect(fueraDeHorario(HORARIO, LUNES_MEDIODIA)).toBe(false);
  });
  it('de noche o en un día que no se atiende, sí', () => {
    expect(fueraDeHorario(HORARIO, LUNES_NOCHE)).toBe(true);
    expect(fueraDeHorario(HORARIO, SABADO)).toBe(true);
  });
  it('usa la hora de Argentina, no la del servidor (a las 15 h UTC son las 12 h acá)', () => {
    expect(fueraDeHorario({ ...HORARIO, desde: '13:00' }, LUNES_MEDIODIA)).toBe(true);
  });
  it('un horario que cruza la medianoche atiende de noche', () => {
    const nocturno = { ...HORARIO, desde: '20:00', hasta: '04:00' };
    expect(fueraDeHorario(nocturno, LUNES_NOCHE)).toBe(false);
    expect(fueraDeHorario(nocturno, LUNES_MEDIODIA)).toBe(true);
  });
});

describe('tienePalabraProhibida', () => {
  it('no distingue mayúsculas ni tildes, y encuentra frases', () => {
    expect(tienePalabraProhibida('Esto es una ESTAFA!!', ['estafa'])).toBe(true);
    expect(tienePalabraProhibida('qué vergüenza', ['verguenza'])).toBe(true);
    expect(tienePalabraProhibida('ganá dinero rápido ya', ['dinero rapido'])).toBe(true);
    expect(tienePalabraProhibida('me encantó', ['estafa'])).toBe(false);
  });
  it('una palabra de una sola letra o vacía no oculta todo', () => {
    expect(tienePalabraProhibida('hola', ['', ' ', 'a'])).toBe(false);
  });
});

function armar(ajustes: Partial<AjustesDeInstagram> = {}, mensajeReciente = false) {
  const completos = { ...aAjustes(null), ...ajustes };
  const fila = {
    welcomeEnabled: completos.bienvenida.activa, welcomeText: completos.bienvenida.texto,
    awayEnabled: completos.ausencia.activa, awayText: completos.ausencia.texto,
    openFrom: completos.ausencia.desde, openTo: completos.ausencia.hasta, openDays: completos.ausencia.dias,
    moderationEnabled: completos.moderacion.activa, moderationWords: completos.moderacion.palabras,
  };
  const prisma: any = {
    instagramSettings: {
      findUnique: jest.fn().mockResolvedValue(fila),
      findMany: jest.fn().mockResolvedValue([{ businessId: BIZ, ...fila }]),
      upsert: jest.fn().mockImplementation(async ({ create }) => ({ ...fila, ...create })),
    },
    message: { findFirst: jest.fn().mockResolvedValue(mensajeReciente ? { id: 'm' } : null) },
  };
  return { svc: new InstagramAjustesService(prisma), prisma };
}

describe('respuestaAutomatica', () => {
  const BIENVENIDA = { activa: true, texto: 'Hola! Gracias por escribirnos' };
  const nuevo = { esNueva: true, enviadoEn: LUNES_MEDIODIA };

  it('la bienvenida sale con una persona nueva, y no con una conocida', async () => {
    const { svc } = armar({ bienvenida: BIENVENIDA });
    await expect(svc.respuestaAutomatica(BIZ, 'cv', nuevo, LUNES_MEDIODIA)).resolves.toBe('Hola! Gracias por escribirnos');
    await expect(svc.respuestaAutomatica(BIZ, 'cv', { ...nuevo, esNueva: false }, LUNES_MEDIODIA)).resolves.toBeNull();
  });

  it('sin nada prendido no contesta', async () => {
    const { svc } = armar();
    await expect(svc.respuestaAutomatica(BIZ, 'cv', nuevo, LUNES_MEDIODIA)).resolves.toBeNull();
  });

  it('la ausencia sale fuera de horario y no en horario de atención', async () => {
    const { svc } = armar({ ausencia: HORARIO });
    await expect(svc.respuestaAutomatica(BIZ, 'cv', { esNueva: false, enviadoEn: LUNES_NOCHE }, LUNES_NOCHE)).resolves.toBe('Atendemos de 9 a 18');
    await expect(svc.respuestaAutomatica(BIZ, 'cv', { esNueva: false, enviadoEn: LUNES_MEDIODIA }, LUNES_MEDIODIA)).resolves.toBeNull();
  });

  it('la ausencia no se repite si el negocio ya contestó en las últimas 12 horas', async () => {
    const { svc, prisma } = armar({ ausencia: HORARIO }, true);
    await expect(svc.respuestaAutomatica(BIZ, 'cv', { esNueva: false, enviadoEn: LUNES_NOCHE }, LUNES_NOCHE)).resolves.toBeNull();
    const { where } = prisma.message.findFirst.mock.calls[0][0];
    expect(where).toMatchObject({ conversationId: 'cv', channel: 'INSTAGRAM', sender: 'STORE' });
    expect(LUNES_NOCHE.getTime() - where.createdAt.gte.getTime()).toBe(ENTRE_AUSENCIAS_MS);
  });

  it('con bienvenida y ausencia a la vez, a una persona nueva fuera de horario le llega solo la bienvenida', async () => {
    const { svc } = armar({ bienvenida: BIENVENIDA, ausencia: HORARIO });
    await expect(svc.respuestaAutomatica(BIZ, 'cv', { esNueva: true, enviadoEn: LUNES_NOCHE }, LUNES_NOCHE)).resolves.toBe('Hola! Gracias por escribirnos');
  });

  it('un mensaje viejo (un reintento de Meta) no se contesta solo', async () => {
    const { svc } = armar({ bienvenida: BIENVENIDA });
    const viejo = new Date(LUNES_MEDIODIA.getTime() - ANTIGUEDAD_MAXIMA_MS - 1000);
    await expect(svc.respuestaAutomatica(BIZ, 'cv', { esNueva: true, enviadoEn: viejo }, LUNES_MEDIODIA)).resolves.toBeNull();
  });
});

describe('guardar', () => {
  it('no deja prendida una respuesta sin texto ni una moderación sin palabras, y limpia las palabras', async () => {
    const { svc, prisma } = armar();
    const r = await svc.guardar(BIZ, {
      bienvenida: { activa: true, texto: '   ' },
      ausencia: { ...HORARIO, texto: ' Fuera de horario ' },
      moderacion: { activa: true, palabras: [' estafa ', 'Estafa', 'x', '', 'spam'] },
    });
    const { create } = prisma.instagramSettings.upsert.mock.calls[0][0];
    expect(create).toMatchObject({ businessId: BIZ, welcomeEnabled: false, awayEnabled: true, awayText: 'Fuera de horario', moderationEnabled: true, moderationWords: ['estafa', 'Estafa', 'spam'] });
    expect(r.bienvenida.activa).toBe(false);
    const sinPalabras = await svc.guardar(BIZ, { bienvenida: { activa: false, texto: '' }, ausencia: { ...HORARIO, activa: false }, moderacion: { activa: true, palabras: [] } });
    expect(sinPalabras.moderacion.activa).toBe(false);
  });
});

describe('webhook: respuesta automática', () => {
  const IGSID = '9988776655';
  const IG_CUENTA = '17841400000000000';
  const evento = (mid: string) => ({
    object: 'instagram',
    entry: [{ id: IG_CUENTA, messaging: [{ sender: { id: IGSID }, recipient: { id: IG_CUENTA }, timestamp: Date.now(), message: { mid, text: 'hola' } }] }],
  });

  function armarWebhook(texto: string | null, conversacionExiste = false) {
    const prisma: any = {
      instagramConnection: { findUnique: jest.fn().mockResolvedValue({ businessId: BIZ, status: 'ACTIVE' }) },
      message: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue({ createdAt: new Date() }), create: jest.fn().mockReturnValue('msg') },
      customer: { findUnique: jest.fn().mockResolvedValue({ id: 'cli', deletedAt: null }) },
      conversation: {
        findFirst: jest.fn().mockResolvedValue(conversacionExiste ? { id: 'cv-1' } : null),
        create: jest.fn().mockResolvedValue({ id: 'cv-1' }),
        update: jest.fn().mockReturnValue('upd'),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ ig_user_id: IG_CUENTA, access_token: 'tok' }]),
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const ajustes: any = { respuestaAutomatica: jest.fn().mockResolvedValue(texto) };
    const config: any = { get: (k: string) => ({ INSTAGRAM_TOKEN_KEY: 'k', INSTAGRAM_APP_SECRET: 's' } as Record<string, string>)[k] };
    const svc = new InstagramService(prisma, config, undefined, undefined, ajustes);
    const enviar = jest.spyOn(svc, 'enviarTexto').mockResolvedValue('mid.AUTO');
    return { svc, prisma, ajustes, enviar };
  }

  it('si corresponde, contesta y guarda lo que mandó (como mensaje del negocio)', async () => {
    const { svc, prisma, ajustes, enviar } = armarWebhook('Hola! Ya te respondemos');
    await svc.procesarWebhook(evento('mid.1') as any);
    expect(ajustes.respuestaAutomatica).toHaveBeenCalledWith(BIZ, 'cv-1', expect.objectContaining({ esNueva: true }));
    expect(enviar).toHaveBeenCalledWith(BIZ, 'cv-1', IGSID, 'Hola! Ya te respondemos');
    expect(prisma.message.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({ sender: 'STORE', text: 'Hola! Ya te respondemos', channel: 'INSTAGRAM', externalId: 'mid.AUTO' }),
    });
  });

  it('con una charla que ya existía, no es "nueva"', async () => {
    const { svc, ajustes } = armarWebhook(null, true);
    await svc.procesarWebhook(evento('mid.2') as any);
    expect(ajustes.respuestaAutomatica).toHaveBeenCalledWith(BIZ, 'cv-1', expect.objectContaining({ esNueva: false }));
  });

  it('si no corresponde no manda nada, y si falla el envío el mensaje del cliente igual queda guardado', async () => {
    const sin = armarWebhook(null);
    await sin.svc.procesarWebhook(evento('mid.3') as any);
    expect(sin.enviar).not.toHaveBeenCalled();

    const falla = armarWebhook('Hola');
    falla.enviar.mockRejectedValue(new Error('Instagram caído'));
    await expect(falla.svc.procesarWebhook(evento('mid.4') as any)).resolves.toBeUndefined();
    expect(falla.prisma.$transaction).toHaveBeenCalled();
  });

  it('nunca contesta a lo que mandó el propio negocio (el eco)', async () => {
    const { svc, ajustes } = armarWebhook('Hola');
    const eco = { object: 'instagram', entry: [{ id: IG_CUENTA, messaging: [{ sender: { id: IG_CUENTA }, recipient: { id: IGSID }, timestamp: Date.now(), message: { mid: 'mid.5', text: 'hola', is_echo: true } }] }] };
    await svc.procesarWebhook(eco as any);
    expect(ajustes.respuestaAutomatica).not.toHaveBeenCalled();
  });
});

describe('moderación de comentarios', () => {
  function armarModeracion(palabras: string[], activa = true) {
    const ajustes: any = {
      obtener: jest.fn().mockResolvedValue({ ...aAjustes(null), moderacion: { activa, palabras } }),
      negociosConModeracion: jest.fn().mockResolvedValue([{ businessId: BIZ, palabras }]),
    };
    const graph = jest.fn().mockImplementation(async (_b: string, _p: string, ruta: string, init: any = {}) => {
      if (ruta === '{ig}/media') return { data: [{ id: '11111', caption: 'Remera', comments_count: 3 }] };
      if (ruta === '11111/comments') {
        return { data: [
          { id: '90001', text: 'Qué ESTAFA', username: 'a' },
          { id: '90002', text: 'Hermosa!', username: 'b' },
          { id: '90003', text: 'ya oculto estafa', username: 'c', hidden: true },
        ] };
      }
      if (init.query?.hide) return { success: true };
      throw new Error(`ruta inesperada ${ruta}`);
    });
    const ig: any = { graph };
    return { svc: new InstagramComentariosService(ig, ajustes), graph };
  }

  it('oculta los comentarios con palabras prohibidas que estaban a la vista, y avisa cuántos', async () => {
    const { svc, graph } = armarModeracion(['estafa']);
    const r = await svc.listar(BIZ);
    expect(r.ocultadosAutomaticamente).toBe(1);
    const ocultar = graph.mock.calls.filter((c) => c[3]?.query?.hide);
    expect(ocultar).toHaveLength(1);
    expect(ocultar[0][2]).toBe('90001');
    expect(r.publicaciones[0].comentarios.find((c) => c.id === '90001')?.oculto).toBe(true);
    expect(r.publicaciones[0].comentarios.find((c) => c.id === '90002')?.oculto).toBe(false);
  });

  it('con la moderación apagada no oculta nada', async () => {
    const { svc, graph } = armarModeracion(['estafa'], false);
    const r = await svc.listar(BIZ);
    expect(r.ocultadosAutomaticamente).toBe(0);
    expect(graph.mock.calls.some((c) => c[3]?.query?.hide)).toBe(false);
  });

  it('si Instagram rechaza ocultar uno, la lista se devuelve igual', async () => {
    const { svc, graph } = armarModeracion(['estafa']);
    graph.mockImplementationOnce(async () => ({ data: [{ id: '11111', comments_count: 1 }] }))
      .mockImplementationOnce(async () => ({ data: [{ id: '90001', text: 'estafa', username: 'a' }] }))
      .mockImplementationOnce(async () => { throw new Error('rechazado'); });
    const r = await svc.listar(BIZ);
    expect(r.ocultadosAutomaticamente).toBe(0);
    expect(r.publicaciones[0].comentarios[0].oculto).toBe(false);
  });

  it('el disparo periódico recorre los negocios con moderación prendida', async () => {
    const { svc } = armarModeracion(['estafa']);
    await expect(svc.moderarTodos()).resolves.toEqual({ negocios: 1, ocultados: 1 });
  });
});
