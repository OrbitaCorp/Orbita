// La imagen que se ve al compartir un link de la tienda (WhatsApp, Instagram,
// Facebook, X): ver pages/api/og.ts. Esto es la parte pura, para poder probarla.

/** Tamaño estándar del preview de un link, el que usan todas las redes. */
export const OG_ANCHO = 1200
export const OG_ALTO = 630
/** Más que esto no se procesa: una foto de catálogo pesa una fracción. */
export const OG_MAX_BYTES = 8 * 1024 * 1024

/**
 * La URL de la foto, si es una que /api/og puede traer: una imagen pública del
 * almacenamiento de Órbita (Supabase Storage). Cualquier otra cosa se rechaza
 * — si no, esta ruta sería un proxy abierto para pedirle imágenes a cualquier
 * servidor, incluidos los internos.
 */
export function urlDeFotoPermitida(crudo: string | string[] | undefined): URL | null {
  const valor = Array.isArray(crudo) ? crudo[0] : crudo
  if (!valor || valor.length > 2048) return null
  let url: URL
  try {
    url = new URL(valor)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  if (url.username || url.password || url.port) return null
  if (!url.hostname.endsWith('.supabase.co')) return null
  if (!url.pathname.startsWith('/storage/v1/object/public/')) return null
  return url
}
