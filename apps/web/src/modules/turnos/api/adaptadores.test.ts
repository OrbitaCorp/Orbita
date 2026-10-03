import { describe, expect, it } from 'vitest'
import { ahoraDe } from '@/modules/turnos/reloj'
import { SEMANA_PARTIDA } from '@/modules/turnos/horario'
import type { Permisos } from '@/modules/turnos/admin/equipoDemo'
import {
  beneficiosAApi, beneficiosDeApi, cobroOnlineAApi, cobroOnlineDeApi, confirmacionAApi, confirmacionDeApi, estadoAApi, estadoDeApi,
  estadoVisible, fueraDePlazoAApi, fueraDePlazoDeApi, permisosAApi, permisosDeApi, politicaAApi, politicaDeApi, posicionAApi, semanaAApi,
  semanaDeApi, tipoSenaAApi, tipoSenaDeApi, turnoDeApi,
} from './adaptadores'
import type { TurnoDto } from './tipos'

describe('horario semanal', () => {
  it('tramos de la API → texto de la demo', () => {
    const semana = semanaDeApi([[[540, 780], [960, 1200]], [[600, 1080]], [], [], [], [[540, 780]], []])
    expect(semana[0]).toEqual(['Lunes', '09:00 – 13:00 · 16:00 – 20:00'])
    expect(semana[1]).toEqual(['Martes', '10:00 – 18:00'])
    expect(semana[2]).toEqual(['Miércoles', ''])
    expect(semana[6]).toEqual(['Domingo', ''])
    expect(semana).toHaveLength(7)
  })
  it('ordena los tramos y completa días que falten', () => {
    expect(semanaDeApi([[[960, 1200], [540, 780]]])[0][1]).toBe('09:00 – 13:00 · 16:00 – 20:00')
    expect(semanaDeApi([[[540, 600]]]).slice(1).every(([, h]) => h === '')).toBe(true)
  })
  it('texto de la demo → tramos de la API', () => {
    expect(semanaAApi(SEMANA_PARTIDA)).toEqual([
      [[540, 780], [960, 1200]], [[540, 780], [960, 1200]], [[540, 780], [960, 1200]], [[540, 780], [960, 1200]], [[540, 780], [960, 1200]],
      [[540, 780], [960, 1200]], [],
    ])
  })
  it('ida y vuelta', () => {
    const api = [[[420, 780], [1020, 1320]], [], [[0, 1440]], [[540, 780]], [], [], [[600, 720]]] as [number, number][][]
    expect(semanaAApi(semanaDeApi(api))).toEqual(api)
  })
})

describe('estados', () => {
  it('API → demo y vuelta', () => {
    expect(estadoDeApi('PENDING')).toBe('pendiente')
    expect(estadoDeApi('IN_PROGRESS')).toBe('en-curso')
    expect(estadoDeApi('NO_SHOW')).toBe('ausente')
    expect(estadoAApi('en-curso')).toBe('CONFIRMED')
    expect(estadoAApi('completado')).toBe('COMPLETED')
    expect(estadoAApi('cancelado')).toBe('CANCELLED')
  })
  it('"en curso" sale del reloj', () => {
    const t = { status: 'CONFIRMED' as const, startsAt: '2026-10-03T13:00:00.000Z', endsAt: '2026-10-03T13:30:00.000Z' }
    expect(estadoVisible(t, Date.parse('2026-10-03T12:59:00.000Z'))).toBe('CONFIRMED')
    expect(estadoVisible(t, Date.parse('2026-10-03T13:00:00.000Z'))).toBe('IN_PROGRESS')
    expect(estadoVisible(t, Date.parse('2026-10-03T13:30:00.000Z'))).toBe('CONFIRMED')
    expect(estadoVisible({ ...t, status: 'PENDING' }, Date.parse('2026-10-03T13:10:00.000Z'))).toBe('PENDING')
  })
})

const turno = (cambios: Partial<TurnoDto> = {}): TurnoDto => ({
  id: 'a1', code: '4F7K2Q', status: 'CONFIRMED', visibleStatus: 'CONFIRMED', origin: 'STOREFRONT', modality: 'ON_SITE',
  resourceId: 'r1', resourceName: 'Lucas', serviceId: 's1', serviceName: 'Corte', customer: { id: 'c1', name: 'Sofía', phone: '1155550101', email: null },
  date: '2026-10-03', startMin: 600, startsAt: '2026-10-03T13:00:00.000Z', endsAt: '2026-10-03T13:30:00.000Z', durationMin: 30,
  price: 10000, discountAmount: 1000, total: 9000, depositAmount: 0, depositPaid: false, depositPaidAt: null, depositMethod: null,
  rescheduleCount: 0, customerNote: null, internalNote: null, recurringSeriesId: null, ...cambios,
})

