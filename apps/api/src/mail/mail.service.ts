import { readFileSync } from 'fs';
import { join } from 'path';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as Handlebars from 'handlebars';
import { EmailSendStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FIXTURE_BUSINESS_BRANDING, MAIL_PREVIEW_FIXTURES } from './mail-preview.fixtures';

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
  // Redes del NEGOCIO (BusinessConfig) — solo se muestran en el footer de
  // plantillas negocio→cliente (nunca en las de plataforma, ver isPlatform
  // en email-layout.hbs). null cuando el negocio no cargó esa red o cuando
  // no aplica (avisos de plataforma, sin businessId).
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
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

// Isotipo de Órbita (el mismo anillo+satélite del logo real de orbita.site)
// — firma de plataforma en el footer de cada email. Colores fijos de marca
// (no varían con el negocio): es la identidad de Órbita, no la del negocio.
const ORBITA_ISOTIPO_PARTIAL = `<svg width="14" height="14" viewBox="0 0 30 30" fill="none"><circle cx="15" cy="15" r="13" stroke="#2563eb" stroke-width="3.2" stroke-dasharray="60 22" stroke-linecap="round"/><circle cx="25.5" cy="7.5" r="4" fill="#93c5fd"/><circle cx="15" cy="15" r="4.5" fill="#1e3a8a"/></svg>`;

