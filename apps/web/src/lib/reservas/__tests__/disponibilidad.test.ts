import { describe, expect, it } from 'vitest'
import { armarBloques, bloquesLibres, consecutivasDesde, franjasDelDia, huecosDelDia, inicioslibres, ocupacion } from '../disponibilidad'

const h = (n: number) => n * 60

describe('franjas por hora (canchas, turnos)', () => {
  const apertura: [number, number][] = [[h(16), h(23)]]

  it('ofrece un inicio cada paso dentro de la apertura y nunca pasa el cierre', () => {
    const f = franjasDelDia(apertura, [], { paso: 60, duracion: 60 })
    expect(f.map(x => x.inicio)).toEqual([h(16), h(17), h(18), h(19), h(20), h(21), h(22)])
    expect(f.every(x => x.libre)).toBe(true)
  })

  it('marca ocupadas las que pisan una reserva, con su margen', () => {
    const libres = inicioslibres(apertura, [[h(18), h(19)]], { paso: 60, duracion: 60 })
    expect(libres).not.toContain(h(18))
    expect(libres).toContain(h(17))
    expect(libres).toContain(h(19))
    const conMargen = inicioslibres(apertura, [[h(18), h(19)]], { paso: 60, duracion: 60, margen: 15 })
    expect(conMargen).not.toContain(h(17))
    expect(conMargen).not.toContain(h(19))
  })

  it('si el día es hoy, lo que ya pasó no se ofrece', () => {
    const libres = inicioslibres(apertura, [], { paso: 60, duracion: 60, desde: h(19) + 10 })
    expect(libres[0]).toBe(h(20))
  })

  it('cuenta cuántas franjas seguidas se pueden tomar (una cancha por dos horas)', () => {
    const f = franjasDelDia(apertura, [[h(19), h(20)]], { paso: 60, duracion: 60 })
    expect(consecutivasDesde(f, h(16), 4)).toBe(3) // 16, 17, 18; a las 19 está tomada
    expect(consecutivasDesde(f, h(20), 4)).toBe(3) // 20, 21, 22 y se acaba el día
    expect(consecutivasDesde(f, h(19), 4)).toBe(0)
  })

  it('con turnos de una hora cada media hora, la siguiente es la que arranca donde termina la anterior', () => {
    const f = franjasDelDia(apertura, [[h(20), h(21)]], { paso: 30, duracion: 60 })
    expect(consecutivasDesde(f, h(16), 4)).toBe(4) // 16, 17, 18 y 19
    expect(consecutivasDesde(f, h(17) + 30, 4)).toBe(2) // 17:30 y 18:30; la de 19:30 pisa la de las 20
    expect(consecutivasDesde(f, h(16), 2)).toBe(2)
  })

  it('los huecos y la ocupación salen de la apertura menos lo tomado', () => {
    expect(huecosDelDia(apertura, [[h(18), h(20)]])).toEqual([[h(16), h(18)], [h(20), h(23)]])
    expect(ocupacion(apertura, [[h(18), h(20)]])).toBeCloseTo(2 / 7)
    expect(ocupacion([], [])).toBe(0)
  })
})

describe('bloques fijos (salones)', () => {
  it('arma bloques con limpieza en el medio y les pone nombre por la hora', () => {
    const b = armarBloques([h(14), h(24)], 4 * 60, 90)
    expect(b.map(x => [x.inicio, x.fin])).toEqual([[h(14), h(18)], [h(19) + 30, h(23) + 30]])
    expect(b.map(x => x.nombre)).toEqual(['Tarde', 'Noche'])
  })

  it('deja libres solo los no tomados y respeta la limpieza entre bloques pegados', () => {
    const b = armarBloques([h(10), h(22)], 4 * 60, 0) // 10-14, 14-18, 18-22 pegados
    expect(bloquesLibres(b, ['b2']).map(x => x.id)).toEqual(['b1', 'b3'])
    expect(bloquesLibres(b, ['b2'], 30).map(x => x.id)).toEqual([])
  })
})
