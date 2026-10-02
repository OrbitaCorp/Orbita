import { describe, expect, it } from 'vitest'
import {
  MENSAJE_MANTENIMIENTO_POR_DEFECTO,
  disponibilidadDeLaRespuesta,
  mantenimientoDeLaRespuesta,
  mantenimientoDelEvento,
} from './mantenimiento'

const AVISO = 'Orbi está en mantenimiento por un problema técnico. Ya avisamos al equipo. Mientras tanto, el Manual del panel sigue disponible.'

describe('mantenimientoDeLaRespuesta', () => {
  it('503 con ORBI_MAINTENANCE → el mensaje de la API', () => {
    expect(mantenimientoDeLaRespuesta(503, { error: 'ORBI_MAINTENANCE', statusCode: 503, message: AVISO })).toBe(AVISO)
  })

  it('sin mensaje usable → el texto por defecto', () => {
    expect(mantenimientoDeLaRespuesta(503, { error: 'ORBI_MAINTENANCE', message: '  ' })).toBe(MENSAJE_MANTENIMIENTO_POR_DEFECTO)
  })

  it('otros errores no son mantenimiento: la cuota (429), un 503 cualquiera, cuerpo vacío', () => {
    expect(mantenimientoDeLaRespuesta(429, { error: 'Too Many Requests', message: 'Llegaste al máximo' })).toBeNull()
    expect(mantenimientoDeLaRespuesta(503, { error: 'Service Unavailable', message: 'x' })).toBeNull()
    expect(mantenimientoDeLaRespuesta(503, null)).toBeNull()
    expect(mantenimientoDeLaRespuesta(200, { error: 'ORBI_MAINTENANCE' })).toBeNull()
  })
})

describe('mantenimientoDelEvento', () => {
  it('evento error con code ORBI_MAINTENANCE → el mensaje', () => {
    expect(mantenimientoDelEvento({ code: 'ORBI_MAINTENANCE', message: AVISO })).toBe(AVISO)
  })

  it('una falla pasajera no es mantenimiento', () => {
    expect(mantenimientoDelEvento({ code: 'ORBI_PROVIDER_DOWN', message: 'Probá de nuevo' })).toBeNull()
    expect(mantenimientoDelEvento({ message: 'Error procesando tu mensaje' })).toBeNull()
    expect(mantenimientoDelEvento(undefined)).toBeNull()
  })
})

describe('disponibilidadDeLaRespuesta', () => {
  it('disponible → sin aviso', () => {
    expect(disponibilidadDeLaRespuesta(true, { disponible: true })).toEqual({ mantenimiento: null })
  })

  it('no disponible → el aviso que manda la API', () => {
    expect(disponibilidadDeLaRespuesta(true, { disponible: false, mensaje: AVISO })).toEqual({ mantenimiento: AVISO })
    expect(disponibilidadDeLaRespuesta(true, { disponible: false })).toEqual({ mantenimiento: MENSAJE_MANTENIMIENTO_POR_DEFECTO })
  })

  it('no se sabe (API vieja con 404, error, cuerpo raro) → no se toca nada', () => {
    expect(disponibilidadDeLaRespuesta(false, { statusCode: 404 })).toBeUndefined()
    expect(disponibilidadDeLaRespuesta(true, null)).toBeUndefined()
    expect(disponibilidadDeLaRespuesta(true, { disponible: 'no' })).toBeUndefined()
  })
})
