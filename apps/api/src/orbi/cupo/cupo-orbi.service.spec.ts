import { BadRequestException } from '@nestjs/common';
import { CupoOrbiService, porcentajeDe } from './cupo-orbi.service';

const prisma = {
  businessAddon: { findFirst: jest.fn() },
  orbiCupoAjuste: { aggregate: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  orbiCupoMiembro: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
  orbiTurn: { groupBy: jest.fn() },
};

function armar(env: Record<string, string> = {}) {
  const config = { get: (k: string) => env[k] };
  return new CupoOrbiService(prisma as never, config as never);
}

const NEG = 'neg-1';
const MIEMBRO = 'mie-1';
const AHORA = new Date('2026-10-15T15:00:00Z');

beforeEach(() => {
  jest.resetAllMocks();
  prisma.businessAddon.findFirst.mockResolvedValue(null);
  prisma.orbiCupoAjuste.aggregate.mockResolvedValue({ _sum: { creditos: null } });
  prisma.orbiCupoMiembro.findUnique.mockResolvedValue(null);
  prisma.orbiTurn.groupBy.mockResolvedValue([]);
});

describe('porcentajeDe', () => {
  it('redondea para abajo y maneja total 0', () => {
    expect(porcentajeDe(750, 1500)).toBe(50);
    expect(porcentajeDe(1, 3)).toBe(33);
    expect(porcentajeDe(0, 0)).toBe(0);
    expect(porcentajeDe(5, 0)).toBe(100);
  });
});

describe('CupoOrbiService.cupoDelNegocio', () => {
  it('sin Avanzado y sin ajustes: 1500', async () => {
    const c = await armar().cupoDelNegocio(NEG, '2026-10');
    expect(c).toEqual({ mes: '2026-10', base: 1500, ajustes: 0, total: 1500, avanzado: false });
  });

  it('con Avanzado activo: 2000', async () => {
    prisma.businessAddon.findFirst.mockResolvedValue({ id: 'a' });
    const c = await armar().cupoDelNegocio(NEG, '2026-10');
    expect(c.total).toBe(2000);
    expect(c.avanzado).toBe(true);
    expect(prisma.businessAddon.findFirst.mock.calls[0][0].where).toMatchObject({ businessId: NEG, type: 'ADVANCED', isActive: true });
  });

  it('el base se puede cambiar por variable de entorno', async () => {
    const c = await armar({ ORBI_CREDITOS_MES_BASE: '900' }).cupoDelNegocio(NEG, '2026-10');
    expect(c.base).toBe(900);
    expect(c.total).toBe(900);
  });

  it('suma los ajustes del mes (+500 y -200 = +300)', async () => {
    prisma.orbiCupoAjuste.aggregate.mockResolvedValue({ _sum: { creditos: 300 } });
    const c = await armar().cupoDelNegocio(NEG, '2026-10');
    expect(c.ajustes).toBe(300);
    expect(c.total).toBe(1800);
  });

  it('el total no baja de 0', async () => {
    prisma.orbiCupoAjuste.aggregate.mockResolvedValue({ _sum: { creditos: -99999 } });
    expect((await armar().cupoDelNegocio(NEG, '2026-10')).total).toBe(0);
  });
});

describe('CupoOrbiService.estado', () => {
  it('negocio con 750 de 1500 usados: 50%', async () => {
    prisma.orbiTurn.groupBy.mockResolvedValue([
      { memberId: 'otro', _sum: { credits: 500 } },
      { memberId: MIEMBRO, _sum: { credits: 250 } },
    ]);
    const e = await armar().estado(NEG, MIEMBRO, AHORA);
    expect(e.mes).toBe('2026-10');
    expect(e.bloquea).toBe(false);
    expect(e.negocio).toEqual({ usados: 750, total: 1500, porcentaje: 50 });
    expect(e.propio).toEqual({ usados: 250, disponible: 1500, porcentaje: 16, topePorcentaje: null });
  });

  it('miembro con tope 20% y 240 usados: disponible 300, 80%', async () => {
    prisma.orbiCupoMiembro.findUnique.mockResolvedValue({ topePorcentaje: 20 });
    prisma.orbiTurn.groupBy.mockResolvedValue([{ memberId: MIEMBRO, _sum: { credits: 240 } }]);
    const e = await armar().estado(NEG, MIEMBRO, AHORA);
    expect(e.propio).toEqual({ usados: 240, disponible: 300, porcentaje: 80, topePorcentaje: 20 });
  });

  it('suma solo los turnos del mes pedido', async () => {
    await armar().estado(NEG, MIEMBRO, AHORA);
    const where = prisma.orbiTurn.groupBy.mock.calls[0][0].where;
    expect(where.createdAt.gte.toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(where.createdAt.lt.toISOString()).toBe('2026-11-01T03:00:00.000Z');
  });
});

describe('CupoOrbiService.motivoDeBloqueo', () => {
  it('con el bloqueo apagado nunca bloquea, aunque esté al 150%', async () => {
    prisma.orbiTurn.groupBy.mockResolvedValue([{ memberId: MIEMBRO, _sum: { credits: 2250 } }]);
    expect(await armar().motivoDeBloqueo(NEG, MIEMBRO, AHORA)).toBeNull();
    expect(await armar({ ORBI_CUPO_BLOQUEA: '' }).motivoDeBloqueo(NEG, MIEMBRO, AHORA)).toBeNull();
  });

  it('con el bloqueo prendido y el negocio al 100%: negocio', async () => {
    prisma.orbiTurn.groupBy.mockResolvedValue([{ memberId: 'otro', _sum: { credits: 1500 } }]);
    expect(await armar({ ORBI_CUPO_BLOQUEA: 'true' }).motivoDeBloqueo(NEG, MIEMBRO, AHORA)).toBe('negocio');
  });

  it('miembro al 100% de su tope: miembro', async () => {
    prisma.orbiCupoMiembro.findUnique.mockResolvedValue({ topePorcentaje: 20 });
    prisma.orbiTurn.groupBy.mockResolvedValue([{ memberId: MIEMBRO, _sum: { credits: 300 } }]);
    expect(await armar({ ORBI_CUPO_BLOQUEA: 'true' }).motivoDeBloqueo(NEG, MIEMBRO, AHORA)).toBe('miembro');
  });

  it('con cupo de sobra no bloquea', async () => {
    prisma.orbiTurn.groupBy.mockResolvedValue([{ memberId: MIEMBRO, _sum: { credits: 100 } }]);
    expect(await armar({ ORBI_CUPO_BLOQUEA: 'true' }).motivoDeBloqueo(NEG, MIEMBRO, AHORA)).toBeNull();
  });
});

describe('CupoOrbiService.topes y fijarTope', () => {
  it('topes devuelve un mapa memberId -> porcentaje', async () => {
    prisma.orbiCupoMiembro.findMany.mockResolvedValue([{ memberId: 'a', topePorcentaje: 30 }]);
    expect((await armar().topes(NEG)).get('a')).toBe(30);
  });

  it.each([9, 101, 20.5, Number.NaN])('rechaza un tope fuera de 10..100 (%p)', async (v) => {
    await expect(armar().fijarTope(NEG, MIEMBRO, v, 'yo')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.orbiCupoMiembro.upsert).not.toHaveBeenCalled();
  });

  it('un tope válido hace upsert', async () => {
    await armar().fijarTope(NEG, MIEMBRO, 25, 'yo');
    expect(prisma.orbiCupoMiembro.upsert).toHaveBeenCalledWith({
      where: { businessId_memberId: { businessId: NEG, memberId: MIEMBRO } },
      create: { businessId: NEG, memberId: MIEMBRO, topePorcentaje: 25, updatedBy: 'yo' },
      update: { topePorcentaje: 25, updatedBy: 'yo' },
    });
  });

  it('null borra la fila', async () => {
    await armar().fijarTope(NEG, MIEMBRO, null, 'yo');
    expect(prisma.orbiCupoMiembro.deleteMany).toHaveBeenCalledWith({ where: { businessId: NEG, memberId: MIEMBRO } });
    expect(prisma.orbiCupoMiembro.upsert).not.toHaveBeenCalled();
  });
});

describe('CupoOrbiService.ajustar', () => {
  const ok = { businessId: NEG, mes: '2026-10', creditos: 500, motivo: 'Compensación por caída', adminId: 'adm' };

  it('crea el ajuste con el motivo recortado', async () => {
    prisma.orbiCupoAjuste.create.mockResolvedValue({ id: 'x' });
    const r = await armar().ajustar({ ...ok, motivo: '  Compensación por caída  ' });
    expect(r).toEqual({ id: 'x' });
    expect(prisma.orbiCupoAjuste.create.mock.calls[0][0].data.motivo).toBe('Compensación por caída');
  });

  it.each([
    ['mes inválido', { mes: '2026-13' }],
    ['créditos 0', { creditos: 0 }],
    ['créditos decimales', { creditos: 1.5 }],
    ['créditos de más', { creditos: 100_001 }],
    ['créditos negativos de más', { creditos: -100_001 }],
    ['motivo corto', { motivo: 'abc' }],
    ['motivo de solo espacios', { motivo: '        ' }],
    ['motivo largo', { motivo: 'x'.repeat(301) }],
  ])('rechaza: %s', async (_nombre, cambio) => {
    await expect(armar().ajustar({ ...ok, ...cambio })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.orbiCupoAjuste.create).not.toHaveBeenCalled();
  });

  it('acepta ajustes negativos', async () => {
    prisma.orbiCupoAjuste.create.mockResolvedValue({ id: 'y' });
    await expect(armar().ajustar({ ...ok, creditos: -200 })).resolves.toEqual({ id: 'y' });
  });
});

describe('CupoOrbiService.ajustesDelMes', () => {
  it('lista los ajustes del mes, el más nuevo primero', async () => {
    prisma.orbiCupoAjuste.findMany.mockResolvedValue([]);
    await armar().ajustesDelMes(NEG, '2026-10');
    expect(prisma.orbiCupoAjuste.findMany.mock.calls[0][0]).toMatchObject({ where: { businessId: NEG, mes: '2026-10' }, orderBy: { createdAt: 'desc' } });
  });
});
