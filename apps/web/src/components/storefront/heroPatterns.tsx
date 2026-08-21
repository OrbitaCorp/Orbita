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
  | 'bubbles' | 'sparkle' | 'orbit'
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

// @keyframes de los 3 patrones animados (burbujas/destellos/órbita) — no se
// pueden expresar como objeto de style inline, así que van en un <style> que
// cada uno de esos 3 casos inyecta junto a sus elementos. Repetirlo en cada
// slide que use un patrón animado es inofensivo (mismo nombre, misma regla,
// el navegador solo la aplica una vez) — no hay estado global para "ya lo
// inyecté una vez" entre Inicio.tsx y StorePreview.tsx. Respeta
// prefers-reduced-motion apagando la animación (no el patrón entero).
const HERO_ANIM_KEYFRAMES = `
@keyframes heroBubbleA { 0% { transform: translate(0,0) scale(1); opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { transform: translate(40px,-300px) scale(1.05); opacity: 0; } }
@keyframes heroBubbleB { 0% { transform: translate(0,0) scale(1); opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { transform: translate(-90px,-220px) scale(0.94); opacity: 0; } }
@keyframes heroBubbleC { 0% { transform: translate(0,0) scale(1); opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { transform: translate(150px,-50px) scale(1.08); opacity: 0; } }
@keyframes heroBubbleD { 0% { transform: translate(0,0) scale(1); opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { transform: translate(-70px,200px) scale(0.9); opacity: 0; } }
@keyframes heroBubbleE { 0% { transform: translate(0,0) scale(1); opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { transform: translate(170px,140px) scale(1); opacity: 0; } }
@keyframes heroSparkleTwinkle {
  0%, 100% { opacity: 0.15; transform: scale(0.6); }
  50%      { opacity: 1; transform: scale(1.15); }
}
@keyframes heroOrbitSpin {
  from { transform: translate(-50%,-50%) rotate(0deg); }
  to   { transform: translate(-50%,-50%) rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .hero-anim-bubble, .hero-anim-spark, .hero-anim-orbit { animation: none !important; }
}
`

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
    case 'bubbles': {
      // [leftPct, topPct, size, duración(s), delay(s), keyframe] — fijos (no
      // random) por el mismo motivo que 'confetti': el slide tiene que verse
      // igual en cada render. El pedido puntual era "círculos de diferentes
      // tamaños moviéndose en diferentes direcciones" — no todas iguales
      // subiendo derecho: cada una usa uno de 5 recorridos (arriba-derecha,
      // arriba-izquierda, deriva lateral, abajo-izquierda, abajo-derecha) y
      // el tamaño va de 9px a 30px.
      const bubbles: [number, number, number, number, number, string][] = [
        [8, 70, 26, 11, 0, 'heroBubbleA'], [20, 30, 14, 9, 1.4, 'heroBubbleB'],
        [34, 80, 30, 13, 0.6, 'heroBubbleD'], [46, 15, 10, 8, 2.2, 'heroBubbleC'],
        [58, 55, 22, 10, 1.0, 'heroBubbleE'], [70, 25, 12, 9, 2.6, 'heroBubbleA'],
        [82, 65, 18, 12, 0.3, 'heroBubbleB'], [92, 40, 9, 7, 1.8, 'heroBubbleC'],
      ]
      return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', ...(focused ? focusMask(cx) : {}) }}>
          <style>{HERO_ANIM_KEYFRAMES}</style>
          {bubbles.map(([left, top, size, dur, delay, anim], i) => (
            <span key={i} className="hero-anim-bubble" style={{
              position: 'absolute', left: `${left}%`, top: `${top}%`, width: size, height: size,
              borderRadius: '50%', background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.30)',
              animation: `${anim} ${dur}s ease-in-out ${delay}s infinite`,
            }} />
          ))}
        </div>
      )
    }
    case 'sparkle': {
      const sparks: [number, number, number, number][] = [
        [12, 18, 2.2, 0], [28, 62, 2.6, 0.6], [42, 24, 2.0, 1.2], [58, 70, 2.8, 0.3],
        [72, 30, 2.4, 1.6], [86, 58, 2.2, 0.9], [20, 84, 2.6, 1.9], [64, 10, 2.0, 0.4],
      ]
      return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...(focused ? focusMask(cx) : {}) }}>
          <style>{HERO_ANIM_KEYFRAMES}</style>
          {sparks.map(([x, y, dur, delay], i) => (
            <svg key={i} className="hero-anim-spark" style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, animation: `heroSparkleTwinkle ${dur}s ease-in-out ${delay}s infinite` }} width="10" height="10" viewBox="0 0 10 10">
              <path d="M5 0l1.2 3.8L10 5l-3.8 1.2L5 10l-1.2-3.8L0 5l3.8-1.2z" fill="rgba(255,255,255,0.55)" />
            </svg>
          ))}
        </div>
      )
    }
    case 'orbit': {
      const size = focused ? 380 : 620
      const left = focused ? cx : 50
      return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <style>{HERO_ANIM_KEYFRAMES}</style>
          <svg className="hero-anim-orbit" style={{ position: 'absolute', top: '50%', left: `${left}%`, transform: 'translate(-50%,-50%)', animation: 'heroOrbitSpin 22s linear infinite' }} width={size} height={size} viewBox="0 0 440 440">
            <circle cx="220" cy="220" r="200" fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="1.5" strokeDasharray="4 10" />
            <circle cx="220" cy="220" r="150" fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="1.5" strokeDasharray="3 8" />
            <circle cx="420" cy="220" r="5" fill="rgba(255,255,255,0.55)" />
          </svg>
        </div>
      )
    }
    default:
      return null
  }
}
