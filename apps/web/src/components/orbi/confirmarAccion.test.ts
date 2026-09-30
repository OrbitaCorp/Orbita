import { describe, expect, it } from 'vitest'
import {
  ESPERAS_REINTENTO_MS,
  EVENTO_ACCION_EJECUTADA,
  MENSAJE_DESACTUALIZADA,
  MENSAJE_NO_DISPONIBLE,
  confirmarConReintentos,
  interpretarRespuestaCancelar,
  interpretarRespuestaConfirmar,
  queriesARefrescar,
  recargaProductos,
  siguienteEstado,
  siguienteEstadoAlCancelar,
  type RespuestaConfirmar,
} from './confirmarAccion'

// Tabla de §3.9 del spec: qué hace la tarjeta con cada respuesta de
// POST /orbi/confirm y de POST /orbi/reject. Es lógica pura: la tarjeta y
// useOrbiChat solo la aplican.

const PEDISELA = /ped[ií]sela/i

describe('siguienteEstado (respuesta de confirmar)', () => {
  it('200 con éxito: complete con el resultado', () => {
    const paso = siguienteEstado({ http: 200, body: { success: true, label: 'Cupón "VERANO" creado', data: { couponId: 'c1' } } })
    expect(paso).toEqual({ estado: 'complete', reintentar: false, mensaje: 'Cupón "VERANO" creado' })
  })

  it('200 con success:false: error con el motivo', () => {
    const paso = siguienteEstado({ http: 200, body: { success: false, error: 'El código ya existe', label: 'createCoupon' } })
    expect(paso).toEqual({ estado: 'error', reintentar: false, mensaje: 'El código ya existe' })
  })

  it('200 desactualizada: error que pide pedírsela de nuevo', () => {
    const paso = siguienteEstado({ http: 200, body: { success: false, error: 'desactualizada', label: 'updateOrderStatus' } })
    expect(paso).toEqual({ estado: 'error', reintentar: false, mensaje: MENSAJE_DESACTUALIZADA })
    expect(paso.mensaje).toMatch(PEDISELA)
  })

  it('200 con error interno: no muestra la palabra cruda "interno"', () => {
    const paso = siguienteEstado({ http: 200, body: { success: false, error: 'interno', label: 'createCoupon' } })
    expect(paso.estado).toBe('error')
    expect(paso.mensaje).not.toBe('interno')
    expect(paso.mensaje).not.toMatch(PEDISELA)
  })

  it('404: error "ya no está disponible", único con "pedísela de nuevo" junto a desactualizada', () => {
    const paso = siguienteEstado({ http: 404 })
    expect(paso).toEqual({ estado: 'error', reintentar: false, mensaje: MENSAJE_NO_DISPONIBLE })
    expect(paso.mensaje).toBe('Esa acción ya no está disponible. Pedísela a Orbi de nuevo.')
  })

  it('409 aplicando: sigue en active y pide reintentar', () => {
    const paso = siguienteEstado({ http: 409, body: { estado: 'aplicando' } })
    expect(paso.estado).toBe('active')
    expect(paso.reintentar).toBe(true)
  })

  it('409 desconocido: unknown con dónde revisarlo', () => {
    const paso = siguienteEstado({ http: 409, body: { estado: 'desconocido' } }, 'createCoupon')
    expect(paso.estado).toBe('unknown')
    expect(paso.reintentar).toBe(false)
    expect(paso.mensaje).toMatch(/No sé si se aplicó/)
    expect(paso.mensaje).toMatch(/Cupones/)
  })

  it('red caída: unknown', () => {
    const paso = siguienteEstado({ http: 'red' }, 'createProduct')
    expect(paso.estado).toBe('unknown')
    expect(paso.reintentar).toBe(false)
    expect(paso.mensaje).toMatch(/Productos/)
  })

  it('500: unknown', () => {
    const paso = siguienteEstado({ http: 500 })
    expect(paso.estado).toBe('unknown')
    expect(paso.mensaje).toMatch(/el panel/)
  })

  it('nunca le dice "pedísela de nuevo" a un unknown', () => {
    const respuestas: RespuestaConfirmar[] = [
      { http: 409, body: { estado: 'desconocido' } },
      { http: 'red' },
      { http: 500 },
    ]
    for (const r of respuestas) {
      for (const tool of [undefined, 'createCoupon', 'createDiscount', 'createProduct', 'updateOrderStatus', 'toolRara']) {
        const paso = siguienteEstado(r, tool)
        expect(paso.estado).toBe('unknown')
        expect(paso.mensaje ?? '').not.toMatch(PEDISELA)
      }
    }
  })
})

