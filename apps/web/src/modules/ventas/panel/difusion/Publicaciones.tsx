import { useCallback, useEffect, useState } from 'react'
import { Bookmark, Check, ExternalLink, Heart, MessageCircle, Search, Send } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { Modal } from '@/design-system/components/Modal'
import {
  ApiError, getInstagramPosts, panelListProducts, publishInstagramPost,
  type ApiProductRow, type InstagramEstado, type InstagramPublicacion,
} from '@/lib/api'
import { currentSlug } from '@/lib/tenant'
import { fmtMoney } from '@/lib/utils'
import { Compuerta } from './Compuerta'
import { MAX_TEXTO_INSTAGRAM, textoSugerido, urlDelProducto } from './textoSugerido'

// Difusión → Publicaciones: subir a Instagram la foto de un producto con un texto propio.
//
// Pasos: 1) elegir un producto de la tienda (solo los publicados y con foto), 2) escribir el texto (arranca
// con uno sugerido), 3) mirar cómo queda y confirmar. Nada se publica sin la confirmación: es lo único de
// Órbita que queda a la vista de los seguidores. La foto se convierte a JPEG cuadrado en la API; la vista
// previa la muestra así (sobre fondo blanco) para que no haya sorpresas.

interface Props {
  estado: InstagramEstado | null
  /** Abre el modal de conexión de Instagram (si todavía no está conectado). */
  onAbrirConexion: () => void
}

const fotoDe = (p: ApiProductRow): string | null => p.primaryImageUrl ?? p.images[0] ?? null

export function Publicaciones({ estado, onAbrirConexion }: Props) {
  return (
    <Compuerta estado={estado} permiso="publicar" onAbrirConexion={onAbrirConexion}>
      {(usuario) => <Compositor usuario={usuario} />}
    </Compuerta>
  )
}

// ─── Compositor ────────────────────────────────────────────────────────────────

