import { SearchService } from '../../src/search/search.service';

// Unit test de la búsqueda global (Fase 4 — Ale). Mockea PrismaService: no toca
// la base. Foco de la auditoría: cada grupo se consulta SOLO si el miembro
// tiene el permiso, y el término corto no dispara ninguna query.

function makePrismaMock() {
  return {
    order: { findMany: jest.fn().mockResolvedValue([]) },
    customer: { findMany: jest.fn().mockResolvedValue([]) },
    product: { findMany: jest.fn().mockResolvedValue([]) },
    discount: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

const ALL = ['orders.view', 'customers.view', 'catalog.view'];

describe('SearchService (unit)', () => {
  it('no consulta nada y devuelve grupos vacíos si el término tiene menos de 2 caracteres', async () => {
    const prisma = makePrismaMock();
    const svc = new SearchService(prisma as any);

    const res = await svc.search('biz-1', ALL, 'a');

    expect(res).toEqual({ query: 'a', pedidos: [], clientes: [], productos: [], descuentos: [] });
    expect(prisma.order.findMany).not.toHaveBeenCalled();
    expect(prisma.customer.findMany).not.toHaveBeenCalled();
    expect(prisma.product.findMany).not.toHaveBeenCalled();
    expect(prisma.discount.findMany).not.toHaveBeenCalled();
  });

  it('sin permisos no consulta pedidos/clientes/productos, pero sí descuentos', async () => {
    const prisma = makePrismaMock();
    const svc = new SearchService(prisma as any);

    const res = await svc.search('biz-1', [], 'remera');

    expect(prisma.order.findMany).not.toHaveBeenCalled();
    expect(prisma.customer.findMany).not.toHaveBeenCalled();
    expect(prisma.product.findMany).not.toHaveBeenCalled();
    // Descuentos/cupones no piden permiso para listar (igual que su módulo).
    expect(prisma.discount.findMany).toHaveBeenCalledTimes(1);
    expect(res.pedidos).toEqual([]);
    expect(res.clientes).toEqual([]);
    expect(res.productos).toEqual([]);
  });

  it('con permiso de clientes filtra por nombre/email/tel/dni y solo dentro del negocio', async () => {
    const prisma = makePrismaMock();
    const svc = new SearchService(prisma as any);

    await svc.search('biz-42', ['customers.view'], 'rosa');

    expect(prisma.customer.findMany).toHaveBeenCalledTimes(1);
    const arg = prisma.customer.findMany.mock.calls[0][0];
    expect(arg.where.businessId).toBe('biz-42');
    expect(arg.where.deletedAt).toBeNull();
    const campos = arg.where.OR.flatMap((o: any) => Object.keys(o));
    expect(campos).toEqual(expect.arrayContaining(['firstName', 'lastName', 'email', 'phone', 'dni']));
  });

  it('mapea el pedido a { orderNumber, customerName, total, ... } y arma nombre completo', async () => {
    const prisma = makePrismaMock();
    prisma.order.findMany.mockResolvedValue([
      { id: 'o1', orderNumber: 128, total: 1500, status: 'PENDING', createdAt: new Date('2026-01-01T00:00:00Z'), customer: { firstName: 'Rosa', lastName: 'Manzano' } },
    ]);
    const svc = new SearchService(prisma as any);

    const res = await svc.search('biz-1', ['orders.view'], '128');

    expect(res.pedidos).toHaveLength(1);
    expect(res.pedidos[0]).toMatchObject({ orderNumber: 128, customerName: 'Rosa Manzano', total: 1500, status: 'PENDING' });
    // Si lo tipeado es número, también se busca por número de pedido exacto.
    const arg = prisma.order.findMany.mock.calls[0][0];
    expect(arg.where.OR).toEqual(expect.arrayContaining([{ orderNumber: 128 }]));
  });

  it('marca esCupon=true cuando el descuento tiene code', async () => {
    const prisma = makePrismaMock();
    prisma.discount.findMany.mockResolvedValue([
      { id: 'd1', name: 'Cupón verano', code: 'VERANO', isActive: true },
      { id: 'd2', name: 'Descuento auto', code: null, isActive: false },
    ]);
    const svc = new SearchService(prisma as any);

    const res = await svc.search('biz-1', [], 'ver');

    expect(res.descuentos[0]).toMatchObject({ code: 'VERANO', esCupon: true });
    expect(res.descuentos[1]).toMatchObject({ code: null, esCupon: false });
  });
});
