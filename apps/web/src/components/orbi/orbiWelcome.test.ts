import { describe, expect, it } from 'vitest'
import { mensajeOrbiAlLlegar } from './orbiWelcome'
import type { OrbiContext } from './types'

const wizard = (stepName?: string): OrbiContext => ({ surface: 'wizard', stepName })
const panel: OrbiContext = { surface: 'panel' }

describe('mensajeOrbiAlLlegar', () => {
  it('primer contacto en el wizard: saludo completo del paso', () => {
    expect(mensajeOrbiAlLlegar(wizard('tu-negocio'), true)).toMatch(/^¡Hola!.*negocio/)
    expect(mensajeOrbiAlLlegar(wizard('ubicacion'), true)).toMatch(/^¡Hola!/)
  })

  it('paso sin saludo propio: saludo genérico', () => {
    expect(mensajeOrbiAlLlegar(wizard('paso-raro'), true)).toBe('¡Hola! Soy Orbi. ¿En qué te ayudo?')
    expect(mensajeOrbiAlLlegar(wizard(undefined), true)).toBe('¡Hola! Soy Orbi. ¿En qué te ayudo?')
  })

  it('ya saludó antes: continuación sin "hola"', () => {
    const m = mensajeOrbiAlLlegar(wizard('ubicacion'), false)
    expect(m).not.toMatch(/hola/i)
    expect(m).toMatch(/seguimos con \*\*Ubicación\*\*/)
  })

  it('continuación de un paso sin copy propio: usa el label', () => {
    expect(mensajeOrbiAlLlegar(wizard('paso-raro'), false)).toBe(null) // sin label conocido → nada
    expect(mensajeOrbiAlLlegar(wizard('elegir-rubro'), false)).toBe('Dale, seguimos con **Elegir rubro**.')
  })

  it('panel: saluda solo la primera vez', () => {
    expect(mensajeOrbiAlLlegar(panel, true)).toBe('¡Hola! ¿En qué te doy una mano?')
    expect(mensajeOrbiAlLlegar(panel, false)).toBe(null)
  })
})
