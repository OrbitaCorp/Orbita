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

import type { Receta, SeccionPlantilla } from './tipos'
import { PLANTILLAS } from './datos'
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
      { id: 't1', label: 'Primera — título', tipo: 'texto', max: 34, afirmacion: true, porDefecto: 'Oro 18k con sello' },
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
        afirmacion: true,
        porDefecto: 'Fundimos, engarzamos y pulimos en el mismo lugar desde 1998. Nada sale del taller sin pasar por lupa dos veces.',
      },
      { id: 'n1v', label: 'Número 1', tipo: 'texto', max: 8, help: 'Ej: 26', afirmacion: true, porDefecto: '26' },
      { id: 'n1l', label: 'Número 1 — etiqueta', tipo: 'texto', max: 16, help: 'Ej: años', afirmacion: true, porDefecto: 'años' },
      { id: 'n2v', label: 'Número 2', tipo: 'texto', max: 8, afirmacion: true, porDefecto: '4.100' },
      { id: 'n2l', label: 'Número 2 — etiqueta', tipo: 'texto', max: 16, afirmacion: true, porDefecto: 'piezas' },
      { id: 'n3v', label: 'Número 3', tipo: 'texto', max: 8, afirmacion: true, porDefecto: '100%' },
      { id: 'n3l', label: 'Número 3 — etiqueta', tipo: 'texto', max: 16, afirmacion: true, porDefecto: 'a mano' },
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
  {
    id: 'categorias',
    nombre: 'Grilla de categorías',
    nota: 'El encabezado de la grilla de categorías. Las categorías son las tuyas.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Por categoría' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Qué estás buscando' },
      { id: 'accion', label: 'Enlace de la derecha', tipo: 'texto', max: 30, porDefecto: 'Ver todo →' },
    ],
  },
  {
    id: 'fila',
    nombre: 'Fila de piezas',
    nota: 'El encabezado de la fila de productos. Los productos salen de tu catálogo.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Disponibles ahora' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Piezas de la colección' },
      { id: 'accion', label: 'Enlace de la derecha', tipo: 'texto', max: 30, porDefecto: 'Ver la colección →' },
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
      { id: 'of1', label: 'Bloque 1 — oferta', tipo: 'texto', max: 12, help: 'Ej: −40%', afirmacion: true, porDefecto: '−40%' },
      { id: 'of2', label: 'Bloque 2 — oferta', tipo: 'texto', max: 12, afirmacion: true, porDefecto: '−25%' },
      { id: 'of3', label: 'Bloque 3 — oferta', tipo: 'texto', max: 12, afirmacion: true, porDefecto: '−30%' },
      { id: 'of4', label: 'Bloque 4 — oferta', tipo: 'texto', max: 12, afirmacion: true, porDefecto: 'Nuevo' },
    ],
  },
  {
    id: 'franja',
    nombre: 'Franja de envío',
    nota: 'La banda de color entre los productos y las marcas.',
    campos: [
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 48, afirmacion: true, porDefecto: 'Envío gratis desde $70.000' },
      { id: 'bajada', label: 'Bajada', tipo: 'texto', max: 90, afirmacion: true, porDefecto: 'A todo el país. Llega en 48 a 72 horas.' },
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
  {
    id: 'fila',
    nombre: 'Fila de destacados',
    nota: 'El encabezado de la fila de productos. Los productos salen de tu catálogo.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Se van rápido' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Lo más vendido' },
      { id: 'accion', label: 'Enlace de la derecha', tipo: 'texto', max: 30, porDefecto: 'Ver todo →' },
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
      { id: 'texto', label: 'Texto', tipo: 'texto', max: 120, afirmacion: true, porDefecto: 'ENVÍO GRATIS +$120.000 ✦ 3 CUOTAS SIN INTERÉS ✦ CAMBIO DE TALLE SIN CARGO' },
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
      { id: 'n1v', label: 'Número 1', tipo: 'texto', max: 10, afirmacion: true, porDefecto: '+2.400' },
      { id: 'n1l', label: 'Número 1 — etiqueta', tipo: 'texto', max: 24, porDefecto: 'km este mes' },
      { id: 'n2v', label: 'Número 2', tipo: 'texto', max: 10, afirmacion: true, porDefecto: '1.180' },
      { id: 'n2l', label: 'Número 2 — etiqueta', tipo: 'texto', max: 24, porDefecto: 'corredores' },
      { id: 'n3v', label: 'Número 3', tipo: 'texto', max: 10, afirmacion: true, porDefecto: '48 hs' },
      { id: 'n3l', label: 'Número 3 — etiqueta', tipo: 'texto', max: 24, porDefecto: 'de entrega' },
      { id: 'n4v', label: 'Número 4', tipo: 'texto', max: 10, afirmacion: true, porDefecto: '4,9' },
      { id: 'n4l', label: 'Número 4 — etiqueta', tipo: 'texto', max: 24, porDefecto: 'de puntaje' },
    ],
  },
  {
    id: 'fila',
    nombre: 'Fila de la temporada',
    nota: 'El encabezado de la fila de productos. Los productos salen de tu catálogo.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Equipate' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Lo nuevo de la temporada' },
      { id: 'accion', label: 'Enlace de la derecha', tipo: 'texto', max: 30, porDefecto: 'Ver todo →' },
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
      { id: 'texto', label: 'Texto', tipo: 'texto', max: 90, afirmacion: true, porDefecto: '✦ Envío en el día en CABA comprando antes de las 14 ✦' },
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
  {
    id: 'fila',
    nombre: 'Fila de recomendados',
    nota: 'El encabezado de la fila de productos. Los productos salen de tu catálogo.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Recomendados' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Lo que más eligen' },
      { id: 'accion', label: 'Enlace de la derecha', tipo: 'texto', max: 30, porDefecto: 'Ver todo →' },
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
      { id: 'texto', label: 'Texto', tipo: 'texto', max: 90, afirmacion: true, porDefecto: 'Envío refrigerado · Retiro en la vinoteca · Venta a mayores de 18' },
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
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Para acompañar' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Maridajes que funcionan' },
      { id: 't1', label: 'Primero — título', tipo: 'texto', max: 40, porDefecto: 'Asado y achuras' },
      { id: 'b1', label: 'Primero — texto', tipo: 'parrafo', max: 160, porDefecto: 'Malbec joven o Bonarda. Fruta y poca madera para no tapar la carne.' },
      { id: 't2', label: 'Segundo — título', tipo: 'texto', max: 40, porDefecto: 'Pastas con salsa roja' },
      { id: 'b2', label: 'Segundo — texto', tipo: 'parrafo', max: 160, porDefecto: 'Sangiovese o un blend liviano. Acidez que corte el tomate.' },
      { id: 't3', label: 'Tercero — título', tipo: 'texto', max: 40, porDefecto: 'Quesos duros' },
      { id: 'b3', label: 'Tercero — texto', tipo: 'parrafo', max: 160, porDefecto: 'Cabernet Franc con guarda, o un espumante nature bien frío.' },
    ],
  },
  {
    id: 'seleccion',
    nombre: 'Selección del mes',
    nota: 'El encabezado de la fila de productos. Los productos salen de tu catálogo.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Selección del mes' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Tres para empezar' },
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
      { id: 'texto', label: 'Texto', tipo: 'texto', max: 90, afirmacion: true, porDefecto: 'Algodón orgánico certificado · Cambios sin cargo dentro de los 30 días' },
    ],
  },
  {
    id: 'edades',
    nombre: 'Comprá por edad',
    nota: 'La línea de tiempo: son tus primeras cuatro categorías. Acá van el título y la bajada.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 30, porDefecto: 'Comprá por edad', porDefectoReal: 'Comprá por categoría' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 40, porDefecto: '¿Cuántos meses tiene?', porDefectoReal: 'Elegí una categoría' },
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
      { id: 'b4', label: 'Cuarta — bajada', tipo: 'texto', max: 40, afirmacion: true, porDefecto: 'sin cargo 30 días' },
    ],
  },
  {
    id: 'fila',
    nombre: 'Fila de recomendados',
    nota: 'El encabezado de la fila de productos. Los productos salen de tu catálogo.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Recomendados' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Lo más elegido' },
      { id: 'accion', label: 'Enlace de la derecha', tipo: 'texto', max: 30, porDefecto: 'Ver todo →' },
    ],
  },
]

