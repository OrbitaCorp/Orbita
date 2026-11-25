// El sitio público de un gimnasio real, sin red: qué arma con lo que lee de la
// API y cómo lleva una reserva (tomar el lugar, confirmarlo, la lista de
// espera), con una API de mentira. Lo que decide el servidor (el cupo, el
// candado, la clave del intento) está probado en apps/api/test/gimnasio.e2e-spec.ts.
import { describe, expect, it, vi } from 'vitest'
import { ReservasApiError } from '@/lib/reservasApi/cliente'
import type { ConfigPublica, Recurso, ReservaConToken } from '@/lib/reservasApi/tipos'
import type { GrillaApi } from '../gimnasioApi'
import { RUBROS_DE_GIMNASIO } from '@/lib/reservas/destinoPanel'
import { RUBROS_GYM } from '../../index'
import {
  DIAS_DE_GRILLA, Intento, RESERVA_INICIAL, anotarEnEspera, cargarSitio, confirmarLugar, continuarReserva, diasDelSitio, enviarReserva, erroresDeContacto, estaGuardado,
  firmaDe, negocioDelSitio, releerDias, rubroDelNegocio, soltarLugar, tomarLugar,
  type ApiDelSitio, type ClaseDelSitio, type DepsDeReserva, type EstadoDeReserva, type TiendaDelSitio,
} from '../sitio'

const HOY = '2026-11-25' // miércoles
const LUNES = '2026-11-30'

const tienda = (over: Partial<TiendaDelSitio> = {}): TiendaDelSitio => ({
  business: { name: 'Box Norte SRL', subdomain: 'box-norte', subrubros: ['crossfit'] },
  appearance: { storeName: 'Box Norte', tagline: 'Un WOD por día.', logoUrl: 'https://cdn.test/logo.png' },
  contact: { whatsapp: '3757 55-0101' },
  ...over,
})

const config = (over: Partial<ConfigPublica> = {}): ConfigPublica => ({
  modulo: 'GIMNASIO', confirmacion: 'AUTOMATICA', retencionMinutos: 10, anticipacionMinimaMinutos: 30, anticipacionMaximaDias: 14, cancelacionHastaHoras: 2,
  reprogramacionHastaHoras: 2, reprogramacionesMaximas: 1, senaPorcentaje: 0, senaReembolsable: true, listaDeEspera: true,
  horario: { '1': [[420, 1320]], '3': [[420, 1320]] }, publico: null, ...over,
})

const recurso = (id: string, nombre: string, over: Partial<Recurso> = {}): Recurso => ({
  id, modulo: 'GIMNASIO', tipo: 'CLASE', nombre, descripcion: null, cupo: 12, duracionMinutos: 60, pasoMinutos: null, margenMinutos: null, maximoSeguidos: 1, precio: 0,
  horario: { '1': [[1140, 1200]] }, datos: { gimnasio: { actividadId: 'a1', color: '#2563EB', profeId: 'p1', profe: 'Nico', sala: 'Box' } }, orden: 0, activo: true, ...over,
})
const WOD = recurso('r-wod', 'WOD')
const HALTERO = recurso('r-haltero', 'Halterofilia', { cupo: 3, horario: { '3': [[1080, 1140]] }, datos: { gimnasio: { actividadId: 'a3', color: '#059669', profeId: '', profe: '', sala: 'Box' } } })
const PAUSADA = recurso('r-pausada', 'Yoga', { activo: false, horario: { '1': [[600, 660]] } })

const PLANES = [
  { id: 'pl-prueba', tipo: 'PRUEBA' as const, nombre: 'WOD de prueba', precio: 0, clases: null, porSemana: null, vigenciaDias: 30 },
  { id: 'pl-pack', tipo: 'PACK' as const, nombre: 'Pack de 8 WODs', precio: 60000, clases: 8, porSemana: null, vigenciaDias: 90 },
]

const grilla = (over: Partial<GrillaApi> = {}): GrillaApi => ({
  desde: HOY, hasta: '2026-12-09',
  dias: [
    { fecha: HOY, cerrado: false, motivo: null, sesiones: [{ recursoId: 'r-haltero', inicioMinutos: 1080, finMinutos: 1140, libres: 0, cupo: 3 }] },
    { fecha: '2026-11-26', cerrado: true, motivo: 'Feriado', sesiones: [] },
    { fecha: LUNES, cerrado: false, motivo: null, sesiones: [
      { recursoId: 'r-wod', inicioMinutos: 1140, finMinutos: 1200, libres: 11, cupo: 12 },
      { recursoId: 'r-que-no-conozco', inicioMinutos: 600, finMinutos: 660, libres: 5, cupo: 5 },
    ] },
  ],
  ...over,
})

