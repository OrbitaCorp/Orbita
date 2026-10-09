import { fmtMoney } from '@/lib/utils'

// Texto que se propone al publicar un producto en Instagram: nombre, un pedazo de la descripción, el
// precio y a dónde comprar. Es un punto de partida: el dueño lo edita antes de publicar.

/** Máximo de caracteres de un texto de Instagram. */
export const MAX_TEXTO_INSTAGRAM = 2200
const MAX_DESCRIPCION = 220

export function urlDelProducto(subdominio: string | null, productId: string): string | null {
  return subdominio ? `https://${subdominio}.orbita.site/producto/${productId}` : null
}

export function textoSugerido(
  producto: { name: string; description: string | null; basePrice: number },
  urlProducto: string | null,
): string {
  const partes = [producto.name.trim()]
  const descripcion = (producto.description ?? '').replace(/\s+/g, ' ').trim()
  if (descripcion) {
    partes.push(descripcion.length > MAX_DESCRIPCION ? `${descripcion.slice(0, MAX_DESCRIPCION - 1).trimEnd()}…` : descripcion)
  }
  if (producto.basePrice > 0) partes.push(`Precio: ${fmtMoney(producto.basePrice)}`)
  if (urlProducto) partes.push(`Comprá en ${urlProducto}`)
  return partes.join('\n\n').slice(0, MAX_TEXTO_INSTAGRAM)
}
