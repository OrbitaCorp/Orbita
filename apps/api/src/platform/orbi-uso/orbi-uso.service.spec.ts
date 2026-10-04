import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrbiUsoService } from './orbi-uso.service';

const prisma = {
  $queryRaw: jest.fn(),
  business: { findUnique: jest.fn() },
  member: { findMany: jest.fn() },
  platformAdmin: { findMany: jest.fn() },
  orbiTurn: { findMany: jest.fn() },
};
const cupo = {
  cupoDelNegocio: jest.fn(),
  usados: jest.fn(),
  topes: jest.fn(),
  ajustesDelMes: jest.fn(),
};

function armar(env: Record<string, string> = {}) {
  const config = { get: (k: string) => env[k] };
  return new OrbiUsoService(prisma as never, cupo as never, config as never);
}

const KPIS = {
  mensajes: 10, costoUsd: 1.5, creditos: 300, mensajesSinCosto: 0, promptTokens: 1000, cachedTokens: 400, completionTokens: 200, thinkingTokens: 50,
  latenciaP50: 1200.5, latenciaP95: null, ttftP50: null, errores: 1, frenadosPorCupoMensual: 2, frenadosPorTopeDiario: 3, conGroq: 0,
  accionesPropuestas: 5, accionesConfirmadas: 3, accionesRechazadas: 1, escriturasRechazadas: 0,
};

beforeEach(() => {
  jest.resetAllMocks();
  cupo.cupoDelNegocio.mockResolvedValue({ mes: '2026-10', base: 1500, ajustes: 0, total: 1500, avanzado: false });
});

