import { Inject, Injectable, Logger, OnModuleInit, Optional, UnprocessableEntityException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type MarketingInstagramBot } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { InstagramService } from '../../instagram/instagram.service';
import { InstagramComentariosService } from '../../instagram/instagram-comentarios.service';
import { InstagramRuteoService, type AtencionAlternativa, type ComentarioNuevo } from '../../instagram/instagram-ruteo.service';
import { recortarABytes } from '../../instagram/instagram-bot.service';
import { LLM_ADAPTER_BOT, type LlmAdapter, type LlmMessage } from '../../orbi/llm/llm-adapter.interface';
import type { MensajeDeCliente } from '../../orbi/atencion/estado';
import { describeError } from '../../common/utils/describe-error.util';
import { escaparHtml } from '../../common/utils/html';
import {
  BIENVENIDA, DERIVAR_SIN_RESPUESTA, GRACIAS_AL_DERIVAR, MENU, PIDE_DATOS_AL_DERIVAR, OPCION, OPCIONES, PALABRAS_CLAVE_POR_DEFECTO, PREGUNTAS_FRECUENTES,
  RESPUESTAS_PUBLICAS_POR_DEFECTO, SALUDO_COMENTARIO_POR_DEFECTO, TITULO_OPCION, enlacesDe, normalizar, promptDeVentas,
  respuestaDe, tienePalabraClave, type Opcion, type Precios, type Tarjeta,
} from './contenido';
import type { GuardarBotDeVentasDto } from './dto/guardar-bot-de-ventas.dto';

// El bot de ventas de Órbita en Instagram: contesta los mensajes y los comentarios de la cuenta de la EMPRESA para
// llevar a la persona a crear su cuenta. Es un bot armado (botones y tarjetas, contenido.ts) y, para las preguntas
// sueltas, la IA con lo que dice la web de Órbita y nada más; ante la duda deriva al equipo.
//
// Reglas que no se negocian:
// - Solo la cuenta de la empresa (MARKETING_NEGOCIO). Las tiendas siguen con Orbi.
// - Nada inventado: precios de la API, textos de la web.
// - Si alguien del equipo escribe en la charla (desde el super panel o desde la app), el bot se calla ahí hasta que lo
//   reactiven a mano. Lo mismo cuando la persona pide hablar con alguien.
// - Instagram deja contestar solo dentro de las 24 h del último mensaje de la persona y UN mensaje privado por
//   comentario: el bot nunca escribe por su cuenta fuera de eso.

const NEGOCIO_POR_DEFECTO = 'negocio';
const MAX_BYTES = 1000;
/** Tope de respuestas con IA por charla en 24 h: después, solo botones. */
const IA_POR_CHARLA = 20;
/** Tope de respuestas con IA de la cuenta en 24 h. */
const IA_POR_DIA = 800;
const ESPERA_IA_MS = 20_000;
const DIA_MS = 86_400_000;

export const MOTIVO_PIDIO_PERSONA = 'Pidió hablar con una persona.';
export const MOTIVO_SIN_RESPUESTA = 'El bot no supo responder y la pasó al equipo.';
export const MOTIVO_ESCRIBIO_EL_EQUIPO = 'Respondió alguien del equipo, así que el bot dejó de contestar en esta charla.';

export type EstadoMeta = { preguntasFrecuentes: string; suscripcion: string; al: string };

@Injectable()
export class InstagramVentasService implements AtencionAlternativa, OnModuleInit {
  private readonly logger = new Logger(InstagramVentasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly instagram: InstagramService,
    private readonly comentarios: InstagramComentariosService,
    private readonly ruteo: InstagramRuteoService,
    private readonly suscripciones: SubscriptionsService,
    @Inject(LLM_ADAPTER_BOT) private readonly llm: Pick<LlmAdapter, 'streamChat'>,
    @Optional() private readonly mail?: MailService,
  ) {}

  onModuleInit() {
    this.ruteo.registrar(this);
  }

  // ── Negocio de la empresa y configuración ─────────────────────────────────

