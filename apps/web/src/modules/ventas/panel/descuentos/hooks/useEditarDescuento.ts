import { useMutation, useQueryClient } from '@tanstack/react-query'
import { panelUpdateDiscount } from '@/lib/api'
import { descuentoInputAApi, detalleApiADescuento, type DescuentoInput } from './discountApi'
import type { Descuento } from '../types'

interface Input {
  id: string
  data: DescuentoInput
}

export function useEditarDescuento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: Input): Promise<Descuento> => {
      const editado = await panelUpdateDiscount(id, descuentoInputAApi(data))
      return detalleApiADescuento(editado)
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['descuentos'] })
      qc.invalidateQueries({ queryKey: ['descuento', id] })
    },
  })
}
