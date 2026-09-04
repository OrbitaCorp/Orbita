/**
 * El store de acciones pendientes es lo que hace que una inyección indirecta no
 * pueda escribir en la base sola (RBT-695). Si algo de esto se rompe, el botón
 * de confirmar pasa a ser decorativo — así que va con su propio spec.
 */

import { PendingActionStore } from '../../src/orbi/tools/pending-action.store';

const base = {
  tool: 'createCoupon',
  args: { code: 'VERANO20', value: 20 },
  businessId: 'biz-1',
  memberId: 'member-1',
  resumen: 'Crear el cupón VERANO20 de 20% off',
};

describe('PendingActionStore', () => {
  let store: PendingActionStore;

  beforeEach(() => {
    store = new PendingActionStore();
  });

  it('devuelve la acción a quien la pidió', () => {
    const id = store.crear(base);
    const accion = store.consumir(id, 'biz-1', 'member-1');

    expect(accion?.tool).toBe('createCoupon');
    expect(accion?.args).toEqual({ code: 'VERANO20', value: 20 });
  });

  // Un botón no se aprieta dos veces para crear dos cupones. Y si alguien
  // reenvía el request a mano, el segundo no encuentra nada.
  it('es de un solo uso', () => {
    const id = store.crear(base);

    expect(store.consumir(id, 'biz-1', 'member-1')).not.toBeNull();
    expect(store.consumir(id, 'biz-1', 'member-1')).toBeNull();
  });

  // El aislamiento entre negocios no puede depender de que un id sea difícil de
  // adivinar: se compara igual.
  it('no se puede confirmar desde otro negocio', () => {
    const id = store.crear(base);
    expect(store.consumir(id, 'biz-2', 'member-1')).toBeNull();
  });

  it('no la puede confirmar otra persona del mismo negocio', () => {
    const id = store.crear(base);
    expect(store.consumir(id, 'biz-1', 'member-2')).toBeNull();
  });

  // Un intento fallido tampoco deja el id disponible para reintentar — mismo
  // criterio que el store de códigos de OAuth.
  it('un intento con el negocio equivocado quema la acción igual', () => {
    const id = store.crear(base);

    expect(store.consumir(id, 'biz-2', 'member-1')).toBeNull();
    expect(store.consumir(id, 'biz-1', 'member-1')).toBeNull();
  });

  it('una acción vencida ya no sirve', () => {
    const id = store.crear(base);

    // 10 minutos y un segundo después.
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10 * 60 * 1000 + 1000);
    expect(store.consumir(id, 'biz-1', 'member-1')).toBeNull();
    jest.restoreAllMocks();
  });

  it('un id inventado no devuelve nada', () => {
    expect(store.consumir('deadbeef', 'biz-1', 'member-1')).toBeNull();
  });

  it('cada acción tiene su propio id', () => {
    expect(store.crear(base)).not.toBe(store.crear(base));
  });
});
