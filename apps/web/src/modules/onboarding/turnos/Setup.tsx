import { Check, Scissors, Feather, Palette, Sparkles, Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SetupUnificado, type PrimerPasoProps } from '@/modules/onboarding/SetupUnificado'

// ─── Data del primer paso (específico de turnos) ──────────────────────────────

const SERVICIOS: { key: string; Icon: LucideIcon; label: string; descripcion: string }[] = [
  { key: 'corte',       Icon: Scissors, label: 'Corte de cabello',    descripcion: 'Damas, caballeros y niños'   },
  { key: 'barba',       Icon: Feather,  label: 'Barba / Afeitado',    descripcion: 'Arreglo y diseño de barba'   },
  { key: 'coloracion',  Icon: Palette,  label: 'Coloración',          descripcion: 'Tinte, mechas y balayage'    },
  { key: 'tratamiento', Icon: Sparkles, label: 'Tratamiento capilar', descripcion: 'Hidratación, keratina y más' },
  { key: 'otro',        Icon: Plus,     label: 'Otro servicio',       descripcion: 'Configurá desde cero'        },
]

// ─── Primer paso ──────────────────────────────────────────────────────────────

function StepServicios({ seleccion, toggle }: PrimerPasoProps) {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 6px' }}>
          ¿Qué servicios ofrecés?
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0 }}>
          Podés elegir varios. Los configuramos para que se adapten a tu negocio.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 10 }}>
        {SERVICIOS.map(s => {
          const sel = seleccion.includes(s.key)
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
                <s.Icon size={19} strokeWidth={1.75} color={sel ? 'var(--color-primary)' : '#3B82F6'} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.4 }}>{s.descripcion}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

const SERVICIOS_OPTIONS = SERVICIOS.map(s => ({ key: s.key, label: s.label, description: s.descripcion }))

export function TurnosSetup() {
  return (
    <SetupUnificado
      primerPasoLabel="Tus servicios"
      PrimerPaso={StepServicios}
      successPath="/onboarding/plan?next=/onboarding/turnos/success"
      firstStepOptions={SERVICIOS_OPTIONS}
    />
  )
}
