import { describe, expect, it } from 'vitest'
import type { InstagramPublicacionComentada } from '@/lib/api'
import { contarComentarios, filtrarComentarios } from './filtroComentarios'

const com = (id: string, extra: Partial<InstagramPublicacionComentada['comentarios'][number]> = {}) => ({
  id, usuario: 'u', texto: 't', fecha: null, likes: 0, oculto: false, respuestas: [], ...extra,
})
const pub = (id: string, comentarios: ReturnType<typeof com>[]): InstagramPublicacionComentada => ({
  id, texto: '', imagen: null, enlace: null, fecha: null, totalComentarios: comentarios.length, comentarios,
})

const DATOS = [
  pub('p1', [com('a'), com('b', { respuestas: [{ id: 'r', usuario: 'yo', texto: 'hola', fecha: null }] })]),
  pub('p2', [com('c', { oculto: true }), com('d')]),
  pub('p3', [com('e', { respuestas: [{ id: 'r2', usuario: 'yo', texto: 'ok', fecha: null }] })]),
]

describe('contarComentarios', () => {
  it('cuenta todos, los que esperan respuesta y los ocultos', () => {
    expect(contarComentarios(DATOS)).toEqual({ todos: 5, 'sin-responder': 2, ocultos: 1 })
  })
  it('sin publicaciones, todo en cero', () => {
    expect(contarComentarios([])).toEqual({ todos: 0, 'sin-responder': 0, ocultos: 0 })
  })
})

describe('filtrarComentarios', () => {
  it('"todos" no toca nada', () => {
    expect(filtrarComentarios(DATOS, 'todos')).toBe(DATOS)
  })
  it('"sin responder" deja los pendientes (un oculto no cuenta) y saca las publicaciones que quedan vacías', () => {
    const r = filtrarComentarios(DATOS, 'sin-responder')
    expect(r.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(r.flatMap((p) => p.comentarios.map((c) => c.id))).toEqual(['a', 'd'])
  })
  it('"ocultos" deja solo los ocultos', () => {
    expect(filtrarComentarios(DATOS, 'ocultos').flatMap((p) => p.comentarios.map((c) => c.id))).toEqual(['c'])
  })
})
