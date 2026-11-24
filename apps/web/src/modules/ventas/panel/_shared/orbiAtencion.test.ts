import { describe, expect, it } from 'vitest'
import type { OrbiCanalEstado } from '@/lib/api'
import { formularioDe, orbiAtiende, revisarFormulario, soloDigitos, textoDelCupo } from './orbiAtencion'

// Lo que el formulario de Orbi hace igual en WhatsApp y en Instagram.

const bot = (extra: Partial<OrbiCanalEstado> = {}): OrbiCanalEstado => ({
  disponible: true, conectado: true, enabled: true, modo: 'SELECCIONADOS', instrucciones: null, topeCreditos: null,
  tomaPedidos: false, maxUnidades: 10, maxMonto: 200000, pedidos: { disponible: true },
  cupo: { mes: '2026-11', usados: 0, total: 2000, limite: 2000, porcentaje: 0 }, ...extra,
})

describe('orbiAtiende (igual en las dos bandejas)', () => {
  it('sigue el modo general y respeta lo que decidió el dueño en la charla', () => {
    expect(orbiAtiende(bot({ modo: 'TODOS' }), undefined)).toBe(true)
    expect(orbiAtiende(bot(), 'DEFAULT')).toBe(false)
    expect(orbiAtiende(bot(), 'ON')).toBe(true)
    expect(orbiAtiende(bot({ modo: 'TODOS' }), 'PAUSADO')).toBe(false)
    expect(orbiAtiende(bot({ enabled: false }), 'ON')).toBe(false)
    expect(orbiAtiende(null, 'ON')).toBe(false)
  })
})

describe('revisarFormulario', () => {
  it('sin tocar nada no hay cambios', () => {
    const b = bot({ instrucciones: 'Hablá de vos', topeCreditos: 500 })
    expect(revisarFormulario(formularioDe(b), b)).toMatchObject({ hayCambios: false, topeValido: true, topesValidos: true })
  })

  it('arma lo que se guarda: indicaciones recortadas, tope vacío = sin tope, y los topes del pedido solo si cambiaron', () => {
    const b = bot({ topeCreditos: 500 })
    const r = revisarFormulario({ instrucciones: '  Promo 10%  ', tope: '', maxUnidades: '10', maxMonto: '200000' }, b)
    expect(r.hayCambios).toBe(true)
    expect(r.cambios).toEqual({ instrucciones: 'Promo 10%', topeCreditos: null })
    const conTopes = revisarFormulario({ ...formularioDe(b), maxUnidades: '3' }, b)
    expect(conTopes.cambios).toMatchObject({ maxUnidades: 3, maxMonto: 200000 })
  })

  it('valida los topes del pedido como la API (unidades 1 a 1000, monto desde $1.000)', () => {
    const b = bot()
    expect(revisarFormulario({ ...formularioDe(b), maxUnidades: '0' }, b).topesValidos).toBe(false)
    expect(revisarFormulario({ ...formularioDe(b), maxUnidades: '1001' }, b).topesValidos).toBe(false)
    expect(revisarFormulario({ ...formularioDe(b), maxMonto: '999' }, b).topesValidos).toBe(false)
    expect(revisarFormulario({ ...formularioDe(b), maxMonto: '' }, b).topesValidos).toBe(false)
  })

  it('soloDigitos deja solo los números', () => {
    expect(soloDigitos('1.500 $')).toBe('1500')
  })
})

describe('textoDelCupo', () => {
  it('dice lo de este canal y, si el otro gastó, cuánto', () => {
    expect(textoDelCupo({ mes: '2026-11', usados: 200, total: 2000, limite: 700, porcentaje: 28, otrosCanales: 1300 }, 'WhatsApp'))
      .toBe('Usaste 200 de 700 créditos (28%). WhatsApp usó 1.300 del mismo cupo.')
    expect(textoDelCupo({ mes: '2026-11', usados: 0, total: 2000, limite: 2000, porcentaje: 0, otrosCanales: 0 }, 'Instagram'))
      .toBe('Usaste 0 de 2.000 créditos (0%).')
  })
})
