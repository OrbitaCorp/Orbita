import { Skeleton, SkeletonText } from '@/design-system/components/Skeleton'
import { pageWrap } from './comunes'

// ─── Skeleton ────────────────────────────────────────────────────────────────
// Silueta de carga con la forma real de la pantalla: 6 tarjetas a 2 columnas,
// cada una con su título, sus renglones y el botón de guardar abajo. Usa el
// componente compartido del design-system (la misma clase `.skel` que el resto
// del panel), así el barrido de luz y el corte por prefers-reduced-motion son
// idénticos en todas las pantallas — no un shimmer propio por pantalla. El
// `delay` escalona tarjeta por tarjeta y renglón por renglón para que la luz
// entre en cascada, no todo de golpe.

function CardSkeleton({ lineas, delay = 0 }: { lineas: number; delay?: number }) {
    return (
        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
            <SkeletonText width={160} height={15} delay={delay} style={{ marginBottom: 16 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Array.from({ length: lineas }).map((_, i) => (
                    <Skeleton key={i} height={38} radius={8} delay={delay + (i + 1) * 40} />
                ))}
            </div>
            <Skeleton width={140} height={36} radius={8} delay={delay + (lineas + 1) * 40} style={{ marginTop: 16 }} />
        </div>
    )
}

export function GeneralViewSkeleton() {
    // Una sola tarjeta enfocada — mismo criterio que la pantalla real ahora
    // (cada sección del menú guía es una tarjeta a la vez, no un grid).
    return (
        <div style={pageWrap}>
            <SkeletonText width={180} height={30} delay={0} style={{ marginBottom: 20 }} />
            <div aria-hidden="true">
                <CardSkeleton lineas={3} />
            </div>
        </div>
    )
}
