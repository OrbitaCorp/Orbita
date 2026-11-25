import { readFileSync } from 'fs';
import { join } from 'path';
import { Prisma } from '@prisma/client';
import {
  GRACIAS_AL_DERIVAR, MENU, OPCION, OPCIONES, PIDE_DATOS_AL_DERIVAR, PREGUNTAS_DE_LA_WEB, PREGUNTAS_FRECUENTES, TITULO_OPCION, enlacesDe, promptDeVentas, respuestaDe,
  BIENVENIDA, esSaludo, tienePalabraClave, type Opcion,
} from '../../src/marketing/instagram-ventas/contenido';
import { InstagramVentasService, opcionDe } from '../../src/marketing/instagram-ventas/instagram-ventas.service';

const enlaces = enlacesDe('https://orbita.site');
const precios = { base: 16500, avanzado: 21700, campania: null };
const NEGOCIO = 'neg-1';

describe('bot de ventas de Instagram: contenido', () => {
  it('respeta los límites de Instagram en botones, tarjetas y preguntas frecuentes', () => {
    expect(PREGUNTAS_FRECUENTES.length).toBeLessThanOrEqual(4);
    for (const o of OPCIONES) expect(TITULO_OPCION[o as Opcion].length).toBeLessThanOrEqual(20);
    for (const o of OPCIONES) {
      for (const p of [precios, { ...precios, campania: { base: 9900, avanzado: 12900, meses: 3 } }]) {
        const r = respuestaDe(o as Opcion, enlaces, p);
        for (const pieza of r.piezas) {
          if ('texto' in pieza) expect(Buffer.byteLength(pieza.texto, 'utf8')).toBeLessThanOrEqual(1000);
          else {
            expect(pieza.tarjetas.length).toBeLessThanOrEqual(10);
            for (const t of pieza.tarjetas) {
              expect(t.titulo.length).toBeLessThanOrEqual(80);
              expect(t.subtitulo.length).toBeLessThanOrEqual(80);
              expect(t.botones.length).toBeLessThanOrEqual(3);
              for (const b of t.botones) expect(b.titulo.length).toBeLessThanOrEqual(20);
            }
          }
        }
        // Los botones de abajo van pegados a un texto: la última pieza no puede ser un carrusel.
        if (r.siguientes.length > 0) expect('texto' in r.piezas[r.piezas.length - 1]).toBe(true);
      }
    }
  });

  it('cada respuesta con tarjetas lleva también los enlaces en el texto (en la computadora no se ven las tarjetas)', () => {
    expect(JSON.stringify(respuestaDe(OPCION.DEMO, enlaces, precios).piezas.filter((p) => 'texto' in p))).toContain(enlaces.demoTienda);
    expect(JSON.stringify(respuestaDe(OPCION.PRECIOS, enlaces, precios).piezas.filter((p) => 'texto' in p))).toContain(enlaces.planes);
    expect(JSON.stringify(respuestaDe(OPCION.EMPEZAR, enlaces, precios).piezas)).toContain('utm_source=instagram');
  });

  it('los precios salen de la API: lista o promo vigente', () => {
    expect(JSON.stringify(respuestaDe(OPCION.PRECIOS, enlaces, precios))).toContain('$16.500');
    const conPromo = JSON.stringify(respuestaDe(OPCION.PRECIOS, enlaces, { ...precios, campania: { base: 9900, avanzado: 12900, meses: 3 } }));
    expect(conPromo).toContain('$9.900');
    expect(conPromo).toContain('3 meses');
  });

  it('las preguntas frecuentes son las mismas de la web (es lo único que la IA sabe de Órbita)', () => {
    const web = readFileSync(join(__dirname, '../../../web/src/modules/landing/components/v2/Cierre.tsx'), 'utf8').replace(/\s+/g, ' ');
    const enLaWeb = (web.match(/\bq: '/g) ?? []).length;
    expect(PREGUNTAS_DE_LA_WEB.length).toBe(enLaWeb);
    for (const { q, a } of PREGUNTAS_DE_LA_WEB) {
      expect(web).toContain(q);
      expect(web).toContain(a);
    }
    const prompt = promptDeVentas(enlaces, precios);
    expect(prompt).toContain('[DERIVAR]');
    expect(prompt).toContain('$16.500');
  });

  it('palabras clave: palabras enteras, sin importar acentos ni mayúsculas', () => {
    const p = ['info', 'cuanto', 'me interesa'];
    expect(tienePalabraClave('Info 🙏', p)).toBe(true);
    expect(tienePalabraClave('¿Cuánto sale?', p)).toBe(true);
    expect(tienePalabraClave('A mí me interesa!', p)).toBe(true);
    expect(tienePalabraClave('muy informal todo', p)).toBe(false);
    expect(tienePalabraClave('qué lindo', p)).toBe(false);
  });

  it('reconoce la opción por el botón o escrita tal cual desde la computadora', () => {
    expect(opcionDe({ opcionId: OPCION.DEMO })).toBe(OPCION.DEMO);
    expect(opcionDe({ texto: 'Precios' })).toBe(OPCION.PRECIOS);
    expect(opcionDe({ texto: '¿Cuánto cuesta?' })).toBe(OPCION.PRECIOS);
    expect(opcionDe({ texto: 'Hablar con alguien' })).toBe(OPCION.PERSONA);
    expect(opcionDe({ texto: '¿sirve para una ferretería?' })).toBeNull();
    expect(opcionDe({ opcionId: 'OTRA_COSA', texto: 'hola' })).toBeNull();
  });
});

function armar(o: { cfg?: Record<string, unknown> | null; botEstado?: string; ia?: string; negocio?: string; cuentaConectada?: string } = {}) {
  const cfg = o.cfg === null ? null : {
    businessId: NEGOCIO, activo: true, usarIa: true, responderComentarios: true, todosLosComentarios: false,
    palabrasClave: ['info'], respuestasPublicas: ['¡Te escribimos!'], saludoComentario: null, correosAviso: ['equipo@orbita.test'], estadoMeta: null,
    cuenta: 'IG-EMPRESA',
    ...o.cfg,
  };
  const prisma = {
    business: { findFirst: jest.fn().mockResolvedValue({ id: o.negocio ?? NEGOCIO }) },
    marketingInstagramBot: { findUnique: jest.fn().mockResolvedValue(cfg), upsert: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}) },
    instagramConnection: { findUnique: jest.fn().mockResolvedValue({ igUserId: o.cuentaConectada ?? 'IG-EMPRESA', username: 'cuenta' }) },
    platformAdminLog: { create: jest.fn().mockResolvedValue({}) },
    conversation: { findFirst: jest.fn().mockResolvedValue({ botEstado: o.botEstado ?? 'DEFAULT' }), updateMany: jest.fn().mockResolvedValue({ count: 1 }), count: jest.fn().mockResolvedValue(0) },
    message: {
      create: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([{ sender: 'CUSTOMER', text: 'hola' }]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    customer: { findFirst: jest.fn().mockResolvedValue({ firstName: 'Lu' }) },
    marketingInstagramComentario: { create: jest.fn().mockResolvedValue({ id: 'fila' }), update: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
  };
  const config = { get: jest.fn((k: string) => (k === 'FRONTEND_URL' ? 'https://orbita.site' : undefined)) };
  const instagram = {
    enviarTexto: jest.fn().mockResolvedValue('mid-t'),
    enviarConRespuestasRapidas: jest.fn().mockResolvedValue('mid-q'),
    enviarTarjetas: jest.fn().mockResolvedValue('mid-c'),
    responderComentarioPorPrivado: jest.fn().mockResolvedValue({ messageId: 'mid-p', destinatario: 'igsid-1' }),
    asegurarConversacion: jest.fn().mockResolvedValue('conv-c'),
  };
  const comentarios = { responder: jest.fn().mockResolvedValue({ id: 'r1' }) };
  const ruteo = { registrar: jest.fn() };
  const suscripciones = { ofertaPublica: jest.fn().mockResolvedValue({ list: { base: 16500, avanzado: 21700 }, campaign: null }) };
  const llm = {
    streamChat: jest.fn(async function* () {
      yield { type: 'text', chunk: o.ia ?? 'Sí, podés vender por metro.' };
      yield { type: 'done' };
    }),
  };
  const mail = { sendCustomEmail: jest.fn().mockResolvedValue(true) };
  const svc = new InstagramVentasService(prisma as never, config as never, instagram as never, comentarios as never, ruteo as never, suscripciones as never, llm as never, mail as never);
  return { svc, prisma, instagram, comentarios, llm, mail };
}

const mensaje = (extra: Record<string, unknown>) => ({ businessId: NEGOCIO, conversationId: 'conv-1', customerId: 'cli-1', messageId: 'm1', destinatario: 'igsid-1', esTexto: true, ...extra });

describe('bot de ventas de Instagram: mensajes', () => {
  it('solo atiende la cuenta de la empresa', async () => {
    expect(await armar().svc.atiende(NEGOCIO)).toBe(true);
    expect(await armar({ negocio: 'otro' }).svc.atiende(NEGOCIO)).toBe(false);
    expect(await armar({ cfg: { activo: false } }).svc.atiende(NEGOCIO)).toBe(false);
  });

  it('solo atiende la cuenta de Instagram con la que se prendió: si se conecta otra, esa la atiende Orbi', async () => {
    expect(await armar({ cuentaConectada: 'IG-OTRA' }).svc.atiende(NEGOCIO)).toBe(false);
    expect(await armar({ cfg: { cuenta: null } }).svc.atiende(NEGOCIO)).toBe(false);
  });

  it('guardarlo prendido lo deja atendiendo la cuenta conectada, y el panel avisa si está prendido con otra', async () => {
    const { svc, prisma } = armar({ cuentaConectada: 'IG-OTRA' });
    expect((await svc.estado())?.prendidoConOtraCuenta).toBe(true);
    await svc.guardar('admin-1', {
      activo: true, usarIa: true, responderComentarios: true, todosLosComentarios: false, palabrasClave: ['info'], respuestasPublicas: [], saludoComentario: '', correosAviso: [],
    } as never);
    expect(prisma.marketingInstagramBot.upsert.mock.calls[0][0].update.cuenta).toBe('IG-OTRA');

    // Apagarlo no toca la cuenta.
    await svc.guardar('admin-1', {
      activo: false, usarIa: true, responderComentarios: true, todosLosComentarios: false, palabrasClave: ['info'], respuestasPublicas: [], saludoComentario: '', correosAviso: [],
    } as never);
    expect(prisma.marketingInstagramBot.upsert.mock.calls[1][0].update).not.toHaveProperty('cuenta');
  });

  it('una opción manda el texto, las tarjetas y los botones para seguir', async () => {
    const { svc, instagram, prisma } = armar();
    await svc.atender([mensaje({ texto: 'Precios', opcionId: OPCION.PRECIOS })]);
    expect(instagram.enviarTexto).toHaveBeenCalledTimes(1);
    expect(instagram.enviarTarjetas).toHaveBeenCalledTimes(1);
    expect(instagram.enviarConRespuestasRapidas).toHaveBeenCalledTimes(1);
    expect(prisma.message.create).toHaveBeenCalledTimes(3);
    expect(prisma.message.create.mock.calls.every((c: { data: { viaOrbi: boolean } }[]) => c[0].data.viaOrbi)).toBe(true);
  });

  it('se calla en una charla que está en manos del equipo', async () => {
    for (const botEstado of ['PAUSADO', 'DERIVADO']) {
      const { svc, instagram, llm } = armar({ botEstado });
      await svc.atender([mensaje({ texto: 'hola' })]);
      expect(instagram.enviarTexto).not.toHaveBeenCalled();
      expect(instagram.enviarConRespuestasRapidas).not.toHaveBeenCalled();
      expect(llm.streamChat).not.toHaveBeenCalled();
    }
  });

  it('una pregunta suelta la contesta la IA, con el menú para seguir', async () => {
    const { svc, instagram, llm } = armar();
    await svc.atender([mensaje({ texto: '¿sirve para una ferretería?' })]);
    expect(llm.streamChat).toHaveBeenCalledTimes(1);
    const [, , , texto, opciones] = instagram.enviarConRespuestasRapidas.mock.calls[0];
    expect(texto).toBe('Sí, podés vender por metro.');
    expect(opciones.map((x: { payload: string }) => x.payload)).toEqual(MENU);
  });

  it('si la IA no sabe, deriva al equipo, marca la charla y avisa por correo', async () => {
    const { svc, instagram, prisma, mail } = armar({ ia: '[DERIVAR]' });
    await svc.atender([mensaje({ texto: '¿me hacen una factura A?' })]);
    expect(instagram.enviarTexto.mock.calls[0][3]).toContain('prefiero no inventarte');
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ botEstado: 'DERIVADO' }) }));
    expect(mail.sendCustomEmail).toHaveBeenCalledWith('equipo@orbita.test', expect.any(String), expect.stringContaining('factura A'));
  });

  it('pedir una persona deriva y avisa', async () => {
    const { svc, prisma, mail } = armar();
    await svc.atender([mensaje({ texto: 'Hablar con alguien', opcionId: OPCION.PERSONA })]);
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ botEstado: 'DERIVADO' }) }));
    expect(mail.sendCustomEmail).toHaveBeenCalledTimes(1);
  });

  it('derivado: si contesta la pregunta del bot, agradece una sola vez y le pasa al equipo lo que contó', async () => {
    const { svc, instagram, prisma, mail, llm } = armar({ botEstado: 'DERIVADO' });
    const recien = new Date();
    prisma.message.findFirst.mockResolvedValueOnce({ viaOrbi: true, text: PIDE_DATOS_AL_DERIVAR, createdAt: recien });
    await svc.atender([mensaje({ texto: 'Vendo zapatos' })]);
    expect(instagram.enviarTexto.mock.calls[0][3]).toBe(GRACIAS_AL_DERIVAR);
    expect(mail.sendCustomEmail).toHaveBeenCalledWith('equipo@orbita.test', expect.any(String), expect.stringContaining('Vendo zapatos'));
    expect(llm.streamChat).not.toHaveBeenCalled();

    // Si sigue contando más, no lo contesta: lo último del bot es el agradecimiento y el equipo ya lo lee.
    prisma.message.findFirst.mockResolvedValueOnce({ viaOrbi: true, text: GRACIAS_AL_DERIVAR, createdAt: recien });
    await svc.atender([mensaje({ texto: 'unos 200 productos' })]);
    expect(instagram.enviarTexto).toHaveBeenCalledTimes(1);

    // Si ya contestó alguien del equipo, tampoco (aunque salude).
    prisma.message.findFirst.mockResolvedValueOnce({ viaOrbi: false, text: 'Hola, soy Mateo', createdAt: recien });
    await svc.atender([mensaje({ texto: 'hola' })]);
    expect(instagram.enviarTexto).toHaveBeenCalledTimes(1);
    expect(instagram.enviarConRespuestasRapidas).not.toHaveBeenCalled();
    expect(prisma.conversation.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ botEstado: 'DEFAULT' }) }));
  });

  it('derivado: si saluda, el bot vuelve a atender (no toma el saludo como respuesta)', async () => {
    const { svc, instagram, prisma } = armar({ botEstado: 'DERIVADO', cfg: { usarIa: false } });
    prisma.message.findFirst.mockResolvedValueOnce({ viaOrbi: true, text: GRACIAS_AL_DERIVAR, createdAt: new Date() });
    await svc.atender([mensaje({ texto: 'Hola' })]);
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ botEstado: 'DEFAULT' }) }));
    expect(instagram.enviarConRespuestasRapidas.mock.calls[0][3]).toBe(BIENVENIDA);
    expect(instagram.enviarTexto).not.toHaveBeenCalled();
  });

  it('derivado: pasado el plazo, lo nuevo no es la respuesta a la pregunta y el bot vuelve a atender', async () => {
    const { svc, instagram, prisma, llm, mail } = armar({ botEstado: 'DERIVADO' });
    const ayer = new Date(Date.now() - 20 * 3_600_000);
    prisma.message.findFirst.mockResolvedValueOnce({ viaOrbi: true, text: PIDE_DATOS_AL_DERIVAR, createdAt: ayer });
    await svc.atender([mensaje({ texto: '¿cuánto sale?' })]);
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ botEstado: 'DEFAULT' }) }));
    expect(llm.streamChat).toHaveBeenCalledTimes(1);
    expect(instagram.enviarTexto).not.toHaveBeenCalled();
    expect(mail.sendCustomEmail).not.toHaveBeenCalled();
  });

  it('reconoce un saludo suelto, pero no una respuesta', () => {
    for (const s of ['Hola', 'hola que tal', 'Holaaa!!', 'buenas tardes', 'Buen día, cómo estás?']) expect(esSaludo(s)).toBe(true);
    for (const s of ['Vendo zapatos', 'hola, vendo ropa', 'unos 200 productos', '']) expect(esSaludo(s)).toBe(false);
  });

  it('con la IA apagada contesta con el menú y no llama al modelo', async () => {
    const { svc, instagram, llm } = armar({ cfg: { usarIa: false } });
    await svc.atender([mensaje({ texto: '¿sirve para una ferretería?' })]);
    expect(llm.streamChat).not.toHaveBeenCalled();
    expect(instagram.enviarConRespuestasRapidas).toHaveBeenCalledTimes(1);
  });

  it('un saludo va con la bienvenida y el menú, sin preguntarle a la IA (y sin derivar)', async () => {
    const { svc, instagram, prisma, llm } = armar({ ia: '[DERIVAR]' });
    await svc.atender([mensaje({ texto: 'Hola' })]);
    expect(llm.streamChat).not.toHaveBeenCalled();
    expect(instagram.enviarConRespuestasRapidas.mock.calls[0][3]).toBe(BIENVENIDA);
    expect(prisma.conversation.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ botEstado: 'DERIVADO' }) }));
  });

  it('si la IA falla o no dice nada, contesta con el menú en vez de "no la sé"', async () => {
    for (const ia of ['', '   ']) {
      const { svc, instagram, prisma } = armar({ ia });
      await svc.atender([mensaje({ texto: '¿sirve para una ferretería?' })]);
      expect(instagram.enviarConRespuestasRapidas.mock.calls[0][3]).toBe(BIENVENIDA);
      expect(instagram.enviarTexto).not.toHaveBeenCalled();
      expect(prisma.conversation.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ botEstado: 'DERIVADO' }) }));
    }
    const { svc, instagram, llm } = armar();
    llm.streamChat.mockImplementationOnce(async function* () { throw new Error('timeout'); });
    await svc.atender([mensaje({ texto: '¿sirve para una ferretería?' })]);
    expect(instagram.enviarConRespuestasRapidas.mock.calls[0][3]).toBe(BIENVENIDA);
  });
});

