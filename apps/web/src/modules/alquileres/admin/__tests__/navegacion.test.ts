import { describe, expect, it } from 'vitest'
import { seccionesDe } from '../navegacion'

describe('el menú del panel: la sección de la plata', () => {
  it('en la estadía se llama Estadísticas; en canchas y salones sigue siendo Ingresos', () => {
    expect(seccionesDe('estadia').find(s => s.id === 'ingresos')?.label).toBe('Estadísticas')
    expect(seccionesDe('estadia', undefined, true).find(s => s.id === 'ingresos')?.label).toBe('Estadísticas')
    expect(seccionesDe('cancha').find(s => s.id === 'ingresos')?.label).toBe('Ingresos')
    expect(seccionesDe('bloque').find(s => s.id === 'ingresos')?.label).toBe('Ingresos')
  })
})
