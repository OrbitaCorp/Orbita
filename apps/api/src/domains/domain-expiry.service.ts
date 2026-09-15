import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

// Vencimiento de los dominios comprados desde el panel (auditoría interna,
// hallazgo `dominios-comprados-sin-renovacion`).
//
// Los dominios se compran en la cuenta de Vercel de OrbitaCorp con autoRenew
// apagado a propósito (no hay mecanismo de recobro: ver
// domain-purchase.service.ts). Hasta ahora nadie avisaba antes del
// vencimiento: el dueño se enteraba cuando su dominio dejaba de resolver.
//
// Este barrido corre en el mantenimiento nocturno (internal-cron) y hace dos
// cosas, las dos idempotentes:
//   1. Aviso por mail a los owners a los 30 y a los 7 días del vencimiento.
//      Sin columna nueva: la marca de "ya avisado" es el propio email_logs
//      (plantilla + negocio + dominio en el asunto, dentro del tramo). Un
//      dominio que entra en el barrido con 20 días recibe el aviso de 30 esa
//      misma noche y el de 7 cuando corresponda.
//   2. Pasa a EXPIRED el que ya venció (Vercel lo suelta solo; acá queda
//      reflejado en el panel). No manda mail: el dueño ya recibió dos.
//
// Cómo se cobra la renovación y la transferencia del dominio al dueño siguen
// siendo decisiones abiertas del hallazgo — esto solo evita que el vencimiento
// lo sorprenda.

const DIA_MS = 24 * 60 * 60 * 1000;
export const TRAMOS_AVISO_DIAS = [30, 7] as const;
export const TEMPLATE_DOMINIO_POR_VENCER = 'domain-expiring-soon';

@Injectable()
export class DomainExpiryService {
  private readonly logger = new Logger(DomainExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async avisarVencimientos(ahora: Date = new Date()): Promise<{ avisados: number; vencidos: number }> {
    const horizonte = new Date(ahora.getTime() + TRAMOS_AVISO_DIAS[0] * DIA_MS);
    const dominios = await this.prisma.customDomain.findMany({
      where: {
        source: 'PURCHASED',
        status: { in: ['PENDING', 'VERIFYING', 'ACTIVE'] },
        expiresAt: { not: null, lte: horizonte },
      },
      select: {
        id: true,
        domain: true,
        businessId: true,
        expiresAt: true,
        business: { select: { name: true, subdomain: true } },
      },
      orderBy: { expiresAt: 'asc' },
    });

    let avisados = 0;
    let vencidos = 0;
    for (const d of dominios) {
      if (!d.expiresAt) continue;
      try {
        if (d.expiresAt.getTime() <= ahora.getTime()) {
          await this.prisma.customDomain.update({ where: { id: d.id }, data: { status: 'EXPIRED' } });
          this.logger.warn(`Dominio ${d.domain} (negocio ${d.businessId}) venció el ${d.expiresAt.toISOString().slice(0, 10)}: queda EXPIRED`);
          vencidos++;
          continue;
        }
        const diasRestantes = Math.ceil((d.expiresAt.getTime() - ahora.getTime()) / DIA_MS);
        // El tramo que corresponde hoy: 7 si faltan 7 o menos, si no 30.
        const tramo = diasRestantes <= TRAMOS_AVISO_DIAS[1] ? TRAMOS_AVISO_DIAS[1] : TRAMOS_AVISO_DIAS[0];
        const inicioTramo = new Date(d.expiresAt.getTime() - tramo * DIA_MS);
        const yaAvisado = await this.prisma.emailLog.count({
          where: {
            businessId: d.businessId,
            template: TEMPLATE_DOMINIO_POR_VENCER,
            subject: { contains: d.domain },
            createdAt: { gte: inicioTramo },
          },
        });
        if (yaAvisado > 0) continue;

        const emails = await this.ownerEmails(d.businessId);
        if (emails.length === 0) {
          this.logger.warn(`Dominio ${d.domain} vence en ${diasRestantes} días y el negocio ${d.businessId} no tiene owner activo a quien avisar`);
          continue;
        }
        const data = {
          businessName: d.business.name,
          domain: d.domain,
          expiresAt: this.fecha(d.expiresAt),
          daysLeft: diasRestantes,
          manageUrl: `https://${d.business.subdomain}.orbita.site/admin/ventas/configuracion?vista=dominios`,
        };
        for (const email of emails) {
          await this.mail.sendDomainExpiringSoon(email, data, { businessId: d.businessId });
        }
        avisados++;
      } catch (e) {
        // Un dominio con problemas no frena a los demás ni al resto del
        // mantenimiento nocturno.
        this.logger.error(`Dominio ${d.domain}: no se pudo procesar el vencimiento — ${e instanceof Error ? e.message : e}`);
      }
    }
    if (dominios.length > 0) this.logger.log(`Vencimiento de dominios: ${avisados} avisados, ${vencidos} pasados a EXPIRED`);
    return { avisados, vencidos };
  }

  // Mismo criterio que los mails del ciclo de vida de la suscripción
  // (subscriptions.service.ts#ownerEmails): todos los owners activos.
  private async ownerEmails(businessId: string): Promise<string[]> {
    const owners = await this.prisma.member.findMany({
      where: { businessId, role: { name: 'owner' }, status: 'ACTIVE' },
      select: { email: true },
    });
    return owners.map((o) => o.email);
  }

  private fecha(d: Date): string {
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
  }
}
