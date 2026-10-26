// Las reglas de Gimnasio que el sitio y el panel comparten: la demo es
// determinista, la prueba gratis vale una vez por persona, la membresía
// respeta su tope semanal, el pack se descuenta al reservar y la lista de
// espera avanza sola. Corre en node: el almacén usa localStorage dentro de un
// try, así que acá vive en memoria.
import { beforeEach, describe, expect, it } from 'vitest'
import { HOY, RUBROS_GYM, clasesDelDia, cupoDe, idSocioDemo, inscripcionesDe, negocioDe, rubroPorKey, sociosDe, topeSemanal, yaUsoLaPrueba, type Inscripcion } from '../index'
import { accionesGym, inscripcionesDelDemo, leerDemo, negocioDelDemo, sociosDelDemo } from '../negocio'
import { sumarDias } from '@/lib/reservas/fechas'

const RUBRO = 'crossfit'
const LUNES = sumarDias(HOY, 2) // HOY es sábado
const socio = (id: string) => sociosDelDemo(leerDemo(), RUBRO).find(s => s.id === id)!

beforeEach(() => accionesGym.reiniciar())

describe('datos de ejemplo', () => {
  it('son los mismos cada vez (servidor y navegador dibujan igual)', () => {
    const n = negocioDe(rubroPorKey(RUBRO))
    expect(sociosDe(n)).toEqual(sociosDe(negocioDe(rubroPorKey(RUBRO))))
    expect(inscripcionesDe(n, sociosDe(n))).toEqual(inscripcionesDe(n, sociosDe(n)))
  })

  it('los ids llevan el rubro: un cambio en un negocio no se cuela en otro', () => {
    const ids = RUBROS_GYM.flatMap(r => { const n = negocioDe(r); return [...sociosDe(n), ...inscripcionesDe(n, sociosDe(n))].map(x => x.id) })
    expect(new Set(ids).size).toBe(ids.length)
    accionesGym.cambiarSocio(idSocioDemo(RUBRO), { nota: 'solo en el box' })
    expect(sociosDelDemo(leerDemo(), RUBRO)[0].nota).toBe('solo en el box')
    expect(sociosDelDemo(leerDemo(), 'yoga')[0].nota).not.toBe('solo en el box')
  })
})

describe('clase de prueba: una vez por persona', () => {
  const n = negocioDe(rubroPorKey(RUBRO))
  const socios = sociosDe(n)
  const ins = inscripcionesDe(n, socios)

  it('se reconoce a la persona por el celular, escrito como sea', () => {
    const juan = socios[1] // tiene membresía: ya pasó por la prueba
    expect(juan.probo).toBe(true)
    expect(yaUsoLaPrueba(n, socios, ins, { telefono: juan.telefono })).toBe(true)
    expect(yaUsoLaPrueba(n, socios, ins, { telefono: `+54 9 ${juan.telefono}` })).toBe(true)
  })

  it('o por el email, sin importar mayúsculas', () => {
    const conMail = socios.find(s => s.email)!
    expect(yaUsoLaPrueba(n, socios, ins, { telefono: '11 1111-1111', email: conMail.email!.toUpperCase() })).toBe(true)
  })

  it('alguien nuevo, o un socio que nunca la usó, todavía la tiene', () => {
    expect(yaUsoLaPrueba(n, socios, ins, { telefono: '11 4444-5555' })).toBe(false)
    const nuevo = socios.find(s => !s.probo)!
    expect(yaUsoLaPrueba(n, socios, ins, { telefono: nuevo.telefono })).toBe(false)
  })

  it('reservarla la consume (aunque se reserve como socio nuevo); cancelarla la devuelve', () => {
    const prueba = n.planes.find(p => p.tipo === 'prueba')!
    const clase = clasesDelDia(n, LUNES)[0]
    const nuevo = { id: 'sn-ana', nombre: 'Ana Test', telefono: '11 4444-5555', planId: null, desde: null, vence: null, clasesRestantes: null, probo: false }
    accionesGym.inscribir(RUBRO, { id: 'n-ana', claseId: clase.id, fecha: LUNES, socioId: nuevo.id, estado: 'reservada', creada: HOY, planId: prueba.id }, nuevo)
    const d = leerDemo()
    expect(yaUsoLaPrueba(n, sociosDelDemo(d, RUBRO), inscripcionesDelDemo(d, RUBRO), { telefono: '3757-4444-5555' })).toBe(true)
    accionesGym.cancelar(RUBRO, 'n-ana')
    const d2 = leerDemo()
    expect(yaUsoLaPrueba(n, sociosDelDemo(d2, RUBRO), inscripcionesDelDemo(d2, RUBRO), { telefono: '11 4444-5555' })).toBe(false)
  })
})

