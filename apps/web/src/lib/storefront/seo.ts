// SEO de las tiendas: qué le dice cada página a Google y a los previews de
// WhatsApp, Instagram y Facebook.
//
// Hasta acá las páginas de una tienda salían sin título, sin descripción, sin
// imagen para compartir, sin canonical y sin datos estructurados (medido el
// 05/10/2026 en una tienda real), así que Google no tenía qué mostrar y un link
// de producto pegado en WhatsApp se veía como una URL pelada.
//
// Todo lo de este archivo es puro (sin red ni DOM) a propósito: son las reglas
// de qué se indexa y con qué URL, y tienen que poder probarse. Lo que trae los
// datos vive en forceSSR.ts; lo que dibuja las etiquetas, en SeoHead.tsx.

import type { StorefrontProductDetail } from './api'

/** Las páginas de la tienda que se pueden indexar. Todas las demás van con noindex. */
export type TipoPagina = 'inicio' | 'catalogo' | 'categoria' | 'producto'

export type Robots = 'index, follow' | 'noindex, follow' | 'noindex, nofollow'

export type SeoPagina = {
  title: string
  description: string
  /** URL absoluta de la página, en el dominio que el dueño quiere posicionar. Sin parámetros. */
  canonical: string | null
  robots: Robots
  /** URL absoluta de la imagen para compartir (ya convertida a JPEG por /api/og). */
  image: string | null
  imageAlt: string
  tipo: 'website' | 'product'
  siteName: string
  /** Para `og:product:price`. */
  precio: { monto: number; moneda: string } | null
  jsonLd: Record<string, unknown>[]
  /**
   * Contenido de la etiqueta `<meta name="google-site-verification">`: la prueba de que Órbita es
   * dueña del dominio propio ante Google Search Console. Solo la portada la lleva.
   */
  googleVerificacion?: string[]
}

/** Lo que cualquier página sabe de la tienda. */
export type ContextoSeo = {
  slug: string
  nombre: string
  tagline: string | null
  logo: string | null
  /** Con dominio propio activo, ese; si no, el subdominio de Órbita. Sin barra final. */
  origen: string
  /** Lo que respondió la API: publicada, en línea, no es la demo y tiene productos. */
  indexable: boolean
  instagram: string | null
  facebook: string | null
  tiktok: string | null
  /** Tokens de verificación de Google de los dominios propios de la tienda (los devuelve la API). */
  googleVerificacion?: string[]
}

const MONEDA = 'ARS'
const LARGO_TITULO = 60
const LARGO_DESCRIPCION = 160

// ─── Dónde vive la tienda ──────────────────────────────────────────────────

/**
 * El origen público de la tienda: su dominio propio ACTIVO, o si no su
 * subdominio de Órbita. Ese es al que apuntan todos los canonical: la misma
 * tienda se puede abrir por el subdominio, por el dominio propio y por
 * `orbita.site/tienda/slug`, y sin esto Google las toma por páginas distintas.
 */
export function origenDeTienda(slug: string, primaryDomain: string | null | undefined, rootDomain: string): string {
  const host = primaryDomain?.trim().toLowerCase().replace(/\.$/, '')
  return host ? `https://${host}` : `https://${slug}.${rootDomain}`
}

// ─── Texto ─────────────────────────────────────────────────────────────────

