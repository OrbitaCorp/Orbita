// ─── Variante: Guía lateral estilo asistente (hacelo vos) ────────────────────
//
// Panel acoplado abajo a la derecha que NO bloquea el panel real: pide
// acciones concretas ("abrí Pedidos") y avanza solo cuando detecta que el
// usuario llegó a la sección pedida (seccionActual viene por props, el host
// re-renderiza al navegar — no hace falta escuchar el router acá). El avance
// se persiste en estado.paso para sobrevivir a la navegación.

import { Fragment, useEffect, useRef, useState } from 'react'
import { Button } from '@/design-system/components/Button'
import type { PropsVariante } from './TutorialHost'
import { MISIONES_ASISTENTE, TEXTOS } from './copy'
import { EstilosTutorial, LinkDiscreto, Pulso, useRectAncla } from './piezas'
import { useOrbiStore } from '@/components/orbi/useOrbiStore'

// Mini-parser de **negritas** del copy: split por '**' deja lo resaltado en
// los índices impares. Alcanza para el markdown mínimo de las misiones.
function Negritas({ texto }: { texto: string }) {
    return (
        <>
            {texto.split('**').map((parte, i) =>
                i % 2 === 1
                    ? <strong key={i} style={{ color: 'var(--color-text)', fontWeight: 600 }}>{parte}</strong>
                    : <Fragment key={i}>{parte}</Fragment>,
            )}
        </>
    )
}

// Resumen de una misión ya pasada para la historia colapsada: el pedido sin
// markdown, cortado para que quede en una línea como mucho.
function resumen(pedido: string): string {
    const plano = pedido.replace(/\*\*/g, '')
    return plano.length > 48 ? `${plano.slice(0, 48).trimEnd()}…` : plano
}

type Fase = 'intro' | 'anda' | 'llegaste'

