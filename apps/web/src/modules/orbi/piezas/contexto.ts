import { createContext, useContext, useEffect, useState } from 'react'

export type Vista = 'lateral' | 'hoja' | 'pagina'

export interface ContextoOrbiV2 {
  vista: Vista
  /** Ir a una pantalla del panel. En el lateral y la página el chat sigue abierto; en las modales se cierra para que se vea. */
  navegar: (ruta: string) => void
  /** Avisa al lector de pantalla (una sola región aria-live). */
  anunciar: (texto: string) => void
}

export const OrbiV2Contexto = createContext<ContextoOrbiV2>({ vista: 'lateral', navegar: () => {}, anunciar: () => {} })

export const useOrbiV2Contexto = () => useContext(OrbiV2Contexto)

/** La hora, refrescada cada `cadaMs` solo mientras `activo`: sin consultas en curso ni tarjetas por vencer, no hay timer. */
export function useAhora(cadaMs: number, activo: boolean): number {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    if (!activo) return
    const id = setInterval(() => setAhora(Date.now()), cadaMs)
    return () => clearInterval(id)
  }, [cadaMs, activo])
  return ahora
}
