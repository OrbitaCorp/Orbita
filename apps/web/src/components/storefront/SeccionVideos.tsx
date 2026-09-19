// Sección de video del home clásico — uno o varios videos del negocio, en
// uno de cuatro diseños que el dueño elige en Apariencia → "Video en tu
// tienda" (VIDEO_LAYOUTS en apariencia.mock.ts):
//
//   - cine:      cada video a todo el ancho, con su título y texto debajo.
//   - alternado: video de un lado y texto del otro, cambiando de lado en
//                cada fila (el formato de "producto + demostración").
//   - reels:     videos verticales (9:16) en una fila que se desliza.
//   - lista:     uno grande y al costado la lista para elegir otro.
//
// Pedido de Ale (19/09): la sección de antes era un solo reproductor negro a
// lo ancho, "muy básico". Ninguno de los cuatro carga el reproductor de
// YouTube/Vimeo de entrada: se muestra la miniatura con un botón de play, y
// el iframe recién se monta al hacer clic (cada iframe de YouTube pesa
// ~1 MB de JS; con cuatro videos eran cuatro).
//
// Qué link acepta cada video lo decide parseVideoEmbed (utils.ts): uno que no
// resuelve a nada conocido se descarta en vez de dibujar un cuadro roto.

import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Play, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { parseVideoEmbed, type VideoEmbed } from '@/lib/storefront/utils'
import type { StorefrontVideoItem, VideoLayout } from '@/lib/storefront/api'

type Video = StorefrontVideoItem & { embed: VideoEmbed }

type Props = {
  titulo: string
  subtitulo: string
  layout: VideoLayout | null | undefined
  videos: StorefrontVideoItem[] | undefined
  // El video único de antes de que existiera la lista: una tienda que nunca
  // guardó `videos` lo sigue mostrando como el único.
  videoUrlLegado: string | null | undefined
  // Navegación interna de la tienda para los botones con link relativo
  // ("/catalogo"); un link absoluto abre normal.
  go: (path: string) => void
}

export function SeccionVideos({ titulo, subtitulo, layout, videos, videoUrlLegado, go }: Props) {
  const crudos: StorefrontVideoItem[] = videos && videos.length > 0
    ? videos
    : videoUrlLegado ? [{ id: 'legado', url: videoUrlLegado }] : []
  const lista: Video[] = crudos.flatMap(v => {
    const embed = parseVideoEmbed(v.url)
    return embed ? [{ ...v, embed }] : []
  })
  if (lista.length === 0) return null

  const diseno = layout ?? 'cine'

  return (
    <section className="sf-w sf-vd" aria-labelledby={titulo ? 'sf-vd-titulo' : undefined}>
      <style>{ESTILOS}</style>
      {(titulo || subtitulo) && (
        <header className="sf-vd-head">
          {titulo && <h2 id="sf-vd-titulo" className="sf-vd-h2">{titulo}</h2>}
          {subtitulo && <p className="sf-vd-bajada">{subtitulo}</p>}
        </header>
      )}
      {diseno === 'alternado' ? <Alternado videos={lista} go={go} />
        : diseno === 'reels' ? <Reels videos={lista} go={go} />
        : diseno === 'lista' ? <ConLista videos={lista} go={go} />
        : <Cine videos={lista} go={go} />}
    </section>
  )
}

// ── Diseños ──────────────────────────────────────────────────────────────────

function Cine({ videos, go }: { videos: Video[]; go: Props['go'] }) {
  return (
    <div className="sf-vd-cine">
      {videos.map(v => (
        <article key={v.id}>
          <Reproductor video={v} className="sf-vd-marco" />
          {(v.title || v.text || v.ctaText) && (
            <div className="sf-vd-cine-pie">
              <div>
                {v.title && <h3 className="sf-vd-h3">{v.title}</h3>}
                {v.text && <p className="sf-vd-texto">{v.text}</p>}
              </div>
              <Cta video={v} go={go} />
            </div>
          )}
        </article>
      ))}
    </div>
  )
}

function Alternado({ videos, go }: { videos: Video[]; go: Props['go'] }) {
  return (
    <div className="sf-vd-alt">
      {videos.map((v, i) => (
        <article key={v.id} className={`sf-vd-alt-fila${i % 2 === 1 ? ' sf-vd-alt-fila--inv' : ''}`}>
          <Reproductor video={v} className="sf-vd-alt-video" />
          <div className="sf-vd-alt-copy">
            {v.title && <h3 className="sf-vd-alt-h3">{v.title}</h3>}
            {v.text && <p className="sf-vd-texto">{v.text}</p>}
            <Cta video={v} go={go} boton />
          </div>
        </article>
      ))}
    </div>
  )
}

