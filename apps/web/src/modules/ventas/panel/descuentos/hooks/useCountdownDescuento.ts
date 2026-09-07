import { useMutation, useQueryClient } from '@tanstack/react-query'
import { panelSetDiscountCountdown } from '@/lib/api'

interface Params {
  id: string
  countdown: boolean
}

// Prende o apaga la cuenta regresiva de un descuento desde la píldora del
// listado. Como solo un descuento por negocio la puede tener, se invalida el
// listado entero: prenderla acá se la saca al que la tenía.
export function useCountdownDescuento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, countdown }: Params): Promise<void> => {
      await panelSetDiscountCountdown(id, countdown)
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['descuentos'] })
      qc.invalidateQueries({ queryKey: ['descuento', id] })
    },
  })
}
