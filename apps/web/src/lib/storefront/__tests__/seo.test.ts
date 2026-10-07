import { describe, expect, it } from 'vitest'
import type { StorefrontProductDetail } from '../api'
import {
  acotar, armarTitulo, imagenParaCompartir, origenDeTienda, parametrosRelevantes, precioLegible, robotsDeTienda,
  seoCatalogo, seoCategoria, seoInicio, seoNoIndexable, seoProducto, serializarJsonLd, sitemapDeTienda, textoPlano, tokensDeVerificacion,
  type ContextoSeo,
} from '../seo'
import { urlDeFotoPermitida } from '../og'
import { esHostPrincipal, type TiendaDeHost } from '../hostTienda'

const ctx = (over: Partial<ContextoSeo> = {}): ContextoSeo => ({
  slug: 'venustyle', nombre: 'Venus Style', tagline: 'Ropa deportiva y streetwear', logo: 'https://x.supabase.co/storage/v1/object/public/logo.webp',
  origen: 'https://venustyle.orbita.site', indexable: true, instagram: '@venus.style', facebook: null, tiktok: null, ...over,
})

const variante = (price: number, inStock = true, sku: string | null = null) =>
  ({ id: `v${price}`, sku, price, comparePrice: null, isDefault: false, optionValues: [], inStock, lowStock: false, maxQty: 3 })

const producto = (over: Partial<StorefrontProductDetail> = {}): StorefrontProductDetail => ({
  id: '900d84cd-dc2e-4e33-8260-47800a971f4b', name: 'POTRERO/NBA3', description: 'Short deportivo de **tela liviana**.\n\nIdeal para jugar.',
  categoryId: 'c1', categoryName: 'SHORTS DEPORTIVOS', price: 17000, comparePrice: null, isFeatured: false, promoLabel: null, promo: null,
  specs: [], videoUrl: null, tags: [], options: [],
  variants: [variante(17000, true, 'SH-01')],
  images: [
    { url: 'https://x.supabase.co/storage/v1/object/public/p/2.webp', position: 1, isPrimary: false, optionValueId: null, hasAiBackground: false },
    { url: 'https://x.supabase.co/storage/v1/object/public/p/1.webp', position: 0, isPrimary: true, optionValueId: null, hasAiBackground: false },
  ],
  ...over,
} as StorefrontProductDetail)

const ld = (seo: ReturnType<typeof seoProducto>, tipo: string) => seo.jsonLd.find((x) => x['@type'] === tipo) as Record<string, any>

describe('origenDeTienda', () => {
  it('con dominio propio activo gana el dominio propio', () => {
    expect(origenDeTienda('venustyle', 'tefaltacalleok.com', 'orbita.site')).toBe('https://tefaltacalleok.com')
  })
  it('sin dominio propio, el subdominio de Órbita', () => {
    expect(origenDeTienda('venustyle', null, 'orbita.site')).toBe('https://venustyle.orbita.site')
    expect(origenDeTienda('venustyle', undefined, 'orbita.site')).toBe('https://venustyle.orbita.site')
  })
  it('normaliza mayúsculas y el punto final', () => {
    expect(origenDeTienda('t', ' MiTienda.COM. ', 'orbita.site')).toBe('https://mitienda.com')
  })
})

describe('texto', () => {
  it('textoPlano saca HTML, markdown y espacios de más', () => {
    expect(textoPlano('<p>Hola **mundo**</p>\n\n  `ok`  ')).toBe('Hola mundo ok')
    expect(textoPlano(null)).toBe('')
  })
  it('acotar no pasa del máximo, no parte palabras y agrega …', () => {
    const t = acotar('Una descripción bastante larga que no entra en el espacio disponible para esto', 40)
    expect(t.length).toBeLessThanOrEqual(40)
    expect(t.endsWith('…')).toBe(true)
    expect(t).not.toMatch(/\s…$/)
    expect(acotar('corto', 40)).toBe('corto')
  })
  it('armarTitulo cabe en 60 y conserva la marca antes que el nombre del producto', () => {
    const largo = armarTitulo('Short deportivo de básquet edición limitada NBA Celtics 2026', 'Venus Style')
    expect(largo.length).toBeLessThanOrEqual(60)
    expect(largo.endsWith('| Venus Style')).toBe(true)
    expect(armarTitulo('Short', 'Venus Style')).toBe('Short | Venus Style')
  })
  it('precioLegible usa puntos de miles', () => {
    expect(precioLegible(17000)).toBe('$ 17.000')
  })
})

