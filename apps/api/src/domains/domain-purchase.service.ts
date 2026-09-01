import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookSignatureValidator, InvalidWebhookSignatureError } from 'mercadopago';
import { PrismaService } from '../prisma/prisma.service';
import { VercelDomainsService } from './vercel-domains.service';
import { MercadopagoService } from '../mercadopago/mercadopago.service';
import { QuoteDomainPurchaseDto } from './dto/quote-domain-purchase.dto';
import { CheckoutDomainPurchaseDto } from './dto/checkout-domain-purchase.dto';

// Compra real de un dominio nuevo (.com, .store, etc.) vía la API de
// registrador de Vercel — reemplaza la idea original de tercerizar a
// OpenSRS/ResellerClub (nunca se dio de alta ninguna cuenta ahí): Vercel YA
// es un registrador real, con la MISMA cuenta/token que se usa para
// vincular dominios propios (LINKED, ver vercel-domains.service.ts).
//
// Vercel le cobra a la tarjeta de LA CUENTA DE ORBITACORP, no al dueño del
// negocio (no tiene cuenta en Vercel) — así que acá se cobra primero, con
// margen, vía Mercado Pago con el token de PLATAFORMA (MP_ACCESS_TOKEN, el
// mismo que usa subscriptions.service.ts para la suscripción mensual — NO
// el OAuth por-negocio que usa el checkout del storefront, esa plata nunca
// pasa por Órbita) y recién cuando ese pago se confirma (webhook) se llama
// a Vercel para comprar de verdad.
//
// DomainPurchaseOrder es un modelo APARTE de CustomDomain a propósito: un
// pedido pasa por estados (pago pendiente, pago aprobado pero Vercel
// todavía procesando) que no tienen sentido en un dominio ya activo —
// CustomDomain solo se crea cuando la compra en Vercel termina bien.
@Injectable()
export class DomainPurchaseService {
  private readonly logger = new Logger(DomainPurchaseService.name);

  // Margen de Órbita sobre el precio real de Vercel.
  private static readonly DOMAIN_MARKUP = 1.35;
  // Comisión de Mercado Pago (Checkout Pro, "al instante" — la tasa más
  // alta de las 4 disponibles, se usa esa porque Órbita necesita la plata
  // ya para poder pagarle a Vercel, no puede esperar 10-35 días). OJO: la
  // tabla que confirmó el dueño dice "no incluye IVA ni retenciones" — el %
  // real termina siendo más alto, falta que contable lo confirme antes de
  // producción.
  private static readonly MP_FEE_INSTANT = 0.0629;
  private static readonly DOLAR_CACHE_MS = 60 * 60 * 1000; // 1 hora

  private dolarCache: { venta: number; at: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly vercelDomains: VercelDomainsService,
    private readonly mercadopago: MercadopagoService,
  ) {}

  // ── Tipo de cambio ────────────────────────────────────────────────────
  // dolarapi.com — pública, gratis, sin auth (confirmada funcionando antes
  // de escribir esto). Cacheada en memoria: no hace falta pegarle en cada
  // cotización que teclea el dueño. `USD_ARS_RATE_FALLBACK` (env var, a
  // cargar a mano con el dólar del día) cubre si la API de terceros está
  // caída — sin ninguna de las dos, no se puede cotizar (no se inventa un
  // número).
  private async getDolarVenta(): Promise<number> {
    if (this.dolarCache && Date.now() - this.dolarCache.at < DomainPurchaseService.DOLAR_CACHE_MS) {
      return this.dolarCache.venta;
    }
    try {
      const res = await fetch('https://dolarapi.com/v1/dolares/oficial');
      const data = await res.json();
      const venta = Number(data?.venta);
      if (!venta || Number.isNaN(venta)) throw new Error('respuesta sin `venta` numérico');
      this.dolarCache = { venta, at: Date.now() };
      return venta;
    } catch (e) {
      this.logger.warn(`No se pudo obtener el dólar de dolarapi.com: ${e instanceof Error ? e.message : e}`);
      const fallback = this.config.get<string>('USD_ARS_RATE_FALLBACK');
      const fallbackNum = fallback ? Number(fallback) : NaN;
      if (!fallbackNum || Number.isNaN(fallbackNum)) {
        throw new BadRequestException('No se pudo obtener el tipo de cambio para cotizar el dominio — probá de nuevo en un momento');
      }
      return fallbackNum;
    }
  }

  // precioConMargen = lo que Órbita quiere QUEDARSE neto. precioACobrar se
  // "engorda" para que, después de que MP se cobre su comisión, lo que
  // efectivamente llega siga siendo precioConMargen — no alcanza con sumar
  // el % de la comisión sin más (eso subcobraría).
  private priceToCharge(priceVercelUsd: number, dolarVenta: number): number {
    const baseArs = priceVercelUsd * dolarVenta;
    const conMargen = baseArs * DomainPurchaseService.DOMAIN_MARKUP;
    const aCobrar = conMargen / (1 - DomainPurchaseService.MP_FEE_INSTANT);
    return Math.round(aCobrar * 100) / 100;
  }

