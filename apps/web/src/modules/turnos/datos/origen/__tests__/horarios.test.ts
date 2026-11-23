// Horarios, feriados y vacaciones de Turnos sobre la config y los bloqueos de la API (tarea del 12/11).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Bloqueo, HorarioSemanal, Recurso, Tramo } from '@/lib/reservasApi/tipos'
import { rubroPorKey } from '@/modules/turnos/datos'

const recursos = vi.fn()
const servicios = vi.fn()
const guardarConfig = vi.fn()
const editarRecurso = vi.fn()
const crearBloqueo = vi.fn()
const borrarBloqueo = vi.fn()
vi.mock('@/lib/reservasApi/cliente', () => ({
  panel: {
    recursos: (...a: unknown[]) => recursos(...a),
    servicios: (...a: unknown[]) => servicios(...a),
    guardarConfig: (d: unknown) => guardarConfig(d),
    editarRecurso: (id: string, d: unknown) => editarRecurso(id, d),
    crearBloqueo: (d: unknown) => crearBloqueo(d),
    borrarBloqueo: (id: string) => borrarBloqueo(id),
  },
}))

const { origenApi } = await import('../api')
const {
  MARCA_VACACIONES, bloqueosDeDia, diasCerradosDeBloqueos, errorDiasCerrados, horarioDeSemana, mismoHorario, recortarHorario, semanaDeHorario,
} = await import('../mapear')
type DiasCerrados = import('../mapear').DiasCerrados

const horarios = origenApi.horarios!
const barberia = rubroPorKey('barberia')
const PARTIDO: Tramo[] = [[540, 780], [960, 1200]]
const LUN_SAB: HorarioSemanal = { 1: PARTIDO, 2: PARTIDO, 3: PARTIDO, 4: PARTIDO, 5: PARTIDO, 6: PARTIDO }
const semana = semanaDeHorario(LUN_SAB)

// Un instante de la API para una fecha y un minuto de Argentina (UTC−3).
const instante = (fecha: string, minuto: number) => new Date(Date.parse(`${fecha}T00:00:00Z`) + (minuto + 180) * 60_000).toISOString()
const bloqueo = (id: string, f1: string, m1: number, f2: string, m2: number, motivo: string | null = null, recursoId: string | null = null): Bloqueo =>
  ({ id, modulo: 'TURNOS', recursoId, inicio: instante(f1, m1), fin: instante(f2, m2), motivo, createdAt: '2026-11-01T00:00:00Z' })
const agenda = (id: string, nombre: string, horario: HorarioSemanal | null): Recurso => ({
  id, modulo: 'TURNOS', tipo: 'PROFESIONAL', nombre, descripcion: null, cupo: 1, duracionMinutos: null, pasoMinutos: null, margenMinutos: null,
  maximoSeguidos: 1, precio: 0, horario, datos: null, orden: 0, activo: true,
})
const vacio: DiasCerrados = { especiales: [], vacaciones: false, vacDesde: '', vacHasta: '', vacMensaje: '' }

beforeEach(() => { vi.clearAllMocks(); servicios.mockResolvedValue([]) })

describe('recortar un horario propio al del negocio', () => {
  it('se queda con lo que cae adentro, día por día', () => {
    const propio: HorarioSemanal = { 1: [[600, 1100]], 6: [[960, 1200]] }
    const negocio: HorarioSemanal = { 1: PARTIDO, 6: [[540, 780]] }
    expect(recortarHorario(propio, negocio)).toEqual({ 1: [[600, 780], [960, 1100]] })
  })
  it('compara horarios sin importar los días vacíos', () => {
    expect(mismoHorario({ 1: PARTIDO, 2: [] }, { 1: PARTIDO })).toBe(true)
    expect(mismoHorario({ 1: PARTIDO }, { 1: [[540, 780]] })).toBe(false)
  })
})