const retenida = (over: Partial<ReservaConToken> = {}): ReservaConToken => ({
  id: 'res-1', modulo: 'GIMNASIO', recursoId: 'r-wod', servicioId: null, codigo: 'ABC234', estado: 'RETENIDA', origen: 'TIENDA',
  inicio: '2026-11-30T22:00:00.000Z', fin: '2026-11-30T23:00:00.000Z', fecha: LUNES, inicioMinutos: 1140, finMinutos: 1200, cantidad: 1,
  retenidaHasta: '2026-11-25T13:10:00.000Z', clienteId: null, clienteNombre: '', clienteTelefono: null, clienteEmail: null, notas: null, servicio: null, extras: null,
  datos: null, precio: 0, sena: 0, pagado: 0, pagoMetodo: null, confirmadaEn: null, completadaEn: null, canceladaEn: null, canceladaPor: null, motivoCancelacion: null,
  reprogramaciones: 0, version: 1, creadaEn: '2026-11-25T13:00:00.000Z', token: 'tok-1', ...over,
})

/** Las 10:00 de Argentina del miércoles 25: diez minutos antes de que venza la retenida de ejemplo. */
const AHORA = new Date('2026-11-25T13:00:00.000Z').getTime()

function api(over: Partial<ApiDelSitio> = {}): ApiDelSitio {
  return {
    tienda: vi.fn(async () => tienda()),
    config: vi.fn(async () => config()),
    recursos: vi.fn(async () => [WOD, HALTERO, PAUSADA]),
    planes: vi.fn(async () => PLANES),
    grilla: vi.fn(async () => grilla()),
    retener: vi.fn(async () => retenida()),
    confirmar: vi.fn(async () => retenida({ estado: 'CONFIRMADA', retenidaHasta: null, clienteNombre: 'Ana Sosa', clienteEmail: 'ana@test.com' })),
    cancelar: vi.fn(async () => ({})),
    anotarseEnEspera: vi.fn(async () => ({ id: 'esp-1', token: 'tok-e', yaEstaba: false, estado: 'ESPERANDO' as const, posicion: 2, inicio: '', fin: '' })),
    ...over,
  }
}

const claseWod = (over: Partial<ClaseDelSitio> = {}): ClaseDelSitio => ({ id: 'r-wod', recursoId: 'r-wod', fecha: LUNES, inicio: 1140, fin: 1200, actividad: 'WOD', color: '#2563EB', profe: 'Nico', sala: 'Box', libres: 11, cupo: 12, ...over })
const ANA = { nombre: '  Ana Sosa ', telefono: ' 3757 55-0202 ', email: '', notas: '' }

describe('el negocio del sitio', () => {
  it('el rubro es el primero de sus subrubros que sea de Gimnasio; sin ninguno, el gimnasio de siempre', () => {
    expect(rubroDelNegocio(['crossfit']).key).toBe('crossfit')
    expect(rubroDelNegocio(['indumentaria', 'yoga']).key).toBe('yoga')
    expect(rubroDelNegocio([]).key).toBe('gym')
    expect(rubroDelNegocio(null).key).toBe('gym')
  })

  it('se arma solo con lo público: nunca aparecen los datos del negocio de ejemplo', () => {
    const { rubro, negocio } = negocioDelSitio({ slug: 'box-norte', tienda: tienda(), config: config(), recursos: [WOD, HALTERO, PAUSADA], planes: PLANES })
    expect(rubro.key).toBe('crossfit')
    expect(negocio).toMatchObject({
      rubro: 'crossfit', nombre: 'Box Norte', slug: 'box-norte', descripcion: 'Un WOD por día.', telefono: '3757 55-0101', logo: 'https://cdn.test/logo.png',
      direccion: '', ciudad: '', fotoPortada: '', galeria: [], anticipacionDias: 14, cancelaHastaHoras: 2, bloqueos: [],
    })
    // Las clases y lo que se arma con ellas: solo de los recursos activos.
    expect(negocio.clases.map(c => c.id)).toEqual(['r-wod', 'r-haltero'])
    expect(negocio.actividades.map(a => a.nombre)).toEqual(['WOD', 'Halterofilia'])
    expect(negocio.profes.map(p => p.nombre)).toEqual(['Nico'])
    expect(negocio.planes.map(p => [p.tipo, p.nombre, p.activo])).toEqual([['prueba', 'WOD de prueba', true], ['pack', 'Pack de 8 WODs', true]])
    expect(negocio.apertura).toEqual({ dias: [0, 2], desde: 420, hasta: 1320 })
  })

  it('sin nombre de tienda usa el del negocio; sin frase ni WhatsApp, quedan vacíos', () => {
    const { negocio } = negocioDelSitio({ slug: 'x', tienda: tienda({ appearance: null, contact: null }), config: config(), recursos: [], planes: [] })
    expect(negocio).toMatchObject({ nombre: 'Box Norte SRL', descripcion: '', telefono: '', logo: null, clases: [], planes: [] })
  })
})

