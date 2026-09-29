// Punto de entrada de la demo pública (ver lib/demo/modo.ts). Se llama una
// vez al cargar la app, a nivel de módulo en _app: los efectos de los hijos
// corren antes que los del padre y harían fetch antes de instalar el parche.
import type { QueryClient } from '@tanstack/react-query'
import { esTiendaDemo } from './modo'
import { instalarInterceptorDemo } from './interceptor'
import { alCambiar } from './almacen'
import './recursos/tienda'

export function iniciarDemo(queryClient: QueryClient): void {
  if (typeof window === 'undefined' || !esTiendaDemo()) return
  instalarInterceptorDemo()
  // Lo que el visitante cambia se ve al toque en las pantallas abiertas.
  alCambiar(() => void queryClient.invalidateQueries())
}
