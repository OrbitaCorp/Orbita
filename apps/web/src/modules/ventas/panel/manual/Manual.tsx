// src/modules/ventas/panel/manual/Manual.tsx — Módulo "Manual"
//
// El manual de uso completo del panel, en pantalla: un índice fijo a la
// izquierda y el contenido a la derecha, con buscador arriba y un botón
// "Ir a…" en cada tema que te deja parado en la pantalla que se está
// explicando.
//
// Es el complemento del tutorial de Primeros pasos (tutoriales/), no su
// reemplazo: el tutorial te lleva de la mano por las seis o siete cosas que
// hay que hacer sí o sí; el manual explica TODO, incluido lo que se usa una
// vez cada tanto y justo ahí uno no se acuerda de dónde estaba.
//
// Todo el texto vive en contenido.ts — este archivo no tiene copy propio más
// que los rótulos de la cáscara (título, buscador, vacío de búsqueda).

import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Search, X, ChevronRight, ArrowUp } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { CAPITULOS, TOTAL_TEMAS, textoPlano, type Capitulo, type Tema } from './contenido'
import { BloqueVista, BotonIr } from './piezas'

const idTema = (capId: string, temaId: string) => `man-${capId}-${temaId}`
const idCapitulo = (capId: string) => `man-cap-${capId}`

/** Saca tildes y pasa a minúsculas: buscar "publicacion" tiene que encontrar
 *  "publicación". */
const normalizar = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** "1 tema" / "5 temas" \u2014 el contador de resultados se lee, no se completa
 *  con par\u00e9ntesis. */
const plural = (n: number, uno: string, varios: string) =>
    `${n} ${n === 1 ? uno : varios}`