describe('los días del sitio', () => {
  const { negocio } = negocioDelSitio({ slug: 'box-norte', tienda: tienda(), config: config(), recursos: [WOD, HALTERO], planes: [] })

  it('cada sesión de la grilla sale con los datos de su clase; la de una clase que no conoce no se muestra', () => {
    const dias = diasDelSitio(negocio, grilla())
    expect(dias.map(d => [d.fecha, d.cerrado, d.motivo, d.clases.length])).toEqual([[HOY, false, null, 1], ['2026-11-26', true, 'Feriado', 0], [LUNES, false, null, 1]])
    expect(dias[0].clases[0]).toEqual({ id: 'r-haltero', recursoId: 'r-haltero', fecha: HOY, inicio: 1080, fin: 1140, actividad: 'Halterofilia', color: '#059669', profe: '', sala: 'Box', libres: 0, cupo: 3 })
    expect(dias[2].clases[0]).toMatchObject({ id: 'r-wod', actividad: 'WOD', profe: 'Nico', libres: 11, cupo: 12 })
  })

  it('las clases de un día van por hora', () => {
    const manana = recurso('r-manana', 'Open box', { horario: { '1': [[420, 480]] }, datos: { gimnasio: { actividadId: 'a2', color: '', profeId: 'p1', profe: 'Nico', sala: 'Box' } } })
    const n = negocioDelSitio({ slug: 'x', tienda: tienda(), config: config(), recursos: [WOD, manana], planes: [] }).negocio
    const dias = diasDelSitio(n, { desde: LUNES, hasta: LUNES, dias: [{ fecha: LUNES, cerrado: false, motivo: null, sesiones: [
      { recursoId: 'r-wod', inicioMinutos: 1140, finMinutos: 1200, libres: 1, cupo: 12 }, { recursoId: 'r-manana', inicioMinutos: 420, finMinutos: 480, libres: 12, cupo: 12 },
    ] }] })
    expect(dias[0].clases.map(c => `${c.actividad}@${c.inicio}`)).toEqual(['Open box@420', 'WOD@1140'])
  })
})

describe('cargar el sitio', () => {
  it('pide todo una vez, y la grilla desde hoy hasta donde el negocio deja reservar', async () => {
    const a = api()
    const c = await cargarSitio(a, 'box-norte', HOY)
    expect(a.grilla).toHaveBeenCalledTimes(1)
    expect(a.grilla).toHaveBeenCalledWith(HOY, '2026-12-09')
    for (const f of [a.tienda, a.config, a.recursos, a.planes]) expect(f).toHaveBeenCalledTimes(1)
    expect(c.negocio.nombre).toBe('Box Norte')
    expect(c.rubro.key).toBe('crossfit')
    expect(c.reglas).toEqual({ dias: 14, cancelaHastaHoras: 2, retencionMinutos: 10, listaDeEspera: true, confirmaElNegocio: false })
    expect(c.dias).toHaveLength(3)
    // El horario del negocio, día por día (0 = lunes): lunes y miércoles de 7 a 22.
    expect(c.horarios).toEqual([{ dia: 0, inicio: 420, fin: 1320 }, { dia: 2, inicio: 420, fin: 1320 }])
  })

  it('si el negocio deja reservar más lejos que la grilla, muestra hasta donde llega la grilla', async () => {
    const a = api({ config: vi.fn(async () => config({ anticipacionMaximaDias: 365, confirmacion: 'MANUAL', listaDeEspera: false })) })
    const c = await cargarSitio(a, 'box-norte', HOY)
    expect(DIAS_DE_GRILLA).toBe(34)
    expect(a.grilla).toHaveBeenCalledWith(HOY, '2026-12-29')
    expect(c.reglas).toMatchObject({ dias: 34, confirmaElNegocio: true, listaDeEspera: false })
  })

  it('sin los planes el sitio se muestra igual; sin la config (reservas en pausa), falla con el mensaje de la API', async () => {
    const sinPlanes = await cargarSitio(api({ planes: vi.fn(async () => { throw new ReservasApiError(404, 'No encontrado') }) }), 'box-norte', HOY)
    expect(sinPlanes.negocio.planes).toEqual([])
    expect(sinPlanes.dias).toHaveLength(3)
    const pausado = api({ config: vi.fn(async () => { throw new ReservasApiError(404, 'Las reservas online están pausadas por el momento.') }) })
    await expect(cargarSitio(pausado, 'box-norte', HOY)).rejects.toThrow('Las reservas online están pausadas por el momento.')
  })

  it('releer los días pide solo la grilla y deja el negocio como estaba', async () => {
    const a = api()
    const c = await cargarSitio(a, 'box-norte', HOY)
    const llena = grilla()
    llena.dias[2].sesiones[0].libres = 0
    vi.mocked(a.grilla).mockResolvedValueOnce(llena)
    const d = await releerDias(a, c, HOY)
    expect(a.grilla).toHaveBeenCalledTimes(2)
    expect(a.grilla).toHaveBeenLastCalledWith(HOY, '2026-12-09')
    expect(a.recursos).toHaveBeenCalledTimes(1)
    expect(d.negocio).toBe(c.negocio)
    expect(d.dias[2].clases[0].libres).toBe(0)
  })
})

