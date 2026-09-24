import { describe, expect, it } from 'vitest'
import { toProducto, type StorefrontProductItem } from '../api'

// Badges de la tarjeta de producto. Lo que se prueba: el de oferta muestra el
// porcentaje real, y cada toggle de Apariencia apaga solo lo suyo.

function item(over: Partial<StorefrontProductItem> = {}): StorefrontProductItem {
  return {
    id: 'p1', name: 'Remera', categoryName: 'Remeras', price: 8000, comparePrice: 10000,
    createdAt: '2020-01-01T00:00:00.000Z', inStock: true, lowStock: true,
    imageUrl: null, images: [], variantOptions: [], priceTo: null, promoLabel: null,
    ...over,
  } as unknown as StorefrontProductItem
}

describe('toProducto — badge de oferta con porcentaje', () => {
  it('muestra el descuento real contra el precio anterior', () => {
    expect(toProducto(item()).badge).toBe('-20%')
    expect(toProducto(item({ price: 7500, comparePrice: 10000 })).badge).toBe('-25%')
  })

  it('redondea al entero más cercano', () => {
    expect(toProducto(item({ price: 6667, comparePrice: 10000 })).badge).toBe('-33%')
  })

  it('un descuento de menos de 1% no se escribe "-0%": queda "Oferta"', () => {
    expect(toProducto(item({ price: 9960, comparePrice: 10000 })).badge).toBe('Oferta')
  })

  it('sin precio anterior más alto no hay badge de oferta', () => {
    expect(toProducto(item({ comparePrice: null })).badge).toBeNull()
    expect(toProducto(item({ price: 10000, comparePrice: 10000 })).badge).toBeNull()
  })

  it('con el toggle de oferta apagado no aparece', () => {
    expect(toProducto(item(), { showOffer: false }).badge).toBeNull()
  })

  it('una promo real ("2x1") gana sobre el porcentaje', () => {
    expect(toProducto(item({ promoLabel: '2x1' } as Partial<StorefrontProductItem>)).badge).toBe('2x1')
  })
})

describe('toProducto — indicador de stock bajo', () => {
  it('con el toggle encendido, la tarjeta marca stock bajo', () => {
    expect(toProducto(item()).lowStock).toBe(true)
  })

  it('con el toggle apagado, la tarjeta no lo marca', () => {
    expect(toProducto(item(), { showLowStock: false }).lowStock).toBe(false)
  })
})
