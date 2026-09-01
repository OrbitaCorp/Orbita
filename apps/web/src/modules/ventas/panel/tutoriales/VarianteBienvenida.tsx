// ─── Variante: Hotspots (bienvenida, v3) ─────────────────────────────────────
//
// Tercer concepto para esta ranura (v1 slides y v2 mapa no convencieron).
// Patrón estilo Figma/Linear: puntos pulsantes repartidos sobre la UI REAL
// — uno por sección en el sidebar, uno en el buscador del header — todos a la
// vez, sin orden y sin bloquear nada. Tocás el que te da curiosidad, se abre
// una mini-tarjeta con el copy de esa sección y el punto se apaga. Una píldora
// discreta lleva la cuenta; al apagar todos, cierre breve.
//
// Mantiene el id/URL `?tutorial=bienvenida` y el modelo del host:
// seccionesVistas = puntos apagados, paso = 1 si la intro ya se mostró.

import { useEffect, useRef, useState } from 'react'
import type { PropsVariante } from './TutorialHost'
import { Button } from '@/design-system/components/Button'
import { HERRAMIENTAS, SECCIONES, TEXTOS } from './copy'
import { EstilosTutorial, LinkDiscreto, TarjetaPaso } from './piezas'
import { RectAncla, esVisible, rectDe, resolverAncla } from './anclas'

interface Hotspot {
    id: string
    ancla: string
    titulo: string
    /** Cuerpo de la mini-tarjeta (3-4 líneas, sin listas largas). */
    cuerpo: string
    /** Línea "Primer paso" opcional. */
    primerPaso?: string
}

// Un punto por sección (anclado a su ítem real del sidebar) + el buscador.
// El copy sale de copy.ts: misma información que las otras variantes.
const HOTSPOTS: Hotspot[] = [
    ...SECCIONES.map(s => ({
        id: s.id,
        ancla: `sidebar:${s.sidebarTexto}`,
        titulo: s.titulo,
        cuerpo: `${s.queEs} ${s.paraQue}`,
        primerPaso: s.accionClave,
    })),
    {
        id: 'herramientas',
        ancla: 'header:buscador',
        titulo: 'Búsqueda y herramientas',
        cuerpo: `${HERRAMIENTAS[0].texto} Al lado tenés: ${HERRAMIENTAS.slice(1).map(h => h.titulo).join(' · ')}.`,
    },
]

/**
 * Mide TODOS los hotspots con un solo intervalo (a diferencia de useRectAncla,
 * que es un ancla por hook): 9 intervalos separados serían puro desperdicio.
 */
function useRects(activo: boolean): Record<string, RectAncla | null> {
    const [rects, setRects] = useState<Record<string, RectAncla | null>>({})

    useEffect(() => {
        if (!activo) return
        let vivo = true

        const medir = () => {
            if (!vivo) return
            const proximos: Record<string, RectAncla | null> = {}
            for (const h of HOTSPOTS) {
                const el = resolverAncla(h.ancla)
                proximos[h.id] = el && esVisible(el) ? rectDe(el, 0) : null
            }
            setRects(prev => {
                for (const h of HOTSPOTS) {
                    const a = prev[h.id]
                    const b = proximos[h.id]
                    if (!!a !== !!b) return proximos
                    if (a && b && (Math.abs(a.top - b.top) > 1 || Math.abs(a.left - b.left) > 1 || Math.abs(a.width - b.width) > 1)) {
                        return proximos
                    }
                }
                return prev // nada se movió: mismo objeto, sin re-render
            })
        }

        medir()
        window.addEventListener('scroll', medir, true)
        window.addEventListener('resize', medir)
        const timer = window.setInterval(medir, 200)
        return () => {
            vivo = false
            window.removeEventListener('scroll', medir, true)
            window.removeEventListener('resize', medir)
            window.clearInterval(timer)
        }
    }, [activo])

    return activo ? rects : {}
}

