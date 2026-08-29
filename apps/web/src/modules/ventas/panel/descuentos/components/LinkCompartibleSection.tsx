import { useState } from 'react'
import { Copy, Check, Link2 } from 'lucide-react'
import { Toggle } from '../../../_shared/components/Toggle'
import { SectionCard } from './FormField'
import { useAuth } from '@/hooks/useAuth'
import { tenantUrl } from '@/lib/tenant'

const MONO: React.CSSProperties = { fontFamily: '"Geist Mono", "Fira Code", monospace' }

interface Props {
  codigo: string
  linkActivo: boolean
  onToggleActivo: (v: boolean) => void
}

export function LinkCompartibleSection({ codigo, linkActivo, onToggleActivo }: Props) {
  const { user } = useAuth()
  const subdomain = user && 'business' in user ? user.business.subdomain : null
  const [copiado, setCopiado] = useState(false)

  const url = subdomain ? tenantUrl(subdomain, `/descuentos/${codigo}`) : `(cargando…) /descuentos/${codigo}`

  function copiar() {
    navigator.clipboard.writeText(url).catch(() => {})
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <SectionCard
      title="Link compartible"
      subtitle="Generá un link para que el cliente vea el código del cupón y lo copie para usarlo en el checkout."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Toggle */}
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
          <>
            {/* URL */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>URL</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 10px', height: 34, borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: 11, color: 'var(--color-body)', overflow: 'hidden', ...MONO }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
                </div>
                <button className="ds-hover" onClick={copiar} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: copiado ? 'var(--color-success)' : 'var(--color-body)', fontSize: 12, cursor: 'pointer' }}>
                  {copiado ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 8, background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.15)', fontSize: 12, color: 'var(--color-primary)' }}>
              <Link2 size={12} /> El link se comparte desde el menú contextual (⋮) de la tabla de cupones.
            </div>
          </>
        )}
      </div>
    </SectionCard>
  )
}
