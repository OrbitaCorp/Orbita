import { describe, expect, it } from 'vitest'
import { MAX_TEXTO_INSTAGRAM, textoSugerido, urlDelProducto } from './textoSugerido'

describe('textoSugerido', () => {
  const remera = { name: ' Remera lisa ', description: 'Algodón peinado.\n\n  Talles   S a XL.', basePrice: 15000 }

  it('arma nombre, descripción limpia, precio y enlace, separados por una línea en blanco', () => {
    const t = textoSugerido(remera, 'https://tienda.orbita.site/producto/p1')
    expect(t).toBe('Remera lisa\n\nAlgodón peinado. Talles S a XL.\n\nPrecio: $15.000\n\nComprá en https://tienda.orbita.site/producto/p1')
  })

  it('omite lo que no hay: sin descripción, sin precio o sin enlace', () => {
    expect(textoSugerido({ name: 'Gorra', description: null, basePrice: 0 }, null)).toBe('Gorra')
    expect(textoSugerido({ name: 'Gorra', description: '  ', basePrice: 2500 }, null)).toBe('Gorra\n\nPrecio: $2.500')
  })

  it('recorta una descripción larga con puntos suspensivos', () => {
    const larga = 'a'.repeat(500)
    const t = textoSugerido({ name: 'X', description: larga, basePrice: 0 }, null)
    const descripcion = t.split('\n\n')[1]
    expect(descripcion.length).toBe(220)
    expect(descripcion.endsWith('…')).toBe(true)
  })

  it('nunca pasa del máximo de Instagram', () => {
    const t = textoSugerido({ name: 'n'.repeat(3000), description: null, basePrice: 1 }, 'https://x')
    expect(t.length).toBeLessThanOrEqual(MAX_TEXTO_INSTAGRAM)
  })
})

describe('urlDelProducto', () => {
  it('arma la dirección pública de la tienda, o null sin subdominio', () => {
    expect(urlDelProducto('mitienda', 'abc')).toBe('https://mitienda.orbita.site/producto/abc')
    expect(urlDelProducto(null, 'abc')).toBeNull()
  })
})
