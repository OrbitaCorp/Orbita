import { useEffect } from 'react'
import { computeKeyboardMetrics } from './orbiViewport'

// Último alto de teclado visto en esta pestaña. Sirve para adelantarse: apenas
// el usuario enfoca el input aplicamos este valor sin esperar a que iOS avise
// (Safari dispara visualViewport.resize recién al TERMINAR la animación del
// teclado, ~300ms — ese era el "tarda un ratito en adaptarse").
let ultimoTecladoPx = 0

function esCampoDeTexto(el: Element | null): boolean {
  if (!el) return false
  const t = el.tagName
  return t === 'TEXTAREA' || t === 'INPUT' || (el as HTMLElement).isContentEditable === true
}

// Ancla el sheet de Orbi al VISUAL VIEWPORT, en píxeles, publicando en <html>:
//   --orbi-vv-top : offsetTop del visual viewport (iOS lo mueve al enfocar)
//   --orbi-vv-h   : alto del visual viewport (lo que queda arriba del teclado)
//   --orbi-kb     : alto del teclado
//   data-orbi-kb  : "1" con el teclado abierto (lo usa el CSS para compactar)
//
// Por qué en píxeles y no con 100dvh + padding: en iOS Safari, cuando enfocás
// un input que quedaría debajo del teclado, el navegador SCROLLEA el elemento
// position:fixed que lo contiene. Con top/height fijados al visual viewport en
// cada evento, el sheet vuelve a su lugar solo. Nada de transform: sobre un
// position:fixed, Safari lo trata como absolute y se va con el scroll.
//
// El teclado NO se puede deducir de layoutHeight - visualHeight: con
// `interactive-widget=resizes-content` los dos se achican juntos y la cuenta da
// cero. Se usa una LÍNEA BASE: el alto medido mientras no hay ningún campo de
// texto enfocado. La diferencia contra esa base es el teclado.
export function useOrbiViewport(): void {
  useEffect(() => {
    const root = document.documentElement
    const vv = window.visualViewport
    let raf = 0
    let base = 0
    let anchoBase = window.innerWidth

    const aplicar = (top: number, alto: number, teclado: number) => {
      root.style.setProperty('--orbi-vv-top', `${Math.round(top)}px`)
      root.style.setProperty('--orbi-vv-h', `${Math.round(alto)}px`)
      root.style.setProperty('--orbi-kb', `${Math.round(teclado)}px`)
      root.dataset.orbiKb = teclado > 0 ? '1' : '0'
    }

    const medir = () => {
      raf = 0
      const visualHeight = vv ? vv.height : window.innerHeight
      const offsetTop = vv ? vv.offsetTop : 0
      const conFoco = esCampoDeTexto(document.activeElement)

      // Rotación / cambio de ancho: la línea base vieja ya no sirve.
      if (window.innerWidth !== anchoBase) { anchoBase = window.innerWidth; base = 0 }
      // El teclado solo ACHICA el viewport, así que el máximo visto es el alto
      // sin teclado. (No se condiciona a "sin foco": OrbiInput hace autofocus al
      // montar, y en iOS un focus programático no abre el teclado — si se
      // esperara a que no haya foco, la base nunca se establecería.)
      if (visualHeight > base) base = visualHeight

      const m = computeKeyboardMetrics({
        layoutHeight: base || root.clientHeight,
        visualHeight,
        visualOffsetTop: offsetTop,
      })
      if (conFoco && m.keyboardOpen) ultimoTecladoPx = m.keyboardHeight

      aplicar(m.offsetTop, visualHeight, conFoco && m.keyboardOpen ? m.keyboardHeight : 0)
    }

    const agendar = () => { if (!raf) raf = requestAnimationFrame(medir) }

    // Adelanto optimista al enfocar: si ya sabemos cuánto mide el teclado en
    // este dispositivo, encogemos el sheet YA y después la medición real
    // corrige. Sin esto se ve el sheet a pantalla completa por ~300ms.
    const alEnfocar = (e: FocusEvent) => {
      if (esCampoDeTexto(e.target as Element) && ultimoTecladoPx > 0 && base > 0) {
        aplicar(0, base - ultimoTecladoPx, ultimoTecladoPx)
      }
      agendar()
      setTimeout(agendar, 120)
      setTimeout(agendar, 350)
    }

    const alDesenfocar = () => {
      agendar()
      setTimeout(agendar, 120)
      setTimeout(agendar, 350)
    }

    medir()
    vv?.addEventListener('resize', agendar)
    vv?.addEventListener('scroll', agendar)
    window.addEventListener('resize', agendar)
    window.addEventListener('scroll', agendar, { passive: true })
    window.addEventListener('focusin', alEnfocar)
    window.addEventListener('focusout', alDesenfocar)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      vv?.removeEventListener('resize', agendar)
      vv?.removeEventListener('scroll', agendar)
      window.removeEventListener('resize', agendar)
      window.removeEventListener('scroll', agendar)
      window.removeEventListener('focusin', alEnfocar)
      window.removeEventListener('focusout', alDesenfocar)
      root.style.removeProperty('--orbi-vv-top')
      root.style.removeProperty('--orbi-vv-h')
      root.style.removeProperty('--orbi-kb')
      delete root.dataset.orbiKb
    }
  }, [])
}
