// El panel de Gimnasio sobre la API: qué ruta se llama para cada cosa que se
// hace en pantalla, en qué orden y qué se avisa; qué se vuelve a leer después
// de cada acción (lo que esa acción pudo cambiar, salga bien o mal, y nada
// más); cómo se lee (la ventana, los días que faltan, un solo día) y qué se
// le dice a la persona cuando algo falla. Con un cliente falso: nada viaja a
// la red.
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/authClient', () => ({ authedFetch: vi.fn() }))

import { ReservasApiError } from '@/lib/reservasApi/cliente'
import type { Bloqueo, Config, Espera, FiltroAgenda, Recurso, Reserva } from '@/lib/reservasApi/tipos'
import { negocioDe, rubroPorKey, type ClaseSemanal, type Inscripcion, type NegocioGym, type Socio } from '../../index'
import {
  ADELANTE, ATRAS, AvisoDelPanel, ColaDeLecturas, accionesApi, alrededorDe, conFecha, conTiempo, leerApi, leerMasDias, leerParte, loQueFalta, mensajeDeFalla,
  ocupando, reservasEntre, seDejaMirar, type DatosApi, type DepsAcciones, type Leido,
} from '../api'

const recurso = (over: Partial<Recurso> = {}): Recurso => ({
  id: 'r1', modulo: 'GIMNASIO', tipo: 'CLASE', nombre: 'WOD', descripcion: null, cupo: 12, duracionMinutos: 60, pasoMinutos: null, margenMinutos: null,
  maximoSeguidos: 1, precio: 0, horario: { '1': [[1140, 1200]] }, orden: 0, activo: true,
  datos: { gimnasio: { actividadId: 'a1', color: '#7C3AED', profeId: 'p1', profe: 'Nico', sala: 'Box' } },
  ...over,
})
const clase = (over: Partial<ClaseSemanal> = {}): ClaseSemanal => ({ id: 'r1', actividadId: 'a1', dia: 0, inicio: 1140, profeId: 'p1', sala: 'Box', cupo: 12, ...over })
const socio: Socio = { id: 'tel:37550101', nombre: 'Lu Paz', telefono: '3757 55-0101', planId: null, desde: null, vence: null, clasesRestantes: null, probo: true }
const reservaDeVuelta = (over: Partial<Reserva> = {}) => ({ id: 'res-1', clienteNombre: 'Lu Paz', ...over }) as Reserva
const inscripcion = (over: Partial<Inscripcion>): Inscripcion => ({ id: 'res-1', claseId: 'r1', fecha: '2026-11-16', socioId: socio.id, estado: 'reservada', creada: '2026-11-15', planId: null, ...over })

function armar(over: { recursos?: Recurso[]; clases?: ClaseSemanal[]; negocio?: Partial<NegocioGym>; inscripciones?: Inscripcion[] } = {}) {
  const recursos = over.recursos ?? [recurso(), recurso({ id: 'r2', horario: { '1': [[600, 660]], '3': [[600, 660]] } })]
  const negocio: NegocioGym = {
    ...negocioDe(rubroPorKey('crossfit')),
    actividades: [{ id: 'a1', nombre: 'WOD', duracion: 60, cupo: 12, color: '#7C3AED' }],
    profes: [{ id: 'p1', nombre: 'Nico', color: '#1D4ED8', actividades: ['a1'] }],
    clases: over.clases ?? [clase(), clase({ id: 'r2~0-600', inicio: 600 }), clase({ id: 'r2~2-600', dia: 2, inicio: 600 })],
    bloqueos: [{ id: 'b1', desde: '2026-11-20', hasta: '2026-11-21', motivo: 'Feriado', origen: 'dueno' }],
    ...over.negocio,
  }
  const cliente = {
    crearRecurso: vi.fn(async () => recurso({ id: 'nuevo' })),
    editarRecurso: vi.fn(async (id: string) => recurso({ id })),
    borrarRecurso: vi.fn(async () => ({ ok: true as const })),
    crearBloqueo: vi.fn(async () => ({ id: 'b-n', inicio: '', fin: '', afectadas: 2 })),
    borrarBloqueo: vi.fn(async () => ({ ok: true as const })),
    crear: vi.fn(async () => reservaDeVuelta()),
    completar: vi.fn(async () => reservaDeVuelta({ estado: 'COMPLETADA' })),
    ausente: vi.fn(async () => reservaDeVuelta({ estado: 'AUSENTE' })),
    cancelar: vi.fn(async () => ({ ...reservaDeVuelta({ estado: 'CANCELADA' }), sena: 'SIN_SENA' as const, promovida: null as Reserva | null })),
    anotarEnEspera: vi.fn(async () => ({ id: 'e9', posicion: 3 }) as never),
    darLugar: vi.fn(async () => reservaDeVuelta()),
    quitarDeEspera: vi.fn(async () => ({ ok: true as const })),
  }
  const refrescar = vi.fn()
  // Lo que el panel tiene a la vista: una reserva del lunes 16 y alguien esperando el miércoles 18.
  const inscripciones = over.inscripciones ?? [inscripcion({}), inscripcion({ id: 'res-2', fecha: '2026-11-17' }), inscripcion({ id: 'espera:e7', fecha: '2026-11-18', estado: 'espera' })]
  const deps: DepsAcciones = { cliente, recursos, negocio, socios: [socio], inscripciones, refrescar, clave: () => 'clave-fija' }
  return { acciones: accionesApi(deps), cliente, refrescar, negocio }
}

