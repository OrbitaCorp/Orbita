import { describe, expect, it } from 'vitest'
import { rutaDelNegocio, rutaDemo, rutaMiReserva } from '../rutas'

describe('rutaDemo', () => {
  it('lleva el modo en ?tipo= y conserva lo demás', () => {
    expect(rutaDemo('inicio', 'estadia')).toBe('/alquileres-demo/negocio?tipo=estadia')
    expect(rutaDemo('reserva', 'estadia', { propiedad: 'p1', entrada: '2026-12-10' })).toBe('/alquileres-demo/reserva?tipo=estadia&propiedad=p1&entrada=2026-12-10')
    expect(rutaDemo('mis-reservas', 'cancha', {}, '#x')).toBe('/alquileres-demo/mis-reservas?tipo=cancha#x')
  })
})

describe('rutaDelNegocio', () => {
  const ruta = rutaDelNegocio('cabanas-del-monte')
  it('arma los links del sitio del negocio, sin el modo', () => {
    expect(ruta('inicio', 'estadia')).toBe('/tienda/cabanas-del-monte')
    expect(ruta('reserva', 'estadia')).toBe('/tienda/cabanas-del-monte/reserva')
    expect(ruta('inicio', 'estadia', { propiedad: 'p1' })).toBe('/tienda/cabanas-del-monte?propiedad=p1')
    expect(ruta('reserva', 'estadia', { propiedad: 'p1', entrada: '2026-12-10', salida: '2026-12-13' })).toBe('/tienda/cabanas-del-monte/reserva?propiedad=p1&entrada=2026-12-10&salida=2026-12-13')
  })
  it('"mis reservas" no existe sin cuenta: cae en la portada', () => {
    expect(ruta('mis-reservas', 'estadia')).toBe('/tienda/cabanas-del-monte')
  })
})

describe('rutaMiReserva', () => {
  it('es el enlace personal, igual al de los emails una vez reescrito por el subdominio', () => {
    expect(rutaMiReserva('cabanas-del-monte', 'AbC_123-xyz')).toBe('/tienda/cabanas-del-monte/mi-reserva/AbC_123-xyz')
  })
})
