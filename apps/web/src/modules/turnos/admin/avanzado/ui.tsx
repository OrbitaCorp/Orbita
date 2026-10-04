// Piezas compartidas por todas las pantallas del Avanzado de Turnos: el
// armazón de cada función (volver, cabecera protagonista, interruptor maestro,
// config a la izquierda y "así lo ve tu cliente" a la derecha) y los controles
// chicos. Un solo armazón para que las doce se lean igual y no haya que
// diseñar cada una desde cero.
//
// Lo propio del Avanzado va con prefijo tua-. Los controles genéricos (campos,
// pastillas, tarjetas-opción, renglones, estado vacío) son los mismos de
// Configuración (tuc-, en configuracion/ui.tsx): se montan acá junto con los
// tua- para no mantener dos copias del mismo botón.
import { createContext, useCallback, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Check, Sparkles, Info, Signal, Wifi, BatteryFull, Eye } from 'lucide-react'
import { Volver } from '@/modules/ventas/panel/_shared/Volver'
import { cargarFuentes } from '@/modules/ventas/panel/avanzado/plantillas/piezas'
import type { RubroTurnos } from '@/modules/turnos/datos'
import { temaDe, variablesTema } from '@/modules/turnos/storefront/tema'
import { EstiloTurnos } from '@/modules/turnos/_shared/orbita/estilo'
import { Indicador } from '@/modules/turnos/_shared/orbita/piezas'
import { CSS_UI_CONFIG, Boton, Vacio } from '../configuracion/ui'
import { grupoPorId, type Funcion } from './datosAvanzado'

export { Boton, Vacio }

