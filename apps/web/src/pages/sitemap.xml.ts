// /sitemap.xml — no existía (auditoría de SEO 2026-09-22). Lista las
// páginas públicas de marketing para que Google las encuentre sin tener que
// descubrirlas solo por links.
//
// Solo las 3 páginas estáticas de marketing (home, /nosotros, /planes). Las
// quedan afuera a propósito:
//   - /plantillas/[id]: son ~16 slugs que viven mezclados con ids internos
//     de piezas dentro de PLANTILLAS (datos.tsx) — listarlas bien requiere
//     tocar ese módulo, se deja para una tarea aparte si hace falta.
//   - /tienda/*, /panel, /admin, etc.: no son contenido de marketing, ver
//     robots.txt.ts.
import type { GetServerSideProps } from 'next'
import { ROOT_DOMAIN } from '@/lib/tenant'

const STATIC_PATHS = ['/', '/nosotros', '/planes']

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
    const urlEntries = STATIC_PATHS.map(
        (path) => `  <url>\n    <loc>https://${ROOT_DOMAIN}${path}</loc>\n  </url>`,
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
