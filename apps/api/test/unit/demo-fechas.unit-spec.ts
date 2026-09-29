// Fechas de la demo pública: avanzan con el calendario (DemoFechasService).
import { Prisma } from '@prisma/client';
import { DemoFechasService, MARGEN_MS, TABLAS_DEMO } from '../../src/demo/demo-fechas.service';

function prismaFalso(negocios: { id: string; demoFechasAl: Date }[], anclaTomada = true) {
  const sql: string[] = [];
  const tx = {
    business: { updateMany: jest.fn().mockResolvedValue({ count: anclaTomada ? 1 : 0 }) },
    $executeRawUnsafe: jest.fn(async (q: string) => { sql.push(q); return 1; }),
  };
  const prisma = {
    business: { findMany: jest.fn().mockResolvedValue(negocios) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { prisma, tx, sql };
}

describe('DemoFechasService', () => {
  const ahora = new Date('2026-10-10T12:00:00Z');

  it('corre todas las tablas de la demo lo que pasó desde el ancla, y mueve el ancla a ahora', async () => {
    const desde = new Date(ahora.getTime() - 3 * 24 * 3600 * 1000);
    const { prisma, tx, sql } = prismaFalso([{ id: 'demo', demoFechasAl: desde }]);
    await expect(new DemoFechasService(prisma as never).ponerAlDia(ahora)).resolves.toBe(1);
    expect(tx.business.updateMany).toHaveBeenCalledWith({ where: { id: 'demo', demoFechasAl: desde }, data: { demoFechasAl: ahora } });
    expect(sql).toHaveLength(TABLAS_DEMO.length);
    const params = tx.$executeRawUnsafe.mock.calls[0].slice(1);
    expect(params).toEqual(['demo', 3 * 24 * 3600 * 1000]);
    // Todas filtradas por negocio: nunca un UPDATE sin WHERE sobre otra tienda.
    for (const q of sql) expect(q).toMatch(/WHERE .*\$1/);
  });

  it('solo busca negocios demo atrasados más que el margen', async () => {
    const { prisma } = prismaFalso([]);
    await new DemoFechasService(prisma as never).ponerAlDia(ahora);
    expect(prisma.business.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isDemo: true, demoFechasAl: { not: null, lt: new Date(ahora.getTime() - MARGEN_MS) } },
    }));
  });

  it('si otro pedido ya tomó el ancla, no corre nada (sin doble corrimiento)', async () => {
    const { prisma, sql } = prismaFalso([{ id: 'demo', demoFechasAl: new Date(ahora.getTime() - 3600 * 1000) }], false);
    await expect(new DemoFechasService(prisma as never).ponerAlDia(ahora)).resolves.toBe(0);
    expect(sql).toHaveLength(0);
  });

  it('no toca fechas que no son "cuándo pasó algo" (nacimiento, bloqueo de login)', () => {
    const clientes = TABLAS_DEMO.find((t) => t.tabla === 'customers')!;
    expect(clientes.columnas).not.toContain('birth_date');
    expect(clientes.columnas).not.toContain('locked_until');
  });

  it('el reloj de la oferta relámpago se corre junto con su descuento (si no, vence solo)', () => {
    const fin = (tabla: string) => TABLAS_DEMO.find((t) => t.tabla === tabla)?.columnas.includes('end_date');
    expect(fin('discounts')).toBe(true);
    expect(fin('countdown_configs')).toBe(true);
  });

  it('las columnas existen en el schema (si una se renombra, esto avisa)', () => {
    const porTabla = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.dbName ?? m.name, new Set(m.fields.filter((f) => f.type === 'DateTime').map((f) => f.dbName ?? f.name))]));
    for (const t of TABLAS_DEMO) {
      const fechas = porTabla.get(t.tabla);
      expect(fechas).toBeDefined();
      for (const c of t.columnas) expect([t.tabla, fechas!.has(c)]).toEqual([t.tabla, true]);
    }
  });
});
