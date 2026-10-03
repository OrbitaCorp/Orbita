import { Skeleton } from '@/design-system/components/Skeleton'
import { pageWrap } from './utils'

// ─── Skeleton — misma forma exacta del layout real (mismo criterio que
// mensajes/Bandeja.tsx/Plantillas.tsx), con el shimmer del componente
// compartido design-system/Skeleton.tsx. No replica cada control de cada
// SecCard (serían decenas) sino la forma general: header + N secciones con
// unas pocas líneas cada una + el panel de preview a la derecha. ───────────
function SecCardSkeleton({ lineas }: { lineas: number }) {
    return (
        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <Skeleton width={30} height={30} radius={8} />
                <Skeleton width={140} height={15} radius={8} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Array.from({ length: lineas }).map((_, i) => <Skeleton key={i} width="100%" height={38} radius={8} />)}
            </div>
        </div>
    )
}

export function AparienciaSkeleton() {
    return (
        <div style={pageWrap}>
            <style>{`
                .ap-split-sk { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 28px; align-items: start; }
                @media (max-width: 1100px) { .ap-split-sk { grid-template-columns: minmax(0,1fr); } }
            `}</style>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
                <div>
                    <Skeleton width={220} height={30} radius={8} style={{ marginBottom: 8 }} />
                    <Skeleton width={320} height={13} radius={8} />
                </div>
                <Skeleton width={140} height={36} radius={8} />
            </div>
            <div className="ap-split-sk">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <SecCardSkeleton lineas={5} />
                    <SecCardSkeleton lineas={4} />
                    <SecCardSkeleton lineas={3} />
                    <SecCardSkeleton lineas={4} />
                </div>
                <Skeleton width="100%" height={640} radius={16} />
            </div>
        </div>
    )
}