export default function Manual() {
    const [q, setQ] = useState('')
    const [activo, setActivo] = useState<string>('')
    const [indiceAbierto, setIndiceAbierto] = useState(false)
    const [arribaVisible, setArribaVisible] = useState(false)
    const contenedorRef = useRef<HTMLDivElement>(null)
    const indiceRef = useRef<HTMLDivElement>(null)

    // ── Búsqueda ────────────────────────────────────────────────────────────
    // Filtra por texto plano del tema (título + todos sus bloques). Un
    // capítulo cuyo TÍTULO o resumen matchea se muestra entero: si alguien
    // busca "cupones", quiere el capítulo completo, no los dos temas donde
    // esa palabra aparece escrita.
    const capitulosFiltrados: Capitulo[] = useMemo(() => {
        const term = normalizar(q.trim())
        if (term.length < 2) return CAPITULOS
        return CAPITULOS.flatMap(cap => {
            if (normalizar(`${cap.titulo} ${cap.resumen}`).includes(term)) return [cap]
            const temas = cap.temas.filter(t => normalizar(textoPlano(t)).includes(term))
            return temas.length > 0 ? [{ ...cap, temas }] : []
        })
    }, [q])

    const buscando = q.trim().length >= 2
    const sinResultados = buscando && capitulosFiltrados.length === 0

    // ── Scroll-spy + botón "volver arriba" ──────────────────────────────────
    //
    // Activo = el ÚLTIMO encabezado que ya pasó la línea de los 140px. Se
    // calcula sobre las posiciones, no con un IntersectionObserver de banda:
    // con banda, un tema más largo que la banda dejaba el índice sin nada
    // marcado justo mientras se lo estaba leyendo. Así siempre hay uno y
    // solo uno resaltado, en cualquier posición del scroll.
    //
    // El panel scrollea en <main class="admin-main">, no en la ventana (ver
    // AdminLayout.tsx): el listener va sobre ese contenedor. El throttle es
    // por tiempo y no por requestAnimationFrame a propósito — el rAF no corre
    // cuando la pestaña no está pintando, y el índice quedaba clavado en el
    // último tema marcado al volver a la ventana.
    useEffect(() => {
        const main = contenedorRef.current?.closest('.admin-main') as HTMLElement | null
        if (!main) return
        let timer: ReturnType<typeof setTimeout> | null = null

        const recalcular = () => {
            timer = null
            setArribaVisible(main.scrollTop > 600)
            const nodos = Array.from(document.querySelectorAll<HTMLElement>('[data-man-tema]'))
            if (nodos.length === 0) return
            let actual = nodos[0]
            for (const n of nodos) {
                if (n.getBoundingClientRect().top <= 140) actual = n
                else break
            }
            setActivo(actual.getAttribute('data-man-tema') ?? '')
        }

        const onScroll = () => { if (timer === null) timer = setTimeout(recalcular, 90) }
        main.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', onScroll)
        recalcular()
        return () => {
            main.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', onScroll)
            if (timer !== null) clearTimeout(timer)
        }
    }, [capitulosFiltrados])

    // El índice tiene su propio scroll (59 temas no entran en pantalla): se
    // lo acompaña para que el tema activo nunca quede fuera de vista. Se
    // mueve SOLO el contenedor del índice — nada de scrollIntoView, que
    // arrastraría también el panel y pelearía con la lectura.
    useEffect(() => {
        const cont = indiceRef.current
        const el = cont?.querySelector<HTMLElement>('.man-idx-tema-activo')
        if (!cont || !el) return
        const cr = cont.getBoundingClientRect()
        const er = el.getBoundingClientRect()
        if (er.top < cr.top + 8) cont.scrollTop -= (cr.top + 8 - er.top)
        else if (er.bottom > cr.bottom - 8) cont.scrollTop += (er.bottom - cr.bottom + 8)
    }, [activo])

    function irA(id: string) {
        const el = document.getElementById(id)
        if (!el) return
        const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        el.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' })
        setIndiceAbierto(false)
    }

    function volverArriba() {
        const main = contenedorRef.current?.closest('.admin-main') as HTMLElement | null
        const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        main?.scrollTo({ top: 0, behavior: suave ? 'smooth' : 'auto' })
    }

    return (
        <div ref={contenedorRef} style={pageWrap}>
            <style>{CSS_MANUAL}</style>

            {/* ── Portada ───────────────────────────────────────────────── */}
            <header style={{ marginBottom: 26 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)',
                    }}>
                        <BookOpen size={19} strokeWidth={1.8} color="var(--color-primary)" />
                    </div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>
                        Manual de uso
                    </h1>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--color-muted)', margin: '0 0 18px', maxWidth: '62ch' }}>
                    Todo el panel explicado, pantalla por pantalla: qué es cada número, qué hace cada
                    botón y cómo se usa. {CAPITULOS.length} capítulos, {TOTAL_TEMAS} temas — y desde
                    cada uno saltás directo a la sección que está explicando.
                </p>

                {/* Buscador: la entrada principal de cualquier documentación */}
                <div className="man-buscador" style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    height: 46, padding: '0 14px', borderRadius: 11,
                    border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                    maxWidth: 520, boxShadow: 'var(--shadow-card, 0 1px 2px rgba(0,0,0,0.04))',
                }}>
                    <Search size={17} strokeWidth={2} color="var(--color-muted)" style={{ flexShrink: 0 }} />
                    <input
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        placeholder="Buscar en el manual: cupones, stock, Mercado Pago…"
                        aria-label="Buscar en el manual"
                        style={{
                            flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none',
                            background: 'transparent', color: 'var(--color-text)',
                            fontSize: 14.5, fontFamily: 'inherit',
                        }}
                    />
                    {q !== '' && (
                        <button
                            className="ds-hover"
                            onClick={() => setQ('')}
                            aria-label="Limpiar la búsqueda"
                            style={{
                                flexShrink: 0, width: 26, height: 26, borderRadius: 7, border: 'none',
                                background: 'var(--color-surface-alt)', color: 'var(--color-muted)',
                                cursor: 'pointer', display: 'grid', placeItems: 'center',
                            }}
                        >
                            <X size={13} strokeWidth={2.4} />
                        </button>
                    )}
                </div>
                {buscando && (
                    <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 10 }}>
                        {sinResultados
                            ? 'Nada coincide con esa búsqueda.'
                            : `${plural(capitulosFiltrados.reduce((n, c) => n + c.temas.length, 0), 'tema', 'temas')} en ${plural(capitulosFiltrados.length, 'capítulo', 'capítulos')}.`}
                    </div>
                )}
            </header>

            <div className="man-layout">
                {/* ── Índice ────────────────────────────────────────────── */}
                <nav className="man-indice-col" aria-label="Índice del manual">
                    <button
                        className="man-indice-toggle ds-hover"
                        onClick={() => setIndiceAbierto(o => !o)}
                        aria-expanded={indiceAbierto}
                    >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <BookOpen size={15} strokeWidth={2} />
                            Índice
                        </span>
                        <ChevronRight
                            size={15}
                            style={{ transform: indiceAbierto ? 'rotate(90deg)' : 'none', transition: 'transform 180ms ease' }}
                        />
                    </button>

                    <div ref={indiceRef} className={`man-indice${indiceAbierto ? ' man-indice-abierto' : ''}`}>
                        <div style={{
                            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                            color: 'var(--color-muted)', padding: '0 4px 10px',
                        }}>
                            Índice
                        </div>
                        {capitulosFiltrados.map((cap, i) => {
                            const activoEnCap = cap.temas.some(t => activo === idTema(cap.id, t.id))
                            return (
                                <div key={cap.id} style={{ marginBottom: 4 }}>
                                    <button
                                        className="man-idx-cap ds-hover"
                                        onClick={() => irA(idCapitulo(cap.id))}
                                        style={{ color: activoEnCap ? 'var(--color-text)' : 'var(--color-body)' }}
                                    >
                                        <span className="man-idx-num" style={{ color: cap.accent }}>{String(i + 1).padStart(2, '0')}</span>
                                        <span style={{ flex: 1, minWidth: 0 }}>{cap.titulo}</span>
                                    </button>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {cap.temas.map(t => {
                                            const esActivo = activo === idTema(cap.id, t.id)
                                            return (
                                                <button
                                                    key={t.id}
                                                    className={`man-idx-tema ds-hover${esActivo ? ' man-idx-tema-activo' : ''}`}
                                                    onClick={() => irA(idTema(cap.id, t.id))}
                                                    aria-current={esActivo ? 'true' : undefined}
                                                    style={esActivo ? { borderLeftColor: cap.accent } : undefined}
                                                >
                                                    {t.titulo}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </nav>

                {/* ── Contenido ─────────────────────────────────────────── */}
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 34 }}>
                    {sinResultados ? (
                        <Card padding="lg">
                            <div style={{ textAlign: 'center', padding: '22px 8px' }}>
                                <Search size={26} strokeWidth={1.6} color="var(--color-muted)" />
                                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginTop: 12 }}>
                                    No encontramos nada con “{q.trim()}”
                                </div>
                                <div style={{ fontSize: 13.5, color: 'var(--color-muted)', marginTop: 6, lineHeight: 1.6 }}>
                                    Probá con una palabra más corta, o preguntale a Orbi con Ctrl+K: él busca
                                    sobre los datos de tu negocio, no sobre este texto.
                                </div>
                            </div>
                        </Card>
                    ) : (
                        capitulosFiltrados.map((cap, i) => (
                            <CapituloVista key={cap.id} cap={cap} numero={i + 1} />
                        ))
                    )}
                </div>
            </div>

            {arribaVisible && (
                <button className="man-arriba ds-hover" onClick={volverArriba} aria-label="Volver arriba">
                    <ArrowUp size={17} strokeWidth={2.2} />
                </button>
            )}
        </div>
    )
}

// ─── Capítulo ────────────────────────────────────────────────────────────────

function CapituloVista({ cap, numero }: { cap: Capitulo; numero: number }) {
    return (
        <section id={idCapitulo(cap.id)} style={{ scrollMarginTop: 18 }}>
            {/* Encabezado del capítulo */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 18 }}>
                <div style={{
                    width: 42, height: 42, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center',
                    background: `color-mix(in srgb, ${cap.accent} 13%, transparent)`,
                }}>
                    <cap.Icon size={20} strokeWidth={1.8} color={cap.accent} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
                        color: cap.accent, marginBottom: 3,
                    }}>
                        Capítulo {String(numero).padStart(2, '0')}
                    </div>
                    <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.015em', color: 'var(--color-text)', margin: 0 }}>
                        {cap.titulo}
                    </h2>
                    <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--color-muted)', margin: '5px 0 0', maxWidth: '62ch' }}>
                        {cap.resumen}
                    </p>
                    {cap.ir && <div style={{ marginTop: 13 }}><BotonIr destino={cap.ir} compacto /></div>}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {cap.temas.map(t => <TemaVista key={t.id} capId={cap.id} accent={cap.accent} tema={t} />)}
            </div>
        </section>
    )
}

