import { readFileSync } from 'fs';
import { join } from 'path';
import { StorefrontController } from '../../src/storefront/storefront.controller';

// Auditoría interna 10/09, ítem web.cliente.checkout (hallazgo email-en-url):
// el email del comprador invitado ya no viaja en la URL. El seguimiento lo
// lee del header x-buyer-email (y acepta ?email= solo por compatibilidad), y
// la URL de retorno de Mercado Pago ya no lo lleva.

function armar() {
  const storefront = { resolveBusinessId: jest.fn().mockResolvedValue('biz-1') };
  const orders = { findOneForTracking: jest.fn().mockResolvedValue({ id: 'o-1' }) };
  const ctrl = new StorefrontController(storefront as any, orders as any);
  return { ctrl, orders };
}

describe('GET /storefront/:slug/orders/:id/tracking', () => {
  it('toma el email del header x-buyer-email', async () => {
    const { ctrl, orders } = armar();
    await ctrl.tracking('tienda', 'o-1', 'ana@x.com', undefined, undefined);
    expect(orders.findOneForTracking).toHaveBeenCalledWith('biz-1', 'o-1', { customerId: undefined, email: 'ana@x.com' });
  });

  it('sigue aceptando ?email= (pedidos que vuelven de MP con la URL vieja)', async () => {
    const { ctrl, orders } = armar();
    await ctrl.tracking('tienda', 'o-1', undefined, 'ana@x.com', undefined);
    expect(orders.findOneForTracking.mock.calls[0][2].email).toBe('ana@x.com');
  });

  it('un cliente logueado de la misma tienda va por su customerId', async () => {
    const { ctrl, orders } = armar();
    await ctrl.tracking('tienda', 'o-1', undefined, undefined, { type: 'customer', businessId: 'biz-1', customerId: 'c-1' } as any);
    expect(orders.findOneForTracking.mock.calls[0][2]).toEqual({ customerId: 'c-1', email: undefined });
  });
});

describe('URL de retorno de Mercado Pago', () => {
  it('no lleva el email del comprador', () => {
    const fuente = readFileSync(join(__dirname, '../../src/mercadopago/mercadopago.service.ts'), 'utf8');
    const linea = fuente.split('\n').find((l) => l.includes('const volverA ='));
    expect(linea).toBeDefined();
    expect(linea).not.toMatch(/email/i);
  });
});
