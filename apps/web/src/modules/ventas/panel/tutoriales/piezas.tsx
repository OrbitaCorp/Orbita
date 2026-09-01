// ─── Piezas compartidas de las variantes de tutorial ─────────────────────────
//
// Overlay con recorte (spotlight), tarjeta de paso posicionada contra un
// ancla (con caret que la señala), resaltado pulsante no bloqueante y el hook
// que sigue el rect de un ancla viva (scroll/resize/re-render). Todo estilado
// con los tokens del design system (var(--color-*)) — el modo oscuro sale solo.
//
// Las animaciones viven en CLASES (no inline) a propósito: así el bloque de
// prefers-reduced-motion de EstilosTutorial puede apagarlas todas de un saque.

import { CSSProperties, ReactNode, useEffect, useRef, useState } from 'react'
import { RectAncla, esVisible, rectDe, resolverAncla, traerALaVista } from './anclas'

// Por encima de todo el panel (toast 9000, previews 9500/9510) — el tutorial
// es lo último que se dibuja. Ver convención de z-index en tokens/spacing.ts.
export const Z_TUTORIAL = 9600

/**
 * Sigue el rect de un ancla mientras `activo`: la resuelve, la scrollea a la
 * vista una vez, y actualiza el rect ante scroll/resize/cambios de layout.
 * Devuelve null si el ancla no existe o no es visible (fallback: centrado).
 */
export function useRectAncla(ancla: string, activo: boolean): RectAncla | null {
    const [rect, setRect] = useState<RectAncla | null>(null)
    const scrolleado = useRef<string | null>(null)

    useEffect(() => {
        if (!activo) return // sin suscripción; el return de abajo ya devuelve null
        let vivo = true

        const medir = () => {
            if (!vivo) return
            const el = resolverAncla(ancla)
            if (!el || !esVisible(el)) { setRect(null); return }
            if (scrolleado.current !== ancla) {
                scrolleado.current = ancla
                traerALaVista(el)
            }
            const r = rectDe(el)
            setRect(prev =>
                prev && Math.abs(prev.top - r.top) < 1 && Math.abs(prev.left - r.left) < 1 &&
                Math.abs(prev.width - r.width) < 1 && Math.abs(prev.height - r.height) < 1
                    ? prev
                    : r,
            )
        }

        medir()
        // El contenido del panel scrollea dentro de .admin-main → escuchar en
        // captura agarra ese scroll y el de cualquier sub-contenedor.
        window.addEventListener('scroll', medir, true)
        window.addEventListener('resize', medir)
        const timer = window.setInterval(medir, 200) // re-renders/async del panel

        return () => {
            vivo = false
            window.removeEventListener('scroll', medir, true)
            window.removeEventListener('resize', medir)
            window.clearInterval(timer)
        }
    }, [ancla, activo])

    // Derivado en vez de setRect(null) en el effect: mismo resultado sin
    // renders en cascada (react-hooks/set-state-in-effect).
    return activo ? rect : null
}

/** Backdrop oscuro con recorte iluminado sobre el ancla (bloquea clicks). */
export function Recorte({ rect }: { rect: RectAncla | null }) {
    if (!rect) {
        return (
            <div style={{
                position: 'fixed', inset: 0, zIndex: Z_TUTORIAL,
                background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(1.5px)', WebkitBackdropFilter: 'blur(1.5px)',
            }} />
        )
    }
    return (
        <>
            {/* El "agujero": una caja transparente cuya sombra gigante oscurece
                todo lo demás; un segundo halo tenue del primario lo destaca. */}
            <div className="tut-mueve" style={{
                position: 'fixed', zIndex: Z_TUTORIAL,
                top: rect.top, left: rect.left, width: rect.width, height: rect.height,
                borderRadius: 10,
                boxShadow: '0 0 0 100vmax rgba(15,23,42,0.55), 0 0 0 5px color-mix(in srgb, var(--color-primary) 30%, transparent)',
                border: '2px solid var(--color-primary)',
                pointerEvents: 'none',
            }} />
            {/* Bloqueo de clicks en toda la pantalla (el recorte de arriba no captura). */}
            <div style={{ position: 'fixed', inset: 0, zIndex: Z_TUTORIAL - 1 }} />
        </>
    )
}

