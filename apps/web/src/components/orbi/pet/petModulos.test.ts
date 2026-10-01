import { describe, expect, it } from 'vitest'
import { moduloDeSeccion } from '@/layouts/components/moduloActivo'
import { PET_BASE, PET_GESTOS, PET_MODULOS, petModulo } from './petModulos'
import { esRutaPanel } from './useModuloPet'

describe('moduloDeSeccion', () => {
  it('lleva cada sección al módulo del menú', () => {
    expect(moduloDeSeccion('pedidos')).toBe('pedidos')
    expect(moduloDeSeccion('catalogo')).toBe('productos')
    expect(moduloDeSeccion('categorias')).toBe('productos')
    expect(moduloDeSeccion('inventario')).toBe('productos')
    expect(moduloDeSeccion('cupones')).toBe('descuentos')
    expect(moduloDeSeccion('configuracion')).toBe('config')
  })

  it('reportes depende de la vista', () => {
    expect(moduloDeSeccion('reportes', 'clientes')).toBe('clientes')
    expect(moduloDeSeccion('reportes', 'productos')).toBe('productos')
    expect(moduloDeSeccion('reportes')).toBe('productos')
  })

  it('una sección desconocida cae en Inicio', () => {
    expect(moduloDeSeccion('no-existe')).toBe('dashboard')
  })
})

describe('petModulo', () => {
  it('hay una forma por cada módulo del menú', () => {
    const ids = ['dashboard', 'pedidos', 'clientes', 'productos', 'mensajes', 'descuentos', 'config', 'avanzado', 'manual']
    expect(PET_MODULOS.map(m => m.id)).toEqual(ids)
    for (const id of ids) expect(petModulo(id).id).toBe(id)
  })

  it('sin módulo, o con uno desconocido, usa la forma base de Inicio', () => {
    expect(PET_BASE.id).toBe('dashboard')
    expect(petModulo(undefined)).toBe(PET_BASE)
    expect(petModulo('ventas')).toBe(PET_BASE)
  })

  it('todo gesto usado tiene sus keyframes', () => {
    for (const m of PET_MODULOS) expect(PET_GESTOS[m.gesto].length).toBeGreaterThan(1)
  })
})

describe('esRutaPanel', () => {
  it('reconoce el panel de administración', () => {
    expect(esRutaPanel('/admin')).toBe(true)
    expect(esRutaPanel('/admin/[...slug]')).toBe(true)
  })

  it('el onboarding y el resto no son el panel', () => {
    expect(esRutaPanel('/onboarding/tienda')).toBe(false)
    expect(esRutaPanel('/administracion')).toBe(false)
    expect(esRutaPanel('/')).toBe(false)
  })
})
