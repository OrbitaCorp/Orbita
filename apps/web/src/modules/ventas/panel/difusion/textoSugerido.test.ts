import { describe, expect, it } from 'vitest'
import { CIERRE, MAX_TEXTO_INSTAGRAM, hashtagsDelProducto, textoSugerido, urlDelProducto } from './textoSugerido'

describe('textoSugerido', () => {
  const remera = { name: ' Remera lisa ', description: 'Algodón peinado.\n\n  Talles   S a XL.', basePrice: 15000, categoryName: 'Indumentaria' }

  it('arma nombre, descripción limpia, precio, el cierre que manda al link de la bio y los hashtags, separados por una línea en blanco', () => {
    const t = textoSugerido(remera, 'mitienda')
    expect(t).toBe(
      'Remera lisa\n\nAlgodón peinado. Talles S a XL.\n\nPrecio: $15.000\n\nComprá desde el link de mi bio.\n\n#remera #lisa #remeralisa #indumentaria #mitienda',
    )
    expect(t).not.toMatch(/https?:|orbita\.site/)
  })

  it('omite lo que no hay: sin descripción o sin precio', () => {
    expect(textoSugerido({ name: 'Gorra', description: null, basePrice: 0 })).toBe(`Gorra\n\n${CIERRE}\n\n#gorra`)
    expect(textoSugerido({ name: 'Gorra', description: '  ', basePrice: 2500 })).toBe(`Gorra\n\nPrecio: $2.500\n\n${CIERRE}\n\n#gorra`)
  })

  it('recorta una descripción larga con puntos suspensivos', () => {
    const larga = 'a'.repeat(500)
    const t = textoSugerido({ name: 'X', description: larga, basePrice: 0 })
    const descripcion = t.split('\n\n')[1]
    expect(descripcion.length).toBe(220)
    expect(descripcion.endsWith('…')).toBe(true)
  })

  it('nunca pasa del máximo de Instagram', () => {
    const t = textoSugerido({ name: 'n'.repeat(3000), description: null, basePrice: 1 })
    expect(t.length).toBeLessThanOrEqual(MAX_TEXTO_INSTAGRAM)
  })
})

describe('hashtagsDelProducto', () => {
  it('toma las palabras con sentido del nombre, sin tildes ni símbolos, y descarta las vacías', () => {
    expect(hashtagsDelProducto({ name: 'Zapatillas Running para Hombre - Talle 42' })).toEqual(['zapatillas', 'running', 'hombre'])
  })

  it('suma la categoría y el nombre de la tienda, sin repetir', () => {
    expect(hashtagsDelProducto({ name: 'Remera', categoryName: 'Remeras Básicas' }, 'Rama Indumentaria')).toEqual(['remera', 'remerasbasicas', 'ramaindumentaria'])
    expect(hashtagsDelProducto({ name: 'Gorra', categoryName: 'Gorra' }, 'gorra')).toEqual(['gorra'])
  })

  it('no pasa de 6 etiquetas ni usa números sueltos o palabras cortas', () => {
    const h = hashtagsDelProducto({ name: 'Mochila 2024 de cuero genuino artesanal hecha a mano', categoryName: 'Accesorios' }, 'cuerosur')
    expect(h.length).toBeLessThanOrEqual(6)
    expect(h).not.toContain('2024')
    expect(h).not.toContain('de')
    expect(new Set(h).size).toBe(h.length)
  })

  it('un nombre sin palabras útiles no rompe', () => {
    expect(hashtagsDelProducto({ name: '12 - 3' })).toEqual([])
  })
})

describe('urlDelProducto', () => {
  it('arma el link corto (8 caracteres del id, sin https), o null sin subdominio', () => {
    expect(urlDelProducto('mitienda', '39b2a1a3-462a-4c1c-a1b2-8dd6c0bf5ca3')).toBe('mitienda.orbita.site/p/39b2a1a3')
    expect(urlDelProducto(null, 'abc')).toBeNull()
  })
})
