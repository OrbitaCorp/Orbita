import { BadRequestException } from '@nestjs/common';
import { ReportsService } from '../../src/reports/reports.service';

// Dashboard avanzado (desplegable "Métricas avanzadas" del inicio). Los números
// de abajo están hechos a mano para poder verificarlos con una calculadora.
//
// Período: el 1/10/2026 (un día → serie por hora). Anterior: el 30/9.
// Pedido A (completado, cliente c1, por la tienda, 12:00 hs de Argentina):
//   2 × $500 (costo 200) + 1 × $100 (sin costo cargado) = $1.100 de lista,
//   con $100 de descuento → factor 1 − 100/1100.
//   Ingreso neto: ítem 1 = 1000 × 10/11 = 909,09 · ítem 2 = 90,91
//   Costo: 2 × 200 = 400 → ganancia 509,09 sobre 909,09 con costo (56 %).
//   Cobertura del costo: 909,09 / 1000 = 90,9 %.
// Pedido B: cancelado el mismo día → no cuenta, pero entra en la tasa de cancelación.

const DIA = 24 * 60 * 60 * 1000;
const item = (quantity: number, unitPrice: number, cost: number | null, extra: Record<string, unknown> = {}) => ({
  quantity,
  unitPrice,
  isConcept: false,
  variant: { product: { cost, categoryId: 'cat-1', category: { name: 'Remeras' } } },
  ...extra,
});

function svcCon(ordenes: unknown[], opciones: { previosPorCliente?: Record<string, number>; visitasActual?: number; devuelto?: number } = {}) {
  const grupos = Object.entries(opciones.previosPorCliente ?? {}).map(([customerId, n]) => ({ customerId, _count: n }));
  const prisma = {
    order: { findMany: jest.fn().mockResolvedValue(ordenes), groupBy: jest.fn().mockResolvedValue(grupos) },
    return: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: opciones.devuelto ?? 0 } }) },
    storeVisit: { count: jest.fn().mockResolvedValueOnce(opciones.visitasActual ?? 0).mockResolvedValue(0) },
    product: { findMany: jest.fn().mockResolvedValue([{ cost: 100, variants: [{ price: 150, stock: [{ quantity: 4 }] }] }]) },
  };
  return { svc: new ReportsService(prisma as never), prisma };
}

const pedidoA = {
  status: 'COMPLETED',
  createdAt: new Date('2026-10-01T15:00:00.000Z'), // 12:00 en Argentina
  customerId: 'c1',
  origin: 'STOREFRONT',
  total: 1100,
  discountTotal: 100,
  items: [item(2, 500, 200), item(1, 100, null)],
};
const pedidoB = { ...pedidoA, status: 'CANCELLED', customerId: 'c2', total: 500, discountTotal: 0, items: [item(1, 500, 200)] };

