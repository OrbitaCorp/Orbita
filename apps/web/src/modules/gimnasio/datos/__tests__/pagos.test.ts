// Con qué se paga un lugar: lo que el panel le ofrece a quien anota (con su
// plan, aparte o con la clase de prueba) y cómo queda cada cosa después. Son
// las mismas cuentas que hace la API al anotar (apps/api/src/gimnasio/dominio/
// planes.ts): acá sirven para ofrecer lo que corresponde antes de guardar.
//
// Dos partes: las cuentas sobre los planes de alguien (uno en la demo, varios
// con la API) y las acciones de la demo, que guardan en el almacén. Corre en
// node: el almacén usa localStorage dentro de un try, así que vive en memoria.
import { beforeEach, describe, expect, it } from 'vitest'
import { sumarDias } from '@/lib/reservas/fechas'
import {
  HOY, clasesDelDia, negocioDe, pagoDe, pagosPosibles, planActualDe, planDelPago, planesDeSocio, rubroPorKey, type Inscripcion, type NegocioGym, type Plan, type PlanDeSocio, type Socio,
} from '../index'
import { accionesGym, inscripcionesDelDemo, leerDemo, negocioDelDemo, sociosDelDemo } from '../negocio'
import { accionesDemo } from '../origen/demo'

const RUBRO = 'crossfit'
const LUNES = sumarDias(HOY, 2) // HOY es sábado 14/11/2026

// Un negocio con los cuatro tipos de plan, como los trae la API.
const PLANES: Plan[] = [
  { id: 'p-prueba', tipo: 'prueba', nombre: 'Clase de prueba', precio: 0, vigenciaDias: 30, activo: true },
  { id: 'p-suelta', tipo: 'suelta', nombre: 'Clase suelta', precio: 7000, vigenciaDias: 1, activo: false },
  { id: 'p-pack', tipo: 'pack', nombre: 'Pack de 8', precio: 56000, clases: 8, vigenciaDias: 90, activo: true },
  { id: 'p-2x', tipo: 'membresia', nombre: '2 veces por semana', precio: 48000, porSemana: 2, vigenciaDias: 30, activo: true },
  { id: 'p-libre', tipo: 'membresia', nombre: 'Pase libre', precio: 60000, porSemana: 0, vigenciaDias: 30, activo: true },
]
const negocio: NegocioGym = { ...negocioDe(rubroPorKey(RUBRO)), planes: PLANES }

const plan = (over: Partial<PlanDeSocio> = {}): PlanDeSocio => ({ id: 's-pack', planId: 'p-pack', tipo: 'pack', nombre: 'Pack de 8', precio: 56000, desde: '2026-11-01', hasta: '2027-01-30', clases: 8, restantes: 3, porSemana: null, ...over })
const membresia = (over: Partial<PlanDeSocio> = {}) => plan({ id: 's-2x', planId: 'p-2x', tipo: 'membresia', nombre: '2 veces por semana', precio: 48000, desde: '2026-11-01', hasta: '2026-12-01', clases: null, restantes: null, porSemana: 2, ...over })
/** Alguien como lo arma el origen de la API: con la lista de sus planes. */
const conPlanes = (planes: PlanDeSocio[], over: Partial<Socio> = {}): Socio => ({ id: 'ficha-ana', nombre: 'Ana Sosa', telefono: '3757 55-0202', planId: planes[0]?.planId ?? null, desde: planes[0]?.desde ?? null, vence: planes[0]?.hasta ?? null, clasesRestantes: planes[0]?.restantes ?? null, probo: true, fichaId: 'ficha-ana', alumnoId: 'alu-1', planes, ...over })
const lugar = (over: Partial<Inscripcion> = {}): Inscripcion => ({ id: 'i1', claseId: 'c1', fecha: LUNES, socioId: 'ficha-ana', estado: 'reservada', creada: HOY, planId: 'p-2x', pago: 'plan', suscripcionId: 's-2x', ...over })

