// /robots.txt — no existía (auditoría de SEO 2026-09-22). Sin uno, Google
// decide solo qué rastrear y puede terminar indexando rutas internas (panel,
// login, onboarding) en vez de concentrarse en las páginas de marketing.
//
// Ruta dinámica en vez de un archivo estático en /public porque el dominio
// del Sitemap tiene que salir de ROOT_DOMAIN (distinto en dev/prod) y no de
// un valor hardcodeado.
//
// Nota: esta misma ruta se sirve tal cual en cualquier host (apex, subdominio
// de tienda o dominio propio) — el middleware la deja pasar sin reescribir
// porque su matcher excluye paths con punto (ver middleware.ts). Las tiendas
// individuales no tienen todavía su propio robots.txt/sitemap: queda fuera
// del alcance de esto, que es sobre el sitio de marketing.
import type { GetServerSideProps } from 'next'
import { SEO_CANONICAL_HOST, ROOT_DOMAIN } from '@/lib/tenant'
import { getStorefrontSeo } from '@/lib/storefront/api'
import { esHostPrincipal, tiendaDeHost } from '@/lib/storefront/hostTienda'
import { origenDeTienda, robotsDeTienda } from '@/lib/storefront/seo'

const DISALLOWED_PATHS = [
    '/panel',
    '/admin',
    '/api',
    '/login',
    '/registro',
    '/signup',
    '/forgot-password',
    '/restablecer-contrasena',
    '/aceptar-invitacion',
    '/onboarding',
    '/design-system',
    '/superadmin',
    '/tienda',
    '/propuestas',
    '/nueva-home',
    '/turnos-demo',
]

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
    // Una tienda (por subdominio o dominio propio) tiene su propio robots.txt:
    // el de la plataforma le declararía el sitemap de Órbita, no el suyo.
    const tienda = await tiendaDeHost(req.headers.host)
    if (tienda) {
        const seo = await getStorefrontSeo(tienda.slug).catch(() => null)
        const origen = origenDeTienda(tienda.slug, seo?.primaryDomain, ROOT_DOMAIN)
        // Si la API no contestó no se cierra el sitio entero (Google tarda en
        // volver a mirar un robots.txt que prohíbe todo): se deja abierto, y
        // cada página lleva su propio noindex si corresponde.
        const cuerpo = robotsDeTienda(origen, seo ? seo.indexable : true, seo ? esHostPrincipal(tienda, seo.primaryDomain) : false)
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        // Sin variación por navegador: se puede cachear en el borde unos minutos.
        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
        res.write(cuerpo)
        res.end()
        return { props: {} }
    }

    const lines = [
        'User-agent: *',
        'Allow: /',
        ...DISALLOWED_PATHS.map((path) => `Disallow: ${path}`),
        '',
        `Sitemap: https://${SEO_CANONICAL_HOST}/sitemap.xml`,
    ]

    res.setHeader('Content-Type', 'text/plain')
    res.write(lines.join('\n'))
    res.end()

    return { props: {} }
}

export default function RobotsTxt() {
    return null
}
