import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CartItemForEngine, EligibleDiscount, evaluateCart } from '../../src/discounts/discount-engine';
import { diaYHoraArgentina } from '../../src/common/utils/hora-argentina';
import { vigenciaDe } from '../../src/discounts/discount-status.util';
import { DiscountsController } from '../../src/discounts/discounts.controller';
import { DiscountsService } from '../../src/discounts/discounts.service';
import { UpsertDiscountDto } from '../../src/discounts/dto/upsert-discount.dto';
import { MetricsQueryDto } from '../../src/discounts/dto/metrics-query.dto';

// Auditoría interna 2026-09-10, ítem `api.discounts`.
//
// - Días y horarios de los descuentos se evaluaban en la hora del servidor
//   (UTC en Cloud Run): tres horas corridos respecto de lo que cargó el dueño.
// - Las reglas de acumulación del motor no tenían tests (solo el 2x1).
// - Un cliente podía probar cupones personales de otro mandando su id.
// - DTOs sin topes: fechas y horas cualquier string, usos en 0 o negativos.

const item = (variantId: string, unitPrice: number, quantity = 1, extra: Partial<CartItemForEngine> = {}): CartItemForEngine => ({
  variantId, productId: `p-${variantId}`, categoryId: 'cat-1', quantity, unitPrice, ...extra,
});
const desc = (id: string, extra: Partial<EligibleDiscount>): EligibleDiscount => ({
  id, name: id, type: 'PERCENT_PRODUCT', value: 10, scope: 'CATEGORY', productLevel: null, minAmount: null, minQuantity: null,
  priority: 0, productIds: [], categoryIds: ['cat-1'], ...extra,
});

describe('Reglas de acumulación del motor', () => {
  it('un solo descuento por renglón: gana el de mayor ahorro, no se suman', () => {
    const r = evaluateCart([item('a', 1000)], [desc('d10', { value: 10 }), desc('d25', { value: 25 })]);
    expect(r.itemDiscounts).toEqual([expect.objectContaining({ discountId: 'd25', amount: 250 })]);
    expect(r.total).toBe(750);
  });

  it('a igual ahorro desempata la prioridad', () => {
    const r = evaluateCart([item('a', 1000)], [desc('baja', { value: 10 }), desc('alta', { value: 10, priority: 5 })]);
    expect(r.itemDiscounts[0].discountId).toBe('alta');
  });

  it('el de ticket se aplica una vez, sobre lo que queda después de los de renglón', () => {
    const r = evaluateCart([item('a', 1000)], [desc('prod', { value: 50 }), desc('ticket', { type: 'PERCENT_TICKET', scope: 'TICKET', value: 10, categoryIds: [] })]);
    // 1000 − 500 = 500; 10 % de 500 = 50 (no de 1000).
    expect(r.ticketDiscount?.amount).toBe(50);
    expect(r.total).toBe(450);
  });

  it('el monto mínimo del ticket se mide sobre el subtotal bruto', () => {
    const t = desc('t', { type: 'AMOUNT_TICKET', scope: 'TICKET', value: 100, minAmount: 1000, categoryIds: [] });
    expect(evaluateCart([item('a', 999)], [t]).ticketDiscount).toBeNull();
    expect(evaluateCart([item('a', 1000)], [t]).ticketDiscount?.amount).toBe(100);
  });

  it('el total nunca queda negativo: montos fijos topeados por unidad y por ticket', () => {
    const r = evaluateCart([item('a', 100, 3)], [
      desc('fijo', { type: 'AMOUNT_PRODUCT', value: 5000 }),
      desc('ticket', { type: 'AMOUNT_TICKET', scope: 'TICKET', value: 99999, categoryIds: [] }),
    ]);
    expect(r.itemDiscounts[0].amount).toBe(300);
    expect(r.total).toBe(0);
    expect(r.discountTotal).toBeLessThanOrEqual(r.subtotal);
  });

  it('una unidad con 2x1 no recibe además otro descuento de renglón', () => {
    const dosPorUno = desc('2x1', { type: 'BUY_X_PAY_Y', minQuantity: 2, value: 1 });
    const r = evaluateCart([item('a', 1000, 2)], [dosPorUno, desc('d50', { value: 50 })]);
    expect(r.itemDiscounts).toEqual([expect.objectContaining({ discountId: '2x1', amount: 1000 })]);
  });
});

