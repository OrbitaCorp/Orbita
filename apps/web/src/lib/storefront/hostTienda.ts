// ¿De qué tienda es este host? Para el robots.txt y el sitemap.xml, que se
// sirven en la misma ruta desde cualquier dominio: el de la plataforma
// (orbita.site), el subdominio de una tienda (mitienda.orbita.site) o el
// dominio propio que el dueño conectó (mitienda.com).

import { ROOT_DOMAIN, slugFromHost } from '@/lib/tenant'
import { getSlugDeDominio } from './api'

export type TiendaDeHost = {
  slug: string
  /** El host sin puerto, en minúsculas. */
  host: string
  /** true si es `slug.orbita.site`; false si es un dominio propio. */
  esSubdominio: boolean
}

const hostSinPuerto = (host: string) => host.split(':')[0].toLowerCase()

/**
 * La tienda a la que pertenece el host, o null si es la plataforma (apex, www,
 * localhost, un deploy de preview) y no una tienda.
 */
export async function tiendaDeHost(hostHeader: string | undefined): Promise<TiendaDeHost | null> {
  if (!hostHeader) return null
  const host = hostSinPuerto(hostHeader)
  if (host === 'localhost' || host === '127.0.0.1') return null

  const slug = slugFromHost(host)
  if (slug) return { slug, host, esSubdominio: true }

  // Es de la plataforma: el apex, www o cualquier otra cosa bajo el dominio raíz.
  if (host === ROOT_DOMAIN || host.endsWith(`.${ROOT_DOMAIN}`)) return null
  // Los deploys de preview de Vercel tampoco son tiendas.
  if (host.endsWith('.vercel.app')) return null

  // Cualquier otro host: puede ser el dominio propio de una tienda.
  try {
    const slugPropio = await getSlugDeDominio(host)
    return slugPropio ? { slug: slugPropio, host, esSubdominio: false } : null
  } catch {
    return null
  }
}

/**
 * ¿Este host es el que el dueño quiere posicionar? Con un dominio propio
 * activo, es ese; sin uno, el subdominio de Órbita. Los demás hosts de la
 * misma tienda (el subdominio, cuando hay dominio propio) quedan secundarios:
 * sus páginas llevan el canonical al principal y no declaran sitemap.
 */
export function esHostPrincipal(tienda: TiendaDeHost, primaryDomain: string | null): boolean {
  return primaryDomain ? tienda.host === primaryDomain.toLowerCase() : tienda.esSubdominio
}
