import { useMutation, useQueryClient } from '@tanstack/react-query'
import { panelDeleteCoupon } from '@/lib/api'

export function useEliminarCupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await panelDeleteCoupon(id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cupones'] }),
  })
}