describe('membresía de X por semana', () => {
  it('cuenta las clases de la semana de la fecha y avisa cuando se llenó', () => {
    const d = leerDemo()
    const n = negocioDelDemo(d, RUBRO)
    const sofia = socio(idSocioDemo(RUBRO))
    const tope = topeSemanal(n, sofia, LUNES, inscripcionesDelDemo(d, RUBRO))!
    expect(tope).not.toBeNull()
    const libres = tope.porSemana - tope.usadas
    const clases = Array.from({ length: 6 }, (_, k) => sumarDias(LUNES, k)).flatMap(f => clasesDelDia(n, f).map(c => ({ c, f })))
      .filter(({ c, f }) => !inscripcionesDelDemo(leerDemo(), RUBRO).some(i => i.socioId === sofia.id && i.claseId === c.id && i.fecha === f))
    clases.slice(0, Math.max(0, libres)).forEach(({ c, f }, k) => accionesGym.inscribir(RUBRO, { id: `n-s${k}`, claseId: c.id, fecha: f, socioId: sofia.id, estado: 'reservada', creada: HOY, planId: sofia.planId }))
    const despues = topeSemanal(n, sofia, LUNES, inscripcionesDelDemo(leerDemo(), RUBRO))!
    expect(despues.usadas).toBeGreaterThanOrEqual(despues.porSemana)
    expect(despues.lleno).toBe(true)
    // La semana siguiente arranca de cero.
    expect(topeSemanal(n, sofia, sumarDias(LUNES, 7), inscripcionesDelDemo(leerDemo(), RUBRO))!.lleno).toBe(false)
  })
})

describe('pack: se descuenta al reservar', () => {
  const conPack = `${RUBRO}-s7` // los socios 7 a 9 de ejemplo tienen pack
  const clase = () => clasesDelDia(negocioDelDemo(leerDemo(), RUBRO), LUNES)[0]
  const reservar = (id: string, estado: Inscripcion['estado'] = 'reservada') =>
    accionesGym.inscribir(RUBRO, { id, claseId: clase().id, fecha: LUNES, socioId: conPack, estado, creada: HOY, planId: socio(conPack).planId })

  it('reservar resta una; cancelar a tiempo la devuelve', () => {
    const antes = socio(conPack).clasesRestantes!
    reservar('n-p1')
    expect(socio(conPack).clasesRestantes).toBe(antes - 1)
    accionesGym.cancelar(RUBRO, 'n-p1')
    expect(socio(conPack).clasesRestantes).toBe(antes)
  })

  it('cancelar fuera de plazo no la devuelve', () => {
    const n = negocioDelDemo(leerDemo(), RUBRO)
    const empezada = clasesDelDia(n, HOY).find(c => c.inicio <= 10 * 60 + 40)! // ya arrancó: pasó el plazo
    const antes = socio(conPack).clasesRestantes!
    accionesGym.inscribir(RUBRO, { id: 'n-tarde', claseId: empezada.id, fecha: HOY, socioId: conPack, estado: 'reservada', creada: HOY, planId: socio(conPack).planId })
    accionesGym.cancelar(RUBRO, 'n-tarde')
    expect(socio(conPack).clasesRestantes).toBe(antes - 1)
  })

  it('en lista de espera no se descuenta; al darle el lugar, sí', () => {
    const antes = socio(conPack).clasesRestantes!
    reservar('n-esp', 'espera')
    expect(socio(conPack).clasesRestantes).toBe(antes)
    accionesGym.cambiarInscripcionEn(RUBRO, 'n-esp', { estado: 'reservada' })
    expect(socio(conPack).clasesRestantes).toBe(antes - 1)
  })

  it('un socio nuevo que compra el pack arranca con el pack entero menos la clase que reservó', () => {
    const pack = negocioDelDemo(leerDemo(), RUBRO).planes.find(p => p.tipo === 'pack')!
    const nuevo = { id: 'sn-leo', nombre: 'Leo Test', telefono: '11 2222-3333', planId: pack.id, desde: HOY, vence: sumarDias(HOY, pack.vigenciaDias), clasesRestantes: pack.clases!, probo: false }
    accionesGym.inscribir(RUBRO, { id: 'n-leo', claseId: clase().id, fecha: LUNES, socioId: nuevo.id, estado: 'reservada', creada: HOY, planId: pack.id }, nuevo)
    expect(socio('sn-leo').clasesRestantes).toBe(pack.clases! - 1)
  })
})

