import { useEffect, useState } from 'react'
import { X, Copy, Check, Loader2 } from 'lucide-react'
import { useToggleDescuentoLink } from '../hooks/useToggleDescuentoLink'
import { useDescuento } from '../hooks/useDescuento'
import { useAuth } from '@/hooks/useAuth'
import { tenantUrl } from '@/lib/tenant'
import type { Descuento } from '../types'

const MONO: React.CSSProperties = { fontFamily: '"Geist Mono", "Fira Code", monospace' }

interface Props {
  descuento: Descuento
  onClose: () => void
}

// Modal "Compartir descuento" — abierto desde el menú (⋮) de la tabla, mismo
// patrón que LinkCompartibleModal.tsx (cupones). A diferencia del cupón, sin
// destino configurable, sin envío por email, y sin toggle activo/inactivo:
// el link de un descuento siempre está activo. Si el descuento todavía tiene
// linkActive=false en el backend (creado antes de este cambio), se activa
// solo apenas se abre el modal — nunca se le pide al dueño que lo prenda.
export function LinkDescuentoModal({ descuento: descuentoFila, onClose }: Props) {
  const { user } = useAuth()
  const subdomain = user && 'business' in user ? user.business.subdomain : null

  // La fila del listado no trae productosIds/categoriasIds completos (son
  // placeholders para la tabla) — se pide el detalle completo, única fuente
  // confiable para armar el PUT (reemplaza el descuento entero).
  const { data: descuento, isLoading: cargando } = useDescuento(descuentoFila.id)

  const [copiado, setCopiado] = useState(false)
  const toggleLink = useToggleDescuentoLink()

  useEffect(() => {
    if (!descuento || descuento.linkActive) return
    toggleLink.mutate({ descuento, linkActive: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descuento])

  const activo = descuento?.linkActive || toggleLink.isPending
  const urlActual = subdomain && descuento ? tenantUrl(subdomain, `/oferta/${descuento.id}`) : ''

  function copiar() {
    if (!urlActual) return
    navigator.clipboard.writeText(urlActual).catch(() => {})
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', background: 'var(--color-bg)', borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>Compartir descuento</div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{descuentoFila.nombre}</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-body)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <X size={15} />
          </button>
        </div>

        {cargando || !descuento || !activo ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
            <Loader2 size={20} color="var(--color-muted)" style={{ animation: 'spin 800ms linear infinite' }} />
          </div>
        ) : (
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>URL del link</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: 12, color: 'var(--color-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...MONO }}>
                {urlActual || '—'}
              </div>
              <button onClick={copiar} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: copiado ? 'var(--color-success-bg, #f0fdf4)' : 'var(--color-bg)', color: copiado ? 'var(--color-success)' : 'var(--color-body)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                {copiado ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
              </button>
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            El link lleva directo a los productos alcanzados por este descuento.
          </div>
        </div>
        )}

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
          <button onClick={onClose} style={{ height: 36, padding: '0 18px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-body)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
