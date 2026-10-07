import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { describeError } from '../common/utils/describe-error.util';

// Instagram (mensajes directos) dentro de la bandeja de Mensajes.
//
// Misma idea que WhatsApp (ver whatsapp.service.ts): un mensaje de Instagram
// entra como un Message más del hilo del cliente, con channel = INSTAGRAM, y la
// respuesta del panel sale por el canal por el que el cliente escribió por
// última vez.
//
// La conexión usa "Business Login for Instagram": el dueño inicia sesión con su
// cuenta profesional de Instagram (sin Página de Facebook) y Órbita recibe un
// token de larga duración (60 días) que se guarda cifrado con pgp_sym_encrypt,
// igual que WhatsappConnection. A diferencia de WhatsApp ese token VENCE: hay
// que renovarlo antes (renovarTokens, colgado del cron nocturno).
//
// Hay UN solo webhook para toda la plataforma: Meta manda el id de la cuenta
// profesional y con eso se resuelve el negocio (InstagramConnection.igUserId).

const VENTANA_MS = 24 * 60 * 60 * 1000;
const STATE_TTL_MS = 10 * 60 * 1000;
const RENOVAR_CON_ANTICIPACION_MS = 15 * 24 * 60 * 60 * 1000;
// Límite de la API de Instagram para un mensaje de texto.
const MAX_BYTES_TEXTO = 1000;
const SCOPES = 'instagram_business_basic,instagram_business_manage_messages';

interface StatePayload {
  businessId: string;
  memberId?: string;
  nonce: string;
  exp: number;
}

interface IgAttachment {
  type?: string;
}
interface IgMessage {
  mid?: string;
  text?: string;
  is_echo?: boolean;
  is_deleted?: boolean;
  attachments?: IgAttachment[];
}
interface IgMessaging {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: IgMessage;
}
export interface IgWebhookBody {
  object?: string;
  entry?: { id?: string; messaging?: IgMessaging[] }[];
}

type ConexionDescifrada = { ig_user_id: string; access_token: string };

const ETIQUETA_ADJUNTO: Record<string, string> = {
  image: '[Imagen]',
  video: '[Video]',
  audio: '[Audio]',
  file: '[Archivo]',
  share: '[Publicación compartida]',
  story_mention: '[Mención en una historia]',
  reel: '[Reel]',
  ig_reel: '[Reel]',
};

