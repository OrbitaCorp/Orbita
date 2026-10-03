import { describe, expect, it } from 'vitest'
import { TOPE_RESERVAS, agregarALista, depurarLista, leerLista, reservasGuardadas } from './misReservas'

// Un token como los de la API: randomBytes(32).toString('base64url') = 43 caracteres.
const tk = (n: number) => `tok${String(n).padStart(4, '0')}`.padEnd(43, 'x')

describe('mis reservas en el dispositivo', () => {
  it('lee solo listas de tokens válidos', () => {
    expect(leerLista(null)).toEqual([])
    expect(leerLista('no es json')).toEqual([])
    expect(leerLista('{"a":1}')).toEqual([])
    expect(leerLista(JSON.stringify([tk(1), 'corto', 42, tk(1), tk(2), 'con espacios y más de cuarenta y tres caracteres!!']))).toEqual([tk(1), tk(2)])
  })
  it('agrega adelante, sin repetir', () => {
    expect(agregarALista([tk(1), tk(2)], tk(3))).toEqual([tk(3), tk(1), tk(2)])
    expect(agregarALista([tk(1), tk(2)], tk(2))).toEqual([tk(2), tk(1)])
    expect(agregarALista([tk(1)], 'invalido')).toEqual([tk(1)])
  })
  it('respeta el tope de 20: se va el más viejo', () => {
    let lista: string[] = []
    for (let i = 1; i <= TOPE_RESERVAS + 3; i++) lista = agregarALista(lista, tk(i))
    expect(lista).toHaveLength(TOPE_RESERVAS)
    expect(lista[0]).toBe(tk(TOPE_RESERVAS + 3))
    expect(lista).not.toContain(tk(3))
    expect(lista).toContain(tk(4))
    expect(leerLista(JSON.stringify(Array.from({ length: 30 }, (_, i) => tk(i))))).toHaveLength(TOPE_RESERVAS)
  })
  it('depura lo que la API ya no reconoce, sin cambiar el orden', () => {
    expect(depurarLista([tk(3), tk(2), tk(1)], [tk(3), tk(2), tk(1)], [tk(1), tk(3)])).toEqual([tk(3), tk(1)])
    expect(depurarLista([tk(1)], [tk(1)], [])).toEqual([])
  })
  it('no borra una reserva guardada mientras el pedido viajaba', () => {
    expect(depurarLista([tk(9), tk(2), tk(1)], [tk(2), tk(1)], [tk(1)])).toEqual([tk(9), tk(1)])
  })
  it('fuera del navegador no hay nada guardado', () => {
    expect(reservasGuardadas('barberia-lucas')).toEqual([])
  })
})