describe('lista de espera', () => {
  it('cuando se libera un lugar de una clase llena, pasa sola la primera que esperaba', () => {
    const d = leerDemo()
    const n = negocioDelDemo(d, RUBRO)
    const todas = inscripcionesDelDemo(d, RUBRO)
    // Una clase que viene, llena y con gente esperando.
    const llena = Array.from({ length: 14 }, (_, k) => sumarDias(HOY, k + 1)).flatMap(f => clasesDelDia(n, f).map(c => ({ c, f })))
      .find(({ c, f }) => cupoDe(c, f, todas).espera > 0)!
    expect(llena).toBeDefined()
    const suyas = todas.filter(i => i.claseId === llena.c.id && i.fecha === llena.f)
    const primera = suyas.filter(i => i.estado === 'espera').sort((a, b) => a.creada.localeCompare(b.creada) || a.id.localeCompare(b.id))[0]
    const sale = suyas.find(i => i.estado === 'reservada')!
    accionesGym.cancelar(RUBRO, sale.id)
    const despues = inscripcionesDelDemo(leerDemo(), RUBRO)
    expect(despues.find(i => i.id === sale.id)!.estado).toBe('cancelada')
    expect(despues.find(i => i.id === primera.id)!.estado).toBe('reservada')
    expect(cupoDe(llena.c, llena.f, despues).anotados).toBe(cupoDe(llena.c, llena.f, todas).anotados)
  })

  it('si el dueño le sube el cupo a la clase, los que esperaban pasan solos', () => {
    const d = leerDemo()
    const n = negocioDelDemo(d, RUBRO)
    const todas = inscripcionesDelDemo(d, RUBRO)
    const llena = Array.from({ length: 10 }, (_, k) => sumarDias(HOY, k + 1)).flatMap(f => clasesDelDia(n, f).map(c => ({ c, f })))
      .find(({ c, f }) => cupoDe(c, f, todas).espera > 0)!
    const antes = cupoDe(llena.c, llena.f, todas)
    accionesGym.configurar(RUBRO, { clases: n.clases.map(c => (c.id === llena.c.id ? { ...c, cupo: c.cupo + antes.espera } : c)) })
    const clase = negocioDelDemo(leerDemo(), RUBRO).clases.find(c => c.id === llena.c.id)!
    const despues = cupoDe(clase, llena.f, inscripcionesDelDemo(leerDemo(), RUBRO))
    expect(despues.espera).toBe(0)
    expect(despues.anotados).toBe(antes.anotados + antes.espera)
  })

  it('salir de la lista de espera no le da el lugar a nadie', () => {
    const d = leerDemo()
    const n = negocioDelDemo(d, RUBRO)
    const todas = inscripcionesDelDemo(d, RUBRO)
    const espera = todas.find(i => i.estado === 'espera' && i.fecha > HOY)!
    const clase = n.clases.find(c => c.id === espera.claseId)!
    const antes = cupoDe(clase, espera.fecha, todas)
    accionesGym.cancelar(RUBRO, espera.id)
    const despues = cupoDe(clase, espera.fecha, inscripcionesDelDemo(leerDemo(), RUBRO))
    expect(despues.anotados).toBe(antes.anotados)
    expect(despues.espera).toBe(antes.espera - 1)
  })
})
