import { describe, expect, it } from 'vitest'
import { canalVisible } from './utilidades'

describe('qué bandeja se ve al entrar a Mensajes', () => {
  it('sin nada en la dirección, WhatsApp es la principal', () => {
    expect(canalVisible(null, false, false)).toBe('whatsapp')
  })

  it('respeta la bandeja que pide la dirección', () => {
    expect(canalVisible('sistema', false, false)).toBe('sistema')
    expect(canalVisible('whatsapp', true, true)).toBe('whatsapp')
  })

  it('un link viejo a un chat, sin canal, es de la tienda', () => {
    expect(canalVisible(null, true, false)).toBe('sistema')
  })

  it('si WhatsApp no está habilitado para el negocio, entra a la de la tienda', () => {
    expect(canalVisible(null, false, true)).toBe('sistema')
  })
})
