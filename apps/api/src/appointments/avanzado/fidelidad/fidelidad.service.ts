import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import type { Paginado } from '../../appointments.types';
import { nombreDe } from '../comun/clientes';
import { AvanzadoContextoService, Db } from '../comun/contexto.service';
import { PaginacionDto, paginacion } from '../comun/paginado';
import { bloquear, enTransaccion } from '../comun/transacciones';
import { ReglasTarjeta, conUnSelloMas, reglasTarjeta, sellosVencidos } from './fidelidad.puro';

export interface FilaFidelidad {
  customerId: string;
  customerName: string;
  stamps: number;
  needed: number;
  rewardsAvailable: number;
  lastStampAt: string | null;
}

export interface ResultadoSello {
  /** false = el turno no sumó (cliente sin cuenta, sin tarjeta o por debajo del mínimo). */
  sumo: boolean;
  /** Este sello completó la tarjeta: hay un premio nuevo. */
  completo: boolean;
  stamps: number;
  needed: number;
  rewardsAvailable: number;
}

export interface PremioDisponible {
  stamps: number;
  needed: number;
  rewardsAvailable: number;
  premio: ReglasTarjeta['premio'];
}

/**
 * Programa de fidelidad (P4.5). Exporta para el núcleo de turnos:
 *
 * - `sumarSello`: al pasar un turno a COMPLETED (CONTRATO § 1.2), en la misma
 *   transacción. Solo clientes CON cuenta (contraseña o Google).
 * - `premioDisponible`: lo que muestra la ficha y "Mis turnos".
 */
