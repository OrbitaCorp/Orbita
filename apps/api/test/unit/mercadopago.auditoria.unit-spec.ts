import { ServiceUnavailableException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MercadopagoService } from '../../src/mercadopago/mercadopago.service';
import { SyncPaymentDto } from '../../src/mercadopago/dto/sync-payment.dto';

// Auditoría interna 2026-09-10, ítem `api.mercadopago`.
//
// - Sin MP_WEBHOOK_SECRET el webhook de pagos procesaba sin firma.
// - Un pago sin external_reference pasaba como si fuera del pedido, y el
//   monto cobrado no se comparaba con nada.
// - Un pago "en proceso" quedaba rechazado.
// - Webhook y pantalla de vuelta podían resolver el mismo pago a la vez.
// - Pedido cobrado que no se podía confirmar (sin stock): nadie se enteraba.

const mockGet = jest.fn();
jest.mock('mercadopago', () => {
  const real = jest.requireActual('mercadopago');
  return { ...real, Payment: jest.fn().mockImplementation(() => ({ get: (...a: unknown[]) => mockGet(...a) })) };
});

const BIZ = 'biz-1';
const PEDIDO = '11111111-1111-4111-8111-111111111111';

function config(secret?: string) {
  const valores: Record<string, string> = {
    MERCADOPAGO_CLIENT_ID: 'client-id',
    MERCADOPAGO_CLIENT_SECRET: 'client-secret',
    MERCADOPAGO_REDIRECT_URI: 'https://api.orbita.site/api/v1/mercadopago/oauth/callback',
    MERCADOPAGO_TOKEN_KEY: 'token-key',
    JWT_SECRET: 'test-secret-de-al-menos-32-caracteres',
  };
  return { getOrThrow: (k: string) => valores[k], get: (k: string) => (k === 'MP_WEBHOOK_SECRET' ? secret : undefined) };
}

const APROBADO = { status: 'approved', status_detail: 'accredited', external_reference: PEDIDO, transaction_amount: 1000, currency_id: 'ARS', fee_details: [] };

function mp(opts: { pago?: object; estadoPedido?: string; claim?: number; updateStatus?: jest.Mock } = {}) {
  mockGet.mockResolvedValue(opts.pago ?? APROBADO);
  const prisma = {
    order: { findUnique: jest.fn().mockResolvedValue({ id: PEDIDO, businessId: BIZ, status: opts.estadoPedido ?? 'PENDING', total: 1000, channel: 'ONLINE', orderNumber: 9 }) },
    payment: {
      // Primera búsqueda: ¿ya aprobado? (no). Segunda: el pendiente de MP.
      findFirst: jest.fn().mockImplementation(({ where }: { where: { status: string } }) =>
        Promise.resolve(where.status === 'APPROVED' ? null : { id: 'pay-1', amount: 1000 })),
      updateMany: jest.fn().mockResolvedValue({ count: opts.claim ?? 1 }),
      create: jest.fn(),
    },
  };
  const orders = { updateStatus: opts.updateStatus ?? jest.fn().mockResolvedValue({}) };
  const emitter = { emit: jest.fn() };
  const svc = new MercadopagoService(prisma as any, config('secreto') as any, orders as any, emitter as any);
  jest.spyOn(svc as any, 'getValidAccessToken').mockResolvedValue('token');
  return { svc, prisma, orders, emitter };
}

describe('Webhook de pagos sin secreto', () => {
  it('responde 503 y no procesa nada', async () => {
    const prisma = { order: { findUnique: jest.fn() } };
    const svc = new MercadopagoService(prisma as any, config(undefined) as any, {} as any, {} as any);
    await expect(
      svc.handlePaymentsWebhookRequest({ type: 'payment', data: { id: '1' } }, {}, { topic: 'payment', orderId: PEDIDO }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });
});

describe('Qué pago se acepta para un pedido', () => {
  it.each([
    ['sin external_reference', { ...APROBADO, external_reference: null }],
    ['de otro pedido', { ...APROBADO, external_reference: 'otro' }],
    ['por menos de lo pedido', { ...APROBADO, transaction_amount: 1 }],
    ['en otra moneda', { ...APROBADO, currency_id: 'USD' }],
  ])('%s: no se toca el pago ni se confirma el pedido', async (_c, pago) => {
    const { svc, prisma, orders } = mp({ pago });
    await svc.handlePaymentWebhook(PEDIDO, '555');
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(orders.updateStatus).not.toHaveBeenCalled();
  });

  it('aprobado y completo: resuelve el pago condicionado a que siga pendiente y confirma el pedido', async () => {
    const { svc, prisma, orders, emitter } = mp();
    await svc.handlePaymentWebhook(PEDIDO, '555');
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'pay-1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'APPROVED', mpPaymentId: '555' }),
    });
    expect(orders.updateStatus).toHaveBeenCalledWith(BIZ, null, PEDIDO, 'CONFIRMED');
    expect(emitter.emit).toHaveBeenCalledWith('notification.pago_confirmado', expect.anything());
  });

  it('en proceso: sigue pendiente (solo se anota lo que dice MP)', async () => {
    const { svc, prisma, orders } = mp({ pago: { ...APROBADO, status: 'in_process' } });
    await svc.handlePaymentWebhook(PEDIDO, '555');
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'pay-1', status: 'PENDING' },
      data: { mpPaymentId: '555', mpStatus: 'in_process', mpStatusDetail: 'accredited' },
    });
    expect(orders.updateStatus).not.toHaveBeenCalled();
  });

  it('si el otro aviso (webhook o pantalla de vuelta) ya lo resolvió, este no confirma de nuevo', async () => {
    const { svc, orders } = mp({ claim: 0 });
    await svc.handlePaymentWebhook(PEDIDO, '555');
    expect(orders.updateStatus).not.toHaveBeenCalled();
  });
});

describe('Pedido cobrado que no se puede confirmar', () => {
  it('sin stock: no revienta el webhook y avisa al negocio', async () => {
    const { svc, emitter } = mp({ updateStatus: jest.fn().mockRejectedValue(new Error('Stock insuficiente')) });
    await expect(svc.handlePaymentWebhook(PEDIDO, '555')).resolves.toBeUndefined();
    expect(emitter.emit).toHaveBeenCalledWith('notification.pago_sin_confirmar', { businessId: BIZ, orderNumber: 9, orderId: PEDIDO, total: 1000 });
    expect(emitter.emit).not.toHaveBeenCalledWith('notification.pago_confirmado', expect.anything());
  });

  it('ya cancelado cuando MP acreditó: también avisa', async () => {
    const { svc, orders, emitter } = mp({ estadoPedido: 'CANCELLED' });
    await svc.handlePaymentWebhook(PEDIDO, '555');
    expect(orders.updateStatus).not.toHaveBeenCalled();
    expect(emitter.emit).toHaveBeenCalledWith('notification.pago_sin_confirmar', expect.objectContaining({ orderId: PEDIDO }));
  });
});

describe('DTO de la pantalla de vuelta', () => {
  it('el id de pago es numérico y acotado', async () => {
    const errores = async (mpPaymentId: unknown) => (await validate(plainToInstance(SyncPaymentDto, { mpPaymentId }))).length;
    expect(await errores('123456789012')).toBe(0);
    expect(await errores('abc')).toBeGreaterThan(0);
    expect(await errores('1'.repeat(21))).toBeGreaterThan(0);
  });
});
