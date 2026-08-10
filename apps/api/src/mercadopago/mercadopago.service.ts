import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, OAuth } from 'mercadopago';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

// OAuth por negocio para el checkout del storefront (Orders API) — "Conectar
// Mercado Pago" en Configuración → Métodos de pago. Cada comerciante autoriza
// a Órbita a operar CON SU PROPIA cuenta de MP: la plata de sus ventas entra
// directo a él, Órbita nunca la toca. Esto es DISTINTO del módulo
// `subscriptions/` (Órbita cobrándole el plan AL negocio) — nunca se mezclan,
// ver MODELO_DATOS_DEFINITIVO.md §10 y CONTRATO_API.md "Fase 6 — MercadoPago".
//
// `access_token`/`refresh_token` se guardan cifrados con pgcrypto
// (`pgp_sym_encrypt`, nativo de Supabase) usando MERCADOPAGO_TOKEN_KEY —
// nunca en texto plano, y nunca se cifran/descifran en el código de Node
// (evita tener la key Y el texto plano juntos en memoria de la app en algún
// punto intermedio; Postgres hace todo el trabajo criptográfico).
//
// Point (mp_stores/mp_pos/mp_devices — terminales físicas) está documentado
// en el modelo de datos pero es una integración de hardware bastante más
// grande y todavía no migrada: queda deliberadamente fuera de este alcance.

interface ConnectStatePayload {
  businessId: string;
  nonce: string;
  exp: number;
}

const STATE_TTL_MS = 10 * 60 * 1000; // tiempo de sobra para completar el consent en MP
const DEFAULT_EXPIRES_IN_SECONDS = 180 * 24 * 60 * 60; // 180 días — fallback si MP no manda expires_in
const REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000; // refresca si vence en menos de 24hs

type CredentialsRow = {
  mp_user_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: Date;
  scopes: string[];
  is_active: boolean;
};

@Injectable()
export class MercadopagoService {
  private readonly logger = new Logger(MercadopagoService.name);
  private readonly oauth: OAuth;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly stateSecret: string;
  private readonly tokenKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.clientId = this.config.getOrThrow<string>('MERCADOPAGO_CLIENT_ID');
    this.clientSecret = this.config.getOrThrow<string>('MERCADOPAGO_CLIENT_SECRET');
    this.redirectUri = this.config.getOrThrow<string>('MERCADOPAGO_REDIRECT_URI');
    this.tokenKey = this.config.getOrThrow<string>('MERCADOPAGO_TOKEN_KEY');
    // Reutiliza JWT_SECRET para firmar el `state` — mismo criterio que
    // GoogleAuthService, evita sumar otra env var solo para esto.
    this.stateSecret = this.config.getOrThrow<string>('JWT_SECRET');

