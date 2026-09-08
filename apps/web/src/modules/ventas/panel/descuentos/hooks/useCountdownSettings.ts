import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { panelGetCountdownSettings, panelSetCountdownEnabled } from '@/lib/api'

// Interruptor de "Oferta relámpago" (tarjeta de Avanzado) y quién la tiene
// hoy. Lo usan la tarjeta de Avanzado y el formulario de Descuentos (para el
// aviso "hoy la tiene «X»; al guardar pasa a esta").
export function useCountdownSettings() {
  return useQuery({
    queryKey: ['countdown-settings'],
    queryFn: panelGetCountdownSettings,
    staleTime: 30_000,
  })
}

export function useSetCountdownEnabled() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (enabled: boolean) => panelSetCountdownEnabled(enabled),
    onSuccess: (data) => {
      qc.setQueryData(['countdown-settings'], data)
      // `useAddons` también lee el flag (es lo que decide si el formulario
      // ofrece el tipo).
      qc.invalidateQueries({ queryKey: ['addons'] })
    },
  })
}