afterEach(() => { vi.useRealTimers() })

describe('Gimnasio sobre la API · la grilla', () => {
  it('una clase nueva crea su recurso; una cambiada edita el suyo; una quitada lo borra si era su única sesión', async () => {
    const { acciones, cliente, refrescar, negocio } = armar()
    const nueva = clase({ id: 'k-nueva', dia: 4, inicio: 480 })
    // r1 sube el cupo, r2~0-600 queda igual, r2~2-600 se quita y entra una nueva el viernes.
    await acciones.configurar({ clases: [{ ...negocio.clases[0], cupo: 15 }, negocio.clases[1], nueva] })
    expect(cliente.crearRecurso).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'CLASE', nombre: 'WOD', horario: { '5': [[480, 540]] } }))
    expect(cliente.editarRecurso).toHaveBeenCalledWith('r1', expect.objectContaining({ cupo: 15, horario: { '1': [[1140, 1200]] } }))
    // r2 tenía dos sesiones: se le saca la del miércoles, no se borra.
    expect(cliente.editarRecurso).toHaveBeenCalledWith('r2', { modulo: 'GIMNASIO', tipo: 'CLASE', nombre: 'WOD', horario: { '1': [[600, 660]] } })
    expect(cliente.borrarRecurso).not.toHaveBeenCalled()
    // Después de guardar la grilla se releen las clases, y nada más.
    expect(refrescar.mock.calls).toEqual([[{ recursos: true, bloqueos: false }]])
  })

  it('quitar la única sesión de un recurso lo borra', async () => {
    const { acciones, cliente, negocio } = armar()
    await acciones.configurar({ clases: negocio.clases.filter(c => c.id !== 'r1') })
    expect(cliente.borrarRecurso).toHaveBeenCalledWith('r1')
  })

  it('la actividad, el profe y la sala que se escribieron al cargar la clase viajan adentro de su recurso', async () => {
    const { acciones, cliente, negocio } = armar()
    const yoga = { id: 'act-yoga', nombre: 'Yoga', duracion: 75, cupo: 10, color: '#059669' }
    const sol = { id: 'p-sol', nombre: 'Sol Ríos', color: '#BE185D', actividades: ['act-yoga'] }
    await acciones.configurar({
      clases: [...negocio.clases, clase({ id: 'k-yoga', actividadId: 'act-yoga', profeId: 'p-sol', sala: 'Salón', dia: 1, inicio: 540, cupo: 10 })],
      actividades: [...negocio.actividades, yoga], profes: [...negocio.profes, sol], salas: [...negocio.salas, 'Salón'],
    })
    expect(cliente.crearRecurso).toHaveBeenCalledWith({
      modulo: 'GIMNASIO', tipo: 'CLASE', nombre: 'Yoga', cupo: 10, duracionMinutos: 75, horario: { '2': [[540, 615]] },
      datos: { gimnasio: { actividadId: 'act-yoga', color: '#059669', profeId: 'p-sol', profe: 'Sol Ríos', sala: 'Salón' } },
    })
  })

  it('si la API dice que no, el error sube con su mensaje, lo que sigue no se manda y se vuelve a leer igual', async () => {
    const { acciones, cliente, refrescar, negocio } = armar()
    cliente.borrarRecurso.mockRejectedValueOnce(new ReservasApiError(400, 'Tiene 3 reservas por delante. Movelas o cancelalas antes de borrarlo.'))
    await expect(acciones.configurar({ clases: negocio.clases.filter(c => c.id !== 'r1') })).rejects.toThrow(/3 reservas por delante/)
    expect(refrescar.mock.calls).toEqual([[{ recursos: true, bloqueos: false }]])
  })

  it('lo que no es la grilla ni los días sin clases no se manda: esas secciones todavía no guardan en la API', async () => {
    const { acciones, cliente, refrescar } = armar()
    await expect(acciones.configurar({ planes: [] })).rejects.toThrow(/todavía no guarda en la API/)
    // Las actividades sueltas tampoco: valen solo junto con la grilla.
    await expect(acciones.configurar({ actividades: [] })).rejects.toThrow(/todavía no guarda en la API/)
    expect(cliente.crearRecurso).not.toHaveBeenCalled()
    expect(refrescar).toHaveBeenCalledTimes(2)
  })
})

