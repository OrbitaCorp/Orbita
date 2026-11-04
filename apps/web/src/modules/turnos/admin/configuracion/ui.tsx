// Piezas de los formularios del panel de Turnos: tarjeta de sección, rótulos,
// llave, selector segmentado, campos con prefijo o sufijo, tarjeta-opción,
// estado vacío (el borrador y la barra de "cambios sin guardar" son del kit:
// useBorrador y BarraGuardar en design-system/reservas/piezas.tsx). Pintan con
// las clases rv- del kit de reservas (design-system/reservas/estilo.tsx); lo que
// el kit no trae va con prefijo tuc- en CSS_UI_CONFIG, que PanelTurnos monta
// una sola vez.
//
// Lo visual que cambia con hover, foco o selección vive en clases y no en
// estilos inline a propósito: un estilo inline le gana a cualquier :hover.
import { useId, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Check } from 'lucide-react'
import { Encabezado as EncabezadoKit } from '@/design-system/reservas/piezas'

export const CSS_UI_CONFIG = `
  /* ── Tarjeta de sección: la del kit, con un ícono en chip al lado del título ── */
  .tuc-card { scroll-margin-top: 24px; }
  .tuc-card-cab { display: flex; align-items: center; gap: 12px; }
  .tuc-card-ico { width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; flex-shrink: 0; color: var(--color-primary); background: var(--color-primary-bg); }
  .tuc-card-bajada { font-size: 13px; line-height: 1.5; color: var(--color-muted); margin: 2px 0 0; }
  .tuc-card-cuerpo { margin-top: 18px; }

  /* ── Rótulos y campos (las medidas de rv-input: 42 px, radio 8, 16 px en celular) ── */
  .tuc-rotulo { display: block; font-size: 13px; font-weight: 600; color: var(--color-text); }
  .tuc-ayuda { font-size: 12.5px; color: var(--color-muted); margin-top: 3px; line-height: 1.45; }
  .tuc-field--fila { display: flex; align-items: center; min-height: 42px; padding: 0 12px; gap: 8px; border-radius: var(--rv-r-sm); border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font-size: 14px; }
  .tuc-field--fila > input { flex: 1; min-width: 0; height: 40px; border: none; outline: none; padding: 0; background: transparent; font: inherit; color: var(--color-text); }
  .tuc-field--fila > input::placeholder { color: var(--color-subtle); }
  .tuc-field--fila:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); }
  .tuc-field--fila[aria-invalid='true'] { border-color: var(--color-error); }
  .tuc-field--mono > input, .tuc-mono { font-family: var(--rv-mono); font-variant-numeric: tabular-nums; }
  .tuc-field-adorno { color: var(--color-muted); font-size: 13px; display: inline-flex; align-items: center; flex-shrink: 0; }
  .tuc-cuenta { text-align: right; font-size: 11.5px; color: var(--color-muted); margin-top: 5px; font-family: var(--rv-mono); font-variant-numeric: tabular-nums; }
  .dark .rvp .tuc-field--fila > input { color-scheme: dark; }
  .tuc-rango { width: 100%; height: 36px; accent-color: var(--color-primary); cursor: pointer; }

  /* ── Fila con llave: título, ayuda y, si está prendida, lo que depende de ella ── */
  .tuc-fila { padding: 12px 0; border-top: 1px solid var(--color-border); }
  .tuc-fila:first-child { border-top: none; padding-top: 0; }
  .tuc-fila-cab { display: flex; align-items: flex-start; gap: 12px; }
  .tuc-fila-ico { width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; flex-shrink: 0; background: var(--color-surface-alt); color: var(--color-subtle); }
  .tuc-fila[data-on='true'] .tuc-fila-ico { background: var(--color-primary-bg); color: var(--color-primary); }
  .tuc-fila-titulo { font-size: 14px; font-weight: 600; color: var(--color-text); }
  .tuc-fila-hijos { margin-top: 14px; padding: 14px; border-radius: var(--rv-r-sm); background: var(--color-surface); border: 1px solid var(--color-border); }
  .tuc-fila-hijos > .tuc-fila:first-child { padding-top: 0; }

  /* ── Segmentado: el del kit, pero si las opciones no entran bajan de renglón en vez de scrollear ── */
  .rv-seg.tuc-seg { flex-wrap: wrap; overflow: visible; }
  .rv-seg.tuc-seg > button { flex-grow: 1; }
  /* Un botón a la altura de un campo (el "Conectar" al lado del dominio): 42 px, 46 en celular como rv-input. */
  .tuc-alto-campo { min-height: 42px; }

  /* ── Tarjeta-opción (radio grande): borde, y el acento solo en la elegida ── */
  .tuc-opcion { position: relative; text-align: left; padding: 14px; border-radius: var(--rv-r); border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-body); cursor: pointer; font: inherit; min-width: 0; }
  .tuc-opcion[aria-checked='true'], .tuc-opcion[aria-pressed='true'] { border-color: var(--color-primary); background: var(--color-primary-bg); box-shadow: 0 0 0 1px var(--color-primary); }
  .tuc-opcion:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  @media (hover: hover) { .tuc-opcion:not([aria-checked='true']):not([aria-pressed='true']):hover { border-color: var(--color-border-strong); } }
  .tuc-opcion-tilde { position: absolute; top: 10px; right: 10px; width: 20px; height: 20px; border-radius: 50%; display: none; place-items: center; color: var(--color-on-primary); background: var(--color-primary); }
  .tuc-opcion[aria-checked='true'] .tuc-opcion-tilde, .tuc-opcion[aria-pressed='true'] .tuc-opcion-tilde { display: grid; }

  /* ── Botón de texto y botón de ícono suelto ── */
  /* El texto va en --chip-primary-fg y no en --color-primary: el acento puro sobre blanco da 3,7:1 a 13 px. */
  .tuc-link { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; padding: 0 4px; min-height: 32px; border-radius: 6px; color: var(--chip-primary-fg); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; }
  .tuc-link:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  @media (hover: hover) { .tuc-link:hover { text-decoration: underline; text-underline-offset: 3px; } }
  .tuc-icono { width: 34px; height: 34px; border-radius: 8px; border: none; background: transparent; color: var(--color-muted); display: grid; place-items: center; cursor: pointer; flex-shrink: 0; }
  .tuc-icono:disabled { opacity: 0.3; cursor: not-allowed; }
  .tuc-icono:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
  .tuc-icono--peligro:not(:disabled) { color: var(--color-error); }

  /* ── Renglón de lista dentro de una tarjeta ── */
  .tuc-renglon { border-radius: var(--rv-r-sm); border: 1px solid var(--color-border); background: var(--color-bg); }

  /* ── Vista previa a pantalla completa (Apariencia en celular): un velo oscuro, como el de un modal ── */
  .tuc-velo { position: fixed; inset: var(--rv-tope, 0px) 0 0 0; z-index: 300; background: rgba(3,6,14,0.62); display: flex; flex-direction: column; padding: 12px; }

  @media (max-width: 768px) {
    .tuc-field--fila { min-height: 46px; font-size: 16px; }
    .tuc-field--fila > input { height: 44px; }
    .tuc-icono { width: 44px; height: 44px; }
    .tuc-link { min-height: 44px; }
    .tuc-alto-campo { min-height: 46px; }
    /* Una opción corta ("4", "6") del segmentado también mide un dedo a lo ancho. */
    .rv-seg.tuc-seg > button { min-width: 44px; }
  }
`

