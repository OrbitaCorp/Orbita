import { useEffect, useState } from 'react'
import { CheckCircle2, Lock } from 'lucide-react'
import { Avatar } from '@/design-system/components/Avatar'
import { useDarkMode, type TemaPreferencia } from '@/hooks/useDarkMode'
import { useAuth } from '@/hooks/useAuth'
import { panelGetProfile, panelUpdateProfile, panelUpdateTheme, panelChangePassword, ApiError, type MemberProfile } from '@/lib/api'

// "Propietario" en TODOS lados (header, Equipo, invitaciones): una sola palabra
// por rol, y owner/admin son el mismo rol (acceso total) — decisión del equipo.
const NOMBRES_ROL: Record<string, string> = { owner: 'Propietario', admin: 'Propietario', empleado: 'Empleado' }
// Mismos colores vivos que las tarjetas de rol en Equipo.
const COLORES_ROL: Record<string, string> = { owner: '#3B82F6', admin: '#8B5CF6', empleado: '#10B981' }

// (RBT-646 + Fase 4 — Alex) "Mi perfil" del panel, rehecho: tarjeta de
// identidad arriba (avatar, rol con su color, estado del email y el negocio),
// y abajo las secciones — Datos, Apariencia con preview real de cada tema, y
// Seguridad para cambiar la contraseña (endpoint nuevo en member-profile).
export default function MiPerfil() {
  const { tema, setTema } = useDarkMode()
  const { user } = useAuth()
  const negocio = user?.type === 'member' ? user.business : null

  const [perfil, setPerfil] = useState<MemberProfile | null>(null)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState('')

  // ── Seguridad ──
  const [pwActual, setPwActual] = useState('')
  const [pwNueva, setPwNueva] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwGuardando, setPwGuardando] = useState(false)
  const [pwListo, setPwListo] = useState(false)
  const [pwError, setPwError] = useState('')

  useEffect(() => {
    panelGetProfile().then((p) => {
      setPerfil(p)
      setNombre(p.name)
      setEmail(p.email)
      // El backend es la fuente de verdad de la preferencia — si difiere de
      // lo que ya había en este navegador (otro dispositivo, por ejemplo),
      // se aplica la del servidor.
      if (p.themePreference.toLowerCase() !== tema) setTema(p.themePreference.toLowerCase() as TemaPreferencia)
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!nombre.trim()) { setError('El nombre no puede quedar vacío.'); return }
    setGuardando(true)
    try {
      const p = await panelUpdateProfile({ name: nombre.trim(), email: email.trim() })
      setPerfil(p)
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar. Intentá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  async function handleCambiarTema(t: TemaPreferencia) {
    setTema(t)
    try {
      const p = await panelUpdateTheme(t.toUpperCase() as MemberProfile['themePreference'])
      setPerfil(p)
    } catch {
      // Si falla el guardado remoto, el tema igual quedó aplicado local — no
      // es un error que amerite interrumpir a la persona, se reintentará
      // solo al volver a cambiarlo o recargar.
    }
  }

  async function handleCambiarPassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    if (pwNueva.length < 8) { setPwError('La contraseña nueva tiene que tener al menos 8 caracteres.'); return }
    if (pwNueva !== pwConfirm) { setPwError('Las contraseñas nuevas no coinciden.'); return }
    setPwGuardando(true)
    try {
      await panelChangePassword({ currentPassword: pwActual, newPassword: pwNueva })
      setPwActual(''); setPwNueva(''); setPwConfirm('')
      setPwListo(true)
      setTimeout(() => setPwListo(false), 3000)
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña. Intentá de nuevo.')
    } finally {
      setPwGuardando(false)
    }
  }

  if (!perfil) {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto', padding: 24 }} aria-hidden="true">
        <div style={{ height: 96, borderRadius: 12, background: 'var(--color-surface-alt)', marginBottom: 16 }} />
        <div style={{ height: 180, borderRadius: 12, background: 'var(--color-surface-alt)', marginBottom: 16 }} />
        <div style={{ height: 140, borderRadius: 12, background: 'var(--color-surface-alt)' }} />
      </div>
    )
  }

  const rolLabel = NOMBRES_ROL[perfil.role] ?? perfil.role
  const rolColor = COLORES_ROL[perfil.role] ?? '#3B82F6'

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        .mperf-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .mperf-grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .mperf-negocio { text-align: right; flex-shrink: 0; }
        @media (max-width: 620px) {
          .mperf-grid2, .mperf-grid3 { grid-template-columns: 1fr; }
          .mperf-negocio { display: none; }
        }
      `}</style>

      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>Mi perfil</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>
          Tus datos y preferencias en este negocio.
        </p>
      </div>

      {/* ── Tarjeta de identidad ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px',
        background: 'linear-gradient(120deg, var(--color-primary-bg), var(--color-bg))',
        border: '1px solid var(--color-primary)', borderRadius: 12,
      }}>
        <Avatar name={perfil.name} size={60} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.2 }}>{perfil.name}</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 10.5, fontWeight: 700, borderRadius: 9999, padding: '3px 10px',
              background: `${rolColor}22`, color: rolColor, whiteSpace: 'nowrap',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: rolColor }} />
              {rolLabel}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{perfil.email}</span>
            {perfil.emailVerified ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, borderRadius: 9999, padding: '3px 9px', background: 'var(--color-success-bg)', color: 'var(--color-success)', whiteSpace: 'nowrap' }}>
                ✓ Verificado
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, borderRadius: 9999, padding: '3px 9px', background: 'rgba(245,158,11,0.13)', color: 'var(--color-warning)', whiteSpace: 'nowrap' }}>
                Sin verificar
              </span>
            )}
          </div>
        </div>
        {negocio && (
          <div className="mperf-negocio">
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text)' }}>{negocio.name}</div>
            <div style={{ fontSize: 10.5, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace', marginTop: 2 }}>{negocio.subdomain}.orbita.site</div>
          </div>
        )}
      </div>

      {/* ── Tus datos ── */}
      <form onSubmit={handleGuardar} style={cardStyle}>
        <div style={tituloSeccion}>Tus datos</div>
        <div className="mperf-grid2" style={{ marginBottom: 14 }}>
          <FI label="Nombre">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="ds-field" style={inputStyle} />
          </FI>
          <FI label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="ds-field" style={inputStyle} />
          </FI>
        </div>
        {email.trim() !== perfil.email && (
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 12, lineHeight: 1.5 }}>
            Si cambiás el email, queda como &quot;sin verificar&quot; hasta que lo confirmes desde el correo nuevo.
          </div>
        )}

        {error && <div style={errorBox}>{error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="submit" disabled={guardando} className="ds-hover" style={btnPrimario(guardando)}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {guardado && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-success)', fontWeight: 600 }}>
              <CheckCircle2 size={15} /> Guardado
            </div>
          )}
        </div>
      </form>

      {/* ── Apariencia ── */}
      <div style={cardStyle}>
        <div style={tituloSeccion}>Apariencia</div>
        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--color-muted)' }}>Se guarda en tu cuenta — te va a acompañar en cualquier dispositivo donde entres.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          {/* Cada opción muestra una MINI-PREVIEW real del tema, no solo un ícono:
              claro = panelito claro, oscuro = panelito oscuro, sistema = mitad y mitad. */}
          {([
            ['light', 'Claro'],
            ['dark', 'Oscuro'],
            ['system', 'Sistema'],
          ] as [TemaPreferencia, string][]).map(([id, label]) => {
            const activo = tema === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleCambiarTema(id)}
                className="ds-hover"
                style={{
                  flex: 1, padding: 0, overflow: 'hidden', borderRadius: 10,
                  border: `1.5px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  boxShadow: activo ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
                  background: 'var(--color-bg)', fontFamily: 'inherit',
                }}
              >
                <span style={{ display: 'flex', height: 46 }} aria-hidden="true">
                  {(id === 'light' || id === 'system') && <MiniTema claro />}
                  {(id === 'dark' || id === 'system') && <MiniTema claro={false} />}
                </span>
                <span style={{
                  display: 'block', padding: '7px 0', fontSize: 12, fontWeight: 600, textAlign: 'center',
                  color: activo ? 'var(--color-primary)' : 'var(--color-body)',
                  borderTop: '1px solid var(--color-border)',
                }}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Seguridad ── */}
      <form onSubmit={handleCambiarPassword} style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
          <Lock size={13} strokeWidth={2} style={{ color: 'var(--color-subtle)' }} />
          <div style={{ ...tituloSeccion, marginBottom: 0 }}>Seguridad</div>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--color-muted)' }}>Cambiá tu contraseña cuando quieras — te pedimos la actual primero.</p>
        <div className="mperf-grid3" style={{ marginBottom: 14 }}>
          <FI label="Contraseña actual">
            <input type="password" value={pwActual} onChange={(e) => setPwActual(e.target.value)} autoComplete="current-password" className="ds-field" style={inputStyle} />
          </FI>
          <FI label="Nueva contraseña">
            <input type="password" value={pwNueva} onChange={(e) => setPwNueva(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" className="ds-field" style={inputStyle} />
          </FI>
          <FI label="Confirmar la nueva">
            <input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} autoComplete="new-password" className="ds-field" style={inputStyle} />
          </FI>
        </div>

        {pwError && <div style={errorBox}>{pwError}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="submit"
            disabled={pwGuardando || !pwActual || !pwNueva || !pwConfirm}
            className="ds-hover"
            style={{
              height: 40, padding: '0 20px', borderRadius: 9,
              background: 'transparent', color: 'var(--color-body)',
              border: '1px solid var(--color-border)', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit',
              cursor: pwGuardando || !pwActual || !pwNueva || !pwConfirm ? 'default' : 'pointer',
              opacity: pwGuardando || !pwActual || !pwNueva || !pwConfirm ? 0.55 : 1,
            }}
          >
            {pwGuardando ? 'Cambiando…' : 'Cambiar contraseña'}
          </button>
          {pwListo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-success)', fontWeight: 600 }}>
              <CheckCircle2 size={15} /> Contraseña actualizada
            </div>
          )}
        </div>
      </form>
    </div>
  )
}

