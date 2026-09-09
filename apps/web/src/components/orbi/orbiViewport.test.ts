import { describe, it, expect } from 'vitest'
import { computeKeyboardMetrics } from './orbiViewport'

describe('computeKeyboardMetrics', () => {
  it('sin teclado: keyboardHeight 0, keyboardOpen false', () => {
    const m = computeKeyboardMetrics({ layoutHeight: 844, visualHeight: 844, visualOffsetTop: 0 })
    expect(m.keyboardHeight).toBe(0)
    expect(m.keyboardOpen).toBe(false)
    expect(m.viewportHeight).toBe(844)
    expect(m.offsetTop).toBe(0)
  })

  it('teclado abierto: keyboardHeight = layout - visual - offsetTop', () => {
    const m = computeKeyboardMetrics({ layoutHeight: 844, visualHeight: 500, visualOffsetTop: 0 })
    expect(m.keyboardHeight).toBe(344)
    expect(m.keyboardOpen).toBe(true)
  })

  it('iOS desplaza el visual viewport: descuenta offsetTop', () => {
    const m = computeKeyboardMetrics({ layoutHeight: 844, visualHeight: 500, visualOffsetTop: 40 })
    expect(m.keyboardHeight).toBe(304)
    expect(m.offsetTop).toBe(40)
  })

  it('nunca devuelve valores negativos (rebote de scroll)', () => {
    const m = computeKeyboardMetrics({ layoutHeight: 844, visualHeight: 900, visualOffsetTop: -20 })
    expect(m.keyboardHeight).toBe(0)
    expect(m.offsetTop).toBe(0)
  })

  it('teclado chico (< 120px, barra de sugerencias sola) no cuenta como abierto', () => {
    const m = computeKeyboardMetrics({ layoutHeight: 844, visualHeight: 760, visualOffsetTop: 0 })
    expect(m.keyboardHeight).toBe(84)
    expect(m.keyboardOpen).toBe(false)
  })
})
