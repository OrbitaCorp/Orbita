// Tipos y helpers de las plantillas de Home (paquete Avanzado).
//
// Una plantilla NO es un tema de colores: es una portada distinta. Por eso
// cada una trae su propio `layout` (ver homes.tsx), su marca de muestra y sus
// productos de muestra — lo que se elige acá es la puerta de entrada de la
// tienda, no la tienda.

import type { ReactNode } from 'react'

export const IMG = '/plantillas'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface Tema {
  bg: string; surf: string; soft: string; text: string; muted: string; border: string
  primary: string; onPrimary: string; accent: string
  fh: string; fb: string; radio: number; oscuro: boolean
  sombra: string
}

export type Layout =
  // El esqueleto de Vidriera, extraído para poder reusarlo: una plantilla
  // nueva puede tomarlo en vez de escribir el suyo (Semilla, Lunar, Tueste y
  // Piñón lo hacen).
  | 'tienda'
  // Un esqueleto propio por plantilla — ver el bloque de cada una en
  // homes.tsx. 'vidriera' quedó como alias de 'tienda'.
  | 'vidriera' | 'escaparate' | 'mosaico' | 'premium' | 'nocturno' | 'glow'
  | 'papeleria' | 'corralon' | 'atleta' | 'patitas' | 'bodega' | 'crecer'
  | 'circuito' | 'vera' | 'cobijo' | 'nitida'

export interface Producto {
  nombre: string; precio: string; antes?: string; transfer?: string; cuotas?: string
  badge?: string; badgeTono?: 'azul' | 'violeta' | 'verde' | 'rojo'
  tag?: string; estrellas?: number; resenas?: number; stock?: string
  colores?: string[]
  img: string; img2?: string
  // Solo cuando los datos vienen de la tienda real (ver adaptador en
  // cliente/inicio/plantillaReal.ts): a dónde lleva la tarjeta al hacerle
  // click. En las plantillas de muestra no existe y la tarjeta no navega.
  slug?: string
}

export interface Slide { img: string; kicker?: string; titulo: string; bajada: string; cta: string }

export interface Plantilla {
  id: string; nombre: string; para: string; queCambia: string; secciones: string[]
  marca: string; tagline: string; layout: Layout; tema: Tema
  // Identidad visual que se nota más allá del home — hoy solo la usa
  // Vidriera (header con el logo centrado y buscador, en vez del layout
  // estándar a la izquierda). Antes esto vivía como un ternario
  // `homeTemplate === 'vidriera'` repetido en cada página del storefront
  // (Catálogo, Categoría, Producto, Carrito...) que además NUNCA llegó a
  // pasarse ahí (solo Inicio.tsx lo tenía) — la tienda con Vidriera
  // aplicada se veía "partida": home con el look de la plantilla, el
  // resto de las páginas con el header por defecto (bug real, reportado
  // con captura). Declararlo acá en vez de hardcodear el id de nuevo hace
  // que una plantilla futura que también quiera esto solo tenga que
  // marcarlo, sin tocar ninguna página — ver headerCentrado() en
  // cliente/inicio/plantillaReal.ts, que es lo que cada página del
  // storefront debería llamar en vez de comparar el id a mano.
  headerCentrado?: boolean
  slides: Slide[]; productos: Producto[]
  // Segunda fila ("Más vendidos"). En las plantillas de muestra no se define
  // y sale de invertir `productos` (con 4 productos de muestra alcanza para
  // que se vea distinta); la tienda real sí la pasa, porque ahí destacados y
  // más vendidos son consultas distintas, no la misma lista al revés.
  productosSecundarios?: Producto[]

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
  // [nombre, imagen] en las plantillas de muestra; la tienda real agrega un
  // tercer elemento con el slug para que el tile navegue a la categoría.
  categorias?: [string, string, string?][]
  cupon?: { titulo: string; bajada: string; codigo: string }
  pie?: { columnas: [string, string[]][]; cierre: string }
}

// ─── Acciones reales (solo storefront) ───────────────────────────────────────
//
// El MISMO `Home()` dibuja el preview del panel y la portada de la tienda
// real. Lo único que las diferencia es esto: el panel no lo pasa (todo queda
// decorativo, como siempre) y la tienda real sí, con navegación y carrito de
// verdad.
//
// Por qué así y no re-implementando cada plantilla en Inicio.tsx: eso es
// justo lo que había antes (ternarios `homeTemplate === 'vidriera'` sueltos
// por todo el archivo) y garantizaba que la tienda quedara "parecida" pero
// nunca idéntica — cada retoque en la plantilla había que copiarlo a mano al
// storefront, y siempre se escapaba alguno. Compartiendo el render, una
// plantilla nueva anda en la tienda sin tocar Inicio.tsx.
export interface AccionesHome {
  irACatalogo: () => void
  irACategoria: (slug: string) => void
  irAProducto: (slug: string) => void
  abrirWhatsapp?: () => void
  // La tarjeta de producto de la tienda real (ProductCard) en vez de la
  // maqueta `Card` de piezas.tsx: la maqueta imita a la real pero no compra
  // nada (sin carrito, sin variantes, sin modo vidriera). El layout —la
  // grilla, si va a sangre, los altos— lo sigue poniendo la plantilla; solo
  // se reemplaza QUÉ se dibuja adentro de cada celda.
  //
  // `opts` es ese layout: son los MISMOS valores con los que la plantilla
  // dibujaría su maqueta `Card` (a sangre o con borde propio, y qué alto de
  // foto). Sin esto la tarjeta real no tenía forma de saberlo y quedaba
  // siempre con el look por defecto de Órbita adentro de una grilla pensada
  // para otra cosa — que es justo lo que se veía: la plantilla ponía la
  // grilla a sangre y adentro seguían las cards redondeadas de siempre.
  renderProducto?: (p: Producto, i: number, opts: { sangre?: boolean; alto: number }) => ReactNode
}

export const sans = (n: string) => `"${n}", system-ui, -apple-system, sans-serif`
export const serif = (n: string) => `"${n}", Georgia, serif`

export const ar = (final: string, antes: string, transfer: string, cuota: string) => ({
  precio: final, antes, transfer: `${transfer} con transferencia`, cuotas: `3 cuotas sin interés de ${cuota}`,
})
