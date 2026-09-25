import * as crypto from 'crypto';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';

// Auditoría interna, ítem `decision.webhook-cobros-vacio` (16/09): la tabla
// `subscription_payments` estaba VACÍA en producción aunque la única
// preapproval que llegó a cobrar (negocio `jaja`) tenía 16 cobros reales en
// Mercado Pago (3 aprobados + 13 rechazados entre el 31/07 y el 18/08).
//
// Dos caminos por los que un cobro que SÍ llegó terminaba sin registrarse:
//
//   1. `subscription_authorized_payment` — el tipo con el que MP avisa cada
//      cobro recurrente de una suscripción — manda en `data.id` el id del
//      "authorized payment" (/authorized_payments/{id}), NO el del pago.
//      El webhook se lo pedía a /v1/payments, MP devolvía 404, la excepción
//      caía en el catch general y el cobro no quedaba en ningún lado.
//   2. `recordPayment` descartaba el cobro entero si el plan de la
//      suscripción no era una PlanKey ('standard' del @default del schema o
//      el 'starter' del alta vieja — 5 de las 8 suscripciones de producción,
//      incluida la única que tenía preapproval). Se perdía el rastro de plata
//      que ya se había movido.
//
// Además: los caminos que devuelven `recorded: false` ahora dicen por qué.

const BIZ = 'biz-1';
const SECRET = 'un-secreto-cualquiera';

function firmar(dataId: string, requestId: string, ts: number) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const hash = crypto.createHmac('sha256', SECRET).update(manifest).digest('hex');
  return `ts=${ts},v1=${hash}`;
}

function armar(opts: { plan?: string; mpStatus?: string; yaRegistrado?: boolean; extRef?: string | undefined; sinSub?: boolean; subStatus?: string } = {}) {
  const tx = {
    subscriptionPayment: { create: jest.fn() },
    subscription: { update: jest.fn() },
    business: { update: jest.fn() },
  };
  const finDePeriodo = new Date(Date.now() - 86_400_000);
  const prisma = {
    subscription: {
      findUnique: jest.fn().mockResolvedValue(
        opts.sinSub
          ? null
          : {
              id: 'sub-1',
              businessId: BIZ,
              plan: opts.plan ?? 'mensual',
              status: opts.subStatus ?? 'SUSPENDED',
              amount: 16500,
              currentPeriodEnd: finDePeriodo,
            },
      ),
    },
    subscriptionPayment: { findFirst: jest.fn().mockResolvedValue(opts.yaRegistrado ? { id: 'pay-viejo' } : null) },
    platformAdminLog: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb(tx)),
  };
  const config = { get: (k: string) => (k === 'MP_WEBHOOK_SECRET' ? SECRET : undefined) };
  const mail = { sendSubscriptionReactivated: jest.fn().mockResolvedValue(undefined) };
  const eventEmitter = { emit: jest.fn() };
  const svc = new SubscriptionsService(prisma as any, config as any, {} as any, {} as any, {} as any, {} as any, mail as any, undefined, eventEmitter as any);
  const payment = {
    get: jest.fn().mockImplementation(({ id }: { id: string }) => {
      // MP responde 404 a un id de authorized_payment pedido como pago.
      if (id === '7031052073') return Promise.reject(new Error('Payment not found'));
      return Promise.resolve({
        external_reference: 'extRef' in opts ? opts.extRef : BIZ,
        status: opts.mpStatus ?? 'approved',
        transaction_amount: 16500,
        date_approved: '2026-09-16T10:00:00.000Z',
      });
    }),
  };
  const invoice = {
    get: jest.fn().mockResolvedValue({
      id: '7031052073',
      preapproval_id: 'pre-1',
      status: 'processed',
      payment: { id: '174389217360', status: 'approved', status_detail: 'accredited' },
    }),
  };
  (svc as any)._payment = payment;
  (svc as any)._invoice = invoice;
  jest.spyOn(svc as any, 'syncAddonAvanzado').mockResolvedValue(undefined);
  jest.spyOn(svc as any, 'notificarReactivacion').mockResolvedValue(undefined);
  jest.spyOn(svc as any, 'notificarPagoFallido').mockResolvedValue(undefined);
  return { svc, prisma, tx, payment, invoice, eventEmitter };
}

// Un webhook de MP ya firmado, listo para pasar la validación de firma.
function webhook(type: string, dataId: string) {
  const ts = Math.floor(Date.now() / 1000);
  return [
    { type, data: { id: dataId } },
    { 'x-signature': firmar(dataId, 'req-1', ts), 'x-request-id': 'req-1' },
    { 'data.id': dataId },
  ] as const;
}

describe('Webhook de cobro recurrente (subscription_authorized_payment)', () => {
  it('resuelve el pago real desde /authorized_payments y lo registra', async () => {
    const { svc, tx, invoice, payment } = armar();
    await svc.handleWebhook(...webhook('subscription_authorized_payment', '7031052073'));

    expect(invoice.get).toHaveBeenCalledWith({ id: '7031052073' });
    // El id que se le pide a /v1/payments es el de adentro de la factura, no
    // el del aviso: pedirle el del aviso da 404 y no se registra nada.
    expect(payment.get).toHaveBeenCalledWith({ id: '174389217360' });
    expect(tx.subscriptionPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ mpPaymentId: '174389217360', status: 'APPROVED' }) }),
    );
  });

  it('una factura sin pago asociado todavía no registra nada, pero no revienta', async () => {
    const { svc, tx, invoice } = armar();
    invoice.get.mockResolvedValue({ id: '7031052073', preapproval_id: 'pre-1', status: 'scheduled' });
    await expect(svc.handleWebhook(...webhook('subscription_authorized_payment', '7031052073'))).resolves.toEqual({ received: true });
    expect(tx.subscriptionPayment.create).not.toHaveBeenCalled();
  });

  it('un aviso de pago común (`payment`) sigue yendo derecho a /v1/payments', async () => {
    const { svc, payment, invoice, tx } = armar();
    await svc.handleWebhook(...webhook('payment', '174389217360'));
    expect(invoice.get).not.toHaveBeenCalled();
    expect(payment.get).toHaveBeenCalledWith({ id: '174389217360' });
    expect(tx.subscriptionPayment.create).toHaveBeenCalled();
  });
});

