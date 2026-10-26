// El cierre del alta de Alquileres y de Gimnasio (solo en las demos: en el
// alta real esos módulos están en "Próximamente"): el negocio armado queda
// guardado en la demo de su módulo, con la portada elegida, y se sigue en su
// panel. El alta lo baja recién cuando termina el pago simulado (await
// import(...) en Alta.tsx) y lo monta: guarda una sola vez y le dice a dónde ir.
// No lo importes de forma estática.
//
// Es un componente y no una función suelta porque la demo de Alquileres se
// escribe solo con su hook (useDemoAlquiler); la de Gimnasio tiene sus acciones
// sin hook (accionesGym). Con unas `accionesAlquiler` iguales en
// modules/alquileres/datos/negocio.ts, guardarEnSuDemo se puede llamar directo
// desde el handler de Alta.tsx y este componente sobra.
import { useEffect, useRef } from 'react'
import { useDemoAlquiler } from '@/modules/alquileres/datos/negocio'
import { negocioDesdeAlta as negocioAlquiler, type AltaAlquiler } from '@/modules/alquileres/onboarding/pasos'
import { accionesGym } from '@/modules/gimnasio/datos/negocio'
import { negocioDesdeAlta as negocioGym, type AltaGym } from '@/modules/gimnasio/onboarding/pasos'
import type { DatosAlta } from './modelo'
import { RUBRO_GYM, alquilerDe, baseDe, gymDe, portadaDe, vistaAlquiler, vistaGym } from './reservas'

/** A dónde se sigue: el panel de la demo del módulo, con su modo o su rubro. */
export interface Destino { pathname: string; query: Record<string, string> }

type AccionesAlquiler = Pick<ReturnType<typeof useDemoAlquiler>, 'configurar' | 'guardar'>

function guardarEnSuDemo(d: DatosAlta, alquiler: Partial<AltaAlquiler>, gym: Partial<AltaGym>, demoAlquiler: AccionesAlquiler): Destino {
  if (d.modulo === 'alquileres') {
    const a = alquilerDe(alquiler)
    const tipo = a.tipo ?? 'cancha'
    demoAlquiler.configurar(tipo, { ...negocioAlquiler(a, baseDe(d)), fotoPortada: portadaDe(d, vistaAlquiler(a, d)) })
    // Su store no tiene un marcarAlta como el de Gimnasio: se escribe el mismo campo.
    demoAlquiler.guardar({ alta: tipo })
    return { pathname: '/alquileres-demo/panel', query: { tipo } }
  }
  const g = gymDe(gym)
  const rubro = g.rubro ?? RUBRO_GYM
  accionesGym.configurar(rubro, { ...negocioGym(g, baseDe(d)), fotoPortada: portadaDe(d, vistaGym(g, d)) })
  accionesGym.marcarAlta(rubro)
  return { pathname: '/gimnasio-demo/panel', query: { rubro } }
}

export default function CierreReservas({ d, alquiler, gym, onListo }: {
  /** Su módulo es Alquileres o Gimnasio: el alta no lo monta para los otros. */
  d: DatosAlta
  alquiler: Partial<AltaAlquiler>
  gym: Partial<AltaGym>
  onListo: (destino: Destino) => void
}) {
  const demoAlquiler = useDemoAlquiler()
  // En desarrollo React monta los efectos dos veces (modo estricto): se guarda y se navega una sola vez.
  const hecho = useRef(false)
  useEffect(() => {
    if (hecho.current) return
    hecho.current = true
    onListo(guardarEnSuDemo(d, alquiler, gym, demoAlquiler))
  })
  return null
}
