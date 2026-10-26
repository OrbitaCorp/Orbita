// Lo que el alta calcula con los datos de Alquileres y de Gimnasio (las reglas
// de sus pasos y los resúmenes de la botonera y del pago, en reservas.ts),
// bajado recién cuando se elige uno de esos dos módulos. Este archivo no
// importa nada de ellos: en el alta real, donde están en "Próximamente", no se
// baja nunca. Sus pantallas (los pasos, "Tu página" y el cierre) llegan aparte,
// con next/dynamic (Alta.tsx).
//
// Mismo esquema que estadoAlta.ts (useSyncExternalStore): el servidor y el
// primer pintado no lo tienen, y aparece apenas llega.
import { useEffect, useSyncExternalStore } from 'react'
import type * as ModuloReservas from './reservas'

type Reservas = typeof ModuloReservas

let cargado: Reservas | null = null
let enCurso: Promise<Reservas> | null = null
const oyentes = new Set<() => void>()

/** Lo baja una sola vez. Si falla (sin red), la próxima llamada lo vuelve a intentar. */
function cargar(): Promise<Reservas> {
  enCurso ??= import('./reservas').then(
    m => { cargado = m; oyentes.forEach(f => f()); return m },
    (e: unknown) => { enCurso = null; throw e },
  )
  return enCurso
}

function suscribir(f: () => void) {
  oyentes.add(f)
  return () => { oyentes.delete(f) }
}
const leer = () => cargado
const enServidor = () => null

/**
 * reservas.ts, si `activo` (el módulo elegido es Alquileres o Gimnasio) y ya
 * llegó; si no, null. Mientras es null, sus pasos no dejan seguir (modelo.ts)
 * y la botonera muestra lo de cualquier paso.
 */
export function useReservas(activo: boolean): Reservas | null {
  const reservas = useSyncExternalStore(suscribir, leer, enServidor)
  // Sin dependencias a propósito: si no se pudo bajar, se reintenta en el próximo pintado.
  useEffect(() => {
    if (activo && !cargado) cargar().catch(() => { /* queda en null hasta el próximo intento */ })
  })
  return activo ? reservas : null
}