describe('Gimnasio sobre la API · días sin clases', () => {
  it('los nuevos se crean con el último día incluido, los quitados se borran y se avisa cuántas reservas quedaron adentro', async () => {
    const { acciones, cliente, refrescar } = armar()
    const r = await acciones.configurar({ bloqueos: [{ id: 'bn', desde: '2026-12-24', hasta: '2026-12-26', motivo: 'Navidad', origen: 'dueno' }] })
    expect(cliente.crearBloqueo).toHaveBeenCalledWith({ modulo: 'GIMNASIO', fechaDesde: '2026-12-24', fechaHasta: '2026-12-25', motivo: 'Navidad' })
    expect(cliente.borrarBloqueo).toHaveBeenCalledWith('b1')
    expect(r.detalle).toBe('2 reservas quedan adentro: no se cancelan solas, avisales.')
    // Se releen los días sin clases, no las clases.
    expect(refrescar.mock.calls).toEqual([[{ recursos: false, bloqueos: true }]])
  })
})

describe('Gimnasio sobre la API · anotar, la espera, presente y ausente', () => {
  it('anotar es una reserva confirmada con la clave del intento; con la clase llena, la espera dice el lugar en la fila', async () => {
    const { acciones, cliente, refrescar } = armar()
    await acciones.inscribir({ id: 'n1', claseId: 'r2~0-600', fecha: '2026-11-16', socioId: socio.id, estado: 'reservada', creada: '2026-11-15', planId: null, cantidad: 2 })
    expect(cliente.crear).toHaveBeenCalledWith({ modulo: 'GIMNASIO', recursoId: 'r2', fecha: '2026-11-16', inicioMinutos: 600, cantidad: 2, cliente: { nombre: 'Lu Paz', telefono: '3757 55-0101' }, estado: 'CONFIRMADA', clave: 'clave-fija' })
    const r = await acciones.inscribir({ id: 'n2', claseId: 'r1', fecha: '2026-11-23', socioId: socio.id, estado: 'espera', creada: '2026-11-15', planId: null })
    expect(cliente.anotarEnEspera).toHaveBeenCalledWith({ modulo: 'GIMNASIO', recursoId: 'r1', fecha: '2026-11-23', inicioMinutos: 1140, cliente: { nombre: 'Lu Paz', telefono: '3757 55-0101' } })
    expect(r.detalle).toBe('Está en el lugar 3 de la lista.')
    // Cada una relee su día.
    expect(refrescar.mock.calls).toEqual([[{ fecha: '2026-11-16' }], [{ fecha: '2026-11-23' }]])
  })

  it('alguien nuevo se anota con los datos que se cargaron', async () => {
    const { acciones, cliente } = armar()
    const nueva: Socio = { ...socio, id: 'sn-1', nombre: 'Sol Ríos', telefono: '11 4444-0000' }
    await acciones.inscribir({ id: 'n3', claseId: 'r1', fecha: '2026-11-16', socioId: 'sn-1', estado: 'reservada', creada: '2026-11-15', planId: null }, nueva)
    expect(cliente.crear).toHaveBeenCalledWith(expect.objectContaining({ cliente: { nombre: 'Sol Ríos', telefono: '11 4444-0000' }, cantidad: 1 }))
  })

  it('presente es completar, faltó es ausente y darle el lugar a quien espera es su ruta propia', async () => {
    const { acciones, cliente, refrescar } = armar()
    await acciones.cambiarInscripcion('res-1', { estado: 'asistio' })
    await acciones.cambiarInscripcion('res-2', { estado: 'ausente' })
    await acciones.cambiarInscripcion('espera:e7', { estado: 'reservada' })
    expect(cliente.completar).toHaveBeenCalledWith('res-1')
    expect(cliente.ausente).toHaveBeenCalledWith('res-2')
    expect(cliente.darLugar).toHaveBeenCalledWith('e7')
    await expect(acciones.cambiarInscripcion('res-1', { estado: 'reservada' })).rejects.toThrow(/todavía no se guarda/)
    await expect(acciones.cambiarInscripcion('espera:e7', { estado: 'asistio' })).rejects.toThrow(/solo se le puede dar el lugar o sacar de la lista/)
    // Se relee el día de cada inscripción tocada: el lunes, el martes y el miércoles (y otra vez con cada rechazo).
    expect(refrescar.mock.calls).toEqual([[{ fecha: '2026-11-16' }], [{ fecha: '2026-11-17' }], [{ fecha: '2026-11-18' }], [{ fecha: '2026-11-16' }], [{ fecha: '2026-11-18' }]])
  })

  it('liberar un lugar cancela la reserva y avisa si alguien pasó de la espera; sacar de la espera es quitarla', async () => {
    const { acciones, cliente } = armar()
    cliente.cancelar.mockResolvedValueOnce({ ...reservaDeVuelta({ estado: 'CANCELADA' }), sena: 'SIN_SENA', promovida: reservaDeVuelta({ id: 'res-9', clienteNombre: 'Sol Ríos' }) })
    const r = await acciones.cancelar('res-1')
    expect(cliente.cancelar).toHaveBeenCalledWith('res-1', { motivo: 'Lugar liberado desde el panel.' })
    expect(r.detalle).toBe('Sol pasó de la lista de espera y ya tiene su lugar.')
    await acciones.cancelar('espera:e7')
    expect(cliente.quitarDeEspera).toHaveBeenCalledWith('e7')
  })

  it('si no se sabe de qué día es lo que se tocó, se relee todo', async () => {
    const { acciones, refrescar } = armar()
    await acciones.cancelar('res-que-no-esta-a-la-vista')
    expect(refrescar.mock.calls).toEqual([['todo']])
  })

  it('una clase que ya no está en la grilla no se reserva a ciegas', async () => {
    const { acciones, cliente } = armar()
    await expect(acciones.inscribir({ id: 'n4', claseId: 'r-borrada', fecha: '2026-11-16', socioId: socio.id, estado: 'reservada', creada: '2026-11-15', planId: null })).rejects.toThrow(/ya no está en la grilla/)
    expect(cliente.crear).not.toHaveBeenCalled()
  })

  it('el panel queda ocupado desde que la acción sale: se marca antes de llamar a la API', async () => {
    const { acciones, cliente } = armar()
    const orden: string[] = []
    cliente.completar.mockImplementationOnce(async () => { orden.push('api'); return reservaDeVuelta() })
    await ocupando(acciones, () => orden.push('ocupado')).cambiarInscripcion('res-1', { estado: 'asistio' })
    expect(orden).toEqual(['ocupado', 'api'])
  })
})