// ─── Nocturno ────────────────────────────────────────────────────────────────
// Tech: la que más contenido inventado tenía. El contador de lanzamiento y la
// ficha de cada tarjeta estaban escritos a mano; la comparativa de modelos se
// sacó entera (Orbita no tiene con qué llenarla: eran tres modelos inventados
// con sus specs y sus precios).
const NOCTURNO: SeccionPlantilla[] = [
  {
    id: 'lanzamiento',
    nombre: 'Cintillo de lanzamiento',
    nota: 'La línea de arriba de todo. Vacía, no se dibuja. Para una cuenta regresiva de verdad usá Avanzado → Oferta relámpago.',
    campos: [
      { id: 'texto', label: 'Anuncio', tipo: 'texto', max: 60, porDefecto: 'Lanzamiento de temporada' },
      { id: 'aclaracion', label: 'Aclaración', tipo: 'texto', max: 40, afirmacion: true, porDefecto: '15% off reservando' },
    ],
  },
  {
    id: 'hero',
    nombre: 'Hero',
    nota: 'Las fotos y los textos salen de "Hero". Acá van la etiqueta de arriba del título, el segundo botón y las tres specs.',
    campos: [
      {
        id: 'etiqueta', label: 'Etiqueta', tipo: 'texto', max: 22, afirmacion: true,
        help: 'La pastilla chica arriba del título, en todos los slides. Vacía, no se dibuja.',
        porDefecto: 'Lanzamiento',
      },
      { id: 'cta2', label: 'Segundo botón', tipo: 'texto', max: 24, porDefecto: 'Consultar', help: 'Abre el WhatsApp de la tienda.' },
      { id: 's1v', label: 'Spec 1 — valor', tipo: 'texto', max: 10, afirmacion: true, porDefecto: '50 mm' },
      { id: 's1l', label: 'Spec 1 — etiqueta', tipo: 'texto', max: 16, porDefecto: 'driver' },
      { id: 's2v', label: 'Spec 2 — valor', tipo: 'texto', max: 10, afirmacion: true, porDefecto: '38 h' },
      { id: 's2l', label: 'Spec 2 — etiqueta', tipo: 'texto', max: 16, porDefecto: 'batería' },
      { id: 's3v', label: 'Spec 3 — valor', tipo: 'texto', max: 10, afirmacion: true, porDefecto: '35 dB' },
      { id: 's3l', label: 'Spec 3 — etiqueta', tipo: 'texto', max: 16, porDefecto: 'ANC' },
    ],
  },
  {
    id: 'ficha',
    nombre: 'Ficha de las tarjetas',
    nota: 'Los tres datos que aparecen en TODAS las tarjetas de "Se compran juntos".',
    campos: [
      { id: 'f1l', label: 'Dato 1 — etiqueta', tipo: 'texto', max: 16, porDefecto: 'Garantía' },
      { id: 'f1v', label: 'Dato 1 — valor', tipo: 'texto', max: 16, afirmacion: true, porDefecto: '12 meses' },
      { id: 'f2l', label: 'Dato 2 — etiqueta', tipo: 'texto', max: 16, porDefecto: 'Envío' },
      { id: 'f2v', label: 'Dato 2 — valor', tipo: 'texto', max: 16, afirmacion: true, porDefecto: '24 h' },
      { id: 'f3l', label: 'Dato 3 — etiqueta', tipo: 'texto', max: 16, porDefecto: 'Cuotas' },
      { id: 'f3v', label: 'Dato 3 — valor', tipo: 'texto', max: 16, porDefecto: 'sin interés' },
    ],
  },
  {
    id: 'pasos',
    nombre: 'El recorrido en tres pasos',
    nota: 'Los tres pasos son tus primeras tres categorías y llevan a su listado.',
    campos: [
      { id: 'i1', label: 'Paso 1 — qué va', tipo: 'seleccion', help: 'Elegí el producto o la categoría de este paso. Lo que no elijas se llena con tu catálogo.' },
      { id: 'i2', label: 'Paso 2 — qué va', tipo: 'seleccion' },
      { id: 'i3', label: 'Paso 3 — qué va', tipo: 'seleccion' },
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'En tres pasos' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 48, porDefecto: 'Armá tu setup' },
      { id: 'cta', label: 'Texto del botón', tipo: 'texto', max: 28, porDefecto: 'Ver todo el catálogo' },
    ],
  },
  {
    id: 'numeros',
    nombre: 'Números grandes',
    nota: 'La franja del final. Un número vacío no se dibuja.',
    campos: [
      { id: 'n1v', label: 'Número 1', tipo: 'texto', max: 10, afirmacion: true, porDefecto: '24 h' },
      { id: 'n1l', label: 'Número 1 — etiqueta', tipo: 'texto', max: 30, porDefecto: 'de envío a todo el país' },
      { id: 'n2v', label: 'Número 2', tipo: 'texto', max: 10, afirmacion: true, porDefecto: '12' },
      { id: 'n2l', label: 'Número 2 — etiqueta', tipo: 'texto', max: 30, afirmacion: true, porDefecto: 'meses de garantía' },
      { id: 'n3v', label: 'Número 3', tipo: 'texto', max: 10, afirmacion: true, porDefecto: '12' },
      { id: 'n3l', label: 'Número 3 — etiqueta', tipo: 'texto', max: 30, afirmacion: true, porDefecto: 'cuotas sin interés' },
      { id: 'n4v', label: 'Número 4', tipo: 'texto', max: 10 },
      { id: 'n4l', label: 'Número 4 — etiqueta', tipo: 'texto', max: 30 },
    ],
  },
  {
    id: 'fila',
    nombre: 'Fila de accesorios',
    nota: 'El encabezado de la fila de productos. Los productos salen de tu catálogo.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Arman buen setup' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Se compran juntos' },
      { id: 'accion', label: 'Enlace de la derecha', tipo: 'texto', max: 30, porDefecto: 'Ver el catálogo →' },
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
  {
    id: 'fila',
    nombre: 'Fila de piezas',
    nota: 'El encabezado de la fila de productos. Los productos salen de tu catálogo.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'La colección' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Piezas disponibles' },
    ],
  },
  {
    id: 'categorias',
    nombre: 'Grilla de categorías',
    nota: 'El encabezado de la grilla de categorías. Las categorías son las tuyas.',
    campos: [
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Buscá por pieza' },
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
      { id: 'texto', label: 'Texto', tipo: 'texto', max: 120, afirmacion: true, porDefecto: '✦ ENVÍO GRATIS EN MUEBLES ✦ 6 CUOTAS SIN INTERÉS ✦ ARMADO SIN CARGO' },
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
  {
    id: 'categorias',
    nombre: 'Grilla de categorías',
    nota: 'El encabezado de la grilla de categorías. Las categorías son las tuyas.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Todo el catálogo' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Comprá por categoría' },
      { id: 'accion', label: 'Enlace de la derecha', tipo: 'texto', max: 30, porDefecto: 'Ver todo →' },
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
      { id: 'texto', label: 'Texto', tipo: 'texto', max: 120, afirmacion: true, porDefecto: '✦ MUESTRAS DE REGALO EN TODA COMPRA ✦ ENVÍO GRATIS DESDE $45.000' },
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
  {
    id: 'fila',
    nombre: 'Fila de esenciales',
    nota: 'El encabezado de la fila de productos. Los productos salen de tu catálogo.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Lo esencial' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Los que más se repiten' },
      { id: 'accion', label: 'Enlace de la derecha', tipo: 'texto', max: 30, porDefecto: 'Ver el catálogo →' },
    ],
  },
  {
    id: 'categorias',
    nombre: 'Grilla de categorías',
    nota: 'El encabezado de la grilla de categorías. Las categorías son las tuyas.',
    campos: [
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Por familia', porDefectoReal: 'Por categoría' },
    ],
  },
]

// ─── Papelería ───────────────────────────────────────────────────────────────
// Librería: el buscador es el hero y la lista escolar es lo que resuelve el
// problema de marzo. Las categorías en pastillas son las del negocio.
const PAPELERIA: SeccionPlantilla[] = [
  {
    id: 'cintillo',
    nombre: 'Cintillo superior',
    nota: 'La franja de color de arriba de todo.',
    campos: [
      { id: 'texto', label: 'Texto', tipo: 'texto', max: 90, afirmacion: true, porDefecto: 'Envío gratis desde $25.000 · Retiro en el local sin cargo' },
    ],
  },
  {
    id: 'hero',
    nombre: 'Hero buscador',
    nota: 'El texto grande sale de "Hero". Acá van el texto de la caja de búsqueda y los atajos de abajo.',
    campos: [
      { id: 'placeholder', label: 'Texto de la caja', tipo: 'texto', max: 60, porDefecto: 'Ej: cuaderno rayado 48 hojas' },
      { id: 'atajos', label: 'Búsquedas frecuentes', tipo: 'texto', max: 140, help: 'Separadas por coma. Entran cinco cómodas.', porDefecto: 'Lista escolar, Resma A4, Témperas, Carpeta N°3, Tinta' },
    ],
  },
  {
    id: 'lista',
    nombre: 'Lista sugerida',
    nota: 'Cinco productos de ejemplo, elegidos de tu catálogo. El precio lo pone cada producto; el presupuesto se pide por WhatsApp.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Sin vueltas' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'La lista de la escuela' },
      { id: 'i1', label: 'Ítem 1', tipo: 'seleccion', help: 'Elegí el producto. Lo que no elijas se llena con tu catálogo.' },
      { id: 'i2', label: 'Ítem 2', tipo: 'seleccion' },
      { id: 'i3', label: 'Ítem 3', tipo: 'seleccion' },
      { id: 'i4', label: 'Ítem 4', tipo: 'seleccion' },
      { id: 'i5', label: 'Ítem 5', tipo: 'seleccion' },
      { id: 'volantaCaja', label: 'Caja — volanta', tipo: 'texto', max: 30, porDefecto: 'Te la armamos' },
      { id: 'tituloCaja', label: 'Caja — título', tipo: 'texto', max: 60, porDefecto: 'Mandanos la lista del cole' },
      { id: 'bajadaCaja', label: 'Caja — bajada', tipo: 'texto', max: 90, porDefecto: 'Te pasamos el presupuesto en el día.' },
      { id: 'cta', label: 'Caja — botón', tipo: 'texto', max: 28, porDefecto: 'Consultar por WhatsApp' },
    ],
  },
  {
    id: 'campana',
    nombre: 'Banner de campaña',
    nota: 'La foto ancha del final, antes del pie.',
    campos: [
      { id: 'foto', label: 'Foto', tipo: 'imagen', porDefecto: `${IMG}/libre-biblioteca.jpg` },
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 30, porDefecto: 'Vuelta a clases' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 50, porDefecto: 'Traé la lista, nosotros la armamos' },
      { id: 'texto', label: 'Texto', tipo: 'parrafo', max: 140, porDefecto: 'Mandala por WhatsApp y te pasamos el presupuesto en el día.' },
      { id: 'cta', label: 'Texto del botón', tipo: 'texto', max: 28, porDefecto: 'Mandar mi lista', help: 'Abre el WhatsApp de la tienda. El número sale de Configuración, no se carga acá.' },
    ],
  },
  {
    id: 'categorias',
    nombre: 'Grilla de categorías',
    nota: 'El encabezado de la grilla de categorías. Las categorías son las tuyas.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Buscá por rubro', porDefectoReal: 'Por categoría' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Categorías' },
      { id: 'accion', label: 'Enlace de la derecha', tipo: 'texto', max: 30, porDefecto: 'Ver todas →' },
    ],
  },
  {
    id: 'fila',
    nombre: 'Fila de más vendidos',
    nota: 'El encabezado de la fila de productos. Los productos salen de tu catálogo.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Lo que más sale' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Más vendidos de la semana' },
      { id: 'accion', label: 'Enlace de la derecha', tipo: 'texto', max: 30, porDefecto: 'Ver todo →' },
    ],
  },
]

