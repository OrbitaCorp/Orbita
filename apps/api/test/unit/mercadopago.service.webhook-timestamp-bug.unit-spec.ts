import * as crypto from 'crypto';
import { MercadopagoService } from '../../src/mercadopago/mercadopago.service';

// Unit test de handlePaymentsWebhookRequest() — bug real del SDK oficial
// (RBT-619, encontrado en producción 2026-08-18): un pedido pagado de
// verdad con Mercado Pago (MP ya lo había aprobado y debitado) quedaba
// PENDING para siempre — reportado por el CEO con un pedido real (#11).
//
// Causa: `WebhookSignatureValidator.validate()` de `mercadopago@3.2.0`
// (dist/utils/webhook/index.js) compara el `ts` del header `x-signature`
// (segundos, como documenta MP) contra `Date.now()` (milisegundos) SIN
// convertir unidades — el drift calculado da ~56 años SIEMPRE que se le
// pasa `toleranceSeconds`, así que CUALQUIER webhook real, sin importar
// qué tan rápido llegue, tira "TimestampOutOfTolerance". Este test firma
// un webhook de pago con el HMAC REAL (mismo algoritmo que usa MP) y un
// `ts` = ahora mismo — antes del fix, esto igual fallaba; después del fix
// (ya no se le pasa `toleranceSeconds` a la validación) pasa la firma y
// sigue de largo a procesar el pago.

const SECRET = 'un-secreto-cualquiera';

function firmarWebhook(dataId: string, requestId: string, ts: number) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const hash = crypto.createHmac('sha256', SECRET).update(manifest).digest('hex');
  return `ts=${ts},v1=${hash}`;
}

function svcCon() {
  const prisma = {
    order: { findUnique: jest.fn().mockResolvedValue(null) }, // corta acá: alcanza para probar que pasó la firma
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
    get: (key: string) => (key === 'MP_WEBHOOK_SECRET' ? SECRET : undefined),
  };
  const orders = {} as any;
  const eventEmitter = {} as any;
  return { svc: new MercadopagoService(prisma, config as any, orders, eventEmitter), prisma };
}

describe('MercadopagoService.handlePaymentsWebhookRequest — bug de unidades ts vs Date.now() (unit)', () => {
  it('un webhook de pago firmado correctamente, con ts = AHORA MISMO, ya no se rechaza por "TimestampOutOfTolerance"', async () => {
    const { svc, prisma } = svcCon();
    const tsSegundosAhora = Math.floor(Date.now() / 1000); // MP manda `ts` en SEGUNDOS
    const xSignature = firmarWebhook('123', 'req-1', tsSegundosAhora);

    const res = await svc.handlePaymentsWebhookRequest(
      { type: 'payment', data: { id: '123' } },
      { 'x-signature': xSignature, 'x-request-id': 'req-1' },
      { topic: 'payment', 'data.id': '123', orderId: 'algun-id' },
    );

    expect(res).toEqual({ received: true });
    // La prueba real: si la firma (o la tolerancia) hubiera fallado,
    // `handlePaymentWebhook` nunca se habría llamado y `order.findUnique`
    // seguiría sin invocarse — antes de este fix, la llamada de abajo
    // fallaba porque `toleranceSeconds` calculaba un drift de ~56 años.
    expect(prisma.order.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'algun-id' } }),
    );
  });
});
