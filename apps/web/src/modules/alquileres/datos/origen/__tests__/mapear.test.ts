import { describe, expect, it } from 'vitest'
import type { Bloqueo as BloqueoApi, Config, Recurso, Reserva as ReservaApi, Servicio } from '@/lib/reservasApi/tipos'
import {
  aperturaDeHorario, bloqueosDeApi, clienteIdDe, clientesDeReservas, estadoDeApi, fechaArgentina, negocioDeApi,
  propiedadDeApi, reservaDeApi, salonDeApi, tipoDeRecurso, tipoDeRubro, unidadDeApi,
} from '../mapear'

const recurso = (r: Partial<Recurso> = {}): Recurso => ({
  id: 'r1', modulo: 'ALQUILERES', tipo: 'CANCHA', nombre: 'Cancha 1', descripcion: null, cupo: 1,
  duracionMinutos: 60, pasoMinutos: 60, margenMinutos: null, maximoSeguidos: 3, precio: 45000,
  horario: null, datos: null, orden: 0, activo: true, ...r,
})

const servicio = (s: Partial<Servicio> = {}): Servicio => ({
  id: 's1', modulo: 'ALQUILERES', nombre: 'Clásico', descripcion: null, duracionMinutos: 240, precio: 200000,
  reservableOnline: true, recursoIds: [], orden: 0, activo: true, ...s,
})

const reserva = (r: Partial<ReservaApi> = {}): ReservaApi => ({
  id: 'x1', modulo: 'ALQUILERES', recursoId: 'r1', servicioId: null, codigo: 'ABCDEF', estado: 'CONFIRMADA', origen: 'TIENDA',
  inicio: '2026-11-20T20:00:00.000Z', fin: '2026-11-20T21:00:00.000Z', fecha: '2026-11-20', inicioMinutos: 1020, finMinutos: 1080,
  cantidad: 1, retenidaHasta: null, clienteId: null, clienteNombre: 'Sofía Paz', clienteTelefono: '0000 11-2233', clienteEmail: null,
  notas: null, notaInterna: null, servicio: null, extras: null, precio: 40000, sena: 0, pagado: 0, pagoMetodo: null,
  confirmadaEn: null, completadaEn: null, canceladaEn: null, canceladaPor: null, motivoCancelacion: null, reprogramaciones: 0,
  version: 1, creadaEn: '2026-11-10T15:00:00.000Z', ...r,
})

const config = (c: Partial<Config> = {}): Config => ({
  modulo: 'ALQUILERES', activo: true, confirmacion: 'AUTOMATICA', retencionMinutos: 15, anticipacionMinimaMinutos: 0,
  anticipacionMaximaDias: 180, cancelacionHastaHoras: 48, reprogramacionHastaHoras: 48, reprogramacionesMaximas: 1,
  senaPorcentaje: 30, senaReembolsable: true, maximoActivasPorCliente: 0, listaDeEspera: false, margenMinutos: 0, horario: {}, ...c,
})

describe('fechaArgentina', () => {
  it('toma el día de Argentina (UTC−3), no el de UTC', () => {
    expect(fechaArgentina('2026-11-20T13:00:00.000Z')).toBe('2026-11-20')
    expect(fechaArgentina('2026-11-21T02:30:00.000Z')).toBe('2026-11-20')
  })
})

describe('tipoDeRecurso y tipoDeRubro', () => {
  it('cada modo tiene su tipo de recurso', () => {
    expect(tipoDeRecurso('cancha')).toBe('CANCHA')
    expect(tipoDeRecurso('bloque')).toBe('SALON')
    expect(tipoDeRecurso('estadia')).toBe('ALOJAMIENTO')
  })
  it('el modo sale del primer subrubro conocido', () => {
    expect(tipoDeRubro(['cabana'])).toEqual({ tipo: 'estadia', rubro: 'cabana' })
    expect(tipoDeRubro(['no-existe', 'salon-cumples'])).toEqual({ tipo: 'bloque', rubro: 'salon-cumples' })
  })
  it('sin subrubro conocido, canchas', () => {
    expect(tipoDeRubro(['no-existe'])).toEqual({ tipo: 'cancha', rubro: 'canchas' })
    expect(tipoDeRubro(null)).toEqual({ tipo: 'cancha', rubro: 'canchas' })
  })
})

