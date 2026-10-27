// Piezas del panel de Gimnasio que comparten sus pantallas: el indicador con
// ícono (la KpiCard de Tienda: rótulo en mayúsculas, ícono en chip, valor en
// mono y la variación), la barra de guardar de los formularios, el borrador
// que se compara con lo guardado, las muestras de color del equipo y la hoja
// de estilos del panel (prefijo gip-). Pintan con los tokens del design system
// y las clases rv- del kit de reservas; nada de acá sabe de clases ni de socios.
//
// Lo que acá se repite del kit (el KPI con ícono y delta, el radio de color)
// está pedido como pieza del kit; mientras tanto vive acá con CSS del módulo.
import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Check, RotateCcw } from 'lucide-react'
import type { NegocioGym } from '../datos'

/** Lo que recibe cada pantalla de configuración: el negocio y cómo guardar un cambio (con el aviso que se muestra). */
export interface PropsConfig { negocio: NegocioGym; onGuardar: (cambio: Partial<NegocioGym>, aviso?: string, detalle?: string) => void }

export const CSS_PANEL = `
  /* ── Indicadores (la KpiCard de Tienda) ── */
  .gip-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .gip-kpis--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .gip-kpi { padding: 16px; display: flex; flex-direction: column; min-width: 0; }
  .gip-kpi-cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 14px; }
  .gip-kpi-rotulo { font-size: 12px; font-weight: 600; line-height: 1.3; letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-muted); }
  .gip-kpi-ico { width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; display: grid; place-items: center; background: var(--color-primary-bg); color: var(--color-primary); }
  .gip-kpi-ico[data-tono='aviso'] { background: var(--color-warning-bg); color: var(--chip-warning-fg); }
  .gip-kpi-ico[data-tono='error'] { background: var(--color-error-bg); color: var(--chip-error-fg); }
  .gip-kpi-ico[data-tono='ok'] { background: var(--color-success-bg); color: var(--chip-success-fg); }
  .gip-kpi-valor { font-family: var(--rv-mono); font-size: 30px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; color: var(--color-text); margin-bottom: 10px; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
  /* Una cifra larga ($3.739.000) baja de tamaño antes de cortarse. */
  .gip-kpi-valor[data-largo='true'] { font-size: 24px; }
  .gip-kpi-pie { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; margin-top: auto; font-size: 11.5px; line-height: 1.4; color: var(--color-muted); }
  .gip-kpi-delta { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 6px; flex-shrink: 0; font-family: var(--rv-mono); font-size: 12px; font-weight: 600; white-space: nowrap; background: var(--color-surface-alt); color: var(--color-muted); }
  .gip-kpi-delta[data-tono='bien'] { background: var(--color-success-bg); color: var(--chip-success-fg); }
  .gip-kpi-delta[data-tono='mal'] { background: var(--color-error-bg); color: var(--chip-error-fg); }
  @media (max-width: 1024px) { .gip-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 640px) { .gip-kpis, .gip-kpis--3 { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } }
  /* La densidad de celular de Tienda (globals.css, .ds-kpi-*): mismas piezas, más chicas, dos por fila. */
  @media (max-width: 480px) {
    .gip-kpi { padding: 13px; }
    .gip-kpi-cab { margin-bottom: 8px; }
    .gip-kpi-rotulo { font-size: 10.5px; letter-spacing: 0.02em; }
    .gip-kpi-ico { width: 26px; height: 26px; border-radius: 7px; }
    .gip-kpi-ico > svg { width: 14px; height: 14px; }
    .gip-kpi-valor, .gip-kpi-valor[data-largo='true'] { font-size: 21px; margin-bottom: 7px; }
    .gip-kpi-pie { flex-direction: column; align-items: flex-start; gap: 3px; }
    .gip-kpi-delta { height: 20px; padding: 0 6px; font-size: 11px; }
  }

  /* ── Barra de guardar: aparece abajo cuando hay cambios y queda a la vista mientras se baja ── */
  .gip-guardar { position: sticky; bottom: 12px; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 10px 14px; flex-wrap: wrap; margin-top: 20px; padding: 10px 10px 10px 16px; border-radius: 12px; border: 1px solid var(--color-border-strong); background: var(--color-bg); box-shadow: 0 10px 30px rgba(0,0,0,0.14); animation: rvModal 200ms var(--rv-ease); }
  .gip-guardar > span { flex: 1 1 200px; min-width: 0; font-size: 13.5px; font-weight: 500; color: var(--color-text); }
  .gip-guardar > span > small { display: block; font-weight: 400; color: var(--color-muted); font-size: 12.5px; margin-top: 1px; }
  .gip-guardar-btns { display: flex; gap: 8px; }
  @media (max-width: 640px) { .gip-guardar { bottom: 8px; padding: 10px 12px; } .gip-guardar-btns { width: 100%; } .gip-guardar-btns > .rv-btn { flex: 1; } }

  /* ── Muestras de color (radios de verdad: Tab entra una vez, las flechas eligen) ── */
  .gip-swatches { display: flex; gap: 10px; flex-wrap: wrap; }
  .gip-swatch { position: relative; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: var(--c); color: #fff; }
  .gip-swatch > input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; border-radius: 50%; }
  .gip-swatch:has(> input:checked) { box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--c); }
  .gip-swatch:has(> input:focus-visible) { outline: 2px solid var(--color-primary); outline-offset: 4px; }
  @media (max-width: 768px) { .gip-swatch { width: 44px; height: 44px; } }

  /* ── El punto de color de cada profe, al lado de su nombre ── */
  .gip-punto { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--c, var(--color-border-strong)); flex-shrink: 0; vertical-align: 1px; margin-right: 5px; }

  /* ── Filas de una lista editable (una actividad, una sala, un plan) ── */
  .gip-filas { display: flex; flex-direction: column; }
  .gip-fila { display: grid; gap: 8px 10px; align-items: end; padding: 12px 0; border-top: 1px solid var(--color-border); }
  .gip-fila:first-child { border-top: none; padding-top: 0; }
  .gip-fila:last-child { padding-bottom: 0; }
`