function Compositor({ usuario }: { usuario: string | null }) {
  const [busqueda, setBusqueda] = useState('')
  const [productos, setProductos] = useState<ApiProductRow[] | null>(null)
  const [elegido, setElegido] = useState<ApiProductRow | null>(null)
  const [texto, setTexto] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<InstagramPublicacion | null>(null)
  const [historial, setHistorial] = useState<InstagramPublicacion[]>([])

  const cargarHistorial = useCallback(() => {
    getInstagramPosts().then(setHistorial).catch(() => undefined)
  }, [])
  useEffect(() => { cargarHistorial() }, [cargarHistorial])

  // Buscador de productos: se espera un momento después de la última tecla para no pedir en cada letra.
  useEffect(() => {
    let cancelado = false
    const t = setTimeout(() => {
      panelListProducts({ search: busqueda.trim() || undefined, status: 'PUBLISHED', limit: 12 })
        .then((r) => { if (!cancelado) setProductos(r.data) })
        .catch(() => { if (!cancelado) setProductos([]) })
    }, busqueda ? 300 : 0)
    return () => { cancelado = true; clearTimeout(t) }
  }, [busqueda])

  const elegir = (p: ApiProductRow) => {
    setElegido(p)
    setTexto(textoSugerido(p, urlDelProducto(currentSlug(), p.id)))
    setHecho(null)
    setError(null)
  }

  const foto = elegido ? fotoDe(elegido) : null
  const largo = texto.length
  const puedePublicar = !!elegido && !!foto && texto.trim().length > 0 && largo <= MAX_TEXTO_INSTAGRAM

  const publicar = async () => {
    if (!elegido || !puedePublicar) return
    setPublicando(true); setError(null)
    try {
      const post = await publishInstagramPost({ productId: elegido.id, caption: texto.trim() })
      setHecho(post)
      setElegido(null)
      setTexto('')
      setConfirmando(false)
      cargarHistorial()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo publicar. Probá de nuevo en un momento.')
    } finally {
      setPublicando(false)
    }
  }

  return (
    <div className="pub-raiz">
      <style>{CSS}</style>

      {hecho && (
        <section className="pub-tarjeta pub-exito" role="status">
          <span className="pub-exito-icono" aria-hidden><Check size={18} strokeWidth={3} /></span>
          <div>
            <p className="pub-exito-titulo">Publicado en Instagram</p>
            <p className="pub-suave" style={{ margin: 0 }}>
              {hecho.productName} ya está en tu perfil.{' '}
              {hecho.permalink && (
                <a className="pub-enlace" href={hecho.permalink} target="_blank" rel="noopener noreferrer">Ver la publicación</a>
              )}
            </p>
          </div>
        </section>
      )}

      <div className="pub-grilla">
        <div className="pub-columna">
          <section className="pub-tarjeta">
            <h2 className="pub-paso"><span className="pub-num">1</span> Elegí un producto</h2>
            <label className="pub-buscador">
              <Search size={15} strokeWidth={2} aria-hidden />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar en tus productos publicados"
                aria-label="Buscar producto"
              />
            </label>
            <ul className="pub-lista">
              {productos === null && <li className="pub-vacio">Cargando…</li>}
              {productos?.length === 0 && (
                <li className="pub-vacio">{busqueda ? 'No hay productos publicados con ese nombre.' : 'Todavía no tenés productos publicados en tu tienda.'}</li>
              )}
              {productos?.map((p) => {
                const f = fotoDe(p)
                const activo = elegido?.id === p.id
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`pub-producto${activo ? ' pub-producto-activo' : ''}`}
                      disabled={!f}
                      aria-pressed={activo}
                      onClick={() => elegir(p)}
                    >
                      <span className="pub-miniatura">{f ? <img src={f} alt="" /> : null}</span>
                      <span className="pub-producto-texto">
                        <span className="pub-producto-nombre">{p.name}</span>
                        <span className="pub-producto-sub">{f ? fmtMoney(p.basePrice) : 'Sin foto: cargale una para poder publicarlo'}</span>
                      </span>
                      {activo && <Check size={16} strokeWidth={2.5} aria-hidden className="pub-check" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="pub-tarjeta">
            <div className="pub-paso-fila">
              <h2 className="pub-paso"><span className="pub-num">2</span> Escribí el texto</h2>
              {elegido && (
                <button type="button" className="pub-enlace-boton" onClick={() => setTexto(textoSugerido(elegido, urlDelProducto(currentSlug(), elegido.id)))}>
                  Volver al sugerido
                </button>
              )}
            </div>
            <textarea
              className="pub-texto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={!elegido}
              placeholder={elegido ? '' : 'Elegí un producto y acá aparece un texto para empezar.'}
              rows={8}
              aria-label="Texto de la publicación"
            />
            <p className={`pub-contador${largo > MAX_TEXTO_INSTAGRAM ? ' pub-contador-excedido' : ''}`}>{largo} / {MAX_TEXTO_INSTAGRAM}</p>
            <p className="pub-suave" style={{ margin: '4px 0 0' }}>
              Instagram no convierte los enlaces del texto en botones: quien lo vea tiene que copiarlo o ir al link de tu perfil.
            </p>
          </section>

          <div className="pub-publicar">
            <Button size="lg" disabled={!puedePublicar} onClick={() => { setError(null); setConfirmando(true) }}>
              Publicar en Instagram
            </Button>
          </div>
        </div>

        <aside className="pub-columna pub-lateral" aria-label="Vista previa">
          <VistaPrevia usuario={usuario} foto={foto} texto={texto} />
        </aside>
      </div>

      {historial.length > 0 && (
        <section className="pub-historial">
          <h2 className="pub-historial-titulo">Publicado desde Órbita</h2>
          <ul className="pub-historial-lista">
            {historial.map((h) => (
              <li key={h.id} className="pub-tarjeta pub-fila">
                <span className="pub-miniatura"><img src={h.imageUrl} alt="" /></span>
                <div className="pub-fila-texto">
                  <p className="pub-producto-nombre">{h.productName}</p>
                  <p className="pub-producto-sub">{new Date(h.createdAt).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                {h.permalink && (
                  <a className="pub-enlace" href={h.permalink} target="_blank" rel="noopener noreferrer">
                    Ver en Instagram <ExternalLink size={13} aria-hidden />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal
        isOpen={confirmando}
        onClose={() => { if (!publicando) setConfirmando(false) }}
        dismissable={!publicando}
        title="¿Publicar ahora en Instagram?"
        maxWidth={440}
        footer={(
          <>
            <Button variant="secondary" disabled={publicando} onClick={() => setConfirmando(false)}>Cancelar</Button>
            <Button loading={publicando} onClick={publicar}>Publicar</Button>
          </>
        )}
      >
        <p className="pub-suave" style={{ margin: 0 }}>
          Se va a subir <strong>{elegido?.name}</strong> a tu Instagram{usuario ? ` (@${usuario})` : ''} con el texto que escribiste.
          Tus seguidores lo van a ver enseguida.
        </p>
        {error && <p className="pub-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
      </Modal>
    </div>
  )
}

// ─── Vista previa estilo Instagram ─────────────────────────────────────────────

function VistaPrevia({ usuario, foto, texto }: { usuario: string | null; foto: string | null; texto: string }) {
  const nombre = usuario ?? 'tu_cuenta'
  return (
    <figure className="pub-ig">
      <figcaption className="pub-ig-cabecera">
        <span className="pub-ig-avatar" aria-hidden>{nombre.charAt(0).toUpperCase()}</span>
        <span className="pub-ig-usuario">{nombre}</span>
      </figcaption>
      <div className="pub-ig-foto">
        {foto ? <img src={foto} alt="Foto que se va a publicar" /> : <span className="pub-ig-sinfoto">La foto del producto aparece acá</span>}
      </div>
      <div className="pub-ig-acciones" aria-hidden>
        <Heart size={20} strokeWidth={1.8} /><MessageCircle size={20} strokeWidth={1.8} /><Send size={20} strokeWidth={1.8} />
        <Bookmark size={20} strokeWidth={1.8} style={{ marginLeft: 'auto' }} />
      </div>
      <p className="pub-ig-texto">
        <strong>{nombre}</strong> {texto ? texto : <span className="pub-ig-placeholder">El texto que escribas aparece acá.</span>}
      </p>
    </figure>
  )
}

// ─── Estilos ───────────────────────────────────────────────────────────────────

const CSS = `
.pub-raiz { display: flex; flex-direction: column; gap: 16px; margin-top: 16px; }
.pub-tarjeta { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; box-shadow: var(--shadow-card); padding: 20px; }
.pub-suave { margin: 0 0 12px; font-size: 13px; line-height: 1.55; color: var(--color-muted); }
.pub-error { margin: 0 0 12px; font-size: 12.5px; line-height: 1.4; color: var(--color-error); }


.pub-exito { display: flex; align-items: center; gap: 14px; }
.pub-exito-icono { width: 34px; height: 34px; flex-shrink: 0; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; background: var(--color-success); }
.pub-exito-titulo { margin: 0 0 2px; font-size: 14.5px; font-weight: 600; color: var(--color-text); }

.pub-grilla { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; }
.pub-columna { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.pub-lateral { position: sticky; top: 20px; }

.pub-paso { display: flex; align-items: center; gap: 10px; margin: 0 0 14px; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; color: var(--color-text); }
.pub-paso-fila { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.pub-num { width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: var(--color-muted); border: 1.5px solid var(--color-border); }

.pub-buscador { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; margin-bottom: 10px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface-alt); color: var(--color-muted); transition: border-color 150ms, box-shadow 150ms; }
.pub-buscador:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-bg); background: var(--color-surface); }
.pub-buscador input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font: inherit; font-size: 14px; color: var(--color-text); }

.pub-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 340px; overflow-y: auto; }
.pub-vacio { padding: 18px 8px; text-align: center; font-size: 13px; color: var(--color-muted); }
.pub-producto { width: 100%; display: flex; align-items: center; gap: 12px; padding: 8px 10px; border: 1px solid transparent; border-radius: 12px; background: transparent; cursor: pointer; font: inherit; text-align: left; transition: background-color 150ms, border-color 150ms; }
.pub-producto:hover:not(:disabled) { background: var(--color-surface-alt); }
.pub-producto:disabled { opacity: 0.55; cursor: not-allowed; }
.pub-producto-activo, .pub-producto-activo:hover:not(:disabled) { border-color: var(--color-primary); background: var(--color-primary-bg); }
.pub-producto:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.pub-miniatura { width: 46px; height: 46px; flex-shrink: 0; overflow: hidden; border-radius: 10px; border: 1px solid var(--color-border); background: #fff; display: inline-flex; }
.pub-miniatura img { width: 100%; height: 100%; object-fit: contain; }
.pub-producto-texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pub-producto-nombre { margin: 0; font-size: 14px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pub-producto-sub { margin: 0; font-size: 12.5px; color: var(--color-muted); }
.pub-check { flex-shrink: 0; color: var(--color-primary); }

.pub-texto { width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface-alt); font: inherit; font-size: 16px; line-height: 1.5; color: var(--color-text); resize: vertical; outline: none; transition: border-color 150ms, box-shadow 150ms, background-color 150ms; }
.pub-texto:focus { border-color: var(--color-primary); background: var(--color-surface); box-shadow: 0 0 0 3px var(--color-primary-bg); }
.pub-texto:disabled { opacity: 0.6; cursor: not-allowed; }
.pub-contador { margin: 6px 0 0; text-align: right; font-size: 12px; color: var(--color-muted); }
.pub-contador-excedido { color: var(--color-error); font-weight: 600; }
.pub-enlace-boton { border: none; background: transparent; padding: 0; cursor: pointer; font: inherit; font-size: 12.5px; color: var(--color-primary); }
.pub-enlace-boton:hover { text-decoration: underline; text-underline-offset: 3px; }
.pub-enlace { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 500; color: var(--color-primary); text-decoration: none; }
.pub-enlace:hover { text-decoration: underline; text-underline-offset: 3px; }
.pub-publicar { display: flex; justify-content: flex-end; }
.pub-publicar button { min-width: 240px; justify-content: center; }

.pub-ig { margin: 0; overflow: hidden; border-radius: 16px; border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card); }
.pub-ig-cabecera { display: flex; align-items: center; gap: 10px; padding: 12px 14px; }
.pub-ig-avatar { width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(45deg, #f09433, #dc2743 55%, #bc1888); }
.pub-ig-usuario { font-size: 13.5px; font-weight: 600; color: var(--color-text); }
.pub-ig-foto { aspect-ratio: 1; background: #fff; display: flex; align-items: center; justify-content: center; border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); }
.pub-ig-foto img { width: 100%; height: 100%; object-fit: contain; }
.pub-ig-sinfoto { padding: 16px; text-align: center; font-size: 12.5px; color: #8a94a6; }
.pub-ig-acciones { display: flex; align-items: center; gap: 14px; padding: 10px 14px 4px; color: var(--color-text); }
.pub-ig-texto { margin: 0; padding: 4px 14px 14px; font-size: 13.5px; line-height: 1.45; color: var(--color-text); white-space: pre-wrap; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
.pub-ig-placeholder { color: var(--color-muted); }

.pub-historial-titulo { margin: 8px 0 12px; font-size: 15px; font-weight: 600; color: var(--color-text); }
.pub-historial-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.pub-fila { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
.pub-fila-texto { flex: 1; min-width: 0; }

@media (max-width: 860px) {
  .pub-grilla { grid-template-columns: minmax(0, 1fr); }
  .pub-lateral { position: static; order: -1; }
  .pub-publicar { justify-content: stretch; }
  .pub-publicar button { width: 100%; height: 48px; }
}
@media (prefers-reduced-motion: reduce) { .pub-producto, .pub-buscador, .pub-texto { transition: none; } }
`
