import { describe, expect, it } from 'vitest'
import {
  usd, usdEje, tokens, creditosTxt, avisoSinCosto, SIN_DATO, ms, etiquetaDeTools, mesesRecientes, etiquetaDeMes, mesActualArgentina, pct, porcentajeDe,
  leerCreditos, pasosDe, contextoDe, puntosDeSerie, estadoDelTurno, excedido, lecturaEmpezada,
} from './orbiUsoFormato'

describe('formato', () => {
  it('USD con 4 decimales debajo de 10 centavos y 2 arriba', () => {
    expect(usd(0.0079)).toBe('USD 0,0079')
    expect(usd(12.5)).toBe('USD 12,50')
    expect(usd(null)).toBe('Sin dato')
    expect(usd(undefined)).toBe(SIN_DATO)
    expect(usd(0)).toBe('USD 0,0000')
  })

  it('créditos: null es Sin dato, un cero medido es 0', () => {
    expect(creditosTxt(null)).toBe('Sin dato')
    expect(creditosTxt(0)).toBe('0')
    expect(creditosTxt(12345)).toBe('12.345')
  })

  it('aviso de mensajes sin costo: solo si hay alguno', () => {
    expect(avisoSinCosto(0)).toBeUndefined()
    expect(avisoSinCosto(undefined)).toBeUndefined()
    expect(avisoSinCosto(1)).toBe('1 mensaje sin dato de costo (anteriores al 4/10)')
    expect(avisoSinCosto(1500)).toBe('1.500 mensajes sin dato de costo (anteriores al 4/10)')
  })

  it('eje de USD corto: sin prefijo (el título de la tarjeta dice la moneda)', () => {
    expect(usdEje(0.0125)).toBe('0,013')
    expect(usdEje(12.34)).toBe('12,3')
    expect(usdEje(0)).toBe('0')
  })

  it('tokens con separador de miles', () => {
    expect(tokens(12345)).toBe('12.345')
    expect(tokens(undefined)).toBe('—')
  })

  it('ms: debajo de un segundo en ms, arriba en segundos con un decimal', () => {
    expect(ms(1960)).toBe('2 s')
    expect(ms(1250)).toBe('1,3 s')
    expect(ms(412.6)).toBe('413 ms')
    expect(ms(null)).toBe('—')
  })

  it('un mensaje sin tools se lee como charla', () => {
    expect(etiquetaDeTools('')).toBe('Charla, sin tools')
    expect(etiquetaDeTools('listOrders')).toBe('listOrders')
  })

  it('porcentajes: sin total no hay porcentaje', () => {
    expect(porcentajeDe(25, 100)).toBe(25)
    expect(porcentajeDe(5, 0)).toBeNull()
    expect(pct(33.333)).toBe('33 %')
    expect(pct(null)).toBe('—')
  })

  it('el cupo se marca excedido desde el 100 %', () => {
    expect(excedido(99)).toBe(false)
    expect(excedido(100)).toBe(true)
  })
})

describe('meses', () => {
  it('los últimos N meses, del más nuevo al más viejo', () => {
    expect(mesesRecientes(new Date('2026-10-15'), 3)).toEqual(['2026-10', '2026-09', '2026-08'])
    expect(mesesRecientes(new Date('2026-01-31T12:00:00Z'), 2)).toEqual(['2026-01', '2025-12'])
  })

  it('el mes en curso es el de Argentina: el 1/11 a las 01:00 UTC todavía es octubre', () => {
    expect(mesActualArgentina(new Date('2026-11-01T01:00:00Z'))).toEqual(new Date('2026-10-31T22:00:00Z'))
    expect(mesesRecientes(mesActualArgentina(new Date('2026-11-01T01:00:00Z')), 1)).toEqual(['2026-10'])
  })

  it('etiqueta legible del mes', () => {
    expect(etiquetaDeMes('2026-10')).toBe('octubre 2026')
    expect(etiquetaDeMes('2026-01')).toBe('enero 2026')
  })
})

