import { Button } from '@/design-system/components/Button'

/* Barra flotante de guardado — el botón de arriba queda fuera de
    vista al bajar el scroll (la página es larga), así que con
    cambios sin guardar aparece esto acá abajo para no obligar a
    subir todo de nuevo. Sutil a propósito: solo aparece si hay
    algo sin guardar, no compite con el resto de la UI. */
export function BarraGuardado({ guardando, errorGuardado, puedeDescartar, onDescartar, onGuardar }: {
    guardando: boolean
    errorGuardado: string | null
    puedeDescartar: boolean
    onDescartar: () => void
    onGuardar: () => void
}) {
    return (
        <div style={{
            position: 'fixed', left: '50%', bottom: 20, zIndex: 80,
            transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            borderRadius: 999, padding: '8px 8px 8px 18px',
            boxShadow: '0 10px 30px rgba(15,23,42,0.16)',
            animation: 'apStickyBarIn 220ms ease',
        }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                Tenés cambios sin guardar
            </span>
            {errorGuardado && (
                <span style={{ fontSize: 12, color: 'var(--color-error)', whiteSpace: 'nowrap' }}>{errorGuardado}</span>
            )}
            {puedeDescartar && <Button variant="ghost" disabled={guardando} onClick={onDescartar}>Descartar</Button>}
            <Button variant="primary" loading={guardando} onClick={onGuardar}>Guardar cambios</Button>
        </div>
    )
}
