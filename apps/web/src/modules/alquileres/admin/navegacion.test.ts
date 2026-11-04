import { describe, expect, it } from 'vitest'
import { resolverRuta, seccionesDe } from './navegacion'
import { TIPOS_ORDEN } from '../datos'

describe('seccionesDe', () => {
  it('cada modo tiene ids únicos, arranca con lo de hoy y termina en Calendarios y Configuración', () => {
    for (const tipo of TIPOS_ORDEN) {
      const ids = seccionesDe(tipo).map(s => s.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids.slice(-2)).toEqual(['calendarios', 'configuracion'])
      expect(ids.slice(0, 4)).toContain('ingresos')
      expect(ids[1]).toBe('disponibilidad')
    }
  })

  it('lo que se alquila va en su propio grupo: canchas, salones o propiedades', () => {
    expect(seccionesDe('cancha').filter(s => s.grupo === 'Canchas').map(s => s.id)).toEqual(['unidades', 'extras', 'precios'])
    expect(seccionesDe('bloque').filter(s => s.grupo === 'Salones').map(s => s.id)).toEqual(['salones', 'paquetes', 'extras'])
    expect(seccionesDe('estadia').filter(s => s.grupo === 'Propiedades').map(s => s.id)).toEqual(['propiedades', 'temporadas', 'bloqueos'])
  })

  it('las palabras del rubro cambian el grupo y la gente: salas en vez de canchas, inquilinos en vez de huéspedes', () => {
    const salas = seccionesDe('cancha', { unidades: 'salas', clientes: 'clientes' })
    expect(salas.find(s => s.id === 'unidades')).toMatchObject({ label: 'Salas', grupo: 'Salas' })
    expect(salas.filter(s => s.grupo === 'Salas').map(s => s.id)).toEqual(['unidades', 'extras', 'precios'])
    const deptos = seccionesDe('estadia', { unidades: 'deptos', clientes: 'inquilinos' })
    expect(deptos.find(s => s.id === 'clientes')?.label).toBe('Inquilinos')
    expect(deptos.find(s => s.id === 'propiedades')).toMatchObject({ label: 'Deptos', grupo: 'Deptos' })
    expect(seccionesDe('bloque').find(s => s.id === 'eventos')?.label).toBe('Eventos')
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
    expect(resolverRuta({ vista: 'configuracion', tab: 'salon' }, 'bloque')).toEqual({ vista: 'salones', corregir: true })
    expect(resolverRuta({ vista: 'configuracion', tab: 'propiedades' }, 'estadia')).toEqual({ vista: 'propiedades', corregir: true })
    expect(resolverRuta({ vista: 'configuracion', tab: 'calendarios' }, 'estadia')).toEqual({ vista: 'calendarios', corregir: true })
  })

  it('el link al salón único de antes abre Salones y corrige la URL', () => {
    expect(resolverRuta({ vista: 'salon' }, 'bloque')).toEqual({ vista: 'salones', corregir: true })
    expect(resolverRuta({ vista: 'salones' }, 'bloque')).toEqual({ vista: 'salones', corregir: false })
    expect(resolverRuta({ vista: 'disponibilidad' }, 'estadia')).toEqual({ vista: 'disponibilidad', corregir: false })
  })

  it('un link viejo a algo que este modo no tiene vuelve a la agenda', () => {
    expect(resolverRuta({ vista: 'configuracion', tab: 'salon' }, 'cancha')).toEqual({ vista: 'reservas', corregir: true })
    expect(resolverRuta({ vista: 'salon' }, 'cancha')).toEqual({ vista: 'reservas', corregir: true })
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
