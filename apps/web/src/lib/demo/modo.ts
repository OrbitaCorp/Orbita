// ─── Demo pública de Órbita (demo.orbita.site) ──────────────────────────────
//
// La demo es una tienda REAL (negocio con Business.isDemo en la base, datos
// sembrados) que cualquiera recorre sin cuenta, en dos roles:
//
//   - Cliente: la tienda en `demo.orbita.site/`. Navega, arma el carrito y
//     "compra"; el checkout se simula en el navegador.
//   - Administrador: el panel en `demo.orbita.site/admin/...`. Entra con una
//     sesión anónima de SOLO LECTURA (ver AuthService.demoSession en la API):
//     lee los datos reales de la demo, y lo que crea o edita vive solo en su
//     localStorage (ver lib/demo/interceptor.ts).
//
// Del lado del servidor, DemoGuard rechaza cualquier escritura de un
// visitante: aunque el frontend fallara, los datos sembrados no se tocan.
//
// El dueño real del negocio demo (con su login de siempre) usa el panel
// normal, sin sesión anónima ni localStorage: así se cura la demo.

import { currentSlug } from '@/lib/tenant'

export const DEMO_SLUG = process.env.NEXT_PUBLIC_DEMO_SLUG ?? 'demo'

/** ¿Esta pestaña está en la tienda o el panel de la demo? */
export function esTiendaDemo(): boolean {
  if (typeof window === 'undefined') return false
  if (currentSlug() === DEMO_SLUG) return true
  // Dev sin subdominios: /tienda/demo/...
  return window.location.pathname === `/tienda/${DEMO_SLUG}` || window.location.pathname.startsWith(`/tienda/${DEMO_SLUG}/`)
}

// Si la sesión del panel es la anónima de la demo. En memoria, igual que el
// access token (RBT-290): en un reload se vuelve a pedir.
let visitante = false

export function esVisitanteDemo(): boolean {
  return visitante
}

export function marcarVisitanteDemo(v: boolean): void {
  visitante = v
}
