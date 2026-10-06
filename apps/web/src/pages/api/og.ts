import type { NextApiRequest, NextApiResponse } from 'next'
import sharp from 'sharp'
import { OG_ALTO, OG_ANCHO, OG_MAX_BYTES, urlDeFotoPermitida } from '@/lib/storefront/og'

// GET /api/og?u=<url de la foto>
//
// La foto de un producto (o el logo de la tienda) como JPEG de 1200×630: el
// tamaño y el formato que esperan WhatsApp, Instagram, Facebook y X para el
// preview de un link. Las fotos del catálogo se guardan en webp y no todos los
// rastreadores de previews lo leen; además suelen ser verticales, y un preview
// es apaisado. La foto va entera, centrada, sobre su propio fondo desenfocado
// (no recortada ni con franjas lisas).
//
// Se sirve desde el mismo dominio que la tienda (subdominio o dominio propio):
// el middleware deja pasar /api sin tocarlo. El resultado es el mismo para la
// misma URL, así que el CDN lo guarda y la conversión corre una sola vez.

export const config = { api: { responseLimit: false } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return res.status(405).end()
  }

  const url = urlDeFotoPermitida(req.query.u)
  if (!url) return res.status(400).send('Imagen no permitida')

  let original: Buffer
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!r.ok) return res.status(404).send('No se encontró la imagen')
    const largo = Number(r.headers.get('content-length') ?? 0)
    if (largo > OG_MAX_BYTES) return res.status(413).send('Imagen demasiado grande')
    original = Buffer.from(await r.arrayBuffer())
    if (original.length > OG_MAX_BYTES) return res.status(413).send('Imagen demasiado grande')
  } catch {
    return res.status(502).send('No se pudo traer la imagen')
  }

  try {
    // `rotate()` sin argumentos respeta la orientación de la foto (EXIF); `flatten`
    // pone fondo blanco a las imágenes con transparencia (un producto sin fondo).
    const base = sharp(original, { failOn: 'none' }).rotate().flatten({ background: '#ffffff' })
    const [fondo, frente] = await Promise.all([
      base.clone().resize(OG_ANCHO, OG_ALTO, { fit: 'cover' }).blur(28).modulate({ brightness: 0.9 }).toBuffer(),
      base.clone().resize(OG_ANCHO, OG_ALTO, { fit: 'inside' }).toBuffer(),
    ])
    const jpeg = await sharp(fondo)
      .composite([{ input: frente, gravity: 'center' }])
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()

    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Content-Length', String(jpeg.length))
    // El navegador una hora, el CDN una semana; si la foto cambia, la URL de la foto cambia.
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400')
    return res.status(200).send(jpeg)
  } catch {
    return res.status(422).send('No se pudo procesar la imagen')
  }
}
