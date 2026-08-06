import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ─── Middleware de subdominios (multi-tenant) ───────────────────────────────
//
// Resuelve el tenant a partir del subdominio y reescribe la URL hacia la
// estructura de páginas que ya existe, SIN tocar las pages:
//
//   tienda1.orbita.local/            → /tienda/tienda1            (storefront home)
//   tienda1.orbita.local/login       → /tienda/tienda1/login
//   tienda1.orbita.local/registro    → /tienda/tienda1/registro
//   tienda1.orbita.local/perfil      → /tienda/tienda1/perfil
//   tienda1.orbita.local/panel       → /panel                    (NO se reescribe: área dueño)
//   orbita.local/login               → /login                    (apex: login de dueño)
//
// El slug queda disponible en las pages vía `router.query.slug` (por el rewrite)
// y también se propaga en el header `x-orbita-slug` por si algún día se lee
// desde getServerSideProps.
//
// NO es un router genérico: solo mapea subdominio → path del storefront. Ver
// `lib/tenant.ts` para la resolución de slug en el cliente.

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'orbita.local'

// Paths que en un subdominio de tienda NO se reescriben al storefront:
// se sirven tal cual (área de dueño, o rutas internas).
function isPassthrough(pathname: string): boolean {
  return (
    pathname === '/panel' ||
    pathname.startsWith('/panel/') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/tienda') // ya está en la forma final
  )
}

function slugFromHost(host: string): string | null {
  const hostname = host.split(':')[0].toLowerCase()
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null
  if (hostname === ROOT_DOMAIN) return null
  if (!hostname.endsWith(`.${ROOT_DOMAIN}`)) return null
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

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const slug = slugFromHost(host)

  // Apex (orbita.local) o localhost → sin tenant, se sirve tal cual.
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
