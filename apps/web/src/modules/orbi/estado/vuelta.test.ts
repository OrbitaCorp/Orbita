import { describe, expect, it } from 'vitest'
import { paginaDesde, rutaDeVuelta } from './vuelta'

const INICIO = '/admin/ventas/dashboard'

describe('ida y vuelta de la página de Orbi', () => {
  it('la página recuerda la pantalla de origen, con su query', () => {
    const url = paginaDesde('/admin/ventas/orbi?vista=chat', '/admin/ventas/pedidos?vista=detalle&id=7')
    const desde = new URL(url, 'https://x.orbita.site').searchParams.get('desde')
    expect(desde).toBe('/admin/ventas/pedidos?vista=detalle&id=7')
    expect(rutaDeVuelta(desde, INICIO)).toBe('/admin/ventas/pedidos?vista=detalle&id=7')
  })
  it('sin origen, o con uno raro, vuelve a Inicio', () => {
    expect(rutaDeVuelta(undefined, INICIO)).toBe(INICIO)
    expect(rutaDeVuelta(['/a', '/b'], INICIO)).toBe(INICIO)
    expect(rutaDeVuelta('', INICIO)).toBe(INICIO)
  })
  it('nunca sale del sitio', () => {
    expect(rutaDeVuelta('https://malo.com', INICIO)).toBe(INICIO)
    expect(rutaDeVuelta('//malo.com/admin', INICIO)).toBe(INICIO)
    expect(rutaDeVuelta('/\\malo.com', INICIO)).toBe(INICIO)
    expect(rutaDeVuelta('/javascript:alert(1)', INICIO)).toBe(INICIO)
  })
  it('no vuelve a la misma página de Orbi', () => {
    expect(rutaDeVuelta('/admin/ventas/orbi?vista=chat', INICIO)).toBe(INICIO)
  })
})