/**
 * Un indicador, como la KpiCard de Tienda: rótulo arriba, ícono en su chip,
 * el valor en mono y, debajo, la variación (si la hay) con una nota corta.
 * `delta` es un porcentaje contra el período anterior o, con `unidades`, una
 * cantidad; `invertir` da vuelta el color cuando subir es malo.
 */
export function KpiGym({ label, valor, Icon, tono, delta, nota, i = 0 }: {
  label: string; valor: string; Icon: LucideIcon; tono?: 'primario' | 'aviso' | 'error' | 'ok'
  delta?: { valor: number; unidades?: boolean; invertir?: boolean }; nota?: ReactNode; i?: number
}) {
  const d = delta
  const sube = !!d && d.valor > 0
  const neutro = !d || d.valor === 0
  const bien = !!d && (d.invertir ? !sube : sube)
  const txt = d ? (d.unidades ? String(Math.abs(Math.round(d.valor))) : `${Math.abs(d.valor) > 999 ? '>999' : Math.abs(d.valor).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`) : ''
  return (
    <div className="rv-card gip-kpi rv-entra" style={{ ['--i' as string]: i } as CSSProperties}>
      <div className="gip-kpi-cab">
        <span className="gip-kpi-rotulo">{label}</span>
        <span className="gip-kpi-ico" data-tono={tono} aria-hidden><Icon size={16} strokeWidth={1.5} /></span>
      </div>
      <span className="gip-kpi-valor" data-largo={valor.length > 9 || undefined} title={valor}>{valor}</span>
      <div className="gip-kpi-pie">
        {d && (
          <span className="gip-kpi-delta" data-tono={neutro ? undefined : bien ? 'bien' : 'mal'} aria-label={neutro ? 'Sin cambios' : `${sube ? 'Subió' : 'Bajó'} ${txt}`}>
            {neutro ? '–' : sube ? '▲' : '▼'} {neutro ? '' : txt}
          </span>
        )}
        {nota && <span>{nota}</span>}
      </div>
    </div>
  )
}

/**
 * El borrador de un formulario: arranca igual a lo guardado y sabe si cambió.
 * `set` toca una clave; `descartar` vuelve a lo guardado.
 */
export function useBorrador<T extends object>(base: T) {
  const [v, setV] = useState(base)
  const cambiado = JSON.stringify(v) !== JSON.stringify(base)
  return {
    v, setV, cambiado,
    set: <K extends keyof T>(k: K, x: T[K]) => setV(a => ({ ...a, [k]: x })),
    descartar: () => setV(base),
  }
}

/**
 * La barra de guardar: solo aparece con cambios, pegada abajo mientras se
 * sigue bajando. `motivo` es por qué todavía no se puede guardar ("Marcá al
 * menos un día"): se muestra y el botón queda apagado.
 */
export function BarraGuardar({ cambiado, onGuardar, onDescartar, motivo, nota }: { cambiado: boolean; onGuardar: () => void; onDescartar: () => void; motivo?: string; nota?: string }) {
  if (!cambiado) return null
  return (
    <div className="gip-guardar" role="region" aria-label="Cambios sin guardar">
      <span>{motivo ?? 'Tenés cambios sin guardar.'}{nota && !motivo && <small>{nota}</small>}</span>
      <span className="gip-guardar-btns">
        <button type="button" className="rv-btn" onClick={onDescartar}><RotateCcw size={15} aria-hidden /> Descartar</button>
        <button type="button" className="rv-btn rv-btn--primario" onClick={onGuardar} disabled={!!motivo}><Check size={15} aria-hidden /> Guardar cambios</button>
      </span>
    </div>
  )
}

/** Muestras de color para elegir una: un grupo de radios, con el tilde en la elegida. */
export function Swatches({ label, colores, valor, onChange }: { label: string; colores: string[]; valor: string; onChange: (c: string) => void }) {
  const nombre = useId()
  return (
    <div className="rv-campo">
      <span>{label}</span>
      <div className="gip-swatches" role="radiogroup" aria-label={label}>
        {colores.map(c => (
          <span key={c} className="gip-swatch" style={{ ['--c' as string]: c } as CSSProperties}>
            <input type="radio" name={nombre} value={c} checked={valor === c} onChange={() => onChange(c)} aria-label={`Color ${c}`} />
            {valor === c && <Check size={16} strokeWidth={3} aria-hidden />}
          </span>
        ))}
      </div>
    </div>
  )
}

/** El punto de color de un profe (o gris si la clase quedó sin profe). */
export const Punto = ({ color }: { color?: string }) => <i className="gip-punto" style={color ? ({ ['--c' as string]: color } as CSSProperties) : undefined} aria-hidden />

/** Un número escrito a mano: solo dígitos, nunca negativo. */
export const num = (s: string) => Math.max(0, Math.round(Number(s.replace(/\D/g, '')) || 0))
