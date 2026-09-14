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

// ─── Mosaico ─────────────────────────────────────────────────────────────────
// La única sin hero: arranca con un muro de bloques. Los cuatro chicos son
// categorías reales del negocio; lo único que se escribe a mano es el
// descuento de cada uno.
const MOSAICO: SeccionPlantilla[] = [
  {
    id: 'muro',
    nombre: 'Muro de bloques',
    nota: 'Los cuatro bloques chicos son tus primeras cuatro categorías. Acá va el cartelito de oferta de cada uno; si lo dejás vacío, no se dibuja.',
    campos: [
      { id: 'of1', label: 'Bloque 1 — oferta', tipo: 'texto', max: 12, help: 'Ej: −40%', porDefecto: '−40%' },
      { id: 'of2', label: 'Bloque 2 — oferta', tipo: 'texto', max: 12, porDefecto: '−25%' },
      { id: 'of3', label: 'Bloque 3 — oferta', tipo: 'texto', max: 12, porDefecto: '−30%' },
      { id: 'of4', label: 'Bloque 4 — oferta', tipo: 'texto', max: 12, porDefecto: 'Nuevo' },
    ],
  },
  {
    id: 'franja',
    nombre: 'Franja de envío',
    nota: 'La banda de color entre los productos y las marcas.',
    campos: [
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 48, porDefecto: 'Envío gratis desde $70.000' },
      { id: 'bajada', label: 'Bajada', tipo: 'texto', max: 90, porDefecto: 'A todo el país. Llega en 48 a 72 horas.' },
      { id: 'cta', label: 'Texto del botón', tipo: 'texto', max: 24, porDefecto: 'Aprovechar' },
    ],
  },
  {
    id: 'marcas',
    nombre: 'Marcas que trabajás',
    nota: 'Si lo dejás vacío, la sección no aparece.',
    campos: [
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 40, porDefecto: 'Marcas que trabajamos' },
      {
        id: 'lista', label: 'Marcas', tipo: 'texto', max: 160,
        help: 'Separadas por coma. Entran seis cómodas.',
        porDefecto: 'Lume, Ronda, Casa Nova, Verde, Tramo, Norte',
      },
    ],
  },
]

// ─── Atleta ──────────────────────────────────────────────────────────────────
// Deportes: cartel corriendo, hero a sangre y las tiras por categoría. Los
// números de abajo son de la comunidad y los escribe el dueño.
const ATLETA: SeccionPlantilla[] = [
  {
    id: 'cintillo',
    nombre: 'Cartel corriendo',
    nota: 'La franja de arriba de todo, antes del logo.',
    campos: [
      { id: 'texto', label: 'Texto', tipo: 'texto', max: 120, porDefecto: 'ENVÍO GRATIS +$120.000 ✦ 3 CUOTAS SIN INTERÉS ✦ CAMBIO DE TALLE SIN CARGO' },
    ],
  },
  {
    id: 'hero',
    nombre: 'Hero',
    nota: 'Las fotos y los textos salen de "Hero". Acá va el segundo botón.',
    campos: [
      { id: 'cta2', label: 'Segundo botón', tipo: 'texto', max: 24, porDefecto: 'Guía de talles', help: 'Abre el WhatsApp de la tienda.' },
    ],
  },
  {
    id: 'numeros',
    nombre: 'Números de la comunidad',
    nota: 'La franja de color del final. Un número vacío no se dibuja.',
    campos: [
      { id: 'n1v', label: 'Número 1', tipo: 'texto', max: 10, porDefecto: '+2.400' },
      { id: 'n1l', label: 'Número 1 — etiqueta', tipo: 'texto', max: 24, porDefecto: 'km este mes' },
      { id: 'n2v', label: 'Número 2', tipo: 'texto', max: 10, porDefecto: '1.180' },
      { id: 'n2l', label: 'Número 2 — etiqueta', tipo: 'texto', max: 24, porDefecto: 'corredores' },
      { id: 'n3v', label: 'Número 3', tipo: 'texto', max: 10, porDefecto: '48 hs' },
      { id: 'n3l', label: 'Número 3 — etiqueta', tipo: 'texto', max: 24, porDefecto: 'de entrega' },
      { id: 'n4v', label: 'Número 4', tipo: 'texto', max: 10, porDefecto: '4,9' },
      { id: 'n4l', label: 'Número 4 — etiqueta', tipo: 'texto', max: 24, porDefecto: 'de puntaje' },
    ],
  },
]

