// «Ver tutorial» en la cabecera del alta: abre el video de YouTube "Cómo crear tu espacio" en una ventana encima del
// asistente, sin salir de la página (lo cargado sigue ahí al cerrarla).
//
// El panel trae sus videos de la API (panel/ayuda/videos.ts), pero ese pedido necesita una sesión de la tienda y acá
// todavía no hay cuenta: el id va fijo. Mientras esté vacío (el video todavía no se subió) el botón no se muestra.
import { useEffect, useRef, useState } from 'react'
import { PlayCircle, X } from 'lucide-react'

/** Id de 11 caracteres del video en YouTube (el que va después de `v=`). Vacío = el botón no aparece. */
export const VIDEO_TUTORIAL_ALTA = 'VLpCXDsma94'
const TITULO = 'Cómo crear tu espacio en Órbita'

export function BotonTutorialAlta({ videoId = VIDEO_TUTORIAL_ALTA }: { videoId?: string }) {
  const [abierto, setAbierto] = useState(false)
  const boton = useRef<HTMLButtonElement>(null)
  const cerrar = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!abierto) return
    cerrar.current?.focus()
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    window.addEventListener('keydown', alTeclear)
    const disparador = boton.current
    return () => { window.removeEventListener('keydown', alTeclear); disparador?.focus() }
  }, [abierto])

  if (!/^[\w-]{11}$/.test(videoId)) return null

  return (
    <>
      <style>{CSS_TUTORIAL_ALTA}</style>
      <button ref={boton} type="button" className="tuob-tutorial" onClick={() => setAbierto(true)} aria-haspopup="dialog">
        <PlayCircle size={17} strokeWidth={1.8} aria-hidden /> Ver tutorial
      </button>
      {abierto && (
        <div className="tuob-tut-velo" onClick={() => setAbierto(false)}>
          <div className="tuob-tut-tarjeta" role="dialog" aria-modal="true" aria-label={TITULO} onClick={e => e.stopPropagation()}>
            <div className="tuob-tut-cab">
              <h2 className="tuob-tut-titulo">{TITULO}</h2>
              <button ref={cerrar} type="button" className="tuob-tut-cerrar" onClick={() => setAbierto(false)} aria-label="Cerrar el tutorial">
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div className="tuob-tut-marco">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                title={TITULO}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <p className="tuob-tut-pie">Lo que ya cargaste queda guardado: cerrá el video y seguí donde estabas.</p>
          </div>
        </div>
      )}
    </>
  )
}

const CSS_TUTORIAL_ALTA = `
  .tuob-tutorial {
    position: absolute; right: 24px; top: 22px; z-index: 2;
    display: inline-flex; align-items: center; gap: 8px; min-height: 44px; margin: -6px 0; padding: 0 16px;
    border: 1px solid rgba(255,255,255,0.14); border-radius: 999px; background: rgba(255,255,255,0.04);
    color: var(--color-text); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
    transition: background-color 160ms ease, border-color 160ms ease;
  }
  .tuob-tutorial:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.24); }
  .tuob-tutorial:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
  .tuob-tut-velo {
    position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 16px;
    background: rgba(2,4,10,0.78); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  }
  .tuob-tut-tarjeta {
    width: 100%; max-width: 920px; padding: 16px 18px 18px; border-radius: 20px;
    background: #0b111d; border: 1px solid rgba(255,255,255,0.10); box-shadow: 0 30px 90px rgba(0,0,0,0.55);
  }
  .tuob-tut-cab { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .tuob-tut-titulo { margin: 0; font-family: var(--tuo-fh); font-size: 17px; font-weight: 700; letter-spacing: -0.02em; color: var(--color-text); }
  .tuob-tut-cerrar {
    flex-shrink: 0; width: 44px; height: 44px; display: grid; place-items: center; border: none; border-radius: 12px;
    background: none; color: var(--color-muted); cursor: pointer; transition: background-color 150ms ease, color 150ms ease;
  }
  .tuob-tut-cerrar:hover { background: rgba(255,255,255,0.07); color: var(--color-text); }
  .tuob-tut-cerrar:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .tuob-tut-marco { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: 12px; overflow: hidden; background: #000; }
  .tuob-tut-marco iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .tuob-tut-pie { margin: 12px 2px 0; font-size: 13.5px; line-height: 1.45; color: var(--color-muted); }
  /* Entre 1100 y 1280 px el botón se pisaba con la última estación del arco: con el botón, la cabecera pasa antes a
     la disposición en columna (marca arriba, arco abajo) que estilo.ts usa recién a 1100 px. */
  @media (max-width: 1280px) {
    .tuob-cab:has(.tuob-tutorial) { flex-direction: column; align-items: center; gap: 6px; }
    .tuob-cab:has(.tuob-tutorial) .tuob-marca { position: static; }
  }
  @media (max-width: 720px) {
    .tuob-tutorial { right: 16px; top: 16px; margin: 0; padding: 0 14px; }
  }
  @media (prefers-reduced-motion: reduce) { .tuob-tutorial, .tuob-tut-cerrar { transition: none; } }
`