// La mini-preview de un tema: tres barritas sobre fondo claro u oscuro.
// Colores fijos a propósito (no tokens): cada panelito muestra SU tema,
// sin importar en cuál esté la app ahora.
function MiniTema({ claro }: { claro: boolean }) {
  return (
    <span style={{ flex: 1, background: claro ? '#f1f5f9' : '#0d1526', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {['78%', '52%', '64%'].map((w) => (
        <span key={w} style={{ display: 'block', width: w, height: 5, borderRadius: 3, background: claro ? '#cbd5e1' : '#2b3a58' }} />
      ))}
    </span>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-bg)', border: '1px solid var(--color-border)',
  borderRadius: 12, padding: 24, display: 'block',
}

const tituloSeccion: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--color-subtle)', marginBottom: 12,
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 12px', boxSizing: 'border-box',
  borderRadius: 8, border: '1px solid var(--color-border)',
  background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14,
}

const errorBox: React.CSSProperties = {
  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
  borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: 'var(--color-error)',
  marginBottom: 12,
}

const btnPrimario = (guardando: boolean): React.CSSProperties => ({
  height: 40, padding: '0 20px', borderRadius: 9,
  background: 'var(--color-primary)', color: 'var(--color-on-primary)',
  fontSize: 13.5, fontWeight: 600, border: 'none', fontFamily: 'inherit',
  cursor: guardando ? 'default' : 'pointer', opacity: guardando ? 0.7 : 1,
})

function FI({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{label}</label>
      {children}
    </div>
  )
}