// ─── Patitas ─────────────────────────────────────────────────────────────────
// Petshop: la compra arranca por la mascota. Los tres círculos son categorías
// reales del negocio.
const PATITAS: SeccionPlantilla[] = [
  {
    id: 'cintillo',
    nombre: 'Cintillo superior',
    nota: 'La franja de arriba de todo.',
    campos: [
      { id: 'texto', label: 'Texto', tipo: 'texto', max: 90, porDefecto: '✦ Envío en el día en CABA comprando antes de las 14 ✦' },
      { id: 'cartelera', label: 'Mostrar como cartelera (se desliza)', tipo: 'switch' },
    ],
  },
  {
    id: 'hero',
    nombre: 'Hero',
    nota: 'Las fotos y los textos salen de "Hero". Acá va el segundo botón.',
    campos: [
      { id: 'cta2', label: 'Segundo botón', tipo: 'texto', max: 26, porDefecto: 'Ver el plan mensual', help: 'Abre el WhatsApp de la tienda.' },
    ],
  },
  {
    id: 'selector',
    nombre: '¿Para quién comprás?',
    nota: 'Los tres círculos grandes. Salen de tus primeras tres categorías.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 30, porDefecto: 'Empecemos por acá' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 40, porDefecto: '¿Para quién comprás?' },
    ],
  },
]

// ─── Bodega ──────────────────────────────────────────────────────────────────
// Vinoteca: el corazón es la carta de varietales, una lista sin fotos. Son
// las categorías del negocio, con su bajada y su "desde".
const BODEGA: SeccionPlantilla[] = [
  {
    id: 'cintillo',
    nombre: 'Cintillo superior',
    nota: 'La línea fina de arriba de todo.',
    campos: [
      { id: 'texto', label: 'Texto', tipo: 'texto', max: 90, porDefecto: 'Envío refrigerado · Retiro en la vinoteca · Venta a mayores de 18' },
    ],
  },
  {
    id: 'carta',
    nombre: 'La carta',
    nota: 'La lista de varietales: son tus categorías. Acá van el título y la bajada de la sección.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'La carta' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 40, porDefecto: 'Elegí por varietal' },
      { id: 'accion', label: 'Enlace de la derecha', tipo: 'texto', max: 30, porDefecto: 'Ver todo →' },
    ],
  },
  {
    id: 'maridajes',
    nombre: 'Maridajes',
    nota: 'Los tres bloques de texto del final. Uno sin título no se dibuja.',
    campos: [
      { id: 't1', label: 'Primero — título', tipo: 'texto', max: 40, porDefecto: 'Asado y achuras' },
      { id: 'b1', label: 'Primero — texto', tipo: 'parrafo', max: 160, porDefecto: 'Malbec joven o Bonarda. Fruta y poca madera para no tapar la carne.' },
      { id: 't2', label: 'Segundo — título', tipo: 'texto', max: 40, porDefecto: 'Pastas con salsa roja' },
      { id: 'b2', label: 'Segundo — texto', tipo: 'parrafo', max: 160, porDefecto: 'Sangiovese o un blend liviano. Acidez que corte el tomate.' },
      { id: 't3', label: 'Tercero — título', tipo: 'texto', max: 40, porDefecto: 'Quesos duros' },
      { id: 'b3', label: 'Tercero — texto', tipo: 'parrafo', max: 160, porDefecto: 'Cabernet Franc con guarda, o un espumante nature bien frío.' },
    ],
  },
]

