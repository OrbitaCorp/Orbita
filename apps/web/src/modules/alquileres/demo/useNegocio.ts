// El negocio que se está mirando en la demo: el modo que viaja en ?tipo= y,
// encima del negocio de ejemplo de ese modo, lo que el dueño cambió y las
// reservas que se hicieron. Lo usan el sitio, la reserva, "Mis reservas" y el
// panel: es la única puerta a los datos.
import { useMemo } from 'react'
import { clientesDelDemo, negocioDe, reservasDelDemo, useDemoAlquiler } from '../datos/negocio'
import { useTipoDemo } from './BarraDemo'

export function useNegocio() {
  const [tipo, setTipo] = useTipoDemo()
  const almacen = useDemoAlquiler()
  const negocio = useMemo(() => negocioDe(almacen.demo, tipo), [almacen.demo, tipo])
  const reservas = useMemo(() => reservasDelDemo(almacen.demo, tipo), [almacen.demo, tipo])
  const clientes = useMemo(() => clientesDelDemo(almacen.demo), [almacen.demo])
  return { tipo, setTipo, negocio, reservas, clientes, ...almacen }
}
