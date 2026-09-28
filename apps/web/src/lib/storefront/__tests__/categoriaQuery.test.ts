import { describe, expect, it } from 'vitest'
import { resolverIdsDeCategorias } from '../utils'

describe('resolverIdsDeCategorias', () => {
  const categoriasMock = [
    { id: 'cat-1', name: 'Camisas street', slug: 'camisas-street' },
    { id: 'cat-2', name: 'Chombas street', slug: 'chombas-street' },
    { id: 'cat-3', name: 'Remeras', slug: 'remeras' },
    { id: 'cat-4', name: 'Pantalones & Jeans', slug: 'pantalones-jeans' },
  ]

  it('retorna array vacío si el query es vacío, null o undefined', () => {
    expect(resolverIdsDeCategorias('', categoriasMock)).toEqual([])
    expect(resolverIdsDeCategorias(null, categoriasMock)).toEqual([])
    expect(resolverIdsDeCategorias(undefined, categoriasMock)).toEqual([])
    expect(resolverIdsDeCategorias([], categoriasMock)).toEqual([])
  })

  it('resuelve por slug exacto', () => {
    expect(resolverIdsDeCategorias('camisas-street', categoriasMock)).toEqual(['cat-1'])
    expect(resolverIdsDeCategorias('remeras', categoriasMock)).toEqual(['cat-3'])
  })

  it('resuelve por nombre con espacios (caso del diseño índice)', () => {
    expect(resolverIdsDeCategorias('Camisas street', categoriasMock)).toEqual(['cat-1'])
    expect(resolverIdsDeCategorias('camisas street', categoriasMock)).toEqual(['cat-1'])
    expect(resolverIdsDeCategorias('Chombas street', categoriasMock)).toEqual(['cat-2'])
  })

  it('resuelve por nombre codificado con %20 (URL directa)', () => {
    expect(resolverIdsDeCategorias('Camisas%20street', categoriasMock)).toEqual(['cat-1'])
    expect(resolverIdsDeCategorias('Chombas%20street', categoriasMock)).toEqual(['cat-2'])
  })

  it('resuelve por ID directo', () => {
    expect(resolverIdsDeCategorias('cat-1', categoriasMock)).toEqual(['cat-1'])
    expect(resolverIdsDeCategorias('cat-3', categoriasMock)).toEqual(['cat-3'])
  })

  it('resuelve múltiples categorías separadas por coma', () => {
    expect(resolverIdsDeCategorias('camisas-street,remeras', categoriasMock)).toEqual(['cat-1', 'cat-3'])
    expect(resolverIdsDeCategorias('Camisas street, Remeras', categoriasMock)).toEqual(['cat-1', 'cat-3'])
  })

  it('ignora categorías que no existen', () => {
    expect(resolverIdsDeCategorias('categoria-inexistente', categoriasMock)).toEqual([])
    expect(resolverIdsDeCategorias('camisas-street,inexistente', categoriasMock)).toEqual(['cat-1'])
  })
})

describe('filtro de categorías con productos publicados', () => {
  const todasLasCategorias = [
    { id: 'c1', name: 'Zapatos', slug: 'zapatos', productCount: 5, parentId: null },
    { id: 'c2', name: 'Mochilas', slug: 'mochilas', productCount: 0, parentId: null },
    { id: 'c3', name: 'Gorras', slug: 'gorras', productCount: 1, parentId: null },
    { id: 'c4', name: 'Accesorios vacíos', slug: 'acc-vacios', productCount: 0, parentId: null },
  ]

  it('excluye categorías con 0 productos publicados', () => {
    const visibles = todasLasCategorias.filter(c => (c.productCount ?? 0) > 0)
    expect(visibles).toHaveLength(2)
    expect(visibles.map(c => c.id)).toEqual(['c1', 'c3'])
  })
})
