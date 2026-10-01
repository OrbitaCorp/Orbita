// DEMO INTERNA — el "Escribinos" de la landing en versión vista previa. El
// formulario de verdad (landing/components/v2/Contacto.tsx) manda un mail a
// soporte; este es igual a la vista pero no sale de la pantalla: valida, muestra
// la confirmación y no envía nada a ningún lado.
//
// Se monta solo mientras está abierto, así cada vez arranca en blanco.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, Check, X } from 'lucide-react'
import { CSS_CONTACTO_DEMO } from './estilo'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

type Campo = 'email' | 'mensaje'

export function ContactoDemo({ onCerrar }: { onCerrar: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const primero = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [tocados, setTocados] = useState<Campo[]>([])
  const [intentado, setIntentado] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const errores: Record<Campo, string | undefined> = {
    email: EMAIL_RE.test(email.trim()) ? undefined : 'Revisá el email: le falta algo.',
    mensaje: mensaje.trim().length < 10 ? 'Contanos un poco más (mínimo 10 caracteres).' : undefined,
  }
  const error = (c: Campo) => (intentado || tocados.includes(c) ? errores[c] : undefined)
  const tocar = (c: Campo) => setTocados(t => (t.includes(c) ? t : [...t, c]))

  // Mientras está abierto no se desliza la página de atrás.
  useEffect(() => {
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    primero.current?.focus()
    return () => { document.body.style.overflow = anterior }
  }, [])

  // Esc cierra y el Tab da la vuelta adentro del formulario.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCerrar(); return }
      if (e.key !== 'Tab' || !panel.current) return
      const enfocables = panel.current.querySelectorAll<HTMLElement>('button, input, textarea')
      if (!enfocables.length) return
      const ini = enfocables[0]
      const fin = enfocables[enfocables.length - 1]
      if (e.shiftKey && document.activeElement === ini) { e.preventDefault(); fin.focus() }
      else if (!e.shiftKey && document.activeElement === fin) { e.preventDefault(); ini.focus() }
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [onCerrar])

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    setIntentado(true)
    if (errores.email || errores.mensaje) {
      // Al primer campo con error, que recién queda marcado en el próximo pintado.
      requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    setEnviado(true)
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('[data-listo]')?.focus())
  }

  const errorEmail = error('email')
  const errorMensaje = error('mensaje')

  return (
    <div className="tul-modal">
      <style>{CSS_CONTACTO_DEMO}</style>
      <div className="tul-modal-velo" onMouseDown={onCerrar} aria-hidden />
      <div ref={panel} className="tul-modal-panel" role="dialog" aria-modal="true" aria-labelledby="tul-modal-titulo">
        <div className="tul-modal-cab">
          <h2 id="tul-modal-titulo">{enviado ? 'Recibimos tu consulta' : 'Escribinos'}</h2>
          <button type="button" className="tul-modal-cerrar" onClick={onCerrar} aria-label="Cerrar">
            <X size={18} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
        <span className="tul-modal-aviso">Vista previa: no se envía nada</span>

        {enviado ? (
          <div className="tul-modal-listo">
            <span aria-hidden><Check size={26} strokeWidth={2.4} /></span>
            <p role="status">
              Así se ve la confirmación. En la landing real la consulta le llega al equipo y la respuesta va por mail a <strong>{email.trim()}</strong>.
            </p>
            <button type="button" className="tul-modal-enviar" onClick={onCerrar} data-listo>Cerrar</button>
          </div>
        ) : (
          <form onSubmit={enviar} noValidate>
            <div className="tul-campo">
              <label htmlFor="tul-contacto-email">Tu email</label>
              <input ref={primero} id="tul-contacto-email" className="tul-input" type="email" inputMode="email" autoComplete="email" maxLength={254}
                value={email} onChange={e => setEmail(e.target.value)} onBlur={() => tocar('email')} placeholder="nombre@correo.com"
                aria-invalid={errorEmail ? true : undefined} aria-describedby={errorEmail ? 'tul-contacto-email-error' : undefined} />
              {errorEmail && <p id="tul-contacto-email-error" className="tul-error" role="alert"><AlertCircle size={14} aria-hidden /> {errorEmail}</p>}
            </div>
            <div className="tul-campo">
              <label htmlFor="tul-contacto-mensaje">¿Cómo trabajás y qué necesitás de una agenda?</label>
              <textarea id="tul-contacto-mensaje" className="tul-input" rows={4} maxLength={4000}
                value={mensaje} onChange={e => setMensaje(e.target.value)} onBlur={() => tocar('mensaje')} placeholder="Contanos y te respondemos por mail."
                aria-invalid={errorMensaje ? true : undefined} aria-describedby={errorMensaje ? 'tul-contacto-mensaje-error' : undefined} />
              {errorMensaje && <p id="tul-contacto-mensaje-error" className="tul-error" role="alert"><AlertCircle size={14} aria-hidden /> {errorMensaje}</p>}
            </div>
            <button type="submit" className="tul-modal-enviar">Enviar consulta</button>
          </form>
        )}
      </div>
    </div>
  )
}
