// Piezas que comparten todas las tarjetas de la configuración del negocio.

export const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
export const h1Style: React.CSSProperties = { fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 20px' }

export function SectionTitle({ children }: { children: React.ReactNode }) {
    return <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 16 }}>{children}</div>
}

// Cartelito rojo que aparece abajo del botón cuando un guardado falla.
export function ErrorInline({ msg }: { msg?: string | null }) {
    if (!msg) return null
    return <div style={{ fontSize: 13, color: 'var(--color-error)', marginTop: 10 }}>{msg}</div>
}

// Mismo aviso que ya tiene Apariencia (punto naranja + "Tenés cambios sin
// guardar") pero acá al lado del botón de cada tarjeta en vez de una barra
// flotante — cada sección de Configuración es su propia pantalla con una
// sola tarjeta, así que no hace falta una barra aparte para no perder de
// vista el estado: ya está pegada al botón que lo resuelve.
export function DirtyHint({ show }: { show: boolean }) {
    if (!show) return null
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500, color: 'var(--color-warning)', marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
            Tenés cambios sin guardar
        </div>
    )
}
