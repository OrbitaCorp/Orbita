// src/modules/propuestas/ui.tsx — Piezas compartidas de la demo de
// propuestas: fondo estelar, tarjetas, botones, chips y el CSS global de
// la demo. Todo inline / CSS propio para no depender del design system del
// panel (esto es una vitrina, no producto).

import type { CSSProperties, ReactNode } from 'react'

export const FONT = 'Geist, Inter, system-ui, sans-serif'
export const FONT_DISPLAY = 'Sora, Geist, Inter, system-ui, sans-serif'
export const FONT_MONO = '"Geist Mono", "Fira Code", monospace'

export const C = {
  bg: '#070B16',
  bg2: '#0B1120',
  surface: 'rgba(15,23,42,0.72)',
  surface2: 'rgba(30,41,59,0.6)',
  border: 'rgba(148,163,184,0.16)',
  borderStrong: 'rgba(148,163,184,0.32)',
  text: '#F8FAFC',
  body: '#CBD5E1',
  muted: '#94A3B8',
  subtle: '#64748B',
  primary: '#3B82F6',
  primaryLight: '#60A5FA',
  orbi: '#8B5CF6',
  orbiLight: '#A78BFA',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
}

/** CSS global de la demo: keyframes y utilidades. Se inyecta una vez por página. */
export const CSS_DEMO = `
  @keyframes pr-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  @keyframes pr-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes pr-pulse { 0%, 100% { opacity: .55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.06); } }
  @keyframes pr-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes pr-spin-rev { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
  @keyframes pr-twinkle { 0%, 100% { opacity: .35; } 50% { opacity: .9; } }
  @keyframes pr-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  @keyframes pr-ping { 0% { transform: scale(1); opacity: .8; } 100% { transform: scale(2.4); opacity: 0; } }
  @keyframes pr-shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
  @keyframes pr-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
  @keyframes pr-typing { 0%, 60%, 100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-4px); opacity: 1; } }
  @keyframes pr-dash { to { stroke-dashoffset: 0; } }
  @keyframes pr-orbit { from { transform: rotate(0deg) translateX(var(--r, 60px)) rotate(0deg); } to { transform: rotate(360deg) translateX(var(--r, 60px)) rotate(-360deg); } }
  .pr-fade-up { animation: pr-fade-up .55s cubic-bezier(.2,.8,.2,1) both; }
  .pr-fade-in { animation: pr-fade-in .4s ease both; }
  .pr-hover-lift { transition: transform .22s cubic-bezier(.2,.8,.2,1), box-shadow .22s, border-color .22s; }
  .pr-hover-lift:hover { transform: translateY(-3px); box-shadow: 0 18px 50px rgba(0,0,0,.45); border-color: rgba(148,163,184,.4) !important; }
  .pr-btn { transition: transform .15s, filter .15s, background .15s, border-color .15s; cursor: pointer; }
  .pr-btn:hover { filter: brightness(1.12); }
  .pr-btn:active { transform: scale(.97); }
  .pr-btn:disabled { opacity: .5; cursor: not-allowed; filter: none; }
  .pr-scroll { scrollbar-width: thin; scrollbar-color: rgba(148,163,184,.3) transparent; }
  .pr-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
  .pr-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,.3); border-radius: 99px; }
  .pr-link { color: #93C5FD; text-decoration: none; }
  .pr-link:hover { text-decoration: underline; }
  .pr-input { background: rgba(2,6,23,.6); border: 1px solid rgba(148,163,184,.25); color: #F8FAFC; border-radius: 10px; padding: 10px 12px; font: inherit; outline: none; width: 100%; }
  .pr-input:focus { border-color: #60A5FA; box-shadow: 0 0 0 3px rgba(59,130,246,.25); }
  @media (prefers-reduced-motion: reduce) { .pr-fade-up, .pr-fade-in { animation: none; } }
`

// ─── Fondo estelar ───────────────────────────────────────────────────────────

const STARS = Array.from({ length: 140 }, (_, i) => {
  const x = (i * 197 + 440) % 1920
  const y = (i * 313 + 151) % 1200
  const s = i % 7 === 0 ? 2 : 1
  return `${x}px ${y}px 0 ${s}px rgba(255,255,255,${i % 3 === 0 ? 0.9 : 0.5})`
}).join(', ')

