import { useMutation } from '@tanstack/react-query'
import { useEditarCupon } from './useEditarCupon'
import type { CuponInput } from './couponApi'
import type { Cupon } from '../types'

interface Params {
  // Detalle COMPLETO del cupón (via useCupon) — PUT /coupons/:id reemplaza
  // el cupón entero, no soporta patch parcial. Usar la fila del listado acá
  // pisaría link_redirect/productosIds/categoriasIds con valores incompletos
  // (filaApiACupon los trae vacíos/null a propósito, son solo para la tabla).
  cupon: Cupon
  link_activo: boolean
  link_redirect?: string | null
}

export function useToggleLink() {
  const editar = useEditarCupon()
  return useMutation({
    mutationFn: async ({ cupon, link_activo, link_redirect }: Params): Promise<Cupon> => {
      const data: CuponInput = {
        codigo: cupon.codigo,
        nombre: cupon.nombre,
        tipoDescuento: cupon.tipoDescuento,
        valor: cupon.valor,
        alcance: cupon.alcance,
        productosIds: cupon.productosIds,
        categoriasIds: cupon.categoriasIds,
        montoMinimo: cupon.montoMinimo,
        usosMaxTotal: cupon.usosMaxTotal,
        usosMaxPorCliente: cupon.usosMaxPorCliente,
        fechaInicio: cupon.fechaInicio,
        fechaExpiracion: cupon.fechaExpiracion,
        privado: cupon.privado,
        link_activo,
        link_redirect: link_redirect !== undefined ? link_redirect : cupon.link_redirect,
      }
      return editar.mutateAsync({ id: cupon.id, data })
    },
  })
}
