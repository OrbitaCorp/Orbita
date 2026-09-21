// src/modules/ventas/panel/manual/Manual.tsx — Módulo "Manual"
//
// El manual de uso completo del panel, en pantalla: el índice de capítulos
// a la izquierda, el texto en el medio y, en pantallas anchas, un riel a la
// derecha con los temas del capítulo que se está leyendo. Buscador arriba,
// y un "Ir a…" en cada tema que te deja parado en la pantalla que se está
// explicando.
//
// Es el complemento del tutorial de Primeros pasos (tutoriales/), no su
// reemplazo: el tutorial te lleva de la mano por las seis o siete cosas que
// hay que hacer sí o sí; el manual explica TODO, incluido lo que se usa una
// vez cada tanto y justo ahí uno no se acuerda de dónde estaba.
//
// Se lee como un documento y no como un tablero: una sola columna de texto
// con medida fija (72ch, --man-medida), separadores de un pixel en vez de
// tarjetas, y el azul de marca reservado para lo que se clickea. El criterio
// completo está en piezas.tsx.
//
// Para no perderse adentro de un capítulo largo hay tres cosas, todas
// calculadas por el mismo scroll-spy: la barra fina que se pega arriba con
// el nombre del capítulo cuando su título ya se fue, el riel/índice que
// marca el tema actual, y el pie de cada capítulo con anterior / siguiente.
// Las piezas viven en navegacion.tsx.
//
// Todo el texto vive en contenido.ts — este archivo no tiene copy propio más
// que los rótulos de la cáscara (título, buscador, vacío de búsqueda).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Search, X, ChevronRight, ArrowUp } from 'lucide-react'
import { panelGetManualFeedback } from '@/lib/api'
import { currentSlug } from '@/lib/tenant'
import { CAPITULOS, TOTAL_TEMAS, textoPlano, type Capitulo, type Tema } from './contenido'
import { Ilustracion } from './ilustraciones'
import { BloqueVista, EnlaceIr } from './piezas'
import {
    BarraCapitulo, IndiceCapitulos, PieCapitulo, RielCapitulo,
    idCapitulo, idTema, numeroCap, useAnchoMinimo,
} from './navegacion'

/** Saca tildes y pasa a minúsculas: buscar "publicacion" tiene que encontrar
 *  "publicación". */
const normalizar = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** "1 tema" / "5 temas" — el contador de resultados se lee, no se completa
 *  con paréntesis. */
const plural = (n: number, uno: string, varios: string) =>
    `${n} ${n === 1 ? uno : varios}`

/** Línea de lectura del scroll-spy, en px desde el borde de arriba de la
 *  ventana: un encabezado que ya pasó esta línea es "lo que se está leyendo". */
const LINEA_LECTURA = 140

/** Capítulos leídos: por negocio, así el mismo miembro con dos tiendas no ve
 *  tildado en una lo que leyó en la otra. localStorage puede no estar
 *  (modo privado, permisos): todo va con try/catch y sin él el manual anda
 *  igual, solo sin checks. */
const claveLeidos = (negocioId: string | undefined) =>
    `orbita:manual:leidos:${currentSlug() ?? negocioId ?? 'default'}`

