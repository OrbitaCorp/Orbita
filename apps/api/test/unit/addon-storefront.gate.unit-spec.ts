import { NotFoundException } from '@nestjs/common';
import { GamesPlayService } from '../../src/games/games-play.service';
import { StorefrontSocialProofController } from '../../src/social-proof/storefront-social-proof.controller';
import { StorefrontPromoModalController } from '../../src/promo-modal/storefront-promo-modal.controller';
import { DiscountsService } from '../../src/discounts/discounts.service';

// Revalidación del paquete Avanzado en el STOREFRONT (hallazgo
// "addon-sin-revalidar" del 04/09, cerrado el 09/09).
//
// Los endpoints del panel están cubiertos por AddonGuard, que lee el negocio
// de `req.user`. Los del storefront son públicos: no hay `req.user`, así que
// el guard no puede correr y la revalidación la tiene que hacer el servicio,
// como ya hacía la oferta relámpago (countdown.service.unit-spec.ts).
//
// Sin esto, a un negocio al que se le vencía el add-on le seguían andando en
// la tienda los juegos (que EMITEN DESCUENTOS REALES), los avisos de prueba
// social, el modal de anuncios y los 2x1 del carrito — las filas de
// configuración quedan tal cual a propósito, para no hacerle reconfigurar
// todo cuando vuelve a pagar.

const negocios = (tieneAddon: boolean) =>
  ({ hasActiveAddon: jest.fn().mockResolvedValue(tieneAddon) }) as never;

describe('Juegos — endpoints públicos', () => {
  const juego = {
    id: 'g1', businessId: 'biz-1', type: 'tiro', name: 'Tiro al blanco', isActive: true,
    startDate: null, endDate: null, percentPerWin: 3, maxPercent: 15, maxAttempts: 5,
    timeLimitSeconds: 4, campaignVersion: 1,
  };

  function servicio(tieneAddon: boolean) {
    const prisma = {
      game: {
        findMany: jest.fn().mockResolvedValue([juego]),
        findUnique: jest.fn().mockResolvedValue(juego),
      },
      gameSession: {
        create: jest.fn().mockResolvedValue({ id: 'sess-1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'sess-1', businessId: 'biz-1', status: 'PLAYING', game: juego }),
      },
    } as never;
    const mail = { enviarPremioJuego: jest.fn() } as never;
    return new GamesPlayService(prisma, mail, negocios(tieneAddon));
  }

  it('sin el add-on no lista ningún juego activo', async () => {
    await expect(servicio(false).listActive('biz-1')).resolves.toEqual([]);
  });

  it('con el add-on sí los lista', async () => {
    await expect(servicio(true).listActive('biz-1')).resolves.toHaveLength(1);
  });

  it('sin el add-on no se puede empezar, terminar ni reclamar una partida', async () => {
    const svc = servicio(false);
    await expect(svc.startSession('biz-1', 'tiro', null)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.finishSession('biz-1', 'sess-1', 5, null)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.claimSession('biz-1', 'sess-1', 'cust-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('con el add-on se puede empezar una partida', async () => {
    await expect(servicio(true).startSession('biz-1', 'tiro', null)).resolves.toMatchObject({ sessionId: 'sess-1' });
  });
});

describe('Prueba social — endpoint público', () => {
  function controlador(tieneAddon: boolean) {
    const storefront = { resolveBusinessId: jest.fn().mockResolvedValue('biz-1') } as never;
    const socialProof = {
      getForBusiness: jest.fn().mockResolvedValue({ isActive: true, position: 'BOTTOM_LEFT' }),
      getRecentEvents: jest.fn().mockResolvedValue([{ producto: 'Remera', ciudad: 'Rosario' }]),
    } as never;
    return new StorefrontSocialProofController(storefront, socialProof, negocios(tieneAddon));
  }

  it('sin el add-on no devuelve avisos', async () => {
    await expect(controlador(false).recent('mi-tienda')).resolves.toBeNull();
  });

  it('con el add-on devuelve los avisos configurados', async () => {
    await expect(controlador(true).recent('mi-tienda')).resolves.toMatchObject({ position: 'BOTTOM_LEFT' });
  });
});

describe('Modal de anuncios — endpoint público', () => {
  function controlador(tieneAddon: boolean) {
    const storefront = { resolveBusinessId: jest.fn().mockResolvedValue('biz-1') } as never;
    const prisma = {
      // Tienda publicada y en línea: desde el 10/09 el modal no se sirve en
      // tiendas pausadas o sin publicar (ver promo-modal.auditoria).
      business: { findUnique: jest.fn().mockResolvedValue({ isActive: true, isPaused: false }) },
      promoModal: {
        findUnique: jest.fn().mockResolvedValue({
          businessId: 'biz-1', isActive: true, startDate: null, endDate: null,
          title: '20% off', message: 'Solo hoy', badge: null, code: null,
          ctaText: null, ctaLink: null, campaignVersion: 1,
        }),
      },
    } as never;
    return new StorefrontPromoModalController(storefront, prisma, negocios(tieneAddon));
  }

  it('sin el add-on no devuelve el modal', async () => {
    await expect(controlador(false).active('mi-tienda')).resolves.toBeNull();
  });

  it('con el add-on devuelve el modal configurado', async () => {
    await expect(controlador(true).active('mi-tienda')).resolves.toMatchObject({ title: '20% off' });
  });
});

describe('2x1 — motor de descuentos automáticos', () => {
  const HACE_UN_DIA = new Date(Date.now() - 24 * 3600 * 1000);

  function fila(type: string, id: string) {
    return {
      id, name: type, type, value: 1, scope: 'PRODUCT', minQuantity: 2,
      priority: 0, activeDays: [], startTime: null, endTime: null,
      maxUsesTotal: null, usesConsumed: 0, startDate: HACE_UN_DIA, endDate: null,
      products: [{ productId: 'p1' }], categories: [],
    };
  }

  function servicio(tieneAddon: boolean) {
    const prisma = {
      discount: { findMany: jest.fn().mockResolvedValue([fila('BUY_X_PAY_Y', 'd-2x1'), fila('PERCENT_PRODUCT', 'd-pct')]) },
    } as never;
    const countdown = { discountIdConCountdown: jest.fn().mockResolvedValue(null) } as never;
    return new DiscountsService(prisma, countdown, negocios(tieneAddon));
  }

  // Método privado: se lo llama directo porque es exactamente el punto donde
  // vive el gate, y todos los caminos del storefront pasan por él.
  const vigentes = (svc: DiscountsService) =>
    (svc as unknown as { descuentosAutomaticosVigentes(b: string): Promise<{ id: string }[]> })
      .descuentosAutomaticosVigentes('biz-1');

  it('sin el add-on el 2x1 no se aplica, pero el resto de los descuentos sí', async () => {
    expect((await vigentes(servicio(false))).map((d) => d.id)).toEqual(['d-pct']);
  });

  it('con el add-on se aplican los dos', async () => {
    expect((await vigentes(servicio(true))).map((d) => d.id)).toEqual(['d-2x1', 'd-pct']);
  });
});
