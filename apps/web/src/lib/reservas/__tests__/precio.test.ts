import { describe, expect, it } from 'vitest'
import { ajusteDe, pesos, precioBloque, precioPorHora, redondearCien, saldoDe, senaDe } from '../precio'

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
