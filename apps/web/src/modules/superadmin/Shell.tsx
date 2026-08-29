import { useEffect, useState } from 'react'
import { Menu, X, LogOut, type LucideIcon } from 'lucide-react'
import { OrbitLogo, Chip } from './ui'

// Shell del panel de plataforma: sidebar fijo a la izquierda + área de
// contenido a la derecha.
//
// Las medidas, clases y estados salen del sidebar real del panel de negocios
// (layouts/components/Sidebar.tsx) a propósito: ancho w-60, encabezado h-16
// con la misma línea inferior que el contenido, ítems h-9 de 12px con
// primary-bg cuando están activos, y el mismo quiebre a drawer en 768px. Así
// el super admin se siente parte de Órbita y no una herramienta aparte.

export interface ItemNav<T extends string> {
  id: T
  label: string
  Icono: LucideIcon
  grupo: string
}

interface Props<T extends string> {
  items: ItemNav<T>[]
  activo: T
  onNavegar: (id: T) => void
  usuario: { nombre: string; rol: string }
  onCerrarSesion: () => void
  children: React.ReactNode
}

export function SuperAdminShell<T extends string>({
  items, activo, onNavegar, usuario, onCerrarSesion, children,
}: Props<T>) {
  const [abierto, setAbierto] = useState(false)

  // El drawer se cierra al navegar y al pasar a desktop; si no, quedaba
  // abierto y tapando el contenido al rotar o agrandar la ventana.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)')
    const cerrar = () => setAbierto(false)
    mq.addEventListener('change', cerrar)
    return () => mq.removeEventListener('change', cerrar)
  }, [])

  // Agrupa preservando el orden de aparición de cada grupo.
  const grupos: { nombre: string; items: ItemNav<T>[] }[] = []
  for (const it of items) {
    const g = grupos.find((x) => x.nombre === it.grupo)
    if (g) g.items.push(it)
    else grupos.push({ nombre: it.grupo, items: [it] })
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-surface)' }}>
      <style>{`
        .sa-sidebar {
          position: sticky;
          top: 0;
          height: 100vh;
          transition: transform 280ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 280ms ease;
        }
        .sa-burger { display: none; }
        @media (max-width: 768px) {
          .sa-sidebar {
            position: fixed !important;
            left: 0; top: 0;
            width: 15rem !important;
            z-index: 50;
            transform: translateX(-100%);
          }
          .sa-sidebar.sa-open {
            transform: translateX(0);
            box-shadow: 8px 0 32px rgba(0,0,0,0.25);
          }
          .sa-burger { display: inline-flex; }
          .sa-contenido { padding: 20px 16px 48px !important; }
        }
      `}</style>

      <aside
        className={`sa-sidebar flex flex-col w-60 shrink-0${abierto ? ' sa-open' : ''}`}
        style={{ background: 'var(--color-bg)', borderRight: '1px solid var(--color-border)' }}
      >
        {/* Encabezado: misma altura que la barra del contenido, para que las
            dos líneas inferiores se encuentren sin quiebre. */}
        <div
          className="flex items-center gap-2.5 h-16 px-4 shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <OrbitLogo />
          <span className="text-[15px] font-bold" style={{ color: 'var(--color-text)' }}>Órbita</span>
          <Chip text="Plataforma" tone="blue" />
        </div>

        <nav className="flex-1 overflow-y-auto" style={{ padding: '10px 8px' }}>
          {grupos.map((g) => (
            <div key={g.nombre} style={{ marginBottom: 6 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: 'var(--color-subtle)',
                textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 8px 4px',
              }}>
                {g.nombre}
              </div>
              <div className="flex flex-col" style={{ gap: 2 }}>
                {g.items.map((it) => {
                  const esActivo = it.id === activo
                  return (
                    <button
                      key={it.id}
                      onClick={() => { onNavegar(it.id); setAbierto(false) }}
                      aria-current={esActivo ? 'page' : undefined}
                      className="ds-hover flex items-center h-9 rounded-md gap-2.5 w-full px-2.5"
                      style={{
                        border: 'none',
                        fontFamily: 'inherit',
                        fontSize: 12,
                        background: esActivo ? 'var(--color-primary-bg)' : 'transparent',
                        color: esActivo ? 'var(--color-primary)' : 'var(--color-body)',
                        fontWeight: esActivo ? 600 : 500,
                      }}
                    >
                      <it.Icono size={16} strokeWidth={1.6} />
                      <span className="flex-1 text-left">{it.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Pie: quién sos y salir. En el panel de negocios esta zona también
            vive abajo, separada por una línea. */}
        <div className="shrink-0" style={{ borderTop: '1px solid var(--color-border)', padding: 10 }}>
          <div style={{ padding: '4px 6px 10px', minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {usuario.nombre}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>{usuario.rol}</div>
          </div>
          <button
            onClick={onCerrarSesion}
            className="ds-hover flex items-center h-9 rounded-md gap-2.5 w-full px-2.5"
            style={{
              border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
              background: 'transparent', color: 'var(--color-muted)',
            }}
          >
            <LogOut size={16} strokeWidth={1.6} />
            <span className="flex-1 text-left">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Backdrop del drawer en mobile */}
      {abierto && (
        <div
          onClick={() => setAbierto(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 40 }}
        />
      )}

      <main style={{ flex: 1, minWidth: 0 }}>
        {/* Barra superior: en desktop solo sostiene la línea que continúa la
            del sidebar; en mobile es donde vive la hamburguesa. */}
        <div
          className="flex items-center gap-3 h-16 px-4 sa-burger"
          style={{
            background: 'var(--color-bg)',
            borderBottom: '1px solid var(--color-border)',
            position: 'sticky', top: 0, zIndex: 30,
          }}
        >
          <button
            onClick={() => setAbierto((a) => !a)}
            aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
            className="ds-hover"
            style={{
              width: 36, height: 36, borderRadius: 8, border: '1px solid var(--color-border)',
              background: 'var(--color-bg)', color: 'var(--color-body)',
              display: 'grid', placeItems: 'center', fontFamily: 'inherit',
            }}
          >
            {abierto ? <X size={18} /> : <Menu size={18} />}
          </button>
          <OrbitLogo />
          <span className="text-[15px] font-bold" style={{ color: 'var(--color-text)' }}>Órbita</span>
        </div>

        <div className="sa-contenido" style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 28px 56px' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