// ─── Corralón ────────────────────────────────────────────────────────────────
// Catálogo grande y comprador apurado: la barra de departamentos son las
// categorías, y el cálculo de materiales se pide por WhatsApp.
const CORRALON: SeccionPlantilla[] = [
  {
    id: 'servicios',
    nombre: 'Barra de servicios',
    nota: 'La línea de arriba de todo. Separá los ítems con ·',
    campos: [
      { id: 'texto', label: 'Texto', tipo: 'texto', max: 110, afirmacion: true, porDefecto: '9 sucursales · Retiro en el día · Cuenta corriente para empresas' },
    ],
  },
  {
    id: 'avisos',
    nombre: 'Avisos del hero',
    nota: 'Los dos bloques chicos al lado de la campaña grande. Uno sin título no se dibuja.',
    campos: [
      { id: 't1', label: 'Primero — título', tipo: 'texto', max: 34, afirmacion: true, porDefecto: 'Retiro en 2 horas' },
      { id: 'b1', label: 'Primero — texto', tipo: 'parrafo', max: 140, porDefecto: 'Comprás online y lo pasás a buscar por la sucursal que te quede.' },
      { id: 't2', label: 'Segundo — título', tipo: 'texto', max: 34, porDefecto: 'Envío a obra' },
      { id: 'b2', label: 'Segundo — texto', tipo: 'parrafo', max: 140, porDefecto: 'Camión propio en CABA y GBA. Coordinamos día y horario.' },
    ],
  },
  {
    id: 'calculo',
    nombre: 'Cálculo de materiales',
    nota: 'El bloque de color con la tarjeta blanca. El cálculo se pide por WhatsApp: Órbita no lo resuelve sola.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Cálculo' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: '¿Cuánto material necesitás?' },
      { id: 'texto', label: 'Texto', tipo: 'parrafo', max: 200, porDefecto: 'Contanos los metros y te decimos cuánto comprar. Sin comprar de más ni volver al local.' },
      { id: 'volantaCaja', label: 'Tarjeta — volanta', tipo: 'texto', max: 30, porDefecto: 'Te lo calculamos' },
      { id: 'tituloCaja', label: 'Tarjeta — título', tipo: 'texto', max: 60, porDefecto: 'Pasanos las medidas y te pasamos el total' },
      { id: 'cta', label: 'Tarjeta — botón', tipo: 'texto', max: 28, porDefecto: 'Consultar por WhatsApp' },
    ],
  },
  {
    id: 'numeros',
    nombre: 'Números de la casa',
    nota: 'La franja del final. Un número vacío no se dibuja.',
    campos: [
      { id: 'n1v', label: 'Número 1', tipo: 'texto', max: 10, porDefecto: '9' },
      { id: 'n1l', label: 'Número 1 — etiqueta', tipo: 'texto', max: 24, porDefecto: 'sucursales' },
      { id: 'n2v', label: 'Número 2', tipo: 'texto', max: 10, afirmacion: true, porDefecto: '2 hs' },
      { id: 'n2l', label: 'Número 2 — etiqueta', tipo: 'texto', max: 24, porDefecto: 'para retirar' },
      { id: 'n3v', label: 'Número 3', tipo: 'texto', max: 10, afirmacion: true, porDefecto: '52' },
      { id: 'n3l', label: 'Número 3 — etiqueta', tipo: 'texto', max: 24, afirmacion: true, porDefecto: 'años' },
      { id: 'n4v', label: 'Número 4', tipo: 'texto', max: 10, afirmacion: true, porDefecto: '+18.000' },
      { id: 'n4l', label: 'Número 4 — etiqueta', tipo: 'texto', max: 24, porDefecto: 'productos' },
    ],
  },
  {
    id: 'categorias',
    nombre: 'Grilla de rubros',
    nota: 'El encabezado de la grilla de categorías. Las categorías son las tuyas.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Departamentos', porDefectoReal: 'Por categoría' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Entrá por rubro', porDefectoReal: 'Comprá por categoría' },
      { id: 'accion', label: 'Enlace de la derecha', tipo: 'texto', max: 30, porDefecto: 'Ver todos →' },
    ],
  },
  {
    id: 'fila',
    nombre: 'Fila de más pedidos',
    nota: 'El encabezado de la fila de productos. Los productos salen de tu catálogo.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Lo más pedido' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Herramienta y obra' },
      { id: 'accion', label: 'Enlace de la derecha', tipo: 'texto', max: 30, porDefecto: 'Ver catálogo →' },
    ],
  },
]

