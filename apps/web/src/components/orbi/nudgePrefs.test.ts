import { beforeEach, describe, expect, it } from 'vitest'
import { marcarPasoOfrecido, nudgesApagados, pasoYaOfrecido, puedeOfrecer, registrarNo } from './nudgePrefs'

// El entorno de vitest acá es 'node' (sin DOM), así que sessionStorage no
// existe: lo mockeamos con un Map.
class FakeStorage {
  private m = new Map<string, string>()
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
  clear() { this.m.clear() }
}

beforeEach(() => {
  ;(globalThis as any).sessionStorage = new FakeStorage()
})

describe('nudgePrefs', () => {
  it('arranca sin nada ofrecido ni apagado', () => {
    expect(nudgesApagados()).toBe(false)
    expect(pasoYaOfrecido('tu-negocio')).toBe(false)
    expect(puedeOfrecer('tu-negocio')).toBe(true)
  })

  it('un "No" marca ese paso como ya ofrecido pero no apaga el resto', () => {
    registrarNo('tu-negocio')
    expect(pasoYaOfrecido('tu-negocio')).toBe(true)
    expect(puedeOfrecer('tu-negocio')).toBe(false)
    expect(puedeOfrecer('ubicacion')).toBe(true)
    expect(nudgesApagados()).toBe(false)
  })

  it('dos "No" apagan TODAS las ofertas proactivas', () => {
    registrarNo('tu-negocio')
    registrarNo('ubicacion')
    expect(nudgesApagados()).toBe(true)
    expect(puedeOfrecer('cuenta')).toBe(false)
    expect(puedeOfrecer('subrubros')).toBe(false)
  })

  it('marcarPasoOfrecido sin "No" también evita re-ofrecer ese paso', () => {
    marcarPasoOfrecido('subrubros')
    expect(puedeOfrecer('subrubros')).toBe(false)
    expect(nudgesApagados()).toBe(false)
  })

  it('no rompe si sessionStorage tira (modo incógnito)', () => {
    ;(globalThis as any).sessionStorage = {
      getItem() { throw new Error('bloqueado') },
      setItem() { throw new Error('bloqueado') },
    }
    expect(() => registrarNo('tu-negocio')).not.toThrow()
    expect(nudgesApagados()).toBe(false)
    expect(puedeOfrecer('tu-negocio')).toBe(true)
  })
})
