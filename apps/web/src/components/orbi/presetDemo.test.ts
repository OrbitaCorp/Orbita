import { describe, expect, it } from 'vitest'
import { reproducirPreset, type OpsDelChat } from './presetDemo'
import { PRESETS_DEMO } from '@/lib/demo/orbiPresets'
import type { OrbiAction } from './types'

// Un chat de mentira: junta lo que se escribe y las acciones, sin esperar de verdad.
function chat(vigentes = Infinity) {
  let texto = ''
  let consultas = 0
  const acciones: OrbiAction[] = []
  const esperas: number[] = []
  const ops: OpsDelChat = {
    appendToLastAssistant: t => { texto += t },
    addActionToLastAssistant: a => { acciones.push({ ...a }) },
    updateAction: (id, cambios) => {
      const a = acciones.find(x => x.id === id)
      if (a) Object.assign(a, cambios)
    },
    esperar: async ms => { esperas.push(ms) },
    // Cada llamada a vigente() consume una "vida": al agotarse, simula un corte.
    vigente: () => consultas++ < vigentes,
  }
  return { ops, acciones, esperas, texto: () => texto }
}

describe('reproducirPreset', () => {
  const sinAccion = PRESETS_DEMO.find(p => !p.accion)!
  const conAccion = PRESETS_DEMO.find(p => p.accion)!

  it('piensa con una herramienta, escribe la respuesta completa y termina', async () => {
    const c = chat()
    expect(await reproducirPreset(sinAccion, c.ops)).toBe(true)
    expect(c.texto()).toBe(sinAccion.respuesta)
    // La consulta del "pensando" quedó completa y no hay tarjeta.
    expect(c.acciones).toHaveLength(1)
    expect(c.acciones[0]).toMatchObject({ tool: sinAccion.tool, status: 'complete' })
    expect(c.acciones[0].actionId).toBeUndefined()
    // Antes de escribir hay una pausa larga ("pensando").
    expect(c.esperas[0]).toBeGreaterThan(500)
  })

  it('una pregunta de cupón termina en una tarjeta pendiente que no viaja a la API', async () => {
    const c = chat()
    await reproducirPreset(conAccion, c.ops)
    const tarjeta = c.acciones.find(a => a.actionId)!
    expect(tarjeta.status).toBe('pending')
    expect(tarjeta.actionId).toMatch(/^demo:/)
    expect(tarjeta.resumen).toBe(conAccion.accion!.resumen)
  })

  it('si lo cortan mientras piensa, no escribe nada ni deja tarjeta', async () => {
    const c = chat(0) // lo cortan antes de que termine de pensar
    expect(await reproducirPreset(conAccion, c.ops)).toBe(false)
    expect(c.texto()).toBe('')
    expect(c.acciones.find(a => a.actionId)).toBeUndefined()
  })

  it('si lo cortan a mitad de la respuesta, queda lo escrito y sin tarjeta', async () => {
    const c = chat(4)
    expect(await reproducirPreset(conAccion, c.ops)).toBe(false)
    expect(c.texto().length).toBeGreaterThan(0)
    expect(c.texto().length).toBeLessThan(conAccion.respuesta.length)
    expect(c.acciones.find(a => a.actionId)).toBeUndefined()
  })
})
