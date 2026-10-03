import { describe, expect, it } from 'vitest'
import { VENCE_EN_MS, destinosDe, duracion, esConsulta, filaDe, resumenDelResultado, resumenPlegado, vistaDeTarjeta } from './actividad'
import type { OrbiAction } from '@/components/orbi/types'

const T0 = Date.UTC(2026, 9, 2, 17, 32) // 14:32 en Argentina
const accion = (over: Partial<OrbiAction>): OrbiAction => ({ id: 'a', label: 'x', tool: 'listOrders', status: 'complete', ...over })

describe('filas de actividad', () => {
  it('en curso: frase en gerundio y el tiempo que lleva', () => {
    expect(filaDe(accion({ status: 'active', inicio: T0 }), T0 + 300)).toEqual({ id: 'a', estado: 'en_curso', etiqueta: 'Buscando pedidos', resumen: undefined, ms: 300 })
  })

  it('lista: pasado, resumen desde el label del servidor y lo que tardó', () => {
    expect(filaDe(accion({ result: 'Encontré 4 pedidos', inicio: T0, fin: T0 + 800 }), T0 + 5000)).toEqual({
      id: 'a', estado: 'ok', etiqueta: 'Buscó pedidos', resumen: '4 encontrados', ms: 800,
    })
  })

  it('una consulta que falló (label de error del servidor) se ve como error, sin resumen', () => {
    const f = filaDe(accion({ tool: 'listCustomers', result: 'Error listando clientes', inicio: T0, fin: T0 + 2000 }), T0)
    expect(f).toMatchObject({ estado: 'error', etiqueta: 'No pudo leer los clientes', resumen: undefined })
  })

  it('una tool sin frase propia usa la genérica', () => {
    expect(filaDe(accion({ tool: 'algoNuevo' }), T0).etiqueta).toBe('Consultó tus datos')
  })

  it('resumenDelResultado reconoce cantidades, pedidos y temas del manual, y calla lo demás', () => {
    expect(resumenDelResultado('Encontré 1 cliente')).toBe('1 encontrado')
    expect(resumenDelResultado('Encontré 0 productos')).toBe('ninguno')
    expect(resumenDelResultado('Pedido #1024')).toBe('#1024')
    expect(resumenDelResultado('Manual: Envíos')).toBe('Envíos')
    expect(resumenDelResultado('Reporte de ventas obtenido')).toBeUndefined()
  })

  it('las tarjetas y la navegación no son consultas', () => {
    expect(esConsulta(accion({ actionId: 'p1', status: 'pending' }))).toBe(false)
    expect(esConsulta(accion({ tool: 'navigateTo' }))).toBe(false)
    expect(esConsulta(accion({}))).toBe(true)
  })
})

describe('duración', () => {
  it('con una decimal y coma debajo de 10 s; enteros después; minutos', () => {
    expect(duracion(800)).toBe('0,8 s')
    expect(duracion(1150)).toBe('1,2 s')
    expect(duracion(12_400)).toBe('12 s')
    expect(duracion(65_000)).toBe('1 min 5 s')
    expect(duracion(120_000)).toBe('2 min')
  })
})

describe('resumen plegado', () => {
  it('cuenta las consultas y el tiempo total de punta a punta', () => {
    const r = resumenPlegado([
      accion({ id: '1', inicio: T0, fin: T0 + 1200 }),
      accion({ id: '2', inicio: T0 + 1300, fin: T0 + 6000 }),
      accion({ id: '3', actionId: 'p', status: 'pending', inicio: T0 }),
    ])
    expect(r).toEqual({ texto: 'Revisó 2 cosas', tiempo: '6,0 s' })
  })

  it('dice cuántas fallaron; una sola es "cosa"', () => {
    expect(resumenPlegado([accion({ result: 'Error listando pedidos' })])?.texto).toBe('Revisó 1 cosa · 1 falló')
  })

  it('sin consultas no hay línea', () => {
    expect(resumenPlegado([accion({ actionId: 'p', status: 'pending' })])).toBeNull()
  })
})

describe('destinos', () => {
  it('navigateTo con el nombre de la pantalla; el manual con su botón; sin repetir', () => {
    const r = destinosDe([
      accion({ id: 'n', tool: 'navigateTo', data: { path: '/admin/ventas/pedidos', seccion: 'pedidos' } }),
      accion({ id: 'n2', tool: 'navigateTo', data: { path: '/admin/ventas/pedidos', seccion: 'pedidos' } }),
      accion({ id: 'm', tool: 'leerTemaDelManual', result: 'Abrir Zona peligrosa', data: { path: '/admin/ventas/configuracion?vista=peligro' } }),
    ])
    expect(r).toEqual([
      { id: 'n', path: '/admin/ventas/pedidos', label: 'Ir a Pedidos' },
      { id: 'm', path: '/admin/ventas/configuracion?vista=peligro', label: 'Abrir Zona peligrosa' },
    ])
  })
})

describe('tarjeta de aprobación', () => {
  const pendiente = accion({ actionId: 'p', status: 'pending', inicio: T0 })

  it('pendiente: confirmable y con la hora de vencimiento', () => {
    expect(vistaDeTarjeta(pendiente, T0 + 1000)).toMatchObject({ chip: 'Esperando tu aprobación', tono: 'espera', hora: 'vence 14:42', confirmable: true })
  })

  it('a los 10 minutos vence: no se puede confirmar y dice qué hacer', () => {
    expect(vistaDeTarjeta(pendiente, T0 + VENCE_EN_MS)).toMatchObject({ chip: 'Venció', confirmable: false, atenuada: true, pie: expect.stringContaining('Pedile a Orbi') })
  })

  it('aplicada, cancelada, con error y sin saber', () => {
    expect(vistaDeTarjeta({ ...pendiente, status: 'complete', result: 'Pedido #1024 actualizado', fin: T0 + 60_000 }, T0)).toMatchObject({ chip: 'Aplicado', tono: 'ok', hora: '14:33', pie: 'Pedido #1024 actualizado' })
    expect(vistaDeTarjeta({ ...pendiente, status: 'rejected' }, T0)).toMatchObject({ chip: 'Cancelado', pie: 'No se hizo ningún cambio.', atenuada: true })
    expect(vistaDeTarjeta({ ...pendiente, status: 'error', titulo: 'No se aplicó', result: 'El pedido ya estaba enviado' }, T0)).toMatchObject({ chip: 'No se aplicó', tono: 'error' })
    expect(vistaDeTarjeta({ ...pendiente, status: 'unknown' }, T0)).toMatchObject({ reintentable: true, tono: 'duda' })
  })
})