  async negocioId(): Promise<string | null> {
    const subdominio = this.config.get<string>('MARKETING_NEGOCIO')?.trim().toLowerCase() || NEGOCIO_POR_DEFECTO;
    const n = await this.prisma.business.findFirst({ where: { subdomain: subdominio, deletedAt: null }, select: { id: true } });
    return n?.id ?? null;
  }

  private leer(businessId: string) {
    return this.prisma.marketingInstagramBot.findUnique({ where: { businessId } });
  }

  async atiende(businessId: string): Promise<boolean> {
    const cfg = await this.prisma.marketingInstagramBot.findUnique({ where: { businessId }, select: { activo: true } });
    if (!cfg?.activo) return false;
    // Doble seguro: aunque una fila quedara en otro negocio, solo atiende la cuenta de la empresa.
    return (await this.negocioId()) === businessId;
  }

  /** Lo que muestra el super panel. Sin fila todavía, los valores por defecto (apagado). */
  async estado() {
    const businessId = await this.negocioId();
    if (!businessId) return null;
    const cfg = await this.leer(businessId);
    const recientes = await this.prisma.marketingInstagramComentario.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, usuario: true, texto: true, privado: true, publico: true, error: true, createdAt: true },
    });
    const desde = new Date(Date.now() - 7 * DIA_MS);
    const [derivadas, respuestas] = await Promise.all([
      this.prisma.conversation.count({ where: { businessId, botEstado: 'DERIVADO', messages: { some: { channel: 'INSTAGRAM' } } } }),
      this.prisma.message.count({ where: { channel: 'INSTAGRAM', viaOrbi: true, createdAt: { gte: desde }, conversation: { businessId } } }),
    ]);
    return {
      activo: cfg?.activo ?? false,
      usarIa: cfg?.usarIa ?? true,
      responderComentarios: cfg?.responderComentarios ?? true,
      todosLosComentarios: cfg?.todosLosComentarios ?? false,
      palabrasClave: cfg?.palabrasClave.length ? cfg.palabrasClave : PALABRAS_CLAVE_POR_DEFECTO,
      respuestasPublicas: cfg ? cfg.respuestasPublicas : RESPUESTAS_PUBLICAS_POR_DEFECTO,
      saludoComentario: cfg?.saludoComentario ?? SALUDO_COMENTARIO_POR_DEFECTO,
      correosAviso: cfg?.correosAviso ?? [],
      estadoMeta: (cfg?.estadoMeta as EstadoMeta | null) ?? null,
      comentariosRecientes: recientes,
      resumen: { charlasEsperandoAlEquipo: derivadas, respuestasUltimos7Dias: respuestas },
    };
  }

  async guardar(adminId: string, dto: GuardarBotDeVentasDto) {
    const businessId = await this.negocioId();
    if (!businessId) throw new UnprocessableEntityException('No se encontró el negocio de la empresa');
    const limpiar = (xs: string[] | undefined) => [...new Set((xs ?? []).map((x) => x.trim()).filter(Boolean))];
    const data = {
      activo: dto.activo,
      usarIa: dto.usarIa,
      responderComentarios: dto.responderComentarios,
      todosLosComentarios: dto.todosLosComentarios,
      palabrasClave: limpiar(dto.palabrasClave).map((p) => p.toLowerCase()),
      respuestasPublicas: limpiar(dto.respuestasPublicas),
      saludoComentario: dto.saludoComentario?.trim() || null,
      correosAviso: limpiar(dto.correosAviso).map((c) => c.toLowerCase()),
    };
    const antes = await this.leer(businessId);
    await this.prisma.marketingInstagramBot.upsert({ where: { businessId }, create: { businessId, ...data }, update: data });

    // Prenderlo (o guardarlo prendido) deja lista la cuenta: preguntas frecuentes y avisos de botones y comentarios.
    // Apagarlo saca las preguntas frecuentes. Ninguna de las dos cosas puede impedir guardar: se informa el resultado.
    if (dto.activo || antes?.activo) {
      const estadoMeta = await this.prepararCuenta(businessId, dto.activo);
      await this.prisma.marketingInstagramBot.update({ where: { businessId }, data: { estadoMeta } });
    }
    await this.prisma.platformAdminLog
      .create({ data: { adminId, action: 'instagram_bot_ventas', targetType: 'marketing_instagram', targetId: businessId, details: { activo: dto.activo } } })
      .catch(() => undefined);
    return this.estado();
  }

  private async prepararCuenta(businessId: string, activo: boolean): Promise<EstadoMeta> {
    const resultado = async (f: () => Promise<void>) => {
      try {
        await f();
        return 'ok';
      } catch (e) {
        return describeError(e).slice(0, 300);
      }
    };
    const preguntasFrecuentes = await resultado(() =>
      this.instagram.configurarPreguntasFrecuentes(businessId, activo ? PREGUNTAS_FRECUENTES.map((p) => ({ pregunta: p.pregunta, payload: p.opcion })) : null),
    );
    const suscripcion = activo ? await resultado(() => this.instagram.suscribirCampos(businessId, ['messages', 'messaging_postbacks', 'comments'])) : 'ok';
    return { preguntasFrecuentes, suscripcion, al: new Date().toISOString() };
  }

  /** Reactivar el bot en una charla que estaba en manos del equipo. */
  async reactivar(conversationId: string) {
    const businessId = await this.negocioId();
    if (!businessId) throw new UnprocessableEntityException('No se encontró el negocio de la empresa');
    await this.prisma.conversation.updateMany({
      where: { id: conversationId, businessId },
      data: { botEstado: 'DEFAULT', botMotivo: null, botCambiadoAt: new Date() },
    });
    return { ok: true };
  }

  async pausarPorPersona(businessId: string, conversationId: string): Promise<void> {
    if (!(await this.atiende(businessId))) return;
    await this.prisma.conversation.updateMany({
      where: { id: conversationId, businessId, botEstado: { in: ['DEFAULT', 'ON'] } },
      data: { botEstado: 'PAUSADO', botMotivo: MOTIVO_ESCRIBIO_EL_EQUIPO, botCambiadoAt: new Date() },
    });
  }

  // ── Mensajes directos ─────────────────────────────────────────────────────

  async atender(mensajes: MensajeDeCliente[]): Promise<void> {
    for (const m of mensajes) {
      try {
        await this.atenderUno(m);
      } catch (e) {
        this.logger.error(`No se pudo contestar en ${m.conversationId}: ${describeError(e)}`);
      }
    }
  }

  private async atenderUno(m: MensajeDeCliente): Promise<void> {
    const cfg = await this.leer(m.businessId);
    if (!cfg?.activo) return;
    const conv = await this.prisma.conversation.findFirst({ where: { id: m.conversationId, businessId: m.businessId }, select: { botEstado: true } });
    if (!conv) return;
    if (conv.botEstado === 'DERIVADO') return this.agradecerUnaVez(m, cfg);
    if (conv.botEstado === 'PAUSADO' || conv.botEstado === 'OFF') return;

    const opcion = opcionDe(m);
    if (opcion) return this.responderOpcion(m, cfg, opcion);
    // Fotos, audios y archivos no los lee: los ve el equipo en la bandeja.
    if (!m.esTexto || !m.texto) return;

    if (cfg.usarIa && (await this.quedaIa(m.businessId, m.conversationId))) {
      const respuesta = await this.preguntarIa(m);
      if (respuesta === null) return this.derivar(m, cfg, MOTIVO_SIN_RESPUESTA, DERIVAR_SIN_RESPUESTA);
      return this.enviarTexto(m, respuesta, MENU);
    }
    return this.enviarTexto(m, BIENVENIDA, MENU);
  }

  private async responderOpcion(m: MensajeDeCliente, cfg: MarketingInstagramBot, opcion: Opcion): Promise<void> {
    const r = respuestaDe(opcion, this.enlaces(), await this.precios());
    if (r.derivar) return this.derivar(m, cfg, MOTIVO_PIDIO_PERSONA, (r.piezas[0] as { texto: string }).texto);
    for (let i = 0; i < r.piezas.length; i++) {
      const pieza = r.piezas[i];
      const ultima = i === r.piezas.length - 1;
      if ('tarjetas' in pieza) await this.enviarTarjetas(m, pieza.tarjetas);
      else await this.enviarTexto(m, pieza.texto, ultima ? r.siguientes : []);
    }
  }

  private async derivar(m: MensajeDeCliente, cfg: MarketingInstagramBot, motivo: string, texto: string): Promise<void> {
    await this.enviarTexto(m, texto, []);
    await this.prisma.conversation.updateMany({
      where: { id: m.conversationId, businessId: m.businessId },
      data: { botEstado: 'DERIVADO', botMotivo: motivo, botCambiadoAt: new Date(), isUnread: true },
    });
    await this.avisarAlEquipo(cfg, m, motivo);
  }

  /**
   * La charla ya es del equipo. Si lo último que dijo el bot fue la pregunta de "¿qué vendés?" (o el aviso de que no
   * sabía) y la persona contesta, agradece una sola vez y le reenvía al equipo lo que contó. Si después de eso sigue
   * escribiendo, o si ya contestó alguien del equipo, no dice nada más.
   */
  private async agradecerUnaVez(m: MensajeDeCliente, cfg: MarketingInstagramBot): Promise<void> {
    if (!m.esTexto || !m.texto) return;
    const ultimo = await this.prisma.message.findFirst({
      where: { conversationId: m.conversationId, conversation: { businessId: m.businessId }, sender: 'STORE' },
      orderBy: { createdAt: 'desc' },
      select: { viaOrbi: true, text: true },
    });
    if (!ultimo?.viaOrbi || (ultimo.text !== PIDE_DATOS_AL_DERIVAR && ultimo.text !== DERIVAR_SIN_RESPUESTA)) return;
    await this.enviarTexto(m, GRACIAS_AL_DERIVAR, []);
    await this.avisarAlEquipo(cfg, m, 'Contó más sobre lo que necesita.');
  }

  private async avisarAlEquipo(cfg: MarketingInstagramBot, m: MensajeDeCliente, motivo: string): Promise<void> {
    if (!this.mail || cfg.correosAviso.length === 0) return;
    const cliente = await this.prisma.customer.findFirst({ where: { id: m.customerId, businessId: m.businessId }, select: { firstName: true } });
    const nombre = cliente?.firstName ?? 'Alguien';
    const sitio = (this.config.get<string>('FRONTEND_URL') ?? 'https://orbita.site').replace(/\/+$/, '');
    const html = `<p>${escaparHtml(nombre)} escribió a la cuenta de Instagram de Órbita. ${escaparHtml(motivo)}</p>`
      + (m.texto ? `<p>Su último mensaje: «${escaparHtml(m.texto.slice(0, 500))}»</p>` : '')
      + `<p>Respondele desde <a href="${sitio}/superadmin?seccion=marketing">Superadmin → Marketing → Instagram → Mensajes</a>. Instagram deja contestar dentro de las 24 horas de su último mensaje.</p>`;
    for (const correo of cfg.correosAviso) {
      try {
        await this.mail.sendCustomEmail(correo, `Instagram: ${nombre} quiere hablar con alguien`, html);
      } catch (e) {
        this.logger.warn(`No se pudo avisar a ${correo}: ${describeError(e)}`);
      }
    }
  }

  // ── Comentarios ───────────────────────────────────────────────────────────

  async atenderComentarios(comentarios: ComentarioNuevo[]): Promise<void> {
    for (const c of comentarios) {
      try {
        await this.atenderComentario(c);
      } catch (e) {
        this.logger.error(`No se pudo atender el comentario ${c.commentId}: ${describeError(e)}`);
      }
    }
  }

  private async atenderComentario(c: ComentarioNuevo): Promise<void> {
    if (!(await this.atiende(c.businessId))) return;
    const cfg = await this.leer(c.businessId);
    if (!cfg?.responderComentarios) return;
    const palabras = cfg.palabrasClave.length ? cfg.palabrasClave : PALABRAS_CLAVE_POR_DEFECTO;
    if (!cfg.todosLosComentarios && !tienePalabraClave(c.texto, palabras)) return;

    // Un solo mensaje privado por comentario: si Meta reintenta el aviso, el segundo choca con el commentId único.
    let filaId: string;
    try {
      const fila = await this.prisma.marketingInstagramComentario.create({
        data: { businessId: c.businessId, commentId: c.commentId, mediaId: c.mediaId, usuario: c.autorUsuario, texto: c.texto.slice(0, 500) },
        select: { id: true },
      });
      filaId = fila.id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return;
      throw e;
    }

    const errores: string[] = [];
    let privado = false;
    let publico = false;
    const saludo = recortarABytes(cfg.saludoComentario?.trim() || SALUDO_COMENTARIO_POR_DEFECTO, MAX_BYTES);
    try {
      const r = await this.instagram.responderComentarioPorPrivado(c.businessId, c.commentId, saludo, MENU.map((o) => ({ titulo: TITULO_OPCION[o], payload: o })));
      privado = true;
      // Se guarda en la charla con esa persona, para que el equipo lo vea en la bandeja.
      const conversationId = await this.instagram.asegurarConversacion(c.businessId, r.destinatario ?? c.autorId, c.autorUsuario);
      if (conversationId) {
        await this.prisma.message.create({
          data: { conversationId, sender: 'STORE', text: saludo, channel: 'INSTAGRAM', externalId: r.messageId, viaOrbi: true, deliveryStatus: 'sent' },
        });
      }
    } catch (e) {
      errores.push(`Mensaje privado: ${describeError(e)}`);
    }

    if (cfg.respuestasPublicas.length > 0) {
      const frase = cfg.respuestasPublicas[Math.floor(Math.random() * cfg.respuestasPublicas.length)];
      try {
        await this.comentarios.responder(c.businessId, c.commentId, frase);
        publico = true;
      } catch (e) {
        errores.push(`Respuesta pública: ${describeError(e)}`);
      }
    }

    await this.prisma.marketingInstagramComentario.update({
      where: { id: filaId },
      data: { privado, publico, error: errores.length ? errores.join(' · ').slice(0, 500) : null },
    });
  }

  // ── Envío ─────────────────────────────────────────────────────────────────

  private async enviarTexto(m: MensajeDeCliente, texto: string, siguientes: Opcion[]): Promise<void> {
    const t = recortarABytes(texto, MAX_BYTES);
    let externalId: string;
    if (siguientes.length > 0) {
      const opciones = siguientes.map((o) => ({ titulo: TITULO_OPCION[o], payload: o }));
      try {
        externalId = await this.instagram.enviarConRespuestasRapidas(m.businessId, m.conversationId, m.destinatario, t, opciones);
      } catch (e) {
        if (e instanceof UnprocessableEntityException || e instanceof ConflictException) throw e;
        this.logger.warn(`Instagram no aceptó los botones en ${m.conversationId}; va solo el texto: ${describeError(e)}`);
        externalId = await this.instagram.enviarTexto(m.businessId, m.conversationId, m.destinatario, t);
      }
    } else {
      externalId = await this.instagram.enviarTexto(m.businessId, m.conversationId, m.destinatario, t);
    }
    await this.guardarEnviado(m, t, externalId);
  }

  /** Las tarjetas son un extra: si Instagram las rechaza, el texto de al lado ya trae los enlaces. */
  private async enviarTarjetas(m: MensajeDeCliente, tarjetas: Tarjeta[]): Promise<void> {
    try {
      const externalId = await this.instagram.enviarTarjetas(m.businessId, m.conversationId, m.destinatario, tarjetas.map((t) => ({
        titulo: t.titulo,
        subtitulo: t.subtitulo,
        imagen: t.imagen,
        botones: t.botones.map((b) => (b.url ? { titulo: b.titulo, url: b.url } : { titulo: b.titulo, payload: b.opcion as string })),
      })));
      await this.guardarEnviado(m, `[Tarjetas] ${tarjetas.map((t) => t.titulo).join(' · ')}`, externalId);
    } catch (e) {
      if (e instanceof UnprocessableEntityException || e instanceof ConflictException) throw e;
      this.logger.warn(`Instagram no aceptó las tarjetas en ${m.conversationId}: ${describeError(e)}`);
    }
  }

  private async guardarEnviado(m: MensajeDeCliente, texto: string, externalId: string): Promise<void> {
    await this.prisma.message.create({
      data: { conversationId: m.conversationId, sender: 'STORE', text: texto, channel: 'INSTAGRAM', externalId, viaOrbi: true, deliveryStatus: 'sent' },
    });
    await this.prisma.conversation.updateMany({ where: { id: m.conversationId, businessId: m.businessId }, data: { updatedAt: new Date() } });
  }

  // ── IA ────────────────────────────────────────────────────────────────────

  private async quedaIa(businessId: string, conversationId: string): Promise<boolean> {
    const desde = new Date(Date.now() - DIA_MS);
    const [enLaCharla, enElDia] = await Promise.all([
      this.prisma.message.count({ where: { conversationId, conversation: { businessId }, viaOrbi: true, createdAt: { gte: desde } } }),
      this.prisma.message.count({ where: { channel: 'INSTAGRAM', viaOrbi: true, createdAt: { gte: desde }, conversation: { businessId } } }),
    ]);
    return enLaCharla < IA_POR_CHARLA && enElDia < IA_POR_DIA;
  }

  /** La respuesta de la IA, o null si no la sabe (o falló): entonces se deriva al equipo. */
  private async preguntarIa(m: MensajeDeCliente): Promise<string | null> {
    const previos = await this.prisma.message.findMany({
      where: { conversationId: m.conversationId, conversation: { businessId: m.businessId }, channel: 'INSTAGRAM' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { sender: true, text: true },
    });
    const historial: LlmMessage[] = previos
      .reverse()
      .filter((x) => !x.text.startsWith('[Tarjetas]'))
      .map((x) => ({ role: x.sender === 'CUSTOMER' ? 'user' : 'assistant', content: x.text }));
    if (historial.length === 0 || historial[historial.length - 1].role !== 'user') historial.push({ role: 'user', content: m.texto ?? '' });

    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), ESPERA_IA_MS);
    let texto = '';
    try {
      for await (const ev of this.llm.streamChat({ messages: [{ role: 'system', content: promptDeVentas(this.enlaces(), await this.precios()) }, ...historial], signal: corte.signal })) {
        if (ev.type === 'text') texto += ev.chunk;
      }
    } catch (e) {
      this.logger.warn(`La IA no respondió en ${m.conversationId}: ${describeError(e)}`);
      return null;
    } finally {
      clearTimeout(reloj);
    }
    const limpio = texto.replace(/\*+/g, '').trim();
    if (!limpio || limpio.includes('[DERIVAR]')) return null;
    return limpio;
  }

  // ── Datos de Órbita ───────────────────────────────────────────────────────

  private enlaces() {
    return enlacesDe(this.config.get<string>('FRONTEND_URL') ?? 'https://orbita.site');
  }

  /** Los mismos precios que la página de planes (lista y promo vigente). */
  private async precios(): Promise<Precios> {
    const o = await this.suscripciones.ofertaPublica();
    return {
      base: o.list.base,
      avanzado: o.list.avanzado,
      campania: o.campaign ? { base: o.campaign.priceBase, avanzado: o.campaign.priceAdvanced, meses: o.campaign.months } : null,
    };
  }
}

