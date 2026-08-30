import { randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorefrontService } from '../storefront/storefront.service';
import { MailService } from '../mail/mail.service';
import { CreateReturnRequestDto, ReturnRequestReason } from './dto/create-return-request.dto';

// RBT-683 — botón "Arrepentimiento / Devolución" del footer del storefront.
// A propósito NO es un dominio con estados/panel como ReturnsService
// (notas de crédito) o CancellationsService: acá Órbita solo garantiza dos
// cosas — (1) un número de trámite + acuse de recibo inmediato al cliente,
// que NUNCA depende de que el comercio actúe, y (2) el aviso al comercio con
// todo el detalle. La revisión y resolución del caso (aceptar, rechazar,
// coordinar la devolución) pasa 100% por fuera de Órbita, por email/WhatsApp
// directo entre cliente y comercio — así lo pidió el negocio. Por eso no hay
// tabla nueva en Prisma ni endpoint de "ver mis solicitudes": el único
// registro que queda es el de email_logs (MailService.registrar), que ya
// alcanza como constancia de fecha/hora de la notificación.
const REASON_LABEL: Record<ReturnRequestReason, string> = {
  [ReturnRequestReason.ARREPENTIMIENTO]: 'Arrepentimiento de compra',
  [ReturnRequestReason.GARANTIA]: 'Garantía (producto fallado o dañado)',
  [ReturnRequestReason.OTRO]: 'Devolución / cambio',
};

// Prefijo del número de trámite — a simple vista, sin abrir el mail, se ve
// de qué tipo es el caso (ej. "AR-260830-9F2C1B").
const REASON_PREFIX: Record<ReturnRequestReason, string> = {
  [ReturnRequestReason.ARREPENTIMIENTO]: 'AR',
  [ReturnRequestReason.GARANTIA]: 'GA',
  [ReturnRequestReason.OTRO]: 'DV',
};

// Texto legal que acompaña cada motivo — informativo nada más (la
// verificación real del plazo/resolución la hace el comercio a mano, ver
// decisión RBT-683 en Jira: sin validación automática contra el pedido).
const REASON_LEGAL_NOTE: Record<ReturnRequestReason, string> = {
  [ReturnRequestReason.ARREPENTIMIENTO]:
    'Válido dentro de los 10 días corridos desde la entrega (Ley 24.240 / Disp. 954-2025). Da derecho al reintegro del dinero, sin costo para el comprador.',
  [ReturnRequestReason.GARANTIA]:
    'Válido dentro de los 6 meses desde la entrega (Ley 24.240). El comercio debe ofrecer reparación, cambio por otro igual o reintegro del dinero, a elección del comprador.',
  [ReturnRequestReason.OTRO]:
    'Se resuelve según la política de cambios propia de esta tienda (fuera de los plazos legales de arrepentimiento/garantía).',
};

@Injectable()
export class ReturnRequestsService {
  private readonly logger = new Logger(ReturnRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storefrontService: StorefrontService,
    private readonly mailService: MailService,
  ) {}

  private generarNumeroTramite(reason: ReturnRequestReason): string {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const random = randomBytes(3).toString('hex').toUpperCase(); // 6 chars
    return `${REASON_PREFIX[reason]}-${yy}${mm}${dd}-${random}`;
  }

