import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { describeError } from '../common/utils/describe-error.util';
import { ConnectWhatsappDto } from './dto/connect-whatsapp.dto';
import type { EmbeddedSignupDto } from './dto/embedded-signup.dto';
import { WhatsappMediosService } from './whatsapp-medios.service';

// WhatsApp Business (Cloud API de Meta) dentro de la bandeja de Mensajes.
//
// No hay una bandeja aparte: un mensaje de WhatsApp entra como un Message más
// del hilo del cliente (Conversation, una por negocio+cliente), con
// channel = WHATSAPP. Así el dueño ve en un solo lugar lo que el cliente
// escribe por la tienda y por WhatsApp, y lo que responde va por el canal por
// el que el cliente le escribió por última vez (ver ConversationsService).
//
// Multi-negocio: hay UN solo webhook para toda la plataforma. Meta manda en
// cada evento el `phone_number_id` al que le escribieron, y con eso se resuelve
// a qué negocio pertenece (WhatsappConnection.phoneNumberId es único).
//
// El access_token de cada negocio se guarda cifrado con pgp_sym_encrypt, igual
// que MpCredentials: Node nunca lo cifra ni lo descifra, lo hace Postgres.

const VENTANA_MS = 24 * 60 * 60 * 1000;
// Meta 131030: el destinatario no está en la lista permitida del número de
// prueba. En Argentina pasa porque el wa_id que llega por webhook trae el 9 de
// celular (549…) y la lista permitida se carga sin él (54…).
const ERR_DESTINATARIO_NO_PERMITIDO = 131030;

const ORDEN_ESTADO: Record<string, number> = { sent: 1, delivered: 2, read: 3 };
// Estado de entrega que trae el historial → el que guarda Órbita.
const ESTADO_DEL_HISTORIAL: Record<string, string> = { SENT: 'sent', DELIVERED: 'delivered', READ: 'read', PLAYED: 'read', ERROR: 'failed' };

interface WaMedia {
  /** Id de la imagen en Meta: con él se pide la dirección temporal para bajarla. */
  id?: string;
  caption?: string;
  filename?: string;
}
interface WaMessage {
  id: string;
  from: string;
  timestamp?: string;
  type: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  image?: WaMedia;
  video?: WaMedia;
  document?: WaMedia;
}
interface WaStatus {
  id: string;
  status: string;
  errors?: { code?: number; title?: string }[];
}
// Coexistencia (el número sigue en la app WhatsApp Business): lo que el dueño escribe desde el celular llega como "eco".
interface WaEco extends Omit<WaMessage, 'from'> {
  from?: string;
  /** El cliente al que le escribió el negocio. */
  to: string;
  revoke?: { original_message_id?: string };
  edit?: { original_message_id?: string; message?: { type?: string; text?: { body?: string } } };
}
// Historial que Meta manda una vez al conectar un número que ya estaba en la app.
interface WaHistorialMensaje extends Omit<WaMessage, 'from'> {
  from?: string;
  to?: string;
  history_context?: { status?: string };
}
interface WaHistorialBloque {
  metadata?: { phase?: number; chunk_order?: number; progress?: number };
  threads?: { id?: string; messages?: WaHistorialMensaje[] }[];
  errors?: { code?: number; title?: string }[];
}
interface WaChangeValue {
  metadata?: { phone_number_id?: string };
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  messages?: WaMessage[];
  statuses?: WaStatus[];
  message_echoes?: WaEco[];
  history?: WaHistorialBloque[];
}
export interface WaWebhookBody {
  object?: string;
  entry?: { changes?: { field?: string; value?: WaChangeValue }[] }[];
}

type ConexionDescifrada = { phone_number_id: string; waba_id: string; access_token: string };

const ETIQUETA_TIPO: Record<string, string> = {
  image: '[Imagen]',
  video: '[Video]',
  audio: '[Audio]',
  document: '[Documento]',
  sticker: '[Sticker]',
  location: '[Ubicación]',
  contacts: '[Contacto]',
  media_placeholder: '[Archivo]',
};

