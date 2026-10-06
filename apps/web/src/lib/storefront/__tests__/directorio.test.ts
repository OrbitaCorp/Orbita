import { describe, expect, it } from 'vitest'
import type { DirectorioDeTiendas } from '../api'
import { direccionLegible, inicialDe, jsonLdDirectorio, rutaDePagina, totalDePaginas, urlDeTienda } from '../directorio'

describe('urlDeTienda', () => {
  it('con dominio propio activo, apunta al dominio propio', () => {
    expect(urlDeTienda({ subdomain: 'tefaltacalle', domain: 'tefaltacalleok.com' })).toBe('https://tefaltacalleok.com/')
  })
  it('sin dominio propio, al subdominio de Órbita (el dominio raíz sale de la configuración)', () => {
    expect(urlDeTienda({ subdomain: 'venustyle', domain: null })).toMatch(/^https:\/\/venustyle\.[a-z.-]+\/$/)
  })
  it('direccionLegible saca el protocolo y la barra', () => {
    expect(direccionLegible({ subdomain: 'x', domain: 'mitienda.com' })).toBe('mitienda.com')
  })
})

describe('paginación', () => {
  it('totalDePaginas redondea para arriba y nunca es menor a 1', () => {
    expect(totalDePaginas({ total: 0, perPage: 48 })).toBe(1)
    expect(totalDePaginas({ total: 48, perPage: 48 })).toBe(1)
    expect(totalDePaginas({ total: 49, perPage: 48 })).toBe(2)
  })
  it('la primera página tiene una sola URL, sin parámetro', () => {
    expect(rutaDePagina(1)).toBe('/tiendas')
    expect(rutaDePagina(0)).toBe('/tiendas')
    expect(rutaDePagina(3)).toBe('/tiendas?pagina=3')
  })
})

describe('inicialDe', () => {
  it('la primera letra en mayúscula; con el nombre vacío, un punto', () => {
    expect(inicialDe('  venus style')).toBe('V')
    expect(inicialDe('')).toBe('·')
  })
})

describe('jsonLdDirectorio', () => {
  const dir: DirectorioDeTiendas = {
    total: 60, page: 2, perPage: 48, lastChange: null,
    stores: [{ name: 'Venus Style', subdomain: 'venustyle', domain: null, description: null, logoUrl: null }],
  }
  it('lista las tiendas con su posición dentro del total, no de la página', () => {
    const ld = jsonLdDirectorio(dir, 'https://www.orbita.site/tiendas?pagina=2') as Record<string, any>
    expect(ld['@type']).toBe('CollectionPage')
    expect(ld.mainEntity.numberOfItems).toBe(60)
    expect(ld.mainEntity.itemListElement[0]).toMatchObject({ position: 49, name: 'Venus Style' })
    expect(ld.mainEntity.itemListElement[0].url).toMatch(/^https:\/\/venustyle\./)
  })
})