describe('parametrosRelevantes', () => {
  it('ignora el seguimiento (utm, fbclid, gclid…) y las claves de la ruta', () => {
    expect(parametrosRelevantes({ slug: 'venustyle', utm_source: 'bio', utm_medium: 'instagram', fbclid: 'x', igsh: 'y' })).toEqual({})
  })
  it('conserva lo que de verdad filtra', () => {
    expect(parametrosRelevantes({ slug: 't', cat: 'remeras', sort: 'precio', utm_source: 'bio' })).toEqual({ cat: 'remeras', sort: 'precio' })
  })
})

describe('seoInicio', () => {
  it('una tienda indexable: index, canonical limpio, título con la bajada y datos de la tienda', () => {
    const s = seoInicio(ctx())
    expect(s.robots).toBe('index, follow')
    expect(s.canonical).toBe('https://venustyle.orbita.site/')
    expect(s.title).toBe('Venus Style — Ropa deportiva y streetwear')
    expect(s.jsonLd.map((x) => x['@type'])).toEqual(['OnlineStore', 'WebSite'])
  })
  it('no promete nada que no se sepa: sin bajada, una descripción neutra', () => {
    const s = seoInicio(ctx({ tagline: null }))
    expect(s.title).toBe('Venus Style')
    expect(s.description).toBe('Conocé el catálogo de Venus Style.')
  })
  it('las redes sociales salen como URLs completas, y solo las que hay', () => {
    const tienda = seoInicio(ctx({ instagram: '@venus.style', facebook: 'https://facebook.com/venus' })).jsonLd[0] as Record<string, any>
    expect(tienda.sameAs).toEqual(['https://www.instagram.com/venus.style', 'https://facebook.com/venus'])
  })
  it('el buscador de la tienda apunta a /catalogo?search=', () => {
    const web = seoInicio(ctx()).jsonLd[1] as Record<string, any>
    expect(web.potentialAction.target).toBe('https://venustyle.orbita.site/catalogo?search={search_term_string}')
  })
  it('una tienda no indexable va con noindex y sin datos estructurados', () => {
    const s = seoInicio(ctx({ indexable: false }))
    expect(s.robots).toBe('noindex, follow')
    expect(s.jsonLd).toEqual([])
  })
  it('con dominio propio el canonical es el dominio propio', () => {
    expect(seoInicio(ctx({ origen: 'https://tefaltacalleok.com' })).canonical).toBe('https://tefaltacalleok.com/')
  })

  // Search Console: la etiqueta con la que Google da por verificado un dominio propio.
  const TOKEN = 'abc123_TOKEN-de-google-0123456789'
  it('la portada lleva el token de verificación de Google', () => {
    expect(seoInicio(ctx({ googleVerificacion: [TOKEN] })).googleVerificacion).toEqual([TOKEN])
  })
  it('sin token (la mayoría de las tiendas) no manda ninguna etiqueta', () => {
    expect(seoInicio(ctx()).googleVerificacion).toEqual([])
  })
  it('un token que no tiene la forma de los de Google se descarta (va dentro de un atributo del HTML)', () => {
    expect(tokensDeVerificacion([TOKEN, 'corto', '"><script>alert(1)</script>' + 'x'.repeat(30), TOKEN])).toEqual([TOKEN])
  })
  it('solo la portada lo lleva: el catálogo y la ficha no', () => {
    expect(seoCatalogo(ctx({ googleVerificacion: [TOKEN] }), {}).googleVerificacion).toBeUndefined()
  })
})

describe('seoCatalogo', () => {
  it('el catálogo limpio se indexa', () => {
    const s = seoCatalogo(ctx(), {})
    expect(s.robots).toBe('index, follow')
    expect(s.canonical).toBe('https://venustyle.orbita.site/catalogo')
  })
  it('?cat=<una categoría> es su página de categoría', () => {
    const s = seoCatalogo(ctx(), { cat: 'remeras' })
    expect(s.canonical).toBe('https://venustyle.orbita.site/catalogo/remeras')
    expect(s.robots).toBe('index, follow')
  })
  it.each([
    ['ordenar', { sort: 'precio' }],
    ['buscar', { search: 'nba' }],
    ['varias categorías', { cat: 'a,b' }],
    ['página 2', { page: '2' }],
    ['categoría y precio', { cat: 'remeras', min: '1000' }],
  ])('%s: se pide sin indexar y el canonical queda en el catálogo limpio', (_c, params) => {
    const s = seoCatalogo(ctx(), params as Record<string, string>)
    expect(s.robots).toBe('noindex, follow')
    expect(s.canonical).toMatch(/\/catalogo(\/[\w-]+)?$/)
  })
})

describe('seoCategoria', () => {
  it('título, canonical por ruta y migas de pan', () => {
    const s = seoCategoria(ctx(), { slug: 'remeras', nombre: 'Remeras' })
    expect(s.title).toBe('Remeras | Venus Style')
    expect(s.canonical).toBe('https://venustyle.orbita.site/catalogo/remeras')
    expect(ld({ ...s } as never, 'BreadcrumbList').itemListElement).toHaveLength(3)
  })
})

