// Tipos y helpers de las plantillas de Home (paquete Avanzado).
//
// Una plantilla NO es un tema de colores: es una portada distinta. Por eso
// cada una trae su propio `layout` (ver homes.tsx), su marca de muestra y sus
// productos de muestra — lo que se elige acá es la puerta de entrada de la
// tienda, no la tienda.

export const IMG = '/plantillas'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface Tema {
  bg: string; surf: string; soft: string; text: string; muted: string; border: string
  primary: string; onPrimary: string; accent: string
  fh: string; fb: string; radio: number; oscuro: boolean
  sombra: string
}

export type Layout =
  // El que usan todas las plantillas visibles hoy.
  | 'tienda'
  // De autor, sin uso: ver la nota en homes.tsx.
  | 'vidriera' | 'escaparate' | 'mosaico' | 'premium' | 'nocturno' | 'glow'
  | 'papeleria' | 'corralon' | 'atleta' | 'patitas' | 'bodega' | 'crecer'

export interface Producto {
  nombre: string; precio: string; antes?: string; transfer?: string; cuotas?: string
  badge?: string; badgeTono?: 'azul' | 'violeta' | 'verde' | 'rojo'
  tag?: string; estrellas?: number; resenas?: number; stock?: string
  colores?: string[]
  img: string; img2?: string
}

export interface Slide { img: string; kicker?: string; titulo: string; bajada: string; cta: string }

export interface Plantilla {
  id: string; nombre: string; para: string; queCambia: string; secciones: string[]
  marca: string; tagline: string; layout: Layout; tema: Tema
  slides: Slide[]; productos: Producto[]

  // Una plantilla que no se muestra en la galería. NO se borra: el dueño
  // quiso guardar las de autor (Escaparate, Mosaico, Premium, Nocturno,
  // Glow) por si más adelante las quiere de vuelta — se destapan sacando
  // este campo.
  oculta?: boolean

  // Contenido del layout 'tienda'. Es el mismo esqueleto para todas (el que
  // más vende, y el único que arma secciones que Órbita realmente genera);
  // lo que cambia de una a otra es esto, más el tema y las fotos.
  cartel?: string
  links?: string[]
  confianza?: [string, string][]
  categorias?: [string, string][]
  cupon?: { titulo: string; bajada: string; codigo: string }
  pie?: { columnas: [string, string[]][]; cierre: string }
}

export const sans = (n: string) => `"${n}", system-ui, -apple-system, sans-serif`
export const serif = (n: string) => `"${n}", Georgia, serif`

export const ar = (final: string, antes: string, transfer: string, cuota: string) => ({
  precio: final, antes, transfer: `${transfer} con transferencia`, cuotas: `3 cuotas sin interés de ${cuota}`,
})
