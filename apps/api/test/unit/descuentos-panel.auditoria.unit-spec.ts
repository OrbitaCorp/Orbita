import { PERMISSION_KEY } from '../../src/common/decorators/require-permission.decorator';
import { ROLES_KEY } from '../../src/common/decorators/roles.decorator';
import { DiscountsController } from '../../src/discounts/discounts.controller';
import { DiscountsService } from '../../src/discounts/discounts.service';
import { CouponsService } from '../../src/coupons/coupons.service';

// Auditoría interna 10/09, ítem web.panel.descuentos: tope de 99% en los
// porcentajes (un 100% deja el pedido en $0) y lecturas de /discounts con
// discounts.view (antes cualquier miembro listaba los códigos privados).

// validarReglas no usa nada del constructor: se prueba sobre el prototipo.
const reglasDescuento = (dto: object) => () => (Object.create(DiscountsService.prototype) as any).validarReglas(dto);
const reglasCupon = (dto: object) => () => (Object.create(CouponsService.prototype) as any).validarReglas(dto);

const ticket = (type: string, value: number) => ({ type, value, scope: 'TICKET', productIds: [], categoryIds: [] });

describe('Tope de 99% en porcentajes', () => {
  it.each(['PERCENT_TICKET', 'PERCENT_PRODUCT'])('descuento %s del 100% → 400', (type) => {
    expect(reglasDescuento({ ...ticket(type, 100), scope: 'PRODUCT', productIds: ['p-1'] })).toThrow('entre 1 y 99');
  });

  it('descuento del 99% pasa la regla de porcentaje', () => {
    expect(reglasDescuento(ticket('PERCENT_TICKET', 99))).not.toThrow(/porcentaje/);
  });

  it('descuento de 0% o negativo → 400', () => {
    expect(reglasDescuento(ticket('PERCENT_TICKET', 0))).toThrow('entre 1 y 99');
  });

  it('un monto fijo de $100 no se ve afectado por el tope', () => {
    expect(reglasDescuento(ticket('AMOUNT_TICKET', 100))).not.toThrow(/porcentaje|monto/);
  });

  it('cupón porcentual del 100% → 400; del 99% pasa', () => {
    expect(reglasCupon({ code: 'PROMO', ...ticket('PERCENT_TICKET', 100) })).toThrow('entre 1 y 99');
    expect(reglasCupon({ code: 'PROMO', ...ticket('PERCENT_TICKET', 99) })).not.toThrow(/porcentaje/);
  });
});

describe('Permisos de /discounts', () => {
  const meta = (key: string, metodo: keyof DiscountsController) => Reflect.getMetadata(key, DiscountsController.prototype[metodo]);

  it.each(['findAll', 'metrics', 'findOne'] as const)('GET %s pide discounts.view', (metodo) => {
    expect(meta(PERMISSION_KEY, metodo)).toBe('discounts.view');
  });

  it('las escrituras siguen siendo de owner/admin', () => {
    expect(meta(ROLES_KEY, 'create')).toEqual(['owner', 'admin']);
  });
});
