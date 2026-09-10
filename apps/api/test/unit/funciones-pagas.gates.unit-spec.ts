import 'reflect-metadata';
import { ROLES_KEY } from '../../src/common/decorators/roles.decorator';
import { REQUIRES_ADDON_KEY } from '../../src/common/decorators/requires-addon.decorator';
import { GamesController } from '../../src/games/games.controller';
import { PromoModalController } from '../../src/promo-modal/promo-modal.controller';
import { SocialProofController } from '../../src/social-proof/social-proof.controller';
import { TwoForOneController } from '../../src/two-for-one/two-for-one.controller';
import { CountdownSettingsController } from '../../src/countdown/countdown-settings.controller';
import { BusinessesController } from '../../src/businesses/businesses.controller';

// Gates de las funciones del paquete "Avanzado" (auditoría interna
// 2026-09-09, verificaciones 2 y 5 del ítem `api.common`).
//
// Son dos gates distintos y hacen falta los dos:
//
// - @RequiresAddon('ADVANCED') → lo paga el negocio. Faltaba en las plantillas
//   de Home: un negocio en plan Base podía dejarse aplicada una plantilla paga
//   de forma permanente.
// - @Roles('owner','admin') → quién lo decide adentro del negocio. Faltaba en
//   juegos, 2x1, anuncios y prueba social: cualquier empleado los configuraba,
//   incluidos los juegos, que emiten descuentos reales de hasta 100%.
//
// El test mira los metadatos del decorador y no el comportamiento porque es
// exactamente lo que se olvidó las dos veces: la lógica de los guards ya
// estaba bien, lo que faltó fue ponerles el decorador a estos endpoints.

type Handler = (...args: never[]) => unknown;

function gates(controller: new (...args: never[]) => object, metodo: string) {
  const handler = (controller.prototype as Record<string, Handler>)[metodo];
  expect(typeof handler).toBe('function'); // atrapa un método renombrado
  return {
    roles: Reflect.getMetadata(ROLES_KEY, handler) as string[] | undefined,
    addon: Reflect.getMetadata(REQUIRES_ADDON_KEY, handler) as string | undefined,
  };
}

// [controller, método, ¿pide rol?] — las lecturas del panel (listar, métricas,
// preview) solo piden el add-on: mostrarle la pantalla a un empleado no rompe
// nada, lo que se cierra es el guardado.
const ESCRITURAS: [string, new (...args: never[]) => object, string][] = [
  ['juegos · configurar', GamesController, 'upsertGame'],
  ['juegos · relanzar', GamesController, 'relanzar'],
  ['anuncios · configurar', PromoModalController, 'upsertPromoModal'],
  ['anuncios · relanzar', PromoModalController, 'relanzar'],
  ['prueba social · configurar', SocialProofController, 'upsert'],
  ['2x1 · crear', TwoForOneController, 'create'],
  ['2x1 · editar', TwoForOneController, 'update'],
  ['2x1 · prender/apagar', TwoForOneController, 'toggle'],
  ['2x1 · borrar', TwoForOneController, 'remove'],
  ['oferta relámpago · configurar', CountdownSettingsController, 'setEnabled'],
  ['plantilla de Home · aplicar', BusinessesController, 'setHomeTemplate'],
];

describe('Funciones pagas — gates de add-on y de rol', () => {
  it.each(ESCRITURAS)('%s exige el add-on Avanzado y rol owner/admin', (_nombre, controller, metodo) => {
    const { roles, addon } = gates(controller, metodo);
    expect(addon).toBe('ADVANCED');
    expect(roles).toEqual(['owner', 'admin']);
  });

  it('las lecturas del panel siguen pidiendo el add-on', () => {
    for (const [controller, metodo] of [
      [GamesController, 'getGames'],
      [GamesController, 'getWinners'],
      [GamesController, 'getMetrics'],
      [PromoModalController, 'getPromoModal'],
      [SocialProofController, 'get'],
      [SocialProofController, 'preview'],
      [TwoForOneController, 'list'],
    ] as [new (...args: never[]) => object, string][]) {
      expect(gates(controller, metodo).addon).toBe('ADVANCED');
    }
  });
});
