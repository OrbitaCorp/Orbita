// Piezas chicas del lenguaje de Turnos: cabecera de pantalla, indicador con
// tendencia y llavecita. Todas pintan con las clases tuo- de estilo.tsx.
import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { TrendingDown, TrendingUp } from 'lucide-react'

/** Título de pantalla: rótulo en mono, título en Sora, bajada y acciones. */
export function Cabecera({ rotulo, titulo, bajada, acciones, contador, style }: {
  rotulo?: string; titulo: ReactNode; bajada?: ReactNode; acciones?: ReactNode; contador?: ReactNode; style?: CSSProperties
}) {
  return (
    <header className="tuo-entra" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22, ...style }}>
      <div style={{ minWidth: 0, flex: '1 1 320px' }}>
        {rotulo && <div className="tuo-eyebrow" style={{ marginBottom: 10 }}>{rotulo}</div>}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h1 className="tuo-h1">{titulo}</h1>
          {contador !== undefined && <span className="tuo-num" style={{ fontSize: 14, color: 'var(--color-muted)' }}>{contador}</span>}
        </div>
        {bajada && <p className="tuo-bajada">{bajada}</p>}
      </div>
      {acciones && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>{acciones}</div>}
    </header>
  )
}

/**
 * Línea de tendencia mínima, sin ejes: acompaña al número, no lo reemplaza.
 * La línea va en el tono que no compite (el gris de los textos secundarios) y
 * solo el último punto, el de hoy, lleva el acento. Sin relleno ni degradado.
 * Se achica con la tarjeta (viewBox) sin deformarse.
 */
export function Chispa({ datos, ancho = 96, alto = 32 }: { datos: number[]; ancho?: number; alto?: number }) {
  const max = Math.max(...datos), min = Math.min(...datos)
  const rango = max - min || 1
  const pts = datos.map((d, i) => [4 + (i / (datos.length - 1)) * (ancho - 8), alto - 4 - ((d - min) / rango) * (alto - 8)] as const)
  const linea = pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const [ux, uy] = pts[pts.length - 1]
  return (
    <svg aria-hidden width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} style={{ display: 'block' }}>
      <path d={linea} fill="none" stroke="var(--color-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />
      <circle cx={ux} cy={uy} r={3.5} fill="var(--color-primary)" stroke="var(--color-bg)" strokeWidth={1.5} />
    </svg>
  )
}

/**
 * Indicador del tablero. `bueno` dice hacia dónde es una mejora: en ausencias,
 * bajar es bueno, y el color del cambio se invierte. El ícono va siempre en el
 * acento: el color con significado (subió, bajó) lo lleva el chip del cambio.
 */
export function Indicador({ label, valor, Icon, cambio, bueno = 'sube', nota, tendencia, i = 0 }: {
  label: string; valor: ReactNode; Icon: LucideIcon; cambio?: string; bueno?: 'sube' | 'baja'; nota?: string; tendencia?: number[]; i?: number
}) {
  const sube = cambio ? !cambio.trim().startsWith('-') && !cambio.trim().startsWith('−') : true
  const neutro = !cambio || /^[+−-]?0([.,]0+)?\s*%?$/.test(cambio.trim())
  const ok = neutro ? null : (bueno === 'sube') === sube
  const Flecha = sube ? TrendingUp : TrendingDown
  return (
    <div className="tuo-card tuo-card--pad tuo-entra tuo-ind" style={{ ['--i' as string]: i, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="tuo-ind-ico"><Icon size={17} strokeWidth={1.8} /></span>
        <span className="tuo-rotulo" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </div>
      <div className="tuo-ind-fila">
        <span className="tuo-ind-valor">{valor}</span>
        {tendencia && <span className="tuo-ind-chispa"><Chispa datos={tendencia} /></span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minHeight: 22 }}>
        {cambio && (
          <span className="tuo-chip tuo-num" style={{ height: 22, padding: '0 8px', fontSize: 11.5, ...(ok === null ? {} : ok ? { background: 'var(--color-success-bg)', color: 'var(--chip-success-fg)' } : { background: 'var(--color-error-bg)', color: 'var(--chip-error-fg)' }) }}>
            {!neutro && <Flecha size={12} strokeWidth={2.2} />}{cambio}
          </span>
        )}
        {nota && <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{nota}</span>}
      </div>
    </div>
  )
}

export function Llave({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className="tuo-switch" onClick={() => onChange(!on)} />
}

/** Iniciales sobre el color de quien atiende: reemplaza al punto de color suelto. */
export function Sigla({ nombre, color, size = 32, Icon }: { nombre: string; color: string; size?: number; Icon?: LucideIcon }) {
  const letras = nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()
  return (
    <span aria-hidden style={{
      width: size, height: size, borderRadius: size * 0.32, flexShrink: 0, display: 'grid', placeItems: 'center',
      fontFamily: 'var(--tuo-fh)', fontSize: size * 0.36, fontWeight: 700, letterSpacing: '-0.02em',
      color, background: `color-mix(in srgb, ${color} 15%, var(--color-bg))`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
    }}>
      {Icon ? <Icon size={size * 0.46} strokeWidth={1.8} /> : letras}
    </span>
  )
}