describe('turnos', () => {
  it('turno de la API → turno de la agenda, con el día contado desde hoy', () => {
    // Hoy: sábado 3/10 a las 10:10 de Argentina.
    const ahora = ahoraDe(Date.parse('2026-10-03T13:10:00.000Z'))
    expect(turnoDeApi(turno(), ahora)).toEqual({
      id: 'a1', recursoId: 'r1', clienteId: 'c1', servicio: 'Corte', dia: 0, inicio: 600, duracion: 30, precio: 9000, estado: 'en-curso', senaPagada: false,
    })
    const manana = turnoDeApi(turno({ date: '2026-10-04', startsAt: '2026-10-04T13:00:00.000Z', endsAt: '2026-10-04T13:30:00.000Z', internalNote: 'Trae foto' }), ahora)
    expect(manana.dia).toBe(1)
    expect(manana.estado).toBe('confirmado')
    expect(manana.nota).toBe('Trae foto')
  })
  it('el día cruza de mes y de año', () => {
    const ahora = ahoraDe(Date.parse('2026-12-31T23:00:00.000Z')) // 31/12 20:00 en Argentina
    expect(turnoDeApi(turno({ date: '2027-01-02', status: 'PENDING' }), ahora).dia).toBe(2)
    expect(turnoDeApi(turno({ date: '2026-11-30', status: 'COMPLETED' }), ahora)).toMatchObject({ dia: -31, estado: 'completado' })
  })
  it('un cliente sin ficha queda con id vacío', () => {
    const ahora = ahoraDe(Date.parse('2026-10-03T13:10:00.000Z'))
    expect(turnoDeApi(turno({ customer: { id: null, name: 'Ana', phone: '••••', email: null } }), ahora).clienteId).toBe('')
  })
  it('posición de la agenda → fecha y minutos de la API', () => {
    expect(posicionAApi({ dia: 2, inicio: 990, recursoId: 'r2' }, '2026-12-30')).toEqual({ date: '2027-01-01', startMin: 990, resourceId: 'r2' })
    expect(posicionAApi({ inicio: 540 }, '2026-10-03')).toEqual({ date: '2026-10-03', startMin: 540 })
  })
})

describe('valores de configuración', () => {
  it('seña, cobro online, fuera de plazo y confirmación', () => {
    expect(tipoSenaDeApi('percent')).toBe('pct')
    expect(tipoSenaAApi('fijo')).toBe('fixed')
    expect(cobroOnlineDeApi('customer_choice')).toBe('elige')
    expect(cobroOnlineAApi('sena')).toBe('deposit')
    expect(cobroOnlineAApi('total')).toBe('total')
    expect(fueraDePlazoDeApi('credit')).toBe('queda-a-favor')
    expect(fueraDePlazoAApi('se-pierde')).toBe('forfeit')
    expect(confirmacionDeApi('manual')).toBe('manual')
    expect(confirmacionAApi('auto')).toBe('auto')
  })
  it('política y beneficios, ida y vuelta', () => {
    const politica = { cancelUntilHours: 24, depositOutOfWindow: 'credit' as const, toleranceMin: 10 }
    expect(politicaDeApi(politica)).toEqual({ cancelaHasta: 24, senaFueraDePlazo: 'queda-a-favor', tolerancia: 10 })
    expect(politicaAApi(politicaDeApi(politica))).toEqual(politica)
    const cuenta = { accountEnabled: true, welcomeDiscountPercent: 10, loyaltyStamps: 6, promosEnabled: false }
    expect(beneficiosDeApi(cuenta)).toEqual({ activo: true, bienvenida: 10, sellos: 6, promos: false })
    expect(beneficiosAApi(beneficiosDeApi(cuenta))).toEqual(cuenta)
  })
})

describe('permisos por pares', () => {
  const todoNo: Permisos = {
    'agenda.ver': 'no', 'agenda.editar': 'no', 'clientes.ver': 'no', 'clientes.contacto': 'no', 'caja.cobrar': 'no', 'ganancias.ver': 'no',
    'ganancias.liquidar': 'no', 'reportes.ver': 'no', 'servicios.editar': 'no', 'equipo.editar': 'no', 'config.editar': 'no',
  }
  it('base = propio, base + _all = todo, sin punto medio = todo', () => {
    const p = permisosDeApi(['appointments.agenda.view', 'appointments.clients.view', 'appointments.clients.view_all', 'appointments.cash.charge'])
    expect(p['agenda.ver']).toBe('propio')
    expect(p['clientes.ver']).toBe('todo')
    expect(p['caja.cobrar']).toBe('todo')
    expect(p['agenda.editar']).toBe('no')
    // Un _all sin su base no da nada.
    expect(permisosDeApi(['appointments.agenda.view_all'])['agenda.ver']).toBe('no')
  })
  it('alcance → códigos', () => {
    expect(permisosAApi({ ...todoNo, 'agenda.ver': 'todo', 'agenda.editar': 'propio', 'reportes.ver': 'todo' }))
      .toEqual(['appointments.agenda.view', 'appointments.agenda.view_all', 'appointments.agenda.manage', 'appointments.reports.view'])
  })
  it('aplica las dependencias', () => {
    const codigos = permisosAApi({ ...todoNo, 'agenda.ver': 'propio', 'agenda.editar': 'todo', 'clientes.contacto': 'todo', 'ganancias.ver': 'propio', 'ganancias.liquidar': 'todo' })
    expect(codigos).toEqual(['appointments.agenda.view', 'appointments.agenda.manage', 'appointments.earnings.view'])
  })
  it('ida y vuelta', () => {
    const p: Permisos = { ...todoNo, 'agenda.ver': 'todo', 'agenda.editar': 'todo', 'clientes.ver': 'propio', 'clientes.contacto': 'todo', 'ganancias.ver': 'todo', 'ganancias.liquidar': 'todo' }
    expect(permisosDeApi(permisosAApi(p))).toEqual(p)
  })
})
