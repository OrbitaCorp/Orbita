// /aceptar-invitacion?token=... — la página a la que apunta el mail de
// invitación al equipo. Antes NO EXISTÍA: el link del mail caía en el 404 de
// Next y el invitado quedaba Pendiente para siempre (su única salida era el
// login con la contraseña temporal, que nadie descubría solo).
//
// (Fase 4 — Alex) El flujo completo:
//   1. Con el token de la URL se pide GET /api/auth/invitation-info para
//      saludar con nombre (tienda, rol, invitado). Token inválido/vencido →
//      pantalla de "esta invitación ya no sirve" con su explicación.
//   2. El invitado crea su contraseña definitiva (mín. 8, con confirmación).
//   3. POST /api/auth/accept-invitation: el backend activa la cuenta, quema el
//      token (un solo uso, vence a las 24 h) y devuelve la sesión; el BFF deja
//      el refresh token en la cookie httpOnly compartida en .orbita.site.
//   4. Redirect directo al panel del negocio — el AuthProvider rearma la
//      sesión desde la cookie al aterrizar, sin pasar por el login.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Lock, Eye, ShieldX } from 'lucide-react'
import { tenantUrl, apexUrl } from '@/lib/tenant'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'

// Los roles de fábrica llegan con su nombre técnico; se muestran en español.
// Un rol custom se muestra tal cual lo nombró el negocio (igual que el Header).
// "Dueño" en TODOS lados (header, Mi Perfil, Equipo): un solo nombre por rol.
const NOMBRES_ROL: Record<string, string> = { owner: 'Dueño', admin: 'Administrador', empleado: 'Empleado' }

interface InvitacionInfo {
  storeName: string
  roleName: string
  memberName: string
  email: string
  expiresAt: string
}

type Estado =
  | { fase: 'cargando' }
  | { fase: 'lista'; info: InvitacionInfo }
  | { fase: 'invalida'; motivo: string }

export default function AceptarInvitacion() {
  const router = useRouter()
  const token = typeof router.query.token === 'string' ? router.query.token : ''

  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' })
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Con el token de la URL se buscan los datos de la invitación. Sin token
  // (o con uno inválido/vencido) la página lo dice claro en vez de romperse.
  useEffect(() => {
    if (!router.isReady) return
    if (!token) {
      setEstado({ fase: 'invalida', motivo: 'El link está incompleto — abrilo de nuevo desde el email de invitación.' })
      return
    }
    let cancelado = false
    fetch(`/api/auth/invitation-info?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (cancelado) return
        if (!res.ok) {
          // Solo se muestran los motivos HUMANOS del backend (los 400 de
          // "inválida" / "expiró"). Cualquier otro error (backend viejo sin el
          // endpoint, 500, HTML de un proxy) se tapa con el mensaje genérico —
          // un "Cannot GET /auth/..." crudo en pantalla queda espantoso.
          const raw = (body?.message ?? body?.error ?? '') as string | string[]
          const msg = Array.isArray(raw) ? raw.join(', ') : raw
          const esHumano = res.status === 400 && msg && !/cannot|error|exception|<\/?[a-z]+>/i.test(msg)
          setEstado({ fase: 'invalida', motivo: esHumano ? msg : 'Invitación inválida o ya aceptada.' })
          return
        }
        setEstado({ fase: 'lista', info: body as InvitacionInfo })
      })
      .catch(() => { if (!cancelado) setEstado({ fase: 'invalida', motivo: 'No se pudo verificar la invitación. Recargá la página.' }) })
    return () => { cancelado = true }
  }, [router.isReady, token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (pw.length < 8) { setError('La contraseña tiene que tener al menos 8 caracteres.'); return }
    if (pw !== pw2) { setError('Las contraseñas no coinciden.'); return }
    setEnviando(true)
    try {
      const res = await fetch('/api/auth/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: pw }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        // Mismo criterio que arriba: solo mensajes humanos del backend; nada
        // de "Cannot POST ..." ni stack traces en la cara del invitado.
        const raw = (body?.message ?? body?.error ?? '') as string | string[]
        const msg = Array.isArray(raw) ? raw.join(', ') : raw
        const esHumano = res.status === 400 && msg && !/cannot|error|exception|<\/?[a-z]+>/i.test(msg)
        setError(esHumano ? msg : 'No se pudo aceptar la invitación. Intentá de nuevo.')
        setEnviando(false)
        return
      }
      // La cookie de refresh ya quedó puesta por el BFF: con recarga completa,
      // el AuthProvider del panel rearma la sesión solo al aterrizar.
      const subdomain = body?.business?.subdomain as string | undefined
      window.location.href = subdomain ? tenantUrl(subdomain, '/panel') : apexUrl('/login')
    } catch {
      setError('No se pudo aceptar la invitación. Revisá tu conexión e intentá de nuevo.')
      setEnviando(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-surface)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <style>{`
        .acinv-card { width: 100%; max-width: 420px; box-sizing: border-box; padding: 36px; }
        @media (max-width: 480px) { .acinv-card { padding: 26px 20px; } }
      `}</style>

      <div className="acinv-card" style={{
        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
        borderRadius: 16, boxShadow: '0 1px 3px rgba(15,23,42,0.06)', textAlign: 'center',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <OrbitaLogo size={56} />
        </div>

        {estado.fase === 'cargando' && (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 6px' }}>Revisando tu invitación…</h1>
            <p style={{ fontSize: 13.5, color: 'var(--color-muted)', margin: 0 }}>Un segundo.</p>
          </>
        )}

        {estado.fase === 'invalida' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-error-bg)', display: 'grid', placeItems: 'center' }}>
                <ShieldX size={22} strokeWidth={1.6} color="var(--color-error)" />
              </span>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>Esta invitación ya no sirve</h1>
            <p style={{ fontSize: 13.5, color: 'var(--color-muted)', margin: '0 0 6px', lineHeight: 1.6 }}>{estado.motivo}</p>
            <p style={{ fontSize: 12.5, color: 'var(--color-subtle)', margin: '0 0 22px', lineHeight: 1.6 }}>
              Los links de invitación valen por 24 horas y se usan una sola vez. Pedile a quien te invitó que te mande una nueva.
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

        {estado.fase === 'lista' && (
          <>
            <h1 style={{ fontSize: 21, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 6px', lineHeight: 1.3 }}>
              Te invitaron a <span style={{ color: 'var(--color-primary)' }}>{estado.info.storeName}</span>
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--color-muted)', margin: '0 0 12px' }}>
              {estado.info.memberName}, te sumaron al equipo
            </p>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 26, padding: '0 12px', borderRadius: 9999,
              background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
              fontSize: 12.5, fontWeight: 700,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)' }} />
              Rol: {NOMBRES_ROL[estado.info.roleName] ?? estado.info.roleName}
            </span>

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

              <Field label="Creá tu contraseña">
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
                {enviando ? 'Entrando…' : 'Aceptar y entrar al panel →'}
              </button>

              <p style={{ fontSize: 11.5, color: 'var(--color-subtle)', textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
                Al continuar aceptás el acceso como {NOMBRES_ROL[estado.info.roleName] ?? estado.info.roleName}.<br />
                ¿No esperabas esta invitación? Ignorá este link.
              </p>
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
