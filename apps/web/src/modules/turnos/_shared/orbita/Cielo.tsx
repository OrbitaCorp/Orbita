// Fondo decorativo de Órbita: estrellas y anillos concéntricos con un satélite.
// Va detrás del contenido de un bloque .tuo-espacio (o de cualquier contenedor
// con position: relative). Es puro adorno: aria-hidden y sin eventos.
import type { CSSProperties } from 'react'

// Posiciones fijas, calculadas una vez al cargar el módulo con un generador
// con semilla: mismas estrellas en servidor y cliente (no hay Math.random en
// render, que además react-compiler prohíbe).
function sembrar(cantidad: number, semilla: number) {
  let s = semilla
  const azar = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
  return Array.from({ length: cantidad }, () => ({
    x: +(azar() * 100).toFixed(2), y: +(azar() * 100).toFixed(2),
    r: +(0.6 + azar() * 1.3).toFixed(2), o: +(0.25 + azar() * 0.6).toFixed(2), d: +(azar() * 6).toFixed(2), t: +(4 + azar() * 5).toFixed(2),
  }))
}
const ESTRELLAS = sembrar(70, 20260926)

export function Estrellas({ cantidad = 46, style }: { cantidad?: number; style?: CSSProperties }) {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: -1, pointerEvents: 'none', ...style }}>
      {ESTRELLAS.slice(0, cantidad).map((e, i) => (
        <span key={i} className="tuo-estrella" style={{
          position: 'absolute', left: `${e.x}%`, top: `${e.y}%`, width: e.r * 2, height: e.r * 2, borderRadius: '50%',
          background: i % 5 === 0 ? '#93C5FD' : '#fff', opacity: e.o, ['--o' as string]: e.o,
          animation: `tuoTitila ${e.t}s ease-in-out ${e.d}s infinite`,
        }} />
      ))}
    </div>
  )
}

/**
 * Anillos de órbita con un satélite dando la vuelta. `lado` lo ancla a una
 * esquina del contenedor para que asome por detrás del contenido.
 */
export function Anillos({ size = 520, lado = 'derecha', opacidad = 1, style }: { size?: number; lado?: 'derecha' | 'izquierda' | 'centro'; opacidad?: number; style?: CSSProperties }) {
  const pos: CSSProperties = lado === 'centro'
    ? { left: '50%', top: '50%', marginLeft: -size / 2, marginTop: -size / 2 }
    : lado === 'derecha' ? { right: -size * 0.32, top: -size * 0.3 } : { left: -size * 0.32, bottom: -size * 0.3 }
  return (
    <svg aria-hidden viewBox="0 0 400 400" width={size} height={size} style={{ position: 'absolute', zIndex: -1, pointerEvents: 'none', opacity: opacidad, ...pos, ...style }}>
      <defs>
        <radialGradient id="tuoPlaneta" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="45%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="190" fill="none" stroke="rgba(147,197,253,0.10)" strokeWidth="1" strokeDasharray="2 7" />
      <circle cx="200" cy="200" r="142" fill="none" stroke="rgba(147,197,253,0.16)" strokeWidth="1" />
      <circle cx="200" cy="200" r="94" fill="none" stroke="rgba(147,197,253,0.22)" strokeWidth="1" />
      <circle cx="200" cy="200" r="30" fill="url(#tuoPlaneta)" opacity="0.9" />
      <circle cx="200" cy="200" r="46" fill="#3B82F6" opacity="0.10" />
      <g className="tuo-gira" style={{ transformOrigin: '200px 200px', animation: 'tuoGira 38s linear infinite' }}>
        <circle cx="200" cy="58" r="4.5" fill="#BFDBFE" />
        <circle cx="200" cy="58" r="10" fill="#93C5FD" opacity="0.22" />
      </g>
      <g className="tuo-gira" style={{ transformOrigin: '200px 200px', animation: 'tuoGira 24s linear infinite reverse' }}>
        <circle cx="294" cy="200" r="3.5" fill="#A5B4FC" />
      </g>
    </svg>
  )
}