// ─── Glow ────────────────────────────────────────────────────────────────────
// Belleza: sellos, la rutina en tres pasos, el antes y después, y la galería.
const GLOW: SeccionPlantilla[] = [
  {
    id: 'cintillo',
    nombre: 'Cintillo superior',
    nota: 'La franja de color de arriba de todo.',
    campos: [
      { id: 'texto', label: 'Texto', tipo: 'texto', max: 90, afirmacion: true, porDefecto: '✦ Envío gratis desde $45.000 · 3 cuotas sin interés' },
    ],
  },
  {
    id: 'hero',
    nombre: 'Hero',
    nota: 'Las fotos y los textos salen de "Hero". Acá va el segundo botón.',
    campos: [
      { id: 'cta2', label: 'Segundo botón', tipo: 'texto', max: 26, porDefecto: 'Asesorate por WhatsApp', help: 'Abre el WhatsApp de la tienda.' },
    ],
  },
  {
    id: 'sellos',
    nombre: 'Sellos de producto',
    nota: 'La franja de cuatro columnas debajo del hero. Uno sin título no se dibuja.',
    campos: [
      { id: 't1', label: 'Sello 1', tipo: 'texto', max: 24, porDefecto: 'Vegano' },
      { id: 'b1', label: 'Sello 1 — bajada', tipo: 'texto', max: 40, porDefecto: 'sin ingredientes animales' },
      { id: 't2', label: 'Sello 2', tipo: 'texto', max: 24, porDefecto: 'Sin crueldad' },
      { id: 'b2', label: 'Sello 2 — bajada', tipo: 'texto', max: 40, porDefecto: 'no testeado en animales' },
      { id: 't3', label: 'Sello 3', tipo: 'texto', max: 24, porDefecto: 'Dermatológico' },
      { id: 'b3', label: 'Sello 3 — bajada', tipo: 'texto', max: 40, porDefecto: 'testeado en piel sensible' },
      { id: 't4', label: 'Sello 4', tipo: 'texto', max: 24, porDefecto: 'Sin fragancia' },
      { id: 'b4', label: 'Sello 4 — bajada', tipo: 'texto', max: 40, porDefecto: 'apto rosácea' },
    ],
  },
  {
    id: 'rutina',
    nombre: 'La rutina en tres pasos',
    nota: 'El nombre de cada paso y qué va en él. Lo que no elijas se llena con tu catálogo.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Tres pasos' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 40, porDefecto: 'Tu rutina, resuelta' },
      { id: 'paso1', label: 'Paso 1 — nombre', tipo: 'texto', max: 20, porDefecto: 'Limpiar' },
      { id: 'i1', label: 'Paso 1 — qué va', tipo: 'seleccion', help: 'Elegí el producto o la categoría de este paso.' },
      { id: 'paso2', label: 'Paso 2 — nombre', tipo: 'texto', max: 20, porDefecto: 'Tratar' },
      { id: 'i2', label: 'Paso 2 — qué va', tipo: 'seleccion' },
      { id: 'paso3', label: 'Paso 3 — nombre', tipo: 'texto', max: 20, porDefecto: 'Hidratar' },
      { id: 'i3', label: 'Paso 3 — qué va', tipo: 'seleccion' },
      { id: 'pie', label: 'Línea de abajo', tipo: 'texto', max: 90, help: 'Vacía, no se dibuja.' },
    ],
  },
  {
    id: 'antesDespues',
    nombre: 'Antes y después',
    nota: 'Las dos fotos comparadas. Usá fotos propias: es una promesa de resultado.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Ocho semanas' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 40, porDefecto: 'Antes y después' },
      { id: 'foto1', label: 'Foto — antes', tipo: 'imagen', porDefecto: `${IMG}/belleza-spa.jpg` },
      { id: 'etiqueta1', label: 'Etiqueta — antes', tipo: 'texto', max: 16, porDefecto: 'Antes' },
      { id: 'foto2', label: 'Foto — después', tipo: 'imagen', porDefecto: `${IMG}/belleza-labial.jpg` },
      { id: 'etiqueta2', label: 'Etiqueta — después', tipo: 'texto', max: 16, porDefecto: 'Después' },
      { id: 'leyenda', label: 'Leyenda', tipo: 'parrafo', max: 160, porDefecto: 'Resultados de uso diario. Fotos sin retoque.' },
    ],
  },
  {
    id: 'galeria',
    nombre: 'Galería',
    nota: 'La tira de fotos del final. Una foto vacía no se dibuja; sin ninguna, la sección desaparece.',
    campos: [
      { id: 'usuario', label: 'Usuario', tipo: 'texto', max: 30, porDefecto: '@tutienda' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 40, porDefecto: 'Seguinos en Instagram' },
      { id: 'f1', label: 'Foto 1', tipo: 'imagen', porDefecto: `${IMG}/belleza-maquillaje.jpg` },
      { id: 'f2', label: 'Foto 2', tipo: 'imagen', porDefecto: `${IMG}/belleza-paletas.jpg` },
      { id: 'f3', label: 'Foto 3', tipo: 'imagen', porDefecto: `${IMG}/belleza-manos.jpg` },
      { id: 'f4', label: 'Foto 4', tipo: 'imagen', porDefecto: `${IMG}/belleza-coral.jpg` },
      { id: 'f5', label: 'Foto 5', tipo: 'imagen', porDefecto: `${IMG}/belleza-cosmetica.jpg` },
      { id: 'f6', label: 'Foto 6', tipo: 'imagen', porDefecto: `${IMG}/belleza-spa.jpg` },
    ],
  },
  {
    id: 'fila',
    nombre: 'Fila de más elegidos',
    nota: 'El encabezado de la fila de productos. Los productos salen de tu catálogo.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Se llevan todo' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Las más elegidas' },
      { id: 'accion', label: 'Enlace de la derecha', tipo: 'texto', max: 30, porDefecto: 'Ver todo →' },
    ],
  },
]