// ─── Encabezado de pantalla ──────────────────────────────────────────────────

/** El encabezado del kit (h1 de 26 px), con "Configuración" como rótulo salvo que se diga otro. */
export function Encabezado({ titulo, bajada, acciones, rotulo = 'Configuración' }: { titulo: string; bajada: ReactNode; acciones?: ReactNode; rotulo?: string }) {
  return <EncabezadoKit rotulo={rotulo} titulo={titulo} bajada={bajada} acciones={acciones} />
}

// ─── Botón ───────────────────────────────────────────────────────────────────
// El botón del kit (.rv-btn) con la misma forma de uso que el Button del design
// system, para que las pantallas solo cambien el import.

type VarianteBoton = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'

export function Boton({ variant = 'primary', size = 'md', icon, children, className, type = 'button', ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: VarianteBoton; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode }) {
  const v = { primary: ' rv-btn--primario', ghost: ' rv-btn--fantasma', danger: ' rv-btn--peligro', secondary: '', outline: '' }[variant]
  const s = { sm: ' rv-btn--sm', md: '', lg: ' rv-btn--lg' }[size]
  return <button type={type} {...props} className={`rv-btn${v}${s}${className ? ` ${className}` : ''}`}>{icon}{children}</button>
}

/** Botón chico con borde, el de "Copiar", "Agregar", etc. Sin texto es un botón de ícono y necesita `label`. */
export function BotonBorde({ children, onClick, Icon, label, style, pressed }: {
  children?: ReactNode; onClick?: () => void; Icon?: LucideIcon; label?: string; style?: CSSProperties; pressed?: boolean
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={children ? undefined : label} aria-pressed={pressed}
      className={`rv-btn rv-btn--sm${children ? '' : ' rv-btn--icono'}`} style={{ flexShrink: 0, ...style }}>
      {Icon && <Icon size={14} strokeWidth={1.8} aria-hidden />}{children}
    </button>
  )
}

