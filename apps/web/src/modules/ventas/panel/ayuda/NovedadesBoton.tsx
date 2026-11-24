// ─── Botón compacto de novedades en la barra superior ─────────────────────────
//
// Ocupa el mismo lugar que un botón de ícono (36×36px) junto al selector de
// tema y muestra un punto de acento cuando existen novedades todavía no vistas
// por el propietario en este dispositivo.

import { useCallback, useSyncExternalStore } from 'react'
import { Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { EVENTO_CAMBIO_AYUDA, leerAyuda } from './almacen'
import { NOVEDADES, novedadesSinVer, novedadesVigentes } from './novedades'

export const EVENTO_ABRIR_NOVEDADES = 'orbita:abrir-novedades'

const suscribirAyuda = (cb: () => void) => {
    window.addEventListener(EVENTO_CAMBIO_AYUDA, cb)
    window.addEventListener('storage', cb)
    return () => {
        window.removeEventListener(EVENTO_CAMBIO_AYUDA, cb)
        window.removeEventListener('storage', cb)
    }
}

export default function NovedadesBoton() {
    const { user } = useAuth()
    const esAdmin = user?.type === 'member' && (user.role === 'owner' || user.role === 'admin')
    const negocioId = esAdmin ? user.business.id : null

    const getSnapshot = useCallback(
        () => (negocioId ? novedadesSinVer(leerAyuda(negocioId).novedadesVistas).length : 0),
        [negocioId],
    )
    const sinVer = useSyncExternalStore(suscribirAyuda, getSnapshot, () => 0)
    // Sin ninguna vigente (todas leídas hace más de 3 días) el botón no aparece.
    const getVigentes = useCallback(
        () => (negocioId ? novedadesVigentes(leerAyuda(negocioId), Date.now()).length : 0),
        [negocioId],
    )
    const vigentes = useSyncExternalStore(suscribirAyuda, getVigentes, () => 0)

    if (!esAdmin || NOVEDADES.length === 0 || vigentes === 0) return null

    return (
        <>
            <style>{CSS_BOTON}</style>
            <button
                type="button"
                onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR_NOVEDADES))}
                aria-label={sinVer > 0 ? `Novedades del panel (${sinVer} sin leer)` : 'Novedades del panel'}
                title="Novedades del panel"
                className="admin-novedades-btn ds-hover grid place-items-center rounded-lg"
                style={{
                    width: 36,
                    height: 36,
                    position: 'relative',
                    background: 'transparent',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-body)',
                    flexShrink: 0,
                }}
            >
                <Sparkles size={17} strokeWidth={1.5} aria-hidden="true" />
                {sinVer > 0 && (
                    <span
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            top: -2,
                            right: -2,
                            width: 8,
                            height: 8,
                            borderRadius: 9999,
                            background: 'var(--color-primary)',
                            border: '2px solid var(--color-bg)',
                        }}
                    />
                )}
            </button>
        </>
    )
}

const CSS_BOTON = `
@media (max-width: 360px) {
    .admin-novedades-btn { display: none !important; }
}
`
