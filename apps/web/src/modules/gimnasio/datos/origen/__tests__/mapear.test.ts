// Las traducciones entre la API (la de reservas y la de Gimnasio) y el panel:
// días (domingo 0 ↔ lunes 0), clases como recursos CLASE de una sesión, lo
// propio de Gimnasio en datos.gimnasio, inscripciones (con cómo se paga cada
// lugar), espera, planes, alumnos con sus planes, días sin clases, y lo que se
// manda al guardar.
import { describe, expect, it } from 'vitest'
import type { Bloqueo, Config, Espera, Recurso, Reserva } from '@/lib/reservasApi/tipos'
import { COLORES_ACTIVIDAD, estadoPlanDe, negocioDe, rubroPorKey, type ClaseSemanal, type PlanDeSocio } from '../../index'
import type { AlumnoApi, PlanApi, SuscripcionApi } from '../gimnasioApi'
import {
  actividadesDe, altaDeSocio, aperturaDeHorario, bloqueoParaApi, bloqueosDeApi, claveApi, clasesDeRecurso, datosGimnasio, detalleDePago, diaPanel, estadoDeReserva, fechaDeEspera,
  horarioConSesion, horarioSinSesion, inscripcionesDeApi, negocioDeApi, pagoDeDatos, pedidoConPago, pedidoDeInscripcion, personaDe, planDeApi, planDeBloqueos, planDeGrilla,
  planDeSocioDeApi, planesParaApi, profesDe, quienEs, recursoDeClase, recursoParaClase, resumenDePlanes, salasDe, socioDeAlumno, sociosDeApi,
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

describe('Gimnasio sobre la API · planes y precios', () => {
  const pack: PlanApi = { id: 'p-pack', tipo: 'PACK', nombre: 'Pack de 8', precio: 56000, clases: 8, porSemana: null, vigenciaDias: 90, activo: true }
  const libre: PlanApi = { id: 'p-libre', tipo: 'MEMBRESIA', nombre: 'Pase libre', precio: 60000, clases: null, porSemana: 0, vigenciaDias: 30, activo: true }
  const prueba: PlanApi = { id: 'p-prueba', tipo: 'PRUEBA', nombre: 'Clase de prueba', precio: 0, clases: null, porSemana: null, vigenciaDias: 30, activo: false }

  it('un plan de la API es el del panel: las clases solo en un pack y el tope de la semana solo en una membresía (0 es libre)', () => {
    expect(planDeApi(pack)).toEqual({ id: 'p-pack', tipo: 'pack', nombre: 'Pack de 8', precio: 56000, clases: 8, vigenciaDias: 90, activo: true })
    expect(planDeApi(libre)).toEqual({ id: 'p-libre', tipo: 'membresia', nombre: 'Pase libre', precio: 60000, porSemana: 0, vigenciaDias: 30, activo: true })
    expect(planDeApi(prueba)).toEqual({ id: 'p-prueba', tipo: 'prueba', nombre: 'Clase de prueba', precio: 0, vigenciaDias: 30, activo: false })
  })

  it('el negocio muestra los planes de la API en su orden, nunca los de ejemplo', () => {
    const base = negocioDe(rubroPorKey('crossfit'))
    expect(base.planes.length).toBeGreaterThan(0)
    const n = negocioDeApi(base, { config: config(), recursos: [], bloqueos: [], planes: [prueba, pack, libre] })
    expect(n.planes.map(p => [p.id, p.tipo])).toEqual([['p-prueba', 'prueba'], ['p-pack', 'pack'], ['p-libre', 'membresia']])
    expect(negocioDeApi(base, { config: config(), recursos: [], bloqueos: [], planes: [] }).planes).toEqual([])
  })

  it('al guardar va la lista entera: los que la API ya tiene, con su id; los cargados recién, sin el id del panel; ida y vuelta no cambia nada', () => {
    const delPanel = [planDeApi(pack), planDeApi(libre), planDeApi(prueba)]
    expect(planesParaApi(delPanel, [pack, libre, prueba])).toEqual([pack, libre, prueba])
    const nuevo = { id: 'pl1a2b', tipo: 'pack' as const, nombre: '  Pack de 4 ', precio: 30000, clases: 4, vigenciaDias: 60, activo: true }
    expect(planesParaApi([nuevo, planDeApi(pack)], [pack])).toEqual([
      { tipo: 'PACK', nombre: 'Pack de 4', precio: 30000, clases: 4, porSemana: null, vigenciaDias: 60, activo: true },
      pack,
    ])
  })
})

describe('Gimnasio sobre la API · alumnos y sus planes', () => {
  const HOY = '2026-11-24'
  const sus = (over: Partial<SuscripcionApi> = {}): SuscripcionApi => ({
    id: 's1', planId: 'p-pack', tipo: 'PACK', nombre: 'Pack de 8', precio: 56000, clases: 8, porSemana: null, desde: '2026-11-01', hasta: '2027-01-30', estado: 'VIGENTE', usadas: 5, restantes: 3, ...over,
  })
  const membresia = (over: Partial<SuscripcionApi> = {}) => sus({ id: 'm1', planId: 'p-2x', tipo: 'MEMBRESIA', nombre: '2 veces por semana', precio: 48000, clases: null, porSemana: 2, restantes: null, usadas: 3, desde: '2026-11-10', hasta: '2026-12-10', ...over })
  const alumno = (over: Partial<AlumnoApi> = {}): AlumnoApi => ({ id: 'alu-1', clienteId: 'ficha-ana', nombre: 'Ana Sosa', telefono: '3757 55-0202', email: 'ana@ejemplo.com', nota: 'Viene a la mañana', alta: '2026-11-01', probo: true, planes: [sus()], ultimo: null, ...over })
  const plan = (over: Partial<PlanDeSocio>): PlanDeSocio => ({ id: 'x', planId: 'p', tipo: 'pack', nombre: 'Pack', precio: 1, desde: '2026-11-01', hasta: '2026-12-31', clases: 8, restantes: 3, porSemana: null, ...over })

  it('un alumno con un pack: su id es su ficha, y trae el plan, hasta cuándo vale y las clases que le quedan', () => {
    const s = socioDeAlumno(alumno(), HOY)
    expect(s).toMatchObject({
      id: 'ficha-ana', fichaId: 'ficha-ana', alumnoId: 'alu-1', nombre: 'Ana Sosa', telefono: '3757 55-0202', email: 'ana@ejemplo.com', nota: 'Viene a la mañana', alta: '2026-11-01', probo: true,
      planId: 'p-pack', desde: '2026-11-01', vence: '2027-01-30', clasesRestantes: 3,
    })
    expect(s.planes).toEqual([{ id: 's1', planId: 'p-pack', tipo: 'pack', nombre: 'Pack de 8', precio: 56000, desde: '2026-11-01', hasta: '2027-01-30', clases: 8, restantes: 3, porSemana: null }])
    expect(estadoPlanDe(s, HOY)).toBe('vigente')
  })

  it('renovar la misma membresía antes de que venza corre el vencimiento: la lista muestra hasta cuándo sigue, no cuándo termina la de ahora', () => {
    // Vence el 28/11 (en 4 días) y ya tiene la renovación, que arranca el 29.
    const s = socioDeAlumno(alumno({ planes: [membresia({ hasta: '2026-11-28' }), membresia({ id: 'm2', desde: '2026-11-29', hasta: '2026-12-29', usadas: 0 })] }), HOY)
    expect(s).toMatchObject({ planId: 'p-2x', desde: '2026-11-10', vence: '2026-12-29', clasesRestantes: null })
    expect(estadoPlanDe(s, HOY)).toBe('vigente')
    // Sin la renovación, vence pronto.
    expect(estadoPlanDe(socioDeAlumno(alumno({ planes: [membresia({ hasta: '2026-11-28' })] }), HOY), HOY)).toBe('por-vencer')
    // Otra membresía que arranca después no es la renovación de esta: no corre su vencimiento.
    expect(resumenDePlanes([plan({ id: 'a', planId: 'p-2x', tipo: 'membresia', hasta: '2026-11-28', restantes: null }), plan({ id: 'b', planId: 'p-libre', tipo: 'membresia', desde: '2026-11-29', hasta: '2026-12-29', restantes: null })], HOY).vence).toBe('2026-11-28')
  })

  it('con dos packs se muestra el que vence primero y las clases de los dos; un pack sin clases no tapa a otro plan que sirve', () => {
    const dos = [plan({ id: 'viejo', hasta: '2026-12-05', restantes: 1 }), plan({ id: 'nuevo', hasta: '2027-02-20', restantes: 8 })]
    expect(resumenDePlanes(dos, HOY)).toEqual({ planId: 'p', desde: '2026-11-01', vence: '2026-12-05', clasesRestantes: 9 })
    // El pack viejo se quedó sin clases: se muestra el nuevo, con las suyas.
    expect(resumenDePlanes([plan({ id: 'viejo', hasta: '2026-12-05', restantes: 0 }), plan({ id: 'nuevo', planId: 'p2', hasta: '2027-02-20', restantes: 8 })], HOY)).toMatchObject({ planId: 'p2', vence: '2027-02-20', clasesRestantes: 8 })
    // Un pack agotado y una membresía al día: está al día, con la membresía.
    expect(resumenDePlanes([plan({ id: 'viejo', hasta: '2026-12-05', restantes: 0 }), plan({ id: 'm', planId: 'p-2x', tipo: 'membresia', hasta: '2026-12-20', restantes: null, clases: null, porSemana: 2 })], HOY)).toEqual({ planId: 'p-2x', desde: '2026-11-01', vence: '2026-12-20', clasesRestantes: null })
    // Solo un pack sin clases: agotado.
    const agotado = socioDeAlumno(alumno({ planes: [sus({ restantes: 0, usadas: 8 })] }), HOY)
    expect(estadoPlanDe(agotado, HOY)).toBe('agotado')
  })

  it('sin planes vigentes, el último que tuvo dice cuándo venció; quien nunca tuvo queda sin plan', () => {
    const vencido = socioDeAlumno(alumno({ planes: [], ultimo: membresia({ hasta: '2026-11-15' }) }), HOY)
    expect(vencido).toMatchObject({ planId: 'p-2x', vence: '2026-11-15' })
    expect(vencido.planes).toHaveLength(1)
    expect(estadoPlanDe(vencido, HOY)).toBe('vencido')
    const sinPlan = socioDeAlumno(alumno({ planes: [], ultimo: null, telefono: null, email: null, nota: null }), HOY)
    expect(sinPlan).toMatchObject({ planId: null, desde: null, vence: null, clasesRestantes: null, telefono: '', planes: [] })
    expect(sinPlan).not.toHaveProperty('email')
    expect(estadoPlanDe(sinPlan, HOY)).toBe('sin-plan')
    // La clase de prueba y la suelta no son planes de nadie.
    expect(planDeSocioDeApi(sus({ tipo: 'SUELTA' }))).toBeNull()
  })

  it('los socios son los alumnos y, además, quienes reservaron o esperan sin serlo: uno por persona', () => {
    const socios = sociosDeApi(
      [
        // Ana reservó (con su ficha) antes de ser alumna: su alta es esa primera reserva.
        reserva({ id: 'r-ana', clienteId: 'ficha-ana', clienteNombre: 'Anita', creadaEn: '2026-10-20T15:00:00.000Z' }),
        // Lu reservó desde el sitio con la clase de prueba y no es alumna.
        reserva({ id: 'r-lu', clienteId: 'ficha-lu', clienteNombre: 'Lu Paz', datos: { gimnasio: { pago: 'prueba', planId: 'p-prueba' } } }),
      ],
      [espera()],
      [alumno()],
      HOY,
    )
    expect(socios.map(s => [s.id, s.nombre, s.alumnoId ?? null])).toEqual([['ficha-ana', 'Ana Sosa', 'alu-1'], ['ficha-lu', 'Lu Paz', null], ['tel:44440000', 'Sol Ríos', null]])
    expect(socios[0]).toMatchObject({ alta: '2026-10-20', planId: 'p-pack', clasesRestantes: 3 })
    // De quien no es alumna se sabe lo de sus filas: si usó la prueba, su ficha para darle un plan, y que no tiene planes.
    expect(socios[1]).toMatchObject({ fichaId: 'ficha-lu', probo: true, planId: null, planes: [] })
    expect(socios[2]).toMatchObject({ fichaId: null, probo: false })
    // Una prueba cancelada no cuenta: la puede volver a pedir.
    const otra = sociosDeApi([reserva({ clienteId: 'ficha-lu', estado: 'CANCELADA', datos: { gimnasio: { pago: 'prueba' } } })], [], [], HOY)
    expect(otra[0].probo).toBe(false)
  })

  it('cada lugar dice cómo se paga; sin eso (pasó de la espera o reservó desde el sitio) queda sin definir', () => {
    const clases = clasesDeRecurso(recurso())
    const [conPlan, aparte, sinDefinir] = inscripcionesDeApi([
      reserva({ id: 'a', datos: { gimnasio: { pago: 'plan', suscripcionId: 's1', planId: 'p-pack' } } }),
      reserva({ id: 'b', datos: { gimnasio: { pago: 'aparte' }, otra: 'cosa' } }),
      reserva({ id: 'c', datos: null }),
    ], [espera()], clases, AHORA)
    expect(conPlan).toMatchObject({ pago: 'plan', planId: 'p-pack', suscripcionId: 's1' })
    expect(aparte).toMatchObject({ pago: 'aparte', planId: null })
    expect(aparte).not.toHaveProperty('suscripcionId')
    expect(sinDefinir).toMatchObject({ pago: null, planId: null })
    // Lo que no tenga la forma esperada también es "sin definir".
    expect(pagoDeDatos({ gimnasio: { pago: 'gratis' } })).toBeNull()
    expect(pagoDeDatos({ gimnasio: 'plan' })).toBeNull()
    expect(pagoDeDatos(undefined)).toBeNull()
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

  it('anotar diciendo cómo paga: a una alumna por su fila, a quien tiene ficha por su ficha, a alguien nuevo con sus datos', () => {
    const lu = { nombre: ' Lu Paz ', telefono: '3757 55-0101', email: '' }
    expect(quienEs({ ...lu, alumnoId: 'alu-1', fichaId: 'ficha-lu' })).toEqual({ alumnoId: 'alu-1' })
    expect(quienEs({ ...lu, alumnoId: null, fichaId: 'ficha-lu' })).toEqual({ clienteId: 'ficha-lu' })
    expect(quienEs(lu)).toEqual({ cliente: { nombre: 'Lu Paz', telefono: '3757 55-0101' } })
    expect(pedidoConPago({ fecha: LUNES, pago: 'plan' }, clase({ id: 'r9~0-1140' }), { ...lu, alumnoId: 'alu-1' }, 'clave-1')).toEqual({ recursoId: 'r9', fecha: LUNES, inicioMinutos: 1140, alumnoId: 'alu-1', pago: 'plan', clave: 'clave-1' })
    // Sin decir cómo paga, se cobra aparte; la cantidad viaja solo si es más de un lugar.
    expect(pedidoConPago({ fecha: LUNES, cantidad: 3 }, clase(), lu, 'clave-2')).toEqual({ recursoId: 'r1', fecha: LUNES, inicioMinutos: 1140, cantidad: 3, cliente: { nombre: 'Lu Paz', telefono: '3757 55-0101' }, pago: 'aparte', clave: 'clave-2' })
  })

  it('dar de alta manda los datos, la nota y el plan solo si los hay', () => {
    expect(altaDeSocio({ nombre: 'Ana Sosa', telefono: '3757 55-0202', email: 'ana@ejemplo.com', nota: ' Viene a la mañana ', planId: 'p-pack' })).toEqual({ cliente: { nombre: 'Ana Sosa', telefono: '3757 55-0202', email: 'ana@ejemplo.com' }, nota: 'Viene a la mañana', planId: 'p-pack' })
    expect(altaDeSocio({ nombre: 'Ana Sosa', telefono: '3757 55-0202', planId: null, fichaId: 'ficha-ana' })).toEqual({ clienteId: 'ficha-ana' })
  })

  it('lo que el panel cuenta después de anotar: cómo quedó el plan o cuánto se cobra aparte', () => {
    const p = { id: 's1', planId: 'p', tipo: 'PACK' as const, nombre: 'Pack de 8', precio: 1, clases: 8, porSemana: null, desde: LUNES, hasta: LUNES, estado: 'VIGENTE' as const, usadas: 5, restantes: 3 }
    expect(detalleDePago({ pago: 'plan', plan: p, usadasEnLaSemana: null }, 0)).toBe('Le quedan 3 clases en Pack de 8.')
    expect(detalleDePago({ pago: 'plan', plan: { ...p, restantes: 1 }, usadasEnLaSemana: null }, 0)).toBe('Le queda 1 clase en Pack de 8.')
    expect(detalleDePago({ pago: 'plan', plan: { ...p, restantes: 0 }, usadasEnLaSemana: null }, 0)).toBe('Usó la última clase de Pack de 8.')
    const libre = { ...p, tipo: 'MEMBRESIA' as const, nombre: 'Pase libre', clases: null, porSemana: 0, restantes: null }
    expect(detalleDePago({ pago: 'plan', plan: libre, usadasEnLaSemana: null }, 0)).toBe('Con Pase libre.')
    expect(detalleDePago({ pago: 'aparte', plan: null, usadasEnLaSemana: null }, 0)).toBe('Se cobra aparte.')
    expect(detalleDePago({ pago: null, plan: null, usadasEnLaSemana: null }, 0)).toBeUndefined()
  })

  it('si el aviso ya dice cómo paga, el detalle no lo repite: suma el monto o cómo quedó el plan', () => {
    const p = { id: 's1', planId: 'p', tipo: 'PACK' as const, nombre: 'Pack de 8', precio: 1, clases: 8, porSemana: null, desde: LUNES, hasta: LUNES, estado: 'VIGENTE' as const, usadas: 5, restantes: 3 }
    expect(detalleDePago({ pago: 'aparte', plan: null, usadasEnLaSemana: null }, 14000, true)).toMatch(/^Son \$\s?14\.000\.$/)
    expect(detalleDePago({ pago: 'aparte', plan: null, usadasEnLaSemana: null }, 0, true)).toBeUndefined()
    expect(detalleDePago({ pago: 'prueba', plan: null, usadasEnLaSemana: null }, 0, true)).toBeUndefined()
    expect(detalleDePago({ pago: 'prueba', plan: null, usadasEnLaSemana: null }, 0)).toBe('Es su clase de prueba.')
    // Con su plan, lo que queda es justo lo que falta saber.
    expect(detalleDePago({ pago: 'plan', plan: p, usadasEnLaSemana: null }, 0, true)).toBe('Le quedan 3 clases en Pack de 8.')
  })
})
