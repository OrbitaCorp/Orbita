import { useState } from 'react'
import { useRouter } from 'next/router'
import { Mail, Lock, Eye, ArrowLeft, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AuthError, googleLoginUrl } from '@/lib/auth/authClient'
import { tenantUrl, apexUrl } from '@/lib/tenant'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'

// Login de DUEÑO (panel), servido en el apex: orbita.local/login.
// Como no estamos en un subdominio de tienda, el AuthContext no manda
// X-Business-Slug → el backend usa el path "sin slug" (busca member en
// cualquier negocio) y devuelve el negocio del dueño en `business.subdomain`.
//
// Redirect entre subdominios: el token de acceso queda en memoria de ESTE
// origen (apex) y se pierde al navegar al subdominio — pero el BFF ya seteó el
// refresh token en una cookie httpOnly scopeada a `.orbita.local` (compartida).
// Al aterrizar en {slug}.orbita.local/panel, el AuthProvider hace /api/auth/refresh
// (la cookie viaja) y recupera un token nuevo. Ningún token viaja en la URL.
export default function AdminLogin() {
  const { login, verifyPlatformAdminCode } = useAuth()
  const router = useRouter()
  const [email,  setEmail]  = useState('')
  const [pw,     setPw]     = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error,  setError]  = useState('')
  const [enviando, setEnviando] = useState(false)
  // Se activa con cuenta bloqueada (403) o rate-limit (429) — casos donde
  // reintentar de inmediato no tiene sentido. Se desactiva solo cuando el
  // usuario edita el email o la contraseña (señal de que va a intentar de
  // nuevo con otra credencial), no con un timer arbitrario.
  const [bloqueado, setBloqueado] = useState(false)

  // Segundo factor de platform admin (RBT-647): cuando login() devuelve el
  // challenge, mfaEmail se llena y el formulario cambia a pedir el código en
  // vez de email/contraseña. `mfaEmail` (derivado, no un efecto) también
  // toma ?mfaEmail= de la URL — Google redirige ahí cuando resuelve a un
  // super admin y todavía falta el código.
  const [mfaEmailState, setMfaEmailState] = useState<string | null>(null)
  const mfaEmailQuery = typeof router.query.mfaEmail === 'string' ? router.query.mfaEmail : null
  const mfaEmail = mfaEmailState ?? mfaEmailQuery
  const [code, setCode] = useState('')

  function onEditarCampo(setter: (v: string) => void) {
    return (v: string) => {
      setter(v)
      if (bloqueado) setBloqueado(false)
    }
  }

  function irAlPanel(user: { type: string; business?: { subdomain: string } }) {
    if (user.type === 'platform_admin') {
      // Super admin → panel de plataforma, en el mismo apex (no un subdominio).
      window.location.href = apexUrl('/superadmin')
      return
    }
    if (user.type !== 'member' || !user.business) {
      // Un customer no tiene panel. (No debería pasar por el path sin slug.)
      setError('Esta cuenta no tiene un panel de administración.')
      setEnviando(false)
      return
    }
    // Redirige al panel en el subdominio del negocio del dueño.
    window.location.href = tenantUrl(user.business.subdomain, '/panel')
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
      const result = await login(email.trim(), pw)
      if (result.type === 'platform_admin_mfa_required') {
        setMfaEmailState(result.email)
        setEnviando(false)
        return
      }
      irAlPanel(result)
    } catch (err) {
      // El backend devuelve 401 genérico tanto para contraseña incorrecta como
      // para email inexistente (anti-enumeración, decidido en la migración de
      // auth). No se puede distinguir "no tenés negocio" → mensaje genérico.
      if (err instanceof AuthError && err.status === 429) {
        setError('Demasiados intentos. Esperá unos minutos antes de volver a intentar.')
        setBloqueado(true)
      } else if (err instanceof AuthError && err.status === 403) {
        // Cuenta bloqueada por intentos fallidos — el backend manda el
        // mensaje con los minutos restantes en err.message.
        setError(err.message || 'Cuenta bloqueada por intentos fallidos. Intentá de nuevo más tarde.')
        setBloqueado(true)
      } else if (err instanceof AuthError && err.status === 401) {
        setError('Email o contraseña incorrectos.')
      } else {
        setError('No se pudo iniciar sesión. Intentá de nuevo.')
      }
      setEnviando(false)
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!mfaEmail || code.length !== 6) {
      setError('Ingresá el código de 6 dígitos que te mandamos por mail.')
      return
    }
    setEnviando(true)
    try {
      const user = await verifyPlatformAdminCode(mfaEmail, code)
      irAlPanel(user)
    } catch (err) {
      setError(err instanceof AuthError ? err.message || 'Código inválido o expirado.' : 'No se pudo verificar el código. Intentá de nuevo.')
      setEnviando(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-surface)', display: 'grid', placeItems: 'center' }}>
      <a href="/" className="ds-link" style={{
        position: 'fixed', top: 24, left: 24,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 13, fontWeight: 500, color: 'var(--color-muted)',
        textDecoration: 'none',
      }}>
        <ArrowLeft size={15} strokeWidth={2} /> Atrás
      </a>
      <div style={{
        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
        borderRadius: 16, padding: 36, width: 420,
        boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <OrbitaLogo size={44} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', textAlign: 'center', margin: '0 0 6px' }}>
          {mfaEmail ? 'Verificá tu acceso' : 'Ingresá a Órbita'}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', textAlign: 'center', margin: '0 0 24px' }}>
          {mfaEmail ? `Te mandamos un código a ${mfaEmail}` : 'Panel de administración'}
        </p>
        <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 24 }} />

        {mfaEmail ? (
          <form onSubmit={handleVerifyCode} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: 'var(--color-error)',
              }}>
                {error}
              </div>
            )}

            <Field label="Código de verificación">
              <Input
                type="text"
                value={code}
                onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                icon={<ShieldCheck size={15} strokeWidth={1.5} color="var(--color-subtle)" />}
              />
            </Field>

            <button type="submit" className="ds-hover" disabled={enviando} style={{
              width: '100%', height: 48, borderRadius: 10, marginTop: 8,
              background: enviando ? 'var(--color-surface-alt)' : 'var(--color-primary)', color: '#fff',
              fontSize: 14, fontWeight: 700, border: 'none', cursor: enviando ? 'default' : 'pointer',
              boxShadow: enviando ? 'none' : '0 4px 16px rgba(59,130,246,0.25)',
            }}>
              {enviando ? 'Verificando…' : 'Verificar y entrar'}
            </button>

            <button
              type="button"
              className="ds-hover"
              onClick={() => { setMfaEmailState(null); setCode(''); setError('') }}
              style={{ background: 'none', border: 'none', color: 'var(--color-muted)', fontSize: 12.5, fontWeight: 500, textAlign: 'center' }}
            >
              Volver al login
            </button>
          </form>
        ) : (
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
                <a href="/forgot-password" className="ds-link" style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 500, textDecoration: 'none' }}>¿Olvidaste?</a>
              </div>
              <Input
                type={showPw ? 'text' : 'password'}
                value={pw}
                onChange={onEditarCampo(setPw)}
                placeholder="••••••••"
                icon={<Lock size={15} strokeWidth={1.5} color="var(--color-subtle)" />}
                rightIcon={
                  <button type="button" className="ds-hover" onClick={() => setShowPw(p => !p)} style={{ color: 'var(--color-muted)', background: 'none', border: 'none', display: 'flex', alignItems: 'center' }}>
                    <Eye size={15} strokeWidth={1.5} />
                  </button>
                }
              />
            </div>

            <button type="submit" className="ds-hover" disabled={enviando || bloqueado} style={{
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

            <button type="button" className="ds-hover" onClick={() => { window.location.href = googleLoginUrl() }} style={{
              width: '100%', height: 44, borderRadius: 10,
              background: 'var(--color-bg)', border: '1.5px solid var(--color-border)',
              fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <GoogleIcon /> Continuar con Google
            </button>
          </form>
        )}

        {!mfaEmail && (
          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--color-muted)' }}>
            ¿No tenés cuenta?{' '}
            <a href="/onboarding/rubro" className="ds-link" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
              Registrate gratis
            </a>
          </div>
        )}
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
        className="ds-field"
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
