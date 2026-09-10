import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchService } from '../../src/search/search.service';
import { SearchQueryDto } from '../../src/search/dto/search-query.dto';

// Auditoría interna 2026-09-10, ítem `api.search`: el término de búsqueda
// llegaba crudo (sin tope, y como array con ?q=a&q=b → 500), y un número
// largo iba como número de pedido y desbordaba el Int de Postgres (500).

const BIZ = 'biz-1';
const TODOS = ['orders.view', 'customers.view', 'catalog.view'];

function buscador() {
  // Un mock por modelo: si se comparten, "no se llamó a clientes" falla por
  // las llamadas de los otros grupos.
  const vacio = () => jest.fn().mockResolvedValue([]);
  const prisma = {
    order: { findMany: vacio() },
    customer: { findMany: vacio() },
    product: { findMany: vacio() },
    discount: { findMany: vacio() },
  };
  return { svc: new SearchService(prisma as any), prisma };
}

describe('Búsqueda global del panel', () => {
  it('un número largo (CUIT, teléfono) no se usa como número de pedido', async () => {
    const { svc, prisma } = buscador();
    await svc.search(BIZ, TODOS, '20304050607');
    const or = prisma.order.findMany.mock.calls[0][0].where.OR;
    expect(or).not.toContainEqual({ orderNumber: 20304050607 });
  });

  it('un número de pedido normal sí se busca exacto', async () => {
    const { svc, prisma } = buscador();
    await svc.search(BIZ, TODOS, '#1234');
    expect(prisma.order.findMany.mock.calls[0][0].where.OR).toContainEqual({ orderNumber: 1234 });
  });

  it('cada grupo filtra por el negocio y se omite sin el permiso', async () => {
    const { svc, prisma } = buscador();
    await svc.search(BIZ, ['catalog.view'], 'remera');
    expect(prisma.order.findMany).not.toHaveBeenCalled();
    expect(prisma.customer.findMany).not.toHaveBeenCalled();
    expect(prisma.product.findMany.mock.calls[0][0].where).toMatchObject({ businessId: BIZ, deletedAt: null });
  });

  it('el término pasa por un DTO: string, con tope', async () => {
    const props = async (body: object) => (await validate(plainToInstance(SearchQueryDto, body))).map((e) => e.property);
    expect(await props({ q: 'remera' })).toEqual([]);
    expect(await props({ q: ['a', 'b'] })).toContain('q');
    expect(await props({ q: 'x'.repeat(101) })).toContain('q');
  });
});