describe('Gimnasio sobre la API · lo que se dice cuando algo falla', () => {
  it('lo que rechaza la API se dice con su mensaje; lo demás, en castellano y sin tecnicismos', () => {
    expect(mensajeDeFalla(new ReservasApiError(409, 'No queda lugar en ese horario.'))).toBe('No queda lugar en ese horario.')
    expect(mensajeDeFalla(new ReservasApiError(429, 'ThrottlerException: Too Many Requests'))).toMatch(/Demasiados pedidos seguidos/)
    expect(mensajeDeFalla(new ReservasApiError(401, 'Unauthorized'))).toMatch(/sesión venció/)
    expect(mensajeDeFalla(new ReservasApiError(403, 'Forbidden resource'))).toMatch(/no tiene permiso/)
    expect(mensajeDeFalla(new ReservasApiError(502, 'Bad Gateway'))).toMatch(/servidor no pudo/)
    expect(mensajeDeFalla(new AvisoDelPanel('Esa clase ya no está en la grilla. Actualizá el panel.'))).toBe('Esa clase ya no está en la grilla. Actualizá el panel.')
    // Sin conexión, el navegador tira un TypeError en inglés: no se muestra.
    expect(mensajeDeFalla(new TypeError('Failed to fetch'))).toBe('No pudimos conectar con el servidor. Revisá tu conexión y probá de nuevo.')
  })

  it('una acción que falla sin conexión sale con el mensaje en castellano, y se relee igual', async () => {
    const { acciones, cliente, refrescar } = armar()
    cliente.crear.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(acciones.inscribir(inscripcion({ id: 'n9' }))).rejects.toThrow('No pudimos conectar con el servidor. Revisá tu conexión y probá de nuevo.')
    expect(refrescar).toHaveBeenCalledTimes(1)
  })

  it('una respuesta que no llega se da por perdida a los 20 segundos: el panel no queda trabado', async () => {
    vi.useFakeTimers()
    const nunca = new Promise<string>(() => {})
    const espera = conTiempo(nunca)
    const fallo = expect(espera).rejects.toThrow(/tarda en contestar/)
    await vi.advanceTimersByTimeAsync(20_000)
    await fallo
    // La que llega a tiempo pasa tal cual, y su error también.
    await expect(conTiempo(Promise.resolve('ok'))).resolves.toBe('ok')
    await expect(conTiempo(Promise.reject(new Error('no')))).rejects.toThrow('no')
  })
})

