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
  const bruto = Math.max(0, input.layoutHeight - input.visualHeight - offsetTop)
  // Un teclado nunca ocupa más de ~60% de la pantalla. Si la cuenta da más,
  // algo se midió mal (barra de Safari, interactive-widget ya reacomodó, etc.)
  // y clampear evita que el sheet se rompa reservando de más.
  const keyboardHeight = Math.min(bruto, input.layoutHeight * 0.6)
  return {
    keyboardHeight,
    viewportHeight: input.visualHeight,
    offsetTop,
    keyboardOpen: keyboardHeight > KEYBOARD_MIN,
  }
}