// ─── Tarjeta de sección ──────────────────────────────────────────────────────

export function SecCard({ id, titulo, Icon, badge, bajada, children, style }: {
  id?: string; titulo: string; Icon: LucideIcon; badge?: ReactNode; bajada?: ReactNode; children: ReactNode; style?: CSSProperties
}) {
  return (
    <section id={id} aria-label={titulo} className="rv-card rv-card--pad tuc-card" style={style}>
      <div className="tuc-card-cab">
        <span className="tuc-card-ico" aria-hidden><Icon size={16} strokeWidth={1.7} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="rv-h2">{titulo}</h2>
          {bajada && <p className="tuc-card-bajada">{bajada}</p>}
        </div>
        {badge}
      </div>
      <div className="tuc-card-cuerpo">{children}</div>
    </section>
  )
}

export function Rotulo({ children, ayuda, htmlFor }: { children: ReactNode; ayuda?: ReactNode; htmlFor?: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      {htmlFor ? <label htmlFor={htmlFor} className="tuc-rotulo">{children}</label> : <div className="tuc-rotulo">{children}</div>}
      {ayuda && <div className="tuc-ayuda">{ayuda}</div>}
    </div>
  )
}

export function Divisor() {
  return <div role="presentation" style={{ height: 1, background: 'var(--color-border)', margin: '16px 0' }} />
}

// ─── Llave ───────────────────────────────────────────────────────────────────

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} className="rv-switch" />
}

/** Fila con título, explicación y llave a la derecha. `children` se muestra solo si está prendida. */
export function FilaSwitch({ titulo, ayuda, on, onChange, children, Icon }: {
  titulo: string; ayuda?: ReactNode; on: boolean; onChange: (v: boolean) => void; children?: ReactNode; Icon?: LucideIcon
}) {
  return (
    <div className="tuc-fila" data-on={on}>
      <div className="tuc-fila-cab">
        {Icon && <span className="tuc-fila-ico" aria-hidden><Icon size={16} strokeWidth={1.7} /></span>}
        <div style={{ flex: 1, minWidth: 0, paddingTop: Icon ? 1 : 0 }}>
          <div className="tuc-fila-titulo">{titulo}</div>
          {ayuda && <div className="tuc-ayuda">{ayuda}</div>}
        </div>
        <Switch on={on} onChange={onChange} label={titulo} />
      </div>
      {on && children && <div className="tuc-fila-hijos">{children}</div>}
    </div>
  )
}

// ─── Selector segmentado ─────────────────────────────────────────────────────

export function Segmentado<T extends string | number>({ valor, opciones, onChange, label, lleno }: {
  valor: T; opciones: { id: T; label: string }[]; onChange: (v: T) => void; label: string; lleno?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`rv-seg tuc-seg${lleno ? ' rv-seg--lleno' : ''}`}>
      {opciones.map(o => (
        <button key={String(o.id)} type="button" role="radio" aria-checked={o.id === valor} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  )
}

/** Tarjeta grande de opción excluyente: ícono, título y una línea de ayuda. Va dentro de un role="radiogroup". */
export function OpcionTarjeta({ activa, onClick, Icon, titulo, ayuda, children }: {
  activa: boolean; onClick: () => void; Icon?: LucideIcon; titulo: string; ayuda?: ReactNode; children?: ReactNode
}) {
  return (
    <button type="button" role="radio" aria-checked={activa} onClick={onClick} className="tuc-opcion">
      <span className="tuc-opcion-tilde" aria-hidden><Check size={12} strokeWidth={3} /></span>
      {children}
      <span style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingRight: 22 }}>
        {Icon && <Icon size={18} strokeWidth={1.7} aria-hidden style={{ color: activa ? 'var(--color-primary)' : 'var(--color-subtle)', flexShrink: 0, marginTop: 1 }} />}
        <span>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{titulo}</span>
          {/* --color-body y no --color-muted: la opción elegida va sobre primary-bg, donde el gris no llega a AA. */}
          {ayuda && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-body)', marginTop: 3, lineHeight: 1.45 }}>{ayuda}</span>}
        </span>
      </span>
    </button>
  )
}