describe('bot de ventas de Instagram: comentarios', () => {
  const comentario = (texto: string) => ({ businessId: NEGOCIO, commentId: 'c1', texto, autorId: 'igsid-1', autorUsuario: 'lu', mediaId: 'p1' });

  it('con palabra clave: mensaje privado con botones, respuesta pública y queda en la bandeja', async () => {
    const { svc, instagram, comentarios, prisma } = armar();
    await svc.atenderComentarios([comentario('info porfa')]);
    expect(instagram.responderComentarioPorPrivado).toHaveBeenCalledWith(NEGOCIO, 'c1', expect.any(String), expect.arrayContaining([expect.objectContaining({ payload: OPCION.PRECIOS })]));
    expect(comentarios.responder).toHaveBeenCalledWith(NEGOCIO, 'c1', '¡Te escribimos!');
    expect(prisma.message.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ conversationId: 'conv-c', externalId: 'mid-p' }) }));
    expect(prisma.marketingInstagramComentario.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ privado: true, publico: true, error: null }) }));
  });

  it('sin palabra clave no hace nada (salvo que esté prendido "todos los comentarios")', async () => {
    const a = armar();
    await a.svc.atenderComentarios([comentario('qué lindo!')]);
    expect(a.instagram.responderComentarioPorPrivado).not.toHaveBeenCalled();
    const b = armar({ cfg: { todosLosComentarios: true } });
    await b.svc.atenderComentarios([comentario('qué lindo!')]);
    expect(b.instagram.responderComentarioPorPrivado).toHaveBeenCalledTimes(1);
  });

  it('un aviso repetido de Meta no manda un segundo mensaje privado', async () => {
    const { svc, instagram, prisma } = armar();
    prisma.marketingInstagramComentario.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('duplicado', { code: 'P2002', clientVersion: 'x' }));
    await svc.atenderComentarios([comentario('info')]);
    expect(instagram.responderComentarioPorPrivado).not.toHaveBeenCalled();
  });

  it('si falla el mensaje privado igual contesta en público y anota el error', async () => {
    const { svc, instagram, comentarios, prisma } = armar();
    instagram.responderComentarioPorPrivado.mockRejectedValueOnce(new Error('ventana vencida'));
    await svc.atenderComentarios([comentario('info')]);
    expect(comentarios.responder).toHaveBeenCalled();
    expect(prisma.marketingInstagramComentario.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ privado: false, error: expect.stringContaining('ventana vencida') }) }));
  });
});