  // Escapado mínimo — este HTML se arma a mano (no con Handlebars, que ya
  // escapa por default) a partir de texto que tipeó un desconocido sin
  // sesión, así que nunca puede insertarse tal cual.
  private esc(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async create(slug: string, dto: CreateReturnRequestDto): Promise<{ trackingNumber: string }> {
    const businessId = await this.storefrontService.resolveBusinessId(slug);
    const [businessConfig, business] = await Promise.all([
      this.prisma.businessConfig.findUnique({ where: { businessId }, select: { email: true } }),
      this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
    ]);
    const storeName = business?.name ?? 'la tienda';
    const merchantEmail = businessConfig?.email ?? null;
    const trackingNumber = this.generarNumeroTramite(dto.reason);
    const reasonLabel = REASON_LABEL[dto.reason];
    const legalNote = REASON_LEGAL_NOTE[dto.reason];

    // 1) Acuse de recibo al cliente — obligatorio e inmediato, no puede
    // depender de que el comercio abra o responda nada. Si falla el envío,
    // igual devolvemos el número de trámite (se muestra en pantalla, punto 2
    // del requisito) — no queremos que un mail caído tire abajo el reclamo.
    try {
      await this.mailService.sendCustomEmail(
        dto.email,
        `Recibimos tu solicitud — Trámite ${trackingNumber}`,
        this.armarHtmlCliente({ trackingNumber, reasonLabel, legalNote, orderNumber: dto.orderNumber, storeName, comment: dto.comment }),
        { businessId },
      );
    } catch (e) {
      this.logger.error(`No se pudo mandar el acuse de recibo de ${trackingNumber} a ${dto.email}: ${e}`);
    }

    // 2) Aviso al comercio, al email de contacto que cargó en Apariencia/
    // Contacto (BusinessConfig.email) — el mismo que ya usan para Reply-To
    // en el resto de los mails al cliente. Si todavía no lo cargó, no hay
    // dónde avisarle por ahora (queda solo el trámite + el mail al cliente).
    if (merchantEmail) {
      try {
        await this.mailService.sendCustomEmail(
          merchantEmail,
          `Nueva solicitud de ${reasonLabel} — Pedido #${dto.orderNumber}`,
          this.armarHtmlComercio({ trackingNumber, reasonLabel, orderNumber: dto.orderNumber, email: dto.email, phone: dto.phone, comment: dto.comment }),
          { businessId },
        );
      } catch (e) {
        this.logger.error(`No se pudo avisar al comercio (${merchantEmail}) de la solicitud ${trackingNumber}: ${e}`);
      }
    } else {
      this.logger.warn(`Negocio ${businessId} sin email de contacto cargado — no se pudo avisar de la solicitud ${trackingNumber}`);
    }

    return { trackingNumber };
  }

  private armarHtmlCliente(data: {
    trackingNumber: string; reasonLabel: string; legalNote: string; orderNumber: string; storeName: string; comment?: string;
  }): string {
    return `
      <p>Recibimos tu solicitud de <strong>${this.esc(data.reasonLabel)}</strong> para el pedido <strong>#${this.esc(data.orderNumber)}</strong>.</p>
      <div style="margin:18px 0;padding:14px 16px;background:#f8fafc;border-radius:8px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin-bottom:4px;">Número de trámite</div>
        <div style="font-size:19px;font-weight:700;color:#1a1f36;">${this.esc(data.trackingNumber)}</div>
      </div>
      <p style="color:#697386;">Guardá este número: te va a servir para hacer referencia a tu solicitud si necesitás volver a escribirle a la tienda.</p>
      <p style="margin-top:16px;">${this.esc(data.legalNote)}</p>
      ${data.comment ? `<p style="margin-top:16px;"><strong>Tu comentario:</strong> ${this.esc(data.comment)}</p>` : ''}
      <p style="margin-top:16px;"><strong>${this.esc(data.storeName)}</strong> se va a contactar con vos a la brevedad para coordinar los próximos pasos. Esta solicitud se resuelve directamente con la tienda — Órbita solo garantiza que quedó registrada.</p>
    `;
  }

  private armarHtmlComercio(data: {
    trackingNumber: string; reasonLabel: string; orderNumber: string; email: string; phone?: string; comment?: string;
  }): string {
    return `
      <p>Nueva solicitud de <strong>${this.esc(data.reasonLabel)}</strong> para el pedido <strong>#${this.esc(data.orderNumber)}</strong>.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0; font-size:13.5px;">
        <tr><td style="padding:6px 0; color:#94a3b8; width:140px;">Trámite</td><td style="padding:6px 0; color:#1a1f36; font-weight:600;">${this.esc(data.trackingNumber)}</td></tr>
        <tr><td style="padding:6px 0; color:#94a3b8;">Pedido</td><td style="padding:6px 0; color:#1a1f36;">#${this.esc(data.orderNumber)}</td></tr>
        <tr><td style="padding:6px 0; color:#94a3b8;">Motivo</td><td style="padding:6px 0; color:#1a1f36;">${this.esc(data.reasonLabel)}</td></tr>
        <tr><td style="padding:6px 0; color:#94a3b8;">Email del cliente</td><td style="padding:6px 0; color:#1a1f36;">${this.esc(data.email)}</td></tr>
        ${data.phone ? `<tr><td style="padding:6px 0; color:#94a3b8;">Teléfono</td><td style="padding:6px 0; color:#1a1f36;">${this.esc(data.phone)}</td></tr>` : ''}
      </table>
      ${data.comment ? `<p><strong>Comentario del cliente:</strong><br/>${this.esc(data.comment)}</p>` : ''}
      <p style="margin-top:16px; color:#697386;">Este caso se coordina directo con el cliente — respondele a su email (o al teléfono, si dejó uno) para avanzar. Órbita no gestiona la resolución de esta solicitud.</p>
    `;
  }
}
