// Las traducciones de la API de reservas a los tipos del panel de Turnos
// (datos/origen/mapear.ts) y el origen de la demo, que tiene que dar lo mismo
// que el panel armaba antes por su cuenta.
import { describe, expect, it } from 'vitest'
import type { HorarioSemanal, Recurso as RecursoApi, Reserva } from '@/lib/reservasApi/tipos'
import { rubroPorKey, recursosDe, clientesDe, semanaDe } from '@/modules/turnos/datos'
import { turnosDelDia } from '@/modules/turnos/datos/agenda'
import { SEMANA_PARTIDA } from '@/modules/turnos/horario'
import {
  agendaDeHorario, ahoraArgentina, claveApi, clienteKey, clientesDeReservas, diaDe, estadoDeApi, fechaDe, horarioDeSemana, indicePanel,
  porDia, recursoDeApi, semanaDeHorario, servicioDeApi, turnoDeApi,
} from '../mapear'
import { origenDemo } from '../demo'

const HOY = '2026-11-13'
const barberia = rubroPorKey('barberia')
const PARTIDO: [number, number][] = [[540, 780], [960, 1200]]
// Lunes a sábado partido, domingo cerrado: la semana de ejemplo.
const HORARIO: HorarioSemanal = { 1: PARTIDO, 2: PARTIDO, 3: PARTIDO, 4: PARTIDO, 5: PARTIDO, 6: PARTIDO }

function reserva(p: Partial<Reserva> = {}): Reserva {
  return {
    id: 'r1', modulo: 'TURNOS', recursoId: 'rec1', servicioId: 's1', codigo: 'ABCDEF', estado: 'CONFIRMADA', origen: 'TIENDA',
    inicio: '', fin: '', fecha: HOY, inicioMinutos: 600, finMinutos: 645, cantidad: 1, retenidaHasta: null,
    clienteId: null, clienteNombre: 'Sofía Ramírez', clienteTelefono: '11 5555-0101', clienteEmail: null, notas: null, notaInterna: null,
    servicio: { id: 's1', nombre: 'Corte', duracionMinutos: 45, precio: 12000 }, extras: null, precio: 12000, sena: 0, pagado: 0, pagoMetodo: null,
    confirmadaEn: null, completadaEn: null, canceladaEn: null, canceladaPor: null, motivoCancelacion: null, reprogramaciones: 0, version: 1,
    creadaEn: '2026-11-01T12:00:00Z', ...p,
  }
}

describe('días y fechas', () => {
  it('el lunes del panel (0) es la clave 1 de la API, y el domingo (6) la 0', () => {
    expect(claveApi(0)).toBe('1')
    expect(claveApi(6)).toBe('0')
    for (let i = 0; i < 7; i++) expect(indicePanel(claveApi(i))).toBe(i)
  })
  it('dia y fecha van y vuelven', () => {
    expect(diaDe('2026-11-14', HOY)).toBe(1)
    expect(diaDe('2026-09-12', HOY)).toBe(-62)
    expect(fechaDe(-1, HOY)).toBe('2026-11-12')
  })
  it('ahora en Argentina es UTC−3', () => {
    expect(ahoraArgentina(new Date('2026-11-14T02:30:00Z'))).toEqual({ hoy: '2026-11-13', minutos: 23 * 60 + 30 })
  })
})

describe('horarios', () => {
  it('el horario de la API es la semana de ejemplo, y vuelve igual', () => {
    expect(semanaDeHorario(HORARIO)).toEqual(SEMANA_PARTIDA)
    expect(horarioDeSemana(SEMANA_PARTIDA)).toEqual(HORARIO)
  })
  it('sin horario, todo cerrado', () => {
    expect(semanaDeHorario(null).every(([, h]) => h === '')).toBe(true)
  })
  it('una agenda sin horario propio atiende los días del negocio', () => {
    expect(agendaDeHorario(null, SEMANA_PARTIDA)).toEqual({ atiende: [0, 1, 2, 3, 4, 5], horario: '', dias: 'Lun a sáb' })
  })
  it('una agenda con el horario del negocio en menos días no lleva horario propio', () => {
    const { 1: _lunes, ...sinLunes } = HORARIO
    void _lunes
    expect(agendaDeHorario(sinLunes, SEMANA_PARTIDA)).toMatchObject({ atiende: [1, 2, 3, 4, 5], horario: '' })
  })
  it('una agenda que atiende solo a la tarde lleva su horario', () => {
    const tarde: HorarioSemanal = { 1: [[960, 1200]], 3: [[960, 1200]] }
    expect(agendaDeHorario(tarde, SEMANA_PARTIDA)).toEqual({ atiende: [0, 2], horario: '16:00 – 20:00', dias: 'Lun y mié' })
  })
})

describe('catálogo', () => {
  const api: RecursoApi = {
    id: 'rec1', modulo: 'TURNOS', tipo: 'PROFESIONAL', nombre: 'Martín Sosa', descripcion: null, cupo: 1, duracionMinutos: null, pasoMinutos: null,
    margenMinutos: null, maximoSeguidos: 1, precio: 0, horario: null, datos: null, orden: 0, activo: true,
  }
  it('un profesional sin datos lleva el oficio del rubro y un color de la paleta', () => {
    expect(recursoDeApi(api, barberia, SEMANA_PARTIDA, 0)).toMatchObject({ id: 'rec1', nombre: 'Martín Sosa', rol: barberia.profesional, color: '#3B82F6', horario: '' })
  })
  it('el rol y el color guardados en datos mandan', () => {
    expect(recursoDeApi({ ...api, datos: { rol: 'Colorista', color: '#EC4899' } }, barberia, SEMANA_PARTIDA, 0)).toMatchObject({ rol: 'Colorista', color: '#EC4899' })
  })
  it('un servicio inactivo llega pausado', () => {
    const s = { id: 's1', modulo: 'TURNOS' as const, nombre: 'Corte', descripcion: null, duracionMinutos: 45, precio: 12000, reservableOnline: false, recursoIds: [], orden: 0, activo: false }
    expect(servicioDeApi(s)).toEqual({ id: 's1', nombre: 'Corte', duracion: 45, precio: 12000, online: false, pausado: true })
    expect(servicioDeApi({ ...s, activo: true })).not.toHaveProperty('pausado')
  })
})

