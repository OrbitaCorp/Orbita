import { useMutation, useQueryClient } from '@tanstack/react-query'
import { panelToggleCoupon } from '@/lib/api'

interface Params {
  id: string
  activo: boolean
}

export function useToggleCupon() {
  const qc = useQueryClient()
  return useMutation({
    // El backend invierte isActive tal cual está; `activo` queda en la firma
    // porque ToggleConfirmacion ya lo manda armado (es la lectura del estado
    // actual con la que el switch dispara el click).
    mutationFn: async ({ id }: Params): Promise<void> => {
      await panelToggleCoupon(id)
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['cupones'] })
      qc.invalidateQueries({ queryKey: ['cupon', id] })
    },
  })
}
