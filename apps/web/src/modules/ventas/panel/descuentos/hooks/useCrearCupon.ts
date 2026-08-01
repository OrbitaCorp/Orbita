import { useMutation, useQueryClient } from '@tanstack/react-query'
import { panelCreateCoupon } from '@/lib/api'
import { cuponInputAApi, detalleApiACupon, type CuponInput } from './couponApi'
import type { Cupon } from '../types'

export function useCrearCupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CuponInput): Promise<Cupon> => {
      const creado = await panelCreateCoupon(cuponInputAApi(input))
      return detalleApiACupon(creado)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cupones'] })
    },
  })
}
