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
  return (
    <div style={{
      width: '100%', height, borderRadius: radius, position: 'relative', overflow: 'hidden',
      ...(imgUrl ? {} : { background: thumbGradient(hue) }),
      ...style,
    }}>
      {imgUrl && (
        <img
          src={imgUrl}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {children}
    </div>
  )
}
