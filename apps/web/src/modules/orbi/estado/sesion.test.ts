import { describe, expect, it } from 'vitest'
import { mensajesDeLaSesion } from './sesion'
import { vistaDeTarjeta } from './actividad'

describe('mensajesDeLaSesion', () => {
  it('una v1: texto por mensaje, con su hora', () => {
    expect(mensajesDeLaSesion([
      { id: 'v1-0', rol: 'user', partes: [{ tipo: 'texto', texto: 'hola' }], creadoEl: '2026-10-02T14:00:00Z' },
      { id: 'v1-1', rol: 'assistant', partes: [{ tipo: 'texto', texto: 'Hola' }], creadoEl: null },
    ])).toEqual([
      { id: 'sesion-v1-0', role: 'user', content: 'hola', timestamp: Date.parse('2026-10-02T14:00:00Z') },
      { id: 'sesion-v1-1', role: 'assistant', content: 'Hola', timestamp: 1 },
    ])
  })

  it('las tarjetas vuelven con su estado de hoy; una vencida se ve vencida', () => {
    const [m] = mensajesDeLaSesion([{
      id: 'm2', rol: 'assistant', creadoEl: '2026-10-02T14:00:00Z',
      partes: [
        { tipo: 'aprobacion', actionId: 'a1', tool: 'createCoupon', resumen: 'Crear el cupón', estadoActual: 'aplicada' },
        { tipo: 'aprobacion', actionId: 'a2', tool: 'createCoupon', resumen: 'Crear otro', estadoActual: 'vencida' },
        { tipo: 'texto', texto: 'Listo.' },
      ],
    }])
    expect(m.content).toBe('Listo.')
    expect(m.actions!.map(a => a.status)).toEqual(['complete', 'pending'])
    expect(vistaDeTarjeta(m.actions![1], Date.parse('2026-10-02T14:01:00Z')).chip).toBe('Venció')
  })
})
