import type { OpcionDeMenu } from '@/lib/api'

// Lógica chica del editor del menú de Orbi en WhatsApp. Los límites son los de WhatsApp para los mensajes interactivos
// (la API los vuelve a validar: acá solo se avisa antes, mientras el dueño escribe).

export const LIMITES = { tituloLista: 24, tituloBoton: 20, descripcion: 72, bienvenida: 600, respuesta: 1000, opcionesLista: 10, opcionesBotones: 3 } as const

/** El motivo por el que el menú no se puede guardar, o null si está bien. Mismas reglas que la API. */
export function errorDelMenu(opciones: OpcionDeMenu[], estilo: 'LISTA' | 'BOTONES'): string | null {
  if (opciones.length > LIMITES.opcionesLista) return `El menú puede tener hasta ${LIMITES.opcionesLista} opciones.`
  const tope = estilo === 'BOTONES' ? LIMITES.tituloBoton : LIMITES.tituloLista
  for (const o of opciones) {
    const titulo = o.titulo.trim()
    if (!titulo) return 'Todas las opciones necesitan un título.'
    if (titulo.length > tope) return `"${titulo}" es muy largo: ${estilo === 'BOTONES' ? 'en botones' : 'en lista'} el título puede tener hasta ${tope} caracteres.`
    if ((o.descripcion ?? '').trim().length > LIMITES.descripcion) return `La descripción de "${titulo}" puede tener hasta ${LIMITES.descripcion} caracteres.`
    if (o.id.startsWith('custom-') && !(o.respuesta ?? '').trim()) return `La opción "${titulo}" necesita el texto con el que Orbi contesta.`
  }
  const activas = opciones.filter((o) => o.activa).length
  if (activas === 0) return 'Dejá al menos una opción activa.'
  if (estilo === 'BOTONES' && activas > LIMITES.opcionesBotones) return `Con botones el menú puede tener hasta ${LIMITES.opcionesBotones} opciones activas: apagá alguna o elegí la lista.`
  return null
}

/** Sube (-1) o baja (+1) una opción en el orden del menú. */
export function moverOpcion(opciones: OpcionDeMenu[], indice: number, sentido: -1 | 1): OpcionDeMenu[] {
  const destino = indice + sentido
  if (destino < 0 || destino >= opciones.length) return opciones
  const copia = [...opciones]
  ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
  return copia
}

/** Una opción propia nueva, con un id que no se repite. */
export function nuevaOpcionPropia(opciones: OpcionDeMenu[]): OpcionDeMenu {
  let n = 1
  while (opciones.some((o) => o.id === `custom-${n}`)) n++
  return { id: `custom-${n}`, titulo: '', descripcion: '', activa: true, respuesta: '' }
}

/** Las opciones tal como van a la API: sin espacios de más y sin campos vacíos. */
export function opcionesParaGuardar(opciones: OpcionDeMenu[]): OpcionDeMenu[] {
  return opciones.map((o) => ({
    id: o.id,
    titulo: o.titulo.trim(),
    activa: o.activa,
    ...((o.descripcion ?? '').trim() ? { descripcion: o.descripcion!.trim() } : {}),
    ...(o.id.startsWith('custom-') ? { respuesta: (o.respuesta ?? '').trim() } : {}),
  }))
}

/** ¿Cambió algo del menú respecto de lo guardado? (ignora espacios y campos vacíos) */
export function menuCambio(a: OpcionDeMenu[], b: OpcionDeMenu[]): boolean {
  return JSON.stringify(opcionesParaGuardar(a)) !== JSON.stringify(opcionesParaGuardar(b))
}
