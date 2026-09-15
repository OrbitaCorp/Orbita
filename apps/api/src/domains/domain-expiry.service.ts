import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { TEMPLATE_DOMINIO_POR_VENCER, marcaAsuntoDominio } from './dominio-por-vencer';

// Vencimiento de los dominios comprados desde el panel (auditoría interna,
// hallazgo `dominios-comprados-sin-renovacion`).
//
// Los dominios se compran en la cuenta de Vercel de OrbitaCorp con autoRenew
// apagado a propósito (no hay mecanismo de recobro: ver
// domain-purchase.service.ts). Hasta ahora nadie avisaba antes del
// vencimiento: el dueño se enteraba cuando su dominio dejaba de resolver.
//
// Decidido el 15/09 (ver el hallazgo en audit-seed.ts): la renovación es
// manual, a pedido del dueño, y se cobra aparte al precio del registrador; la
// transferencia se hace a pedido, por soporte. Después de renovar en Vercel,
// soporte corre scripts/dominios/registrar-renovacion.cjs para correr
// expires_at. Si no, este barrido seguiría avisando con la fecha vieja.
//
// Corre en el mantenimiento nocturno (internal-cron) y SOLO avisa:
//   - Mail a cada owner activo a los 30 y a los 7 días del vencimiento.
//   - Cuenta como avisado un owner que ya tiene en email_logs una fila SENT
//     con esta plantilla, este negocio, la marca del dominio en el asunto y
//     fecha dentro del tramo. Un envío FAILED (rechazo o caída de Resend) o
//     SIMULATED (una API local sin Resend) no cuenta: la noche siguiente se
//     reintenta, y solo a los owners que faltan.
//   - No cambia el estado del dominio. Pasarlo a EXPIRED lo sacaría del CORS de
//     la API (main.ts solo acepta dominios ACTIVE) aunque se haya renovado con
//     la fecha sin actualizar. Un dominio vencido de verdad deja de resolver
//     solo; acá queda en el log del servidor.

const DIA_MS = 24 * 60 * 60 * 1000;
export const TRAMOS_AVISO_DIAS = [30, 7] as const;
export { TEMPLATE_DOMINIO_POR_VENCER };

interface DominioPorVencer {
  id: string;
  domain: string;
  businessId: string;
  expiresAt: Date | null;
  business: { name: string; subdomain: string };
}

export interface ResultadoVencimientos {
  // Dominios con al menos un aviso que salió esta noche.
  avisados: number;
  // Dominios que ya figuran vencidos (no se tocan: ver arriba).
  vencidos: number;
  // Envíos que no salieron esta noche (se reintentan la próxima).
  fallidos: number;
}

@Injectable()
export class DomainExpiryService {
  private readonly logger = new Logger(DomainExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async avisarVencimientos(ahora: Date = new Date()): Promise<ResultadoVencimientos> {
    const horizonte = new Date(ahora.getTime() + TRAMOS_AVISO_DIAS[0] * DIA_MS);
    const dominios: DominioPorVencer[] = await this.prisma.customDomain.findMany({
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

    const resultado: ResultadoVencimientos = { avisados: 0, vencidos: 0, fallidos: 0 };
    for (const d of dominios) {
      if (!d.expiresAt) continue;
      if (d.expiresAt.getTime() <= ahora.getTime()) {
        this.logger.warn(
          `Dominio ${d.domain} (negocio ${d.businessId}) figura vencido desde el ${d.expiresAt.toISOString().slice(0, 10)}: si se renovó, falta correr scripts/dominios/registrar-renovacion.cjs`,
        );
        resultado.vencidos++;
        continue;
      }
      try {
        const { enviados, fallidos } = await this.avisarDominio(d as DominioPorVencer & { expiresAt: Date }, ahora);
        if (enviados > 0) resultado.avisados++;
        resultado.fallidos += fallidos;
      } catch (e) {
        // Un dominio con problemas (por ejemplo, la consulta a email_logs) no
        // frena a los demás ni al resto del mantenimiento nocturno.
        this.logger.error(`Dominio ${d.domain}: no se pudo procesar el vencimiento — ${e instanceof Error ? e.message : e}`);
      }
    }
    if (dominios.length > 0) {
      this.logger.log(
        `Vencimiento de dominios: ${resultado.avisados} avisados, ${resultado.fallidos} envíos fallidos (se reintentan), ${resultado.vencidos} figuran vencidos`,
      );
    }
    return resultado;
  }

  private async avisarDominio(d: DominioPorVencer & { expiresAt: Date }, ahora: Date): Promise<{ enviados: number; fallidos: number }> {
    const diasRestantes = Math.ceil((d.expiresAt.getTime() - ahora.getTime()) / DIA_MS);
    // El tramo que corresponde hoy: 7 si faltan 7 o menos, si no 30.
    const tramo = diasRestantes <= TRAMOS_AVISO_DIAS[1] ? TRAMOS_AVISO_DIAS[1] : TRAMOS_AVISO_DIAS[0];
    const inicioTramo = new Date(d.expiresAt.getTime() - tramo * DIA_MS);

    const emails = await this.ownerEmails(d.businessId);
    if (emails.length === 0) {
      this.logger.warn(`Dominio ${d.domain} vence en ${diasRestantes} días y el negocio ${d.businessId} no tiene owner activo a quien avisar`);
      return { enviados: 0, fallidos: 0 };
    }

    const yaAvisados = await this.prisma.emailLog.findMany({
      where: {
        businessId: d.businessId,
        template: TEMPLATE_DOMINIO_POR_VENCER,
        status: 'SENT',
        to: { in: emails },
        subject: { contains: marcaAsuntoDominio(d.domain) },
        createdAt: { gte: inicioTramo },
      },
      select: { to: true },
    });
    const avisados = new Set(yaAvisados.map((l) => l.to));
    const pendientes = emails.filter((email) => !avisados.has(email));
    if (pendientes.length === 0) return { enviados: 0, fallidos: 0 };

    const data = {
      businessName: d.business.name,
      domain: d.domain,
      expiresAt: this.fecha(d.expiresAt),
      daysLeft: diasRestantes,
      manageUrl: `https://${d.business.subdomain}.orbita.site/admin/ventas/configuracion?vista=dominios`,
    };
    let enviados = 0;
    let fallidos = 0;
    // Uno por uno y cada uno con su try: un owner cuyo envío tira no deja sin
    // aviso a los demás.
    for (const email of pendientes) {
      try {
        if (await this.mail.sendDomainExpiringSoon(email, data, { businessId: d.businessId })) enviados++;
        else fallidos++;
      } catch (e) {
        fallidos++;
        this.logger.error(`Dominio ${d.domain}: no salió el aviso a ${email} — ${e instanceof Error ? e.message : e}`);
      }
    }
    return { enviados, fallidos };
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
