import { describe, expect, it } from 'vitest'
import { armarPrivacidad, armarTerminos, datosLegalesDe, type DatosLegales } from '../legales'
import type { StorefrontConfigResponse } from '../api'

// Los documentos legales del footer se arman con los datos de cada tienda.
// Lo que se prueba: que las variables de la plantilla se completan con lo que
// la tienda tiene, y que cuando NO tiene un dato el texto sigue leyéndose
// bien (sin "undefined", sin coma colgada, sin "a  o a través de").

function config(over: Partial<StorefrontConfigResponse> = {}): StorefrontConfigResponse {
  return {
    business: { id: 'b1', name: 'Zapatos Lorena', subdomain: 'zapatoslorena', mode: 'FULL', isActive: true, isPaused: false },
    appearance: null,
    contact: null,
    payment: null,
    shipping: null,
    ...over,
  } as StorefrontConfigResponse
}

describe('datosLegalesDe — variables de la plantilla', () => {
  it('nombre: el de Apariencia si hay, si no el del negocio', () => {
    expect(datosLegalesDe(config()).nombreComercio).toBe('Zapatos Lorena')
    expect(datosLegalesDe(config({ appearance: { storeName: 'Lorena Shoes' } as never })).nombreComercio).toBe('Lorena Shoes')
  })

  it('canal alternativo: WhatsApp primero, Instagram después, null si no hay', () => {
    expect(datosLegalesDe(config({ contact: { whatsapp: '+54 9 11 5555-0000', instagram: 'lorena' } as never })).canalAlternativo).toBe('WhatsApp (+54 9 11 5555-0000)')
    expect(datosLegalesDe(config({ contact: { instagram: 'lorena' } as never })).canalAlternativo).toBe('Instagram (@lorena)')
    expect(datosLegalesDe(config()).canalAlternativo).toBeNull()
  })

  it('medios de pago: lista en castellano según lo habilitado', () => {
    const d = datosLegalesDe(config({ payment: { acceptsMercadopago: true, acceptsTransfer: true, acceptsCash: true, acceptsPickup: true } as never }))
    expect(d.mediosDePago).toBe('Mercado Pago, transferencia bancaria y efectivo con retiro en el local')
    expect(datosLegalesDe(config({ payment: { acceptsTransfer: true } as never })).mediosDePago).toBe('transferencia bancaria')
    expect(datosLegalesDe(config()).mediosDePago).toBe('los medios de pago indicados al finalizar la compra')
  })

  it('envíos: la política escrita por el Comercio manda; si no, se arma con lo configurado', () => {
    expect(datosLegalesDe(config({ shipping: { shippingPolicy: 'Enviamos a todo el país en 48 hs.' } as never })).politicaEnvios).toBe('Enviamos a todo el país en 48 hs.')
    const armada = datosLegalesDe(config({
      shipping: { shippingPolicy: null, enabledCarriers: ['CORREO_ARGENTINO', 'ANDREANI'], freeShippingFrom: 50000 } as never,
      payment: { acceptsPickup: true, pickupAddress: 'Av. Siempreviva 742' } as never,
    })).politicaEnvios
    expect(armada).toContain('Correo Argentino y Andreani')
    expect(armada).toContain('$50.000')
    expect(armada).toContain('Av. Siempreviva 742')
    expect(armada).toContain('antes de confirmar el pedido')
  })
})

describe('armarTerminos / armarPrivacidad', () => {
  const completo: DatosLegales = {
    nombreComercio: 'Zapatos Lorena', cuit: null, email: 'hola@lorena.com',
    canalAlternativo: 'WhatsApp (+54 9 11 5555-0000)', mediosDePago: 'Mercado Pago', politicaEnvios: 'Envíos a todo el país.',
  }

  it('completa nombre, email y canal en las cláusulas de contacto', () => {
    const t = armarTerminos(completo)
    expect(t.titulo).toBe('Términos y Condiciones de Compra — Zapatos Lorena')
    const texto = JSON.stringify(t)
    expect(texto).toContain('operada por Zapatos Lorena (en adelante')
    expect(texto).toContain('escribirnos a hola@lorena.com o a través de WhatsApp (+54 9 11 5555-0000).')
    expect(texto).toContain('medios de pago: Mercado Pago.')
    expect(texto).toContain('Envíos a todo el país.')
    expect(texto).not.toContain('{{')
    expect(texto).not.toContain('undefined')
  })

  it('con CUIT lo agrega tal cual la plantilla; sin CUIT, la frase no queda colgada', () => {
    expect(JSON.stringify(armarTerminos({ ...completo, cuit: '30-12345678-9' }))).toContain('Zapatos Lorena, CUIT 30-12345678-9 (en adelante')
    expect(JSON.stringify(armarPrivacidad(completo))).toContain('operada por Zapatos Lorena, con contacto en hola@lorena.com (en adelante')
  })

  it('sin email ni canal alternativo el texto sigue cerrado', () => {
    const sin = armarPrivacidad({ ...completo, email: null, canalAlternativo: null })
    const texto = JSON.stringify(sin)
    expect(texto).toContain('operada por Zapatos Lorena (en adelante')
    expect(texto).toContain('por los canales de contacto de esta tienda.')
    expect(texto).not.toContain(' a  ')
    expect(texto).not.toContain('null')
  })

  it('conserva las cláusulas legales fijas (arrepentimiento 10 días, garantía 6 meses, AAIP)', () => {
    const t = JSON.stringify(armarTerminos(completo))
    expect(t).toContain('10 (diez) días corridos')
    expect(t).toContain('6 (seis) meses')
    expect(t).toContain('Ley N.º 24.240')
    const p = JSON.stringify(armarPrivacidad(completo))
    expect(p).toContain('Ley N.º 25.326')
    expect(p).toContain('Agencia de Acceso a la Información Pública (AAIP)')
  })
})