describe('recordPayment: un cobro real nunca se pierde', () => {
  it('plan desconocido (filas viejas con "starter"/"standard"): registra el cobro igual', async () => {
    const { svc, tx } = armar({ plan: 'starter' });
    const r = await svc.recordPayment('174389217360');

    expect(r).toMatchObject({ recorded: true, approved: true, renewed: false });
    expect(tx.subscriptionPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subscriptionId: 'sub-1', status: 'APPROVED', amount: expect.anything() }) }),
    );
    // Sin plan no hay ciclo: el período no se renueva ni se reabre la tienda.
    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.business.update).not.toHaveBeenCalled();
  });

  it('con un plan conocido sí renueva el período y reabre la tienda suspendida por mora', async () => {
    const { svc, tx } = armar({ plan: 'mensual' });
    const r = await svc.recordPayment('174389217360');

    expect(r).toMatchObject({ recorded: true, renewed: true });
    expect(tx.subscription.update).toHaveBeenCalled();
    expect(tx.business.update).toHaveBeenCalledWith({ where: { id: BIZ }, data: { isActive: true, isPaused: false } });
  });

  it('un cobro rechazado queda registrado como FAILED con el motivo de MP', async () => {
    const { svc, tx } = armar({ mpStatus: 'rejected' });
    (svc as any)._payment.get = jest.fn().mockResolvedValue({
      external_reference: BIZ, status: 'rejected', status_detail: 'cc_rejected_insufficient_amount', transaction_amount: 16500,
    });
    await svc.recordPayment('172852461415');
    expect(tx.subscriptionPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', failedReason: 'cc_rejected_insufficient_amount', paidAt: null }) }),
    );
  });

  // sendSubscriptionPaymentFailed tenía plantilla y función armadas pero
  // ningún llamador (auditoría de mails, pedido explícito de cablearla):
  // recordPayment() es el webhook real de MP, así que es acá donde tiene
  // que dispararse — no en el barrido nocturno, que recién avisa al otro
  // día con un texto genérico.
  it('un cobro rechazado avisa al dueño por mail, uno aprobado no', async () => {
    const rechazado = armar({ mpStatus: 'rejected' });
    (rechazado.svc as any)._payment.get = jest.fn().mockResolvedValue({
      external_reference: BIZ, status: 'rejected', status_detail: 'cc_rejected_insufficient_amount', transaction_amount: 16500,
    });
    await rechazado.svc.recordPayment('172852461415');
    expect((rechazado.svc as any).notificarPagoFallido).toHaveBeenCalledWith(BIZ, expect.objectContaining({ id: 'sub-1' }), 16500);

    const aprobado = armar({ plan: 'mensual' });
    await aprobado.svc.recordPayment('174389217360');
    expect((aprobado.svc as any).notificarPagoFallido).not.toHaveBeenCalled();
  });

  // cobro_suscripcion (ver notifications.service.ts) — la renovación normal
  // (la sub ya estaba ACTIVE) avisa con el recibo simple; una que saca de
  // mora (SUSPENDED→ACTIVE) NO lo duplica, ya manda notificarReactivacion.
  it('una renovación normal (ya ACTIVE) avisa cobro_suscripcion; una reactivación de mora no', async () => {
    const renovacion = armar({ plan: 'mensual', subStatus: 'ACTIVE' });
    await renovacion.svc.recordPayment('174389217360');
    expect(renovacion.eventEmitter.emit).toHaveBeenCalledWith('notification.cobro_suscripcion', { businessId: BIZ, amount: 16500 });
    expect((renovacion.svc as any).notificarReactivacion).not.toHaveBeenCalled();

    const reactivacion = armar({ plan: 'mensual', subStatus: 'SUSPENDED' });
    await reactivacion.svc.recordPayment('174389217360');
    expect(reactivacion.eventEmitter.emit).not.toHaveBeenCalledWith('notification.cobro_suscripcion', expect.anything());
    expect((reactivacion.svc as any).notificarReactivacion).toHaveBeenCalled();
  });

  it('cada camino que no registra dice por qué', async () => {
    const sinRef = armar({ extRef: undefined });
    await expect(sinRef.svc.recordPayment('1')).resolves.toEqual({ recorded: false, reason: 'sin_external_reference' });

    const sinSub = armar({ sinSub: true });
    await expect(sinSub.svc.recordPayment('1')).resolves.toEqual({ recorded: false, reason: 'sin_suscripcion' });

    const repetido = armar({ yaRegistrado: true });
    await expect(repetido.svc.recordPayment('1')).resolves.toEqual({ recorded: false, duplicated: true, reason: 'duplicado' });
    expect(repetido.tx.subscriptionPayment.create).not.toHaveBeenCalled();
  });
});
