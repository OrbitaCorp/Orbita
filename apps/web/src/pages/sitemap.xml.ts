// /sitemap.xml — no existía (auditoría de SEO 2026-09-22). Lista las
// páginas públicas de marketing para que Google las encuentre sin tener que
// descubrirlas solo por links.
//
// Solo las páginas estáticas públicas (home, /nosotros, /planes y las legales). Las
// quedan afuera a propósito:
//   - /plantillas/[id]: son ~16 slugs que viven mezclados con ids internos
//     de piezas dentro de PLANTILLAS (datos.tsx) — listarlas bien requiere
//     tocar ese módulo, se deja para una tarea aparte si hace falta.
//   - /tienda/*, /panel, /admin, etc.: no son contenido de marketing, ver
//     robots.txt.ts.
import type { GetServerSideProps } from 'next'
import { SEO_CANONICAL_HOST, ROOT_DOMAIN } from '@/lib/tenant'
import { getStorefrontSitemap } from '@/lib/storefront/api'
import { esHostPrincipal, tiendaDeHost } from '@/lib/storefront/hostTienda'
import { origenDeTienda, sitemapDeTienda } from '@/lib/storefront/seo'

const STATIC_PATHS = ['/', '/demo', '/nosotros', '/planes', '/tiendas', '/terminos', '/privacidad', '/cookies', '/eliminacion-de-datos']

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
    // Una tienda (por subdominio o dominio propio) sirve su propio sitemap, con
    // sus productos y categorías: antes cualquier subdominio devolvía el de la
    // plataforma, con las páginas de Órbita.
    const tienda = await tiendaDeHost(req.headers.host)
    if (tienda) {
        let datos
        try {
            datos = await getStorefrontSitemap(tienda.slug)
        } catch (err) {
            console.error(`[sitemap] no se pudo armar el de "${tienda.slug}":`, err instanceof Error ? err.message : err)
            // Un sitemap vacío le diría a Google "no hay nada": mejor un error
            // que reintente más tarde.
            res.statusCode = 503
            res.setHeader('Retry-After', '600')
            res.end()
            return { props: {} }
        }
        const origen = origenDeTienda(tienda.slug, datos.primaryDomain, ROOT_DOMAIN)
        res.setHeader('Content-Type', 'application/xml; charset=utf-8')
        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
        res.write(sitemapDeTienda(origen, datos, esHostPrincipal(tienda, datos.primaryDomain)))
        res.end()
        return { props: {} }
    }

    const urlEntries = STATIC_PATHS.map(
        (path) => `  <url>\n    <loc>https://${SEO_CANONICAL_HOST}${path}</loc>\n  </url>`,
    ).join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>`

    res.setHeader('Content-Type', 'application/xml')
    res.write(xml)
    res.end()

    return { props: {} }
}

export default function SitemapXml() {
    return null
}
