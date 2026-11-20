// Pantallas del panel que una vidriera digital (Business.mode = SHOWCASE) no usa.
//
// La vidriera muestra el catálogo y el pedido se cierra por WhatsApp: no hay
// carrito, checkout ni cuenta de cliente. Lo de abajo, o la API ya lo rechaza
// con 403 (@FullModeOnly: conversaciones, Instagram, WhatsApp, plantillas), o
// solo tiene sentido con checkout (cupones que se canjean en el carrito, la
// política de cancelaciones y devoluciones que pide el comprador desde su
// cuenta). El menú lo oculta y AdminSeccionShell no lo dibuja si se entra por
// la URL. Si el negocio pasa a checkout, vuelve todo solo.
//
// Lo que sí queda: pedidos (se cargan a mano), catálogo, clientes, reportes,
// descuentos automáticos (se ven en la tienda), pagos, envíos y apariencia.

const SECCIONES_SOLO_CHECKOUT = new Set(['mensajes', 'difusion', 'cupones'])
const VISTAS_SOLO_CHECKOUT: Record<string, string[]> = {
    configuracion: ['postventa'],
}

export function esVidriera(mode: string | null | undefined): boolean {
    return mode === 'SHOWCASE'
}

/** true si la pantalla (sección + vista) no se usa en una vidriera digital. */
export function soloConCheckout(seccion: string | null | undefined, vista?: string | null): boolean {
    if (!seccion) return false
    if (SECCIONES_SOLO_CHECKOUT.has(seccion)) return true
    return !!vista && (VISTAS_SOLO_CHECKOUT[seccion]?.includes(vista) ?? false)
}
