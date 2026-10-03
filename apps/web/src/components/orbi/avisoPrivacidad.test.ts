import { describe, expect, it } from 'vitest'
import { ROOT_DOMAIN } from '@/lib/tenant'
import { AVISO_PRIVACIDAD, URL_PRIVACIDAD } from './avisoPrivacidad'

describe('aviso de privacidad del chat de Orbi', () => {
  it('nombra a los dos proveedores que procesan el texto: Gemini y Groq de respaldo', () => {
    expect(AVISO_PRIVACIDAD).toBe('Lo que escribís queda en tu historial y lo procesa Google Gemini (y Groq como respaldo).')
  })

  it('el link es absoluto al sitio de Órbita: en el subdominio de una tienda, /privacidad iría al storefront', () => {
    expect(URL_PRIVACIDAD).toMatch(/^https:\/\//)
    expect(URL_PRIVACIDAD.endsWith(`${ROOT_DOMAIN}/privacidad`)).toBe(true)
  })
})