// ─── Circuito ────────────────────────────────────────────────────────────────
// Tech con panel lateral fijo: el cartel corriendo y el bloque de consulta.
const CIRCUITO: SeccionPlantilla[] = [
  {
    id: 'cintillo',
    nombre: 'Cartel corriendo',
    nota: 'La franja de arriba de todo, sobre el panel. Vacía, no se dibuja.',
    campos: [
      { id: 'texto', label: 'Texto', tipo: 'texto', max: 120, afirmacion: true, porDefecto: '✦ 12 CUOTAS SIN INTERÉS ✦ GARANTÍA OFICIAL 12 MESES' },
    ],
  },
  {
    id: 'whatsapp',
    nombre: 'Consulta por WhatsApp',
    nota: 'El bloque del final, antes del pie.',
    campos: [
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 60, porDefecto: '¿Dudas con la compatibilidad?' },
      { id: 'bajada', label: 'Bajada', tipo: 'texto', max: 120, porDefecto: 'Escribinos por WhatsApp y te respondemos en el día.' },
      { id: 'cta', label: 'Texto del botón', tipo: 'texto', max: 28, porDefecto: 'Escribir por WhatsApp' },
    ],
  },
  {
    id: 'fila',
    nombre: 'Fila de más vendidos',
    nota: 'El encabezado de la fila de productos. Los productos salen de tu catálogo.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Ficha técnica a la vista' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Lo que más se vende' },
      { id: 'accion', label: 'Enlace de la derecha', tipo: 'texto', max: 30, porDefecto: 'Ver el catálogo →' },
    ],
  },
  {
    id: 'categorias',
    nombre: 'Lista de categorías',
    nota: 'El encabezado de la grilla de categorías. Las categorías son las tuyas.',
    campos: [
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Por categoría' },
    ],
  },
  {
    id: 'fila2',
    nombre: 'Fila de nuevos ingresos',
    nota: 'El encabezado de la fila de productos. Los productos salen de tu catálogo.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'También te puede servir' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Nuevos ingresos' },
    ],
  },
]

