import { describe, expect, it } from 'vitest'
import { fmtFalta, fmtFechaHora, instanteALocal, localAInstante } from '../utils'

// Helpers de fecha y hora exactas de la oferta relámpago. El punto delicado
// es la zona horaria: el formulario trabaja en hora local y la API en UTC, y
// un descuido acá corre la oferta tres horas en Argentina.

describe('instanteALocal / localAInstante', () => {
  it('ida y vuelta: lo que el dueño carga es lo que vuelve a ver', () => {
    const iso = localAInstante('2026-09-12', '23:59')
    expect(iso).not.toBeNull()
    expect(instanteALocal(iso!)).toEqual({ fecha: '2026-09-12', hora: '23:59' })
  })

  it('el instante generado es el de la hora LOCAL, no UTC', () => {
    const iso = localAInstante('2026-09-12', '20:00')!
    const d = new Date(iso)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(8)
    expect(d.getDate()).toBe(12)
    expect(d.getHours()).toBe(20)
    expect(d.getMinutes()).toBe(0)
  })

  it('sin fecha o sin hora no hay instante', () => {
    expect(localAInstante('', '20:00')).toBeNull()
    expect(localAInstante('2026-09-12', '')).toBeNull()
    expect(localAInstante('no-es-fecha', '20:00')).toBeNull()
  })

  it('un ISO inválido da campos vacíos en vez de tirar', () => {
    expect(instanteALocal('basura')).toEqual({ fecha: '', hora: '' })
  })
})

describe('fmtFechaHora', () => {
  it('muestra DD/MM/AAAA HH:mm en hora local', () => {
    const iso = localAInstante('2026-09-12', '09:05')!
    expect(fmtFechaHora(iso)).toBe('12/09/2026 09:05')
  })
})

describe('fmtFalta', () => {
  const ahora = Date.UTC(2026, 8, 8, 12, 0)
  const min = 60_000
  it('días y horas cuando falta más de un día', () => {
    expect(fmtFalta(ahora + 2 * 24 * 60 * min + 4 * 60 * min + 30 * min, ahora)).toBe('2d 4h')
  })
  it('horas y minutos cuando falta menos de un día', () => {
    expect(fmtFalta(ahora + 4 * 60 * min + 12 * min, ahora)).toBe('4h 12m')
  })
  it('solo minutos en la última hora', () => {
    expect(fmtFalta(ahora + 12 * min, ahora)).toBe('12m')
    expect(fmtFalta(ahora + 30_000, ahora)).toBe('menos de 1m')
  })
  it('vacío si ya pasó', () => {
    expect(fmtFalta(ahora, ahora)).toBe('')
    expect(fmtFalta(ahora - min, ahora)).toBe('')
  })
})
