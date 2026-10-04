// Catálogo de permisos del panel: la fuente única para Onboarding (que lo siembra
// en cada negocio nuevo) y para Orbi (que valida contra él los permisos que pide
// cada tool y le da al dueño la lista completa, ver orbi/permisos-orbi.ts).
//
// prisma/seed.ts conserva su PROPIA copia a propósito: prisma/ está fuera del
// grafo de Nest y no puede importar de src/. Si cambia el catálogo, actualizar
// los dos lugares.

export const PERMISSIONS: Array<{ group: string; code: string; label: string }> = [
  { group: 'Pedidos', code: 'orders.view', label: 'Ver pedidos' },
  { group: 'Pedidos', code: 'orders.manage', label: 'Gestionar pedidos' },
  { group: 'Pedidos', code: 'orders.export', label: 'Exportar pedidos' },
  { group: 'Clientes', code: 'customers.view', label: 'Ver clientes' },
  { group: 'Clientes', code: 'customers.manage', label: 'Gestionar clientes' },
  { group: 'Reportes', code: 'reports.view', label: 'Ver reportes' },
  { group: 'Reportes', code: 'reports.export', label: 'Exportar reportes' },
  // Separado de reports.view a pedido del negocio: el dashboard es LA foto
  // de la facturación, y un rol puede necesitar reportes puntuales sin ver
  // la caja completa (o al revés). Los negocios existentes lo reciben por
  // la migración reports_dashboard_permission (owner y admin).
  { group: 'Reportes', code: 'reports.dashboard', label: 'Ver dashboard' },
  { group: 'Inventario', code: 'inventory.view', label: 'Ver inventario' },
  { group: 'Inventario', code: 'inventory.manage', label: 'Gestionar inventario' },
  { group: 'Descuentos', code: 'discounts.view', label: 'Ver descuentos' },
  { group: 'Descuentos', code: 'discounts.manage', label: 'Gestionar descuentos' },
  { group: 'Configuración', code: 'config.edit', label: 'Editar configuración' },
  { group: 'Configuración', code: 'config.team.view', label: 'Ver equipo' },
  { group: 'Configuración', code: 'config.team.manage', label: 'Gestionar equipo' },
  { group: 'Configuración', code: 'config.audit.view', label: 'Ver auditoría' },
  { group: 'Configuración', code: 'config.domains.manage', label: 'Gestionar dominios' },
  { group: 'Catálogo', code: 'catalog.view', label: 'Ver catálogo' },
  { group: 'Catálogo', code: 'catalog.manage', label: 'Gestionar catálogo' },
  // Mensajes y Avanzado — antes sin permiso propio (Mensajes: abierto a
  // cualquier miembro; Avanzado: gate de @Roles('owner','admin') a secas).
  // Pedido explícito de Ale (17/09): poder darle Mensajes o Avanzado a un
  // empleado puntual sin ascenderlo a Propietario. Los negocios existentes
  // los reciben por la migración 20260917_mensajes_avanzado_permisos.
  { group: 'Mensajes', code: 'messages.view', label: 'Ver mensajes' },
  { group: 'Mensajes', code: 'messages.manage', label: 'Responder mensajes' },
  { group: 'Avanzado', code: 'advanced.manage', label: 'Gestionar Avanzado' },
];

// Los códigos solos: lo que recibe el dueño, que pasa por todo (ver PermissionsGuard).
export const CODIGOS_DEL_CATALOGO: string[] = PERMISSIONS.map((p) => p.code);
