// Cálculo puro del alto del teclado a partir de medidas del viewport.
// Vive aparte del hook para poder testearlo sin DOM (vitest corre en 'node').

export interface ViewportInput {
  layoutHeight: number
  visualHeight: number
  visualOffsetTop: number
}

export interface KeyboardMetrics {
  keyboardHeight: number
  viewportHeight: number
  offsetTop: number
  keyboardOpen: boolean
}

// Debajo de esto es la barra de sugerencias del teclado o ruido de medición,
// no un teclado de verdad — no vale la pena reacomodar el sheet por eso.
const KEYBOARD_MIN = 120

export function computeKeyboardMetrics(input: ViewportInput): KeyboardMetrics {
  const offsetTop = Math.max(0, input.visualOffsetTop)
  const keyboardHeight = Math.max(0, input.layoutHeight - input.visualHeight - offsetTop)
  return {
    keyboardHeight,
    viewportHeight: input.visualHeight,
    offsetTop,
    keyboardOpen: keyboardHeight > KEYBOARD_MIN,
  }
}
