import { useQuery } from '@tanstack/react-query'
import { panelGetAddons } from '@/lib/api'

// Qué funcionalidades pagas tiene el negocio (hoy: el paquete Avanzado). Se
// cachea unos minutos porque no cambia mientras se edita un descuento, y el
// formulario lo pide en cada montaje.
export function useAddons() {
  return useQuery({
    queryKey: ['addons'],
    queryFn: panelGetAddons,
    staleTime: 5 * 60 * 1000,
  })
}
