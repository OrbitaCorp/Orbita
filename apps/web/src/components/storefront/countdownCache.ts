// Cache de la promesa (no del resultado) del countdown activo, por slug.
//
// En la portada hay hasta TRES consumidores montados a la vez del mismo dato:
// el banner ancho (Inicio.tsx), la tira de "todas las páginas"
// (StorefrontChrome.tsx) y la sección de productos en oferta
// (CountdownOfertaSection.tsx). Sin esto eran tres GET idénticos.
//
// Vive lo que vive la pestaña; una navegación real del storefront la recarga
// igual, así que no hace falta invalidarla a mano.

import { getActiveCountdown, type StorefrontActiveCountdown } from '@/lib/storefront/api'

const enVuelo = new Map<string, Promise<StorefrontActiveCountdown | null>>()

export function pedirCountdown(slug: string): Promise<StorefrontActiveCountdown | null> {
  const cacheado = enVuelo.get(slug)
  if (cacheado) return cacheado
  // El .catch va acá adentro y no en cada consumidor: la promesa cacheada
  // nunca rechaza, así que un montaje tardío no se encuentra con una promesa
  // ya rechazada sin handler.
  const p = getActiveCountdown(slug).catch(() => null)
  enVuelo.set(slug, p)
  return p
}