// ─── Estilos ──────────────────────────────────────────────────────────────────
// Un bloque para todo el módulo: las pantallas se renderizan de a una, así que
// no se duplica.
export const CSS_AVANZADO = CSS_UI_CONFIG + `
  /* Los desplegables de estas pantallas son <select> sueltos (sin el envoltorio de Configuración): la flecha va de fondo. */
  select.tuc-field { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%237E89A6' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; }
  /* Entrada que no deja transform aplicado al terminar (ver CSS_PLANTILLA): lo que se eleva al hover la usa. */
  @keyframes tuaEntra { from { opacity: 0; transform: translateY(12px); } }
  .tua-entra { animation: tuaEntra 520ms var(--tuo-ease, ease) backwards; animation-delay: calc(var(--i, 0) * 55ms); }
  .tua-pantalla-in { animation: tuaPantalla 280ms ease backwards; }
  @keyframes tuaPantalla { from { opacity: 0; } }

  .tua-cols { display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 24px; align-items: start; }
  .tua-sticky { position: sticky; top: 16px; min-width: 0; }
  .tua-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 20px; }
  .tua-kpis > :nth-child(2) { animation-delay: 70ms; } .tua-kpis > :nth-child(3) { animation-delay: 140ms; }
  .tua-kpis .tuo-ind-valor { font-size: 26px !important; white-space: normal !important; overflow-wrap: anywhere; }
  .tua-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }

  /* ── Cabecera de la función ─────────────────────────────────────────────── */
  .tua-hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 360px); gap: 24px; align-items: center; padding: 24px; margin: 14px 0 20px; overflow: hidden; }
  .tua-hero-ico { position: relative; width: 68px; height: 68px; flex-shrink: 0; display: grid; place-items: center; }
  .tua-hero-ico > span { position: relative; width: 60px; height: 60px; border-radius: 18px; display: grid; place-items: center; color: var(--color-subtle); background: var(--color-surface-alt); border: 1px solid var(--color-border);
    transition: color 300ms ease, box-shadow 400ms ease, border-color 300ms ease; isolation: isolate; overflow: hidden; }
  .tua-hero-ico > span::before { content: ''; position: absolute; inset: 0; z-index: -1; background: var(--tuo-grad); opacity: 0; transition: opacity 400ms ease; }
  .tua-hero-ico > svg { position: absolute; inset: -14px; width: calc(100% + 28px); height: calc(100% + 28px); color: var(--color-primary); opacity: 0.25; transition: opacity 400ms ease; animation: tuoGira 26s linear infinite; animation-play-state: paused; }
  .tua-hero[data-on='true'] .tua-hero-ico > span { color: #fff; border-color: transparent; box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-primary) 12%, transparent), 0 14px 34px color-mix(in srgb, var(--color-primary) 45%, transparent); }
  .tua-hero[data-on='true'] .tua-hero-ico > span::before { opacity: 1; }
  .tua-hero[data-on='true'] .tua-hero-ico > svg { opacity: 0.9; animation-play-state: running; }

  /* ── Interruptor maestro ────────────────────────────────────────────────── */
  .tua-maestro { position: relative; isolation: isolate; overflow: hidden; display: flex; align-items: flex-start; gap: 14px; padding: 18px; border-radius: 18px; border: 1px solid var(--color-border); background: var(--color-surface);
    cursor: pointer; transition: border-color 300ms ease, box-shadow 400ms ease; }
  .tua-maestro::before { content: ''; position: absolute; inset: 0; z-index: -1; background: var(--tuo-grad-suave); opacity: 0; transition: opacity 400ms ease; }
  .tua-maestro[data-on='true'] { border-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-border)); box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 12%, transparent), 0 18px 40px -22px color-mix(in srgb, var(--color-primary) 70%, transparent); }
  .tua-maestro[data-on='true']::before { opacity: 1; }
  .tua-maestro-txt { animation: tuaPantalla 320ms ease backwards; }
  .tua-maestro .tuo-switch { width: 52px; height: 30px; margin-top: 2px; }
  .tua-maestro .tuo-switch::after { width: 24px; height: 24px; }
  .tua-maestro .tuo-switch[aria-checked='true']::after { transform: translateX(22px); }

  /* ── Sección de la columna de config ────────────────────────────────────── */
  .tua-sec { padding: 22px; margin-bottom: 16px; transition: border-color 200ms ease, box-shadow 240ms ease; animation: tuoEntra 520ms var(--tuo-ease, ease) both; }
  .tua-sec:nth-of-type(2) { animation-delay: 60ms; } .tua-sec:nth-of-type(3) { animation-delay: 120ms; } .tua-sec:nth-of-type(n+4) { animation-delay: 180ms; }
  .tua-aviso { display: flex; gap: 10px; padding: 12px 14px; border-radius: 12px; background: var(--color-primary-bg); border: 1px solid color-mix(in srgb, var(--color-primary) 22%, transparent); margin-bottom: 16px; font-size: 12.5px; color: var(--color-body); line-height: 1.55; }
  .tua-guardar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding-top: 4px; }

  /* ── "Así lo ve tu cliente": el celular ─────────────────────────────────── */
  .tua-vista { padding: 18px 18px 22px; overflow: hidden; }
  .tua-escena { position: relative; isolation: isolate; margin: 16px -18px -22px; padding: 30px 18px 34px; display: grid; place-items: center; overflow: hidden;
    background: radial-gradient(420px 300px at 50% 8%, color-mix(in srgb, var(--color-primary) 20%, transparent), transparent 70%), var(--color-surface); border-top: 1px solid var(--color-border); }
  .tua-escena > svg { position: absolute; z-index: -1; left: 50%; top: 50%; width: 560px; height: 560px; margin: -280px 0 0 -280px; color: var(--color-primary); opacity: 0.5; pointer-events: none; }
  .tua-escena > svg > g { transform-origin: 280px 280px; animation: tuoGira 40s linear infinite; }
  .tua-tel { position: relative; width: min(304px, 100%); border-radius: 46px; padding: 10px; box-sizing: border-box; background: linear-gradient(145deg, #2A3350 0%, #0B0F19 38%, #0B0F19 62%, #1B2238 100%);
    box-shadow: 0 0 0 1px rgba(255,255,255,0.10) inset, 0 40px 70px -28px rgba(3,6,14,0.65), 0 18px 30px -18px rgba(3,6,14,0.5), 0 0 70px -12px color-mix(in srgb, var(--color-primary) 40%, transparent);
    transform: perspective(1600px) rotateY(-6deg) rotateX(2deg); transition: transform 600ms var(--tuo-ease, ease), box-shadow 600ms ease; will-change: transform; }
  .tua-tel::before, .tua-tel::after { content: ''; position: absolute; width: 3px; border-radius: 2px; background: #1B2238; }
  .tua-tel::before { left: -3px; top: 118px; height: 58px; }
  .tua-tel::after { right: -3px; top: 148px; height: 84px; }
  .tua-pantalla { position: relative; border-radius: 37px; overflow: hidden; display: flex; flex-direction: column; height: clamp(500px, calc(100vh - 280px), 620px); }
  .tua-pantalla-estado { position: relative; z-index: 2; height: 38px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 6px 24px 0; font-size: 12px; font-weight: 700; font-family: system-ui, -apple-system, sans-serif; }
  .tua-isla { position: absolute; left: 50%; top: 9px; transform: translateX(-50%); width: 84px; height: 24px; border-radius: 999px; background: #05070D; }
  .tua-pantalla-cuerpo { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none; display: flex; flex-direction: column; gap: 12px; }
  .tua-pantalla-cuerpo::-webkit-scrollbar { display: none; }
  .tua-pantalla-cuerpo > * { flex-shrink: 0; }
  .tua-pantalla-base { position: absolute; left: 50%; bottom: 7px; transform: translateX(-50%); width: 108px; height: 4px; border-radius: 999px; background: currentColor; opacity: 0.32; pointer-events: none; z-index: 2; }

  /* ── Opciones sueltas de las pantallas (chips, tarjetas-radio, casillas) ── */
  .tua-opc { transition: border-color 150ms ease, background 150ms ease, color 150ms ease, transform 150ms ease; }
  .tua-opc:focus-visible, .tua-btn-txt:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .tua-opc:active { transform: scale(0.98); }
  .tua-btn-txt { border-radius: 4px; }
  .tua-estado { font-size: 12px; color: var(--color-muted); line-height: 1.45; min-height: 17px; }

  /* ── Lo que se toca adentro del celular ─────────────────────────────────── */
  .tua-vbtn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; min-height: 44px; box-sizing: border-box; padding: 0 12px; border: none; border-radius: var(--tu-r);
    background: var(--color-primary); color: var(--color-on-primary); font-family: inherit; font-weight: 700; font-size: 14px; line-height: 1.2; text-align: center; text-decoration: none; cursor: pointer;
    transition: filter 150ms ease, transform 150ms ease; }
  .tua-vbtn--borde { background: transparent; color: var(--color-primary); border: 1.5px solid var(--color-primary); }
  .tua-vbtn--suave { background: var(--color-surface-alt); color: var(--color-text); font-weight: 600; }
  .tua-vbtn--chico { min-height: 36px; font-size: 12.5px; border-radius: 8px; }
  .tua-vbtn:focus-visible, .tua-vlink:focus-visible { outline: 2px solid var(--color-text); outline-offset: 2px; }
  .tua-vbtn:active { transform: scale(0.98); }
  .tua-vlink { color: var(--color-primary); font-weight: 600; text-decoration: none; border-radius: 4px; }
  .tua-vcampo { width: 100%; box-sizing: border-box; min-height: 38px; border-radius: var(--tu-r); border: 1px solid var(--color-border); background: var(--color-bg); padding: 8px 10px; font-family: inherit; font-size: 12.5px;
    color: var(--color-text); outline: none; display: block; transition: border-color 150ms ease, box-shadow 180ms ease; }
  textarea.tua-vcampo { min-height: 62px; resize: none; line-height: 1.45; }
  .tua-vcampo::placeholder { color: var(--color-muted); }
  .tua-vcampo:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent); }
  .tua-toast-zona { position: absolute; left: 12px; right: 12px; bottom: 20px; z-index: 3; pointer-events: none; }
  .tua-toast { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 12px; background: #0B0F19; color: #FFFFFF; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; font-weight: 600; line-height: 1.4;
    box-shadow: 0 14px 30px -10px rgba(3,6,14,0.6); overflow-wrap: anywhere; animation: tuaToast 260ms var(--tuo-ease, ease) backwards; }
  @keyframes tuaToast { from { opacity: 0; transform: translateY(10px); } }
  .tua-chat-btn { display: block; width: 100%; min-height: 40px; box-sizing: border-box; padding: 9px 8px; border: none; border-radius: 12px; background: #FFFFFF; color: #027EB5; font-family: system-ui, sans-serif; font-size: 12.5px; font-weight: 600;
    text-align: center; box-shadow: 0 1px 1px rgba(0,0,0,.1); cursor: pointer; transition: opacity 150ms ease, transform 150ms ease; }
  .tua-chat-btn:disabled { cursor: default; opacity: 0.5; }
  .tua-chat-btn[aria-pressed='true'] { opacity: 1; }
  .tua-chat-btn:not(:disabled):active { transform: scale(0.98); }
  .tua-chat-btn:focus-visible, .tua-chat-otra:focus-visible { outline: 2px solid #027EB5; outline-offset: 2px; }
  .tua-chat-otra { align-self: center; min-height: 32px; padding: 0 12px; border: none; border-radius: 999px; background: rgba(255,255,255,.85); color: #54656F; font-family: system-ui, sans-serif; font-size: 11.5px; font-weight: 600; cursor: pointer; }
  .tua-chat-sale { animation: tuaToast 240ms var(--tuo-ease, ease) backwards; }

  @media (hover: hover) {
    .tua-vbtn:hover { filter: brightness(1.08); }
    .tua-vlink:hover, .tua-btn-txt:hover { text-decoration: underline; }
    .tua-chat-btn:not(:disabled):hover { background: #F5F6F6; }
    .tua-escena:hover .tua-tel { transform: perspective(1600px) rotateY(0deg) rotateX(0deg) translateY(-4px); }
    .tua-sec:hover { border-color: color-mix(in srgb, var(--color-primary) 24%, var(--color-border)); box-shadow: var(--shadow-card-hover); }
    .tua-maestro:hover { border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border)); }
  }

  @media (max-width: 1100px) {
    .tua-cols { grid-template-columns: minmax(0, 1fr); }
    .tua-sticky { position: static; }
    .tua-hero { grid-template-columns: minmax(0, 1fr); }
    .tua-pantalla { height: 560px; }
    .tua-tel { transform: none; }
  }
  @media (max-width: 640px) {
    .tua-kpis { grid-template-columns: minmax(0, 1fr); }
    .tua-2 { grid-template-columns: minmax(0, 1fr); }
    .tua-hero { padding: 18px; }
    .tua-sec { padding: 16px; }
    .tua-hero-cab { flex-direction: column; }
  }
  @media (max-width: 768px) {
    /* Dedo: 44px de alto en todo lo que se toca; 16px en los campos para que iOS no haga zoom. */
    .tua-opc, .tua-chat-btn, .tua-chat-otra, .tua-vbtn--chico { min-height: 44px !important; }
    .tua-btn-txt { display: inline-block; padding: 12px 0 !important; }
    .tua-vcampo { font-size: 16px; min-height: 44px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .tua-toast, .tua-chat-sale { animation: none !important; }
    .tua-opc, .tua-vbtn, .tua-chat-btn { transition: none; transform: none !important; }
    .tua-entra, .tua-pantalla-in, .tua-sec, .tua-maestro-txt, .tua-hero-ico > svg, .tua-escena > svg > g { animation: none !important; }
    .tua-tel { transform: none !important; transition: none; }
    .tua-maestro, .tua-maestro::before, .tua-hero-ico > span, .tua-hero-ico > span::before { transition: none; }
  }
`

