import { useSyncExternalStore } from 'react'

// El Orbi nuevo sale apagado. Se prende para todos con
// NEXT_PUBLIC_ORBI_PANEL_V2=1 en Vercel, o en UN navegador agregando ?orbiV2=1
// a cualquier URL del panel (?orbiV2=0 lo apaga): así se prueba en producción,
// con datos reales, sin prendérselo a nadie más. No es un permiso: el Orbi
// nuevo usa los mismos endpoints y permisos que el de hoy.

const CLAVE = 'orbi:v2'

export function orbiV2Prendido(env: string | undefined, guardado: string | null, query: string | null): boolean {
  if (query === '1') return true
  if (query === '0') return false
  return env === '1' || guardado === '1'
}

/** Lee (y si vino en la URL, recuerda) el interruptor. Solo en el navegador. */
export function leerFlagOrbiV2(): boolean {
  if (typeof window === 'undefined') return false
  let guardado: string | null = null
  try { guardado = window.localStorage.getItem(CLAVE) } catch { /* sin storage */ }
  const query = new URLSearchParams(window.location.search).get('orbiV2')
  if (query === '1' || query === '0') {
    try { window.localStorage.setItem(CLAVE, query) } catch { /* sin storage */ }
  }
  return orbiV2Prendido(process.env.NEXT_PUBLIC_ORBI_PANEL_V2, guardado, query)
}

const sinSuscripcion = () => () => {}

/** El interruptor en un componente: apagado en el servidor, leído en el navegador. */
export function useFlagOrbiV2(): boolean {
  return useSyncExternalStore(sinSuscripcion, leerFlagOrbiV2, () => false)
}