  private webhookUrl(orderId: string): string {
    const redirectUri = this.config.getOrThrow<string>('MERCADOPAGO_REDIRECT_URI');
    const base = redirectUri.replace('/mercadopago/oauth/callback', '/webhooks/mercadopago/domain-purchase');
    return `${base}?orderId=${orderId}`;
  }

  // ── Cotización — read-only, no cobra ni compra nada ──────────────────
  async quote(dto: QuoteDomainPurchaseDto) {
    const domain = dto.domain.trim().toLowerCase();
    const years = dto.years ?? 1;
    const [available, dolarVenta] = await Promise.all([
      this.vercelDomains.checkAvailability(domain),
      this.getDolarVenta(),
    ]);
    if (!available) return { domain, available: false, priceVercel: null, priceCharged: null };

    const priceVercel = await this.vercelDomains.getPrice(domain, years);
    return { domain, available: true, priceVercel, priceCharged: this.priceToCharge(priceVercel, dolarVenta) };
  }

  // ── Arranca el pago — crea el pedido PENDING_PAYMENT + la preferencia de MP ──
  async startCheckout(businessId: string, dto: CheckoutDomainPurchaseDto) {
    const domain = dto.domain.trim().toLowerCase();
    // Re-chequea disponibilidad Y precio EN ESTE MOMENTO — no confía en lo
    // que haya cotizado el frontend hace rato (pudo cambiar, o alguien más
    // agarrar el dominio mientras tanto).
    const [available, dolarVenta] = await Promise.all([
      this.vercelDomains.checkAvailability(domain),
      this.getDolarVenta(),
    ]);
    if (!available) throw new BadRequestException('Ese dominio ya no está disponible');
    const priceVercel = await this.vercelDomains.getPrice(domain, 1);
    const priceCharged = this.priceToCharge(priceVercel, dolarVenta);

    const order = await this.prisma.domainPurchaseOrder.create({
      data: {
        businessId, domain, years: 1,
        priceVercel, priceCharged,
        contactFirstName: dto.contact.firstName,
        contactLastName: dto.contact.lastName,
        contactEmail: dto.contact.email,
        contactPhone: dto.contact.phone,
        contactAddress1: dto.contact.address1,
        contactCity: dto.contact.city,
        contactState: dto.contact.state,
        contactZip: dto.contact.zip,
        contactCountry: dto.contact.country,
      },
    });

    // `dto.returnUrl` es la pantalla de Dominios sin más — el orderId recién
    // existe acá (se acaba de crear arriba), así que se agrega EN EL
    // BACKEND antes de mandarlo a MP; el frontend no lo conoce todavía en
    // el momento de armar el request.
    const backUrl = `${dto.returnUrl}${dto.returnUrl.includes('?') ? '&' : '?'}domainOrder=${order.id}`;
    const { mpPreferenceId, initPoint } = await this.mercadopago.createPlatformPreference(
      [{ id: order.id, title: `Dominio ${domain} (1 año)`, quantity: 1, unit_price: priceCharged }],
      order.id,
      this.webhookUrl(order.id),
      backUrl,
    );
    await this.prisma.domainPurchaseOrder.update({ where: { id: order.id }, data: { mpPreferenceId } });
    return { orderId: order.id, initPoint };
  }

  // ── Estado del pedido — para que el panel sondee después de volver de MP ──
  async getOrderForBusiness(businessId: string, orderId: string) {
    const order = await this.prisma.domainPurchaseOrder.findFirst({ where: { id: orderId, businessId } });
    if (!order) throw new NotFoundException('Pedido de dominio no encontrado');
    return order;
  }