describe('interpretarRespuestaConfirmar (HTTP crudo → respuesta tipada)', () => {
  it('200 con ToolResult', () => {
    expect(interpretarRespuestaConfirmar(200, { success: true, label: 'Listo', data: { x: 1 } }))
      .toEqual({ http: 200, body: { success: true, label: 'Listo', data: { x: 1 } } })
  })

  it('409 lee `estado` del cuerpo de Nest (que también trae error y statusCode)', () => {
    const cuerpo = { estado: 'aplicando', mensaje: 'Esa acción se está aplicando.', error: 'Conflict', statusCode: 409 }
    expect(interpretarRespuestaConfirmar(409, cuerpo)).toEqual({ http: 409, body: { estado: 'aplicando', mensaje: 'Esa acción se está aplicando.' } })
    expect(interpretarRespuestaConfirmar(409, { estado: 'desconocido' })).toEqual({ http: 409, body: { estado: 'desconocido' } })
  })

  it('404', () => {
    expect(interpretarRespuestaConfirmar(404, { message: 'x' })).toEqual({ http: 404 })
  })

  it('cualquier otra cosa (5xx, 403, 429, cuerpo raro) cae en "no sé": nunca afirma algo que no sabe', () => {
    expect(interpretarRespuestaConfirmar(502, null)).toEqual({ http: 500 })
    expect(interpretarRespuestaConfirmar(403, { message: 'no' })).toEqual({ http: 500 })
    expect(interpretarRespuestaConfirmar(200, null)).toEqual({ http: 500 })
    expect(interpretarRespuestaConfirmar(409, { estado: 'otro' })).toEqual({ http: 500 })
  })
})

describe('confirmarConReintentos', () => {
  const sinEsperar = () => {
    const esperas: number[] = []
    return { esperas, esperar: async (ms: number) => { esperas.push(ms) } }
  }

  it('409 aplicando reintenta el MISMO actionId con espera creciente hasta el 200', async () => {
    const pedidos: string[] = []
    const respuestas: RespuestaConfirmar[] = [
      { http: 409, body: { estado: 'aplicando' } },
      { http: 409, body: { estado: 'aplicando' } },
      { http: 200, body: { success: true, label: 'Listo', data: { productId: 'p1' } } },
    ]
    const { esperas, esperar } = sinEsperar()
    const final = await confirmarConReintentos('acc-1', async (id) => { pedidos.push(id); return respuestas.shift()! }, esperar)

    expect(pedidos).toEqual(['acc-1', 'acc-1', 'acc-1'])
    expect(esperas).toEqual([500, 1000])
    expect(final).toMatchObject({ estado: 'complete', mensaje: 'Listo', data: { productId: 'p1' } })
  })

  it('tope de 5 reintentos con [500, 1000, 2000, 4000, 8000] ms; después queda unknown, sin "pedísela"', async () => {
    const pedidos: string[] = []
    const { esperas, esperar } = sinEsperar()
    const final = await confirmarConReintentos(
      'acc-2',
      async (id) => { pedidos.push(id); return { http: 409, body: { estado: 'aplicando' } } },
      esperar,
      'createDiscount',
    )

    expect(ESPERAS_REINTENTO_MS).toEqual([500, 1000, 2000, 4000, 8000])
    expect(esperas).toEqual([500, 1000, 2000, 4000, 8000])
    expect(pedidos).toHaveLength(6)
    expect(new Set(pedidos)).toEqual(new Set(['acc-2']))
    expect(final.estado).toBe('unknown')
    expect(final.mensaje).toMatch(/Descuentos/)
    expect(final.mensaje).not.toMatch(PEDISELA)
  })

  it('si pedir tira (red caída) queda unknown y no reintenta solo', async () => {
    const { esperas, esperar } = sinEsperar()
    let llamadas = 0
    const final = await confirmarConReintentos('acc-3', async () => { llamadas++; throw new TypeError('Failed to fetch') }, esperar)
    expect(llamadas).toBe(1)
    expect(esperas).toEqual([])
    expect(final.estado).toBe('unknown')
  })

  it('Reintentar desde unknown vuelve a mandar el mismo actionId (confirmar es idempotente)', async () => {
    const pedidos: string[] = []
    const { esperar } = sinEsperar()
    const pedir = async (id: string): Promise<RespuestaConfirmar> => {
      pedidos.push(id)
      return pedidos.length === 1 ? { http: 'red' } : { http: 200, body: { success: true, label: 'Listo' } }
    }
    const primero = await confirmarConReintentos('acc-4', pedir, esperar)
    expect(primero.estado).toBe('unknown')
    const segundo = await confirmarConReintentos('acc-4', pedir, esperar)
    expect(segundo.estado).toBe('complete')
    expect(pedidos).toEqual(['acc-4', 'acc-4'])
  })
})