// ─── Vidriera ────────────────────────────────────────────────────────────────
// La más usada. Su header y su hero los dibuja la tienda real (va con
// `soloCuerpo`), así que lo editable son los títulos de sus filas y el bloque
// de WhatsApp.
const VIDRIERA: SeccionPlantilla[] = [
  {
    id: 'destacados',
    nombre: 'Fila de destacados',
    nota: 'La primera fila de productos, a sangre.',
    campos: [
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 40, porDefecto: 'Destacados' },
      { id: 'bajada', label: 'Bajada', tipo: 'texto', max: 70, porDefecto: 'Los que más se venden esta semana' },
    ],
  },
  {
    id: 'categorias',
    nombre: 'Comprá por categoría',
    nota: 'El título de la grilla de categorías.',
    campos: [
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 40, porDefecto: 'Comprá por categoría' },
    ],
  },
  {
    id: 'masVendidos',
    nombre: 'Fila de más vendidos',
    nota: 'La segunda fila de productos.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Top ventas' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 40, porDefecto: 'Más vendidos' },
      { id: 'accion', label: 'Enlace de la derecha', tipo: 'texto', max: 30, porDefecto: 'Ver el catálogo →' },
    ],
  },
  {
    id: 'whatsapp',
    nombre: 'Consulta por WhatsApp',
    nota: 'El bloque del final, antes del pie.',
    campos: [
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 60, porDefecto: '¿Dudas con tu compra?' },
      { id: 'bajada', label: 'Bajada', tipo: 'texto', max: 120, porDefecto: 'Escribinos por WhatsApp y te respondemos en el día.' },
      { id: 'cta', label: 'Texto del botón', tipo: 'texto', max: 28, porDefecto: 'Escribir por WhatsApp' },
    ],
  },
]

