// ─── Variante: Checklist de primeros pasos ───────────────────────────────────
//
// Tarjeta flotante persistente abajo a la derecha: las 6 tareas de arranque
// como acordeón, con progreso arriba y acceso directo a cada pantalla. No usa
// backdrop ni spotlight — convive con el panel operable y sobrevive a la
// navegación porque el host la monta en todo el panel. Se minimiza a píldora.

import { useEffect, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import type { PropsVariante } from './TutorialHost'
import { TAREAS_CHECKLIST, TEXTOS, type TareaChecklist } from './copy'
import { CursorFantasma, EstilosTutorial, LinkDiscreto, Pulso, useRectAncla, type PasoCursor } from './piezas'
import { rectDe, resolverAncla } from './anclas'
import { useOrbiStore } from '@/components/orbi/useOrbiStore'

// Ítem del sidebar por el que se llega a cada sección destino — el cursor
// fantasma lo "toca" en el camino para enseñar POR DÓNDE se navega de verdad.
const SIDEBAR_DE: Record<string, string> = {
    configuracion: 'Configuración',
    categorias: 'Productos',
    catalogo: 'Productos',
    dashboard: 'Dashboard',
}

// Widget NO bloqueante: vive debajo de los modales del panel (300) y lejos del
// toast (bottom-center, 9000) — nunca por encima de lo que el usuario opera.
const Z_CHECKLIST = 250

export default function VarianteChecklist(props: PropsVariante) {
    const total = TAREAS_CHECKLIST.length
    const hechas = props.estado.hechas
    // Contamos contra las tareas reales por si quedó un id viejo en storage.
    const nHechas = TAREAS_CHECKLIST.filter(t => hechas.includes(t.id)).length
    const todasHechas = nHechas === total

    // Acordeón: una sola fila abierta a la vez. Arranca abierta la primera
    // pendiente para señalar "por acá se sigue" sin obligar a nada.
    const [abierta, setAbierta] = useState<string | null>(
        () => TAREAS_CHECKLIST.find(t => !props.estado.hechas.includes(t.id))?.id ?? null,
    )

    // El toggle es manual en esta demo: sirve para probar el flujo completo.
    // La versión real engancharía eventos reales del panel (producto creado,
    // MP conectado, tienda publicada…) y el click quedaría como override.
    const alternarHecha = (id: string) => {
        const yaHecha = hechas.includes(id)
        const proximas = yaHecha ? hechas.filter(h => h !== id) : [...hechas, id]
        props.actualizar({ hechas: proximas })
        // Si se completó la fila abierta, abrimos la siguiente pendiente.
        if (!yaHecha && abierta === id) {
            setAbierta(TAREAS_CHECKLIST.find(t => !proximas.includes(t.id))?.id ?? null)
        }
    }

    const reiniciar = () => {
        // El componente no se remonta al reiniciar: el acordeón se resetea acá.
        setAbierta(TAREAS_CHECKLIST[0]?.id ?? null)
        props.reiniciar()
    }

    // El drawer de Orbi (z 200) vive en la misma esquina y quedaría tapado por
    // esta tarjeta (z 250): mientras Orbi está abierto, el checklist se corre.
    const orbiAbierto = useOrbiStore(s => s.isOpen)

    // Recuadro azul guía (mismo Pulso que las otras variantes): cuando la
    // tarea abierta es de ESTA pantalla, se le marca el elemento exacto a
    // tocar — el "Ir a Pagos" te trae y el recuadro te termina de llevar.
    const tareaGuia = abierta ? TAREAS_CHECKLIST.find(t => t.id === abierta && !hechas.includes(t.id)) : undefined
    const guiaActiva =
        !!tareaGuia?.anclaDestino &&
        tareaGuia.seccionDestino === props.seccionActual &&
        !props.estado.minimizado && !orbiAbierto && !todasHechas
    const rectGuia = useRectAncla(tareaGuia?.anclaDestino ?? 'centro', guiaActiva)

    // ── Cursor fantasma ──────────────────────────────────────────────────────
    // "Ir a X" no navega en seco: un puntero animado sale del botón, toca el
    // ítem del menú (así se aprende POR DÓNDE se llega), recién ahí navega, y
    // al aterrizar vuela hasta el elemento exacto y lo marca con "Es acá".
    const [cursor, setCursor] = useState<{ pasos: PasoCursor[]; alTerminar: () => void } | null>(null)
    const [esperandoLlegada, setEsperandoLlegada] = useState<TareaChecklist | null>(null)
    const [esAca, setEsAca] = useState(false)

    const irConCursor = (t: TareaChecklist, e: ReactMouseEvent<HTMLButtonElement>) => {
        const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const itemMenu = SIDEBAR_DE[t.destino[1]] ? resolverAncla(`sidebar:${SIDEBAR_DE[t.destino[1]]}`) : null
        // Sin menú visible (drawer mobile) o con animaciones apagadas: navegar
        // directo, que era el comportamiento de siempre.
        if (reducido || !itemMenu) { props.irA(...t.destino); return }
        const b = e.currentTarget.getBoundingClientRect()
        const m = rectDe(itemMenu, 0)
        setEsAca(false)
        setCursor({
            pasos: [
                { x: b.left + b.width / 2, y: b.top + b.height / 2, ms: 0 },
                { x: m.left + m.width / 2, y: m.top + m.height / 2, ms: 650, click: true },
            ],
            alTerminar: () => {
                setCursor(null)
                props.irA(...t.destino)
                setEsperandoLlegada(t)
            },
        })
    }

    // Segunda mitad del vuelo: cuando la pantalla destino ya está montada, el
    // cursor va del menú al elemento exacto. Se le da una gracia corta al DOM
    // (la pantalla puede estar cargando datos) y si el ancla no aparece, no
    // pasa nada: el anillo pulsante de guiaActiva sigue haciendo su trabajo.
    useEffect(() => {
        if (!esperandoLlegada || props.seccionActual !== esperandoLlegada.seccionDestino) return
        const t = esperandoLlegada
        let intentos = 0
        const timer = window.setInterval(() => {
            const destino = t.anclaDestino ? resolverAncla(t.anclaDestino) : null
            intentos += 1
            if (!destino && intentos < 20) return
            window.clearInterval(timer)
            setEsperandoLlegada(null)
            if (!destino) return
            const itemMenu = SIDEBAR_DE[t.destino[1]] ? resolverAncla(`sidebar:${SIDEBAR_DE[t.destino[1]]}`) : null
            const d = rectDe(destino, 0)
            const desde = itemMenu ? rectDe(itemMenu, 0) : { left: 40, top: window.innerHeight / 2, width: 0, height: 0 }
            setCursor({
                pasos: [
                    { x: desde.left + desde.width / 2, y: desde.top + desde.height / 2, ms: 0 },
                    { x: d.left + d.width / 2, y: d.top + d.height / 2, ms: 750, click: true },
                ],
                alTerminar: () => {
                    setCursor(null)
                    setEsAca(true)
                    window.setTimeout(() => setEsAca(false), 4200)
                },
            })
        }, 150)
        return () => window.clearInterval(timer)
    }, [esperandoLlegada, props.seccionActual, props.irA])

    if (orbiAbierto) return null

    // ── Minimizada: píldora en la misma esquina, un click restaura ───────────
    if (props.estado.minimizado) {
        return (
            <>
                <EstilosTutorial />
                <style>{`@media (max-width: 768px){
                    .tut-check-pill { right: 12px !important; bottom: 12px !important; }
                }`}</style>
                <button
                    className="ds-hover tut-check-pill"
                    onClick={() => props.actualizar({ minimizado: false })}
                    aria-label="Restaurar la lista de primeros pasos"
                    style={{
                        position: 'fixed', right: 20, bottom: 20, zIndex: Z_CHECKLIST,
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '10px 16px', borderRadius: 9999, cursor: 'pointer',
                        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                        boxShadow: '0 8px 24px rgba(2,6,23,0.25)',
                        fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
                        animation: 'orbita-tut-entrada 200ms ease',
                    }}
                >
                    Primeros pasos · {nHechas}/{total}
                </button>
            </>
        )
    }

    // ── Tarjeta completa ─────────────────────────────────────────────────────
    return (
        <>
            <EstilosTutorial />
            <Pulso rect={rectGuia} />
            {cursor && <CursorFantasma pasos={cursor.pasos} alTerminar={cursor.alTerminar} />}
            {/* El remate del vuelo: un cartelito pegado al elemento marcado,
                por si el anillo solo no alcanza. Se va solo a los segundos. */}
            {esAca && guiaActiva && rectGuia && (
                <div className="tut-tarjeta" style={{
                    position: 'fixed', zIndex: 261, pointerEvents: 'none',
                    left: rectGuia.left, top: rectGuia.top + rectGuia.height + 8,
                    background: 'var(--color-primary)', color: 'var(--color-on-primary)',
                    fontSize: 12, fontWeight: 600, borderRadius: 999, padding: '5px 12px',
                    boxShadow: '0 6px 18px rgba(2,6,23,0.35)',
                }}>
                    {tareaGuia?.guiaLabel ?? 'Tocá acá'}
                </div>
            )}
            <style>{`
                /* Acordeón por grid-template-rows (0fr→1fr): anima hasta la altura
                   real del contenido sin medir nada en JS. El hijo con min-height:0
                   + overflow:hidden es el que deja que la fila se achique a cero. */
                .tut-check-exp { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 220ms ease-out; }
                .tut-check-exp > div { min-height: 0; overflow: hidden; visibility: hidden; transition: visibility 220ms; }
                .tut-check-exp-abierta { grid-template-rows: 1fr; }
                .tut-check-exp-abierta > div { visibility: visible; }
                /* El tilde entra con un pop cortito: feedback de "quedó marcada"
                   sin mover un píxel del layout (solo transform/opacity). */
                @keyframes orbita-tut-tilde-pop {
                    from { transform: scale(0.5); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .tut-check-tilde { animation: orbita-tut-tilde-pop 180ms ease-out; }
                /* El círculo del cierre reutiliza la entrada de EstilosTutorial:
                   mismo lenguaje de movimiento que la tarjeta, nada inventado. */
                .tut-check-cierre { animation: orbita-tut-entrada 220ms ease-out; }
                /* Festejo sobrio del cierre: 12 puntitos que salen del tilde y
                   se apagan. Una sola vez, 700ms, nada de loops. */
                @keyframes tut-check-part {
                    from { transform: translate(0, 0) scale(1); opacity: 1; }
                    to { transform: translate(var(--dx), var(--dy)) scale(0.3); opacity: 0; }
                }
                .tut-check-part {
                    position: absolute; left: 50%; top: 50%; width: 6px; height: 6px;
                    border-radius: 999px; pointer-events: none;
                    animation: tut-check-part 700ms ease-out forwards;
                }
                @media (prefers-reduced-motion: reduce) {
                    .tut-check-exp, .tut-check-exp > div { transition: none !important; }
                    .tut-check-tilde, .tut-check-cierre, .tut-check-part { animation: none !important; opacity: 0; }
                }
                @media (max-width: 768px){
                    .tut-check-card { left: 12px !important; right: 12px !important; bottom: 12px !important; width: auto !important; }
                }
            `}</style>
            <div
                className="tut-check-card"
                style={{
                    position: 'fixed', right: 20, bottom: 20, width: 340, zIndex: Z_CHECKLIST,
                    display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
                    // Con una fila abierta la tarjeta crece: que nunca se coma la pantalla.
                    maxHeight: 'min(72vh, 560px)',
                    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                    borderRadius: 12, boxShadow: '0 16px 48px rgba(2,6,23,0.35)',
                    animation: 'orbita-tut-entrada 200ms ease',
                }}
            >
                {/* Header: título, progreso y minimizar */}
                <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Primeros pasos</div>
                            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                                {nHechas} de {total} completados
                            </div>
                        </div>
                        <button
                            className="ds-hover"
                            onClick={() => props.actualizar({ minimizado: true })}
                            aria-label="Minimizar"
                            style={{
                                width: 28, height: 28, flexShrink: 0, borderRadius: 8, border: 'none',
                                background: 'transparent', cursor: 'pointer', padding: 0,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--color-muted)', fontFamily: 'inherit',
                            }}
                        >
                            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </button>
                    </div>
                    <div style={{ marginTop: 10, height: 5, borderRadius: 9999, background: 'var(--color-surface-alt)', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', borderRadius: 9999, background: 'var(--color-primary)',
                            width: `${(nHechas / total) * 100}%`, transition: 'width 300ms ease',
                        }} />
                    </div>
                </div>

                {todasHechas ? (
                    // Cierre festivo sobrio: reemplaza la lista cuando está todo hecho.
                    <div style={{ padding: '22px 18px', textAlign: 'center' }}>
                        {/* Tilde grande arriba del texto: remata el "quedó todo listo"
                            de un vistazo, antes de leer una sola palabra. */}
                        <div
                            className="tut-check-cierre"
                            aria-hidden
                            style={{
                                width: 44, height: 44, margin: '0 auto 12px', borderRadius: 9999,
                                background: 'var(--color-success-bg)', position: 'relative',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            {Array.from({ length: 12 }, (_, k) => {
                                const ang = (k / 12) * Math.PI * 2
                                return (
                                    <span
                                        key={k}
                                        className="tut-check-part"
                                        style={{
                                            background: k % 2 ? 'var(--color-primary)' : 'var(--color-success)',
                                            ['--dx' as never]: `${Math.round(Math.cos(ang) * 46)}px`,
                                            ['--dy' as never]: `${Math.round(Math.sin(ang) * 46)}px`,
                                        }}
                                    />
                                )
                            })}
                            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{TEXTOS.cierreTitulo}</div>
                        <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--color-body)', marginTop: 6 }}>
                            {TEXTOS.cierre}
                        </div>
                        <div style={{ marginTop: 14 }}>
                            <Button size="sm" onClick={props.terminar}>{TEXTOS.listo}</Button>
                        </div>
                    </div>
                ) : (
                    <div style={{ overflowY: 'auto', minHeight: 0 }}>
                        {TAREAS_CHECKLIST.map((t, i) => {
                            const hecha = hechas.includes(t.id)
                            const estaAbierta = abierta === t.id
                            return (
                                <div key={t.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--color-border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}>
                                        <button
                                            className="ds-hover"
                                            onClick={() => alternarHecha(t.id)}
                                            aria-label={hecha ? `Desmarcar "${t.titulo}"` : `Marcar "${t.titulo}" como hecha`}
                                            style={{
                                                // El botón es el área táctil (36px) y el span de adentro el
                                                // círculo visual (20px): dedo cómodo sin engordar el dibujo.
                                                // El margen negativo devuelve los 20px al layout de la fila,
                                                // así nada se corre respecto de cómo estaba antes.
                                                width: 36, height: 36, margin: -8, flexShrink: 0, padding: 0,
                                                background: 'transparent', border: 'none', borderRadius: 9999,
                                                cursor: 'pointer', fontFamily: 'inherit',
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                            }}
                                        >
                                            <span
                                                aria-hidden
                                                style={{
                                                    width: 20, height: 20, borderRadius: 9999, boxSizing: 'border-box',
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                    background: hecha ? 'var(--color-success)' : 'transparent',
                                                    border: `1.5px solid ${hecha ? 'var(--color-success)' : 'var(--color-border-strong)'}`,
                                                    transition: 'background 150ms ease-out, border-color 150ms ease-out',
                                                }}
                                            >
                                                {/* Pendiente = número de paso: el orden ahora es parte del
                                                    contenido (categorías ANTES que producto), no decoración. */}
                                                {!hecha && (
                                                    <span style={{
                                                        fontSize: 10.5, fontWeight: 600, lineHeight: 1,
                                                        fontFamily: '"Geist Mono", monospace', color: 'var(--color-muted)',
                                                    }}>
                                                        {i + 1}
                                                    </span>
                                                )}
                                                {hecha && (
                                                    // Tilde sobre relleno success: --color-on-primary es el
                                                    // "texto sobre color lleno" del sistema en ambos modos.
                                                    // La clase le da el pop de entrada (reduced motion lo apaga).
                                                    <svg className="tut-check-tilde" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                )}
                                            </span>
                                        </button>
                                        <button
                                            className="ds-hover"
                                            onClick={() => setAbierta(estaAbierta ? null : t.id)}
                                            aria-expanded={estaAbierta}
                                            style={{
                                                flex: 1, textAlign: 'left', background: 'transparent', border: 'none',
                                                padding: '2px 4px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                                                display: 'flex', alignItems: 'center', gap: 8,
                                                fontSize: 13, fontWeight: estaAbierta ? 600 : 500,
                                                color: hecha ? 'var(--color-muted)' : 'var(--color-text)',
                                                // Lo hecho se apaga de a poco: opacidad y tachado fundido en
                                                // vez de un salto seco. La línea existe siempre pero queda
                                                // transparente hasta marcar — transicionar su color no mueve
                                                // ni un píxel del layout.
                                                opacity: hecha ? 0.65 : 1,
                                                textDecorationLine: 'line-through',
                                                textDecorationColor: hecha ? 'var(--color-border-strong)' : 'transparent',
                                                transition: 'opacity 200ms ease-out, color 200ms ease-out, text-decoration-color 200ms ease-out',
                                            }}
                                        >
                                            <span style={{ flex: 1, minWidth: 0 }}>{t.titulo}</span>
                                            {/* Chevron: la fila se expande — que se vea que se expande. */}
                                            <svg
                                                aria-hidden width={13} height={13} viewBox="0 0 24 24" fill="none"
                                                stroke="var(--color-subtle)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                                                style={{
                                                    flexShrink: 0,
                                                    transform: estaAbierta ? 'rotate(90deg)' : 'rotate(0deg)',
                                                    transition: 'transform 180ms ease-out',
                                                }}
                                            >
                                                <polyline points="9 18 15 12 9 6" />
                                            </svg>
                                        </button>
                                    </div>
                                    {/* Siempre montado: el acordeón anima con grid-template-rows
                                        (clases tut-check-exp de arriba) y visibility saca lo cerrado
                                        del tab-order y del árbol de accesibilidad al terminar. */}
                                    <div className={estaAbierta ? 'tut-check-exp tut-check-exp-abierta' : 'tut-check-exp'}>
                                        <div>
                                            <div style={{ padding: '0 16px 12px 46px' }}>
                                                <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--color-body)' }}>{t.detalle}</div>
                                                {t.tip && (
                                                    // Tip con la estética de Orbi (violeta + Sparkles, como el
                                                    // botón real "Generar con Orbi" de la pantalla de producto):
                                                    // tokens --color-violet-bg / --chip-violet-fg del sistema.
                                                    <div style={{
                                                        display: 'flex', gap: 8, marginTop: 8, padding: '8px 10px',
                                                        borderRadius: 8, background: 'var(--color-violet-bg)',
                                                        fontSize: 12, lineHeight: 1.5, color: 'var(--chip-violet-fg)',
                                                    }}>
                                                        <Sparkles size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                                                        <span>{t.tip}</span>
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                                                    <Button size="sm" onClick={e => irConCursor(t, e)}>{t.destinoLabel}</Button>
                                                    <LinkDiscreto onClick={() => alternarHecha(t.id)}>
                                                        {hecha ? 'Desmarcar' : 'Marcar como hecha'}
                                                    </LinkDiscreto>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Pie: salidas siempre a mano */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
                    padding: '10px 16px', borderTop: '1px solid var(--color-border)',
                    background: 'var(--color-surface)', borderRadius: '0 0 12px 12px',
                }}>
                    <LinkDiscreto onClick={reiniciar}>{TEXTOS.reiniciar}</LinkDiscreto>
                    <LinkDiscreto onClick={props.terminar}>Ocultar definitivamente</LinkDiscreto>
                </div>
            </div>
        </>
    )
}
