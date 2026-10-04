// Piezas compartidas de Configuración de Turnos: tarjeta de sección, rótulos,
// llavecita, selector segmentado, campos, estado vacío y la barra flotante de
// "cambios sin guardar". Todas pintan con el lenguaje de Turnos (clases tuo- de
// _shared/orbita/estilo.tsx) y lo que es propio de Configuración va con
// prefijo tuc- en CSS_UI_CONFIG, que el hub monta una sola vez.
//
// Lo visual que cambia con hover, foco o selección vive en clases y no en
// estilos inline a propósito: un estilo inline le gana a cualquier :hover.
import { useId, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Check, ChevronDown } from 'lucide-react'
import { Cabecera } from '@/modules/turnos/_shared/orbita/piezas'

export const CSS_UI_CONFIG = `
  /* ── Tarjeta de sección ─────────────────────────────────────────────────── */
  .tuc-card { padding: 22px; scroll-margin-top: 24px; transition: border-color 200ms ease, box-shadow 240ms ease; animation: tuoEntra 520ms var(--tuo-ease, ease) both; }
  .tuc-card:nth-of-type(2) { animation-delay: 60ms; } .tuc-card:nth-of-type(3) { animation-delay: 120ms; }
  .tuc-card:nth-of-type(4) { animation-delay: 180ms; } .tuc-card:nth-of-type(5) { animation-delay: 240ms; }
  .tuc-card:nth-of-type(n+6) { animation-delay: 300ms; }
  .tuc-card-cab { display: flex; align-items: center; gap: 12px; }
  .tuc-card-ico { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; flex-shrink: 0; color: var(--color-primary);
    background: var(--tuo-grad-suave); border: 1px solid color-mix(in srgb, var(--color-primary) 22%, transparent); transition: transform 260ms var(--tuo-ease, ease), box-shadow 260ms ease; }
  .tuc-card-bajada { font-size: 13px; line-height: 1.5; color: var(--color-muted); margin: 2px 0 0; }
  .tuc-card-cuerpo { margin-top: 18px; }
  @media (hover: hover) {
    .tuc-card:hover { border-color: color-mix(in srgb, var(--color-primary) 26%, var(--color-border)); box-shadow: var(--shadow-card-hover); }
    .tuc-card:hover .tuc-card-ico { transform: rotate(-4deg) scale(1.05); box-shadow: 0 6px 16px color-mix(in srgb, var(--color-primary) 22%, transparent); }
  }
  .tuc-pila { display: flex; flex-direction: column; gap: 16px; min-width: 0; }

  /* ── Rótulos y campos ───────────────────────────────────────────────────── */
  .tuc-rotulo { display: block; font-size: 13px; font-weight: 600; color: var(--color-text); }
  .tuc-ayuda { font-size: 12px; color: var(--color-muted); margin-top: 3px; line-height: 1.45; }
  .tuc-field, .tuc-input { box-sizing: border-box; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 10px; font-size: 14px;
    color: var(--color-text); font-family: inherit; outline: none; transition: border-color 150ms ease, box-shadow 180ms ease; }
  .tuc-field { width: 100%; }
  .tuc-input { height: 40px; padding: 0 11px; }
  .tuc-field--fila { display: flex; align-items: center; height: 42px; padding: 0 12px; gap: 8px; }
  .tuc-field--fila > input { flex: 1; min-width: 0; height: 100%; border: none; outline: none; background: transparent; font-size: inherit; color: var(--color-text); font-family: inherit; }
  .tuc-field--fila > input:focus-visible { outline: none; }
  .tuc-field--mono > input, .tuc-mono { font-family: var(--tuo-mono, "Geist Mono", monospace); font-variant-numeric: tabular-nums; }
  textarea.tuc-field { resize: vertical; min-height: 84px; padding: 11px 12px; line-height: 1.5; display: block; }
  input.tuc-field { height: 42px; padding: 0 12px; }
  select.tuc-field { height: 42px; padding: 0 36px 0 12px; appearance: none; cursor: pointer; }
  .tuc-field::placeholder, .tuc-field--fila > input::placeholder, .tuc-input::placeholder { color: var(--color-subtle); }
  .tuc-field:focus, .tuc-field:focus-within, .tuc-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent); }
  .tuc-field:focus-visible, .tuc-input:focus-visible { outline: none; }
  .tuc-field-adorno { color: var(--color-muted); font-size: 13px; display: inline-flex; align-items: center; flex-shrink: 0; }
  .tuc-cuenta { text-align: right; font-size: 11px; color: var(--color-subtle); margin-top: 5px; font-family: var(--tuo-mono, monospace); font-variant-numeric: tabular-nums; }
  .tuc-select-flecha { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--color-muted); pointer-events: none; transition: transform 200ms ease, color 150ms ease; }
  .tuc-select:focus-within .tuc-select-flecha { color: var(--color-primary); transform: translateY(-50%) rotate(180deg); }
  @media (hover: hover) {
    .tuc-field:hover:not(:focus):not(:focus-within), .tuc-input:hover:not(:focus) { border-color: var(--color-border-strong); }
  }
  .dark .tuc-input, .dark .tuc-field, .dark .tuc-field input { color-scheme: dark; }
  .tuc-rango { width: 100%; height: 36px; accent-color: var(--color-primary); cursor: pointer; }

  /* ── Llavecita: la del kit, con el área táctil agrandada sin mover nada ── */
  .tuc-switch::before { content: ''; position: absolute; inset: -11px -6px; }
  @media (hover: hover) { .tuc-switch:not(:disabled):hover { filter: brightness(1.08); } }
  .tuc-fila { padding: 12px 0; }
  .tuc-fila-cab { display: flex; align-items: flex-start; gap: 12px; }
  .tuc-fila-ico { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; flex-shrink: 0; background: var(--color-surface-alt); color: var(--color-subtle);
    transition: background 200ms ease, color 200ms ease; }
  .tuc-fila[data-on='true'] .tuc-fila-ico { background: var(--color-primary-bg); color: var(--color-primary); }
  .tuc-fila-titulo { font-size: 13.5px; font-weight: 600; color: var(--color-text); }
  .tuc-fila-hijos { margin-top: 14px; padding: 14px; border-radius: 12px; background: var(--color-surface); border: 1px solid var(--color-border); animation: tucAbre 260ms var(--tuo-ease, ease) both; }
  @keyframes tucAbre { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }

  /* ── Segmentado ─────────────────────────────────────────────────────────── */
  .tuc-seg { display: inline-flex; flex-wrap: wrap; padding: 3px; gap: 3px; border-radius: 12px; background: var(--color-surface-alt); border: 1px solid var(--color-border); max-width: 100%; }
  .tuc-seg--lleno { display: flex; }
  .tuc-seg--lleno > button { flex: 1; }
  /* flex-grow: si las opciones no entran en un renglón, cada renglón se reparte el ancho en vez de dejar una suelta. */
  .tuc-seg > button { flex-grow: 1; min-height: 34px; padding: 0 14px; border-radius: 9px; border: none; background: transparent; color: var(--color-muted); font-family: inherit; font-size: 13px; font-weight: 500;
    white-space: nowrap; cursor: pointer; transition: background 180ms ease, color 160ms ease, box-shadow 180ms ease; }
  .tuc-seg > button[aria-checked='true'] { background: var(--color-bg); color: var(--color-text); font-weight: 600; box-shadow: 0 1px 3px rgba(15,23,42,0.16), 0 0 0 1px color-mix(in srgb, var(--color-primary) 35%, var(--color-border)); }
  .tuc-seg > button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
  @media (hover: hover) { .tuc-seg > button:not([aria-checked='true']):hover { color: var(--color-text); background: color-mix(in srgb, var(--color-bg) 60%, transparent); } }

  /* ── Tarjeta-opción (radio grande) ──────────────────────────────────────── */
  .tuc-opcion { position: relative; text-align: left; padding: 14px; border-radius: 14px; border: 1.5px solid var(--color-border); background: var(--color-bg); color: var(--color-body); cursor: pointer; font-family: inherit; min-width: 0;
    transition: border-color 160ms ease, background 200ms ease, box-shadow 220ms ease, transform 220ms var(--tuo-ease, ease); }
  .tuc-opcion[aria-checked='true'], .tuc-opcion[aria-pressed='true'] { border-color: var(--color-primary); background: var(--tuo-grad-suave); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 16%, transparent); }
  .tuc-opcion:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .tuc-opcion-tilde { position: absolute; top: 10px; right: 10px; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: var(--tuo-grad); opacity: 0; transform: scale(0.6); transition: opacity 180ms ease, transform 240ms var(--tuo-ease, ease); }
  .tuc-opcion[aria-checked='true'] .tuc-opcion-tilde, .tuc-opcion[aria-pressed='true'] .tuc-opcion-tilde { opacity: 1; transform: none; }
  @media (hover: hover) {
    .tuc-opcion:not([aria-checked='true']):not([aria-pressed='true']):hover { border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border)); box-shadow: var(--shadow-card-hover); transform: translateY(-2px); }
  }

  /* ── Chips que se tocan ─────────────────────────────────────────────────── */
  .tuc-pastilla { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 13px; border-radius: 999px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-body);
    font-family: inherit; font-size: 12.5px; font-weight: 500; cursor: pointer; white-space: nowrap; transition: border-color 150ms ease, background 150ms ease, color 150ms ease, transform 150ms ease; }
  .tuc-pastilla[aria-pressed='true'] { border-color: var(--color-primary); background: var(--color-primary-bg); color: var(--chip-primary-fg); font-weight: 600; }
  .tuc-pastilla--mono { font-family: var(--tuo-mono, monospace); border-style: dashed; border-color: var(--color-border-strong); }
  .tuc-pastilla:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .tuc-pastilla:active { transform: scale(0.97); }
  @media (hover: hover) { .tuc-pastilla:not([aria-pressed='true']):hover { border-color: var(--color-primary); color: var(--color-text); } }

  /* ── Botón de texto y botón de ícono suelto ─────────────────────────────── */
  .tuc-link { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; padding: 0 4px; min-height: 32px; border-radius: 6px; color: var(--color-primary); font-size: 12.5px; font-weight: 600;
    cursor: pointer; font-family: inherit; text-decoration: none; transition: color 150ms ease, background 150ms ease; }
  .tuc-link:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  @media (hover: hover) { .tuc-link:hover { background: var(--color-primary-bg); } }
  .tuc-icono { width: 34px; height: 34px; border-radius: 9px; border: none; background: transparent; color: var(--color-muted); display: grid; place-items: center; cursor: pointer; flex-shrink: 0;
    transition: background 150ms ease, color 150ms ease, transform 150ms ease; }
  .tuc-icono:disabled { opacity: 0.3; cursor: not-allowed; }
  .tuc-icono:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
  .tuc-icono:not(:disabled):active { transform: scale(0.92); }
  @media (hover: hover) {
    .tuc-icono:not(:disabled):hover { background: var(--color-surface-alt); color: var(--color-text); }
    .tuc-icono--peligro:not(:disabled):hover { background: var(--color-error-bg); color: var(--color-error); }
  }

  /* ── Renglón de lista dentro de una tarjeta ─────────────────────────────── */
  .tuc-renglon { border-radius: 12px; border: 1px solid var(--color-border); background: var(--color-bg); transition: border-color 160ms ease, box-shadow 200ms ease, background 160ms ease; }
  @media (hover: hover) { .tuc-renglon:hover { border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border)); box-shadow: var(--shadow-card); } }
  .tuc-linea { transition: background 150ms ease; border-radius: 8px; }
  @media (hover: hover) { .tuc-linea:hover { background: color-mix(in srgb, var(--color-primary) 5%, transparent); } }

  /* ── Estado vacío ───────────────────────────────────────────────────────── */
  .tuc-vacio { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 26px 18px; border-radius: 14px; border: 1.5px dashed var(--color-border-strong); background: var(--color-surface); }
  .tuc-vacio-orbita { position: relative; width: 56px; height: 56px; margin-bottom: 6px; color: var(--color-primary); }
  .tuc-vacio-orbita > svg.tuc-vacio-anillo { position: absolute; inset: 0; animation: tuoGira 14s linear infinite; }
  .tuc-vacio-orbita > span { position: absolute; inset: 14px; border-radius: 50%; display: grid; place-items: center; background: var(--tuo-grad-suave); border: 1px solid color-mix(in srgb, var(--color-primary) 26%, transparent); }

  /* ── Barra flotante de guardado ─────────────────────────────────────────── */
  .tuc-barra { position: sticky; bottom: 16px; z-index: 40; display: flex; justify-content: center; margin-top: 24px; pointer-events: none; }
  .tuc-barra-in { pointer-events: auto; display: flex; align-items: center; gap: 10px; max-width: 100%; border-radius: 999px; padding: 8px 8px 8px 18px;
    border: 1px solid rgba(147,197,253,0.28); box-shadow: 0 18px 44px rgba(3,6,14,0.42), 0 0 0 1px rgba(255,255,255,0.04) inset; animation: tucBarraIn 420ms var(--tuo-ease, ease) both; }
  .tuc-barra-punto { position: relative; width: 8px; height: 8px; border-radius: 50%; background: #FBBF24; flex-shrink: 0; }
  .tuc-barra-punto::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: #FBBF24; animation: tuoOnda 1.8s ease-out infinite; }
  .tuc-barra-txt, .tuc-barra-corto { font-size: 13px; font-weight: 500; color: var(--color-text); white-space: nowrap; }
  .tuc-barra-corto { display: none; flex: 1; }
  @keyframes tucBarraIn { from { opacity: 0; transform: translateY(18px) scale(0.96); } to { opacity: 1; transform: none; } }

  /* ── Diálogo ────────────────────────────────────────────────────────────── */
  .tuc-velo { position: fixed; inset: 0; z-index: 300; background: rgba(3,6,14,0.62); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 16px; animation: tucVelo 200ms ease both; }
  .tuc-dialogo { width: min(380px, 100%); background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 20px; padding: 22px; box-shadow: 0 30px 80px rgba(3,6,14,0.45); animation: tucDialogo 320ms var(--tuo-ease, ease) both; }
  @keyframes tucVelo { from { opacity: 0; } to { opacity: 1; } }
  @keyframes tucDialogo { from { opacity: 0; transform: translateY(14px) scale(0.97); } to { opacity: 1; transform: none; } }

  .tuc-dos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tuc-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

  @media (max-width: 768px) {
    .tuc-card { padding: 16px; }
    .tuc-dos { grid-template-columns: minmax(0, 1fr); }
    .tuc-barra-txt { display: none; }
    .tuc-barra-corto { display: inline; }
    .tuc-barra-in { width: 100%; }
    .tuc-barra-in > .tuo-btn { height: 44px; }
    /* 16px: por debajo de eso iOS hace zoom al enfocar el campo. */
    .tuc-field, .tuc-input { font-size: 16px; }
    .tuc-field--fila, select.tuc-field, input.tuc-field, .tuc-input { height: 46px; }
    .tuc-seg > button { min-height: 44px; }
    .tuc-pastilla { min-height: 44px; }
    .tuc-icono { width: 44px; height: 44px; }
    .tuc-link { min-height: 44px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .tuc-card, .tuc-barra-in, .tuc-fila-hijos, .tuc-velo, .tuc-dialogo, .tuc-vacio-orbita > svg.tuc-vacio-anillo, .tuc-barra-punto::after { animation: none !important; }
    .tuc-card-ico, .tuc-opcion, .tuc-opcion-tilde, .tuc-pastilla, .tuc-icono, .tuc-select-flecha { transition: none !important; transform: none !important; }
    .tuc-select:focus-within .tuc-select-flecha { transform: translateY(-50%) !important; }
    .tuc-select-flecha { transform: translateY(-50%) !important; }
  }
`

