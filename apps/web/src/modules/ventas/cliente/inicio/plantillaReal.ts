// Adaptador: datos reales de la tienda → la forma `Plantilla` que entiende el
// render compartido de las plantillas de Home (panel/avanzado/plantillas).
//
// Por qué existe: el preview del panel y la portada de la tienda real dibujan
// el MISMO `Home()` (ver homes.tsx). Antes no era así — Inicio.tsx
// re-implementaba la plantilla con ternarios `homeTemplate === 'vidriera'`
// sueltos, y cada retoque en la plantilla había que copiarlo a mano al
// storefront: siempre se escapaba alguno y la tienda quedaba "parecida" pero
// nunca idéntica (orden de secciones distinto, categorías en carrusel en vez
// de grilla, sin cupón, banner de WhatsApp de otro color...).
//
// Con esto, lo único que cambia entre el preview y la tienda real son los
// datos: las fotos y los productos de verdad. Y una plantilla nueva anda en
// la tienda sin tocar Inicio.tsx.

import type { CSSProperties } from 'react'
import { PLANTILLAS } from '@/modules/ventas/panel/avanzado/plantillas/datos'
import type { Plantilla, Tema, Producto as ProductoPlantilla } from '@/modules/ventas/panel/avanzado/plantillas/tipos'
import type { Producto } from '@/lib/storefront/types'
import { thumbGradient } from '@/lib/storefront/utils'
import type { StorefrontStatsItem } from '@/lib/storefront/api'

type CatReal = { id: string; slug: string; nombre: string; hue: number; imageUrl: string | null }

/** La definición de la plantilla elegida, o null si el id no existe. */
export function definicionPlantilla(id: string | null | undefined): Plantilla | null {
  if (!id) return null
  return PLANTILLAS.find(p => p.id === id) ?? null
}

/**
 * ¿La plantilla activa pide header centrado (logo + buscador al medio, en
 * vez del layout estándar a la izquierda) en TODA la tienda, no solo el
 * home? Antes esto era `homeTemplate === 'vidriera'` copiado a mano en cada
 * página del storefront (Catálogo, Categoría, Producto, Carrito...) — y en
 * los hechos solo estaba en Inicio.tsx, así que la tienda quedaba "partida"
 * entre un home con el look de la plantilla y el resto de las páginas con
 * el header por defecto (bug real, reportado con captura: "si esta en otra
 * vista como por ejemplo la del catálogo, siga aplicando el header de la
 * plantilla"). Cada página del storefront debería llamar a esto (con
 * `config?.appearance?.homeTemplate`) en vez de comparar el id a mano —
 * una plantilla nueva que también lo quiera solo tiene que marcar
 * `headerCentrado: true` en su propia definición (datos.tsx), sin tocar
 * ninguna página.
 *
 * A propósito, SOLO el header — pedido explícito: "solamente quiero que
 * el header cambie... en las otras vistas". El modo "cartelera oscura"
 * del AnnouncementBar sigue atado a este mismo flag únicamente en el home
 * (Inicio.tsx, donde ya vivía desde antes) — el resto de las páginas del
 * storefront NO lo tocan, aunque tengan su propio AnnouncementBar.
 */
export function headerCentrado(homeTemplate: string | null | undefined): boolean {
  return definicionPlantilla(homeTemplate)?.headerCentrado ?? false
}

/**
 * El tema de la plantilla, traducido a las variables CSS del storefront.
 *
 * Por qué hace falta: hasta acá la plantilla pintaba SUS secciones con
 * `tema.*` inline, pero todo lo demás del home —header, cartel, hero, footer,
 * badges, botones— seguía leyendo las variables de Apariencia. Con Vidriera no
 * se notaba (es clara y neutra, como la mayoría de las tiendas), pero una
 * plantilla oscura quedaba con el cuerpo oscuro y el header blanco. Aplicando
 * esto en el nodo que envuelve el home, la plantilla manda sobre TODO lo de
 * adentro sin tocar un solo componente: heredan las variables y listo.
 *
 * Se aplica en un div del home, no en `:root`: el resto del sitio (catálogo,
 * ficha, carrito, checkout) tiene que seguir con los colores del negocio —
 * la regla de la casa es que una plantilla cambia la PORTADA, nada más.
 *
 * `--color-body` y `--color-subtle` no tienen equivalente propio en el tema
 * (que solo distingue texto/apagado), así que se mapean al par más cercano en
 * vez de inventar tonos intermedios.
 */