describe('Días y horarios en hora de Argentina', () => {
  it('lunes 01:30 UTC es domingo 22:30 en Argentina', () => {
    expect(diaYHoraArgentina(new Date('2026-09-14T01:30:00Z'))).toEqual({ dia: 0, hhmm: '22:30' });
  });

  it('medianoche argentina: 03:00 UTC es 00:00 del mismo día', () => {
    expect(diaYHoraArgentina(new Date('2026-09-14T03:00:00Z'))).toEqual({ dia: 1, hhmm: '00:00' });
  });

  it('un descuento de los lunes no aplica el domingo a la noche aunque en UTC ya sea lunes', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-14T01:30:00Z') }); // domingo 22:30 en Argentina
    try {
      const prisma = {
        discount: {
          findMany: jest.fn().mockResolvedValue([{
            id: 'lunes', name: 'Lunes', type: 'PERCENT_TICKET', value: 10, scope: 'TICKET', productLevel: null, minAmount: null, minQuantity: null,
            priority: 0, activeDays: [1], startTime: null, endTime: null, maxUsesTotal: null, usesConsumed: 0, products: [], categories: [],
          }]),
        },
      };
      const svc = new DiscountsService(prisma as any, {} as any, { hasActiveAddon: jest.fn() } as any);
      expect(await (svc as any).descuentosAutomaticosVigentes('biz-1')).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Vigencia por días de Argentina', () => {
  it('"hasta el 12/09" termina el 12/09 a las 23:59:59.999 de Argentina, no el 11/09 a las 21', () => {
    const { startDate, endDate } = vigenciaDe({ startDate: '2026-09-10', endDate: '2026-09-12' });
    expect(startDate.toISOString()).toBe('2026-09-10T03:00:00.000Z');
    expect(endDate?.toISOString()).toBe('2026-09-13T02:59:59.999Z');
  });

  it('un instante completo (oferta relámpago) se respeta tal cual', () => {
    expect(vigenciaDe({ startDate: '2026-09-10T15:00:00.000Z', endDate: '2026-09-12T18:30:00.000Z' }).endDate?.toISOString()).toBe('2026-09-12T18:30:00.000Z');
  });

  it('un descuento de un solo día ("del 12 al 12") es válido', () => {
    const { startDate, endDate } = vigenciaDe({ startDate: '2026-09-12', endDate: '2026-09-12' });
    expect(endDate!.getTime()).toBeGreaterThan(startDate.getTime());
  });
});

describe('Validar un cupón', () => {
  it('un cliente se evalúa con su propio id aunque mande el de otro', async () => {
    const svc = { validateCoupon: jest.fn() };
    const ctrl = new DiscountsController(svc as any, {} as any);
    await ctrl.validate({ type: 'customer', businessId: 'biz-1', customerId: 'c-yo' } as any, { code: 'PREMIO', items: [], customerId: 'c-otro' });
    expect(svc.validateCoupon).toHaveBeenCalledWith('biz-1', expect.objectContaining({ customerId: 'c-yo' }));
  });

  it('el panel sí puede probar el cupón de un cliente', async () => {
    const svc = { validateCoupon: jest.fn() };
    const ctrl = new DiscountsController(svc as any, {} as any);
    await ctrl.validate({ type: 'member', businessId: 'biz-1', memberId: 'm-1' } as any, { code: 'PREMIO', items: [], customerId: 'c-1' });
    expect(svc.validateCoupon).toHaveBeenCalledWith('biz-1', expect.objectContaining({ customerId: 'c-1' }));
  });
});

describe('DTOs', () => {
  const base = { name: 'Promo', type: 'PERCENT_PRODUCT', value: 10, scope: 'CATEGORY', startDate: '2026-09-10', categoryIds: ['8b1f0f1e-3b8a-4f7e-9d6e-1f2a3b4c5d6e'] };
  const errores = async (cls: any, body: object) => (await validate(plainToInstance(cls, body))).map((e) => e.property);

  it('acepta un descuento bien formado', async () => {
    expect(await errores(UpsertDiscountDto, { ...base, activeDays: [1, 5], startTime: '18:00', endTime: '20:30', maxUsesTotal: 10 })).toEqual([]);
  });

  it.each([
    ['fecha inválida', { startDate: 'mañana' }, 'startDate'],
    ['hora sin cero', { startTime: '9:00' }, 'startTime'],
    ['día 7', { activeDays: [7] }, 'activeDays'],
    ['usos en 0', { maxUsesTotal: 0 }, 'maxUsesTotal'],
    ['nombre vacío', { name: '' }, 'name'],
  ])('rechaza %s', async (_c, cambio, campo) => {
    expect(await errores(UpsertDiscountDto, { ...base, ...cambio })).toContain(campo);
  });

  it('las métricas personalizadas piden fechas de verdad', async () => {
    expect(await errores(MetricsQueryDto, { rango: 'personalizado', fechaDesde: 'ayer' })).toContain('fechaDesde');
  });
});
