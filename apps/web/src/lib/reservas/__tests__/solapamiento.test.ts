import { describe, expect, it } from 'vitest'
import { chocaCon, minutosDe, restar, seSolapan, unir } from '../solapamiento'

describe('solapamiento', () => {
  it('tocarse en el borde no es pisarse', () => {
    expect(seSolapan([600, 630], [630, 660])).toBe(false)
    expect(seSolapan([600, 660], [630, 660])).toBe(true)
    expect(seSolapan([600, 700], [620, 640])).toBe(true)
  })

  it('una reserva nueva choca con las del mismo día, y el margen agranda cada ocupación', () => {
    const ocupadas = [{ fecha: '2026-11-14', inicio: 600, fin: 660, id: 'a' }, { fecha: '2026-11-15', inicio: 600, fin: 660, id: 'b' }]
    expect(chocaCon({ fecha: '2026-11-14', inicio: 630, fin: 690 }, ocupadas)).toEqual(ocupadas[0])
    expect(chocaCon({ fecha: '2026-11-14', inicio: 660, fin: 720 }, ocupadas)).toBeNull()
    expect(chocaCon({ fecha: '2026-11-14', inicio: 660, fin: 720 }, ocupadas, 15)).toEqual(ocupadas[0])
    // Al editar, una reserva no choca consigo misma.
    expect(chocaCon({ fecha: '2026-11-14', inicio: 600, fin: 660, id: 'a' }, ocupadas)).toBeNull()
  })

  it('une y resta tramos', () => {
    expect(unir([[600, 660], [630, 700], [800, 860]])).toEqual([[600, 700], [800, 860]])
    expect(restar([540, 780], [[600, 660]])).toEqual([[540, 600], [660, 780]])
    expect(restar([540, 780], [[500, 800]])).toEqual([])
    expect(minutosDe([[600, 660], [630, 700]])).toBe(100)
  })
})
