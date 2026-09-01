import { useState, useEffect, useMemo } from 'react'
import { Check } from 'lucide-react'
import { SetupUnificado, type PrimerPasoProps } from '@/modules/onboarding/SetupUnificado'
import { getRubrosCatalog, type Subrubro as ApiSubrubro } from '@/lib/api'
import { getIcon } from '@/modules/onboarding/iconMap'
import { Skeleton } from '@/design-system/components/Skeleton'

const TIPO_BADGE: Record<string, string | null> = {
  variantes: '✦ Matriz de talles / variantes',
  serie:     '✦ N° de serie / IMEI',
  volumen:   '✦ Cantidad variable',
  simple:    null,
}

// ─── Primer paso ──────────────────────────────────────────────────────────────

type StepTipoProps = PrimerPasoProps & { subrubros: ApiSubrubro[]; cargando: boolean }

function StepTipo({ seleccion, toggle, subrubros, cargando }: StepTipoProps) {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 6px' }}>
          ¿Qué tipo de productos vendés?
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0 }}>
          Podés elegir varios. Configuramos los atributos según cada rubro.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 10 }}>
        {cargando
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ padding: '13px 13px 12px', borderRadius: 14, border: '1.5px solid var(--color-border)', background: 'var(--color-surface)' }}>
                <Skeleton width={38} height={38} radius={10} style={{ display: 'block', marginBottom: 9 }} />
                <Skeleton width="70%" height={13} radius={4} style={{ display: 'block', marginBottom: 6 }} />
                <Skeleton width="90%" height={11} radius={4} style={{ display: 'block' }} />
              </div>
            ))
          : subrubros.map(s => {
          const sel   = seleccion.includes(s.key)
          const badge = TIPO_BADGE[s.tipo] ?? null
          const Icon  = getIcon(s.icon)
          return (
            <button
              key={s.key}
              onClick={() => toggle(s.key)}
              style={{
                position: 'relative', textAlign: 'left', padding: '13px 13px 12px', borderRadius: 14,
                border:     `2px solid ${sel ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: sel ? 'rgba(59,130,246,0.05)' : 'var(--color-bg)',
                cursor: 'pointer', transition: 'all 150ms ease',
                boxShadow: sel ? '0 0 0 3px rgba(59,130,246,0.12)' : 'none',
              }}
              onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = 'var(--color-primary)' }}
              onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = 'var(--color-border)'  }}
            >
              {sel && (
                <div style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={10} color="white" strokeWidth={3} />
                </div>
              )}
              <div style={{ width: 38, height: 38, borderRadius: 10, marginBottom: 9, background: sel ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={19} strokeWidth={1.75} color={sel ? 'var(--color-primary)' : '#3B82F6'} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.4, marginBottom: badge ? 8 : 0 }}>{s.descripcion}</div>
              {badge && (
                <div style={{ fontSize: 10, fontWeight: 600, color: '#6366F1', background: 'rgba(99,102,241,0.08)', borderRadius: 6, padding: '3px 7px', display: 'inline-flex' }}>
                  {badge}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Toggle especial: "de todo un poco" limpia el resto
function toggleTienda(prev: string[], key: string): string[] {
  if (key === 'detodo') return ['detodo']
  const sinDetodo = prev.filter(k => k !== 'detodo')
  return sinDetodo.includes(key)
    ? sinDetodo.filter(k => k !== key)
    : [...sinDetodo, key]
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function TiendaSetup() {
  const [subrubros, setSubrubros] = useState<ApiSubrubro[]>([])
  const [cargando,  setCargando]  = useState(true)

  useEffect(() => {
    getRubrosCatalog()
      .then(({ rubros }) => setSubrubros(rubros.find(r => r.key === 'tienda')?.subrubros ?? []))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  // Identidad estable del componente (solo cambia cuando llegan los datos)
  // para no perder el estado de `seleccion` que vive en SetupUnificado.
  const PrimerPasoConectado = useMemo(() => {
    return (props: PrimerPasoProps) => <StepTipo {...props} subrubros={subrubros} cargando={cargando} />
  }, [subrubros, cargando])

  const firstStepOptions = useMemo(
    () => subrubros.map(s => ({ key: s.key, label: s.label, description: s.descripcion })),
    [subrubros],
  )

  return (
    <SetupUnificado
      primerPasoLabel="Tipo de tienda"
      PrimerPaso={PrimerPasoConectado}
      toggleFn={toggleTienda}
      conModoVenta={true}
      successPath="/onboarding/plan?next=/onboarding/tienda/success"
      firstStepOptions={firstStepOptions}
    />
  )
}
