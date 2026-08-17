import { MercadopagoService } from '../../src/mercadopago/mercadopago.service';

// Unit test de handlePaymentsWebhookRequest() — filtro por topic (RBT-619,
// bug real encontrado en producción 2026-08-17): la cuenta conectada manda
// notificaciones de MÁS de un topic a la misma URL ("payment" Y
// "merchant_order"), y antes de este fix se les aplicaba el MISMO chequeo de
// firma HMAC sin filtrar — a "merchant_order" nunca le correspondía (no es
// el esquema con el que MP la firma, y de todos modos nunca leímos su
// contenido), así que siempre daba "firma inválida" y quedaba en los logs
// como si algo estuviera roto, tapando el caso real que sí importaba.

function svcCon() {
  const prisma = {
    order: { findUnique: jest.fn() },
    payment: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  } as any;
  const config = {
    getOrThrow: (key: string) => {
      const valores: Record<string, string> = {
        MERCADOPAGO_CLIENT_ID: 'client-id',
        MERCADOPAGO_CLIENT_SECRET: 'client-secret',
        MERCADOPAGO_REDIRECT_URI: 'https://api.orbita.site/api/v1/mercadopago/oauth/callback',
        MERCADOPAGO_TOKEN_KEY: 'token-key',
        JWT_SECRET: 'test-secret-de-al-menos-32-caracteres',
      };
      return valores[key];
    },
    get: (key: string) => (key === 'MP_WEBHOOK_SECRET' ? 'un-secreto-cualquiera' : undefined),
  };
  const orders = {} as any;
  const eventEmitter = {} as any;
  return { svc: new MercadopagoService(prisma, config as any, orders, eventEmitter), prisma };
}

describe('MercadopagoService.handlePaymentsWebhookRequest — filtro por topic (unit)', () => {
  it('topic=merchant_order se reconoce sin validar firma ni tocar la base (no es nuestro topic)', async () => {
    const { svc, prisma } = svcCon();
    const res = await svc.handlePaymentsWebhookRequest(
      { type: 'merchant_order' },
      {}, // sin x-signature: si esto intentara validar firma, tiraría MissingSignatureHeader
      { topic: 'merchant_order', orderId: 'algun-id' },
    );
    expect(res).toEqual({ received: true });
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it('topic=payment con firma inválida se ignora (200 igual) sin reventar', async () => {
    const { svc, prisma } = svcCon();
    const res = await svc.handlePaymentsWebhookRequest(
      { type: 'payment', data: { id: '123' } },
      { 'x-signature': 'ts=1,v1=firma-incorrecta', 'x-request-id': 'req-1' },
      { topic: 'payment', 'data.id': '123', orderId: 'algun-id' },
    );
    expect(res).toEqual({ received: true });
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it('sin topic/type en la notificación (compatibilidad con payloads viejos) sigue intentando validar la firma', async () => {
    const { svc, prisma } = svcCon();
    const res = await svc.handlePaymentsWebhookRequest(
      { data: { id: '123' } },
      { 'x-signature': 'ts=1,v1=firma-incorrecta', 'x-request-id': 'req-1' },
      { 'data.id': '123', orderId: 'algun-id' },
    );
    // Firma inválida → se ignora igual, pero llegó a intentar (no lo filtró
    // por topic ausente) — confirma que el filtro es solo para topics
    // explícitamente DISTINTOS de "payment", no para ausencia de topic.
    expect(res).toEqual({ received: true });
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });
});