// ─── Escaparate ──────────────────────────────────────────────────────────────
// Moda urbana. "Comprá el look" es lo que la distingue y era lo último que
// seguía con una foto del repo y los puntos en coordenadas fijas.
const ESCAPARATE: SeccionPlantilla[] = [
  {
    id: 'tira',
    nombre: 'Tira de lo nuevo',
    nota: 'La fila que se arrastra, debajo de las dos campañas.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Recién llegado' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 40, porDefecto: 'Lo nuevo de la semana' },
      { id: 'accion', label: 'Enlace de la derecha', tipo: 'texto', max: 30, porDefecto: 'Ver todo →' },
    ],
  },
  {
    id: 'look',
    nombre: 'Comprá el look',
    nota: 'La foto grande con los puntos numerados. Los productos de la lista son tus destacados.',
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: 'Total look' },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Comprá el look completo' },
      { id: 'foto', label: 'Foto del look', tipo: 'imagen', help: 'Vertical, una persona con varias prendas puestas.', porDefecto: `${IMG}/vidriera-modelo.jpg` },
      { id: 'p1', label: 'Punto 1 — posición', tipo: 'texto', max: 12, help: 'Alto,ancho en % sobre la foto. Ej: 26,32', porDefecto: '26,32' },
      { id: 'p2', label: 'Punto 2 — posición', tipo: 'texto', max: 12, porDefecto: '58,54' },
      { id: 'p3', label: 'Punto 3 — posición', tipo: 'texto', max: 12, porDefecto: '72,78' },
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
  nocturno: NOCTURNO,
  papeleria: PAPELERIA,
  corralon: CORRALON,
  glow: GLOW,
  circuito: CIRCUITO,
  vidriera: VIDRIERA,
  escaparate: ESCAPARATE,
  atleta: ATLETA,
  patitas: PATITAS,
  bodega: BODEGA,
  crecer: CRECER,
  vera: VERA,
  cobijo: COBIJO,
  nitida: NITIDA,
}

/**
 * El formulario de una plantilla con receta, armado desde sus bloques.
 *
 * Las dieciséis primeras declaran su esquema a mano porque cada una tiene
 * secciones que ninguna otra tiene. Una plantilla con receta usa el
 * vocabulario compartido, así que su editor se deduce: cada bloque sabe qué
 * campos necesita, y el orden del formulario es el orden de la portada.
 *
 * Sumar una plantilla nueva no es escribir un editor — es elegir bloques.
 */