describe('cancelar (POST /orbi/reject)', () => {
  it('interpreta las respuestas', () => {
    expect(interpretarRespuestaCancelar(200, { ok: true })).toEqual({ http: 200 })
    expect(interpretarRespuestaCancelar(404, {})).toEqual({ http: 404 })
    expect(interpretarRespuestaCancelar(409, { estado: 'ya_aplicada', result: { success: true, label: 'Listo' }, statusCode: 409 }))
      .toEqual({ http: 409, body: { estado: 'ya_aplicada', result: { success: true, label: 'Listo' } } })
    expect(interpretarRespuestaCancelar(403, {})).toEqual({ http: 500 })
    expect(interpretarRespuestaCancelar(503, null)).toEqual({ http: 500 })
  })

  it('200: rejected', () => {
    expect(siguienteEstadoAlCancelar({ http: 200 })).toMatchObject({ estado: 'rejected' })
  })

  it('409 ya_aplicada con éxito: complete con el resultado guardado y "Ya se aplicó"', () => {
    const paso = siguienteEstadoAlCancelar({ http: 409, body: { estado: 'ya_aplicada', result: { success: true, label: 'Cupón creado', data: { couponId: 'c' } } } })
    expect(paso).toMatchObject({ estado: 'complete', mensaje: 'Cupón creado', nota: 'Ya se aplicó', data: { couponId: 'c' } })
  })

  it('409 ya_aplicada que había fallado: error con el motivo guardado', () => {
    const paso = siguienteEstadoAlCancelar({ http: 409, body: { estado: 'ya_aplicada', result: { success: false, error: 'desactualizada', label: 'x' } } })
    expect(paso.estado).toBe('error')
    expect(paso.mensaje).toBe(MENSAJE_DESACTUALIZADA)
    expect(paso.nota).toBeTruthy()
  })

  it('404: no afirma que no se hizo nada (pudo estar aplicándose) y no dice "pedísela"', () => {
    const paso = siguienteEstadoAlCancelar({ http: 404 }, 'createCoupon')
    expect(paso.estado).toBe('error')
    expect(paso.mensaje).toMatch(/Cupones/)
    expect(paso.mensaje).not.toMatch(PEDISELA)
  })

  it('red o 5xx: la tarjeta vuelve a pending con un aviso (cancelar no escribe nada)', () => {
    expect(siguienteEstadoAlCancelar({ http: 'red' })).toMatchObject({ estado: 'pending' })
    expect(siguienteEstadoAlCancelar({ http: 500 }).nota).toBeTruthy()
  })
})

describe('refresco de pantalla tras un confirmar exitoso', () => {
  it('createDiscount y createCoupon invalidan descuentos y cupones', () => {
    expect(queriesARefrescar('createDiscount')).toEqual([['descuentos'], ['cupones']])
    expect(queriesARefrescar('createCoupon')).toEqual([['descuentos'], ['cupones']])
    expect(queriesARefrescar('createProduct')).toEqual([])
    expect(queriesARefrescar('updateOrderStatus')).toEqual([])
  })

  it('ProductoLista recarga solo con createProduct', () => {
    expect(EVENTO_ACCION_EJECUTADA).toBe('orbi:accion-ejecutada')
    expect(recargaProductos({ tool: 'createProduct', data: { productId: 'p' } })).toBe(true)
    expect(recargaProductos({ tool: 'createCoupon' })).toBe(false)
    expect(recargaProductos(null)).toBe(false)
    expect(recargaProductos('createProduct')).toBe(false)
  })
})
