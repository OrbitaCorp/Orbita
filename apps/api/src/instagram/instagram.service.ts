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
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { describeError } from '../common/utils/describe-error.util';
import { escaparHtml } from '../common/utils/html';
import { MailService } from '../mail/mail.service';
import { PANTALLAS_DE_RETORNO, type PantallaDeRetorno } from './dto/conectar-instagram.dto';

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
const SCOPES_BASE = 'instagram_business_basic,instagram_business_manage_messages';
// Kit de difusión: publicar, comentarios y estadísticas. Se piden cuando la persona se conecta desde Difusión (o
// autoriza el kit desde ahí), para que quien solo quiere mensajes no vea en Instagram una pantalla que pide más
// de lo que usa.
export const SCOPE_PUBLICAR = 'instagram_business_content_publish';
export const SCOPE_COMENTAR = 'instagram_business_manage_comments';
export const SCOPE_ESTADISTICAS = 'instagram_business_manage_insights';
const SCOPES_KIT = [SCOPE_PUBLICAR, SCOPE_COMENTAR, SCOPE_ESTADISTICAS];
const SCOPES_COMPLETOS = [SCOPES_BASE, ...SCOPES_KIT].join(',');

// Qué hay que hacer cuando falta cada permiso (el mensaje que ve la persona).
const MENSAJE_SIN_PERMISO: Record<string, string> = {
  [SCOPE_PUBLICAR]: 'Falta autorizar la publicación: volvé a conectar Instagram dándole ese permiso a Órbita.',
  [SCOPE_COMENTAR]: 'Falta autorizar los comentarios: volvé a conectar Instagram dándole ese permiso a Órbita.',
  [SCOPE_ESTADISTICAS]: 'Falta autorizar las estadísticas: volvé a conectar Instagram dándole ese permiso a Órbita.',
};

