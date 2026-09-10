import { describe, it, expect } from 'vitest'
import { deriveStepChips, ORBI_STEP_LABELS } from './orbiWizardSteps'

describe('ORBI_STEP_LABELS', () => {
  it('tiene un label por cada stepName real del onboarding', () => {
    for (const s of ['elegir-rubro', 'subrubros', 'tu-negocio', 'ubicacion', 'cuenta']) {
      expect(ORBI_STEP_LABELS[s]).toBeTruthy()
    }
  })
})

describe('deriveStepChips', () => {
  it('elegir-rubro: chips tipo prompt, sin estado filled', () => {
    const { chips, quickChips } = deriveStepChips('elegir-rubro', {})
    expect(chips.length).toBeGreaterThan(0)
    expect(chips.every(c => c.kind === 'prompt')).toBe(true)
    expect(chips.every(c => c.filled === undefined)).toBe(true)
    expect(quickChips.length).toBeGreaterThan(0)
  })

  it('tu-negocio: chips de campo con filled segun el form', () => {
    const { chips } = deriveStepChips('tu-negocio', { nombre: 'Aromas del Valle', descripcion: '', subdominio: '' })
    const byKey = Object.fromEntries(chips.map(c => [c.key, c]))
    expect(byKey.nombre.kind).toBe('field')
    expect(byKey.nombre.filled).toBe(true)
    expect(byKey.descripcion.filled).toBe(false)
    expect(byKey.subdominio.filled).toBe(false)
  })

  it('tu-negocio: incluye "modoVenta" solo si conModoVenta', () => {
    const sin = deriveStepChips('tu-negocio', {}, { conModoVenta: false })
    const con = deriveStepChips('tu-negocio', {}, { conModoVenta: true })
    expect(sin.chips.some(c => c.key === 'modoVenta')).toBe(false)
    expect(con.chips.some(c => c.key === 'modoVenta')).toBe(true)
    expect(con.chips.find(c => c.key === 'modoVenta')!.filled).toBe(false)
  })

  it('tu-negocio: modoVenta filled cuando el form lo tiene', () => {
    const { chips } = deriveStepChips('tu-negocio', { modoVenta: 'ecommerce' }, { conModoVenta: true })
    expect(chips.find(c => c.key === 'modoVenta')!.filled).toBe(true)
  })

  it('ubicacion y subrubros y cuenta: prompts, no fields', () => {
    for (const s of ['ubicacion', 'subrubros', 'cuenta']) {
      const { chips } = deriveStepChips(s, {})
      expect(chips.every(c => c.kind === 'prompt')).toBe(true)
    }
  })

  it('stepName desconocido: listas vacías, no tira', () => {
    const { chips, quickChips } = deriveStepChips('inexistente', {})
    expect(chips).toEqual([])
    expect(quickChips).toEqual([])
  })

  it('cada chip trae un mensaje "send" no vacío', () => {
    for (const s of ['elegir-rubro', 'subrubros', 'tu-negocio', 'ubicacion', 'cuenta']) {
      const { chips } = deriveStepChips(s, {}, { conModoVenta: true })
      expect(chips.every(c => c.send.trim().length > 0)).toBe(true)
    }
  })
})
