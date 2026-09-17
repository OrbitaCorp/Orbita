// src/modules/ventas/panel/manual/Manual.tsx — Módulo "Manual"
//
// El manual de uso completo del panel, en pantalla: un índice fijo a la
// izquierda y el contenido a la derecha, con buscador arriba y un "Ir a…"
// en cada tema que te deja parado en la pantalla que se está explicando.
//
// Es el complemento del tutorial de Primeros pasos (tutoriales/), no su
// reemplazo: el tutorial te lleva de la mano por las seis o siete cosas que
// hay que hacer sí o sí; el manual explica TODO, incluido lo que se usa una
// vez cada tanto y justo ahí uno no se acuerda de dónde estaba.
//
// Se lee como un documento y no como un tablero: una sola columna de texto
// con medida fija, separadores de un pixel en vez de tarjetas, y el azul de
// marca reservado para lo que se clickea. El criterio completo está en
// piezas.tsx.
//
// Todo el texto vive en contenido.ts — este archivo no tiene copy propio más
// que los rótulos de la cáscara (título, buscador, vacío de búsqueda).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, ChevronRight, ArrowUp } from 'lucide-react'
import { CAPITULOS, TOTAL_TEMAS, textoPlano, type Capitulo, type Tema } from './contenido'
import { Ilustracion } from './ilustraciones'
import { BloqueVista, EnlaceIr } from './piezas'

const idTema = (capId: string, temaId: string) => `man-${capId}-${temaId}`
const idCapitulo = (capId: string) => `man-cap-${capId}`

/** Saca tildes y pasa a minúsculas: buscar "publicacion" tiene que encontrar
 *  "publicación". */
