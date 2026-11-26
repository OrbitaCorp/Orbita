// El alta real de Turnos: lo que viaja a la API para que el negocio nazca con su agenda.
import { describe, expect, it } from 'vitest'
import { rubroPorKey } from '@/modules/turnos/datos'
import { DATOS_INICIALES, serviciosIniciales, type DatosAlta } from '../modelo'
import { altaTurnosDe } from '../altaTurnos'

const datos = (extra: Partial<DatosAlta> = {}): DatosAlta => ({
  ...DATOS_INICIALES, modulo: 'turnos', negocio: 'Barbería Ríos', nombre: ' Martín Ríos ', ...extra,
})

describe('alta real de Turnos', () => {
  it('lleva el horario del negocio en la forma del motor (0 = domingo), la seña, al dueño como agenda y los servicios', () => {
    const barberia = rubroPorKey('barberia')
    const servicios = [{ id: 'a', nombre: ' Corte ', duracion: 30, precio: 12000 }, { id: 'b', nombre: '', duracion: 20, precio: 0 }]
    const a = altaTurnosDe(datos(), barberia, servicios, 30)
    expect(a.rubro).toBe('barberia')
    // De lunes a sábado (los días de fábrica), mañana y tarde; el domingo cerrado.
    expect(a.horario['1']).toEqual([[540, 780], [960, 1200]])
    expect(a.horario['6']).toEqual([[540, 780], [960, 1200]])
    expect(a.horario['0'] ?? []).toEqual([])
    expect(a.senaPorcentaje).toBe(30)
    expect(a.agenda).toEqual({ tipo: 'PROFESIONAL', nombre: 'Martín Ríos', rol: barberia.profesional, color: '#3B82F6' })
    // El servicio sin nombre no viaja.
    expect(a.servicios).toEqual([{ nombre: 'Corte', duracionMinutos: 30, precio: 12000 }])
  })

  it('sin servicios con nombre van los típicos del rubro', () => {
    const barberia = rubroPorKey('barberia')
    const a = altaTurnosDe(datos(), barberia, [], 0)
    expect(a.servicios.map(s => s.nombre)).toEqual(serviciosIniciales(barberia).map(s => s.nombre))
  })

  it('en un rubro por sala la primera agenda es un espacio', () => {
    const estetica = rubroPorKey('estetica')
    const a = altaTurnosDe(datos(), estetica, serviciosIniciales(estetica), estetica.sena)
    expect(a.agenda.tipo).toBe('ESPACIO')
    expect(a.agenda.rol).toBe('Espacio')
    expect(a.agenda.nombre).not.toBe('Martín Ríos')
  })
})
