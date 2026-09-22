// Metadatos de SEO (title, description, Open Graph, Twitter Card, canonical)
// para las páginas públicas de marketing (home, /nosotros, /planes). Antes
// cada página ponía su propio <title>/<meta description> a mano (o, en
// /nosotros y /planes, no ponía ninguno) y no había Open Graph en ningún
// lado — auditoría de SEO 2026-09-22: eso hace que Google arme el título y
// la descripción del resultado por su cuenta en vez de usar los que se le
// dan, y que compartir un link en WhatsApp/redes no muestre nada.
import Head from 'next/head'
import { ROOT_DOMAIN } from '@/lib/tenant'

// TODO: reemplazar por una imagen 1200x630 dedicada (hoy usa el ícono
// cuadrado de 512x512, que Facebook/WhatsApp recortan en vez de mostrar
// completo). No hay ninguna imagen "og" en apps/web/public todavía.
const OG_IMAGE_PATH = '/icon-512.png'

type SeoProps = {
    title: string
    description: string
    /** Path de la página, ej. '/', '/nosotros', '/planes'. */
    path: string
}

export function Seo({ title, description, path }: SeoProps) {
    const url = `https://${ROOT_DOMAIN}${path}`
    const image = `https://${ROOT_DOMAIN}${OG_IMAGE_PATH}`

    return (
        <Head>
            <title>{title}</title>
            <meta name="description" content={description} />
            <link rel="canonical" href={url} />

            <meta property="og:type" content="website" />
            <meta property="og:site_name" content="Órbita" />
            <meta property="og:locale" content="es_AR" />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:url" content={url} />
            <meta property="og:image" content={image} />

            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />
        </Head>
    )
}