export function FondoEstelar({ acento = C.primary, acento2 = C.orbi }: { acento?: string; acento2?: string }) {
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden', background: `radial-gradient(ellipse at top, ${C.bg2} 0%, ${C.bg} 60%)` }}>
      <div style={{ position: 'absolute', inset: '-100px', boxShadow: STARS, width: 1, height: 1, animation: 'pr-twinkle 6s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 900, height: 900, borderRadius: '50%', background: `radial-gradient(circle, ${acento} 0%, transparent 65%)`, filter: 'blur(120px)', opacity: 0.16 }} />
      <div style={{ position: 'absolute', bottom: '-30%', right: '-10%', width: 900, height: 900, borderRadius: '50%', background: `radial-gradient(circle, ${acento2} 0%, transparent 65%)`, filter: 'blur(120px)', opacity: 0.13 }} />
    </div>
  )
}

// ─── Primitivas ──────────────────────────────────────────────────────────────

export function Tarjeta({ children, style, className, id }: { children: ReactNode; style?: CSSProperties; className?: string; id?: string }) {
  return (
    <div id={id} className={className} style={{ background: C.surface, borderWidth: 1, borderStyle: 'solid', borderColor: C.border, borderRadius: 18, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', ...style }}>
      {children}
    </div>
  )
}

export function Chip({ children, color = C.primaryLight, style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, letterSpacing: '0.02em', color, background: `${color}1F`, border: `1px solid ${color}44`, whiteSpace: 'nowrap', ...style }}>
      {children}
    </span>
  )
}

export function Boton({
  children, onClick, variante = 'primario', color, style, disabled, tam = 'md', type = 'button',
}: {
  children: ReactNode; onClick?: () => void; variante?: 'primario' | 'fantasma' | 'suave'; color?: string; style?: CSSProperties; disabled?: boolean; tam?: 'sm' | 'md' | 'lg'; type?: 'button' | 'submit'
}) {
  const c = color ?? C.primary
  const pad = tam === 'sm' ? '7px 12px' : tam === 'lg' ? '14px 24px' : '10px 18px'
  const fs = tam === 'sm' ? 12.5 : tam === 'lg' ? 16 : 14
  const base: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: pad, fontSize: fs, fontWeight: 700, borderRadius: 12, fontFamily: FONT, border: '1px solid transparent', lineHeight: 1.2 }
  const v: CSSProperties =
    variante === 'primario' ? { background: `linear-gradient(135deg, ${c}, ${c}CC)`, color: '#fff', boxShadow: `0 8px 24px ${c}55` }
    : variante === 'suave' ? { background: `${c}22`, color: c, borderColor: `${c}55` }
    : { background: 'transparent', color: C.body, borderColor: C.borderStrong }
  return (
    <button type={type} className="pr-btn" onClick={onClick} disabled={disabled} style={{ ...base, ...v, ...style }}>
      {children}
    </button>
  )
}

export function Titulo({ children, tam = 28, style }: { children: ReactNode; tam?: number; style?: CSSProperties }) {
  return <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: tam, fontWeight: 800, letterSpacing: '-0.02em', color: C.text, margin: 0, lineHeight: 1.15, ...style }}>{children}</h2>
}

export function Etiqueta({ children, color = C.primaryLight, style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color, ...style }}>{children}</div>
}

/** Marco tipo "pantalla" para meter un prototipo adentro (celular o panel). */
export function Pantalla({ children, tipo = 'panel', style, ancho }: { children: ReactNode; tipo?: 'panel' | 'celular'; style?: CSSProperties; ancho?: number }) {
  if (tipo === 'celular') {
    return (
      <div style={{ width: ancho ?? 340, margin: '0 auto', borderRadius: 40, padding: 10, background: 'linear-gradient(160deg, #1E293B, #0F172A)', boxShadow: '0 30px 80px rgba(0,0,0,.6), inset 0 0 0 1px rgba(148,163,184,.25)', ...style }}>
        <div style={{ borderRadius: 32, overflow: 'hidden', background: '#fff', minHeight: 620, position: 'relative', color: '#0F172A', fontFamily: FONT }}>
          <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 96, height: 26, borderRadius: 999, background: '#0F172A', zIndex: 5 }} />
          {children}
        </div>
      </div>
    )
  }
  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', background: '#fff', color: '#0F172A', fontFamily: FONT, boxShadow: '0 30px 80px rgba(0,0,0,.5), inset 0 0 0 1px rgba(148,163,184,.25)', ...style }}>
      <div style={{ height: 34, background: '#F1F5F9', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px' }}>
        <span style={{ width: 10, height: 10, borderRadius: 99, background: '#FCA5A5' }} />
        <span style={{ width: 10, height: 10, borderRadius: 99, background: '#FCD34D' }} />
        <span style={{ width: 10, height: 10, borderRadius: 99, background: '#86EFAC' }} />
      </div>
      {children}
    </div>
  )
}

/** Avatar de Orbi (planeta con gradiente azul-violeta, como en la app). */
export function OrbiAvatar({ size = 28 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', boxShadow: '0 0 16px rgba(139,92,246,.5)', flexShrink: 0 }}>
      <svg viewBox="0 0 24 24" fill="none" style={{ width: size * 0.62, height: size * 0.62 }}>
        <circle cx="12" cy="12" r="9.5" stroke="#fff" strokeOpacity={0.6} strokeWidth="1.8" strokeDasharray="38 16" strokeLinecap="round" />
        <circle cx="18.5" cy="5.5" r="2.5" fill="#fff" fillOpacity={0.9} />
        <circle cx="12" cy="12" r="3" fill="#fff" />
      </svg>
    </span>
  )
}

export function formatoARS(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-AR')
}
