import { BadGatewayException, BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { PrismaService } from '../../prisma/prisma.service';
import { describeError } from '../../common/utils/describe-error.util';
import { PublicarTiktokDto } from './dto/publicar-tiktok.dto';
import { R2Service } from '../../r2/r2.service';

// Publicar los videos de marketing de Órbita en TikTok (Content Posting API, "Direct Post").
//
// Es la cuenta de la EMPRESA, no de un negocio: la conecta un superadmin desde Superadmin →
// Marketing → TikTok, y n8n (u otro automatismo) publica a través de esta API. Los tokens van
// cifrados con pgp_sym_encrypt, igual que WhatsApp e Instagram.
//
// OJO con la auditoría de TikTok: hasta que la app la pase, todo lo que se publique queda en
// modo PRIVADO ("SELF_ONLY") y si la cuenta no es privada la subida se rechaza. Sirve para
// construir y probar; recién con la app auditada se puede publicar en público.
//
// Los secretos se leen al usarlos y no al arrancar, para que la API siga levantando en un
// entorno donde TikTok todavía no está configurado.

const TIKTOK = 'https://open.tiktokapis.com';
// Los permisos que se piden al conectar: perfil, publicar directo y mandar a borradores. Tienen que coincidir
// con los de la app en developers.tiktok.com (si se pide uno que la app no tiene, TikTok rechaza el login).
const SCOPES_POR_DEFECTO = 'user.info.basic,video.publish,video.upload';
const STATE_TTL_MS = 10 * 60 * 1000;
const RENOVAR_CON_ANTICIPACION_MS = 6 * 3_600_000;
const MAX_TITULO = 2200;
// Un video de marketing no llega a esto. El tope protege la memoria de la API (se baja entero).
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const MB = 1024 * 1024;
const TROZO_MIN = 5 * MB;
const TROZO_MAX = 64 * MB;
const TIMEOUT_MS = 30_000;
const TIMEOUT_SUBIDA_MS = 180_000;

const EXTENSION_VIDEO: Record<string, string> = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' };

export type EstadoPublicacion = 'PROCESSING_UPLOAD' | 'PROCESSING_DOWNLOAD' | 'SEND_TO_USER_INBOX' | 'PUBLISH_COMPLETE' | 'FAILED';

export class TiktokApiError extends Error {
  constructor(readonly codigo: string, mensaje: string, readonly status: number) {
    super(mensaje);
    this.name = 'TiktokApiError';
  }
}

type StatePayload = { adminId: string; nonce: string; exp: number };
type CuentaDescifrada = { id: string; open_id: string; access_token: string; refresh_token: string; access_expires_at: Date; refresh_expires_at: Date };

export type InfoDelCreador = {
  avatar: string | null;
  usuario: string;
  nombre: string;
  /** Las privacidades que TikTok le permite elegir a esta cuenta ahora mismo. */
  privacidades: string[];
  comentariosDeshabilitados: boolean;
  duetosDeshabilitados: boolean;
  stitchDeshabilitado: boolean;
  duracionMaximaSeg: number;
};

/**
 * Cómo se parte un video para subirlo: TikTok pide trozos de entre 5 y 64 MB y la cantidad de
 * trozos es `floor(tamaño / trozo)`; el último absorbe lo que sobra. Un video de menos de 5 MB
 * va entero en un solo trozo.
 */
export function planDeTrozos(tamano: number, trozoDeseado = 10 * MB): { trozo: number; cantidad: number } {
  if (tamano <= 0) throw new BadRequestException('El video está vacío');
  if (tamano < TROZO_MIN) return { trozo: tamano, cantidad: 1 };
  const trozo = Math.min(Math.max(trozoDeseado, TROZO_MIN), TROZO_MAX, tamano);
  return { trozo, cantidad: Math.floor(tamano / trozo) };
}

/** ¿Es una dirección a la que la API no debe conectarse nunca (red interna, metadatos de Cloud Run, etc.)? */
export function esDireccionPrivada(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v6 = ip.toLowerCase();
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80') || v6.startsWith('::ffff:');
}

@Injectable()
export class TiktokService {
  private readonly logger = new Logger(TiktokService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    // Opcional por compatibilidad con los specs que construyen el servicio a mano; en la app real Nest lo inyecta siempre.
    private readonly r2?: R2Service,
  ) {}

  private requerida(nombre: string): string {
    const v = this.config.get<string>(nombre);
    if (!v) throw new ServiceUnavailableException('TikTok no está configurado en este entorno');
    return v;
  }

  private get redirectUri(): string {
    return this.config.get<string>('TIKTOK_REDIRECT_URI') ?? 'https://api.orbita.site/api/v1/platform/marketing/tiktok/callback';
  }

  private get tokenKey(): string {
    return this.requerida('TIKTOK_TOKEN_KEY');
  }

  private get scopes(): string {
    return this.config.get<string>('TIKTOK_SCOPES') ?? SCOPES_POR_DEFECTO;
  }

  /** ¿Están cargados los secretos de la app de TikTok? */
  configurado(): boolean {
    return !!(this.config.get('TIKTOK_CLIENT_KEY') && this.config.get('TIKTOK_CLIENT_SECRET') && this.config.get('TIKTOK_TOKEN_KEY'));
  }

  private iguales(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  }

  // ── Estado ─────────────────────────────────────────────────────────────

  async estado() {
    const configurado = this.configurado();
    const cuenta = await this.prisma.marketingTiktokAccount.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { openId: true, displayName: true, avatarUrl: true, scopes: true, accessExpiresAt: true, refreshExpiresAt: true, createdAt: true },
    });
    return {
      configurado,
      conectado: !!cuenta,
      cuenta: cuenta
        ? { nombre: cuenta.displayName, avatar: cuenta.avatarUrl, permisos: cuenta.scopes.split(',').filter(Boolean), conectadaEl: cuenta.createdAt, renovacionVenceEl: cuenta.refreshExpiresAt }
        : null,
    };
  }

  // ── Conectar: login con TikTok ─────────────────────────────────────────

  // El callback es público (vuelve desde TikTok sin sesión), así que el superadmin que inició la
  // conexión viaja en un `state` firmado con JWT_SECRET: no se puede inventar.
  private firmarState(adminId: string): string {
    const payload: StatePayload = { adminId, nonce: randomBytes(16).toString('hex'), exp: Date.now() + STATE_TTL_MS };
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

  urlDeAutorizacion(adminId: string): string {
    const params = new URLSearchParams({
      client_key: this.requerida('TIKTOK_CLIENT_KEY'),
      scope: this.scopes,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      state: this.firmarState(adminId),
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  }

  /** Vuelta del login: cambia el code por los tokens, trae el perfil y lo guarda todo (tokens cifrados). */
  async manejarCallback(code: string, state: string | undefined): Promise<{ nombre: string | null }> {
    const { adminId } = this.verificarState(state);
    const t = await this.pedirToken({ grant_type: 'authorization_code', code, redirect_uri: this.redirectUri });
    const perfil = await this.llamarApi<{ data?: { user?: { open_id?: string; display_name?: string; avatar_url?: string } } }>(
      'GET', `${TIKTOK}/v2/user/info/?fields=open_id,display_name,avatar_url`, t.access_token,
    ).catch((e: unknown) => {
      // El perfil es decorativo: si falla, la conexión igual sirve.
      this.logger.warn(`TikTok: no se pudo leer el perfil — ${describeError(e)}`);
      return null;
    });
    const usuario = perfil?.data?.user;
    const openId = usuario?.open_id ?? t.open_id;
    const ahora = Date.now();
    const venceAcceso = new Date(ahora + t.expires_in * 1000);
    const venceRenovacion = new Date(ahora + t.refresh_expires_in * 1000);
    await this.prisma.$executeRaw`
      INSERT INTO marketing_tiktok_accounts (id, open_id, display_name, avatar_url, access_token, refresh_token, access_expires_at, refresh_expires_at, scopes, connected_by, created_at, updated_at)
      VALUES (
        ${randomUUID()}, ${openId}, ${usuario?.display_name ?? null}, ${usuario?.avatar_url ?? null},
        encode(pgp_sym_encrypt(${t.access_token}, ${this.tokenKey}), 'base64'),
        encode(pgp_sym_encrypt(${t.refresh_token}, ${this.tokenKey}), 'base64'),
        ${venceAcceso}, ${venceRenovacion}, ${t.scope ?? this.scopes}, ${adminId}, now(), now()
      )
      ON CONFLICT (open_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        access_expires_at = EXCLUDED.access_expires_at,
        refresh_expires_at = EXCLUDED.refresh_expires_at,
        scopes = EXCLUDED.scopes,
        connected_by = EXCLUDED.connected_by,
        updated_at = now()`;
    // Es la cuenta de la empresa: hay una sola. Conectar otra reemplaza a la anterior.
    await this.prisma.marketingTiktokAccount.deleteMany({ where: { openId: { not: openId } } });
    await this.registrar(adminId, 'tiktok_connect', openId, { nombre: usuario?.display_name ?? null });
    return { nombre: usuario?.display_name ?? null };
  }

  // ── Tokens ─────────────────────────────────────────────────────────────

  private async pedirToken(extra: Record<string, string>) {
    const r = await fetch(`${TIKTOK}/v2/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
      body: new URLSearchParams({ client_key: this.requerida('TIKTOK_CLIENT_KEY'), client_secret: this.requerida('TIKTOK_CLIENT_SECRET'), ...extra }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const j = (await r.json().catch(() => ({}))) as {
      access_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number; open_id?: string; scope?: string;
      error?: string; error_description?: string;
    };
    if (!r.ok || j.error || !j.access_token || !j.refresh_token) {
      throw new TiktokApiError(j.error ?? 'token', j.error_description ?? 'TikTok no devolvió el token', r.status);
    }
    return {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_in: j.expires_in ?? 86_400,
      refresh_expires_in: j.refresh_expires_in ?? 365 * 86_400,
      open_id: j.open_id ?? '',
      scope: j.scope,
    };
  }

  private async cuentaDescifrada(): Promise<CuentaDescifrada | null> {
    const rows = await this.prisma.$queryRaw<CuentaDescifrada[]>`
      SELECT id, open_id,
        pgp_sym_decrypt(decode(access_token, 'base64'), ${this.tokenKey}) AS access_token,
        pgp_sym_decrypt(decode(refresh_token, 'base64'), ${this.tokenKey}) AS refresh_token,
        access_expires_at, refresh_expires_at
      FROM marketing_tiktok_accounts ORDER BY created_at ASC LIMIT 1`;
    return rows[0] ?? null;
  }

  /** Renueva con el token de renovación y guarda lo nuevo (TikTok puede cambiar también el de renovación). */
  private async renovar(cuenta: CuentaDescifrada): Promise<string> {
    const t = await this.pedirToken({ grant_type: 'refresh_token', refresh_token: cuenta.refresh_token });
    const ahora = Date.now();
    await this.prisma.$executeRaw`
      UPDATE marketing_tiktok_accounts SET
        access_token = encode(pgp_sym_encrypt(${t.access_token}, ${this.tokenKey}), 'base64'),
        refresh_token = encode(pgp_sym_encrypt(${t.refresh_token}, ${this.tokenKey}), 'base64'),
        access_expires_at = ${new Date(ahora + t.expires_in * 1000)},
        refresh_expires_at = ${new Date(ahora + t.refresh_expires_in * 1000)},
        updated_at = now()
      WHERE id = ${cuenta.id}`;
    return t.access_token;
  }

  /** Un token de acceso vigente (lo renueva si le queda poco). null si no hay cuenta conectada. */
  private async tokenVigente(): Promise<{ token: string; cuentaId: string } | null> {
    const cuenta = await this.cuentaDescifrada();
    if (!cuenta) return null;
    if (cuenta.access_expires_at.getTime() - Date.now() > RENOVAR_CON_ANTICIPACION_MS / 12) {
      return { token: cuenta.access_token, cuentaId: cuenta.id };
    }
    return { token: await this.renovar(cuenta), cuentaId: cuenta.id };
  }

  /**
   * Cuelga del mantenimiento nocturno: el token de acceso dura 24 h, así que se renueva cada noche
   * (eso también mantiene vivo el de renovación, que dura un año). No tira: si falla, queda en el log.
   */
  async renovarTokens(): Promise<{ renovada: boolean }> {
    if (!this.configurado()) return { renovada: false };
    try {
      const cuenta = await this.cuentaDescifrada();
      if (!cuenta) return { renovada: false };
      await this.renovar(cuenta);
      return { renovada: true };
    } catch (e) {
      this.logger.error(`TikTok: no se pudo renovar el token — ${describeError(e)}`);
      return { renovada: false };
    }
  }

  // ── Llamadas a la API de TikTok ────────────────────────────────────────

  private async llamarApi<T>(metodo: 'GET' | 'POST', url: string, token: string, cuerpo?: unknown): Promise<T> {
    const r = await fetch(url, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const j = (await r.json().catch(() => ({}))) as T & { error?: { code?: string; message?: string } };
    // TikTok contesta 200 con `error.code: "ok"` cuando salió bien, y un código propio cuando no.
    if (!r.ok || (j.error?.code && j.error.code !== 'ok')) {
      throw new TiktokApiError(j.error?.code ?? 'error', j.error?.message ?? `TikTok respondió ${r.status}`, r.status);
    }
    return j;
  }

  /** Lo que TikTok sabe de la cuenta ahora mismo: qué privacidades permite y los límites de duración. */
  async infoDelCreador(): Promise<InfoDelCreador> {
    const v = await this.tokenVigente();
    if (!v) throw new BadRequestException('TikTok no está conectado');
    const r = await this.llamarApi<{
      data?: {
        creator_avatar_url?: string; creator_username?: string; creator_nickname?: string; privacy_level_options?: string[];
        comment_disabled?: boolean; duet_disabled?: boolean; stitch_disabled?: boolean; max_video_post_duration_sec?: number;
      };
    }>('POST', `${TIKTOK}/v2/post/publish/creator_info/query/`, v.token).catch((e: unknown) => this.traducir(e));
    const d = r.data ?? {};
    return {
      avatar: d.creator_avatar_url ?? null,
      usuario: d.creator_username ?? '',
      nombre: d.creator_nickname ?? '',
      privacidades: d.privacy_level_options ?? [],
      comentariosDeshabilitados: !!d.comment_disabled,
      duetosDeshabilitados: !!d.duet_disabled,
      stitchDeshabilitado: !!d.stitch_disabled,
      duracionMaximaSeg: d.max_video_post_duration_sec ?? 0,
    };
  }

  /** Mensajes entendibles para los rechazos más comunes de TikTok. */
  private traducir(e: unknown): never {
    if (e instanceof TiktokApiError) {
      if (e.codigo === 'unaudited_client_can_only_post_to_private_accounts') {
        throw new BadRequestException('La app de TikTok todavía no pasó la auditoría: solo puede publicar en una cuenta privada y con visibilidad "solo yo".');
      }
      if (e.codigo === 'spam_risk_too_many_posts') throw new BadRequestException('TikTok frenó la publicación por demasiados videos en poco tiempo. Probá más tarde.');
      if (e.codigo === 'spam_risk_user_banned_from_posting') throw new BadRequestException('TikTok no deja publicar con esta cuenta por ahora.');
      if (e.codigo === 'access_token_invalid' || e.codigo === 'scope_not_authorized') {
        throw new BadRequestException('La conexión con TikTok venció o le faltan permisos. Volvé a conectar la cuenta.');
      }
      throw new BadGatewayException(`TikTok respondió: ${e.message}`.slice(0, 300));
    }
    throw e;
  }

  // ── Publicar ───────────────────────────────────────────────────────────

  /**
   * Una dirección firmada para que el navegador suba el video DIRECTO a R2 (sin pasar por el servidor, así no
   * pesa el límite de tamaño de la API) y la dirección pública con la que después se publica en TikTok.
   * Es el mismo camino que usa la sección de video de Apariencia.
   */
  async urlDeSubida(mimetype: string): Promise<{ uploadUrl: string; publicUrl: string }> {
    if (!this.r2) throw new ServiceUnavailableException('El almacenamiento de videos no está disponible');
    const ext = EXTENSION_VIDEO[mimetype];
    if (!ext) throw new BadRequestException('El archivo tiene que ser un video mp4, mov o webm');
    const path = `marketing/tiktok/${randomUUID()}.${ext}`;
    return { uploadUrl: await this.r2.presignUpload(path, mimetype), publicUrl: this.r2.publicUrlDe(path) };
  }

  /** Baja el video (solo https, sin redes internas, con tope de tamaño). */
  private async descargarVideo(url: string): Promise<{ datos: Buffer; tipo: string }> {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      throw new BadRequestException('La dirección del video no es válida');
    }
    if (u.protocol !== 'https:') throw new BadRequestException('La dirección del video tiene que ser https');
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new BadRequestException('Esa dirección de video no está permitida');
    const ips = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
    if (ips.length === 0) throw new BadRequestException('No se pudo resolver la dirección del video');
    if (ips.some(esDireccionPrivada)) throw new BadRequestException('Esa dirección de video no está permitida');

    // Sin seguir redirecciones: una redirección podría terminar en una red interna.
    const r = await fetch(u, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_SUBIDA_MS) });
    if (!r.ok) throw new BadRequestException(`No se pudo bajar el video (${r.status})`);
    const tipo = r.headers.get('content-type')?.split(';')[0].trim() ?? '';
    if (tipo && !tipo.startsWith('video/') && tipo !== 'application/octet-stream') throw new BadRequestException('Esa dirección no es un video');
    const declarado = Number(r.headers.get('content-length') ?? 0);
    if (declarado > MAX_VIDEO_BYTES) throw new BadRequestException('El video es demasiado grande');
    const partes: Buffer[] = [];
    let total = 0;
    for await (const parte of r.body as unknown as AsyncIterable<Uint8Array>) {
      total += parte.byteLength;
      if (total > MAX_VIDEO_BYTES) throw new BadRequestException('El video es demasiado grande');
      partes.push(Buffer.from(parte));
    }
    return { datos: Buffer.concat(partes), tipo: tipo.startsWith('video/') ? tipo : 'video/mp4' };
  }

  async publicar(dto: PublicarTiktokDto, adminId?: string) {
    if (dto.title.length > MAX_TITULO) throw new BadRequestException(`El título no puede pasar de ${MAX_TITULO} caracteres`);
    const v = await this.tokenVigente();
    if (!v) throw new BadRequestException('TikTok no está conectado');

    // TikTok exige elegir una de las privacidades que la cuenta permite en este momento.
    const creador = await this.infoDelCreador();
    if (!creador.privacidades.includes(dto.privacyLevel)) {
      throw new BadRequestException(`Esa visibilidad no está disponible para esta cuenta. Opciones: ${creador.privacidades.join(', ') || 'ninguna'}`);
    }
    if ((dto.brandContent || dto.brandOrganic) && dto.privacyLevel === 'SELF_ONLY') {
      throw new BadRequestException('Un video que promociona una marca no puede ser privado: TikTok lo rechaza.');
    }

    const { datos, tipo } = await this.descargarVideo(dto.videoUrl);
    const { trozo, cantidad } = planDeTrozos(datos.length);
    const init = await this.llamarApi<{ data?: { publish_id?: string; upload_url?: string } }>('POST', `${TIKTOK}/v2/post/publish/video/init/`, v.token, {
      post_info: {
        title: dto.title,
        privacy_level: dto.privacyLevel,
        disable_comment: !!dto.disableComment,
        disable_duet: !!dto.disableDuet,
        disable_stitch: !!dto.disableStitch,
        brand_content_toggle: !!dto.brandContent,
        brand_organic_toggle: !!dto.brandOrganic,
        is_aigc: !!dto.isAigc,
      },
      source_info: { source: 'FILE_UPLOAD', video_size: datos.length, chunk_size: trozo, total_chunk_count: cantidad },
    }).catch((e: unknown) => this.traducir(e));
    const publishId = init.data?.publish_id;
    const uploadUrl = init.data?.upload_url;
    if (!publishId || !uploadUrl) throw new BadGatewayException('TikTok no devolvió dónde subir el video');

    await this.subirPorTrozos(uploadUrl, datos, tipo, trozo, cantidad);

    const post = await this.prisma.marketingTiktokPost.create({
      data: {
        accountId: v.cuentaId, publishId, title: dto.title, privacyLevel: dto.privacyLevel, videoUrl: dto.videoUrl,
        status: 'PROCESSING_UPLOAD', createdBy: adminId ?? null,
      },
      select: { id: true, publishId: true, status: true },
    });
    if (adminId) await this.registrar(adminId, 'tiktok_publish', publishId, { privacidad: dto.privacyLevel, titulo: dto.title.slice(0, 120) });
    return post;
  }

  /** Sube el video a la dirección que dio TikTok, por trozos. El último se lleva lo que sobra de la división. */
  private async subirPorTrozos(uploadUrl: string, datos: Buffer, tipo: string, trozo: number, cantidad: number): Promise<void> {
    for (let i = 0; i < cantidad; i++) {
      const desde = i * trozo;
      const hasta = i === cantidad - 1 ? datos.length : desde + trozo;
      const r = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': tipo, 'Content-Length': String(hasta - desde), 'Content-Range': `bytes ${desde}-${hasta - 1}/${datos.length}` },
        // Un Buffer es válido como cuerpo de fetch en Node; los tipos de BodyInit todavía no lo reconocen.
        body: datos.subarray(desde, hasta) as unknown as BodyInit,
        signal: AbortSignal.timeout(TIMEOUT_SUBIDA_MS),
      });
      if (!r.ok && r.status !== 206) throw new BadGatewayException(`TikTok rechazó el trozo ${i + 1} de ${cantidad} (${r.status})`);
    }
  }

  /**
   * Manda el video a los BORRADORES de la cuenta (permiso video.upload): no se publica solo, una persona lo
   * termina en la app de TikTok (título, visibilidad, etc.). Sirve para publicar con una persona mirando y,
   * hasta que la app pase la auditoría, para no depender de la visibilidad "solo yo" del Direct Post.
   */
  async enviarABorradores(videoUrl: string, adminId?: string) {
    const v = await this.tokenVigente();
    if (!v) throw new BadRequestException('TikTok no está conectado');
    const { datos, tipo } = await this.descargarVideo(videoUrl);
    const { trozo, cantidad } = planDeTrozos(datos.length);
    const init = await this.llamarApi<{ data?: { publish_id?: string; upload_url?: string } }>('POST', `${TIKTOK}/v2/post/publish/inbox/video/init/`, v.token, {
      source_info: { source: 'FILE_UPLOAD', video_size: datos.length, chunk_size: trozo, total_chunk_count: cantidad },
    }).catch((e: unknown) => this.traducir(e));
    const publishId = init.data?.publish_id;
    const uploadUrl = init.data?.upload_url;
    if (!publishId || !uploadUrl) throw new BadGatewayException('TikTok no devolvió dónde subir el video');
    await this.subirPorTrozos(uploadUrl, datos, tipo, trozo, cantidad);

    const post = await this.prisma.marketingTiktokPost.create({
      data: {
        accountId: v.cuentaId, publishId, title: '(borrador)', privacyLevel: 'BORRADOR', videoUrl,
        status: 'PROCESSING_UPLOAD', createdBy: adminId ?? null,
      },
      select: { id: true, publishId: true, status: true },
    });
    if (adminId) await this.registrar(adminId, 'tiktok_draft', publishId, { video: videoUrl.slice(0, 200) });
    return post;
  }

  /** Pregunta a TikTok cómo va la publicación y guarda el estado. */
  async consultarEstado(publishId: string) {
    const post = await this.prisma.marketingTiktokPost.findUnique({ where: { publishId } });
    if (!post) throw new BadRequestException('Publicación desconocida');
    const v = await this.tokenVigente();
    if (!v) throw new BadRequestException('TikTok no está conectado');
    const r = await this.llamarApi<{ data?: { status?: string; fail_reason?: string; publicaly_available_post_id?: (string | number)[] } }>(
      'POST', `${TIKTOK}/v2/post/publish/status/fetch/`, v.token, { publish_id: publishId },
    ).catch((e: unknown) => this.traducir(e));
    const d = r.data ?? {};
    const actualizado = await this.prisma.marketingTiktokPost.update({
      where: { publishId },
      data: {
        status: d.status ?? post.status,
        failReason: d.fail_reason ?? null,
        postId: d.publicaly_available_post_id?.[0] != null ? String(d.publicaly_available_post_id[0]) : post.postId,
      },
    });
    return actualizado;
  }

  async publicaciones(limite = 20) {
    return this.prisma.marketingTiktokPost.findMany({ orderBy: { createdAt: 'desc' }, take: Math.min(Math.max(limite, 1), 100) });
  }

  // ── Desconectar ────────────────────────────────────────────────────────

  async desconectar(adminId?: string): Promise<{ ok: true }> {
    const cuenta = this.configurado() ? await this.cuentaDescifrada() : null;
    if (cuenta) {
      // Mejor esfuerzo: si TikTok no responde, igual se borra del lado de Órbita.
      await fetch(`${TIKTOK}/v2/oauth/revoke/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_key: this.requerida('TIKTOK_CLIENT_KEY'), client_secret: this.requerida('TIKTOK_CLIENT_SECRET'), token: cuenta.access_token }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }).catch((e: unknown) => this.logger.warn(`TikTok: no se pudo revocar el token — ${describeError(e)}`));
    }
    await this.prisma.marketingTiktokAccount.deleteMany({});
    if (adminId) await this.registrar(adminId, 'tiktok_disconnect', cuenta?.open_id ?? 'tiktok');
    return { ok: true };
  }

  // Quién conectó, publicó o desconectó la cuenta de la empresa: queda en el historial del super panel.
  // Es un registro, no puede romper la acción que ya se hizo.
  private async registrar(adminId: string, action: string, targetId: string, details?: Record<string, unknown>) {
    await this.prisma.platformAdminLog
      .create({ data: { adminId, action, targetType: 'marketing_tiktok', targetId, details: details as object | undefined } })
      .catch((e: unknown) => this.logger.warn(`TikTok: no se pudo registrar la acción ${action} — ${describeError(e)}`));
  }
}
