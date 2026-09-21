// Navegación del Manual — todo lo que te ubica y te mueve entre capítulos.
//
// Manual.tsx dibuja el documento (portada, capítulos, temas) y calcula el
// scroll-spy; acá viven las piezas que dependen de ese cálculo pero no del
// contenido: el índice de capítulos con su contador de leídos, el riel
// "En este capítulo", la barra fina que se pega arriba cuando el título del
// capítulo ya se fue, y el pie de capítulo (anterior / siguiente + "¿Te
// sirvió?"). Ninguna tiene copy del manual: solo rótulos de la cáscara, en
// voseo y cortos.
//
// Los estilos de todas están en CSS_MANUAL (Manual.tsx), con las mismas
// clases man-*: es un solo módulo y conviene tener el CSS en un solo lugar
// para que los anchos y los breakpoints no se desincronicen.

import { useState, useSyncExternalStore } from 'react'
import { Check, ChevronLeft, ChevronRight, ThumbsDown, ThumbsUp } from 'lucide-react'
import { panelSendManualFeedback } from '@/lib/api'
import { CAPITULOS, type Capitulo } from './contenido'
import { EnlaceIr } from './piezas'

export const idTema = (capId: string, temaId: string) => `man-${capId}-${temaId}`
export const idCapitulo = (capId: string) => `man-cap-${capId}`
export const numeroCap = (n: number) => String(n).padStart(2, '0')

// ─── ¿La ventana mide al menos N px? ─────────────────────────────────────────
// El índice y el riel derecho se reparten los temas según el ancho: a
// ≥1280 los temas van al riel, más angosto van debajo del capítulo activo
// en el índice. Se resuelve en JS y no con dos copias en el DOM ocultas por
// CSS porque el aria-expanded del capítulo tiene que ser verdad en el
// breakpoint en que se lo ve. En el servidor no hay window: se asume
// angosto, y el primer efecto lo corrige.
export function useAnchoMinimo(px: number): boolean {
    // Las tres funciones se crean una sola vez: useSyncExternalStore se
    // resuscribe cada vez que cambia la identidad de "suscribir".
    const [store] = useState(() => {
        const consulta = `(min-width: ${px}px)`
        return {
            suscribir: (cb: () => void) => {
                const mq = window.matchMedia(consulta)
                mq.addEventListener('change', cb)
                return () => mq.removeEventListener('change', cb)
            },
            leer: () => window.matchMedia(consulta).matches,
            servidor: () => false,
        }
    })
    return useSyncExternalStore(store.suscribir, store.leer, store.servidor)
}

