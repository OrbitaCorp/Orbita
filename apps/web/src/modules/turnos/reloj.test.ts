import { describe, expect, it } from 'vitest'
import {
  ahoraDe, diaDeSemana, diasDe, diasDelMes, diasEntre, esFecha, fechaArgentina, fechaCorta, fechaHoraCorta, fechaLarga, fechaYMinutos, grillaDelMes,
  instanteDe, isoDe, lunesDe, mesAnterior, mesDe, mesTxt, minutosArgentina, moverMes, rangoTxt, semanaDe, sumarDias,
} from './reloj'

const utc = (iso: string) => Date.parse(iso)

describe('medianoche en Argentina vs UTC', () => {
  it('a las 01:30 UTC todavía es el día anterior en Argentina (22:30)', () => {
    const t = utc('2026-10-03T01:30:00.000Z')
    expect(fechaArgentina(t)).toBe('2026-10-02')
    expect(minutosArgentina(t)).toBe(22 * 60 + 30)
  })
  it('a las 03:00 UTC es exactamente la medianoche argentina', () => {
    expect(fechaYMinutos(utc('2026-10-03T03:00:00.000Z'))).toEqual({ fecha: '2026-10-03', minutos: 0 })
    expect(fechaYMinutos(utc('2026-10-03T02:59:00.000Z'))).toEqual({ fecha: '2026-10-02', minutos: 1439 })
  })
  it('el fin de año cambia a las 03:00 UTC del 1/1', () => {
    expect(fechaArgentina(utc('2027-01-01T02:00:00.000Z'))).toBe('2026-12-31')
    expect(fechaArgentina(utc('2027-01-01T03:00:00.000Z'))).toBe('2027-01-01')
  })
  it('instanteDe es la inversa', () => {
    expect(isoDe('2026-10-05', 600)).toBe('2026-10-05T13:00:00.000Z')
    expect(instanteDe('2026-10-05')).toBe(utc('2026-10-05T03:00:00.000Z'))
    expect(fechaYMinutos(instanteDe('2026-02-28', 23 * 60 + 59))).toEqual({ fecha: '2026-02-28', minutos: 23 * 60 + 59 })
  })
  it('ahoraDe redondea al minuto y saca el día de la semana argentino', () => {
    // Sábado 26/09/2026 10:40:59 en Argentina.
    const a = ahoraDe(utc('2026-09-26T13:40:59.999Z'))
    expect(a).toEqual({ instante: utc('2026-09-26T13:40:00.000Z'), fecha: '2026-09-26', minutos: 640, diaSemana: 5 })
    // Domingo 00:10 en Argentina = domingo 03:10 UTC; el sábado 23:50 de Argentina ya es domingo en UTC.
    expect(ahoraDe(utc('2026-09-27T02:50:00.000Z')).diaSemana).toBe(5)
    expect(ahoraDe(utc('2026-09-27T03:10:00.000Z')).diaSemana).toBe(6)
  })
})

describe('fechas', () => {
  it('valida fechas reales', () => {
    expect(esFecha('2026-02-28')).toBe(true)
    expect(esFecha('2026-02-29')).toBe(false)
    expect(esFecha('2028-02-29')).toBe(true)
    expect(esFecha('2026-13-01')).toBe(false)
    expect(esFecha('26/09/2026')).toBe(false)
  })
  it('día de la semana con 0 = lunes', () => {
    expect(diaDeSemana('2026-09-21')).toBe(0)
    expect(diaDeSemana('2026-09-26')).toBe(5)
    expect(diaDeSemana('2026-09-27')).toBe(6)
  })
  it('cambio de mes y de año al sumar días', () => {
    expect(sumarDias('2026-09-30', 1)).toBe('2026-10-01')
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(sumarDias('2027-01-01', -1)).toBe('2026-12-31')
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29')
    expect(diasEntre('2026-12-30', '2027-01-02')).toBe(3)
    expect(diasEntre('2027-01-02', '2026-12-30')).toBe(-3)
  })
  it('meses de 28, 29, 30 y 31 días', () => {
    expect(diasDelMes(2026, 2)).toBe(28)
    expect(diasDelMes(2028, 2)).toBe(29)
    expect(diasDelMes(2100, 2)).toBe(28)
    expect(diasDelMes(2026, 9)).toBe(30)
    expect(diasDelMes(2026, 10)).toBe(31)
    expect(diasDelMes(2026, 12)).toBe(31)
  })
  it('moverMes se queda en el último día si el mes destino es más corto', () => {
    expect(moverMes('2026-01-31', 1)).toBe('2026-02-28')
    expect(moverMes('2028-01-31', 1)).toBe('2028-02-29')
    expect(moverMes('2026-10-31', -1)).toBe('2026-09-30')
    expect(moverMes('2026-12-15', 1)).toBe('2027-01-15')
    expect(moverMes('2027-01-15', -1)).toBe('2026-12-15')
    expect(moverMes('2026-03-31', -13)).toBe('2025-02-28')
  })
})