describe('los datos de quien reserva', () => {
  it('pide nombre y un celular con código de área; el email es opcional pero, si está, tiene que ser un email', () => {
    expect(erroresDeContacto({ nombre: 'Ana Sosa', telefono: '3757 55-0202', email: '', notas: '' })).toEqual({})
    expect(erroresDeContacto({ nombre: 'Ana Sosa', telefono: '+54 (3757) 55-0202', email: 'ana@test.com', notas: '' })).toEqual({})
    expect(erroresDeContacto({ nombre: ' A ', telefono: '', email: '', notas: '' })).toEqual({ nombre: 'Escribí tu nombre y apellido.', telefono: 'Escribí un celular con código de área.' })
    expect(erroresDeContacto({ nombre: 'Ana Sosa', telefono: '55-0202', email: '', notas: '' }).telefono).toBe('Escribí un celular con código de área.')
    expect(erroresDeContacto({ nombre: 'Ana Sosa', telefono: 'mi celu 3757550202', email: 'ana@', notas: '' })).toEqual({ telefono: 'Solo números (podés usar espacios, + y guiones).', email: 'Revisá el email.' })
  })
})

describe('la clave del intento', () => {
  it('es la misma mientras se pida lo mismo; con otra clase, o al cerrar el intento, es otra', () => {
    let n = 0
    const i = new Intento(() => `clave-${++n}`)
    const wod = firmaDe(claseWod())
    expect(i.para(wod)).toBe('clave-1')
    expect(i.para(wod)).toBe('clave-1')
    expect(i.para(firmaDe(claseWod({ fecha: '2026-12-07' })))).toBe('clave-2')
    expect(i.para(wod)).toBe('clave-3')
    i.cerrar()
    expect(i.para(wod)).toBe('clave-4')
  })
})

