import { useMutation, useQueryClient } from '@tanstack/react-query'
import { panelCreateDiscount } from '@/lib/api'
import { descuentoInputAApi, detalleApiADescuento, type DescuentoInput } from './discountApi'
import type { Descuento } from '../types'

export function useCrearDescuento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: DescuentoInput): Promise<Descuento> => {
      const creado = await panelCreateDiscount(descuentoInputAApi(input))
      return detalleApiADescuento(creado)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['descuentos'] })
    },
  })
}