export default function VarianteAsistente(props: PropsVariante) {
    const { estado, actualizar, terminar, reiniciar, seccionActual, irA } = props

    const total = MISIONES_ASISTENTE.length
    // Clamp defensivo: si quedó un paso fuera de rango en la base
    // (cambió la lista de misiones entre sesiones), no explotamos.
    const paso = Math.max(0, Math.min(estado.paso, total - 1))
    const mision = MISIONES_ASISTENTE[paso]
    const esUltima = paso === total - 1

    // Minimizado local: en esta variante no hace falta que sobreviva a la
    // navegación (el panel vuelve abierto y eso está bien para la demo).
    const [minimizada, setMinimizada] = useState(false)

    // Si el usuario ya está parado en la sección pedida, la misión nace en
    // fase "llegaste" — de acá sale gratis el "ya estabas ahí".
    const fase: Fase =
        mision.esperaSeccion === null ? 'intro'
            : seccionActual === mision.esperaSeccion ? 'llegaste'
                : 'anda'

    // Rescate "Llevame": si a los ~6 segundos de pedirle que navegue todavía
    // no llegó, le ofrecemos llevarlo nosotros. Guardamos EL PASO en el que
    // venció el timer (no un booleano) a propósito: al cambiar de misión el
    // valor viejo deja de matchear solo, sin resetear estado dentro de un
    // effect (react-hooks/set-state-in-effect).
    const [rescatePaso, setRescatePaso] = useState<number | null>(null)
    useEffect(() => {
        if (fase !== 'anda') return
        const timer = window.setTimeout(() => setRescatePaso(paso), 6000)
        // Limpieza al desmontar o al cambiar de paso/fase: nada de timers
        // colgados que hagan aparecer el botón en la misión equivocada.
        return () => window.clearTimeout(timer)
    }, [paso, fase])
    // Al llegar a la sección, fase deja de ser 'anda' y el botón desaparece.
    const mostrarLlevame = fase === 'anda' && rescatePaso === paso

    const llevame = () => {
        // En fase 'anda' siempre hay sección destino; el if es solo para el
        // narrowing de TS (esperaSeccion es string | null en el tipo).
        if (mision.esperaSeccion) irA('ventas', mision.esperaSeccion)
    }

    // El pulso sobre el sidebar solo mientras esperamos que navegue y la guía
    // está a la vista: minimizada, el resaltado suelto quedaría sin contexto.
    const orbiAbierto = useOrbiStore(s => s.isOpen)
    const rectSidebar = useRectAncla(
        mision.resaltaSidebar ? `sidebar:${mision.resaltaSidebar}` : 'centro',
        fase === 'anda' && !minimizada && !orbiAbierto,
    )

    // Auto-scroll al fondo cuando cambia el paso o la fase: la historia crece
    // arriba y lo nuevo tiene que quedar siempre visible, como en un chat.
    // mostrarLlevame también: el rescate aparece al final y no sirve de nada
    // si queda abajo del pliegue del scroll.
    const panelRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const el = panelRef.current
        if (el) el.scrollTop = el.scrollHeight
    }, [paso, fase, minimizada, mostrarLlevame])

    const avanzar = () => {
        if (esUltima) terminar()
        else actualizar({ paso: paso + 1 })
    }

    // El drawer de Orbi (z 200, right:0, 360px) quedaría tapado por la guía
    // (z 260, misma esquina): mientras Orbi está abierto, la guía se esconde
    // y reaparece al cerrarlo. Después de todos los hooks a propósito.
    if (orbiAbierto) return null

    // Estilos propios de la variante: la media query mobile compartida por el
    // panel y la píldora, más las animaciones de esta variante. Van por CLASE
    // (no inline) para que el bloque de prefers-reduced-motion de acá abajo
    // las apague todas de un saque — el de EstilosTutorial no las conoce.
    const estilosPropios = (
        <style>{`
            @media (max-width: 768px) {
                .tut-asist-panel { left: 12px !important; right: 12px !important; bottom: 12px !important; width: auto !important; }
                .tut-asist-pill { right: 12px !important; bottom: 12px !important; }
            }
            @keyframes orbita-tut-asist-entrada {
                from { opacity: 0; transform: translateY(6px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes orbita-tut-asist-check {
                from { transform: scale(0.5); }
                to { transform: scale(1); }
            }
            /* Entrada del rescate "Llevame" y del bloque de "llegaste": lo
               nuevo del chat asoma desde abajo, igual que el panel entero. */
            .tut-asist-entra { animation: orbita-tut-asist-entrada 220ms ease-out; }
            /* inline-block porque transform no aplica sobre inline a secas. */
            .tut-asist-check { display: inline-block; animation: orbita-tut-asist-check 180ms ease-out; }
            .tut-asist-barra { transition: width 300ms ease-out; }
            @media (prefers-reduced-motion: reduce) {
                .tut-asist-entra, .tut-asist-check { animation: none !important; }
                .tut-asist-barra { transition: none !important; }
            }
        `}</style>
    )

    if (minimizada) {
        return (
            <>
                <EstilosTutorial />
                {estilosPropios}
                <button
                    className="ds-hover tut-asist-pill"
                    aria-label="Abrir guía"
                    onClick={() => setMinimizada(false)}
                    style={{
                        position: 'fixed', right: 16, bottom: 16, zIndex: 260,
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        height: 34, padding: '0 14px', borderRadius: 9999,
                        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                        boxShadow: '0 8px 24px rgba(2,6,23,0.25)',
                        cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 12, fontWeight: 600, color: 'var(--color-text)',
                        animation: 'orbita-tut-entrada 200ms ease',
                    }}
                >
                    <span style={{ color: 'var(--color-primary)', fontSize: 10 }}>●</span>
                    Guía · {paso + 1}/{total}
                </button>
            </>
        )
    }

    return (
        <>
            <EstilosTutorial />
            {estilosPropios}
            {fase === 'anda' && <Pulso rect={rectSidebar} />}

            <div
                ref={panelRef}
                className="tut-asist-panel"
                style={{
                    position: 'fixed', right: 16, bottom: 16, width: 330,
                    maxHeight: 'calc(100vh - 96px)', overflow: 'auto',
                    // 260: widget no bloqueante que convive con el panel, debajo
                    // de modales (300) y del toast (9000). No usa Z_TUTORIAL
                    // porque acá no hay overlay que bloquee nada.
                    zIndex: 260, boxSizing: 'border-box',
                    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                    borderRadius: 12, boxShadow: '0 16px 48px rgba(2,6,23,0.35)',
                    animation: 'orbita-tut-entrada 200ms ease',
                }}
            >
                {/* Header sticky: la historia scrollea por abajo sin taparlo. */}
                <div style={{
                    position: 'sticky', top: 0, zIndex: 1,
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px 16px', background: 'var(--color-bg)',
                    borderBottom: '1px solid var(--color-border)',
                }}>
                    <span style={{ color: 'var(--color-primary)', fontSize: 10 }}>●</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Guía del panel</span>
                    <span style={{
                        marginLeft: 'auto', fontSize: 11, color: 'var(--color-muted)',
                        fontFamily: '"Geist Mono", monospace', whiteSpace: 'nowrap',
                    }}>
                        paso {paso + 1} de {total}
                    </span>
                    <button
                        className="ds-hover"
                        aria-label="Minimizar guía"
                        onClick={() => setMinimizada(true)}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '2px 6px', borderRadius: 8, lineHeight: 1,
                            fontSize: 13, color: 'var(--color-muted)', fontFamily: 'inherit',
                        }}
                    >
                        ▾
                    </button>
                    {/* Barra de progreso finita pegada al borde de abajo del
                        header. Va ADENTRO del sticky para viajar con él cuando
                        la historia scrollea. paso/(total-1) y no paso/total:
                        la última misión tiene que mostrar la barra llena.
                        aria-hidden porque "paso x de y" ya dice lo mismo. */}
                    <div aria-hidden style={{
                        position: 'absolute', left: 0, right: 0, bottom: 0, height: 3,
                        background: 'var(--color-surface-alt)',
                    }}>
                        <div className="tut-asist-barra" style={{
                            width: `${(paso / (total - 1)) * 100}%`,
                            height: '100%', background: 'var(--color-primary)',
                        }} />
                    </div>
                </div>

                <div style={{ padding: 16 }}>
                    {/* Historia: misiones ya cumplidas, colapsadas a tildes para
                        dar sensación de conversación que avanza. */}
                    {paso > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                            {MISIONES_ASISTENTE.slice(0, paso).map(m => (
                                <div key={m.id} style={{
                                    display: 'flex', gap: 6, alignItems: 'flex-start',
                                    fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.4,
                                }}>
                                    <span style={{ color: 'var(--color-success)', flexShrink: 0 }}>✓</span>
                                    <span>{resumen(m.pedido)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pedido de la misión actual. */}
                    <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--color-body)' }}>
                        <Negritas texto={mision.pedido} />
                    </div>

                    {fase === 'intro' && (
                        <Button onClick={avanzar} style={{ marginTop: 14 }}>
                            {TEXTOS.empezar}
                        </Button>
                    )}

                    {fase === 'anda' && (
                        <div style={{ marginTop: 12 }}>
                            {mostrarLlevame && (
                                <div className="tut-asist-entra" style={{ marginBottom: 12 }}>
                                    {/* Rescate para el que se trabó: navega POR él.
                                        No pisa a "Saltar", que es otra cosa — saltar
                                        pasa de largo sin mostrarle la sección. */}
                                    <Button variant="secondary" size="sm" onClick={llevame}>
                                        Llevame
                                    </Button>
                                </div>
                            )}
                            {/* Escape para la demo: avanza sin navegar, y en la
                                última misión saltar equivale a terminar. */}
                            <LinkDiscreto onClick={avanzar}>Saltar este paso</LinkDiscreto>
                        </div>
                    )}

                    {/* La clase de entrada va acá y no adentro: el bloque entero
                        (tilde + explicación + botón) asoma junto como un mensaje
                        nuevo de chat; el ✓ suma su micro-scale encima. */}
                    {fase === 'llegaste' && (
                        <div className="tut-asist-entra" style={{ marginTop: 12 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                <span className="tut-asist-check" style={{ color: 'var(--color-success)', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>✓</span>
                                <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--color-body)' }}>
                                    <Negritas texto={mision.explicacion} />
                                </div>
                            </div>
                            <Button size="sm" onClick={avanzar} style={{ marginTop: 12 }}>
                                {esUltima ? TEXTOS.listo : TEXTOS.siguiente}
                            </Button>
                        </div>
                    )}
                </div>

                {/* Pie al fondo del scroll: reinicio y salida, siempre presentes. */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 16px', borderTop: '1px solid var(--color-border)',
                }}>
                    <LinkDiscreto onClick={reiniciar}>{TEXTOS.reiniciar}</LinkDiscreto>
                    <span style={{ color: 'var(--color-border-strong)', fontSize: 12 }}>·</span>
                    <LinkDiscreto onClick={terminar}>Cerrar guía</LinkDiscreto>
                </div>
            </div>
        </>
    )
}