// ─── Tema ────────────────────────────────────────────────────────────────────

function TemaVista({ capId, accent, tema }: { capId: string; accent: string; tema: Tema }) {
    const id = idTema(capId, tema.id)
    return (
        <Card padding="lg" className="man-tema">
            {/* El ancla del scroll-spy va en el encabezado, no en la Card: es
                lo que se quiere ver arriba al saltar desde el índice. */}
            <h3
                id={id}
                data-man-tema={id}
                style={{
                    scrollMarginTop: 18, margin: '0 0 14px',
                    fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em',
                    color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 9,
                }}
            >
                <span aria-hidden="true" style={{
                    width: 3, height: 17, borderRadius: 2, background: accent, flexShrink: 0,
                }} />
                {tema.titulo}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                {tema.bloques.map((b, i) => <BloqueVista key={i} bloque={b} />)}
            </div>

            {tema.ir && <div style={{ marginTop: 18 }}><BotonIr destino={tema.ir} /></div>}
        </Card>
    )
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const pageWrap: React.CSSProperties = {
    padding: '24px 32px 80px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box',
    position: 'relative',
}

// Lo que no se puede escribir inline: media queries, :hover y :focus-visible.
const CSS_MANUAL = `
.man-layout {
    display: grid;
    grid-template-columns: 252px minmax(0, 1fr);
    gap: 34px;
    /* SIN align-items: start. Con "start" la columna del índice mide solo lo
       que mide el índice (~770px) y el sticky se despega apenas se pasa esa
       altura: a mitad del manual la columna izquierda quedaba vacía. Estirada
       (el default), la columna acompaña todo el alto del contenido y el
       índice queda pegado arriba de punta a punta. */
}
.man-indice-col { min-width: 0; }
.man-indice {
    position: sticky;
    top: 8px;
    max-height: calc(100vh - 130px);
    overflow-y: auto;
    padding-right: 6px;
    scrollbar-width: thin;
}
.man-indice-toggle { display: none; }

.man-idx-cap {
    display: flex; align-items: center; gap: 9px;
    width: 100%; padding: 7px 8px; border: none; border-radius: 8px;
    background: transparent; cursor: pointer;
    font-family: inherit; font-size: 13.5px; font-weight: 600; text-align: left;
    line-height: 1.4;
    transition: background 160ms ease, color 160ms ease;
}
.man-idx-num {
    font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em;
    font-variant-numeric: tabular-nums; flex-shrink: 0; opacity: 0.9;
}
.man-idx-tema {
    display: block; width: 100%; text-align: left;
    padding: 6px 10px 6px 30px; margin-left: 9px;
    border: none; border-left: 2px solid var(--color-border);
    background: transparent; cursor: pointer;
    font-family: inherit; font-size: 12.5px; line-height: 1.45;
    color: var(--color-muted);
    transition: color 160ms ease, border-color 160ms ease, background 160ms ease;
}
.man-idx-tema:hover { color: var(--color-body); }
.man-idx-tema-activo {
    color: var(--color-text);
    font-weight: 600;
    border-left-width: 2px;
}
.man-idx-cap:focus-visible,
.man-idx-tema:focus-visible,
.man-ir:focus-visible,
.man-arriba:focus-visible,
.man-indice-toggle:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
}

.man-ir:hover { background: var(--color-primary-bg) !important; border-color: var(--color-primary) !important; }

.man-arriba {
    position: fixed; right: 26px; bottom: 26px; z-index: 30;
    width: 42px; height: 42px; border-radius: 50%;
    display: grid; place-items: center;
    border: 1px solid var(--color-border);
    background: var(--color-bg); color: var(--color-body);
    cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,0.14);
    transition: background 160ms ease, color 160ms ease;
}
.man-arriba:hover { background: var(--color-primary-bg); color: var(--color-primary); }

/* ── Tablet / celular ────────────────────────────────────────────────── */
@media (max-width: 1024px) {
    .man-layout { grid-template-columns: minmax(0, 1fr); gap: 18px; }
    .man-indice-col {
        position: sticky; top: 0; z-index: 20;
        background: var(--color-bg);
        padding: 8px 0;
        margin: 0 -4px;
    }
    .man-indice-toggle {
        display: flex; align-items: center; justify-content: space-between;
        width: 100%; min-height: 44px; padding: 0 14px;
        border: 1px solid var(--color-border); border-radius: 10px;
        background: var(--color-surface); color: var(--color-text);
        font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .man-indice {
        display: none;
        position: static; max-height: 52vh;
        margin-top: 8px; padding: 10px;
        border: 1px solid var(--color-border); border-radius: 10px;
        background: var(--color-surface);
    }
    .man-indice-abierto { display: block; }
    /* En celular el dedo necesita más blanco: las filas del índice crecen. */
    .man-idx-cap { padding: 10px 8px; }
    .man-idx-tema { padding: 9px 10px 9px 30px; }
}
@media (max-width: 768px) {
    .man-campos > div { grid-template-columns: minmax(0, 1fr) !important; gap: 3px !important; }
    .man-arriba { right: 16px; bottom: 16px; }
}
@media (prefers-reduced-motion: reduce) {
    .man-idx-cap, .man-idx-tema, .man-ir, .man-arriba, .man-indice-toggle svg { transition: none !important; }
}
`
