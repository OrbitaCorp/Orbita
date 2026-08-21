// Capa decorativa detrás del hero en modo "imagen centrada" — compartida entre
// el storefront real (Inicio.tsx) y la vista previa de Apariencia
// (StorePreview.tsx) para que ambos rendericen exactamente lo mismo.
// Presets 100% CSS/SVG, sin assets nuevos.
//
// Cada patrón tiene un "alcance" (scope, ver BgPatternScope en apariencia.mock):
//  - 'image': el patrón se concentra alrededor de donde está la imagen del
//    slide y sigue su posición (izquierda/centro/derecha) — para que se
//    sienta "atado" a la foto, como un marco decorativo detrás suyo.
//  - 'full':  el patrón cubre el slide entero, parejo, sin importar dónde
//    esté la imagen — un fondo de marca, no un marco para la foto.
// Antes los 4 patrones originales estaban fijos "a la derecha" sin importar
// la posición elegida — por eso "Centro" se veía igual que "Derecha".

import type { CSSProperties } from 'react'

export type HeroBgPattern =
  | 'none' | 'rings' | 'dots' | 'waves' | 'diagonal'
  | 'grid' | 'stripes' | 'confetti' | 'halo' | 'arc' | 'plus'
  | string
export type HeroBgPatternScope = 'image' | 'full' | string
export type HeroPatternAnchor = 'left' | 'center' | 'right' | string

export interface HeroPatternOpts {
  scope?: HeroBgPatternScope
  anchor?: HeroPatternAnchor
}

// `anchor` llega como string suelto desde la config guardada (puede ser un
// valor viejo/desconocido) — 'left'/'right' se resuelven explícito, todo lo
// demás (incluido 'center') cae al centro.
function anchorX(anchor: HeroPatternAnchor | undefined): number {
  return anchor === 'left' ? 25 : anchor === 'right' ? 75 : 50
}

// Máscara radial que concentra un patrón "tileado" (puntos, cuadrícula,
// rayas, confeti, cruces) alrededor del punto donde está la imagen — sin
// esto, un patrón de textura cubre el layer entero sin importar el scope.
function focusMask(cx: number): CSSProperties {
  const g = `radial-gradient(ellipse 42% 62% at ${cx}% 50%, black 35%, transparent 82%)`
  return { maskImage: g, WebkitMaskImage: g }
}

export function renderHeroBgPattern(pattern: HeroBgPattern | undefined, opts: HeroPatternOpts = {}) {
  const scope = opts.scope ?? 'image'
  const focused = scope === 'image'
  const cx = anchorX(opts.anchor ?? 'center')

  switch (pattern) {
    case 'rings': {
      const size = focused ? 380 : 620
      const left = focused ? cx : 50
      return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <svg style={{ position: 'absolute', top: '50%', left: `${left}%`, transform: 'translate(-50%,-50%)' }} width={size} height={size} viewBox="0 0 440 440">
            <circle cx="220" cy="220" r="200" fill="none" stroke="rgba(255,255,255,0.26)" strokeWidth="1.5" />
            <circle cx="220" cy="220" r="150" fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="1.5" />
            <circle cx="220" cy="220" r="100" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" />
          </svg>
        </div>
      )
    }
    case 'dots':
      return (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.22) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          ...(focused ? focusMask(cx) : {}),
        }} />
      )
    case 'grid':
      return (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
          ...(focused ? focusMask(cx) : {}),
        }} />
      )
    case 'stripes':
      return (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.18) 0 2px, transparent 2px 18px)',
          ...(focused ? focusMask(cx) : {}),
        }} />
      )
    case 'confetti': {
      // Posiciones fijas (no random): el mismo slide tiene que verse igual
      // en cada render, no un patrón que "titile" al re-renderizar.
      const shapes: [number, number, 'circle' | 'square'][] = [
        [8, 14, 'circle'], [22, 62, 'square'], [38, 30, 'circle'], [52, 74, 'square'],
        [66, 18, 'circle'], [78, 56, 'square'], [90, 36, 'circle'], [14, 84, 'square'],
        [46, 8, 'circle'], [84, 80, 'circle'],
      ]
      return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...(focused ? focusMask(cx) : {}) }}>
          {shapes.map(([x, y, shape], i) => (
            <span key={i} style={{
              position: 'absolute', left: `${x}%`, top: `${y}%`, width: 7, height: 7,
              background: 'rgba(255,255,255,0.32)', borderRadius: shape === 'circle' ? '50%' : 2,
              transform: shape === 'square' ? 'rotate(20deg)' : undefined,
            }} />
          ))}
        </div>
      )
    }
    case 'plus': {
      const marks: [number, number][] = [[10, 20], [26, 60], [42, 12], [58, 68], [74, 24], [88, 58], [18, 84], [64, 86]]
      return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...(focused ? focusMask(cx) : {}) }}>
          {marks.map(([x, y], i) => (
            <svg key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%` }} width="12" height="12" viewBox="0 0 12 12">
              <path d="M6 0v12M0 6h12" stroke="rgba(255,255,255,0.30)" strokeWidth="1.4" />
            </svg>
          ))}
        </div>
      )
    }
    case 'waves': {
      const a = focused ? cx : 32
      const b = focused ? cx : 68
      return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-10%', left: `${a}%`, transform: 'translateX(-50%)', width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', filter: 'blur(70px)' }} />
          <div style={{ position: 'absolute', bottom: '-15%', left: `${b}%`, transform: 'translateX(-50%)', width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', filter: 'blur(60px)' }} />
        </div>
      )
    }
    case 'halo': {
      const left = focused ? cx : 50
      const size = focused ? 460 : 760
      return (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(${size}px ${size}px at ${left}% 50%, rgba(255,255,255,0.20), transparent 68%)`,
        }} />
      )
    }
    case 'arc': {
      const left = focused ? cx : 50
      const size = focused ? 420 : 680
      return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <svg style={{ position: 'absolute', top: '50%', left: `${left}%`, transform: 'translate(-50%,-50%)' }} width={size} height={size} viewBox="0 0 200 200">
            <path d="M20 100a80 80 0 0 1 160 0" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
            <path d="M45 100a55 55 0 0 1 110 0" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="2" />
          </svg>
        </div>
      )
    }
    case 'diagonal': {
      const c = focused ? cx : 50
      const w = focused ? 12 : 20
      return (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `linear-gradient(115deg, transparent ${c - w}%, rgba(255,255,255,0.14) ${c - w}%, rgba(255,255,255,0.14) ${c + w}%, transparent ${c + w}%)`,
        }} />
      )
    }
    default:
      return null
  }
}
