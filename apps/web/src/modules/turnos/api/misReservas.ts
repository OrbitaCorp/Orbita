// Los enlaces personales de "mi turno" de las reservas hechas desde ESTE
// navegador. Al reservar sin cuenta, la API devuelve una sola vez el
// `accessToken` de la reserva (el secreto de <sitio>/mi-turno/<token>); se
// guarda acá para que el sitio pueda listar "tus turnos reservados desde este
// dispositivo" (POST storefront/:slug/appointments/mine) sin pedir cuenta.
//
// - Una lista por negocio (clave por slug), la más nueva primero, con tope de 20
//   (lo mismo que acepta la API en un pedido).
// - Se lee con useSyncExternalStore: en el servidor y en la hidratación es la
//   lista vacía, y se entera de los cambios de otras pestañas (evento storage).
// - Cuando la API contesta, los tokens que ya no reconoce (reserva borrada, de
//   otro negocio) se limpian con `depurarReservas`.
import { useSyncExternalStore } from 'react'

export const TOPE_RESERVAS = 20
const PREFIJO = 'orbita_turnos_mis_reservas:'
/** Como valida la API: 43–64 caracteres base64url. */
const ES_TOKEN = /^[A-Za-z0-9_-]{43,64}$/

const VACIA: readonly string[] = Object.freeze([])

// ─── Lógica pura ────────────────────────────────────────────────────────────

/** Lo guardado → lista de tokens válidos, sin repetidos y con el tope. Cualquier cosa rara → []. */
export function leerLista(crudo: string | null): string[] {
  if (!crudo) return []
  try {
    const v: unknown = JSON.parse(crudo)
    if (!Array.isArray(v)) return []
    return [...new Set(v.filter((t): t is string => typeof t === 'string' && ES_TOKEN.test(t)))].slice(0, TOPE_RESERVAS)
  } catch {
    return []
  }
}

/** Suma un token adelante (si ya estaba, lo sube) y respeta el tope: se descarta el más viejo. */
export function agregarALista(lista: readonly string[], token: string): string[] {
  if (!ES_TOKEN.test(token)) return [...lista]
  return [token, ...lista.filter(t => t !== token)].slice(0, TOPE_RESERVAS)
}

/** Se queda solo con los tokens que la API reconoció, en el orden en que estaban. */
export function depurarLista(lista: readonly string[], reconocidos: readonly string[]): string[] {
  const ok = new Set(reconocidos)
  return lista.filter(t => ok.has(t))
}

// ─── localStorage ───────────────────────────────────────────────────────────

const clave = (slug: string) => `${PREFIJO}${slug}`
const oyentes = new Set<() => void>()
// Lo último leído de cada negocio: mientras el texto guardado no cambie, se
// devuelve el MISMO array (useSyncExternalStore lo exige).
const cache = new Map<string, { crudo: string | null; lista: readonly string[] }>()

function crudoDe(slug: string): string | null {
  try {
    return window.localStorage.getItem(clave(slug))
  } catch {
    return null // Modo privado o almacenamiento bloqueado: como si no hubiera nada.
  }
}

/** Los tokens guardados para un negocio, la reserva más nueva primero. [] fuera del navegador. */
export function reservasGuardadas(slug: string): readonly string[] {
  if (typeof window === 'undefined') return VACIA
  const crudo = crudoDe(slug)
  const previo = cache.get(slug)
  if (previo && previo.crudo === crudo) return previo.lista
  const lista = leerLista(crudo)
  cache.set(slug, { crudo, lista })
  return lista
}

function escribir(slug: string, lista: readonly string[]) {
  try {
    if (lista.length) window.localStorage.setItem(clave(slug), JSON.stringify(lista))
    else window.localStorage.removeItem(clave(slug))
  } catch {
    // Sin almacenamiento la reserva igual quedó hecha: el enlace también llega por mail.
  }
  oyentes.forEach(o => o())
}

/** Guarda el token de una reserva recién hecha. */
export function guardarReserva(slug: string, token: string) {
  escribir(slug, agregarALista(reservasGuardadas(slug), token))
}

/** Olvida una reserva (por ejemplo, "sacar de este dispositivo"). */
export function olvidarReserva(slug: string, token: string) {
  escribir(slug, reservasGuardadas(slug).filter(t => t !== token))
}

/** Deja solo las reservas que la API reconoció (la respuesta de POST …/mine). */
export function depurarReservas(slug: string, reconocidos: readonly string[]) {
  const actual = reservasGuardadas(slug)
  const depurada = depurarLista(actual, reconocidos)
  if (depurada.length !== actual.length) escribir(slug, depurada)
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente)
  // Otra pestaña del mismo sitio guardó o borró una reserva.
  const alCambiar = (e: StorageEvent) => { if (e.key === null || e.key.startsWith(PREFIJO)) oyente() }
  window.addEventListener('storage', alCambiar)
  return () => {
    oyentes.delete(oyente)
    window.removeEventListener('storage', alCambiar)
  }
}

/** Los tokens guardados en este dispositivo para un negocio. En el servidor y al hidratar, []. */
export function useReservasGuardadas(slug: string): readonly string[] {
  return useSyncExternalStore(suscribir, () => reservasGuardadas(slug), () => VACIA)
}
