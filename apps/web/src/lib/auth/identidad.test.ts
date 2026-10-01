import { describe, expect, it } from 'vitest'
import { cambiaDeIdentidad } from './identidad'
import type { AuthUser } from './AuthContext'

const negocio = (id: string) => ({ id, name: 'N', subdomain: 'n', mode: 'x' })

const miembro = (id: string, negocioId = 'b1'): AuthUser => ({
  type: 'member',
  member: { id, name: 'M', email: 'm@x.com' },
  role: 'owner',
  permissions: [],
  business: negocio(negocioId),
})

describe('cambiaDeIdentidad()', () => {
  it('sin nadie en memoria no hay cambio (el wizard se loguea desde anónimo)', () => {
    expect(cambiaDeIdentidad(null, miembro('m1'))).toBe(false)
  })

  it('el mismo miembro del mismo negocio no cambia', () => {
    expect(cambiaDeIdentidad(miembro('m1'), miembro('m1'))).toBe(false)
  })

  it('otro miembro del mismo negocio cambia (POS compartido)', () => {
    expect(cambiaDeIdentidad(miembro('m1'), miembro('m2'))).toBe(true)
  })

  it('el mismo id de miembro en otro negocio cambia', () => {
    expect(cambiaDeIdentidad(miembro('m1', 'b1'), miembro('m1', 'b2'))).toBe(true)
  })

  it('pasar de cliente a miembro cambia', () => {
    const cliente: AuthUser = {
      type: 'customer',
      customer: { id: 'm1', firstName: 'C', lastName: null, email: null, avatarUrl: null },
      business: negocio('b1'),
    }
    expect(cambiaDeIdentidad(cliente, miembro('m1'))).toBe(true)
  })
})
