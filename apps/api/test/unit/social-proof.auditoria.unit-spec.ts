import { SocialProofService } from '../../src/social-proof/social-proof.service';
import { StorefrontSocialProofController } from '../../src/social-proof/storefront-social-proof.controller';

// Auditoría interna 2026-09-10, ítem `api.social-proof`.
//
// - Cada aviso del feed público llevaba el id real del pedido, que para una
//   compra como invitado es la prueba de pertenencia en los flujos de pago.
// - Los avisos se servían también en tiendas pausadas o sin publicar.

const PEDIDO = '11111111-1111-4111-8111-111111111111';

describe('Feed de prueba social', () => {
  function feed() {
    const prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([
          { id: PEDIDO, createdAt: new Date('2026-09-09T12:00:00Z'), onlineOrderDetails: { buyerName: 'María Fernanda Gómez' }, items: [{ productName: 'Remera' }] },
        ]),
      },
    };
    return { svc: new SocialProofService(prisma as any), prisma };
  }

  it('el aviso no lleva el id del pedido, ni nada que lo contenga', async () => {
    const { svc } = feed();
    const [ev] = await svc.getRecentEvents('biz-1');
    expect(ev.id).not.toBe(PEDIDO);
    expect(JSON.stringify(ev)).not.toContain(PEDIDO);
    expect(ev.id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('muestra nombre y la inicial del apellido, el producto y cuándo', async () => {
    const { svc } = feed();
    const [ev] = await svc.getRecentEvents('biz-1');
    expect(ev).toEqual({ id: expect.any(String), firstName: 'María', lastInitial: 'G', productName: 'Remera', occurredAt: '2026-09-09T12:00:00.000Z' });
  });

  it('solo pedidos reales de la tienda, confirmados o más, de la última semana', async () => {
    const { svc, prisma } = feed();
    await svc.getRecentEvents('biz-1');
    const { where, take } = prisma.order.findMany.mock.calls[0][0];
    expect(where).toMatchObject({ businessId: 'biz-1', origin: 'STOREFRONT', status: { in: ['CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED'] }, deletedAt: null });
    expect(Date.now() - where.createdAt.gte.getTime()).toBeLessThanOrEqual(7 * 24 * 3600 * 1000 + 1000);
    expect(take).toBe(12);
  });
});

describe('Endpoint público', () => {
  function publico(tienda: { isActive: boolean; isPaused: boolean }) {
    const storefront = { resolveBusinessId: jest.fn().mockResolvedValue('biz-1') };
    const social = { getForBusiness: jest.fn().mockResolvedValue({ isActive: true, position: 'BOTTOM_LEFT' }), getRecentEvents: jest.fn().mockResolvedValue([]) };
    const businesses = { hasActiveAddon: jest.fn().mockResolvedValue(true) };
    const prisma = { business: { findUnique: jest.fn().mockResolvedValue(tienda) } };
    return { ctrl: new StorefrontSocialProofController(storefront as any, social as any, businesses as any, prisma as any), social };
  }

  it.each([
    ['pausada', { isActive: true, isPaused: true }],
    ['sin publicar', { isActive: false, isPaused: false }],
  ])('tienda %s: sin avisos y sin leer pedidos', async (_c, tienda) => {
    const { ctrl, social } = publico(tienda);
    await expect(ctrl.recent('t')).resolves.toBeNull();
    expect(social.getRecentEvents).not.toHaveBeenCalled();
  });
});
