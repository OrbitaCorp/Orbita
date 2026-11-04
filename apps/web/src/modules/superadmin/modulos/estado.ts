// Lo que cada uno marca en Módulos, guardado en su navegador: las tareas
// tildadas, las entradas confirmadas, las entradas cargadas desde la hoja
// (con la tarea que documentan) y el horizonte elegido de cada módulo.
//
// Módulos es solo visual, sin API: esto no lo ven los demás ni sale de este
// navegador, y la pantalla lo avisa ("Se guarda en este navegador"). Lo que
// tiene que quedar para todos se pasa al código: la entrada a entradas.ts
// (con `confirmada` si ya se confirmó) y su tarea, en plan.ts, con
// documentada().
//
// Mismo esquema que las demos (modules/turnos/datos/negocio.ts):
// useSyncExternalStore sobre localStorage. El servidor y el primer pintado ven
// el estado vacío y recién después aparece lo guardado; lo que cambia otra
// pestaña se ve solo (evento storage).
import { useSyncExternalStore } from 'react'
import { PERSONAS, type ConPlan, type Persona } from './plan'
import type { Entrada, TipoEntrada } from './entradas'

export type Horizonte = '2m' | '1m'

export interface EstadoModulos {
  /** Tareas tildadas, por `<modulo>.<id de tarea>` (turnos.t3). */
  tildadas: Record<string, true>
  /** Tareas vinculadas acá a una entrada cargada desde la hoja: `<modulo>.<id>` → key de la entrada. */
  vinculos: Record<string, string>
  /** Entradas confirmadas en este navegador: key → AAAA-MM-DD. */
  confirmadas: Record<string, string>
  /** Entradas cargadas desde la hoja de Módulos. */
  nuevas: Entrada[]
  /** El horizonte elegido de cada módulo; sin elegir, 2 meses. */
  horizonte: Partial<Record<ConPlan, Horizonte>>
}

export const ESTADO_VACIO: EstadoModulos = { tildadas: {}, vinculos: {}, confirmadas: {}, nuevas: [], horizonte: {} }
// Una clave por ciclo: los ids de las tareas son por posición y el ciclo 2
// (05/11/2026) arrancó limpio, así que lo tildado en el ciclo 1 no se lee.
const CLAVE = 'orbita_superadmin_modulos_c2'

export const idTarea = (modulo: ConPlan, id: string) => `${modulo}.${id}`

let cache = ESTADO_VACIO
let leido = false
const oyentes = new Set<() => void>()

const RE_ISO = /^\d{4}-\d{2}-\d{2}$/
const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const esModulo = (v: unknown): v is ConPlan => v === 'turnos' || v === 'alquileres' || v === 'gimnasio'
const esTipo = (v: unknown): v is TipoEntrada => v === 'tarea' || v === 'diseño' || v === 'decisión'
const esPersona = (v: unknown): v is Persona => typeof v === 'string' && (PERSONAS as string[]).includes(v)

// Una entrada guardada con la forma de hoy, o nada: lo guardado puede ser de
// otra versión, estar a medio escribir o haberlo tocado alguien a mano.
function entradaGuardada(v: unknown): Entrada | null {
  if (!esObjeto(v)) return null
  const { key, modulo, tipo, titulo, foco, quien, fecha, informe } = v
  if (typeof key !== 'string' || !key.startsWith('auditoria.') || !esModulo(modulo) || !esTipo(tipo)) return null
  if (typeof titulo !== 'string' || typeof foco !== 'string' || typeof informe !== 'string') return null
  if (!esPersona(quien) || typeof fecha !== 'string' || !RE_ISO.test(fecha)) return null
  return { key, modulo, tipo, transversal: v.transversal === true, titulo, foco, quien, fecha, informe, abierta: false, origen: 'navegador', confirmada: null }
}

// Los textos de un registro que cumplen `vale`; lo demás se descarta.
function textos(v: unknown, vale: (x: string) => boolean): Record<string, string> {
  if (!esObjeto(v)) return {}
  return Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string' && vale(e[1])))
}

