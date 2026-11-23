// La compuerta de la demo de Alquileres. Todas las páginas de
// /alquileres-demo van adentro: en desarrollo se ven sin más; en producción
// piden sesión de superadmin (sin sesión, RequireAuth manda al login y la demo
// ni se dibuja: el servidor solo devuelve la pantalla de carga). Antes estas
// páginas daban 404 en producción; se abrieron así el 23/11/2026 para que el
// equipo las pruebe en orbita.site (plan: docs/superpowers/plans/2026-11-23-alquileres-en-produccion.md).
//
// Un test recorre pages/alquileres-demo y falla si una página no pasa por acá.
import Head from 'next/head'
import type { ReactNode } from 'react'
import { RequireAuth } from '@/lib/auth/RequireAuth'
import { pideSuperadmin } from './acceso'

export function SoloEquipo({ children }: { children: ReactNode }) {
  const contenido = pideSuperadmin(process.env.NODE_ENV) ? <RequireAuth type="platform_admin">{children}</RequireAuth> : children
  return (
    <>
      {/* Nunca en buscadores, tampoco si alguien pega el link. */}
      <Head><meta name="robots" content="noindex, nofollow" /></Head>
      {contenido}
    </>
  )
}
