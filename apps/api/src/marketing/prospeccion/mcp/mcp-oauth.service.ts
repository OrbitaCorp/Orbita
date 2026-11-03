import { dominiosDelEquipo } from '../../../common/utils/dominios-equipo';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../../prisma/prisma.service';

// Servidor OAuth 2.1 (código de autorización + PKCE) del conector MCP de la Prospección.
//
// Quién puede conectar a Claude: solo un SUPERADMIN activo de Órbita cuyo correo sea de un dominio de la organización
// (MCP_DOMINIOS_PERMITIDOS, por defecto orbita-corp.com y orbita.site),. Cuenta el correo del PANEL, no el de la cuenta
// de Claude con la que se paga. Eso se vuelve a chequear en cada consulta del
// conector, no solo al autorizar: si alguien deja de ser superadmin o se desactiva su cuenta, Claude pierde el acceso
// en el momento.
//
// La autorización se aprueba en el panel (pages/superadmin/conectar-claude), que ya tiene login con Google y segundo
// factor: acá no hay una pantalla de login nueva.
//
// Los clientes (Claude) se registran solos (RFC 7591) pero NO se guardan: el client_id es un JWT firmado que lleva
// adentro sus direcciones de retorno. Los códigos de autorización y los tokens de renovación son de un solo uso y van
// como hash SHA-256. Las claves de firma se derivan de JWT_SECRET con una etiqueta distinta para cada uso, así un
// token de este conector nunca sirve como sesión del panel ni al revés.

export const PERMISO_MCP = 'marketing';
// Lo que se le muestra a la persona antes de autorizar (pantalla conectar-claude del panel): un solo conector, dos usos.
export const PERMISOS_MOSTRADOS = [
  'Videos: crear videos y dejarlos en la cola de preparación, para que una persona los apruebe antes de usarlos.',
  'Prospección: consultar cuentas de Instagram y guardar su análisis y un borrador de mensaje.',
];
const CODIGO_TTL_MS = 10 * 60_000;
const SOLICITUD_TTL = '10m';
const ACCESO_TTL_S = 3600;
const REFRESH_TTL_MS = 30 * 24 * 3_600_000;
const MAX_URIS_POR_CLIENTE = 5;

// Las direcciones a las que Claude vuelve después de autorizar. Claude (web y app) usa estas dos; Claude Code usa
// una dirección local (http://localhost:<puerto>/…), que se acepta solo en loopback.
const RETORNOS_DE_CLAUDE = ['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback'];
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

export class OAuthError extends Error {
  constructor(
    readonly codigo: string,
    mensaje: string,
    readonly status = 400,
    /** Si el error es del cliente o de su dirección de retorno no se puede redirigir: se muestra y listo. */
    readonly redirigible = false,
  ) {
    super(mensaje);
    this.name = 'OAuthError';
  }
}

export class AccesoDenegadoError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'AccesoDenegadoError';
  }
}

export interface ClienteMcp {
  nombre: string;
  redirectUris: string[];
}

