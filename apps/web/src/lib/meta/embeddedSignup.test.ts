import { describe, expect, it } from 'vitest'
import { interpretarMensajeDeMeta } from './embeddedSignup'

const FB = 'https://www.facebook.com'
const msg = (event: string, data: Record<string, unknown> = {}) => JSON.stringify({ type: 'WA_EMBEDDED_SIGNUP', event, data })

describe('interpretarMensajeDeMeta', () => {
  it('solo confía en mensajes que vienen de Facebook', () => {
    expect(interpretarMensajeDeMeta('https://evil.example', msg('FINISH', { phone_number_id: '1', waba_id: '2' }))).toBeNull()
    expect(interpretarMensajeDeMeta('https://www.facebook.com.evil.example', msg('CANCEL'))).toBeNull()
    expect(interpretarMensajeDeMeta('https://business.facebook.com', msg('CANCEL'))).toEqual({ tipo: 'cancelado', paso: undefined })
  })

  it('FINISH trae el número y la cuenta que eligió el cliente (los ids pueden llegar como número)', () => {
    expect(interpretarMensajeDeMeta(FB, msg('FINISH', { phone_number_id: '111', waba_id: 222, business_id: '333' })))
      .toEqual({ tipo: 'terminado', phoneNumberId: '111', wabaId: '222', businessId: '333' })
  })

  it('un FINISH sin los ids es un error, no una conexión a medias', () => {
    expect(interpretarMensajeDeMeta(FB, msg('FINISH', { waba_id: '2' }))).toMatchObject({ tipo: 'error' })
  })

  it('coexistencia: terminar de conectar el número de la app WhatsApp Business trae solo el id de la cuenta', () => {
    expect(interpretarMensajeDeMeta(FB, msg('FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING', { waba_id: '222', business_id: '333' })))
      .toEqual({ tipo: 'terminado', wabaId: '222', businessId: '333' })
    expect(interpretarMensajeDeMeta(FB, msg('FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING', {}))).toMatchObject({ tipo: 'error' })
  })

  it('un CANCEL con mensaje de error es un error de la persona, no un simple cancelar', () => {
    expect(interpretarMensajeDeMeta(FB, msg('CANCEL', { error_message: 'Número no válido', error_code: 1 }))).toEqual({ tipo: 'error', mensaje: 'Número no válido' })
  })

  it('terminar sin agregar un número, cancelar y los errores de Meta se distinguen', () => {
    expect(interpretarMensajeDeMeta(FB, msg('FINISH_ONLY_WABA', { waba_id: '2' }))).toEqual({ tipo: 'sin-numero', wabaId: '2' })
    expect(interpretarMensajeDeMeta(FB, msg('CANCEL', { current_step: 'PHONE_NUMBER_SETUP' }))).toEqual({ tipo: 'cancelado', paso: 'PHONE_NUMBER_SETUP' })
    expect(interpretarMensajeDeMeta(FB, msg('ERROR', { error_message: 'Número no válido' }))).toEqual({ tipo: 'error', mensaje: 'Número no válido' })
  })

  it('ignora lo que no es del flujo de WhatsApp (la página recibe mensajes de todo tipo)', () => {
    expect(interpretarMensajeDeMeta(FB, 'no es json')).toBeNull()
    expect(interpretarMensajeDeMeta(FB, JSON.stringify({ type: 'OTRA_COSA' }))).toBeNull()
    expect(interpretarMensajeDeMeta(FB, 42)).toBeNull()
    expect(interpretarMensajeDeMeta(FB, msg('EVENTO_NUEVO'))).toBeNull()
  })

  it('acepta el mensaje ya como objeto (no solo como texto)', () => {
    expect(interpretarMensajeDeMeta(FB, { type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH', data: { phone_number_id: '1', waba_id: '2' } }))
      .toMatchObject({ tipo: 'terminado' })
  })
})