describe('estadoDeApi', () => {
  it('traduce los siete estados', () => {
    expect(estadoDeApi('VENCIDA')).toBeNull()
    expect(estadoDeApi('RETENIDA')).toBe('pendiente')
    expect(estadoDeApi('PENDIENTE')).toBe('pendiente')
    expect(estadoDeApi('CONFIRMADA')).toBe('confirmada')
    expect(estadoDeApi('COMPLETADA')).toBe('completada')
    expect(estadoDeApi('AUSENTE')).toBe('cancelada')
    expect(estadoDeApi('CANCELADA')).toBe('cancelada')
  })
})

describe('unidadDeApi', () => {
  it('la tarifa por hora sale del precio de la franja', () => {
    const u = unidadDeApi(recurso({ precio: 30000, duracionMinutos: 30, descripcion: 'Pádel', datos: { foto: '/f.jpg' } }))
    expect(u).toEqual({ id: 'r1', nombre: 'Cancha 1', detalle: 'Pádel', tarifaHora: 60000, foto: '/f.jpg' })
  })
})

describe('salonDeApi', () => {
  it('los paquetes son los servicios activos de ese salón', () => {
    const salon = recurso({ id: 'sa', tipo: 'SALON', duracionMinutos: 240, margenMinutos: 60, datos: { capacidad: 60, deposito: 50000 } })
    const s = salonDeApi(salon, [
      servicio({ id: 'p1', recursoIds: ['sa'], descripcion: 'Torta\nDJ' }),
      servicio({ id: 'p2', recursoIds: ['otro'] }),
      servicio({ id: 'p3', recursoIds: ['sa'], activo: false }),
    ])
    expect(s.duracionBloque).toBe(240)
    expect(s.limpieza).toBe(60)
    expect(s.capacidad).toBe(60)
    expect(s.deposito).toBe(50000)
    expect(s.paquetes).toEqual([{ id: 'p1', nombre: 'Clásico', precio: 200000, hastaInvitados: 60, incluye: ['Torta', 'DJ'] }])
  })
})

describe('propiedadDeApi', () => {
  it('lee check-in, noches mínimas y la tarifa de datos, con los defaults del servidor', () => {
    const p = propiedadDeApi(recurso({ tipo: 'ALOJAMIENTO', precio: 80000, datos: { checkIn: 900, nochesMinimas: 2, tarifa: { limpieza: 15000 } } }))
    expect(p.checkIn).toBe(900)
    expect(p.checkOut).toBe(600)
    expect(p.tarifa).toEqual({ precioNoche: 80000, temporadas: [], finDeSemanaPct: 0, limpieza: 15000, minNoches: 2 })
    expect(p.modalidad).toBe('noche')
  })
  it('un campo con otro tipo toma el default', () => {
    const p = propiedadDeApi(recurso({ tipo: 'ALOJAMIENTO', datos: { huespedes: 'cuatro', tipo: 'Castillo' } }))
    expect(typeof p.huespedes).toBe('number')
    expect(p.tipo).toBe('Cabaña')
  })
})

describe('reservaDeApi', () => {
  it('una estadía va con entrada y salida en días de Argentina', () => {
    const r = reservaDeApi(reserva({ fecha: '2026-11-20', inicio: '2026-11-20T17:00:00.000Z', fin: '2026-11-23T13:00:00.000Z' }), recurso({ tipo: 'ALOJAMIENTO' }))
    expect(r?.entrada).toBe('2026-11-20')
    expect(r?.salida).toBe('2026-11-23')
    expect(r?.fecha).toBeUndefined()
  })
  it('una cancha va con fecha, inicio y fin', () => {
    const r = reservaDeApi(reserva(), recurso())
    expect(r).toMatchObject({ fecha: '2026-11-20', inicio: 1020, fin: 1080, unidadId: 'r1', estado: 'confirmada', creada: '2026-11-10' })
  })
  it('una vencida no se muestra', () => {
    expect(reservaDeApi(reserva({ estado: 'VENCIDA' }), recurso())).toBeNull()
  })
  it('la seña pagada y el saldo salen de lo pagado', () => {
    const r = reservaDeApi(reserva({ sena: 10000, pagado: 10000, precio: 40000 }), recurso())
    expect(r?.senaPagada).toBe(true)
    expect(r?.saldoPagado).toBe(false)
    expect(r?.total).toBe(40000)
  })
  it('los extras van por id y la nota interna gana', () => {
    const r = reservaDeApi(reserva({ extras: [{ id: 'luz', nombre: 'Luz', precio: 5000 }], notas: 'del cliente', notaInterna: 'del negocio' }), recurso())
    expect(r?.extras).toEqual(['luz'])
    expect(r?.nota).toBe('del negocio')
  })
})