export default function VarianteBienvenida(props: PropsVariante) {
    const { estado, actualizar, terminar, reiniciar } = props

    // Punto con la mini-tarjeta abierta (null = ninguno).
    const [abierto, setAbierto] = useState<string | null>(null)

    const apagados = estado.seccionesVistas
    const pendientes = HOTSPOTS.filter(h => !apagados.includes(h.id))
    const completado = pendientes.length === 0
    const introVista = estado.paso >= 1

    const rects = useRects(!completado)
    const hotspotAbierto = abierto ? HOTSPOTS.find(h => h.id === abierto) ?? null : null
    const rectAbierto = abierto ? rects[abierto] ?? null : null

    const entendido = (id: string) => {
        setAbierto(null)
        if (!apagados.includes(id)) actualizar({ seccionesVistas: [...apagados, id] })
    }

    // El host no remonta al reiniciar: la tarjeta abierta se cierra acá.
    const reiniciarHotspots = () => {
        setAbierto(null)
        reiniciar()
    }

    // Escape cierra la mini-tarjeta abierta (nada más — no hay nada que bloquee).
    const abiertoRef = useRef(abierto)
    useEffect(() => { abiertoRef.current = abierto }, [abierto])
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && abiertoRef.current !== null) setAbierto(null)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    return (
        <>
            <EstilosTutorial />
            <style>{`
                @keyframes tut-hs-halo {
                    0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary) 50%, transparent); }
                    70% { box-shadow: 0 0 0 9px color-mix(in srgb, var(--color-primary) 0%, transparent); }
                    100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary) 0%, transparent); }
                }
                .tut-hs-punto {
                    animation: tut-hs-halo 2s ease-out infinite;
                    transition: transform 150ms ease-out;
                }
                .tut-hs-punto:hover { transform: scale(1.35); }
                @media (max-width: 768px) {
                    .tut-hs-pildora { left: 12px !important; bottom: 12px !important; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .tut-hs-punto { animation: none !important; transition: none !important; }
                    .tut-hs-punto:hover { transform: none !important; }
                }
            `}</style>

            {/* ── Los puntos: sobre el borde derecho de su ancla, sin bloquear nada ── */}
            {!completado && pendientes.map(h => {
                const r = rects[h.id]
                if (!r) return null // ancla oculta (drawer mobile, colapso): el punto no está
                const top = Math.max(8, r.top + r.height / 2 - 7)
                const left = Math.min(
                    typeof window !== 'undefined' ? window.innerWidth - 22 : r.left + r.width,
                    r.left + r.width - 7,
                )
                return (
                    <button
                        key={h.id}
                        className="tut-hs-punto"
                        aria-label={`Qué es ${h.titulo}`}
                        onClick={() => setAbierto(h.id)}
                        style={{
                            position: 'fixed', top, left, zIndex: 260,
                            width: 14, height: 14, borderRadius: 9999, padding: 0,
                            cursor: 'pointer', border: '2px solid var(--color-bg)',
                            background: 'var(--color-primary)',
                        }}
                    />
                )
            })}

            {/* ── Mini-tarjeta del punto abierto (no bloqueante, bajo modales) ── */}
            {hotspotAbierto && (
                <TarjetaPaso
                    rect={rectAbierto}
                    zIndex={261}
                    titulo={hotspotAbierto.titulo}
                    pie={
                        <>
                            <Button size="sm" onClick={() => entendido(hotspotAbierto.id)}>{TEXTOS.entendido}</Button>
                            <span style={{ flex: 1 }} />
                            <LinkDiscreto onClick={() => setAbierto(null)}>Cerrar</LinkDiscreto>
                        </>
                    }
                >
                    {hotspotAbierto.cuerpo}
                    {hotspotAbierto.primerPaso && (
                        <span style={{ display: 'block', marginTop: 8, fontSize: 12.5 }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Primer paso: </span>
                            {hotspotAbierto.primerPaso}
                        </span>
                    )}
                </TarjetaPaso>
            )}

            {/* ── Intro de una sola vez: qué son los puntos (no bloquea, abajo al centro) ── */}
            {!introVista && !completado && abierto === null && (
                <div
                    className="tut-tarjeta"
                    role="status"
                    style={{
                        // Centrado sin transform: la animación de entrada de .tut-tarjeta
                        // ya anima transform y lo pisaría durante los primeros 200ms.
                        position: 'fixed', bottom: 24, left: 0, right: 0, margin: '0 auto', width: 'fit-content',
                        zIndex: 259, display: 'flex', alignItems: 'center', gap: 12,
                        maxWidth: 'min(430px, calc(100vw - 24px))', boxSizing: 'border-box',
                        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                        borderRadius: 12, padding: '12px 16px', boxShadow: 'var(--shadow-card-hover)',
                    }}
                >
                    <span aria-hidden className="tut-hs-punto" style={{
                        width: 14, height: 14, borderRadius: 9999, flexShrink: 0,
                        border: '2px solid var(--color-bg)', background: 'var(--color-primary)',
                    }} />
                    <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--color-body)' }}>
                        Los puntos azules explican el panel. Tocalos cuando quieras, en el orden que quieras.
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => actualizar({ paso: 1 })}>Ok</Button>
                </div>
            )}

            {/* ── Cierre: se apagaron los 9 ── */}
            {completado && (
                <TarjetaPaso
                    rect={null}
                    zIndex={261}
                    titulo={TEXTOS.cierreTitulo}
                    pie={
                        <>
                            <Button size="sm" onClick={terminar}>{TEXTOS.listo}</Button>
                            <span style={{ flex: 1 }} />
                            <LinkDiscreto onClick={reiniciarHotspots}>{TEXTOS.reiniciar}</LinkDiscreto>
                        </>
                    }
                >
                    {TEXTOS.cierre}
                </TarjetaPaso>
            )}

            {/* ── Píldora discreta: cuenta regresiva + salidas ── */}
            {!completado && (
                <div
                    className="tut-hs-pildora"
                    style={{
                        position: 'fixed', left: 252, bottom: 16, zIndex: 250,
                        display: 'inline-flex', alignItems: 'center', gap: 10,
                        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                        borderRadius: 9999, padding: '7px 14px',
                        fontSize: 12, fontWeight: 600, color: 'var(--color-text)',
                        boxShadow: 'var(--shadow-card-hover)',
                    }}
                >
                    <span aria-hidden style={{ width: 8, height: 8, borderRadius: 9999, background: 'var(--color-primary)', flexShrink: 0 }} />
                    {pendientes.length === 1 ? 'Queda 1 punto' : `Quedan ${pendientes.length} puntos`}
                    <span style={{ display: 'inline-flex', gap: 10, marginLeft: 2 }}>
                        <LinkDiscreto onClick={reiniciarHotspots}>{TEXTOS.reiniciar}</LinkDiscreto>
                        <LinkDiscreto onClick={terminar}>{TEXTOS.saltar}</LinkDiscreto>
                    </span>
                </div>
            )}
        </>
    )
}
