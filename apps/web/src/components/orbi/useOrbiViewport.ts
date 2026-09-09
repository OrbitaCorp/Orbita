import { useEffect } from 'react'
import { computeKeyboardMetrics } from './orbiViewport'

// Ancla el sheet de Orbi al VISUAL VIEWPORT, en píxeles, publicando en <html>:
//   --orbi-vv-top : offsetTop del visual viewport (iOS lo mueve al enfocar)
//   --orbi-vv-h   : alto del visual viewport (lo que queda arriba del teclado)
//   --orbi-kb     : alto del teclado (para quien lo necesite)
//
// Por qué en píxeles y no con 100dvh + padding: en iOS Safari, cuando enfocás
// un input que quedaría debajo del teclado, el navegador SCROLLEA el elemento
// position:fixed que lo contiene. Con top/height fijados al visual viewport en
// cada evento, el sheet vuelve a su lugar solo. Nada de transform: sobre un
// position:fixed, Safari lo trata como absolute y se va con el scroll.
export function useOrbiViewport(): void {
  useEffect(() => {
    const root = document.documentElement
    const vv = window.visualViewport
    let raf = 0

    const medir = () => {
      raf = 0
      const layoutHeight = root.clientHeight
      const visualHeight = vv ? vv.height : window.innerHeight
      const visualOffsetTop = vv ? vv.offsetTop : 0

      const m = computeKeyboardMetrics({ layoutHeight, visualHeight, visualOffsetTop })

      root.style.setProperty('--orbi-vv-top', `${Math.round(m.offsetTop)}px`)
      root.style.setProperty('--orbi-vv-h', `${Math.round(visualHeight)}px`)
      root.style.setProperty('--orbi-kb', `${Math.round(m.keyboardHeight)}px`)
    }

    const agendar = () => { if (!raf) raf = requestAnimationFrame(medir) }

    medir()
    vv?.addEventListener('resize', agendar)
    vv?.addEventListener('scroll', agendar)
    window.addEventListener('resize', agendar)
    window.addEventListener('scroll', agendar, { passive: true })
    // iOS a veces reacomoda DESPUÉS del evento de foco; una pasada extra a los
    // 300ms agarra el estado final de la animación del teclado.
    const focoTardio = () => { agendar(); setTimeout(agendar, 300) }
    window.addEventListener('focusin', focoTardio)
    window.addEventListener('focusout', focoTardio)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      vv?.removeEventListener('resize', agendar)
      vv?.removeEventListener('scroll', agendar)
      window.removeEventListener('resize', agendar)
      window.removeEventListener('scroll', agendar)
      window.removeEventListener('focusin', focoTardio)
      window.removeEventListener('focusout', focoTardio)
      root.style.removeProperty('--orbi-vv-top')
      root.style.removeProperty('--orbi-vv-h')
      root.style.removeProperty('--orbi-kb')
    }
  }, [])
}
