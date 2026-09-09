import { useEffect } from 'react'
import { computeKeyboardMetrics } from './orbiViewport'

// Publica en <html> la variable --orbi-kb = alto del teclado (px), calculada con
// window.visualViewport. En iOS el viewport de layout NO se achica al aparecer
// el teclado; sin esto el input del sheet queda detrás del teclado y asoma el
// wizard por el hueco.
//
// Se usa solo mientras el sheet está montado; al desmontarse limpia la variable
// y saca los listeners.
export function useOrbiViewport(): void {
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
      root.style.setProperty('--orbi-kb', `${m.keyboardOpen ? m.keyboardHeight : 0}px`)
    }

    const agendar = () => { if (!raf) raf = requestAnimationFrame(medir) }

    medir()
    vv?.addEventListener('resize', agendar)
    vv?.addEventListener('scroll', agendar)
    window.addEventListener('resize', agendar)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      vv?.removeEventListener('resize', agendar)
      vv?.removeEventListener('scroll', agendar)
      window.removeEventListener('resize', agendar)
      root.style.removeProperty('--orbi-kb')
    }
  }, [])
}