// ─── Crecer ──────────────────────────────────────────────────────────────────
// Bebés: se navega por edad. La línea de tiempo son categorías reales.
const CRECER: SeccionPlantilla[] = [
  {
    id: 'cintillo',
    nombre: 'Cintillo superior',
    nota: 'La franja de arriba de todo.',
    campos: [
      { id: 'texto', label: 'Texto', tipo: 'texto', max: 90, porDefecto: 'Algodón orgánico certificado · Cambios sin cargo dentro de los 30 días' },
    ],
  },
  {
    id: 'edades',
    nombre: 'Comprá por edad',
    nota: 'La línea de tiempo: son tus primeras cuatro categorías. Acá van el título y la bajada.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 30, porDefecto: 'Comprá por edad' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 40, porDefecto: '¿Cuántos meses tiene?' },
    ],
  },
  {
    id: 'certificaciones',
    nombre: 'Certificaciones',
    nota: 'La franja del final, antes del pie. Una sin título no se dibuja.',
    campos: [
      { id: 't1', label: 'Primera — título', tipo: 'texto', max: 30, porDefecto: 'Algodón orgánico' },
      { id: 'b1', label: 'Primera — bajada', tipo: 'texto', max: 40, porDefecto: 'certificado GOTS' },
      { id: 't2', label: 'Segunda — título', tipo: 'texto', max: 30, porDefecto: 'Sin tóxicos' },
      { id: 'b2', label: 'Segunda — bajada', tipo: 'texto', max: 40, porDefecto: 'pinturas al agua' },
      { id: 't3', label: 'Tercera — título', tipo: 'texto', max: 30, porDefecto: 'Costuras planas' },
      { id: 'b3', label: 'Tercera — bajada', tipo: 'texto', max: 40, porDefecto: 'no marcan la piel' },
      { id: 't4', label: 'Cuarta — título', tipo: 'texto', max: 30, porDefecto: 'Cambios' },
      { id: 'b4', label: 'Cuarta — bajada', tipo: 'texto', max: 40, porDefecto: 'sin cargo 30 días' },
    ],
  },
]

// ─── Vera ────────────────────────────────────────────────────────────────────
// Joyería como portada de catálogo impreso: cintillo de servicios, piezas
// numeradas y el bloque de asesoramiento por WhatsApp al final.
const VERA: SeccionPlantilla[] = [
  {
    id: 'cintillo',
    nombre: 'Cintillo superior',
    nota: 'La línea fina de arriba de todo, sobre fondo crema.',
    campos: [
      {
        id: 'texto', label: 'Texto', tipo: 'texto', max: 90,
        help: 'Se ve en versalitas. Separá con · los ítems.',
        porDefecto: 'Grabado sin cargo · Envío asegurado a todo el país',
      },
      { id: 'cartelera', label: 'Mostrar como cartelera (se desliza)', tipo: 'switch', help: 'En vez de quedarse fijo, el texto corre en loop.' },
    ],
  },
  {
    id: 'whatsapp',
    nombre: 'Consulta por WhatsApp',
    nota: 'El bloque del final, antes del pie.',
    campos: [
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 60, porDefecto: '¿Dudas con el talle o el grabado?' },
      { id: 'bajada', label: 'Bajada', tipo: 'texto', max: 120, porDefecto: 'Escribinos por WhatsApp y te asesoramos antes de encargar.' },
      { id: 'cta', label: 'Texto del botón', tipo: 'texto', max: 28, porDefecto: 'Escribir por WhatsApp' },
    ],
  },
]

