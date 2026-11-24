// Dónde vive el sitio de Alquileres y cómo se arman sus links.
//
// Las mismas pantallas (Home, Reserva, Sitio) sirven a dos lugares:
// - la demo: /alquileres-demo/negocio, /reserva y /mis-reservas, con el modo en ?tipo=;
// - el sitio de un negocio real: /tienda/<slug>, /tienda/<slug>/reserva y
//   /tienda/<slug>/mi-reserva/<token> (en <slug>.orbita.site, el middleware
//   reescribe / y /reserva a esas rutas, como con la tienda).
//
// Cada pantalla le pide al contexto su `ruta`. Sin proveedor, es la demo: así
// /alquileres-demo no cambia. El sitio real monta <SitioProvider> con lo suyo
// (ver SitioReal.tsx).
import { createContext, createElement, useContext, type ReactElement, type ReactNode } from 'react'
import type { ISO } from '@/lib/reservas/fechas'
import type { TipoAlquiler } from '../datos'

export type PaginaSitio = 'inicio' | 'reserva' | 'mis-reservas'

export type Ruta = (p: PaginaSitio, tipo: TipoAlquiler, q?: Record<string, string>, hash?: string) => string

const RUTAS_DEMO: Record<PaginaSitio, string> = { inicio: '/alquileres-demo/negocio', reserva: '/alquileres-demo/reserva', 'mis-reservas': '/alquileres-demo/mis-reservas' }

/** Link a una página de la demo, conservando el modo. */
export const rutaDemo: Ruta = (p, tipo, q = {}, hash = '') => {
  const s = new URLSearchParams({ tipo, ...q }).toString()
  return `${RUTAS_DEMO[p]}?${s}${hash}`
}

/**
 * Los links del sitio de un negocio real. El modo no viaja: es el del negocio.
 * "Mis reservas" no existe sin cuenta: cada reserva se ve con su enlace
 * personal (rutaMiReserva), así que ese destino cae en la portada.
 */
export function rutaDelNegocio(slug: string): Ruta {
  const base = `/tienda/${encodeURIComponent(slug)}`
  return (p, _tipo, q = {}, hash = '') => {
    const s = new URLSearchParams(q).toString()
    return `${p === 'reserva' ? `${base}/reserva` : base}${s ? `?${s}` : ''}${hash}`
  }
}

/** El enlace personal de una reserva en el sitio del negocio: el mismo al que apuntan los emails. */
export const rutaMiReserva = (slug: string, token: string) => `/tienda/${encodeURIComponent(slug)}/mi-reserva/${encodeURIComponent(token)}`

export interface ContextoSitio {
  /** true en el sitio de un negocio real: reserva contra la API y no muestra nada de la demo. */
  real: boolean
  ruta: Ruta
  /** Sitio real: el enlace a la última reserva hecha desde este navegador, si hay. */
  miReserva: string | null
  /** Sitio real: el último día que se puede reservar (la anticipación máxima del negocio). */
  ultimoDia: ISO | null
  /** Sitio real: el negocio confirma a mano (la reserva nace pendiente). */
  confirmaElNegocio: boolean
}

const DEMO: ContextoSitio = { real: false, ruta: rutaDemo, miReserva: null, ultimoDia: null, confirmaElNegocio: false }

const Contexto = createContext<ContextoSitio>(DEMO)

export function SitioProvider({ valor, children }: { valor: ContextoSitio; children: ReactNode }): ReactElement {
  return createElement(Contexto.Provider, { value: valor }, children)
}

export const useSitio = () => useContext(Contexto)

// ─── La última reserva de este navegador ─────────────────────────────────────
//
// Sin cuenta, lo único que identifica una reserva es su token. Se guarda el de
// la última que se hizo acá para ofrecer "Mi reserva" en el menú; si el
// navegador no deja guardar, el enlace sigue estando en la confirmación y en
// el email.

const clave = (slug: string) => `orbita:alquileres:mi-reserva:${slug}`

export function guardarMiReserva(slug: string, token: string): void {
  try { window.localStorage.setItem(clave(slug), token) } catch { /* sin almacenamiento: no pasa nada */ }
}

export function ultimaReserva(slug: string): string | null {
  try { return window.localStorage.getItem(clave(slug)) } catch { return null }
}

export function olvidarMiReserva(slug: string): void {
  try { window.localStorage.removeItem(clave(slug)) } catch { /* idem */ }
}
