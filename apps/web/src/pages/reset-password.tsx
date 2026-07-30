import { useState } from 'react'
import { useRouter } from 'next/router'
import { Lock, Eye, CheckCircle, XCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AuthError } from '@/lib/auth/authClient'
import { apexUrl, tenantUrl } from '@/lib/tenant'

type Step = 'password' | 'done'

// Página universal a la que apunta el link del mail (ver
// auth.service.ts#issuePasswordResetToken): siempre `/reset-password` en el
// FRONTEND_URL configurado, sin importar si el token es de un dueño (member)
// o de un cliente de una tienda (customer) — el tipo lo resuelve el backend
// recién al canjear el token, así que acá no hace falta saberlo de antemano.
export default function ResetPassword() {
  const router = useRouter()
  const { resetPassword } = useAuth()
  const token = typeof router.query.token === 'string' ? router.query.token : ''
  const slug = typeof router.query.slug === 'string' ? router.query.slug : ''

  const [step, setStep] = useState<Step>('password')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [loginHref, setLoginHref] = useState('/login')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!router.isReady) return
    if (!token) {
      setError('Este link no es válido. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".')
      return
    }
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
      const { userType } = await resetPassword(token, pw)
      setLoginHref(userType === 'CUSTOMER' && slug ? tenantUrl(slug, '/login') : apexUrl('/login'))
      setStep('done')
    } catch (err) {
      if (err instanceof AuthError && err.status === 400) {
        setError('Este link expiró o ya se usó. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".')
      } else {
        setError('No se pudo cambiar la contraseña. Intentá de nuevo.')
      }
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
          <svg viewBox="0 0 30 30" fill="none" style={{ width: 40, height: 40 }}>
            <circle cx="15" cy="15" r="13" stroke="#2563eb" strokeWidth="3.2" strokeDasharray="60 22" strokeLinecap="round"/>
            <circle cx="25.5" cy="7.5" r="4" fill="#93c5fd"/>
            <circle cx="15" cy="15" r="4.5" fill="#1e3a8a"/>
          </svg>
        </div>

        {step === 'password' && <>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', textAlign: 'center', margin: '0 0 6px' }}>
            Nueva contraseña
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', textAlign: 'center', margin: '0 0 24px' }}>
            Elegí una contraseña segura
          </p>
          <Divider />

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: 'var(--color-error)',
              }}>
                <XCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

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
              Ya podés ingresar con tu nueva contraseña.
            </p>
            <Btn onClick={() => { window.location.href = loginHref }}>Ir al inicio de sesión</Btn>
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
