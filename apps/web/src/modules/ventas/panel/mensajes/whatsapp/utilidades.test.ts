import { describe, expect, it } from 'vitest'
import type { ChatMessage, ConversationRow } from '@/lib/api'
import {
  MAX_BYTES_FOTO, VENTANA_WHATSAPP_MS, armarFilas, colorDeAvatar, errorDeFoto, estadoDeEntrega, fotoDelMensaje, iniciales, marcaDeLaLista, pieDeFoto, puedeResponderHasta,
  repartirCharlas, separadorDeDia, vistaPreviaDeLaLista,
} from './utilidades'

const AHORA = new Date(2026, 9, 17, 15, 30) // sábado 17 de octubre de 2026, 15:30

const msg = (id: string, sender: 'CUSTOMER' | 'STORE', creado: Date, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id, sender, text: 'hola', orderId: null, channel: 'WHATSAPP', deliveryStatus: null, createdAt: creado.toISOString(), ...extra,
} as ChatMessage)

describe('repartirCharlas: las dos bandejas no se mezclan', () => {
  const fila = (id: string, canal?: ConversationRow['lastChannel'], extra: Partial<ConversationRow> = {}) => ({ id, lastChannel: canal, isUnread: false, ...extra } as ConversationRow)
  const info = (texto: string, isUnread = false) => ({ lastMessage: { id: texto, text: texto } as ChatMessage, isUnread })

  it('sin el detalle por canal (la demo o una API vieja) usa el canal del último mensaje', () => {
    const r = repartirCharlas([fila('a', 'WHATSAPP'), fila('b', 'STOREFRONT'), fila('c', undefined)])
    expect(r.whatsapp.map((x) => x.id)).toEqual(['a'])
    expect(r.sistema.map((x) => x.id)).toEqual(['b', 'c'])
  })

  it('una persona que escribió por los dos canales está en las dos bandejas, cada una con SU último mensaje', () => {
    const r = repartirCharlas([fila('x', 'WHATSAPP', { canales: { STOREFRONT: info('desde la tienda'), WHATSAPP: info('por wpp') } })])
    expect(r.sistema).toHaveLength(1)
    expect(r.whatsapp).toHaveLength(1)
    expect(r.sistema[0].lastMessage?.text).toBe('desde la tienda')
    expect(r.whatsapp[0].lastMessage?.text).toBe('por wpp')
  })

  it('el "sin leer" de un canal no se ve en la otra bandeja', () => {
    const r = repartirCharlas([fila('x', 'WHATSAPP', { isUnread: true, canales: { STOREFRONT: info('tienda', false), WHATSAPP: info('wpp', true) } })])
    expect(r.whatsapp[0].isUnread).toBe(true)
    expect(r.sistema[0].isUnread).toBe(false)
  })

  it('una charla que solo existe en un canal no aparece en la otra bandeja', () => {
    const r = repartirCharlas([fila('solo-wpp', 'WHATSAPP', { canales: { WHATSAPP: info('wpp') } }), fila('solo-tienda', 'STOREFRONT', { canales: { STOREFRONT: info('tienda') } })])
    expect(r.sistema.map((x) => x.id)).toEqual(['solo-tienda'])
    expect(r.whatsapp.map((x) => x.id)).toEqual(['solo-wpp'])
  })
})

describe('puedeResponderHasta', () => {
  it('son 24 horas desde el último mensaje del cliente por WhatsApp', () => {
    const ultimo = new Date(AHORA.getTime() - 5 * 3600_000)
    const r = puedeResponderHasta([msg('1', 'CUSTOMER', new Date(AHORA.getTime() - 30 * 3600_000)), msg('2', 'CUSTOMER', ultimo)], AHORA.getTime())
    expect(r?.getTime()).toBe(ultimo.getTime() + VENTANA_WHATSAPP_MS)
  })
  it('lo que escribió el negocio no renueva el plazo', () => {
    const viejo = new Date(AHORA.getTime() - 30 * 3600_000)
    expect(puedeResponderHasta([msg('1', 'CUSTOMER', viejo), msg('2', 'STORE', new Date(AHORA.getTime() - 3600_000))], AHORA.getTime())).toBeNull()
  })
  it('un mensaje del chat de la tienda no cuenta para WhatsApp, y sin mensajes del cliente no hay plazo', () => {
    expect(puedeResponderHasta([msg('1', 'CUSTOMER', new Date(AHORA.getTime() - 3600_000), { channel: 'STOREFRONT' })], AHORA.getTime())).toBeNull()
    expect(puedeResponderHasta([], AHORA.getTime())).toBeNull()
  })
})