// ─── Borrador con "Descartar" ────────────────────────────────────────────────
// Cada pestaña edita un borrador y compara contra lo "guardado" (en memoria):
// así la barra de guardado aparece solo si de verdad cambió algo.
// "arranque" deja que el borrador empiece distinto de lo guardado (por ejemplo,
// con la plantilla que se eligió en otra pantalla): ya nace como cambio pendiente.

export function useBorrador<T>(inicial: () => T, arranque?: (guardado: T) => T) {
  const [guardado, setGuardado] = useState<T>(inicial)
  const [valor, setValor] = useState<T>(() => arranque ? arranque(guardado) : guardado)
  const dirty = JSON.stringify(valor) !== JSON.stringify(guardado)
  const set = <K extends keyof T>(k: K, v: T[K]) => setValor(p => ({ ...p, [k]: v }))
  return { valor, setValor, set, dirty, descartar: () => setValor(guardado), guardar: () => setGuardado(valor) }
}

// ─── Encabezado de pestaña ───────────────────────────────────────────────────

export function Encabezado({ titulo, bajada, acciones, rotulo = 'Configuración' }: { titulo: string; bajada: ReactNode; acciones?: ReactNode; rotulo?: string }) {
  return <Cabecera rotulo={rotulo} titulo={titulo} bajada={bajada} acciones={acciones} />
}

