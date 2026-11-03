import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { ApiError } from '@/lib/api'

// Botón "Sugerir con Orbi" para las respuestas (comentarios y mensajes): pide opciones, las muestra y, al
// elegir una, la devuelve para que se complete el campo de texto. No envía nada: la persona la revisa y manda.

interface Props {
  /** Pide las sugerencias; cada una es un texto listo para usar. */
  pedir: () => Promise<string[]>
  onElegir: (texto: string) => void
  disabled?: boolean
  /** Más compacto, para la barra del chat. */
  compacto?: boolean
}

export function SugerenciasDeOrbi({ pedir, onElegir, disabled, compacto }: Props) {
  const [cargando, setCargando] = useState(false)
  const [opciones, setOpciones] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sugerir = async () => {
    setCargando(true); setError(null)
    try {
      setOpciones(await pedir())
    } catch (e) {
      setOpciones(null)
      setError(e instanceof ApiError ? e.message : 'No se pudo generar con Orbi. Probá de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className={`sug-raiz${compacto ? ' sug-compacto' : ''}`}>
      <style>{CSS}</style>
      <button type="button" className="sug-boton" onClick={sugerir} disabled={disabled || cargando}>
        {cargando ? <span className="sug-giro" aria-hidden /> : <Sparkles size={13} strokeWidth={2} aria-hidden />}
        {cargando ? 'Pensando…' : opciones ? 'Otras ideas' : 'Sugerir con Orbi'}
      </button>
      {error && <p className="sug-error" role="alert">{error}</p>}
      {opciones && opciones.length > 0 && (
        <div className="sug-lista" aria-live="polite">
          {opciones.map((o, i) => (
            <button key={i} type="button" className="sug-opcion" onClick={() => { onElegir(o); setOpciones(null) }}>
              {o}
            </button>
          ))}
          <button type="button" className="sug-cerrar" onClick={() => setOpciones(null)} aria-label="Cerrar las sugerencias"><X size={13} /></button>
        </div>
      )}
    </div>
  )
}

const CSS = `
.sug-raiz { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; min-width: 0; }
.sug-boton { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 500; color: var(--color-text); transition: border-color 150ms, background-color 150ms; }
.sug-boton:hover:not(:disabled) { border-color: var(--color-muted); background: var(--color-surface-alt); }
.sug-boton:disabled { opacity: 0.55; cursor: not-allowed; }
.sug-boton:focus-visible, .sug-opcion:focus-visible, .sug-cerrar:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.sug-error { margin: 0; font-size: 12.5px; color: var(--color-error); }
.sug-lista { position: relative; width: 100%; display: flex; flex-direction: column; gap: 6px; padding-right: 26px; }
.sug-opcion { width: 100%; padding: 9px 12px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface-alt); cursor: pointer; font: inherit; font-size: 13px; line-height: 1.45; text-align: left; color: var(--color-text); white-space: pre-wrap; overflow-wrap: anywhere; transition: border-color 150ms, background-color 150ms; }
.sug-opcion:hover { border-color: var(--color-primary); background: var(--color-primary-bg); }
.sug-cerrar { position: absolute; top: 0; right: 0; width: 22px; height: 22px; padding: 0; border: none; border-radius: 50%; background: transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: var(--color-muted); }
.sug-cerrar:hover { color: var(--color-text); background: var(--color-surface-alt); }
.sug-giro { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--color-border); border-top-color: var(--color-primary); animation: sug-giro 0.8s linear infinite; }
@keyframes sug-giro { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .sug-giro { animation: none; } .sug-boton, .sug-opcion { transition: none; } }
`
