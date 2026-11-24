import { describe, expect, it } from 'vitest'
import { destinoDelPanel, esDeAlquileres, sitioDelNegocio } from '../destinoPanel'

describe('a dónde lleva /panel', () => {
  it('un negocio de Tienda (o sin rubro en la sesión) va al panel de Tienda, como siempre', () => {
    expect(destinoDelPanel('tienda', '')).toBe('/admin/ventas/dashboard')
    expect(destinoDelPanel(undefined, '')).toBe('/admin/ventas/dashboard')
    expect(destinoDelPanel('', '?tutorial=b')).toBe('/admin/ventas/dashboard?tutorial=b')
    expect(destinoDelPanel('Indumentaria', '')).toBe('/admin/ventas/dashboard')
  })
  it('un negocio de Alquileres va a su panel, con la query entera', () => {
    expect(destinoDelPanel('alquileres', '')).toBe('/panel/alquileres')
    expect(destinoDelPanel('alquileres', '?vista=propiedades')).toBe('/panel/alquileres?vista=propiedades')
  })
  it('esDeAlquileres mira solo el rubro principal del negocio', () => {
    expect(esDeAlquileres('alquileres')).toBe(true)
    expect(esDeAlquileres('turnos')).toBe(false)
    expect(esDeAlquileres(undefined)).toBe(false)
  })
})

describe('qué muestra la portada del sitio del negocio', () => {
  it('la tienda, como siempre, para cualquier rubro que no sea Alquileres o si el rubro no llegó', () => {
    expect(sitioDelNegocio('tienda')).toBe('tienda')
    expect(sitioDelNegocio('Indumentaria')).toBe('tienda')
    expect(sitioDelNegocio(undefined)).toBe('tienda')
    expect(sitioDelNegocio(null)).toBe('tienda')
    expect(sitioDelNegocio('')).toBe('tienda')
  })
  it('el sitio de reservas para un negocio de Alquileres', () => {
    expect(sitioDelNegocio('alquileres')).toBe('alquileres')
  })
})
