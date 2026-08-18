// /restablecer-contrasena?email=...&code=... — la pantalla del link que el
// mail de "reset de contraseña" le manda a un miembro cuando el admin se la
// resetea desde Equipo. Misma familia visual que /aceptar-invitacion.
//
// (Fase 4 — Alex) Reusa el motor de "olvidé mi contraseña": el código viene
// en el link (un solo uso, 1 hora, hasheado en la base, 5 intentos máx.), se
// verifica al entrar SIN consumirlo, y el consumo real pasa al guardar la
// contraseña nueva. Ninguna pantalla muestra errores crudos del backend.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Lock, Eye, ShieldX, CheckCircle } from 'lucide-react'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'

type Fase = 'verificando' | 'lista' | 'invalido' | 'hecho'

export default function RestablecerContrasena() {
  const router = useRouter()
  const email = typeof router.query.email === 'string' ? router.query.email : ''
  const code = typeof router.query.code === 'string' ? router.query.code : ''

  const [fase, setFase] = useState<Fase>('verificando')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Al entrar se verifica el código (sin consumirlo): link roto o vencido →
  // pantalla clara, no un formulario que va a fallar al final.
  useEffect(() => {
    if (!router.isReady) return
    if (!email || !code) { setFase('invalido'); return }
    let cancelado = false
    fetch('/api/auth/verify-reset-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
      .then(res => { if (!cancelado) setFase(res.ok ? 'lista' : 'invalido') })
      .catch(() => { if (!cancelado) setFase('invalido') })
    return () => { cancelado = true }
  }, [router.isReady, email, code])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (pw.length < 8) { setError('La contraseña tiene que tener al menos 8 caracteres.'); return }
    if (pw !== pw2) { setError('Las contraseñas no coinciden.'); return }
    setEnviando(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword: pw }),
      })
      if (!res.ok) {
        setError('No se pudo guardar la contraseña. El link pudo haber vencido — pedí uno nuevo.')
        setEnviando(false)
        return
      }
      setFase('hecho')
    } catch {
      setError('No se pudo guardar la contraseña. Revisá tu conexión e intentá de nuevo.')
      setEnviando(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-surface)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <style>{`
        .rstpw-card { width: 100%; max-width: 420px; box-sizing: border-box; padding: 36px; }
        @media (max-width: 480px) { .rstpw-card { padding: 26px 20px; } }
      `}</style>

      <div className="rstpw-card" style={{
        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
        borderRadius: 16, boxShadow: '0 1px 3px rgba(15,23,42,0.06)', textAlign: 'center',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <OrbitaLogo size={56} />
        </div>

        {fase === 'verificando' && (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 6px' }}>Revisando el link…</h1>
            <p style={{ fontSize: 13.5, color: 'var(--color-muted)', margin: 0 }}>Un segundo.</p>
          </>
        )}

        {fase === 'invalido' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-error-bg)', display: 'grid', placeItems: 'center' }}>
                <ShieldX size={22} strokeWidth={1.6} color="var(--color-error)" />
              </span>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>Este link ya no sirve</h1>
            <p style={{ fontSize: 13.5, color: 'var(--color-muted)', margin: '0 0 6px', lineHeight: 1.6 }}>
              Los links de restablecer valen por 1 hora y se usan una sola vez.
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--color-subtle)', margin: '0 0 22px', lineHeight: 1.6 }}>
              Pedile a quien administra la tienda que te lo genere de nuevo, o entrá con tu contraseña temporal desde el login.
            </p>
            <a href="/login" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              height: 44, padding: '0 22px', borderRadius: 10,
              background: 'var(--color-primary)', color: '#fff',
              fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
            }}>
              Ir al login
            </a>
          </>
        )}

        {fase === 'hecho' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-success-bg)', display: 'grid', placeItems: 'center' }}>
                <CheckCircle size={22} strokeWidth={1.6} color="var(--color-success)" />
              </span>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>Contraseña actualizada</h1>
            <p style={{ fontSize: 13.5, color: 'var(--color-muted)', margin: '0 0 22px', lineHeight: 1.6 }}>
              Ya podés entrar al panel con tu contraseña nueva.
            </p>
            <a href="/login" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              height: 44, padding: '0 22px', borderRadius: 10,
              background: 'var(--color-primary)', color: '#fff',
              fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
            }}>
              Ir al login →
            </a>
          </>
        )}

        {fase === 'lista' && (
          <>
            <h1 style={{ fontSize: 21, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 6px' }}>Restablecé tu contraseña</h1>
            <p style={{ fontSize: 13.5, color: 'var(--color-muted)', margin: '0 0 4px' }}>
              Creá la contraseña nueva para <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{email}</span>
            </p>

            <div style={{ height: 1, background: 'var(--color-border)', margin: '22px 0' }} />

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' }}>
              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: 'var(--color-error)',
                }}>
                  {error}
                </div>
              )}

              <Field label="Contraseña nueva">
                <Input
                  type={showPw ? 'text' : 'password'}
                  value={pw}
                  onChange={setPw}
                  placeholder="Mínimo 8 caracteres"
                  icon={<Lock size={15} strokeWidth={1.5} color="var(--color-subtle)" />}
                  rightIcon={
                    <button type="button" onClick={() => setShowPw(p => !p)} aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'} style={{ color: 'var(--color-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Eye size={15} strokeWidth={1.5} />
                    </button>
                  }
                />
              </Field>

              <Field label="Confirmar contraseña">
                <Input
                  type={showPw ? 'text' : 'password'}
                  value={pw2}
                  onChange={setPw2}
                  placeholder="La misma de arriba"
                  icon={<Lock size={15} strokeWidth={1.5} color="var(--color-subtle)" />}
                />
              </Field>

              <button type="submit" disabled={enviando} style={{
                width: '100%', height: 48, borderRadius: 10, marginTop: 4,
                background: enviando ? 'var(--color-surface-alt)' : 'var(--color-primary)', color: '#fff',
                fontSize: 14, fontWeight: 700, border: 'none', cursor: enviando ? 'default' : 'pointer',
                boxShadow: enviando ? 'none' : '0 4px 16px rgba(59,130,246,0.25)',
              }}>
                {enviando ? 'Guardando…' : 'Guardar y listo'}
              </button>
            </form>
          </>
        )}
      </div>
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
