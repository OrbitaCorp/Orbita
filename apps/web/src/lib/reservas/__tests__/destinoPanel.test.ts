import { describe, expect, it } from 'vitest'
import { destinoDelPanel, esDeAlquileres, esDeGimnasio, sitioConReserva, sitioDelNegocio } from '../destinoPanel'

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
  it('Gimnasio todavía no tiene su panel en producción: /panel lo lleva al de siempre', () => {
    expect(destinoDelPanel('gimnasio', '')).toBe('/admin/ventas/dashboard')
  })
})

describe('qué negocio es de Gimnasio', () => {
  it('el que tiene el rubro principal "gimnasio" y, entre sus subrubros, uno de Gimnasio', () => {
    expect(esDeGimnasio('gimnasio', ['crossfit'])).toBe(true)
    expect(esDeGimnasio('gimnasio', ['indumentaria', 'yoga'])).toBe(true)
    expect(esDeGimnasio('gimnasio', ['gym'])).toBe(true)
  })
  it('una tienda que escribió "gimnasio" como rubro en su configuración no lo es: sus subrubros son los de Tienda', () => {
    expect(esDeGimnasio('gimnasio', ['deportes'])).toBe(false)
    expect(esDeGimnasio('gimnasio', [])).toBe(false)
    expect(esDeGimnasio('gimnasio', null)).toBe(false)
    expect(esDeGimnasio('gimnasio', undefined)).toBe(false)
  })
  it('con otro rubro principal, o escrito de otra forma, tampoco', () => {
    expect(esDeGimnasio('tienda', ['crossfit'])).toBe(false)
    expect(esDeGimnasio('Gimnasio', ['crossfit'])).toBe(false)
    expect(esDeGimnasio(undefined, ['crossfit'])).toBe(false)
    expect(esDeGimnasio(null, null)).toBe(false)
  })
})

describe('qué muestra la portada del sitio del negocio', () => {
  it('la tienda, como siempre, para cualquier rubro que no sea de reservas o si el rubro no llegó', () => {
    expect(sitioDelNegocio('tienda')).toBe('tienda')
    expect(sitioDelNegocio('Indumentaria')).toBe('tienda')
    expect(sitioDelNegocio(undefined)).toBe('tienda')
    expect(sitioDelNegocio(null)).toBe('tienda')
    expect(sitioDelNegocio('')).toBe('tienda')
    expect(sitioDelNegocio('tienda', ['indumentaria', 'calzado'])).toBe('tienda')
  })
  it('el sitio de reservas para un negocio de Alquileres', () => {
    expect(sitioDelNegocio('alquileres')).toBe('alquileres')
    expect(sitioDelNegocio('alquileres', ['cabana'])).toBe('alquileres')
  })
  it('el sitio de clases para un negocio de Gimnasio; con "gimnasio" a secas, sin su subrubro, sigue siendo la tienda', () => {
    expect(sitioDelNegocio('gimnasio', ['crossfit'])).toBe('gimnasio')
    expect(sitioDelNegocio('gimnasio')).toBe('tienda')
    expect(sitioDelNegocio('gimnasio', ['deportes'])).toBe('tienda')
  })
})

describe('qué sitio tiene la página /reserva', () => {
  it('los que reservan (Alquileres, Gimnasio); en una tienda no existe', () => {
    expect(sitioConReserva('alquileres')).toBe(true)
    expect(sitioConReserva('gimnasio', ['yoga'])).toBe(true)
    expect(sitioConReserva('tienda', ['indumentaria'])).toBe(false)
    expect(sitioConReserva('gimnasio', ['deportes'])).toBe(false)
    expect(sitioConReserva(null)).toBe(false)
  })
})
