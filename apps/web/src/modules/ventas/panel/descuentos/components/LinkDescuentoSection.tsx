import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Toggle } from '../../../_shared/components/Toggle'
import { SectionCard } from './FormField'
import { useAuth } from '@/hooks/useAuth'
import { tenantUrl } from '@/lib/tenant'

const MONO: React.CSSProperties = { fontFamily: '"Geist Mono", "Fira Code", monospace' }

interface Props {
  id: string
  linkActivo: boolean
  onToggleActivo: (v: boolean) => void
}

// Link compartible de un DESCUENTO (no cupón) — a diferencia de
// LinkCompartibleSection.tsx (cupón) no hay selector de destino: el alcance
// del descuento (producto/categoría) ya define a qué productos lleva. Solo
// se muestra para descuentos ya creados (necesita el id real) con alcance
// producto/categoría — ver DescuentosCrear.tsx.
export function LinkDescuentoSection({ id, linkActivo, onToggleActivo }: Props) {
  const { user } = useAuth()
  const subdomain = user && 'business' in user ? user.business.subdomain : null
  const [copiado, setCopiado] = useState(false)
  const url = subdomain ? tenantUrl(subdomain, `/oferta/${id}`) : `(cargando…) /oferta/${id}`

  function copiar() {
    navigator.clipboard.writeText(url).catch(() => {})
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <SectionCard
      title="Link compartible"
      subtitle="Generá un link que lleva directo a los productos de este descuento."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)' }}>Habilitar link compartible</div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
              {linkActivo ? 'El link está activo y puede ser compartido.' : 'Activá para generar un link compartible.'}
            </div>
          </div>
          <Toggle checked={linkActivo} onChange={onToggleActivo} />
        </div>

        {linkActivo && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>URL</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 10px', height: 34, borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: 11, color: 'var(--color-body)', overflow: 'hidden', ...MONO }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
              </div>
              <button onClick={copiar} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: copiado ? 'var(--color-success)' : 'var(--color-body)', fontSize: 12, cursor: 'pointer' }}>
                {copiado ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  )
}
