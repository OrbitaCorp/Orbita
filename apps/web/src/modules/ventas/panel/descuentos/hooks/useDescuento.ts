import { useQuery } from '@tanstack/react-query'
import { panelGetDiscount } from '@/lib/api'
import { detalleApiADescuento } from './discountApi'

export function useDescuento(id: string | undefined) {
  return useQuery({
    queryKey: ['descuento', id],
    queryFn: async () => {
      if (!id) throw new Error('id requerido')
      return detalleApiADescuento(await panelGetDiscount(id))
    },
    enabled: !!id,
  })
}
