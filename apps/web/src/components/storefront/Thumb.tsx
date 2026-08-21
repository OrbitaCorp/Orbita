import { thumbGradient } from '@/lib/storefront/utils'

type Props = {
  hue:    number
  size?:  number
  radius?: number
  style?: React.CSSProperties
}

export function Thumb({ hue, size = 80, radius = 10, style }: Props) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: thumbGradient(hue),
      ...style,
    }} />
  )
}

type ProdImageProps = {
  hue:     number
  imgUrl?: string | null
  height?: number
  radius?: number
  style?:  React.CSSProperties
  children?: React.ReactNode
}

export function ProdImage({ hue, imgUrl, height = 280, radius = 14, style, children }: ProdImageProps) {
  // El gradiente rayado es placeholder — solo tiene sentido SIN foto real.
  // Antes se pintaba siempre, así que un PNG con transparencia (fondo
  // recortado) dejaba ver las rayas de color por detrás/alrededor del
  // producto en vez de quedar limpio.
  //
  // `object-fit: contain` (antes `cover`) + fondo neutro (antes
  // transparente) — cada negocio sube sus fotos con su propio recorte y
  // proporción, sin ningún estándar entre productos: una puede venir
  // recortada al pixel, otra con un margen enorme alrededor. Con `cover` esa
  // diferencia se notaba MUCHO — el producto con margen quedaba minúsculo y
  // "flotando" en el medio de la card mientras el otro llenaba el cuadro
  // entero, dos tamaños de card que en los hechos parecían distintos aunque
  // el contenedor mida exactamente lo mismo (ver Catalogo.tsx/ProductCard.tsx,
  // siempre un height fijo). `contain` nunca recorta la foto (se ve completa
  // siempre, sea cual sea su proporción) y el fondo parejo + un margen
  // interno chico (`inset`, no pegado al borde) hacen que todas las cards
  // lean con el mismo "aire" alrededor del producto — mismo criterio que
  // usan MercadoLibre/Amazon para catálogos con fotos de muchos vendedores
  // distintos, exactamente este problema.
  return (
    <div style={{
      width: '100%', height, borderRadius: radius, position: 'relative', overflow: 'hidden',
      background: imgUrl ? 'var(--color-surface)' : thumbGradient(hue),
      ...style,
    }}>
      {imgUrl && (
        <img
          src={imgUrl}
          alt=""
          style={{ position: 'absolute', inset: '6%', width: '88%', height: '88%', objectFit: 'contain' }}
        />
      )}
      {children}
    </div>
  )
}
