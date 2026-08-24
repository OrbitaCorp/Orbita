import { useMutation } from '@tanstack/react-query'
import { useEditarDescuento } from './useEditarDescuento'
import type { DescuentoInput } from './discountApi'
import type { Descuento } from '../types'

interface Params {
  // Detalle COMPLETO del descuento (via useDescuento) — PUT /discounts/:id
  // reemplaza el descuento entero, no soporta patch parcial (misma razón que
  // useToggleLink.ts de cupones).
  descuento: Descuento
  linkActive: boolean
}

export function useToggleDescuentoLink() {
  const editar = useEditarDescuento()
  return useMutation({
    mutationFn: async ({ descuento, linkActive }: Params): Promise<Descuento> => {
      const data: DescuentoInput = {
        nombre: descuento.nombre,
        tipo: descuento.tipo,
        valor: descuento.valor,
        alcance: descuento.alcance,
        productosIds: descuento.productosIds,
        categoriasIds: descuento.categoriasIds,
        condicion: descuento.condicion,
        aplicacion: descuento.aplicacion,
        fechaInicio: descuento.fechaInicio,
        fechaFin: descuento.fechaFin,
        diasVigencia: descuento.diasVigencia,
        horaInicio: descuento.horaInicio,
        horaFin: descuento.horaFin,
        limiteUsosTotal: descuento.limiteUsosTotal,
        linkActive,
      }
      return editar.mutateAsync({ id: descuento.id, data })
    },
  })
}