export function esquemaDeReceta(receta: Receta): SeccionPlantilla[] {
  const out: SeccionPlantilla[] = [{
    id: 'cintillo',
    nombre: 'Cintillo superior',
    nota: 'La línea de arriba de todo. Vacía, no se dibuja.',
    campos: [
      { id: 'texto', label: 'Texto', tipo: 'texto', max: 90, afirmacion: true, help: 'Ej: envío gratis desde cierto monto, o una promo vigente.', porDefecto: 'Envío gratis en compras superiores a $80.000' },
      { id: 'cartelera', label: 'Mostrar como cartelera (se desliza)', tipo: 'switch', help: 'En vez de quedarse fijo, el texto corre en loop.' },
    ],
  }]

  const encabezado = (id: string, nombre: string, nota: string, vol: string, tit: string, accion?: string): SeccionPlantilla => ({
    id, nombre, nota,
    campos: [
      { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24, porDefecto: vol },
      { id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: tit },
      ...(accion !== undefined ? [{ id: 'accion', label: 'Enlace de la derecha', tipo: 'texto' as const, max: 30, porDefecto: accion }] : []),
    ],
  })

  for (const b of receta.bloques) {
    switch (b.t) {
      case 'hero':
        out.push({
          id: 'hero',
          nombre: 'Hero',
          nota: 'Las fotos y los textos salen de "Hero", en Apariencia. Acá va el segundo botón.',
          campos: [
            { id: 'cta2', label: 'Segundo botón', tipo: 'texto', max: 24, help: 'Abre el WhatsApp de la tienda. Vacío, no se dibuja.' },
          ],
        })
        break
      case 'categorias':
        out.push(encabezado('categorias', 'Grilla de categorías', 'El encabezado. Las categorías son las tuyas.', 'Por categoría', 'Comprá por categoría', 'Ver todas →'))
        break
      case 'fila':
        out.push(encabezado(b.id, 'Fila de productos', 'El encabezado de esta fila. Los productos salen de tu catálogo.', 'Lo más elegido', 'Destacados', 'Ver todo →'))
        break
      case 'franja':
        out.push({
          id: 'franja',
          nombre: 'Espacio de anuncio',
          nota: 'La franja ancha. Sin título no se dibuja: una tienda que no anuncia nada no muestra una barra vacía.',
          campos: [
            { id: 'titulo', label: 'Título', tipo: 'texto', max: 60, afirmacion: true, help: 'Lo que querés anunciar.', porDefecto: 'Envío gratis desde $80.000' },
            { id: 'bajada', label: 'Bajada', tipo: 'texto', max: 90, afirmacion: true, porDefecto: 'A todo el país, con seguimiento.' },
            { id: 'cta', label: 'Texto del botón', tipo: 'texto', max: 24, porDefecto: 'Ver el catálogo' },
          ],
        })
        break
      case 'parallax':
        out.push({
          id: 'parallax',
          nombre: 'Banner con parallax',
          nota: 'Foto ancha que se queda quieta mientras la página scrollea. Sin foto o sin título no se dibuja.',
          campos: [
            { id: 'foto', label: 'Foto', tipo: 'imagen', help: 'Bien apaisada, 1600px de ancho o más: se ve a pantalla completa.' },
            { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 24 },
            { id: 'titulo', label: 'Título', tipo: 'texto', max: 50 },
            { id: 'texto', label: 'Texto', tipo: 'parrafo', max: 140 },
            { id: 'cta', label: 'Texto del botón', tipo: 'texto', max: 24, porDefecto: 'Ver el catálogo' },
          ],
        })
        break
      case 'campana':
        out.push({
          id: 'campana',
          nombre: 'Banner de campaña',
          nota: 'La foto ancha del final, con el texto encima. Sin foto o sin título no se dibuja.',
          campos: [
            { id: 'foto', label: 'Foto', tipo: 'imagen', help: 'Apaisada, se ve a todo el ancho.' },
            { id: 'volanta', label: 'Volanta', tipo: 'texto', max: 30 },
            { id: 'titulo', label: 'Título', tipo: 'texto', max: 50 },
            { id: 'texto', label: 'Texto', tipo: 'parrafo', max: 140 },
            { id: 'cta', label: 'Texto del botón', tipo: 'texto', max: 24, porDefecto: 'Ver el catálogo' },
          ],
        })
        break
      case 'whatsapp':
        out.push({
          id: 'whatsapp',
          nombre: 'Consulta por WhatsApp',
          nota: 'El bloque del final. El número sale de Configuración, no se carga acá.',
          campos: [
            { id: 'titulo', label: 'Título', tipo: 'texto', max: 60, porDefecto: '¿Dudas con tu compra?' },
            { id: 'bajada', label: 'Bajada', tipo: 'texto', max: 120, porDefecto: 'Escribinos por WhatsApp y te respondemos.' },
            { id: 'cta', label: 'Texto del botón', tipo: 'texto', max: 28, porDefecto: 'Escribir por WhatsApp' },
          ],
        })
        break
      // `porCategoria` no lleva formulario: sus títulos son los nombres de las
      // categorías del negocio, que ya se editan en Categorías.
      case 'porCategoria':
        break
    }
  }
  return out
}

export function seccionesDe(idPlantilla: string | null | undefined): SeccionPlantilla[] {
  if (!idPlantilla) return []
  const propias = SECCIONES_POR_PLANTILLA[idPlantilla]
  if (propias) return propias
  const receta = PLANTILLAS.find(x => x.id === idPlantilla)?.receta
  return receta ? esquemaDeReceta(receta) : []
}

/**
 * El contenido con el que se diseñó un campo. Lo usan la portada (cuando el
 * dueño no editó nada) y el editor (que lo muestra precargado) — así los dos
 * leen exactamente el mismo texto.
 */
/**
 * ¿Ese campo afirma algo del negocio (un descuento, un envío gratis, una
 * cantidad) en vez de ser una etiqueta? Ver `afirmacion` en tipos.ts.
 */
export function esAfirmacion(idPlantilla: string, seccion: string, campo: string): boolean {
  return !!SECCIONES_POR_PLANTILLA[idPlantilla]
    ?.find(s => s.id === seccion)
    ?.campos.find(c => c.id === campo)
    ?.afirmacion
}

/**
 * El texto con el que se diseñó ese campo.
 *
 * `real` pide la versión para una tienda de verdad: si el campo declaró un
 * `porDefectoReal` (porque el de la vitrina está escrito para el rubro de la
 * maqueta), gana ese. Ver `porDefectoReal` en tipos.ts.
 */
export function porDefectoDe(idPlantilla: string | null | undefined, seccion: string, campo: string, real = false): string {
  const sec = seccionesDe(idPlantilla).find(s => s.id === seccion)
  const c = sec?.campos.find(x => x.id === campo)
  if (!c) return ''
  return (real ? c.porDefectoReal ?? c.porDefecto : c.porDefecto) ?? ''
}
