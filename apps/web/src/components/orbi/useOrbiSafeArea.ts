import { useLayoutEffect } from 'react'
import type { RefObject } from 'react'

// Mide el header/footer reales de la pantalla del wizard y los publica como
// variables CSS globales (--orbi-wizard-top / --orbi-wizard-bottom) para que
// OrbiPanel pueda encajar entre ambos sin taparlos ni quedar tapado por ellos
// (ver bug: el panel se superponía al botón "Continuar" y al header).
export function useOrbiSafeArea(
  headerRef: RefObject<HTMLElement | null>,
  footerRef: RefObject<HTMLElement | null>,
  deps: unknown[] = [],
) {
  useLayoutEffect(() => {
    const root = document.documentElement
    const update = () => {
      root.style.setProperty('--orbi-wizard-top', `${headerRef.current?.offsetHeight ?? 0}px`)
      root.style.setProperty('--orbi-wizard-bottom', `${footerRef.current?.offsetHeight ?? 0}px`)
    }
    update()

    const ro = new ResizeObserver(update)
    if (headerRef.current) ro.observe(headerRef.current)
    if (footerRef.current) ro.observe(footerRef.current)
    window.addEventListener('resize', update)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
      root.style.removeProperty('--orbi-wizard-top')
      root.style.removeProperty('--orbi-wizard-bottom')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
