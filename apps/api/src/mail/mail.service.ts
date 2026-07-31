import { readFileSync } from 'fs';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as Handlebars from 'handlebars';

// Envío por Resend (API, no SMTP). Las plantillas siguen siendo los mismos
// .hbs de antes — nest-cli.json las copia a dist/mail/templates en el build
// (ver "assets" en ese archivo) — pero ahora se compilan a mano con
// `handlebars` en vez de depender del adapter de @nestjs-modules/mailer, que
// se sacó junto con nodemailer al migrar de SMTP a Resend.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly isConfigured: boolean;
  private readonly from: string;
  private _resend: Resend | undefined;
  // Cachea cada plantilla compilada: se lee y compila una sola vez, no en
  // cada envío.
  private readonly templates = new Map<string, HandlebarsTemplateDelegate>();

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.isConfigured = !!apiKey;
    this.from = this.config.get<string>('MAIL_FROM') ?? '"Órbita" <no-reply@orbita-corp.com>';
    if (apiKey) this._resend = new Resend(apiKey);
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

  private async sendOrLog(to: string, subject: string, template: string, context: Record<string, any>) {
    if (!this.isConfigured) {
      this.logger.log(`[MAIL STUB] To: ${to} | Subject: ${subject} | Template: ${template} | Data: ${JSON.stringify(context)}`);
      return;
    }
    const html = this.compile(template)(context);
    const { error } = await this.resend.emails.send({ from: this.from, to, subject, html });
    if (error) this.logger.error(`Resend rechazó el envío a ${to} (${template}): ${error.message}`);
  }

  // ── Custom (free-form, used by POST /customers/email) ─

  async sendCustomEmail(to: string, subject: string, htmlBody: string) {
    if (!this.isConfigured) {
      this.logger.log(`[MAIL STUB] To: ${to} | Subject: ${subject} | Body: ${htmlBody.substring(0, 200)}`);
      return;
    }
    const { error } = await this.resend.emails.send({ from: this.from, to, subject, html: htmlBody });
    if (error) this.logger.error(`Resend rechazó el envío custom a ${to}: ${error.message}`);
  }

  // ── Auth ──────────────────────────────────────────────

  async sendWelcome(to: string, data: { storeName: string }) {
    await this.sendOrLog(to, `Bienvenido a ${data.storeName}`, 'welcome', data);
  }

  async sendPasswordReset(to: string, data: { code: string; expiresIn: string }) {
    await this.sendOrLog(to, 'Recuperá tu contraseña', 'reset-password', data);
  }

  // ── Members ───────────────────────────────────────────

  async sendMemberInvitation(to: string, data: {
    storeName: string;
    roleName: string;
    panelUrl: string;
    tempPassword: string;
  }) {
    await this.sendOrLog(to, `Te invitaron a gestionar ${data.storeName}`, 'member-invitation', data);
  }

  // ── Orders ────────────────────────────────────────────

  async sendOrderConfirmation(to: string, data: {
    storeName: string;
    orderNumber: number;
    total: number;
    items: Array<{ name: string; quantity: number; price: number }>;
  }) {
    await this.sendOrLog(to, `Pedido #${data.orderNumber} confirmado`, 'order-confirmation', data);
  }

  async sendOrderShipped(to: string, data: {
    storeName: string;
    orderNumber: number;
    tracking?: string;
  }) {
    await this.sendOrLog(to, `Tu pedido #${data.orderNumber} está en camino`, 'order-shipped', data);
  }

  async sendOrderDelivered(to: string, data: {
    storeName: string;
    orderNumber: number;
  }) {
    await this.sendOrLog(to, `Tu pedido #${data.orderNumber} fue entregado`, 'order-delivered', data);
  }

  // ── Reviews ───────────────────────────────────────────

  async sendReviewRequest(to: string, data: {
    storeName: string;
    productName: string;
    reviewUrl: string;
  }) {
    await this.sendOrLog(to, `¿Qué te pareció tu compra en ${data.storeName}?`, 'review-request', data);
  }

  // ── Returns ───────────────────────────────────────────

  async sendReturnApproved(to: string, data: {
    storeName: string;
    orderNumber: number;
    refundMethod: string;
    amount: number;
  }) {
    await this.sendOrLog(to, `Tu devolución fue aprobada`, 'return-approved', data);
  }

  // ── Subscriptions (negocio → Orbita) ──────────────────

  async sendSubscriptionPaymentFailed(to: string, data: {
    businessName: string;
    amount: number;
    retryDate: string;
    graceDaysLeft: number;
  }) {
    await this.sendOrLog(to, `No pudimos cobrar tu suscripción de Orbita`, 'subscription-payment-failed', data);
  }

  async sendSubscriptionSuspended(to: string, data: {
    businessName: string;
    reactivateUrl: string;
  }) {
    await this.sendOrLog(to, `Tu tienda en Orbita fue suspendida`, 'subscription-suspended', data);
  }
}
