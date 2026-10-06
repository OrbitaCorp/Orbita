import Head from 'next/head'
import { serializarJsonLd, type SeoPagina } from '@/lib/storefront/seo'

// Las etiquetas de SEO de una página de la tienda: título, descripción,
// robots, canonical, Open Graph (WhatsApp, Facebook, Instagram), Twitter y los
// datos estructurados de Google. Se dibuja una sola vez, en _app.tsx, con lo
// que arma forceSSR.ts para cada página (`pageProps.__seo`).
//
// Cada etiqueta lleva `key`: next/head se queda con la última de cada clave,
// así una página puede afinar el título (la ficha, cuando carga el producto)
// sin que queden dos <title>.
export function SeoHead({ seo }: { seo: SeoPagina | null | undefined }) {
  if (!seo) return null
  const conImagen = !!seo.image
  return (
    <Head>
      <title key="title">{seo.title}</title>
      {seo.description && <meta key="description" name="description" content={seo.description} />}
      <meta key="robots" name="robots" content={seo.robots} />
      {seo.canonical && <link key="canonical" rel="canonical" href={seo.canonical} />}

      <meta key="og:type" property="og:type" content={seo.tipo === 'product' ? 'product' : 'website'} />
      <meta key="og:site_name" property="og:site_name" content={seo.siteName} />
      <meta key="og:locale" property="og:locale" content="es_AR" />
      <meta key="og:title" property="og:title" content={seo.title} />
      {seo.description && <meta key="og:description" property="og:description" content={seo.description} />}
      {seo.canonical && <meta key="og:url" property="og:url" content={seo.canonical} />}
      {conImagen && <meta key="og:image" property="og:image" content={seo.image!} />}
      {conImagen && <meta key="og:image:width" property="og:image:width" content="1200" />}
      {conImagen && <meta key="og:image:height" property="og:image:height" content="630" />}
      {conImagen && <meta key="og:image:alt" property="og:image:alt" content={seo.imageAlt} />}
      {seo.precio && <meta key="product:price:amount" property="product:price:amount" content={String(seo.precio.monto)} />}
      {seo.precio && <meta key="product:price:currency" property="product:price:currency" content={seo.precio.moneda} />}

      <meta key="twitter:card" name="twitter:card" content={conImagen ? 'summary_large_image' : 'summary'} />
      <meta key="twitter:title" name="twitter:title" content={seo.title} />
      {seo.description && <meta key="twitter:description" name="twitter:description" content={seo.description} />}
      {conImagen && <meta key="twitter:image" name="twitter:image" content={seo.image!} />}

      {seo.jsonLd.map((dato, i) => (
        <script key={`ld-${i}`} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializarJsonLd(dato) }} />
      ))}
    </Head>
  )
}