describe('clientes', () => {
  it('sin ficha, el cliente es su teléfono (solo dígitos)', () => {
    expect(clienteIdDe(reserva({ clienteTelefono: '3757 55-0101' }))).toBe('tel:3757550101')
    expect(clienteIdDe(reserva({ clienteTelefono: null, clienteEmail: 'Ana@Mail.com' }))).toBe('mail:ana@mail.com')
    expect(clienteIdDe(reserva({ clienteTelefono: null, clienteEmail: null, clienteNombre: 'Ana Gil' }))).toBe('nom:ana gil')
    expect(clienteIdDe(reserva({ clienteId: 'c-9' }))).toBe('c-9')
  })
  it('dos reservas con el mismo teléfono son un solo cliente', () => {
    const cs = clientesDeReservas([reserva({ id: 'a', clienteTelefono: '3757 55-0101' }), reserva({ id: 'b', clienteTelefono: '3757550101' })])
    expect(cs).toHaveLength(1)
    expect(cs[0]).toMatchObject({ id: 'tel:3757550101', nombre: 'Sofía Paz', telefono: '3757 55-0101' })
  })
})

describe('bloqueosDeApi', () => {
  const b = (x: Partial<BloqueoApi> = {}): BloqueoApi => ({
    id: 'b1', modulo: 'ALQUILERES', recursoId: 'a', inicio: '2026-11-25T03:00:00.000Z', fin: '2026-11-27T03:00:00.000Z', motivo: 'Pintura', createdAt: '2026-11-01T00:00:00.000Z', ...x,
  })
  it('un bloqueo de una unidad queda con sus días de Argentina', () => {
    expect(bloqueosDeApi([b()], ['a', 'b'])).toEqual([{ id: 'b1', unidadId: 'a', desde: '2026-11-25', hasta: '2026-11-27', motivo: 'Pintura', origen: 'dueno' }])
  })
  it('un bloqueo de todo el negocio se reparte en cada unidad', () => {
    const bs = bloqueosDeApi([b({ recursoId: null, motivo: null })], ['a', 'b'])
    expect(bs.map(x => x.unidadId)).toEqual(['a', 'b'])
    expect(new Set(bs.map(x => x.id)).size).toBe(2)
    expect(bs[0].motivo).toBe('Bloqueado')
  })
})

describe('aperturaDeHorario', () => {
  it('los días van con lunes en 0 y el tramo del más temprano al más tarde', () => {
    expect(aperturaDeHorario({ '1': [[540, 780], [960, 1320]], '6': [[600, 1200]] })).toEqual({ dias: [0, 5], desde: 540, hasta: 1320 })
    expect(aperturaDeHorario({ '0': [[600, 1200]] })).toEqual({ dias: [6], desde: 600, hasta: 1200 })
  })
  it('sin horario, abierto todo el día todos los días (la estadía no tiene apertura)', () => {
    expect(aperturaDeHorario(null)).toEqual({ dias: [0, 1, 2, 3, 4, 5, 6], desde: 0, hasta: 1440 })
    expect(aperturaDeHorario({})).toEqual({ dias: [0, 1, 2, 3, 4, 5, 6], desde: 0, hasta: 1440 })
  })
})

describe('negocioDeApi', () => {
  it('arma el negocio con la config, los recursos de su modo y los defaults de lo que la API no guarda', () => {
    const n = negocioDeApi({
      tipo: 'cancha', rubro: 'canchas',
      negocio: { nombre: 'Complejo', slug: 'complejo', telefono: null },
      config: config({ senaPorcentaje: 50, cancelacionHastaHoras: 24, horario: { '1': [[540, 1380]] } }),
      recursos: [
        recurso({ id: 'c1', datos: { extras: [{ id: 'luz', nombre: 'Luz', precio: 5000 }] } }),
        recurso({ id: 'c2', datos: { extras: [{ id: 'luz', nombre: 'Luz', precio: 5000 }, { id: 'pel', nombre: 'Pelotas', precio: 3000 }] } }),
      ],
      servicios: [],
      bloqueos: [],
    })
    expect(n.senaPct).toBe(50)
    expect(n.cancelaHastaHoras).toBe(24)
    expect(n.unidades.map(u => u.id)).toEqual(['c1', 'c2'])
    expect(n.extras.map(e => e.id)).toEqual(['luz', 'pel'])
    expect(n.reglasPrecio).toEqual([])
    expect(n.pasoMin).toBe(60)
    expect(n.maxFranjas).toBe(3)
    expect(n.mensajes).toHaveLength(4)
    expect(n.equipo).toEqual([])
    expect(n.calendariosExternos).toEqual([])
    expect(n.telefono).toBe('')
  })
})