export function variablesDeTema(tema: Tema): CSSProperties {
  return {
    '--color-bg': tema.bg,
    '--color-surface': tema.surf,
    '--color-surface-alt': tema.soft,
    '--color-border': tema.border,
    '--color-border-strong': tema.border,
    '--color-text': tema.text,
    '--color-body': tema.text,
    '--color-muted': tema.muted,
    '--color-subtle': tema.muted,
    '--color-primary': tema.primary,
    // Mismo criterio que _app.tsx para el hover del primario: oscurecerlo en
    // temas claros y aclararlo en los oscuros, en vez de pedirle a cada
    // plantilla un segundo color que hoy no define.
    '--color-primary-h': `color-mix(in srgb, ${tema.primary} ${tema.oscuro ? '75%, white' : '82%, black'})`,
    '--color-primary-bg': `color-mix(in srgb, ${tema.primary} 15%, transparent)`,
    '--color-on-primary': tema.onPrimary,
    '--color-accent': tema.accent,
    '--font-heading': tema.fh,
    '--font-body': tema.fb,
    fontFamily: tema.fb,
  } as CSSProperties
}

// Los productos reales los dibuja la ProductCard de verdad (ver
// `renderProducto` en AccionesHome), así que acá solo hace falta lo mínimo
// para que la plantilla los pueda iterar y clavar una key estable. El resto
// de los campos de `Producto` de la plantilla —precio formateado, cuotas,
// swatches— son de la maqueta del panel y no se usan en la tienda real.
function aProductoPlantilla(p: Producto): ProductoPlantilla {
  // `img` cae al degradé por `hue` (mismo que el resto del storefront) y no a
  // string vacío: con '' el <img> de la maqueta pide la página entera de
  // nuevo por red y deja un recuadro roto. En la tienda real este camino no
  // se usa (la dibuja ProductCard vía `renderProducto`), pero una plantilla
  // futura podría no pasar `renderProducto` y no tiene por qué romperse.
  return { nombre: p.nombre, precio: '', img: p.imgUrl ?? thumbGradient(p.hue), slug: p.id }
}

/**
 * Arma la `Plantilla` con la que la tienda real dibuja su portada.
 *
 * `base` es la plantilla elegida: de ahí sale TODO lo visual (tema, tipografía,
 * radios, sombras). Lo que se reemplaza es solo el contenido.
 */
export function plantillaReal({
  base, productos, destacados, masVendidos, categorias, stats, cupon,
}: {
  base: Plantilla
  productos: Producto[]
  destacados: Producto[]
  masVendidos: Producto[]
  categorias: CatReal[]
  stats: StorefrontStatsItem[]
  cupon?: { titulo: string; bajada: string; codigo: string } | null
}): Plantilla {
  // La plantilla muestra las categorías como tiles fotográficos — de dónde
  // sale esa foto, en orden de prioridad:
  //   1. La imagen propia de la categoría (Categorias.tsx → campo "Imagen",
  //      RBT-604): es la que el dueño eligió a propósito PARA esto, así que
  //      manda sobre cualquier otra cosa si está cargada.
  //   2. Sin imagen propia, la foto del primer producto de esa categoría —
  //      sigue siendo una foto real de lo que hay adentro, que es lo que el
  //      tile promete.
  //   3. Sin ninguna de las dos, el MISMO degradé por `hue` que el resto del
  //      storefront usa para lo que no tiene foto — no se descarta la
  //      categoría. Descartarla dejaba a una tienda recién armada (sin fotos
  //      cargadas) sin la sección entera, y ahí deja de ser una réplica de
  //      la plantilla.
  const fotoDeCategoria = (c: CatReal): string | null =>
    c.imageUrl ?? productos.find(p => p.cat === c.nombre && p.imgUrl)?.imgUrl ?? null

  const cats = categorias
    .slice(0, 4) // la grilla de la plantilla es de 4
    .map(c => [c.nombre, fotoDeCategoria(c) ?? thumbGradient(c.hue), c.slug] as [string, string, string])

  return {
    ...base,
    // Barra de confianza: los stats reales del negocio (Apariencia → statsBar),
    // con el mismo par [fuerte, apagado] que usa la plantilla.
    confianza: stats.map(s => [s.value, s.label] as [string, string]),
    categorias: cats,
    // Sin código no hay cupón. El panel ya manda null al vaciarlo, pero un
    // negocio que lo guardó antes de esa validación podría traer strings
    // vacíos — y ahí el home dibujaría el bloque oscuro con la caja punteada
    // en blanco, que se ve peor que no tener cupón.
    cupon: cupon?.codigo?.trim() ? cupon : undefined,
    productos: destacados.map(aProductoPlantilla),
    productosSecundarios: masVendidos.map(aProductoPlantilla),
  }
}
