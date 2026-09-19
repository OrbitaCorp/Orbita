// Ficha técnica completa — se abre desde el link "Ver más detalles" de
// ProductoDetalle.tsx cuando la tabla de specs no entra recortada a la
// altura de la columna derecha (título/precio/botones/envíos). Mismo
// criterio visual que VariantPickerModal.tsx: overlay fijo + panel
// centrado, sin depender de ningún estado del carrito.
import { useEffect } from 'react'
import { X } from 'lucide-react'

export function FichaTecnicaModal({ nombre, specs, onClose }: {
  nombre: string
  specs: { label: string; value: string }[]
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
      <div
        onClick={e => e.stopPropagation()}
        style={{ position: 'relative', width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', background: 'var(--color-bg)', borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-bg)' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Características</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.3 }}>{nombre}</div>
          </div>
          <button onClick={onClose} className="ds-hover" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-body)', display: 'grid', placeItems: 'center' }}>
            <X size={15} />
          </button>
        </div>

        <div>
          {specs.map((c, i) => (
            <div key={`${c.label}-${i}`} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 12, padding: '10px 18px', borderBottom: i < specs.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</span>
              <span style={{ fontSize: 13, color: 'var(--color-body)' }}>{c.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
