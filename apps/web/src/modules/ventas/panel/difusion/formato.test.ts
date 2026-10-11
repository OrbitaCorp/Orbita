import { describe, expect, it } from 'vitest'
import { haceCuanto, numero, resumir } from './formato'

const AHORA = Date.parse('2026-10-09T12:00:00Z')
const hace = (ms: number) => new Date(AHORA - ms).toISOString()
const MIN = 60_000
const HORA = 60 * MIN
const DIA = 24 * HORA

describe('haceCuanto', () => {
  it('escala de minutos a días', () => {
    expect(haceCuanto(hace(20_000), AHORA)).toBe('recién')
    expect(haceCuanto(hace(5 * MIN), AHORA)).toBe('hace 5 min')
    expect(haceCuanto(hace(3 * HORA), AHORA)).toBe('hace 3 h')
    expect(haceCuanto(hace(30 * HORA), AHORA)).toBe('ayer')
    expect(haceCuanto(hace(4 * DIA), AHORA)).toBe('hace 4 días')
  })

  it('pasada una semana muestra la fecha', () => {
    expect(haceCuanto(hace(20 * DIA), AHORA)).toMatch(/\d+ \w+/)
    expect(haceCuanto(hace(20 * DIA), AHORA)).not.toMatch(/hace/)
  })

  it('sin fecha o con una fecha inválida no devuelve nada', () => {
    expect(haceCuanto(null, AHORA)).toBe('')
    expect(haceCuanto(undefined, AHORA)).toBe('')
    expect(haceCuanto('no es una fecha', AHORA)).toBe('')
  })
})

describe('numero', () => {
  it('pone puntos de miles y "—" cuando no hay dato', () => {
    expect(numero(12500)).toBe('12.500')
    expect(numero(0)).toBe('0')
    expect(numero(null)).toBe('—')
    expect(numero(undefined)).toBe('—')
  })
})

describe('resumir', () => {
  it('no toca un texto corto y junta los espacios', () => {
    expect(resumir('  Remera   lisa  ', 40)).toBe('Remera lisa')
  })

  it('recorta con puntos suspensivos, mejor en un espacio que a mitad de palabra', () => {
    expect(resumir('Remera lisa oversize de algodón peinado', 25)).toBe('Remera lisa oversize de…')
    expect(resumir('a'.repeat(50), 10)).toBe(`${'a'.repeat(9)}…`)
  })
})