/** Texto plano: sin HTML ni marcas de markdown, con los espacios colapsados. */
export function textoPlano(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/<[^>]*>/g, ' ')
    // Marcas de markdown (negrita, tachado, código, títulos y citas al empezar la línea), pegadas al texto.
    // `#` y `_` sueltos se dejan: pueden ser parte de la descripción ("#2", "talle_m").
    .replace(/\*+|__|~~|`/g, '')
    .replace(/(^|\n)[ \t]*[#>]+[ \t]*/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
}

/** Corta en el último espacio antes del límite y agrega "…". No parte palabras. */
export function acotar(s: string, max: number): string {
  if (s.length <= max) return s
  const corte = s.slice(0, max - 1)
  const espacio = corte.lastIndexOf(' ')
  return `${(espacio > max * 0.6 ? corte.slice(0, espacio) : corte).replace(/[\s,.;:–—-]+$/, '')}…`
}

const formatoPrecio = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
export const precioLegible = (monto: number) => `$ ${formatoPrecio.format(Math.round(monto))}`

/** "Producto | Tienda", acotado: Google corta los títulos largos. */
export function armarTitulo(principal: string, tienda: string): string {
  const completo = `${principal} | ${tienda}`
  if (completo.length <= LARGO_TITULO) return completo
  // Si no entra con la tienda, se sacrifica el nombre del producto, no la marca.
  const lugar = LARGO_TITULO - tienda.length - 3
  return lugar >= 12 ? `${acotar(principal, lugar)} | ${tienda}` : acotar(completo, LARGO_TITULO)
}

// ─── Parámetros de la URL ──────────────────────────────────────────────────

const PARAMETROS_DE_SEGUIMIENTO = /^(utm_|fbclid$|gclid$|gbraid$|wbraid$|ttclid$|msclkid$|mc_|_ga$|igshid$|igsh$|ref$|src$)/i

/**
 * Los parámetros de la URL que de verdad cambian lo que se ve. Los de
 * seguimiento (utm_*, fbclid, gclid…) no: un link de Instagram con
 * `?utm_source=bio` es la misma página y no puede volverse "otra" para Google.
 */
export function parametrosRelevantes(query: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(query)) {
    if (k === 'slug' || k === 'id' || k === 'categoria' || PARAMETROS_DE_SEGUIMIENTO.test(k)) continue
    const valor = Array.isArray(v) ? v.join(',') : v
    if (valor !== undefined && valor !== '') out[k] = valor
  }
  return out
}

// ─── Imagen para compartir ─────────────────────────────────────────────────

/**
 * La imagen del preview, servida como JPEG 1200×630 por /api/og. Las fotos del
 * catálogo se guardan en webp y no todos los rastreadores de previews lo
 * leen; un JPEG de ese tamaño se ve bien en todos.
 */
export function imagenParaCompartir(origen: string, urlImagen: string | null | undefined): string | null {
  if (!urlImagen) return null
  return `${origen}/api/og?u=${encodeURIComponent(urlImagen)}`
}

// ─── JSON-LD ───────────────────────────────────────────────────────────────

const unico = <T>(xs: (T | null | undefined | false)[]): T[] => [...new Set(xs.filter((x): x is T => !!x))]

function perfilesSociales(ctx: ContextoSeo): string[] {
  // Los handles se guardan sueltos ("@mitienda") o como URL: se normalizan a URL.
  const url = (base: string, v: string | null) => {
    if (!v) return null
    const t = v.trim()
    if (/^https?:\/\//i.test(t)) return t
    const handle = t.replace(/^@/, '').replace(/^\/+/, '')
    return handle ? `${base}${handle}` : null
  }
  return unico([
    url('https://www.instagram.com/', ctx.instagram),
    url('https://www.facebook.com/', ctx.facebook),
    url('https://www.tiktok.com/@', ctx.tiktok),
  ])
}

/** La tienda y su buscador. Solo en la portada. */
export function jsonLdTienda(ctx: ContextoSeo): Record<string, unknown>[] {
  const sameAs = perfilesSociales(ctx)
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'OnlineStore',
      name: ctx.nombre,
      url: `${ctx.origen}/`,
      ...(ctx.logo ? { logo: ctx.logo } : {}),
      ...(ctx.tagline ? { description: ctx.tagline } : {}),
      ...(sameAs.length > 0 ? { sameAs } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: ctx.nombre,
      url: `${ctx.origen}/`,
      // El catálogo ya lee ?search=, así que el buscador de la tienda es real.
      potentialAction: {
        '@type': 'SearchAction',
        target: `${ctx.origen}/catalogo?search={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ]
}

export function jsonLdMigas(items: { nombre: string; url: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.nombre, item: it.url })),
  }
}

/**
 * El producto, con precio y disponibilidad reales. Sin estrellas: las reseñas
 * de Órbita son solo texto, sin puntaje, y Google no muestra estrellas sin
 * `ratingValue` (ni hay que inventarlo).
 */
export function jsonLdProducto(p: StorefrontProductDetail, ctx: ContextoSeo, canonical: string, descripcion: string): Record<string, unknown> {
  const variantes = p.variants ?? []
  const precios = variantes.length > 0 ? variantes.map((v) => v.price) : [p.price]
  const min = Math.min(...precios)
  const max = Math.max(...precios)
  const hayStock = variantes.length > 0 ? variantes.some((v) => v.inStock) : true
  const disponibilidad = hayStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
  const vendedor = { '@type': 'Organization', name: ctx.nombre }
  const sku = variantes.find((v) => v.sku)?.sku

  const oferta = min === max
    ? { '@type': 'Offer', url: canonical, price: min, priceCurrency: MONEDA, availability: disponibilidad, seller: vendedor }
    : { '@type': 'AggregateOffer', url: canonical, lowPrice: min, highPrice: max, offerCount: precios.length, priceCurrency: MONEDA, availability: disponibilidad, seller: vendedor }

  // La principal primero: es la que Google usa de miniatura.
  const ordenadas = [...(p.images ?? [])].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
  const imagenes = unico(ordenadas.map((im) => im.url)).slice(0, 6)
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: descripcion,
    url: canonical,
    ...(imagenes.length > 0 ? { image: imagenes } : {}),
    ...(sku ? { sku } : {}),
    ...(p.categoryName ? { category: p.categoryName } : {}),
    offers: oferta,
  }
}

