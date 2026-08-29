import { useState } from 'react'
import { useRouter } from 'next/router'
import { User, Mail, Phone, Lock, Eye } from 'lucide-react'
import { TIENDA } from '@/lib/storefront/mock'
import { useAuth } from '@/hooks/useAuth'
import { AuthError, googleLoginUrl } from '@/lib/auth/authClient'
import { currentSlug, storefrontBase } from '@/lib/tenant'

export default function Registro() {
  const router = useRouter()
  const { register } = useAuth()

  // Slug del negocio: en subdominio viene del host; en path legacy del route param.
  const slug = (router.query.slug as string | undefined) ?? currentSlug() ?? ''
  const base = storefrontBase(slug)
  // RBT-351 — a dónde volver después de autenticarse (checkout, home, etc.).
  const returnTo = typeof router.query.returnTo === 'string' ? router.query.returnTo : ''

  const [nombre,   setNombre]   = useState('')
  const [email,    setEmail]    = useState('')
  const [telefono, setTelefono] = useState('')
  const [pw,       setPw]       = useState('')
  const [acepta,   setAcepta]   = useState(true)
  const [showPw,   setShowPw]   = useState(false)
  const [error,    setError]    = useState('')
  const [enviando, setEnviando] = useState(false)

  const strength      = pw.length === 0 ? 0 : pw.length < 6 ? 1 : pw.length < 10 ? 2 : pw.length < 14 ? 3 : 4
  const strengthLabel = ['', 'Débil', 'Regular', 'Buena', 'Excelente'][strength]
  const strengthColor = ['', 'var(--color-error)', 'var(--color-warning)', 'var(--color-warning)', 'var(--color-success)'][strength]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!nombre.trim() || !email.trim() || pw.length < 8) {
      setError('Completá nombre, email y una contraseña de al menos 8 caracteres.')
      return
    }
    if (!acepta) {
      setError('Necesitás aceptar los términos y la política de privacidad.')
      return
    }

    const [first, ...rest] = nombre.trim().split(/\s+/)
    setEnviando(true)
    try {
      await register({
        firstName: first,
        lastName: rest.join(' ') || undefined,
        email: email.trim(),
        phone: telefono.trim() || undefined,
        password: pw,
      })
      // Éxito → ya queda logueado (el backend loguea directo al registrarse).
      // Va directo a returnTo (RBT-351) o al home del storefront, sin volver a
      // pedirle la contraseña que acaba de elegir. window.location (navegación
      // dura) para que el middleware reescriba el subdominio correctamente.
      window.location.href = returnTo || `${base}/`
    } catch (err) {
      if (err instanceof AuthError && err.status === 400) {
        // El backend devuelve 400 con "Ya tenés cuenta en esta tienda. Iniciá sesión."
        setError(err.message || 'Ya tenés cuenta en esta tienda.')
      } else {
        setError('No se pudo crear la cuenta. Intentá de nuevo.')
      }
      setEnviando(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-surface)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <style>{`
        @media (max-width: 480px) {
          .sf-registro-card { width: 100% !important; padding: 24px !important; }
        }
      `}</style>
      <div className="sf-registro-card" style={{
        width: 460, maxWidth: '100%', boxSizing: 'border-box',
        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
        borderRadius: 16, padding: 36,
        boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', textAlign: 'center', margin: '0 0 6px' }}>
          Creá tu cuenta
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-muted)', textAlign: 'center', margin: '0 0 24px' }}>
          en {TIENDA.nombre} · gratis y sin tarjeta
        </p>
        <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 20 }} />

        <button type="button" className="ds-hover" onClick={() => { window.location.href = googleLoginUrl(slug) }} style={{
          width: '100%', height: 44, borderRadius: 10, marginBottom: 20,
          background: 'var(--color-bg)', border: '1.5px solid var(--color-border)',
          fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <GoogleIcon /> Registrarse con Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--color-subtle)', fontSize: 11, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          <span>o con email</span>
          <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: 'var(--color-error)',
            }}>
              {error}
            </div>
          )}

          <Field label="Nombre completo">
            <Input value={nombre} onChange={setNombre} placeholder="María Fernández" icon={<User size={15} strokeWidth={1.5} color="var(--color-subtle)" />} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Email">
              <Input type="email" value={email} onChange={setEmail} placeholder="tu@email.com" icon={<Mail size={15} strokeWidth={1.5} color="var(--color-subtle)" />} />
            </Field>
            <Field label="Teléfono">
              <Input type="tel" value={telefono} onChange={setTelefono} placeholder="+54 9 11..." icon={<Phone size={15} strokeWidth={1.5} color="var(--color-subtle)" />} />
            </Field>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: 6 }}>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <Lock size={15} strokeWidth={1.5} color="var(--color-subtle)" />
              </span>
              <input
                className="ds-field"
                type={showPw ? 'text' : 'password'}
                value={pw}
                onChange={e => setPw(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                style={{
                  width: '100%', height: 44, padding: '0 40px',
                  borderRadius: 8, border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)', color: 'var(--color-text)',
                  fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
              />
              <button type="button" className="ds-hover" onClick={() => setShowPw(p => !p)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--color-muted)',
                display: 'flex', alignItems: 'center',
              }}>
                <Eye size={15} strokeWidth={1.5} />
              </button>
            </div>
            {pw && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[1,2,3,4].map(n => (
                    <div key={n} style={{ flex: 1, height: 4, borderRadius: 999, background: n <= strength ? strengthColor : 'var(--color-border)' }} />
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>
                  Fortaleza: <span style={{ color: strengthColor, fontWeight: 600 }}>{strengthLabel}</span>
                </div>
              </div>
            )}
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--color-body)', cursor: 'pointer' }}>
            <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} style={{ accentColor: 'var(--color-primary)', marginTop: 2 }} />
            <span>
              Acepto los{' '}
              <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Términos y condiciones</span>
              {' '}y la{' '}
              <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>política de privacidad</span>
            </span>
          </label>

          <button type="submit" className="ds-hover" disabled={enviando} style={{
            width: '100%', height: 48, borderRadius: 10, marginTop: 8,
            background: enviando ? 'var(--color-surface-alt)' : 'var(--color-primary)', color: '#fff',
            fontSize: 14, fontWeight: 700, border: 'none', cursor: enviando ? 'default' : 'pointer',
            boxShadow: enviando ? 'none' : '0 4px 16px rgba(59,130,246,0.25)',
          }}>
            {enviando ? 'Creando cuenta…' : 'Crear mi cuenta'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--color-muted)' }}>
          ¿Ya tenés cuenta?{' '}
          <a href={`${base}/login`} className="ds-link" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
            Ingresá
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

function Input({ type = 'text', value, onChange, placeholder, icon }: {
  type?: string; value: string; onChange: (v: string) => void; placeholder?: string; icon?: React.ReactNode
}) {
  return (
    <div style={{ position: 'relative' }}>
      {icon && <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>{icon}</span>}
      <input className="ds-field" type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{
        width: '100%', height: 44, padding: `0 14px 0 ${icon ? 40 : 14}px`,
        borderRadius: 8, border: '1px solid var(--color-border)',
        background: 'var(--color-bg)', color: 'var(--color-text)',
        fontSize: 14, outline: 'none', boxSizing: 'border-box',
      }} />
    </div>
  )
}
