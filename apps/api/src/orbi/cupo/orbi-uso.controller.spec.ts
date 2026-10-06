import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrbiUsoController } from './orbi-uso.controller';

const prisma = {
  member: { findMany: jest.fn(), findFirst: jest.fn() },
  orbiPendingAction: { findMany: jest.fn() },
};
const cupo = {
  estado: jest.fn(),
  cupoDelNegocio: jest.fn(),
  usados: jest.fn(),
  topes: jest.fn(),
  fijarTope: jest.fn(),
};
const audit = { registrar: jest.fn() };

function armar() {
  return new OrbiUsoController(cupo as never, prisma as never, audit as never);
}

const duenio = { type: 'member', memberId: 'mie-dueno', businessId: 'neg-1', roleName: 'owner', permissions: [] } as never;
const cliente = { type: 'customer', customerId: 'cli-1', businessId: 'neg-1' } as never;

beforeEach(() => {
  jest.resetAllMocks();
});

describe('GET /orbi/uso', () => {
  it('devuelve solo porcentajes: sin usados, total ni disponible', async () => {
    cupo.estado.mockResolvedValue({
      mes: '2026-10',
      bloquea: true,
      negocio: { usados: 600, total: 1500, porcentaje: 40 },
      propio: { usados: 100, disponible: 750, porcentaje: 13, topePorcentaje: 50 },
    });

    const r = await armar().propio(duenio);

    expect(cupo.estado).toHaveBeenCalledWith('neg-1', 'mie-dueno');
    expect(r).toEqual({ mes: '2026-10', bloquea: true, negocio: { porcentaje: 40 }, propio: { porcentaje: 13, topePorcentaje: 50 } });
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/usados|total|disponible/);
  });

  it('un cliente de la tienda no entra', async () => {
    await expect(armar().propio(cliente)).rejects.toThrow(ForbiddenException);
    expect(cupo.estado).not.toHaveBeenCalled();
  });
});

describe('GET /orbi/uso/equipo', () => {
  it('un ítem por miembro con su % (sobre el cupo o sobre su tope) y las últimas acciones con el nombre', async () => {
    cupo.cupoDelNegocio.mockResolvedValue({ mes: '2026-10', base: 1500, ajustes: 0, total: 1500, avanzado: false });
    cupo.usados.mockResolvedValue({ negocio: 900, porMiembro: new Map([['mie-1', 150], ['mie-2', 300]]) });
    cupo.topes.mockResolvedValue(new Map([['mie-2', 50]]));
    prisma.member.findMany.mockResolvedValue([
      { id: 'mie-1', name: 'Ana' },
      { id: 'mie-2', name: 'Beto' },
      { id: 'mie-3', name: 'Caro' },
    ]);
    const f1 = new Date('2026-10-02T10:00:00Z');
    const f2 = new Date('2026-10-01T10:00:00Z');
    prisma.orbiPendingAction.findMany.mockResolvedValue([
      { resolvedAt: f1, memberId: 'mie-2', tool: 'createProduct', summary: 'Crear Remera', status: 'executed' },
      { resolvedAt: f2, memberId: 'mie-viejo', tool: 'createDiscount', summary: 'Crear 10%', status: 'failed' },
    ]);

    const r = await armar().equipo(duenio);

    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: 'neg-1', status: 'ACTIVE', readOnly: false } }),
    );
    expect(prisma.orbiPendingAction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: 'neg-1', status: { in: ['executed', 'failed'] } },
        orderBy: { resolvedAt: 'desc' },
        take: 50,
      }),
    );
    expect(r.negocio).toEqual({ porcentaje: 60 });
    expect(r.miembros).toEqual([
      { memberId: 'mie-1', nombre: 'Ana', porcentaje: 10, topePorcentaje: null },
      // 300 de un tope de 750 (50% de 1500) = 40%
      { memberId: 'mie-2', nombre: 'Beto', porcentaje: 40, topePorcentaje: 50 },
      { memberId: 'mie-3', nombre: 'Caro', porcentaje: 0, topePorcentaje: null },
    ]);
    expect(r.acciones).toEqual([
      { fecha: f1, miembro: 'Beto', tool: 'createProduct', resumen: 'Crear Remera', estado: 'executed' },
      { fecha: f2, miembro: 'Ex miembro', tool: 'createDiscount', resumen: 'Crear 10%', estado: 'failed' },
    ]);
    expect(JSON.stringify(r)).not.toMatch(/usados|"total"|disponible/);
  });

  it('un cliente de la tienda no entra', async () => {
    await expect(armar().equipo(cliente)).rejects.toThrow(ForbiddenException);
  });
});

describe('PUT /orbi/uso/equipo/:memberId', () => {
  it('fija el tope y lo deja en la auditoría con el valor anterior', async () => {
    prisma.member.findFirst.mockResolvedValue({ id: 'mie-2' });
    cupo.topes.mockResolvedValue(new Map([['mie-2', 50]]));

    const r = await armar().fijarTope(duenio, 'mie-2', { topePorcentaje: 30 });

    expect(prisma.member.findFirst).toHaveBeenCalledWith({ where: { id: 'mie-2', businessId: 'neg-1' }, select: { id: true } });
    expect(cupo.fijarTope).toHaveBeenCalledWith('neg-1', 'mie-2', 30, 'mie-dueno');
    expect(audit.registrar).toHaveBeenCalledWith({
      businessId: 'neg-1',
      memberId: 'mie-dueno',
      entityType: 'orbi_cupo_miembro',
      entityId: 'mie-2',
      action: 'UPDATE',
      changes: [{ field: 'topePorcentaje', before: 50, after: 30 }],
    });
    expect(r).toEqual({ ok: true });
  });

  it('sacar el tope (null) también se audita, con before null si no tenía', async () => {
    prisma.member.findFirst.mockResolvedValue({ id: 'mie-2' });
    cupo.topes.mockResolvedValue(new Map());

    await armar().fijarTope(duenio, 'mie-2', { topePorcentaje: null });

    expect(cupo.fijarTope).toHaveBeenCalledWith('neg-1', 'mie-2', null, 'mie-dueno');
    expect(audit.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ changes: [{ field: 'topePorcentaje', before: null, after: null }] }),
    );
  });

  it('un miembro de otro negocio da 404 y no toca nada', async () => {
    prisma.member.findFirst.mockResolvedValue(null);

    await expect(armar().fijarTope(duenio, 'mie-ajeno', { topePorcentaje: 30 })).rejects.toThrow(NotFoundException);
    expect(cupo.fijarTope).not.toHaveBeenCalled();
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('un cliente de la tienda no entra', async () => {
    await expect(armar().fijarTope(cliente, 'mie-2', { topePorcentaje: 30 })).rejects.toThrow(ForbiddenException);
  });
});
