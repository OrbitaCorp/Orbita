import { useAuth } from '@/hooks/useAuth'
import { RequireAuth } from '@/lib/auth/RequireAuth'
import { apexUrl } from '@/lib/tenant'

// Panel de plataforma (super admin) — vive en el apex: orbita.site/superadmin.
// NO es un subdominio: es una identidad cross-tenant, fuera del multi-tenant.
//
// Fase A (esto): solo el esqueleto + guard. Exige sesión de tipo platform_admin
// (RequireAuth). El contenido real (lista de negocios, dueños, métricas) es
// Fase B — se diseña aparte.
export default function SuperAdminPage() {
  return (
    <RequireAuth type="platform_admin">
      <SuperAdminHome />
    </RequireAuth>
  )
}

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Super administrador',
  OPERATOR: 'Operador',
}

function SuperAdminHome() {
  const { user, logout } = useAuth()
  if (!user || user.type !== 'platform_admin') return null // RequireAuth ya lo garantiza

  const cerrarSesion = () => {
    void logout().then(() => {
      window.location.href = apexUrl('/login')
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-surface)', padding: 24 }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <OrbitLogo />
            <div>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  color: 'var(--color-subtle)',
                  margin: '0 0 2px',
                }}
              >
                Órbita · Plataforma
              </p>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                Panel de super admin
              </h1>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{user.admin.name}</div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                {ROLE_LABELS[user.admin.role] ?? user.admin.role}
              </div>
            </div>
            <button
              onClick={cerrarSesion}
              style={{
                height: 38,
                padding: '0 16px',
                borderRadius: 10,
                border: '1.5px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-body)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* Placeholder de contenido (Fase B) */}
        <div
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 16,
            padding: 40,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px',
              fontSize: 22,
            }}
          >
            🛰️
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 6px' }}>
            Sesión de plataforma verificada
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--color-muted)', margin: '0 auto', maxWidth: 460, lineHeight: 1.6 }}>
            Estás autenticado como super admin ({user.admin.email}). El contenido del panel —
            lista de negocios, dueños y métricas de la plataforma— se construye en la próxima
            fase.
          </p>
        </div>
      </div>
    </div>
  )
}

function OrbitLogo() {
  return (
    <svg viewBox="0 0 30 30" fill="none" style={{ width: 34, height: 34, flexShrink: 0 }}>
      <circle cx="15" cy="15" r="13" stroke="#2563eb" strokeWidth="3.2" strokeDasharray="60 22" strokeLinecap="round" />
      <circle cx="25.5" cy="7.5" r="4" fill="#93c5fd" />
      <circle cx="15" cy="15" r="4.5" fill="#1e3a8a" />
    </svg>
  )
}
