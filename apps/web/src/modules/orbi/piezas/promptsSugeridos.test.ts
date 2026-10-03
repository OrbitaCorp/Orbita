import { describe, expect, it } from 'vitest'
import { promptsSugeridos } from './promptsSugeridos'
import { SECCIONES_DEL_PANEL } from '@/modules/ventas/panel/secciones'

describe('promptsSugeridos', () => {
  it('el dueño ve todas las de la pantalla', () => {
    expect(promptsSugeridos('pedidos', 'owner', [])).toEqual([
      '¿Qué pedidos tengo pendientes?',
      '¿Cuáles están pagados y sin enviar?',
      'Mostrame los pedidos de esta semana',
      '¿Cómo hago una devolución?',
    ])
  })

  it('a un empleado sin reportes no se le ofrece lo que no puede contestar', () => {
    const r = promptsSugeridos('dashboard', 'empleado', ['orders.view', 'catalog.view'])
    expect(r).not.toContain('¿Cómo vengo este mes comparado con el anterior?')
    expect(r).toContain('¿Qué pedidos tengo sin enviar?')
  })

  it('si quedan menos de 4, se completa con preguntas del manual; nunca más de 6', () => {
    const r = promptsSugeridos('clientes', 'empleado', [])
    expect(r.length).toBeGreaterThanOrEqual(2)
    expect(r).toContain('¿Cómo cargo un producto con variantes?')
    for (const pantalla of SECCIONES_DEL_PANEL) {
      expect(promptsSugeridos(pantalla, 'owner', []).length).toBeLessThanOrEqual(6)
    }
  })

  it('una pantalla sin frases propias, o sin pantalla, ofrece las del manual', () => {
    expect(promptsSugeridos('perfil', 'owner', [])).toEqual(['¿Cómo cargo un producto con variantes?', '¿Dónde configuro los envíos?'])
    expect(promptsSugeridos(undefined, undefined, undefined)).toHaveLength(2)
  })

  it('cada pantalla con frases es una sección real del panel', () => {
    const conFrases = ['dashboard', 'pedidos', 'catalogo', 'categorias', 'clientes', 'reportes', 'descuentos', 'cupones', 'configuracion', 'mensajes']
    for (const p of conFrases) expect(SECCIONES_DEL_PANEL).toContain(p)
  })
})
