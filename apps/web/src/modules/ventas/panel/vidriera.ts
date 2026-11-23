// Pantallas del panel que una vidriera digital (Business.mode = SHOWCASE) no usa.
//
// La vidriera muestra el catálogo y el pedido se cierra por WhatsApp: no hay
// carrito, checkout ni cuenta de cliente. Lo de abajo solo tiene sentido con
// checkout: cupones que se canjean en el carrito y la política de
// cancelaciones y devoluciones que pide el comprador desde su cuenta. El menú
// lo oculta y AdminSeccionShell no lo dibuja si se entra por la URL. Si el
// negocio pasa a checkout, vuelve todo solo.
//
// Lo que sí queda: pedidos (se cargan a mano), catálogo, clientes, reportes,
// descuentos automáticos (se ven en la tienda), pagos, envíos, apariencia y,
// desde 2026-11, Mensajes y Difusión: la vidriera vende por WhatsApp e
// Instagram, así que la bandeja, las plantillas y Orbi respondiendo le sirven
// más que a nadie (la API dejó de rechazarlos en SHOWCASE).

const SECCIONES_SOLO_CHECKOUT = new Set(['cupones'])
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
