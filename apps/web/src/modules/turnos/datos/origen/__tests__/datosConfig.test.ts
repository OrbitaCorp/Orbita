// Lo propio de Turnos en `datos` de la config: reglas extra y equipo (decisión del 24/11).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config, Recurso as RecursoApi } from '@/lib/reservasApi/tipos'
import { rubroPorKey } from '@/modules/turnos/datos'
import { rolesDe, type Persona } from '@/modules/turnos/datos/equipo'
import { conCambios, extrasDeDatos, leerDatos } from '../datosConfig'

const config = vi.fn()
const guardarConfig = vi.fn()
const recursos = vi.fn()
const editarRecurso = vi.fn()
vi.mock('@/lib/reservasApi/cliente', () => ({
  panel: {
    config: () => config(),
    guardarConfig: (d: unknown) => guardarConfig(d),
    recursos: () => recursos(),
    editarRecurso: (id: string, d: unknown) => editarRecurso(id, d),
  },
}))
const { equipoApi, origenApi } = await import('../api')

const barberia = rubroPorKey('barberia')
const base: Config = {
  modulo: 'TURNOS', activo: true, confirmacion: 'AUTOMATICA', retencionMinutos: 10, anticipacionMinimaMinutos: 60, anticipacionMaximaDias: 60,
  cancelacionHastaHoras: 24, reprogramacionHastaHoras: 24, reprogramacionesMaximas: 2, senaPorcentaje: 0, senaReembolsable: true,
  maximoActivasPorCliente: 2, listaDeEspera: true, margenMinutos: 0, horario: { 1: [[540, 780]] }, datos: null,
}
const agenda = (id: string, paso: number | null): RecursoApi => ({
  id, modulo: 'TURNOS', tipo: 'PROFESIONAL', nombre: id, descripcion: null, cupo: 1, duracionMinutos: null, pasoMinutos: paso, margenMinutos: null,
  maximoSeguidos: 1, precio: 0, horario: null, datos: null, orden: 0, activo: true,
})

beforeEach(() => { vi.clearAllMocks(); guardarConfig.mockResolvedValue(base); editarRecurso.mockResolvedValue({}) })

describe('leer y escribir datos de la config', () => {
  it('lee lo que tiene forma y deja afuera lo que no', () => {
    const d = leerDatos({ publico: { elegirRecurso: false, tolerancia: '10', senaFueraDePlazo: 'otra', campos: { dni: true } }, turnos: { grilla: 15, equipo: { personas: 'x' } } })
    expect(d.publico).toEqual({ elegirRecurso: false, campos: { obraSocial: false, dni: true, motivo: false } })
    expect(d.turnos).toEqual({ grilla: 15 })
    expect(leerDatos(null)).toEqual({ publico: {}, turnos: {} })
    expect(extrasDeDatos({ publico: { cualquiera: true }, turnos: { grilla: 30 } })).toEqual({ cualquiera: true, grilla: 30 })
  })

  it('cambia solo su parte y conserva lo que puso otro', () => {
    const guardado = { publico: { alias: 'mi.alias', tolerancia: 10 }, turnos: { equipo: { personas: [], roles: [] } }, otra: 1 }
    expect(conCambios(guardado, { publico: { tolerancia: 15 }, turnos: { grilla: 30 } })).toEqual({
      publico: { alias: 'mi.alias', tolerancia: 15 }, turnos: { equipo: { personas: [], roles: [] }, grilla: 30 }, otra: 1,
    })
  })
})

describe('reglas extra', () => {
  const reglas = { minAnt: 60, maxAnt: 60, buffer: 0, confirmacion: 'auto' as const, sena: false, senaPct: 30, reprogramar: true, reproHoras: 24, reproMax: 2, limite: 2, espera: true, cancelaHasta: 24 }
  const extras = { grilla: 15, elegirRecurso: true, cualquiera: false, campos: { obraSocial: false, dni: false, motivo: false }, tolerancia: 10, senaFueraDePlazo: 'se-pierde' as const, cuentas: { activo: true, bienvenida: 10, sellos: 0, promos: false } }

  it('van en una sola escritura de la config, sin pisar el equipo, y la grilla va a cada agenda', async () => {
    const equipo = { personas: [], roles: [] }
    config.mockResolvedValue({ ...base, datos: { turnos: { equipo, grilla: 30 } } })
    recursos.mockResolvedValue([agenda('a', 30), agenda('b', 15)])
    await origenApi.reglas!.guardar(reglas, extras, barberia)
    const enviado = guardarConfig.mock.calls[0][0]
    expect(enviado).toMatchObject({ modulo: 'TURNOS', anticipacionMinimaMinutos: 60 })
    expect(enviado.datos.turnos).toEqual({ equipo, grilla: 15 })
    expect(enviado.datos.publico).toMatchObject({ elegirRecurso: true, tolerancia: 10, cuentas: { bienvenida: 10 } })
    expect(editarRecurso).toHaveBeenCalledTimes(1)
    expect(editarRecurso).toHaveBeenCalledWith('a', { modulo: 'TURNOS', tipo: 'PROFESIONAL', nombre: 'a', pasoMinutos: 15 })
  })

  it('si la grilla no cambia, no toca las agendas', async () => {
    config.mockResolvedValue({ ...base, datos: { turnos: { grilla: 15 } } })
    await origenApi.reglas!.guardar(reglas, extras, barberia)
    expect(recursos).not.toHaveBeenCalled()
    expect(editarRecurso).not.toHaveBeenCalled()
  })
})

describe('el equipo en datos', () => {
  const recurso = (id: string) => ({ id, nombre: id, rol: 'Barbero', color: '#000', atiende: [0], horario: '', dias: 'Lun' })
  const persona = (id: string, recursoId?: string): Persona => ({ id, nombre: id, rolId: 'profesional', email: `${id}@x.invalid`, telefono: '', color: '#000', pago: null, ...(recursoId ? { recursoId } : {}) })

  it('se guarda sin pisar las reglas', async () => {
    config.mockResolvedValue({ ...base, datos: { publico: { tolerancia: 10 }, turnos: { grilla: 30 } } })
    const roles = rolesDe(barberia)
    await origenApi.equipo!.guardar([persona('ana', 'r1')], roles)
    expect(guardarConfig.mock.calls[0][0].datos).toEqual({ publico: { tolerancia: 10 }, turnos: { grilla: 30, equipo: { personas: [persona('ana', 'r1')], roles } } })
  })

  it('al leerlo, quien perdió su agenda la suelta, y una agenda sin persona suma a quien atiende ahí', () => {
    const guardado = { personas: [persona('ana', 'r1'), persona('caro'), persona('beto', 'ya-no-esta')], roles: rolesDe(barberia) }
    const { personas } = equipoApi(barberia, [recurso('r1'), recurso('r2')], { r2: 'aprendiz' }, guardado)
    expect(personas.map(p => [p.id, p.recursoId ?? null, p.rolId])).toEqual([
      ['ana', 'r1', 'profesional'], ['caro', null, 'profesional'], ['beto', null, 'profesional'], ['p-r2', 'r2', 'aprendiz'],
    ])
  })
})
