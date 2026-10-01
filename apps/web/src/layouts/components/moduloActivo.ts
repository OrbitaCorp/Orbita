// ─── Módulo activo del panel ─────────────────────────────────────────────────
// Qué módulo del menú lateral corresponde a la sección que se está viendo
// (`/admin/ventas/{seccion}?vista=…`). Vive aparte del Sidebar porque también
// lo usa el pet de Orbi para tomar la forma del módulo: si cada uno tuviera su
// propia tabla, tarde o temprano se desincronizarían.

const SECCION_MODULO: Record<string, string> = {
    dashboard: 'dashboard', pedidos: 'pedidos', clientes: 'clientes',
    catalogo: 'productos', categorias: 'productos', inventario: 'productos', reportes: 'productos',
    mensajes: 'mensajes', descuentos: 'descuentos', cupones: 'descuentos', configuracion: 'config',
    avanzado: 'avanzado', manual: 'manual',
}

/** Id del módulo del menú (`dashboard`, `pedidos`, …, `manual`). Cae en `dashboard`. */
export function moduloDeSeccion(seccion: string, vista = ''): string {
    if (seccion === 'reportes') return vista === 'clientes' ? 'clientes' : 'productos'
    return SECCION_MODULO[seccion] ?? 'dashboard'
}
