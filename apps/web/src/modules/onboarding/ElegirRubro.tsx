import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { Check, ChevronRight, ChevronLeft, type LucideIcon } from 'lucide-react'
import { Skeleton } from '@/design-system/components/Skeleton'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'
import { OrbiPanel } from '@/components/orbi/OrbiPanel'
import { OrbiIcon } from '@/components/orbi/OrbiIcon'
import { useOrbiStore } from '@/components/orbi/useOrbiStore'
import { useOrbiKeyboardShortcut } from '@/components/orbi/useOrbiKeyboardShortcut'
import { setWizardContext } from '@/components/orbi/useOrbiContext'
import { track, trackPaso } from '@/lib/analytics/wizardTracker'
import { useOrbiSafeArea } from '@/components/orbi/useOrbiSafeArea'
import { getRubrosCatalog, type Rubro as ApiRubro, type Categoria as ApiCategoria } from '@/lib/api'
import { getIcon } from './iconMap'
import { useOnboardingStore } from './useOnboardingStore'
import { BarraPasos, pasosOnboarding, labelPasoRubro } from './BarraPasos'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Filtro = 'todos' | string

// Único rubro funcional hoy — el resto del catálogo (traído de la API) se
// muestra como roadmap "Próximamente", sin ruta de setup propia todavía.
const RUTA_SETUP: Record<string, string> = {
  tienda: '/onboarding/tienda/setup',
}


// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      padding: 14, borderRadius: 14,
      border: '1.5px solid var(--color-border)',
      background: 'var(--color-surface)',
    }}>
      <Skeleton width={40} height={40} radius={10} style={{ display: 'block', marginBottom: 10 }} />
      <Skeleton width="60%" height={13} radius={4}  style={{ display: 'block', marginBottom: 6  }} />
      <Skeleton width="90%" height={11} radius={4}  style={{ display: 'block', marginBottom: 3  }} />
      <Skeleton width="75%" height={11} radius={4}  style={{ display: 'block', marginBottom: 10 }} />
      <Skeleton width={72}  height={11} radius={10} style={{ display: 'block' }} />
    </div>
  )
}

// El logo vive en design-system/components/OrbitaLogo: el orbital animado
// oficial (el de la pantalla de carga), en vez de un SVG estático distinto acá.

// ─── ElegirRubro ─────────────────────────────────────────────────────────────

