import { useAuth } from '@/hooks/useAuth'
import { RequireAuth } from '@/lib/auth/RequireAuth'
import { apexUrl } from '@/lib/tenant'

// Entrada del panel del dueño en el subdominio de la tienda:
// {slug}.orbita.local/panel
//
// SOLO protege el acceso (RBT-290): exige sesión de tipo member para ESTE
// negocio. No reconstruye el panel — el panel real vive en /admin/[moduloPadre]/[seccion]
// (hoy mock). Desde acá se entra a ese shell existente.
export default function PanelPage() {
  return (
    <RequireAuth type="member">
      <PanelHome />
    </RequireAuth>
  )
}

function PanelHome() {
  const { user, logout } = useAuth()
  if (!user || user.type !== 'member') return null // RequireAuth ya garantiza esto

  const irAlPanel = () => {
    // Entra al shell de admin existente (mock). El negocio ya está
    // identificado por el subdominio actual, así que la URL no lo repite
    // (ver lib/tenant.ts#adminPath).
    window.location.href = '/admin/ventas/dashboard'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-surface)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div style={{
        width: 460, background: 'var(--color-bg)', border: '1px solid var(--color-border)',
        borderRadius: 16, padding: 36, boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
      }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--color-subtle)', margin: '0 0 6px' }}>
          Panel · {user.business.subdomain}.orbita.local
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 4px' }}>
          {user.business.name}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 20px' }}>
          Hola, {user.member.name} · rol <strong style={{ color: 'var(--color-text)' }}>{user.role}</strong>
        </p>

        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 8 }}>
            Sesión verificada contra el backend (GET /auth/me) para este negocio.
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-body)' }}>
            {user.permissions.length} permisos · modo {user.business.mode}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={irAlPanel} style={{
            flex: 1, height: 44, borderRadius: 10, border: 'none',
            background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>
            Entrar al panel
          </button>
          <button onClick={() => { void logout().then(() => { window.location.href = apexUrl('/login') }) }} style={{
            height: 44, padding: '0 18px', borderRadius: 10,
            border: '1.5px solid var(--color-border)', background: 'transparent',
            color: 'var(--color-body)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
