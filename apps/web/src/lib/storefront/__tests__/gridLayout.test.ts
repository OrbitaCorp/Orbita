import { describe, expect, it } from 'vitest'
import { columnasDeGrilla, itemsPorFilaGrilla, esGrillaDeLista } from '../utils'
import { OPCIONES_MAX_NUEVOS, AP_DEFAULTS } from '@/modules/ventas/panel/configuracion/mock/apariencia.mock'
import { apToUpdateDto, dtoToAp } from '@/modules/ventas/panel/configuracion/mock/apariencia.mapper'
import type { ApiAppearanceConfig } from '@/lib/api'

describe('Grilla de productos — paridad entre CSS y cantidad de items por fila', () => {
  it('para 4col devuelve 4 columnas y 4 productos por fila', () => {
    expect(columnasDeGrilla('4col')).toBe('repeat(4, 1fr)')
    expect(itemsPorFilaGrilla('4col')).toBe(4)
  })

  it('para 3col devuelve 3 columnas y 3 productos por fila', () => {
    expect(columnasDeGrilla('3col')).toBe('repeat(3, 1fr)')
    expect(itemsPorFilaGrilla('3col')).toBe(3)
  })

  it('para null o undefined (default) devuelve 3 columnas y 3 productos por fila (evita 4 productos en 2 filas)', () => {
    expect(columnasDeGrilla(null)).toBe('repeat(3, 1fr)')
    expect(itemsPorFilaGrilla(null)).toBe(3)
    expect(columnasDeGrilla(undefined)).toBe('repeat(3, 1fr)')
    expect(itemsPorFilaGrilla(undefined)).toBe(3)
  })

  it('reconoce modo lista correctamente', () => {
    expect(esGrillaDeLista('list')).toBe(true)
    expect(esGrillaDeLista('3col')).toBe(false)
    expect(esGrillaDeLista('4col')).toBe(false)
    expect(esGrillaDeLista(null)).toBe(false)
  })
})

describe('Opciones de Nuevos ingresos según diseño de grilla', () => {
  it('en 3 columnas ofrece múltiplos exactos de 3 (sin dejar huérfanos)', () => {
    const opts = OPCIONES_MAX_NUEVOS['3col']
    expect(opts.map(o => o.valor)).toEqual([3, 6, 9, 12])
    opts.forEach(o => expect(o.valor % 3).toBe(0))
  })

  it('en 4 columnas ofrece múltiplos exactos de 4 (sin dejar huérfanos)', () => {
    const opts = OPCIONES_MAX_NUEVOS['4col']
    expect(opts.map(o => o.valor)).toEqual([4, 8, 12, 16])
    opts.forEach(o => expect(o.valor % 4).toBe(0))
  })

  it('en modo lista ofrece opciones progresivas', () => {
    const opts = OPCIONES_MAX_NUEVOS['list']
    expect(opts.map(o => o.valor)).toEqual([3, 4, 6, 8, 12])
  })
})

describe('Mapeo de maxNuevosIngresos en mapper', () => {
  it('apToUpdateDto serializa maxNuevosIngresos dentro de homeTemplateData', () => {
    const ap = { ...AP_DEFAULTS, maxNuevosIngresos: 6 }
    const dto = apToUpdateDto(ap)
    expect(dto.homeTemplateData?.maxNuevosIngresos).toBe(6)
  })

  it('dtoToAp extrae maxNuevosIngresos de homeTemplateData', () => {
    const apiDto = {
      homeTemplateData: {
        maxNuevosIngresos: 9,
      },
    } as unknown as ApiAppearanceConfig

    const ap = dtoToAp(apiDto, AP_DEFAULTS)
    expect(ap.maxNuevosIngresos).toBe(9)
  })

  it('dtoToAp mantiene null si no viene configurado', () => {
    const apiDto = {
      homeTemplateData: null,
    } as unknown as ApiAppearanceConfig

    const ap = dtoToAp(apiDto, AP_DEFAULTS)
    expect(ap.maxNuevosIngresos).toBeNull()
  })
})