// ─── Botón ───────────────────────────────────────────────────────────────────
// El botón del lenguaje de Turnos (.tuo-btn) con la misma forma de uso que el
// Button del design system, para que las pantallas solo cambien el import.

type VarianteBoton = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'

export function Boton({ variant = 'primary', size = 'md', icon, children, className, type = 'button', ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: VarianteBoton; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode }) {
  const v = { primary: ' tuo-btn--primario', ghost: ' tuo-btn--fantasma', danger: ' tuo-btn--peligro', secondary: '', outline: '' }[variant]
  const s = { sm: ' tuo-btn--sm', md: '', lg: ' tuo-btn--lg' }[size]
  return <button type={type} {...props} className={`tuo-btn${v}${s}${className ? ` ${className}` : ''}`}>{icon}{children}</button>
}

/** Botón chico con borde, el de "Copiar", "Agregar", etc. Sin texto es un botón de ícono y necesita `label`. */
export function BotonBorde({ children, onClick, Icon, label, style, pressed }: {
  children?: ReactNode; onClick?: () => void; Icon?: LucideIcon; label?: string; style?: CSSProperties; pressed?: boolean
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={children ? undefined : label} aria-pressed={pressed}
      className={`tuo-btn tuo-btn--sm${children ? '' : ' tuo-btn--icono'}`} style={{ flexShrink: 0, ...style }}>
      {Icon && <Icon size={14} strokeWidth={1.8} aria-hidden />}{children}
    </button>
  )
}

