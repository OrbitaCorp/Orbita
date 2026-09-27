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
