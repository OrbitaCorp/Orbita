import { useEffect, useRef } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { ROOT_DOMAIN } from '@/lib/tenant'
import type { Apariencia as Ap } from '../../mock/apariencia.mock'
import type { PedidoFoco } from './focoPreview'
import { StorePreview } from './StorePreview'

// Vista previa completa de la tienda.
//   · Computadora: la tienda sobre un velo, en una ventana central.
//   · Celular (`movil`): una hoja a pantalla completa con la tienda a tamaño
//     natural — la previa de al lado no entra en una pantalla angosta, así que
//     se abre acá y se cierra para seguir editando. Abre en la parte que se
//     estaba tocando (`foco`).
export function VistaPreviaCompleta({ ap, publicado, subdomain, onCerrar, movil = false, foco }: {
    ap: Ap
    // Lo publicado, solo si hay cambios sin guardar (ver StorePreview).
    publicado: Ap | null
    subdomain: string
    onCerrar: () => void
    movil?: boolean
    foco?: PedidoFoco | null
}) {
    const cerrarRef = useRef<HTMLButtonElement>(null)
    // En un ref: quien nos usa pasa una función nueva en cada render y el efecto
    // de abajo no tiene que volver a correr (robaría el foco otra vez).
    const cerrarAlTocar = useRef(onCerrar)
    useEffect(() => { cerrarAlTocar.current = onCerrar }, [onCerrar])

    // Escape cierra; al abrir el foco pasa al botón de cerrar y al cerrar vuelve
    // a lo que lo abrió (el botón de la barra de abajo, en el celular).
    useEffect(() => {
        const anterior = document.activeElement as HTMLElement | null
        cerrarRef.current?.focus()
        const alTecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrarAlTocar.current() }
        window.addEventListener('keydown', alTecla)
        return () => { window.removeEventListener('keydown', alTecla); anterior?.focus?.() }
    }, [])

    const direccion = subdomain ? `${subdomain}.${ROOT_DOMAIN}` : ''

    if (movil) {
        return (
            <div role="dialog" aria-modal="true" aria-label="Así se ve tu tienda" style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 56, padding: 'env(safe-area-inset-top, 0px) 8px 0 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>Así se ve tu tienda</div>
                        {direccion && <div style={{ fontSize: 12, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{direccion}</div>}
                    </div>
                    <button ref={cerrarRef} onClick={onCerrar} aria-label="Cerrar la vista previa" className="ds-hover" style={{ width: 44, height: 44, borderRadius: 10, background: 'transparent', border: 'none', color: 'var(--color-text)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <X size={22} strokeWidth={1.8} />
                    </button>
                </div>
                {/* Caja con medidas propias (absolute + inset): el iframe de adentro
                    se estira a todo el alto sin depender de alturas en porcentaje. */}
                <div style={{ flex: 1, minHeight: 0, position: 'relative', marginBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                    <div style={{ position: 'absolute', inset: 0 }}>
                        <StorePreview ap={ap} publicado={publicado} subdomain={subdomain} foco={foco} nativo />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div onClick={onCerrar} role="dialog" aria-modal="true" aria-label="Vista previa de tu tienda" style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.70)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', padding: '60px 40px 40px' }}>
            <div onClick={e => e.stopPropagation()} style={{ maxWidth: 1100, width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><ExternalLink size={16} strokeWidth={1.6} /> Vista previa{direccion ? ` · ${direccion}` : ''}</span>
                    <button ref={cerrarRef} onClick={onCerrar} aria-label="Cerrar la vista previa" className="ds-hover" style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={18} /></button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', borderRadius: 12, background: 'var(--color-bg)' }}><StorePreview ap={ap} publicado={publicado} subdomain={subdomain} foco={foco} full /></div>
            </div>
        </div>
    )
}