/** Para incrustar en un <script>: nada que cierre el script antes de tiempo. */
export function serializarJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

// ─── Una función por página ────────────────────────────────────────────────

/** Solo pasan tokens con la forma de los de Google: el valor va dentro de un atributo del HTML. */
export function tokensDeVerificacion(lista: string[] | null | undefined): string[] {
  return [...new Set((lista ?? []).filter((t) => /^[A-Za-z0-9_-]{20,128}$/.test(t)))]
}

const base = (ctx: ContextoSeo) => ({
  siteName: ctx.nombre,
  imageAlt: ctx.nombre,
  tipo: 'website' as const,
  precio: null,
})

/**
 * Una página que no se indexa (carrito, checkout, perfil, login…, o una
 * tienda que no corresponde mostrar en Google). Lleva título para la pestaña,
 * pero nada para compartir.
 */
export function seoNoIndexable(nombreTienda: string, titulo?: string, robots: Robots = 'noindex, nofollow'): SeoPagina {
  return {
    title: titulo ? armarTitulo(titulo, nombreTienda) : nombreTienda,
    description: '',
    canonical: null,
    robots,
    image: null,
    imageAlt: nombreTienda,
    tipo: 'website',
    siteName: nombreTienda,
    precio: null,
    jsonLd: [],
  }
}

export function seoInicio(ctx: ContextoSeo): SeoPagina {
  const descripcion = acotar(textoPlano(ctx.tagline) || `Conocé el catálogo de ${ctx.nombre}.`, LARGO_DESCRIPCION)
  const titulo = ctx.tagline ? acotar(`${ctx.nombre} — ${textoPlano(ctx.tagline)}`, LARGO_TITULO) : ctx.nombre
  return {
    ...base(ctx),
    title: titulo,
    description: descripcion,
    canonical: `${ctx.origen}/`,
    robots: ctx.indexable ? 'index, follow' : 'noindex, follow',
    image: imagenParaCompartir(ctx.origen, ctx.logo),
    jsonLd: ctx.indexable ? jsonLdTienda(ctx) : [],
    googleVerificacion: tokensDeVerificacion(ctx.googleVerificacion),
  }
}

/**
 * El catálogo. Con parámetros que filtran u ordenan (precio, orden, búsqueda,
 * varias categorías, página 2…) cada combinación sería una página "nueva" casi
 * igual a las otras: se piden sin indexar y con el canonical en el catálogo
 * limpio. Con `?cat=<una categoría>` el canonical es su página de categoría.
 */
export function seoCatalogo(ctx: ContextoSeo, params: Record<string, string>): SeoPagina {
  const claves = Object.keys(params)
  const soloUnaCategoria = claves.length === 1 && claves[0] === 'cat' && /^[\w-]+$/.test(params.cat)
  const path = soloUnaCategoria ? `/catalogo/${params.cat}` : '/catalogo'
  const filtrado = claves.length > 0 && !soloUnaCategoria
  return {
    ...base(ctx),
    title: armarTitulo('Catálogo', ctx.nombre),
    description: acotar(`Mirá todos los productos de ${ctx.nombre}.`, LARGO_DESCRIPCION),
    canonical: `${ctx.origen}${path}`,
    robots: ctx.indexable && !filtrado ? 'index, follow' : 'noindex, follow',
    image: imagenParaCompartir(ctx.origen, ctx.logo),
    jsonLd: [],
  }
}

export function seoCategoria(ctx: ContextoSeo, categoria: { slug: string; nombre: string }): SeoPagina {
  return {
    ...base(ctx),
    title: armarTitulo(categoria.nombre, ctx.nombre),
    description: acotar(`${categoria.nombre} en ${ctx.nombre}. Mirá los productos disponibles.`, LARGO_DESCRIPCION),
    canonical: `${ctx.origen}/catalogo/${categoria.slug}`,
    robots: ctx.indexable ? 'index, follow' : 'noindex, follow',
    image: imagenParaCompartir(ctx.origen, ctx.logo),
    jsonLd: ctx.indexable
      ? [jsonLdMigas([
          { nombre: 'Inicio', url: `${ctx.origen}/` },
          { nombre: 'Catálogo', url: `${ctx.origen}/catalogo` },
          { nombre: categoria.nombre, url: `${ctx.origen}/catalogo/${categoria.slug}` },
        ])]
      : [],
  }
}

