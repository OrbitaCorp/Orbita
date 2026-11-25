// Dónde vive el sitio de Gimnasio y cómo se arman sus links.
//
// El armazón del sitio (Sitio.tsx: cabecera, pie, botón fijo del celular) sirve
// a dos lugares:
// - la demo: /gimnasio-demo/negocio, /reserva y /mis-clases, con el rubro en ?rubro=;
// - el sitio de un negocio real: /tienda/<slug> y /tienda/<slug>/reserva (en
//   <slug>.orbita.site el middleware reescribe / y /reserva a esas rutas, como
//   con la tienda).
//
// El armazón le pide al contexto su `ruta`. Sin proveedor es la demo: así
// /gimnasio-demo no cambia. El sitio real monta <SitioProvider> con lo suyo
// (SitioReal.tsx).
import { createContext, createElement, useContext, type ReactElement, type ReactNode } from 'react'

export type PaginaSitio = 'inicio' | 'reserva' | 'mis-clases'

export type Ruta = (p: PaginaSitio, rubro: string, q?: Record<string, string>, hash?: string) => string

const RUTAS_DEMO: Record<PaginaSitio, string> = { inicio: '/gimnasio-demo/negocio', reserva: '/gimnasio-demo/reserva', 'mis-clases': '/gimnasio-demo/mis-clases' }

/** Link a una página de la demo, conservando el rubro. */
export const rutaDemo: Ruta = (p, rubro, q = {}, hash = '') => {
  const s = new URLSearchParams({ rubro, ...q }).toString()
  return `${RUTAS_DEMO[p]}?${s}${hash}`
}

/**
 * Los links del sitio de un negocio real. El rubro no viaja: es el del negocio.
 * "Mis clases" todavía no existe ahí (llega con la sesión del alumno): ese
 * destino cae en la portada.
 */
export function rutaDelNegocio(slug: string): Ruta {
  const base = `/tienda/${encodeURIComponent(slug)}`
  return (p, _rubro, q = {}, hash = '') => {
    const s = new URLSearchParams(q).toString()
    return `${p === 'reserva' ? `${base}/reserva` : base}${s ? `?${s}` : ''}${hash}`
  }
}

export interface ContextoSitio {
  /** true en el sitio de un negocio real: reserva contra la API y no muestra nada de la demo. */
  real: boolean
  ruta: Ruta
}

const DEMO: ContextoSitio = { real: false, ruta: rutaDemo }

const Contexto = createContext<ContextoSitio>(DEMO)

export function SitioProvider({ valor, children }: { valor: ContextoSitio; children: ReactNode }): ReactElement {
  return createElement(Contexto.Provider, { value: valor }, children)
}

export const useSitio = (): ContextoSitio => useContext(Contexto)
