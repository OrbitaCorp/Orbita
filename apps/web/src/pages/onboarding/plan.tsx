import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Check, Shield, Zap, HeadphonesIcon, Globe, Percent, FileText, Printer, ArrowRight } from 'lucide-react'
import { completeOnboarding, publishBusiness, uploadLogo, dataUrlToBlob, startPendingCheckout, ApiError } from '@/lib/api'
import { useOnboardingStore } from '@/modules/onboarding/useOnboardingStore'
import { useAuth } from '@/hooks/useAuth'
import { tenantUrl } from '@/lib/tenant'

const FEATURES = [
  { texto: 'Panel de administración completo'      },
  { texto: 'Subdominio .orbita.site incluido'      },
  { texto: 'Sin comisiones por venta o turno'      },
  { texto: 'Soporte prioritario por WhatsApp'      },
  { texto: 'Cancelá cuando quieras, sin penalidad' },
]

// Resumen de alto nivel, NO una re-lista de los pasos granulares del wizard
// (esos ya se mostraron en SetupUnificado.tsx, incluyendo "Pago" como último
// ítem desde el principio — ver PENDIENTES.md). Acá solo queda un paso real:
// confirmar el pago.
const PASOS = ['Configuración', 'Pago']

const N_COMPROBANTE = 'OB-2025-004817'
const FECHA_HOY = new Date().toLocaleDateString('es-AR', {
  day: '2-digit', month: 'long', year: 'numeric',
})

// ─── Logos ──────────────────────────────────────────────────────────────────

function OrbitaLogo({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 30 30" fill="none" style={{ width: size, height: size, flexShrink: 0 }}>
      <circle cx="15" cy="15" r="13" stroke="#2563eb" strokeWidth="3.2" strokeDasharray="60 22" strokeLinecap="round"/>
      <circle cx="25.5" cy="7.5" r="4" fill="#93c5fd"/>
      <circle cx="15" cy="15" r="4.5" fill="#1e3a8a"/>
    </svg>
  )
}

function MercadoPagoLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="24" fill="#009EE3"/>
      <path d="M8 24c0-8.837 7.163-16 16-16 4.418 0 8.418 1.791 11.314 4.686L24 24H8z" fill="white" opacity=".9"/>
      <path d="M24 24l11.314-11.314A15.96 15.96 0 0 1 40 24c0 8.837-7.163 16-16 16-4.418 0-8.418-1.791-11.314-4.686L24 24z" fill="white" opacity=".6"/>
    </svg>
  )
}

// ─── Header con stepper (compartido) ────────────────────────────────────────

