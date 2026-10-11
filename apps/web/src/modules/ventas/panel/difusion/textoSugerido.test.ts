import { describe, expect, it } from 'vitest'
import { MAX_TEXTO_INSTAGRAM, textoSugerido, urlDelProducto } from './textoSugerido'

describe('textoSugerido', () => {
  const remera = { name: ' Remera lisa ', description: 'Algodón peinado.\n\n  Talles   S a XL.', basePrice: 15000 }

  it('arma nombre, descripción limpia, precio y enlace, separados por una línea en blanco', () => {
    const t = textoSugerido(remera, 'tienda.orbita.site/p/1a2b3c4d')
    expect(t).toBe('Remera lisa\n\nAlgodón peinado. Talles S a XL.\n\nPrecio: $15.000\n\nComprá en tienda.orbita.site/p/1a2b3c4d\nTambién en el link de mi perfil.')
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
  it('arma el link corto (8 caracteres del id, sin https), o null sin subdominio', () => {
    expect(urlDelProducto('mitienda', '39b2a1a3-462a-4c1c-a1b2-8dd6c0bf5ca3')).toBe('mitienda.orbita.site/p/39b2a1a3')
    expect(urlDelProducto(null, 'abc')).toBeNull()
  })
})