describe('feriados y vacaciones desde los bloqueos', () => {
  it('reconoce el día cerrado, el otro horario y las vacaciones', () => {
    const d = diasCerradosDeBloqueos([
      bloqueo('a', '2026-12-25', 0, '2026-12-26', 0, 'Navidad'),
      bloqueo('b', '2026-12-24', 0, '2026-12-24', 600, 'Nochebuena'),
      bloqueo('c', '2026-12-24', 780, '2026-12-25', 0, 'Nochebuena'),
      bloqueo('v', '2027-01-15', 0, '2027-02-01', 0, `${MARCA_VACACIONES}Volvemos en febrero`),
    ])
    expect(d.especiales.map(e => [e.fecha, e.tipo, e.tipo === 'especial' ? e.rango : null, e.motivo, e.bloqueos])).toEqual([
      ['2026-12-24', 'especial', ['10:00', '13:00'], 'Nochebuena', ['b', 'c']],
      ['2026-12-25', 'cerrado', null, 'Navidad', ['a']],
    ])
    expect(d).toMatchObject({ vacaciones: true, vacDesde: '2027-01-15', vacHasta: '2027-01-31', vacMensaje: 'Volvemos en febrero', vacBloqueo: 'v' })
  })

  it('no toma lo que no es de esta pantalla: de un recurso, un rato suelto o varios días', () => {
    const d = diasCerradosDeBloqueos([
      bloqueo('r', '2026-12-25', 0, '2026-12-26', 0, null, 'rec1'),
      bloqueo('m', '2026-12-26', 600, '2026-12-26', 660),
      bloqueo('x', '2026-12-28', 0, '2026-12-30', 0),
    ])
    expect(d).toEqual(vacio)
  })

  it('un otro horario se arma con lo de antes y lo de después, y vuelve igual', () => {
    const e = { id: 'n', fecha: '2026-12-24', motivo: ' Nochebuena ', tipo: 'especial' as const, rango: ['10:00', '13:00'] as [string, string] }
    const armados = bloqueosDeDia(e)
    expect(armados).toEqual([
      { modulo: 'TURNOS', fechaDesde: '2026-12-24', motivo: 'Nochebuena', minutoDesde: 0, minutoHasta: 600 },
      { modulo: 'TURNOS', fechaDesde: '2026-12-24', motivo: 'Nochebuena', minutoDesde: 780, minutoHasta: 1440 },
    ])
    const leido = diasCerradosDeBloqueos([bloqueo('1', '2026-12-24', 0, '2026-12-24', 600, 'Nochebuena'), bloqueo('2', '2026-12-24', 780, '2026-12-25', 0, 'Nochebuena')])
    expect(leido.especiales[0].rango).toEqual(['10:00', '13:00'])
  })
})

describe('qué no se puede guardar', () => {
  const dia = (fecha: string, rango: [string, string], tipo: 'cerrado' | 'especial' = 'especial') => ({ ...vacio, especiales: [{ id: 'x', fecha, motivo: '', tipo, rango }] })
  it('otro horario tiene que estar adentro de lo que abre ese día', () => {
    expect(errorDiasCerrados(dia('2026-12-24', ['10:00', '13:00']), semana)).toBeNull()
    expect(errorDiasCerrados(dia('2026-12-24', ['08:00', '13:00']), semana)?.texto).toContain('09:00 a 20:00')
    expect(errorDiasCerrados(dia('2026-12-27', ['10:00', '13:00']), semana)?.titulo).toBe('El 27/12 no abrís')
    expect(errorDiasCerrados(dia('2026-12-27', ['10:00', '13:00'], 'cerrado'), semana)).toBeNull()
  })
  it('sin fecha, repetido o vacaciones al revés', () => {
    expect(errorDiasCerrados(dia('', ['10:00', '13:00']), semana)?.titulo).toBe('Falta una fecha')
    const e = dia('2026-12-24', ['10:00', '13:00']).especiales[0]
    expect(errorDiasCerrados({ ...vacio, especiales: [e, { ...e, id: 'y' }] }, semana)?.titulo).toContain('dos veces')
    expect(errorDiasCerrados({ ...vacio, vacaciones: true, vacDesde: '2027-01-15', vacHasta: '2027-01-10' }, semana)?.titulo).toBe('Revisá las vacaciones')
  })
})