/**
 * La opción que eligió: un botón, una tarjeta o una pregunta frecuente (vienen con su payload) o, desde la computadora
 * (donde no se ven los botones), el nombre de la opción escrito tal cual.
 */
export function opcionDe(m: Pick<MensajeDeCliente, 'opcionId' | 'texto'>): Opcion | null {
  if (m.opcionId && OPCIONES.includes(m.opcionId)) return m.opcionId as Opcion;
  const t = normalizar(m.texto ?? '').replace(/[¿?¡!.]/g, '').trim();
  if (!t) return null;
  const escritas: Record<string, Opcion> = {
    'como funciona': OPCION.COMO,
    'que es orbita': OPCION.COMO,
    precios: OPCION.PRECIOS,
    precio: OPCION.PRECIOS,
    'cuanto cuesta': OPCION.PRECIOS,
    'ver la demo': OPCION.DEMO,
    demo: OPCION.DEMO,
    'la demo': OPCION.DEMO,
    'quiero ver una demo': OPCION.DEMO,
    'empezar ahora': OPCION.EMPEZAR,
    empezar: OPCION.EMPEZAR,
    'hablar con alguien': OPCION.PERSONA,
    'quiero hablar con alguien': OPCION.PERSONA,
    'hablar con una persona': OPCION.PERSONA,
  };
  return escritas[t] ?? null;
}
