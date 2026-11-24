// El origen de la demo: los negocios de ejemplo con lo que el dueño cambió en
// el navegador (datos/negocio.ts). Es lo que el panel usaba antes de tener
// origen, tal cual: /alquileres-demo no cambia.
import { clientesDelDemo, negocioDe, reservasDelDemo, type DemoAlquiler } from '../negocio'
import type { TipoAlquiler } from '../index'
import { useNegocio } from '../../demo/useNegocio'
import type { DatosPanelAlquiler, OrigenAlquileres } from './index'

/** Lo que la demo muestra de un modo, con lo guardado en el navegador encima. */
export function datosDemo(demo: DemoAlquiler, tipo: TipoAlquiler): Pick<DatosPanelAlquiler, 'tipo' | 'negocio' | 'reservas' | 'clientes'> {
  return { tipo, negocio: negocioDe(demo, tipo), reservas: reservasDelDemo(demo, tipo), clientes: clientesDelDemo(demo) }
}

const nada = () => {}

export const origenDemo: OrigenAlquileres = {
  tipo: 'demo',
  useDatos() {
    const n = useNegocio()
    return {
      tipo: n.tipo,
      negocio: n.negocio,
      reservas: n.reservas,
      clientes: n.clientes,
      listo: n.hidratado,
      error: null,
      reintentar: nada,
      demo: n.demo,
      soloLectura: false,
      configurar: n.configurar,
      reservar: n.reservar,
      cambiarReserva: n.cambiarReserva,
      agregarBloqueo: n.agregarBloqueo,
      quitarBloqueo: n.quitarBloqueo,
      agregarCalendario: n.agregarCalendario,
      quitarCalendario: n.quitarCalendario,
    }
  },
}