// Error de la API de Instagram. Extiende BadGatewayException para que el panel
// reciba un 502 con el motivo real y no un 500 genérico.
class InstagramApiError extends BadGatewayException {
  constructor(
    message: string,
    readonly code?: number,
    readonly tipo?: string,
  ) {
    super(`Instagram respondió con un error: ${message}`);
  }
}

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // Las credenciales se leen al usarlas y no al arrancar: la API sigue
  // levantando en un entorno donde Instagram todavía no está configurado.
  private requerida(nombre: string): string {
    const v = this.config.get<string>(nombre);
    if (!v) throw new ServiceUnavailableException('Instagram no está configurado en este entorno');
    return v;
  }

  private get version(): string {
    return this.config.get<string>('INSTAGRAM_GRAPH_VERSION') ?? 'v23.0';
  }

  private get redirectUri(): string {
    return this.config.get<string>('INSTAGRAM_REDIRECT_URI') ?? 'https://api.orbita.site/api/v1/instagram/oauth/callback';
  }

  private get tokenKey(): string {
    return this.requerida('INSTAGRAM_TOKEN_KEY');
  }

  // ── Compuerta por negocio ──────────────────────────────────────────────────

  /**
   * Igual criterio que WhatsApp: mientras la app no tenga acceso avanzado, solo
   * funciona con cuentas de testers. En producción solo se ve y se usa en los
   * negocios listados en INSTAGRAM_NEGOCIOS_HABILITADOS (subdominios separados
   * por coma); sin la variable, en ninguno. Fuera de producción, sin la
   * variable, están todos habilitados para poder probar.
   */
  async asegurarHabilitado(businessId: string): Promise<void> {
    const lista = (this.config.get<string>('INSTAGRAM_NEGOCIOS_HABILITADOS') ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (lista.length === 0) {
      if (this.config.get<string>('NODE_ENV') === 'production') throw new ForbiddenException('Instagram todavía no está disponible para este negocio');
      return;
    }
    const negocio = await this.prisma.business.findUnique({ where: { id: businessId }, select: { subdomain: true } });
    if (!negocio || !lista.includes(negocio.subdomain.toLowerCase())) {
      throw new ForbiddenException('Instagram todavía no está disponible para este negocio');
    }
  }

  // ── Conectar: login con Instagram ──────────────────────────────────────────

  // El callback es público (vuelve desde Instagram sin sesión), así que el
  // negocio que inició la conexión viaja en un `state` firmado con JWT_SECRET:
  // no se puede inventar. Mismo patrón que Mercado Pago.
  private firmarState(businessId: string, memberId?: string): string {
    const payload: StatePayload = {
      businessId,
      ...(memberId ? { memberId } : {}),
      nonce: randomBytes(16).toString('hex'),
      exp: Date.now() + STATE_TTL_MS,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.requerida('JWT_SECRET')).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  private verificarState(state: string | undefined): StatePayload {
    const [body, sig] = (state ?? '').split('.');
    if (!body || !sig) throw new BadRequestException('state inválido');
    const esperada = createHmac('sha256', this.requerida('JWT_SECRET')).update(body).digest('base64url');
    if (!this.iguales(sig, esperada)) throw new BadRequestException('state inválido');
    let payload: StatePayload;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('state inválido');
    }
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) throw new BadRequestException('state expirado');
    return payload;
  }

  urlDeAutorizacion(businessId: string, memberId?: string): string {
    const params = new URLSearchParams({
      client_id: this.requerida('INSTAGRAM_APP_ID'),
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: SCOPES,
      state: this.firmarState(businessId, memberId),
      // Si el navegador ya tiene una sesión de Instagram abierta, obliga a elegir la
      // cuenta (Meta lo recomienda sobre todo en celulares).
      force_reauth: 'true',
    });
    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  }

  /** Vuelta del login: cambia el code por el token, lo guarda cifrado y suscribe el webhook. */
  async manejarCallback(code: string, state: string | undefined): Promise<{ businessId: string; subdomain: string; suscripta: boolean }> {
    const { businessId } = this.verificarState(state);
    await this.asegurarHabilitado(businessId);

    const negocio = await this.prisma.business.findUnique({ where: { id: businessId }, select: { subdomain: true } });
    if (!negocio) throw new BadRequestException('Negocio no encontrado');

    // 1) code (vale 1 hora y un solo uso) → token corto.
    const form = new URLSearchParams({
      client_id: this.requerida('INSTAGRAM_APP_ID'),
      client_secret: this.requerida('INSTAGRAM_APP_SECRET'),
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
      code,
    });
    const corto = await this.llamar<{ access_token?: string; data?: { access_token?: string }[] }>('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: form,
    });
    const tokenCorto = corto.access_token ?? corto.data?.[0]?.access_token;
    if (!tokenCorto) throw new BadGatewayException('Instagram no devolvió el token esperado');

    // 2) token corto (1 hora) → token largo (60 días). Siempre desde el servidor:
    // lleva el App Secret.
    const largo = await this.llamar<{ access_token?: string; expires_in?: number }>(
      `https://graph.instagram.com/access_token?${new URLSearchParams({
        grant_type: 'ig_exchange_token',
        client_secret: this.requerida('INSTAGRAM_APP_SECRET'),
        access_token: tokenCorto,
      }).toString()}`,
    );
    if (!largo.access_token) throw new BadGatewayException('Instagram no devolvió el token de larga duración');
    const vence = new Date(Date.now() + (largo.expires_in ?? 60 * 24 * 3600) * 1000);

    // 3) quién es: `user_id` es el id de la cuenta profesional, el que viene en
    // los webhooks (`id` es el id propio de esta app).
    const perfil = await this.llamar<{ id?: string; user_id?: string | number; username?: string }>(
      `https://graph.instagram.com/${this.version}/me?${new URLSearchParams({ fields: 'user_id,username', access_token: largo.access_token }).toString()}`,
    );
    const igUserId = String(perfil.user_id ?? perfil.id ?? '');
    if (!igUserId) throw new BadGatewayException('Instagram no devolvió la cuenta conectada');

    try {
      await this.prisma.$executeRaw`
        INSERT INTO instagram_connections (id, business_id, ig_user_id, username, access_token, token_expires_at, status, created_at, updated_at)
        VALUES (
          ${randomUUID()}, ${businessId}, ${igUserId}, ${perfil.username ?? null},
          encode(pgp_sym_encrypt(${largo.access_token}, ${this.tokenKey}), 'base64'),
          ${vence}, 'ACTIVE'::"InstagramConnectionStatus", now(), now()
        )
        ON CONFLICT (business_id) DO UPDATE SET
          ig_user_id = EXCLUDED.ig_user_id,
          username = EXCLUDED.username,
          access_token = EXCLUDED.access_token,
          token_expires_at = EXCLUDED.token_expires_at,
          status = 'ACTIVE'::"InstagramConnectionStatus",
          updated_at = now()`;
    } catch (e) {
      if (describeError(e).includes('ig_user_id')) {
        throw new ConflictException('Esa cuenta de Instagram ya está conectada a otro negocio');
      }
      throw e;
    }

    // Para recibir los mensajes hay que suscribir la cuenta al webhook. Se
    // intenta y se informa: la conexión ya quedó guardada.
    let suscripta = true;
    try {
      await this.llamar(
        `https://graph.instagram.com/${this.version}/me/subscribed_apps?${new URLSearchParams({ subscribed_fields: 'messages', access_token: largo.access_token }).toString()}`,
        { method: 'POST' },
      );
    } catch (e) {
      suscripta = false;
      this.logger.warn(`No se pudo suscribir la cuenta de Instagram al webhook (negocio ${businessId}): ${describeError(e)}`);
    }
    return { businessId, subdomain: negocio.subdomain, suscripta };
  }

  async estado(businessId: string) {
    const c = await this.prisma.instagramConnection.findUnique({
      where: { businessId },
      select: { status: true, username: true, tokenExpiresAt: true, createdAt: true },
    });
    if (!c || c.status !== 'ACTIVE') return { connected: false as const };
    return { connected: true as const, username: c.username, connectedAt: c.createdAt, tokenExpiresAt: c.tokenExpiresAt };
  }

  async desconectar(businessId: string) {
    const c = await this.prisma.instagramConnection.findUnique({ where: { businessId }, select: { id: true } });
    if (!c) throw new NotFoundException('No hay una conexión de Instagram para desconectar');
    // Se borra la credencial (no solo se marca): al desconectar dejamos de
    // guardar el token, como promete la política de privacidad.
    await this.prisma.instagramConnection.update({ where: { businessId }, data: { status: 'DISCONNECTED', accessToken: '' } });
    return { connected: false as const };
  }

  /**
   * Callback de "desautorización": Instagram lo llama cuando el dueño quita la
   * app desde su cuenta. Llega un `signed_request` firmado con el App Secret;
   * se valida y se corta la conexión (y se borra el token).
   */
  async desautorizar(signedRequest: string | undefined): Promise<void> {
    const [sig, payload] = (signedRequest ?? '').split('.');
    if (!sig || !payload) throw new BadRequestException('signed_request inválido');
    const esperada = createHmac('sha256', this.requerida('INSTAGRAM_APP_SECRET')).update(payload).digest('base64url');
    if (!this.iguales(sig, esperada)) throw new ForbiddenException();
    let userId: string | undefined;
    try {
      userId = String((JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { user_id?: string | number }).user_id ?? '');
    } catch {
      throw new BadRequestException('signed_request inválido');
    }
    if (!userId) return;
    // Primero se resuelve a qué negocio pertenece la cuenta (igUserId es único) y
    // recién ahí se corta, filtrando por ese negocio como el resto de las consultas.
    const c = await this.prisma.instagramConnection.findUnique({ where: { igUserId: userId }, select: { businessId: true } });
    if (!c) return;
    await this.prisma.instagramConnection.update({
      where: { businessId: c.businessId },
      data: { status: 'DISCONNECTED', accessToken: '' },
    });
  }

  // ── Webhook: verificación y firma ──────────────────────────────────────────

  verificarSuscripcion(mode?: string, token?: string, challenge?: string): string | null {
    const esperado = this.config.get<string>('INSTAGRAM_VERIFY_TOKEN');
    if (!esperado || mode !== 'subscribe' || !token || !challenge) return null;
    return this.iguales(token, esperado) ? challenge : null;
  }

  /** Valida X-Hub-Signature-256 (HMAC-SHA256 del body crudo con el App Secret de Instagram). */
  firmaValida(rawBody: Buffer | undefined, header: string | undefined): boolean {
    const secret = this.config.get<string>('INSTAGRAM_APP_SECRET');
    if (!secret) {
      this.logger.error('INSTAGRAM_APP_SECRET no configurado: webhook rechazado');
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

  async procesarWebhook(body: IgWebhookBody): Promise<void> {
    if (body.object !== 'instagram') return;
    for (const entry of body.entry ?? []) {
      for (const m of entry.messaging ?? []) {
        try {
          await this.guardarMensaje(entry.id, m);
        } catch (e) {
          // Un mensaje que falla no tumba el resto ni hace que Meta reintente el lote.
          this.logger.error(`No se pudo guardar el mensaje ${m.message?.mid ?? '?'}: ${describeError(e)}`);
        }
      }
    }
  }

  private textoDe(msg: IgMessage): string | null {
    if (msg.is_deleted) return null;
    if (msg.text?.trim()) return msg.text.trim();
    const tipo = msg.attachments?.[0]?.type;
    if (!tipo) return null;
    // Las imágenes, audios y archivos todavía no se descargan: se avisa que
    // llegó algo para que el dueño lo abra desde la app de Instagram.
    return ETIQUETA_ADJUNTO[tipo] ?? '[Mensaje no compatible]';
  }

  private async guardarMensaje(entryId: string | undefined, m: IgMessaging): Promise<void> {
    const msg = m.message;
    if (!msg?.mid) return;
    const texto = this.textoDe(msg);
    if (!texto) return;
    // Meta reintenta si no recibe 200 a tiempo: un mismo mensaje no se guarda dos veces.
    if (await this.prisma.message.findUnique({ where: { externalId: msg.mid }, select: { id: true } })) return;

    // El eco (is_echo) es un mensaje que mandó EL NEGOCIO (por Órbita o desde la
    // app de Instagram): ahí el remitente es la cuenta y el cliente es el
    // destinatario. Los que mandó Órbita ya están guardados y se cortan arriba.
    const eco = msg.is_echo === true;
    const idCuenta = eco ? m.sender?.id : m.recipient?.id;
    const idCliente = eco ? m.recipient?.id : m.sender?.id;
    if (!idCliente) return;

    const conexion = await this.conexionActiva([entryId, idCuenta]);
    if (!conexion) {
      this.logger.warn('Evento de Instagram para una cuenta sin conexión activa');
      return;
    }

    const customerId = await this.resolverCliente(conexion.businessId, idCliente);
    if (!customerId) return;

    const conv =
      (await this.prisma.conversation.findFirst({ where: { businessId: conexion.businessId, customerId }, select: { id: true } })) ??
      (await this.prisma.conversation.create({ data: { businessId: conexion.businessId, customerId, isUnread: !eco }, select: { id: true } }));

    const creado = m.timestamp ? new Date(m.timestamp > 1e12 ? m.timestamp : m.timestamp * 1000) : new Date();
    await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId: conv.id, sender: eco ? 'STORE' : 'CUSTOMER', text: texto, channel: 'INSTAGRAM', externalId: msg.mid, createdAt: creado },
      }),
      this.prisma.conversation.update({
        where: { id: conv.id },
        // Un eco (el dueño contestó desde el celular) no marca la charla como sin leer.
        data: eco ? { updatedAt: new Date() } : { isUnread: true, isArchived: false, updatedAt: new Date() },
      }),
    ]);
  }

  private async conexionActiva(ids: (string | undefined)[]): Promise<{ businessId: string } | null> {
    for (const id of ids) {
      if (!id) continue;
      const c = await this.prisma.instagramConnection.findUnique({ where: { igUserId: id }, select: { businessId: true, status: true } });
      if (c && c.status === 'ACTIVE') return { businessId: c.businessId };
    }
    return null;
  }

  // Un cliente de Instagram es un Customer del negocio identificado por su IGSID.
  // A diferencia de WhatsApp no hay teléfono con el cual vincularlo a un cliente
  // existente: se crea uno nuevo (el dueño lo ve igual en la bandeja).
  private async resolverCliente(businessId: string, igsid: string): Promise<string | null> {
    const existente = await this.prisma.customer.findUnique({
      where: { businessId_instagramId: { businessId, instagramId: igsid } },
      select: { id: true, deletedAt: true },
    });
    if (existente) {
      if (existente.deletedAt) {
        this.logger.warn(`Mensaje de Instagram de un cliente eliminado (negocio ${businessId})`);
        return null;
      }
      return existente.id;
    }
    const nombre = await this.nombreDelPerfil(businessId, igsid);
    const creado = await this.prisma.customer.create({
      data: { businessId, firstName: nombre ?? `Instagram ${igsid.slice(-4)}`, instagramId: igsid },
      select: { id: true },
    });
    return creado.id;
  }

  // Mejor esfuerzo: el nombre no es motivo para perder el mensaje.
  private async nombreDelPerfil(businessId: string, igsid: string): Promise<string | null> {
    try {
      const cred = await this.credenciales(businessId);
      if (!cred) return null;
      const p = await this.llamar<{ name?: string; username?: string }>(
        `https://graph.instagram.com/${this.version}/${igsid}?${new URLSearchParams({ fields: 'name,username', access_token: cred.access_token }).toString()}`,
      );
      return p.name?.trim() || (p.username ? `@${p.username}` : null);
    } catch (e) {
      this.logger.warn(`No se pudo leer el perfil del cliente de Instagram: ${describeError(e)}`);
      return null;
    }
  }

  // ── Envío ──────────────────────────────────────────────────────────────────

  private async credenciales(businessId: string): Promise<ConexionDescifrada | null> {
    const rows = await this.prisma.$queryRaw<ConexionDescifrada[]>`
      SELECT ig_user_id, pgp_sym_decrypt(decode(access_token, 'base64'), ${this.tokenKey}) AS access_token
      FROM instagram_connections WHERE business_id = ${businessId} AND status = 'ACTIVE'::"InstagramConnectionStatus"`;
    return rows[0] ?? null;
  }

  /**
   * Manda un texto por Instagram y devuelve el id del mensaje. Instagram solo
   * deja contestar dentro de las 24 h posteriores al último mensaje del
   * cliente: pasado ese plazo se rechaza antes de llamar a la API.
   */
  async enviarTexto(businessId: string, conversationId: string, igsid: string, texto: string): Promise<string> {
    if (Buffer.byteLength(texto, 'utf8') > MAX_BYTES_TEXTO) {
      throw new BadRequestException('El mensaje es demasiado largo para Instagram (máximo 1000 caracteres).');
    }
    const ultimo = await this.prisma.message.findFirst({
      where: { conversationId, channel: 'INSTAGRAM', sender: 'CUSTOMER' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (!ultimo || Date.now() - ultimo.createdAt.getTime() > VENTANA_MS) {
      throw new UnprocessableEntityException(
        'Pasaron más de 24 horas desde el último mensaje del cliente. Instagram solo permite responder dentro de ese plazo.',
      );
    }
    const cred = await this.credenciales(businessId);
    if (!cred) throw new BadRequestException('Instagram no está conectado');

    try {
      const res = await this.llamar<{ message_id?: string }>(`https://graph.instagram.com/${this.version}/${cred.ig_user_id}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cred.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: igsid }, message: { text: texto } }),
      });
      if (!res.message_id) throw new BadGatewayException('Instagram no confirmó el envío');
      return res.message_id;
    } catch (e) {
      // Un error de autenticación (código 190) significa que Instagram ya no acepta
      // ese token (cambió la contraseña o quitó la app): se corta la conexión para
      // que el panel pida volver a conectar.
      if (e instanceof InstagramApiError && (e.code === 190 || e.tipo === 'OAuthException')) {
        await this.prisma.instagramConnection.update({ where: { businessId }, data: { status: 'DISCONNECTED', accessToken: '' } });
        throw new UnprocessableEntityException('Instagram ya no acepta la conexión de esta cuenta. Volvé a conectarla desde Mensajes.');
      }
      throw e;
    }
  }

  // ── Renovación del token (cron nocturno) ───────────────────────────────────

  /**
   * El token de larga duración dura 60 días y se puede renovar. Si no se renueva
   * antes, todas las conexiones se cortan a la vez. Renueva las que vencen en
   * menos de 15 días; si Instagram rechaza el token (el dueño cambió la
   * contraseña o quitó la app), marca la conexión como desconectada.
   */
  async renovarTokens(): Promise<{ renovadas: number; desconectadas: number; fallidas: number }> {
    const limite = new Date(Date.now() + RENOVAR_CON_ANTICIPACION_MS);
    const porVencer = await this.prisma.instagramConnection.findMany({
      where: { status: 'ACTIVE', tokenExpiresAt: { lt: limite } },
      select: { businessId: true },
    });
    let renovadas = 0;
    let desconectadas = 0;
    let fallidas = 0;
    for (const { businessId } of porVencer) {
      try {
        const cred = await this.credenciales(businessId);
        if (!cred) continue;
        const r = await this.llamar<{ access_token?: string; expires_in?: number }>(
          `https://graph.instagram.com/refresh_access_token?${new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: cred.access_token }).toString()}`,
        );
        if (!r.access_token) throw new BadGatewayException('Instagram no devolvió el token renovado');
        const vence = new Date(Date.now() + (r.expires_in ?? 60 * 24 * 3600) * 1000);
        await this.prisma.$executeRaw`
          UPDATE instagram_connections
          SET access_token = encode(pgp_sym_encrypt(${r.access_token}, ${this.tokenKey}), 'base64'), token_expires_at = ${vence}, updated_at = now()
          WHERE business_id = ${businessId}`;
        renovadas++;
      } catch (e) {
        if (e instanceof InstagramApiError && (e.tipo === 'OAuthException' || e.code === 190)) {
          await this.prisma.instagramConnection.update({ where: { businessId }, data: { status: 'DISCONNECTED', accessToken: '' } });
          desconectadas++;
          this.logger.warn(`Instagram rechazó el token del negocio ${businessId}: la conexión se marcó como desconectada`);
        } else {
          fallidas++;
          this.logger.error(`No se pudo renovar el token de Instagram del negocio ${businessId}: ${describeError(e)}`);
        }
      }
    }
    return { renovadas, desconectadas, fallidas };
  }

  // ── Llamadas HTTP ──────────────────────────────────────────────────────────

  private async llamar<T = unknown>(url: string, init: { method?: string; headers?: Record<string, string>; body?: string | URLSearchParams } = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    } catch (e) {
      this.logger.error(`Instagram (red): ${describeError(e)}`);
      throw new BadGatewayException('No se pudo comunicar con Instagram. Probá de nuevo en un momento.');
    }
    const json = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; code?: number; type?: string };
      error_message?: string;
      error_type?: string;
      code?: number;
    } & T;
    if (!res.ok) {
      const mensaje = json.error?.message ?? json.error_message ?? `HTTP ${res.status}`;
      const err = new InstagramApiError(mensaje, json.error?.code ?? json.code, json.error?.type ?? json.error_type);
      // La URL puede llevar el token en la query: solo se registra el recurso.
      this.logger.warn(`Instagram ${init.method ?? 'GET'} ${url.split('?')[0].replace(/\/\d{6,}/g, '/:id')} → ${res.status}: ${mensaje}`);
      throw err;
    }
    return json;
  }
}