/** Anillo pulsante NO bloqueante sobre un ancla (variante asistente/tooltips). */
export function Pulso({ rect }: { rect: RectAncla | null }) {
    if (!rect) return null
    return (
        <div className="tut-pulso tut-mueve" style={{
            position: 'fixed', zIndex: 260,
            top: rect.top, left: rect.left, width: rect.width, height: rect.height,
            borderRadius: 10, pointerEvents: 'none',
            border: '2px solid var(--color-primary)',
        }} />
    )
}

type LadoTarjeta = 'abajo' | 'arriba' | 'costado' | 'centro'

/** Posición de la tarjeta relativa al rect del ancla (o centrada) + de qué lado quedó. */
function posicionTarjeta(
    rect: RectAncla | null, ancho: number, alto: number,
): { estilo: CSSProperties; lado: LadoTarjeta; left: number } {
    // Centrado sin transform: la animación de entrada ya usa transform y
    // pisaría el translate(-50%,-50%) durante los primeros 200ms (salto feo).
    const centrada = {
        estilo: { position: 'fixed', top: '50%', left: '50%', marginLeft: -ancho / 2, marginTop: -alto / 2 } as CSSProperties,
        lado: 'centro' as const, left: 0,
    }
    if (typeof window === 'undefined' || !rect) return centrada
    const vw = window.innerWidth
    const vh = window.innerHeight
    const margen = 12
    const sep = 14 // deja lugar para el caret

    let left = rect.left + rect.width / 2 - ancho / 2
    left = Math.max(margen, Math.min(left, vw - ancho - margen))

    const abajo = rect.top + rect.height + sep
    if (abajo + alto <= vh - margen) return { estilo: { position: 'fixed', top: abajo, left }, lado: 'abajo', left }

    const arriba = rect.top - sep - alto
    if (arriba >= margen) return { estilo: { position: 'fixed', top: arriba, left }, lado: 'arriba', left }

    // Sin lugar arriba ni abajo (ancla alta, ej. sidebar entero): al costado.
    const costado = rect.left + rect.width + sep
    if (costado + ancho <= vw - margen) {
        return {
            estilo: { position: 'fixed', top: Math.max(margen, Math.min(rect.top, vh - alto - margen)), left: costado },
            lado: 'costado', left: costado,
        }
    }
    return centrada
}

/** Flechita que une la tarjeta con su ancla (mismo fondo y borde que la tarjeta). */
function Caret({ lado, rect, cardLeft, ancho }: { lado: LadoTarjeta; rect: RectAncla; cardLeft: number; ancho: number }) {
    if (lado === 'centro') return null
    const base: CSSProperties = {
        position: 'absolute', width: 12, height: 12,
        background: 'var(--color-bg)', transform: 'rotate(45deg)',
        border: '1px solid var(--color-border)',
    }
    if (lado === 'costado') {
        // Apunta a la altura del centro del ancla (la tarjeta arranca ~en su top).
        return <span aria-hidden style={{
            ...base, left: -7, top: Math.max(14, Math.min(rect.height / 2 - 6, 40)),
            borderRight: 'none', borderTop: 'none',
        }} />
    }
    // Alineada al centro del ancla, sin salirse de la tarjeta.
    const x = Math.max(16, Math.min(rect.left + rect.width / 2 - cardLeft - 6, ancho - 28))
    if (lado === 'abajo') {
        return <span aria-hidden style={{ ...base, top: -7, left: x, borderRight: 'none', borderBottom: 'none' }} />
    }
    return <span aria-hidden style={{ ...base, bottom: -7, left: x, borderLeft: 'none', borderTop: 'none' }} />
}

