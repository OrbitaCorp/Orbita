// Qué puede editar el dueño de CADA plantilla, y en qué orden.
//
// Apariencia alcanza para lo que todas las portadas tienen en común (hero,
// categorías, barra de estadísticas, cartelera, pie). Pero cada plantilla
// trae además secciones que ninguna otra tiene —"El taller" de Premium, la
// carta de varietales de Bodega, el muro de Mosaico— y las trae en SU orden.
// Eso no entra en un formulario fijo: acá cada plantilla declara su propio
// juego de campos y el panel lo dibuja solo (ver Apariencia.tsx, pestaña
// "Secciones", y `sec` en tipos.ts).
//
// Reglas para sumar una sección:
//
//  1. El `id` de la sección y de cada campo es la CLAVE DE GUARDADO
//     (`homeTemplateData.secciones[seccion][campo]`). Cambiarlo hace
//     desaparecer lo que el dueño ya escribió — si hay que renombrar algo,
//     se renombra el `label`, nunca el `id`.
//  2. `porDefecto` es el contenido con el que se diseñó la sección y vive
//     SOLO acá: lo dibuja la portada cuando el campo está vacío (helper
//     `txt()` en homes.tsx) y el editor lo muestra precargado. Repetirlo
//     adentro del bloque de homes.tsx es justo lo que hay que evitar: con el
//     texto en dos lados, el día que se retoca una copia el panel muestra una
//     cosa y la tienda otra.
//  3. El orden del array es el orden en que se ven en la portada, no el
//     alfabético: el dueño busca la sección por dónde cae, no por su nombre.
//  4. `max` es un tope de DISEÑO (el texto desborda la caja a ese tamaño),
//     no de seguridad.

import type { SeccionPlantilla } from './tipos'
import { IMG } from './tipos'

// ─── Premium ─────────────────────────────────────────────────────────────────
// Joyería: cintillo de servicios, tres promesas en filete, el taller con sus
// números, y el grabado a pedido.
const PREMIUM: SeccionPlantilla[] = [
  {
    id: 'cintillo',
    nombre: 'Cintillo superior',
    nota: 'La línea fina de arriba de todo, antes del logo.',
    campos: [
      {
        id: 'texto', label: 'Texto', tipo: 'texto', max: 90,
        help: 'Se ve en versalitas y bien chico. Separá con · los ítems.',
        porDefecto: 'Envío asegurado · Certificado de autenticidad · Grabado sin cargo',
      },
      {
        id: 'cartelera', label: 'Mostrar como cartelera (se desliza)', tipo: 'switch',
        help: 'En vez de quedarse fijo y centrado, el texto corre en loop de derecha a izquierda.',
      },
    ],
  },
  {
    id: 'hero',
    nombre: 'Hero',
    nota: 'Las fotos y los textos salen de "Hero". Acá va el segundo botón, el de al lado del principal.',
    campos: [
      { id: 'cta2', label: 'Segundo botón', tipo: 'texto', max: 24, porDefecto: 'Pedir a medida', help: 'Abre el WhatsApp de la tienda.' },
    ],
  },
  {
    id: 'promesas',
    nombre: 'Las tres promesas',
    nota: 'La franja de tres columnas que va debajo del hero.',
    campos: [
      { id: 't1', label: 'Primera — título', tipo: 'texto', max: 34, porDefecto: 'Oro 18k con sello' },
      { id: 'b1', label: 'Primera — bajada', tipo: 'texto', max: 60, porDefecto: 'Cada pieza sale con su certificado' },
      { id: 't2', label: 'Segunda — título', tipo: 'texto', max: 34, porDefecto: 'Garantía de por vida' },
      { id: 'b2', label: 'Segunda — bajada', tipo: 'texto', max: 60, porDefecto: 'Ajustes y pulido sin cargo' },
      { id: 't3', label: 'Tercera — título', tipo: 'texto', max: 34, porDefecto: 'Envío asegurado' },
      { id: 'b3', label: 'Tercera — bajada', tipo: 'texto', max: 60, porDefecto: 'Con seguimiento a todo el país' },
    ],
  },
  {
    id: 'taller',
    nombre: 'El taller',
    nota: 'Foto grande a un lado y, al otro, tu historia con tres números.',
    campos: [
      { id: 'foto', label: 'Foto', tipo: 'imagen', help: 'Apaisada, se ve a media pantalla. 1200×900px o más.', porDefecto: `${IMG}/joya-pulsera-rosa.jpg` },
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, help: 'El renglón chiquito en dorado, arriba del título.', porDefecto: 'El taller' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 48, porDefecto: 'Cuatro manos, una pieza por vez' },
      {
        id: 'texto', label: 'Texto', tipo: 'parrafo', max: 260,
        porDefecto: 'Fundimos, engarzamos y pulimos en el mismo lugar desde 1998. Nada sale del taller sin pasar por lupa dos veces.',
      },
      { id: 'n1v', label: 'Número 1', tipo: 'texto', max: 8, help: 'Ej: 26', porDefecto: '26' },
      { id: 'n1l', label: 'Número 1 — etiqueta', tipo: 'texto', max: 16, help: 'Ej: años', porDefecto: 'años' },
      { id: 'n2v', label: 'Número 2', tipo: 'texto', max: 8, porDefecto: '4.100' },
      { id: 'n2l', label: 'Número 2 — etiqueta', tipo: 'texto', max: 16, porDefecto: 'piezas' },
      { id: 'n3v', label: 'Número 3', tipo: 'texto', max: 8, porDefecto: '100%' },
      { id: 'n3l', label: 'Número 3 — etiqueta', tipo: 'texto', max: 16, porDefecto: 'a mano' },
    ],
  },
  {
    id: 'grabado',
    nombre: 'A pedido',
    nota: 'El bloque del final, con el texto a la izquierda y la foto a la derecha.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'A pedido' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 48, porDefecto: 'Grabá la pieza por dentro' },
      {
        id: 'texto', label: 'Texto', tipo: 'parrafo', max: 260,
        porDefecto: 'Una fecha, un nombre o las coordenadas de un lugar. El grabado se hace a mano y suma cinco días hábiles a la entrega, sin costo adicional.',
      },
      { id: 'cta', label: 'Texto del enlace', tipo: 'texto', max: 28, porDefecto: 'Pedir una pieza', help: 'Abre el WhatsApp de la tienda.' },
      { id: 'foto', label: 'Foto', tipo: 'imagen', help: 'Apaisada, se ve a media pantalla.', porDefecto: `${IMG}/joya-anillos-caja.jpg` },
    ],
  },
]

// ─── El registro ─────────────────────────────────────────────────────────────
// Una plantilla que todavía no declaró sus secciones no muestra la pestaña
// "Secciones" en el panel — se sigue viendo igual, solo que su contenido
// propio no es editable todavía.
export const SECCIONES_POR_PLANTILLA: Record<string, SeccionPlantilla[]> = {
  premium: PREMIUM,
}

export function seccionesDe(idPlantilla: string | null | undefined): SeccionPlantilla[] {
  if (!idPlantilla) return []
  return SECCIONES_POR_PLANTILLA[idPlantilla] ?? []
}

/**
 * El contenido con el que se diseñó un campo. Lo usan la portada (cuando el
 * dueño no editó nada) y el editor (que lo muestra precargado) — así los dos
 * leen exactamente el mismo texto.
 */
export function porDefectoDe(idPlantilla: string | null | undefined, seccion: string, campo: string): string {
  const sec = seccionesDe(idPlantilla).find(s => s.id === seccion)
  return sec?.campos.find(c => c.id === campo)?.porDefecto ?? ''
}