describe('seoProducto', () => {
  it('canonical, título y descripción salen del producto, sin markdown', () => {
    const s = seoProducto(ctx(), producto())
    expect(s.canonical).toBe('https://venustyle.orbita.site/producto/900d84cd-dc2e-4e33-8260-47800a971f4b')
    expect(s.title).toBe('POTRERO/NBA3 | Venus Style')
    expect(s.description).toBe('Short deportivo de tela liviana. Ideal para jugar.')
    expect(s.tipo).toBe('product')
    expect(s.precio).toEqual({ monto: 17000, moneda: 'ARS' })
  })

  it('sin descripción propia usa solo datos reales: nombre, categoría, precio y tienda', () => {
    const s = seoProducto(ctx(), producto({ description: null }))
    expect(s.description).toBe('POTRERO/NBA3 — SHORTS DEPORTIVOS. $ 17.000 en Venus Style.')
  })

  it('el JSON-LD del producto lleva precio en ARS, disponibilidad y la foto principal primero', () => {
    const p = ld(seoProducto(ctx(), producto()), 'Product')
    expect(p.offers).toMatchObject({ '@type': 'Offer', price: 17000, priceCurrency: 'ARS', availability: 'https://schema.org/InStock' })
    expect(p.image[0]).toBe('https://x.supabase.co/storage/v1/object/public/p/1.webp')
    expect(p.sku).toBe('SH-01')
    expect(p.category).toBe('SHORTS DEPORTIVOS')
  })

  it('variantes con precios distintos: AggregateOffer con el rango', () => {
    const p = ld(seoProducto(ctx(), producto({ variants: [variante(15000), variante(19000)] })), 'Product')
    expect(p.offers).toMatchObject({ '@type': 'AggregateOffer', lowPrice: 15000, highPrice: 19000, offerCount: 2 })
  })

  it('sin stock en ninguna variante: agotado', () => {
    const p = ld(seoProducto(ctx(), producto({ variants: [variante(17000, false)] })), 'Product')
    expect(p.offers.availability).toBe('https://schema.org/OutOfStock')
  })

  it('NO inventa estrellas: las reseñas de Órbita no tienen puntaje', () => {
    const s = seoProducto(ctx(), producto())
    expect(JSON.stringify(s.jsonLd)).not.toMatch(/aggregateRating|ratingValue|reviewRating/)
  })

  it('el preview usa la foto principal pasada por /api/og, codificada', () => {
    const s = seoProducto(ctx(), producto())
    expect(s.image).toBe(`https://venustyle.orbita.site/api/og?u=${encodeURIComponent('https://x.supabase.co/storage/v1/object/public/p/1.webp')}`)
  })

  it('sin fotos usa el logo de la tienda; sin ninguno, sin imagen', () => {
    expect(seoProducto(ctx(), producto({ images: [] })).image).toContain(encodeURIComponent('logo.webp'))
    expect(seoProducto(ctx({ logo: null }), producto({ images: [] })).image).toBeNull()
  })

  it('una tienda no indexable: noindex y sin datos estructurados', () => {
    const s = seoProducto(ctx({ indexable: false }), producto())
    expect(s.robots).toBe('noindex, follow')
    expect(s.jsonLd).toEqual([])
  })
})

describe('seoNoIndexable', () => {
  it('carrito, checkout, perfil…: noindex, nofollow, con título y nada para compartir', () => {
    const s = seoNoIndexable('Venus Style', 'Carrito')
    expect(s).toMatchObject({ title: 'Carrito | Venus Style', robots: 'noindex, nofollow', canonical: null, image: null, jsonLd: [] })
  })
  it('sin título propio queda el nombre de la tienda', () => {
    expect(seoNoIndexable('Venus Style').title).toBe('Venus Style')
  })
})

describe('imagenParaCompartir / serializarJsonLd', () => {
  it('sin imagen, null', () => {
    expect(imagenParaCompartir('https://t.orbita.site', null)).toBeNull()
  })
  it('serializarJsonLd no deja cerrar el <script>', () => {
    const salida = serializarJsonLd({ name: '</script><script>alert(1)</script>' })
    expect(salida).not.toContain('</script>')
    expect(JSON.parse(salida).name).toBe('</script><script>alert(1)</script>')
  })
})