// ─── Campos ──────────────────────────────────────────────────────────────────

export function Campo({ label, ayuda, value, onChange, prefijo, sufijo, placeholder, maxLength, area, mono, type = 'text', readOnly, style }: {
  label: string; ayuda?: ReactNode; value: string; onChange?: (v: string) => void; prefijo?: ReactNode; sufijo?: ReactNode
  placeholder?: string; maxLength?: number; area?: boolean; mono?: boolean; type?: string; readOnly?: boolean; style?: CSSProperties
}) {
  const id = useId()
  return (
    <div style={{ marginBottom: 16, minWidth: 0, ...style }}>
      <Rotulo htmlFor={id} ayuda={ayuda}>{label}</Rotulo>
      {area ? (
        <textarea id={id} value={value} onChange={e => onChange?.(e.target.value)} readOnly={readOnly} placeholder={placeholder} maxLength={maxLength} rows={3} className="rv-textarea" />
      ) : (
        <div className={`tuc-field--fila${mono ? ' tuc-field--mono' : ''}`}>
          {prefijo && <span className="tuc-field-adorno">{prefijo}</span>}
          <input id={id} type={type} value={value} onChange={e => onChange?.(e.target.value)} readOnly={readOnly} placeholder={placeholder} maxLength={maxLength} />
          {sufijo && <span className="tuc-field-adorno" style={{ fontSize: 12.5 }}>{sufijo}</span>}
        </div>
      )}
      {maxLength && <div className="tuc-cuenta" aria-hidden>{value.length}/{maxLength}</div>}
    </div>
  )
}

export function Selector<T extends string | number>({ label, ayuda, valor, opciones, onChange, style }: {
  label: string; ayuda?: ReactNode; valor: T; opciones: { id: T; label: string }[]; onChange: (v: T) => void; style?: CSSProperties
}) {
  const id = useId()
  return (
    <div style={{ marginBottom: 16, minWidth: 0, ...style }}>
      <Rotulo htmlFor={id} ayuda={ayuda}>{label}</Rotulo>
      <select id={id} value={String(valor)} className="rv-select"
        onChange={e => { const o = opciones.find(x => String(x.id) === e.target.value); if (o) onChange(o.id) }}>
        {opciones.map(o => <option key={String(o.id)} value={String(o.id)}>{o.label}</option>)}
      </select>
    </div>
  )
}

/** Grilla de 2 columnas que pasa a 1 en celular. */
export function Dos({ children, gap = 14 }: { children: ReactNode; gap?: number }) {
  return <div className="rv-dos" style={{ columnGap: gap, rowGap: 0 }}>{children}</div>
}

export function Chip({ children, tono = 'neutro' }: { children: ReactNode; tono?: 'neutro' | 'ok' | 'aviso' | 'primario' }) {
  const c = { neutro: '', ok: ' rv-chip--ok', aviso: ' rv-chip--aviso', primario: ' rv-chip--primario' }[tono]
  return <span className={`rv-chip${c}`} style={{ height: 24, padding: '0 10px', fontSize: 11.5 }}>{children}</span>
}

// ─── Estado vacío ────────────────────────────────────────────────────────────

/** El vacío del kit (borde punteado), con un ícono en un círculo como el EmptyState de Tienda. */
export function Vacio({ Icon, titulo, children, accion }: { Icon: LucideIcon; titulo: string; children?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="rv-vacio">
      <span aria-hidden style={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--color-surface-alt)', color: 'var(--color-muted)' }}><Icon size={20} strokeWidth={1.5} /></span>
      <div className="rv-h3">{titulo}</div>
      {children && <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, maxWidth: 360 }}>{children}</p>}
      {accion && <div style={{ marginTop: 4 }}>{accion}</div>}
    </div>
  )
}

// ─── Props de cada pantalla de configuración ─────────────────────────────────

export interface PropsTab {
  rubro: import('@/modules/turnos/datos').RubroTurnos
  /** Muestra el aviso de la pantalla (no se guarda nada: es la demo). */
  avisar: (titulo: string, descripcion?: string) => void
}