// ─── Tarjeta de sección ──────────────────────────────────────────────────────

export function SecCard({ id, titulo, Icon, badge, bajada, children, style }: {
  id?: string; titulo: string; Icon: LucideIcon; badge?: ReactNode; bajada?: ReactNode; children: ReactNode; style?: CSSProperties
}) {
  return (
    <section id={id} aria-label={titulo} className="tuo-card tuo-card--luz tuc-card" style={style}>
      <div className="tuc-card-cab">
        <span className="tuc-card-ico" aria-hidden><Icon size={18} strokeWidth={1.7} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="tuo-h2">{titulo}</h2>
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
  return <div role="presentation" style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--color-border) 12%, var(--color-border) 88%, transparent)', margin: '16px 0' }} />
}

// ─── Llavecita ───────────────────────────────────────────────────────────────

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} className="tuo-switch tuc-switch" />
}

/** Fila con título, explicación y llavecita a la derecha. `children` se muestra solo si está prendida. */
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
    <div role="radiogroup" aria-label={label} className={`tuc-seg${lleno ? ' tuc-seg--lleno' : ''}`}>
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
        {Icon && <Icon size={18} strokeWidth={1.7} aria-hidden style={{ color: activa ? 'var(--color-primary)' : 'var(--color-subtle)', flexShrink: 0, marginTop: 1, transition: 'color 160ms ease' }} />}
        <span>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{titulo}</span>
          {ayuda && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-muted)', marginTop: 3, lineHeight: 1.45 }}>{ayuda}</span>}
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
        <textarea id={id} value={value} onChange={e => onChange?.(e.target.value)} readOnly={readOnly} placeholder={placeholder} maxLength={maxLength} rows={3} className="tuc-field" />
      ) : (
        <div className={`tuc-field tuc-field--fila${mono ? ' tuc-field--mono' : ''}`}>
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
      <div className="tuc-select" style={{ position: 'relative' }}>
        <select id={id} value={String(valor)} className="tuc-field"
          onChange={e => { const o = opciones.find(x => String(x.id) === e.target.value); if (o) onChange(o.id) }}>
          {opciones.map(o => <option key={String(o.id)} value={String(o.id)}>{o.label}</option>)}
        </select>
        <ChevronDown size={15} aria-hidden className="tuc-select-flecha" />
      </div>
    </div>
  )
}

