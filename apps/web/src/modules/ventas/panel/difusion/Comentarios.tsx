import { useCallback, useEffect, useState } from 'react'
import { EyeOff, Eye, ExternalLink, Heart, MessageCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import {
  ApiError, getInstagramComentarios, hideInstagramComment, pedirRespuestaAOrbi, replyInstagramComment,
  type InstagramComentario, type InstagramEstado, type InstagramPublicacionComentada,
} from '@/lib/api'
import { Compuerta } from './Compuerta'
import { contarComentarios, filtrarComentarios, type FiltroDeComentarios } from './filtroComentarios'
import { haceCuanto, resumir } from './formato'
import { SugerenciasDeOrbi } from './SugerenciasDeOrbi'

// Difusión → Comentarios: los comentarios de las últimas publicaciones, con respuesta en el lugar y la
// posibilidad de ocultar (y volver a mostrar) los que no querés a la vista. Borrar no se ofrece: no tiene vuelta
// atrás. Los comentarios se leen al abrir la pantalla o al tocar "Actualizar"; no llegan solos.

interface Props {
  estado: InstagramEstado | null
  /** Abre el modal de conexión de Instagram (si todavía no está conectado). */
  onAbrirConexion: () => void
}

export function Comentarios({ estado, onAbrirConexion }: Props) {
  return (
    <Compuerta estado={estado} permiso="comentar" onAbrirConexion={onAbrirConexion}>
      {(usuario) => <Lista usuario={usuario} />}
    </Compuerta>
  )
}

function Lista({ usuario }: { usuario: string | null }) {
  const [publicaciones, setPublicaciones] = useState<InstagramPublicacionComentada[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [filtro, setFiltro] = useState<FiltroDeComentarios>('todos')

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      setPublicaciones((await getInstagramComentarios()).publicaciones)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudieron cargar los comentarios. Probá de nuevo en un momento.')
      setPublicaciones((previas) => previas ?? [])
    } finally {
      setCargando(false)
    }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  // Cambia un comentario de una publicación sin volver a pedir todo.
  const cambiar = (publicacionId: string, comentarioId: string, fn: (c: InstagramComentario) => InstagramComentario) =>
    setPublicaciones((ps) => ps?.map((p) => (p.id !== publicacionId ? p : { ...p, comentarios: p.comentarios.map((c) => (c.id === comentarioId ? fn(c) : c)) })) ?? null)

  const cuenta = contarComentarios(publicaciones ?? [])
  const total = cuenta.todos
  const visibles = filtrarComentarios(publicaciones ?? [], filtro)

  return (
    <div className="com-raiz">
      <style>{CSS}</style>
      <div className="com-cabecera">
        <p className="com-resumen">
          {publicaciones === null ? 'Cargando comentarios…' : total > 0 ? `${total} comentario${total === 1 ? '' : 's'} en tus últimas publicaciones` : 'Comentarios de tus últimas publicaciones'}
        </p>
        <Button variant="secondary" size="sm" onClick={cargar} disabled={cargando} icon={<RefreshCw size={14} className={cargando ? 'com-girar' : undefined} />}>
          Actualizar
        </Button>
      </div>

      {total > 0 && (
        <div className="com-filtros" role="group" aria-label="Filtrar comentarios">
          {([['todos', 'Todos'], ['sin-responder', 'Sin responder'], ['ocultos', 'Ocultos']] as const).map(([clave, etiqueta]) => (
            <button key={clave} type="button" className={`com-filtro${filtro === clave ? ' com-filtro-activo' : ''}`} aria-pressed={filtro === clave} onClick={() => setFiltro(clave)}>
              {etiqueta} <span className="com-filtro-cuenta">{cuenta[clave]}</span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="com-error" role="alert">{error}</p>}

      {publicaciones === null && <div className="com-esqueleto" aria-hidden><span /><span /><span /></div>}

      {publicaciones?.length === 0 && !error && (
        <section className="com-tarjeta com-vacio">
          <MessageCircle size={26} strokeWidth={1.5} aria-hidden />
          <p className="com-vacio-titulo">Todavía no hay comentarios</p>
          <p className="com-suave">Cuando alguien comente una de tus últimas publicaciones, lo ves acá y lo respondés sin salir de Órbita.</p>
        </section>
      )}

      {publicaciones && publicaciones.length > 0 && visibles.length === 0 && (
        <section className="com-tarjeta com-vacio">
          <p className="com-vacio-titulo">{filtro === 'sin-responder' ? 'Estás al día' : 'No hay comentarios para mostrar'}</p>
          <p className="com-suave">{filtro === 'sin-responder' ? 'Respondiste todos los comentarios de tus últimas publicaciones.' : 'No tenés comentarios ocultos.'}</p>
        </section>
      )}

      {visibles.map((p) => (
        <section key={p.id} className="com-tarjeta">
          <header className="com-publicacion">
            <span className="com-miniatura">{p.imagen ? <img src={p.imagen} alt="" /> : null}</span>
            <div className="com-publicacion-texto">
              <p className="com-publicacion-titulo">{p.texto ? resumir(p.texto, 90) : 'Publicación sin texto'}</p>
              <p className="com-meta">{haceCuanto(p.fecha)}{p.fecha ? ' · ' : ''}{p.totalComentarios} comentario{p.totalComentarios === 1 ? '' : 's'}</p>
            </div>
            {p.enlace && (
              <a className="com-enlace" href={p.enlace} target="_blank" rel="noopener noreferrer">
                Ver <ExternalLink size={13} aria-hidden />
              </a>
            )}
          </header>
          <ul className="com-lista">
            {p.comentarios.map((c) => (
              <ComentarioFila
                key={c.id}
                c={c}
                publicacion={p.texto}
                usuarioPropio={usuario}
                onRespondido={(r) => cambiar(p.id, c.id, (x) => ({ ...x, respuestas: [...x.respuestas, r] }))}
                onOculto={(oculto) => cambiar(p.id, c.id, (x) => ({ ...x, oculto }))}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function ComentarioFila({ c, publicacion, usuarioPropio, onRespondido, onOculto }: {
  c: InstagramComentario
  publicacion: string
  usuarioPropio: string | null
  onRespondido: (r: InstagramComentario['respuestas'][number]) => void
  onOculto: (oculto: boolean) => void
}) {
  const [respondiendo, setRespondiendo] = useState(false)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [ocultando, setOcultando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enviar = async () => {
    const limpio = texto.trim()
    if (!limpio) return
    setEnviando(true); setError(null)
    try {
      const { id } = await replyInstagramComment(c.id, limpio)
      onRespondido({ id: id || `local-${Date.now()}`, usuario: usuarioPropio ?? 'vos', texto: limpio, fecha: new Date().toISOString() })
      setTexto('')
      setRespondiendo(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo enviar la respuesta. Probá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  const alternarOculto = async () => {
    const nuevo = !c.oculto
    setOcultando(true); setError(null)
    onOculto(nuevo) // se ve el cambio al instante; si Instagram lo rechaza, vuelve
    try {
      await hideInstagramComment(c.id, nuevo)
    } catch (e) {
      onOculto(!nuevo)
      setError(e instanceof ApiError ? e.message : 'No se pudo cambiar el comentario. Probá de nuevo.')
    } finally {
      setOcultando(false)
    }
  }

  return (
    <li className={`com-comentario${c.oculto ? ' com-oculto' : ''}`}>
      <span className="com-avatar" aria-hidden>{c.usuario.charAt(0).toUpperCase()}</span>
      <div className="com-cuerpo">
        <p className="com-texto"><strong>{c.usuario}</strong> {c.texto}</p>
        <p className="com-meta">
          {haceCuanto(c.fecha)}
          {c.likes > 0 && <> · <span className="com-likes"><Heart size={11} aria-hidden /> {c.likes}</span></>}
          {c.oculto && <span> · Oculto: solo lo ve quien lo escribió</span>}
        </p>

        {c.respuestas.length > 0 && (
          <ul className="com-respuestas">
            {c.respuestas.map((r) => (
              <li key={r.id}><p className="com-texto"><strong>{r.usuario}</strong> {r.texto}</p><p className="com-meta">{haceCuanto(r.fecha)}</p></li>
            ))}
          </ul>
        )}

        {respondiendo ? (
          <form className="com-form" onSubmit={(e) => { e.preventDefault(); if (!enviando) enviar() }}>
            <textarea
              className="com-campo"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={2}
              maxLength={2200}
              autoFocus
              placeholder={`Respondé a @${c.usuario}`}
              aria-label={`Respuesta a ${c.usuario}`}
            />
            <SugerenciasDeOrbi
              pedir={async () => (await pedirRespuestaAOrbi({ tipo: 'comentario', texto: c.texto, publicacion })).sugerencias}
              onElegir={setTexto}
              disabled={enviando}
            />
            <div className="com-form-acciones">
              <Button type="button" variant="ghost" size="sm" disabled={enviando} onClick={() => { setRespondiendo(false); setTexto(''); setError(null) }}>Cancelar</Button>
              <Button type="submit" size="sm" loading={enviando} disabled={!texto.trim()}>Responder</Button>
            </div>
          </form>
        ) : (
          <div className="com-acciones">
            <button type="button" className="com-accion" onClick={() => setRespondiendo(true)}>Responder</button>
            <button type="button" className="com-accion" onClick={alternarOculto} disabled={ocultando}>
              {c.oculto ? <><Eye size={13} aria-hidden /> Volver a mostrar</> : <><EyeOff size={13} aria-hidden /> Ocultar</>}
            </button>
          </div>
        )}
        {error && <p className="com-error" role="alert">{error}</p>}
      </div>
    </li>
  )
}

const CSS = `
.com-raiz { display: flex; flex-direction: column; gap: 14px; margin-top: 16px; }
.com-cabecera { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.com-filtros { display: flex; flex-wrap: wrap; gap: 6px; }
.com-filtro { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: 16px; background: var(--color-surface); cursor: pointer; font: inherit; font-size: 13px; font-weight: 500; color: var(--color-muted); transition: border-color 150ms, color 150ms, background-color 150ms; }
.com-filtro:hover { color: var(--color-text); border-color: var(--color-muted); }
.com-filtro-activo, .com-filtro-activo:hover { color: var(--color-surface); background: var(--color-text); border-color: var(--color-text); }
.com-filtro-cuenta { font-size: 12px; font-variant-numeric: tabular-nums; opacity: 0.75; }
.com-filtro:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.com-resumen { margin: 0; font-size: 14px; font-weight: 600; color: var(--color-text); }
.com-error { margin: 0 0 4px; font-size: 12.5px; line-height: 1.4; color: var(--color-error); }
.com-suave { margin: 0; font-size: 13px; line-height: 1.55; color: var(--color-muted); }
.com-girar { animation: com-giro 0.9s linear infinite; }
@keyframes com-giro { to { transform: rotate(360deg); } }

.com-tarjeta { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; box-shadow: var(--shadow-card); overflow: hidden; }
.com-vacio { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 36px 24px; text-align: center; color: var(--color-muted); }
.com-vacio-titulo { margin: 6px 0 0; font-size: 15px; font-weight: 600; color: var(--color-text); }
.com-vacio .com-suave { max-width: 44ch; }

.com-publicacion { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--color-border); background: var(--color-surface-alt); }
.com-miniatura { width: 44px; height: 44px; flex-shrink: 0; overflow: hidden; border-radius: 10px; border: 1px solid var(--color-border); background: #fff; display: inline-flex; }
.com-miniatura img { width: 100%; height: 100%; object-fit: cover; }
.com-publicacion-texto { flex: 1; min-width: 0; }
.com-publicacion-titulo { margin: 0 0 2px; font-size: 13.5px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.com-meta { margin: 2px 0 0; font-size: 12px; color: var(--color-muted); }
.com-likes { display: inline-flex; align-items: center; gap: 3px; }
.com-enlace { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; font-size: 13px; font-weight: 500; color: var(--color-primary); text-decoration: none; }
.com-enlace:hover { text-decoration: underline; text-underline-offset: 3px; }

.com-lista { list-style: none; margin: 0; padding: 4px 16px; }
.com-comentario { display: flex; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--color-border); }
.com-comentario:last-child { border-bottom: none; }
.com-oculto .com-texto { color: var(--color-muted); }
.com-avatar { width: 32px; height: 32px; flex-shrink: 0; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: var(--color-muted); background: var(--color-surface-alt); border: 1px solid var(--color-border); }
.com-cuerpo { flex: 1; min-width: 0; }
.com-texto { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--color-text); overflow-wrap: anywhere; white-space: pre-wrap; }
.com-texto strong { font-weight: 600; }

.com-respuestas { list-style: none; margin: 10px 0 0; padding: 0 0 0 12px; border-left: 2px solid var(--color-border); display: flex; flex-direction: column; gap: 8px; }
.com-acciones { display: flex; align-items: center; gap: 16px; margin-top: 8px; }
.com-accion { display: inline-flex; align-items: center; gap: 5px; min-height: 28px; padding: 0; border: none; background: transparent; cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 500; color: var(--color-muted); transition: color 150ms; }
.com-accion:hover:not(:disabled) { color: var(--color-text); }
.com-accion:disabled { opacity: 0.5; cursor: not-allowed; }
.com-accion:focus-visible, .com-enlace:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 4px; }

.com-form { margin-top: 10px; }
.com-campo { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface-alt); font: inherit; font-size: 16px; line-height: 1.45; color: var(--color-text); resize: vertical; outline: none; transition: border-color 150ms, box-shadow 150ms, background-color 150ms; }
.com-campo:focus { border-color: var(--color-primary); background: var(--color-surface); box-shadow: 0 0 0 3px var(--color-primary-bg); }
.com-form-acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }

.com-esqueleto { display: flex; flex-direction: column; gap: 12px; }
.com-esqueleto span { height: 92px; border-radius: 16px; background: var(--color-surface-alt); border: 1px solid var(--color-border); }

@media (prefers-reduced-motion: reduce) { .com-girar { animation: none; } .com-campo, .com-accion { transition: none; } }
@media (max-width: 520px) { .com-cabecera { flex-wrap: wrap; } .com-lista { padding: 4px 12px; } }
`
