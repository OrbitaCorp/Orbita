import { useAddons } from './useAddons'
import { useCountdownSettings } from './useCountdownSettings'
import { useAhora } from '@/hooks/useAhora'

// Si se puede elegir el tipo "Oferta relámpago" en el formulario, y si no,
// por qué. La regla, en orden:
//   - 'candado':    el negocio no pagó el paquete Avanzado → no se elige; la
//                   tarjeta vende la función y lleva a Suscripción.
//   - 'apagada':    tiene el paquete pero la apagó desde Avanzado → tampoco;
//                   lleva a prenderla.
//   - 'ocupada':    ya hay una oferta relámpago corriendo (otra que la que se
//                   está editando) → tampoco: solo puede haber una a la vez,
//                   y la que está tiene que terminar o borrarse antes. Lleva
//                   a verla.
//   - 'disponible': se elige como cualquier otro tipo.
//   - null:         todavía no se sabe (cargando).
export type EstadoRelampago = 'disponible' | 'apagada' | 'candado' | 'ocupada' | null

export interface OfertaVigente {
  discountId: string
  name: string
  startDate: string
  endDate: string | null
  // Todavía no empezó (la tienda no la muestra hasta la fecha de inicio).
  programada: boolean
}

// `editandoId`: el descuento que se está editando, si alguno — si es el que
// tiene la oferta, no se bloquea a sí mismo.
export function useEstadoRelampago(editandoId?: string): { estado: EstadoRelampago; vigente: OfertaVigente | null } {
  const { data: addons } = useAddons()
  const { data: settings } = useCountdownSettings()
  const ahora = useAhora(true, 60_000)

  if (!addons) return { estado: null, vigente: null }
  if (!addons.advanced) return { estado: 'candado', vigente: null }
  if (!addons.flashSaleEnabled) return { estado: 'apagada', vigente: null }

  // Hasta no saber si hay una corriendo, no se habilita: si no, la tarjeta
  // parpadearía de "Elegir" a bloqueada al llegar la respuesta.
  if (settings === undefined || ahora === null) return { estado: null, vigente: null }

  const a = settings.actual
  const corriendo = !!a && a.isActive && !!a.endDate && new Date(a.endDate).getTime() > ahora
  if (corriendo && a!.discountId !== editandoId) {
    return { estado: 'ocupada', vigente: { discountId: a!.discountId, name: a!.name, startDate: a!.startDate, endDate: a!.endDate, programada: a!.programada } }
  }
  return { estado: 'disponible', vigente: null }
}