  // ── Webhook: MP confirma el pago → recién ACÁ se compra de verdad ────
  async handleWebhookRequest(
    body: Record<string, unknown>,
    headers: Record<string, string | string[] | undefined>,
    query: Record<string, string | string[] | undefined>,
  ): Promise<{ received: true }> {
    const topic = this.firstValue(query.topic) ?? this.firstValue(query.type) ?? (body?.type as string | undefined);
    if (topic && topic !== 'payment') return { received: true };

    // Misma validación de firma (HMAC) que mercadopago.service.ts —
    // MP_WEBHOOK_SECRET es un secreto de la app completa, no por
    // integración, así que sirve igual acá. Sin `toleranceSeconds` a
    // propósito: mismo bug real del SDK oficial ya documentado (compara
    // segundos contra milisegundos sin convertir) — nunca se confía en el
    // contenido del webhook igual, siempre se vuelve a preguntar a MP.
    const secret = this.config.get<string>('MP_WEBHOOK_SECRET');
    if (secret) {
      try {
        WebhookSignatureValidator.validate({
          xSignature: headers['x-signature'],
          xRequestId: headers['x-request-id'],
          dataId: query['data.id'] ?? (body?.data as { id?: string } | undefined)?.id,
          secret,
        });
      } catch (err) {
        if (err instanceof InvalidWebhookSignatureError) {
          this.logger.warn(`Webhook de compra de dominio con firma inválida (${err.reason}) — se ignora.`);
          return { received: true };
        }
        throw err;
      }
    }

    const data = body?.data as { id?: string } | undefined;
    const mpPaymentId = data?.id ?? (body?.id as string | undefined);
    const orderId = typeof query.orderId === 'string' ? query.orderId : undefined;

    try {
      await this.handlePaymentConfirmed(orderId, mpPaymentId);
    } catch (err) {
      this.logger.error(`Webhook de compra de dominio (pedido ${orderId}, pago ${mpPaymentId}) falló`, err as Error);
    }
    return { received: true };
  }

  private firstValue(v: string | string[] | undefined): string | undefined {
    return Array.isArray(v) ? v[0] : v;
  }

  // ── El corazón del flujo: pago confirmado → comprar en Vercel → vincular ──
  async handlePaymentConfirmed(orderId: string | undefined, mpPaymentId: string | undefined): Promise<void> {
    if (!orderId || !mpPaymentId) {
      this.logger.warn('Webhook de compra de dominio sin orderId o payment id — se ignora');
      return;
    }
    const order = await this.prisma.domainPurchaseOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      this.logger.warn(`Webhook de compra de dominio: pedido ${orderId} no encontrado`);
      return;
    }
    // Idempotencia — mismo criterio que mercadopago.service.ts: si MP
    // reintenta la notificación, no se reprocesa un pedido que ya terminó.
    if (order.status !== 'PENDING_PAYMENT') return;

    const pago = await this.mercadopago.getPlatformPayment(mpPaymentId);
    if (pago.external_reference != null && String(pago.external_reference) !== orderId) {
      this.logger.warn(`Pago ${mpPaymentId} no corresponde al pedido ${orderId} (external_reference: ${pago.external_reference}) — se ignora`);
      return;
    }
    if (pago.status !== 'approved') return; // sigue PENDING_PAYMENT — puede llegar otro webhook

    await this.prisma.domainPurchaseOrder.update({ where: { id: orderId }, data: { status: 'PAID', mpPaymentId } });

    try {
      const { orderId: vercelOrderId } = await this.vercelDomains.buyDomain(
        order.domain,
        order.years,
        {
          firstName: order.contactFirstName, lastName: order.contactLastName,
          email: order.contactEmail, phone: order.contactPhone,
          address1: order.contactAddress1, city: order.contactCity,
          state: order.contactState, zip: order.contactZip, country: order.contactCountry,
        },
        Number(order.priceVercel),
        false, // autoRenew — ver plan: sin mecanismo de recobro todavía, se deja apagado a propósito
      );

      // Un dominio comprado en Vercel ya es de su propia infraestructura —
      // se vincula solo, a diferencia de LINKED (que necesita que el dueño
      // cargue DNS a mano en otro lado).
      await this.vercelDomains.addDomain(order.domain);
      const customDomain = await this.prisma.customDomain.create({
        data: {
          businessId: order.businessId,
          domain: order.domain,
          source: 'PURCHASED',
          registrar: 'vercel',
          status: 'PENDING', // se confirma ACTIVE con el mismo verifyDns() de siempre
          purchasedAt: new Date(),
          expiresAt: new Date(Date.now() + order.years * 365 * 24 * 60 * 60 * 1000),
          autoRenew: false,
        },
      });

      await this.prisma.domainPurchaseOrder.update({
        where: { id: orderId },
        data: { status: 'COMPLETED', vercelOrderId, customDomainId: customDomain.id },
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Error desconocido comprando el dominio en Vercel';
      this.logger.error(`Compra de dominio ${order.domain} (pedido ${orderId}) falló después de cobrar — reembolsando`, err as Error);
      try {
        await this.mercadopago.refundPlatformPayment(mpPaymentId);
      } catch (refundErr) {
        // No debería pasar nunca (el pago se acaba de confirmar aprobado),
        // pero si el reembolso automático falla, queda bien logueado para
        // resolverlo a mano — no se pierde el dinero sin dejar rastro.
        this.logger.error(`REEMBOLSO FALLIDO para el pedido ${orderId} (pago ${mpPaymentId}) — requiere atención manual`, refundErr as Error);
      }
      await this.prisma.domainPurchaseOrder.update({ where: { id: orderId }, data: { status: 'FAILED', failReason: reason } });
    }
  }
}
