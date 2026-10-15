import { Eye } from 'lucide-react'
import { Button } from '@/design-system/components/Button'

// La barra fija de abajo en el celular. Junta las dos cosas que ahí no se
// pueden tener a la vista a la vez: la previa de la tienda (no entra al lado
// del formulario, se abre a pantalla completa) y el guardado (el botón de
// arriba queda lejos apenas se baja un poco).
export function BarraMovil({ dirty, guardando, errorGuardado, puedeDescartar, onVerTienda, onDescartar, onGuardar }: {
    dirty: boolean
    guardando: boolean
    errorGuardado: string | null
    puedeDescartar: boolean
    onVerTienda: () => void
    onDescartar: () => void
    onGuardar: () => void
}) {
    return (
        <div className="ap-barra-movil">
            {dirty && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 28 }}>
                    <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>Tenés cambios sin guardar</span>
                    {puedeDescartar && (
                        <button type="button" onClick={onDescartar} disabled={guardando} className="ap-barra-descartar">Descartar</button>
                    )}
                </div>
            )}
            {errorGuardado && <div role="alert" style={{ fontSize: 12, color: 'var(--color-error)' }}>{errorGuardado}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="secondary" size="lg" icon={<Eye size={18} strokeWidth={1.8} />} onClick={onVerTienda} style={{ flex: 1, justifyContent: 'center', padding: '0 12px' }}>
                    Ver mi tienda
                </Button>
                {dirty && (
                    <Button variant="primary" size="lg" loading={guardando} onClick={onGuardar} style={{ flex: 1, justifyContent: 'center', padding: '0 12px' }}>
                        Guardar cambios
                    </Button>
                )}
            </div>
        </div>
    )
}
