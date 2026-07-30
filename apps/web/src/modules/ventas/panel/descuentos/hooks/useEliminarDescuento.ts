import { useMutation, useQueryClient } from '@tanstack/react-query'
import { panelDeleteDiscount } from '@/lib/api'

export function useEliminarDescuento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await panelDeleteDiscount(id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['descuentos'] }),
  })
}
