// DEMO INTERNA — dónde vive lo que se va cargando en el alta.
//
// Queda en memoria y, de respaldo, en sessionStorage: si en medio del alta se
// salta a otra pantalla de la demo (o se recarga), al volver se sigue desde el
// mismo paso en vez de arrancar de cero. Es por pestaña y se borra con
// "Empezar de nuevo". La contraseña NUNCA se guarda: al recargar se vuelve a
// pedir.
//
// Mismo esquema que demo/negocioDemo.ts (useSyncExternalStore): el servidor y
// el primer pintado ven el alta vacía, y recién después aparece lo guardado.
import { useSyncExternalStore } from 'react'
import { JORNADA_INICIAL } from '@/modules/turnos/horario'
import { DATOS_INICIALES, type DatosAlta, type ServicioAlta } from './modelo'

export interface EstadoAlta {
  /** Índice en los pasos del módulo elegido; igual a la cantidad de pasos = alta terminada. */
  paso: number
  /** Hasta dónde se llegó: las estaciones ya visitadas se pueden volver a tocar. */
  alcanzado: number
  datos: DatosAlta
  /** Turnos: servicios editados y seña, por rubro, para no perderlos al ir y volver de rubro. */
  editados: Record<string, ServicioAlta[]>
  senas: Record<string, number>
}

const INICIAL: EstadoAlta = { paso: 0, alcanzado: 0, datos: DATOS_INICIALES, editados: {}, senas: {} }
const CLAVE = 'orbita_turnos_demo_alta'

let cache: EstadoAlta = INICIAL
let leido = false
let pendiente: number | undefined
const oyentes = new Set<() => void>()

function leer(): EstadoAlta {
  if (leido) return cache
  leido = true
  try {
    const crudo = window.sessionStorage.getItem(CLAVE)
    if (crudo) {
      const g = JSON.parse(crudo) as Partial<EstadoAlta>
      const datos = { ...DATOS_INICIALES, ...g.datos, clave: '', clave2: '' }
      // Lo guardado puede venir de una versión anterior del alta (tenía "online" y un horario de corrido).
      const modalidades = datos.modalidades?.filter(m => m === 'local' || m === 'domicilio') ?? null
      const jornada = datos.jornada?.manana && datos.jornada?.tarde ? datos.jornada : JORNADA_INICIAL
      cache = { ...INICIAL, ...g, datos: { ...datos, modalidades, jornada } }
    }
  } catch { /* sin acceso al almacenamiento o JSON roto: se arranca de cero */ }
  return cache
}

function persistir() {
  window.clearTimeout(pendiente)
  try {
    if (cache === INICIAL) window.sessionStorage.removeItem(CLAVE)
    else window.sessionStorage.setItem(CLAVE, JSON.stringify({ ...cache, datos: { ...cache.datos, clave: '', clave2: '' } }))
  } catch { /* cuota llena: queda solo en memoria */ }
}

function escribir(e: EstadoAlta) {
  cache = e
  leido = true
  // Se escribe un rato después de la última tecla, no en cada una.
  window.clearTimeout(pendiente)
  pendiente = window.setTimeout(persistir, 250)
  oyentes.forEach(f => f())
}

function suscribir(f: () => void) {
  oyentes.add(f)
  window.addEventListener('pagehide', persistir)
  return () => { oyentes.delete(f); window.removeEventListener('pagehide', persistir) }
}

export function useAlta() {
  const estado = useSyncExternalStore(suscribir, leer, () => INICIAL)
  return {
    estado,
    cambiar: (cambio: (e: EstadoAlta) => EstadoAlta) => escribir(cambio(leer())),
    reiniciar: () => escribir(INICIAL),
  }
}