describe('grilla del mes', () => {
  it('semanas enteras de lunes a domingo', () => {
    // Septiembre 2026 arranca martes y termina miércoles.
    const g = grillaDelMes('2026-09-26')
    expect(g[0]).toBe('2026-08-31')
    expect(g.at(-1)).toBe('2026-10-04')
    expect(g.length).toBe(35)
    expect(g.length % 7).toBe(0)
  })
  it('un febrero de 28 que arranca lunes ocupa justo 4 semanas', () => {
    const g = grillaDelMes('2027-02-10')
    expect(g[0]).toBe('2027-02-01')
    expect(g.length).toBe(28)
  })
  it('un mes de 31 que arranca domingo ocupa 6 semanas', () => {
    // Agosto 2027 arranca domingo.
    const g = grillaDelMes('2027-08-01')
    expect(g[0]).toBe('2027-07-26')
    expect(g.length).toBe(42)
  })
  it('cruza de año', () => {
    const g = grillaDelMes('2026-12-01')
    expect(g[0]).toBe('2026-11-30')
    expect(g.at(-1)).toBe('2027-01-03')
  })
})

describe('semana y mes', () => {
  it('semana que cruza de mes', () => {
    expect(semanaDe('2026-10-01')).toEqual({ desde: '2026-09-28', hasta: '2026-10-04' })
    expect(lunesDe('2026-10-04')).toBe('2026-09-28')
    expect(diasDe(semanaDe('2026-10-01'))).toHaveLength(7)
  })
  it('semana que cruza de año', () => {
    expect(semanaDe('2027-01-01')).toEqual({ desde: '2026-12-28', hasta: '2027-01-03' })
  })
  it('mes en curso y mes anterior', () => {
    expect(mesDe('2026-10-03')).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' })
    expect(mesAnterior('2026-10-03')).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' })
    expect(mesAnterior('2027-01-15')).toEqual({ desde: '2026-12-01', hasta: '2026-12-31' })
    expect(mesAnterior('2026-03-31')).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' })
  })
  it('rango vacío', () => {
    expect(diasDe({ desde: '2026-10-05', hasta: '2026-10-04' })).toEqual([])
  })
})

describe('texto', () => {
  it('fechas en palabras', () => {
    expect(fechaLarga('2026-09-26')).toBe('Sábado 26 de septiembre')
    expect(fechaCorta('2026-10-03')).toBe('03/10')
    expect(mesTxt('2027-01-04')).toBe('Enero de 2027')
    expect(fechaHoraCorta('2026-09-26', 640)).toBe('Sáb 26 sep · 10:40')
  })
  it('rangos', () => {
    expect(rangoTxt('2026-09-21', '2026-09-26')).toBe('del 21 al 26 de septiembre')
    expect(rangoTxt('2026-09-28', '2026-10-03')).toBe('del 28 de septiembre al 3 de octubre')
    expect(rangoTxt('2026-12-28', '2027-01-02')).toBe('del 28 de diciembre de 2026 al 2 de enero de 2027')
  })
})