export function TarjetaPaso(props: {
    rect: RectAncla | null
    titulo: string
    children: ReactNode
    pie: ReactNode
    /** 'x de y' arriba a la derecha; opcional. */
    progreso?: string
    /** 0..1 → barra finita de progreso en el borde superior de la tarjeta. */
    fraccion?: number
    ancho?: number
    /** Capa: default Z_TUTORIAL+1 (variantes bloqueantes). Las NO bloqueantes
        deben pasar un valor bajo los modales del panel (300). */
    zIndex?: number
    /** Llevar el foco del teclado al primer botón del pie en cada paso.
        SOLO para variantes bloqueantes — robar foco en las no bloqueantes
        interrumpiría lo que el usuario está haciendo en el panel. */
    capturarFoco?: boolean
}) {
    const ancho = props.ancho ?? 340
    const anchoReal = typeof window !== 'undefined' ? Math.min(ancho, window.innerWidth - 24) : ancho
    const ref = useRef<HTMLDivElement>(null)
    const [alto, setAlto] = useState(210)
    // Sin deps a propósito: el alto cambia con el contenido de cada paso y
    // setAlto con el mismo valor no re-renderiza (bailout de React) — no hay
    // cadena infinita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (ref.current) setAlto(ref.current.offsetHeight)
    })

    // Foco al primer botón del pie al cambiar de paso: Enter/Espacio avanzan
    // sin que el usuario tenga que cazar la tarjeta con el mouse.
    const { capturarFoco, titulo } = props
    useEffect(() => {
        if (!capturarFoco) return
        ref.current?.querySelector<HTMLElement>('button')?.focus()
    }, [capturarFoco, titulo])

    const { estilo, lado, left } = posicionTarjeta(props.rect, anchoReal, alto)

    return (
        <div
            ref={ref}
            role="dialog"
            aria-label={props.titulo}
            className="tut-tarjeta tut-mueve"
            style={{
                ...estilo,
                width: anchoReal, zIndex: props.zIndex ?? Z_TUTORIAL + 1, boxSizing: 'border-box',
                background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                borderRadius: 12, padding: 18, boxShadow: '0 16px 48px rgba(2,6,23,0.35)',
            }}
        >
            {props.rect && <Caret lado={lado} rect={props.rect} cardLeft={left} ancho={anchoReal} />}
            {typeof props.fraccion === 'number' && (
                <div aria-hidden style={{
                    position: 'absolute', top: 0, left: 10, right: 10, height: 3,
                    borderRadius: '0 0 3px 3px', overflow: 'hidden', background: 'var(--color-surface-alt)',
                }}>
                    <div style={{
                        width: `${Math.round(Math.max(0, Math.min(1, props.fraccion)) * 100)}%`,
                        height: '100%', background: 'var(--color-primary)',
                        transition: 'width 300ms ease-out',
                    }} />
                </div>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{props.titulo}</div>
                {props.progreso && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', whiteSpace: 'nowrap' }}>
                        {props.progreso}
                    </div>
                )}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--color-body)' }}>{props.children}</div>
            {/* flexWrap: con 4 acciones (Anterior/Siguiente/Saltar/Reiniciar) el pie
                puede superar el ancho de la tarjeta — que baje de línea, no que desborde. */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, rowGap: 6, marginTop: 14 }}>{props.pie}</div>
        </div>
    )
}

/** Link chico y discreto (Saltar / Reiniciar) con área táctil decente. */
export function LinkDiscreto({ onClick, children }: { onClick: () => void; children: ReactNode }) {
    return (
        <button
            className="ds-link"
            onClick={onClick}
            style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '8px 4px', margin: '-8px -4px', // área táctil ~32px sin mover el layout
                fontSize: 12, color: 'var(--color-muted)', fontFamily: 'inherit',
            }}
        >
            {children}
        </button>
    )
}

/** Puntos de progreso (bienvenida). */
export function Puntos({ total, actual, onIr }: { total: number; actual: number; onIr?: (i: number) => void }) {
    return (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            {Array.from({ length: total }, (_, i) => (
                <button
                    key={i}
                    onClick={onIr ? () => onIr(i) : undefined}
                    aria-label={`Paso ${i + 1}`}
                    aria-current={i === actual ? 'step' : undefined}
                    className={onIr ? 'ds-hover' : undefined}
                    style={{
                        width: i === actual ? 18 : 6, height: 6, borderRadius: 9999, border: 'none', padding: 0,
                        cursor: onIr ? 'pointer' : 'default',
                        background: i === actual ? 'var(--color-primary)' : 'var(--color-border-strong)',
                        transition: 'width 200ms ease-out, background 200ms ease-out',
                    }}
                />
            ))}
        </div>
    )
}

