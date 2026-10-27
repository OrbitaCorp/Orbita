import { describe, expect, it } from 'vitest'
import { resolverRuta, seccionesDe } from './navegacion'
import { TIPOS_ORDEN } from '../datos'

describe('seccionesDe', () => {
  it('cada modo tiene ids únicos y termina en Calendarios y Configuración', () => {
    for (const tipo of TIPOS_ORDEN) {
      const ids = seccionesDe(tipo).map(s => s.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids.slice(-2)).toEqual(['calendarios', 'configuracion'])
      expect(ids.slice(0, 3)).toContain('ingresos')
    }
  })

  it('lo que se alquila va en su propio grupo: canchas, salón o propiedades', () => {
    expect(seccionesDe('cancha').filter(s => s.grupo === 'Canchas').map(s => s.id)).toEqual(['unidades', 'extras', 'precios'])
    expect(seccionesDe('bloque').filter(s => s.grupo === 'Salón').map(s => s.id)).toEqual(['salon', 'paquetes', 'extras'])
    expect(seccionesDe('estadia').filter(s => s.grupo === 'Propiedades').map(s => s.id)).toEqual(['propiedades', 'temporadas', 'bloqueos'])
  })

  it('la estadía no tiene Horarios en Configuración (se entra y se sale a la hora de cada propiedad)', () => {
    const subs = (tipo: 'cancha' | 'bloque' | 'estadia') => seccionesDe(tipo).find(s => s.id === 'configuracion')?.subs?.map(s => s.id)
    expect(subs('cancha')).toEqual(['negocio', 'horarios', 'equipo'])
    expect(subs('bloque')).toEqual(['negocio', 'horarios', 'equipo'])
    expect(subs('estadia')).toEqual(['negocio', 'equipo'])
  })
})

describe('resolverRuta', () => {
  it('sin nada en la URL abre la agenda, sin corregir', () => {
    expect(resolverRuta({}, 'cancha')).toEqual({ vista: 'reservas', corregir: false })
  })

  it('los links viejos de Configuración abren la sección nueva y piden reescribir la URL', () => {
    expect(resolverRuta({ vista: 'configuracion', tab: 'reglas' }, 'cancha')).toEqual({ vista: 'reglas', corregir: true })
    expect(resolverRuta({ vista: 'configuracion', tab: 'unidades' }, 'cancha')).toEqual({ vista: 'unidades', corregir: true })
    expect(resolverRuta({ vista: 'configuracion', tab: 'precios' }, 'cancha')).toEqual({ vista: 'precios', corregir: true })
    expect(resolverRuta({ vista: 'configuracion', tab: 'salon' }, 'bloque')).toEqual({ vista: 'salon', corregir: true })
    expect(resolverRuta({ vista: 'configuracion', tab: 'propiedades' }, 'estadia')).toEqual({ vista: 'propiedades', corregir: true })
    expect(resolverRuta({ vista: 'configuracion', tab: 'calendarios' }, 'estadia')).toEqual({ vista: 'calendarios', corregir: true })
  })

  it('un link viejo a algo que este modo no tiene vuelve a la agenda', () => {
    expect(resolverRuta({ vista: 'configuracion', tab: 'salon' }, 'cancha')).toEqual({ vista: 'reservas', corregir: true })
  })

  it('Datos del negocio y Horarios siguen adentro de Configuración', () => {
    expect(resolverRuta({ vista: 'configuracion', tab: 'horarios' }, 'cancha')).toEqual({ vista: 'configuracion', tab: 'horarios', corregir: false })
    expect(resolverRuta({ vista: 'configuracion' }, 'bloque')).toEqual({ vista: 'configuracion', tab: 'negocio', corregir: false })
    // La estadía no tiene Horarios: cae en la primera sub-sección y corrige.
    expect(resolverRuta({ vista: 'configuracion', tab: 'horarios' }, 'estadia')).toEqual({ vista: 'configuracion', tab: 'negocio', corregir: true })
  })

  it('una sección de otro modo o inventada vuelve a la agenda y corrige', () => {
    expect(resolverRuta({ vista: 'eventos' }, 'cancha')).toEqual({ vista: 'reservas', corregir: true })
    expect(resolverRuta({ vista: 'eventos' }, 'bloque')).toEqual({ vista: 'eventos', corregir: false })
    expect(resolverRuta({ vista: 'loquesea' }, 'estadia')).toEqual({ vista: 'reservas', corregir: true })
  })

  it('un tab suelto en una sección sin sub-secciones se limpia', () => {
    expect(resolverRuta({ vista: 'pagos', tab: 'negocio' }, 'cancha')).toEqual({ vista: 'pagos', corregir: true })
  })
})