describe('tomar el lugar', () => {
  const intento = () => { let n = 0; return new Intento(() => `clave-${++n}`) }

  it('retiene un lugar de esa clase y devuelve hasta cuándo queda guardado', async () => {
    const a = api()
    const r = await tomarLugar(a, intento(), claseWod(), () => AHORA)
    expect(a.retener).toHaveBeenCalledWith({ modulo: 'GIMNASIO', recursoId: 'r-wod', fecha: LUNES, inicioMinutos: 1140, cantidad: 1, clave: 'clave-1' })
    expect(r).toEqual({ ok: true, lugar: { token: 'tok-1', hasta: '2026-11-25T13:10:00.000Z', firma: 'r-wod|2026-11-30|1140' } })
  })

  it('un doble toque o un reintento mandan la misma clave: el servidor devuelve el mismo lugar', async () => {
    const a = api()
    const i = intento()
    const [uno, dos] = await Promise.all([tomarLugar(a, i, claseWod(), () => AHORA), tomarLugar(a, i, claseWod(), () => AHORA)])
    expect(vi.mocked(a.retener).mock.calls.map(c => c[0].clave)).toEqual(['clave-1', 'clave-1'])
    expect(uno).toEqual(dos)
  })

  it('si el servidor devuelve un lugar que ya venció (el del intento anterior), prueba una vez con una clave nueva', async () => {
    const a = api({
      retener: vi.fn()
        .mockResolvedValueOnce(retenida({ token: 'tok-viejo', retenidaHasta: '2026-11-25T12:50:00.000Z' }))
        .mockResolvedValueOnce(retenida({ token: 'tok-nuevo', retenidaHasta: '2026-11-25T13:10:00.000Z' })),
    })
    const r = await tomarLugar(a, intento(), claseWod(), () => AHORA)
    expect(vi.mocked(a.retener).mock.calls.map(c => c[0].clave)).toEqual(['clave-1', 'clave-2'])
    expect(r).toMatchObject({ ok: true, lugar: { token: 'tok-nuevo' } })
  })

  it('si tampoco así queda tomado (una vencida que ya se marcó), lo dice sin insistir', async () => {
    const a = api({ retener: vi.fn(async () => retenida({ estado: 'VENCIDA', retenidaHasta: null })) })
    const r = await tomarLugar(a, intento(), claseWod(), () => AHORA)
    expect(a.retener).toHaveBeenCalledTimes(2)
    expect(r).toEqual({ ok: false, mensaje: 'No pudimos guardarte el lugar. Probá de nuevo.', lleno: false })
  })

  it('si la clase se llenó mientras tanto responde con el mensaje de la API y avisa que hay que volver a mirar', async () => {
    const a = api({ retener: vi.fn(async () => { throw new ReservasApiError(409, 'No queda lugar en ese horario.') }) })
    expect(await tomarLugar(a, intento(), claseWod(), () => AHORA)).toEqual({ ok: false, mensaje: 'No queda lugar en ese horario.', lleno: true })
  })

  it('un pedido que la API rechaza (muy sobre la hora) o un corte de conexión no son "clase llena"', async () => {
    const tarde = api({ retener: vi.fn(async () => { throw new ReservasApiError(400, 'Hay que reservar con al menos 30 minutos de anticipación.') }) })
    expect(await tomarLugar(tarde, intento(), claseWod(), () => AHORA)).toEqual({ ok: false, mensaje: 'Hay que reservar con al menos 30 minutos de anticipación.', lleno: false })
    const sinRed = api({ retener: vi.fn(async () => { throw new TypeError('Failed to fetch') }) })
    const r = await tomarLugar(sinRed, intento(), claseWod(), () => AHORA)
    expect(r).toMatchObject({ ok: false, lleno: false })
    expect(r.ok === false && r.mensaje).toMatch(/No pudimos conectarnos.*no se duplica/)
  })

  it('soltar un lugar no avisa nada si no se puede: se vence solo', async () => {
    const a = api({ cancelar: vi.fn(async () => { throw new ReservasApiError(400, 'Ya no se puede cancelar.') }) })
    await expect(soltarLugar(a, { token: 'tok-1', hasta: '', firma: '' })).resolves.toBeUndefined()
    expect(a.cancelar).toHaveBeenCalledWith('tok-1')
  })
})

describe('confirmar el lugar', () => {
  const lugar = { token: 'tok-1', hasta: '2026-11-25T13:10:00.000Z', firma: 'r-wod|2026-11-30|1140' }

  it('manda los datos sin espacios de más, el email y las notas solo si están, y devuelve el código', async () => {
    const a = api()
    const r = await confirmarLugar(a, lugar, ANA)
    expect(a.confirmar).toHaveBeenCalledWith('tok-1', { cliente: { nombre: 'Ana Sosa', telefono: '3757 55-0202' } })
    expect(r).toEqual({ ok: true, hecha: { codigo: 'ABC234', pendiente: false, nombre: 'Ana Sosa', email: 'ana@test.com' } })
    await confirmarLugar(a, lugar, { ...ANA, email: ' ana@test.com ', notas: ' Primera vez ' })
    expect(a.confirmar).toHaveBeenLastCalledWith('tok-1', { cliente: { nombre: 'Ana Sosa', telefono: '3757 55-0202', email: 'ana@test.com' }, notas: 'Primera vez' })
  })

  it('si el negocio confirma a mano, la reserva queda pendiente y se dice', async () => {
    const a = api({ confirmar: vi.fn(async () => retenida({ estado: 'PENDIENTE', retenidaHasta: null, clienteNombre: 'Ana Sosa' })) })
    expect(await confirmarLugar(a, lugar, ANA)).toMatchObject({ ok: true, hecha: { pendiente: true, email: null } })
  })

  it('si se venció el tiempo (409) hay que elegir la clase de nuevo; otro rechazo deja seguir en el formulario', async () => {
    const vencido = api({ confirmar: vi.fn(async () => { throw new ReservasApiError(409, 'Se venció el tiempo para confirmar. Elegí el horario de nuevo.') }) })
    expect(await confirmarLugar(vencido, lugar, ANA)).toEqual({ ok: false, mensaje: 'Se venció el tiempo para confirmar. Elegí el horario de nuevo.', vencido: true })
    const tope = api({ confirmar: vi.fn(async () => { throw new ReservasApiError(400, 'Ya tenés 2 reservas activas. Cancelá alguna para reservar otra.') }) })
    expect(await confirmarLugar(tope, lugar, ANA)).toEqual({ ok: false, mensaje: 'Ya tenés 2 reservas activas. Cancelá alguna para reservar otra.', vencido: false })
  })
})

