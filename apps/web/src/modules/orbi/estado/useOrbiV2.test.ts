import { describe, expect, it } from 'vitest'
import { anchoValido, claveDeBorrador, topeDeAncho, tituloProvisorio } from './useOrbiV2'

describe('ancho del lateral', () => {
  it('queda entre 320 y 560; lo inválido vuelve a 400', () => {
    expect(anchoValido(200)).toBe(320)
    expect(anchoValido(900)).toBe(560)
    expect(anchoValido('432.6')).toBe(433)
    expect(anchoValido('x')).toBe(400)
    expect(anchoValido(undefined)).toBe(400)
  })
})

describe('tope del lateral según la pantalla', () => {
  it('deja siempre 720 px a la sección del medio', () => {
    // 1280 con el menú abierto (240): solo entra el mínimo de Orbi.
    expect(topeDeAncho(1280 - 240)).toBe(320)
    // 1440 con el menú abierto: 1200 - 720.
    expect(topeDeAncho(1440 - 240)).toBe(480)
    // 1280 con el menú angosto (64): el lateral puede crecer más.
    expect(topeDeAncho(1280 - 64)).toBe(496)
  })
  it('no pasa del máximo ni baja del mínimo de Orbi', () => {
    expect(topeDeAncho(1920 - 240)).toBe(560)
    expect(topeDeAncho(800)).toBe(320)
    expect(topeDeAncho(Number.NaN)).toBe(560)
  })
})

describe('borradores y títulos', () => {
  it('una sesión sin id guarda su borrador como "nueva"', () => {
    expect(claveDeBorrador(null)).toBe('nueva')
    expect(claveDeBorrador('abc')).toBe('abc')
  })

  it('el título provisorio es una línea y no pasa de 60', () => {
    expect(tituloProvisorio('  ¿Cuánto\nvendí ayer?  ')).toBe('¿Cuánto vendí ayer?')
    const largo = tituloProvisorio('Necesito armar un descuento del veinte por ciento para todos los mates de calabaza')
    expect(Array.from(largo).length).toBeLessThanOrEqual(60)
    expect(largo.endsWith('…')).toBe(true)
  })
})
