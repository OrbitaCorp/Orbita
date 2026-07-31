import { readFileSync } from 'fs';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as Handlebars from 'handlebars';
import { EmailSendStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Referencias opcionales para el registro de envíos: a qué negocio pertenece
// el mail y a qué cliente/miembro le llegó. Todo opcional para que los flujos
// que no tienen el dato a mano (o donde no aplica, como los avisos de
// plataforma) puedan mandar igual — el envío nunca se bloquea por metadata.
export type MailMeta = {
  businessId?: string;
  customerId?: string;
  memberId?: string;
};

type Branding = {
  storeName: string;
  logoUrl: string | null;
  colorPrimary: string;
  colorBackground: string;
};

// Partial de Handlebars para el botón de acción — mismo look (píldora con
// sombra en el color de marca) en todas las plantillas que lo usan. Se
// registra una sola vez, en el constructor. Espera `url` y `label` (pasados
// por hash) más `colorPrimary`/`colorPrimaryGlow` heredados del contexto de
// quien lo invoca — por eso SIEMPRE se usa como
// `{{> cta-button this url=... label="..."}}`, nunca sin el `this` inicial
// (sin eso, el partial pierde el contexto de la plantilla y esas dos
// variables quedarían undefined).
const CTA_BUTTON_PARTIAL = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr><td style="background:{{colorPrimary}}; border-radius:9999px; box-shadow:0 10px 22px {{colorPrimaryGlow}};">
        <a href="{{url}}" style="display:inline-block; padding:14px 32px; color:#ffffff; font-size:14px; font-weight:700; text-decoration:none;">{{label}}</a>
      </td></tr>
    </table>
  </td></tr>
</table>`;

// Envío por Resend (API, no SMTP). Las plantillas siguen siendo los mismos
// .hbs de antes — nest-cli.json las copia a dist/mail/templates en el build
// (ver "assets" en ese archivo) — pero ahora se compilan a mano con
// `handlebars` en vez de depender del adapter de @nestjs-modules/mailer, que
// se sacó junto con nodemailer al migrar de SMTP a Resend.
//
// Cada envío queda registrado en email_logs (SENT / FAILED / SIMULATED) para
// trazabilidad propia y la pestaña Actividad del cliente. El registro es
// best-effort: si falla el INSERT, el mail ya salió y no se rompe nada.
//
// Diseño de marca (Fase 3, tarjeta 1 — pedido de Ale, 30/07): cada plantilla
// (welcome.hbs, order-confirmation.hbs, etc.) ahora es solo el CONTENIDO — un
// fragmento sin <html>/<body> propio. sendOrLog/sendCustomEmail lo envuelven
// en `email-layout.hbs`, un layout compartido con estilo de email real
// (header con el logo o el nombre de la tienda sobre color de marca, tarjeta
// blanca de contenido, footer). Los colores/logo salen de
// `StorefrontConfig` (Apariencia) del negocio — así cada negocio ve SU propio
// color, no uno fijo de Orbita. Los avisos de plataforma (suscripción
// vencida/suspendida, que Orbita le manda al dueño sobre SU pago a Orbita,
// no sobre su tienda) usan a propósito el branding default de Orbita en vez
// del branding del negocio — no tendría sentido que un aviso de "se suspendió
// tu tienda" viniera con los colores de esa misma tienda.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly isConfigured: boolean;
  private readonly from: string;
  private _resend: Resend | undefined;
  // Cachea cada plantilla compilada: se lee y compila una sola vez, no en
  // cada envío.
  private readonly templates = new Map<string, HandlebarsTemplateDelegate>();

  // Branding de Orbita como plataforma — se usa cuando no hay businessId, o
  // cuando el negocio todavía no cargó nada en Apariencia (fallback), o para
  // los avisos de plataforma (ver PLATFORM_BRANDED_TEMPLATES).
  private readonly DEFAULT_BRANDING: Branding = {
    storeName: 'Órbita',
    logoUrl: null,
    colorPrimary: '#2563eb',
    colorBackground: '#f1f5f9',
  };

  // Plantillas que hablan de la relación negocio→Orbita (no negocio→cliente):
  // siempre con el branding de Orbita, nunca con el del propio negocio.
  private readonly PLATFORM_BRANDED_TEMPLATES = new Set([
    'subscription-payment-failed',
    'subscription-suspended',
  ]);

  // Ícono chico que va en la insignia circular del header de cada mail —
  // puramente decorativo, uno por tipo de plantilla para que cada email se
  // distinga de un vistazo (Fase 3, rediseño "cálido" — pedido de Ale,
  // 31/07). No todos los envíos tienen uno: si el tipo no está en el mapa
  // (hoy es el caso del email masivo/individual custom, que no tiene un
  // "tipo" — es texto libre) no se fuerza ningún ícono de relleno; el layout
  // directamente no muestra la insignia (ver `icon` en `envolverEnLayout` y
  // el `{{#if icon}}` de `email-layout.hbs`). A pedido de Ale (31/07): "si
  // requiere ícono lo pongo, si no lo requiere no lo pongo".
  private readonly TEMPLATE_ICON: Record<string, string> = {
    welcome: '👋',
    'reset-password': '🔑',
    'password-changed': '🔒',
    'member-invitation': '👥',
    'member-access-reminder': '🔑',
    'order-confirmation': '✅',
    'order-shipped': '📦',
    'order-ready-pickup': '📍',
    'order-delivered': '🎉',
    'thanks-for-purchase': '🙏',
    'review-request': '⭐',
    'return-approved': '↩️',
    'subscription-payment-failed': '⚠️',
    'subscription-suspended': '⏸️',
  };

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.isConfigured = !!apiKey;
    this.from = this.config.get<string>('MAIL_FROM') ?? '"Órbita" <no-reply@orbita-corp.com>';
    if (apiKey) this._resend = new Resend(apiKey);
    Handlebars.registerPartial('cta-button', CTA_BUTTON_PARTIAL);
  }

  private get resend(): Resend {
    // this.isConfigured ya garantiza que _resend existe en los call sites que
    // lo usan (sendOrLog/sendCustomEmail cortan antes si no está configurado).
    return this._resend!;
  }

  private compile(templateName: string): HandlebarsTemplateDelegate {
    const cached = this.templates.get(templateName);
    if (cached) return cached;
    const path = join(__dirname, 'templates', `${templateName}.hbs`);
    const source = readFileSync(path, 'utf8');
    const compiled = Handlebars.compile(source, { strict: true });
    this.templates.set(templateName, compiled);
    return compiled;
  }

  // Oscurece un color hex para el segundo color del degradé del header
  // (Fase 3, rediseño "cálido"). El color siempre sale de un <input
  // type="color"> de Apariencia, así que en la práctica siempre matchea el
  // regex — pero si algún día no matchea, devuelve el color sin oscurecer
  // en vez de romper el envío.
  private darken(hex: string, factor = 0.72): string {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
    if (!m) return hex;
    const num = parseInt(m[1], 16);
    const r = Math.round(((num >> 16) & 0xff) * factor);
    const g = Math.round(((num >> 8) & 0xff) * factor);
    const b = Math.round((num & 0xff) * factor);
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  }

  // Misma idea, pero para un rgba() semitransparente — la sombra del botón
  // y el fondo tenue de las "tarjetas" de cada plantilla, siempre en el
  // tono de marca del negocio (o de Orbita, en los avisos de plataforma).
  private toRgba(hex: string, alpha: number): string {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
    if (!m) return `rgba(37,99,235,${alpha})`;
    const num = parseInt(m[1], 16);
    const r = (num >> 16) & 0xff;
    const g = (num >> 8) & 0xff;
    const b = num & 0xff;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // Busca el logo/colores/nombre que el negocio cargó en Apariencia
  // (StorefrontConfig). Si no hay businessId, si el negocio no cargó nada
  // todavía, o si algo falla en la consulta, cae en el branding default de
  // Orbita — un mail nunca se bloquea ni se rompe por esto.
  private async obtenerBranding(businessId?: string): Promise<Branding> {
    if (!businessId) return this.DEFAULT_BRANDING;
    try {
      const config = await this.prisma.storefrontConfig.findUnique({
        where: { businessId },
        select: { storeName: true, logoUrl: true, colorPrimary: true, colorBackground: true },
      });
      let storeName = config?.storeName ?? null;
      if (!storeName) {
        const business = await this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
        storeName = business?.name ?? null;
      }
      return {
        storeName: storeName ?? this.DEFAULT_BRANDING.storeName,
        logoUrl: config?.logoUrl ?? null,
        colorPrimary: config?.colorPrimary ?? this.DEFAULT_BRANDING.colorPrimary,
        colorBackground: config?.colorBackground ?? this.DEFAULT_BRANDING.colorBackground,
      };
    } catch (e) {
      this.logger.warn(`No se pudo resolver el branding del negocio ${businessId} para el email, uso el de Orbita: ${e}`);
      return this.DEFAULT_BRANDING;
    }
  }

  // Envuelve el HTML de una plantilla (o el texto libre del email masivo) en
  // el layout de marca compartido. `icon` puede venir vacío ('') cuando el
  // envío no tiene un tipo con ícono propio (el masivo/custom) — en ese caso
  // el layout no muestra la insignia circular, y acá le damos un poco más de
  // aire arriba del contenido para que no se sienta apretado contra el
  // header sin esa insignia de por medio.
  private envolverEnLayout(contentHtml: string, branding: Branding, isPlatform: boolean, icon: string): string {
    return this.compile('email-layout')({
      ...branding,
      colorPrimaryDark: this.darken(branding.colorPrimary),
      isPlatform,
      icon,
      contentTopPad: icon ? 16 : 30,
      contentHtml,
    });
  }

  // Deja constancia del envío en email_logs. Nunca tira: un fallo acá no
  // puede voltear un mail que ya salió (ni el flujo que lo disparó).
  private async registrar(
    to: string,
    subject: string,
    template: string | null,
    status: EmailSendStatus,
    meta?: MailMeta,
    error?: string,
  ) {
    try {
      await this.prisma.emailLog.create({
        data: {
          businessId: meta?.businessId ?? null,
          customerId: meta?.customerId ?? null,
          memberId: meta?.memberId ?? null,
          to,
          subject,
          template,
          status,
          error: error ?? null,
        },
      });
    } catch (e) {
      this.logger.warn(`No se pudo registrar el envío a ${to} en email_logs: ${e}`);
    }
  }

  private async sendOrLog(
    to: string,
    subject: string,
    template: string,
    context: Record<string, any>,
    meta?: MailMeta,
  ) {
    if (!this.isConfigured) {
      this.logger.log(`[MAIL STUB] To: ${to} | Subject: ${subject} | Template: ${template} | Data: ${JSON.stringify(context)}`);
      await this.registrar(to, subject, template, EmailSendStatus.SIMULATED, meta);
      return;
    }
    try {
      // Armar el HTML (branding + compilar la plantilla + envolver en el
      // layout) va DENTRO del try — antes estaba afuera y un fallo acá (por
      // ejemplo, un .hbs recién agregado que todavía no se copió a dist/
      // porque el server no se reinició) se escapaba sin pasar por el catch:
      // no quedaba registrado en email_logs y, si quien lo llamaba lo
      // atajaba en silencio (como el envío masivo), el resultado terminaba
      // siendo un misterioso "0 enviados" sin ningún rastro del error real.
      const isPlatform = this.PLATFORM_BRANDED_TEMPLATES.has(template);
      const branding = isPlatform ? this.DEFAULT_BRANDING : await this.obtenerBranding(meta?.businessId);
      // colorPrimaryDark/Glow/Tint son derivados del color de marca — cada
      // plantilla los puede usar para su botón (cta-button) o su "tarjeta"
      // de datos destacados (ver .hbs de cada una), sin tener que calcular
      // nada de color a mano.
      const contentHtml = this.compile(template)({
        ...context,
        colorPrimary: branding.colorPrimary,
        colorPrimaryDark: this.darken(branding.colorPrimary),
        colorPrimaryGlow: this.toRgba(branding.colorPrimary, 0.35),
        colorPrimaryTint: this.toRgba(branding.colorPrimary, 0.08),
      });
      const icon = this.TEMPLATE_ICON[template] ?? '';
      const html = this.envolverEnLayout(contentHtml, branding, isPlatform, icon);
      const { error } = await this.resend.emails.send({ from: this.from, to, subject, html });
      if (error) {
        this.logger.error(`Resend rechazó el envío a ${to} (${template}): ${error.message}`);
        await this.registrar(to, subject, template, EmailSendStatus.FAILED, meta, error.message);
        return;
      }
      await this.registrar(to, subject, template, EmailSendStatus.SENT, meta);
    } catch (e) {
      // Cubre errores de red/transporte (Resend caído, timeout) Y errores al
      // armar el HTML — antes solo cubría el primer caso.
      this.logger.error(`No se pudo armar/enviar el email a ${to} (${template}): ${e}`);
      await this.registrar(to, subject, template, EmailSendStatus.FAILED, meta, String(e));
      throw e;
    }
  }

  // ── Custom (free-form, used by POST /customers/email) ─

  async sendCustomEmail(to: string, subject: string, htmlBody: string, meta?: MailMeta) {
    if (!this.isConfigured) {
      this.logger.log(`[MAIL STUB] To: ${to} | Subject: ${subject} | Body: ${htmlBody.substring(0, 200)}`);
      await this.registrar(to, subject, null, EmailSendStatus.SIMULATED, meta);
      return;
    }
    try {
      // Mismo motivo que en sendOrLog: armar el branding/HTML va adentro del
      // try para que un fallo acá quede registrado como FAILED en vez de
      // escaparse sin dejar rastro.
      const branding = await this.obtenerBranding(meta?.businessId);
      const html = this.envolverEnLayout(htmlBody, branding, false, '');
      const { error } = await this.resend.emails.send({ from: this.from, to, subject, html });
      if (error) {
        this.logger.error(`Resend rechazó el envío custom a ${to}: ${error.message}`);
        await this.registrar(to, subject, null, EmailSendStatus.FAILED, meta, error.message);
        return;
      }
      await this.registrar(to, subject, null, EmailSendStatus.SENT, meta);
    } catch (e) {
      this.logger.error(`No se pudo armar/enviar el email custom a ${to}: ${e}`);
      await this.registrar(to, subject, null, EmailSendStatus.FAILED, meta, String(e));
      throw e;
    }
  }

  // ── Auth ──────────────────────────────────────────────

  async sendWelcome(to: string, data: { storeName: string }, meta?: MailMeta) {
    await this.sendOrLog(to, `Bienvenido a ${data.storeName}`, 'welcome', data, meta);
  }

  async sendPasswordReset(to: string, data: { code: string; expiresIn: string }, meta?: MailMeta) {
    await this.sendOrLog(to, 'Recuperá tu contraseña', 'reset-password', data, meta);
  }

  // Aviso de seguridad: la contraseña ya se cambió (post reset o cambio
  // manual). No lleva links de acción — es solo para que el dueño real de la
  // cuenta se entere si no fue él.
  async sendPasswordChanged(to: string, data: { storeName: string }, meta?: MailMeta) {
    await this.sendOrLog(to, 'Tu contraseña fue actualizada', 'password-changed', data, meta);
  }

  // ── Members ───────────────────────────────────────────

  async sendMemberInvitation(
    to: string,
    data: {
      storeName: string;
      roleName: string;
      panelUrl: string;
      tempPassword: string;
    },
    meta?: MailMeta,
  ) {
    await this.sendOrLog(to, `Te invitaron a gestionar ${data.storeName}`, 'member-invitation', data, meta);
  }

  // Recordatorio de acceso para un miembro que ya existe: adónde entrar y,
  // si el admin le generó una contraseña temporal nueva, cuál es.
  async sendMemberAccessReminder(
    to: string,
    data: {
      storeName: string;
      panelUrl: string;
      tempPassword?: string;
    },
    meta?: MailMeta,
  ) {
    await this.sendOrLog(to, `Tu acceso al panel de ${data.storeName}`, 'member-access-reminder', data, meta);
  }

  // ── Orders ────────────────────────────────────────────

  async sendOrderConfirmation(
    to: string,
    data: {
      storeName: string;
      orderNumber: number;
      total: number;
      items: Array<{ name: string; quantity: number; price: number }>;
    },
    meta?: MailMeta,
  ) {
    await this.sendOrLog(to, `Pedido #${data.orderNumber} confirmado`, 'order-confirmation', data, meta);
  }

  async sendOrderReadyForPickup(
    to: string,
    data: {
      storeName: string;
      orderNumber: number;
      pickupAddress?: string;
    },
    meta?: MailMeta,
  ) {
    await this.sendOrLog(to, `Tu pedido #${data.orderNumber} está listo para retirar`, 'order-ready-pickup', data, meta);
  }

  async sendOrderShipped(
    to: string,
    data: {
      storeName: string;
      orderNumber: number;
      tracking?: string;
    },
    meta?: MailMeta,
  ) {
    await this.sendOrLog(to, `Tu pedido #${data.orderNumber} está en camino`, 'order-shipped', data, meta);
  }

  async sendOrderDelivered(
    to: string,
    data: {
      storeName: string;
      orderNumber: number;
    },
    meta?: MailMeta,
  ) {
    await this.sendOrLog(to, `Tu pedido #${data.orderNumber} fue entregado`, 'order-delivered', data, meta);
  }

  async sendThanksForPurchase(
    to: string,
    data: {
      storeName: string;
      orderNumber: number;
      customerName?: string;
    },
    meta?: MailMeta,
  ) {
    await this.sendOrLog(to, `¡Gracias por tu compra en ${data.storeName}!`, 'thanks-for-purchase', data, meta);
  }

  // ── Reviews ───────────────────────────────────────────

  async sendReviewRequest(
    to: string,
    data: {
      storeName: string;
      productName: string;
      reviewUrl: string;
    },
    meta?: MailMeta,
  ) {
    await this.sendOrLog(to, `¿Qué te pareció tu compra en ${data.storeName}?`, 'review-request', data, meta);
  }

  // ── Returns ───────────────────────────────────────────

  async sendReturnApproved(
    to: string,
    data: {
      storeName: string;
      orderNumber: number;
      refundMethod: string;
      amount: number;
    },
    meta?: MailMeta,
  ) {
    await this.sendOrLog(to, `Tu devolución fue aprobada`, 'return-approved', data, meta);
  }

  // ── Subscriptions (negocio → Orbita) ──────────────────

  async sendSubscriptionPaymentFailed(
    to: string,
    data: {
      businessName: string;
      amount: number;
      retryDate: string;
      graceDaysLeft: number;
    },
    meta?: MailMeta,
  ) {
    await this.sendOrLog(to, `No pudimos cobrar tu suscripción de Orbita`, 'subscription-payment-failed', data, meta);
  }

  async sendSubscriptionSuspended(
    to: string,
    data: {
      businessName: string;
      reactivateUrl: string;
    },
    meta?: MailMeta,
  ) {
    await this.sendOrLog(to, `Tu tienda en Orbita fue suspendida`, 'subscription-suspended', data, meta);
  }
}
