// DEMO INTERNA — dónde vive lo que se va cargando en el alta.
//
// Queda en memoria y, de respaldo, en sessionStorage: si en medio del alta se
// salta a otra pantalla de la demo (o se recarga), al volver se sigue desde el
// mismo paso en vez de arrancar de cero. Es por pestaña y se borra con
// "Empezar de nuevo". La contraseña NUNCA se guarda: al recargar se vuelve a
// pedir.
//
// Mismo esquema que modules/turnos/datos/negocio.ts (useSyncExternalStore): el
// servidor y el primer pintado ven el alta vacía, y recién después aparece lo
// guardado.
import { useSyncExternalStore } from 'react'
import { JORNADA_INICIAL } from '@/modules/turnos/horario'
import type { AltaAlquiler } from '@/modules/alquileres/onboarding/pasos'
import type { AltaGym } from '@/modules/gimnasio/onboarding/pasos'
import { DATOS_INICIALES, moduloHabilitado, type DatosAlta, type ServicioAlta } from './modelo'

export interface EstadoAlta {
  /** Índice en los pasos del módulo elegido; igual a la cantidad de pasos = alta terminada. */
  paso: number
  /** Hasta dónde se llegó: las estaciones ya visitadas se pueden volver a tocar. */
  alcanzado: number
  datos: DatosAlta
  /** Turnos: servicios editados y seña, por rubro, para no perderlos al ir y volver de rubro. */
  editados: Record<string, ServicioAlta[]>
  senas: Record<string, number>
  /**
   * Alquileres: qué alquila y lo que cargó de eso (los pasos son del módulo).
   * Solo lo que se tocó: los valores de fábrica son del módulo y se ponen
   * encima al usarlos (reservas.ts), así este archivo no baja su código.
   */
  alquileres: Partial<AltaAlquiler>
  /** Gimnasio: rubro, actividades y precios (los pasos son del módulo). Igual que alquileres, solo lo que se tocó. */
  gimnasio: Partial<AltaGym>
}

const INICIAL: EstadoAlta = { paso: 0, alcanzado: 0, datos: DATOS_INICIALES, editados: {}, senas: {}, alquileres: {}, gimnasio: {} }
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
      // Y de antes de Alquileres y Gimnasio: sin esas claves, arrancan de fábrica.
      cache = {
        ...INICIAL, ...g, datos: { ...datos, modalidades, jornada },
        alquileres: g.alquileres ?? {},
        gimnasio: g.gimnasio ?? {},
      }
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

/**
 * Lo cargado en el alta. El alta real y las demos comparten la clave (es la
 * misma pestaña): en el alta real (`real`), un alta empezada con un módulo que
 * ahí está en "Próximamente" vuelve al primer paso en vez de seguir un
 * recorrido que no se puede terminar.
 */
export function useAlta(real = false) {
  const guardado = useSyncExternalStore(suscribir, leer, () => INICIAL)
  const sanear = (e: EstadoAlta): EstadoAlta =>
    e.datos.modulo && !moduloHabilitado(e.datos.modulo, real) ? { ...e, paso: 0, alcanzado: 0, datos: { ...e.datos, modulo: null } } : e
  return {
    estado: sanear(guardado),
    cambiar: (cambio: (e: EstadoAlta) => EstadoAlta) => escribir(cambio(sanear(leer()))),
    reiniciar: () => escribir(INICIAL),
  }
}

/** Alta real terminada (pago aprobado): se borra lo cargado para que la próxima arranque de cero. */
export function borrarAlta() {
  window.clearTimeout(pendiente)
  cache = INICIAL
  leido = true
  try { window.sessionStorage.removeItem(CLAVE) } catch { /* sin acceso al almacenamiento */ }
  oyentes.forEach(f => f())
}