describe('guardar la semana', () => {
  const nueva = semanaDeHorario({ 1: PARTIDO, 2: PARTIDO, 3: PARTIDO, 4: PARTIDO, 5: PARTIDO, 6: [[540, 780]] })

  it('guarda la config y recorta solo los horarios propios que cambian', async () => {
    const lista = [
      agenda('a', 'Martín', null),
      agenda('b', 'Nico', { 1: [[960, 1200]], 6: [[540, 780], [960, 1200]] }),
      agenda('c', 'Lucas', { 1: [[540, 780]] }),
    ]
    recursos.mockResolvedValue(lista)
    guardarConfig.mockResolvedValue({})
    editarRecurso.mockResolvedValue({})
    const r = await horarios.guardarSemana(nueva, barberia)
    expect(guardarConfig).toHaveBeenCalledWith({ modulo: 'TURNOS', horario: horarioDeSemana(nueva) })
    expect(editarRecurso).toHaveBeenCalledTimes(1)
    expect(editarRecurso).toHaveBeenCalledWith('b', { modulo: 'TURNOS', tipo: 'PROFESIONAL', nombre: 'Nico', horario: { 1: [[960, 1200]], 6: [[540, 780]] } })
    expect(r).toMatchObject({ ajustadas: ['Nico'], sinAjustar: [] })
    expect(r.recursos).toHaveLength(3)
  })

  it('si alguien quedaría sin días no escribe nada y dice quién', async () => {
    recursos.mockResolvedValue([agenda('b', 'Nico', { 6: [[960, 1200]] })])
    await expect(horarios.guardarSemana(nueva, barberia)).rejects.toThrow('Nico se queda sin días')
    expect(guardarConfig).not.toHaveBeenCalled()
    expect(editarRecurso).not.toHaveBeenCalled()
  })
})

describe('guardar feriados y vacaciones', () => {
  const navidad = { id: 'a', fecha: '2026-12-25', motivo: 'Navidad', tipo: 'cerrado' as const, rango: ['09:00', '13:00'] as [string, string], bloqueos: ['a'] }
  const nochebuena = { id: 'n', fecha: '2026-12-24', motivo: '', tipo: 'cerrado' as const, rango: ['09:00', '13:00'] as [string, string] }

  it('solo toca lo que cambió, y crea antes de borrar', async () => {
    const orden: string[] = []
    crearBloqueo.mockImplementation(async () => { orden.push('crear'); return { afectadas: 0 } })
    borrarBloqueo.mockImplementation(async () => { orden.push('borrar'); return { ok: true } })
    const viejo = { id: 'b', fecha: '2026-12-31', motivo: '', tipo: 'cerrado' as const, rango: ['09:00', '13:00'] as [string, string], bloqueos: ['b'] }
    const r = await horarios.guardarDiasCerrados({ ...vacio, especiales: [navidad, viejo] }, { ...vacio, especiales: [navidad, nochebuena] })
    expect(crearBloqueo).toHaveBeenCalledTimes(1)
    expect(crearBloqueo).toHaveBeenCalledWith({ modulo: 'TURNOS', fechaDesde: '2026-12-24' })
    expect(borrarBloqueo).toHaveBeenCalledTimes(1)
    expect(borrarBloqueo).toHaveBeenCalledWith('b')
    expect(orden).toEqual(['crear', 'borrar'])
    expect(r.hayTurnos).toBe(false)
  })

  it('avisa si quedaron turnos adentro, y reemplaza las vacaciones si cambian', async () => {
    crearBloqueo.mockResolvedValue({ afectadas: 2 })
    borrarBloqueo.mockResolvedValue({ ok: true })
    const antes = { ...vacio, vacaciones: true, vacDesde: '2027-01-15', vacHasta: '2027-01-31', vacMensaje: 'Chau', vacBloqueo: 'v' }
    const r = await horarios.guardarDiasCerrados(antes, { ...antes, vacHasta: '2027-02-05' })
    expect(crearBloqueo).toHaveBeenCalledWith({ modulo: 'TURNOS', fechaDesde: '2027-01-15', fechaHasta: '2027-02-05', motivo: `${MARCA_VACACIONES}Chau` })
    expect(borrarBloqueo).toHaveBeenCalledWith('v')
    expect(r.hayTurnos).toBe(true)
  })

  it('apagar las vacaciones las borra', async () => {
    borrarBloqueo.mockResolvedValue({ ok: true })
    const antes = { ...vacio, vacaciones: true, vacDesde: '2027-01-15', vacHasta: '2027-01-31', vacMensaje: 'Chau', vacBloqueo: 'v' }
    await horarios.guardarDiasCerrados(antes, { ...antes, vacaciones: false })
    expect(crearBloqueo).not.toHaveBeenCalled()
    expect(borrarBloqueo).toHaveBeenCalledWith('v')
  })
})