// ─── Controles ────────────────────────────────────────────────────────────────

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className="tuo-switch tuc-switch" onClick={() => onChange(!on)} />
}

/** Fila con texto + interruptor (para opciones sí/no dentro de la config). */
export function FilaSwitch({ titulo, desc, on, onChange, Icon }: { titulo: string; desc?: string; on: boolean; onChange: (v: boolean) => void; Icon?: LucideIcon }) {
  return (
    <div className="tuc-fila" data-on={on}>
      <div className="tuc-fila-cab">
        {Icon && <span className="tuc-fila-ico" aria-hidden><Icon size={16} strokeWidth={1.7} /></span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="tuc-fila-titulo">{titulo}</div>
          {desc && <div className="tuc-ayuda">{desc}</div>}
        </div>
        <Switch on={on} onChange={onChange} label={titulo} />
      </div>
    </div>
  )
}

/** Grupo de opciones excluyentes. Envuelve en varias líneas cuando son muchas. */
export function Segmentado<T extends string | number>({ opciones, valor, onChange, label }: { opciones: { valor: T; label: string }[]; valor: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="tuc-seg">
      {opciones.map(o => (
        <button key={String(o.valor)} type="button" role="radio" aria-checked={o.valor === valor} onClick={() => onChange(o.valor)}>{o.label}</button>
      ))}
    </div>
  )
}

export function Campo({ label, htmlFor, ayuda, children, style }: { label: string; htmlFor?: string; ayuda?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ marginBottom: 18, minWidth: 0, ...style }}>
      {htmlFor
        ? <label htmlFor={htmlFor} className="tuc-rotulo" style={{ marginBottom: 8 }}>{label}</label>
        : <div className="tuc-rotulo" style={{ marginBottom: 8 }}>{label}</div>}
      {children}
      {ayuda && <div className="tuc-ayuda" style={{ marginTop: 7 }}>{ayuda}</div>}
    </div>
  )
}