const normalizar = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** "1 tema" / "5 temas" — el contador de resultados se lee, no se completa
 *  con paréntesis. */
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
        <div ref={contenedorRef} className="man-page">
            <style>{CSS_MANUAL}</style>

            {/* ── Portada ───────────────────────────────────────────────── */}
            <header className="man-portada">
                <h1>Manual de uso</h1>
                <p>
                    Todo el panel explicado, pantalla por pantalla: qué es cada número, qué hace cada
                    botón y cómo se usa. {CAPITULOS.length} capítulos, {TOTAL_TEMAS} temas — y desde
                    cada uno saltás directo a la sección que está explicando.
                </p>

                <div className="man-buscador">
                    <Search size={16} strokeWidth={2} aria-hidden="true" />
                    <input
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        placeholder="Buscar en el manual"
                        aria-label="Buscar en el manual"
                    />
                    {q !== '' && (
                        <button type="button" onClick={() => setQ('')} aria-label="Limpiar la búsqueda">
                            <X size={14} strokeWidth={2.2} />
                        </button>
                    )}
                </div>
                {buscando && (
                    <p className="man-resultados">
                        {sinResultados
                            ? 'Nada coincide con esa búsqueda.'
                            : `${plural(capitulosFiltrados.reduce((n, c) => n + c.temas.length, 0), 'tema', 'temas')} en ${plural(capitulosFiltrados.length, 'capítulo', 'capítulos')}.`}
                    </p>
                )}
            </header>

            <div className="man-layout">
                {/* ── Índice ────────────────────────────────────────────── */}
                <nav className="man-indice-col" aria-label="Índice del manual">
                    <button
                        type="button"
                        className="man-indice-toggle"
                        onClick={() => setIndiceAbierto(o => !o)}
                        aria-expanded={indiceAbierto}
                    >
                        Índice
                        <ChevronRight size={15} aria-hidden="true" style={{ transform: indiceAbierto ? 'rotate(90deg)' : 'none' }} />
                    </button>

                    <div ref={indiceRef} className={`man-indice${indiceAbierto ? ' man-indice-abierto' : ''}`}>
                        {capitulosFiltrados.map((cap, i) => (
                            <div key={cap.id} className="man-idx-grupo">
                                <button type="button" className="man-idx-cap" onClick={() => irA(idCapitulo(cap.id))}>
                                    <span className="man-idx-num">{String(i + 1).padStart(2, '0')}</span>
                                    <span>{cap.titulo}</span>
                                </button>
                                {cap.temas.map(t => {
                                    const esActivo = activo === idTema(cap.id, t.id)
                                    return (
                                        <button
                                            key={t.id}
                                            type="button"
                                            className={`man-idx-tema${esActivo ? ' man-idx-tema-activo' : ''}`}
                                            onClick={() => irA(idTema(cap.id, t.id))}
                                            aria-current={esActivo ? 'true' : undefined}
                                        >
                                            {t.titulo}
                                        </button>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                </nav>

                {/* ── Contenido ─────────────────────────────────────────── */}
                <div className="man-contenido">
                    {sinResultados ? (
                        <p className="man-vacio">
                            No encontramos nada con “{q.trim()}”. Probá con una palabra más corta, o
                            preguntale a Orbi con Ctrl+K: él busca sobre los datos de tu negocio, no
                            sobre este texto.
                        </p>
                    ) : (
                        capitulosFiltrados.map((cap, i) => (
                            <CapituloVista key={cap.id} cap={cap} numero={i + 1} />
                        ))
                    )}
                </div>
            </div>

            {arribaVisible && (
                <button type="button" className="man-arriba" onClick={volverArriba} aria-label="Volver arriba">
                    <ArrowUp size={16} strokeWidth={2} />
                </button>
            )}
        </div>
    )
}

// ─── Capítulo ────────────────────────────────────────────────────────────────

function CapituloVista({ cap, numero }: { cap: Capitulo; numero: number }) {
    return (
        <section id={idCapitulo(cap.id)} className="man-cap">
            {/* El encabezado del capítulo cuenta para el scroll-spy como su
                PRIMER tema: sin esto, mientras se lee la portada de un
                capítulo el índice seguía marcando el último tema del
                capítulo anterior, que es donde uno ya no está. Comparte el
                id con ese primer tema, así el resaltado no parpadea al
                pasar de uno al otro. */}
            <header className="man-cap-head" data-man-tema={idTema(cap.id, cap.temas[0].id)}>
                <div className="man-cap-eyebrow">
                    <cap.Icon size={14} strokeWidth={1.9} aria-hidden="true" />
                    Capítulo {String(numero).padStart(2, '0')}
                </div>
                <h2>{cap.titulo}</h2>
                <p>{cap.resumen}</p>
                {cap.ir && <div className="man-cap-ir"><EnlaceIr destino={cap.ir} /></div>}
            </header>

            {cap.ilustracion && <Ilustracion id={cap.ilustracion} />}

            {cap.temas.map(t => <TemaVista key={t.id} capId={cap.id} tema={t} />)}
        </section>
    )
}

// ─── Tema ────────────────────────────────────────────────────────────────────

function TemaVista({ capId, tema }: { capId: string; tema: Tema }) {
    const id = idTema(capId, tema.id)
    return (
        <article className="man-tema">
            <h3 id={id} data-man-tema={id}>{tema.titulo}</h3>

            {tema.ilustracion && <Ilustracion id={tema.ilustracion} />}

            <div className="man-tema-cuerpo">
                {tema.bloques.map((b, i) => <BloqueVista key={i} bloque={b} />)}
            </div>

            {tema.ir && <div className="man-tema-ir"><EnlaceIr destino={tema.ir} /></div>}
        </article>
    )
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const CSS_MANUAL = `
.man-page {
    padding: 28px 32px 96px;
    max-width: 1180px; width: 100%; margin: 0 auto;
    box-sizing: border-box; position: relative;
}

/* ── Portada ─────────────────────────────────────────────────────────── */
.man-portada { max-width: 62ch; margin-bottom: 34px; }
.man-portada h1 {
    margin: 0 0 8px;
    font-size: 27px; font-weight: 650; letter-spacing: -0.025em;
    color: var(--color-text);
}
.man-portada p {
    margin: 0 0 20px;
    font-size: 14.5px; line-height: 1.7; color: var(--color-muted);
}
.man-buscador {
    display: flex; align-items: center; gap: 10px;
    height: 40px; padding: 0 12px;
    max-width: 380px;
    border: 1px solid var(--color-border); border-radius: 8px;
    background: var(--color-bg);
    transition: border-color 180ms ease;
}
.man-buscador:focus-within { border-color: var(--color-primary); }
.man-buscador > svg { flex-shrink: 0; color: var(--color-muted); }
.man-buscador input {
    flex: 1; min-width: 0; height: 100%;
    border: none; outline: none; background: transparent;
    color: var(--color-text); font-size: 14px; font-family: inherit;
}
.man-buscador button {
    flex-shrink: 0; display: grid; place-items: center;
    width: 24px; height: 24px; border: none; border-radius: 6px;
    background: transparent; color: var(--color-muted); cursor: pointer;
}
.man-buscador button:hover { background: var(--color-surface-alt); color: var(--color-text); }
.man-resultados { margin: 10px 0 0; font-size: 13px; color: var(--color-muted); }

/* ── Layout ──────────────────────────────────────────────────────────── */
/* SIN align-items: start. Con "start" la columna del índice mide solo lo
   que mide el índice y el sticky se despega apenas se pasa esa altura: a
   mitad del manual la columna izquierda quedaba vacía. Estirada (el
   default), el índice queda pegado arriba de punta a punta. */
.man-layout {
    display: grid;
    grid-template-columns: 236px minmax(0, 1fr);
    gap: 48px;
}
.man-indice-col { min-width: 0; }
.man-contenido { min-width: 0; }

/* ── Índice ──────────────────────────────────────────────────────────── */
.man-indice {
    position: sticky; top: 4px;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
    /* overflow-x explícito: con solo overflow-y, el eje x computa a "auto"
       (regla de CSS) y aparecía una barra horizontal al pie del índice. */
    overflow-x: hidden;
    padding-right: 4px;
    scrollbar-width: thin;
}
.man-indice-toggle { display: none; }
.man-idx-grupo { margin-bottom: 18px; }
.man-idx-cap {
    display: flex; align-items: baseline; gap: 9px;
    width: 100%; padding: 0 0 7px; border: none;
    background: transparent; cursor: pointer; text-align: left;
    font-family: inherit; font-size: 13px; font-weight: 600; line-height: 1.4;
    color: var(--color-text);
}
.man-idx-num {
    flex-shrink: 0;
    font-size: 11px; font-weight: 500; font-variant-numeric: tabular-nums;
    color: var(--color-muted); opacity: 0.7;
}
.man-idx-tema {
    display: block; width: 100%; text-align: left;
    padding: 5px 0 5px 12px; margin-left: 4px;
    border: none; border-left: 1px solid var(--color-border);
    background: transparent; cursor: pointer;
    font-family: inherit; font-size: 12.5px; line-height: 1.45;
    color: var(--color-muted);
    transition: color 160ms ease, border-color 160ms ease;
}
.man-idx-tema:hover { color: var(--color-text); }
.man-idx-tema-activo {
    color: var(--color-text); font-weight: 500;
    border-left-color: var(--color-primary);
    box-shadow: inset 1px 0 0 var(--color-primary);
}
.man-idx-cap:focus-visible,
.man-idx-tema:focus-visible,
.man-ir:focus-visible,
.man-arriba:focus-visible,
.man-indice-toggle:focus-visible,
.man-buscador button:focus-visible {
    outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 3px;
}

/* ── Capítulo ────────────────────────────────────────────────────────── */
.man-cap { padding-top: 6px; }
.man-cap + .man-cap { margin-top: 64px; }
.man-cap-head { max-width: 66ch; }
.man-cap-eyebrow {
    display: flex; align-items: center; gap: 7px;
    font-size: 12px; font-weight: 500; color: var(--color-muted);
    margin-bottom: 7px;
}
.man-cap-head h2 {
    margin: 0;
    font-size: 21px; font-weight: 650; letter-spacing: -0.02em;
    color: var(--color-text);
}
.man-cap-head p {
    margin: 6px 0 0;
    font-size: 14px; line-height: 1.65; color: var(--color-muted);
}
.man-cap-ir { margin-top: 12px; }

/* ── Tema ────────────────────────────────────────────────────────────── */
/* Separadores de un pixel en vez de tarjetas: el capítulo se lee como un
   texto corrido y no como una pila de cajas. */
.man-tema {
    max-width: 68ch;
    padding-top: 26px; margin-top: 26px;
    border-top: 1px solid var(--color-border);
}
.man-tema h3 {
    margin: 0 0 14px; scroll-margin-top: 16px;
    font-size: 16px; font-weight: 600; letter-spacing: -0.01em;
    color: var(--color-text);
}
.man-tema-cuerpo { display: flex; flex-direction: column; gap: 16px; }
.man-tema-ir { margin-top: 18px; }

/* ── Enlace "Ir a…" ──────────────────────────────────────────────────── */
.man-ir {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 0; border: none; background: none;
    color: var(--color-primary); cursor: pointer;
    font-family: inherit; font-size: 13.5px; font-weight: 500;
}
.man-ir:hover { text-decoration: underline; text-underline-offset: 3px; }
.man-ir > svg { transition: transform 160ms ease; }
.man-ir:hover > svg { transform: translateX(2px); }

/* ── Definiciones (campos y estados) ─────────────────────────────────── */
.man-campos > div {
    display: grid; grid-template-columns: minmax(130px, 190px) 1fr;
    gap: 18px; padding: 10px 0;
    border-top: 1px solid var(--color-border);
}
.man-campos > div:first-child { border-top: none; padding-top: 2px; }
.man-campos dt {
    font-size: 13.5px; font-weight: 600; line-height: 1.6;
    color: var(--color-text);
}
.man-campos dd { margin: 0; }

/* ── Ilustraciones ───────────────────────────────────────────────────── */
.man-fig {
    margin: 0 0 20px; max-width: 460px;
    border: 1px solid var(--color-border); border-radius: 8px;
    background: var(--color-surface);
    padding: 12px; box-sizing: border-box;
}
.man-cap-head + .man-fig { margin-top: 22px; }
.man-fig svg { display: block; width: 100%; height: auto; }

.man-vacio {
    max-width: 58ch; margin: 0;
    font-size: 14px; line-height: 1.7; color: var(--color-muted);
}

/* ── Volver arriba ───────────────────────────────────────────────────── */
.man-arriba {
    position: fixed; right: 26px; bottom: 26px; z-index: 30;
    width: 38px; height: 38px; border-radius: 8px;
    display: grid; place-items: center;
    border: 1px solid var(--color-border);
    background: var(--color-bg); color: var(--color-muted);
    cursor: pointer;
    transition: color 160ms ease, border-color 160ms ease;
}
.man-arriba:hover { color: var(--color-text); border-color: var(--color-muted); }

/* ── Tablet y celular ────────────────────────────────────────────────── */
@media (max-width: 1024px) {
    .man-page { padding: 22px 16px 80px; }
    .man-layout { grid-template-columns: minmax(0, 1fr); gap: 20px; }
    .man-indice-col {
        position: sticky; top: 0; z-index: 20;
        background: var(--color-bg); padding: 8px 0;
    }
    .man-indice-toggle {
        display: flex; align-items: center; justify-content: space-between;
        width: 100%; min-height: 44px; padding: 0 14px;
        border: 1px solid var(--color-border); border-radius: 8px;
        background: var(--color-bg); color: var(--color-text);
        font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .man-indice-toggle > svg { transition: transform 180ms ease; color: var(--color-muted); }
    .man-indice {
        display: none; position: static;
        max-height: 52vh; margin-top: 8px; padding: 14px;
        border: 1px solid var(--color-border); border-radius: 8px;
    }
    .man-indice-abierto { display: block; }
    /* En celular el dedo necesita más blanco que el mouse. */
    .man-idx-cap { padding: 6px 0 8px; }
    .man-idx-tema { padding: 9px 0 9px 12px; }
    .man-cap + .man-cap { margin-top: 48px; }
}
@media (max-width: 680px) {
    .man-campos > div { grid-template-columns: minmax(0, 1fr); gap: 2px; }
    .man-arriba { right: 14px; bottom: 14px; }
}
@media (prefers-reduced-motion: reduce) {
    .man-idx-tema, .man-ir, .man-ir > svg, .man-arriba,
    .man-indice-toggle > svg, .man-buscador { transition: none !important; }
}
`
