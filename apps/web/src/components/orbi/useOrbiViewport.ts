import { useEffect, useState } from 'react'
import { computeKeyboardMetrics, type KeyboardMetrics } from './orbiViewport'

const VACIO: KeyboardMetrics = { keyboardHeight: 0, viewportHeight: 0, offsetTop: 0, keyboardOpen: false }

// Suscribe window.visualViewport y publica el alto del teclado como estado y
// como variables CSS en <html>, para que el sheet de Orbi se apoye EXACTO
// sobre el teclado (en iOS el viewport de layout no se achica al aparecer el
// teclado — sin esto el input queda detrás y asoma el wizard por el hueco).
//
// Se usa solo mientras el sheet está montado; al desmontarse, el efecto limpia
// las variables CSS y saca los listeners.
export function useOrbiViewport(): KeyboardMetrics {
  const [metrics, setMetrics] = useState<KeyboardMetrics>(VACIO)

  useEffect(() => {
    const root = document.documentElement
    const vv = window.visualViewport
    let raf = 0

    const medir = () => {
      raf = 0
      const m = computeKeyboardMetrics({
        layoutHeight: root.clientHeight,
        visualHeight: vv ? vv.height : window.innerHeight,
        visualOffsetTop: vv ? vv.offsetTop : 0,
      })
      root.style.setProperty('--orbi-vv-height', `${m.viewportHeight || root.clientHeight}px`)
      root.style.setProperty('--orbi-kb', `${m.keyboardHeight}px`)
      root.style.setProperty('--orbi-vv-top', `${m.offsetTop}px`)
      setMetrics(m)
    }

    const agendar = () => { if (!raf) raf = requestAnimationFrame(medir) }

    // Primera medición en rAF (no sincrónica en el cuerpo del efecto): el sheet
    // renderiza un frame con el fallback 100dvh y se corrige enseguida, tapado
    // por la animación de entrada.
    agendar()
    vv?.addEventListener('resize', agendar)
    vv?.addEventListener('scroll', agendar)
    window.addEventListener('resize', agendar)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      vv?.removeEventListener('resize', agendar)
      vv?.removeEventListener('scroll', agendar)
      window.removeEventListener('resize', agendar)
      root.style.removeProperty('--orbi-vv-height')
      root.style.removeProperty('--orbi-kb')
      root.style.removeProperty('--orbi-vv-top')
    }
  }, [])

  return metrics
}
