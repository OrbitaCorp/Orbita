import { useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { Mail, Lock, Eye, ArrowLeft, CheckCircle, XCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AuthError } from '@/lib/auth/authClient'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'

type Step = 'email' | 'code' | 'password' | 'done'

// Login de dueño: servido en el apex, sin X-Business-Slug → el backend busca
// el member globalmente (ver AuthContext.forgotPassword()/authHeaders()).
export default function AdminForgotPassword() {
  const router = useRouter()
  const { forgotPassword, verifyResetCode, resetPassword } = useAuth()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [digits, setDigits] = useState(Array(6).fill(''))
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const code = digits.join('')

  function handleDigit(i: number, v: string) {
    if (!/^\d*$/.test(v)) return
    const next = [...digits]; next[i] = v.slice(-1); setDigits(next)
    if (v && i < 5) inputsRef.current[i + 1]?.focus()
  }
  function handleDigitKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputsRef.current[i - 1]?.focus()
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Ingresá tu email.')
      return
    }
    setEnviando(true)
    try {
      await forgotPassword(email.trim())
    } catch {
      // Anti-enumeración: seguimos igual al paso de código aunque falle.
    } finally {
      setEnviando(false)
      setStep('code')
    }
  }

  async function handleReenviar() {
    setError('')
    setDigits(Array(6).fill(''))
    try {
      await forgotPassword(email.trim())
    } catch {
      // idem — no revelamos nada
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (code.length !== 6) {
      setError('Ingresá el código de 6 dígitos.')
      return
    }
    setEnviando(true)
    try {
      await verifyResetCode(email.trim(), code)
      setStep('password')
    } catch {
      setError('Código incorrecto o vencido. Probá de nuevo o pedí uno nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (pw.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (pw !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setEnviando(true)
    try {
      await resetPassword(email.trim(), code, pw)
      setStep('done')
    } catch (err) {
      if (err instanceof AuthError && err.status === 400) {
        setError('El código venció o ya se usó. Volvé a pedirlo.')
        setStep('code')
      } else {
        setError('No se pudo cambiar la contraseña. Intentá de nuevo.')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-surface)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div style={{
        width: 420, maxWidth: '100%',
        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
        borderRadius: 16, padding: 36,
        boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <OrbitaLogo size={44} />
        </div>

        {step === 'email' && <>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', textAlign: 'center', margin: '0 0 6px' }}>
            Recuperar contraseña
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', textAlign: 'center', margin: '0 0 24px' }}>
            Panel de administración
          </p>
          <Divider />

          <p style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6, marginBottom: 20 }}>
            Ingresá el email de tu cuenta de administrador y te enviaremos un código para restablecer tu contraseña.
          </p>

          <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ErrorBox error={error} />
            <Field label="Email">
              <InputField type="email" value={email} onChange={setEmail} placeholder="admin@tuempresa.com"
                icon={<Mail size={15} strokeWidth={1.5} color="var(--color-subtle)" />} />
            </Field>
            <Btn type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar código'}</Btn>
          </form>

          <BackLink href="/login">Volver al inicio de sesión</BackLink>
        </>}

        {step === 'code' && <>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', textAlign: 'center', margin: '0 0 6px' }}>
            Revisá tu email
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', textAlign: 'center', margin: '0 0 24px' }}>
            Si <strong style={{ color: 'var(--color-text)' }}>{email}</strong> tiene una cuenta, enviamos un código. Expira en 15 minutos.
          </p>
          <Divider />

          <form onSubmit={handleCodeSubmit}>
            <ErrorBox error={error} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: error ? 12 : 0, marginBottom: 20 }}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => { inputsRef.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handleDigit(i, e.target.value)}
                  onKeyDown={e => handleDigitKey(i, e)}
                  style={{
                    width: 48, height: 56, borderRadius: 10, textAlign: 'center',
                    fontSize: 24, fontWeight: 700, color: 'var(--color-text)',
                    border: `2px solid ${d ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: 'var(--color-bg)', outline: 'none',
                    transition: 'border-color 0.15s', boxSizing: 'border-box',
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Btn type="submit" disabled={enviando}>{enviando ? 'Verificando…' : 'Verificar código'}</Btn>
              <button type="button" onClick={handleReenviar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-primary)', fontWeight: 500, padding: '6px 0' }}>
                Reenviar código
              </button>
            </div>
          </form>

          <BackBtn onClick={() => setStep('email')}>Volver</BackBtn>
        </>}

        {step === 'password' && <>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', textAlign: 'center', margin: '0 0 6px' }}>
            Nueva contraseña
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', textAlign: 'center', margin: '0 0 24px' }}>
            Elegí una contraseña segura para tu panel
          </p>
          <Divider />

          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ErrorBox error={error} />
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: 6 }}>Nueva contraseña</label>
              <InputField
                type={showPw ? 'text' : 'password'}
                value={pw}
                onChange={setPw}
                placeholder="Mínimo 8 caracteres"
                icon={<Lock size={15} strokeWidth={1.5} color="var(--color-subtle)" />}
                rightIcon={
                  <button type="button" onClick={() => setShowPw(p => !p)} style={{ color: 'var(--color-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Eye size={15} strokeWidth={1.5} />
                  </button>
                }
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: 6 }}>Confirmar contraseña</label>
              <InputField type="password" value={confirm} onChange={setConfirm} placeholder="Repetí tu contraseña"
                icon={<Lock size={15} strokeWidth={1.5} color="var(--color-subtle)" />} />
            </div>

            <Btn type="submit" disabled={enviando}>{enviando ? 'Cambiando…' : 'Cambiar contraseña'}</Btn>
          </form>

          <BackBtn onClick={() => setStep('code')}>Volver</BackBtn>
        </>}

        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'grid', placeItems: 'center' }}>
                <CheckCircle size={34} color="#10b981" strokeWidth={1.8} />
              </div>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>
              ¡Contraseña actualizada!
            </h2>
            <p style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 28, lineHeight: 1.6 }}>
              Ya podés ingresar al panel con tu nueva contraseña.
            </p>
            <Btn onClick={() => router.push('/login')}>Ir al inicio de sesión</Btn>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 24 }} />
}

function ErrorBox({ error }: { error: string }) {
  if (!error) return null
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start',
      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: 'var(--color-error)',
    }}>
      <XCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{error}</span>
    </div>
  )
}

function Btn({ children, onClick, type = 'button', disabled }: {
  children: React.ReactNode; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      width: '100%', height: 48, borderRadius: 10,
      background: disabled ? 'var(--color-surface-alt)' : 'var(--color-primary)', color: '#fff',
      fontSize: 14, fontWeight: 700, border: 'none', cursor: disabled ? 'default' : 'pointer',
      boxShadow: disabled ? 'none' : '0 4px 16px rgba(59,130,246,0.25)',
    }}>
      {children}
    </button>
  )
}

function BackBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div style={{ textAlign: 'center', marginTop: 20 }}>
      <button type="button" onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <ArrowLeft size={13} />
        {children}
      </button>
    </div>
  )
}

function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <div style={{ textAlign: 'center', marginTop: 24 }}>
      <a href={href} style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <ArrowLeft size={13} />
        {children}
      </a>
    </div>
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

function InputField({ type = 'text', placeholder, value, onChange, icon, rightIcon }: {
  type?: string; placeholder?: string; value: string; onChange: (v: string) => void
  icon?: React.ReactNode; rightIcon?: React.ReactNode
}) {
  return (
    <div style={{ position: 'relative' }}>
      {icon && <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>{icon}</span>}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
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