export function seoProducto(ctx: ContextoSeo, p: StorefrontProductDetail): SeoPagina {
  const canonical = `${ctx.origen}/producto/${p.id}`
  const precioMinimo = Math.min(...(p.variants?.length ? p.variants.map((v) => v.price) : [p.price]))
  const propia = textoPlano(p.description)
  // Sin descripción propia, una de datos reales: nada que el dueño no haya cargado.
  const descripcion = acotar(
    propia || `${p.name}${p.categoryName ? ` — ${p.categoryName}` : ''}. ${precioLegible(precioMinimo)} en ${ctx.nombre}.`,
    LARGO_DESCRIPCION,
  )
  const foto = (p.images?.find((im) => im.isPrimary) ?? p.images?.[0])?.url ?? null
  return {
    ...base(ctx),
    title: armarTitulo(p.name, ctx.nombre),
    description: descripcion,
    canonical,
    robots: ctx.indexable ? 'index, follow' : 'noindex, follow',
    image: imagenParaCompartir(ctx.origen, foto ?? ctx.logo),
    imageAlt: p.name,
    tipo: 'product',
    precio: { monto: precioMinimo, moneda: MONEDA },
    jsonLd: ctx.indexable
      ? [
          jsonLdProducto(p, ctx, canonical, propia ? acotar(propia, 5000) : descripcion),
          jsonLdMigas([
            { nombre: 'Inicio', url: `${ctx.origen}/` },
            { nombre: 'Catálogo', url: `${ctx.origen}/catalogo` },
            { nombre: p.name, url: canonical },
          ]),
        ]
      : [],
  }
}

// ─── sitemap.xml y robots.txt de una tienda ────────────────────────────────

const escaparXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

export type DatosSitemap = {
  indexable: boolean
  categories: { slug: string; updatedAt: string }[]
  products: { id: string; updatedAt: string }[]
}

/**
 * El sitemap de la tienda en `host`. Solo lista URLs de ESE host: el protocolo
 * exige que un sitemap contenga URLs de su propio dominio. Por eso, si la
 * tienda tiene dominio propio, el sitemap del subdominio sale vacío (sus
 * páginas ya dicen en el canonical que el original es el otro).
 */
export function sitemapDeTienda(origen: string, datos: DatosSitemap, esHostPrincipal: boolean): string {
  const urls: { loc: string; lastmod?: string }[] = []
  if (datos.indexable && esHostPrincipal) {
    const ultima = [...datos.products.map((p) => p.updatedAt), ...datos.categories.map((c) => c.updatedAt)].sort().pop()
    urls.push({ loc: `${origen}/`, lastmod: ultima })
    urls.push({ loc: `${origen}/catalogo`, lastmod: ultima })
    for (const c of datos.categories) urls.push({ loc: `${origen}/catalogo/${encodeURIComponent(c.slug)}`, lastmod: c.updatedAt })
    for (const p of datos.products) urls.push({ loc: `${origen}/producto/${encodeURIComponent(p.id)}`, lastmod: p.updatedAt })
  }
  const filas = urls
    .map((u) => `  <url>\n    <loc>${escaparXml(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}\n  </url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${filas ? `\n${filas}\n` : '\n'}</urlset>`
}

// Lo que ninguna tienda quiere en Google: el panel, las cuentas, el carrito y
// el checkout. Son páginas de uso personal y no aportan nada en una búsqueda.
const RUTAS_PRIVADAS = [
  '/panel', '/admin', '/api', '/carrito', '/checkout', '/perfil', '/login', '/registro',
  '/forgot-password', '/restablecer-contrasena', '/pedido', '/superadmin',
]

export function robotsDeTienda(origen: string, indexable: boolean, esHostPrincipal: boolean): string {
  // Una tienda que no corresponde mostrar en Google se cierra entera: sin
  // productos, pausada o la demo, no hay nada que rastrear.
  if (!indexable) return 'User-agent: *\nDisallow: /\n'
  const lineas = ['User-agent: *', 'Allow: /', ...RUTAS_PRIVADAS.map((r) => `Disallow: ${r}`)]
  // El sitemap solo se declara en el host principal: ahí están las URLs canónicas.
  if (esHostPrincipal) lineas.push('', `Sitemap: ${origen}/sitemap.xml`)
  return `${lineas.join('\n')}\n`
}