// Los campos se pintan con la clase tuc-field; estos objetos quedan para los
// ajustes de medida que cada pantalla le suma encima (ancho, alto).
export const inputStyle: CSSProperties = { width: '100%' }
export const textareaStyle: CSSProperties = { width: '100%', minHeight: 100 }

/** Bloque de la columna de config, con título y bajada. */
export function Seccion({ titulo, desc, children, accion, Icon }: { titulo: string; desc?: string; children: ReactNode; accion?: ReactNode; Icon?: LucideIcon }) {
  return (
    <section aria-label={titulo} className="tuo-card tuo-card--luz tua-sec">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {Icon && <span className="tuc-card-ico" aria-hidden><Icon size={18} strokeWidth={1.7} /></span>}
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <h2 className="tuo-h2">{titulo}</h2>
          {desc && <p className="tuc-card-bajada">{desc}</p>}
        </div>
        {accion}
      </div>
      {children}
    </section>
  )
}

/** Número de contexto. La nota dice siempre si es un dato de ejemplo. */
export function Dato({ label, valor, nota, Icon, acento = 'var(--color-primary)' }: { label: string; valor: string; nota?: string; Icon?: LucideIcon; acento?: string }) {
  return <Indicador label={label} valor={valor} nota={nota} Icon={Icon ?? Sparkles} color={acento} />
}

