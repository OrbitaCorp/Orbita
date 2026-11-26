// "Mi turno": los textos de la página del enlace personal y su guarda (26/11).
import { describe, expect, it } from 'vitest'
import { ESTADO_TXT, senaAlCancelarTxt } from '../MiTurno'
import { RUBROS_DE_TURNOS, destinoDelPanel, esDeTurnos, rubroDeTurnos } from '@/lib/reservas/destinoPanel'
import { RUBROS_TURNOS } from '@/modules/turnos/datos'

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
    expect(esDeTurnos('turnos', ['barberia'])).toBe(true)
    expect(esDeTurnos('alquileres', ['barberia'])).toBe(false)
    expect(esDeTurnos('Indumentaria', [])).toBe(false)
  })
})

describe('qué negocio es de Turnos', () => {
  it('el de rubro principal "turnos" con su rubro de Turnos en subrubros, como lo deja el alta', () => {
    expect(rubroDeTurnos('turnos', ['psico'])).toBe('psico')
    // "turnos" escrito a mano como rubro de una tienda no la vuelve de Turnos.
    expect(esDeTurnos('turnos', ['indumentaria'])).toBe(false)
    expect(esDeTurnos('turnos', undefined)).toBe(false)
    expect(rubroDeTurnos('tienda', ['barberia'])).toBeNull()
  })

  it('/panel lo lleva a su panel, con la query entera', () => {
    expect(destinoDelPanel('turnos', '?vista=agenda', ['barberia'])).toBe('/panel/turnos?vista=agenda')
    expect(destinoDelPanel('turnos', '', ['indumentaria'])).toBe('/admin/ventas/dashboard')
  })

  it('la lista copiada en destinoPanel es la de los rubros de Turnos', () => {
    expect([...RUBROS_DE_TURNOS].sort()).toEqual(RUBROS_TURNOS.map(r => r.key).sort())
  })
})
