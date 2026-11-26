import { ForbiddenException, Injectable, Logger, Optional, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { describeError } from '../common/utils/describe-error.util';
import { InstagramMediosService } from './instagram-medios.service';
import { InstagramApiError, InstagramService, SCOPE_MENSAJES } from './instagram.service';

// Al conectar una cuenta de Instagram, la bandeja arrancaba vacía: solo mostraba lo que llegaba por webhook desde ese
// momento. Esto trae las charlas que la cuenta ya tenía, con la API de Conversaciones (Instagram API with Instagram Login):
//
//   GET /{ig-user-id}/conversations?platform=instagram  → ids de las charlas, la más reciente primero.
//   GET /{conversation-id}?fields=messages{…}           → sus mensajes.
//
// Lo que dice Meta y condiciona el diseño (docs/instagram-platform/instagram-api-with-instagram-login/conversations-api):
// - Solo da el detalle de los 20 mensajes más recientes de cada charla ("If you query a message that is older than the
//   last 20, you will see an error that the message has been deleted"): de cada charla se traen esos 20.
// - Las solicitudes de mensaje (carpeta Solicitudes) sin actividad en 30 días no vuelven: no se pueden importar.
// - Alcanza con instagram_business_manage_messages, el permiso que ya pide la conexión.
//
// Lo importado es historia: no dispara a Orbi ni al bot de ventas, no manda bienvenida ni ausencia y no marca nada como
// sin leer. Es idempotente (el mid de Meta es Message.externalId, único): volver a correrla solo agrega lo que falte.
//
// Cloud Run no le da CPU a lo que queda corriendo después de responder (--cpu-throttling), así que la importación no
// puede ir "en segundo plano" dentro del callback de OAuth. Va en pedidos propios: el callback le pega al endpoint
// interno (instagram/importacion/:businessId, con CRON_SECRET) y no espera la respuesta. Cada pedido trabaja hasta
// PRESUPUESTO_MS (por debajo de los 60 s que corta Firebase Hosting delante de la API) y, si quedan charlas, encadena
// el siguiente. Sin CRON_SECRET o sin dirección propia (en local), corre en el mismo proceso.

/** Tope de charlas por importación: las más recientes. */
const MAX_CONVERSACIONES = 50;
/** Meta da el detalle de los 20 mensajes más recientes de cada charla y no más. */
const MAX_MENSAJES = 20;
const POR_PAGINA = 25;
const PRESUPUESTO_MS = 40_000;
/** Pausa entre charla y charla: la API de mensajes tiene límite por cuenta. */
const PAUSA_MS = 200;
/** Lo que el callback espera a que salga el pedido a la importación antes de redirigir. */
const DESPACHO_MS = 1000;
// Códigos de Meta de "demasiadas llamadas": ahí se corta y no se insiste (se puede volver a lanzar más tarde).
const CODIGOS_DE_LIMITE = new Set([4, 17, 32, 613, 80002, 80006]);
const CAMPOS_MENSAJE = 'id,created_time,from,to,message,attachments,shares,story,is_unsupported';

interface IgParticipante {
  id?: string;
  username?: string;
}
export interface IgMensajeDetalle {
  id?: string;
  created_time?: string | number;
  from?: IgParticipante;
  to?: { data?: IgParticipante[] };
  message?: string;
  attachments?: { data?: { image_data?: { url?: string }; video_data?: { url?: string }; file_url?: string }[] };
  shares?: { data?: unknown[] };
  story?: { mention?: unknown; reply_to?: unknown };
  is_unsupported?: boolean;
}

export interface ResultadoImportacion {
  conversaciones: number;
  mensajes: number;
  /** Índice de la próxima charla a importar en otro pedido, o null si terminó. */
  siguiente: number | null;
  /** Por qué terminó antes: sin conexión activa, ya corría, Meta pidió frenar o rechazó la conexión. */
  corte?: 'sin-conexion' | 'en-curso' | 'limite' | 'conexion';
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Meta da las fechas como ISO ("2022-07-12T19:11:07+0000") o como timestamp Unix. */
export function fechaDeMeta(v: string | number | undefined): Date | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number' || /^\d+$/.test(v)) {
    const n = Number(v);
    return new Date(n > 1e12 ? n : n * 1000);
  }
  const d = new Date(v.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Mismo criterio que el webhook: el texto, o una etiqueta de lo que vino. */
export function textoDeMensaje(m: IgMensajeDetalle): string | null {
  if (m.message?.trim()) return m.message.trim();
  if (m.story?.mention) return '[Mención en una historia]';
  if (m.story?.reply_to) return '[Respuesta a una historia]';
  if (m.shares?.data?.length) return '[Publicación compartida]';
  const a = m.attachments?.data?.[0];
  if (a?.image_data) return '[Imagen]';
  if (a?.video_data) return '[Video]';
  if (a) return '[Archivo]';
  if (m.is_unsupported) return '[Mensaje no compatible]';
  return null;
}

const esDuplicado = (e: unknown) => (e as { code?: string })?.code === 'P2002';

@Injectable()
export class InstagramImportacionService {
  private readonly logger = new Logger(InstagramImportacionService.name);
  /** Negocios con una tanda corriendo en esta instancia (dos a la vez solo duplicarían llamadas a Meta). */
  private readonly enCurso = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly instagram: InstagramService,
    // Opcional: guarda las imágenes en el almacenamiento propio (la dirección de Instagram vence).
    @Optional() private readonly medios?: InstagramMediosService,
  ) {}

  private numero(nombre: string, porDefecto: number): number {
    const v = Number(this.config.get<string>(nombre));
    return Number.isFinite(v) && v >= 0 ? v : porDefecto;
  }

  // ── Lanzar ─────────────────────────────────────────────────────────────────

  /**
   * Arranca (o continúa desde `desde`) la importación sin esperarla: le pega al endpoint interno, que la corre en su
   * propio pedido. Nunca tira: la conexión ya quedó hecha y la importación es un agregado.
   */
  async lanzar(businessId: string, desde = 0): Promise<void> {
    try {
      const secreto = this.config.get<string>('CRON_SECRET');
      const url = this.urlInterna(businessId, desde);
      if (!secreto || !url) {
        this.enProceso(businessId, desde);
        return;
      }
      const envio = fetch(url, { method: 'POST', headers: { 'x-cron-secret': secreto }, signal: AbortSignal.timeout(120_000) })
        .then((res) => {
          if (!res.ok) {
            // El endpoint no la aceptó (por ejemplo, otra API en esa dirección): se corre acá.
            this.logger.warn(`La importación de Instagram no se pudo lanzar por HTTP (${res.status}); corre en este proceso (negocio ${businessId})`);
            this.enProceso(businessId, desde);
          }
        })
        .catch((e) => {
          // Un corte por tiempo del lado de quien lanzó no frena la importación, que sigue en su pedido.
          if ((e as { name?: string })?.name === 'TimeoutError') return;
          this.logger.warn(`La importación de Instagram no se pudo lanzar por HTTP; corre en este proceso (negocio ${businessId}): ${describeError(e)}`);
          this.enProceso(businessId, desde);
        });
      await Promise.race([envio, esperar(this.numero('INSTAGRAM_IMPORTAR_DESPACHO_MS', DESPACHO_MS))]);
    } catch (e) {
      this.logger.warn(`No se pudo lanzar la importación de Instagram (negocio ${businessId}): ${describeError(e)}`);
    }
  }

  /** La dirección del endpoint interno, al lado del callback de OAuth (la misma API, del lado público). */
  private urlInterna(businessId: string, desde: number): string | null {
    const base = this.config.get<string>('INSTAGRAM_IMPORTAR_URL')
      ?? (this.config.get<string>('INSTAGRAM_REDIRECT_URI') ?? 'https://api.orbita.site/api/v1/instagram/oauth/callback').replace(/\/instagram\/oauth\/callback\/?$/, '/instagram/importacion');
    if (!/\/instagram\/importacion$/.test(base)) return null;
    return `${base}/${encodeURIComponent(businessId)}${desde > 0 ? `?desde=${desde}` : ''}`;
  }

  /** En el mismo proceso, todas las tandas seguidas (en local, o si el endpoint interno no respondió). */
  private enProceso(businessId: string, desde: number): void {
    void (async () => {
      let siguiente: number | null = desde;
      while (siguiente !== null) siguiente = (await this.importar(businessId, siguiente, Infinity)).siguiente;
    })().catch((e) => this.logger.error(`La importación de Instagram falló (negocio ${businessId}): ${describeError(e)}`));
  }

  /** Lo que corre el endpoint interno: una tanda y, si quedan charlas, el pedido de la siguiente. */
  async tanda(businessId: string, desde: number): Promise<ResultadoImportacion> {
    const r = await this.importar(businessId, desde, this.numero('INSTAGRAM_IMPORTAR_PRESUPUESTO_MS', PRESUPUESTO_MS));
    if (r.siguiente !== null) await this.lanzar(businessId, r.siguiente);
    return r;
  }

  // ── Importar ───────────────────────────────────────────────────────────────

  /**
   * Importa las charlas de la cuenta conectada, desde la número `desde` (la más reciente es la 0), hasta agotar el
   * presupuesto de tiempo. Siempre avanza al menos una charla, así que encadenar tandas termina.
   */
  async importar(businessId: string, desde = 0, presupuestoMs = PRESUPUESTO_MS): Promise<ResultadoImportacion> {
    const resultado: ResultadoImportacion = { conversaciones: 0, mensajes: 0, siguiente: null };
    const conexion = await this.prisma.instagramConnection.findUnique({ where: { businessId }, select: { igUserId: true, status: true } });
    if (!conexion || conexion.status !== 'ACTIVE') return { ...resultado, corte: 'sin-conexion' };
    if (this.enCurso.has(businessId)) return { ...resultado, corte: 'en-curso' };
    this.enCurso.add(businessId);
    const inicio = Date.now();
    try {
      const ids = await this.listarConversaciones(businessId);
      const pausa = this.numero('INSTAGRAM_IMPORTAR_PAUSA_MS', PAUSA_MS);
      for (let i = Math.max(0, desde); i < ids.length; i++) {
        if (i > desde && Date.now() - inicio > presupuestoMs) {
          resultado.siguiente = i;
          break;
        }
        try {
          const guardados = await this.importarConversacion(businessId, conexion.igUserId, ids[i]);
          if (guardados > 0) resultado.conversaciones++;
          resultado.mensajes += guardados;
        } catch (e) {
          const corte = this.corteDe(e);
          if (corte) {
            resultado.corte = corte;
            this.logger.warn(`Importación de Instagram cortada (${corte}) en la charla ${i + 1} de ${ids.length} (negocio ${businessId}): ${describeError(e)}`);
            break;
          }
          // Una charla que falla (un mensaje raro, un usuario que ya no existe) no corta el resto.
          this.logger.warn(`No se pudo importar una charla de Instagram (negocio ${businessId}): ${describeError(e)}`);
        }
        if (pausa > 0 && i + 1 < ids.length) await esperar(pausa);
      }
    } catch (e) {
      const corte = this.corteDe(e);
      this.logger.warn(`No se pudieron listar las charlas de Instagram (negocio ${businessId}): ${describeError(e)}`);
      resultado.corte = corte ?? 'conexion';
    } finally {
      this.enCurso.delete(businessId);
    }
    this.logger.log(
      `Importación de Instagram (negocio ${businessId}, desde ${desde}): ${resultado.conversaciones} charlas, ${resultado.mensajes} mensajes` +
        (resultado.siguiente !== null ? `, sigue en ${resultado.siguiente}` : '') + (resultado.corte ? `, corte: ${resultado.corte}` : ''),
    );
    return resultado;
  }

  /** Meta pidió frenar, o ya no acepta la conexión (token vencido o sin el permiso): no tiene sentido seguir. */
  private corteDe(e: unknown): ResultadoImportacion['corte'] | null {
    if (e instanceof InstagramApiError && e.code !== undefined && CODIGOS_DE_LIMITE.has(e.code)) return 'limite';
    if (e instanceof UnprocessableEntityException || e instanceof ForbiddenException) return 'conexion';
    if (e instanceof InstagramApiError && (e.code === 190 || e.tipo === 'OAuthException')) return 'conexion';
    return null;
  }

  /** Los ids de las charlas, la más reciente primero, hasta el tope. */
  private async listarConversaciones(businessId: string): Promise<string[]> {
    const max = this.numero('INSTAGRAM_IMPORTAR_MAX', MAX_CONVERSACIONES);
    const ids: string[] = [];
    let after: string | undefined;
    while (ids.length < max) {
      const pagina = await this.instagram.graph<{ data?: { id?: string }[]; paging?: { cursors?: { after?: string }; next?: string } }>(
        businessId, SCOPE_MENSAJES, '{ig}/conversations',
        { query: { platform: 'instagram', fields: 'id,updated_time', limit: String(Math.min(POR_PAGINA, max)), ...(after ? { after } : {}) } },
      );
      for (const c of pagina.data ?? []) if (c.id && !ids.includes(c.id)) ids.push(c.id);
      after = pagina.paging?.next ? pagina.paging.cursors?.after : undefined;
      if (!after || (pagina.data ?? []).length === 0) break;
    }
    return ids.slice(0, max);
  }

  /** Los (hasta) 20 mensajes más recientes de la charla, con su detalle. */
  private async mensajesDe(businessId: string, conversacionId: string): Promise<IgMensajeDetalle[]> {
    let lista: IgMensajeDetalle[];
    try {
      const r = await this.instagram.graph<{ messages?: { data?: IgMensajeDetalle[] } }>(businessId, SCOPE_MENSAJES, conversacionId, {
        query: { fields: `messages.limit(${MAX_MENSAJES}){${CAMPOS_MENSAJE}}` },
      });
      lista = r.messages?.data ?? [];
    } catch (e) {
      if (this.corteDe(e)) throw e;
      // Si la cuenta no acepta pedir el detalle anidado, se piden los ids y el detalle de a uno (como la documentación).
      const r = await this.instagram.graph<{ messages?: { data?: IgMensajeDetalle[] } }>(businessId, SCOPE_MENSAJES, conversacionId, { query: { fields: 'messages' } });
      lista = r.messages?.data ?? [];
    }
    const salida: IgMensajeDetalle[] = [];
    for (const m of lista.slice(0, MAX_MENSAJES)) {
      if (!m.id) continue;
      if (m.from?.id) {
        salida.push(m);
        continue;
      }
      try {
        salida.push(await this.instagram.graph<IgMensajeDetalle>(businessId, SCOPE_MENSAJES, m.id, { query: { fields: CAMPOS_MENSAJE } }));
      } catch (e) {
        if (this.corteDe(e)) throw e;
        // Meta contesta "mensaje eliminado" para los que ya no deja leer: se saltean.
      }
    }
    return salida;
  }

  /** Guarda la charla y los mensajes que falten. Devuelve cuántos mensajes se guardaron. */
  private async importarConversacion(businessId: string, igUserId: string, conversacionId: string): Promise<number> {
    const mensajes = (await this.mensajesDe(businessId, conversacionId))
      .map((m) => ({ m, fecha: fechaDeMeta(m.created_time), texto: textoDeMensaje(m) }))
      .filter((x): x is { m: IgMensajeDetalle & { id: string }; fecha: Date; texto: string } => !!x.m.id && !!x.fecha && !!x.texto)
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    if (mensajes.length === 0) return 0;

    // El cliente es el otro participante: quien escribió, o a quien le escribió la cuenta.
    let cliente: IgParticipante | undefined;
    for (const { m } of mensajes) {
      cliente = m.from?.id && m.from.id !== igUserId ? m.from : m.to?.data?.find((p) => p.id && p.id !== igUserId);
      if (cliente?.id) break;
    }
    if (!cliente?.id) return 0;

    const yaEstan = new Set(
      (await this.prisma.message.findMany({ where: { externalId: { in: mensajes.map((x) => x.m.id) } }, select: { externalId: true } })).map((x) => x.externalId),
    );
    const nuevos = mensajes.filter((x) => !yaEstan.has(x.m.id));
    if (nuevos.length === 0) return 0;

    const customerId = await this.cliente(businessId, cliente.id, cliente.username);
    if (!customerId) return 0;
    const conversationId = await this.conversacion(businessId, customerId, igUserId, mensajes[0].fecha, mensajes[mensajes.length - 1].fecha);

    let guardados = 0;
    for (const { m, fecha, texto } of nuevos) {
      const adjuntos = await this.adjuntosDe(businessId, m);
      try {
        await this.prisma.message.create({
          data: {
            conversationId, sender: m.from?.id === igUserId ? 'STORE' : 'CUSTOMER', text: texto, channel: 'INSTAGRAM', externalId: m.id, createdAt: fecha,
            ...(adjuntos.length > 0 ? { attachments: adjuntos } : {}),
          },
        });
        guardados++;
      } catch (e) {
        // Lo guardó el webhook mientras tanto.
        if (!esDuplicado(e)) throw e;
      }
    }
    return guardados;
  }

  /** El cliente por su IGSID, como en el webhook; se crea con su @usuario (que ya viene en el mensaje). */
  private async cliente(businessId: string, igsid: string, usuario: string | undefined): Promise<string | null> {
    const buscar = () =>
      this.prisma.customer.findUnique({ where: { businessId_instagramId: { businessId, instagramId: igsid } }, select: { id: true, deletedAt: true } });
    const existente = await buscar();
    if (existente) return existente.deletedAt ? null : existente.id;
    try {
      const creado = await this.prisma.customer.create({
        data: { businessId, firstName: usuario ? `@${usuario}` : `Instagram ${igsid.slice(-4)}`, instagramId: igsid, isChatContact: true },
        select: { id: true },
      });
      return creado.id;
    } catch (e) {
      if (!esDuplicado(e)) throw e;
      const otro = await buscar();
      return otro && !otro.deletedAt ? otro.id : null;
    }
  }

  /**
   * La charla del cliente. Si ya existe (le escribió después de conectar, o es la misma cuenta reconectada) se usa esa
   * sin tocar si está leída ni su orden. Si no, se crea leída y con las fechas reales, para que quede en su lugar.
   */
  private async conversacion(businessId: string, customerId: string, igUserId: string, primera: Date, ultima: Date): Promise<string> {
    const existente = await this.prisma.conversation.findFirst({ where: { businessId, customerId }, select: { id: true } });
    if (existente) {
      await this.prisma.conversation.updateMany({ where: { id: existente.id, businessId }, data: { instagramCuenta: igUserId } });
      return existente.id;
    }
    const creada = await this.prisma.conversation.create({
      data: { businessId, customerId, isUnread: false, instagramCuenta: igUserId, createdAt: primera, updatedAt: ultima },
      select: { id: true },
    });
    return creada.id;
  }

  /** Igual que el webhook: las imágenes se guardan en el almacenamiento propio; video y archivo conservan la dirección. */
  private async adjuntosDe(businessId: string, m: IgMensajeDetalle): Promise<{ tipo: string; url: string }[]> {
    const salida: { tipo: string; url: string }[] = [];
    for (const a of m.attachments?.data ?? []) {
      if (a.image_data?.url) salida.push({ tipo: 'image', url: (await this.medios?.guardarImagenEntrante(businessId, a.image_data.url)) ?? a.image_data.url });
      else if (a.video_data?.url) salida.push({ tipo: 'video', url: a.video_data.url });
      else if (a.file_url) salida.push({ tipo: 'file', url: a.file_url });
    }
    return salida;
  }
}
