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

// La demo tiene dos tiendas, cada una su negocio sembrado (ver
// apps/api/prisma/demo/tienda.ts): Nébula Tech en `demo` —la original, y la
// única con panel: demo.orbita.site/panel— y Nébula Moda en `demo-moda`, la
// de ropa, que es la que abre "Probá la demo". Las dos tiendas llevan el
// selector para pasar de una a otra (SelectorTiendaDemo).
export const DEMO_SLUG = process.env.NEXT_PUBLIC_DEMO_SLUG ?? 'demo'
export const DEMO_SLUG_MODA = process.env.NEXT_PUBLIC_DEMO_SLUG_MODA ?? 'demo-moda'

export const TIENDAS_DEMO = [
  { slug: DEMO_SLUG_MODA, rubro: 'Ropa y accesorios', corto: 'Ropa' },
  { slug: DEMO_SLUG, rubro: 'Tecnología', corto: 'Tecnología' },
] as const

/** La tienda con la que arranca la demo ("Probá la demo" → Tienda). */
export const DEMO_SLUG_TIENDA = DEMO_SLUG_MODA

/** ¿Es el slug de una tienda de la demo? */
export function esSlugDemo(slug: string | null | undefined): boolean {
  return !!slug && TIENDAS_DEMO.some(t => t.slug === slug)
}

/** Slug de la tienda demo de esta pestaña (por subdominio, o /tienda/<slug> en dev), o null. */
export function slugTiendaDemo(): string | null {
  if (typeof window === 'undefined') return null
  const porHost = currentSlug()
  if (esSlugDemo(porHost)) return porHost
  // Dev sin subdominios: /tienda/demo/...
  const enRuta = window.location.pathname.match(/^\/tienda\/([^/]+)/)?.[1] ?? null
  return esSlugDemo(enRuta) ? enRuta : null
}

/** ¿Esta pestaña está en una tienda o el panel de la demo? */
export function esTiendaDemo(): boolean {
  return slugTiendaDemo() !== null
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
