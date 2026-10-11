import { fmtMoney } from '@/lib/utils'

// Texto que se propone al publicar un producto en Instagram: nombre, un pedazo de la descripción, el precio, un
// cierre que manda al link de la bio y hashtags. Es un punto de partida: el dueño lo edita antes de publicar.

/** Máximo de caracteres de un texto de Instagram. */
export const MAX_TEXTO_INSTAGRAM = 2200
const MAX_DESCRIPCION = 220
const MAX_HASHTAGS = 6
// Instagram no vuelve tocables los enlaces del texto: en vez de pegar uno, se manda a la gente al link de la bio.
export const CIERRE = 'Comprá desde el link de mi bio.'

/**
 * Link corto de la ficha del producto, sin "https://" (`/p/<código>` en la tienda lo redirige a la ficha). Ya no se
 * pone en el texto sugerido, pero sirve para otros lados (mensajes directos, anuncios).
 */
export function urlDelProducto(subdominio: string | null, productId: string): string | null {
  return subdominio ? `${subdominio}.orbita.site/p/${productId.slice(0, 8)}` : null
}

// Palabras que no sirven de hashtag (artículos, preposiciones y medidas sueltas).
const VACIAS = new Set([
  'para', 'con', 'sin', 'del', 'los', 'las', 'una', 'uno', 'unos', 'unas', 'por', 'como', 'este', 'esta', 'esto',
  'pack', 'set', 'kit', 'combo', 'nuevo', 'nueva', 'oferta', 'promo',
])

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** "Remera de Lino Premium" → "remeradelinopremium": minúsculas, sin tildes ni símbolos. */
function aEtiqueta(t: string): string {
  return sinTildes(t).toLowerCase().replace(/[^a-z0-9ñ]/g, '')
}

/**
 * Hashtags del producto, sin repetidos y sin el #: las palabras con sentido de su nombre, su categoría y el nombre
 * de la tienda. Pocos y relevantes: más de 6 le restan más que lo que suman.
 */
export function hashtagsDelProducto(
  producto: { name: string; categoryName?: string | null },
  tienda?: string | null,
): string[] {
  const salida: string[] = []
  const agregar = (h: string) => {
    if (h.length >= 3 && h.length <= 30 && !salida.includes(h) && salida.length < MAX_HASHTAGS) salida.push(h)
  }
  const palabras = producto.name
    .split(/[\s/,.\-–—|+()]+/)
    .map(aEtiqueta)
    .filter((p) => p.length >= 4 && !VACIAS.has(p) && !/^\d+$/.test(p))
  palabras.slice(0, 3).forEach(agregar)
  // El nombre completo pegado también es una etiqueta propia del producto, si no es larguísimo.
  const completo = aEtiqueta(producto.name)
  if (palabras.length > 1 && completo.length <= 24) agregar(completo)
  if (producto.categoryName) agregar(aEtiqueta(producto.categoryName))
  if (tienda) agregar(aEtiqueta(tienda))
  return salida
}

export function textoSugerido(
  producto: { name: string; description: string | null; basePrice: number; categoryName?: string | null },
  tienda?: string | null,
): string {
  const partes = [producto.name.trim()]
  const descripcion = (producto.description ?? '').replace(/\s+/g, ' ').trim()
  if (descripcion) {
    partes.push(descripcion.length > MAX_DESCRIPCION ? `${descripcion.slice(0, MAX_DESCRIPCION - 1).trimEnd()}…` : descripcion)
  }
  if (producto.basePrice > 0) partes.push(`Precio: ${fmtMoney(producto.basePrice)}`)
  partes.push(CIERRE)
  const etiquetas = hashtagsDelProducto(producto, tienda).map((h) => `#${h}`).join(' ')
  if (etiquetas) partes.push(etiquetas)
  return partes.join('\n\n').slice(0, MAX_TEXTO_INSTAGRAM)
}
