// El calendario del sitio: el de la demo (26/09/2026) o el de un negocio real.
import { afterEach, describe, expect, it } from 'vitest'
import { HOY, enDias, fechaDeIso, fechaLarga, fijarHoy, isoDe, mesCorto, nombreDia, sumarDias } from '../reserva/calendario'

afterEach(() => fijarHoy(null))

describe('calendario del sitio', () => {
  it('la demo sigue en el sábado 26 de septiembre de 2026, y pasa a octubre', () => {
    fijarHoy(null)
    expect(fechaLarga(HOY)).toBe('Sábado 26 de septiembre')
    expect(fechaLarga(sumarDias(HOY, 5))).toBe('Jueves 1 de octubre')
    expect(enDias(sumarDias(HOY, 5))).toBe(5)
    expect(isoDe(HOY)).toBe('2026-09-26')
  })

  it('con un hoy real cruza de mes y de año', () => {
    fijarHoy('2026-12-30')
    expect(nombreDia(HOY)).toBe('Miércoles')
    const enero = sumarDias(HOY, 3)
    expect(enero).toEqual({ mes: 13, dia: 2 })
    expect(fechaLarga(enero)).toBe('Sábado 2 de enero')
    expect(mesCorto(enero)).toBe('ene')
    expect(isoDe(enero)).toBe('2027-01-02')
    expect(fechaDeIso('2027-01-02')).toEqual(enero)
    expect(enDias(enero)).toBe(3)
  })
})