describe('la lista de espera', () => {
  const llena = claseWod({ libres: 0 })

  it('anota a la persona en la espera de esa clase y devuelve su lugar en la lista', async () => {
    const a = api()
    const r = await anotarEnEspera(a, llena, ANA)
    expect(a.anotarseEnEspera).toHaveBeenCalledWith({ modulo: 'GIMNASIO', recursoId: 'r-wod', fecha: LUNES, inicioMinutos: 1140, cliente: { nombre: 'Ana Sosa', telefono: '3757 55-0202' } })
    expect(r).toEqual({ ok: true, posicion: 2, yaEstaba: false })
  })

  it('si ya estaba esperando, lo dice (no se anota dos veces)', async () => {
    const a = api({ anotarseEnEspera: vi.fn(async () => ({ id: 'esp-1', token: null, yaEstaba: true, estado: 'ESPERANDO' as const, posicion: 1, inicio: '', fin: '' })) })
    expect(await anotarEnEspera(a, llena, ANA)).toEqual({ ok: true, posicion: 1, yaEstaba: true })
  })

  it('si se liberó un lugar mientras tanto, avisa que se reserva directo; otro rechazo es solo su mensaje', async () => {
    const libre = api({ anotarseEnEspera: vi.fn(async () => { throw new ReservasApiError(400, 'Todavía hay lugar en ese horario: reservá directo.') }) })
    expect(await anotarEnEspera(libre, llena, ANA)).toEqual({ ok: false, mensaje: 'Todavía hay lugar en ese horario: reservá directo.', hayLugar: true })
    const sinEspera = api({ anotarseEnEspera: vi.fn(async () => { throw new ReservasApiError(400, 'Este negocio no tiene lista de espera.') }) })
    expect(await anotarEnEspera(sinEspera, llena, ANA)).toEqual({ ok: false, mensaje: 'Este negocio no tiene lista de espera.', hayLugar: false })
  })
})

// ─── El flujo de la pantalla de reserva ──────────────────────────────────────

