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

import { PLANTILLAS } from '@/modules/ventas/panel/avanzado/plantillas/datos'
import type { Plantilla, Producto as ProductoPlantilla } from '@/modules/ventas/panel/avanzado/plantillas/tipos'
import type { Producto } from '@/lib/storefront/types'
import type { StorefrontStatsItem } from '@/lib/storefront/api'

type CatReal = { id: string; slug: string; nombre: string }

/** La definición de la plantilla elegida, o null si el id no existe. */
export function definicionPlantilla(id: string | null | undefined): Plantilla | null {
  if (!id) return null
  return PLANTILLAS.find(p => p.id === id) ?? null
}

// Los productos reales los dibuja la ProductCard de verdad (ver
// `renderProducto` en AccionesHome), así que acá solo hace falta lo mínimo
// para que la plantilla los pueda iterar y clavar una key estable. El resto
// de los campos de `Producto` de la plantilla —precio formateado, cuotas,
// swatches— son de la maqueta del panel y no se usan en la tienda real.
function aProductoPlantilla(p: Producto): ProductoPlantilla {
  return { nombre: p.nombre, precio: '', img: p.imgUrl ?? '', slug: p.id }
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
  // Las categorías reales no tienen foto propia (en el panel se eligen ícono y
  // color, ver Categorias.tsx), pero la plantilla las muestra como tiles
  // fotográficos. Se usa la foto del primer producto de esa categoría: es una
  // foto real de lo que hay adentro, que es justo lo que el tile promete.
  // Sin fotos cargadas la categoría se saltea — mejor mostrar menos tiles que
  // uno vacío.
  const fotoDeCategoria = (nombre: string): string | null =>
    productos.find(p => p.cat === nombre && p.imgUrl)?.imgUrl ?? null

  const cats = categorias
    .map(c => {
      const img = fotoDeCategoria(c.nombre)
      return img ? ([c.nombre, img, c.slug] as [string, string, string]) : null
    })
    .filter((x): x is [string, string, string] => x !== null)
    .slice(0, 4) // la grilla de la plantilla es de 4

  return {
    ...base,
    // Barra de confianza: los stats reales del negocio (Apariencia → statsBar),
    // con el mismo par [fuerte, apagado] que usa la plantilla.
    confianza: stats.map(s => [s.value, s.label] as [string, string]),
    categorias: cats,
    cupon: cupon ?? undefined,
    productos: destacados.map(aProductoPlantilla),
    productosSecundarios: masVendidos.map(aProductoPlantilla),
  }
}
