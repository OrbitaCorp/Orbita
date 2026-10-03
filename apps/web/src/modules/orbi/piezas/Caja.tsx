import { useEffect, useLayoutEffect, useRef } from 'react'
import { ArrowUp, Square, X } from 'lucide-react'
import s from '../orbi.module.css'

/**
 * El input (A3·6): crece hasta 6 líneas, Enter envía y Shift+Enter baja de
 * línea. Mientras Orbi responde se puede seguir escribiendo; el botón de enviar
 * pasa a Detener. El texto es el borrador de la sesión: cambiar de vista o de
 * sesión no lo pierde.
 */
export function Caja({ texto, onTexto, onEnviar, onDetener, enVivo, deshabilitado, placeholder, contexto, onQuitarContexto, enfocar, conAviso = true }: {
  texto: string
  onTexto: (t: string) => void
  onEnviar: (t: string) => void
  onDetener: () => void
  enVivo: boolean
  deshabilitado?: boolean
  placeholder?: string
  /** "Pedidos": la pantalla que Orbi tiene en cuenta. */
  contexto?: string
  onQuitarContexto?: () => void
  /** Enfocar al montar (no en pantallas táctiles: abriría el teclado sin que nadie lo pida). */
  enfocar?: boolean
  /** La línea de privacidad de abajo. Se apaga en la demo: ahí las conversaciones no se guardan. */
  conAviso?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [texto])

  // El alto depende del ancho: al abrirse el panel acoplado crece desde 0 (o se
  // le cambia el ancho con el tirador), y el alto medido angosto queda enorme.
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let ancho = el.clientWidth
    const observador = new ResizeObserver(() => {
      if (el.clientWidth === ancho) return
      ancho = el.clientWidth
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    })
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  useEffect(() => {
    if (!enfocar) return
    if (window.matchMedia?.('(hover: none)').matches) return
    ref.current?.focus()
  }, [enfocar])

  const puedeEnviar = !enVivo && !deshabilitado && texto.trim().length > 0
  const enviar = () => {
    if (!puedeEnviar) return
    onEnviar(texto.trim())
  }

  return (
    <>
    <div className={s.caja}>
      {contexto && (
        <span className={s.contexto}>
          Viendo: {contexto}
          {onQuitarContexto && (
            <button type="button" aria-label={`Sacar ${contexto} del contexto`} title="Que Orbi no tenga en cuenta esta pantalla" onClick={onQuitarContexto}>
              <X aria-hidden />
            </button>
          )}
        </span>
      )}
      <label htmlFor="orbi-v2-texto" className={s.soloLector}>Escribile a Orbi</label>
      <textarea
        id="orbi-v2-texto"
        ref={ref}
        rows={1}
        className={s.texto}
        value={texto}
        onChange={e => onTexto(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            enviar()
          }
        }}
        placeholder={placeholder ?? 'Escribile a Orbi'}
        disabled={deshabilitado}
        maxLength={4000}
      />
      <div className={s.cajaAbajo}>
        <span className={s.ayuda} aria-hidden>{enVivo && texto.trim() ? 'Lo mandás cuando Orbi termine' : ' '}</span>
        {enVivo ? (
          <button type="button" className={`${s.detener} ${s.foco}`} onClick={onDetener} aria-label="Detener la respuesta de Orbi">
            <Square aria-hidden fill="currentColor" />Detener
          </button>
        ) : (
          <button type="button" className={`${s.enviar} ${s.foco}`} onClick={enviar} disabled={!puedeEnviar} aria-label="Enviar">
            <ArrowUp aria-hidden strokeWidth={2.25} />
          </button>
        )}
      </div>
    </div>
    {conAviso && (
      <p className={s.avisoPrivacidad}>
        Lo que escribís queda en tu historial y lo procesa Google Gemini.{' '}
        <a href="/privacidad" target="_blank" rel="noreferrer">Privacidad</a>
      </p>
    )}
    </>
  )
}
