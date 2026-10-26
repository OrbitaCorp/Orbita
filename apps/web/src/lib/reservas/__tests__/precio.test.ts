import { describe, expect, it } from 'vitest'
import { ajusteDe, conAjuste, pesos, precioBloque, precioPorHora, precioTurnosSeguidos, redondearCien, saldoDe, senaDe } from '../precio'

describe('precio', () => {
  const reglas = [
    { dias: [0, 1, 2, 3], desde: 9 * 60, hasta: 12 * 60, ajuste: -15 },
    { dias: [], desde: 19 * 60, hasta: 22 * 60, ajuste: 20 },
  ]

  it('aplica la franja que corresponde al día y a la hora de inicio', () => {
    expect(ajusteDe(0, 10 * 60, reglas)).toBe(-15)
    expect(ajusteDe(5, 10 * 60, reglas)).toBe(0) // sábado: la primera regla no aplica
    expect(ajusteDe(5, 20 * 60, reglas)).toBe(20) // la segunda vale todos los días
    expect(ajusteDe(5, 22 * 60, reglas)).toBe(0) // el final no entra
  })

  it('cobra por hora con la duración y el ajuste', () => {
    expect(precioPorHora(45000, 60, 5, 20 * 60, reglas)).toEqual({ base: 45000, ajuste: 20, final: 54000 })
    expect(precioPorHora(45000, 90, 5, 16 * 60, reglas)).toEqual({ base: 67500, ajuste: 0, final: 67500 })
    expect(precioPorHora(36000, 60, 0, 10 * 60, reglas).final).toBe(30600)
  })

  it('redondea el ajuste sin errores de coma flotante', () => {
    // 45.000 × 1,15 = 51.749,999… en coma flotante (redondeaba a 51.700); el ajuste da 51.750 justo y va a 51.800.
    const pico = [{ dias: [], desde: 19 * 60, hasta: 22 * 60, ajuste: 15 }]
    expect(precioPorHora(45000, 60, 5, 19 * 60, pico).final).toBe(51800)
    expect(conAjuste(45000, 15)).toBe(51750)
    expect(conAjuste(52000, -15)).toBe(44200)
  })

  it('cobra cada turno seguido con el ajuste de su propia franja', () => {
    // Lunes de 9 a 11: las dos horas caen en el -15 %. Un solo tramo, igual que con precioPorHora.
    const iguales = precioTurnosSeguidos(45000, 60, 2, 0, 9 * 60, reglas)
    expect(iguales.tramos).toEqual([{ inicio: 9 * 60, fin: 11 * 60, ajuste: -15, base: 90000, final: 76500 }])
    expect(iguales.final).toBe(precioPorHora(45000, 120, 0, 9 * 60, reglas).final)
    // Lunes de 11 a 13: la franja del -15 % termina a las 12, así que la segunda hora va sin descuento.
    const cruza = precioTurnosSeguidos(45000, 60, 2, 0, 11 * 60, reglas)
    expect(cruza.tramos.map(t => [t.inicio, t.fin, t.ajuste, t.final])).toEqual([[660, 720, -15, 38300], [720, 780, 0, 45000]])
    expect(cruza.final).toBe(83300)
    expect(cruza.base).toBe(90000)
    // De 21 a 24 con el pico de 19 a 22 (+20 %): el recargo va solo en la primera hora (antes iba en las tres).
    expect(precioTurnosSeguidos(45000, 60, 3, 5, 21 * 60, reglas).final).toBe(54000 + 90000)
    // Turnos de 90 minutos: el segundo arranca donde termina el primero.
    expect(precioTurnosSeguidos(40000, 90, 2, 5, 17 * 60 + 30, reglas).tramos.map(t => [t.inicio, t.ajuste])).toEqual([[1050, 0], [1140, 20]])
    expect(precioTurnosSeguidos(45000, 60, 0, 0, 600, reglas)).toEqual({ base: 0, final: 0, tramos: [] })
  })

  it('suma paquete y extras elegidos', () => {
    const extras = [{ id: 'dj', nombre: 'DJ', precio: 80000 }, { id: 'torta', nombre: 'Torta', precio: 35000 }]
    expect(precioBloque(350000, extras, ['dj'])).toEqual({ paquete: 350000, extras: 80000, total: 430000 })
    expect(precioBloque(350000, extras, [])).toEqual({ paquete: 350000, extras: 0, total: 350000 })
  })

  it('calcula seña y saldo', () => {
    expect(senaDe(430000, 30)).toBe(129000)
    expect(senaDe(430000, 0)).toBe(0)
    expect(saldoDe(430000, 129000)).toBe(301000)
    expect(redondearCien(12349)).toBe(12300)
    expect(pesos(45000)).toBe('$45.000')
  })
})
