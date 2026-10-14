// Respuestas prearmadas de Orbi en la demo (lib/demo/orbiPresets.ts).
import { describe, expect, it } from 'vitest'
import {
  PRESETS_DEMO,
  actionIdDemo,
  esAccionDemo,
  presetDeAccion,
  tramosDeRespuesta,
} from '../orbiPresets'

describe('PRESETS_DEMO', () => {
  it('tiene preguntas con id único y respuesta no vacía', () => {
    const ids = PRESETS_DEMO.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const p of PRESETS_DEMO) {
      expect(p.pregunta.trim()).not.toBe('')
      expect(p.respuesta.trim()).not.toBe('')
      expect(p.tool).not.toBe('')
    }
  })

  it('hay al menos dos preguntas de cupón, con tarjeta de acción', () => {
    const conAccion = PRESETS_DEMO.filter(p => p.accion)
    expect(conAccion.length).toBeGreaterThanOrEqual(2)
    for (const p of conAccion) {
      expect(p.accion!.tool).toBe('createCoupon')
      // La tarjeta muestra el resumen tal cual: sin markdown.
      expect(p.accion!.resumen).not.toContain('**')
      // Confirmar nunca promete haber guardado algo.
      expect(p.accion!.alConfirmar).toMatch(/demo no se guarda nada/i)
    }
  })

  it('la consulta previa de cada pregunta es una herramienta de lectura', () => {
    // Las de cupón consultan descuentos antes de proponer: la tarjeta es aparte.
    for (const p of PRESETS_DEMO) expect(p.tool).not.toMatch(/^(create|update)/)
  })

  it('las negritas de cada respuesta vienen en pares', () => {
    for (const p of PRESETS_DEMO) {
      expect((p.respuesta.match(/\*\*/g) ?? []).length % 2).toBe(0)
    }
  })
})

describe('tramosDeRespuesta', () => {
  it('al unir los tramos vuelve el texto exacto, con sus saltos de línea', () => {
    for (const p of PRESETS_DEMO) {
      expect(tramosDeRespuesta(p.respuesta).join('')).toBe(p.respuesta)
    }
  })

  it('escribe de a pocas palabras, no todo de golpe', () => {
    const tramos = tramosDeRespuesta('uno dos tres cuatro cinco')
    expect(tramos).toEqual(['uno dos', ' tres cuatro', ' cinco'])
  })

  it('texto vacío: sin tramos', () => {
    expect(tramosDeRespuesta('')).toEqual([])
  })
})

describe('acciones de la demo', () => {
  it('el actionId lleva el prefijo y se vuelve al preset', () => {
    const cupon = PRESETS_DEMO.find(p => p.accion)!
    const id = actionIdDemo(cupon.id)
    expect(esAccionDemo(id)).toBe(true)
    expect(presetDeAccion(id)).toBe(cupon)
  })

  it('un actionId real del servidor no es de la demo', () => {
    expect(esAccionDemo('3f9c1a52-8c1e-4a8a-9d55-1d6f3f7a2b10')).toBe(false)
    expect(presetDeAccion('3f9c1a52-8c1e-4a8a-9d55-1d6f3f7a2b10')).toBeUndefined()
    expect(presetDeAccion(undefined)).toBeUndefined()
    expect(presetDeAccion('demo:no-existe')).toBeUndefined()
  })
})