function Reels({ videos, go }: { videos: Video[]; go: Props['go'] }) {
  const fila = useRef<HTMLUListElement>(null)
  // Con más de cuatro la fila se desliza. En celular alcanza con el dedo; en
  // escritorio van flechas, porque con mouse la barra de scroll horizontal
  // es incómoda (y la de Windows, fea).
  const desliza = videos.length > 4
  const mover = (d: 1 | -1) => fila.current?.scrollBy({ left: d * fila.current.clientWidth * 0.75, behavior: 'smooth' })
  return (
    <div className="sf-vd-reels-wrap">
      <ul ref={fila} className={`sf-vd-reels${desliza ? ' sf-vd-reels--fila' : ''}`}>
        {videos.map(v => (
          <li key={v.id} className="sf-vd-reel">
            <Reproductor video={v} vertical className="sf-vd-reel-video" />
            {v.title && <p className="sf-vd-reel-titulo">{v.title}</p>}
            <Cta video={v} go={go} />
          </li>
        ))}
      </ul>
      {desliza && (
        <div className="sf-vd-flechas">
          <button type="button" className="sf-vd-flecha" onClick={() => mover(-1)} aria-label="Videos anteriores"><ChevronLeft size={18} /></button>
          <button type="button" className="sf-vd-flecha" onClick={() => mover(1)} aria-label="Más videos"><ChevronRight size={18} /></button>
        </div>
      )}
    </div>
  )
}

