import { useEffect, useRef } from 'react'

interface Options {
  /** Identifica el paso actual. Al cambiar, el timer se reinicia. */
  stepKey: string
  /** Solo corre el detector si está activo (ej. panel cerrado, ofertas no apagadas). */
  enabled: boolean
  /** Se llama UNA vez cuando el paso lleva `thresholdMs` sin ninguna interacción. */
  onStuck: (stepKey: string) => void
  thresholdMs?: number
}

// Reemplaza al viejo useInactivityDetector (que solo miraba 3 campos del paso 1).
// Genérico: escucha cualquier interacción dentro de la página y, si el usuario
// pasa `thresholdMs` sin tocar nada en el paso actual, avisa una sola vez.
export function useStuckDetector({ stepKey, enabled, onStuck, thresholdMs = 30_000 }: Options) {
  const lastActivity = useRef(Date.now())
  const yaAviso = useRef<string | null>(null)
  const onStuckRef = useRef(onStuck)
  onStuckRef.current = onStuck

  // Paso nuevo: reinicia el reloj y habilita un aviso más.
  useEffect(() => {
    lastActivity.current = Date.now()
    yaAviso.current = null
  }, [stepKey])

  useEffect(() => {
    if (!enabled) return

    const marcar = () => { lastActivity.current = Date.now() }
    const eventos: (keyof DocumentEventMap)[] = ['pointerdown', 'keydown', 'input', 'change', 'wheel', 'touchstart']
    for (const ev of eventos) document.addEventListener(ev, marcar, { passive: true, capture: true })

    const id = setInterval(() => {
      if (yaAviso.current === stepKey) return
      if (Date.now() - lastActivity.current < thresholdMs) return
      yaAviso.current = stepKey
      onStuckRef.current(stepKey)
    }, 5_000)

    return () => {
      clearInterval(id)
      for (const ev of eventos) document.removeEventListener(ev, marcar, { capture: true } as EventListenerOptions)
    }
  }, [enabled, stepKey, thresholdMs])
}
