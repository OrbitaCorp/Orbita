import { describe, expect, it } from 'vitest'
import { destinoDelPanel, esDeAlquileres } from '../destinoPanel'

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
