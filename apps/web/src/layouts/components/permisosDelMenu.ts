// Qué permiso hace falta para ver cada módulo del menú lateral. Vive en un
// módulo puro (sin React ni Next) porque lo leen dos lugares:
//
// - Sidebar.tsx, para decidir qué módulos dibuja. Alcanza con UNO de los
//   permisos de la lista (`some`); sin lista, el módulo lo ve cualquiera.
// - El generador del manual para Orbi (manual/paraOrbi.ts): la tool
//   accesoDelEquipo explica "tu empleado no ve Descuentos porque le falta
//   «Ver descuentos»" con estos mismos datos, no con una copia.
//
// Las etiquetas son las de MODULOS en Sidebar.tsx; el test "permisos del menú" de manual/paraOrbi.test.ts
// compara las dos listas.

export const MODULOS_DEL_MENU: { id: string; label: string; permisos: string[] }[] = [
    { id: 'dashboard', label: 'Inicio', permisos: ['reports.dashboard'] },
    { id: 'pedidos', label: 'Pedidos', permisos: ['orders.view'] },
    { id: 'clientes', label: 'Clientes', permisos: ['customers.view'] },
    { id: 'productos', label: 'Productos', permisos: ['catalog.view', 'inventory.view'] },
    { id: 'mensajes', label: 'Mensajes', permisos: ['messages.view'] },
    { id: 'descuentos', label: 'Descuentos', permisos: ['discounts.view', 'discounts.manage'] },
    { id: 'config', label: 'Configuración', permisos: ['config.edit', 'config.team.view', 'config.team.manage', 'config.audit.view', 'config.domains.manage'] },
    { id: 'avanzado', label: 'Avanzado', permisos: ['advanced.manage'] },
    { id: 'manual', label: 'Manual', permisos: [] },
]

export const PERMISOS_MODULO: Record<string, string[]> = Object.fromEntries(
    MODULOS_DEL_MENU.filter(m => m.permisos.length > 0).map(m => [m.id, m.permisos]),
)