describe('ReportsService.dashboardAvanzado', () => {
  it('rentabilidad: ingreso neto con el descuento repartido, costo y ganancia solo de lo que tiene costo', async () => {
    const { svc } = svcCon([pedidoA, pedidoB]);
    const r = await svc.dashboardAvanzado('biz', '2026-10-01', '2026-10-01');
    expect(r.actual.ingresos).toBe(1000);
    expect(r.actual.costo).toBe(400);
    expect(r.actual.ganancia).toBe(509.09);
    expect(r.actual.margenPct).toBe(56);
    expect(r.actual.coberturaCostoPct).toBe(90.9);
    expect(r.actual.descuentos).toBe(100);
  });

  it('un pedido cancelado no suma ventas ni ganancia, pero sí cuenta en la tasa de cancelación', async () => {
    const { svc } = svcCon([pedidoA, pedidoB]);
    const r = await svc.dashboardAvanzado('biz', '2026-10-01', '2026-10-01');
    expect(r.actual.pedidos).toBe(1);
    expect(r.actual.cancelados).toBe(1);
    expect(r.actual.tasaCancelacionPct).toBe(50);
    expect(r.actual.ventas).toBe(1100);
  });

  it('conversión = pedidos hechos por la tienda / visitas, y unidades por pedido', async () => {
    const { svc } = svcCon([pedidoA], { visitasActual: 10 });
    const r = await svc.dashboardAvanzado('biz', '2026-10-01', '2026-10-01');
    expect(r.actual.conversionPct).toBe(10);
    expect(r.actual.unidadesPorPedido).toBe(3);
  });

  it('sin visitas la conversión es null (no 0 ni infinito)', async () => {
    const { svc } = svcCon([pedidoA], { visitasActual: 0 });
    const r = await svc.dashboardAvanzado('biz', '2026-10-01', '2026-10-01');
    expect(r.actual.conversionPct).toBeNull();
  });

  it('un pedido cargado a mano no cuenta para la conversión', async () => {
    const { svc } = svcCon([{ ...pedidoA, origin: 'MANUAL' }], { visitasActual: 10 });
    const r = await svc.dashboardAvanzado('biz', '2026-10-01', '2026-10-01');
    expect(r.actual.conversionPct).toBe(0);
  });

  it('clientes recurrentes: ya habían comprado antes del período', async () => {
    const { svc } = svcCon([pedidoA], { previosPorCliente: { c1: 1 } });
    const r = await svc.dashboardAvanzado('biz', '2026-10-01', '2026-10-01');
    expect(r.clientes).toMatchObject({ compradores: 1, recurrentes: 1, nuevos: 0 });
    expect(r.actual.recurrentesPct).toBe(100);
  });

  it('un cliente sin compras previas y con una sola en el período es nuevo', async () => {
    const { svc } = svcCon([pedidoA], { previosPorCliente: {} });
    const r = await svc.dashboardAvanzado('biz', '2026-10-01', '2026-10-01');
    expect(r.clientes).toMatchObject({ compradores: 1, recurrentes: 0, nuevos: 1 });
  });

  it('los pedidos sin cliente registrado no entran en compradores y se cuentan aparte', async () => {
    const { svc } = svcCon([{ ...pedidoA, customerId: null }]);
    const r = await svc.dashboardAvanzado('biz', '2026-10-01', '2026-10-01');
    expect(r.clientes).toMatchObject({ compradores: 0, sinRegistrar: 1 });
    expect(r.actual.recurrentesPct).toBeNull();
  });

  it('un día se grafica por hora (hora de Argentina) y el pedido cae en la franja de las 12', async () => {
    const { svc } = svcCon([pedidoA]);
    const r = await svc.dashboardAvanzado('biz', '2026-10-01', '2026-10-01');
    expect(r.porFranja.granularidad).toBe('hora');
    expect(r.porFranja.labels).toHaveLength(24);
    expect(r.porFranja.labels[12]).toBe('12h');
    expect(r.porFranja.ventas[12]).toBe(1100);
    expect(r.porFranja.ganancia[12]).toBe(509.09);
    expect(r.porHora[12]).toBe(1);
    expect(r.porDiaSemana[4]).toBe(1); // 1/10/2026 es jueves
  });

  it('un rango largo se agrupa por semana en vez de dar cientos de barras', async () => {
    const { svc } = svcCon([]);
    const r = await svc.dashboardAvanzado('biz', '2026-01-01', '2026-06-30');
    expect(r.porFranja.granularidad).toBe('semana');
    expect(r.porFranja.labels.length).toBeLessThan(30);
  });

  it('el período anterior se calcula con los pedidos de los días previos de igual largo', async () => {
    const previo = { ...pedidoA, createdAt: new Date(pedidoA.createdAt.getTime() - DIA), customerId: null, items: [item(1, 1000, 400)], total: 1000, discountTotal: 0 };
    const { svc } = svcCon([pedidoA, previo]);
    const r = await svc.dashboardAvanzado('biz', '2026-10-01', '2026-10-01');
    expect(r.actual.pedidos).toBe(1);
    expect(r.anterior.pedidos).toBe(1);
    expect(r.anterior.ganancia).toBe(600);
  });

  it('rentabilidad por categoría: la categoría sin ningún costo cargado no inventa una ganancia', async () => {
    const sinCosto = { ...pedidoA, items: [{ ...item(1, 500, null), variant: { product: { cost: null, categoryId: 'cat-2', category: { name: 'Accesorios' } } } }], discountTotal: 0, total: 500 };
    const { svc } = svcCon([pedidoA, sinCosto]);
    const r = await svc.dashboardAvanzado('biz', '2026-10-01', '2026-10-01');
    const accesorios = r.porCategoria.find((c) => c.label === 'Accesorios');
    expect(accesorios).toMatchObject({ ingresos: 500, ganancia: null, margenPct: null });
    expect(r.porCategoria.find((c) => c.label === 'Remeras')?.ganancia).toBe(509.09);
  });

  it('devoluciones: tasa sobre las ventas del período', async () => {
    const { svc } = svcCon([pedidoA], { devuelto: 110 });
    const r = await svc.dashboardAvanzado('biz', '2026-10-01', '2026-10-01');
    expect(r.actual.devuelto).toBe(110);
    expect(r.actual.tasaDevolucionPct).toBe(10);
  });

  it('incluye la ganancia potencial del stock actual', async () => {
    const { svc } = svcCon([]);
    const r = await svc.dashboardAvanzado('biz', '2026-10-01', '2026-10-01');
    expect(r.inventario).toMatchObject({ valorCosto: 400, gananciaPotencial: 200, sinCosto: 0 });
  });

  it('sin pedidos todo da cero o null, sin NaN', async () => {
    const { svc } = svcCon([]);
    const r = await svc.dashboardAvanzado('biz', '2026-10-01', '2026-10-01');
    expect(r.actual).toMatchObject({ pedidos: 0, ganancia: 0, margenPct: null, tasaCancelacionPct: null, unidadesPorPedido: 0 });
    expect(JSON.stringify(r)).not.toContain('null,null,NaN');
    expect(Object.values(r.actual).some((v) => typeof v === 'number' && Number.isNaN(v))).toBe(false);
  });

  it('rechaza un rango invertido', async () => {
    const { svc } = svcCon([]);
    await expect(svc.dashboardAvanzado('biz', '2026-10-05', '2026-10-01')).rejects.toBeInstanceOf(BadRequestException);
  });
});
