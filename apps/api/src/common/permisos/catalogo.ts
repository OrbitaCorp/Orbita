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
  // Turnos & Agenda (módulo appointments). El sistema es binario; los alcances
  // "todo / solo lo propio" de Turnos van en pares: el código base da lo propio
  // (su agenda, sus clientes, sus ganancias) y `_all` lo extiende a todo el
  // negocio. Los negocios existentes los reciben por la migración
  // 20261003120100_appointments_permisos (owner y admin). No van al Empleado
  // por defecto: los roles de un negocio de turnos los siembra el alta.
  { group: 'Turnos', code: 'appointments.agenda.view', label: 'Ver su agenda' },
  { group: 'Turnos', code: 'appointments.agenda.view_all', label: 'Ver la agenda de todos' },
  { group: 'Turnos', code: 'appointments.agenda.manage', label: 'Dar, mover y cancelar sus turnos' },
  { group: 'Turnos', code: 'appointments.agenda.manage_all', label: 'Dar, mover y cancelar turnos de todos' },
  { group: 'Turnos', code: 'appointments.clients.view', label: 'Ver sus clientes y su historial' },
  { group: 'Turnos', code: 'appointments.clients.view_all', label: 'Ver todos los clientes' },
  { group: 'Turnos', code: 'appointments.clients.contact', label: 'Ver teléfonos y escribirles' },
  { group: 'Turnos', code: 'appointments.cash.charge', label: 'Cobrar y registrar señas' },
  { group: 'Turnos', code: 'appointments.earnings.view', label: 'Ver sus ganancias' },
  { group: 'Turnos', code: 'appointments.earnings.view_all', label: 'Ver las ganancias de todos' },
  { group: 'Turnos', code: 'appointments.earnings.settle', label: 'Liquidar y registrar pagos al equipo' },
  { group: 'Turnos', code: 'appointments.reports.view', label: 'Ver los números del negocio' },
  { group: 'Turnos', code: 'appointments.services.manage', label: 'Editar servicios y precios' },
  { group: 'Turnos', code: 'appointments.team.manage', label: 'Sumar gente y cambiar roles' },
  { group: 'Turnos', code: 'appointments.settings.manage', label: 'Configurar el negocio de turnos' },
];

// Los códigos solos: lo que recibe el dueño, que pasa por todo (ver PermissionsGuard).
export const CODIGOS_DEL_CATALOGO: string[] = PERMISSIONS.map((p) => p.code);
