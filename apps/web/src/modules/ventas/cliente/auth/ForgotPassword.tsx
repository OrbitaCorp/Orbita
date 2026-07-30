import { useState } from 'react'
import { useRouter } from 'next/router'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { TIENDA } from '@/lib/storefront/mock'
import { useAuth } from '@/hooks/useAuth'
import { currentSlug, storefrontBase } from '@/lib/tenant'

type Step = 'email' | 'sent'

export default function ForgotPassword() {
  const router = useRouter()
  const { forgotPassword } = useAuth()
  const slug = (router.query.slug as string | undefined) ?? currentSlug() ?? ''
  const base = storefrontBase(slug)

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Ingresá tu email.')
      return
    }
    setEnviando(true)
    try {
      await forgotPassword(email.trim())
      setStep('sent')
    } catch {
      // Anti-enumeración: el backend nunca distingue "no existe" de "enviado".
      setStep('sent')
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
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #2563EB, #3B82F6)', display: 'grid', placeItems: 'center' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff' }} />
          </div>
        </div>

        {step === 'email' && <>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', textAlign: 'center', margin: '0 0 6px' }}>
            Recuperar contraseña
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', textAlign: 'center', margin: '0 0 24px' }}>
            en {TIENDA.nombre}
          </p>
          <Divider />

          <p style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6, marginBottom: 20 }}>
            Ingresá el email de tu cuenta y te enviaremos un link para restablecer tu contraseña.
          </p>

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
              <InputField type="email" value={email} onChange={setEmail} placeholder="tu@email.com"
                icon={<Mail size={15} strokeWidth={1.5} color="var(--color-subtle)" />} />
            </Field>

            <Btn type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar link'}</Btn>
          </form>

          <BackLink href={`${base}/login`}>Volver al inicio de sesión</BackLink>
        </>}

        {step === 'sent' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(37,99,235,0.1)', display: 'grid', placeItems: 'center' }}>
                <CheckCircle size={34} color="#2563eb" strokeWidth={1.8} />
              </div>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>
              Revisá tu email
            </h2>
            <p style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 28, lineHeight: 1.6 }}>
              Si <strong style={{ color: 'var(--color-text)' }}>{email}</strong> tiene una cuenta, te enviamos un
              link para restablecer tu contraseña. Expira en 1 hora.
            </p>
            <Btn onClick={() => router.push(`${base}/login`)}>Volver al inicio de sesión</Btn>
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

function InputField({ type = 'text', placeholder, value, onChange, icon }: {
  type?: string; placeholder?: string; value: string; onChange: (v: string) => void
  icon?: React.ReactNode
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
          padding: `0 14px 0 ${icon ? 40 : 14}px`,
          borderRadius: 8, border: '1px solid var(--color-border)',
          background: 'var(--color-bg)', color: 'var(--color-text)',
          fontSize: 14, outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}