@Injectable()
export class FidelidadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: AvanzadoContextoService,
    private readonly audit: AuditService,
  ) {}

  /** Qué tarjeta corre en el negocio (la de Avanzado o la básica); null = ninguna. */
  async reglas(businessId: string, tx: Db = this.prisma): Promise<ReglasTarjeta | null> {
    const { on, config, negocio } = await this.contexto.activa(businessId, 'fidelidad', tx);
    return reglasTarjeta(on ? config : null, negocio.settings.loyaltyStamps);
  }

  async listar(businessId: string, q: PaginacionDto): Promise<Paginado<FilaFidelidad>> {
    const reglas = await this.reglas(businessId);
    const { page, limit, skip } = paginacion(q);
    const where = { businessId, customer: { deletedAt: null } };
    const [total, tarjetas] = await Promise.all([
      this.prisma.appointmentLoyaltyCard.count({ where }),
      this.prisma.appointmentLoyaltyCard.findMany({
        where, include: { customer: { select: { firstName: true, lastName: true } } },
        orderBy: [{ lastStampAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }], skip, take: limit,
      }),
    ]);
    const ahora = new Date();
    return {
      data: tarjetas.map((t) => ({
        customerId: t.customerId,
        customerName: nombreDe(t.customer),
        stamps: reglas && sellosVencidos(t, reglas, ahora) ? 0 : t.stamps,
        needed: reglas?.needed ?? 0,
        rewardsAvailable: Math.max(0, t.rewardsEarned - t.rewardsRedeemed),
        lastStampAt: t.lastStampAt?.toISOString() ?? null,
      })),
      total, page, limit,
    };
  }

  /** Canjear un premio: rewardsRedeemed + 1, solo si hay uno ganado sin usar (condición en el update: dos clics no canjean dos). */
  async canjear(businessId: string, memberId: string, customerId: string): Promise<FilaFidelidad> {
    await this.contexto.delNegocio(businessId);
    const { count } = await this.prisma.appointmentLoyaltyCard.updateMany({
      where: { businessId, customerId, rewardsRedeemed: { lt: this.prisma.appointmentLoyaltyCard.fields.rewardsEarned } },
      data: { rewardsRedeemed: { increment: 1 } },
    });
    if (count === 0) {
      const existe = await this.prisma.appointmentLoyaltyCard.findFirst({ where: { businessId, customerId }, select: { id: true } });
      if (!existe) throw new NotFoundException('Ese cliente no tiene tarjeta de sellos.');
      throw new BadRequestException('No tiene premios para canjear.');
    }
    await this.audit.registrar({ businessId, memberId, entityType: 'appointment_loyalty_card', entityId: customerId, action: 'UPDATE', changes: [{ field: 'rewardsRedeemed', before: null, after: '+1' }] });
    const reglas = await this.reglas(businessId);
    const t = await this.prisma.appointmentLoyaltyCard.findFirst({ where: { businessId, customerId }, include: { customer: { select: { firstName: true, lastName: true } } } });
    return {
      customerId, customerName: nombreDe(t!.customer), stamps: t!.stamps, needed: reglas?.needed ?? 0,
      rewardsAvailable: Math.max(0, t!.rewardsEarned - t!.rewardsRedeemed), lastStampAt: t!.lastStampAt?.toISOString() ?? null,
    };
  }

  // ── Para enchufar en el núcleo ───────────────────────────────────────────

  /**
   * Un sello por turno COMPLETED de un cliente con cuenta. `monto` = lo que
   * pagó el turno (price - discount), para la regla "suma desde $X". Llamarlo
   * con el `tx` de la transición de estado: el lock por cliente evita que dos
   * turnos completados a la vez pisen la tarjeta.
   */
  async sumarSello(p: { businessId: string; customerId: string | null; monto: number }, tx?: Db): Promise<ResultadoSello> {
    const nada = (needed = 0): ResultadoSello => ({ sumo: false, completo: false, stamps: 0, needed, rewardsAvailable: 0 });
    if (!p.customerId) return nada();
    return enTransaccion(this.prisma, tx, async (t) => {
      const reglas = await this.reglas(p.businessId, t);
      if (!reglas) return nada();
      const cliente = await t.customer.findFirst({ where: { id: p.customerId!, businessId: p.businessId, deletedAt: null }, select: { passwordHash: true, googleId: true } });
      if (!cliente || (!cliente.passwordHash && !cliente.googleId)) return nada(reglas.needed);

      await bloquear(t, `appt-sellos:${p.customerId}`);
      const ahora = new Date();
      let tarjeta = await t.appointmentLoyaltyCard.findFirst({ where: { businessId: p.businessId, customerId: p.customerId! } });
      if (!tarjeta) {
        tarjeta = await t.appointmentLoyaltyCard.create({
          data: { businessId: p.businessId, customerId: p.customerId!, stamps: reglas.selloDeBienvenida ? 1 : 0, lastStampAt: reglas.selloDeBienvenida ? ahora : null },
        });
      }
      const nueva = conUnSelloMas(tarjeta, reglas, p.monto, ahora);
      if (nueva.sumo) {
        const { count } = await t.appointmentLoyaltyCard.updateMany({
          where: { id: tarjeta.id, businessId: p.businessId },
          data: { stamps: nueva.stamps, rewardsEarned: nueva.rewardsEarned, lastStampAt: nueva.lastStampAt },
        });
        if (count === 0) return nada(reglas.needed);
      }
      return {
        sumo: nueva.sumo, completo: nueva.completo, stamps: nueva.stamps, needed: reglas.needed,
        rewardsAvailable: Math.max(0, nueva.rewardsEarned - tarjeta.rewardsRedeemed),
      };
    });
  }

  /** La tarjeta de un cliente y su premio (null = el negocio no tiene tarjeta). */
  async premioDisponible(businessId: string, customerId: string, tx: Db = this.prisma): Promise<PremioDisponible | null> {
    const reglas = await this.reglas(businessId, tx);
    if (!reglas) return null;
    const t = await tx.appointmentLoyaltyCard.findFirst({ where: { businessId, customerId } });
    const stamps = t && !sellosVencidos(t, reglas, new Date()) ? t.stamps : 0;
    return { stamps, needed: reglas.needed, rewardsAvailable: t ? Math.max(0, t.rewardsEarned - t.rewardsRedeemed) : 0, premio: reglas.premio };
  }
}
