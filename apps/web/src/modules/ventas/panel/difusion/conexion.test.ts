import { describe, expect, it } from 'vitest'
import type { InstagramEstado } from '@/lib/api'
import { abreElModalSolo, pasosHechos } from './conexion'

const estado = (e: Record<string, unknown>) => e as unknown as InstagramEstado

describe('conexión de Instagram en Difusión', () => {
  const sinPedido = estado({ connected: false, habilitado: false, solicitud: null })
  const pendiente = estado({ connected: false, habilitado: false, solicitud: { username: 'tienda' } })
  const paraConectar = estado({ connected: false, habilitado: true })
  const conectado = estado({ connected: true, username: 'tienda' })

  it('cuenta los pasos hechos', () => {
    expect([null, sinPedido, pendiente, paraConectar, conectado].map(pasosHechos)).toEqual([0, 0, 1, 2, 3])
  })

  it('el modal se abre solo únicamente en el paso 3', () => {
    expect([null, sinPedido, pendiente, paraConectar, conectado].map(abreElModalSolo)).toEqual([false, false, false, true, false])
  })

  it('sin el dato de habilitación (acceso ya abierto) también es paso 3', () => {
    expect(abreElModalSolo(estado({ connected: false }))).toBe(true)
  })
})
