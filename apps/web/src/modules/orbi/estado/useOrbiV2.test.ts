import { describe, expect, it } from 'vitest'
import { anchoValido, claveDeBorrador, tituloProvisorio } from './useOrbiV2'
import { orbiV2Prendido } from './flag'

describe('ancho del lateral', () => {
  it('queda entre 320 y 560; lo inválido vuelve a 400', () => {
    expect(anchoValido(200)).toBe(320)
    expect(anchoValido(900)).toBe(560)
    expect(anchoValido('432.6')).toBe(433)
    expect(anchoValido('x')).toBe(400)
    expect(anchoValido(undefined)).toBe(400)
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

describe('interruptor del Orbi nuevo', () => {
  it('apagado por defecto; se prende por env, por navegador o por la URL', () => {
    expect(orbiV2Prendido(undefined, null, null)).toBe(false)
    expect(orbiV2Prendido('1', null, null)).toBe(true)
    expect(orbiV2Prendido(undefined, '1', null)).toBe(true)
    expect(orbiV2Prendido(undefined, null, '1')).toBe(true)
  })

  it('?orbiV2=0 lo apaga aunque esté prendido para todos', () => {
    expect(orbiV2Prendido('1', '1', '0')).toBe(false)
  })
})
