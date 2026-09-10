import { randomBytes } from 'crypto';
import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorefrontService } from '../storefront/storefront.service';
import { MailService } from '../mail/mail.service';
import { escaparHtml } from '../common/utils/html';
import { CreateReturnRequestDto, ReturnRequestReason } from './dto/create-return-request.dto';

// Un solo mensaje para "no existe ese pedido" y "el email no es el de la
// compra": distinguirlos le diría a un desconocido qué números de pedido
// existen en la tienda.
const PEDIDO_NO_COINCIDE =
  'No encontramos un pedido con ese número y ese email en esta tienda. Revisá el número (está en el mail de confirmación de tu compra) y usá el mismo email con el que compraste.';

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

// Texto legal que acompaña cada motivo, del lado del CLIENTE — informativo
// nada más (la verificación real del plazo/resolución la hace el comercio a
// mano, ver decisión RBT-683 en Jira: sin validación automática contra el
// pedido).
const REASON_LEGAL_NOTE: Record<ReturnRequestReason, string> = {
  [ReturnRequestReason.ARREPENTIMIENTO]:
    'Válido dentro de los 10 días corridos desde la entrega (Ley 24.240 / Disp. 954-2025). Da derecho al reintegro del dinero, sin costo para el comprador.',
  [ReturnRequestReason.GARANTIA]:
    'Válido dentro de los 6 meses desde la entrega (Ley 24.240). El comercio debe ofrecer reparación, cambio por otro igual o reintegro del dinero, a elección del comprador.',
  [ReturnRequestReason.OTRO]:
    'Se resuelve según la política de cambios propia de esta tienda (fuera de los plazos legales de arrepentimiento/garantía).',
};

// Mismo marco legal, pero redactado como OBLIGACIÓN para quien lo recibe —
// no todo dueño de comercio conoce el detalle de la Ley 24.240/Disp.
// 954-2025, y el aviso es el único lugar donde Órbita puede mencionárselo
// (pedido explícito: "hay que hacerle entender o mencionar la ley"). Sigue
// siendo informativo, no reemplaza asesoramiento legal — por eso no dice
// "estás obligado a" en términos tajantes, dice qué corresponde por ley.
const REASON_LEGAL_NOTE_COMERCIO: Record<ReturnRequestReason, string> = {
  [ReturnRequestReason.ARREPENTIMIENTO]:
    'Por la Ley 24.240 (Disp. 954-2025), el cliente tiene derecho a arrepentirse de la compra dentro de los 10 días corridos desde la entrega. Si el pedido está dentro de ese plazo, corresponde el reintegro del dinero — los gastos de devolución del producto son a tu cargo, no del cliente.',
  [ReturnRequestReason.GARANTIA]:
    'Por la Ley 24.240, la garantía legal por defectos es de 6 meses desde la entrega. Ante un producto fallado o dañado dentro de ese plazo, la elección entre reparación, cambio por otro igual o reintegro del dinero es del cliente, no tuya — y no tiene costo para él.',
  [ReturnRequestReason.OTRO]:
    'Este motivo no está alcanzado por los plazos legales de arrepentimiento ni de garantía — se resuelve según tu propia política de cambios.',
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

  // Este HTML se arma a mano (no con Handlebars, que ya escapa por default) a
  // partir de texto que tipeó un desconocido sin sesión, así que nunca puede
  // insertarse tal cual.
  private esc(value: string): string {
    return escaparHtml(value);
  }

  // Auditoría interna 2026-09-10 (ítem api.return-requests): el formulario no
  // miraba ni el pedido ni el email, así que cualquiera podía hacer que Órbita
  // mandara, con el nombre de la tienda y un comentario a su gusto, un mail a
  // cualquier dirección — y llenarle la casilla al comercio con pedidos
  // inventados. Ahora el pedido tiene que existir en ESTA tienda y el email
  // tiene que ser el de la compra (el que quedó en el pedido o el de la cuenta
  // del cliente), mismo criterio que el seguimiento público
  // (OrdersService.findOneForTracking). Sigue sin validar plazos ni estado del
  // pedido: eso lo resuelve el comercio (decisión RBT-683).
  private async pedidoDelComprador(businessId: string, orderNumber: string, email: string): Promise<number> {
    const order = await this.prisma.order.findFirst({
      where: { businessId, orderNumber: Number(orderNumber), deletedAt: null },
      select: {
        orderNumber: true,
        customer: { select: { email: true } },
        onlineOrderDetails: { select: { buyerEmail: true } },
      },
    });
    const emailsDeLaCompra = [order?.onlineOrderDetails?.buyerEmail, order?.customer?.email]
      .filter((e): e is string => !!e)
      .map((e) => e.trim().toLowerCase());
    if (!order || !emailsDeLaCompra.includes(email.trim().toLowerCase())) {
      throw new UnprocessableEntityException(PEDIDO_NO_COINCIDE);
    }
    return order.orderNumber;
  }

  async create(slug: string, dto: CreateReturnRequestDto): Promise<{ trackingNumber: string }> {
    const businessId = await this.storefrontService.resolveBusinessId(slug);
    const orderNumber = String(await this.pedidoDelComprador(businessId, dto.orderNumber, dto.email));
    const [businessConfig, business] = await Promise.all([
      this.prisma.businessConfig.findUnique({ where: { businessId }, select: { email: true } }),
      this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
    ]);
    const storeName = business?.name ?? 'la tienda';
    const merchantEmail = businessConfig?.email ?? null;
    const trackingNumber = this.generarNumeroTramite(dto.reason);
    const reasonLabel = REASON_LABEL[dto.reason];
    const legalNote = REASON_LEGAL_NOTE[dto.reason];
    const legalNoteComercio = REASON_LEGAL_NOTE_COMERCIO[dto.reason];

    // 1) Acuse de recibo al cliente — obligatorio e inmediato, no puede
    // depender de que el comercio abra o responda nada. Si falla el envío,
    // igual devolvemos el número de trámite (se muestra en pantalla, punto 2
    // del requisito) — no queremos que un mail caído tire abajo el reclamo.
    try {
      await this.mailService.sendCustomEmail(
        dto.email,
        `Recibimos tu solicitud — Trámite ${trackingNumber}`,
        this.armarHtmlCliente({ trackingNumber, reasonLabel, legalNote, orderNumber, storeName, comment: dto.comment }),
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
          `Nueva solicitud de ${reasonLabel} — Pedido #${orderNumber}`,
          this.armarHtmlComercio({ trackingNumber, reasonLabel, legalNote: legalNoteComercio, orderNumber, email: dto.email, phone: dto.phone, comment: dto.comment }),
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
    trackingNumber: string; reasonLabel: string; legalNote: string; orderNumber: string; email: string; phone?: string; comment?: string;
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
      <div style="margin-top:16px; padding:12px 14px; background:#fdf1e0; border-left:3px solid #b45309; border-radius:6px;">
        <div style="font-size:10.5px; text-transform:uppercase; letter-spacing:.06em; color:#b45309; font-weight:700; margin-bottom:4px;">Qué dice la ley</div>
        <div style="color:#7c4a10; font-size:13px; line-height:1.6;">${this.esc(data.legalNote)}</div>
      </div>
      <p style="margin-top:16px; color:#697386;">Este caso se coordina directo con el cliente — respondele a su email (o al teléfono, si dejó uno) para avanzar. Órbita no gestiona la resolución de esta solicitud ni te reemplaza como asesoramiento legal.</p>
    `;
  }
}
