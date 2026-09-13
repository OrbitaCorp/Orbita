// Qué puede editar el dueño de CADA plantilla, y en qué orden.
//
// Apariencia alcanza para lo que todas las portadas tienen en común (hero,
// categorías, barra de estadísticas, cartelera, pie). Pero cada plantilla
// trae además secciones que ninguna otra tiene —"El taller" de Premium, la
// carta de varietales de Bodega, el muro de Mosaico— y las trae en SU orden.
// Eso no entra en un formulario fijo: acá cada plantilla declara su propio
// juego de campos y el panel lo dibuja solo (ver Apariencia.tsx, pestaña
// "Secciones", y `seccionesEditables` en tipos.ts).
//
// Reglas para sumar una sección:
//
//  1. El `id` de la sección y de cada campo es la CLAVE DE GUARDADO
//     (`homeTemplateData.secciones[seccion][campo]`). Cambiarlo hace
//     desaparecer lo que el dueño ya escribió — si hay que renombrar algo,
//     se renombra el `label`, nunca el `id`.
//  2. Todo campo tiene que tener su texto de muestra como fallback en el
//     bloque de homes.tsx (helper `txt()`): una tienda que no editó nada
//     tiene que verse idéntica a la vitrina del panel.
//  3. El orden del array es el orden en que se ven en la portada, no el
//     alfabético: el dueño busca la sección por dónde cae, no por su nombre.
//  4. `max` es un tope de DISEÑO (el texto desborda la caja a ese tamaño),
//     no de seguridad.

import type { SeccionPlantilla } from './tipos'

// ─── Premium ─────────────────────────────────────────────────────────────────
// Joyería: cintillo de servicios, tres promesas en filete, el taller con sus
// números, y el grabado a pedido.
const PREMIUM: SeccionPlantilla[] = [
  {
    id: 'cintillo',
    nombre: 'Cintillo superior',
    nota: 'La línea fina de arriba de todo, antes del logo.',
    campos: [
      { id: 'texto', label: 'Texto', tipo: 'texto', max: 90, help: 'Se ve en versalitas y bien chico. Separá con · los ítems.' },
    ],
  },
  {
    id: 'promesas',
    nombre: 'Las tres promesas',
    nota: 'La franja de tres columnas que va debajo del hero.',
    campos: [
      { id: 't1', label: 'Primera — título', tipo: 'texto', max: 34 },
      { id: 'b1', label: 'Primera — bajada', tipo: 'texto', max: 60 },
      { id: 't2', label: 'Segunda — título', tipo: 'texto', max: 34 },
      { id: 'b2', label: 'Segunda — bajada', tipo: 'texto', max: 60 },
      { id: 't3', label: 'Tercera — título', tipo: 'texto', max: 34 },
      { id: 'b3', label: 'Tercera — bajada', tipo: 'texto', max: 60 },
    ],
  },
  {
    id: 'taller',
    nombre: 'El taller',
    nota: 'Foto grande a un lado y, al otro, tu historia con tres números.',
    campos: [
      { id: 'foto', label: 'Foto', tipo: 'imagen', help: 'Apaisada, se ve a media pantalla. 1200×900px o más.' },
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, help: 'El renglón chiquito en dorado, arriba del título.' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 48 },
      { id: 'texto', label: 'Texto', tipo: 'parrafo', max: 260 },
      { id: 'n1v', label: 'Número 1', tipo: 'texto', max: 8, help: 'Ej: 26' },
      { id: 'n1l', label: 'Número 1 — etiqueta', tipo: 'texto', max: 16, help: 'Ej: años' },
      { id: 'n2v', label: 'Número 2', tipo: 'texto', max: 8 },
      { id: 'n2l', label: 'Número 2 — etiqueta', tipo: 'texto', max: 16 },
      { id: 'n3v', label: 'Número 3', tipo: 'texto', max: 8 },
      { id: 'n3l', label: 'Número 3 — etiqueta', tipo: 'texto', max: 16 },
    ],
  },
  {
    id: 'grabado',
    nombre: 'A pedido',
    nota: 'El bloque del final, con el texto a la izquierda y la foto a la derecha.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24 },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 48 },
      { id: 'texto', label: 'Texto', tipo: 'parrafo', max: 260 },
      { id: 'cta', label: 'Texto del enlace', tipo: 'texto', max: 28 },
      { id: 'foto', label: 'Foto', tipo: 'imagen', help: 'Apaisada, se ve a media pantalla.' },
    ],
  },
]

// ─── El registro ─────────────────────────────────────────────────────────────
// Una plantilla que todavía no declaró sus secciones no aparece con la
// pestaña "Secciones" en el panel — se sigue viendo igual, solo que su
// contenido propio no es editable todavía.
export const SECCIONES_POR_PLANTILLA: Record<string, SeccionPlantilla[]> = {
  premium: PREMIUM,
}

export function seccionesDe(idPlantilla: string | null | undefined): SeccionPlantilla[] {
  if (!idPlantilla) return []
  return SECCIONES_POR_PLANTILLA[idPlantilla] ?? []
}