export default function Manual() {
    const router = useRouter()
    const negocioId = typeof router.query.negocioId === 'string' ? router.query.negocioId : undefined
    const temaQuery = typeof router.query.tema === 'string' ? router.query.tema : undefined

    const [q, setQ] = useState('')
    const [activo, setActivo] = useState<string>('')
    const [capActivo, setCapActivo] = useState<string>('')
    const [barraVisible, setBarraVisible] = useState(false)
    const [indiceAbierto, setIndiceAbierto] = useState(false)
    const [arribaVisible, setArribaVisible] = useState(false)
    // null = todavía no se leyó localStorage: no hay que pisarlo con [].
    const [leidos, setLeidos] = useState<string[] | null>(null)
    const [votos, setVotos] = useState<Record<string, boolean>>({})
    const contenedorRef = useRef<HTMLDivElement>(null)
    const ancho = useAnchoMinimo(1280)

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

    const indiceCapActivo = capitulosFiltrados.findIndex(c => c.id === capActivo)
    const capActual = indiceCapActivo >= 0 ? capitulosFiltrados[indiceCapActivo] : undefined

    // ── Scroll-spy + barra pegada + leídos + "volver arriba" ────────────────
    //
    // Activo = el ÚLTIMO encabezado que ya pasó la línea de lectura. Se
    // calcula sobre las posiciones, no con un IntersectionObserver de banda:
    // con banda, un tema más largo que la banda dejaba el índice sin nada
    // marcado justo mientras se lo estaba leyendo. Así siempre hay uno y
    // solo uno resaltado, en cualquier posición del scroll.
    //
    // Del mismo recorrido salen las otras tres cosas: el capítulo activo
    // (data-man-cap del encabezado activo), si la barra pegada se muestra
    // (el encabezado real del capítulo activo ya salió por arriba del
    // contenedor) y qué capítulos se dieron por leídos (su último tema pasó
    // la línea de lectura). Leídos no se marcan mientras se busca: con el
    // filtro puesto el "último tema" visible no es el último de verdad.
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
            const terminados: string[] = []
            for (const n of nodos) {
                if (n.getBoundingClientRect().top > LINEA_LECTURA) break
                actual = n
                if (n.dataset.manUltimo === '1' && n.dataset.manCap) terminados.push(n.dataset.manCap)
            }
            const capId = actual.dataset.manCap ?? ''
            setActivo(actual.dataset.manTema ?? '')
            setCapActivo(capId)

            const h2 = document.getElementById(idCapitulo(capId))?.querySelector<HTMLElement>('.man-cap-head h2')
            const topMain = main.getBoundingClientRect().top
            setBarraVisible(!!h2 && h2.getBoundingClientRect().bottom <= topMain)

            if (!buscando && terminados.length > 0) {
                setLeidos(prev => {
                    const base = prev ?? []
                    const nuevos = terminados.filter(id => !base.includes(id))
                    return nuevos.length > 0 ? [...base, ...nuevos] : prev
                })
            }
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
    }, [capitulosFiltrados, buscando])

    // ── Leídos: leer y guardar en localStorage ──────────────────────────────
    useEffect(() => {
        let guardados: string[] = []
        try {
            const crudo = window.localStorage.getItem(claveLeidos(negocioId))
            const parseado: unknown = crudo ? JSON.parse(crudo) : []
            if (Array.isArray(parseado)) guardados = parseado.filter((x): x is string => typeof x === 'string')
        } catch { /* sin localStorage no hay checks, nada más */ }
        setLeidos(prev => (prev === null ? guardados : Array.from(new Set([...guardados, ...prev]))))
    }, [negocioId])

    useEffect(() => {
        if (leidos === null) return
        try { window.localStorage.setItem(claveLeidos(negocioId), JSON.stringify(leidos)) } catch { /* idem */ }
    }, [leidos, negocioId])

    // ── Votos "¿Te sirvió?": una sola lectura al montar ─────────────────────
    // Si el endpoint no está o falla, silencio: los botones arrancan sin
    // marcar y el voto se intenta igual al tocar.
    useEffect(() => {
        let vigente = true
        panelGetManualFeedback()
            .then(r => {
                if (!vigente) return
                const mapa: Record<string, boolean> = {}
                for (const v of r.data) mapa[v.chapterId] = v.helpful
                setVotos(mapa)
            })
            .catch(() => { /* sin estado inicial, nada más */ })
        return () => { vigente = false }
    }, [])

    // ── Anclas: #man-<cap>-<tema> (o ?tema=<cap>-<tema>) ────────────────────
    // Soporte y otras pantallas llegan con el hash del tema. El contenido se
    // monta dinámico, así que se espera un frame y un poco más antes de
    // buscar el id; scroll-margin-top del encabezado deja lugar a la barra
    // pegada. Next no dispara hashchange cuando cambia solo el hash por
    // router.push (usa pushState), por eso también se escucha su evento.
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null
        let frame: number | null = null

        const irAlAncla = () => {
            const hash = window.location.hash
            let id = hash.startsWith('#man-') ? hash.slice(1) : ''
            if (!id && temaQuery) id = temaQuery.startsWith('man-') ? temaQuery : `man-${temaQuery}`
            if (!id) return
            if (frame !== null) cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => {
                timer = setTimeout(() => {
                    document.getElementById(id)?.scrollIntoView({ behavior: 'auto', block: 'start' })
                }, 50)
            })
        }

        irAlAncla()
        window.addEventListener('hashchange', irAlAncla)
        router.events.on('hashChangeComplete', irAlAncla)
        return () => {
            window.removeEventListener('hashchange', irAlAncla)
            router.events.off('hashChangeComplete', irAlAncla)
            if (frame !== null) cancelAnimationFrame(frame)
            if (timer !== null) clearTimeout(timer)
        }
    }, [temaQuery, router.events])

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

    function onVotado(capId: string, helpful: boolean) {
        setVotos(prev => ({ ...prev, [capId]: helpful }))
    }

    return (
        <div ref={contenedorRef} className="man-page">
            <style>{CSS_MANUAL}</style>

            {/* ── Portada ───────────────────────────────────────────────── */}
            {/* Misma grilla que el cuerpo, pero ocupando las TRES columnas:
                el título arranca donde arranca el índice y el buscador
                termina donde termina el riel. Metida en la columna del
                medio quedaban 220px de aire muerto a cada lado (Ale, 21/09). */}
            <header className="man-portada">
                <div className="man-portada-in">
                    <div className="man-portada-texto">
                        <h1>Manual de uso</h1>
                        <p>
                            Todo el panel explicado, pantalla por pantalla: qué es cada número, qué hace cada
                            botón y cómo se usa. {CAPITULOS.length} capítulos, {TOTAL_TEMAS} temas — y desde
                            cada uno saltás directo a la sección que está explicando.
                        </p>
                    </div>

                    <div className="man-portada-busca">
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
                    </div>
                </div>
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

                    <div className={`man-indice${indiceAbierto ? ' man-indice-abierto' : ''}`}>
                        <IndiceCapitulos
                            capitulos={capitulosFiltrados}
                            capActivo={capActivo}
                            temaActivo={activo}
                            leidos={leidos ?? []}
                            conTemas={!ancho}
                            onIr={irA}
                        />
                    </div>
                </nav>

                {/* ── Contenido ─────────────────────────────────────────── */}
                <div className="man-contenido">
                    <BarraCapitulo
                        visible={barraVisible && !sinResultados}
                        numero={indiceCapActivo + 1}
                        cap={capActual}
                        anterior={indiceCapActivo > 0 ? capitulosFiltrados[indiceCapActivo - 1] : undefined}
                        siguiente={indiceCapActivo >= 0 ? capitulosFiltrados[indiceCapActivo + 1] : undefined}
                        onIr={irA}
                    />
                    {sinResultados ? (
                        <p className="man-vacio">
                            No encontramos nada con “{q.trim()}”. Probá con una palabra más corta, o
                            preguntale a Orbi con Ctrl+K: él busca sobre los datos de tu negocio, no
                            sobre este texto.
                        </p>
                    ) : (
                        capitulosFiltrados.map((cap, i) => (
                            <CapituloVista
                                key={cap.id}
                                cap={cap}
                                numero={i + 1}
                                anterior={capitulosFiltrados[i - 1]}
                                siguiente={capitulosFiltrados[i + 1]}
                                voto={votos[cap.id]}
                                onIr={irA}
                                onVotado={onVotado}
                            />
                        ))
                    )}
                </div>

                {/* ── Riel derecho (solo ≥1280) ─────────────────────────── */}
                {ancho && (
                    <aside className="man-riel-col" aria-label="Temas del capítulo actual">
                        <div className="man-riel">
                            <RielCapitulo cap={capActual} temaActivo={activo} onIr={irA} />
                        </div>
                    </aside>
                )}
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

function CapituloVista({ cap, numero, anterior, siguiente, voto, onIr, onVotado }: {
    cap: Capitulo
    numero: number
    anterior: Capitulo | undefined
    siguiente: Capitulo | undefined
    voto: boolean | undefined
    onIr: (id: string) => void
    onVotado: (capId: string, helpful: boolean) => void
}) {
    // "Leído" se decide con el último tema del capítulo COMPLETO, no del que
    // dejó pasar el filtro de búsqueda (cap.temas puede venir recortado).
    const completo = CAPITULOS.find(c => c.id === cap.id) ?? cap
    const ultimoTemaId = completo.temas[completo.temas.length - 1]?.id

    return (
        <section id={idCapitulo(cap.id)} className="man-cap">
            {/* El encabezado del capítulo cuenta para el scroll-spy como su
                PRIMER tema: sin esto, mientras se lee la portada de un
                capítulo el índice seguía marcando el último tema del
                capítulo anterior, que es donde uno ya no está. Comparte el
                id con ese primer tema, así el resaltado no parpadea al
                pasar de uno al otro. */}
            <header
                className="man-cap-head"
                data-man-tema={idTema(cap.id, cap.temas[0].id)}
                data-man-cap={cap.id}
                data-man-ultimo={cap.temas[0].id === ultimoTemaId ? '1' : undefined}
            >
                <div className="man-cap-eyebrow">
                    <cap.Icon size={14} strokeWidth={1.9} aria-hidden="true" />
                    Capítulo {numeroCap(numero)}
                </div>
                <h2>{cap.titulo}</h2>
                <p>{cap.resumen}</p>
                {cap.ir && <div className="man-cap-ir"><EnlaceIr destino={cap.ir} /></div>}
            </header>

            {cap.ilustracion && <Ilustracion id={cap.ilustracion} />}

            {cap.temas.map(t => (
                <TemaVista key={t.id} capId={cap.id} tema={t} esUltimo={t.id === ultimoTemaId} />
            ))}

            <PieCapitulo
                cap={cap}
                anterior={anterior}
                siguiente={siguiente}
                voto={voto}
                onIr={onIr}
                onVotado={onVotado}
            />
        </section>
    )
}

// ─── Tema ────────────────────────────────────────────────────────────────────

function TemaVista({ capId, tema, esUltimo }: { capId: string; tema: Tema; esUltimo: boolean }) {
    const id = idTema(capId, tema.id)
    return (
        <article className="man-tema">
            <h3 id={id} data-man-tema={id} data-man-cap={capId} data-man-ultimo={esUltimo ? '1' : undefined}>
                {tema.titulo}
            </h3>

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
/* Tres medidas gobiernan todo el módulo: la columna de texto (--man-medida),
   las columnas de la grilla (--man-cols) y el aire entre ellas. Portada y
   cuerpo usan la MISMA grilla, centrada, así en 1920px no queda un hueco
   muerto a la derecha y el título arranca donde arranca el texto. */
.man-page {
    --man-medida: 72ch;
    --man-cols: 220px minmax(0, var(--man-medida)) 220px;
    --man-gap: 40px;
    --man-barra: 44px;
    padding: 28px 32px 96px;
    max-width: 1280px; width: 100%; margin: 0 auto;
    box-sizing: border-box; position: relative;
}
.man-portada, .man-layout {
    display: grid;
    grid-template-columns: var(--man-cols);
    column-gap: var(--man-gap);
    justify-content: center;
}
.man-sr {
    position: absolute; width: 1px; height: 1px; overflow: hidden;
    clip: rect(0 0 0 0); white-space: nowrap;
}

/* ── Portada ─────────────────────────────────────────────────────────── */
/* Ocupa el ancho entero de la grilla (índice + texto + riel): título y
   bajada a la izquierda, buscador a la derecha, apoyados en la misma línea
   base. El borde inferior ata la portada al ancho del cuerpo, así se lee
   como una sola pieza y no como un bloque flotando en el medio. */
.man-portada {
    margin-bottom: 30px; padding-bottom: 24px;
    border-bottom: 1px solid var(--color-border);
}
.man-portada-in {
    grid-column: 1 / -1; min-width: 0;
    display: flex; flex-wrap: wrap; align-items: flex-end;
    justify-content: space-between; gap: 20px 48px;
}
.man-portada-texto { flex: 1 1 440px; min-width: 0; }
.man-portada h1 {
    margin: 0 0 8px;
    font-size: 27px; font-weight: 650; letter-spacing: -0.025em;
    color: var(--color-text);
}
.man-portada p {
    margin: 0; max-width: 64ch;
    font-size: 14.5px; line-height: 1.7; color: var(--color-muted);
}
.man-portada-busca { flex: 0 1 380px; min-width: 260px; }
.man-buscador {
    display: flex; align-items: center; gap: 10px;
    height: 40px; padding: 0 12px;
    width: 100%; box-sizing: border-box;
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
/* SIN align-items: start. Con "start" las columnas laterales miden solo lo
   que mide su contenido y el sticky se despega apenas se pasa esa altura: a
   mitad del manual quedaban vacías. Estiradas (el default), índice y riel
   acompañan de punta a punta. */
.man-indice-col { grid-column: 1; min-width: 0; }
.man-contenido  { grid-column: 2; min-width: 0; }
.man-riel-col   { grid-column: 3; min-width: 0; }

/* ── Índice y riel ───────────────────────────────────────────────────── */
/* Sin max-height ni overflow: solo capítulos (13 renglones) o los temas de
   uno, entran en cualquier pantalla. Así no hay un segundo scroll adentro
   del scroll de la página. */
.man-indice, .man-riel { position: sticky; top: 12px; }
.man-indice-toggle { display: none; }
.man-idx-contador {
    margin: 0 0 14px; padding-bottom: 12px;
    border-bottom: 1px solid var(--color-border);
    font-size: 12px; font-weight: 500; color: var(--color-muted);
    font-variant-numeric: tabular-nums;
}
.man-idx-grupo { margin-bottom: 2px; }
.man-idx-cap {
    display: flex; align-items: baseline; gap: 9px;
    width: 100%; min-height: 32px; padding: 6px 8px; margin: 0;
    box-sizing: border-box;
    border: none; border-radius: 6px;
    background: transparent; cursor: pointer; text-align: left;
    font-family: inherit; font-size: 13px; font-weight: 500; line-height: 1.4;
    color: var(--color-muted);
    transition: color 160ms ease, background-color 160ms ease;
}
.man-idx-cap:hover { color: var(--color-text); }
.man-idx-cap-activo {
    color: var(--color-text); font-weight: 600;
    background: var(--color-surface-alt);
}
.man-idx-num {
    flex-shrink: 0;
    font-size: 11px; font-weight: 500; font-variant-numeric: tabular-nums;
    color: var(--color-muted); opacity: 0.7;
}
.man-idx-titulo { flex: 1; min-width: 0; }
.man-idx-check {
    flex-shrink: 0; display: inline-flex; align-self: center;
    color: var(--color-success);
}
.man-idx-temas { padding: 4px 0 10px 22px; }
.man-riel-titulo {
    margin: 0 0 10px;
    font-size: 11.5px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
    color: var(--color-muted);
}
.man-idx-tema {
    display: block; width: 100%; text-align: left;
    padding: 5px 0 5px 12px;
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
.man-riel-ir { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--color-border); }

.man-idx-cap:focus-visible,
.man-idx-tema:focus-visible,
.man-ir:focus-visible,
.man-arriba:focus-visible,
.man-indice-toggle:focus-visible,
.man-barra-btn:focus-visible,
.man-pie-tarjeta:focus-visible,
.man-opinion-btn:focus-visible,
.man-opinion-enviar:focus-visible,
.man-opinion-textarea:focus-visible,
.man-buscador button:focus-visible {
    outline: 2px solid var(--color-primary); outline-offset: 2px;
}
.man-idx-tema:focus-visible, .man-ir:focus-visible { border-radius: 3px; }

/* ── Barra pegada del capítulo ───────────────────────────────────────── */
/* Altura cero + hijo de 44px: se pega al tope del scroll de .admin-main
   sin ocupar lugar en el flujo. z-index 5: encima del texto, debajo de los
   menús del panel. */
.man-barra-wrap { position: sticky; top: 0; height: 0; z-index: 5; }
.man-barra {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    height: var(--man-barra); box-sizing: border-box;
    background: var(--color-bg); border-bottom: 1px solid var(--color-border);
    visibility: hidden; opacity: 0; transform: translateY(-4px);
    transition: opacity 160ms ease, transform 160ms ease, visibility 0s linear 160ms;
}
.man-barra-visible {
    visibility: visible; opacity: 1; transform: none;
    transition: opacity 160ms ease, transform 160ms ease;
}
.man-barra-titulo {
    min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-size: 13px; font-weight: 600; color: var(--color-text);
}
.man-barra-num { font-weight: 500; color: var(--color-muted); }
.man-barra-botones { display: flex; gap: 4px; flex-shrink: 0; }
.man-barra-btn {
    display: grid; place-items: center; width: 32px; height: 32px;
    border: 1px solid var(--color-border); border-radius: 7px;
    background: var(--color-bg); color: var(--color-muted); cursor: pointer;
    transition: color 160ms ease, border-color 160ms ease;
}
.man-barra-btn:hover:not(:disabled) { color: var(--color-text); border-color: var(--color-border-strong); }
.man-barra-btn:disabled { opacity: 0.4; cursor: default; }

/* ── Capítulo ────────────────────────────────────────────────────────── */
.man-cap { padding-top: 6px; scroll-margin-top: 12px; }
.man-cap + .man-cap { margin-top: 64px; }
/* Un solo ancho para todo lo que va en la columna: encabezado, temas,
   figuras y el vacío de búsqueda. La columna ya mide --man-medida; el
   max-width repetido es para que nada la pase ni quede más angosto. */
.man-cap-head, .man-tema, .man-fig, .man-vacio, .man-pie { max-width: var(--man-medida); }
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
    padding-top: 26px; margin-top: 26px;
    border-top: 1px solid var(--color-border);
}
/* scroll-margin: la barra pegada (44px) más un poco de aire, así un ancla
   por hash no queda escondida debajo de ella. */
.man-tema h3 {
    margin: 0 0 14px; scroll-margin-top: calc(var(--man-barra) + 14px);
    font-size: 16px; font-weight: 600; letter-spacing: -0.01em;
    color: var(--color-text);
}
.man-tema-cuerpo { display: flex; flex-direction: column; gap: 16px; }
.man-tema-ir { margin-top: 18px; }

/* ── Chip de botón ([[Publicar tienda]] en contenido.ts) ─────────────── */
/* Se parece al botón real de la pantalla — con borde, fondo y peso — pero
   más chico, para que se lea "esto es un botón que vas a ver" sin competir
   con el texto. */
.man-btn {
    display: inline-flex; align-items: center;
    height: 22px; padding: 0 8px; border-radius: 6px;
    border: 1px solid var(--color-border-strong); background: var(--color-surface-alt);
    color: var(--color-text); font-size: 12.5px; font-weight: 600; line-height: 1;
    white-space: nowrap; vertical-align: baseline; margin: 0 1px;
}

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
/* El <figure> lo arma ilustraciones.tsx (svg + figcaption propio); acá va
   solo el marco, con el mismo ancho que el texto. */
.man-fig {
    margin: 0 0 20px; width: 100%;
    border: 1px solid var(--color-border); border-radius: 8px;
    background: var(--color-surface);
    padding: 12px; box-sizing: border-box;
}
.man-cap-head + .man-fig { margin-top: 22px; }
.man-fig svg { display: block; width: 100%; height: auto; }

.man-vacio {
    margin: 0;
    font-size: 14px; line-height: 1.7; color: var(--color-muted);
}

/* ── Pie de capítulo ─────────────────────────────────────────────────── */
.man-pie { margin-top: 36px; padding-top: 22px; border-top: 1px solid var(--color-border); }
.man-pie-nav { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.man-pie-tarjeta {
    display: flex; flex-direction: column; gap: 4px; min-height: 44px;
    padding: 12px 14px; text-align: left;
    border: 1px solid var(--color-border); border-radius: 10px;
    background: var(--color-bg); color: var(--color-text); cursor: pointer;
    font-family: inherit;
    transition: border-color 160ms ease;
}
.man-pie-tarjeta:hover { border-color: var(--color-primary); }
.man-pie-tarjeta-sig { text-align: right; align-items: flex-end; }
.man-pie-rotulo {
    display: inline-flex; align-items: center; gap: 3px;
    font-size: 11.5px; font-weight: 500; color: var(--color-muted);
}
.man-pie-titulo { font-size: 13.5px; font-weight: 600; line-height: 1.4; }

.man-opinion { margin-top: 22px; }
.man-opinion-fila { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 16px; }
.man-opinion-pregunta { font-size: 13.5px; font-weight: 500; color: var(--color-text); }
.man-opinion-botones { display: inline-flex; gap: 6px; }
.man-opinion-btn {
    display: inline-flex; align-items: center; gap: 6px;
    height: 32px; padding: 0 12px; border-radius: 7px;
    border: 1px solid var(--color-border); background: var(--color-bg);
    color: var(--color-body); cursor: pointer;
    font-family: inherit; font-size: 13px; font-weight: 500;
    transition: color 160ms ease, border-color 160ms ease, background-color 160ms ease;
}
.man-opinion-btn:hover:not(:disabled) { color: var(--color-text); border-color: var(--color-border-strong); }
.man-opinion-btn[aria-pressed="true"] {
    color: var(--color-primary); border-color: var(--color-primary);
    background: var(--color-primary-bg);
}
.man-opinion-btn:disabled { cursor: default; opacity: 0.6; }
.man-opinion-form { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; max-width: 46ch; }
.man-opinion-label { font-size: 13px; font-weight: 500; color: var(--color-text); }
.man-opinion-label > span { font-weight: 400; color: var(--color-muted); }
.man-opinion-textarea {
    width: 100%; box-sizing: border-box; padding: 8px 10px; resize: vertical;
    border: 1px solid var(--color-border); border-radius: 8px;
    background: var(--color-bg); color: var(--color-text);
    font-family: inherit; font-size: 13.5px; line-height: 1.5;
}
.man-opinion-textarea:focus { border-color: var(--color-primary); outline: none; }
.man-opinion-acciones { display: flex; justify-content: flex-end; }
.man-opinion-enviar {
    height: 32px; padding: 0 14px; border-radius: 7px; border: none;
    background: var(--color-primary); color: var(--color-on-primary); cursor: pointer;
    font-family: inherit; font-size: 13px; font-weight: 600;
}
.man-opinion-enviar:disabled { opacity: 0.5; cursor: default; }
.man-opinion-estado { margin: 8px 0 0; min-height: 1.2em; font-size: 13px; color: var(--color-muted); }

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

/* ── Dos columnas (sin riel): los temas del capítulo activo van al índice ── */
@media (max-width: 1279px) {
    .man-page { --man-cols: 220px minmax(0, var(--man-medida)); }
}

/* ── Tablet y celular ────────────────────────────────────────────────── */
/* Una columna, índice plegable. La barra pegada del capítulo se oculta:
   el botón "Índice" ya va pegado arriba, y dos tiras fijas en 390px se
   comen un cuarto de la pantalla; el pie de cada capítulo (anterior /
   siguiente) sigue estando. */
@media (max-width: 1024px) {
    .man-page { --man-cols: minmax(0, 1fr); padding: 22px 16px 80px; }
    .man-portada-in, .man-indice-col, .man-contenido { grid-column: 1; }
    .man-portada-in { gap: 14px; }
    .man-portada-texto, .man-portada-busca { flex: 1 1 100%; min-width: 0; }
    .man-layout { row-gap: 20px; }
    .man-barra-wrap { display: none; }
    .man-tema h3 { scroll-margin-top: 72px; }
    .man-cap { scroll-margin-top: 72px; }
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
        max-height: 60vh; overflow-y: auto; overflow-x: hidden;
        margin-top: 8px; padding: 14px;
        border: 1px solid var(--color-border); border-radius: 8px;
        background: var(--color-bg);
    }
    .man-indice-abierto { display: block; }
    /* En celular el dedo necesita más blanco que el mouse. */
    .man-idx-cap { min-height: 44px; padding-top: 8px; padding-bottom: 8px; }
    .man-idx-tema { min-height: 44px; padding: 11px 0 11px 12px; }
    .man-cap + .man-cap { margin-top: 48px; }
    .man-opinion-btn { height: 44px; padding: 0 16px; }
    .man-opinion-enviar { height: 44px; }
}
@media (max-width: 680px) {
    .man-campos > div { grid-template-columns: minmax(0, 1fr); gap: 2px; }
    .man-arriba { right: 14px; bottom: 14px; }
    .man-pie-nav { grid-template-columns: minmax(0, 1fr); }
    .man-pie-tarjeta-sig { text-align: left; align-items: flex-start; }
}
@media (prefers-reduced-motion: reduce) {
    .man-idx-cap, .man-idx-tema, .man-ir, .man-ir > svg, .man-arriba, .man-barra, .man-barra-btn,
    .man-pie-tarjeta, .man-opinion-btn, .man-indice-toggle > svg, .man-buscador { transition: none !important; }
}
`
