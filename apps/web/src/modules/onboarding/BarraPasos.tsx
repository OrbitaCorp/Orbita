// ─── Barra de pasos ÚNICA de todo el onboarding ──────────────────────────────
//
// Antes había DOS wizards visuales para un solo camino: la página de rubro
// mostraba "Rubro · Negocio · Listo" (3 pasos) y el setup, adentro, otra barra
// de 5 — y el dueño no entendía dónde estaba parado ni cuántos pasos faltaban
// de verdad. Pedido explícito: un solo recorrido, mostrado igual en todas las
// pantallas (rubro → setup → pago), con lo ya hecho tildado.
//
// El markup es el que vivía en SetupUnificado (extraído tal cual): la franja
// de escritorio (.ob-inner-progress) y el indicador compacto de mobile
// (.ob-mobile-step) — sus reglas responsive ya están en globals.css.

import { Fragment } from 'react'
import { Check } from 'lucide-react'

/** El recorrido completo, de punta a punta. El paso 2 depende del rubro. */
export function pasosOnboarding(segundoPaso: string): string[] {
  return ['Rubro', segundoPaso, 'Tu negocio', 'Ubicación', 'Tu cuenta', 'Pago']
}

/** Label del paso 2 según el rubro elegido (genérico si todavía no hay). */
export function labelPasoRubro(rubro: string): string {
  if (!rubro) return 'Qué ofrecés'
  return rubro === 'tienda' ? 'Tipo de tienda' : 'Tus servicios'
}

export function BarraPasos({ pasos, actual }: { pasos: string[]; actual: number }) {
  return (
    <>
      {/* ── Escritorio: la franja con todos los pasos ── */}
      <div className="ob-inner-progress" style={{
        borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)',
        padding: '0 28px', overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 480 }}>
          {pasos.map((label, i) => {
            const done    = i < actual
            const current = i === actual
            const isLast  = i === pasos.length - 1
            return (
              <Fragment key={label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 0', flexShrink: 0, opacity: (done || current) ? 1 : 0.45 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700,
                    background: done ? '#10B981' : current ? '#2563EB' : 'var(--color-surface-alt)',
                    color:      (done || current) ? 'white' : 'var(--color-subtle)',
                    boxShadow:  current ? '0 0 0 3px rgba(37,99,235,0.2)' : 'none',
                    transition: 'all 300ms',
                  }}>
                    {done ? <Check size={10} strokeWidth={3} /> : i + 1}
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: current ? 600 : 500, whiteSpace: 'nowrap',
                    color: current ? 'var(--color-text)' : done ? '#10B981' : 'var(--color-muted)',
                    transition: 'color 300ms',
                  }}>
                    {label}
                  </span>
                </div>
                {!isLast && (
                  <div style={{ flex: 1, height: 1, margin: '0 10px', background: done ? '#10B981' : 'var(--color-border)', transition: 'background 300ms', minWidth: 20 }} />
                )}
              </Fragment>
            )
          })}
        </div>
      </div>

      {/* ── Mobile: indicador compacto (solo <640px, ver globals.css) ── */}
      <div className="ob-mobile-step" style={{
        display: 'none', borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)', padding: '10px 16px',
        alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
          background: '#2563EB', color: 'white', fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {actual + 1}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
          {pasos[actual]}
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
          · {actual + 1} de {pasos.length}
        </span>
      </div>
    </>
  )
}