interface SolicitudFirmada {
  cid: string;
  ru: string;
  cc: string;
  st?: string;
  nom: string;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const b64url = (b: Buffer) => b.toString('base64url');

function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** ¿Es una dirección de retorno aceptable para un cliente que se registra? */
export function retornoPermitido(uri: string, extras: string[] = []): boolean {
  if (RETORNOS_DE_CLAUDE.includes(uri) || extras.includes(uri)) return true;
  try {
    const u = new URL(uri);
    return u.protocol === 'http:' && LOOPBACK.has(u.hostname) && !u.hash && !u.username && !u.password;
  } catch {
    return false;
  }
}

@Injectable()
export class McpOauthService {
  private readonly logger = new Logger(McpOauthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ── Direcciones y claves ────────────────────────────────────────────────────────────────────────────────────

  get base(): string {
    return (this.config.get<string>('MCP_PUBLIC_URL') ?? 'https://api.orbita.site').replace(/\/$/, '');
  }
  get urlMcp(): string {
    return `${this.base}/api/v1/mcp`;
  }
  get urlMetadataRecurso(): string {
    return `${this.base}/.well-known/oauth-protected-resource/api/v1/mcp`;
  }
  private get urlConsentimiento(): string {
    return this.config.get<string>('MCP_CONSENT_URL') ?? 'https://orbita.site/superadmin/conectar-claude';
  }
  get dominiosPermitidos(): string[] {
    return dominiosDelEquipo(this.config);
  }
  private get retornosExtra(): string[] {
    return (this.config.get<string>('MCP_RETORNOS_EXTRA') ?? '').split(',').map((d) => d.trim()).filter(Boolean);
  }
  private clave(uso: 'cliente' | 'solicitud' | 'acceso'): Buffer {
    const secreto = this.config.getOrThrow<string>('JWT_SECRET');
    return createHmac('sha256', secreto).update(`orbita-mcp-prospeccion-v1:${uso}`).digest();
  }

  // ── Metadata de descubrimiento (RFC 9728 y RFC 8414) ───────────────────────────────────────────────────────

  metadataRecurso() {
    return {
      resource: this.urlMcp,
      authorization_servers: [this.base],
      bearer_methods_supported: ['header'],
      scopes_supported: [PERMISO_MCP],
      resource_name: 'Órbita — Marketing',
    };
  }

  metadataServidor() {
    return {
      issuer: this.base,
      authorization_endpoint: `${this.base}/api/v1/mcp/oauth/authorize`,
      token_endpoint: `${this.base}/api/v1/mcp/oauth/token`,
      registration_endpoint: `${this.base}/api/v1/mcp/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: [PERMISO_MCP],
    };
  }

  // ── Registro dinámico de clientes (RFC 7591) ───────────────────────────────────────────────────────────────

  registrarCliente(body: Record<string, unknown>) {
    const uris = body.redirect_uris;
    if (!Array.isArray(uris) || !uris.length || uris.length > MAX_URIS_POR_CLIENTE || !uris.every((u) => typeof u === 'string')) {
      throw new OAuthError('invalid_redirect_uri', 'redirect_uris tiene que ser una lista de 1 a 5 direcciones');
    }
    const malas = (uris as string[]).filter((u) => !retornoPermitido(u, this.retornosExtra));
    if (malas.length) throw new OAuthError('invalid_redirect_uri', `Dirección de retorno no permitida: ${malas[0].slice(0, 120)}`);
    const nombre = typeof body.client_name === 'string' && body.client_name.trim() ? body.client_name.trim().slice(0, 60) : 'Claude';
    const clientId = jwt.sign({ ru: uris, n: nombre }, this.clave('cliente'), { algorithm: 'HS256', jwtid: randomUUID() });
    return {
      client_id: clientId,
      client_name: nombre,
      redirect_uris: uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
  }

  /** Lee el client_id firmado. Si no es de acá (o fue alterado), invalid_client: Claude se vuelve a registrar. */
  clienteDe(clientId: string | undefined): ClienteMcp {
    if (!clientId) throw new OAuthError('invalid_client', 'Falta client_id', 401);
    try {
      const p = jwt.verify(clientId, this.clave('cliente'), { algorithms: ['HS256'] }) as { ru: string[]; n: string };
      return { nombre: p.n, redirectUris: p.ru };
    } catch {
      throw new OAuthError('invalid_client', 'Cliente desconocido: hay que registrarlo de nuevo', 401);
    }
  }

  // ── Autorización ───────────────────────────────────────────────────────────────────────────────────────────

  /** Valida el pedido de Claude y devuelve a dónde mandar al usuario: la página de consentimiento del panel. */
  iniciarAutorizacion(q: Record<string, string | undefined>): string {
    const cliente = this.clienteDe(q.client_id);
    if (!q.redirect_uri || !cliente.redirectUris.includes(q.redirect_uri)) {
      throw new OAuthError('invalid_request', 'La dirección de retorno no coincide con la del cliente registrado');
    }
    const redirigir = (codigo: string, mensaje: string) => new OAuthError(codigo, mensaje, 400, true);
    if (q.response_type !== 'code') throw redirigir('unsupported_response_type', 'Solo se soporta response_type=code');
    if (!q.code_challenge || !/^[A-Za-z0-9_-]{43,128}$/.test(q.code_challenge) || q.code_challenge_method !== 'S256') {
      throw redirigir('invalid_request', 'Hace falta PKCE con code_challenge_method=S256');
    }
    if (q.resource && q.resource.replace(/\/$/, '') !== this.urlMcp) throw redirigir('invalid_target', 'El recurso pedido no es este conector');
    const solicitud: SolicitudFirmada = { cid: q.client_id!, ru: q.redirect_uri, cc: q.code_challenge, st: q.state, nom: cliente.nombre };
    const req = jwt.sign(solicitud, this.clave('solicitud'), { algorithm: 'HS256', expiresIn: SOLICITUD_TTL });
    return `${this.urlConsentimiento}?req=${encodeURIComponent(req)}`;
  }

  private leerSolicitud(req: string): SolicitudFirmada {
    try {
      return jwt.verify(req, this.clave('solicitud'), { algorithms: ['HS256'] }) as SolicitudFirmada;
    } catch {
      throw new OAuthError('invalid_request', 'La solicitud venció o no es válida: volvé a conectar desde Claude');
    }
  }

  /** Lo que muestra la página de consentimiento antes de que la persona decida. */
  detalleSolicitud(req: string) {
    const s = this.leerSolicitud(req);
    let host = '';
    try {
      host = new URL(s.ru).host;
    } catch {
      /* el host solo se muestra */
    }
    return { cliente: s.nom, retorno: host, permisos: PERMISOS_MOSTRADOS, dominios: this.dominiosPermitidos };
  }

  /** Un superadmin o alguien de marketing, activo y con correo de la organización. Si no, no hay acceso. */
  async adminAutorizado(adminId: string): Promise<{ id: string; email: string }> {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { id: adminId }, select: { id: true, email: true, role: true, isActive: true } });
    if (!admin || !admin.isActive) throw new AccesoDenegadoError('La cuenta de superadmin no está activa');
    if (admin.role !== 'SUPERADMIN' && admin.role !== 'MARKETING') throw new AccesoDenegadoError('Solo un superadmin o el equipo de marketing pueden conectar Claude a la Prospección');
    const dominio = admin.email.toLowerCase().split('@').pop() ?? '';
    if (!this.dominiosPermitidos.includes(dominio)) {
      throw new AccesoDenegadoError(`El correo tiene que ser de la organización (${this.dominiosPermitidos.map((d) => '@' + d).join(' o ')})`);
    }
    return { id: admin.id, email: admin.email };
  }

  /** La persona aprobó o canceló en el panel: devuelve la dirección a la que volver a Claude. */
  async resolverSolicitud(adminId: string, req: string, decision: 'aprobar' | 'cancelar'): Promise<{ redirect: string }> {
    const s = this.leerSolicitud(req);
    const volver = (params: Record<string, string>) => {
      const u = new URL(s.ru);
      for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
      if (s.st) u.searchParams.set('state', s.st);
      return { redirect: u.toString() };
    };
    if (decision === 'cancelar') return volver({ error: 'access_denied', error_description: 'La persona canceló la conexión' });
    const admin = await this.adminAutorizado(adminId);
    const codigo = b64url(randomBytes(32));
    await this.prisma.marketingMcpCodigo.create({
      data: { codigoHash: sha256(codigo), adminId: admin.id, clientId: s.cid, redirectUri: s.ru, codeChallenge: s.cc, expiraAt: new Date(Date.now() + CODIGO_TTL_MS) },
    });
    await this.registrar(admin.id, 'mcp_autorizar', s.nom, { retorno: new URL(s.ru).host });
    return volver({ code: codigo });
  }

  // ── Tokens ─────────────────────────────────────────────────────────────────────────────────────────────────

  async token(p: Record<string, string | undefined>) {
    const cliente = this.clienteDe(p.client_id);
    void cliente;
    let respuesta;
    if (p.grant_type === 'authorization_code') respuesta = await this.canjearCodigo(p);
    else if (p.grant_type === 'refresh_token') respuesta = await this.renovar(p);
    else throw new OAuthError('unsupported_grant_type', 'grant_type no soportado');
    void this.limpiar();
    return respuesta;
  }

  private async canjearCodigo(p: Record<string, string | undefined>) {
    if (!p.code || !p.code_verifier || !p.redirect_uri) throw new OAuthError('invalid_request', 'Faltan code, code_verifier o redirect_uri');
    const fila = await this.prisma.marketingMcpCodigo.findUnique({ where: { codigoHash: sha256(p.code) } });
    if (!fila || fila.usadoAt || fila.expiraAt < new Date()) throw new OAuthError('invalid_grant', 'El código no es válido, venció o ya se usó');
    if (fila.clientId !== p.client_id || fila.redirectUri !== p.redirect_uri) throw new OAuthError('invalid_grant', 'El código no corresponde a este cliente');
    const esperado = b64url(createHash('sha256').update(p.code_verifier).digest());
    if (!iguales(esperado, fila.codeChallenge)) throw new OAuthError('invalid_grant', 'El code_verifier no coincide (PKCE)');
    // Se consume ANTES de emitir nada: dos canjes a la vez no pueden salir los dos.
    const consumido = await this.prisma.marketingMcpCodigo.updateMany({ where: { id: fila.id, usadoAt: null }, data: { usadoAt: new Date() } });
    if (consumido.count !== 1) throw new OAuthError('invalid_grant', 'El código ya se usó');
    const admin = await this.adminDeToken(fila.adminId);
    return this.emitir(admin.id, fila.clientId, randomUUID());
  }

  private async renovar(p: Record<string, string | undefined>) {
    if (!p.refresh_token) throw new OAuthError('invalid_request', 'Falta refresh_token');
    const fila = await this.prisma.marketingMcpRefresh.findUnique({ where: { tokenHash: sha256(p.refresh_token) } });
    if (!fila || fila.clientId !== p.client_id) throw new OAuthError('invalid_grant', 'El token de renovación no es válido');
    if (fila.revocadoAt) {
      // Ya se había rotado: si vuelve a aparecer, alguien lo copió. Se corta toda la autorización.
      await this.prisma.marketingMcpRefresh.updateMany({ where: { familiaId: fila.familiaId, revocadoAt: null }, data: { revocadoAt: new Date() } });
      this.logger.warn(`Token de renovación reusado: se revocó la familia ${fila.familiaId}`);
      throw new OAuthError('invalid_grant', 'El token de renovación ya se usó: hay que volver a conectar');
    }
    if (fila.expiraAt < new Date()) throw new OAuthError('invalid_grant', 'El token de renovación venció: hay que volver a conectar');
    const rotado = await this.prisma.marketingMcpRefresh.updateMany({ where: { id: fila.id, revocadoAt: null }, data: { revocadoAt: new Date() } });
    if (rotado.count !== 1) throw new OAuthError('invalid_grant', 'El token de renovación ya se usó');
    const admin = await this.adminDeToken(fila.adminId);
    return this.emitir(admin.id, fila.clientId, fila.familiaId);
  }

  private async adminDeToken(adminId: string) {
    try {
      return await this.adminAutorizado(adminId);
    } catch (e) {
      throw new OAuthError('invalid_grant', e instanceof Error ? e.message : 'Sin acceso');
    }
  }

  private async emitir(adminId: string, clientId: string, familiaId: string) {
    const acceso = jwt.sign({ scope: PERMISO_MCP }, this.clave('acceso'), {
      algorithm: 'HS256', subject: adminId, audience: this.urlMcp, issuer: this.base, expiresIn: ACCESO_TTL_S,
    });
    const refresh = b64url(randomBytes(32));
    await this.prisma.marketingMcpRefresh.create({
      data: { tokenHash: sha256(refresh), familiaId, adminId, clientId, expiraAt: new Date(Date.now() + REFRESH_TTL_MS) },
    });
    return { access_token: acceso, token_type: 'Bearer', expires_in: ACCESO_TTL_S, refresh_token: refresh, scope: PERMISO_MCP };
  }

  /** Para cada consulta del conector: el token es nuestro, no venció y sigue siendo de un superadmin de la organización. */
  async verificarAcceso(token: string): Promise<{ adminId: string; email: string }> {
    let sub: string | undefined;
    try {
      const p = jwt.verify(token, this.clave('acceso'), { algorithms: ['HS256'], audience: this.urlMcp, issuer: this.base }) as jwt.JwtPayload;
      sub = p.sub;
    } catch {
      throw new OAuthError('invalid_token', 'Token inválido o vencido', 401);
    }
    if (!sub) throw new OAuthError('invalid_token', 'Token inválido', 401);
    const admin = await this.adminAutorizado(sub); // AccesoDenegadoError → 403
    return { adminId: admin.id, email: admin.email };
  }

  /** ¿Tiene esta persona algún Claude conectado ahora (un token de renovación vigente)? */
  async estaConectado(adminId: string): Promise<boolean> {
    const n = await this.prisma.marketingMcpRefresh.count({ where: { adminId, revocadoAt: null, expiraAt: { gt: new Date() } } });
    return n > 0;
  }

  /** Desconecta todos los Claude de un superadmin (o de todos, si no se pasa adminId). */
  async revocarTodo(adminId?: string) {
    const r = await this.prisma.marketingMcpRefresh.updateMany({ where: { revocadoAt: null, ...(adminId ? { adminId } : {}) }, data: { revocadoAt: new Date() } });
    return { revocados: r.count };
  }

  private async limpiar() {
    try {
      const hace1d = new Date(Date.now() - 86_400_000);
      const hace7d = new Date(Date.now() - 7 * 86_400_000);
      await this.prisma.marketingMcpCodigo.deleteMany({ where: { expiraAt: { lt: hace1d } } });
      await this.prisma.marketingMcpRefresh.deleteMany({ where: { OR: [{ expiraAt: { lt: hace7d } }, { revocadoAt: { lt: hace7d } }] } });
    } catch (e) {
      this.logger.warn(`No se pudo limpiar: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private async registrar(adminId: string, action: string, targetId: string, details: Record<string, unknown>) {
    try {
      await this.prisma.platformAdminLog.create({ data: { adminId, action, targetType: 'mcp', targetId, details: details as Prisma.InputJsonValue } });
    } catch (e) {
      this.logger.warn(`No se pudo registrar ${action}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
