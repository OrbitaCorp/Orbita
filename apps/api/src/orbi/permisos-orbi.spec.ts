import { permisosDeOrbi } from './permisos-orbi';
import { CODIGOS_DEL_CATALOGO } from '../common/permisos/catalogo';

describe('permisosDeOrbi', () => {
  it('el dueño recibe todos los códigos del catálogo aunque su lista de permisos esté vacía', () => {
    // Igual que PermissionsGuard: el owner no depende de filas de permisos, así
    // que un permiso nuevo en el catálogo no lo deja afuera de Orbi.
    expect(permisosDeOrbi({ roleName: 'owner', permissions: [] })).toEqual(CODIGOS_DEL_CATALOGO);
  });

  it('un rol común recibe exactamente los suyos, ni más ni menos', () => {
    const suyos = ['orders.view', 'customers.view'];
    expect(permisosDeOrbi({ roleName: 'empleado', permissions: suyos })).toEqual(suyos);
  });

  it('un rol común sin permisos no recibe ninguno', () => {
    expect(permisosDeOrbi({ roleName: 'empleado', permissions: [] })).toEqual([]);
  });

  it('sin nombre de rol se comporta como rol común (nunca como dueño)', () => {
    expect(permisosDeOrbi({ permissions: ['catalog.view'] })).toEqual(['catalog.view']);
  });

  it('el catálogo incluye los códigos que las tools de Orbi necesitan', () => {
    for (const c of ['catalog.manage', 'discounts.manage', 'orders.manage', 'config.edit', 'reports.dashboard']) {
      expect(CODIGOS_DEL_CATALOGO).toContain(c);
    }
  });
});