// ─── Cursor fantasma ─────────────────────────────────────────────────────────
//
// Un puntero animado que MUESTRA el camino: aparece donde tocó el usuario,
// vuela hasta el elemento real y "hace click" (onda expansiva). Aprender
// viendo el mouse moverse es más directo que leer adónde ir. No captura
// eventos (pointer-events none): es puro teatro, el click real lo hace el
// código que lo coreografía.

export interface PasoCursor {
    x: number
    y: number
    /** Duración del vuelo hasta este punto (0 = teletransporte inicial). */
    ms: number
    /** Al llegar, dibujar la onda de click. */
    click?: boolean
}

export function CursorFantasma({ pasos, alTerminar }: { pasos: PasoCursor[]; alTerminar: () => void }) {
    const [idx, setIdx] = useState(0)
    const [onda, setOnda] = useState<number | null>(null)

    // Coreografía por timeouts: cada paso espera su vuelo + una pausa corta
    // para que el click se lea. El cleanup corta todo si el componente se va.
    const { length } = pasos
    const alTerminarRef = useRef(alTerminar)
    useEffect(() => { alTerminarRef.current = alTerminar }, [alTerminar])
    useEffect(() => {
        if (idx >= length) return
        const paso = pasos[idx]
        const timer = window.setTimeout(() => {
            if (paso.click) setOnda(idx)
            if (idx + 1 < length) setIdx(idx + 1)
            else window.setTimeout(() => alTerminarRef.current(), paso.click ? 420 : 120)
        }, paso.ms + (paso.click ? 260 : 40))
        return () => window.clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idx, length])

    const actual = pasos[Math.min(idx, length - 1)]
    if (!actual) return null

    return (
        <div
            aria-hidden
            style={{
                position: 'fixed', zIndex: Z_TUTORIAL + 50, pointerEvents: 'none',
                left: actual.x, top: actual.y,
                transition: `left ${actual.ms}ms cubic-bezier(0.3, 0.9, 0.35, 1), top ${actual.ms}ms cubic-bezier(0.3, 0.9, 0.35, 1)`,
            }}
        >
            {onda !== null && (
                <span key={onda} className="tut-cursor-onda" style={{
                    position: 'absolute', left: -4, top: -4, width: 40, height: 40, borderRadius: 9999,
                    border: '2.5px solid var(--color-primary)',
                }} />
            )}
            {/* Flecha clásica de mouse: blanca con borde oscuro, se ve sobre
                cualquier fondo de cualquier tema. */}
            <svg width={26} height={26} viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 2px 5px rgba(2,6,23,0.45))' }}>
                <path
                    d="M5 3 L19 12.5 L12.6 13.8 L15.6 20.2 L13 21.4 L10 15 L5 19.5 Z"
                    fill="#FFFFFF" stroke="#1E293B" strokeWidth={1.4} strokeLinejoin="round"
                />
            </svg>
        </div>
    )
}

/**
 * Keyframes y clases de movimiento del tutorial — montar una sola vez por
 * variante. prefers-reduced-motion apaga TODO el movimiento de un saque
 * (por eso las animaciones van por clase y no inline).
 */
export function EstilosTutorial() {
    return (
        <style>{`
            @keyframes orbita-tut-entrada {
                from { opacity: 0; transform: translateY(6px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes orbita-tut-pulso {
                0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary) 45%, transparent); }
                50% { box-shadow: 0 0 0 8px color-mix(in srgb, var(--color-primary) 0%, transparent); }
            }
            @keyframes orbita-tut-onda {
                from { transform: scale(0.25); opacity: 0.9; }
                to { transform: scale(1.5); opacity: 0; }
            }
            .tut-tarjeta { animation: orbita-tut-entrada 200ms ease-out; }
            .tut-pulso { animation: orbita-tut-pulso 1.6s ease-in-out infinite; }
            .tut-cursor-onda { animation: orbita-tut-onda 460ms ease-out forwards; }
            /* La tarjeta, el recorte y el pulso siguen al ancla con suavidad. */
            .tut-mueve { transition: top 240ms ease-out, left 240ms ease-out, width 240ms ease-out, height 240ms ease-out; }
            @media (prefers-reduced-motion: reduce) {
                .tut-tarjeta, .tut-pulso, .tut-cursor-onda { animation: none !important; }
                .tut-mueve { transition: none !important; }
            }
        `}</style>
    )
}
