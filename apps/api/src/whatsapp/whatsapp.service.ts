import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { describeError } from '../common/utils/describe-error.util';
import { ConnectWhatsappDto } from './dto/connect-whatsapp.dto';

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

interface WaMedia {
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
interface WaChangeValue {
  metadata?: { phone_number_id?: string };
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  messages?: WaMessage[];
  statuses?: WaStatus[];
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
        if (change.field !== 'messages' || !change.value) continue;
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

  private async guardarEntrante(businessId: string, m: WaMessage, nombrePerfil?: string): Promise<void> {
    const texto = this.textoDe(m);
    if (!texto) return;
    // Meta reintenta si no recibe 200 a tiempo: sin esto un mismo mensaje se
    // guardaría dos veces. `externalId` es único, pero se mira antes para no
    // depender de capturar el error de la base.
    if (await this.prisma.message.findUnique({ where: { externalId: m.id }, select: { id: true } })) return;

    const customerId = await this.resolverCliente(businessId, m.from, nombrePerfil);
    if (!customerId) return;

    const conv =
      (await this.prisma.conversation.findFirst({ where: { businessId, customerId }, select: { id: true } })) ??
      (await this.prisma.conversation.create({ data: { businessId, customerId, isUnread: true }, select: { id: true } }));

    const creado = m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date();
    await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId: conv.id, sender: 'CUSTOMER', text: texto, channel: 'WHATSAPP', externalId: m.id, createdAt: creado },
      }),
      this.prisma.conversation.update({ where: { id: conv.id }, data: { isUnread: true, isArchived: false, updatedAt: new Date() } }),
    ]);
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

    try {
      await this.prisma.$executeRaw`
        INSERT INTO whatsapp_connections (id, business_id, waba_id, phone_number_id, display_phone, access_token, status, created_at, updated_at)
        VALUES (
          ${randomUUID()}, ${businessId}, ${dto.wabaId}, ${dto.phoneNumberId}, ${info.display_phone_number ?? null},
          encode(pgp_sym_encrypt(${dto.accessToken}, ${this.tokenKey}), 'base64'),
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

    // Para recibir los mensajes de esa cuenta, la app tiene que estar
    // suscripta a su WABA. Se intenta y se informa: no se corta la conexión,
    // que ya quedó guardada, pero el dueño tiene que saber si no va a recibir.
    let suscripta = true;
    try {
      await this.graphCall(`/${dto.wabaId}/subscribed_apps`, dto.accessToken, { method: 'POST', body: '{}' });
    } catch (e) {
      suscripta = false;
      this.logger.warn(`No se pudo suscribir la app al WABA ${dto.wabaId}: ${describeError(e)}`);
    }
    return { connected: true as const, displayPhone: info.display_phone_number ?? null, suscripta };
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
          type: 'text',
          text: { body: texto, preview_url: false },
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
