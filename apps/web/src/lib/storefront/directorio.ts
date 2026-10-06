// El directorio público de tiendas (orbita.site/tiendas): las piezas puras.
//
// La página existe para que Google llegue SOLO a cada tienda nueva: el sitemap
// y el robots.txt de una tienda los lee Google recién después de entrar a ella,
// y entrar requiere un link. Cada tienda que cumple los requisitos de
// indexación aparece acá (la API usa el mismo criterio que `indexable`) y se
// enlaza al dominio donde quiere posicionarse: su dominio propio, si lo tiene.

import { ROOT_DOMAIN } from '@/lib/tenant'
import type { DirectorioDeTiendas, TiendaDelDirectorio } from './api'
import { origenDeTienda } from './seo'

/** La dirección de la tienda: su dominio propio activo o, si no, su subdominio de Órbita. */
export function urlDeTienda(t: Pick<TiendaDelDirectorio, 'subdomain' | 'domain'>): string {
  return `${origenDeTienda(t.subdomain, t.domain, ROOT_DOMAIN)}/`
}

/** La dirección tal como se lee ("venustyle.orbita.site"), sin protocolo ni barra. */
export function direccionLegible(t: Pick<TiendaDelDirectorio, 'subdomain' | 'domain'>): string {
  return urlDeTienda(t).replace(/^https?:\/\//, '').replace(/\/$/, '')
}

/** La letra que se muestra cuando la tienda no cargó logo. */
export function inicialDe(nombre: string): string {
  return nombre.trim().charAt(0).toUpperCase() || '·'
}

export const totalDePaginas = (d: Pick<DirectorioDeTiendas, 'total' | 'perPage'>) => Math.max(1, Math.ceil(d.total / d.perPage))

/** La ruta de una página del directorio. La primera va sin parámetro: una sola URL para la misma página. */
export const rutaDePagina = (pagina: number) => (pagina <= 1 ? '/tiendas' : `/tiendas?pagina=${pagina}`)

/** Datos estructurados: la lista de tiendas de la página, cada una con su URL. */
export function jsonLdDirectorio(d: DirectorioDeTiendas, urlPagina: string): Record<string, unknown> {
  const primera = (d.page - 1) * d.perPage
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Tiendas en Órbita',
    url: urlPagina,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: d.total,
      itemListElement: d.stores.map((t, i) => ({
        '@type': 'ListItem',
        position: primera + i + 1,
        name: t.name,
        url: urlDeTienda(t),
      })),
    },
  }
}