/** Grilla de 2 columnas que pasa a 1 en celular. */
export function Dos({ children, gap = 14 }: { children: ReactNode; gap?: number }) {
  return <div className="tuc-dos" style={{ columnGap: gap }}>{children}</div>
}

export function Chip({ children, tono = 'neutro' }: { children: ReactNode; tono?: 'neutro' | 'ok' | 'aviso' | 'primario' }) {
  const c = { neutro: '', ok: ' tuo-chip--ok', aviso: ' tuo-chip--aviso', primario: ' tuo-chip--primario' }[tono]
  return <span className={`tuo-chip${c}`} style={{ height: 24, padding: '0 10px', fontSize: 11.5 }}>{children}</span>
}

// ─── Estado vacío ────────────────────────────────────────────────────────────

/** Una órbita sin nada girando: el vacío con la cara de Órbita. */
export function Vacio({ Icon, titulo, children, accion }: { Icon: LucideIcon; titulo: string; children?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="tuc-vacio">
      <div className="tuc-vacio-orbita" aria-hidden>
        <svg className="tuc-vacio-anillo" viewBox="0 0 56 56" width={56} height={56}>
          <circle cx="28" cy="28" r="26" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 5" />
          <circle cx="28" cy="2" r="3" fill="currentColor" />
        </svg>
        <span><Icon size={15} strokeWidth={1.8} /></span>
      </div>
      <div style={{ fontFamily: 'var(--tuo-fh)', fontSize: 14.5, fontWeight: 600, color: 'var(--color-text)' }}>{titulo}</div>
      {children && <div style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5, maxWidth: 360 }}>{children}</div>}
      {accion && <div style={{ marginTop: 8 }}>{accion}</div>}
    </div>
  )
}

