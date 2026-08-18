// ─── OrbitaLogo ──────────────────────────────────────────────────────────────
// El logo de Órbita de verdad: el planeta con su anillo y el satélite dando
// la vuelta — el mismo dibujo de la pantalla de carga, que es la identidad
// original de la marca. Antes cada pantalla tenía su propio logo estático y
// distinto (un circulito recortado en el login, un cuadradito azul en el
// sidebar) y ninguno se parecía al de verdad.
//
// `animated` viene prendido: el satélite gira suave. Se puede apagar donde el
// movimiento moleste (impresiones, emails renderizados a imagen, etc.).

import type { CSSProperties } from 'react'

export function OrbitaLogo({ size = 40, animated = true, style }: { size?: number; animated?: boolean; style?: CSSProperties }) {
  const anillo = Math.max(1, Math.round(size * 0.035))
  const sat = Math.max(5, Math.round(size * 0.17))
  return (
    <span aria-hidden="true" style={{ position: 'relative', width: size, height: size, display: 'inline-block', flexShrink: 0, ...style }}>
      <style>{`@keyframes orbitaLogoSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      {/* Anillo de la órbita */}
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `${anillo}px solid rgba(59,130,246,0.4)`, boxSizing: 'border-box' }} />
      {/* Planeta */}
      <span style={{
        position: 'absolute', left: '50%', top: '50%',
        width: size * 0.34, height: size * 0.34, borderRadius: '50%',
        background: 'var(--color-primary, #3b82f6)', transform: 'translate(-50%,-50%)',
        boxShadow: `0 0 ${Math.round(size * 0.3)}px rgba(59,130,246,0.45)`,
      }} />
      {/* Satélite en órbita */}
      <span style={{ position: 'absolute', inset: 0, animation: animated ? 'orbitaLogoSpin 3.2s linear infinite' : undefined }}>
        <span style={{
          position: 'absolute', top: -Math.round(sat / 2 - anillo / 2), left: '50%',
          width: sat, height: sat, borderRadius: '50%',
          background: '#93c5fd', transform: 'translateX(-50%)',
          boxShadow: '0 0 8px rgba(147,197,253,0.8)',
        }} />
      </span>
    </span>
  )
}
