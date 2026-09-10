import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CancellationsService } from '../../src/cancellations/cancellations.service';
import { OrdersService } from '../../src/orders/orders.service';

// Auditoría interna 2026-09-10, ítem `api.cancellations`.
//
// El cliente puede pedir cancelar un pedido CONFIRMADO o EN PREPARACIÓN, pero
// la máquina de estados no dejaba cancelar desde "en preparación", y aprobar
// marcaba la solicitud ANTES de cancelar el pedido: la solicitud quedaba
// APROBADA, el pedido seguía y no se reembolsaba nada. Ahora primero se
// cancela (con la transición habilitada para solicitudes aceptadas) y recién
// después se marca la solicitud.

const BIZ = 'biz-1';
const ORDEN = { orderNumber: 7, customerId: 'c-1', customer: { firstName: 'Ana', lastName: null, email: 'ana@x.com' }, onlineOrderDetails: null };

function cancelaciones(opts: { status?: string; refundMethod?: string; claim?: number; updateStatus?: jest.Mock; pagoMp?: boolean } = {}) {
  const solicitud = {
    id: 'cr-1', orderId: 'o-1', reason: 'me equivoqué', status: opts.status ?? 'PENDING', refundMethod: opts.refundMethod ?? 'REFUND',
    refundStatus: null, createdAt: new Date(), order: { ...ORDEN, id: 'o-1', total: 15000 },
  };
  const prisma = {
    cancellationRequest: {
      findFirst: jest.fn().mockResolvedValue(solicitud),
      updateMany: jest.fn().mockResolvedValue({ count: opts.claim ?? 1 }),
      update: jest.fn().mockResolvedValue({}),
      findFirstOrThrow: jest.fn().mockResolvedValue({ ...solicitud, status: 'APPROVED' }),
    },
    payment: {
      findFirst: jest.fn().mockResolvedValue(opts.pagoMp ? { id: 'pay-9', mpPaymentId: 'mp-9' } : null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    creditNote: { create: jest.fn().mockResolvedValue({}) },
  };
  const orders = { updateStatus: opts.updateStatus ?? jest.fn().mockResolvedValue(undefined) };
  const mp = { refundPayment: jest.fn().mockResolvedValue({ id: 'r-1' }) };
  const mail = { sendCustomEmail: jest.fn().mockResolvedValue(true) };
  const svc = new CancellationsService(prisma as any, mail as any, { emit: jest.fn() } as any, orders as any, mp as any);
  return { svc, prisma, orders, mp, mail };
}

describe('Aprobar una solicitud de cancelación', () => {
  it('cancela el pedido primero (con la transición de solicitud) y recién después marca la solicitud', async () => {
    const { svc, prisma, orders, mp } = cancelaciones({ pagoMp: true });
    await svc.approve(BIZ, 'm-1', 'cr-1');
    expect(orders.updateStatus).toHaveBeenCalledWith(BIZ, 'm-1', 'o-1', 'CANCELLED', { porSolicitudDeCancelacion: true });
    expect(orders.updateStatus.mock.invocationCallOrder[0]).toBeLessThan(prisma.cancellationRequest.updateMany.mock.invocationCallOrder[0]);
    expect(mp.refundPayment).toHaveBeenCalledWith(BIZ, 'mp-9');
    // Reembolsado de verdad: el pago deja de contar como ingreso.
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({ where: { id: 'pay-9', businessId: BIZ, status: 'APPROVED' }, data: { status: 'REFUNDED' } });
  });

  it('si el reembolso de MP falla, el pago sigue aprobado', async () => {
    const { svc, prisma, mp } = cancelaciones({ pagoMp: true });
    mp.refundPayment.mockRejectedValue(new Error('MP caído'));
    await svc.approve(BIZ, 'm-1', 'cr-1');
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    expect(prisma.cancellationRequest.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ refundStatus: 'FAILED' }) }));
  });

  it('si el pedido no se puede cancelar (ya salió), la solicitud NO queda aprobada ni se reembolsa', async () => {
    const { svc, prisma, mp } = cancelaciones({ pagoMp: true, updateStatus: jest.fn().mockRejectedValue(new UnprocessableEntityException('No se puede pasar de "Enviado" a "Cancelado"')) });
    await expect(svc.approve(BIZ, 'm-1', 'cr-1')).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.cancellationRequest.updateMany).not.toHaveBeenCalled();
    expect(mp.refundPayment).not.toHaveBeenCalled();
  });

  it('una solicitud ya resuelta no toca el pedido', async () => {
    const { svc, orders } = cancelaciones({ status: 'APPROVED' });
    await expect(svc.approve(BIZ, 'm-1', 'cr-1')).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(orders.updateStatus).not.toHaveBeenCalled();
  });

  it('si otro la resolvió justo en el medio, no hay reembolso automático', async () => {
    const { svc, mp } = cancelaciones({ pagoMp: true, claim: 0 });
    await expect(svc.approve(BIZ, 'm-1', 'cr-1')).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(mp.refundPayment).not.toHaveBeenCalled();
  });

  it('con nota de crédito se emite por el total, una sola vez', async () => {
    const { svc, prisma, mp } = cancelaciones({ refundMethod: 'CREDIT_NOTE' });
    await svc.approve(BIZ, 'm-1', 'cr-1');
    expect(prisma.creditNote.create).toHaveBeenCalledTimes(1);
    expect(prisma.creditNote.create.mock.calls[0][0].data).toMatchObject({ businessId: BIZ, orderId: 'o-1', amount: 15000 });
    expect(mp.refundPayment).not.toHaveBeenCalled();
  });

  it('una solicitud de otro negocio da 404', async () => {
    const { svc, prisma } = cancelaciones();
    prisma.cancellationRequest.findFirst.mockResolvedValue(null);
    await expect(svc.approve(BIZ, 'm-1', 'cr-ajena')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Rechazar', () => {
  it('el mensaje del negocio va escapado dentro del HTML del mail', async () => {
    const { svc, mail } = cancelaciones();
    await svc.reject(BIZ, 'cr-1', { rejectionMessage: 'Ya salió <a href="https://x">acá</a>\nSaludos' });
    expect(mail.sendCustomEmail.mock.calls[0][2]).toBe('Ya salió &lt;a href=&quot;https://x&quot;&gt;acá&lt;/a&gt;<br/>Saludos');
  });
});

describe('La transición PREPARING → CANCELLED', () => {
  function pedidoEnPreparacion() {
    const tx = {
      order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      orderStatusHistory: { create: jest.fn() },
      payment: { updateMany: jest.fn() },
      variantStock: { upsert: jest.fn() },
      stockMovement: { create: jest.fn() },
    };
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'o-1', channel: 'ONLINE', status: 'PREPARING', branchId: 'b-1', orderNumber: 7, customerId: null, total: 100,
          business: { name: 'T', subdomain: 't' }, customer: null, onlineOrderDetails: null,
          items: [{ variantId: 'v-1', quantity: 2, isConcept: false }],
        }),
      },
      $transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb(tx)),
    };
    const svc = new OrdersService(prisma as any, {} as any, {} as any, { emit: jest.fn() } as any);
    // updateStatus termina devolviendo findOne() (el detalle completo): acá
    // solo importa la transición y el stock.
    jest.spyOn(svc, 'findOne').mockResolvedValue({} as any);
    return { svc, tx };
  }

  it('desde el panel sigue sin estar permitida', async () => {
    const { svc } = pedidoEnPreparacion();
    await expect(svc.updateStatus(BIZ, 'm-1', 'o-1', 'CANCELLED')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('por una solicitud aceptada sí, y repone el stock', async () => {
    const { svc, tx } = pedidoEnPreparacion();
    await svc.updateStatus(BIZ, 'm-1', 'o-1', 'CANCELLED', { porSolicitudDeCancelacion: true });
    expect(tx.variantStock.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { quantity: { increment: 2 } } }));
  });
});
