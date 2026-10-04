// Preferencias de cookies (lib/cookies/consentimiento.ts): sin elección las estadísticas
// cuentan; "Solo necesarias" las apaga; cambiar la versión obliga a volver a preguntar.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EVENTO_ABRIR, EVENTO_CAMBIO, abrirPreferenciasDeCookies, estadisticasPermitidas,
  guardarConsentimiento, leerConsentimiento,
} from '../consentimiento'

function entorno() {
  const datos = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
  })
  const eventos = new EventTarget()
  vi.stubGlobal('window', eventos)
  return { datos, eventos }
}

describe('consentimiento de cookies', () => {
  let ctx: ReturnType<typeof entorno>
  beforeEach(() => { ctx = entorno() })

  it('sin elección no hay registro y las estadísticas cuentan', () => {
    expect(leerConsentimiento()).toBeNull()
    expect(estadisticasPermitidas()).toBe(true)
  })

  it('"Solo necesarias" apaga las estadísticas y se recuerda', () => {
    guardarConsentimiento(false)
    expect(leerConsentimiento()?.estadisticas).toBe(false)
    expect(estadisticasPermitidas()).toBe(false)
  })

  it('aceptar todo las deja activas', () => {
    guardarConsentimiento(true)
    expect(estadisticasPermitidas()).toBe(true)
  })

  it('avisa el cambio a quien escucha (el contador de visitas)', () => {
    const oyente = vi.fn()
    ctx.eventos.addEventListener(EVENTO_CAMBIO, oyente)
    guardarConsentimiento(false)
    expect(oyente).toHaveBeenCalledTimes(1)
  })

  it('una elección de otra versión o corrupta se ignora y se vuelve a preguntar', () => {
    ctx.datos.set('orbita-cookies', JSON.stringify({ estadisticas: false, version: 0, fecha: '' }))
    expect(leerConsentimiento()).toBeNull()
    ctx.datos.set('orbita-cookies', '{no es json')
    expect(leerConsentimiento()).toBeNull()
    expect(estadisticasPermitidas()).toBe(true)
  })

  it('"Preferencias de cookies" dispara el evento que reabre el aviso', () => {
    const oyente = vi.fn()
    ctx.eventos.addEventListener(EVENTO_ABRIR, oyente)
    abrirPreferenciasDeCookies()
    expect(oyente).toHaveBeenCalledTimes(1)
  })
})
