import { useSyncExternalStore } from 'react'

// `prefers-reduced-motion` como store externo: así el pet y su globo de texto
// reaccionan si la persona cambia la preferencia con la página abierta, sin un
// setState dentro de un efecto. En el servidor se asume que no hay preferencia.

const CONSULTA = '(prefers-reduced-motion: reduce)'

function suscribir(avisar: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const mq = window.matchMedia(CONSULTA)
  mq.addEventListener?.('change', avisar)
  return () => mq.removeEventListener?.('change', avisar)
}

function leer() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(CONSULTA).matches
}

export function useMovimientoReducido(): boolean {
  return useSyncExternalStore(suscribir, leer, () => false)
}
