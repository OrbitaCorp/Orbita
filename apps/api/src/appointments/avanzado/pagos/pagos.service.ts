import { Injectable } from '@nestjs/common';
import { AppointmentPaymentKind } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { fechaArgentina } from '../../../common/utils/hora-argentina';
import { AvanzadoContextoService, Db } from '../comun/contexto.service';
import { enTransaccion } from '../comun/transacciones';
import { venceA } from '../gift-cards/gift-cards.service';
import { proximoDiaDeCobro, venceElDia } from '../membresias/membresias.puro';

const DIA_MS = 24 * 3600 * 1000;

/**
 * Lo que pasa cuando Mercado Pago aprueba un pago de algo de Avanzado vendido
 * en el sitio. El webhook es de P2 (`POST webhooks/mercadopago/appointments`,
 * CONTRATO § P2.5): cuando marca APPROVED un AppointmentPayment de kind
 * PACKAGE, GIFT_CARD o MEMBERSHIP, tiene que llamar a `aplicarPagoAprobado`
 * (idealmente en la misma transacción). Es idempotente: un pago que llega dos
 * veces no hace nada la segunda.
 */
@Injectable()
export class AvanzadoPagosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: AvanzadoContextoService,
  ) {}

  async aplicarPagoAprobado(businessId: string, appointmentPaymentId: string, tx?: Db): Promise<{ kind: AppointmentPaymentKind | null; aplicado: boolean }> {
    return enTransaccion(this.prisma, tx, async (t) => {
      const pago = await t.appointmentPayment.findFirst({ where: { id: appointmentPaymentId, businessId } });
      if (!pago) return { kind: null, aplicado: false };
      const ahora = pago.paidAt ?? new Date();

      if (pago.kind === 'PACKAGE' && pago.packagePurchaseId) {
        const compra = await t.appointmentPackagePurchase.findFirst({ where: { id: pago.packagePurchaseId, businessId }, include: { package: { select: { validDays: true } } } });
        if (!compra) return { kind: pago.kind, aplicado: false };
        // El vencimiento corre desde que se pagó, no desde que se abrió el checkout.
        const expiresAt = compra.package.validDays > 0 ? new Date(ahora.getTime() + compra.package.validDays * DIA_MS) : null;
        const { count } = await t.appointmentPackagePurchase.updateMany({ where: { id: compra.id, businessId, paidAt: null }, data: { paidAt: ahora, expiresAt } });
        return { kind: pago.kind, aplicado: count > 0 };
      }

      if (pago.kind === 'GIFT_CARD' && pago.giftCardId) {
        const negocio = await this.contexto.delNegocio(businessId, t);
        const { config } = this.contexto.funcion(negocio.settings, 'gift-cards');
        const { count } = await t.appointmentGiftCard.updateMany({
          where: { id: pago.giftCardId, businessId, paidAt: null },
          data: { paidAt: ahora, expiresAt: venceA(ahora, config.mesesValidez) },
        });
        return { kind: pago.kind, aplicado: count > 0 };
      }

      if (pago.kind === 'MEMBERSHIP' && pago.membershipId) {
        const negocio = await this.contexto.delNegocio(businessId, t);
        const { config } = this.contexto.funcion(negocio.settings, 'membresias');
        const m = await t.appointmentMembership.findFirst({ where: { id: pago.membershipId, businessId } });
        if (!m || m.status === 'CANCELLED' || (m.lastPaidAt && m.lastPaidAt.getTime() >= ahora.getTime())) return { kind: pago.kind, aplicado: false };
        const base = m.nextChargeAt && m.nextChargeAt.getTime() > ahora.getTime() - 31 * DIA_MS ? fechaArgentina(m.nextChargeAt) : fechaArgentina(ahora);
        const { count } = await t.appointmentMembership.updateMany({
          where: { id: m.id, businessId },
          data: { lastPaidAt: ahora, nextChargeAt: venceElDia(proximoDiaDeCobro(base, config.diaCobro)), ...(m.status === 'PAST_DUE' ? { status: 'ACTIVE' as const } : {}) },
        });
        return { kind: pago.kind, aplicado: count > 0 };
      }
      return { kind: pago.kind, aplicado: false };
    });
  }
}