// ─── Índice de capítulos ─────────────────────────────────────────────────────
// Solo capítulos: 13 renglones entran en cualquier pantalla sin scroll
// propio, que era lo que hacía que hubiera dos barras de scroll a la vista.
// Cada capítulo leído lleva un check chico a la derecha; "leído" lo decide
// el scroll-spy de Manual.tsx (pasaste por el último tema), no un clic.
export function IndiceCapitulos({
    capitulos, capActivo, temaActivo, leidos, conTemas, onIr,
}: {
    capitulos: Capitulo[]
    capActivo: string
    temaActivo: string
    leidos: string[]
    /** Entre 1025 y 1279px no hay riel: el capítulo activo despliega sus
     *  temas acá, y el resto queda plegado. */
    conTemas: boolean
    onIr: (id: string) => void
}) {
    const cantidadLeidos = leidos.filter(id => CAPITULOS.some(c => c.id === id)).length
    return (
        <>
            <p className="man-idx-contador">
                {cantidadLeidos} de {CAPITULOS.length} capítulos leídos
            </p>
            {capitulos.map((cap, i) => {
                const esActivo = cap.id === capActivo
                const leido = leidos.includes(cap.id)
                return (
                    <div key={cap.id} className="man-idx-grupo">
                        <button
                            type="button"
                            className={`man-idx-cap${esActivo ? ' man-idx-cap-activo' : ''}`}
                            onClick={() => onIr(idCapitulo(cap.id))}
                            aria-current={esActivo ? 'true' : undefined}
                            aria-expanded={conTemas ? esActivo : undefined}
                        >
                            <span className="man-idx-num">{numeroCap(i + 1)}</span>
                            <span className="man-idx-titulo">{cap.titulo}</span>
                            {leido && (
                                <span className="man-idx-check" title="Capítulo leído">
                                    <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                                    <span className="man-sr">, leído</span>
                                </span>
                            )}
                        </button>
                        {conTemas && esActivo && (
                            <div className="man-idx-temas">
                                {cap.temas.map(t => (
                                    <BotonTema
                                        key={t.id}
                                        titulo={t.titulo}
                                        id={idTema(cap.id, t.id)}
                                        activo={temaActivo === idTema(cap.id, t.id)}
                                        onIr={onIr}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )
            })}
        </>
    )
}

function BotonTema({ titulo, id, activo, onIr }: { titulo: string; id: string; activo: boolean; onIr: (id: string) => void }) {
    return (
        <button
            type="button"
            className={`man-idx-tema${activo ? ' man-idx-tema-activo' : ''}`}
            onClick={() => onIr(id)}
            aria-current={activo ? 'true' : undefined}
        >
            {titulo}
        </button>
    )
}

// ─── Riel derecho: "En este capítulo" ────────────────────────────────────────
// Solo a ≥1280px. Muestra los temas del capítulo que se está leyendo y,
// debajo, el atajo a la pantalla que explica. Es lo que antes hacía el
// índice completo con 59 renglones y scroll propio.
export function RielCapitulo({
    cap, temaActivo, onIr,
}: {
    cap: Capitulo | undefined
    temaActivo: string
    onIr: (id: string) => void
}) {
    if (!cap) return null
    return (
        <>
            <p className="man-riel-titulo">En este capítulo</p>
            <div className="man-riel-temas">
                {cap.temas.map(t => (
                    <BotonTema
                        key={t.id}
                        titulo={t.titulo}
                        id={idTema(cap.id, t.id)}
                        activo={temaActivo === idTema(cap.id, t.id)}
                        onIr={onIr}
                    />
                ))}
            </div>
            {cap.ir && (
                <div className="man-riel-ir">
                    <EnlaceIr destino={{ ...cap.ir, label: 'Ir a la pantalla' }} />
                </div>
            )}
        </>
    )
}

// ─── Barra pegada del capítulo ───────────────────────────────────────────────
// Aparece recién cuando el título real del capítulo salió por arriba: hasta
// ahí el h2 ya te dice dónde estás y la barra sería ruido. Es sticky dentro
// de la columna de contenido con altura cero, así no empuja el primer
// capítulo 44px para abajo: el contenido visible se dibuja por fuera de la
// caja. Cuando está oculta va con visibility hidden, no con display none:
// así la transición de opacidad anda y los botones salen del orden de Tab.
export function BarraCapitulo({
    visible, numero, cap, anterior, siguiente, onIr,
}: {
    visible: boolean
    numero: number
    cap: Capitulo | undefined
    anterior: Capitulo | undefined
    siguiente: Capitulo | undefined
    onIr: (id: string) => void
}) {
    return (
        <div className="man-barra-wrap">
            <div className={`man-barra${visible && cap ? ' man-barra-visible' : ''}`} aria-hidden={!visible || !cap}>
                <span className="man-barra-titulo">
                    <span className="man-barra-num">Capítulo {numeroCap(numero)}</span>
                    <span aria-hidden="true"> · </span>
                    {cap?.titulo}
                </span>
                <span className="man-barra-botones">
                    <button
                        type="button"
                        className="man-barra-btn"
                        onClick={() => anterior && onIr(idCapitulo(anterior.id))}
                        disabled={!anterior}
                        aria-label={anterior ? `Capítulo anterior: ${anterior.titulo}` : 'Capítulo anterior'}
                    >
                        <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        className="man-barra-btn"
                        onClick={() => siguiente && onIr(idCapitulo(siguiente.id))}
                        disabled={!siguiente}
                        aria-label={siguiente ? `Capítulo siguiente: ${siguiente.titulo}` : 'Capítulo siguiente'}
                    >
                        <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
                    </button>
                </span>
            </div>
        </div>
    )
}

// ─── Pie de capítulo: anterior / siguiente + "¿Te sirvió?" ───────────────────
export function PieCapitulo({
    cap, anterior, siguiente, voto, onIr, onVotado,
}: {
    cap: Capitulo
    anterior: Capitulo | undefined
    siguiente: Capitulo | undefined
    /** Voto guardado en el servidor (llega después del montaje, o nunca). */
    voto: boolean | undefined
    onIr: (id: string) => void
    onVotado: (capId: string, helpful: boolean) => void
}) {
    return (
        <footer className="man-pie">
            <nav className="man-pie-nav" aria-label={`Navegar desde ${cap.titulo}`}>
                {anterior ? (
                    <button type="button" className="man-pie-tarjeta" onClick={() => onIr(idCapitulo(anterior.id))}>
                        <span className="man-pie-rotulo"><ChevronLeft size={13} strokeWidth={2} aria-hidden="true" /> Anterior</span>
                        <span className="man-pie-titulo">{anterior.titulo}</span>
                    </button>
                ) : <span aria-hidden="true" />}
                {siguiente ? (
                    <button type="button" className="man-pie-tarjeta man-pie-tarjeta-sig" onClick={() => onIr(idCapitulo(siguiente.id))}>
                        <span className="man-pie-rotulo">Siguiente <ChevronRight size={13} strokeWidth={2} aria-hidden="true" /></span>
                        <span className="man-pie-titulo">{siguiente.titulo}</span>
                    </button>
                ) : <span aria-hidden="true" />}
            </nav>
            <Opinion capId={cap.id} voto={voto} onVotado={onVotado} />
        </footer>
    )
}

// El voto se manda apenas se toca Sí o No — si el que dijo "No" se va sin
// contar qué faltó, igual quedó registrado que el capítulo no sirvió. El
// comentario es una segunda llamada que pisa la primera (un voto por
// capítulo y miembro, ver panelSendManualFeedback). Si el endpoint todavía
// no existe o falla, se avisa en una línea y la página sigue igual.
type EstadoOpinion = 'quieto' | 'enviando' | 'gracias' | 'error'

function Opinion({ capId, voto, onVotado }: {
    capId: string
    voto: boolean | undefined
    onVotado: (capId: string, helpful: boolean) => void
}) {
    const [votoLocal, setVotoLocal] = useState<boolean | null>(null)
    const [estado, setEstado] = useState<EstadoOpinion>('quieto')
    const [comentario, setComentario] = useState('')
    const [comentarioAbierto, setComentarioAbierto] = useState(false)
    const actual = votoLocal ?? voto

    async function enviar(helpful: boolean, comment?: string) {
        setEstado('enviando')
        try {
            await panelSendManualFeedback({ chapterId: capId, helpful, ...(comment ? { comment } : {}) })
            setVotoLocal(helpful)
            onVotado(capId, helpful)
            setEstado('gracias')
            if (comment) { setComentarioAbierto(false); setComentario('') }
        } catch {
            setEstado('error')
        }
    }

    function votar(helpful: boolean) {
        setComentarioAbierto(!helpful)
        void enviar(helpful)
    }

    const idComentario = `man-opinion-${capId}`
    const ocupado = estado === 'enviando'

    return (
        <div className="man-opinion">
            <div className="man-opinion-fila">
                <span className="man-opinion-pregunta" id={`${idComentario}-pregunta`}>¿Te sirvió este capítulo?</span>
                <span className="man-opinion-botones" role="group" aria-labelledby={`${idComentario}-pregunta`}>
                    <button
                        type="button"
                        className="man-opinion-btn"
                        aria-pressed={actual === true}
                        disabled={ocupado}
                        onClick={() => votar(true)}
                    >
                        <ThumbsUp size={14} strokeWidth={2} aria-hidden="true" /> Sí
                    </button>
                    <button
                        type="button"
                        className="man-opinion-btn"
                        aria-pressed={actual === false}
                        disabled={ocupado}
                        onClick={() => votar(false)}
                    >
                        <ThumbsDown size={14} strokeWidth={2} aria-hidden="true" /> No
                    </button>
                </span>
            </div>

            {comentarioAbierto && (
                <form
                    className="man-opinion-form"
                    onSubmit={e => { e.preventDefault(); if (comentario.trim()) void enviar(false, comentario.trim()) }}
                >
                    <label htmlFor={idComentario} className="man-opinion-label">¿Qué faltó? <span>(opcional)</span></label>
                    <textarea
                        id={idComentario}
                        className="man-opinion-textarea"
                        rows={3}
                        maxLength={1000}
                        value={comentario}
                        onChange={e => setComentario(e.target.value)}
                        placeholder="Contanos qué esperabas encontrar y no estaba."
                    />
                    <div className="man-opinion-acciones">
                        <button type="submit" className="man-opinion-enviar" disabled={ocupado || comentario.trim() === ''}>
                            Enviar
                        </button>
                    </div>
                </form>
            )}

            <p className="man-opinion-estado" role="status" aria-live="polite">
                {estado === 'gracias' && 'Gracias, lo tomamos en cuenta.'}
                {estado === 'error' && 'No pudimos guardar tu opinión. Probá de nuevo en un rato.'}
            </p>
        </div>
    )
}