function ConLista({ videos, go }: { videos: Video[]; go: Props['go'] }) {
  const [activo, setActivo] = useState(0)
  // Al elegir de la lista el video arranca solo: el clic ya fue el "play".
  // El primero no — nadie lo pidió todavía.
  const [elegido, setElegido] = useState(false)
  const v = videos[Math.min(activo, videos.length - 1)]
  return (
    <div className={`sf-vd-lista${videos.length === 1 ? ' sf-vd-lista--uno' : ''}`}>
      <div className="sf-vd-lista-main">
        <Reproductor key={v.id} video={v} autoplay={elegido} className="sf-vd-marco" />
        {(v.title || v.text || v.ctaText) && (
          <div className="sf-vd-cine-pie">
            <div>
              {v.title && <h3 className="sf-vd-h3">{v.title}</h3>}
              {v.text && <p className="sf-vd-texto">{v.text}</p>}
            </div>
            <Cta video={v} go={go} />
          </div>
        )}
      </div>
      {videos.length > 1 && (
        <ol className="sf-vd-lista-items">
          {videos.map((x, i) => (
            <li key={x.id}>
              <button
                type="button"
                className={`sf-vd-lista-item${i === activo ? ' sf-vd-lista-item--on' : ''}`}
                aria-current={i === activo ? 'true' : undefined}
                onClick={() => { setActivo(i); setElegido(true) }}
              >
                <span className="sf-vd-lista-thumb"><Miniatura embed={x.embed} /></span>
                <span className="sf-vd-lista-nombre">{x.title || `Video ${i + 1}`}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

// ── Piezas ───────────────────────────────────────────────────────────────────

function Cta({ video, go, boton }: { video: Video; go: Props['go']; boton?: boolean }) {
  if (!video.ctaText) return null
  const link = video.ctaLink?.trim() || '/catalogo'
  const externo = /^https?:\/\//i.test(link)
  const cls = boton ? 'sf-vd-cta sf-vd-cta--boton' : 'sf-vd-cta'
  const contenido = <>{video.ctaText} <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" /></>
  return externo
    ? <a href={link} className={cls} target="_blank" rel="noopener noreferrer">{contenido}</a>
    : <button type="button" className={cls} onClick={() => go(link)}>{contenido}</button>
}

function youtubeId(src: string): string | null {
  return src.match(/\/embed\/([A-Za-z0-9_-]{11})/)?.[1] ?? null
}

// Lo que se ve antes de reproducir: la miniatura de YouTube, el primer
// cuadro del archivo, o un fondo liso para Vimeo (su miniatura pide una API).
function Miniatura({ embed, vertical }: { embed: VideoEmbed; vertical?: boolean }) {
  const cubrir: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }
  if (embed.tipo === 'youtube') {
    const id = youtubeId(embed.src)
    // hqdefault es 4:3 con bandas negras arriba y abajo (el 16:9 va en el
    // medio). En un marco 16:9 el `cover` ya las recorta; en uno vertical
    // no, así que ahí se agranda 4/3 para sacarlas.
    return id ? <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" style={vertical ? { ...cubrir, transform: 'scale(1.34)' } : cubrir} /> : null
  }
  if (embed.tipo === 'file') {
    // #t=0.1: sin él algunos navegadores (Firefox) dejan el cuadro en negro
    // hasta reproducir — mismo criterio que VideoUploader.tsx.
    return <video src={`${embed.src}#t=0.1`} preload="metadata" muted playsInline tabIndex={-1} aria-hidden="true" style={cubrir} />
  }
  return null
}

function Reproductor({ video, vertical, autoplay = false, className }: {
  video: Video
  vertical?: boolean
  autoplay?: boolean
  className?: string
}) {
  const [jugando, setJugando] = useState(autoplay)
  const { embed } = video
  const nombre = video.title || 'Video'
  const marco: CSSProperties = { aspectRatio: vertical ? '9 / 16' : '16 / 9' }

  let contenido: ReactNode
  if (jugando) {
    contenido = embed.tipo === 'file'
      ? <video src={embed.src} controls autoPlay playsInline className="sf-vd-media" />
      : <iframe
          src={`${embed.src}?autoplay=1&rel=0`}
          title={nombre}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="sf-vd-media"
        />
  } else {
    contenido = (
      <button type="button" className="sf-vd-poster" onClick={() => setJugando(true)} aria-label={`Reproducir: ${nombre}`}>
        <Miniatura embed={embed} vertical={vertical} />
        <span className="sf-vd-play" aria-hidden="true"><Play size={vertical ? 20 : 24} fill="currentColor" strokeWidth={0} /></span>
      </button>
    )
  }
  return <div className={`sf-vd-frame ${className ?? ''}`} style={marco}>{contenido}</div>
}

const ESTILOS = `
.sf-vd { padding-top: 12px; padding-bottom: 56px; }
.sf-vd-head { max-width: 640px; margin-bottom: 24px; }
.sf-vd-h2 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; color: var(--color-text); }
.sf-vd-bajada { margin: 8px 0 0; font-size: 15px; line-height: 1.55; color: var(--color-muted); }

/* ── El marco y el póster ── */
.sf-vd-frame { position: relative; width: 100%; overflow: hidden; border-radius: 14px; background: #0b0b0c; }
.sf-vd-media { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: #000; }
.sf-vd-poster {
  position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; border: 0;
  background: #1a1a1c; cursor: pointer; display: grid; place-items: center;
}
/* Un velo apenas oscuro para que el botón se lea sobre cualquier miniatura. */
.sf-vd-poster::after { content: ""; position: absolute; inset: 0; background: rgba(0,0,0,0.18); transition: background 200ms ease; }
.sf-vd-poster:hover::after { background: rgba(0,0,0,0.08); }
.sf-vd-play {
  position: relative; z-index: 1; width: 64px; height: 64px; border-radius: 50%;
  display: grid; place-items: center; padding-left: 3px; box-sizing: border-box;
  background: rgba(255,255,255,0.94); color: #111;
  transition: transform 200ms ease;
}
.sf-vd-poster:hover .sf-vd-play { transform: scale(1.06); }
.sf-vd-poster:focus-visible { outline: 3px solid var(--color-primary); outline-offset: -3px; }
.sf-vd-reel .sf-vd-play { width: 48px; height: 48px; }

/* ── Textos comunes ── */
.sf-vd-h3 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.01em; color: var(--color-text); }
.sf-vd-texto { margin: 6px 0 0; font-size: 14.5px; line-height: 1.6; color: var(--color-muted); max-width: 62ch; white-space: pre-line; }
.sf-vd-cta {
  display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
  padding: 0; border: 0; background: none; cursor: pointer; font-family: inherit;
  font-size: 14px; font-weight: 600; color: var(--color-primary); text-decoration: none;
}
.sf-vd-cta:hover { text-decoration: underline; text-underline-offset: 3px; }
.sf-vd-cta--boton {
  margin-top: 22px; min-height: 44px; padding: 0 20px; border-radius: 10px;
  background: var(--color-primary); color: var(--color-on-primary);
}
.sf-vd-cta--boton:hover { text-decoration: none; opacity: 0.92; }
.sf-vd-cta:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }

/* ── Grande ── */
.sf-vd-cine { display: flex; flex-direction: column; gap: 44px; }
.sf-vd-cine-pie { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-top: 16px; }

/* ── Alternado ── */
.sf-vd-alt { display: flex; flex-direction: column; gap: 20px; }
.sf-vd-alt-fila {
  display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); align-items: stretch;
  border: 1px solid var(--color-border); border-radius: 16px; overflow: hidden; background: var(--color-surface);
}
.sf-vd-alt-fila--inv { grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); }
.sf-vd-alt-fila--inv .sf-vd-alt-video { order: 2; }
.sf-vd-alt-video { border-radius: 0; height: 100%; min-height: 100%; }
.sf-vd-alt-copy { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding: 40px 44px; }
.sf-vd-alt-h3 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; color: var(--color-text); }
.sf-vd-alt-copy .sf-vd-texto { margin-top: 10px; font-size: 15px; }

/* ── Verticales ── */
.sf-vd-reels { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.sf-vd-reels--fila {
  grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: calc((100% - 3 * 16px) / 4.3);
  overflow-x: auto; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; scrollbar-width: none;
}
.sf-vd-reels--fila::-webkit-scrollbar { display: none; }
.sf-vd-flechas { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.sf-vd-flecha {
  width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; cursor: pointer;
  border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text);
  transition: background 150ms ease;
}
.sf-vd-flecha:hover { background: color-mix(in srgb, var(--color-text) 6%, var(--color-surface)); }
.sf-vd-flecha:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.sf-vd-reel { min-width: 0; scroll-snap-align: start; display: flex; flex-direction: column; gap: 8px; }
.sf-vd-reel-video { border-radius: 14px; }
.sf-vd-reel-titulo { margin: 4px 0 0; font-size: 14.5px; font-weight: 600; line-height: 1.35; color: var(--color-text); }

/* ── Con lista ── */
.sf-vd-lista { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 24px; align-items: start; }
.sf-vd-lista--uno { grid-template-columns: minmax(0, 1fr); }
.sf-vd-lista-items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.sf-vd-lista-item {
  display: flex; align-items: center; gap: 14px; width: 100%; padding: 10px; border: 0; border-radius: 10px;
  background: transparent; cursor: pointer; font-family: inherit; text-align: left; color: var(--color-text);
  transition: background 150ms ease;
}
.sf-vd-lista-item:hover { background: color-mix(in srgb, var(--color-text) 5%, transparent); }
.sf-vd-lista-item--on { background: color-mix(in srgb, var(--color-text) 7%, transparent); }
.sf-vd-lista-item--on .sf-vd-lista-nombre { color: var(--color-primary); }
.sf-vd-lista-item:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
.sf-vd-lista-thumb { position: relative; flex-shrink: 0; width: 128px; aspect-ratio: 16 / 9; border-radius: 8px; overflow: hidden; background: #1a1a1c; }
.sf-vd-lista-nombre { font-size: 14px; font-weight: 600; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

@media (prefers-reduced-motion: reduce) {
  .sf-vd-play, .sf-vd-poster::after, .sf-vd-lista-item { transition: none; }
  .sf-vd-poster:hover .sf-vd-play { transform: none; }
}

@media (max-width: 1024px) {
  .sf-vd-reels { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .sf-vd-reels--fila { grid-template-columns: none; grid-auto-columns: calc((100% - 2 * 16px) / 3.3); }
  .sf-vd-alt-copy { padding: 28px; }
  .sf-vd-lista { grid-template-columns: minmax(0, 1fr); }
  .sf-vd-lista-items { flex-direction: row; overflow-x: auto; gap: 4px; scrollbar-width: none; }
  .sf-vd-lista-items li { flex: 0 0 180px; }
  .sf-vd-lista-item { flex-direction: column; align-items: stretch; gap: 8px; }
  .sf-vd-lista-thumb { width: 100%; }
}

@media (max-width: 720px) {
  .sf-vd-h2 { font-size: 22px; }
  .sf-vd-cine { gap: 32px; }
  .sf-vd-cine-pie { flex-direction: column; gap: 10px; }
  .sf-vd-alt-fila, .sf-vd-alt-fila--inv { grid-template-columns: minmax(0, 1fr); }
  .sf-vd-alt-fila--inv .sf-vd-alt-video { order: 0; }
  .sf-vd-alt-video { aspect-ratio: 16 / 9; height: auto; min-height: 0; }
  .sf-vd-alt-copy { padding: 20px 18px 22px; }
  .sf-vd-alt-h3 { font-size: 21px; }
  .sf-vd-cta--boton { width: 100%; justify-content: center; }
  .sf-vd-reels, .sf-vd-reels--fila {
    grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: 62%; gap: 12px;
    overflow-x: auto; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; scrollbar-width: none;
  }
  .sf-vd-reels::-webkit-scrollbar, .sf-vd-lista-items::-webkit-scrollbar { display: none; }
  .sf-vd-flechas { display: none; }
  .sf-vd-lista-items li { flex-basis: 150px; }
}
`
