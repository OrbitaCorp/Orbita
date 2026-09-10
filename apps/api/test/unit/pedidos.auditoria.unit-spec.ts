import { RequestMethod } from '@nestjs/common';
import { PERMISSION_KEY } from '../../src/common/decorators/require-permission.decorator';
import { OrdersController } from '../../src/orders/orders.controller';
import { OrdersService } from '../../src/orders/orders.service';

// Auditoría interna 10/09, ítem web.panel.pedidos: exportar pedidos pide
// orders.export en la API (antes el panel bajaba GET /orders, que solo pide
// orders.view) y deja registro en audit_logs.

const proto = OrdersController.prototype as unknown as Record<string, object>;
const rutasGet = Object.getOwnPropertyNames(OrdersController.prototype)
  .filter((n) => n !== 'constructor' && Reflect.getMetadata('method', proto[n]) === RequestMethod.GET)
  .map((n) => ({ nombre: n, path: Reflect.getMetadata('path', proto[n]) as string }));

describe('GET /orders/export', () => {
  it('pide orders.export', () => {
    const exportar = rutasGet.find((r) => r.path === 'export');
    expect(exportar).toBeDefined();
    expect(Reflect.getMetadata(PERMISSION_KEY, proto[exportar!.nombre])).toBe('orders.export');
  });

  it('se declara antes que GET :id (si no, "export" se toma como un id)', () => {
    const i = (path: string) => rutasGet.findIndex((r) => r.path === path);
    expect(i('export')).toBeGreaterThanOrEqual(0);
    expect(i('export')).toBeLessThan(i(':id'));
  });
});

describe('OrdersService.exportar', () => {
  function armar(total = 1) {
    const audit = { registrar: jest.fn().mockResolvedValue(undefined) };
    const svc = new OrdersService({} as any, {} as any, {} as any, { emit: jest.fn() } as any, audit as any);
    (svc as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const findAll = jest.spyOn(svc, 'findAll').mockResolvedValue({ data: [{ id: 'o-1' }], total, page: 1, limit: 5000, counts: {} } as any);
    return { svc, audit, findAll };
  }

  it('usa los filtros de la lista, sin su paginación y con el tope por archivo', async () => {
    const { svc, findAll } = armar();
    await svc.exportar('biz', 'm-1', { status: 'PENDING', search: 'ana', page: 7, limit: 10, returnable: 'true' });
    const [negocio, q] = findAll.mock.calls[0];
    expect(negocio).toBe('biz');
    expect(q).toMatchObject({ status: 'PENDING', search: 'ana', page: 1, limit: OrdersService.MAX_EXPORTACION });
    expect(q.returnable).toBeUndefined();
  });

  it('deja registro de quién exportó, cuántos y con qué filtros', async () => {
    const { svc, audit } = armar();
    await svc.exportar('biz', 'm-1', { status: 'PENDING', page: 2 });
    expect(audit.registrar).toHaveBeenCalledTimes(1);
    const entrada = audit.registrar.mock.calls[0][0];
    expect(entrada).toMatchObject({ businessId: 'biz', memberId: 'm-1', entityType: 'order_export', action: 'CREATE' });
    const campos = entrada.changes.map((c: { field: string }) => c.field);
    expect(campos).toEqual(['pedidos_exportados', 'status']);
    expect(entrada.changes[0].after).toBe(1);
  });

  it('avisa si el archivo quedó cortado por el tope', async () => {
    const { svc } = armar(7);
    await expect(svc.exportar('biz', 'm-1', {})).resolves.toMatchObject({ total: 7, truncado: true });
    const { svc: otro } = armar(1);
    await expect(otro.exportar('biz', 'm-1', {})).resolves.toMatchObject({ truncado: false });
  });
});
