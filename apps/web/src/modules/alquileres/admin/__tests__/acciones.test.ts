import { describe, expect, it, vi } from 'vitest'
import { avisoDeCalendario, ejecutar } from '../acciones'
import { HechoConAviso } from '../../datos/origen/aviso'
import type { CalendarioExterno } from '../../datos'

describe('ejecutar: una escritura del panel y cómo se avisa', () => {
  it('si sale bien, avisa lo hecho y devuelve true', async () => {
    const avisar = vi.fn()
    await expect(ejecutar(async () => undefined, avisar, { real: true, texto: 'Calendario conectado', detalle: 'Ya se bajaron las noches.' })).resolves.toBe(true)
    expect(avisar.mock.calls).toEqual([['Guardando…'], ['Calendario conectado', 'Ya se bajaron las noches.']])
  })

  it('en la demo no dice "Guardando…": la escritura es al instante', async () => {
    const avisar = vi.fn()
    await ejecutar(() => undefined, avisar, { real: false, texto: 'Bloqueo quitado' })
    expect(avisar.mock.calls).toEqual([['Bloqueo quitado', undefined]])
  })

  it('si la API lo rechaza, el aviso es de error (no un tilde verde) con su motivo, y devuelve false', async () => {
    const avisar = vi.fn()
    const ok = await ejecutar(async () => { throw new Error('Pegá el enlace de Airbnb que termina en .ics') }, avisar, { real: true, texto: 'Calendario conectado' })
    expect(ok).toBe(false)
    expect(avisar).toHaveBeenLastCalledWith('No se pudo guardar', 'Pegá el enlace de Airbnb que termina en .ics', 'error')
  })

  it('un error sin mensaje dice qué hacer', async () => {
    const avisar = vi.fn()
    await ejecutar(async () => { throw new Error('') }, avisar, { real: true })
    expect(avisar).toHaveBeenLastCalledWith('No se pudo guardar', 'Probá de nuevo.', 'error')
  })

  it('lo que se hizo pero con una salvedad se avisa como error con su propio título, y cuenta como hecho', async () => {
    const avisar = vi.fn()
    const ok = await ejecutar(async () => { throw new HechoConAviso('No se pudo bajar el calendario', 'Airbnb respondió 404.') }, avisar, { real: true, texto: 'Calendario sincronizado' })
    expect(ok).toBe(true)
    expect(avisar).toHaveBeenLastCalledWith('No se pudo bajar el calendario', 'Airbnb respondió 404.', 'error')
    expect(avisar).not.toHaveBeenCalledWith('Calendario sincronizado', undefined)
  })
})

describe('avisoDeCalendario: lo que dice la campanita de un calendario conectado', () => {
  const cal = (c: Partial<CalendarioExterno> = {}): CalendarioExterno => ({ id: 'cal-1', unidadId: 'p1', nombre: 'Airbnb', url: 'u', ultimaSync: '2026-11-25', ...c })

  it('uno que se bajó bien dice "sincronizado" y cuántas fechas bloquea', () => {
    expect(avisoDeCalendario(cal(), { fechas: 2, propiedad: 'Cabaña del Monte', cuando: 'hace 12 min' }))
      .toEqual({ titulo: 'Airbnb: sincronizado', detalle: '2 fechas bloqueadas en Cabaña del Monte', cuando: 'hace 12 min' })
  })

  it('uno que falló no dice "sincronizado": dice que no se pudo, por qué, y va en tono de aviso', () => {
    expect(avisoDeCalendario(cal({ error: 'Airbnb respondió 404.' }), { fechas: 2, propiedad: 'Cabaña del Monte', cuando: 'recién' }))
      .toEqual({ tono: 'aviso', titulo: 'Airbnb: no se pudo sincronizar', detalle: 'Cabaña del Monte · Airbnb respondió 404.', cuando: 'recién' })
  })
})
