// Lo que las tarjetas de Apariencia comparten con la pantalla: si se ve en un
// celular, cuál tarjeta está abierta (en el celular son plegables, de a una) y
// cómo pedirle a la vista previa que lleve la mirada a una parte de la tienda.

import { createContext, useContext, useSyncExternalStore } from 'react'
import type { ObjetivoPreview } from './focoPreview'

export interface ContextoApariencia {
    movil: boolean
    /** Tarjeta abierta (su `id`); solo tiene efecto en el celular. */
    abierta: string | null
    alternar: (id: string) => void
    pedirFoco: (objetivo: ObjetivoPreview) => void
}

export const CtxApariencia = createContext<ContextoApariencia>({
    movil: false,
    abierta: null,
    alternar: () => {},
    pedirFoco: () => {},
})

export const useCtxApariencia = () => useContext(CtxApariencia)

// Mismo corte que el resto del panel (ver globals.css y el CSS de esta pantalla).
const MQ_MOVIL = '(max-width: 768px)'
const suscribir = (avisar: () => void) => {
    const mq = window.matchMedia(MQ_MOVIL)
    mq.addEventListener('change', avisar)
    return () => mq.removeEventListener('change', avisar)
}

/** ¿Pantalla de celular? Falso en el servidor, así no hay diferencia al hidratar. */
export function useEsMovil(): boolean {
    return useSyncExternalStore(suscribir, () => window.matchMedia(MQ_MOVIL).matches, () => false)
}
