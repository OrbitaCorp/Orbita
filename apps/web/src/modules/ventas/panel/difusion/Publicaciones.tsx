import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useRouter } from 'next/router'
import { Bookmark, Check, ChevronLeft, ChevronRight, ExternalLink, Heart, ImagePlus, MessageCircle, Play, Search, Send, Sparkles, X } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { Modal } from '@/design-system/components/Modal'
import {
  ApiError, continuarPublicacionInstagram, crearPublicacionInstagram, getInstagramPosts, panelListProducts, pedirTextoAOrbi,
  subirFotoInstagram, subirVideoInstagram,
  type ApiProductRow, type InstagramEstado, type InstagramItemPublicacion, type InstagramPublicacion, type InstagramTextoDeOrbi,
} from '@/lib/api'
import { fmtMoney } from '@/lib/utils'
import { Compuerta } from './Compuerta'
import { MAX_TEXTO_INSTAGRAM, textoSugerido } from './textoSugerido'

// Difusión → Publicaciones: subir a Instagram una foto, un carrusel (hasta 10 fotos y videos) o un video.
//
// Se puede partir de un producto (sus fotos entran solas y se pueden sacar o reordenar) o armar todo con
// archivos de la computadora; las dos cosas se mezclan. La vista previa muestra cómo queda el carrusel.
// Nada se publica sin la confirmación: es lo único de Órbita que queda a la vista de los seguidores.
// Instagram tarda en procesar los videos: después de confirmar se sigue el avance hasta que sale.

const MAX_ELEMENTOS = 10
const MAX_FOTO_BYTES = 10 * 1024 * 1024
const MAX_VIDEO_BYTES = 50 * 1024 * 1024
const FOTOS_ACEPTADAS = ['image/jpeg', 'image/png', 'image/webp']
const VIDEOS_ACEPTADOS = ['video/mp4', 'video/quicktime']
const CADA_CUANTO_MS = 3000
const ESPERA_MAXIMA_MS = 10 * 60 * 1000

interface Props {
  estado: InstagramEstado | null
  /** Abre el modal de conexión de Instagram (si todavía no está conectado). */
  onAbrirConexion: () => void
}

/** Un elemento de la bandeja: una foto del producto o un archivo de la computadora (que puede estar subiéndose). */
interface Elemento {
  clave: string
  origen: 'producto' | 'subida'
  tipo: 'image' | 'video'
  /** producto: la dirección de la foto. subida: la ruta que devolvió la subida (null mientras sube). */
  ref: string | null
  vista: string
  nombre: string
  estado: 'subiendo' | 'listo' | 'error'
  progreso: number
  error?: string
}

const fotosDe = (p: ApiProductRow): string[] => {
  const todas = p.images.length > 0 ? p.images : p.primaryImageUrl ? [p.primaryImageUrl] : []
  return Array.from(new Set(todas)).slice(0, MAX_ELEMENTOS)
}

export function Publicaciones({ estado, onAbrirConexion }: Props) {
  const { query } = useRouter()
  // Desde las ideas del tablero se llega con el producto ya elegido (?producto=ID&nombre=...).
  const inicial = typeof query.producto === 'string' ? { id: query.producto, nombre: typeof query.nombre === 'string' ? query.nombre : '' } : null
  return (
    <Compuerta estado={estado} permiso="publicar" onAbrirConexion={onAbrirConexion}>
      {(usuario) => <Compositor usuario={usuario} productoInicial={inicial} />}
    </Compuerta>
  )
}

// ─── Compositor ────────────────────────────────────────────────────────────────

type Fase = 'cerrado' | 'confirmar' | 'publicando' | 'listo' | 'fallo'