    // El SDK exige un accessToken para construir el config aunque las
    // operaciones de OAuth (create/refresh/getAuthorizationURL) no lo usen
    // — viajan client_id/client_secret en el body de cada request. Reutiliza
    // el token de la propia app de la plataforma (MP_ACCESS_TOKEN, ya
    // cargado para las suscripciones) solo para satisfacer el constructor.
    // `.get()` y no `.getOrThrow()` a propósito: MP_ACCESS_TOKEN es del módulo
    // de suscripciones (independiente de este), que ya tolera no estar
    // configurado en un entorno (ver SubscriptionsService) — este módulo no
    // debería tirar abajo TODO el boot de la app por una env var ajena que
    // ni siquiera usa de verdad (el placeholder nunca viaja a MP en las
    // llamadas de OAuth).
    const platformConfig = new MercadoPagoConfig({ accessToken: this.config.get<string>('MP_ACCESS_TOKEN') ?? 'unused-placeholder' });
    this.oauth = new OAuth(platformConfig);
  }

  // ── state firmado (HMAC, no JWT — mismo patrón que google-auth.service.ts) ──
  private signState(businessId: string): string {
    const payload: ConnectStatePayload = { businessId, nonce: randomBytes(16).toString('hex'), exp: Date.now() + STATE_TTL_MS };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.stateSecret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  private verifyState(state: string | undefined): ConnectStatePayload {
    const [body, sig] = (state ?? '').split('.');
    if (!body || !sig) throw new BadRequestException('state inválido');

    const expectedSig = createHmac('sha256', this.stateSecret).update(body).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      throw new BadRequestException('state inválido');
    }

    let payload: ConnectStatePayload;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('state inválido');
    }
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) throw new BadRequestException('state expirado');
    return payload;
  }

  // ── Conectar (iniciar) ───────────────────────────────────────────────────
  getAuthorizationUrl(businessId: string): string {
    const state = this.signState(businessId);
    return this.oauth.getAuthorizationURL({
      options: { client_id: this.clientId, redirect_uri: this.redirectUri, state },
    });
  }

  // ── Callback: intercambia el code por tokens y los guarda cifrados ──────
  // Devuelve el `subdomain` (no solo el businessId) para que el controller
  // pueda armar el redirect de vuelta a /admin/{subdomain}/ventas/configuracion
  // sin que el frontend tenga que resolverlo por su cuenta.
  async handleCallback(code: string, state: string | undefined): Promise<{ businessId: string; subdomain: string }> {
    const { businessId } = this.verifyState(state);

    const business = await this.prisma.business.findUnique({ where: { id: businessId }, select: { subdomain: true } });
    if (!business) throw new BadRequestException('Negocio no encontrado');

    const tokens = await this.oauth.create({
      body: { client_id: this.clientId, client_secret: this.clientSecret, code, redirect_uri: this.redirectUri },
    });
    if (!tokens.access_token || !tokens.refresh_token || tokens.user_id === undefined) {
      throw new UnauthorizedException('Mercado Pago no devolvió los tokens esperados');
    }

    const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in ?? DEFAULT_EXPIRES_IN_SECONDS) * 1000);
    const scopes = tokens.scope ? tokens.scope.split(' ') : [];

    await this.upsertCredentials(businessId, {
      mpUserId: String(tokens.user_id),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt,
      scopes,
    });

    return { businessId, subdomain: business.subdomain };
  }

  // INSERT/UPDATE con cifrado del lado de Postgres (pgp_sym_encrypt) — el
  // texto plano solo existe en la query parametrizada, nunca se concatena
  // a mano (evita inyección SQL con valores que ya de por sí son sensibles).
  private async upsertCredentials(
    businessId: string,
    params: { mpUserId: string; accessToken: string; refreshToken: string; tokenExpiresAt: Date; scopes: string[] },
  ): Promise<void> {
    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO mp_credentials (id, business_id, mp_user_id, access_token, refresh_token, token_expires_at, scopes, is_active, created_at, updated_at)
      VALUES (
        ${id}, ${businessId}, ${params.mpUserId},
        encode(pgp_sym_encrypt(${params.accessToken}, ${this.tokenKey}), 'base64'),
        encode(pgp_sym_encrypt(${params.refreshToken}, ${this.tokenKey}), 'base64'),
        ${params.tokenExpiresAt}, ${params.scopes}, true, now(), now()
      )
      ON CONFLICT (business_id) DO UPDATE SET
        mp_user_id = EXCLUDED.mp_user_id,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expires_at = EXCLUDED.token_expires_at,
        scopes = EXCLUDED.scopes,
        is_active = true,
        updated_at = now()
    `;
  }

  // Lee y descifra — Postgres hace pgp_sym_decrypt, el texto plano solo
  // existe en la respuesta de la query, nunca queda guardado en ningún lado.
  private async getDecryptedCredentials(businessId: string): Promise<CredentialsRow | null> {
    const rows = await this.prisma.$queryRaw<CredentialsRow[]>`
      SELECT
        mp_user_id,
        pgp_sym_decrypt(decode(access_token, 'base64'), ${this.tokenKey}) as access_token,
        pgp_sym_decrypt(decode(refresh_token, 'base64'), ${this.tokenKey}) as refresh_token,
        token_expires_at, scopes, is_active
      FROM mp_credentials WHERE business_id = ${businessId}
    `;
    return rows[0] ?? null;
  }

  // ── Desconectar (soft — CONTRATO_API.md: isActive=false, no se borra) ───
  async disconnect(businessId: string): Promise<{ ok: boolean }> {
    await this.prisma.mpCredentials.updateMany({ where: { businessId }, data: { isActive: false } });
    return { ok: true };
  }

  // ── Estado de conexión (panel) ───────────────────────────────────────────
  async getStatus(businessId: string): Promise<{ connected: boolean; mpUserId: string | null; scopes: string[] }> {
    const cred = await this.prisma.mpCredentials.findUnique({
      where: { businessId },
      select: { mpUserId: true, scopes: true, isActive: true },
    });
    if (!cred || !cred.isActive) return { connected: false, mpUserId: null, scopes: [] };
    return { connected: true, mpUserId: cred.mpUserId, scopes: cred.scopes };
  }

  // ── Access token vigente (lo va a consumir el checkout en una fase
  // posterior, al crear la preferencia de pago) — refresca solo si está por
  // vencer, no en cada llamada. Si no hay cuenta conectada o el refresh
  // falla, null: el llamador decide cómo reaccionar (nunca ofrecer MP sin
  // esto resuelto, mismo criterio que ya usa el checkout hoy).
  async getValidAccessToken(businessId: string): Promise<string | null> {
    const cred = await this.getDecryptedCredentials(businessId);
    if (!cred || !cred.is_active) return null;

    const vencePronto = cred.token_expires_at.getTime() - Date.now() < REFRESH_MARGIN_MS;
    if (!vencePronto) return cred.access_token;

    try {
      const refreshed = await this.oauth.refresh({
        body: { client_id: this.clientId, client_secret: this.clientSecret, refresh_token: cred.refresh_token },
      });
      if (!refreshed.access_token || !refreshed.refresh_token) throw new Error('respuesta incompleta de MP');

      const tokenExpiresAt = new Date(Date.now() + (refreshed.expires_in ?? DEFAULT_EXPIRES_IN_SECONDS) * 1000);
      await this.upsertCredentials(businessId, {
        mpUserId: cred.mp_user_id,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        tokenExpiresAt,
        scopes: cred.scopes,
      });
      return refreshed.access_token;
    } catch (e) {
      this.logger.warn(`No se pudo refrescar el token de Mercado Pago del negocio ${businessId}: ${e}`);
      // El que hay todavía puede servir hasta que venza de verdad — no
      // cortar el servicio por un refresh que falló antes de tiempo.
      return cred.access_token;
    }
  }

  // ── Webhook de desautorización (el comercio revoca desde SU cuenta de MP) ──
  async handleOAuthWebhook(mpUserId: string | undefined): Promise<void> {
    if (!mpUserId) return;
    await this.prisma.mpCredentials.updateMany({ where: { mpUserId }, data: { isActive: false } });
  }
}
