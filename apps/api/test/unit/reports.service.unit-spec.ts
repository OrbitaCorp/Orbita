import { ReportsService } from '../../src/reports/reports.service';

// Unit test de la segmentación de clientes (Fase 4 — Ale). El segmento se
// calcula al leer (no hay campo en la base); estas reglas son las que la
// auditoría dejó ABIERTAS a confirmar, así que conviene fijarlas con un test.
// Reglas: sin pedidos → nuevo si <30d / inactivo si no · última compra >90d →
// inactivo · P85+ de gasto y 2+ pedidos → vip · 2+ pedidos → recurrente ·
// resto → nuevo.

const DIA = 24 * 60 * 60 * 1000;
const hace = (dias: number) => new Date(Date.now() - dias * DIA);

// Construye un ReportsService con Prisma mockeado para customers():
// - customer.findMany → la lista de clientes
// - order.groupBy → resumen por cliente (pedidos, gastado, última compra)
// - customer.count → nuevos del mes / mes pasado (no relevante para el segmento)
function svcCon(clientes: any[], grupos: any[]) {
  const prisma = {
    customer: {
      findMany: jest.fn().mockResolvedValue(clientes),
      count: jest.fn().mockResolvedValue(0),
    },
    order: { groupBy: jest.fn().mockResolvedValue(grupos) },
  };
  return new ReportsService(prisma as any);
}

const seg = (filas: any[], id: string) => filas.find((f) => f.id === id)?.segmento;

describe('ReportsService.customers — segmentación (unit)', () => {
  it('cliente sin pedidos: nuevo si se registró hace menos de 30 días', async () => {
    const svc = svcCon([{ id: 'c1', firstName: 'Ana', lastName: null, createdAt: hace(10) }], []);
    const r = await svc.customers('biz');
    expect(seg(r.clientes, 'c1')).toBe('nuevo');
  });

  it('cliente sin pedidos y registrado hace más de 30 días: inactivo', async () => {
    const svc = svcCon([{ id: 'c1', firstName: 'Ana', lastName: null, createdAt: hace(120) }], []);
    const r = await svc.customers('biz');
    expect(seg(r.clientes, 'c1')).toBe('inactivo');
  });

  it('última compra hace más de 90 días: inactivo aunque tenga varios pedidos', async () => {
    const svc = svcCon(
      [{ id: 'c1', firstName: 'Ana', lastName: null, createdAt: hace(200) }],
      [{ customerId: 'c1', _count: 5, _sum: { total: 90000 }, _max: { createdAt: hace(120) } }],
    );
    const r = await svc.customers('biz');
    expect(seg(r.clientes, 'c1')).toBe('inactivo');
  });

  it('2+ pedidos recientes pero gasto bajo (bajo P85): recurrente', async () => {
    // c-vip marca el techo de gasto; c-rec compra reciente con 2 pedidos y poco gasto.
    const clientes = [
      { id: 'c-vip', firstName: 'Vip', lastName: null, createdAt: hace(200) },
      { id: 'c-rec', firstName: 'Rec', lastName: null, createdAt: hace(200) },
    ];
    const grupos = [
      { customerId: 'c-vip', _count: 6, _sum: { total: 500000 }, _max: { createdAt: hace(5) } },
      { customerId: 'c-rec', _count: 2, _sum: { total: 3000 }, _max: { createdAt: hace(5) } },
    ];
    const r = await svcCon(clientes, grupos).customers('biz');
    expect(seg(r.clientes, 'c-rec')).toBe('recurrente');
  });

  it('gasto en el tope (P85+) y 2+ pedidos: vip', async () => {
    const clientes = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, firstName: `C${i}`, lastName: null, createdAt: hace(200) }));
    // c9 gasta muchísimo más que el resto y compró hace poco con 3 pedidos → vip.
    const grupos = clientes.map((c, i) => ({
      customerId: c.id,
      _count: i === 9 ? 3 : 2,
      _sum: { total: i === 9 ? 1000000 : 1000 },
      _max: { createdAt: hace(5) },
    }));
    const r = await svcCon(clientes, grupos).customers('biz');
    expect(seg(r.clientes, 'c9')).toBe('vip');
  });

  it('cuenta activos (compra en los últimos 90 días) y arma el top por gasto', async () => {
    const clientes = [
      { id: 'a', firstName: 'A', lastName: null, createdAt: hace(200) },
      { id: 'b', firstName: 'B', lastName: null, createdAt: hace(200) },
    ];
    const grupos = [
      { customerId: 'a', _count: 1, _sum: { total: 100 }, _max: { createdAt: hace(5) } },   // activo
      { customerId: 'b', _count: 1, _sum: { total: 999 }, _max: { createdAt: hace(200) } }, // inactivo
    ];
    const r = await svcCon(clientes, grupos).customers('biz');
    expect(r.metricas.activos).toBe(1);
    expect(r.topClientes[0].id).toBe('b'); // el de mayor gasto va primero
  });
});