export function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="tua-aviso" role="note">
      <Info size={15} aria-hidden style={{ flexShrink: 0, marginTop: 2, color: 'var(--color-primary)' }} />
      <div>{children}</div>
    </div>
  )
}

/** Botón de solo ícono (borrar, subir, bajar): 34px en escritorio, 44px en celular. Siempre con `label`. */
export function BotonIcono({ Icon, label, onClick, disabled, peligro, style }: { Icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; peligro?: boolean; style?: CSSProperties }) {
  return (
    <button type="button" className={`tuc-icono${peligro ? ' tuc-icono--peligro' : ''}`} aria-label={label} title={label} disabled={disabled} onClick={onClick} style={style}>
      <Icon size={15} aria-hidden />
    </button>
  )
}

/** Copia al portapapeles. Si el navegador no deja (sin https, sin permiso) prueba con el método viejo. */
export async function copiarTexto(valor: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(valor)
      return true
    }
  } catch { /* sigue con el método viejo */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = valor
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

// ─── Badges ───────────────────────────────────────────────────────────────────

export function BadgeEstado({ on }: { on: boolean }) {
  return (
    <span className={`tuo-chip${on ? ' tuo-chip--ok' : ''}`} style={{ height: 24, fontSize: 11.5, transition: 'background 240ms ease, color 240ms ease' }}>
      <span aria-hidden className={on ? 'tuo-late' : undefined} style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', opacity: on ? 1 : 0.6 }} />
      {on ? 'Activo' : 'Inactivo'}
    </span>
  )
}
export function BadgePlan() {
  return <span className="tuo-chip" style={{ height: 24, fontSize: 11.5, background: 'var(--color-violet-bg)', color: 'var(--chip-violet-fg)' }}><Sparkles size={11} aria-hidden />Avanzado</span>
}
export function BadgeRecomendado({ rubro }: { rubro: RubroTurnos }) {
  return (
    <span className="tuo-chip tuo-chip--primario" style={{ whiteSpace: 'normal', height: 'auto', minHeight: 24, lineHeight: 1.3, padding: '3px 10px', fontSize: 11.5 }}>
      <Sparkles size={11} aria-hidden style={{ flexShrink: 0 }} /> Recomendado para {rubro.label.toLowerCase()}
    </span>
  )
}

// ─── Cabecera de función ──────────────────────────────────────────────────────

/** Ícono grande con halo y una órbita que gira cuando la función está prendida. */
export function IconoOrbita({ Icon }: { Icon: LucideIcon }) {
  return (
    <span className="tua-hero-ico" aria-hidden>
      <svg viewBox="0 0 96 96">
        <circle cx="48" cy="48" r="46" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 6" />
        <circle cx="48" cy="2" r="3.2" fill="currentColor" />
      </svg>
      <span><Icon size={27} strokeWidth={1.7} /></span>
    </span>
  )
}

// ─── Armazón de cada función ──────────────────────────────────────────────────

interface ShellProps {
  funcion: Funcion
  rubro: RubroTurnos
  activo: boolean
  onActivo: (v: boolean) => void
  onVolver: () => void
  /** Texto largo debajo del título. */
  bajada: string
  /** Qué pasa con el interruptor prendido, en una línea. */
  textoOn: string
  kpis?: ReactNode
  children: ReactNode
  preview: ReactNode
}

export function ShellFuncion({ funcion, rubro, activo, onActivo, onVolver, bajada, textoOn, kpis, children, preview }: ShellProps) {
  const [guardado, setGuardado] = useState(false)
  useEffect(() => {
    if (!guardado) return
    const t = setTimeout(() => setGuardado(false), 2600)
    return () => clearTimeout(t)
  }, [guardado])

  const grupo = grupoPorId(funcion.grupo)
  return (
    <div className="tuo panel-page tua-pantalla-in">
      <EstiloTurnos />
      <style>{CSS_AVANZADO}</style>
      <Volver a="Avanzado" onClick={onVolver} espacio="suelto" />

      <header className="tuo-card tuo-card--luz tua-hero tuo-entra" data-on={activo}>
        <div className="tua-hero-cab" style={{ display: 'flex', alignItems: 'flex-start', gap: 18, minWidth: 0 }}>
          <IconoOrbita Icon={funcion.Icon} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="tuo-eyebrow" style={{ marginBottom: 8 }}>Avanzado · {grupo.label}</div>
            <h1 className="tuo-h1">{funcion.label}</h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              <BadgeEstado on={activo} />
              <BadgePlan />
              {funcion.recomendada(rubro) && <BadgeRecomendado rubro={rubro} />}
            </div>
            <p className="tuo-bajada" style={{ marginTop: 12 }}>{bajada}</p>
          </div>
        </div>

        {/* Interruptor maestro: decide si todo lo de abajo se ve en el sitio. Toda la tarjeta es el
            área de toque; el botón de adentro es el que lleva el rol y el foco. */}
        <label className="tua-maestro" data-on={activo}>
          <Switch on={activo} onChange={onActivo} label={`${funcion.label}: ${activo ? 'activo' : 'apagado'}`} />
          <div key={String(activo)} className="tua-maestro-txt" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--tuo-fh)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-text)' }}>{activo ? 'Activo en tu sitio de reservas' : 'Apagado'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 3, lineHeight: 1.5 }}>
              {activo ? textoOn : 'Podés dejar todo configurado y prenderlo cuando quieras. Tus clientes no ven nada mientras esté apagado.'}
            </div>
          </div>
        </label>
      </header>

      {kpis && <div className="tua-kpis">{kpis}</div>}

      <div className="tua-cols">
        <div style={{ minWidth: 0 }}>
          {children}
          <div className="tua-guardar">
            <Boton variant="primary" onClick={() => setGuardado(true)} icon={guardado ? <Check size={15} strokeWidth={2.4} aria-hidden /> : undefined}>
              {guardado ? 'Guardado' : 'Guardar cambios'}
            </Boton>
            <span role="status" style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>
              {guardado ? 'Demo: los cambios quedan solo en esta pantalla.' : ''}
            </span>
          </div>
        </div>
        <div className="tua-sticky">{preview}</div>
      </div>
    </div>
  )
}

