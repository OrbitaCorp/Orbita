// Piezas del panel de Gimnasio que comparten sus pantallas: las muestras de
// color del equipo, el punto de color de cada profe, las filas de una lista
// editable y la hoja de estilos del panel (prefijo gip-). Pintan con los tokens
// del design system y las clases rv- del kit de reservas; el indicador con
// ícono y variación, el borrador y la barra de guardar son del kit
// (design-system/reservas/piezas.tsx). Nada de acá sabe de clases ni de socios.
import { useId, type CSSProperties } from 'react'
import { Check } from 'lucide-react'
import type { NegocioGym } from '../datos'

/** Lo que recibe cada pantalla de configuración: el negocio y cómo guardar un cambio (con el aviso que se muestra). */
export interface PropsConfig { negocio: NegocioGym; onGuardar: (cambio: Partial<NegocioGym>, aviso?: string, detalle?: string) => void }

export const CSS_PANEL = `
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
