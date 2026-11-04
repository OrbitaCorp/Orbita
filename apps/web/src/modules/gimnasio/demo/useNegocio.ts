// El negocio que se está mirando en la demo: el rubro que viaja en ?rubro= y,
// encima del negocio de ejemplo de ese rubro, lo que el dueño cambió, los
// socios y las inscripciones. La única puerta a los datos para el sitio, la
// reserva, "Mis clases" y el panel.
import { useMemo } from 'react'
import type { Inscripcion } from '../datos'
import { inscripcionesDelDemo, negocioDelDemo, sociosDelDemo, useDemoGym, useHidratado } from '../datos/negocio'
import { useRubroDemo } from './BarraDemo'

export function useNegocio() {
  const [rubro, setRubro] = useRubroDemo()
  const almacen = useDemoGym()
  const hidratado = useHidratado()
  const negocio = useMemo(() => negocioDelDemo(almacen.demo, rubro.key), [almacen.demo, rubro.key])
  const socios = useMemo(() => sociosDelDemo(almacen.demo, rubro.key), [almacen.demo, rubro.key])
  const inscripciones = useMemo(() => inscripcionesDelDemo(almacen.demo, rubro.key), [almacen.demo, rubro.key])
  return {
    rubro, setRubro, negocio, socios, inscripciones, ...almacen,
    /** false en el primer render de una carga completa (todavía es el negocio de ejemplo): ver useHidratado. */
    hidratado,
    // Con el rubro ya puesto: así "Darle el lugar" desde el panel también descuenta el pack.
    cambiarInscripcion: (id: string, cambio: Partial<Inscripcion>) => almacen.cambiarInscripcionEn(rubro.key, id, cambio),
  }
}
