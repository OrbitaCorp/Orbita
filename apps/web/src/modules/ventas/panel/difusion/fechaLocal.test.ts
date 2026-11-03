import { describe, expect, it } from 'vitest'
import { aInputLocal, claveDeMes, cuando, deInputLocal, mismoDia, semanasDelMes, ventanaHoraria } from './fechaLocal'

describe('aInputLocal / deInputLocal', () => {
  it('van y vuelven en la hora local, con ceros a la izquierda', () => {
    const f = new Date(2026, 9, 3, 7, 5)
    expect(aInputLocal(f)).toBe('2026-10-03T07:05')
    expect(deInputLocal('2026-10-03T07:05')?.getTime()).toBe(f.getTime())
  })
  it('un valor vacío o mal formado no es una fecha', () => {
    expect(deInputLocal('')).toBeNull()
    expect(deInputLocal('mañana')).toBeNull()
    expect(deInputLocal('2026-13-45T99:99')).toBeNull()
  })
})

describe('cuando', () => {
  const ahora = new Date(2026, 9, 12, 10, 0)
  it('muestra día, fecha y hora, y el año solo si no es el actual', () => {
    expect(cuando(new Date(2026, 9, 13, 19, 0), ahora)).toBe('mar 13 oct · 19:00')
    expect(cuando(new Date(2027, 0, 5, 9, 30), ahora)).toBe('mar 5 ene 2027 · 09:30')
  })
})

describe('semanasDelMes', () => {
  it('arma semanas de 7 días que empiezan en lunes, con vacíos antes y después del mes', () => {
    // Octubre de 2026 empieza en jueves y tiene 31 días.
    const semanas = semanasDelMes(2026, 9)
    expect(semanas.every((s) => s.length === 7)).toBe(true)
    expect(semanas[0].slice(0, 3)).toEqual([null, null, null])
    expect(semanas[0][3]?.getDate()).toBe(1)
    expect(semanas.flat().filter(Boolean)).toHaveLength(31)
    expect(semanas.at(-1)?.at(-1)).toBeNull()
  })
  it('un mes que empieza en lunes no tiene vacíos al principio', () => {
    // Junio de 2026 empieza en lunes.
    expect(semanasDelMes(2026, 5)[0][0]?.getDate()).toBe(1)
  })
})

describe('chicos', () => {
  it('claveDeMes, mismoDia y ventanaHoraria', () => {
    expect(claveDeMes(new Date(2026, 0, 31))).toBe('2026-01')
    expect(mismoDia(new Date(2026, 9, 1, 8), new Date(2026, 9, 1, 23))).toBe(true)
    expect(mismoDia(new Date(2026, 9, 1), new Date(2026, 10, 1))).toBe(false)
    expect(ventanaHoraria(18)).toBe('18 a 21 h')
    expect(ventanaHoraria(21)).toBe('21 a 0 h')
  })
})