// ─── Barra de guardado ───────────────────────────────────────────────────────
// Sticky al pie del área que scrollea (.admin-main): queda centrada sobre el
// contenido y no sobre el sidebar, y no hace falta volver arriba para guardar.
// Va sobre .tuo-espacio: una píldora oscura flota igual de bien en claro y en
// oscuro, y los botones de adentro se pintan solos con esa paleta.

export function BarraGuardar({ dirty, onDescartar, onGuardar }: { dirty: boolean; onDescartar: () => void; onGuardar: () => void }) {
  if (!dirty) return null
  return (
    <div className="tuc-barra">
      <div role="status" className="tuo-espacio tuc-barra-in">
        <span aria-hidden className="tuc-barra-punto" />
        <span className="tuc-barra-txt">Tenés cambios sin guardar</span>
        <span className="tuc-barra-corto">Sin guardar</span>
        <Boton variant="ghost" size="sm" onClick={onDescartar}>Descartar</Boton>
        <Boton variant="primary" size="sm" onClick={onGuardar} icon={<Check size={14} strokeWidth={2.4} aria-hidden />}>Guardar</Boton>
      </div>
    </div>
  )
}

// ─── Diálogo chico ───────────────────────────────────────────────────────────

export function Dialogo({ titulo, onCerrar, children, ancho }: { titulo: string; onCerrar: () => void; children: ReactNode; ancho?: number }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} className="tuc-velo" onClick={onCerrar}
      onKeyDown={e => { if (e.key === 'Escape') onCerrar() }}>
      <div className="tuc-dialogo" style={ancho ? { width: `min(${ancho}px, 100%)` } : undefined} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

// ─── Props de cada pestaña ───────────────────────────────────────────────────

export interface PropsTab {
  rubro: import('@/modules/turnos/datos').RubroTurnos
  /** Muestra el toast de la pantalla (no se guarda nada: es la demo). */
  avisar: (titulo: string, descripcion?: string) => void
}
