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
import { ROOT_DOMAIN } from '@/lib/tenant'

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
]

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
    const lines = [
        'User-agent: *',
        'Allow: /',
        ...DISALLOWED_PATHS.map((path) => `Disallow: ${path}`),
        '',
        `Sitemap: https://${ROOT_DOMAIN}/sitemap.xml`,
    ]

    res.setHeader('Content-Type', 'text/plain')
    res.write(lines.join('\n'))
    res.end()

    return { props: {} }
}

export default function RobotsTxt() {
    return null
}