function Compositor({ usuario, productoInicial }: { usuario: string | null; productoInicial: { id: string; nombre: string } | null }) {
  const [busqueda, setBusqueda] = useState('')
  const [productos, setProductos] = useState<ApiProductRow[] | null>(null)
  const [producto, setProducto] = useState<ApiProductRow | null>(null)
  const [elementos, setElementos] = useState<Elemento[]>([])
  const [formato, setFormato] = useState<'cuadrado' | 'vertical'>('cuadrado')
  const [texto, setTexto] = useState('')
  const [fase, setFase] = useState<Fase>('cerrado')
  const [etapa, setEtapa] = useState<'preparando' | 'procesando'>('preparando')
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<InstagramPublicacion | null>(null)
  const [historial, setHistorial] = useState<InstagramPublicacion[]>([])
  const [arrastrando, setArrastrando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const montado = useRef(true)
  const sugeridoActual = useRef('')
  const entrada = useRef<HTMLInputElement>(null)
  const [idea, setIdea] = useState('')
  const [orbi, setOrbi] = useState<{ cargando: boolean; error: string | null; resultado: InstagramTextoDeOrbi | null }>({ cargando: false, error: null, resultado: null })

  useEffect(() => () => { montado.current = false }, [])

  const cargarHistorial = useCallback(() => {
    getInstagramPosts().then((h) => { if (montado.current) setHistorial(h) }).catch(() => undefined)
  }, [])
  useEffect(() => { cargarHistorial() }, [cargarHistorial])

  // Lo que quedó procesándose (por ejemplo, si se cerró la pantalla a mitad de camino) se sigue solo.
  const pendientes = historial.some((h) => h.estado === 'PROCESSING' || h.estado === 'PUBLISHING')
  useEffect(() => {
    if (!pendientes || fase === 'publicando') return
    const t = setInterval(() => {
      historial
        .filter((h) => h.estado === 'PROCESSING' || h.estado === 'PUBLISHING')
        .forEach((h) => { continuarPublicacionInstagram(h.id).then(cargarHistorial).catch(() => undefined) })
    }, 5000)
    return () => clearInterval(t)
  }, [pendientes, fase, historial, cargarHistorial])

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

  // ── Producto ───────────────────────────────────────────────────────────────

  const elegirProducto = (p: ApiProductRow) => {
    const fotos = fotosDe(p)
    setProducto(p)
    // Las fotos del producto anterior salen; lo que se subió de la computadora se queda.
    setElementos((actuales) => {
      const propios = actuales.filter((e) => e.origen === 'subida')
      const deProducto: Elemento[] = fotos.slice(0, Math.max(0, MAX_ELEMENTOS - propios.length)).map((url) => ({
        clave: `p:${url}`, origen: 'producto', tipo: 'image', ref: url, vista: url, nombre: p.name, estado: 'listo', progreso: 100,
      }))
      return [...deProducto, ...propios]
    })
    const nuevo = textoSugerido(p)
    setTexto((actual) => (actual.trim() === '' || actual === sugeridoActual.current ? nuevo : actual))
    sugeridoActual.current = nuevo
    setHecho(null); setError(null); setAviso(null)
  }

  // Llegó desde una idea del tablero: se busca ese producto por su nombre y se elige solo.
  const inicialAplicado = useRef(false)
  useEffect(() => {
    if (!productoInicial || inicialAplicado.current) return
    inicialAplicado.current = true
    panelListProducts({ search: productoInicial.nombre || undefined, status: 'PUBLISHED', limit: 24 })
      .then((r) => { const p = r.data.find((x) => x.id === productoInicial.id); if (p && montado.current) elegirProducto(p) })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoInicial])

  const escribirConOrbi = async () => {
    setOrbi((o) => ({ ...o, cargando: true, error: null }))
    try {
      const resultado = await pedirTextoAOrbi({
        productId: producto?.id,
        idea: idea.trim() || undefined,
        elementos: elementos.length || undefined,
        hayVideo: elementos.some((e) => e.tipo === 'video') || undefined,
      })
      if (montado.current) setOrbi({ cargando: false, error: null, resultado })
    } catch (e) {
      if (montado.current) setOrbi((o) => ({ ...o, cargando: false, error: e instanceof ApiError ? e.message : 'No se pudo generar con Orbi. Probá de nuevo.' }))
    }
  }
  const usarVersion = (t: string) => { sugeridoActual.current = ''; setTexto(t.slice(0, MAX_TEXTO_INSTAGRAM)) }
  const agregarHashtags = (tags: string[]) => {
    if (tags.length === 0) return
    const linea = tags.map((h) => `#${h}`).join(' ')
    setTexto((actual) => (actual.includes(`#${tags[0]}`) ? actual : `${actual.trimEnd()}${actual.trim() ? '\n\n' : ''}${linea}`.slice(0, MAX_TEXTO_INSTAGRAM)))
  }

  const quitarProducto = () => {
    setProducto(null)
    setElementos((actuales) => actuales.filter((e) => e.origen !== 'producto'))
    setTexto((actual) => (actual === sugeridoActual.current ? '' : actual))
    sugeridoActual.current = ''
  }

  const alternarFotoDeProducto = (url: string) => {
    if (!producto) return
    setElementos((actuales) => {
      if (actuales.some((e) => e.clave === `p:${url}`)) return actuales.filter((e) => e.clave !== `p:${url}`)
      if (actuales.length >= MAX_ELEMENTOS) { setAviso(`Una publicación lleva hasta ${MAX_ELEMENTOS} fotos o videos.`); return actuales }
      return [...actuales, { clave: `p:${url}`, origen: 'producto', tipo: 'image', ref: url, vista: url, nombre: producto.name, estado: 'listo', progreso: 100 }]
    })
  }

  // ── Archivos de la computadora ─────────────────────────────────────────────

  const modificar = (clave: string, cambios: Partial<Elemento>) =>
    setElementos((actuales) => actuales.map((e) => (e.clave === clave ? { ...e, ...cambios } : e)))

  const agregarArchivos = (archivos: File[]) => {
    setAviso(null); setHecho(null)
    if (archivos.length === 0) return
    const lugar = MAX_ELEMENTOS - elementos.length
    if (lugar <= 0) { setAviso(`Una publicación lleva hasta ${MAX_ELEMENTOS} fotos o videos.`); return }
    const aceptados = archivos.slice(0, lugar)
    if (archivos.length > lugar) setAviso(`Sumamos ${lugar}: una publicación lleva hasta ${MAX_ELEMENTOS} fotos o videos.`)

    for (const archivo of aceptados) {
      const esVideo = VIDEOS_ACEPTADOS.includes(archivo.type) || /\.(mp4|mov)$/i.test(archivo.name)
      const esFoto = FOTOS_ACEPTADAS.includes(archivo.type)
      const clave = `s:${crypto.randomUUID()}`
      const base = { clave, origen: 'subida' as const, nombre: archivo.name, vista: URL.createObjectURL(archivo), progreso: 0 }
      if (!esVideo && !esFoto) {
        setElementos((a) => [...a, { ...base, tipo: 'image', ref: null, estado: 'error', error: 'Subí una foto JPG, PNG o WebP, o un video MP4 o MOV.' }])
        continue
      }
      if (esFoto && archivo.size > MAX_FOTO_BYTES) {
        setElementos((a) => [...a, { ...base, tipo: 'image', ref: null, estado: 'error', error: 'La foto pesa más de 10 MB.' }])
        continue
      }
      if (esVideo && archivo.size > MAX_VIDEO_BYTES) {
        setElementos((a) => [...a, { ...base, tipo: 'video', ref: null, estado: 'error', error: 'El video pesa más de 50 MB.' }])
        continue
      }
      const tipo = esVideo ? 'video' : 'image'
      setElementos((a) => [...a, { ...base, tipo, ref: null, estado: 'subiendo' }])
      const subida = esVideo
        ? subirVideoInstagram(archivo, (p) => { if (montado.current) modificar(clave, { progreso: p }) })
        : subirFotoInstagram(archivo)
      subida
        .then((r) => { if (montado.current) modificar(clave, { ref: r.ref, estado: 'listo', progreso: 100 }) })
        .catch((e) => { if (montado.current) modificar(clave, { estado: 'error', error: e instanceof ApiError ? e.message : 'No se pudo subir el archivo.' }) })
    }
  }

  const alElegir = (e: ChangeEvent<HTMLInputElement>) => {
    agregarArchivos(Array.from(e.target.files ?? []))
    e.target.value = ''
  }
  const alSoltar = (e: DragEvent) => {
    e.preventDefault(); setArrastrando(false)
    agregarArchivos(Array.from(e.dataTransfer.files))
  }

  const sacar = (clave: string) => {
    setElementos((actuales) => {
      const e = actuales.find((x) => x.clave === clave)
      if (e?.origen === 'subida') URL.revokeObjectURL(e.vista)
      return actuales.filter((x) => x.clave !== clave)
    })
    setAviso(null)
  }
  const mover = (clave: string, delta: -1 | 1) => {
    setElementos((actuales) => {
      const i = actuales.findIndex((x) => x.clave === clave)
      const j = i + delta
      if (i < 0 || j < 0 || j >= actuales.length) return actuales
      const copia = [...actuales]
      ;[copia[i], copia[j]] = [copia[j], copia[i]]
      return copia
    })
  }

  // ── Publicar ───────────────────────────────────────────────────────────────

  const subiendo = elementos.some((e) => e.estado === 'subiendo')
  const conError = elementos.some((e) => e.estado === 'error')
  const largo = texto.length
  const puedePublicar = elementos.length > 0 && !subiendo && !conError && largo <= MAX_TEXTO_INSTAGRAM
  const cantidadVideos = elementos.filter((e) => e.tipo === 'video').length
  const tipoDeLaPublicacion = elementos.length > 1 ? `carrusel de ${elementos.length}` : cantidadVideos === 1 ? 'reel' : 'foto'

  const publicar = async () => {
    if (!puedePublicar) return
    setFase('publicando'); setEtapa('preparando'); setError(null)
    try {
      const items: InstagramItemPublicacion[] = elementos.map((e) => ({ origen: e.origen, ref: e.ref as string, tipo: e.tipo }))
      let post = await crearPublicacionInstagram({ productId: producto?.id, caption: texto.trim(), formato, items })
      setEtapa('procesando')
      const limite = Date.now() + ESPERA_MAXIMA_MS
      while ((post.estado === 'PROCESSING' || post.estado === 'PUBLISHING') && Date.now() < limite && montado.current) {
        await new Promise((r) => setTimeout(r, CADA_CUANTO_MS))
        post = await continuarPublicacionInstagram(post.id)
      }
      if (!montado.current) return
      if (post.estado === 'PUBLISHED') {
        setHecho(post)
        setFase('listo')
        elementos.forEach((e) => { if (e.origen === 'subida') URL.revokeObjectURL(e.vista) })
        setElementos([]); setProducto(null); setTexto(''); sugeridoActual.current = ''
      } else {
        setError(post.error ?? 'Instagram tardó más de lo esperado. Revisá el historial en unos minutos.')
        setFase('fallo')
      }
      cargarHistorial()
    } catch (e) {
      if (!montado.current) return
      setError(e instanceof ApiError ? e.message : 'No se pudo publicar. Probá de nuevo en un momento.')
      setFase('fallo')
      cargarHistorial()
    }
  }

  const cerrar = () => { if (fase !== 'publicando') setFase('cerrado') }
  const fotosDelProducto = producto ? fotosDe(producto) : []

  return (
    <div className="pub-raiz">
      <style>{CSS}</style>

      {hecho && (
        <section className="pub-tarjeta pub-exito" role="status">
          <span className="pub-exito-icono" aria-hidden><Check size={18} strokeWidth={3} /></span>
          <div>
            <p className="pub-exito-titulo">Publicado en Instagram</p>
            <p className="pub-suave" style={{ margin: 0 }}>
              {hecho.productName ?? 'Tu publicación'} ya está en tu perfil.{' '}
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
            <h2 className="pub-paso"><span className="pub-num">1</span> Qué vas a publicar</h2>

            {producto ? (
              <div className="pub-producto-elegido">
                <span className="pub-miniatura">{fotosDelProducto[0] ? <img src={fotosDelProducto[0]} alt="" /> : null}</span>
                <span className="pub-producto-texto">
                  <span className="pub-producto-nombre">{producto.name}</span>
                  <span className="pub-producto-sub">{fotosDelProducto.length} {fotosDelProducto.length === 1 ? 'foto' : 'fotos'} en el catálogo</span>
                </span>
                <button type="button" className="pub-enlace-boton" onClick={quitarProducto}>Quitar</button>
              </div>
            ) : (
              <>
                <p className="pub-etiqueta">Partir de un producto <span className="pub-opcional">(opcional)</span></p>
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
                    const fotos = fotosDe(p)
                    return (
                      <li key={p.id}>
                        <button type="button" className="pub-producto" disabled={fotos.length === 0} onClick={() => elegirProducto(p)}>
                          <span className="pub-miniatura">{fotos[0] ? <img src={fotos[0]} alt="" /> : null}</span>
                          <span className="pub-producto-texto">
                            <span className="pub-producto-nombre">{p.name}</span>
                            <span className="pub-producto-sub">
                              {fotos.length === 0 ? 'Sin foto: cargale una para poder publicarlo' : `${fmtMoney(p.basePrice)} · ${fotos.length} ${fotos.length === 1 ? 'foto' : 'fotos'}`}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}

            {producto && fotosDelProducto.length > 1 && (
              <>
                <p className="pub-etiqueta" style={{ marginTop: 16 }}>Fotos del producto</p>
                <div className="pub-fotos-producto">
                  {fotosDelProducto.map((url) => {
                    const puesta = elementos.some((e) => e.clave === `p:${url}`)
                    return (
                      <button
                        key={url}
                        type="button"
                        className={`pub-foto-opcion${puesta ? ' pub-foto-opcion-activa' : ''}`}
                        aria-pressed={puesta}
                        aria-label={puesta ? 'Sacar esta foto de la publicación' : 'Sumar esta foto a la publicación'}
                        onClick={() => alternarFotoDeProducto(url)}
                      >
                        <img src={url} alt="" />
                        {puesta && <span className="pub-foto-tilde" aria-hidden><Check size={12} strokeWidth={3} /></span>}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            <p className="pub-etiqueta" style={{ marginTop: 16 }}>
              Tu publicación <span className="pub-opcional">({elementos.length} de {MAX_ELEMENTOS})</span>
            </p>
            <div
              className={`pub-zona${arrastrando ? ' pub-zona-activa' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={alSoltar}
            >
              {elementos.length > 0 && (
                <ol className="pub-bandeja">
                  {elementos.map((e, i) => (
                    <li key={e.clave} className={`pub-item${e.estado === 'error' ? ' pub-item-error' : ''}`}>
                      <div className="pub-item-vista">
                        {e.tipo === 'video'
                          ? <video src={e.vista} muted preload="metadata" />
                          : <img src={e.vista} alt={`Elemento ${i + 1}`} />}
                        {e.tipo === 'video' && <span className="pub-item-video" aria-hidden><Play size={12} fill="currentColor" /></span>}
                        <span className="pub-item-orden" aria-hidden>{i + 1}</span>
                        {e.estado === 'subiendo' && (
                          <span className="pub-item-subiendo" role="status">
                            <span className="pub-barra"><span style={{ width: `${e.tipo === 'video' ? e.progreso : 60}%` }} /></span>
                            <span>{e.tipo === 'video' ? `${e.progreso}%` : 'Subiendo'}</span>
                          </span>
                        )}
                        <button type="button" className="pub-item-sacar" aria-label={`Sacar el elemento ${i + 1}`} onClick={() => sacar(e.clave)}><X size={13} strokeWidth={2.5} /></button>
                        <span className="pub-item-mover">
                          <button type="button" aria-label="Mover antes" disabled={i === 0} onClick={() => mover(e.clave, -1)}><ChevronLeft size={14} /></button>
                          <button type="button" aria-label="Mover después" disabled={i === elementos.length - 1} onClick={() => mover(e.clave, 1)}><ChevronRight size={14} /></button>
                        </span>
                      </div>
                      {e.estado === 'error' && <p className="pub-item-msg" role="alert">{e.error}</p>}
                    </li>
                  ))}
                  {elementos.length < MAX_ELEMENTOS && (
                    <li>
                      <button type="button" className="pub-agregar" onClick={() => entrada.current?.click()} aria-label="Sumar fotos o videos">
                        <ImagePlus size={20} strokeWidth={1.8} aria-hidden />
                      </button>
                    </li>
                  )}
                </ol>
              )}
              {elementos.length === 0 && (
                <button type="button" className="pub-soltar" onClick={() => entrada.current?.click()}>
                  <ImagePlus size={26} strokeWidth={1.6} aria-hidden />
                  <span className="pub-soltar-titulo">Subí fotos o videos de tu computadora</span>
                  <span className="pub-suave" style={{ margin: 0 }}>Arrastralos acá o hacé clic. Fotos JPG, PNG o WebP (hasta 10 MB) y videos MP4 o MOV (hasta 50 MB).</span>
                </button>
              )}
            </div>
            <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" multiple hidden onChange={alElegir} />
            {aviso && <p className="pub-error" role="alert" style={{ marginTop: 8 }}>{aviso}</p>}
            {elementos.length > 1 && <p className="pub-suave" style={{ margin: '10px 0 0' }}>El primero es la portada. Podés cambiar el orden con las flechas.</p>}
            {elementos.length === 1 && cantidadVideos === 1 && (
              <p className="pub-suave" style={{ margin: '10px 0 0' }}>Un video solo se publica como reel (formato vertical). Para un video dentro de un carrusel, sumá al menos otro archivo.</p>
            )}
          </section>

          <section className="pub-tarjeta">
            <div className="pub-paso-fila">
              <h2 className="pub-paso"><span className="pub-num">2</span> Escribí el texto</h2>
              {producto && (
                <button type="button" className="pub-enlace-boton" onClick={() => {
                  const s = textoSugerido(producto)
                  sugeridoActual.current = s
                  setTexto(s)
                }}>
                  Volver al sugerido
                </button>
              )}
            </div>
            <div className="pub-orbi">
              <div className="pub-orbi-fila">
                <input
                  className="pub-orbi-idea"
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  maxLength={600}
                  placeholder="Contale a Orbi qué querés comunicar (opcional)"
                  aria-label="Qué querés comunicar"
                />
                <Button variant="secondary" size="md" loading={orbi.cargando} onClick={escribirConOrbi} icon={<Sparkles size={14} aria-hidden />}>
                  {orbi.resultado ? 'Otras versiones' : 'Escribir con Orbi'}
                </Button>
              </div>
              {orbi.error && <p className="pub-error" role="alert" style={{ margin: '8px 0 0' }}>{orbi.error}</p>}
              {orbi.resultado && (
                <div className="pub-versiones" aria-live="polite">
                  {orbi.resultado.versiones.map((v) => (
                    <article key={v.estilo} className="pub-version">
                      <p className="pub-version-estilo">{v.estilo === 'cercano' ? 'Cercano' : v.estilo === 'vendedor' ? 'Vendedor' : 'Breve'}</p>
                      <p className="pub-version-texto">{v.texto}</p>
                      <button type="button" className="pub-enlace-boton" onClick={() => usarVersion(v.texto)}>Usar este texto</button>
                    </article>
                  ))}
                  {orbi.resultado.hashtags.length > 0 && (
                    <div className="pub-hashtags">
                      <p className="pub-version-texto">{orbi.resultado.hashtags.map((h) => `#${h}`).join(' ')}</p>
                      <button type="button" className="pub-enlace-boton" onClick={() => agregarHashtags(orbi.resultado?.hashtags ?? [])}>Agregar al final del texto</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <textarea
              className="pub-texto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Contá de qué trata la publicación. Podés dejarlo vacío."
              rows={8}
              aria-label="Texto de la publicación"
            />
            <p className={`pub-contador${largo > MAX_TEXTO_INSTAGRAM ? ' pub-contador-excedido' : ''}`}>{largo} / {MAX_TEXTO_INSTAGRAM}</p>
            <p className="pub-suave" style={{ margin: '4px 0 0' }}>
              Instagram no convierte los enlaces del texto en botones: quien lo vea tiene que copiarlo o ir al link de tu perfil.
            </p>
          </section>

          <div className="pub-publicar">
            <Button size="lg" disabled={!puedePublicar} onClick={() => { setError(null); setFase('confirmar') }}>
              Publicar en Instagram
            </Button>
          </div>
        </div>

        <aside className="pub-columna pub-lateral" aria-label="Vista previa">
          <VistaPrevia usuario={usuario} elementos={elementos} texto={texto} formato={formato} onFormato={setFormato} />
        </aside>
      </div>

      {historial.length > 0 && (
        <section className="pub-historial">
          <h2 className="pub-historial-titulo">Publicado desde Órbita</h2>
          <ul className="pub-historial-lista">
            {historial.map((h) => <FilaDeHistorial key={h.id} h={h} />)}
          </ul>
        </section>
      )}

      <Modal
        isOpen={fase !== 'cerrado'}
        onClose={cerrar}
        dismissable={fase !== 'publicando'}
        title={fase === 'publicando' ? 'Publicando en Instagram' : fase === 'fallo' ? 'No se pudo publicar' : fase === 'listo' ? 'Publicado' : '¿Publicar ahora en Instagram?'}
        maxWidth={440}
        footer={fase === 'confirmar' ? (
          <>
            <Button variant="secondary" onClick={cerrar}>Cancelar</Button>
            <Button onClick={publicar}>Publicar</Button>
          </>
        ) : fase === 'fallo' ? (
          <Button variant="secondary" onClick={cerrar}>Entendido</Button>
        ) : fase === 'listo' ? (
          <Button onClick={cerrar}>Listo</Button>
        ) : undefined}
      >
        {fase === 'confirmar' && (
          <p className="pub-suave" style={{ margin: 0 }}>
            Se va a subir un <strong>{tipoDeLaPublicacion}</strong> a tu Instagram{usuario ? ` (@${usuario})` : ''}
            {texto.trim() ? ' con el texto que escribiste' : ' sin texto'}. Tus seguidores lo van a ver enseguida.
          </p>
        )}
        {fase === 'publicando' && (
          <ol className="pub-pasos" aria-live="polite">
            <li className="pub-paso-listo"><Check size={14} strokeWidth={3} aria-hidden /> Archivos subidos</li>
            <li className={etapa === 'preparando' ? 'pub-paso-actual' : 'pub-paso-listo'}>
              {etapa === 'preparando' ? <span className="pub-giro" aria-hidden /> : <Check size={14} strokeWidth={3} aria-hidden />} Preparando las fotos para Instagram
            </li>
            <li className={etapa === 'procesando' ? 'pub-paso-actual' : 'pub-paso-espera'}>
              {etapa === 'procesando' ? <span className="pub-giro" aria-hidden /> : <span className="pub-punto" aria-hidden />}
              Instagram está procesando{cantidadVideos > 0 ? ' (los videos pueden tardar unos minutos)' : ''}
            </li>
          </ol>
        )}
        {fase === 'listo' && <p className="pub-suave" style={{ margin: 0 }}>Tu publicación ya está en Instagram.</p>}
        {fase === 'fallo' && <p className="pub-error" role="alert" style={{ margin: 0 }}>{error}</p>}
      </Modal>
    </div>
  )
}

// ─── Historial ─────────────────────────────────────────────────────────────────

function nombreDelTipo(h: InstagramPublicacion): string {
  if (h.elementos.length > 1) return `Carrusel de ${h.elementos.length}`
  return h.elementos[0] === 'video' ? 'Reel' : 'Foto'
}

function FilaDeHistorial({ h }: { h: InstagramPublicacion }) {
  const titulo = h.productName ?? (h.caption.split('\n')[0].slice(0, 60) || 'Publicación sin texto')
  return (
    <li className="pub-tarjeta pub-fila">
      <span className="pub-miniatura">{h.miniatura ? <img src={h.miniatura} alt="" /> : <Play size={16} aria-hidden style={{ margin: 'auto', color: 'var(--color-muted)' }} />}</span>
      <div className="pub-fila-texto">
        <p className="pub-producto-nombre">{titulo}</p>
        <p className="pub-producto-sub">
          {nombreDelTipo(h)} · {new Date(h.createdAt).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
        {h.estado === 'FAILED' && h.error && <p className="pub-error" style={{ margin: '4px 0 0' }}>{h.error}</p>}
      </div>
      {h.estado === 'PUBLISHED' && h.permalink && (
        <a className="pub-enlace" href={h.permalink} target="_blank" rel="noopener noreferrer">
          Ver en Instagram <ExternalLink size={13} aria-hidden />
        </a>
      )}
      {(h.estado === 'PROCESSING' || h.estado === 'PUBLISHING') && <span className="pub-estado">Procesando…</span>}
      {h.estado === 'FAILED' && <span className="pub-estado pub-estado-fallo">No salió</span>}
    </li>
  )
}

// ─── Vista previa estilo Instagram ─────────────────────────────────────────────

interface PreviaProps {
  usuario: string | null
  elementos: Elemento[]
  texto: string
  formato: 'cuadrado' | 'vertical'
  onFormato: (f: 'cuadrado' | 'vertical') => void
}

function VistaPrevia({ usuario, elementos, texto, formato, onFormato }: PreviaProps) {
  const nombre = usuario ?? 'tu_cuenta'
  const [indice, setIndice] = useState(0)
  const actual = Math.min(indice, Math.max(0, elementos.length - 1))
  const el = elementos[actual]
  const soloVideo = elementos.length === 1 && el?.tipo === 'video'

  return (
    <div className="pub-previa">
      <div className="pub-formato" role="group" aria-label="Formato de las fotos">
        <button type="button" aria-pressed={formato === 'cuadrado'} className={formato === 'cuadrado' ? 'pub-formato-activo' : ''} onClick={() => onFormato('cuadrado')}>Cuadrado</button>
        <button type="button" aria-pressed={formato === 'vertical'} className={formato === 'vertical' ? 'pub-formato-activo' : ''} onClick={() => onFormato('vertical')}>Vertical</button>
      </div>
      <figure className="pub-ig">
        <figcaption className="pub-ig-cabecera">
          <span className="pub-ig-avatar" aria-hidden>{nombre.charAt(0).toUpperCase()}</span>
          <span className="pub-ig-usuario">{nombre}</span>
        </figcaption>
        <div className={`pub-ig-foto${formato === 'vertical' && !soloVideo ? ' pub-ig-vertical' : ''}${soloVideo ? ' pub-ig-reel' : ''}`}>
          {el ? (
            el.tipo === 'video'
              ? <video key={el.clave} src={el.vista} controls muted playsInline />
              : <img src={el.vista} alt="Vista previa" />
          ) : <span className="pub-ig-sinfoto">Lo que subas aparece acá</span>}
          {elementos.length > 1 && (
            <>
              <span className="pub-ig-contador" aria-hidden>{actual + 1}/{elementos.length}</span>
              {actual > 0 && <button type="button" className="pub-ig-flecha pub-ig-flecha-izq" aria-label="Anterior" onClick={() => setIndice(actual - 1)}><ChevronLeft size={16} /></button>}
              {actual < elementos.length - 1 && <button type="button" className="pub-ig-flecha pub-ig-flecha-der" aria-label="Siguiente" onClick={() => setIndice(actual + 1)}><ChevronRight size={16} /></button>}
            </>
          )}
        </div>
        <div className="pub-ig-acciones" aria-hidden>
          <Heart size={20} strokeWidth={1.8} /><MessageCircle size={20} strokeWidth={1.8} /><Send size={20} strokeWidth={1.8} />
          {elementos.length > 1 && (
            <span className="pub-ig-puntos">
              {elementos.map((e, i) => <span key={e.clave} className={i === actual ? 'pub-ig-punto-activo' : ''} />)}
            </span>
          )}
          <Bookmark size={20} strokeWidth={1.8} style={{ marginLeft: elementos.length > 1 ? 0 : 'auto' }} className="pub-ig-guardar" />
        </div>
        <p className="pub-ig-texto">
          <strong>{nombre}</strong> {texto ? texto : <span className="pub-ig-placeholder">El texto que escribas aparece acá.</span>}
        </p>
      </figure>
    </div>
  )
}

// ─── Estilos ───────────────────────────────────────────────────────────────────

const CSS = `
.pub-raiz { display: flex; flex-direction: column; gap: 16px; margin-top: 16px; }
.pub-tarjeta { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; box-shadow: var(--shadow-card); padding: 20px; }
.pub-suave { margin: 0 0 12px; font-size: 13px; line-height: 1.55; color: var(--color-muted); }
.pub-error { margin: 0 0 12px; font-size: 12.5px; line-height: 1.4; color: var(--color-error); }
.pub-etiqueta { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: var(--color-text); }
.pub-opcional { font-weight: 400; color: var(--color-muted); }

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

.pub-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto; }
.pub-vacio { padding: 18px 8px; text-align: center; font-size: 13px; color: var(--color-muted); }
.pub-producto { width: 100%; display: flex; align-items: center; gap: 12px; padding: 8px 10px; border: 1px solid transparent; border-radius: 12px; background: transparent; cursor: pointer; font: inherit; text-align: left; transition: background-color 150ms, border-color 150ms; }
.pub-producto:hover:not(:disabled) { background: var(--color-surface-alt); }
.pub-producto:disabled { opacity: 0.55; cursor: not-allowed; }
.pub-producto:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.pub-producto-elegido { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface-alt); }
.pub-miniatura { width: 46px; height: 46px; flex-shrink: 0; overflow: hidden; border-radius: 10px; border: 1px solid var(--color-border); background: #fff; display: inline-flex; }
.pub-miniatura img { width: 100%; height: 100%; object-fit: contain; }
.pub-producto-texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pub-producto-nombre { margin: 0; font-size: 14px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pub-producto-sub { margin: 0; font-size: 12.5px; color: var(--color-muted); }

.pub-fotos-producto { display: flex; flex-wrap: wrap; gap: 8px; }
.pub-foto-opcion { position: relative; width: 56px; height: 56px; padding: 0; overflow: hidden; border-radius: 10px; border: 2px solid var(--color-border); background: #fff; cursor: pointer; opacity: 0.6; transition: opacity 150ms, border-color 150ms; }
.pub-foto-opcion img { width: 100%; height: 100%; object-fit: contain; }
.pub-foto-opcion-activa { border-color: var(--color-primary); opacity: 1; }
.pub-foto-opcion:hover { opacity: 1; }
.pub-foto-opcion:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.pub-foto-tilde { position: absolute; top: 3px; right: 3px; width: 17px; height: 17px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; background: var(--color-primary); }

.pub-zona { border-radius: 14px; transition: background-color 150ms, outline-color 150ms; outline: 2px dashed transparent; outline-offset: 4px; }
.pub-zona-activa { background: var(--color-primary-bg); outline-color: var(--color-primary); }
.pub-soltar { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 28px 20px; border: 1.5px dashed var(--color-border); border-radius: 14px; background: var(--color-surface-alt); cursor: pointer; font: inherit; text-align: center; color: var(--color-muted); transition: border-color 150ms, background-color 150ms; }
.pub-soltar:hover { border-color: var(--color-primary); background: var(--color-primary-bg); }
.pub-soltar:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.pub-soltar-titulo { font-size: 14px; font-weight: 600; color: var(--color-text); }

.pub-bandeja { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 10px; }
.pub-item { min-width: 0; }
.pub-item-vista { position: relative; aspect-ratio: 1; overflow: hidden; border-radius: 12px; border: 1px solid var(--color-border); background: #fff; }
.pub-item-vista img, .pub-item-vista video { width: 100%; height: 100%; object-fit: contain; display: block; }
.pub-item-vista video { background: #000; }
.pub-item-error .pub-item-vista { border-color: var(--color-error); }
.pub-item-orden { position: absolute; left: 6px; top: 6px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; background: rgba(0,0,0,0.6); }
.pub-item-video { position: absolute; left: 6px; bottom: 6px; width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; background: rgba(0,0,0,0.6); }
.pub-item-sacar { position: absolute; right: 5px; top: 5px; width: 22px; height: 22px; padding: 0; border: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: #fff; background: rgba(0,0,0,0.6); }
.pub-item-sacar:hover { background: rgba(0,0,0,0.8); }
.pub-item-mover { position: absolute; right: 5px; bottom: 5px; display: inline-flex; gap: 3px; opacity: 0; transition: opacity 150ms; }
.pub-item-vista:hover .pub-item-mover, .pub-item-vista:focus-within .pub-item-mover { opacity: 1; }
.pub-item-mover button { width: 22px; height: 22px; padding: 0; border: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: #fff; background: rgba(0,0,0,0.6); }
.pub-item-mover button:disabled { opacity: 0.35; cursor: default; }
.pub-item-subiendo { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 11.5px; font-weight: 600; color: #fff; background: rgba(0,0,0,0.5); }
.pub-barra { width: 60%; height: 4px; border-radius: 2px; overflow: hidden; background: rgba(255,255,255,0.3); }
.pub-barra span { display: block; height: 100%; background: #fff; transition: width 200ms; }
.pub-item-msg { margin: 4px 0 0; font-size: 11.5px; line-height: 1.35; color: var(--color-error); }
.pub-agregar { width: 100%; aspect-ratio: 1; border: 1.5px dashed var(--color-border); border-radius: 12px; background: transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: var(--color-muted); transition: border-color 150ms, color 150ms; }
.pub-agregar:hover { border-color: var(--color-primary); color: var(--color-primary); }
.pub-agregar:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

.pub-orbi { margin-bottom: 14px; }
.pub-orbi-fila { display: flex; gap: 8px; align-items: center; }
.pub-orbi-idea { flex: 1; min-width: 0; height: 40px; padding: 0 12px; box-sizing: border-box; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface-alt); font: inherit; font-size: 16px; color: var(--color-text); outline: none; transition: border-color 150ms, box-shadow 150ms, background-color 150ms; }
.pub-orbi-idea:focus { border-color: var(--color-primary); background: var(--color-surface); box-shadow: 0 0 0 3px var(--color-primary-bg); }
.pub-versiones { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.pub-version, .pub-hashtags { padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface-alt); }
.pub-version-estilo { margin: 0 0 4px; font-size: 12px; font-weight: 600; color: var(--color-muted); }
.pub-version-texto { margin: 0 0 6px; font-size: 13.5px; line-height: 1.5; color: var(--color-text); white-space: pre-wrap; overflow-wrap: anywhere; }
.pub-texto { width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface-alt); font: inherit; font-size: 16px; line-height: 1.5; color: var(--color-text); resize: vertical; outline: none; transition: border-color 150ms, box-shadow 150ms, background-color 150ms; }
.pub-texto:focus { border-color: var(--color-primary); background: var(--color-surface); box-shadow: 0 0 0 3px var(--color-primary-bg); }
.pub-contador { margin: 6px 0 0; text-align: right; font-size: 12px; color: var(--color-muted); }
.pub-contador-excedido { color: var(--color-error); font-weight: 600; }
.pub-enlace-boton { border: none; background: transparent; padding: 0; cursor: pointer; font: inherit; font-size: 12.5px; color: var(--color-primary); }
.pub-enlace-boton:hover { text-decoration: underline; text-underline-offset: 3px; }
.pub-enlace { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 500; color: var(--color-primary); text-decoration: none; }
.pub-enlace:hover { text-decoration: underline; text-underline-offset: 3px; }
.pub-publicar { display: flex; justify-content: flex-end; }
.pub-publicar button { min-width: 240px; justify-content: center; }

.pub-formato { display: inline-flex; align-self: center; padding: 3px; margin-bottom: 12px; border-radius: 10px; background: var(--color-surface-alt); border: 1px solid var(--color-border); }
.pub-formato button { height: 28px; padding: 0 14px; border: none; border-radius: 8px; background: transparent; cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 500; color: var(--color-muted); }
.pub-formato .pub-formato-activo { background: var(--color-surface); color: var(--color-text); box-shadow: var(--shadow-card); }
.pub-previa { display: flex; flex-direction: column; }

.pub-ig { margin: 0; overflow: hidden; border-radius: 16px; border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card); }
.pub-ig-cabecera { display: flex; align-items: center; gap: 10px; padding: 12px 14px; }
.pub-ig-avatar { width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(45deg, #f09433, #dc2743 55%, #bc1888); }
.pub-ig-usuario { font-size: 13.5px; font-weight: 600; color: var(--color-text); }
.pub-ig-foto { position: relative; aspect-ratio: 1; background: #fff; display: flex; align-items: center; justify-content: center; border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); }
.pub-ig-vertical { aspect-ratio: 4 / 5; }
.pub-ig-reel { aspect-ratio: 9 / 16; background: #000; }
.pub-ig-foto img, .pub-ig-foto video { width: 100%; height: 100%; object-fit: contain; }
.pub-ig-foto video { background: #000; }
.pub-ig-sinfoto { padding: 16px; text-align: center; font-size: 12.5px; color: #8a94a6; }
.pub-ig-contador { position: absolute; right: 10px; top: 10px; padding: 3px 9px; border-radius: 12px; font-size: 11.5px; font-weight: 600; color: #fff; background: rgba(0,0,0,0.6); }
.pub-ig-flecha { position: absolute; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; padding: 0; border: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: #111; background: rgba(255,255,255,0.9); box-shadow: 0 1px 4px rgba(0,0,0,0.25); }
.pub-ig-flecha-izq { left: 8px; }
.pub-ig-flecha-der { right: 8px; }
.pub-ig-acciones { display: flex; align-items: center; gap: 14px; padding: 10px 14px 4px; color: var(--color-text); }
.pub-ig-guardar { margin-left: auto; }
.pub-ig-puntos { flex: 1; display: inline-flex; justify-content: center; gap: 4px; }
.pub-ig-puntos span { width: 6px; height: 6px; border-radius: 50%; background: var(--color-border); }
.pub-ig-puntos .pub-ig-punto-activo { background: var(--color-primary); }
.pub-ig-texto { margin: 0; padding: 4px 14px 14px; font-size: 13.5px; line-height: 1.45; color: var(--color-text); white-space: pre-wrap; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
.pub-ig-placeholder { color: var(--color-muted); }

.pub-historial-titulo { margin: 8px 0 12px; font-size: 15px; font-weight: 600; color: var(--color-text); }
.pub-historial-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.pub-fila { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
.pub-fila-texto { flex: 1; min-width: 0; }
.pub-estado { flex-shrink: 0; font-size: 12.5px; color: var(--color-muted); }
.pub-estado-fallo { color: var(--color-error); }

.pub-pasos { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; font-size: 14px; }
.pub-pasos li { display: flex; align-items: center; gap: 10px; }
.pub-paso-listo { color: var(--color-text); }
.pub-paso-listo svg { color: var(--color-success); }
.pub-paso-actual { color: var(--color-text); font-weight: 600; }
.pub-paso-espera { color: var(--color-muted); }
.pub-punto { width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center; }
.pub-punto::after { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--color-border); }
.pub-giro { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--color-border); border-top-color: var(--color-primary); animation: pub-giro 0.8s linear infinite; }
@keyframes pub-giro { to { transform: rotate(360deg); } }

@media (max-width: 560px) { .pub-orbi-fila { flex-direction: column; align-items: stretch; } }
@media (max-width: 860px) {
  .pub-grilla { grid-template-columns: minmax(0, 1fr); }
  .pub-lateral { position: static; order: -1; }
  .pub-publicar { justify-content: stretch; }
  .pub-publicar button { width: 100%; height: 48px; }
  .pub-item-mover { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) { .pub-producto, .pub-buscador, .pub-texto, .pub-barra span, .pub-zona { transition: none; } .pub-giro { animation: none; } }
`