export function sanear(g: unknown): EstadoModulos {
  if (!esObjeto(g)) return ESTADO_VACIO
  const tildadas: Record<string, true> = {}
  if (esObjeto(g.tildadas)) for (const [k, v] of Object.entries(g.tildadas)) if (v === true) tildadas[k] = true
  const horizonte: Partial<Record<ConPlan, Horizonte>> = {}
  if (esObjeto(g.horizonte)) for (const [m, h] of Object.entries(g.horizonte)) if (esModulo(m) && (h === '1m' || h === '2m')) horizonte[m] = h
  return {
    tildadas,
    vinculos: textos(g.vinculos, (x) => x.startsWith('auditoria.')),
    confirmadas: textos(g.confirmadas, (x) => RE_ISO.test(x)),
    nuevas: Array.isArray(g.nuevas) ? g.nuevas.map(entradaGuardada).filter((e): e is Entrada => e !== null) : [],
    horizonte,
  }
}

function leer(): EstadoModulos {
  if (leido) return cache
  leido = true
  try {
    const crudo = window.localStorage.getItem(CLAVE)
    if (crudo) cache = sanear(JSON.parse(crudo))
  } catch { /* sin acceso al almacenamiento (o en el servidor) o JSON roto: queda el estado vacío */ }
  return cache
}

function escribir(e: EstadoModulos) {
  cache = e
  leido = true
  try { window.localStorage.setItem(CLAVE, JSON.stringify(e)) } catch { /* cuota llena o sin acceso: queda solo en memoria */ }
  oyentes.forEach((f) => f())
}

function suscribir(f: () => void) {
  oyentes.add(f)
  // Otra pestaña cambió algo: se vuelve a leer.
  const alCambiar = (e: StorageEvent) => { if (e.key === CLAVE) { leido = false; f() } }
  window.addEventListener('storage', alCambiar)
  return () => { oyentes.delete(f); window.removeEventListener('storage', alCambiar) }
}

// Cada acción parte de lo último guardado y cambia solo lo suyo.
const cambiar = (f: (e: EstadoModulos) => EstadoModulos) => escribir(f(leer()))

export const accionesModulos = {
  tildar(modulo: ConPlan, id: string, hecha: boolean) {
    cambiar((e) => {
      const tildadas = { ...e.tildadas }
      if (hecha) tildadas[idTarea(modulo, id)] = true
      else delete tildadas[idTarea(modulo, id)]
      return { ...e, tildadas }
    })
  },
  /** Confirma una entrada (el día `dia`) y tilda las tareas que documenta. */
  confirmar(key: string, dia: string, tareas: { modulo: ConPlan; id: string }[]) {
    cambiar((e) => ({
      ...e,
      confirmadas: { ...e.confirmadas, [key]: dia },
      tildadas: { ...e.tildadas, ...Object.fromEntries(tareas.map((t) => [idTarea(t.modulo, t.id), true as const])) },
    }))
  },
  /** Deshace una confirmación hecha en este navegador. Las tareas quedan como están: se destildan aparte. */
  desconfirmar(key: string) {
    cambiar((e) => {
      const confirmadas = { ...e.confirmadas }
      delete confirmadas[key]
      return { ...e, confirmadas }
    })
  },
  horizonte(modulo: ConPlan, h: Horizonte) {
    cambiar((e) => ({ ...e, horizonte: { ...e.horizonte, [modulo]: h } }))
  },
  /** Una entrada cargada desde la hoja, con la tarea que documenta si vino de una. Nace pendiente. */
  agregar(entrada: Entrada, tarea?: { modulo: ConPlan; id: string }) {
    cambiar((e) => ({
      ...e,
      nuevas: [...e.nuevas, { ...entrada, origen: 'navegador', abierta: false, confirmada: null }],
      vinculos: tarea ? { ...e.vinculos, [idTarea(tarea.modulo, tarea.id)]: entrada.key } : e.vinculos,
    }))
  },
  /** Vuelve todo a como viene en el código (lo usan los tests). */
  reiniciar() {
    escribir(ESTADO_VACIO)
  },
}

/** Lo guardado hasta ahora, fuera de React (lo usan los tests). */
export const estadoGuardado = (): EstadoModulos => leer()

/** Lo guardado en este navegador. En el servidor (y en el primer pintado) es el estado vacío. */
export function useEstadoModulos(): EstadoModulos {
  return useSyncExternalStore(suscribir, leer, () => ESTADO_VACIO)
}