describe('ajuste de cupo', () => {
  it('acepta enteros con signo, distintos de cero', () => {
    expect(leerCreditos('500')).toBe(500)
    expect(leerCreditos('+200')).toBe(200)
    expect(leerCreditos(' -150 ')).toBe(-150)
  })

  it('rechaza cero, decimales y texto', () => {
    expect(leerCreditos('0')).toBeNull()
    expect(leerCreditos('1.5')).toBeNull()
    expect(leerCreditos('')).toBeNull()
    expect(leerCreditos('abc')).toBeNull()
  })
})

describe('ficha del turno', () => {
  it('pasos: se leen los que tienen forma y se descartan los rotos', () => {
    const steps = [
      { n: 1, provider: 'gemini', model: 'gemini-3.6-flash', promptTokens: 1200, cachedTokens: 800, completionTokens: 90, thinkingTokens: 40, ms: 1500,
        tools: [{ name: 'listOrders', tipo: 'lectura', ms: 120, ok: true }, { name: 'x', tipo: 'otro', ms: 1, ok: true }] },
      'basura',
      { n: 2 },
    ]
    expect(pasosDe(steps)).toEqual([
      { n: 1, provider: 'gemini', model: 'gemini-3.6-flash', promptTokens: 1200, cachedTokens: 800, completionTokens: 90, thinkingTokens: 40, ms: 1500,
        tools: [{ name: 'listOrders', tipo: 'lectura', ms: 120, ok: true }] },
      { n: 2, provider: null, model: null, promptTokens: null, cachedTokens: null, completionTokens: null, thinkingTokens: null, ms: 0, tools: [] },
    ])
    expect(pasosDe(null)).toEqual([])
  })

  it('contexto: los cuatro tamaños en caracteres o nada', () => {
    expect(contextoDe({ system: 9000, tools: 4000, history: 1200, message: 40 })).toEqual({ system: 9000, tools: 4000, history: 1200, message: 40 })
    expect(contextoDe(null)).toBeNull()
    expect(contextoDe({ system: 'x' })).toBeNull()
  })

  it('estado legible, con tono, y el valor crudo si no se conoce', () => {
    expect(estadoDelTurno('ok')).toEqual({ label: 'Respondió', tone: 'green' })
    expect(estadoDelTurno('quota')).toEqual({ label: 'Frenado por cupo', tone: 'amber' })
    expect(estadoDelTurno('raro')).toEqual({ label: 'raro', tone: 'gray' })
  })
})

describe('abrir una conversación', () => {
  it('el formulario cuenta como empezado apenas hay motivo, detalle o ticket (espacios solos no)', () => {
    expect(lecturaEmpezada({ motivo: null, detalle: '', ticket: '' })).toBe(false)
    expect(lecturaEmpezada({ motivo: null, detalle: '   ', ticket: ' ' })).toBe(false)
    expect(lecturaEmpezada({ motivo: 'soporte', detalle: '', ticket: '' })).toBe(true)
    expect(lecturaEmpezada({ motivo: null, detalle: 'x', ticket: '' })).toBe(true)
    expect(lecturaEmpezada({ motivo: null, detalle: '', ticket: 'RBT-1' })).toBe(true)
  })
})

describe('serie diaria', () => {
  it('el día va a mediodía UTC: así se dibuja el mismo día en cualquier huso', () => {
    expect(puntosDeSerie([{ dia: '2026-10-01', mensajes: 3, costoUsd: 0.02 }])).toEqual([
      { date: '2026-10-01T12:00:00Z', mensajes: 3, costo: 0.02 },
    ])
  })

  it('un día sin costo medido (null) se dibuja en 0, sin romper el gráfico', () => {
    expect(puntosDeSerie([{ dia: '2026-10-01', mensajes: 3, costoUsd: null }])).toEqual([
      { date: '2026-10-01T12:00:00Z', mensajes: 3, costo: 0 },
    ])
  })
})
