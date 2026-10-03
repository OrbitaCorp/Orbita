import { useRouter } from 'next/router'
import { moduloDeSeccion } from '@/layouts/components/moduloActivo'

/** ¿Estamos en el panel de administración? Ahí el pet toma la forma del módulo; afuera, la de Inicio. */
export function esRutaPanel(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

/**
 * Módulo del menú lateral que se está viendo, para que el pet tome su forma.
 * Usa la misma regla que el Sidebar (moduloDeSeccion). Fuera del panel, o sin
 * sección, devuelve 'dashboard': la forma base de Inicio.
 */
export function useModuloPet(): string {
  const router = useRouter()
  if (!esRutaPanel(router.pathname)) return 'dashboard'
  const partes = router.query.slug
  const seccion = (Array.isArray(partes) ? partes[partes.length - 1] : undefined)
    ?? (router.query.seccion as string | undefined)
    ?? 'dashboard'
  const vista = (router.query.vista as string | undefined) ?? ''
  return moduloDeSeccion(seccion, vista)
}

/** true en el panel de administración. */
export function useEsPanel(): boolean {
  return esRutaPanel(useRouter().pathname)
}