describe('fechas como en WhatsApp', () => {
  it('la lista muestra la hora de hoy, "Ayer" o la fecha', () => {
    expect(marcaDeLaLista(new Date(2026, 9, 17, 9, 5).toISOString(), AHORA)).toBe('09:05')
    expect(marcaDeLaLista(new Date(2026, 9, 16, 23, 0).toISOString(), AHORA)).toBe('Ayer')
    expect(marcaDeLaLista(new Date(2026, 8, 3, 12, 0).toISOString(), AHORA)).toBe('03/09/2026')
  })
  it('el separador del chat dice HOY, AYER, el día de la semana o la fecha completa', () => {
    expect(separadorDeDia(new Date(2026, 9, 17, 1).toISOString(), AHORA)).toBe('HOY')
    expect(separadorDeDia(new Date(2026, 9, 16, 1).toISOString(), AHORA)).toBe('AYER')
    expect(separadorDeDia(new Date(2026, 9, 14, 12).toISOString(), AHORA)).toBe('MIÉRCOLES')
    expect(separadorDeDia(new Date(2026, 8, 3, 12).toISOString(), AHORA)).toBe('3 de septiembre de 2026')
  })
})

describe('avatares y entrega', () => {
  it('iniciales y color estable por persona', () => {
    expect(iniciales('Ana Paz')).toBe('AP')
    expect(iniciales('')).toBe('?')
    expect(colorDeAvatar('Ana Paz')).toBe(colorDeAvatar('Ana Paz'))
  })
  it('los tildes solo existen en lo que mandó el negocio', () => {
    expect(estadoDeEntrega({ sender: 'CUSTOMER', deliveryStatus: null })).toBeNull()
    expect(estadoDeEntrega({ sender: 'STORE', deliveryStatus: 'sent' })).toBe('enviado')
    expect(estadoDeEntrega({ sender: 'STORE', deliveryStatus: 'delivered' })).toBe('entregado')
    expect(estadoDeEntrega({ sender: 'STORE', deliveryStatus: 'read' })).toBe('leido')
    expect(estadoDeEntrega({ sender: 'STORE', deliveryStatus: 'failed' })).toBe('fallo')
  })
})

describe('armarFilas', () => {
  it('marca el separador del primer mensaje de cada día y la colita al empezar cada racha', () => {
    const filas = armarFilas([
      msg('1', 'CUSTOMER', new Date(2026, 9, 16, 10)),
      msg('2', 'CUSTOMER', new Date(2026, 9, 16, 10, 1)),
      msg('3', 'STORE', new Date(2026, 9, 16, 11)),
      msg('4', 'STORE', new Date(2026, 9, 17, 9)),
    ], AHORA)
    expect(filas.map((f) => f.dia)).toEqual(['AYER', null, null, 'HOY'])
    expect(filas.map((f) => f.primeroDeRacha)).toEqual([true, false, true, true])
  })
})

describe('fotos en el chat', () => {
  const conFoto = (text: string) => ({ text, attachments: [{ tipo: 'image' as const, url: 'https://almacen/a.jpg' }] })

  it('una foto se detecta por su adjunto, y un mensaje sin adjunto no tiene foto', () => {
    expect(fotoDelMensaje(conFoto('[Imagen]'))).toBe('https://almacen/a.jpg')
    expect(fotoDelMensaje({ attachments: null })).toBeNull()
    expect(fotoDelMensaje({})).toBeNull()
  })
  it('el pie de foto es el texto, salvo que sea solo la etiqueta', () => {
    expect(pieDeFoto(conFoto('[Imagen]'))).toBe('')
    expect(pieDeFoto(conFoto('Así queda'))).toBe('Así queda')
    expect(pieDeFoto({ text: '[Imagen]', attachments: null })).toBe('[Imagen]')
  })
  it('la lista anuncia la foto como "Foto" o con su pie', () => {
    expect(vistaPreviaDeLaLista(null)).toBe('')
    expect(vistaPreviaDeLaLista({ text: 'hola', attachments: null })).toBe('hola')
    expect(vistaPreviaDeLaLista(conFoto('[Imagen]'))).toBe('📷 Foto')
    expect(vistaPreviaDeLaLista(conFoto('Así queda'))).toBe('📷 Así queda')
  })
  it('solo se aceptan JPG, PNG o WebP de hasta 10 MB', () => {
    expect(errorDeFoto({ type: 'image/png', size: 1000 })).toBeNull()
    expect(errorDeFoto({ type: 'image/webp', size: MAX_BYTES_FOTO })).toBeNull()
    expect(errorDeFoto({ type: 'application/pdf', size: 1000 })).toMatch(/JPG, PNG o WebP/)
    expect(errorDeFoto({ type: 'image/gif', size: 1000 })).not.toBeNull()
    expect(errorDeFoto({ type: 'image/jpeg', size: MAX_BYTES_FOTO + 1 })).toMatch(/10 MB/)
  })
})
