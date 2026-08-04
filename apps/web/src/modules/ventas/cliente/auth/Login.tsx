import { useState } from 'react'
import { useRouter } from 'next/router'
import { Mail, Lock, Eye } from 'lucide-react'
import { TIENDA } from '@/lib/storefront/mock'
import { useAuth } from '@/hooks/useAuth'
import { AuthError, googleLoginUrl } from '@/lib/auth/authClient'
import { currentSlug, storefrontBase } from '@/lib/tenant'

export default function Login() {
  const router = useRouter()
  const { login } = useAuth()

  const slug = (router.query.slug as string | undefined) ?? currentSlug() ?? ''
  const base = storefrontBase(slug)
  const returnTo = typeof router.query.returnTo === 'string' ? router.query.returnTo : ''

  const [email,  setEmail]  = useState('')
  const [pw,     setPw]     = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error,  setError]  = useState('')
  const [enviando, setEnviando] = useState(false)
  // Se activa con cuenta bloqueada (403, intentos fallidos) o rate-limit
  // (429) — reintentar de inmediato no tiene sentido en ninguno de los dos
  // casos. Se desactiva cuando el usuario edita email o contraseña.
  const [bloqueado, setBloqueado] = useState(false)

  function onEditarCampo(setter: (v: string) => void) {
    return (v: string) => {
      setter(v)
      if (bloqueado) setBloqueado(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !pw) {
      setError('Ingresá tu email y contraseña.')
      return
    }
    setEnviando(true)
    try {
      const user = await login(email.trim(), pw)
      // Un member de ESTA tienda logueándose desde el storefront → va al panel.
      if (user.type === 'member') {
        window.location.href = '/panel'
        return
      }
      // Customer → vuelve a returnTo (RBT-351) o al home del storefront.
      window.location.href = returnTo || `${base}/` || '/'
    } catch (err) {
      // Mapeo al contrato real del backend (ver notas): no existen códigos
      // INVALID_CREDENTIALS/ACCOUNT_LOCKED; se distingue por status + `error`.
      if (err instanceof AuthError) {
        if (err.status === 403 && err.code === 'NO_ACCOUNT_IN_BUSINESS') {
          setError('No tenés cuenta en esta tienda. Registrate para continuar.')
        } else if (err.status === 403) {
          // Único otro 403 del login: cuenta bloqueada por intentos fallidos.
          setError(err.message || 'Cuenta bloqueada. Intentá de nuevo en 15 minutos.')
          setBloqueado(true)
        } else if (err.status === 429) {
          setError('Demasiados intentos. Esperá unos minutos antes de volver a intentar.')
          setBloqueado(true)
        } else if (err.status === 401) {
          setError('Email o contraseña incorrectos.')
        } else {
          setError('No se pudo iniciar sesión. Intentá de nuevo.')
        }
      } else {
        setError('No se pudo iniciar sesión. Intentá de nuevo.')
      }
      setEnviando(false)
    }
  }

  function continuarSinCuenta() {
    // RBT-351: navegar libre sin cuenta; el checkout es el que exige login.
    window.location.href = returnTo || `${base}/` || '/'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-surface)', display: 'grid', placeItems: 'center', padding: '16px' }}>
      <style>{`
        @media (max-width: 480px) {
          .sf-login-card { width: 100% !important; padding: 24px !important; }
        }
      `}</style>
      <div className="sf-login-card" style={{
        width: 420,
        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
        borderRadius: 16, padding: 36,
        boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', textAlign: 'center', margin: '0 0 6px' }}>
          Ingresá a tu cuenta
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', textAlign: 'center', margin: '0 0 24px' }}>
          en {TIENDA.nombre}
        </p>
        <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 24 }} />

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: 'var(--color-error)',
            }}>
              {error}
            </div>
          )}

          <Field label="Email">
            <Input type="email" value={email} onChange={onEditarCampo(setEmail)} placeholder="tu@email.com"
              icon={<Mail size={15} strokeWidth={1.5} color="var(--color-subtle)" />} />
          </Field>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>Contraseña</label>
              <a href={`${base}/forgot-password`} style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 500, textDecoration: 'none' }}>¿Olvidaste?</a>
            </div>
            <Input
              type={showPw ? 'text' : 'password'}
              value={pw}
              onChange={onEditarCampo(setPw)}
              placeholder="••••••••"
              icon={<Lock size={15} strokeWidth={1.5} color="var(--color-subtle)" />}
              rightIcon={
                <button type="button" onClick={() => setShowPw(p => !p)} style={{ color: 'var(--color-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Eye size={15} strokeWidth={1.5} />
                </button>
              }
            />
          </div>

          <button type="submit" disabled={enviando || bloqueado} style={{
            width: '100%', height: 48, borderRadius: 10, marginTop: 8,
            background: (enviando || bloqueado) ? 'var(--color-surface-alt)' : 'var(--color-primary)', color: '#fff',
            fontSize: 14, fontWeight: 700, border: 'none', cursor: (enviando || bloqueado) ? 'default' : 'pointer',
            boxShadow: (enviando || bloqueado) ? 'none' : '0 4px 16px rgba(59,130,246,0.25)',
          }}>
            {enviando ? 'Ingresando…' : bloqueado ? 'Bloqueado temporalmente' : 'Ingresar'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--color-subtle)', fontSize: 11, margin: '4px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            <span>o continuá con</span>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          </div>

          <button type="button" onClick={() => { window.location.href = googleLoginUrl(slug) }} style={{
            width: '100%', height: 44, borderRadius: 10,
            background: 'var(--color-bg)', border: '1.5px solid var(--color-border)',
            fontSize: 13, fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <GoogleIcon /> Continuar con Google
          </button>

          <button type="button" onClick={continuarSinCuenta} style={{
            width: '100%', height: 44, borderRadius: 10,
            background: 'transparent', border: '1px solid var(--color-border)',
            fontSize: 13, fontWeight: 600, color: 'var(--color-body)', cursor: 'pointer',
          }}>
            Continuar sin cuenta
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--color-muted)' }}>
          ¿No tenés cuenta?{' '}
          <a href={`${base}/registro${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`} style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
            Registrate gratis
          </a>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
      <path fill="#FBBC04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function Input({ type = 'text', value, onChange, placeholder, icon, rightIcon }: {
  type?: string; value: string; onChange: (v: string) => void; placeholder?: string
  icon?: React.ReactNode; rightIcon?: React.ReactNode
}) {
  return (
    <div style={{ position: 'relative' }}>
      {icon && <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>{icon}</span>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', height: 44,
          padding: `0 ${rightIcon ? 40 : 14}px 0 ${icon ? 40 : 14}px`,
          borderRadius: 8, border: '1px solid var(--color-border)',
          background: 'var(--color-bg)', color: 'var(--color-text)',
          fontSize: 14, outline: 'none', boxSizing: 'border-box',
        }}
      />
      {rightIcon && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>{rightIcon}</span>}
    </div>
  )
}
