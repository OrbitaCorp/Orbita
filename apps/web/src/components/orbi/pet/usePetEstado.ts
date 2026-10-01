import { useEffect, useState } from 'react'
import { useOrbiStore } from '../useOrbiStore'
import type { PetEstado } from './OrbiPet'

const PENSANDO_MS = 2500

/**
 * Cara del pet según lo que pasa en la conversación: "escribiendo" mientras
 * llega la respuesta, y "pensando" un momento cuando la última acción salió mal.
 * Solo lee el estado del chat; no cambia nada de cómo responde Orbi.
 */
export function usePetEstado(): PetEstado {
  const escribiendo = useOrbiStore(s => s.isStreaming)
  const fallo = useOrbiStore(s => {
    for (let i = s.messages.length - 1; i >= 0; i--) {
      const msg = s.messages[i]
      if (msg.role === 'assistant') return !!msg.actions?.some(a => a.status === 'error')
    }
    return false
  })
  const [pensando, setPensando] = useState(false)
  const [falloAnterior, setFalloAnterior] = useState(fallo)

  // Cuando aparece un error, se marca durante el render (patrón de React para
  // ajustar estado cuando cambia una entrada) y el efecto solo lo apaga después.
  if (fallo !== falloAnterior) {
    setFalloAnterior(fallo)
    if (fallo) setPensando(true)
  }

  useEffect(() => {
    if (!pensando) return
    const t = setTimeout(() => setPensando(false), PENSANDO_MS)
    return () => clearTimeout(t)
  }, [pensando])

  if (escribiendo) return 'escribiendo'
  return pensando ? 'pensando' : 'normal'
}
