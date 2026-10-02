import { useEffect } from 'react'
import { useOrbiStore } from './useOrbiStore'
import { disponibilidadDeLaRespuesta, REVISAR_MANTENIMIENTO_CADA_MS } from './mantenimiento'
import type { OrbiSurface } from './types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

async function revisar(surface: OrbiSurface, signal: AbortSignal): Promise<void> {
  try {
    const res = await fetch(`${API}/orbi/estado?surface=${surface}`, { signal })
    const estado = disponibilidadDeLaRespuesta(res.ok, await res.json().catch(() => null))
    if (estado && !signal.aborted) useOrbiStore.getState().setMantenimiento(estado.mantenimiento)
  } catch {
    // Red caída o corte: no se sabe, se deja lo que hubiera.
  }
}

/**
 * Al abrir Orbi pregunta si atiende, así el aviso de mantenimiento aparece
 * antes de que la persona escriba. Mientras el aviso está, vuelve a preguntar
 * cada minuto: cuando un admin lo rehabilita, el aviso se va solo. Con Orbi
 * cerrado no pregunta nada.
 */
export function useDisponibilidadOrbi(surface: OrbiSurface, abierto: boolean): void {
  const enMantenimiento = useOrbiStore(s => s.mantenimiento !== null)

  useEffect(() => {
    if (!abierto) return
    const corte = new AbortController()
    void revisar(surface, corte.signal)
    return () => corte.abort()
  }, [surface, abierto])

  useEffect(() => {
    if (!abierto || !enMantenimiento) return
    const corte = new AbortController()
    const intervalo = setInterval(() => void revisar(surface, corte.signal), REVISAR_MANTENIMIENTO_CADA_MS)
    return () => {
      corte.abort()
      clearInterval(intervalo)
    }
  }, [surface, abierto, enMantenimiento])
}
