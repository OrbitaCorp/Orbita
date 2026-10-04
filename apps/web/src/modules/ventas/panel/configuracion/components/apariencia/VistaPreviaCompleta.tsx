import { ExternalLink, X } from 'lucide-react'
import { ROOT_DOMAIN } from '@/lib/tenant'
import type { Apariencia as Ap } from '../../mock/apariencia.mock'
import { StorePreview } from './StorePreview'

// Vista previa completa: la tienda a pantalla completa, sobre un velo.
export function VistaPreviaCompleta({ ap, publicado, subdomain, onCerrar }: {
    ap: Ap
    // Lo publicado, solo si hay cambios sin guardar (ver StorePreview).
    publicado: Ap | null
    subdomain: string
    onCerrar: () => void
}) {
    return (
        <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.70)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', padding: '60px 40px 40px' }}>
            <div onClick={e => e.stopPropagation()} style={{ maxWidth: 1100, width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><ExternalLink size={16} strokeWidth={1.6} /> Vista previa{subdomain ? ` · ${subdomain}.${ROOT_DOMAIN}` : ''}</span>
                    <button onClick={onCerrar} className="ds-hover" style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={18} /></button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', borderRadius: 12, background: 'var(--color-bg)' }}><StorePreview ap={ap} publicado={publicado} subdomain={subdomain} full /></div>
            </div>
        </div>
    )
}