describe('OrbiUsoService.resumen', () => {
  it('arma los KPIs, la serie, las acciones ordenadas por costo total y los negocios con su cupo', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([KPIS])
      .mockResolvedValueOnce([{ dia: '2026-10-01', mensajes: 4, costoUsd: 0.5 }])
      .mockResolvedValueOnce([
        { tools: 'a', mensajes: 2, costoPromedioUsd: 0.1, costoTotalUsd: 0.2, entradaPromedio: 100, latenciaPromedio: 900 },
        { tools: '', mensajes: 5, costoPromedioUsd: 0.1, costoTotalUsd: 0.9, entradaPromedio: 80, latenciaPromedio: 500 },
        { tools: 'b + c', mensajes: 1, costoPromedioUsd: 0.4, costoTotalUsd: 0.4, entradaPromedio: 300, latenciaPromedio: 2000 },
      ])
      .mockResolvedValueOnce([{ businessId: 'n1', nombre: 'Rama', mensajes: 10, costoUsd: 1.5, creditos: 750, mensajesSinCosto: 0 }]);

    const r = await armar({ ORBI_LECTURA_CONVERSACIONES: 'on' }).resumen('2026-10');

    expect(r.mes).toBe('2026-10');
    expect(r.lecturaHabilitada).toBe(true);
    expect(r.kpis).toMatchObject({ mensajes: 10, costoUsd: 1.5, creditos: 300, latenciaP50: 1200.5, latenciaP95: null, ttftP50: null, frenadosPorCupoMensual: 2, frenadosPorTopeDiario: 3 });
    expect(r.serie).toEqual([{ dia: '2026-10-01', mensajes: 4, costoUsd: 0.5 }]);
    expect(r.acciones.map((a) => a.costoTotalUsd)).toEqual([0.9, 0.4, 0.2]);
    expect(r.acciones[0].tools).toBe('Charla, sin tools');
    expect(r.negocios).toEqual([{ businessId: 'n1', nombre: 'Rama', mensajes: 10, costoUsd: 1.5, creditos: 750, mensajesSinCosto: 0, cupo: 1500, porcentaje: 50 }]);
    expect(cupo.cupoDelNegocio).toHaveBeenCalledWith('n1', '2026-10');
  });

  it('la serie diaria pasa created_at (UTC, sin zona) a hora argentina con el doble AT TIME ZONE', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await armar().resumen('2026-10');
    // El mock no evalúa SQL: se mira el texto de la consulta de la serie (la 2ª).
    const sql = (prisma.$queryRaw.mock.calls[1][0] as string[]).join('?');
    expect(sql).toContain("(created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Argentina/Buenos_Aires'");
  });

  it('separa los frenados por cupo mensual de los del tope diario (las filas viejas, sin categoría, son del tope diario)', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await armar().resumen('2026-10');
    // El mock no evalúa SQL: se mira el texto de la consulta de los KPIs (la 1ª).
    const sql = (prisma.$queryRaw.mock.calls[0][0] as string[]).join('?');
    expect(sql).toContain(`count(*) FILTER (WHERE status = 'quota' AND error_category = 'cupo_mensual')::int AS "frenadosPorCupoMensual"`);
    expect(sql).toContain(`count(*) FILTER (WHERE status = 'quota' AND error_category IS DISTINCT FROM 'cupo_mensual')::int AS "frenadosPorTopeDiario"`);
    expect(sql).not.toContain('"frenadosPorCupo"');
  });

  it('sin la variable, la lectura de conversaciones no está habilitada, y sin datos todo da cero', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const r = await armar().resumen('2026-10');
    expect(r.lecturaHabilitada).toBe(false);
    expect(r.kpis.mensajes).toBe(0);
    expect(r.kpis.latenciaP50).toBeNull();
    expect(r.kpis).toMatchObject({ frenadosPorCupoMensual: 0, frenadosPorTopeDiario: 0 });
    expect(r.negocios).toEqual([]);
  });

  it('mensajes sin costo medido dan null (Sin dato), no cero, y el cupo los cuenta como 0 créditos', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ ...KPIS, costoUsd: null, creditos: null, mensajesSinCosto: 10 }])
      .mockResolvedValueOnce([{ dia: '2026-10-01', mensajes: 4, costoUsd: null }])
      .mockResolvedValueOnce([
        { tools: 'a', mensajes: 2, costoPromedioUsd: null, costoTotalUsd: null, entradaPromedio: 100, latenciaPromedio: 900 },
        { tools: 'b', mensajes: 1, costoPromedioUsd: 0.4, costoTotalUsd: 0.4, entradaPromedio: 300, latenciaPromedio: 2000 },
      ])
      .mockResolvedValueOnce([{ businessId: 'n1', nombre: 'Rama', mensajes: 10, costoUsd: null, creditos: null, mensajesSinCosto: 10 }]);

    const r = await armar().resumen('2026-10');

    expect(r.kpis).toMatchObject({ mensajes: 10, costoUsd: null, creditos: null, mensajesSinCosto: 10 });
    expect(r.serie).toEqual([{ dia: '2026-10-01', mensajes: 4, costoUsd: null }]);
    expect(r.acciones.map((a) => a.costoTotalUsd)).toEqual([0.4, null]);
    expect(r.acciones[1].costoPromedioUsd).toBeNull();
    expect(r.negocios[0]).toMatchObject({ costoUsd: null, creditos: null, mensajesSinCosto: 10, porcentaje: 0 });
  });

  it('el costo y los créditos se suman sin coalesce a 0 y los ORDER BY sí lo usan (los null no quedan primeros)', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await armar().resumen('2026-10');
    const sql = (n: number) => (prisma.$queryRaw.mock.calls[n][0] as string[]).join('?');
    expect(sql(0)).toContain('sum(cost_usd)::float AS "costoUsd", sum(credits)::int AS creditos');
    expect(sql(0)).toContain(`count(*) FILTER (WHERE cost_usd IS NULL AND status <> 'quota')::int AS "mensajesSinCosto"`);
    expect(sql(3)).toContain('ORDER BY coalesce(sum(t.cost_usd),0) DESC');
    expect(sql(2)).toContain('ORDER BY coalesce(sum(cost_usd),0) DESC');
  });

  it('un mes inválido es 400 y no consulta nada', async () => {
    await expect(armar().resumen('2026-13')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('OrbiUsoService.negocio', () => {
  it('junta cupo, ajustes con el nombre del admin y miembros con su tope', async () => {
    prisma.business.findUnique.mockResolvedValue({ name: 'Rama' });
    cupo.usados.mockResolvedValue({ negocio: 750, porMiembro: new Map() });
    cupo.ajustesDelMes.mockResolvedValue([{ id: 'aj1', creditos: 500, motivo: 'Cortesía', adminId: 'ad1', createdAt: new Date('2026-10-05T12:00:00Z') }]);
    cupo.topes.mockResolvedValue(new Map([['m1', 40]]));
    prisma.platformAdmin.findMany.mockResolvedValue([{ id: 'ad1', name: 'Ale', email: 'ale@orbita.site' }]);
    prisma.$queryRaw.mockResolvedValue([
      { memberId: 'm1', mensajes: 6, costoUsd: 1, creditos: 500, mensajesSinCosto: 0, promptTokens: 900, completionTokens: 100, latenciaP50: 800 },
      { memberId: 'm2', mensajes: 4, costoUsd: null, creditos: null, mensajesSinCosto: 4, promptTokens: 100, completionTokens: 10, latenciaP50: null },
    ]);
    prisma.member.findMany.mockResolvedValue([{ id: 'm1', name: 'Lorena' }]);

    const r = await armar().negocio('n1', '2026-10');

    expect(r).toMatchObject({ mes: '2026-10', businessId: 'n1', nombre: 'Rama', usados: 750, porcentaje: 50 });
    expect(r.ajustes).toEqual([{ id: 'aj1', creditos: 500, motivo: 'Cortesía', admin: 'Ale', fecha: '2026-10-05T12:00:00.000Z' }]);
    expect(r.miembros).toEqual([
      { memberId: 'm1', nombre: 'Lorena', mensajes: 6, costoUsd: 1, creditos: 500, mensajesSinCosto: 0, promptTokens: 900, completionTokens: 100, latenciaP50: 800, topePorcentaje: 40 },
      { memberId: 'm2', nombre: 'm2', mensajes: 4, costoUsd: null, creditos: null, mensajesSinCosto: 4, promptTokens: 100, completionTokens: 10, latenciaP50: null, topePorcentaje: null },
    ]);
  });

  it('un negocio que no existe es 404', async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    await expect(armar().negocio('nope', '2026-10')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('un mes inválido es 400', async () => {
    await expect(armar().negocio('n1', 'octubre')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('OrbiUsoService.turnos', () => {
  const fila = (i: number) => ({
    id: `t${i}`, createdAt: new Date(Date.UTC(2026, 9, 20, 12, 0, 0) - i * 60_000), memberId: 'm1', conversationId: 'c1', section: 'ventas', module: 'ventas',
    model: 'gemini', provider: 'gemini', status: 'ok', errorCategory: null, promptTokens: 10, cachedTokens: 0, completionTokens: 5, thinkingTokens: 0,
    latencyMs: 900, ttftMs: 300, rounds: 1, toolsUsed: [], actionsProposed: 0, actionsConfirmed: 0, actionsRejected: 0, writesRejected: 0,
    costUsd: { toString: () => '0.001234' }, toolsCostUsd: null, credits: 2, contextChars: { a: 1 }, steps: [],
  });

  it('pide 51 y, si hay de más, devuelve 50 y el cursor del 50°', async () => {
    const filas = Array.from({ length: 51 }, (_, i) => fila(i));
    prisma.orbiTurn.findMany.mockResolvedValue(filas);
    prisma.member.findMany.mockResolvedValue([{ id: 'm1', name: 'Lorena' }]);

    const r = await armar().turnos({ businessId: 'n1', mes: '2026-10' });

    const args = prisma.orbiTurn.findMany.mock.calls[0][0];
    expect(args.take).toBe(51);
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
    expect(args.where.businessId).toBe('n1');
    expect(r.turnos).toHaveLength(50);
    expect(r.siguiente).toBe(filas[49].createdAt.toISOString());
    expect(r.turnos[0]).toMatchObject({ id: 't0', miembro: 'Lorena', costUsd: 0.001234, toolsCostUsd: null, credits: 2 });
    expect(r.turnos[0].fecha).toBe(filas[0].createdAt.toISOString());
  });

  it('con 50 o menos no hay siguiente, y filtra por miembro y por cursor', async () => {
    prisma.orbiTurn.findMany.mockResolvedValue([fila(0)]);
    prisma.member.findMany.mockResolvedValue([]);
    const r = await armar().turnos({ businessId: 'n1', memberId: 'm9', mes: '2026-10', antesDe: '2026-10-20T11:00:00.000Z' });
    expect(r.siguiente).toBeNull();
    expect(r.turnos[0].miembro).toBe('m1');
    const where = prisma.orbiTurn.findMany.mock.calls[0][0].where;
    expect(where.memberId).toBe('m9');
    expect(where.createdAt.lt).toEqual(new Date('2026-10-20T11:00:00.000Z'));
  });

  it('mes inválido o cursor inválido: 400', async () => {
    await expect(armar().turnos({ businessId: 'n1', mes: '2026-00' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(armar().turnos({ businessId: 'n1', mes: '2026-10', antesDe: 'ayer' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
