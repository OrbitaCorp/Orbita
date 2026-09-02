import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ─── Middleware de subdominios + dominios propios (multi-tenant) ───────────
//
// Resuelve el tenant a partir del host y reescribe la URL hacia la
// estructura de páginas que ya existe, SIN tocar las pages:
//
//   tienda1.orbita.local/            → /tienda/tienda1            (storefront home)
//   tienda1.orbita.local/login       → /tienda/tienda1/login
//   tienda1.orbita.local/registro    → /tienda/tienda1/registro
//   tienda1.orbita.local/perfil      → /tienda/tienda1/perfil
//   tienda1.orbita.local/panel       → /panel                    (NO se reescribe: área dueño)
//   orbita.local/login               → /login                    (apex: login de dueño)
//   midominiopropio.com/             → /tienda/tienda1            (dominio propio vinculado, ver abajo)
//
// El slug queda disponible en las pages vía `router.query.slug` (por el rewrite)
// y también se propaga en el header `x-orbita-slug` por si algún día se lee
// desde getServerSideProps.
//
// Dominios propios (Configuración → Dominios, "Vincular un dominio que ya
// tenés"): el hostname no trae el slug adentro como un subdominio — hay que
// resolverlo contra la base (CustomDomain). Bug encontrado 2026-09-02: antes
// esto no existía, así que un dominio propio ya vinculado y con DNS
// correctamente apuntado a Vercel terminaba mostrando la LANDING DE ÓRBITA
// en vez de la tienda del negocio (el middleware nunca reconocía el host).
//
// NO es un router genérico: solo mapea host → path del storefront. Ver
// `lib/tenant.ts` para la resolución de slug en el cliente.

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'orbita.local'
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

// Paths que en un subdominio de tienda NO se reescriben al storefront:
// se sirven tal cual (área de dueño, o rutas internas).
function isPassthrough(pathname: string): boolean {
  return (
    pathname === '/panel' ||
    pathname.startsWith('/panel/') ||
    pathname.startsWith('/admin') ||
    // El link del mail de invitación al equipo: es una página de plataforma
    // (vive en el apex), pero si el mail quedó apuntando a un subdominio el
    // rewrite la mandaba al storefront → 404. Pasa tal cual en ambos hosts.
    pathname.startsWith('/aceptar-invitacion') ||
    // Ídem: el link del mail de reset de contraseña de un miembro.
    pathname.startsWith('/restablecer-contrasena') ||
    pathname.startsWith('/tienda') // ya está en la forma final
  )
}

// Solo el caso *.orbita.local — el llamador ya confirmó el sufijo, acá solo
// se extrae el primer label como slug.
function slugFromSubdomain(hostname: string): string | null {
  let sub = hostname.slice(0, -(ROOT_DOMAIN.length + 1))
  if (!sub || sub === 'www') return null
  // "www.tienda.orbita.site" (alguien tipea/pega el link con www de más,
  // habito de navegador) — se saca el "www." de más y se toma el primer
  // label de lo que queda como slug. Antes esto devolvía "www" como si fuera
  // el slug de la tienda (bug: `sub.split('.')[0]` sin sacar el www primero).
  if (sub.startsWith('www.')) sub = sub.slice(4)
  if (!sub) return null
  return sub.split('.')[0]
}

// Dominio propio (no termina en .orbita.local ni es el apex) → hay que
// resolverlo contra la base, no hay forma de derivarlo del hostname solo.
// Un fetch por request, sin cache propia todavía — el volumen de dominios
// propios es bajo hoy (recién el primero, ver Dominios.tsx); si el volumen
// crece, vale la pena agregar Cache-Control corto del lado del endpoint.
async function slugFromCustomDomain(hostname: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/storefront/by-domain/${hostname}`)
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    return typeof data?.slug === 'string' ? data.slug : null
  } catch {
    return null // API caída/lenta: se sirve sin tenant en vez de colgar la request
  }
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const hostname = host.split(':')[0].toLowerCase()

  let slug: string | null = null
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== ROOT_DOMAIN) {
    slug = hostname.endsWith(`.${ROOT_DOMAIN}`)
      ? slugFromSubdomain(hostname)
      : await slugFromCustomDomain(hostname)
  }

  // Apex (orbita.local), localhost, o dominio propio no vinculado → sin
  // tenant, se sirve tal cual.
  if (!slug) return NextResponse.next()

  const { pathname } = request.nextUrl

  // En un subdominio de tienda, el área de dueño y las rutas internas pasan
  // sin reescribir; el resto se mapea al storefront `/tienda/[slug]/...`.
  if (isPassthrough(pathname)) {
    const res = NextResponse.next()
    res.headers.set('x-orbita-slug', slug)
    return res
  }

  const url = request.nextUrl.clone()
  url.pathname = `/tienda/${slug}${pathname === '/' ? '' : pathname}`

  const res = NextResponse.rewrite(url)
  res.headers.set('x-orbita-slug', slug)
  return res
}

export const config = {
  // Corre en todo salvo assets internos de Next, el BFF (/api), y archivos
  // estáticos con extensión. El BFF se excluye para que sus rutas queden en
  // el mismo origen sin reescribir.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