describe('el flujo de la reserva (lo que sigue a cada toque)', () => {
  /** Corre una acción y devuelve los estados por los que pasó la pantalla, en orden. */
  const correr = async (accion: (poner: (e: EstadoDeReserva) => void) => Promise<void>) => {
    const pasos: EstadoDeReserva[] = []
    await accion(e => pasos.push(e))
    return pasos
  }
  const deps = (a: ApiDelSitio, over: Partial<DepsDeReserva> = {}) => {
    let n = 0
    const onCambio = vi.fn()
    const d: DepsDeReserva = { api: a, intento: new Intento(() => `clave-${++n}`), listaDeEspera: true, onCambio, reloj: () => AHORA, ...over }
    return { ...d, onCambio }
  }
  const LUGAR = { token: 'tok-1', hasta: '2026-11-25T13:10:00.000Z', firma: 'r-wod|2026-11-30|1140' }
  const enDatos: EstadoDeReserva = { ...RESERVA_INICIAL, paso: 1, camino: 'lugar', lugar: LUGAR }

  it('continuar con lugar: muestra que está guardando, toma el lugar y pasa a los datos', async () => {
    const a = api()
    const d = deps(a)
    const pasos = await correr(p => continuarReserva(RESERVA_INICIAL, claseWod(), d, p))
    expect(pasos).toEqual([
      { ...RESERVA_INICIAL, enviando: true },
      { ...RESERVA_INICIAL, paso: 1, camino: 'lugar', lugar: LUGAR },
    ])
    expect(a.retener).toHaveBeenCalledTimes(1)
    // Los lugares no se vuelven a pedir: el propio, recién tomado, no puede aparecer como "clase completa".
    expect(d.onCambio).not.toHaveBeenCalled()
  })

  it('si ya tenía ese lugar y sigue guardado (volvió atrás y siguió), pasa sin pedir nada; si se venció, lo toma de nuevo', async () => {
    const a = api()
    const conLugar: EstadoDeReserva = { ...RESERVA_INICIAL, lugar: LUGAR, aviso: 'algo de antes' }
    expect(await correr(p => continuarReserva(conLugar, claseWod(), deps(a), p))).toEqual([{ ...conLugar, aviso: null, paso: 1 }])
    expect(a.retener).not.toHaveBeenCalled()
    // Un minuto después de que venció.
    const tarde = deps(a, { reloj: () => new Date('2026-11-25T13:11:00.000Z').getTime() })
    vi.mocked(a.retener).mockResolvedValue(retenida({ token: 'tok-2', retenidaHasta: '2026-11-25T13:21:00.000Z' }))
    const pasos = await correr(p => continuarReserva(conLugar, claseWod(), tarde, p))
    expect(pasos.at(-1)).toMatchObject({ paso: 1, lugar: { token: 'tok-2' }, enviando: false })
  })

  it('con otra clase elegida suelta el lugar que tenía: no quedan dos guardados', async () => {
    const a = api({ retener: vi.fn(async () => retenida({ token: 'tok-otra' })) })
    const otra = claseWod({ fecha: '2026-12-07' })
    const pasos = await correr(p => continuarReserva({ ...RESERVA_INICIAL, lugar: LUGAR }, otra, deps(a), p))
    expect(a.cancelar).toHaveBeenCalledWith('tok-1')
    expect(pasos.at(-1)).toMatchObject({ paso: 1, lugar: { token: 'tok-otra', firma: 'r-wod|2026-12-07|1140' } })
  })

  it('con la clase completa va a la lista de espera sin tomar nada; sin lista de espera no pasa nada', async () => {
    const a = api()
    const llena = claseWod({ libres: 0 })
    expect(await correr(p => continuarReserva(RESERVA_INICIAL, llena, deps(a), p))).toEqual([{ ...RESERVA_INICIAL, paso: 1, camino: 'espera' }])
    expect(await correr(p => continuarReserva(RESERVA_INICIAL, llena, deps(a, { listaDeEspera: false }), p))).toEqual([])
    expect(a.retener).not.toHaveBeenCalled()
  })

  it('si la clase se completó justo antes, lo dice, se queda eligiendo y pide los lugares de nuevo', async () => {
    const a = api({ retener: vi.fn(async () => { throw new ReservasApiError(409, 'No queda lugar en ese horario.') }) })
    const d = deps(a)
    const pasos = await correr(p => continuarReserva(RESERVA_INICIAL, claseWod({ libres: 1 }), d, p))
    expect(pasos.at(-1)).toEqual({ ...RESERVA_INICIAL, aviso: 'Esa clase se acaba de completar. Podés anotarte en la lista de espera o elegir otra.' })
    expect(d.onCambio).toHaveBeenCalledTimes(1)
    const sinEspera = deps(a, { listaDeEspera: false })
    expect((await correr(p => continuarReserva(RESERVA_INICIAL, claseWod({ libres: 1 }), sinEspera, p))).at(-1)?.aviso).toBe('Esa clase se acaba de completar. Elegí otra.')
  })

  it('otro rechazo (muy sobre la hora, sin conexión) se muestra y no pide los lugares de nuevo', async () => {
    const a = api({ retener: vi.fn(async () => { throw new ReservasApiError(400, 'Hay que reservar con al menos 30 minutos de anticipación.') }) })
    const d = deps(a)
    const pasos = await correr(p => continuarReserva(RESERVA_INICIAL, claseWod(), d, p))
    expect(pasos.at(-1)).toEqual({ ...RESERVA_INICIAL, aviso: 'Hay que reservar con al menos 30 minutos de anticipación.' })
    expect(d.onCambio).not.toHaveBeenCalled()
  })

  it('mientras un pedido viaja, otro toque no hace nada', async () => {
    const a = api()
    expect(await correr(p => continuarReserva({ ...RESERVA_INICIAL, enviando: true }, claseWod(), deps(a), p))).toEqual([])
    expect(await correr(p => enviarReserva({ ...enDatos, enviando: true }, claseWod(), ANA, deps(a), p))).toEqual([])
    expect(a.retener).not.toHaveBeenCalled()
    expect(a.confirmar).not.toHaveBeenCalled()
  })

  it('confirmar: el lugar queda firme, se cierra el intento y se piden los lugares de nuevo', async () => {
    const a = api()
    const d = deps(a)
    const clave = d.intento.para(LUGAR.firma)
    const pasos = await correr(p => enviarReserva(enDatos, claseWod(), ANA, d, p))
    expect(pasos[0]).toEqual({ ...enDatos, enviando: true })
    expect(pasos.at(-1)).toEqual({ ...enDatos, lugar: null, terminada: { tipo: 'reserva', clase: claseWod(), codigo: 'ABC234', pendiente: false, nombre: 'Ana Sosa', email: 'ana@test.com' } })
    expect(d.onCambio).toHaveBeenCalledTimes(1)
    // La próxima reserva de esa misma clase es otro intento, con otra clave.
    expect(d.intento.para(LUGAR.firma)).not.toBe(clave)
  })

  it('si al confirmar el lugar ya se venció, vuelve a elegir con el mensaje de la API y los lugares al día', async () => {
    const a = api({ confirmar: vi.fn(async () => { throw new ReservasApiError(409, 'Se venció el tiempo para confirmar. Elegí el horario de nuevo.') }) })
    const d = deps(a)
    const pasos = await correr(p => enviarReserva(enDatos, claseWod(), ANA, d, p))
    expect(pasos.at(-1)).toEqual({ ...RESERVA_INICIAL, aviso: 'Se venció el tiempo para confirmar. Elegí el horario de nuevo.' })
    expect(d.onCambio).toHaveBeenCalledTimes(1)
  })

  it('si la API rechaza los datos (ya tiene el máximo de reservas), sigue en el formulario con su lugar', async () => {
    const a = api({ confirmar: vi.fn(async () => { throw new ReservasApiError(400, 'Ya tenés 2 reservas activas. Cancelá alguna para reservar otra.') }) })
    const d = deps(a)
    const pasos = await correr(p => enviarReserva(enDatos, claseWod(), ANA, d, p))
    expect(pasos.at(-1)).toEqual({ ...enDatos, aviso: 'Ya tenés 2 reservas activas. Cancelá alguna para reservar otra.' })
    expect(d.onCambio).not.toHaveBeenCalled()
  })

  it('por el camino de la espera anota en la lista y no confirma ningún lugar', async () => {
    const a = api()
    const d = deps(a)
    const llena = claseWod({ libres: 0 })
    const enEspera: EstadoDeReserva = { ...RESERVA_INICIAL, paso: 1, camino: 'espera' }
    const pasos = await correr(p => enviarReserva(enEspera, llena, { ...ANA, email: 'ana@test.com' }, d, p))
    expect(pasos.at(-1)).toEqual({ ...enEspera, terminada: { tipo: 'espera', clase: llena, posicion: 2, yaEstaba: false, nombre: 'Ana Sosa', email: 'ana@test.com' } })
    expect(a.confirmar).not.toHaveBeenCalled()
    expect(d.onCambio).toHaveBeenCalledTimes(1)
  })

  it('si al anotarse en la espera se había liberado un lugar, vuelve a elegir para reservarlo directo', async () => {
    const a = api({ anotarseEnEspera: vi.fn(async () => { throw new ReservasApiError(400, 'Todavía hay lugar en ese horario: reservá directo.') }) })
    const d = deps(a)
    const pasos = await correr(p => enviarReserva({ ...RESERVA_INICIAL, paso: 1, camino: 'espera' }, claseWod({ libres: 0 }), ANA, d, p))
    expect(pasos.at(-1)).toEqual({ ...RESERVA_INICIAL, camino: 'espera', aviso: 'Se liberó un lugar en esa clase: ya la podés reservar.' })
    expect(d.onCambio).toHaveBeenCalledTimes(1)
  })

  it('sin lugar tomado no hay nada que confirmar: vuelve a elegir', async () => {
    const a = api()
    expect(await correr(p => enviarReserva({ ...RESERVA_INICIAL, paso: 1 }, claseWod(), ANA, deps(a), p))).toEqual([RESERVA_INICIAL])
    expect(a.confirmar).not.toHaveBeenCalled()
  })

  it('el lugar está guardado solo para su clase y hasta su hora', () => {
    expect(estaGuardado(LUGAR, claseWod(), AHORA)).toBe(true)
    expect(estaGuardado(LUGAR, claseWod({ fecha: '2026-12-07' }), AHORA)).toBe(false)
    expect(estaGuardado(LUGAR, claseWod(), new Date(LUGAR.hasta).getTime())).toBe(false)
    expect(estaGuardado(null, claseWod(), AHORA)).toBe(false)
    expect(estaGuardado(LUGAR, null, AHORA)).toBe(false)
  })
})

describe('los rubros de Gimnasio, en lo compartido', () => {
  it('la lista que decide qué negocio muestra el sitio de Gimnasio es la de los rubros del módulo', () => {
    expect([...RUBROS_DE_GIMNASIO]).toEqual(RUBROS_GYM.map(r => r.key))
  })
})
