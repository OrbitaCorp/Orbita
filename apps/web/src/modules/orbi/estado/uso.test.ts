import { describe, expect, it } from 'vitest'
import {
  accionesRecientes, etiquetaDeMes, etiquetaDeTope, fechaDeAccion, leerTope, mostrarBarra, porcentajeDeUso, puedeFijarTopes,
  puedeVerElEquipo, textoDeEstado, textoDeUso, tonoDeUso, valorDelSelector,
} from './uso'

const conTope = { negocio: { porcentaje: 40 }, propio: { porcentaje: 62, topePorcentaje: 50 } }
const sinTope = { negocio: { porcentaje: 62 }, propio: { porcentaje: 10, topePorcentaje: null } }

describe('mostrarBarra', () => {
  it('aparece desde el 50%', () => {
    expect(mostrarBarra(0)).toBe(false)
    expect(mostrarBarra(49)).toBe(false)
    expect(mostrarBarra(50)).toBe(true)
    expect(mostrarBarra(130)).toBe(true)
  })
})

describe('tonoDeUso', () => {
  it('normal hasta 79, alto de 80 a 99, agotado desde 100', () => {
    expect(tonoDeUso(50)).toBe('normal')
    expect(tonoDeUso(79)).toBe('normal')
    expect(tonoDeUso(80)).toBe('alto')
    expect(tonoDeUso(99)).toBe('alto')
    expect(tonoDeUso(100)).toBe('agotado')
    expect(tonoDeUso(140)).toBe('agotado')
  })
})

describe('textoDeUso', () => {
  it('con tope habla de la parte de la persona', () => {
    expect(textoDeUso(conTope)).toBe('Usaste el 62% de tu parte de Orbi este mes')
  })
  it('sin tope habla del negocio', () => {
    expect(textoDeUso(sinTope)).toBe('El negocio usó el 62% de Orbi este mes')
  })
})

describe('porcentajeDeUso', () => {
  it('es el mismo número que dice el texto', () => {
    expect(porcentajeDeUso(conTope)).toBe(62)
    expect(porcentajeDeUso(sinTope)).toBe(62)
  })
})

describe('roles', () => {
  it('el equipo lo ven el dueño y los administradores', () => {
    expect(puedeVerElEquipo('owner')).toBe(true)
    expect(puedeVerElEquipo('admin')).toBe(true)
    expect(puedeVerElEquipo('staff')).toBe(false)
    expect(puedeVerElEquipo(undefined)).toBe(false)
  })
  it('los topes los fija solo el dueño', () => {
    expect(puedeFijarTopes('owner')).toBe(true)
    expect(puedeFijarTopes('admin')).toBe(false)
  })
})

describe('topes', () => {
  it('leerTope acepta enteros de 10 a 100', () => {
    expect(leerTope('10')).toBe(10)
    expect(leerTope(' 100 ')).toBe(100)
    expect(leerTope('9')).toBeNull()
    expect(leerTope('101')).toBeNull()
    expect(leerTope('33.5')).toBeNull()
    expect(leerTope('')).toBeNull()
    expect(leerTope('abc')).toBeNull()
  })
  it('valorDelSelector: los fijos se eligen directo, el resto es "otro"', () => {
    expect(valorDelSelector(null)).toBe('sin')
    expect(valorDelSelector(25)).toBe('25')
    expect(valorDelSelector(75)).toBe('75')
    expect(valorDelSelector(40)).toBe('otro')
  })
  it('etiquetaDeTope', () => {
    expect(etiquetaDeTope(null)).toBe('Sin tope')
    expect(etiquetaDeTope(40)).toBe('40%')
  })
})

describe('acciones', () => {
  const ahora = new Date('2026-10-03T15:00:00Z')
  const accion = (fecha: string | null) => ({ fecha, miembro: 'Ana', tool: 't', resumen: 'r', estado: 'executed' as const })

  it('se quedan las de los últimos 30 días', () => {
    const lista = [accion('2026-10-02T10:00:00Z'), accion('2026-09-04T16:00:00Z'), accion('2026-09-03T14:00:00Z'), accion(null)]
    expect(accionesRecientes(lista, ahora).map(a => a.fecha)).toEqual(['2026-10-02T10:00:00Z', '2026-09-04T16:00:00Z', null])
  })
  it('textoDeEstado', () => {
    expect(textoDeEstado('executed')).toBe('Hecho')
    expect(textoDeEstado('failed')).toBe('Falló')
  })
})

describe('fechas', () => {
  it('etiquetaDeMes', () => {
    expect(etiquetaDeMes('2026-10')).toBe('octubre de 2026')
    expect(etiquetaDeMes('2027-01')).toBe('enero de 2027')
  })
  it('fechaDeAccion va en hora argentina', () => {
    // 01:30 UTC del 2/10 = 22:30 del 1/10 en Buenos Aires.
    expect(fechaDeAccion('2026-10-02T01:30:00Z')).toBe('01/10 22:30')
    expect(fechaDeAccion('2026-10-02T13:05:00Z')).toBe('02/10 10:05')
    expect(fechaDeAccion(null)).toBe('—')
  })
})