// ─── "Así lo ve tu cliente" ───────────────────────────────────────────────────

const AvisoVistaCtx = createContext<(texto: string) => void>(() => {})
/** Muestra un aviso adentro del celular de la vista previa. Solo anda debajo de VistaCliente. */
export const useAvisoVista = () => useContext(AvisoVistaCtx)

/** Link a una página del sitio de la demo, con el rubro que se está mirando. */
export const linkSitio = (rubro: RubroTurnos, pagina: 'negocio' | 'negocio/servicios' | 'reserva' | 'mis-turnos') =>
  `/turnos-demo/${pagina}?rubro=${encodeURIComponent(rubro.key)}`

/**
 * Botón del sitio adentro del celular. Con `href` abre esa página del sitio en
 * otra pestaña (así no se pierde lo que se estaba configurando); sin `href`
 * contesta con un aviso en el celular que cuenta qué pasaría en el sitio real.
 */
export function BotonVista({ children, aviso, href, variante = 'primario', chico, style }: { children: ReactNode; aviso?: string; href?: string; variante?: 'primario' | 'borde' | 'suave'; chico?: boolean; style?: CSSProperties }) {
  const avisar = useAvisoVista()
  const clase = `tua-vbtn${variante === 'primario' ? '' : ` tua-vbtn--${variante}`}${chico ? ' tua-vbtn--chico' : ''}`
  if (href) return <a className={clase} href={href} target="_blank" rel="noreferrer" style={style}>{children}<span className="tuc-sr"> (abre en otra pestaña)</span></a>
  return <button type="button" className={clase} style={style} onClick={() => avisar(aviso ?? 'Demo: en tu sitio este botón sigue al paso siguiente.')}>{children}</button>
}

