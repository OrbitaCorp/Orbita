import { describe, expect, it } from 'vitest'
import { agruparSesiones, diasArgentinos, grupoDe } from './agrupar'
import type { ResumenDeSesion } from '../api/sesiones'

// 2026-10-02 12:00 en Argentina (UTC-3).
const AHORA = new Date('2026-10-02T15:00:00Z')

const sesion = (id: string, ultimaActividad: string, over: Partial<ResumenDeSesion> = {}): ResumenDeSesion => ({
  id, titulo: id, fijada: false, archivada: false, ultimaActividad, pantalla: null, esperandoAprobacion: false, ...over,
})

describe('grupoDe', () => {
  it('cuenta días de Argentina, no de UTC', () => {
    // 01:30 UTC del 2/10 = 22:30 del 1/10 en Buenos Aires: es de ayer.
    expect(grupoDe('2026-10-02T01:30:00Z', AHORA)).toBe('Ayer')
    expect(grupoDe('2026-10-02T03:30:00Z', AHORA)).toBe('Hoy')
  })

  it('hoy, ayer, esta semana (hasta 6 días) y antes', () => {
    expect(grupoDe('2026-10-02T14:00:00Z', AHORA)).toBe('Hoy')
    expect(grupoDe('2026-10-01T14:00:00Z', AHORA)).toBe('Ayer')
    expect(grupoDe('2026-09-26T14:00:00Z', AHORA)).toBe('Esta semana')
    expect(grupoDe('2026-09-25T14:00:00Z', AHORA)).toBe('Antes')
  })

  it('una fecha del futuro (reloj corrido) cae en Hoy', () => {
    expect(grupoDe('2026-10-03T14:00:00Z', AHORA)).toBe('Hoy')
    expect(diasArgentinos(new Date('2026-10-03T14:00:00Z'), AHORA)).toBe(-1)
  })
})

describe('agruparSesiones', () => {
  it('fijadas arriba, después por fecha, sin grupos vacíos y sin repetir una fijada', () => {
    const fijada = sesion('f', '2026-09-01T12:00:00Z', { fijada: true })
    const r = agruparSesiones([fijada], [
      sesion('hoy', '2026-10-02T14:00:00Z'),
      sesion('f', '2026-09-01T12:00:00Z', { fijada: true }),
      sesion('vieja', '2026-08-01T12:00:00Z'),
    ], AHORA)
    expect(r.map(g => [g.grupo, g.sesiones.map(s => s.id)])).toEqual([
      ['Fijadas', ['f']],
      ['Hoy', ['hoy']],
      ['Antes', ['vieja']],
    ])
  })

  it('sin sesiones, sin grupos', () => {
    expect(agruparSesiones([], [], AHORA)).toEqual([])
  })
})

describe('horaCorta', () => {
  it('hoy la hora, ayer "ayer", esta semana el día y antes la fecha (hora argentina)', async () => {
    const { horaCorta } = await import('./agrupar')
    expect(horaCorta('2026-10-02T17:28:00Z', AHORA)).toBe('14:28')
    expect(horaCorta('2026-10-01T17:28:00Z', AHORA)).toBe('ayer')
    expect(horaCorta('2026-09-29T17:28:00Z', AHORA)).toBe('mar')
    expect(horaCorta('2026-09-12T17:28:00Z', AHORA)).toBe('12/9')
  })
})