describe('Gimnasio sobre la API · la ventana de días', () => {
  it('al entrar se leen cinco semanas para atrás y ocho para adelante', () => {
    expect(alrededorDe('2026-11-24')).toEqual({ desde: '2026-10-20', hasta: '2027-01-19' })
    expect([ATRAS, ADELANTE]).toEqual([35, 56])
  })

  it('mirar otra fecha agranda la ventana con su semana; lo que falta es lo de antes y lo de después', () => {
    const v = alrededorDe('2026-11-24')
    expect(conFecha(v, '2026-12-01')).toEqual(v)
    const hastaMarzo = conFecha(v, '2027-03-10')
    expect(hastaMarzo).toEqual({ desde: '2026-10-20', hasta: '2027-03-17' })
    expect(loQueFalta(v, hastaMarzo)).toEqual([{ desde: '2027-01-20', hasta: '2027-03-17' }])
    expect(loQueFalta(v, conFecha(v, '2026-09-01'))).toEqual([{ desde: '2026-08-25', hasta: '2026-10-19' }])
    expect(loQueFalta(v, v)).toEqual([])
  })

  it('se deja mirar hasta un año para cada lado: un link mal escrito no sale a pedir años de reservas', () => {
    expect(seDejaMirar('2026-11-24', '2027-11-25')).toBe(true)
    expect(seDejaMirar('2026-11-24', '2027-11-26')).toBe(false)
    expect(seDejaMirar('2026-11-24', '2025-11-23')).toBe(true)
    expect(seDejaMirar('2026-11-24', '2025-11-22')).toBe(false)
    expect(seDejaMirar('2026-11-24', '1999-01-01')).toBe(false)
  })
})

