// Loader de marca chico y reutilizable — pensado para cualquier estado de
// carga puntual DENTRO de una pantalla (mandar un email, guardar algo,
// traer una lista) sin tapar todo como `components/PageLoader` (ese es
// solo para transiciones de página completa, a nivel app).
//
// (Fase 3 — Ale, 31/07) Nace puntualmente para el envío de "Email masivo",
// pero la idea es que sea EL loader chico estándar del panel: mismo dibujo
// (el arco orbital + satélite de siempre) en distintos tamaños, con un
// mensaje al lado que cada pantalla adapta a lo que está haciendo
// ("Enviando mails…", "Cargando pedidos…", "Guardando…", etc.) en vez de
// que cada módulo arme su propio spinner suelto.
//
// Uso típico: reemplazar el contenido de una sección/tarjeta/modal por
// <Loader message="Cargando pedidos…" /> mientras se resuelve una carga,
// y volver a mostrar el contenido real cuando termina.

import type { CSSProperties } from 'react'

export type LoaderSize = 'sm' | 'md' | 'lg'

interface LoaderProps {
    message?: string
    size?:    LoaderSize
    style?:   CSSProperties
}

const DIM: Record<LoaderSize, number> = { sm: 32, md: 48, lg: 64 }

export function Loader({ message, size = 'md', style }: LoaderProps) {
    const dim = DIM[size]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, ...style }}>
            <div style={{ position: 'relative', width: dim, height: dim }}>
                {/* Anillo pulsante */}
                <div style={{
                    position:     'absolute',
                    inset:        0,
                    borderRadius: '50%',
                    border:       '1.5px solid rgba(59,130,246,0.35)',
                    animation:    'pulseRing 1.8s ease-out infinite',
                }} />

                {/* Capa giratoria: arco orbital + satélite — mismo dibujo que PageLoader, a escala chica */}
                <svg viewBox="0 0 88 88" fill="none" className="animate-spin" style={{ width: '100%', height: '100%' }}>
                    <circle
                        cx="44" cy="44" r="32"
                        strokeWidth="4.5"
                        strokeDasharray="151 50"
                        strokeLinecap="round"
                        transform="rotate(-90 44 44)"
                        style={{ stroke: 'var(--color-primary)' }}
                    />
                    <circle cx="44" cy="12" r="9" fill="rgba(147,197,253,0.25)" />
                    <circle cx="44" cy="12" r="5.5" fill="#93c5fd" />
                </svg>

                {/* Capa estática: hub central */}
                <svg viewBox="0 0 88 88" fill="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                    <circle cx="44" cy="44" r="18" fill="rgba(59,130,246,0.1)" />
                    <circle cx="44" cy="44" r="10" style={{ fill: 'var(--color-text)' }} />
                </svg>
            </div>

            {message && (
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', textAlign: 'center' }}>
                    {message}
                </span>
            )}
        </div>
    )
}
