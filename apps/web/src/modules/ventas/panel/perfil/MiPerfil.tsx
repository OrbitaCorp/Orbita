import { useEffect, useState } from 'react'
import { CheckCircle2, Monitor, Moon, Sun } from 'lucide-react'
import { useDarkMode, type TemaPreferencia } from '@/hooks/useDarkMode'
import { panelGetProfile, panelUpdateProfile, panelUpdateTheme, ApiError, type MemberProfile } from '@/lib/api'

const NOMBRES_ROL: Record<string, string> = { owner: 'Propietario', admin: 'Administrador', empleado: 'Empleado' }

const OPCIONES_TEMA: { id: TemaPreferencia; label: string; Icon: React.ElementType }[] = [
  { id: 'light', label: 'Claro', Icon: Sun },
  { id: 'dark', label: 'Oscuro', Icon: Moon },
  { id: 'system', label: 'Sistema', Icon: Monitor },
]

// (RBT-646) "Mi perfil" del panel — dueño/equipo. Datos propios + preferencia
// de tema, ahora guardada por usuario (antes solo vivía en localStorage del
// navegador, ver useDarkMode.ts).
export default function MiPerfil() {
  const { tema, setTema } = useDarkMode()
  const [perfil, setPerfil] = useState<MemberProfile | null>(null)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState('')

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

  if (!perfil) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
        <div style={{ height: 220, borderRadius: 12, background: 'var(--color-surface-alt)' }} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>Mi perfil</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>
          Tus datos y preferencias en este negocio.
        </p>
      </div>

      <form onSubmit={handleGuardar} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FI label="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle} />
        </FI>
        <FI label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </FI>
        <FI label="Rol">
          <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', color: 'var(--color-muted)', background: 'var(--color-surface-alt)' }}>
            {NOMBRES_ROL[perfil.role] ?? perfil.role}
          </div>
        </FI>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: 'var(--color-error)' }}>{error}</div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="submit" disabled={guardando} style={{ height: 40, padding: '0 20px', borderRadius: 9, background: 'var(--color-primary)', color: 'var(--color-on-primary)', fontSize: 13.5, fontWeight: 600, border: 'none', cursor: guardando ? 'default' : 'pointer', opacity: guardando ? 0.7 : 1 }}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {guardado && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-success)', fontWeight: 600 }}>
              <CheckCircle2 size={15} /> Guardado
            </div>
          )}
        </div>
      </form>

      <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>Apariencia</div>
        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--color-muted)' }}>Se guarda en tu cuenta — te va a acompañar en cualquier dispositivo donde entres.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {OPCIONES_TEMA.map(({ id, label, Icon }) => {
            const activo = tema === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleCambiarTema(id)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '14px 10px', borderRadius: 10,
                  border: `1.5px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: activo ? 'var(--color-primary-bg)' : 'transparent',
                  color: activo ? 'var(--color-primary)' : 'var(--color-body)',
                  cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                }}
              >
                <Icon size={17} strokeWidth={1.5} />
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 12px', boxSizing: 'border-box',
  borderRadius: 8, border: '1px solid var(--color-border)',
  background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14,
}

function FI({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{label}</label>
      {children}
    </div>
  )
}