interface StatePayload {
  businessId: string;
  memberId?: string;
  // Desde dónde se abrió el panel (el Origin del navegador): a ese mismo lugar se vuelve al terminar el
  // login. Sin esto se volvía siempre a FRONTEND_URL, que puede ser otro sitio que el de la sesión
  // (en local, localhost vs negocio.orbita.local) y la persona caía en el login.
  origen?: string;
  // Pantalla del panel desde la que se pidió la conexión (mensajes o difusion).
  seccion?: PantallaDeRetorno;
  // 'kit' = además del permiso de mensajes, pide los del kit de difusión (publicar, comentarios y estadísticas).
  permisos?: 'kit';
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
    // Opcional: solo avisa los pedidos de acceso anticipado.
    @Optional() private readonly mail?: MailService,
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
   *
   * Además de la variable, un negocio queda habilitado cuando el equipo acepta su
   * pedido de acceso anticipado (InstagramEarlyAccess en ENABLED): así no hace
   * falta tocar variables ni redesplegar para sumar un piloto.
   */
  async estaHabilitado(businessId: string): Promise<boolean> {
    const acceso = await this.prisma.instagramEarlyAccess.findUnique({ where: { businessId }, select: { status: true } });
    if (acceso?.status === 'ENABLED') return true;
    const lista = (this.config.get<string>('INSTAGRAM_NEGOCIOS_HABILITADOS') ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (lista.length === 0) return this.config.get<string>('NODE_ENV') !== 'production';
    const negocio = await this.prisma.business.findUnique({ where: { id: businessId }, select: { subdomain: true } });
    return !!negocio && lista.includes(negocio.subdomain.toLowerCase());
  }

  async asegurarHabilitado(businessId: string): Promise<void> {
    if (!(await this.estaHabilitado(businessId))) {
      throw new ForbiddenException('Instagram todavía no está disponible para este negocio');
    }
  }

  // ── Acceso anticipado ──────────────────────────────────────────────────────

  // Usuario de Instagram: letras, números, puntos y guiones bajos, hasta 30.
  private normalizarUsuario(crudo: string): string {
    const usuario = (crudo ?? '').trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9._]{1,30}$/.test(usuario)) {
      throw new BadRequestException('Escribí tu usuario de Instagram sin espacios (letras, números, puntos y guiones bajos).');
    }
    return usuario;
  }

  /**
   * Lo que ve el panel: si el negocio puede conectar, el estado de la conexión; si
   * no, su pedido de acceso anticipado (o null si todavía no pidió).
   */
  async estadoParaPanel(businessId: string) {
    if (await this.estaHabilitado(businessId)) {
      return { habilitado: true as const, ...(await this.estado(businessId)) };
    }
    const pedido = await this.prisma.instagramEarlyAccess.findUnique({
      where: { businessId },
      select: { username: true, requestedAt: true },
    });
    return { habilitado: false as const, connected: false as const, solicitud: pedido };
  }

  /**
   * El dueño deja su @usuario para que el equipo lo sume como evaluador de la app
   * de Meta. Un pedido por negocio: pedir de nuevo con otro usuario lo corrige, y
   * el aviso al equipo sale solo si el pedido es nuevo o cambió el usuario.
   */
  async solicitarAcceso(businessId: string, usuarioCrudo: string, memberId?: string) {
    const username = this.normalizarUsuario(usuarioCrudo);
    if (await this.estaHabilitado(businessId)) {
      throw new ConflictException('Instagram ya está habilitado para este negocio');
    }
    // A esa persona se le avisa cuando habiliten el negocio. Si no hay (o no se encuentra),
    // el aviso va al propietario.
    const quien = memberId
      ? await this.prisma.member.findFirst({ where: { id: memberId, businessId }, select: { email: true } })
      : null;
    const contactEmail = quien?.email ?? null;
    const previo = await this.prisma.instagramEarlyAccess.findUnique({ where: { businessId }, select: { username: true } });
    const pedido = await this.prisma.instagramEarlyAccess.upsert({
      where: { businessId },
      create: { businessId, username, contactEmail },
      update: { username, ...(contactEmail ? { contactEmail } : {}) },
      select: { username: true, requestedAt: true },
    });
    if (!previo || previo.username !== username) await this.avisarPedido(businessId, username);
    return pedido;
  }

  // El aviso nunca rompe el pedido: si el correo falla, el pedido igual queda en
  // el superadmin.
  private async avisarPedido(businessId: string, username: string): Promise<void> {
    try {
      const negocio = await this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true, subdomain: true } });
      if (!negocio || !this.mail) return;
      const html =
        `<p><strong>${escaparHtml(negocio.name)}</strong> (${escaparHtml(negocio.subdomain)}) pidió acceso anticipado a Instagram con la cuenta <strong>@${escaparHtml(username)}</strong>.</p>` +
        '<p>Sumala como evaluadora de Instagram en los roles de la app de Meta y después habilitala en el superadmin.</p>';
      await this.mail.sendCustomEmail('soporte@orbita.site', `Instagram: pedido de acceso de ${negocio.name}`, html);
    } catch (e) {
      this.logger.warn(`No se pudo avisar el pedido de acceso a Instagram: ${describeError(e)}`);
    }
  }

  // ── Superadmin: pedidos de acceso ──────────────────────────────────────────

  async pedidosDeAcceso() {
    return this.prisma.instagramEarlyAccess.findMany({
      orderBy: { requestedAt: 'desc' },
      select: {
        businessId: true,
        username: true,
        status: true,
        requestedAt: true,
        enabledAt: true,
        business: { select: { name: true, subdomain: true } },
      },
    });
  }

  /**
   * Habilitar es decirle al dueño que la invitación de evaluador ya está enviada: se le avisa por
   * correo (con un botón directo a Difusión) la primera vez que pasa de pendiente a habilitado.
   * Volver a habilitar uno que ya estaba habilitado no reenvía nada.
   */
  async cambiarHabilitacion(businessId: string, habilitar: boolean) {
    const pedido = await this.prisma.instagramEarlyAccess.findUnique({
      where: { businessId },
      select: { id: true, status: true, username: true, contactEmail: true },
    });
    if (!pedido) throw new NotFoundException('Ese negocio no pidió acceso a Instagram');
    const actualizado = await this.prisma.instagramEarlyAccess.update({
      where: { businessId },
      data: habilitar ? { status: 'ENABLED', enabledAt: new Date() } : { status: 'PENDING', enabledAt: null },
      select: { businessId: true, username: true, status: true, enabledAt: true },
    });
    const avisado = habilitar && pedido.status !== 'ENABLED' ? await this.avisarHabilitacion(businessId, pedido) : false;
    return { ...actualizado, avisado };
  }

  // Si el correo falla, el negocio igual queda habilitado: el superadmin se entera por `avisado: false`.
  private async avisarHabilitacion(businessId: string, pedido: { username: string; contactEmail: string | null }): Promise<boolean> {
    try {
      if (!this.mail) return false;
      const negocio = await this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true, subdomain: true } });
      if (!negocio) return false;
      const destino =
        pedido.contactEmail ??
        (await this.prisma.member.findFirst({ where: { businessId, role: { name: 'owner' }, status: 'ACTIVE' }, select: { email: true } }))?.email;
      if (!destino) return false;
      return await this.mail.sendInstagramAccesoListo(
        destino,
        {
          storeName: negocio.name,
          username: pedido.username,
          panelUrl: `https://${negocio.subdomain}.orbita.site/admin/ventas/difusion`,
        },
        { businessId },
      );
    } catch (e) {
      this.logger.warn(`No se pudo avisar la habilitación de Instagram: ${describeError(e)}`);
      return false;
    }
  }

  // ── Conectar: login con Instagram ──────────────────────────────────────────

  // El callback es público (vuelve desde Instagram sin sesión), así que el
  // negocio que inició la conexión viaja en un `state` firmado con JWT_SECRET:
  // no se puede inventar. Mismo patrón que Mercado Pago.
  private firmarState(businessId: string, memberId?: string, origen?: string, seccion?: PantallaDeRetorno, permisos?: 'kit'): string {
    const payload: StatePayload = {
      businessId,
      ...(memberId ? { memberId } : {}),
      ...(origen && this.esOrigenDePanel(origen) ? { origen } : {}),
      ...(seccion && PANTALLAS_DE_RETORNO.includes(seccion) ? { seccion } : {}),
      ...(permisos === 'kit' ? { permisos } : {}),
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

  /**
   * ¿Es este origen un panel de Órbita al que se puede volver? Mismos orígenes fijos que acepta CORS
   * (main.ts): FRONTEND_URL, orbita.site y sus subdominios, y en desarrollo localhost:3001 y
   * orbita.local:3001. Cualquier otra cosa se descarta y se vuelve a FRONTEND_URL: el `state` no puede
   * servir para mandar a la persona a un sitio ajeno.
   */
  private esOrigenDePanel(origen: string): boolean {
    const frontend = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
    if (origen === frontend) return true;
    if (/^https:\/\/([a-z0-9-]+\.)?orbita\.site$/.test(origen)) return true;
    if (this.config.get<string>('NODE_ENV') === 'production') return false;
    return /^http:\/\/localhost:3001$/.test(origen) || /^http:\/\/([a-z0-9-]+\.)?orbita\.local:3001$/.test(origen);
  }

  /**
   * Dirección del panel de Mensajes del negocio para volver tras el login de Instagram. En un host de la
   * tienda (negocio.orbita.site) las rutas del panel no llevan el subdominio; en el apex sí.
   */
  urlDeRetorno(subdomain: string, origen?: string, seccion: PantallaDeRetorno = 'mensajes'): string {
    const base = origen && this.esOrigenDePanel(origen) ? origen : (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001');
    const enHostDeLaTienda = new URL(base).hostname.startsWith(`${subdomain}.`);
    const pantalla = PANTALLAS_DE_RETORNO.includes(seccion) ? seccion : 'mensajes';
    // Publicaciones, comentarios y estadísticas son vistas de Difusión (?vista=), no secciones aparte.
    const esVistaDeDifusion = pantalla === 'publicaciones' || pantalla === 'comentarios' || pantalla === 'estadisticas';
    const ruta = esVistaDeDifusion ? `difusion?vista=${pantalla}` : pantalla;
    return `${base}/admin/${enHostDeLaTienda ? '' : `${subdomain}/`}ventas/${ruta}`;
  }

  /**
   * A dónde volver cuando el login de Instagram falló (el usuario canceló, no tiene permiso...): el panel de
   * Mensajes del negocio del `state`, si el state se puede verificar. undefined si no (vencido, inventado).
   */
  async retornoDelState(state: string | undefined): Promise<string | undefined> {
    try {
      const { businessId, origen, seccion } = this.verificarState(state);
      const negocio = await this.prisma.business.findUnique({ where: { id: businessId }, select: { subdomain: true } });
      return negocio ? this.urlDeRetorno(negocio.subdomain, origen, seccion) : undefined;
    } catch {
      return undefined;
    }
  }

  urlDeAutorizacion(businessId: string, memberId?: string, origen?: string, seccion?: PantallaDeRetorno, permisos?: 'kit'): string {
    const params = new URLSearchParams({
      client_id: this.requerida('INSTAGRAM_APP_ID'),
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.permisosPedidos(permisos, seccion),
      state: this.firmarState(businessId, memberId, origen, seccion, permisos),
      // Si el navegador ya tiene una sesión de Instagram abierta, obliga a elegir la
      // cuenta (Meta lo recomienda sobre todo en celulares).
      force_reauth: 'true',
    });
    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  }

  /** Vuelta del login: cambia el code por el token, lo guarda cifrado y suscribe el webhook. */
  async manejarCallback(code: string, state: string | undefined): Promise<{ businessId: string; subdomain: string; suscripta: boolean; retorno: string }> {
    const { businessId, origen, seccion, permisos } = this.verificarState(state);
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
    const corto = await this.llamar<{ access_token?: string; permissions?: string | string[]; data?: { access_token?: string; permissions?: string | string[] }[] }>('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: form,
    });
    const tokenCorto = corto.access_token ?? corto.data?.[0]?.access_token;
    if (!tokenCorto) throw new BadGatewayException('Instagram no devolvió el token esperado');
    // Qué permisos concedió la persona (puede destildar alguno en la pantalla de Instagram). Si la respuesta no
    // los trae, se toman los que se pidieron.
    const concedidos = corto.permissions ?? corto.data?.[0]?.permissions;
    const scopes = (Array.isArray(concedidos) ? concedidos.join(',') : concedidos)
      ?? this.permisosPedidos(permisos, seccion);

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
        INSERT INTO instagram_connections (id, business_id, ig_user_id, username, access_token, token_expires_at, scopes, status, created_at, updated_at)
        VALUES (
          ${randomUUID()}, ${businessId}, ${igUserId}, ${perfil.username ?? null},
          encode(pgp_sym_encrypt(${largo.access_token}, ${this.tokenKey}), 'base64'),
          ${vence}, ${scopes}, 'ACTIVE'::"InstagramConnectionStatus", now(), now()
        )
        ON CONFLICT (business_id) DO UPDATE SET
          ig_user_id = EXCLUDED.ig_user_id,
          username = EXCLUDED.username,
          access_token = EXCLUDED.access_token,
          token_expires_at = EXCLUDED.token_expires_at,
          scopes = EXCLUDED.scopes,
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
    return { businessId, subdomain: negocio.subdomain, suscripta, retorno: this.urlDeRetorno(negocio.subdomain, origen, seccion) };
  }

  async estado(businessId: string) {
    const c = await this.prisma.instagramConnection.findUnique({
      where: { businessId },
      select: { status: true, username: true, tokenExpiresAt: true, createdAt: true, scopes: true },
    });
    if (!c || c.status !== 'ACTIVE') return { connected: false as const };
    return {
      connected: true as const,
      username: c.username,
      connectedAt: c.createdAt,
      tokenExpiresAt: c.tokenExpiresAt,
      // ¿Qué permisos del kit se concedieron? Sin ellos, la pantalla correspondiente pide volver a autorizar.
      puedePublicar: this.concede(c.scopes, SCOPE_PUBLICAR),
      puedeComentar: this.concede(c.scopes, SCOPE_COMENTAR),
      puedeVerEstadisticas: this.concede(c.scopes, SCOPE_ESTADISTICAS),
    };
  }


  /**
   * Permisos que se piden en el login. Quien se conecta desde Difusión (el kit de difusión) autoriza de una
   * vez los de mensajes y los de publicar: se piden desde la primera conexión, para no volver a pedirle nada
   * cuando use Publicaciones. Quien se conecta desde el botón de Mensajes autoriza solo los de mensajes.
   *
   * INSTAGRAM_PEDIR_PUBLICAR=false lo apaga (Difusión pasa a pedir solo mensajes). Hay que apagarlo si la app
   * sale a producción con los permisos de publicar sin aprobar: un permiso sin aprobar en el login hace fallar
   * la conexión de todos los clientes reales.
   */
  private permisosPedidos(permisos?: 'kit', seccion?: PantallaDeRetorno): string {
    const desdeDifusion = seccion === 'difusion' || seccion === 'publicaciones' || seccion === 'comentarios' || seccion === 'estadisticas';
    const apagado = this.config.get<string>('INSTAGRAM_PEDIR_PUBLICAR') === 'false';
    const conKit = permisos === 'kit' || (desdeDifusion && !apagado);
    return conKit ? SCOPES_COMPLETOS : SCOPES_BASE;
  }

  private concede(scopes: string | null | undefined, permiso: string): boolean {
    return (scopes ?? '').split(',').map((s) => s.trim()).includes(permiso);
  }

  /** ¿La conexión del negocio está activa y tiene este permiso? */
  async tienePermiso(businessId: string, permiso: string): Promise<boolean> {
    const c = await this.prisma.instagramConnection.findUnique({ where: { businessId }, select: { status: true, scopes: true } });
    return !!c && c.status === 'ACTIVE' && this.concede(c.scopes, permiso);
  }

  /** ¿La conexión del negocio tiene el permiso de publicar contenido? */
  puedePublicar(businessId: string): Promise<boolean> {
    return this.tienePermiso(businessId, SCOPE_PUBLICAR);
  }

  /**
   * Llamada a la API de Instagram con el token de la conexión del negocio, para las pantallas del kit
   * (comentarios, estadísticas). Exige antes el permiso que corresponde. "{ig}" en la ruta se reemplaza por el
   * id de la cuenta. El token vencido (código 190) corta la conexión para que el panel pida volver a conectar;
   * otros errores (por ejemplo, un permiso que falta) NO la cortan.
   */
  async graph<T>(
    businessId: string,
    permiso: string,
    ruta: string,
    init: { metodo?: 'GET' | 'POST' | 'DELETE'; query?: Record<string, string>; cuerpo?: Record<string, unknown> } = {},
  ): Promise<T> {
    if (!(await this.tienePermiso(businessId, permiso))) {
      throw new ForbiddenException(MENSAJE_SIN_PERMISO[permiso] ?? 'Falta autorizar un permiso de Instagram.');
    }
    const cred = await this.credenciales(businessId);
    if (!cred) throw new BadRequestException('Instagram no está conectado');
    const qs = new URLSearchParams(init.query ?? {}).toString();
    const url = `https://graph.instagram.com/${this.version}/${ruta.replace('{ig}', cred.ig_user_id)}${qs ? `?${qs}` : ''}`;
    const headers: Record<string, string> = { Authorization: `Bearer ${cred.access_token}` };
    if (init.cuerpo) headers['Content-Type'] = 'application/json';
    try {
      return await this.llamar<T>(url, { method: init.metodo ?? 'GET', headers, ...(init.cuerpo ? { body: JSON.stringify(init.cuerpo) } : {}) });
    } catch (e) {
      if (e instanceof InstagramApiError && e.code === 190) {
        await this.prisma.instagramConnection.update({ where: { businessId }, data: { status: 'DISCONNECTED', accessToken: '' } });
        throw new UnprocessableEntityException('Instagram ya no acepta la conexión de esta cuenta. Volvé a conectarla desde Difusión.');
      }
      throw e;
    }
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