describe('sitemapDeTienda', () => {
  const datos = {
    indexable: true,
    categories: [{ slug: 'remeras', updatedAt: '2026-09-01T00:00:00.000Z' }],
    products: [{ id: 'p-1', updatedAt: '2026-10-01T10:00:00.000Z' }, { id: 'p-2', updatedAt: '2026-09-20T10:00:00.000Z' }],
  }
  const origen = 'https://venustyle.orbita.site'

  it('lista la portada, el catálogo, las categorías y los productos, con su fecha', () => {
    const xml = sitemapDeTienda(origen, datos, true)
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    for (const loc of [`${origen}/`, `${origen}/catalogo`, `${origen}/catalogo/remeras`, `${origen}/producto/p-1`, `${origen}/producto/p-2`]) {
      expect(xml).toContain(`<loc>${loc}</loc>`)
    }
    expect(xml).toContain('<lastmod>2026-10-01T10:00:00.000Z</lastmod>')
  })
  it('escapa los caracteres de XML', () => {
    const xml = sitemapDeTienda(origen, { ...datos, categories: [{ slug: 'a&b', updatedAt: '2026-09-01T00:00:00.000Z' }] }, true)
    expect(xml).toContain('/catalogo/a%26b')
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/)
  })
  it('una tienda no indexable sale vacía (pero válida)', () => {
    const xml = sitemapDeTienda(origen, { ...datos, indexable: false }, true)
    expect(xml).not.toContain('<loc>')
    expect(xml).toContain('</urlset>')
  })
  it('un host secundario (el subdominio, cuando hay dominio propio) sale vacío: un sitemap solo lleva URLs de su host', () => {
    expect(sitemapDeTienda(origen, datos, false)).not.toContain('<loc>')
  })
})

describe('robotsDeTienda', () => {
  const origen = 'https://venustyle.orbita.site'
  it('indexable y principal: permite todo, cierra lo privado y declara su sitemap', () => {
    const r = robotsDeTienda(origen, true, true)
    expect(r).toContain('Allow: /')
    for (const ruta of ['/carrito', '/checkout', '/perfil', '/login', '/panel', '/api']) expect(r).toContain(`Disallow: ${ruta}`)
    expect(r).toContain(`Sitemap: ${origen}/sitemap.xml`)
  })
  it('host secundario: no declara sitemap', () => {
    expect(robotsDeTienda(origen, true, false)).not.toContain('Sitemap:')
  })
  it('una tienda que no debe indexarse se cierra entera', () => {
    expect(robotsDeTienda(origen, false, true)).toBe('User-agent: *\nDisallow: /\n')
  })
})

describe('esHostPrincipal', () => {
  const sub: TiendaDeHost = { slug: 't', host: 't.orbita.site', esSubdominio: true }
  const propio: TiendaDeHost = { slug: 't', host: 'mitienda.com', esSubdominio: false }
  it('sin dominio propio, el principal es el subdominio', () => {
    expect(esHostPrincipal(sub, null)).toBe(true)
    expect(esHostPrincipal(propio, null)).toBe(false)
  })
  it('con dominio propio activo, el principal es ese y el subdominio pasa a secundario', () => {
    expect(esHostPrincipal(propio, 'mitienda.com')).toBe(true)
    expect(esHostPrincipal(sub, 'mitienda.com')).toBe(false)
  })
})

describe('urlDeFotoPermitida (/api/og no es un proxy abierto)', () => {
  const ok = 'https://dgergykdihtvsglfumsb.supabase.co/storage/v1/object/public/product-images/a/b.webp'
  it('acepta una foto pública del almacenamiento de Órbita', () => {
    expect(urlDeFotoPermitida(ok)?.href).toBe(ok)
  })
  it.each([
    ['http', 'http://x.supabase.co/storage/v1/object/public/a.webp'],
    ['otro host', 'https://evil.com/storage/v1/object/public/a.webp'],
    ['un host que solo termina parecido', 'https://x.supabase.co.evil.com/storage/v1/object/public/a.webp'],
    ['usuario y clave', 'https://user:pass@x.supabase.co/storage/v1/object/public/a.webp'],
    ['un puerto', 'https://x.supabase.co:8443/storage/v1/object/public/a.webp'],
    ['una ruta que no es de archivos públicos', 'https://x.supabase.co/rest/v1/products'],
    ['un servidor interno', 'https://169.254.169.254/latest/meta-data'],
    ['localhost', 'https://localhost/storage/v1/object/public/a.webp'],
    ['no es una URL', 'no-es-una-url'],
    ['demasiado larga', `https://x.supabase.co/storage/v1/object/public/${'a'.repeat(2100)}`],
  ])('rechaza %s', (_c, url) => {
    expect(urlDeFotoPermitida(url)).toBeNull()
  })
  it('rechaza lo vacío o ausente', () => {
    expect(urlDeFotoPermitida(undefined)).toBeNull()
    expect(urlDeFotoPermitida('')).toBeNull()
  })
})