export function ElegirRubro() {
  const router = useRouter()
  const setWizard = useOnboardingStore(s => s.setWizard)

  const [filtro,         setFiltro]         = useState<Filtro>('todos')
  const [seleccionado,   setSeleccionado]   = useState<string>('')
  const toggleOrbi = useOrbiStore(s => s.toggle)
  useOrbiKeyboardShortcut()
  const [cargando,       setCargando]       = useState(true)
  const [error,          setError]          = useState('')
  const [categorias,     setCategorias]     = useState<ApiCategoria[]>([])
  const [rubros,         setRubros]         = useState<ApiRubro[]>([])
  const headerRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  useOrbiSafeArea(headerRef, footerRef, [seleccionado])

  useEffect(() => {
    getRubrosCatalog()
      .then(({ categorias, rubros }) => { setCategorias(categorias); setRubros(rubros) })
      .catch(() => setError('No pudimos cargar los rubros. Recargá la página.'))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    const disponibles = rubros.filter(r => r.disponible)
    setWizardContext({
      step: 0,
      stepName: 'elegir-rubro',
      availableOptions: disponibles.map(r => ({ key: r.key, label: r.label, description: r.descripcion })),
    })
  }, [rubros])

  // Punto de entrada del embudo: todo lo que se mide después es un porcentaje
  // de la gente que llegó hasta acá.
  useEffect(() => {
    track('session_start')
    trackPaso(0, 'rubro')
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const { key } = (e as CustomEvent).detail
      const rubro = rubros.find(r => r.key === key)
      if (rubro?.disponible) {
        setSeleccionado(key)
        setWizard({ rubro: rubro.key, subrubros: [] })
        router.push(RUTA_SETUP[rubro.key] ?? '/onboarding/proximamente')
      }
    }
    window.addEventListener('orbi:select-option', handler)
    return () => window.removeEventListener('orbi:select-option', handler)
  }, [rubros])

  const visibles = (filtro === 'todos' ? rubros : rubros.filter(r => r.categoria === filtro))
    .slice()
    .sort((a, b) => Number(b.disponible) - Number(a.disponible))

  function elegirRubro(r: ApiRubro) {
    if (!r.disponible) return
    setSeleccionado(prev => prev === r.key ? '' : r.key)
  }

  function continuar() {
    const rubro = rubros.find(r => r.key === seleccionado)
    if (!rubro) return
    track('step_next', { step: 0, stepName: 'rubro', rubro: rubro.key })
    setWizard({ rubro: rubro.key, subrubros: [] })
    router.push(RUTA_SETUP[rubro.key] ?? '/onboarding/proximamente')
  }

  const rubroSelec = rubros.find(r => r.key === seleccionado)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>

      {/* ── Header ── */}
      <div ref={headerRef} style={{
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', height: 56, padding: '0 28px',
        background: 'var(--color-bg)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <a href="/" className="ds-hover" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', borderRadius: 8 }}>
          <OrbitaLogo size={24} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Órbita</span>
        </a>

        <a href="/login" className="ds-hover ob-login-link" style={{ marginLeft: 'auto', textDecoration: 'none', fontSize: 13, color: 'var(--color-muted)', whiteSpace: 'nowrap', borderRadius: 6 }}>
          ¿Ya tenés cuenta?{' '}
          <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Iniciá sesión</span>
        </a>
      </div>

      {/* ── La barra única del onboarding: mismo recorrido que va a seguir en
           el setup y el pago — acá con "Rubro" como paso actual, y el paso 2
           mostrando el label real apenas elige un rubro. Reemplaza al viejo
           stepper de 3 pasos (Rubro/Negocio/Listo) que hacía parecer que
           había DOS wizards distintos. */}
      <BarraPasos pasos={pasosOnboarding(labelPasoRubro(seleccionado))} actual={0} />

      {/* ── Contenido ── */}
      <div style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: `0 24px ${seleccionado ? '104px' : '48px'}`,
      }}>

        {/* Atrás */}
        <div style={{ paddingTop: 28, marginBottom: 4 }}>
          <a
            href="/"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              textDecoration: 'none', fontSize: 13, fontWeight: 600,
              color: 'var(--color-muted)', transition: 'color 150ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-muted)')}
          >
            <ChevronLeft size={15} />
            Atrás
          </a>
        </div>

        {/* Título */}
        <div style={{ textAlign: 'center', paddingTop: 20, marginBottom: 32 }}>
          <h1 className="ob-rubro-h1" style={{
            fontSize: 30, fontWeight: 800, letterSpacing: '-0.025em',
            color: 'var(--color-text)', margin: '0 0 8px',
          }}>
            ¿Qué tipo de negocio tenés?
          </h1>
          <p style={{ fontSize: 15, color: 'var(--color-muted)', margin: 0 }}>
            Elegí el rubro principal de tu negocio.
          </p>
        </div>

        {error && (
          <div style={{
            marginBottom: 20, padding: '10px 14px', borderRadius: 10, textAlign: 'center',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            fontSize: 13, color: 'var(--color-error)',
          }}>
            {error}
          </div>
        )}

        {/* ── Filtros ── */}
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto',
          paddingBottom: 4, marginBottom: 28,
          scrollbarWidth: 'none',
        }}>
          {[{ key: 'todos', label: 'Todos', icon: '' }, ...categorias].map(({ key, label, icon }) => {
            const activo = filtro === key
            const FIcon: LucideIcon | null = icon ? getIcon(icon) : null
            return (
              <button
                key={key}
                onClick={() => setFiltro(key)}
                className="ds-hover"
                style={{
                  flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 15px',
                  borderRadius: 999,
                  border: activo ? '1.5px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                  background: activo ? 'var(--color-primary-bg)' : 'var(--color-surface)',
                  color: activo ? 'var(--color-primary)' : 'var(--color-body)',
                  fontSize: 13, fontWeight: activo ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 150ms',
                  whiteSpace: 'nowrap',
                }}
              >
                {FIcon && <FIcon size={13} strokeWidth={1.75} />}
                {label}
              </button>
            )
          })}
        </div>

        {/* ── Grid de rubros ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 10,
        }}>
          {cargando
            ? Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)
            : visibles.map(rubro => {
            const { key, icon, label, descripcion, disponible } = rubro
            const Icon = getIcon(icon)
            const sel = seleccionado === key

            return (
              <button
                key={key}
                onClick={() => elegirRubro(rubro)}
                style={{
                  position: 'relative',
                  textAlign: 'left',
                  padding: '14px',
                  borderRadius: 14,
                  border: sel
                    ? '2px solid var(--color-primary)'
                    : '1.5px solid var(--color-border)',
                  background: sel
                    ? 'rgba(59,130,246,0.05)'
                    : (disponible ? 'var(--color-bg)' : 'var(--color-surface)'),
                  cursor: disponible ? 'pointer' : 'default',
                  transition: 'all 150ms ease',
                  boxShadow: sel ? '0 0 0 3px rgba(59,130,246,0.12)' : 'none',
                  opacity: disponible ? 1 : 0.6,
                }}
                onMouseEnter={e => {
                  if (disponible && !sel) {
                    e.currentTarget.style.borderColor = 'var(--color-primary)'
                    e.currentTarget.style.transform   = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow   = '0 4px 16px rgba(59,130,246,0.1)'
                  }
                }}
                onMouseLeave={e => {
                  if (!sel) {
                    e.currentTarget.style.borderColor = 'var(--color-border)'
                    e.currentTarget.style.transform   = 'translateY(0)'
                    e.currentTarget.style.boxShadow   = 'none'
                  }
                }}
              >
                {sel && (
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'var(--color-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={10} color="white" strokeWidth={3} />
                  </div>
                )}

                <div style={{
                  width: 40, height: 40, borderRadius: 10, marginBottom: 10,
                  background: disponible
                    ? (sel ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.07)')
                    : 'rgba(100,116,139,0.07)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon
                    size={20}
                    strokeWidth={1.75}
                    color={disponible ? (sel ? 'var(--color-primary)' : '#3B82F6') : 'var(--color-muted)'}
                  />
                </div>

                <div style={{
                  fontSize: 13, fontWeight: 600, marginBottom: 3,
                  color: disponible ? 'var(--color-text)' : 'var(--color-muted)',
                }}>
                  {label}
                </div>

                <div style={{
                  fontSize: 11, lineHeight: 1.45, marginBottom: 10,
                  color: 'var(--color-muted)',
                }}>
                  {descripcion}
                </div>

                {disponible ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#10B981' }}>Disponible</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-subtle)' }}>
                    <span style={{ fontSize: 10 }}>✦</span>
                    <span style={{ fontSize: 11 }}>Próximamente</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Barra de continuar ── */}
      {seleccionado && (
        <div ref={footerRef} className="ob-bottom-bar" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '14px 32px',
          background: 'var(--color-bg)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.07)',
          animation: 'fadeUp 0.3s ease forwards',
          zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {rubroSelec && (() => { const Icon = getIcon(rubroSelec.icon); return <Icon size={18} strokeWidth={1.75} color="var(--color-primary)" /> })()}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 1 }}>
                {rubroSelec?.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                Rubro principal seleccionado
              </div>
            </div>
          </div>
          <button
            onClick={continuar}
            className="ds-hover"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 22px',
              borderRadius: 10, border: 'none',
              background: '#2563EB', color: 'white',
              fontSize: 14, fontWeight: 700,
              boxShadow: '0 4px 16px rgba(37,99,235,0.35)',
            }}
          >
            Continuar <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* ── Orbi ── */}
      <OrbiPanel />

      <button
        onClick={toggleOrbi}
        title="Orbi AI"
        style={{
          position: 'fixed', bottom: 90, right: 24, zIndex: 170,
          width: 48, height: 48, borderRadius: '50%',
          background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
          border: 'none', cursor: 'pointer',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
          transition: 'transform 150ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        <OrbiIcon size={22} color="white" />
      </button>
    </div>
  )
}
