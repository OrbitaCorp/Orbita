// Las traducciones entre la API de reservas y el panel de Gimnasio: días
// (domingo 0 ↔ lunes 0), clases como recursos CLASE de una sesión, lo propio
// de Gimnasio en datos.gimnasio, inscripciones, espera, socios, días sin
// clases, y lo que se manda al guardar.
import { describe, expect, it } from 'vitest'
import type { Bloqueo, Config, Espera, Recurso, Reserva } from '@/lib/reservasApi/tipos'
import { COLORES_ACTIVIDAD, negocioDe, rubroPorKey, type ClaseSemanal } from '../../index'
import {
  actividadesDe, aperturaDeHorario, bloqueoParaApi, bloqueosDeApi, claveApi, clasesDeRecurso, datosGimnasio, diaPanel, estadoDeReserva, fechaDeEspera, horarioConSesion,
  horarioSinSesion, inscripcionesDeApi, negocioDeApi, pedidoDeInscripcion, personaDe, planDeBloqueos, planDeGrilla, profesDe, recursoDeClase, recursoParaClase,
  salasDe, sociosDeApi,
} from '../mapear'

// Lunes 16/11/2026: la clave '1' de la API, el día 0 del panel.
const LUNES = '2026-11-16'
const AHORA = new Date('2026-11-16T12:00:00Z') // 09:00 de Argentina

const recurso = (over: Partial<Recurso> = {}): Recurso => ({
  id: 'r1', modulo: 'GIMNASIO', tipo: 'CLASE', nombre: 'WOD', descripcion: null, cupo: 12, duracionMinutos: 60, pasoMinutos: null, margenMinutos: null,
  maximoSeguidos: 1, precio: 0, horario: { '1': [[1140, 1200]] }, orden: 0, activo: true,
  datos: { gimnasio: { actividadId: 'a1', color: '#7C3AED', profeId: 'p1', profe: 'Nico Paz', sala: 'Box' } },
  ...over,
})

const reserva = (over: Partial<Reserva> = {}): Reserva => ({
  id: 'res1', modulo: 'GIMNASIO', recursoId: 'r1', servicioId: null, codigo: 'ABC234', estado: 'CONFIRMADA', origen: 'PANEL',
  inicio: '2026-11-16T22:00:00.000Z', fin: '2026-11-16T23:00:00.000Z', fecha: LUNES, inicioMinutos: 1140, finMinutos: 1200, cantidad: 1,
  retenidaHasta: null, clienteId: null, clienteNombre: 'Lu Paz', clienteTelefono: '3757 55-0101', clienteEmail: null, notas: null, servicio: null,
  extras: null, precio: 0, sena: 0, pagado: 0, pagoMetodo: null, confirmadaEn: null, completadaEn: null, canceladaEn: null, canceladaPor: null,
  motivoCancelacion: null, reprogramaciones: 0, version: 1, creadaEn: '2026-11-10T15:00:00.000Z',
  ...over,
})

const espera = (over: Partial<Espera> = {}): Espera => ({
  id: 'e1', modulo: 'GIMNASIO', recursoId: 'r1', inicio: '2026-11-16T22:00:00.000Z', fin: '2026-11-16T23:00:00.000Z', clienteId: null,
  clienteNombre: 'Sol Ríos', clienteTelefono: '11 4444-0000', clienteEmail: null, estado: 'ESPERANDO', reservaId: null, createdAt: '2026-11-15T20:00:00.000Z',
  ...over,
})

const config = (over: Partial<Config> = {}): Config => ({
  modulo: 'GIMNASIO', activo: true, confirmacion: 'AUTOMATICA', retencionMinutos: 10, anticipacionMinimaMinutos: 30, anticipacionMaximaDias: 21,
  cancelacionHastaHoras: 3, reprogramacionHastaHoras: 3, reprogramacionesMaximas: 1, senaPorcentaje: 0, senaReembolsable: true, maximoActivasPorCliente: 0,
  listaDeEspera: true, margenMinutos: 0, horario: { '1': [[420, 1320]], '6': [[540, 780]] },
  ...over,
})

