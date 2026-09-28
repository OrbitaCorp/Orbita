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
  className?: string
  style?:  React.CSSProperties
  children?: React.ReactNode
}

export function ProdImage({ hue, imgUrl, height = 280, radius = 14, className, style, children }: ProdImageProps) {
  // El gradiente rayado es placeholder — solo tiene sentido SIN foto real.
  // Antes se pintaba siempre, así que un PNG con transparencia (fondo
  // recortado) dejaba ver las rayas de color por detrás/alrededor del
  // producto en vez de quedar limpio.
  //
  // Siempre `object-fit: contain` — nunca recorta la foto (se ve completa,
  // sea cual sea su proporción o la del contenedor). Se probó `cover` para
  // la foto principal y miniaturas de la ficha (ProductoDetalle.tsx) creyendo
  // que las fotos con fondo generado por IA tenían margen de sobra para
  // bancarse el recorte sin riesgo — en la práctica igual comía mangas y
  // bordes de la prenda en contenedores no cuadrados (alto fijo, ancho
  // variable), así que se sacó `cover` del todo: ninguna foto de producto
  // (con o sin fondo IA) debería recortarse nunca. El fondo parejo + un
  // margen interno chico (`inset`, no pegado al borde) hacen que todas las
  // cards lean con el mismo "aire" alrededor del producto — mismo criterio
  // que usan MercadoLibre/Amazon para catálogos con fotos de muchos
  // vendedores distintos.
  return (
    <div className={className} style={{
      width: '100%', height, borderRadius: radius, position: 'relative', overflow: 'hidden',
      background: imgUrl ? 'var(--color-surface)' : thumbGradient(hue),
      ...style,
    }}>
      {imgUrl && (
        <img
          src={imgUrl}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ position: 'absolute', inset: '6%', width: '88%', height: '88%', objectFit: 'contain' }}
        />
      )}
      {children}
    </div>
  )
}