// ─── Cobijo ──────────────────────────────────────────────────────────────────
// Deco: se compra por AMBIENTE. Los dos bloques en zigzag son lo que la
// distingue, así que son lo primero que tiene que poder editar el dueño.
const COBIJO: SeccionPlantilla[] = [
  {
    id: 'cintillo',
    nombre: 'Cartel corriendo',
    nota: 'La franja de arriba de todo, antes del logo.',
    campos: [
      { id: 'texto', label: 'Texto', tipo: 'texto', max: 120, porDefecto: '✦ ENVÍO GRATIS EN MUEBLES ✦ 6 CUOTAS SIN INTERÉS ✦ ARMADO SIN CARGO' },
    ],
  },
  {
    id: 'ambiente1',
    nombre: 'Primer ambiente',
    nota: 'El bloque en zigzag con la foto a un lado y sus dos productos al otro.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Ambiente 1' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 40, porDefecto: 'El living' },
      { id: 'texto', label: 'Texto', tipo: 'parrafo', max: 200, porDefecto: 'Sillones, sofás y mesas ratonas que entran por la puerta y duran.' },
      { id: 'foto', label: 'Foto', tipo: 'imagen', help: 'Si no cargás una, se usa la de tu primera categoría.' },
    ],
  },
  {
    id: 'ambiente2',
    nombre: 'Segundo ambiente',
    nota: 'El mismo bloque, dado vuelta.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Ambiente 2' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 40, porDefecto: 'La mesa' },
      { id: 'texto', label: 'Texto', tipo: 'parrafo', max: 200, porDefecto: 'Cerámica esmaltada y textiles de algodón, hechos por talleres de acá.' },
      { id: 'foto', label: 'Foto', tipo: 'imagen', help: 'Si no cargás una, se usa la de tu tercera categoría.' },
    ],
  },
  {
    id: 'whatsapp',
    nombre: 'Consulta por WhatsApp',
    nota: 'El bloque del final, antes del pie.',
    campos: [
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 60, porDefecto: '¿Entra por tu puerta?' },
      { id: 'bajada', label: 'Bajada', tipo: 'texto', max: 120, porDefecto: 'Mandanos las medidas por WhatsApp y lo chequeamos con vos.' },
      { id: 'cta', label: 'Texto del botón', tipo: 'texto', max: 28, porDefecto: 'Escribir por WhatsApp' },
    ],
  },
]

// ─── Nítida ──────────────────────────────────────────────────────────────────
// Cosmética de farmacia prolija: hero partido en dos mitades duras y una
// segunda campaña al final que usa el SEGUNDO slide del hero.
const NITIDA: SeccionPlantilla[] = [
  {
    id: 'cintillo',
    nombre: 'Cartel corriendo',
    nota: 'La franja de arriba de todo, antes del logo.',
    campos: [
      { id: 'texto', label: 'Texto', tipo: 'texto', max: 120, porDefecto: '✦ MUESTRAS DE REGALO EN TODA COMPRA ✦ ENVÍO GRATIS DESDE $45.000' },
    ],
  },
  {
    id: 'hero',
    nombre: 'Hero',
    nota: 'Las fotos y los textos salen de "Hero". Acá va el segundo botón.',
    campos: [
      { id: 'cta2', label: 'Segundo botón', tipo: 'texto', max: 24, porDefecto: 'Ver todo', help: 'Lleva al catálogo completo.' },
    ],
  },
  {
    id: 'whatsapp',
    nombre: 'Consulta por WhatsApp',
    nota: 'El bloque del final, antes del pie.',
    campos: [
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 60, porDefecto: '¿No sabés cuál te sirve?' },
      { id: 'bajada', label: 'Bajada', tipo: 'texto', max: 120, porDefecto: 'Contanos tu tipo de piel por WhatsApp y te armamos la rutina.' },
      { id: 'cta', label: 'Texto del botón', tipo: 'texto', max: 28, porDefecto: 'Escribir por WhatsApp' },
    ],
  },
]

// ─── El registro ─────────────────────────────────────────────────────────────
// Una plantilla que todavía no declaró sus secciones no muestra la pestaña
// "Secciones" en el panel — se sigue viendo igual, solo que su contenido
// propio no es editable todavía.
export const SECCIONES_POR_PLANTILLA: Record<string, SeccionPlantilla[]> = {
  premium: PREMIUM,
  mosaico: MOSAICO,
  atleta: ATLETA,
  patitas: PATITAS,
  bodega: BODEGA,
  crecer: CRECER,
  vera: VERA,
  cobijo: COBIJO,
  nitida: NITIDA,
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
