// ─── Resolución de tenant (slug de la tienda) desde el subdominio ───────────
//
// El slug identifica al negocio. En este proyecto convive de dos formas:
//   1. Subdominio: `tienda1.orbita.local` → slug = "tienda1"
//   2. Path (legacy / rutas internas de Next): `/tienda/tienda1/...`
//
// El middleware reescribe las URLs de subdominio hacia la estructura de path
// `/tienda/[slug]/...` que ya existe, así que las pages siguen leyendo el slug
// desde `router.query.slug`. Estos helpers son para el código que necesita el
// slug ANTES de tener el router resuelto (ej. el authClient armando el header
// X-Business-Slug), o para construir URLs entre subdominios.

// El dominio raíz de la plataforma. En dev es `orbita.local`; en prod será el
// dominio real. Se puede sobrescribir por env sin recompilar la lógica.
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'orbita.local'

/**
 * Extrae el slug del negocio a partir de un host.
 * - `tienda1.orbita.local`      → "tienda1"
 * - `tienda1.orbita.local:3001` → "tienda1"
 * - `orbita.local` (apex)       → null (no es una tienda; es la plataforma)
 * - `www.orbita.local`          → null (www no es un tenant)
 * - `localhost`                 → null
 */
export function slugFromHost(host: string | null | undefined): string | null {
  if (!host) return null
  const hostname = host.split(':')[0].toLowerCase() // saca el puerto

  // localhost puro no tiene tenant.
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null

  // Debe terminar en el dominio raíz para ser un subdominio nuestro.
  if (!hostname.endsWith(`.${ROOT_DOMAIN}`) && hostname !== ROOT_DOMAIN) return null

  // Apex exacto → plataforma, sin tenant.
  if (hostname === ROOT_DOMAIN) return null

  let sub = hostname.slice(0, -(ROOT_DOMAIN.length + 1)) // quita ".orbita.local"
  if (!sub || sub === 'www') return null

  // "www.tienda.orbita.site" (habito de navegador al tipear/pegar el link) —
  // se saca el "www." de más antes de tomar el primer segmento. Sin esto,
  // devolvía "www" como si fuera el slug de la tienda.
  if (sub.startsWith('www.')) sub = sub.slice(4)
  if (!sub) return null

  // Solo tomamos el primer segmento (no soportamos subdominios anidados).
  return sub.split('.')[0]
}

/**
 * Slug del tenant actual, resuelto desde el host del navegador.
 * Devuelve null en el server (sin window) o en el apex.
 */
export function currentSlug(): string | null {
  if (typeof window === 'undefined') return null
  return slugFromHost(window.location.host)
}

/**
 * Canal de sesión de ESTA pestaña: 'panel' (dueño/member, o platform_admin)
 * vs 'customer' (cliente del storefront). Determina qué cookie de refresh
 * usar (ver bff.ts) para que loguearse como cliente en una pestaña no pise
 * la sesión de dueño abierta en otra.
 *
 * Mismo criterio que el passthrough de middleware.ts: `/panel` y `/admin`
 * son del dueño incluso bajo un subdominio de tienda; el resto de un
 * subdominio es storefront; sin slug (apex/localhost) siempre es panel — un
 * customer nunca existe sin negocio (ver auth.service.ts).
 */
export function authChannel(): 'panel' | 'customer' {
  if (typeof window === 'undefined') return 'panel'
  const { pathname } = window.location
  if (pathname === '/panel' || pathname.startsWith('/panel/') || pathname.startsWith('/admin')) return 'panel'
  return currentSlug() ? 'customer' : 'panel'
}

/**
 * URL absoluta hacia un path dentro del subdominio de un tenant, preservando
 * protocolo y puerto actuales. Se usa para el redirect del login de dueño
 * (apex → subdominio de su tienda), donde una URL relativa no alcanza porque
 * cambia el host.
 */
export function tenantUrl(slug: string, path = '/'): string {
  const proto = typeof window !== 'undefined' ? window.location.protocol : 'http:'
  const port = typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : ''
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${proto}//${slug}.${ROOT_DOMAIN}${port}${cleanPath}`
}

/**
 * URL absoluta hacia el apex (plataforma), preservando protocolo y puerto.
 * Se usa para redirigir al login de dueño cuando se pierde la sesión de panel.
 */
export function apexUrl(path = '/'): string {
  const proto = typeof window !== 'undefined' ? window.location.protocol : 'http:'
  const port = typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : ''
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${proto}//${ROOT_DOMAIN}${port}${cleanPath}`
}

/**
 * Base de las rutas del storefront según CÓMO se está accediendo:
 *  - Subdominio (`tienda1.orbita.local/...`) → '' (rutas relativas a la raíz,
 *    el middleware las reescribe a /tienda/[slug]/...).
 *  - Path legacy (`localhost/tienda/tienda1/...`) → '/tienda/{slug}'.
 * Así los links y redirects quedan bien en ambos modos de acceso.
 */
export function storefrontBase(slug: string): string {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/tienda/')) {
    return `/tienda/${slug}`
  }
  return ''
}