describe('Gimnasio sobre la API · la lectura', () => {
  const res = (id: string, fecha: string) => ({ id, fecha }) as Reserva
  const esp = (id: string, inicio: string) => ({ id, inicio, estado: 'ESPERANDO' }) as Espera
  const config = { modulo: 'GIMNASIO' } as Config
  const ventana = { desde: '2026-10-20', hasta: '2027-01-19' }
  /** Un cliente falso que contesta la agenda y la espera según lo que se le pida. */
  function lector(over: { agenda?: (f: FiltroAgenda) => Reserva[]; espera?: (fecha?: string) => Espera[]; config?: Config | null } = {}) {
    return {
      config: vi.fn(async () => (over.config === undefined ? config : over.config)),
      recursos: vi.fn(async () => [recurso({ id: 'leido' })]),
      bloqueos: vi.fn(async () => [{ id: 'b-leido' } as Bloqueo]),
      agenda: vi.fn(async (f: FiltroAgenda = {}) => { const data = over.agenda?.(f) ?? []; return { data, total: data.length, page: f.page ?? 1, limit: f.limit ?? 50 } }),
      espera: vi.fn(async (_modulo: string, _recursoId?: string, fecha?: string) => over.espera?.(fecha) ?? []),
    }
  }
  const leido = (over: Partial<DatosApi> = {}): DatosApi => ({
    config, recursos: [recurso()], bloqueos: [{ id: 'b1' } as Bloqueo], ventana,
    reservas: [res('a', '2026-11-23'), res('b', '2026-11-24'), res('c', '2026-11-24')],
    // 22:00 UTC del 23 son las 19:00 del 23 en Argentina; 01:30 UTC del 25 son las 22:30 del 24.
    esperas: [esp('e1', '2026-11-23T22:00:00.000Z'), esp('e2', '2026-11-25T01:30:00.000Z')],
    ...over,
  })

  it('una ventana larga se pide en tramos de hasta 93 días y cada tramo, en todas sus páginas de 500', async () => {
    const agenda = vi.fn(async (f: FiltroAgenda = {}) => {
      const total = f.desde === '2026-10-01' ? 750 : 2
      const resto = total - ((f.page ?? 1) - 1) * 500
      return { data: Array.from({ length: Math.max(0, Math.min(500, resto)) }, (_, i) => ({ id: `${f.desde}-${f.page}-${i}` }) as Reserva), total, page: f.page ?? 1, limit: 500 }
    })
    const todas = await reservasEntre({ agenda }, { desde: '2026-10-01', hasta: '2027-01-15' })
    expect(agenda.mock.calls.map(([f]) => [f?.desde, f?.hasta, f?.page, f?.limit])).toEqual([
      ['2026-10-01', '2027-01-01', 1, 500],
      ['2026-10-01', '2027-01-01', 2, 500],
      ['2027-01-02', '2027-01-15', 1, 500],
    ])
    expect(todas).toHaveLength(752)
  })

  it('una reserva que la API repite entre dos páginas queda una sola vez', async () => {
    const agenda = vi.fn(async (f: FiltroAgenda = {}) => ({ data: [res('x', '2026-11-24'), res(f.page === 1 ? 'y' : 'x', '2026-11-24')], total: 2, page: f.page ?? 1, limit: 500 }))
    expect((await reservasEntre({ agenda }, { desde: '2026-11-24', hasta: '2026-11-24' })).map(r => r.id)).toEqual(['x', 'y'])
  })

  it('al entrar se lee todo de una vez: los días sin clases desde el principio de la ventana y la espera de hoy en adelante', async () => {
    const c = lector({ agenda: () => [res('a', '2026-11-24')] })
    const datos = await leerApi(c, ventana)
    expect(c.bloqueos).toHaveBeenCalledWith('GIMNASIO', '2026-10-20')
    expect(c.espera).toHaveBeenCalledWith('GIMNASIO')
    expect(datos).toMatchObject({ ventana, reservas: [{ id: 'a' }], recursos: [{ id: 'leido' }], bloqueos: [{ id: 'b-leido' }] })
  })

  it('un negocio sin Gimnasio configurado lo dice, y no pide nada más', async () => {
    const c = lector({ config: null })
    await expect(leerApi(c, ventana)).rejects.toThrow('Este negocio todavía no tiene Gimnasio configurado.')
    expect(c.recursos).not.toHaveBeenCalled()
    expect(c.agenda).not.toHaveBeenCalled()
  })

  it('después de una acción se relee solo su día: las reservas y la espera de los otros días quedan como estaban', async () => {
    const c = lector({ agenda: () => [res('b', '2026-11-24'), res('d', '2026-11-24')], espera: () => [esp('e9', '2026-11-24T23:00:00.000Z')] })
    const datos = await leerParte(c, leido(), { fecha: '2026-11-24' })
    expect(c.agenda).toHaveBeenCalledTimes(1)
    expect(c.agenda).toHaveBeenCalledWith({ modulo: 'GIMNASIO', desde: '2026-11-24', hasta: '2026-11-24', page: 1, limit: 500 })
    expect(c.espera).toHaveBeenCalledWith('GIMNASIO', undefined, '2026-11-24')
    // Del 24 queda lo que contestó la API (la "c" ya no está); la "a" del 23 no se tocó.
    expect(datos.reservas.map(r => r.id).sort()).toEqual(['a', 'b', 'd'])
    // La espera se ubica por el día de Argentina: la de las 22:30 del 24 (01:30 UTC del 25) era de ese día y se reemplaza.
    expect(datos.esperas.map(e => e.id).sort()).toEqual(['e1', 'e9'])
    // Ni las clases ni los días sin clases se volvieron a pedir.
    expect(c.recursos).not.toHaveBeenCalled()
    expect(c.bloqueos).not.toHaveBeenCalled()
    expect(datos.recursos).toEqual(leido().recursos)
  })

  it('después de guardar la grilla o los días sin clases se relee eso, sin tocar las reservas', async () => {
    const c = lector()
    const datos = await leerParte(c, leido(), { recursos: true, bloqueos: true })
    expect(c.recursos).toHaveBeenCalledWith('GIMNASIO')
    expect(c.bloqueos).toHaveBeenCalledWith('GIMNASIO', '2026-10-20')
    expect(c.agenda).not.toHaveBeenCalled()
    expect(c.espera).not.toHaveBeenCalled()
    expect(datos).toMatchObject({ recursos: [{ id: 'leido' }], bloqueos: [{ id: 'b-leido' }] })
    expect(datos.reservas).toEqual(leido().reservas)
  })

  it('al mirar más adelante se piden solo los días que faltan y se suman a lo leído', async () => {
    const c = lector({ agenda: f => (f.desde === '2027-01-20' ? [res('z', '2027-02-01')] : []) })
    const datos = await leerMasDias(c, leido(), { desde: '2026-10-20', hasta: '2027-03-17' })
    expect(c.agenda.mock.calls.map(([f]) => [f?.desde, f?.hasta])).toEqual([['2027-01-20', '2027-03-17']])
    // Los días sin clases se piden "desde": para adelante ya estaban todos.
    expect(c.bloqueos).not.toHaveBeenCalled()
    expect(datos.ventana).toEqual({ desde: '2026-10-20', hasta: '2027-03-17' })
    expect(datos.reservas.map(r => r.id).sort()).toEqual(['a', 'b', 'c', 'z'])
  })

  it('al mirar más atrás se piden también los días sin clases de antes; si no falta nada, no se pide nada', async () => {
    const c = lector({ agenda: () => [res('v', '2026-09-01')] })
    const datos = await leerMasDias(c, leido(), { desde: '2026-08-25', hasta: '2027-01-19' })
    expect(c.agenda.mock.calls.map(([f]) => [f?.desde, f?.hasta])).toEqual([['2026-08-25', '2026-10-19']])
    expect(c.bloqueos).toHaveBeenCalledWith('GIMNASIO', '2026-08-25')
    expect(datos.bloqueos).toEqual([{ id: 'b-leido' }])
    const otro = lector()
    const igual = leido()
    expect(await leerMasDias(otro, igual, ventana)).toBe(igual)
    expect(otro.agenda).not.toHaveBeenCalled()
  })
})

