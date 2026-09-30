// ─── OrbiIcon ────────────────────────────────────────────────────────────────
// Logo de Orbi: la estrella "5a · Facetada" del diseño (Orbi Icono v5) — plata
// azulada con facetas de luz y sombra por cuadrante, sombra proyectada suave y
// un satélite azul que da la vuelta alrededor. Es un dibujo a colores fijos:
// está pensado para fondo oscuro, por eso `disc` lo pone sobre un disco navy
// (el de las tarjetas del diseño) para que se lea igual en tema claro y oscuro.
//
// `animated` prende el giro del satélite y el latido de la estrella (SMIL). Con
// `prefers-reduced-motion` queda congelado en un cuadro, y apagado directamente
// deja el satélite quieto.

import { useEffect, useId, useRef } from 'react'

const ESTRELLA = 'M50 6Q51.7 48.3 94 50Q51.7 51.7 50 94Q48.3 51.7 6 50Q48.3 48.3 50 6Z'
const NUCLEO = 'M50 27Q50.9 49.1 73 50Q50.9 50.9 50 73Q49.1 50.9 27 50Q49.1 49.1 50 27Z'
const ORBITA = 'M93 50A43 15 0 0 1 7 50A43 15 0 0 1 93 50'

export function OrbiIcon({ size = 24, animated = true, disc = false }: {
  size?: number
  animated?: boolean
  /** Dibuja el logo sobre un disco navy, para usarlo solo (sin chip propio). */
  disc?: boolean
}) {
  // useId trae ":" — válido en ids pero incómodo dentro de url(#…), así que se limpia.
  const uid = useId().replace(/:/g, '')
  const id = (n: string) => `${uid}-${n}`
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = ref.current
    if (!animated || !svg || typeof window.matchMedia !== 'function') return
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    svg.setCurrentTime(1.5)
    svg.pauseAnimations()
  }, [animated])

  return (
    <svg ref={ref} viewBox="0 0 100 100" aria-hidden="true" focusable="false" style={{ width: size, height: size, display: 'block', flexShrink: 0 }}>
      <defs>
        <filter id={id('sh')} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" /></filter>
        <radialGradient id={id('blm')}><stop offset="0" stopColor="#a9c2f0" /><stop offset=".5" stopColor="#5f8ae0" /><stop offset="1" stopColor="#3a5cb8" /></radialGradient>
        <radialGradient id={id('glm')}><stop offset="0" stopColor="#5f8ae0" stopOpacity=".5" /><stop offset="1" stopColor="#5f8ae0" stopOpacity="0" /></radialGradient>
        <clipPath id={id('c2')}><polygon points="50,0 100,0 100,100 50,100" /></clipPath>
        <clipPath id={id('c3')}><polygon points="0,50 100,50 100,100 0,100" /></clipPath>
      </defs>

      {disc && <circle cx="50" cy="50" r="50" fill="#0a0e1a" />}

      {/* Satélite, tramo de atrás (detrás de la estrella) */}
      {animated && (
        <g transform="rotate(-25 50 50)">
          <path d="M7 50A43 15 0 0 1 93 50" fill="none" stroke="#b8c4e6" strokeWidth="1.2" opacity=".28" />
          <g>
            <circle r="8" fill={`url(#${id('glm')})`} />
            <circle r="3.2" fill={`url(#${id('blm')})`} />
            <animateMotion dur="6s" repeatCount="indefinite" path={ORBITA} />
            <animate attributeName="opacity" values="0;1" keyTimes="0;0.5" calcMode="discrete" dur="6s" repeatCount="indefinite" />
          </g>
        </g>
      )}

      {/* Sombra proyectada */}
      <path d={ESTRELLA} transform="translate(1.5 2.5)" fill="#000" opacity=".5" filter={`url(#${id('sh')})`} />

      {/* Estrella facetada */}
      <g transform="translate(50 50)">
        <g>
          {animated && <animateTransform attributeName="transform" type="scale" values="1;1.04;1" dur="4s" repeatCount="indefinite" />}
          <g transform="translate(-50 -50)">
            <path d={ESTRELLA} fill="#c3cdea" />
            <g clipPath={`url(#${id('c2')})`}><path d={ESTRELLA} fill="#7383b8" opacity=".3" /></g>
            <g clipPath={`url(#${id('c3')})`}><path d={ESTRELLA} fill="#2b3563" opacity=".3" /></g>
            <g transform="rotate(45 50 50)" opacity=".4"><path d={NUCLEO} fill="#eef2ff" /></g>
            <circle cx="50" cy="50" r="2.2" fill="#5f8ae0">
              {animated && <animate attributeName="opacity" values=".55;1;.55" dur="4s" repeatCount="indefinite" />}
            </circle>
          </g>
        </g>
      </g>

      {/* Satélite, tramo de adelante (delante de la estrella) */}
      <g transform="rotate(-25 50 50)">
        <path d="M7 50A43 15 0 0 0 93 50" fill="none" stroke="#b8c4e6" strokeWidth="1.6" opacity=".8" />
        <g transform={animated ? undefined : 'translate(74 62.5)'}>
          <circle r="9" fill={`url(#${id('glm')})`} />
          <circle r="4.2" fill={`url(#${id('blm')})`} />
          <circle cx="-1.2" cy="-1.3" r="1.1" fill="#dfe8ff" opacity=".7" />
          {animated && (
            <>
              <animateMotion dur="6s" repeatCount="indefinite" path={ORBITA} />
              <animate attributeName="opacity" values="1;0" keyTimes="0;0.5" calcMode="discrete" dur="6s" repeatCount="indefinite" />
            </>
          )}
        </g>
      </g>
    </svg>
  )
}
