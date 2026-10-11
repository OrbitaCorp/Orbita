import type { InstagramPublicacionComentada } from '@/lib/api'

// Filtros de Difusión → Comentarios. "Sin responder" es lo que todavía no tiene ninguna respuesta (de nadie) y
// no está oculto: es la lista de pendientes del día.

export type FiltroDeComentarios = 'todos' | 'sin-responder' | 'ocultos'

type Comentario = InstagramPublicacionComentada['comentarios'][number]

const cumple = (c: Comentario, f: FiltroDeComentarios): boolean =>
  f === 'todos' ? true : f === 'ocultos' ? c.oculto : !c.oculto && c.respuestas.length === 0

export function contarComentarios(publicaciones: InstagramPublicacionComentada[]): Record<FiltroDeComentarios, number> {
  const cuenta: Record<FiltroDeComentarios, number> = { todos: 0, 'sin-responder': 0, ocultos: 0 }
  for (const p of publicaciones) {
    for (const c of p.comentarios) {
      cuenta.todos++
      if (cumple(c, 'sin-responder')) cuenta['sin-responder']++
      if (c.oculto) cuenta.ocultos++
    }
  }
  return cuenta
}

/** Las publicaciones con solo los comentarios que cumplen el filtro; las que quedan sin ninguno se van. */
export function filtrarComentarios(publicaciones: InstagramPublicacionComentada[], f: FiltroDeComentarios): InstagramPublicacionComentada[] {
  if (f === 'todos') return publicaciones
  return publicaciones
    .map((p) => ({ ...p, comentarios: p.comentarios.filter((c) => cumple(c, f)) }))
    .filter((p) => p.comentarios.length > 0)
}