describe('agenda', () => {
  it('estados: vencida no se muestra, retenida y pendiente van sin confirmar, la que está pasando va en curso', () => {
    expect(estadoDeApi(reserva({ estado: 'VENCIDA' }), HOY, 0)).toBeNull()
    expect(estadoDeApi(reserva({ estado: 'RETENIDA' }), HOY, 0)).toBe('pendiente')
    expect(estadoDeApi(reserva({ estado: 'PENDIENTE' }), HOY, 0)).toBe('pendiente')
    expect(estadoDeApi(reserva(), HOY, 620)).toBe('en-curso')
    expect(estadoDeApi(reserva(), HOY, 645)).toBe('confirmado')
    expect(estadoDeApi(reserva({ fecha: '2026-11-14' }), HOY, 620)).toBe('confirmado')
    expect(estadoDeApi(reserva({ estado: 'COMPLETADA' }), HOY, 0)).toBe('completado')
    expect(estadoDeApi(reserva({ estado: 'AUSENTE' }), HOY, 0)).toBe('ausente')
    expect(estadoDeApi(reserva({ estado: 'CANCELADA' }), HOY, 0)).toBe('cancelado')
  })
  it('una reserva es un turno con su día, su duración y si pagó la seña', () => {
    expect(turnoDeApi(reserva({ fecha: '2026-11-15', sena: 3000, pagado: 0, notaInterna: 'Trae foto' }), HOY, 0)).toEqual({
      id: 'r1', recursoId: 'rec1', clienteId: 'tel:1155550101', servicio: 'Corte', inicio: 600, duracion: 45, precio: 12000,
      estado: 'confirmado', senaPagada: false, nota: 'Trae foto', dia: 2,
    })
    expect(turnoDeApi(reserva({ sena: 3000, pagado: 3000 }), HOY, 0)?.senaPagada).toBe(true)
    expect(turnoDeApi(reserva(), HOY, 0)?.senaPagada).toBe(true)
  })
  it('por día, ordenados por hora y sin las vencidas', () => {
    const dias = porDia([
      reserva({ id: 'b', inicioMinutos: 900, finMinutos: 945 }),
      reserva({ id: 'a' }),
      reserva({ id: 'v', estado: 'VENCIDA' }),
      reserva({ id: 'ayer', fecha: '2026-11-12' }),
    ], HOY, 0)
    expect(dias.get(0)?.map(t => t.id)).toEqual(['a', 'b'])
    expect(dias.get(-1)?.map(t => t.id)).toEqual(['ayer'])
  })
})

describe('clientes', () => {
  it('la ficha manda; sin ficha, el teléfono, el email o la reserva', () => {
    expect(clienteKey(reserva({ clienteId: 'cus1' }))).toBe('cus1')
    expect(clienteKey(reserva())).toBe('tel:1155550101')
    expect(clienteKey(reserva({ clienteTelefono: null, clienteEmail: 'Sofi@Mail.com' }))).toBe('mail:sofi@mail.com')
    expect(clienteKey(reserva({ clienteTelefono: null }))).toBe('reserva:r1')
  })
  it('un cliente por persona, con sus visitas atendidas, la última y lo que gastó', () => {
    const [sofia] = clientesDeReservas([
      reserva({ id: 'a', estado: 'COMPLETADA', fecha: '2026-10-02', pagado: 12000 }),
      reserva({ id: 'b', estado: 'COMPLETADA', fecha: '2026-10-20', pagado: 15000, clienteNombre: 'Sofía R.', creadaEn: '2026-10-19T00:00:00Z' }),
      reserva({ id: 'c', fecha: '2026-11-20' }),
    ])
    expect(sofia).toEqual({ id: 'tel:1155550101', nombre: 'Sofía Ramírez', telefono: '11 5555-0101', visitas: 2, ultima: '20/10', gastado: 27000 })
  })
})

describe('origen de la demo', () => {
  it('da lo mismo que el panel armaba por su cuenta', async () => {
    for (const key of ['barberia', 'clinica', 'consulta']) {
      const rubro = rubroPorKey(key)
      const d = await origenDemo.cargar(rubro)
      expect(d.recursos.map(r => r.id)).toEqual(recursosDe(rubro).map(r => r.id))
      expect(d.clientes).toEqual(clientesDe(rubro))
      expect(d.servicios.map(s => s.nombre)).toEqual(rubro.servicios.map(s => s.nombre))
      const semana = d.agenda.semana(rubro)
      expect(semana).toEqual(semanaDe(rubro))
      expect(d.agenda.delDia(0, d.recursos, semana)).toEqual(turnosDelDia(rubro, d.recursos, semana, 0))
      expect(d.agenda.delDia(-3, d.recursos, semana)).toEqual(turnosDelDia(rubro, d.recursos, semana, -3))
    }
  })
})
