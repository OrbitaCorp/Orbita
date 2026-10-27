// Piezas propias del panel de Alquileres (prefijo ala-): el indicador con
// ícono y variación (las medidas de la KpiCard de Tienda: rótulo de 12 px en
// mayúsculas, ícono en un chip de 32, valor mono de 30 y la variación contra
// el período anterior), la barra de guardar de las páginas de configuración y
// la fila de cabecera de una lista. Lo genérico (campos, modal, tabla, chips)
// viene del kit de reservas del design system; acá va solo lo que el kit no
// tiene todavía (pedido en pedidos-kit-alquileres.md).
import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export const CSS_PANEL = `
  .ala-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  /* Cada tarjeta es un contenedor: el número se achica con el ancho de SU tarjeta, no con el de la pantalla. */
  .ala-kpi { padding: 16px; min-width: 0; container-type: inline-size; }
  .ala-kpi-cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
  .ala-kpi-label { font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-muted); line-height: 1.3; }
  .ala-kpi-ico { width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; display: grid; place-items: center; background: var(--color-primary-bg); color: var(--color-primary); }
  .ala-kpi-valor { font-family: var(--rv-mono); font-size: clamp(20px, 13cqi, 30px); font-weight: 700; letter-spacing: -0.02em; line-height: 1; color: var(--color-text); overflow-wrap: anywhere; margin-bottom: 10px; }
  .ala-kpi-pie { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
  /* El chip neutro (sin cambio, sin datos previos) va en tinta de cuerpo: muted sobre surface-alt no llegaba a AA. */
  .ala-kpi-delta { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 6px; font-family: var(--rv-mono); font-size: 12px; font-weight: 600; white-space: nowrap; background: var(--color-surface-alt); color: var(--color-body); }
  .ala-kpi-delta[data-tono='ok'] { background: var(--color-success-bg); color: var(--chip-success-fg); }
  .ala-kpi-delta[data-tono='mal'] { background: var(--color-error-bg); color: var(--chip-error-fg); }
  .ala-kpi-nota { font-size: 11.5px; color: var(--color-muted); min-width: 0; }
  @media (max-width: 1024px) { .ala-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 640px) {
    .ala-kpis { gap: 8px; }
    .ala-kpi { padding: 13px; }
    .ala-kpi-cab { margin-bottom: 8px; }
    .ala-kpi-label { font-size: 10.5px; letter-spacing: 0.02em; }
    .ala-kpi-ico { width: 26px; height: 26px; border-radius: 7px; }
    .ala-kpi-ico > svg { width: 14px; height: 14px; }
    .ala-kpi-valor { margin-bottom: 7px; }
    .ala-kpi-pie { flex-direction: column; align-items: flex-start; gap: 3px; }
    .ala-kpi-delta { height: 20px; padding: 0 6px; font-size: 11px; }
  }

  /* La barra de guardar: al pie de la página, con el estado a la izquierda y los botones a la derecha. */
  .ala-guardar { display: flex; align-items: center; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--color-border); }
  .ala-guardar > .rv-fila { flex-wrap: nowrap; }
  @media (max-width: 640px) {
    .ala-guardar > .rv-fila { width: 100%; }
    .ala-guardar > .rv-fila > .rv-btn { flex: 1 1 auto; }
  }

  /* Una fila de la lista con su rótulo y su acción a la derecha. */
  .ala-cab-lista { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }

  /* La ayuda de una página: un renglón chico al pie de una tarjeta. */
  .ala-pie-nota { margin: 12px 0 0; font-size: 12.5px; line-height: 1.45; color: var(--color-muted); }

  /* Tres indicadores (Clientes): tres columnas; en celular dos, y el tercero a todo el ancho. */
  .ala-kpis--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  @media (max-width: 640px) {
    .ala-kpis--3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .ala-kpis--3 > :last-child:nth-child(odd) { grid-column: 1 / -1; }
  }
`

export const EstiloPanelAlquileres = () => <style>{CSS_PANEL}</style>

/** La variación de un indicador contra el período anterior. `unidades`: se muestra el número (con `sufijo`, p. ej. " pts"), no un %. `invertir`: que suba es malo. */
export interface Delta { valor: number | null; unidades?: boolean; sufijo?: string; invertir?: boolean; vs?: string }

const TOPE_PCT = 999

/**
 * Un indicador: rótulo, ícono en un chip, el valor y la variación contra el
 * período anterior. Sin período anterior (null) la variación no se inventa:
 * queda el chip neutro con "sin datos previos".
 */
export function Kpi({ label, valor, Icon, delta, nota, i = 0 }: { label: string; valor: ReactNode; Icon: LucideIcon; delta?: Delta; nota?: ReactNode; i?: number }) {
  let chip: ReactNode = null
  if (delta) {
    const v = delta.valor
    if (v === null) chip = <span className="ala-kpi-delta">– sin datos previos</span>
    else {
      const sube = v > 0
      const neutro = v === 0
      const bueno = delta.invertir ? !sube : sube
      const abs = Math.abs(v)
      const texto = delta.unidades ? `${Math.round(abs)}${delta.sufijo ?? ''}` : abs > TOPE_PCT ? `>${TOPE_PCT}%` : `${abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(1)}%`
      const exacto = delta.unidades ? undefined : `${sube ? '+' : '-'}${abs.toLocaleString('es-AR', { maximumFractionDigits: 1 })}% vs ${delta.vs ?? 'el período anterior'}`
      chip = <span className="ala-kpi-delta" data-tono={neutro ? undefined : bueno ? 'ok' : 'mal'} title={exacto}>{neutro ? '–' : sube ? '▲' : '▼'} {texto}</span>
    }
  }
  return (
    <div className="rv-card ala-kpi rv-entra" style={{ ['--i' as string]: i } as CSSProperties}>
      <div className="ala-kpi-cab">
        <span className="ala-kpi-label">{label}</span>
        <span className="ala-kpi-ico" aria-hidden><Icon size={16} strokeWidth={1.5} /></span>
      </div>
      <div className="ala-kpi-valor">{valor}</div>
      <div className="ala-kpi-pie">
        {chip}
        <span className="ala-kpi-nota">{nota ?? (delta ? `vs ${delta.vs ?? 'el período anterior'}` : null)}</span>
      </div>
    </div>
  )
}

/**
 * El pie de una página de configuración: qué pasa con el borrador. "Guardar"
 * se habilita con cambios; `nota` reemplaza el estado cuando hay algo que
 * impide guardar ("Marcá al menos un día").
 */
export function Guardar({ cambiado, onGuardar, onDescartar, nota, deshabilitado }: { cambiado: boolean; onGuardar: () => void; onDescartar?: () => void; nota?: string; deshabilitado?: boolean }) {
  return (
    <div className="ala-guardar">
      <span className="rv-ayuda" role="status">{nota ?? (cambiado ? 'Tenés cambios sin guardar.' : 'Todo guardado.')}</span>
      <span className="rv-fila" style={{ gap: 8 }}>
        {onDescartar && cambiado && <button type="button" className="rv-btn" onClick={onDescartar}>Descartar</button>}
        <button type="button" className="rv-btn rv-btn--primario" onClick={onGuardar} disabled={!cambiado || deshabilitado}>Guardar cambios</button>
      </span>
    </div>
  )
}