function Header() {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', height: 56, padding: '0 28px',
      background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
    }}>
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
        <OrbitaLogo size={24} />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Órbita</span>
      </a>
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {PASOS.map((paso, i) => {
          const done    = i < 1
          const current = i === 1
          return (
            <div key={paso} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: done ? '#10B981' : current ? '#2563EB' : 'var(--color-surface-alt)',
                  color: (done || current) ? 'white' : 'var(--color-subtle)',
                }}>
                  {done ? <Check size={11} strokeWidth={3} /> : i + 1}
                </div>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: current ? 'var(--color-text)' : done ? '#10B981' : 'var(--color-subtle)',
                }}>
                  {paso}
                </span>
              </div>
              {i < PASOS.length - 1 && (
                <div style={{ width: 24, height: 1, background: done ? '#10B981' : 'var(--color-border)' }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Pantalla 1: Selección de plan ──────────────────────────────────────────

// Atajo para entrar al panel sin pasar por el cobro. Solo se muestra si la
// variable de entorno lo habilita, así en producción no queda una vía para
// saltearse el pago (ver PENDIENTES.md).
const PERMITE_OMITIR_PAGO = process.env.NEXT_PUBLIC_ALLOW_SKIP_PAYMENT === 'true'

function PlanScreen({ onPagar, onOmitir, error }: { onPagar: () => void; onOmitir: () => void; error?: string }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-surface)', fontFamily: 'inherit' }}>
      <Header />
      <div style={{
        maxWidth: 480, margin: '0 auto',
        padding: '52px 24px 80px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', marginBottom: 20,
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563EB 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(37,99,235,0.35)',
        }}>
          <OrbitaLogo size={36} />
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 8px', textAlign: 'center' }}>
          Activá tu cuenta
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 36px', textAlign: 'center', lineHeight: 1.5 }}>
          Tu negocio está configurado. Elegí el plan de inicio para publicar tu espacio en Órbita.
        </p>

        {error && (
          <div style={{
            width: '100%', marginBottom: 20, padding: '10px 14px', borderRadius: 10,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            fontSize: 12.5, color: 'var(--color-error)', textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <div style={{
          width: '100%',
          background: 'var(--color-bg)',
          border: '2px solid var(--color-primary)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(37,99,235,0.12)',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563EB 100%)',
            padding: '24px 28px 20px',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: 16, right: 16,
              background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)',
              borderRadius: 999, padding: '4px 12px',
              fontSize: 11, fontWeight: 700, color: 'white',
              border: '1px solid rgba(255,255,255,0.25)',
            }}>
              ✦ PLAN INICIAL
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
              Órbita Starter
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 42, fontWeight: 900, color: 'white', letterSpacing: '-0.03em', lineHeight: 1 }}>
                $5.000
              </span>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', paddingBottom: 6 }}>
                / 3 meses
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              $1.667 por mes · Sin renovación automática
            </div>
          </div>

          <div style={{ padding: '20px 28px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {FEATURES.map(({ texto }) => (
                <div key={texto} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: 'rgba(16,185,129,0.10)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={12} strokeWidth={3} color="#10B981" />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--color-body)' }}>{texto}</span>
                </div>
              ))}
            </div>

            <button
              onClick={onPagar}
              style={{
                width: '100%', height: 52, borderRadius: 12, border: 'none',
                background: '#009EE3', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0,158,227,0.40)',
                transition: 'all 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#0085C1'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#009EE3'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <MercadoPagoLogo />
              Pagar con MercadoPago
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 }}>
              <Shield size={11} strokeWidth={2} color="var(--color-subtle)" />
              <span style={{ fontSize: 11, color: 'var(--color-subtle)' }}>
                Pago 100% seguro · Encriptado por MercadoPago
              </span>
            </div>
          </div>
        </div>

        {PERMITE_OMITIR_PAGO && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', margin: '24px 0 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
              <span style={{ fontSize: 12, color: 'var(--color-subtle)', whiteSpace: 'nowrap' }}>o si preferís</span>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            </div>

            <button
              onClick={onOmitir}
              style={{
                marginTop: 16, background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: 'var(--color-muted)', fontWeight: 500,
                textDecoration: 'underline', textUnderlineOffset: 3,
                transition: 'color 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-muted)' }}
            >
              Omitir pago y entrar al panel
            </button>

            <p style={{ fontSize: 11, color: 'var(--color-subtle)', marginTop: 8, textAlign: 'center' }}>
              Atajo de desarrollo — no disponible en producción
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Pantalla 2: Procesando ──────────────────────────────────────────────────

function ProcesandoScreen() {
  const [dots, setDots] = useState(1)

  useEffect(() => {
    const t = setInterval(() => setDots(d => (d % 3) + 1), 500)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 28, padding: 24, fontFamily: 'inherit',
    }}>
      <style>{`
        @keyframes mpSpin    { to { transform: rotate(360deg) } }
        @keyframes mpPulse   { 0%,100%{ opacity:.3;transform:scale(.7) } 50%{ opacity:1;transform:scale(1) } }
        @keyframes mpFadeUp  { from { opacity:0;transform:translateY(12px) } to { opacity:1;transform:translateY(0) } }
      `}</style>

      {/* Spinner + logo MP */}
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '3px solid rgba(0,158,227,0.15)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '3px solid transparent',
          borderTopColor: '#009EE3',
          animation: 'mpSpin 0.85s linear infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MercadoPagoLogo size={36} />
        </div>
      </div>

      {/* Texto */}
      <div style={{ textAlign: 'center', animation: 'mpFadeUp 0.5s ease' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
          Conectando con MercadoPago
        </div>
        <div style={{ fontSize: 14, color: 'var(--color-muted)', lineHeight: 1.6 }}>
          Procesando tu pago de forma segura{'.'.repeat(dots)}<br />
          <span style={{ fontSize: 12 }}>No cerrés esta ventana.</span>
        </div>
      </div>

      {/* Dots loader */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: 8, height: 8, borderRadius: '50%', background: '#009EE3',
              animation: `mpPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Seguridad */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 999,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}>
        <Shield size={12} color="var(--color-subtle)" />
        <span style={{ fontSize: 11, color: 'var(--color-subtle)' }}>
          Pago encriptado · 100% seguro
        </span>
      </div>
    </div>
  )
}

// ─── Pantalla 3: Pago exitoso ────────────────────────────────────────────────

function ExitoScreen({ irAlPanel }: { irAlPanel: () => void }) {
  const DETALLES: [string, string][] = [
    ['Plan',    'Órbita Starter'],
    ['Monto',   '$5.000 ARS'],
    ['Período', '3 meses'],
    ['Fecha',   FECHA_HOY],
    ['Método',  'MercadoPago'],
    ['N° comp.', N_COMPROBANTE],
  ]

  function verComprobante() {
    window.open(`/onboarding/pago-comprobante`, '_blank')
  }
  function imprimir() {
    const w = window.open(`/onboarding/pago-comprobante?print=1`, '_blank')
    if (w) w.focus()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-surface)', fontFamily: 'inherit' }}>
      <style>{`
        @keyframes exitoScale { from { opacity:0;transform:scale(0.5) } to { opacity:1;transform:scale(1) } }
        @keyframes exitoFade  { from { opacity:0;transform:translateY(16px) } to { opacity:1;transform:translateY(0) } }
      `}</style>

      <Header />

      <div style={{
        maxWidth: 480, margin: '0 auto',
        padding: '52px 24px 80px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>

        {/* Check animado */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(16,185,129,0.40)',
          marginBottom: 20,
          animation: 'exitoScale 0.55s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          <Check size={40} color="white" strokeWidth={2.5} />
        </div>

        <div style={{ textAlign: 'center', animation: 'exitoFade 0.5s ease 0.1s both' }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 8px' }}>
            ¡Pago confirmado!
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0, lineHeight: 1.5 }}>
            Tu cuenta <strong style={{ color: 'var(--color-text)' }}>Órbita Starter</strong> está activa.
          </p>
        </div>

        {/* Card comprobante */}
        <div style={{
          width: '100%', marginTop: 32,
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          animation: 'exitoFade 0.5s ease 0.2s both',
        }}>
          {/* Encabezado verde */}
          <div style={{
            background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
            padding: '16px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
                Comprobante de pago
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'white', fontFamily: '"Geist Mono", monospace' }}>
                {N_COMPROBANTE}
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 999, padding: '4px 12px',
            }}>
              <Check size={11} strokeWidth={3} color="white" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>Aprobado</span>
            </div>
          </div>

          {/* Detalle */}
          <div style={{ padding: '4px 0' }}>
            {DETALLES.map(([label, valor], i) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 20px',
                borderBottom: i < DETALLES.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {label}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: label === 'N° comp.' || label === 'Monto' ? '"Geist Mono", monospace' : 'inherit' }}>
                  {valor}
                </span>
              </div>
            ))}
          </div>

          {/* Botones comprobante */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '14px 20px 18px' }}>
            <button
              onClick={verComprobante}
              style={{
                height: 40, borderRadius: 8, border: '1px solid var(--color-border)',
                background: 'var(--color-bg)', color: 'var(--color-text)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transition: 'background 150ms',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--color-bg)'}
            >
              <FileText size={14} strokeWidth={1.5} /> Ver
            </button>
            <button
              onClick={imprimir}
              style={{
                height: 40, borderRadius: 8, border: '1px solid var(--color-border)',
                background: 'var(--color-bg)', color: 'var(--color-text)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transition: 'background 150ms',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--color-bg)'}
            >
              <Printer size={14} strokeWidth={1.5} /> Imprimir
            </button>
          </div>
        </div>

        {/* Separador */}
        <div style={{ height: 1, background: 'var(--color-border)', width: '100%', margin: '28px 0' }} />

        {/* CTA continuar */}
        <button
          onClick={irAlPanel}
          style={{
            width: '100%', height: 52, borderRadius: 12, border: 'none',
            background: 'var(--color-primary)', color: 'white',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 16px rgba(37,99,235,0.30)',
            transition: 'all 150ms',
            animation: 'exitoFade 0.5s ease 0.35s both',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#1D4ED8'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-primary)'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          Continuar al panel
          <ArrowRight size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function PlanPage() {
  const router = useRouter()
  const next   = (router.query.next as string) ?? '/admin'
  const wizard      = useOnboardingStore(s => s.wizard)
  const resetWizard = useOnboardingStore(s => s.resetWizard)
  const { login } = useAuth()
  const [estado, setEstado] = useState<'plan' | 'procesando' | 'exito'>('plan')
  const [errorPago, setErrorPago] = useState('')
  const [subdominioListo, setSubdominioListo] = useState('')

  // Si no vino de completar el wizard (no hay rubro/credenciales cargadas),
  // no tiene nada que pagar/guardar — volver al principio. La contraseña NO
  // se persiste en localStorage (seguridad): si el usuario recargó esta
  // página, está vacía y necesita volver a ingresarla en el paso anterior.
  const passwordLost = !wizard.ownerPassword
  useEffect(() => {
    if (!wizard.rubro || !wizard.ownerEmail) router.push('/onboarding/rubro')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Crea la cuenta, el negocio y la sesión del dueño. El negocio queda SIN
  // publicar: sale al aire recién cuando MercadoPago confirma la suscripción
  // (ver subscriptions.service.ts). Si el usuario abandona en la pantalla de
  // MP, el negocio queda en borrador y no es visible para nadie.
  function activarNegocio() {
    const account = {
      ownerName: wizard.ownerName,
      email: wizard.ownerEmail,
      password: wizard.ownerPassword,
      businessName: wizard.nombre,
    }
    return completeOnboarding(account, wizard)
      .then(() => wizard.logoDataUrl ? uploadLogo(dataUrlToBlob(wizard.logoDataUrl), 'logo.png') : null)
      // El registro de onboarding emite su propio token de un solo uso (sin
      // refresh) — para dejar al dueño con la MISMA sesión que usa el resto
      // del panel (access en memoria + refresh httpOnly cross-subdominio),
      // logueamos acá con las credenciales recién creadas vía el flujo
      // estándar de auth (RBT-285/290), no con el token de onboarding.
      .then(() => login(account.email, account.password))
      .then(user => { if (user.type === 'member') setSubdominioListo(user.business.subdomain) })
  }

  function manejarError(err: unknown) {
    let msg = 'No se pudo procesar tu pago. Intentá de nuevo.'
    if (err instanceof ApiError) {
      if (err.message.includes('password')) msg = 'La contraseña no es válida. Volvé al paso anterior.'
      else if (err.status === 409) msg = 'Este email ya tiene un negocio registrado.'
      else msg = err.message
    }
    setErrorPago(msg)
    setEstado('plan')
  }

  // Manda al dueño a MercadoPago para que autorice el débito automático —
  // TODAVÍA no crea ninguna cuenta ni negocio. Los datos del wizard quedan
  // guardados temporalmente en el backend (PendingSignup) hasta que MP
  // confirme el pago; recién ahí se crea la cuenta real (ver
  // SubscriptionsService.confirmAndCreate, y la vuelta en
  // /onboarding/pago-retorno). Si el usuario abandona en la pantalla de MP,
  // no queda ningún Business/Member creado.
  function pagar() {
    if (passwordLost) {
      setErrorPago('Tu sesión expiró. Volvé al paso anterior para reingresar tu contraseña.')
      return
    }
    setErrorPago('')
    setEstado('procesando')
    const account = {
      ownerName: wizard.ownerName,
      email: wizard.ownerEmail,
      password: wizard.ownerPassword,
      businessName: wizard.nombre,
    }
    startPendingCheckout(account, wizard)
      .then(({ initPoint }) => {
        // Ya viaja todo al backend — se limpia antes de salir para que al
        // volver de MP no quede estado viejo dando vueltas.
        resetWizard()
        window.location.href = initPoint
      })
      .catch(manejarError)
  }

  // Atajo de desarrollo: crea la cuenta y publica el negocio sin pasar por el
  // cobro. Solo accesible con NEXT_PUBLIC_ALLOW_SKIP_PAYMENT=true.
  function omitirPago() {
    if (passwordLost) {
      setErrorPago('Tu sesión expiró. Volvé al paso anterior para reingresar tu contraseña.')
      return
    }
    setErrorPago('')
    setEstado('procesando')
    activarNegocio()
      .then(() => publishBusiness())
      .then(() => { resetWizard(); setEstado('exito') })
      .catch(manejarError)
  }

  function irAlPanel() {
    window.location.href = subdominioListo ? tenantUrl(subdominioListo, '/panel') : next
  }

  if (estado === 'procesando') return <ProcesandoScreen />
  if (estado === 'exito')      return <ExitoScreen irAlPanel={irAlPanel} />
  return <PlanScreen onPagar={pagar} onOmitir={omitirPago} error={errorPago || (passwordLost ? 'Tu sesión expiró. Volvé al paso anterior para reingresar tu contraseña.' : '')} />
}
