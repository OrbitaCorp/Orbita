import { describe, expect, it } from 'vitest'
import { rutaDelNegocio, rutaDemo } from '../rutas'
import { ruta } from '../Sitio'

describe('rutaDemo', () => {
  it('lleva el rubro en ?rubro= y conserva lo demás', () => {
    expect(rutaDemo('inicio', 'crossfit')).toBe('/gimnasio-demo/negocio?rubro=crossfit')
    expect(rutaDemo('reserva', 'yoga', { clase: 'c1', fecha: '2026-11-16' })).toBe('/gimnasio-demo/reserva?rubro=yoga&clase=c1&fecha=2026-11-16')
    expect(rutaDemo('mis-clases', 'gym', {}, '#plan')).toBe('/gimnasio-demo/mis-clases?rubro=gym#plan')
  })
  it('es la `ruta` que usan las pantallas de la demo', () => {
    expect(ruta).toBe(rutaDemo)
  })
})

describe('rutaDelNegocio', () => {
  const r = rutaDelNegocio('box-norte')
  it('arma los links del sitio del negocio, sin el rubro', () => {
    expect(r('inicio', 'crossfit')).toBe('/tienda/box-norte')
    expect(r('reserva', 'crossfit')).toBe('/tienda/box-norte/reserva')
    expect(r('reserva', 'crossfit', { clase: 'r-wod', fecha: '2026-11-30' })).toBe('/tienda/box-norte/reserva?clase=r-wod&fecha=2026-11-30')
    expect(r('inicio', 'crossfit', {}, '#gis-planes')).toBe('/tienda/box-norte#gis-planes')
  })
  it('"Mis clases" todavía no existe en el sitio real: cae en la portada', () => {
    expect(r('mis-clases', 'crossfit')).toBe('/tienda/box-norte')
  })
  it('un id de clase con sesión (recurso~día-hora) viaja escapado', () => {
    expect(r('reserva', 'crossfit', { clase: 'r-wod~0-1140', fecha: '2026-11-30' })).toBe('/tienda/box-norte/reserva?clase=r-wod%7E0-1140&fecha=2026-11-30')
  })
})
