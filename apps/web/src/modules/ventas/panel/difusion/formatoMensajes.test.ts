import { describe, expect, it } from 'vitest'
import { cuandoFue, diaDe, iniciales } from './formatoMensajes'

const AHORA = new Date('2026-10-12T15:00:00').getTime()
const hace = (ms: number) => new Date(AHORA - ms).toISOString()
const MIN = 60_000
const HORA = 60 * MIN
const DIA = 24 * HORA

describe('cuandoFue', () => {
  it('lo de hace un instante es "ahora"', () => {
    expect(cuandoFue(hace(20_000), AHORA)).toBe('ahora')
  })
  it('usa minutos, horas y días según cuánto pasó', () => {
    expect(cuandoFue(hace(5 * MIN), AHORA)).toBe('5 min')
    expect(cuandoFue(hace(3 * HORA), AHORA)).toBe('3 h')
    expect(cuandoFue(hace(2 * DIA), AHORA)).toBe('2 d')
  })
  it('pasada una semana muestra la fecha', () => {
    expect(cuandoFue(hace(10 * DIA), AHORA)).toMatch(/oct/)
  })
  it('una fecha del futuro (reloj corrido) no se rompe', () => {
    expect(cuandoFue(new Date(AHORA + HORA).toISOString(), AHORA)).toBe('ahora')
  })
})

describe('diaDe', () => {
  it('distingue hoy y ayer', () => {
    expect(diaDe(hace(HORA), AHORA)).toBe('Hoy')
    expect(diaDe(hace(DIA), AHORA)).toBe('Ayer')
  })
  it('agrega el año si es de otro año', () => {
    expect(diaDe(new Date('2025-03-02T12:00:00').toISOString(), AHORA)).toMatch(/2025/)
    expect(diaDe(new Date('2026-03-02T12:00:00').toISOString(), AHORA)).not.toMatch(/2026/)
  })
})

describe('iniciales', () => {
  it('toma hasta dos letras', () => {
    expect(iniciales('Ana Paz')).toBe('AP')
    expect(iniciales('Instagram 4821')).toBe('I4')
    expect(iniciales('@tienda_x')).toBe('TX')
    expect(iniciales('maría')).toBe('M')
  })
  it('un nombre vacío no queda sin avatar', () => {
    expect(iniciales('')).toBe('?')
  })
})
