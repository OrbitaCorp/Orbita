import { useMutation, useQueryClient } from '@tanstack/react-query'
import { panelUpdateCoupon } from '@/lib/api'
import { cuponInputAApi, detalleApiACupon, type CuponInput } from './couponApi'
import type { Cupon } from '../types'

interface Input {
  id: string
  data: CuponInput
}

export function useEditarCupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: Input): Promise<Cupon> => {
      const editado = await panelUpdateCoupon(id, cuponInputAApi(data))
      return detalleApiACupon(editado)
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['cupones'] })
      qc.invalidateQueries({ queryKey: ['cupon', id] })
    },
  })
}
