import { useMutation, useQueryClient } from '@tanstack/react-query'
import { panelToggleDiscount } from '@/lib/api'

interface Params {
  id: string
  activo: boolean
}

export function useToggleDescuento() {
  const qc = useQueryClient()
  return useMutation({
    // El backend invierte isActive tal cual está (no recibe un valor destino);
    // `activo` queda en la firma porque ToggleConfirmacion ya lo manda armado
    // y es la lectura del estado con la que el switch dispara el click.
    mutationFn: async ({ id }: Params): Promise<void> => {
      await panelToggleDiscount(id)
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['descuentos'] })
      qc.invalidateQueries({ queryKey: ['descuento', id] })
    },
  })
}
