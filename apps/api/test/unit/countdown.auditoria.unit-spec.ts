import { StorefrontCountdownController } from '../../src/countdown/storefront-countdown.controller';

// Auditoría interna 2026-09-10, ítem `api.countdown`.
//
// El reloj de la oferta relámpago se servía también en tiendas pausadas o sin
// publicar (mismo criterio que el catálogo: ver api.storefront).

function publico(tienda: { isActive: boolean; isPaused: boolean } | null) {
  const storefront = { resolveBusinessId: jest.fn().mockResolvedValue('biz-1') };
  const countdown = { getActiveCountdown: jest.fn().mockResolvedValue({ id: 'cd-1' }) };
  const prisma = { business: { findUnique: jest.fn().mockResolvedValue(tienda) } };
  return { ctrl: new StorefrontCountdownController(storefront as any, countdown as any, prisma as any), countdown };
}

describe('Reloj público de la oferta relámpago', () => {
  it.each([
    ['pausada', { isActive: true, isPaused: true }],
    ['sin publicar', { isActive: false, isPaused: false }],
  ])('tienda %s: no hay reloj y ni se consulta la oferta', async (_c, tienda) => {
    const { ctrl, countdown } = publico(tienda);
    await expect(ctrl.active('t')).resolves.toBeNull();
    expect(countdown.getActiveCountdown).not.toHaveBeenCalled();
  });

  it('tienda en línea: delega en el servicio (add-on, interruptor, inicio y fin)', async () => {
    const { ctrl, countdown } = publico({ isActive: true, isPaused: false });
    await expect(ctrl.active('t')).resolves.toEqual({ id: 'cd-1' });
    expect(countdown.getActiveCountdown).toHaveBeenCalledWith('biz-1');
  });
});