describe('Gimnasio sobre la API · la cola de lecturas', () => {
  const datos = (id: string): DatosApi => ({ config: { modulo: 'GIMNASIO' } as Config, recursos: [recurso({ id })], bloqueos: [], reservas: [], esperas: [], ventana: { desde: '2026-10-20', hasta: '2027-01-19' } })
  const queLeyo = (a: Leido) => ('datos' in a ? a.datos.recursos[0].id : `falla: ${a.falla}`)
  const unMomento = () => new Promise<void>(ok => setTimeout(ok, 0))
  function armarCola() {
    const avisos: Leido[] = []
    const cola = new ColaDeLecturas(r => avisos.push(r))
    cola.abrir()
    return { cola, avisos }
  }

  it('van de a una y en orden: la segunda no arranca hasta que terminó la primera, y parte de lo que esa dejó', async () => {
    const { cola, avisos } = armarCola()
    const orden: string[] = []
    let soltar = () => {}
    const lenta = new Promise<void>(ok => { soltar = ok })
    const primera = cola.encolar(async antes => { orden.push(`1 parte de ${antes?.recursos[0].id ?? 'nada'}`); await lenta; return datos('uno') })
    const segunda = cola.encolar(async antes => { orden.push(`2 parte de ${antes?.recursos[0].id ?? 'nada'}`); return datos('dos') })
    await unMomento()
    // La primera está esperando su respuesta: la segunda todavía no salió.
    expect(orden).toEqual(['1 parte de nada'])
    soltar()
    await Promise.all([primera, segunda])
    expect(orden).toEqual(['1 parte de nada', '2 parte de uno'])
    expect(avisos.map(queLeyo)).toEqual(['uno', 'dos'])
  })

  it('una lectura que falla avisa con su mensaje y no corta la cola: la que sigue parte de lo último que se leyó bien', async () => {
    const { cola, avisos } = armarCola()
    await cola.encolar(async () => datos('uno'))
    await cola.encolar(async () => { throw new TypeError('Failed to fetch') })
    let partio: string | undefined
    await cola.encolar(async antes => { partio = antes?.recursos[0].id; return datos('tres') })
    expect(partio).toBe('uno')
    expect(avisos.map(queLeyo)).toEqual(['uno', 'falla: No pudimos conectar con el servidor. Revisá tu conexión y probá de nuevo.', 'tres'])
  })

  it('una lectura que no tiene nada que cambiar (null) no avisa y deja lo leído como estaba', async () => {
    const { cola, avisos } = armarCola()
    await cola.encolar(async () => datos('uno'))
    await cola.encolar(async () => null)
    let partio: string | undefined
    await cola.encolar(async antes => { partio = antes?.recursos[0].id; return null })
    expect(partio).toBe('uno')
    expect(avisos.map(queLeyo)).toEqual(['uno'])
  })

  it('con el panel desmontado no se lee; y lo que llega después de desmontarlo se descarta', async () => {
    const { cola, avisos } = armarCola()
    let soltar = () => {}
    const lenta = new Promise<void>(ok => { soltar = ok })
    const enVuelo = cola.encolar(async () => { await lenta; return datos('tarde') })
    await unMomento()
    cola.cerrar()
    soltar()
    await enVuelo
    const leer = vi.fn(async () => datos('nunca'))
    await cola.encolar(leer)
    expect(leer).not.toHaveBeenCalled()
    expect(avisos).toEqual([])
    // Al volver a montarse (el doble montaje de desarrollo), sigue leyendo, y sin lo que se descartó.
    cola.abrir()
    let partio: DatosApi | null | undefined
    await cola.encolar(async antes => { partio = antes; return datos('uno') })
    expect(partio).toBeNull()
    expect(avisos.map(queLeyo)).toEqual(['uno'])
  })

  it('el refresco de cada minuto no se apila: mientras uno está en la cola, el que sigue no se suma', async () => {
    const { cola, avisos } = armarCola()
    let soltar = () => {}
    const lenta = new Promise<void>(ok => { soltar = ok })
    const leer = vi.fn(async () => { await lenta; return datos('refresco') })
    cola.refrescar(leer)
    cola.refrescar(leer)
    cola.refrescar(leer)
    await unMomento()
    expect(leer).toHaveBeenCalledTimes(1)
    soltar()
    await cola.encolar(async () => null)
    await unMomento()
    // Terminado el primero, el próximo sí entra.
    cola.refrescar(leer)
    await cola.encolar(async () => null)
    expect(leer).toHaveBeenCalledTimes(2)
    expect(avisos.map(queLeyo)).toEqual(['refresco', 'refresco'])
  })

  it('recuerda el día que el panel tiene a la vista', () => {
    const { cola } = armarCola()
    expect(cola.mirada).toBeNull()
    cola.mirar('2026-12-01')
    expect(cola.mirada).toBe('2026-12-01')
  })
})
