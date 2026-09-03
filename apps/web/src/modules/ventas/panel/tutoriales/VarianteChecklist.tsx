// ─── Variante: Checklist de primeros pasos ───────────────────────────────────
//
// Escritorio / tablet: tarjeta flotante persistente abajo a la derecha con
// las 6 tareas de arranque como acordeón, progreso arriba y acceso directo a
// cada pantalla. Sin backdrop ni spotlight — convive con el panel operable y
// sobrevive a la navegación porque el host la monta en todo el panel.
//
// Celular (≤768px): la tarjeta taparía el 70% de la pantalla, así que vive
// plegada como una barra de una fila abajo ("Paso 2 de 6 · Conectá Mercado
// Pago") y se abre como hoja inferior al tocarla. Al tocar "Ir a X" se pliega
// sola: se llega a la pantalla destino con la barra abajo y el recuadro azul
// marcando qué tocar (la guía hace scroll hasta el elemento).

import { useEffect, useState, useSyncExternalStore } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import type { PropsVariante } from './TutorialHost'
import { TAREAS_CHECKLIST, TEXTOS, type PasoGuia, type TareaChecklist } from './copy'
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

// Guía de una tarea como lista de pasos, tenga uno o varios.
function pasosDe(t: TareaChecklist): PasoGuia[] {
    if (t.pasos?.length) return t.pasos
    if (t.anclaDestino) return [{ ancla: t.anclaDestino, label: t.guiaLabel ?? 'Tocá acá' }]
    return []
}

// ≤768px = celular (mismo corte que el drawer del sidebar). useSyncExternalStore
// y no un effect con setState: sin render extra ni warning del compiler.
const MQ_MOVIL = '(max-width: 768px)'
const suscribirMovil = (cb: () => void) => {
    const mq = window.matchMedia(MQ_MOVIL)
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
}
const useEsMovil = () => useSyncExternalStore(suscribirMovil, () => window.matchMedia(MQ_MOVIL).matches, () => false)

const reducidoMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function VarianteChecklist(props: PropsVariante) {
    const total = TAREAS_CHECKLIST.length
    // hechas = manuales + detectadas por la API (el host ya las mergea y
    // persiste; la unión acá es por si llega una cumplida antes del PUT).
    const auto = props.hechasAuto
    const hechas = [...new Set([...props.estado.hechas, ...auto])]
    // Contamos contra las tareas reales por si quedó un id viejo en storage.
    const nHechas = TAREAS_CHECKLIST.filter(t => hechas.includes(t.id)).length
    const todasHechas = nHechas === total
    const esMovil = useEsMovil()

    // Acordeón: una sola fila abierta a la vez. Arranca abierta la primera
    // pendiente para señalar "por acá se sigue" sin obligar a nada.
    const [abierta, setAbierta] = useState<string | null>(
        () => TAREAS_CHECKLIST.find(t => !props.estado.hechas.includes(t.id))?.id ?? null,
    )

    // Celular: la hoja arranca cerrada (barra plegada) y no se persiste —
    // es un estado de esta pantalla, no del negocio.
    const [hojaAbierta, setHojaAbierta] = useState(false)

    // Dos formas de tildar (pedido de Ale): la API detecta lo cumplido de
    // verdad (hechasAuto: hay productos, MP conectado, tienda publicada...) y
    // eso se tilda solo y queda fijo; el resto se marca a mano como siempre.
    // Si la fila abierta se cumplió sola, se abre la siguiente pendiente
    // (mismo gesto que al tildar a mano). Derivado en render, sin effect.
    const claveAuto = auto.join(',')
    const [claveAutoPrev, setClaveAutoPrev] = useState(claveAuto)
    if (claveAuto !== claveAutoPrev) {
        setClaveAutoPrev(claveAuto)
        if (abierta && auto.includes(abierta)) {
            setAbierta(TAREAS_CHECKLIST.find(t => !hechas.includes(t.id))?.id ?? null)
        }
    }
    const alternarHecha = (id: string) => {
        if (auto.includes(id)) return // cumplida de verdad: no se destilda
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

    // ── Guía en la pantalla destino (recuadro azul + cartelito) ──────────────
    // Cuando la tarea abierta es de ESTA pantalla, se le marca el elemento
    // exacto a tocar. Una tarea puede tener varios pasos (ej. producto: el
    // nombre primero, Orbi después): `pasoGuia` es en cuál está.
    const tareaGuia = abierta ? TAREAS_CHECKLIST.find(t => t.id === abierta && !hechas.includes(t.id)) : undefined
    const pasos = tareaGuia ? pasosDe(tareaGuia) : []
    const [pasoGuia, setPasoGuia] = useState(0)
    // Cambió la tarea o la pantalla → la guía vuelve al primer paso. Reset
    // en render (patrón "derivar estado de props"), sin effect de por medio.
    const claveGuia = `${tareaGuia?.id ?? ''}|${props.seccionActual}`
    const [claveGuiaPrev, setClaveGuiaPrev] = useState(claveGuia)
    if (claveGuia !== claveGuiaPrev) {
        setClaveGuiaPrev(claveGuia)
        setPasoGuia(0)
    }
    const pasoActual: PasoGuia | undefined = pasos[Math.min(pasoGuia, pasos.length - 1)]
    // En celular la barra plegada ES el estado normal: la guía sigue activa.
    // En escritorio, minimizada = el usuario pidió que no lo molesten.
    const tapada = esMovil ? hojaAbierta : props.estado.minimizado
    const guiaActiva =
        !!pasoActual &&
        tareaGuia?.seccionDestino === props.seccionActual &&
        !tapada && !orbiAbierto && !todasHechas
    const rectGuia = useRectAncla(pasoActual?.ancla ?? 'centro', guiaActiva)

    // ── Cursor fantasma ──────────────────────────────────────────────────────
    // "Ir a X" no navega en seco: un puntero animado sale del botón, toca el
    // ítem del menú (así se aprende POR DÓNDE se llega), recién ahí navega, y
    // al aterrizar vuela hasta el elemento exacto y lo marca con el cartelito.
    // En celular no hay menú visible ni mouse: navega directo, la guía hace
    // scroll hasta el elemento y el recuadro + cartelito hacen el resto.
    const [cursor, setCursor] = useState<{ pasos: PasoCursor[]; alTerminar: () => void } | null>(null)
    const [esperandoLlegada, setEsperandoLlegada] = useState<TareaChecklist | null>(null)
    const [esAca, setEsAca] = useState(false)

    const mostrarEsAca = () => {
        setEsAca(true)
        window.setTimeout(() => setEsAca(false), 4200)
    }

    const irConCursor = (t: TareaChecklist, e: ReactMouseEvent<HTMLButtonElement>) => {
        if (esMovil) setHojaAbierta(false)
        const itemMenu = SIDEBAR_DE[t.destino[1]] ? resolverAncla(`sidebar:${SIDEBAR_DE[t.destino[1]]}`) : null
        // Sin menú visible (celular / drawer) o con animaciones apagadas:
        // navegar directo, que era el comportamiento de siempre.
        if (esMovil || reducidoMotion() || !itemMenu) {
            props.irA(...t.destino)
            setEsperandoLlegada(t)
            return
        }
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
    // cursor va del menú al primer paso de la guía. Se le da una gracia corta
    // al DOM (la pantalla puede estar cargando datos) y si el ancla no
    // aparece, no pasa nada: el recuadro de guiaActiva sigue haciendo lo suyo.
    // En celular no hay vuelo: solo el cartelito al llegar.
    useEffect(() => {
        if (!esperandoLlegada || props.seccionActual !== esperandoLlegada.seccionDestino) return
        const t = esperandoLlegada
        const primero = pasosDe(t)[0]
        let intentos = 0
        const timer = window.setInterval(() => {
            const destino = primero ? resolverAncla(primero.ancla) : null
            intentos += 1
            if (!destino && intentos < 20) return
            window.clearInterval(timer)
            setEsperandoLlegada(null)
            if (!destino) return
            if (esMovil || reducidoMotion()) { mostrarEsAca(); return }
            const itemMenu = SIDEBAR_DE[t.destino[1]] ? resolverAncla(`sidebar:${SIDEBAR_DE[t.destino[1]]}`) : null
            const d = rectDe(destino, 0)
            const desde = itemMenu ? rectDe(itemMenu, 0) : { left: 40, top: window.innerHeight / 2, width: 0, height: 0 }
            setCursor({
                pasos: [
                    { x: desde.left + desde.width / 2, y: desde.top + desde.height / 2, ms: 0 },
                    { x: d.left + d.width / 2, y: d.top + d.height / 2, ms: 750, click: true },
                ],
                alTerminar: () => { setCursor(null); mostrarEsAca() },
            })
        }, 150)
        return () => window.clearInterval(timer)
    }, [esperandoLlegada, props.seccionActual, props.irA, esMovil])

    // Avance entre pasos de la guía: cuando el paso actual es "escribí acá",
    // se escucha el input real y, al tener nombre, el cursor vuela de ahí al
    // paso siguiente (Orbi) y el recuadro lo sigue. Si el usuario ya había
    // escrito (volvió a la pantalla), salta directo.
    const anclaPaso = pasoActual?.ancla
    const avanzaAlEscribir = !!pasoActual?.avanzarAlEscribir && pasoGuia < pasos.length - 1
    const anclaSiguiente = pasos[pasoGuia + 1]?.ancla
    useEffect(() => {
        if (!guiaActiva || !avanzaAlEscribir || !anclaPaso) return
        let campo: HTMLInputElement | HTMLTextAreaElement | null = null
        let hecho = false
        const avanzar = (desdeEl: HTMLElement) => {
            if (hecho) return
            hecho = true
            const siguiente = anclaSiguiente ? resolverAncla(anclaSiguiente) : null
            if (!siguiente || esMovil || reducidoMotion()) {
                setPasoGuia(p => p + 1)
                mostrarEsAca()
                return
            }
            const a = rectDe(desdeEl, 0)
            const b = rectDe(siguiente, 0)
            setEsAca(false)
            setCursor({
                pasos: [
                    { x: a.left + a.width / 2, y: a.top + a.height / 2, ms: 0 },
                    { x: b.left + b.width / 2, y: b.top + b.height / 2, ms: 700, click: true },
                ],
                alTerminar: () => {
                    setCursor(null)
                    setPasoGuia(p => p + 1)
                    mostrarEsAca()
                },
            })
        }
        const onInput = () => {
            if (!campo || campo.value.trim().length < 3) return
            // Diferido: este listener nativo corre ANTES que el onChange de
            // React (el nuestro está en el elemento, el de React en la raíz).
            // Si se renderizara acá, el input controlado volvería al valor
            // viejo y se comería la tecla recién escrita.
            const c = campo
            window.setTimeout(() => avanzar(c), 0)
        }
        let intentos = 0
        const timer = window.setInterval(() => {
            const el = resolverAncla(anclaPaso)
            intentos += 1
            if (!el && intentos < 20) return
            window.clearInterval(timer)
            if (!el) return
            const c = el.matches('input, textarea') ? el : el.querySelector('input, textarea')
            if (!c) return
            campo = c as HTMLInputElement | HTMLTextAreaElement
            if (campo.value.trim().length >= 3) { setPasoGuia(p => p + 1); return }
            campo.addEventListener('input', onInput)
        }, 150)
        return () => {
            window.clearInterval(timer)
            campo?.removeEventListener('input', onInput)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guiaActiva, avanzaAlEscribir, anclaPaso, anclaSiguiente, esMovil])

    if (orbiAbierto) return null

    // ── Piezas compartidas entre tarjeta (escritorio) y hoja (celular) ────────

    const encabezado = (alCerrar: () => void, labelCerrar: string, chevron: 'abajo' | 'cerrar') => (
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
                    onClick={alCerrar}
                    aria-label={labelCerrar}
                    style={{
                        width: 36, height: 36, margin: -4, flexShrink: 0, borderRadius: 8, border: 'none',
                        background: 'transparent', cursor: 'pointer', padding: 0,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--color-muted)', fontFamily: 'inherit',
                    }}
                >
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        {chevron === 'abajo' ? <polyline points="6 9 12 15 18 9" /> : <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>}
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
    )

    const cierre = (
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
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{TEXTOS.cierreChecklistTitulo}</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--color-body)', marginTop: 6 }}>
                {TEXTOS.cierreChecklist}
            </div>
            <div style={{ marginTop: 14 }}>
                <Button size="sm" onClick={props.terminar}>{TEXTOS.listo}</Button>
            </div>
        </div>
    )

    const lista = (
        <div style={{ overflowY: 'auto', minHeight: 0, overscrollBehavior: 'contain' }}>
            {TAREAS_CHECKLIST.map((t, i) => {
                const esAuto = auto.includes(t.id)
                const hecha = hechas.includes(t.id)
                const estaAbierta = abierta === t.id
                return (
                    <div key={t.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: esMovil ? '12px 16px' : '10px 16px' }}>
                            <button
                                className={esAuto ? undefined : 'ds-hover'}
                                onClick={() => alternarHecha(t.id)}
                                disabled={esAuto}
                                aria-label={esAuto ? `"${t.titulo}": hecha (detectado solo)` : hecha ? `Desmarcar "${t.titulo}"` : `Marcar "${t.titulo}" como hecha`}
                                title={esAuto ? 'Detectado solo: ya está hecho de verdad' : undefined}
                                style={{
                                    // El botón es el área táctil (44px) y el span de adentro el
                                    // círculo visual (20px): dedo cómodo sin engordar el dibujo.
                                    // El margen negativo devuelve los 20px al layout de la fila,
                                    // así nada se corre respecto de cómo estaba antes.
                                    width: 44, height: 44, margin: -12, flexShrink: 0, padding: 0,
                                    background: 'transparent', border: 'none', borderRadius: 9999,
                                    cursor: esAuto ? 'default' : 'pointer', fontFamily: 'inherit',
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
                                    {/* Pendiente = número de paso: el orden es parte del
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
                                    padding: '2px 4px', minHeight: 32, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
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
                                {esAuto && (
                                    // Se cumplió de verdad: el tilde vino solo, no de un click.
                                    <span style={{
                                        flexShrink: 0, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
                                        textTransform: 'uppercase', color: 'var(--color-success)',
                                    }}>
                                        Listo
                                    </span>
                                )}
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
                            (clases tut-check-exp de abajo) y visibility saca lo cerrado
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
                                        {esAuto ? (
                                            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Detectado solo</span>
                                        ) : (
                                            <LinkDiscreto onClick={() => alternarHecha(t.id)}>
                                                {hecha ? 'Desmarcar' : 'Marcar como hecha'}
                                            </LinkDiscreto>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )

    const pie = (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            padding: '10px 16px', borderTop: '1px solid var(--color-border)',
            background: 'var(--color-surface)', borderRadius: esMovil ? 0 : '0 0 12px 12px',
        }}>
            <LinkDiscreto onClick={reiniciar}>{TEXTOS.reiniciar}</LinkDiscreto>
            <LinkDiscreto onClick={props.terminar}>Ocultar definitivamente</LinkDiscreto>
        </div>
    )

    // El remate de la guía: cartelito pegado al elemento marcado, por si el
    // recuadro solo no alcanza. Se va solo a los segundos. En celular se
    // clampa al ancho de la pantalla.
    const cartelito = esAca && guiaActiva && rectGuia && pasoActual && (
        <div className="tut-tarjeta" style={{
            position: 'fixed', zIndex: 261, pointerEvents: 'none',
            left: Math.max(12, Math.min(rectGuia.left, window.innerWidth - 12 - 280)),
            top: rectGuia.top + rectGuia.height + 8,
            maxWidth: 'calc(100vw - 24px)',
            background: 'var(--color-primary)', color: 'var(--color-on-primary)',
            fontSize: 12, fontWeight: 600, borderRadius: 999, padding: '5px 12px',
            boxShadow: '0 6px 18px rgba(2,6,23,0.35)',
        }}>
            {pasoActual.label}
        </div>
    )

    const estilos = (
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
            /* Hoja inferior (celular): sube desde abajo, 220ms, solo transform. */
            @keyframes orbita-tut-hoja {
                from { transform: translateY(24px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .tut-check-hoja { animation: orbita-tut-hoja 220ms ease-out; }
            @media (prefers-reduced-motion: reduce) {
                .tut-check-exp, .tut-check-exp > div { transition: none !important; }
                .tut-check-tilde, .tut-check-cierre, .tut-check-part { animation: none !important; opacity: 0; }
                .tut-check-hoja { animation: none !important; }
            }
        `}</style>
    )

    // ── Celular: barra plegada u hoja inferior ───────────────────────────────
    if (esMovil) {
        const pendiente = TAREAS_CHECKLIST.find(t => !hechas.includes(t.id))
        const nroPendiente = pendiente ? TAREAS_CHECKLIST.indexOf(pendiente) + 1 : total
        const bordeInferior = 'calc(12px + env(safe-area-inset-bottom, 0px))'
        return (
            <>
                <EstilosTutorial />
                {estilos}
                <Pulso rect={rectGuia} />
                {cartelito}
                {hojaAbierta ? (
                    <>
                        {/* Backdrop: tocar afuera cierra. Deja ver el panel detrás
                            para no perder el contexto de dónde se está. */}
                        <div
                            onClick={() => setHojaAbierta(false)}
                            style={{ position: 'fixed', inset: 0, zIndex: Z_CHECKLIST - 1, background: 'rgba(2,6,23,0.45)' }}
                        />
                        <div
                            className="tut-check-hoja"
                            role="dialog"
                            aria-label="Primeros pasos"
                            style={{
                                position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: Z_CHECKLIST,
                                display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
                                maxHeight: '72vh',
                                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                                background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderBottom: 'none',
                                borderRadius: '16px 16px 0 0', boxShadow: '0 -12px 40px rgba(2,6,23,0.35)',
                            }}
                        >
                            {/* Manija: señal universal de "esto se cierra hacia abajo". */}
                            <div aria-hidden style={{ width: 36, height: 4, borderRadius: 9999, background: 'var(--color-border-strong)', margin: '8px auto -4px' }} />
                            {encabezado(() => setHojaAbierta(false), 'Cerrar la lista de primeros pasos', 'abajo')}
                            {todasHechas ? cierre : lista}
                            {pie}
                        </div>
                    </>
                ) : (
                    <button
                        className="ds-hover"
                        onClick={() => setHojaAbierta(true)}
                        aria-label="Abrir la lista de primeros pasos"
                        style={{
                            position: 'fixed', left: 12, right: 12, bottom: bordeInferior, zIndex: Z_CHECKLIST,
                            height: 56, padding: '0 14px 0 16px', boxSizing: 'border-box',
                            display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                            background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 14,
                            boxShadow: '0 8px 24px rgba(2,6,23,0.3)', cursor: 'pointer',
                            fontFamily: 'inherit', color: 'var(--color-text)',
                            animation: 'orbita-tut-entrada 200ms ease',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Progreso como línea finita arriba de la barra. */}
                        <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, height: 3, width: `${(nHechas / total) * 100}%`, background: 'var(--color-primary)', transition: 'width 300ms ease' }} />
                        <span aria-hidden style={{
                            width: 28, height: 28, borderRadius: 9999, flexShrink: 0, boxSizing: 'border-box',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            background: todasHechas ? 'var(--color-success)' : 'transparent',
                            border: `1.5px solid ${todasHechas ? 'var(--color-success)' : 'var(--color-primary)'}`,
                            fontSize: 12, fontWeight: 600, fontFamily: '"Geist Mono", monospace', color: 'var(--color-primary)',
                        }}>
                            {todasHechas
                                ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                : nroPendiente}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                                {todasHechas ? 'Primeros pasos' : `Paso ${nroPendiente} de ${total} · Primeros pasos`}
                            </span>
                            <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {todasHechas ? TEXTOS.cierreChecklistTitulo : pendiente?.titulo}
                            </span>
                        </span>
                        <svg aria-hidden width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <polyline points="18 15 12 9 6 15" />
                        </svg>
                    </button>
                )}
            </>
        )
    }

    // ── Escritorio, minimizada: píldora en la misma esquina, un click restaura ─
    if (props.estado.minimizado) {
        return (
            <>
                <EstilosTutorial />
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

    // ── Escritorio: tarjeta completa ─────────────────────────────────────────
    return (
        <>
            <EstilosTutorial />
            {estilos}
            <Pulso rect={rectGuia} />
            {cursor && <CursorFantasma pasos={cursor.pasos} alTerminar={cursor.alTerminar} />}
            {cartelito}
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
                {encabezado(() => props.actualizar({ minimizado: true }), 'Minimizar', 'abajo')}
                {todasHechas ? cierre : lista}
                {pie}
            </div>
        </>
    )
}
