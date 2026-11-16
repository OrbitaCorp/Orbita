// El "ahora" con el que cuentan las pantallas del panel de Gimnasio: qué día es
// hoy y qué hora es, en minutos desde las 00:00 de Argentina.
//
// En la demo es fijo, el sábado 14/11/2026 a las 10:40 (HOY y AHORA de
// datos/index.ts): así los datos de ejemplo cuentan siempre la misma historia.
// Conectado a la API es el de verdad, y lo pone el origen (datos/origen/api.ts).
// Las pantallas lo leen con useReloj(); sin proveedor, es el de la demo.
//
// Nadie lee el reloj del sistema en un render (react-compiler no deja usar
// Date.now() ahí): el origen de la API lo toma en un efecto y lo refresca cada
// minuto.
import { createContext, createElement, useContext, useSyncExternalStore, type ReactNode } from 'react'
import type { ISO } from '@/lib/reservas/fechas'
import { AHORA, HOY } from './index'

export interface Reloj {
  /** Hoy, AAAA-MM-DD de Argentina. */
  hoy: ISO
  /** Minutos desde las 00:00 de hoy. */
  ahora: number
}

export const RELOJ_DEMO: Reloj = { hoy: HOY, ahora: AHORA }

const FORMATO = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

/** El día y la hora de Argentina de un instante (la API manda instantes ISO en UTC). */
export function relojArgentina(instante: Date): Reloj {
  const p = Object.fromEntries(FORMATO.formatToParts(instante).map(x => [x.type, x.value]))
  return { hoy: `${p.year}-${p.month}-${p.day}`, ahora: Number(p.hour) * 60 + Number(p.minute) }
}

const Contexto = createContext<Reloj>(RELOJ_DEMO)

export function RelojProvider({ reloj, children }: { reloj: Reloj; children: ReactNode }) {
  return createElement(Contexto.Provider, { value: reloj }, children)
}

export const useReloj = (): Reloj => useContext(Contexto)

// ─── El reloj de verdad ──────────────────────────────────────────────────────
// Un almacén externo que se mueve solo cada medio minuto mientras alguien lo
// mira: el render lee la última foto, nunca el reloj del sistema. En el
// servidor no hay hora (la página se arma en el navegador): null.

/** Una foto del reloj: el día y la hora de Argentina, y el instante (ms) para comparar con los de la API. */
export interface FotoReloj { reloj: Reloj; ms: number }

let foto: FotoReloj | null = null
let timer: ReturnType<typeof setInterval> | null = null
const oyentes = new Set<() => void>()
const tomarFoto = (): FotoReloj => {
  const ms = Date.now()
  return { reloj: relojArgentina(new Date(ms)), ms }
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar)
  if (!timer) {
    // Al volver a mirarlo, la hora de ahora y no la de la última vez.
    foto = tomarFoto()
    timer = setInterval(() => { foto = tomarFoto(); oyentes.forEach(o => o()) }, 30_000)
  }
  return () => {
    oyentes.delete(avisar)
    if (!oyentes.size && timer) { clearInterval(timer); timer = null }
  }
}

const leerFoto = () => (foto ??= tomarFoto())
const sinHora = () => null

/** El día y la hora de Argentina, al día cada medio minuto. null en el servidor y en el render de la hidratación. */
export const useRelojReal = (): FotoReloj | null => useSyncExternalStore(suscribir, leerFoto, sinHora)
