import { describe, expect, it } from 'vitest'
import { diasDeVentana, inicioConHoy, nocheTomada, rangoVentana, ubicar, type BarraGrilla } from './ocupacion'
import { MESES_CORTOS } from '@/lib/reservas/fechas'

const barra = (desde: string, hasta: string, filaId = 'p1'): BarraGrilla => ({ id: `${filaId}-${desde}`, filaId, desde, hasta, titulo: 'x', tono: 'reserva' })

describe('grilla de ocupación', () => {
  it('la ventana son los días seguidos desde el primero, cruzando el mes', () => {
    expect(diasDeVentana('2026-11-29', 4)).toEqual(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02'])
  })

  it('una estadía adentro ocupa sus noches: el día de salida queda libre', () => {
    // Ventana del 23 al 6: entra el 25 y sale el 28 → noches 25, 26 y 27.
    expect(ubicar(barra('2026-11-25', '2026-11-28'), '2026-11-23', 14)).toEqual({ col: 2, span: 3, sigueIzq: false, sigueDer: false })
  })

  it('dos estadías seguidas quedan una al lado de la otra, sin pisarse', () => {
    const a = ubicar(barra('2026-11-25', '2026-11-28'), '2026-11-23', 14)!
    const b = ubicar(barra('2026-11-28', '2026-11-30'), '2026-11-23', 14)!
    expect(a.col + a.span).toBe(b.col)
  })

  it('la que empezó antes o sigue después se corta en el borde y lo dice', () => {
    expect(ubicar(barra('2026-11-20', '2026-11-25'), '2026-11-23', 7)).toEqual({ col: 0, span: 2, sigueIzq: true, sigueDer: false })
    expect(ubicar(barra('2026-11-27', '2026-12-10'), '2026-11-23', 7)).toEqual({ col: 4, span: 3, sigueIzq: false, sigueDer: true })
  })

  it('una que termina justo cuando empieza la ventana, o empieza cuando termina, no se ve', () => {
    expect(ubicar(barra('2026-11-20', '2026-11-23'), '2026-11-23', 7)).toBeNull()
    expect(ubicar(barra('2026-11-30', '2026-12-02'), '2026-11-23', 7)).toBeNull()
    expect(ubicar(barra('2026-11-25', '2026-11-25'), '2026-11-23', 7)).toBeNull()
  })

  it('la noche de salida está libre y la de entrada no; solo cuenta la fila', () => {
    const bs = [barra('2026-11-25', '2026-11-28')]
    expect(nocheTomada(bs, 'p1', '2026-11-25')).toBe(true)
    expect(nocheTomada(bs, 'p1', '2026-11-27')).toBe(true)
    expect(nocheTomada(bs, 'p1', '2026-11-28')).toBe(false)
    expect(nocheTomada(bs, 'p2', '2026-11-26')).toBe(false)
  })

  it('el rango de la ventana y el arranque con hoy (un día antes)', () => {
    expect(rangoVentana('2026-11-23', 14, MESES_CORTOS)).toBe('23 nov → 6 dic')
    expect(inicioConHoy('2026-12-01')).toBe('2026-11-30')
  })
})