describe('Gimnasio sobre la API · días y clases', () => {
  it('la API cuenta el domingo como 0 y el panel el lunes', () => {
    expect(claveApi(0)).toBe('1')
    expect(claveApi(6)).toBe('0')
    expect(diaPanel('1')).toBe(0)
    expect(diaPanel('0')).toBe(6)
    for (let d = 0; d < 7; d++) expect(diaPanel(claveApi(d))).toBe(d)
  })

  it('un recurso con una sesión es una clase con su id; con varias, una clase por sesión', () => {
    expect(clasesDeRecurso(recurso())).toEqual([{ id: 'r1', actividadId: 'a1', dia: 0, inicio: 1140, profeId: 'p1', sala: 'Box', cupo: 12 }])
    const varias = clasesDeRecurso(recurso({ horario: { '3': [[600, 660]], '1': [[600, 660], [1140, 1200]] } }))
    expect(varias.map(c => c.id)).toEqual(['r1~0-600', 'r1~0-1140', 'r1~2-600'])
    expect(varias.every(c => recursoDeClase(c.id) === 'r1')).toBe(true)
  })

  it('un recurso sin datos de Gimnasio agrupa su actividad por el nombre', () => {
    expect(datosGimnasio({ nombre: 'Yoga Ñandú', datos: null })).toEqual({ actividadId: 'act-yoga-nandu', color: '', profeId: '', profe: '', sala: '' })
  })

  it('las actividades, las salas y el equipo salen de las clases', () => {
    const recursos = [
      recurso(),
      recurso({ id: 'r2', cupo: 8, datos: { gimnasio: { actividadId: 'a1', color: '#7C3AED', profeId: 'p2', profe: 'Caro', sala: 'Sala 2' } } }),
      recurso({ id: 'r3', nombre: 'Open box', duracionMinutos: 90, datos: { gimnasio: { actividadId: 'a2', profeId: 'p1', profe: 'Nico Paz', sala: 'Box' } } }),
      recurso({ id: 'r4', nombre: 'Halterofilia', datos: { gimnasio: { actividadId: 'a3', profeId: '', sala: '' } } }),
    ]
    expect(actividadesDe(recursos)).toEqual([
      { id: 'a1', nombre: 'WOD', duracion: 60, cupo: 12, color: '#7C3AED' },
      // Sin color guardado, el de la paleta según su lugar.
      { id: 'a2', nombre: 'Open box', duracion: 90, cupo: 12, color: COLORES_ACTIVIDAD[1] },
      { id: 'a3', nombre: 'Halterofilia', duracion: 60, cupo: 12, color: COLORES_ACTIVIDAD[2] },
    ])
    expect(salasDe(recursos)).toEqual(['Box', 'Sala 2'])
    const profes = profesDe(recursos)
    expect(profes.map(p => [p.id, p.nombre, p.actividades])).toEqual([['p1', 'Nico Paz', ['a1', 'a2']], ['p2', 'Caro', ['a1']]])
    expect(profes[0].color).toMatch(/^#[0-9A-F]{6}$/)
  })

  it('el horario del negocio es la apertura de la demo: los días que abre y la hora más temprana y la más tarde', () => {
    expect(aperturaDeHorario({ '1': [[480, 720], [900, 1320]], '6': [[540, 780]] })).toEqual({ dias: [0, 5], desde: 480, hasta: 1320 })
    expect(aperturaDeHorario(null).dias).toEqual([])
  })

  it('los días sin clases son los bloqueos de todo el negocio, como días [desde, hasta)', () => {
    const bloqueos: Bloqueo[] = [
      // Viernes 20/11 entero: de las 00:00 a las 00:00 del sábado (Argentina).
      { id: 'b1', modulo: 'GIMNASIO', recursoId: null, inicio: '2026-11-20T03:00:00.000Z', fin: '2026-11-21T03:00:00.000Z', motivo: 'Feriado', createdAt: '' },
      // Hasta el mediodía del 24: ese día cuenta entero.
      { id: 'b2', modulo: 'GIMNASIO', recursoId: null, inicio: '2026-11-23T03:00:00.000Z', fin: '2026-11-24T15:00:00.000Z', motivo: null, createdAt: '' },
      // De una sola clase: no es un día sin clases.
      { id: 'b3', modulo: 'GIMNASIO', recursoId: 'r1', inicio: '2026-11-25T03:00:00.000Z', fin: '2026-11-26T03:00:00.000Z', motivo: 'Sin profe', createdAt: '' },
    ]
    expect(bloqueosDeApi(bloqueos)).toEqual([
      { id: 'b1', desde: '2026-11-20', hasta: '2026-11-21', motivo: 'Feriado', origen: 'dueno' },
      { id: 'b2', desde: '2026-11-23', hasta: '2026-11-25', motivo: 'Cerrado', origen: 'dueno' },
    ])
  })

  it('el negocio toma de la API el horario, las reglas, las clases y los días sin clases; los planes quedan vacíos', () => {
    const base = negocioDe(rubroPorKey('crossfit'))
    const n = negocioDeApi(base, { config: config(), recursos: [recurso()], bloqueos: [] })
    expect(n.nombre).toBe(base.nombre)
    expect(n.apertura).toEqual({ dias: [0, 5], desde: 420, hasta: 1320 })
    expect(n.clases).toHaveLength(1)
    expect(n.planes).toEqual([])
    expect(n.anticipacionDias).toBe(21)
    expect(n.cancelaHastaHoras).toBe(3)
    // La API marca presente o ausente recién cuando la clase empezó.
    expect(n.checkInMin).toBe(0)
  })
})

describe('Gimnasio sobre la API · inscripciones y socios', () => {
  it('cada estado de la API tiene el suyo; una retenida vencida o una vencida no se muestran', () => {
    expect(estadoDeReserva({ estado: 'CONFIRMADA', retenidaHasta: null }, AHORA)).toBe('reservada')
    expect(estadoDeReserva({ estado: 'PENDIENTE', retenidaHasta: null }, AHORA)).toBe('reservada')
    expect(estadoDeReserva({ estado: 'RETENIDA', retenidaHasta: '2026-11-16T12:05:00.000Z' }, AHORA)).toBe('reservada')
    expect(estadoDeReserva({ estado: 'RETENIDA', retenidaHasta: '2026-11-16T11:55:00.000Z' }, AHORA)).toBeNull()
    expect(estadoDeReserva({ estado: 'VENCIDA', retenidaHasta: null }, AHORA)).toBeNull()
    expect(estadoDeReserva({ estado: 'COMPLETADA', retenidaHasta: null }, AHORA)).toBe('asistio')
    expect(estadoDeReserva({ estado: 'AUSENTE', retenidaHasta: null }, AHORA)).toBe('ausente')
    expect(estadoDeReserva({ estado: 'CANCELADA', retenidaHasta: null }, AHORA)).toBe('cancelada')
  })

  it('la persona es su ficha; si no tiene, su celular (los últimos 8 dígitos) o su email', () => {
    const fila = { id: 'x', clienteId: null, clienteTelefono: null, clienteEmail: null }
    expect(personaDe({ ...fila, clienteId: 'c-1', clienteTelefono: '3757 55-0101' })).toBe('c-1')
    expect(personaDe({ ...fila, clienteTelefono: '+54 9 3757 55-0101' })).toBe(personaDe({ ...fila, clienteTelefono: '03757 550101' }))
    expect(personaDe({ ...fila, clienteEmail: 'Lu@Mail.com' })).toBe('mail:lu@mail.com')
    expect(personaDe(fila)).toBe('sin-datos:x')
  })

  it('las reservas y la espera caen en su clase; la vencida queda afuera y la cantidad viaja', () => {
    const clases = clasesDeRecurso(recurso())
    const ins = inscripcionesDeApi(
      [reserva({ cantidad: 2 }), reserva({ id: 'res2', estado: 'VENCIDA' }), reserva({ id: 'res3', estado: 'COMPLETADA', clienteId: 'c-9' })],
      [espera(), espera({ id: 'e2', estado: 'TOMADA' })],
      clases, AHORA,
    )
    expect(ins.map(i => [i.id, i.claseId, i.estado, i.fecha])).toEqual([
      ['res1', 'r1', 'reservada', LUNES],
      ['res3', 'r1', 'asistio', LUNES],
      ['espera:e1', 'r1', 'espera', LUNES],
    ])
    expect(ins[0].cantidad).toBe(2)
    expect(ins[1].socioId).toBe('c-9')
    expect(ins[2].creada).toBe('2026-11-15T20:00:00.000Z')
  })

  it('cada lugar conserva el nombre con el que se anotó: dos personas con el mismo celular comparten ficha, no nombre', () => {
    // Una madre anota a sus dos hijos con su celular: es una sola persona para el panel (la misma ficha).
    const ins = inscripcionesDeApi(
      [reserva({ clienteNombre: 'Tomi Paz' }), reserva({ id: 'res2', clienteNombre: 'Juli Paz' })],
      [espera({ clienteNombre: 'Mora Paz', clienteTelefono: '3757 55-0101' })],
      clasesDeRecurso(recurso()), AHORA,
    )
    expect(new Set(ins.map(i => i.socioId)).size).toBe(1)
    expect(ins.map(i => i.nombre)).toEqual(['Tomi Paz', 'Juli Paz', 'Mora Paz'])
  })

  it('el día de quien espera es el de Argentina: una clase de las 22:30 no cae en el día siguiente', () => {
    // 01:30 UTC del martes 17 son las 22:30 del lunes 16 en Argentina.
    expect(fechaDeEspera({ inicio: '2026-11-17T01:30:00.000Z' })).toBe(LUNES)
    expect(fechaDeEspera({ inicio: '2026-11-17T03:00:00.000Z' })).toBe('2026-11-17')
  })

  it('una reserva en un horario donde ya no hay clase no cae en ninguna clase de ese día', () => {
    const clases = clasesDeRecurso(recurso({ horario: { '2': [[1140, 1200]] } })) // la clase pasó al martes
    const [i] = inscripcionesDeApi([reserva()], [], clases, AHORA)
    expect(i.claseId).toBe('r1')
    expect(clases[0].dia).toBe(1)
  })

  it('los socios son uno por persona, con el nombre de su fila más nueva y el alta de la primera', () => {
    const socios = sociosDeApi(
      [reserva({ clienteNombre: 'Lu', creadaEn: '2026-11-01T15:00:00.000Z' }), reserva({ id: 'res2', clienteNombre: 'Lucía Paz', clienteTelefono: '+54 9 3757 550101', creadaEn: '2026-11-12T15:00:00.000Z' })],
      [espera()],
    )
    expect(socios).toHaveLength(2)
    const lu = socios.find(s => s.nombre === 'Lucía Paz')!
    expect(lu).toMatchObject({ telefono: '+54 9 3757 550101', planId: null, vence: null, alta: '2026-11-01' })
    expect(socios.map(s => s.nombre)).toEqual(['Lucía Paz', 'Sol Ríos'])
  })
})

describe('Gimnasio sobre la API · lo que se manda', () => {
  const negocio = { actividades: [{ id: 'a1', nombre: 'WOD', duracion: 60, cupo: 12, color: '#7C3AED' }, { id: 'a2', nombre: 'Open box', duracion: 90, cupo: 10, color: '#059669' }], profes: [{ id: 'p1', nombre: 'Nico Paz', color: '#1D4ED8', actividades: ['a1'] }] }
  const clase = (over: Partial<ClaseSemanal> = {}): ClaseSemanal => ({ id: 'r1', actividadId: 'a1', dia: 0, inicio: 1140, profeId: 'p1', sala: 'Box', cupo: 12, ...over })

  it('el horario cambia una sesión y deja las demás; un día vacío no va', () => {
    const h = { '1': [[600, 660], [1140, 1200]] as [number, number][], '3': [[600, 660]] as [number, number][] }
    expect(horarioConSesion(h, { dia: 0, inicio: 1140 }, { dia: 1, inicio: 1200, fin: 1260 })).toEqual({ '1': [[600, 660]], '2': [[1200, 1260]], '3': [[600, 660]] })
    expect(horarioSinSesion(h, { dia: 2, inicio: 600 })).toEqual({ '1': [[600, 660], [1140, 1200]] })
    expect(horarioConSesion(null, null, { dia: 6, inicio: 600, fin: 660 })).toEqual({ '0': [[600, 660]] })
  })

  it('una clase nueva es un recurso CLASE con el nombre y la duración de su actividad y lo de Gimnasio en datos', () => {
    expect(recursoParaClase(clase({ id: 'k1', actividadId: 'a2', inicio: 600 }), negocio)).toEqual({
      modulo: 'GIMNASIO', tipo: 'CLASE', nombre: 'Open box', cupo: 12, duracionMinutos: 90, horario: { '1': [[600, 690]] },
      datos: { gimnasio: { actividadId: 'a2', color: '#059669', profeId: 'p1', profe: 'Nico Paz', sala: 'Box' } },
    })
  })

  it('al editar, se respeta lo demás de datos y las otras sesiones del recurso', () => {
    const previo = recurso({ horario: { '1': [[1140, 1200]], '4': [[600, 660]] }, datos: { gimnasio: { actividadId: 'a1' }, otro: 'se queda' } })
    const r = recursoParaClase(clase({ dia: 2, cupo: 15, profeId: '' }), negocio, { recurso: previo, clase: clase() })
    expect(r.horario).toEqual({ '3': [[1140, 1200]], '4': [[600, 660]] })
    expect(r.cupo).toBe(15)
    expect(r.datos).toEqual({ otro: 'se queda', gimnasio: { actividadId: 'a1', color: '#7C3AED', profeId: '', profe: '', sala: 'Box' } })
  })

  it('tocarle el cupo a una clase no le cambia la duración: sigue la del recurso mientras no cambie de actividad', () => {
    // Una clase de WOD de 90 minutos (la actividad dice 60): al subirle el cupo sigue durando 90.
    const previo = recurso({ duracionMinutos: 90, horario: { '1': [[1140, 1230]] } })
    const r = recursoParaClase(clase({ cupo: 20 }), negocio, { recurso: previo, clase: clase() })
    expect(r).toMatchObject({ cupo: 20, duracionMinutos: 90, horario: { '1': [[1140, 1230]] } })
    // Si pasa a otra actividad, toma la duración de esa actividad.
    const otra = recursoParaClase(clase({ actividadId: 'a2' }), negocio, { recurso: previo, clase: clase() })
    expect(otra).toMatchObject({ nombre: 'Open box', duracionMinutos: 90, horario: { '1': [[1140, 1230]] } })
    expect(recursoParaClase(clase({ actividadId: 'a1' }), negocio, { recurso: recurso({ duracionMinutos: 45 }), clase: clase({ actividadId: 'a2' }) }).duracionMinutos).toBe(60)
  })

  it('lo que haya en datos.gimnasio y el panel no maneja no se pierde al editar; sin la actividad en la lista, el nombre sigue siendo el del recurso', () => {
    const previo = recurso({ nombre: 'Funcional', datos: { gimnasio: { actividadId: 'a-borrada', nivel: 'inicial', color: '#111111' } } })
    const r = recursoParaClase(clase({ actividadId: 'a-borrada', cupo: 8 }), negocio, { recurso: previo, clase: clase({ actividadId: 'a-borrada' }) })
    expect(r.nombre).toBe('Funcional')
    expect(r.datos).toEqual({ gimnasio: { nivel: 'inicial', actividadId: 'a-borrada', color: '', profeId: 'p1', profe: 'Nico Paz', sala: 'Box' } })
  })

  it('la grilla nueva dice qué crear, qué cambiar y qué quitar; lo igual no se toca', () => {
    const antes = [clase(), clase({ id: 'r2', inicio: 600 }), clase({ id: 'r3', dia: 3 })]
    const despues = [clase(), clase({ id: 'r2', inicio: 660 }), clase({ id: 'k-nueva', dia: 5 })]
    const plan = planDeGrilla(antes, despues)
    expect(plan.crear.map(c => c.id)).toEqual(['k-nueva'])
    expect(plan.editar.map(e => [e.antes.inicio, e.despues.inicio])).toEqual([[600, 660]])
    expect(plan.quitar.map(c => c.id)).toEqual(['r3'])
  })

  it('los días sin clases [desde, hasta) van a la API con el último día incluido', () => {
    const b = { id: 'bn', desde: '2026-12-24', hasta: '2026-12-26', motivo: 'Navidad', origen: 'dueno' as const }
    expect(bloqueoParaApi(b)).toEqual({ modulo: 'GIMNASIO', fechaDesde: '2026-12-24', fechaHasta: '2026-12-25', motivo: 'Navidad' })
    const plan = planDeBloqueos([{ ...b, id: 'b1' }], [b])
    expect(plan.crear.map(x => x.id)).toEqual(['bn'])
    expect(plan.quitar.map(x => x.id)).toEqual(['b1'])
  })

  it('anotar desde el panel es una reserva confirmada del recurso de la clase, con la cantidad y sin datos vacíos', () => {
    const pedido = pedidoDeInscripcion({ fecha: LUNES, cantidad: 2 }, clase({ id: 'r9~0-1140' }), { nombre: ' Lu Paz ', telefono: '3757 55-0101', email: '' }, 'clave-1')
    expect(pedido).toEqual({ modulo: 'GIMNASIO', recursoId: 'r9', fecha: LUNES, inicioMinutos: 1140, cantidad: 2, cliente: { nombre: 'Lu Paz', telefono: '3757 55-0101' }, estado: 'CONFIRMADA', clave: 'clave-1' })
  })
})
