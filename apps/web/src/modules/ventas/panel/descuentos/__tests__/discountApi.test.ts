import { describe, expect, it } from 'vitest'
import { descuentoInputAApi, filaApiADescuento, detalleApiADescuento, filtroTipoAApi, tipoAApi, tipoDesdeApi, tipoFiltroEsSoportado } from '../hooks/discountApi'
import type { ApiDiscountRow, ApiDiscountDetail } from '@/lib/api'

// El tipo "Oferta relámpago" existe solo en el panel: para la API es un
// PERCENT_PRODUCT con la marca `countdown`. Estas pruebas cubren la traducción
// en los dos sentidos, que es donde un descuido lo convertiría en un
// "% Producto" común (o al revés) sin que nadie lo note.

const fila: ApiDiscountRow = {
  id: 'd1', name: 'Cyber Week', type: 'PERCENT_PRODUCT', value: 40, scope: 'PRODUCT', application: 'AUTOMATIC',
  alcanceResumen: 'remeras', startDate: '2026-09-04T00:00:00.000Z', endDate: '2026-09-13T02:59:00.000Z',
  recurrente: false, maxUsesTotal: null, usesConsumed: 0, isActive: true, estado: 'activo', countdown: true,
  createdAt: '2026-09-04T00:00:00.000Z',
}

describe('discountApi — tipo "Oferta relámpago" ↔ API', () => {
  it('PERCENT_PRODUCT con countdown se lee como oferta relámpago; sin countdown, como % Producto', () => {
    expect(tipoDesdeApi('PERCENT_PRODUCT', true)).toBe('oferta_relampago')
    expect(tipoDesdeApi('PERCENT_PRODUCT', false)).toBe('porcentaje_producto')
    expect(tipoDesdeApi('PERCENT_PRODUCT', undefined)).toBe('porcentaje_producto')
  })

  it('la marca countdown en otro tipo no lo convierte en relámpago', () => {
    // Solo un porcentaje en productos puede ser oferta relámpago; si la base
    // tuviera la marca en otra cosa, el panel no inventa un tipo imposible.
    expect(tipoDesdeApi('AMOUNT_PRODUCT', true)).toBe('monto_fijo_producto')
  })

  it('la fila y el detalle del listado llegan con el tipo traducido', () => {
    expect(filaApiADescuento(fila).tipo).toBe('oferta_relampago')
    expect(filaApiADescuento({ ...fila, countdown: false }).tipo).toBe('porcentaje_producto')
    const detalle: ApiDiscountDetail = {
      ...fila, productLevel: 'padre', minQuantity: null, minAmount: null, activeDays: [], startTime: null, endTime: null,
      maxUsesPerCustomer: null, priority: 0, productIds: ['p1'], categoryIds: [], createdBy: 'm1', updatedAt: fila.createdAt, linkActive: true,
    }
    expect(detalleApiADescuento(detalle).tipo).toBe('oferta_relampago')
    // La fecha de fin viaja intacta: es el instante exacto hasta el que corre el reloj.
    expect(detalleApiADescuento(detalle).fechaFin).toBe('2026-09-13T02:59:00.000Z')
  })

  it('al guardar, la oferta relámpago viaja como PERCENT_PRODUCT + countdown: true', () => {
    const body = descuentoInputAApi({
      nombre: 'Cyber Week', tipo: 'oferta_relampago', valor: 40, alcance: 'producto', productosIds: ['p1'],
      aplicacion: 'automatico', fechaInicio: '2026-09-08', fechaFin: '2026-09-13T02:59:00.000Z', limiteUsosTotal: null,
    })
    expect(body.type).toBe('PERCENT_PRODUCT')
    expect(body.countdown).toBe(true)
    expect(body.endDate).toBe('2026-09-13T02:59:00.000Z')
    expect(body.productIds).toEqual(['p1'])
  })

  it('cualquier otro tipo manda countdown: false explícito (cambiar el tipo apaga el reloj)', () => {
    const body = descuentoInputAApi({
      nombre: 'Promo', tipo: 'porcentaje_producto', valor: 10, alcance: 'producto', productosIds: ['p1'],
      aplicacion: 'automatico', fechaInicio: '2026-09-08', fechaFin: null, limiteUsosTotal: null,
    })
    expect(body.countdown).toBe(false)
  })

  it('el filtro "Tipo: Oferta relámpago" va por la marca, no por la columna type', () => {
    expect(filtroTipoAApi('oferta_relampago')).toEqual({ countdown: true })
    expect(filtroTipoAApi('porcentaje_producto')).toEqual({ type: 'PERCENT_PRODUCT' })
    expect(filtroTipoAApi('todos')).toEqual({})
    expect(tipoFiltroEsSoportado('oferta_relampago')).toBe(true)
    expect(tipoAApi('oferta_relampago')).toBe('PERCENT_PRODUCT')
  })
})