describe('con qué puede pagar un lugar', () => {
  it('con su pack, si le alcanzan las clases para todos los lugares; aparte se puede siempre, con el precio de la clase suelta', () => {
    const ana = conPlanes([plan()])
    const uno = pagosPosibles(negocio, ana, LUNES, HOY, [])
    expect(uno.plan).toEqual({ puede: true, con: ana.planes![0] })
    // La clase suelta se usa para cobrar aparte aunque no se ofrezca en el sitio.
    expect(uno.suelta?.id).toBe('p-suelta')
    expect(pagosPosibles(negocio, ana, LUNES, HOY, [], 3).plan.puede).toBe(true)
    expect(pagosPosibles(negocio, ana, LUNES, HOY, [], 4).plan).toEqual({ puede: false, motivo: 'A Ana le quedan 3 clases en el pack: no alcanzan para 4 lugares.' })
    expect(pagosPosibles(negocio, conPlanes([plan({ restantes: 0 })]), LUNES, HOY, []).plan).toEqual({ puede: false, motivo: 'A Ana no le quedan clases en el pack.' })
  })

  it('sin plan, vencido, o con un plan que no llega a esa clase o todavía no arrancó: no, y dice por qué', () => {
    expect(pagosPosibles(negocio, conPlanes([]), LUNES, HOY, []).plan).toEqual({ puede: false, motivo: 'Ana no tiene un plan.' })
    expect(pagosPosibles(negocio, conPlanes([plan({ hasta: '2026-11-10' })]), LUNES, HOY, []).plan.motivo).toBe('El plan de Ana venció el mar 10 nov.')
    // Vale hoy, pero la clase es de después de que venza.
    expect(pagosPosibles(negocio, conPlanes([plan({ hasta: '2026-11-20' })]), '2026-11-23', HOY, []).plan.motivo).toBe('El plan de Ana vence el vie 20 nov: esa clase es de después.')
    expect(pagosPosibles(negocio, conPlanes([membresia({ desde: '2026-12-02', hasta: '2027-01-01' })]), LUNES, HOY, []).plan.motivo).toBe('El plan de Ana arranca el mié 2 dic: esa clase es de antes.')
  })

  it('una membresía con tope cubre hasta sus clases de la semana, un lugar por clase; el pase libre no tiene tope', () => {
    const ana = conPlanes([membresia()])
    const martes = sumarDias(LUNES, 1)
    expect(pagosPosibles(negocio, ana, LUNES, HOY, [lugar({ fecha: martes })]).plan.puede).toBe(true)
    const dos = [lugar({ id: 'a', fecha: martes }), lugar({ id: 'b', fecha: sumarDias(LUNES, 3), estado: 'ausente' })]
    expect(pagosPosibles(negocio, ana, LUNES, HOY, dos).plan).toEqual({ puede: false, motivo: 'Ana ya usó sus 2 clases de esa semana.' })
    // La semana siguiente arranca de cero.
    expect(pagosPosibles(negocio, ana, sumarDias(LUNES, 7), HOY, dos).plan.puede).toBe(true)
    // No cuentan: una cancelada, una que se cobró aparte, una sin definir, ni la de otra persona.
    const noCuentan = [lugar({ id: 'a', fecha: martes }), lugar({ id: 'b', estado: 'cancelada' }), lugar({ id: 'c', pago: 'aparte' }), lugar({ id: 'd', pago: null }), lugar({ id: 'e', socioId: 'otra' })]
    expect(pagosPosibles(negocio, ana, LUNES, HOY, noCuentan).plan.puede).toBe(true)
    expect(pagosPosibles(negocio, ana, LUNES, HOY, [], 2).plan).toEqual({ puede: false, motivo: 'La membresía cubre un lugar por clase: los demás van aparte.' })
    const libre = conPlanes([membresia({ id: 's-libre', planId: 'p-libre', porSemana: 0 })])
    expect(pagosPosibles(negocio, libre, LUNES, HOY, Array.from({ length: 6 }, (_, k) => lugar({ id: `l${k}`, suscripcionId: 's-libre' }))).plan.puede).toBe(true)
  })

  it('con más de un plan se usa primero el que vence antes; si ese no alcanza, el que sigue', () => {
    const viejo = plan({ id: 's-viejo', hasta: '2026-12-05', restantes: 1 })
    const nuevo = plan({ id: 's-nuevo', hasta: '2027-02-20', restantes: 8 })
    const ana = conPlanes([nuevo, viejo])
    expect(pagosPosibles(negocio, ana, LUNES, HOY, []).plan.con?.id).toBe('s-viejo')
    // Dos lugares no entran en el viejo: van con el nuevo.
    expect(pagosPosibles(negocio, ana, LUNES, HOY, [], 2).plan.con?.id).toBe('s-nuevo')
    // Con el tope de la semana cumplido, el pack que también tiene sirve. Lo pagado con el pack no gasta el tope.
    const conLasDos = conPlanes([membresia(), plan({ hasta: '2027-01-30' })])
    const semanaLlena = [lugar({ id: 'a' }), lugar({ id: 'b', fecha: sumarDias(LUNES, 1) })]
    expect(pagosPosibles(negocio, conLasDos, LUNES, HOY, semanaLlena).plan.con?.id).toBe('s-pack')
    expect(pagosPosibles(negocio, conLasDos, LUNES, HOY, [lugar({ id: 'a' }), lugar({ id: 'b', suscripcionId: 's-pack' })]).plan.con?.id).toBe('s-2x')
  })

  it('la clase de prueba: si el negocio la tiene, es de un lugar y esa persona no la usó (ni la tiene reservada)', () => {
    const lu = conPlanes([], { id: 'ficha-lu', nombre: 'Lu Paz', probo: false })
    expect(pagosPosibles(negocio, lu, LUNES, HOY, []).prueba).toBe(true)
    expect(pagosPosibles(negocio, lu, LUNES, HOY, [], 2).prueba).toBe(false)
    expect(pagosPosibles(negocio, { ...lu, probo: true }, LUNES, HOY, []).prueba).toBe(false)
    const reservada = lugar({ socioId: 'ficha-lu', pago: 'prueba', planId: 'p-prueba', suscripcionId: undefined })
    expect(pagosPosibles(negocio, lu, LUNES, HOY, [reservada]).prueba).toBe(false)
    expect(pagosPosibles(negocio, lu, LUNES, HOY, [{ ...reservada, estado: 'cancelada' }]).prueba).toBe(true)
    // Alguien nuevo (todavía sin ficha): la tiene, y con plan no puede.
    expect(pagosPosibles(negocio, undefined, LUNES, HOY, [])).toMatchObject({ plan: { puede: false }, prueba: true })
    // Un negocio sin clase de prueba ni clase suelta no las ofrece: aparte se anota igual, sin precio.
    const sinEsas = { ...negocio, planes: PLANES.filter(p => p.tipo === 'pack' || p.tipo === 'membresia') }
    expect(pagosPosibles(sinEsas, lu, LUNES, HOY, [])).toMatchObject({ prueba: false, suelta: null })
  })

  it('el plan que usa hoy: el primero que todavía sirve; si hoy no vale ninguno, el que arranca después o el último que tuvo', () => {
    const agotado = plan({ id: 's-viejo', hasta: '2026-12-05', restantes: 0 })
    expect(planActualDe(negocio, conPlanes([agotado, membresia()]), HOY)?.id).toBe('s-2x')
    expect(planActualDe(negocio, conPlanes([agotado]), HOY)?.id).toBe('s-viejo')
    expect(planActualDe(negocio, conPlanes([membresia({ desde: '2026-12-02', hasta: '2027-01-01' })]), HOY)?.id).toBe('s-2x')
    expect(planActualDe(negocio, conPlanes([]), HOY)).toBeNull()
  })

  it('en la demo cada socio tiene un solo plan: sale de sus campos, y las cuentas son las mismas', () => {
    const n = negocioDe(rubroPorKey(RUBRO))
    const pack = n.planes.find(p => p.tipo === 'pack')!
    const conPack: Socio = { id: 's', nombre: 'Leo Test', telefono: '11 2222-3333', planId: pack.id, desde: '2026-11-01', vence: '2027-01-30', clasesRestantes: 1, probo: true }
    expect(planesDeSocio(n, conPack)).toEqual([{ id: 's:plan', planId: pack.id, tipo: 'pack', nombre: pack.nombre, precio: pack.precio, desde: '2026-11-01', hasta: '2027-01-30', clases: pack.clases, restantes: 1, porSemana: null }])
    expect(pagosPosibles(n, conPack, LUNES, HOY, []).plan.puede).toBe(true)
    expect(pagosPosibles(n, conPack, LUNES, HOY, [], 2).plan.puede).toBe(false)
    // Quien paga la clase suelta cuando viene no tiene un plan.
    expect(planesDeSocio(n, { ...conPack, planId: null, vence: null })).toEqual([])
    // Las inscripciones de ejemplo no dicen cómo se pagaron: lo dice el tipo de su plan.
    expect(pagoDe(n, { planId: pack.id })).toBe('plan')
    expect(pagoDe(n, { planId: n.planes.find(p => p.tipo === 'suelta')!.id })).toBe('aparte')
    expect(pagoDe(n, { planId: n.planes.find(p => p.tipo === 'prueba')!.id })).toBe('prueba')
    expect(pagoDe(n, { planId: null })).toBeNull()
    // Si lo trae, vale lo que dice (null es "sin definir").
    expect(pagoDe(n, { planId: pack.id, pago: null })).toBeNull()
    expect(planDelPago(n, conPack, 'plan')).toBe(pack.id)
    expect(planDelPago(n, conPack, 'aparte')).toBe(n.planes.find(p => p.tipo === 'suelta')!.id)
  })
})

