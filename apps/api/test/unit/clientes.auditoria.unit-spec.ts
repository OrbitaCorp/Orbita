import { PERMISSION_KEY } from '../../src/common/decorators/require-permission.decorator';
import { CustomersController } from '../../src/customers/customers.controller';
import { CustomersService } from '../../src/customers/customers.service';

// Auditoría interna 10/09, ítem web.panel.clientes: la exportación pide el
// mismo permiso que el botón del panel (customers.manage) y la lista deja de
// traer el DNI de cada cliente (sigue en detalle y exportación).

describe('Permisos de /customers', () => {
  const permiso = (metodo: keyof CustomersController) => Reflect.getMetadata(PERMISSION_KEY, CustomersController.prototype[metodo]);

  it('exportar pide customers.manage (antes customers.view)', () => {
    expect(permiso('exportAll')).toBe('customers.manage');
  });

  it('la lista y el detalle siguen con customers.view', () => {
    expect(permiso('findAll')).toBe('customers.view');
    expect(permiso('findOne')).toBe('customers.view');
  });
});

describe('La lista no trae el DNI', () => {
  const cliente = {
    id: 'c-1', firstName: 'Ana', lastName: null, email: 'ana@x.com', phone: '1155556666', dni: '30111222',
    passwordHash: null, createdAt: new Date('2026-09-01'),
  };

  function armar() {
    const prisma = {
      customer: {
        findMany: jest.fn().mockResolvedValue([cliente]),
        count: jest.fn().mockResolvedValue(1),
      },
      order: { groupBy: jest.fn().mockResolvedValue([]) },
      member: { findFirst: jest.fn().mockResolvedValue(null) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    return new CustomersService(prisma as any, {} as any, { emit: jest.fn() } as any);
  }

  it('GET /customers devuelve nombre, email y teléfono, pero no el DNI', async () => {
    const r = await armar().findAll('biz', {});
    expect(r.data[0]).toMatchObject({ firstName: 'Ana', email: 'ana@x.com', phone: '1155556666' });
    expect(r.data[0].dni).toBeUndefined();
    expect(JSON.stringify(r.data)).not.toContain('30111222');
  });

  it('la exportación (customers.manage) sí lo trae', async () => {
    const r = await armar().exportAll('biz', 'm-1');
    expect(r.data[0].dni).toBe('30111222');
  });
});
