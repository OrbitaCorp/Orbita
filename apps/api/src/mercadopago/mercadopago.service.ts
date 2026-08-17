import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MercadoPagoConfig, OAuth, User, Preference, Payment, WebhookSignatureValidator, InvalidWebhookSignatureError } from 'mercadopago';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';

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

type UpsertCredentialsParams = {
  mpUserId: string;
  mpUserName?: string | null;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  scopes: string[];
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
  private readonly frontendUrl: string;
  // Deriva la URL del webhook de pagos a partir de MERCADOPAGO_REDIRECT_URI
  // en vez de sumar una env var nueva solo para esto — mismo host, mismo
  // criterio de "reutilizar lo que ya está" que el resto del módulo.
  private readonly paymentsWebhookUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly orders: OrdersService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.clientId = this.config.getOrThrow<string>('MERCADOPAGO_CLIENT_ID');
    this.clientSecret = this.config.getOrThrow<string>('MERCADOPAGO_CLIENT_SECRET');
    this.redirectUri = this.config.getOrThrow<string>('MERCADOPAGO_REDIRECT_URI');
    this.tokenKey = this.config.getOrThrow<string>('MERCADOPAGO_TOKEN_KEY');
    this.frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
    this.paymentsWebhookUrl = this.redirectUri.replace('/mercadopago/oauth/callback', '/webhooks/mercadopago/payments');
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
    // Best-effort: el nombre no viene en la respuesta de OAuth, hay que pedirlo
    // aparte con el token recién obtenido. Si falla, se conecta igual sin
    // nombre — el panel cae al mpUserId, nunca bloquea la conexión por esto.
    const mpUserName = await this.fetchDisplayName(tokens.access_token);

    await this.upsertCredentials(businessId, {
      mpUserId: String(tokens.user_id),
      mpUserName,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt,
      scopes,
    });

    return { businessId, subdomain: business.subdomain };
  }

  // GET /users/me con el access_token DEL COMERCIO (no el de la plataforma) —
  // requiere su propio MercadoPagoConfig. Nunca tira: un nombre sin resolver
  // no es motivo para cortar el flujo de conexión ni el de status.
  private async fetchDisplayName(accessToken: string): Promise<string | null> {
    try {
      const user = new User(new MercadoPagoConfig({ accessToken })).get();
      const profile = await user;
      const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
      return fullName || profile.nickname || null;
    } catch (e) {
      this.logger.warn(`No se pudo resolver el nombre de la cuenta de Mercado Pago: ${e}`);
      return null;
    }
  }

  // INSERT/UPDATE con cifrado del lado de Postgres (pgp_sym_encrypt) — el
  // texto plano solo existe en la query parametrizada, nunca se concatena
  // a mano (evita inyección SQL con valores que ya de por sí son sensibles).
  // `mpUserName` usa COALESCE contra el valor ya guardado: si esta llamada no
  // trae nombre (ej. el refresh de getValidAccessToken, que nunca lo pide de
  // nuevo), no borra el que ya estaba.
  private async upsertCredentials(businessId: string, params: UpsertCredentialsParams): Promise<void> {
    const id = randomUUID();
    const mpUserName = params.mpUserName ?? null;
    await this.prisma.$executeRaw`
      INSERT INTO mp_credentials (id, business_id, mp_user_id, mp_user_name, access_token, refresh_token, token_expires_at, scopes, is_active, created_at, updated_at)
      VALUES (
        ${id}, ${businessId}, ${params.mpUserId}, ${mpUserName},
        encode(pgp_sym_encrypt(${params.accessToken}, ${this.tokenKey}), 'base64'),
        encode(pgp_sym_encrypt(${params.refreshToken}, ${this.tokenKey}), 'base64'),
        ${params.tokenExpiresAt}, ${params.scopes}, true, now(), now()
      )
      ON CONFLICT (business_id) DO UPDATE SET
        mp_user_id = EXCLUDED.mp_user_id,
        mp_user_name = COALESCE(EXCLUDED.mp_user_name, mp_credentials.mp_user_name),
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
  // `mpUserName` es un agregado por fuera de CONTRATO_API.md (que solo pedía
  // connected/mpUserId/scopes) para que el panel muestre un nombre en vez de
  // un ID pelado — aditivo, no rompe a nadie que ya lea el shape viejo.
  async getStatus(businessId: string): Promise<{ connected: boolean; mpUserId: string | null; mpUserName: string | null; scopes: string[] }> {
    const cred = await this.prisma.mpCredentials.findUnique({
      where: { businessId },
      select: { mpUserId: true, mpUserName: true, scopes: true, isActive: true },
    });
    if (!cred || !cred.isActive) return { connected: false, mpUserId: null, mpUserName: null, scopes: [] };

    let mpUserName = cred.mpUserName;
    if (!mpUserName) {
      // Backfill perezoso para cuentas conectadas antes de que existiera este
      // campo — best-effort, si falla se sigue mostrando el mpUserId.
      const accessToken = await this.getValidAccessToken(businessId);
      if (accessToken) {
        mpUserName = await this.fetchDisplayName(accessToken);
        if (mpUserName) await this.prisma.mpCredentials.update({ where: { businessId }, data: { mpUserName } });
      }
    }
    return { connected: true, mpUserId: cred.mpUserId, mpUserName, scopes: cred.scopes };
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

  // ── Checkout: crear la preferencia de pago de un pedido ─────────────────
  // Usa la Preference API (Checkout Pro) y no la Orders API v1 más nueva:
  // CONTRATO_API.md dice "Orders API" en el texto pero nombra el campo de
  // respuesta `initPoint` — eso es literalmente el nombre de campo de
  // Preference (`init_point`), no el de Orders v1 (`checkout_url`). Se
  // prioriza Preference por ser la superficie madura y bien documentada
  // para "redirigir al comprador a pagar" (el único required es `items`);
  // Orders v1 apunta más a checkout custom con tarjeta ya tokenizada del
  // lado del frontend, que no es lo que este checkout necesita. El nombre
  // de columna `mp_order_id` igual se usa (guarda el id de la preferencia):
  // cumple el mismo rol de "identificador de la transacción en MP" para
  // reconciliar el webhook, más allá de qué API de MP lo generó. Anotado en
  // Jira (decisión sin especificación 100% clara).
  // Resuelve a qué host/forma volver después de pagar: el header `Origin` de
  // la request que pidió la preferencia (no un campo del body — un browser lo
  // manda solo y una página no lo puede pisar con JS) dice el host REAL desde
  // el que se abrió el checkout. Antes esto siempre volvía a FRONTEND_URL fijo
  // (una sola URL de prod) — rompía en cualquier otro entorno (un preview de
  // Vercel volvía a prod en vez de al mismo preview) y siempre devolvía por la
  // forma de path (`/tienda/{slug}`) aunque se hubiera entrado por el
  // subdominio real de la tienda, un host totalmente distinto.
  //
  // Si el primer segmento del host del Origin coincide con el subdominio del
  // negocio, se abrió por esa forma — las rutas del storefront viven en la
  // raíz de ese host (ver storefrontBase() en apps/web/src/lib/tenant.ts), así
  // que se vuelve ahí directo. Cualquier otro Origin válido (preview de
  // Vercel, apex, localhost) se toma como la forma legacy de path, pero AL
  // MISMO host que mandó la request — nunca a uno fijo de otro entorno. Sin
  // Origin (llamada server-to-server) cae al comportamiento de siempre.
  private resolverBaseDeRetorno(subdomain: string, originHeader: string | undefined): string {
    if (originHeader) {
      try {
        const url = new URL(originHeader);
        const primerLabel = url.hostname.split('.')[0];
        return primerLabel === subdomain ? url.origin : `${url.origin}/tienda/${subdomain}`;
      } catch {
        // Origin ausente/inválido — cae al default de abajo.
      }
    }
    return `${this.frontendUrl}/tienda/${subdomain}`;
  }

  async createOrderPreference(
    businessId: string,
    orderId: string,
    originHeader?: string,
  ): Promise<{ mpOrderId: string; initPoint?: string }> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, businessId, deletedAt: null },
      include: {
        items: true,
        business: { select: { subdomain: true } },
        // Solo se usa para invitados (customerId null) — ver `volverA` abajo:
        // sin sesión, Confirmacion.tsx necesita el email en la URL de vuelta
        // para poder pedir el pedido por el endpoint público de tracking.
        onlineOrderDetails: { select: { buyerEmail: true } },
      },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.status !== 'PENDING') {
      throw new UnprocessableEntityException('Este pedido ya no está pendiente de pago');
    }

    const accessToken = await this.getValidAccessToken(businessId);
    if (!accessToken) {
      throw new UnprocessableEntityException('Este negocio no tiene Mercado Pago conectado');
    }

    const items = order.items
      .filter((it) => !it.isConcept)
      .map((it) => ({
        id: it.id,
        title: it.variantLabel ? `${it.productName} (${it.variantLabel})` : it.productName,
        quantity: it.quantity,
        unit_price: Number(it.unitPrice),
        currency_id: 'ARS',
      }));
    if (items.length === 0) {
      throw new UnprocessableEntityException('El pedido no tiene ítems facturables');
    }

    // Las tres vuelven a la misma pantalla: Confirmacion.tsx ya lee el
    // estado REAL del pedido (no confía en qué dice la URL de MP) y muestra
    // "pendiente" o "confirmado" según corresponda — no hace falta una
    // página de error separada, ni arriesgarse a crear un pedido duplicado
    // si el comprador reintenta desde ahí. Para un pedido de invitado
    // (customerId null) el email viaja en la URL: sin sesión, es lo que
    // Confirmacion.tsx necesita para pedir el pedido por el endpoint público
    // de tracking (ver storefront.controller.ts `tracking()`).
    const emailInvitado = order.customerId ? null : order.onlineOrderDetails?.buyerEmail;
    const baseRetorno = this.resolverBaseDeRetorno(order.business.subdomain, originHeader);
    const volverA = `${baseRetorno}/checkout/confirmacion?pedido=${order.id}${emailInvitado ? `&email=${encodeURIComponent(emailInvitado)}` : ''}`;

    const preference = new Preference(new MercadoPagoConfig({ accessToken }));
    const response = await preference.create({
      body: {
        items,
        external_reference: order.id,
        // El orderId propio viaja en la URL del webhook: así el handler no
        // necesita adivinar de qué negocio es el pago antes de tener un
        // access_token con el que preguntarle a MP (ver handlePaymentWebhook).
        notification_url: `${this.paymentsWebhookUrl}?orderId=${order.id}`,
        back_urls: { success: volverA, pending: volverA, failure: volverA },
        auto_return: 'approved',
      },
    });
    if (!response.id) throw new UnprocessableEntityException('Mercado Pago no devolvió una preferencia válida');

    // Reusa la fila PENDING de un intento anterior de pago con MP para este
    // mismo pedido (si el comprador abandonó y volvió a intentar) en vez de
    // acumular una fila nueva por cada click en "Conectar cuenta" — solo
    // queda una PENDING viva a la vez por pedido.
    const pendiente = await this.prisma.payment.findFirst({
      where: { orderId: order.id, method: 'MERCADOPAGO', status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    const data = {
      businessId, orderId: order.id, method: 'MERCADOPAGO' as const, status: 'PENDING' as const,
      amount: order.total, currency: 'ARS', channel: order.channel, mpOrderId: response.id,
    };
    if (pendiente) await this.prisma.payment.update({ where: { id: pendiente.id }, data: { mpOrderId: response.id } });
    else await this.prisma.payment.create({ data });

    return { mpOrderId: response.id, initPoint: response.init_point };
  }

  // Entrada real del endpoint HTTP: valida la firma HMAC (mismo validador y
  // mismo MP_WEBHOOK_SECRET que subscriptions.service.ts — es un secreto de
  // la app "Orbitasite" completa, no por integración) y saca el id del pago
  // y el orderId propio (viaja en la query del notification_url, ver
  // createOrderPreference) antes de delegar el trabajo real.
  async handlePaymentsWebhookRequest(
    body: Record<string, unknown>,
    headers: Record<string, string | string[] | undefined>,
    query: Record<string, string | string[] | undefined>,
  ): Promise<{ received: true }> {
    const secret = this.config.get<string>('MP_WEBHOOK_SECRET');
    if (secret) {
      try {
        WebhookSignatureValidator.validate({
          xSignature: headers['x-signature'],
          xRequestId: headers['x-request-id'],
          dataId: query['data.id'] ?? (body?.data as { id?: string } | undefined)?.id,
          secret,
          toleranceSeconds: 300,
        });
      } catch (err) {
        if (err instanceof InvalidWebhookSignatureError) {
          this.logger.warn(`Webhook de pagos con firma inválida (${err.reason}) — se ignora`);
          return { received: true }; // 200 igual: no dar pistas ni gatillar reintentos.
        }
        throw err;
      }
    }

    const data = body?.data as { id?: string } | undefined;
    const mpPaymentId = data?.id ?? (body?.id as string | undefined);
    const orderId = typeof query.orderId === 'string' ? query.orderId : undefined;

    try {
      await this.handlePaymentWebhook(orderId, mpPaymentId);
    } catch (err) {
      // Nunca error a MP: si respondemos != 2xx reintenta en loop. Queda
      // logueado para revisar a mano (mismo criterio que subscriptions).
      this.logger.error(`Webhook de pago ${mpPaymentId} (pedido ${orderId}) falló`, err as Error);
    }
    return { received: true };
  }

  // ── Webhook de pagos: MP avisa, nosotros confirmamos contra su propia API ──
  // `orderId` viaja en la query del notification_url (ver createOrderPreference)
  // — así se sabe de qué negocio es ANTES de necesitar pedirle nada a MP, y
  // se puede usar el access_token correcto (el del comercio, no el de la
  // plataforma: el pago vive en SU cuenta).
  async handlePaymentWebhook(orderId: string | undefined, mpPaymentId: string | undefined): Promise<void> {
    if (!orderId || !mpPaymentId) {
      this.logger.warn('Webhook de pagos de Mercado Pago sin orderId o payment id — se ignora');
      return;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, businessId: true, status: true, total: true, channel: true, orderNumber: true },
    });
    if (!order) {
      this.logger.warn(`Webhook de pago ${mpPaymentId}: pedido ${orderId} no encontrado`);
      return;
    }

    // Idempotencia: si MP reenvía la misma notificación (reintentan si no
    // responden 2xx a tiempo), no se reprocesa un pago ya aprobado.
    const yaAprobado = await this.prisma.payment.findFirst({
      where: { orderId, mpPaymentId, status: 'APPROVED' },
    });
    if (yaAprobado) return;

    const accessToken = await this.getValidAccessToken(order.businessId);
    if (!accessToken) {
      this.logger.warn(`Webhook de pago ${mpPaymentId}: negocio ${order.businessId} sin token válido de MP`);
      return;
    }

    // Nunca se confía en el contenido del webhook como fuente de verdad —
    // mismo criterio que subscriptions.service.ts: se vuelve a preguntar a
    // MP el estado real del pago.
    const pago = await new Payment(new MercadoPagoConfig({ accessToken })).get({ id: mpPaymentId });
    const aprobado = pago.status === 'approved';

    const pendiente = await this.prisma.payment.findFirst({
      where: { orderId, method: 'MERCADOPAGO', status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    const cambios = {
      status: (aprobado ? 'APPROVED' : 'REJECTED') as 'APPROVED' | 'REJECTED',
      mpPaymentId, mpStatus: pago.status ?? null, mpStatusDetail: pago.status_detail ?? null,
      paidAt: aprobado ? new Date() : null,
    };
    if (pendiente) {
      await this.prisma.payment.update({ where: { id: pendiente.id }, data: cambios });
    } else {
      // No debería faltar (se crea en createOrderPreference), pero si por
      // algo no está la fila, igual queda registro del pago.
      await this.prisma.payment.create({
        data: { businessId: order.businessId, orderId, method: 'MERCADOPAGO', channel: order.channel, amount: order.total, currency: 'ARS', ...cambios },
      });
    }

    if (aprobado && order.status === 'PENDING') {
      // `updateStatus` ya descuenta el stock (mismo mecanismo que usa el
      // panel al confirmar efectivo/transferencia a mano) — acá lo dispara
      // el webhook, sin un miembro humano de por medio.
      await this.orders.updateStatus(order.businessId, null, order.id, 'CONFIRMED');
      this.eventEmitter.emit('notification.pago_confirmado', {
        businessId: order.businessId,
        orderNumber: order.orderNumber,
        orderId: order.id,
        total: Number(order.total),
      });
    }
  }
}