// Error de la Graph API. Extiende BadGatewayException para que, si nadie lo
// captura, el panel reciba un 502 con el motivo real de Meta en vez de un 500.
class GraphError extends BadGatewayException {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(`WhatsApp respondió con un error: ${message}`);
  }
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    // Opcional: guarda las imágenes (las que llegan y las que se mandan). Sin él, las imágenes entran como etiqueta.
    @Optional() private readonly medios?: WhatsappMediosService,
  ) {}

  private get graph(): string {
    return `https://graph.facebook.com/${this.config.get<string>('WHATSAPP_GRAPH_VERSION') ?? 'v23.0'}`;
  }

  // Se lee al usarla y no al arrancar: así el resto de la API sigue levantando
  // en un entorno donde WhatsApp todavía no está configurado.
  private get tokenKey(): string {
    const key = this.config.get<string>('WHATSAPP_TOKEN_KEY');
    if (!key) throw new ServiceUnavailableException('WhatsApp no está configurado en este entorno');
    return key;
  }

  // ── Webhook: verificación y firma ──────────────────────────────────────────

  /** GET de verificación que hace Meta al registrar el webhook. Devuelve el challenge o null. */
  verificarSuscripcion(mode?: string, token?: string, challenge?: string): string | null {
    const esperado = this.config.get<string>('WHATSAPP_VERIFY_TOKEN');
    if (!esperado || mode !== 'subscribe' || !token || !challenge) return null;
    return this.iguales(token, esperado) ? challenge : null;
  }

  /** Valida X-Hub-Signature-256 (HMAC-SHA256 del body crudo con el App Secret). */
  firmaValida(rawBody: Buffer | undefined, header: string | undefined): boolean {
    const secret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (!secret) {
      // Sin secreto no hay forma de saber que el aviso viene de Meta.
      this.logger.error('WHATSAPP_APP_SECRET no configurado: webhook rechazado');
      throw new ServiceUnavailableException('Webhook no disponible');
    }
    if (!rawBody || !header?.startsWith('sha256=')) return false;
    const esperada = createHmac('sha256', secret).update(rawBody).digest('hex');
    return this.iguales(header.slice('sha256='.length), esperada);
  }

  private iguales(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  }

  // ── Webhook: eventos ───────────────────────────────────────────────────────

  async procesarWebhook(body: WaWebhookBody): Promise<void> {
    if (body.object !== 'whatsapp_business_account') return;
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (!change.value) continue;
        const campo = change.field;
        if (campo !== 'messages' && campo !== 'smb_message_echoes' && campo !== 'history') continue;
        const phoneNumberId = change.value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;
        const conexion = await this.prisma.whatsappConnection.findUnique({
          where: { phoneNumberId },
          select: { businessId: true, status: true },
        });
        if (!conexion || conexion.status !== 'ACTIVE') {
          this.logger.warn(`Evento de WhatsApp para un número sin conexión activa (${phoneNumberId})`);
          continue;
        }
        // Lo que el dueño escribe desde el celular (coexistencia).
        if (campo === 'smb_message_echoes') {
          for (const e of change.value.message_echoes ?? []) {
            try {
              await this.guardarEco(conexion.businessId, e);
            } catch (err) {
              this.logger.error(`No se pudo guardar el mensaje del celular ${e.id}: ${describeError(err)}`);
            }
          }
          continue;
        }
        // El historial de chats que comparte el dueño al conectar (una sola vez).
        if (campo === 'history') {
          try {
            await this.guardarHistorial(conexion.businessId, change.value.history ?? []);
          } catch (err) {
            this.logger.error(`No se pudo guardar el historial de WhatsApp: ${describeError(err)}`);
          }
          continue;
        }
        const nombres = new Map((change.value.contacts ?? []).map((c) => [c.wa_id ?? '', c.profile?.name]));
        for (const m of change.value.messages ?? []) {
          try {
            await this.guardarEntrante(conexion.businessId, m, nombres.get(m.from));
          } catch (e) {
            // Un mensaje que falla no puede tumbar el resto ni hacer que Meta
            // reintente todo el lote: queda en el log con su id.
            this.logger.error(`No se pudo guardar el mensaje ${m.id}: ${describeError(e)}`);
          }
        }
        for (const s of change.value.statuses ?? []) {
          try {
            await this.actualizarEstado(s);
          } catch (e) {
            this.logger.error(`No se pudo actualizar el estado de ${s.id}: ${describeError(e)}`);
          }
        }
      }
    }
  }

  private textoDe(m: WaMessage): string | null {
    if (m.type === 'reaction') return null; // una reacción no es un mensaje del hilo
    if (m.type === 'text') return m.text?.body?.trim() || null;
    if (m.type === 'button') return m.button?.text ?? '[Botón]';
    if (m.type === 'interactive') return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? '[Respuesta]';
    const etiqueta = ETIQUETA_TIPO[m.type] ?? '[Mensaje no compatible]';
    const media = m.image ?? m.video ?? m.document;
    const detalle = media?.caption ?? media?.filename;
    // Las imágenes, audios y documentos todavía no se descargan: se avisa que
    // llegó algo para que el dueño lo abra desde la app de WhatsApp.
    return detalle ? `${etiqueta} ${detalle}` : etiqueta;
  }

  /**
   * Las imágenes se bajan de Meta y se guardan (la dirección que da Meta vence). Devuelve los adjuntos del mensaje:
   * vacío si no es una imagen o no se pudo bajar (el mensaje entra igual, como etiqueta).
   */
  private async adjuntosDe(businessId: string, tipo: string, imagen?: WaMedia): Promise<{ tipo: 'image'; url: string }[]> {
    if (tipo !== 'image' || !imagen?.id || !this.medios) return [];
    const url = await this.descargarImagen(businessId, imagen.id);
    return url ? [{ tipo: 'image', url }] : [];
  }

  /** Con foto, el texto es el pie de foto (o la etiqueta si no tiene), sin el "[Imagen]" delante. */
  private textoConAdjuntos(adjuntos: unknown[], imagen: WaMedia | undefined, textoBase: string): string {
    return adjuntos.length > 0 ? (imagen?.caption?.trim() || '[Imagen]') : textoBase;
  }

  private async descargarImagen(businessId: string, mediaId: string): Promise<string | null> {
    try {
      const cred = await this.credenciales(businessId);
      if (!cred || !this.medios) return null;
      const meta = await this.graphCall<{ url?: string }>(`/${mediaId}`, cred.access_token, { method: 'GET' });
      if (!meta.url) return null;
      return await this.medios.guardarImagenDeMeta(businessId, meta.url, cred.access_token);
    } catch (e) {
      this.logger.warn(`No se pudo bajar la imagen ${mediaId}: ${describeError(e)}`);
      return null;
    }
  }

  private async guardarEntrante(businessId: string, m: WaMessage, nombrePerfil?: string): Promise<void> {
    const textoBase = this.textoDe(m);
    if (!textoBase) return;
    // Meta reintenta si no recibe 200 a tiempo: sin esto un mismo mensaje se
    // guardaría dos veces. `externalId` es único, pero se mira antes para no
    // depender de capturar el error de la base.
    if (await this.prisma.message.findUnique({ where: { externalId: m.id }, select: { id: true } })) return;
    const adjuntos = await this.adjuntosDe(businessId, m.type, m.image);
    const texto = this.textoConAdjuntos(adjuntos, m.image, textoBase);

    const customerId = await this.resolverCliente(businessId, m.from, nombrePerfil);
    if (!customerId) return;

    const conv =
      (await this.prisma.conversation.findFirst({ where: { businessId, customerId }, select: { id: true } })) ??
      (await this.prisma.conversation.create({ data: { businessId, customerId, isUnread: true }, select: { id: true } }));

    const creado = m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date();
    await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: conv.id, sender: 'CUSTOMER', text: texto, channel: 'WHATSAPP', externalId: m.id, createdAt: creado,
          ...(adjuntos.length > 0 ? { attachments: adjuntos } : {}),
        },
      }),
      this.prisma.conversation.update({ where: { id: conv.id }, data: { isUnread: true, isArchived: false, updatedAt: new Date() } }),
    ]);
  }

  /**
   * Un mensaje que el dueño escribió desde la app WhatsApp Business (o la edita o la borra): queda en el hilo del
   * cliente como mensaje del negocio. No marca la charla como sin leer: lo escribió el propio negocio.
   */
  private async guardarEco(businessId: string, e: WaEco): Promise<void> {
    // Editar o borrar un mensaje que ya está guardado (siempre de ESTE negocio).
    if (e.type === 'edit' || e.type === 'revoke') {
      const original = e.type === 'edit' ? e.edit?.original_message_id : e.revoke?.original_message_id;
      if (!original) return;
      const existente = await this.prisma.message.findUnique({ where: { externalId: original }, select: { id: true, conversationId: true } });
      if (!existente) return;
      const propia = await this.prisma.conversation.findFirst({ where: { id: existente.conversationId, businessId }, select: { id: true } });
      if (!propia) return;
      const nuevoTexto = e.type === 'edit' ? e.edit?.message?.text?.body?.trim() : '[Mensaje eliminado]';
      if (nuevoTexto) await this.prisma.message.update({ where: { id: existente.id }, data: { text: nuevoTexto } });
      return;
    }

    const textoBase = this.textoDe({ id: e.id, from: e.to, type: e.type, text: e.text, image: e.image, video: e.video, document: e.document });
    if (!textoBase) return;
    if (await this.prisma.message.findUnique({ where: { externalId: e.id }, select: { id: true } })) return;
    const adjuntos = await this.adjuntosDe(businessId, e.type, e.image);
    const texto = this.textoConAdjuntos(adjuntos, e.image, textoBase);

    const customerId = await this.resolverCliente(businessId, e.to);
    if (!customerId) return;
    const conv =
      (await this.prisma.conversation.findFirst({ where: { businessId, customerId }, select: { id: true } })) ??
      (await this.prisma.conversation.create({ data: { businessId, customerId, isUnread: false }, select: { id: true } }));

    const creado = e.timestamp ? new Date(Number(e.timestamp) * 1000) : new Date();
    await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: conv.id, sender: 'STORE', text: texto, channel: 'WHATSAPP', externalId: e.id, deliveryStatus: 'sent', createdAt: creado,
          ...(adjuntos.length > 0 ? { attachments: adjuntos } : {}),
        },
      }),
      this.prisma.conversation.update({ where: { id: conv.id }, data: { updatedAt: new Date() } }),
    ]);
  }

  /**
   * Historial de chats (hasta 180 días) que Meta manda al conectar un número que ya estaba en la app, en bloques. Se
   * guarda como lo que fue (lo de cada cliente y lo del negocio), sin marcar nada como sin leer y sin duplicar lo que
   * ya estuviera. Si el dueño no quiso compartirlo, Meta avisa con un error y no hay nada que guardar.
   */
  private async guardarHistorial(businessId: string, bloques: WaHistorialBloque[]): Promise<void> {
    for (const bloque of bloques) {
      if (bloque.errors?.length) {
        this.logger.log(`Historial de WhatsApp no compartido (negocio ${businessId}): ${bloque.errors[0].code ?? ''} ${bloque.errors[0].title ?? ''}`);
        continue;
      }
      for (const hilo of bloque.threads ?? []) {
        const waId = hilo.id;
        if (!waId || !hilo.messages?.length) continue;
        const filas = hilo.messages.flatMap((m) => {
          const texto = this.textoDe({ id: m.id, from: waId, type: m.type, text: m.text, image: m.image, video: m.video, document: m.document });
          if (!texto || !m.id) return [];
          // Del negocio: tiene `to`, o `from` no es el cliente. Del cliente: `from` es el cliente.
          const delNegocio = m.to !== undefined || (m.from !== undefined && m.from !== waId);
          return [{
            sender: (delNegocio ? 'STORE' : 'CUSTOMER') as 'STORE' | 'CUSTOMER',
            text: texto,
            externalId: m.id,
            deliveryStatus: delNegocio ? (ESTADO_DEL_HISTORIAL[m.history_context?.status ?? ''] ?? 'sent') : null,
            createdAt: m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date(),
          }];
        });
        if (filas.length === 0) continue;

        const customerId = await this.resolverCliente(businessId, waId);
        if (!customerId) continue;
        const conv =
          (await this.prisma.conversation.findFirst({ where: { businessId, customerId }, select: { id: true } })) ??
          (await this.prisma.conversation.create({ data: { businessId, customerId, isUnread: false }, select: { id: true } }));

        await this.prisma.message.createMany({
          data: filas.map((f) => ({ conversationId: conv.id, channel: 'WHATSAPP' as const, ...f })),
          skipDuplicates: true,
        });
        // La charla sube en la lista hasta su último mensaje, nunca más allá.
        const ultimo = new Date(Math.max(...filas.map((f) => f.createdAt.getTime())));
        await this.prisma.conversation.updateMany({ where: { id: conv.id, businessId, updatedAt: { lt: ultimo } }, data: { updatedAt: ultimo } });
      }
    }
  }

  // Un cliente de WhatsApp es un Customer del negocio, identificado por su
  // wa_id. Si ya había un cliente con ese teléfono (compró por la tienda, o
  // está cargado a mano) se lo vincula en vez de duplicarlo — solo si el match
  // es único: ante la duda, un cliente nuevo es mejor que mezclar dos personas.
  private async resolverCliente(businessId: string, waId: string, nombrePerfil?: string): Promise<string | null> {
    const existente = await this.prisma.customer.findUnique({
      where: { businessId_whatsappId: { businessId, whatsappId: waId } },
      select: { id: true, deletedAt: true },
    });
    if (existente) {
      if (existente.deletedAt) {
        // Cliente eliminado: no se lo resucita (se borraron sus datos a pedido).
        this.logger.warn(`Mensaje de WhatsApp de un cliente eliminado (negocio ${businessId})`);
        return null;
      }
      return existente.id;
    }

    const ultimos10 = waId.slice(-10);
    const coincidencias = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM customers
      WHERE business_id = ${businessId} AND deleted_at IS NULL AND whatsapp_id IS NULL AND phone IS NOT NULL
        AND right(regexp_replace(phone, '\\D', '', 'g'), 10) = ${ultimos10}
      LIMIT 2`;
    if (coincidencias.length === 1) {
      await this.prisma.customer.update({ where: { id: coincidencias[0].id }, data: { whatsappId: waId } });
      return coincidencias[0].id;
    }

    const creado = await this.prisma.customer.create({
      data: { businessId, firstName: nombrePerfil?.trim() || `+${waId}`, phone: `+${waId}`, whatsappId: waId },
      select: { id: true },
    });
    return creado.id;
  }

  private async actualizarEstado(s: WaStatus): Promise<void> {
    const msg = await this.prisma.message.findUnique({ where: { externalId: s.id }, select: { id: true, deliveryStatus: true } });
    if (!msg) return;
    if (s.status === 'failed') {
      const causa = s.errors?.[0];
      if (causa) this.logger.warn(`WhatsApp no entregó ${s.id}: ${causa.code} ${causa.title ?? ''}`);
    } else if ((ORDEN_ESTADO[s.status] ?? 0) <= (ORDEN_ESTADO[msg.deliveryStatus ?? ''] ?? 0)) {
      return; // Meta no garantiza el orden: nunca se retrocede (read → delivered)
    }
    await this.prisma.message.update({ where: { id: msg.id }, data: { deliveryStatus: s.status } });
  }

  // ── Conexión del negocio ───────────────────────────────────────────────────

  /**
   * La conexión de WhatsApp todavía es manual (se pegan los datos de Meta): no
   * es para que la vea cualquier negocio. En producción solo se habilita a los
   * negocios listados en WHATSAPP_NEGOCIOS_HABILITADOS (subdominios separados
   * por coma); sin la variable, ninguno. Con `*` están todos habilitados (es lo
   * que se pone cuando la conexión es por Embedded Signup y no hace falta pegar
   * datos a mano). Fuera de producción, sin la variable, están todos habilitados
   * para poder probar.
   */
  async asegurarHabilitado(businessId: string): Promise<void> {
    const lista = (this.config.get<string>('WHATSAPP_NEGOCIOS_HABILITADOS') ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (lista.includes('*')) return;
    if (lista.length === 0) {
      if (this.config.get<string>('NODE_ENV') === 'production') throw new ForbiddenException('WhatsApp todavía no está disponible para este negocio');
      return;
    }
    const negocio = await this.prisma.business.findUnique({ where: { id: businessId }, select: { subdomain: true } });
    if (!negocio || !lista.includes(negocio.subdomain.toLowerCase())) {
      throw new ForbiddenException('WhatsApp todavía no está disponible para este negocio');
    }
  }

  async estado(businessId: string) {
    const c = await this.prisma.whatsappConnection.findUnique({
      where: { businessId },
      select: { status: true, displayPhone: true, phoneNumberId: true, createdAt: true },
    });
    if (!c || c.status !== 'ACTIVE') return { connected: false as const };
    return { connected: true as const, displayPhone: c.displayPhone, phoneNumberId: c.phoneNumberId, connectedAt: c.createdAt };
  }

  async conectar(businessId: string, dto: ConnectWhatsappDto) {
    // Se valida contra Meta antes de guardar: un token o un ID equivocado se
    // descubre acá y no cuando el primer cliente escribe.
    const info = await this.graphCall<{ display_phone_number?: string; verified_name?: string }>(
      `/${dto.phoneNumberId}?fields=display_phone_number,verified_name`,
      dto.accessToken,
      { method: 'GET' },
    );

    await this.guardarConexion(businessId, dto.wabaId, dto.phoneNumberId, info.display_phone_number ?? null, dto.accessToken);
    const suscripta = await this.suscribirApp(dto.wabaId, dto.accessToken);
    return { connected: true as const, displayPhone: info.display_phone_number ?? null, suscripta };
  }

  /**
   * Conexión por Embedded Signup (la incorporación integrada de Meta): el cliente inició sesión con Facebook, eligió
   * o creó su cuenta de WhatsApp Business y el panel nos manda el código y los ids que Meta le dio. Acá:
   *   1. se canjea el código por el token del negocio (el código vale unos segundos y es de un solo uso);
   *   2. se comprueba contra Meta que el número sea de esa cuenta y que el token lo vea: así nadie conecta un número
   *      que no es suyo mandando ids inventados;
   *   3. se registra el número en la Cloud API (los números nuevos lo necesitan para poder enviar);
   *   4. se guarda cifrado y se suscribe la app a la cuenta para recibir los mensajes por el webhook.
   */
  async conectarConEmbeddedSignup(businessId: string, dto: EmbeddedSignupDto) {
    const token = await this.canjearCodigo(dto.code);

    const numeros = await this.graphCall<{ data?: { id: string; display_phone_number?: string; is_on_biz_app?: boolean }[] }>(
      `/${dto.wabaId}/phone_numbers?fields=id,display_phone_number,is_on_biz_app`,
      token,
      { method: 'GET' },
    ).catch(() => {
      throw new UnprocessableEntityException('No pudimos acceder a esa cuenta de WhatsApp Business. Volvé a intentar la conexión.');
    });
    // Con coexistencia Meta no da el id del número, solo el de la cuenta: se toma el que sigue en la app WhatsApp
    // Business. Si vino un id, tiene que ser de esa cuenta (nadie conecta un número que no es suyo).
    const lista = numeros.data ?? [];
    const numero = dto.phoneNumberId ? lista.find((n) => n.id === dto.phoneNumberId) : (lista.find((n) => n.is_on_biz_app === true) ?? lista[0]);
    if (!numero) {
      throw new UnprocessableEntityException(dto.phoneNumberId
        ? 'Ese número no pertenece a la cuenta de WhatsApp Business que elegiste.'
        : 'No encontramos ningún número en esa cuenta de WhatsApp Business. Agregá uno y volvé a intentarlo.');
    }

    // Un número que sigue en la app WhatsApp Business ya está registrado: registrarlo de nuevo no corresponde.
    const coexistencia = numero.is_on_biz_app === true;
    if (!coexistencia) await this.registrarNumero(numero.id, token);
    await this.guardarConexion(businessId, dto.wabaId, numero.id, numero.display_phone_number ?? null, token);
    const suscripta = await this.suscribirApp(dto.wabaId, token);
    // Meta da 24 horas desde la conexión para traer los contactos y el historial, y una sola vez.
    if (coexistencia) await this.pedirSincronizacionDeLaApp(numero.id, token);
    return { connected: true as const, displayPhone: numero.display_phone_number ?? null, suscripta, coexistencia };
  }

  /** Pide a Meta los contactos y el historial de chats de la app WhatsApp Business (llegan por webhook). Mejor esfuerzo. */
  private async pedirSincronizacionDeLaApp(phoneNumberId: string, token: string): Promise<void> {
    for (const tipo of ['smb_app_state_sync', 'history']) {
      try {
        await this.graphCall(`/${phoneNumberId}/smb_app_data`, token, { method: 'POST', body: JSON.stringify({ messaging_product: 'whatsapp', sync_type: tipo }) });
      } catch (e) {
        this.logger.warn(`No se pudo pedir la sincronización "${tipo}" del número ${phoneNumberId}: ${describeError(e)}`);
      }
    }
  }

  /** Canjea el código de Embedded Signup por el token de acceso del negocio. */
  private async canjearCodigo(code: string): Promise<string> {
    const appId = this.config.get<string>('WHATSAPP_APP_ID');
    const secret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (!appId || !secret) throw new ServiceUnavailableException('La conexión de WhatsApp no está configurada en este entorno');
    let res: Response;
    try {
      const query = new URLSearchParams({ client_id: appId, client_secret: secret, code });
      res = await fetch(`${this.graph}/oauth/access_token?${query.toString()}`, { signal: AbortSignal.timeout(15_000) });
    } catch (e) {
      this.logger.error(`WhatsApp (red) al canjear el código: ${describeError(e)}`);
      throw new BadGatewayException('No se pudo comunicar con Meta. Probá de nuevo en un momento.');
    }
    const json = (await res.json().catch(() => ({}))) as { access_token?: string; error?: { message?: string; code?: number } };
    if (!res.ok || !json.access_token) {
      this.logger.warn(`WhatsApp: no se pudo canjear el código de Embedded Signup → ${res.status} código ${json.error?.code ?? '?'}: ${json.error?.message ?? ''}`);
      throw new BadRequestException('La autorización de Meta venció o ya se usó. Volvé a tocar "Conectar" y completá el proceso sin demorar.');
    }
    return json.access_token;
  }

  /**
   * Registra el número en la Cloud API. El PIN de verificación en dos pasos se deriva del número con el secreto de la
   * app: es el mismo siempre (no hay que guardarlo) y nadie de afuera lo puede adivinar. Si falla (por ejemplo, el
   * número ya estaba registrado) no se corta la conexión: se avisa en el log.
   */
  private async registrarNumero(phoneNumberId: string, token: string): Promise<void> {
    try {
      await this.graphCall(`/${phoneNumberId}/register`, token, {
        method: 'POST',
        body: JSON.stringify({ messaging_product: 'whatsapp', pin: this.pinDelNumero(phoneNumberId) }),
      });
    } catch (e) {
      this.logger.warn(`No se pudo registrar el número ${phoneNumberId} (puede que ya esté registrado): ${describeError(e)}`);
    }
  }

  private pinDelNumero(phoneNumberId: string): string {
    const secret = this.config.get<string>('WHATSAPP_APP_SECRET') ?? '';
    const n = createHmac('sha256', secret).update(`pin:${phoneNumberId}`).digest().readUInt32BE(0) % 1_000_000;
    return String(n).padStart(6, '0');
  }

  private async guardarConexion(businessId: string, wabaId: string, phoneNumberId: string, displayPhone: string | null, token: string): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO whatsapp_connections (id, business_id, waba_id, phone_number_id, display_phone, access_token, status, created_at, updated_at)
        VALUES (
          ${randomUUID()}, ${businessId}, ${wabaId}, ${phoneNumberId}, ${displayPhone},
          encode(pgp_sym_encrypt(${token}, ${this.tokenKey}), 'base64'),
          'ACTIVE'::"WhatsappConnectionStatus", now(), now()
        )
        ON CONFLICT (business_id) DO UPDATE SET
          waba_id = EXCLUDED.waba_id,
          phone_number_id = EXCLUDED.phone_number_id,
          display_phone = EXCLUDED.display_phone,
          access_token = EXCLUDED.access_token,
          status = 'ACTIVE'::"WhatsappConnectionStatus",
          updated_at = now()`;
    } catch (e) {
      if (describeError(e).includes('phone_number_id')) {
        throw new ConflictException('Ese número de WhatsApp ya está conectado a otro negocio');
      }
      throw e;
    }
  }

  // Para recibir los mensajes de esa cuenta, la app tiene que estar suscripta a su WABA. Se intenta y se informa: no
  // se corta la conexión, que ya quedó guardada, pero el dueño tiene que saber si no va a recibir.
  private async suscribirApp(wabaId: string, token: string): Promise<boolean> {
    try {
      await this.graphCall(`/${wabaId}/subscribed_apps`, token, { method: 'POST', body: '{}' });
      return true;
    } catch (e) {
      this.logger.warn(`No se pudo suscribir la app al WABA ${wabaId}: ${describeError(e)}`);
      return false;
    }
  }

  async desconectar(businessId: string) {
    const c = await this.prisma.whatsappConnection.findUnique({ where: { businessId }, select: { id: true } });
    if (!c) throw new NotFoundException('No hay una conexión de WhatsApp para desconectar');
    // Se borra la credencial (no solo se marca): al desconectar dejamos de
    // guardar el token, como promete la política de privacidad.
    await this.prisma.whatsappConnection.update({ where: { businessId }, data: { status: 'DISCONNECTED', accessToken: '' } });
    return { connected: false as const };
  }

  private async credenciales(businessId: string): Promise<ConexionDescifrada | null> {
    const rows = await this.prisma.$queryRaw<ConexionDescifrada[]>`
      SELECT phone_number_id, waba_id, pgp_sym_decrypt(decode(access_token, 'base64'), ${this.tokenKey}) AS access_token
      FROM whatsapp_connections WHERE business_id = ${businessId} AND status = 'ACTIVE'::"WhatsappConnectionStatus"`;
    return rows[0] ?? null;
  }

  // ── Envío ──────────────────────────────────────────────────────────────────

  /**
   * Manda un texto por WhatsApp y devuelve el id del mensaje en Meta.
   * WhatsApp solo deja escribir libremente dentro de las 24 h posteriores al
   * último mensaje del cliente; pasado ese tiempo hace falta una plantilla
   * aprobada (todavía no soportadas): se rechaza antes de llamar a Meta.
   */
  async enviarTexto(businessId: string, conversationId: string, waId: string, texto: string): Promise<string> {
    return this.enviarCarga(businessId, conversationId, waId, { type: 'text', text: { body: texto, preview_url: false } });
  }

  /** Manda una imagen (de una dirección pública de nuestro almacenamiento), con un pie de foto opcional. Mismas reglas de plazo. */
  async enviarImagen(businessId: string, conversationId: string, waId: string, url: string, pieDeFoto?: string): Promise<string> {
    const caption = pieDeFoto?.trim();
    return this.enviarCarga(businessId, conversationId, waId, { type: 'image', image: { link: url, ...(caption ? { caption } : {}) } });
  }

  /** La foto que el negocio manda desde el panel: validada, preparada y guardada. Devuelve su dirección pública. */
  async prepararFoto(businessId: string, archivo: Express.Multer.File | undefined): Promise<string> {
    if (!this.medios) throw new ServiceUnavailableException('Las imágenes no están disponibles en este entorno');
    return this.medios.prepararFotoDelPanel(businessId, archivo);
  }

  private async enviarCarga(businessId: string, conversationId: string, waId: string, carga: Record<string, unknown>): Promise<string> {
    const ultimo = await this.prisma.message.findFirst({
      where: { conversationId, channel: 'WHATSAPP', sender: 'CUSTOMER' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (!ultimo || Date.now() - ultimo.createdAt.getTime() > VENTANA_MS) {
      throw new UnprocessableEntityException(
        'Pasaron más de 24 horas desde el último mensaje del cliente. WhatsApp solo permite responder dentro de ese plazo.',
      );
    }

    const cred = await this.credenciales(businessId);
    if (!cred) throw new BadRequestException('WhatsApp no está conectado');

    const enviar = (to: string) =>
      this.graphCall<{ messages?: { id: string }[] }>(`/${cred.phone_number_id}/messages`, cred.access_token, {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          ...carga,
        }),
      });

    let res: { messages?: { id: string }[] };
    try {
      res = await enviar(waId);
    } catch (e) {
      const sin9 = /^549(\d{10})$/.exec(waId);
      if (sin9 && e instanceof GraphError && e.code === ERR_DESTINATARIO_NO_PERMITIDO) res = await enviar(`54${sin9[1]}`);
      else throw e;
    }
    const id = res.messages?.[0]?.id;
    if (!id) throw new BadGatewayException('WhatsApp no confirmó el envío');
    return id;
  }

  // ── Llamadas a la Graph API ────────────────────────────────────────────────

  private async graphCall<T = unknown>(path: string, token: string, init: { method: string; body?: string }): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.graph}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      this.logger.error(`WhatsApp (red): ${describeError(e)}`);
      throw new BadGatewayException('No se pudo comunicar con WhatsApp. Probá de nuevo en un momento.');
    }
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } } & T;
    if (!res.ok) {
      const err = new GraphError(json.error?.message ?? `HTTP ${res.status}`, json.error?.code);
      this.logger.warn(`WhatsApp ${init.method} ${path.split('?')[0]} → ${res.status} código ${json.error?.code ?? '?'}: ${err.message}`);
      throw err;
    }
    return json;
  }
}