describe('la demo: cómo se paga cada lugar', () => {
  beforeEach(() => accionesGym.reiniciar())
  const acciones = accionesDemo(RUBRO)
  const conPack = `${RUBRO}-s7` // los socios 7 a 9 de ejemplo tienen pack
  const socio = (id: string) => sociosDelDemo(leerDemo(), RUBRO).find(s => s.id === id)!
  const inscripcion = (id: string) => inscripcionesDelDemo(leerDemo(), RUBRO).find(i => i.id === id)!
  const n = () => negocioDelDemo(leerDemo(), RUBRO)
  const clase = () => clasesDelDia(n(), LUNES)[0]
  const anotar = (id: string, pago: Inscripcion['pago'], over: Partial<Inscripcion> = {}) =>
    acciones.inscribir({ id, claseId: clase().id, fecha: LUNES, socioId: conPack, estado: 'reservada', creada: HOY, planId: socio(conPack).planId, ...(pago ? { pago } : {}), ...over })

  it('anotar con su pack descuenta una clase; cobrándole aparte, el pack no se toca', async () => {
    const antes = socio(conPack).clasesRestantes!
    await anotar('n-plan', 'plan')
    expect(socio(conPack).clasesRestantes).toBe(antes - 1)
    expect(pagoDe(n(), inscripcion('n-plan'))).toBe('plan')
    await anotar('n-aparte', 'aparte', { fecha: sumarDias(LUNES, 1), claseId: clasesDelDia(n(), sumarDias(LUNES, 1))[0].id })
    expect(socio(conPack).clasesRestantes).toBe(antes - 1)
    expect(inscripcion('n-aparte')).toMatchObject({ pago: 'aparte', planId: n().planes.find(p => p.tipo === 'suelta')!.id })
  })

  it('pasar un lugar del pack a "aparte" le devuelve la clase; pasarlo de vuelta al pack la descuenta', async () => {
    const antes = socio(conPack).clasesRestantes!
    await anotar('n-1', 'plan')
    await acciones.definirPago('n-1', 'aparte')
    expect(socio(conPack).clasesRestantes).toBe(antes)
    expect(pagoDe(n(), inscripcion('n-1'))).toBe('aparte')
    await acciones.definirPago('n-1', 'plan')
    expect(socio(conPack).clasesRestantes).toBe(antes - 1)
    expect(inscripcion('n-1')).toMatchObject({ pago: 'plan', planId: socio(conPack).planId })
    // Decir dos veces lo mismo no descuenta dos veces.
    await acciones.definirPago('n-1', 'plan')
    expect(socio(conPack).clasesRestantes).toBe(antes - 1)
  })

  it('en la lista de espera no se toca el pack, se diga lo que se diga', async () => {
    const antes = socio(conPack).clasesRestantes!
    await anotar('n-esp', 'plan', { estado: 'espera' })
    await acciones.definirPago('n-esp', 'aparte')
    await acciones.definirPago('n-esp', 'plan')
    expect(socio(conPack).clasesRestantes).toBe(antes)
  })

  it('asignar un plan arranca hoy y dice hasta cuándo vale; quitarlo deja a la persona sin plan', async () => {
    const pack = n().planes.find(p => p.tipo === 'pack')!
    const sinPlan = `${RUBRO}-s15` // nunca vino
    expect(socio(sinPlan).planId).toBeNull()
    const r = await acciones.asignarPlan(sinPlan, pack.id)
    expect(socio(sinPlan)).toMatchObject({ planId: pack.id, desde: HOY, vence: sumarDias(HOY, pack.vigenciaDias), clasesRestantes: pack.clases })
    expect(r.detalle).toMatch(/^Hasta el .+\. El cobro se registra a mano\.$/)
    await acciones.quitarPlan(sinPlan)
    expect(socio(sinPlan)).toMatchObject({ planId: null, vence: null, clasesRestantes: null })
    await expect(acciones.asignarPlan(sinPlan, 'no-existe')).rejects.toThrow('Ese plan ya no existe.')
  })
})
