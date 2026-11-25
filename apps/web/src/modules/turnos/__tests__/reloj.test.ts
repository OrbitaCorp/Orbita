// El reloj del panel: el de la demo o, en un negocio real, el de Argentina (24/11).
import { afterEach, describe, expect, it } from 'vitest'
import { AHORA, AHORA_DEMO, HOY_DIA, HOY_SEMANA, HOY_TXT, FECHA_DEMO, fijarReloj } from '../horario'
import { cuandoTxt, fechaCorta, fechaLarga, indiceDia } from '../datos/agenda'

afterEach(() => fijarReloj(null))

describe('reloj del panel', () => {
  it('sin reloj real, el de la demo: sábado 26/09 a las 10:40', () => {
    fijarReloj(null)
    expect([AHORA, HOY_DIA, HOY_TXT]).toEqual([AHORA_DEMO, HOY_SEMANA, FECHA_DEMO])
    expect(fechaCorta(0)).toBe('26/09')
  })

  it('con el reloj real, el día de la semana y las fechas salen de hoy', () => {
    fijarReloj({ hoy: '2026-11-24', minutos: 17 * 60 + 5 })
    expect(AHORA).toBe(1025)
    expect(HOY_DIA).toBe(1) // martes
    expect(HOY_TXT).toBe('Martes 24 de noviembre')
    expect(indiceDia(0)).toBe(1)
    expect(indiceDia(5)).toBe(6) // domingo 29
    expect(fechaCorta(7)).toBe('01/12')
    expect(fechaLarga(-1)).toBe('Lunes 23 de noviembre')
    expect(cuandoTxt(1)).toBe('Mañana')
  })
})
