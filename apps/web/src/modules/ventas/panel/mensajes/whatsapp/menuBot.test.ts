import { describe, expect, it } from 'vitest'
import type { OpcionDeMenu } from '@/lib/api'
import { errorDelMenu, menuCambio, moverOpcion, nuevaOpcionPropia, opcionesParaGuardar } from './menuBot'

const op = (id: string, titulo: string, extra: Partial<OpcionDeMenu> = {}): OpcionDeMenu => ({ id, titulo, activa: true, ...extra })
const DE_FABRICA = ['catalogo', 'pedidos', 'promos', 'envios', 'horarios', 'persona'].map((id) => op(id, id))

describe('errorDelMenu', () => {
  it('un menú bien armado no tiene error', () => {
    expect(errorDelMenu(DE_FABRICA, 'LISTA')).toBeNull()
  })
  it('con botones solo entran 3 opciones activas; apagando las que sobran, sí', () => {
    expect(errorDelMenu(DE_FABRICA, 'BOTONES')).toMatch(/hasta 3/)
    expect(errorDelMenu(DE_FABRICA.map((o, i) => ({ ...o, activa: i < 3 })), 'BOTONES')).toBeNull()
  })
  it('los títulos tienen un tope distinto en lista (24) y en botones (20)', () => {
    const largo = [op('catalogo', 'x'.repeat(22))]
    expect(errorDelMenu(largo, 'LISTA')).toBeNull()
    expect(errorDelMenu(largo, 'BOTONES')).toMatch(/20/)
    expect(errorDelMenu([op('catalogo', 'x'.repeat(25))], 'LISTA')).toMatch(/24/)
  })
  it('las opciones propias necesitan su respuesta, todas un título, y alguna tiene que estar activa', () => {
    expect(errorDelMenu([op('custom-1', 'Mayoristas')], 'LISTA')).toMatch(/necesita el texto/)
    expect(errorDelMenu([op('custom-1', 'Mayoristas', { respuesta: 'Escribinos' })], 'LISTA')).toBeNull()
    expect(errorDelMenu([op('catalogo', '   ')], 'LISTA')).toMatch(/título/)
    expect(errorDelMenu([op('catalogo', 'A', { activa: false })], 'LISTA')).toMatch(/al menos una/)
  })
  it('máximo 10 opciones y descripciones de hasta 72', () => {
    expect(errorDelMenu(Array.from({ length: 11 }, (_, i) => op(`custom-${i}`, 'x', { respuesta: 'r' })), 'LISTA')).toMatch(/hasta 10/)
    expect(errorDelMenu([op('catalogo', 'A', { descripcion: 'd'.repeat(73) })], 'LISTA')).toMatch(/72/)
  })
})

describe('edición del menú', () => {
  it('mover sube o baja una opción, y en los bordes no hace nada', () => {
    const r = moverOpcion(DE_FABRICA, 1, -1)
    expect(r.map((o) => o.id).slice(0, 2)).toEqual(['pedidos', 'catalogo'])
    expect(moverOpcion(DE_FABRICA, 0, -1)).toBe(DE_FABRICA)
    expect(moverOpcion(DE_FABRICA, DE_FABRICA.length - 1, 1)).toBe(DE_FABRICA)
    expect(DE_FABRICA[0].id).toBe('catalogo') // no muta el original
  })
  it('una opción propia nueva toma el primer id libre', () => {
    expect(nuevaOpcionPropia(DE_FABRICA).id).toBe('custom-1')
    expect(nuevaOpcionPropia([...DE_FABRICA, op('custom-1', 'a'), op('custom-3', 'b')]).id).toBe('custom-2')
  })
  it('para guardar se limpian los espacios y los campos vacíos; la respuesta solo va en las propias', () => {
    expect(opcionesParaGuardar([op('catalogo', ' Catálogo ', { descripcion: '  ', respuesta: 'no va' }), op('custom-1', 'Mayor', { descripcion: ' x ', respuesta: ' Hola ' })])).toEqual([
      { id: 'catalogo', titulo: 'Catálogo', activa: true },
      { id: 'custom-1', titulo: 'Mayor', activa: true, descripcion: 'x', respuesta: 'Hola' },
    ])
  })
  it('un cambio es un cambio de verdad, no un espacio de más', () => {
    expect(menuCambio(DE_FABRICA, DE_FABRICA.map((o) => ({ ...o, titulo: ` ${o.titulo} ` })))).toBe(false)
    expect(menuCambio(DE_FABRICA, moverOpcion(DE_FABRICA, 0, 1))).toBe(true)
  })
})
