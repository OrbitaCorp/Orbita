// conFundidoDeTema: el cambio de tema adentro de una View Transition, con la dirección en
// <html data-tema-fundido> mientras dura, y al instante donde la API no existe. Vitest corre en
// node: el documento es un doble mínimo (documentElement.dataset y startViewTransition).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { conFundidoDeTema } from '../useDarkMode'

interface Transicion { correr: () => void; terminar: () => void; fallar: () => void }

function documentoFalso(conApi: boolean) {
  const dataset: Record<string, string> = {}
  const transiciones: Transicion[] = []
  const startViewTransition = vi.fn((cb: () => void) => {
    let terminar!: () => void, fallar!: (e: unknown) => void
    const finished = new Promise<void>((res, rej) => { terminar = res; fallar = rej })
    transiciones.push({ correr: cb, terminar, fallar: () => fallar(new Error('skipped')) })
    return { finished }
  })
  vi.stubGlobal('document', { documentElement: { dataset }, startViewTransition: conApi ? startViewTransition : undefined })
  return { dataset, transiciones, startViewTransition }
}

const microtareas = () => new Promise<void>((r) => setTimeout(r, 0))

afterEach(() => vi.unstubAllGlobals())

describe('conFundidoDeTema', () => {
  it('sin la API cambia al instante y no deja rastro en <html>', () => {
    const { dataset } = documentoFalso(false)
    const cambiar = vi.fn()
    conFundidoDeTema(true, cambiar)
    expect(cambiar).toHaveBeenCalledTimes(1)
    expect(dataset).toEqual({})
  })

  it('con la API marca la dirección, cambia adentro de la transición y limpia al terminar', async () => {
    const { dataset, transiciones, startViewTransition } = documentoFalso(true)
    const cambiar = vi.fn()
    conFundidoDeTema(true, cambiar)
    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(dataset.temaFundido).toBe('anochece')
    expect(cambiar).not.toHaveBeenCalled()
    transiciones[0].correr()
    expect(cambiar).toHaveBeenCalledTimes(1)
    expect(dataset.temaFundido).toBe('anochece')
    transiciones[0].terminar()
    await microtareas()
    expect(dataset).toEqual({})
  })

  it('hacia el claro amanece', () => {
    const { dataset } = documentoFalso(true)
    conFundidoDeTema(false, () => {})
    expect(dataset.temaFundido).toBe('amanece')
  })

  it('una transición salteada (finished rechaza) también limpia, sin rechazo suelto', async () => {
    const { dataset, transiciones } = documentoFalso(true)
    conFundidoDeTema(true, () => {})
    transiciones[0].fallar()
    await microtareas()
    expect(dataset).toEqual({})
  })

  it('dos toques seguidos: el primero no borra la dirección del segundo', async () => {
    const { dataset, transiciones } = documentoFalso(true)
    conFundidoDeTema(true, () => {})
    conFundidoDeTema(false, () => {})
    expect(dataset.temaFundido).toBe('amanece')
    transiciones[0].terminar()
    await microtareas()
    expect(dataset.temaFundido).toBe('amanece')
    transiciones[1].terminar()
    await microtareas()
    expect(dataset).toEqual({})
  })
})
