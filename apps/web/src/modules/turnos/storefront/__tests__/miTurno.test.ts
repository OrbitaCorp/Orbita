// "Mi turno": los textos de la página del enlace personal y su guarda (26/11).
import { describe, expect, it } from 'vitest'
import { ESTADO_TXT, senaAlCancelarTxt } from '../MiTurno'
import { esDeTurnos } from '@/lib/reservas/destinoPanel'

describe('mi turno', () => {
  it('dice qué pasa con la seña solo si se pagó algo', () => {
    expect(senaAlCancelarTxt('DEVUELTA', 3600, 3600)).toBe('Si cancelás ahora, te devolvemos la seña de $3.600.')
    expect(senaAlCancelarTxt('PERDIDA', 3600, 1000)).toBe('Si cancelás ahora, la seña de $1.000 no se devuelve.')
    expect(senaAlCancelarTxt('DEVUELTA', 3600, 0)).toBe('')
    expect(senaAlCancelarTxt('SIN_SENA', 0, 0)).toBe('')
  })

  it('cada estado tiene su texto para quien reservó', () => {
    expect(ESTADO_TXT.PENDIENTE.titulo).toBe('Esperando que el negocio lo confirme')
    expect(ESTADO_TXT.CONFIRMADA.tono).toBe('ok')
  })

  it('la ruta existe solo en el sitio de un negocio de Turnos', () => {
    expect(esDeTurnos('turnos')).toBe(true)
    expect(esDeTurnos('alquileres')).toBe(false)
    expect(esDeTurnos('Indumentaria')).toBe(false)
  })
})
