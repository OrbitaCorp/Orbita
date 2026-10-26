import { describe, expect, it } from 'vitest'
import { aDias, deDias, diaSemana, diasDelMes, diasEntre, esFinDeSemana, esISO, grillaMes, moverMes, rango, rangoTxt, sumarDias, fechaCorta, fechaLarga, hhmm, aMinutos, fechaRelativa } from '../fechas'

describe('fechas', () => {
  it('suma y resta días sin zona horaria', () => {
    expect(sumarDias('2026-10-26', 7)).toBe('2026-11-02')
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28')
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29') // bisiesto
    expect(diasEntre('2026-10-26', '2026-12-18')).toBe(53)
    expect(deDias(aDias('2026-10-26'))).toBe('2026-10-26')
  })

  it('sabe qué día de la semana es (lunes = 0)', () => {
    expect(diaSemana('2026-10-26')).toBe(0) // lunes
    expect(diaSemana('2026-12-18')).toBe(4) // viernes
    expect(diaSemana('2026-09-26')).toBe(5) // sábado, el día de la demo
    expect(esFinDeSemana('2026-09-26')).toBe(true)
    expect(esFinDeSemana('2026-09-28')).toBe(false)
  })

  it('valida el formato', () => {
    expect(esISO('2026-10-26')).toBe(true)
    expect(esISO('26/10/2026')).toBe(false)
    expect(diasDelMes(2026, 2)).toBe(28)
    expect(diasDelMes(2028, 2)).toBe(29)
  })

  it('arma el rango sin incluir el final: las noches de una estadía', () => {
    expect(rango('2026-11-14', '2026-11-16')).toEqual(['2026-11-14', '2026-11-15'])
    expect(rango('2026-11-14', '2026-11-14')).toEqual([])
  })

  it('la grilla del mes arranca en lunes y cubre semanas completas', () => {
    const g = grillaMes(2026, 11) // noviembre 2026 arranca domingo
    expect(g.length % 7).toBe(0)
    expect(g[0].fecha).toBe('2026-10-26')
    expect(g[0].delMes).toBe(false)
    expect(g.filter(c => c.delMes).length).toBe(30)
    expect(moverMes('2026-11-14', 1)).toBe('2026-12-01')
    expect(moverMes('2026-01-14', -1)).toBe('2025-12-01')
  })

  it('escribe las fechas en castellano', () => {
    expect(fechaCorta('2026-11-14')).toBe('sáb 14 nov')
    expect(fechaLarga('2026-11-14')).toBe('Sábado 14 de noviembre')
    expect(rangoTxt('2026-11-14', '2026-11-16')).toBe('14 al 16 de noviembre')
    expect(rangoTxt('2026-11-30', '2026-12-02')).toBe('30 de nov al 2 de dic')
    expect(fechaRelativa('2026-11-14', '2026-11-14')).toBe('Hoy')
    expect(fechaRelativa('2026-11-15', '2026-11-14')).toBe('Mañana')
  })

  it('convierte horas', () => {
    expect(hhmm(9 * 60 + 5)).toBe('09:05')
    expect(aMinutos('19:30')).toBe(1170)
  })
})