/**
 * Celular pintado con la identidad del negocio (tema.ts): las mismas
 * variables --color-* que usa el sitio real, así el preview se ve como el
 * sitio de ese rubro y no como el panel. Es la estrella de la columna derecha:
 * marco con brillo, isla, leve inclinación que se endereza al acercar el mouse.
 */
export function VistaCliente({ rubro, titulo = 'Así lo ve tu cliente', nota, children, fondo, cabecera = true }: { rubro: RubroTurnos; titulo?: string; nota?: ReactNode; children: ReactNode; fondo?: string; /** false = pantalla completa (ej. un chat de WhatsApp). */ cabecera?: boolean }) {
  const t = temaDe(rubro)
  useEffect(() => { cargarFuentes() }, [])
  const tintaEstado = cabecera ? t.c.text : '#FFFFFF'
  // Aviso del celular: lo que se toca adentro de la vista previa responde acá. El número
  // hace que el mismo texto dos veces seguidas vuelva a entrar y reinicie el reloj.
  const [aviso, setAviso] = useState<{ texto: string; n: number } | null>(null)
  const avisar = useCallback((texto: string) => setAviso(a => ({ texto, n: (a?.n ?? 0) + 1 })), [])
  useEffect(() => {
    if (!aviso) return
    const id = setTimeout(() => setAviso(null), 3400)
    return () => clearTimeout(id)
  }, [aviso])
  return (
    <section aria-label={titulo} className="tuo-card tuo-card--luz tua-vista tuo-entra" style={{ ['--i' as string]: 2 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="tuo-rotulo" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><Eye size={12} aria-hidden style={{ color: 'var(--color-primary)' }} />Vista previa</div>
          <h2 className="tuo-h2">{titulo}</h2>
          <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>{nota ?? 'Con datos de ejemplo. Se actualiza mientras editás.'}</p>
        </div>
        <span className="tuo-chip tuo-chip--ok" style={{ height: 22, fontSize: 11 }}><span aria-hidden className="tuo-late" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />En vivo</span>
      </div>

      <div className="tua-escena">
        <svg aria-hidden viewBox="0 0 560 560">
          <circle cx="280" cy="280" r="276" fill="none" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1" strokeDasharray="2 8" />
          <circle cx="280" cy="280" r="214" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1" />
          <g><circle cx="280" cy="66" r="4" fill="currentColor" /><circle cx="280" cy="66" r="9" fill="currentColor" opacity="0.2" /></g>
        </svg>
        <div className="tua-tel">
          <div className="tua-pantalla" style={{ ...(variablesTema(t) as CSSProperties), background: fondo ?? t.c.bg, color: t.c.body, fontFamily: t.fb }}>
            <div aria-hidden className="tua-pantalla-estado" style={{ color: tintaEstado, background: cabecera ? t.c.bg : '#075E54' }}>
              <span>9:41</span>
              <span className="tua-isla" />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Signal size={13} strokeWidth={2.4} /><Wifi size={13} strokeWidth={2.4} /><BatteryFull size={17} strokeWidth={1.8} /></span>
            </div>
            {cabecera && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 16px 11px', borderBottom: `1px solid ${t.c.border}`, background: t.c.bg, flexShrink: 0 }}>
                <span style={{ width: 28, height: 28, borderRadius: t.radio > 10 ? 9 : '50%', background: t.c.primary, color: t.c.onPrimary, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, fontFamily: t.fh, flexShrink: 0 }}>{t.nombre[0]}</span>
                <span style={{ fontFamily: t.fh, fontWeight: 700, fontSize: 15, color: t.c.text, textTransform: t.mayus ? 'uppercase' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nombre}</span>
              </div>
            )}
            <div className="tua-pantalla-cuerpo" style={{ padding: cabecera ? '14px 14px 26px' : 0 }}>
              <AvisoVistaCtx.Provider value={avisar}>{children}</AvisoVistaCtx.Provider>
            </div>
            <div role="status" className="tua-toast-zona">
              {aviso && <div key={aviso.n} className="tua-toast"><Check size={14} strokeWidth={2.6} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />{aviso.texto}</div>}
            </div>
            <span aria-hidden className="tua-pantalla-base" style={{ color: cabecera ? t.c.text : '#111B21' }} />
          </div>
        </div>
      </div>
    </section>
  )
}

/** Fuente de títulos y colores del negocio, para las piezas que van dentro de VistaCliente. */
export const temaPreview = (rubro: RubroTurnos) => temaDe(rubro)

/**
 * Chat de WhatsApp genérico (sin marca): burbuja entrante del negocio. Los
 * botones se pueden tocar: sale la respuesta del cliente y contesta el negocio
 * con lo que devuelva `respuesta`.
 */
export function ChatWhatsApp({ negocio, children, botones, hora = '10:24', pantalla, respuesta }: { negocio: string; children: ReactNode; botones?: string[]; hora?: string; /** Ocupa toda la pantalla del celular. */ pantalla?: boolean; /** Qué contesta el negocio a cada botón. */ respuesta?: (boton: string) => string }) {
  const [elegido, setElegido] = useState<string | null>(null)
  const burbuja: CSSProperties = { maxWidth: '92%', width: 'fit-content', color: '#111B21', padding: '9px 11px 6px', fontSize: 12.5, lineHeight: 1.5, boxShadow: '0 1px 1px rgba(0,0,0,.1)', fontFamily: 'system-ui, sans-serif', whiteSpace: 'pre-line', overflowWrap: 'anywhere' }
  return (
    <div style={pantalla ? { flex: '1 0 auto', background: '#EFE7DD', display: 'flex', flexDirection: 'column' } : { borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(0,0,0,.08)', background: '#EFE7DD' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px 10px', background: '#075E54', color: '#fff' }}>
        <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,.22)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{negocio[0]}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{negocio}</div>
          <div style={{ fontSize: 10.5, opacity: 0.85 }}>Cuenta de empresa</div>
        </div>
      </div>
      <div style={{ padding: 12, flex: 1, backgroundImage: 'radial-gradient(rgba(0,0,0,.05) 1px, transparent 1px)', backgroundSize: '14px 14px' }}>
        {pantalla && <div style={{ textAlign: 'center', margin: '4px 0 12px' }}><span style={{ fontSize: 10.5, padding: '3px 9px', borderRadius: 7, background: '#FFFFFF', color: '#54656F', fontFamily: 'system-ui, sans-serif', boxShadow: '0 1px 1px rgba(0,0,0,.08)' }}>HOY</span></div>}
        <div style={{ maxWidth: '92%', background: '#fff', color: '#111B21', borderRadius: '0 12px 12px 12px', padding: '9px 11px 6px', fontSize: 12.5, lineHeight: 1.5, boxShadow: '0 1px 1px rgba(0,0,0,.1)', fontFamily: 'system-ui, sans-serif', whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
          {children}
          <div style={{ textAlign: 'right', fontSize: 10, color: '#667781', marginTop: 3 }}>{hora}</div>
        </div>
        {botones && (
          <div style={{ maxWidth: '92%', display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
            {botones.map(b => (
              <button key={b} type="button" className="tua-chat-btn" aria-pressed={elegido === b} disabled={elegido !== null && elegido !== b} onClick={() => setElegido(b)}>{b}</button>
            ))}
          </div>
        )}
        <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: elegido ? 10 : 0 }}>
          {elegido && (
            <>
              <div className="tua-chat-sale" style={{ ...burbuja, alignSelf: 'flex-end', background: '#D9FDD3', borderRadius: '12px 0 12px 12px' }}>
                <span className="tuc-sr">Respuesta del cliente: </span>{elegido}
                <div aria-hidden style={{ textAlign: 'right', fontSize: 10, color: '#667781', marginTop: 3 }}>{hora}</div>
              </div>
              <div className="tua-chat-sale" style={{ ...burbuja, background: '#fff', borderRadius: '0 12px 12px 12px', animationDelay: '320ms' }}>
                {respuesta?.(elegido) ?? '¡Listo! Ya quedó anotado.'}
                <div aria-hidden style={{ textAlign: 'right', fontSize: 10, color: '#667781', marginTop: 3 }}>{hora}</div>
              </div>
              <button type="button" className="tua-chat-otra" onClick={() => setElegido(null)}>Probar otra respuesta</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