// Íconos de red social del footer (negocio→cliente). Trazo fino en
// currentColor, mismo lenguaje visual que TEMPLATE_ICON — el color real lo
// fija el `color:` del <a> que los envuelve en email-layout.hbs.
const ICON_INSTAGRAM_PARTIAL = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="0.6" fill="currentColor" stroke="none"/></svg>`;
const ICON_FACEBOOK_PARTIAL = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 8h2V4h-2a4 4 0 0 0-4 4v2H9v4h2v6h3v-6h2.5l.5-4H14V8a1 1 0 0 1 1-1Z"/></svg>`;
const ICON_TIKTOK_PARTIAL = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M16 7a4 4 0 0 0 4 4"/></svg>`;

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
    // Celeste tenue real de orbita.site (antes #f1f5f9, un gris plano sin
    // relación con la marca) — Fase de rediseño visual, referencia Headspace
    // (pedido de Ale, 16/08).
    colorBackground: '#eef4ff',
    instagram: null,
    facebook: null,
    tiktok: null,
  };

  // Plantillas que hablan de la relación negocio→Orbita (no negocio→cliente):
  // siempre con el branding de Orbita, nunca con el del propio negocio.
  private readonly PLATFORM_BRANDED_TEMPLATES = new Set([
    'subscription-payment-failed',
    'subscription-suspended',
    'platform-admin-login-code',
  ]);

  // Envuelve el contenido de un ícono (paths/circles) en el <svg> común a
  // todos — mismo look "línea" que ya usa el resto del panel (lucide-react):
  // trazo fino, sin relleno, puntas y uniones redondeadas. `stroke="currentColor"`
  // en vez de un color fijo: quien lo use en HTML fija el color real con la
  // propiedad CSS `color` en un elemento contenedor (ver `color:{{colorPrimary}}`
  // en la insignia de email-layout.hbs) — así cada negocio ve el ícono en SU
  // propio color de marca sin que este archivo tenga que saber de colores.
  private svgIcon(inner: string): string {
    return `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block; margin:0 auto;">${inner}</svg>`;
  }

  // Ícono chico que va en la insignia circular del header de cada mail —
  // puramente decorativo, uno por tipo de plantilla para que cada email se
  // distinga de un vistazo (Fase 3, rediseño "cálido" — pedido de Ale,
  // 31/07). Empezó siendo emoji; a pedido de Ale (31/07, "no parezca IA,
  // quiero algo profesional") se pasó a íconos de línea SVG en el color de
  // marca, estilo lucide — igual que el resto del panel. Ojo, trade-off real
  // conocido y aceptado por Ale: Outlook de escritorio (no Outlook.com) tiene
  // soporte pobre de SVG en emails — ahí puede no verse el ícono (queda el
  // círculo blanco vacío, no roto). En Gmail/Apple Mail/Outlook nuevo se ve
  // perfecto.
  //
  // No todos los envíos tienen uno: si el tipo no está en el mapa (hoy es el
  // caso del email masivo/individual custom, que no tiene un "tipo" — es
  // texto libre) no se fuerza ningún ícono de relleno; el layout directamente
  // no muestra la insignia (ver `icon` en `envolverEnLayout` y el
  // `{{#if icon}}` de `email-layout.hbs`).
  private readonly TEMPLATE_ICON: Record<string, string> = {
    // Sparkles — bienvenida.
    welcome: this.svgIcon(
      '<path d="M12 3l1.6 4.8L18 9l-4.4 1.2L12 15l-1.6-4.8L6 9l4.4-1.2L12 3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/><path d="M5 15l.6 1.6L7 17l-1.4.4L5 19l-.6-1.6L3 17l1.4-.4L5 15z"/>',
    ),
    // Key — resetear/recordar acceso.
    'reset-password': this.svgIcon(
      '<circle cx="7.5" cy="15.5" r="5.5"/><path d="M11.5 11.5 21 2"/><path d="M15.5 7.5 18 10"/><path d="M18.5 4.5 21 7"/>',
    ),
    // ShieldCheck — segundo factor del login de platform admin.
    'platform-admin-login-code': this.svgIcon(
      '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    ),
    // Lock — la contraseña ya se cambió (seguridad).
    'password-changed': this.svgIcon(
      '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    ),
    // Users — te sumaron al equipo.
    'member-invitation': this.svgIcon(
      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    ),
    // Key — mismo ícono que reset-password: mismo lenguaje "acceso".
    'member-access-reminder': this.svgIcon(
      '<circle cx="7.5" cy="15.5" r="5.5"/><path d="M11.5 11.5 21 2"/><path d="M15.5 7.5 18 10"/><path d="M18.5 4.5 21 7"/>',
    ),
    // Misma llave: el reset pedido por el admin es el mismo lenguaje "acceso".
    'member-password-reset': this.svgIcon(
      '<circle cx="7.5" cy="15.5" r="5.5"/><path d="M11.5 11.5 21 2"/><path d="M15.5 7.5 18 10"/><path d="M18.5 4.5 21 7"/>',
    ),
    // CircleCheck — pedido confirmado.
    'order-confirmation': this.svgIcon('<circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/>'),
    // Package — pedido despachado.
    'order-shipped': this.svgIcon(
      '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    ),
    // MapPin — listo para retirar en el local.
    'order-ready-pickup': this.svgIcon(
      '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    ),
    // PackageCheck — entregado.
    'order-delivered': this.svgIcon(
      '<path d="M16.5 9.4 7.5 4.2"/><path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/><path d="m17 13.5 1.8 1.8L22.5 12"/>',
    ),
    // HeartHandshake — gracias por confiar en la tienda.
    'thanks-for-purchase': this.svgIcon(
      '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/><path d="M12 5 9 8a2.2 2.2 0 0 0 0 3 2.1 2.1 0 0 0 3 .1l2-1.9a2.8 2.8 0 0 1 3.8 0L20.8 12"/>',
    ),
    // Star — pedido de reseña.
    'review-request': this.svgIcon(
      '<path d="M11.53 2.42a.5.5 0 0 1 .94 0l2.62 6.15a.5.5 0 0 0 .42.3l6.6.55a.5.5 0 0 1 .28.88l-5.02 4.36a.5.5 0 0 0-.16.5l1.53 6.48a.5.5 0 0 1-.74.55l-5.64-3.46a.5.5 0 0 0-.52 0l-5.64 3.46a.5.5 0 0 1-.74-.55l1.53-6.48a.5.5 0 0 0-.16-.5L1.86 10.3a.5.5 0 0 1 .28-.88l6.6-.55a.5.5 0 0 0 .42-.3Z"/>',
    ),
    // Undo2 — devolución aprobada.
    'return-approved': this.svgIcon('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5A5.5 5.5 0 0 1 20 14.5v0A5.5 5.5 0 0 1 14.5 20H11"/>'),
    // TriangleAlert — no se pudo cobrar la suscripción (urgente).
    'subscription-payment-failed': this.svgIcon('<path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
    // Pause — tienda suspendida.
    'subscription-suspended': this.svgIcon('<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'),
  };

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.isConfigured = !!apiKey;
    // En producción, sin API key el servicio "simula" envíos y todo figura
    // como enviado sin que salga un solo mail — mejor negarse a arrancar y
    // que el deploy avise, antes que un éxito silencioso.
    if (!apiKey && process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY no está configurada: en producción los emails son obligatorios (configurala en el host o quitá NODE_ENV=production).');
    }
    this.from = this.config.get<string>('MAIL_FROM') ?? '"Órbita" <no-reply@orbita-corp.com>';
    if (apiKey) this._resend = new Resend(apiKey);
    Handlebars.registerPartial('cta-button', CTA_BUTTON_PARTIAL);
    Handlebars.registerPartial('orbita-isotipo', ORBITA_ISOTIPO_PARTIAL);
    Handlebars.registerPartial('icon-instagram', ICON_INSTAGRAM_PARTIAL);
    Handlebars.registerPartial('icon-facebook', ICON_FACEBOOK_PARTIAL);
    Handlebars.registerPartial('icon-tiktok', ICON_TIKTOK_PARTIAL);
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
      const [config, negocioConfig] = await Promise.all([
        this.prisma.storefrontConfig.findUnique({
          where: { businessId },
          select: { storeName: true, logoUrl: true, colorPrimary: true, colorBackground: true },
        }),
        // Redes sociales del negocio (footer) — tabla aparte (BusinessConfig,
        // no StorefrontConfig). Si falla o no existe, el footer simplemente
        // no muestra íconos: no vale la pena bloquear/reintentar por esto.
        this.prisma.businessConfig.findUnique({
          where: { businessId },
          select: { instagram: true, facebook: true, tiktok: true },
        }),
      ]);
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
        instagram: negocioConfig?.instagram ?? null,
        facebook: negocioConfig?.facebook ?? null,
        tiktok: negocioConfig?.tiktok ?? null,
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
      // Fondo de la insignia circular del ícono — más saturado que el tint
      // de las "tarjetas" de datos (0.08) porque acá es el único color en
      // una superficie chica, necesita leerse como color de marca a simple
      // vista (referencia Headspace: insignia grande con fondo de color).
      colorPrimaryTint: this.toRgba(branding.colorPrimary, 0.14),
      isPlatform,
      hasSocial: !!(branding.instagram || branding.facebook || branding.tiktok),
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

  // Devuelve si el envío salió (true) o el proveedor lo rechazó (false). En
  // local sin API key cuenta como enviado (simulado). Relanza solo ante fallo
  // de transporte / armado del HTML. Antes era void: un rechazo de Resend
  // quedaba solo en email_logs y el caller lo daba por enviado — por eso el
  // comprobante (receipt) decía "enviado" aunque en fase de prueba no salía.
  // (Fase 4 — Ale, auditoría) Reintenta el envío ante fallos TRANSITORIOS de
  // transporte (Resend caído, timeout, red) con backoff exponencial. NO
  // reintenta los rechazos que Resend devuelve en `error` (destinatario
  // inválido, dominio sin verificar, modo prueba): esos son permanentes y
  // reintentarlos solo gasta tiempo. Devuelve el mismo shape { error } que la
  // llamada original para que sendOrLog lo maneje igual.
  private async enviarConReintento(
    payload: { from: string; to: string; subject: string; html: string },
  ): Promise<{ error: { message: string } | null }> {
    const MAX_INTENTOS = 3;
    let ultimoError: unknown;
    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      try {
        const { error } = await this.resend.emails.send(payload);
        // Rechazo del proveedor (permanente): no se reintenta.
        return { error: error ? { message: error.message } : null };
      } catch (e) {
        // Excepción de transporte (transitoria): se reintenta con backoff.
        ultimoError = e;
        if (intento < MAX_INTENTOS) {
          const espera = 300 * 2 ** (intento - 1); // 300ms, 600ms
          this.logger.warn(`Reintento ${intento}/${MAX_INTENTOS - 1} del envío a ${payload.to} tras fallo de transporte: ${e}`);
          await new Promise((r) => setTimeout(r, espera));
        }
      }
    }
    // Agotados los reintentos, se relanza para que el catch de sendOrLog lo
    // registre como FAILED (y el caller decida si corta el flujo).
    throw ultimoError;
  }

  private async sendOrLog(
    to: string,
    subject: string,
    template: string,
    context: Record<string, any>,
    meta?: MailMeta,
  ): Promise<boolean> {
    if (!this.isConfigured) {
      this.logger.log(`[MAIL STUB] To: ${to} | Subject: ${subject} | Template: ${template} | Data: ${JSON.stringify(context)}`);
      await this.registrar(to, subject, template, EmailSendStatus.SIMULATED, meta);
      return true;
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
      const { error } = await this.enviarConReintento({ from: this.from, to, subject, html });
      if (error) {
        this.logger.error(`Resend rechazó el envío a ${to} (${template}): ${error.message}`);
        await this.registrar(to, subject, template, EmailSendStatus.FAILED, meta, error.message);
        return false;
      }
      await this.registrar(to, subject, template, EmailSendStatus.SENT, meta);
      return true;
    } catch (e) {
      // Cubre errores de red/transporte (Resend caído, timeout) Y errores al
      // armar el HTML — antes solo cubría el primer caso.
      this.logger.error(`No se pudo armar/enviar el email a ${to} (${template}): ${e}`);
      await this.registrar(to, subject, template, EmailSendStatus.FAILED, meta, String(e));
      throw e;
    }
  }

  // ── Custom (free-form, used by POST /customers/email) ─

  // Devuelve si el envío salió (o quedó simulado en local). Antes era void y
  // un rechazo de Resend quedaba solo en email_logs: el que llamaba lo contaba
  // como enviado igual, y el panel te decía "enviado" aunque no salió nada.
  async sendCustomEmail(to: string, subject: string, htmlBody: string, meta?: MailMeta): Promise<boolean> {
    if (!this.isConfigured) {
      this.logger.log(`[MAIL STUB] To: ${to} | Subject: ${subject} | Body: ${htmlBody.substring(0, 200)}`);
      await this.registrar(to, subject, null, EmailSendStatus.SIMULATED, meta);
      return true;
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
        return false;
      }
      await this.registrar(to, subject, null, EmailSendStatus.SENT, meta);
      return true;
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

  // El admin le reseteó la contraseña a un miembro: link a la pantalla de
  // restablecer (crea la definitiva ahí, como en la invitación) + la temporal
  // como plan B para entrar por el login. El link vale 1 hora, un solo uso.
  async sendMemberPasswordReset(
    to: string,
    data: {
      storeName: string;
      resetUrl: string;
      tempPassword: string;
    },
    meta?: MailMeta,
  ) {
    await this.sendOrLog(to, `Restablecé tu contraseña de ${data.storeName}`, 'member-password-reset', data, meta);
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
      // El template los imprime tal cual: llegan ya formateados ("$12.500").
      total: string;
      items: Array<{ name: string; quantity: number; price: string }>;
    },
    meta?: MailMeta,
  ): Promise<boolean> {
    return this.sendOrLog(to, `Pedido #${data.orderNumber} confirmado`, 'order-confirmation', data, meta);
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

  async sendOrderCancelled(
    to: string,
    data: {
      storeName: string;
      orderNumber: number;
    },
    meta?: MailMeta,
  ) {
    await this.sendOrLog(to, `Tu pedido #${data.orderNumber} fue cancelado`, 'order-cancelled', data, meta);
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

  // ── Platform admin (segundo factor del login, RBT-647) ────────────────

  async sendPlatformAdminLoginCode(to: string, data: { code: string; expiresIn: string }) {
    await this.sendOrLog(to, 'Tu código de acceso a Órbita', 'platform-admin-login-code', data);
  }

  // ── Testeo (panel de plataforma → Testeo, RBT-607) ────────────────────

  listPreviewables() {
    return MAIL_PREVIEW_FIXTURES.map(({ id, label, group, subject }) => ({ id, label, group, subject }));
  }

  private fixture(id: string) {
    const fixture = MAIL_PREVIEW_FIXTURES.find((f) => f.id === id);
    if (!fixture) throw new NotFoundException(`No existe la plantilla de prueba "${id}"`);
    return fixture;
  }

  // Arma el HTML igual que un envío real, pero sin mandar nada. Usa el mismo
  // branding fijo (Órbita o el negocio ficticio de FIXTURE_BUSINESS_BRANDING,
  // según isPlatform) que sendPreview, para que lo que se ve acá sea
  // exactamente lo que llega si después se manda la prueba.
  previewTemplate(id: string): { subject: string; html: string } {
    const fixture = this.fixture(id);
    const branding = fixture.isPlatform ? this.DEFAULT_BRANDING : FIXTURE_BUSINESS_BRANDING;
    const contentHtml = this.compile(fixture.template)({
      ...fixture.data,
      colorPrimary: branding.colorPrimary,
      colorPrimaryDark: this.darken(branding.colorPrimary),
      colorPrimaryGlow: this.toRgba(branding.colorPrimary, 0.35),
      colorPrimaryTint: this.toRgba(branding.colorPrimary, 0.08),
    });
    const icon = fixture.isPlatform ? '' : (this.TEMPLATE_ICON[fixture.template] ?? '');
    const html = this.envolverEnLayout(contentHtml, branding, fixture.isPlatform, icon);
    return { subject: fixture.subject, html };
  }

  // Manda el preview tal cual a una casilla real — mismo pipeline de envío
  // (reintentos + registro en email_logs) que un envío de producción, para
  // poder chequear el render real en Gmail/Outlook/etc., no solo en el iframe
  // del panel. No usa sendOrLog porque ese resuelve el branding por
  // businessId real; acá el negocio es ficticio, así que el HTML sale de
  // previewTemplate() y se manda con la misma lógica de reintento/registro.
  async sendPreview(id: string, to: string): Promise<boolean> {
    const { subject, html } = this.previewTemplate(id);
    const asunto = `[Prueba] ${subject}`;
    if (!this.isConfigured) {
      this.logger.log(`[MAIL STUB] Testeo → To: ${to} | Subject: ${asunto} | Template: ${id}`);
      await this.registrar(to, asunto, id, EmailSendStatus.SIMULATED);
      return true;
    }
    try {
      const { error } = await this.enviarConReintento({ from: this.from, to, subject: asunto, html });
      if (error) {
        this.logger.error(`Resend rechazó el envío de prueba a ${to} (${id}): ${error.message}`);
        await this.registrar(to, asunto, id, EmailSendStatus.FAILED, undefined, error.message);
        return false;
      }
      await this.registrar(to, asunto, id, EmailSendStatus.SENT);
      return true;
    } catch (e) {
      this.logger.error(`No se pudo enviar el email de prueba a ${to} (${id}): ${e}`);
      await this.registrar(to, asunto, id, EmailSendStatus.FAILED, undefined, String(e));
      throw e;
    }
  }
}
