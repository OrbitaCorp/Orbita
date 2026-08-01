import { useQuery } from '@tanstack/react-query'
import { panelGetCoupon } from '@/lib/api'
import { detalleApiACupon } from './couponApi'

export function useCupon(id: string | undefined) {
  return useQuery({
    queryKey: ['cupon', id],
    queryFn: async () => {
      if (!id) throw new Error('id requerido')
      return detalleApiACupon(await panelGetCoupon(id))
    },
    enabled: !!id,
  })
}
