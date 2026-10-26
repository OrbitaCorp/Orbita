// "Tu cuenta": la del dueño, con la que entra al panel. Pide lo mismo que el
// alta real de Tienda: nombre, email (con chequeo de que no esté en uso),
// contraseña de 8 o más con su confirmación, y aceptar los términos.
import { useState } from 'react'
import { Check, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { Entrada, MensajeError, type PropsPaso } from './campos'
import type { Chequeo } from './modelo'

export function PasoCuenta({ d, poner, error, tocar, mail }: PropsPaso & { mail: Chequeo }) {
  const [verClave, setVerClave] = useState(false)
  const errorAcepta = error('acepta')
  // "En uso" se avisa apenas se sabe; mientras se verifica no se muestra error (dura un instante).
  const errorEmail = mail === 'verificando' ? undefined : mail === 'ocupado' ? 'Ya hay una cuenta con ese email. Usá otro o iniciá sesión.' : error('email')
  const coinciden = d.clave.length >= 8 && d.clave2 === d.clave
  const ojo = (
    <button type="button" className="tuob-ojo" onClick={() => setVerClave(v => !v)} aria-label={verClave ? 'Ocultar las contraseñas' : 'Mostrar las contraseñas'} aria-pressed={verClave}>
      {verClave ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
    </button>
  )
  return (
    <div className="tuob-ancho tuob-ancho--form">
      <div className="tuob-form">
        <Entrada id="tuob-nombre" label="Tu nombre y apellido" valor={d.nombre} onCambio={v => poner('nombre', v)} onTocar={() => tocar('nombre')}
          error={error('nombre')} placeholder="Juan García" autoComplete="name" autoCapitalize="words" maxLength={80} required />
        <Entrada id="tuob-email" label="Email" type="email" inputMode="email" valor={d.email} onCambio={v => poner('email', v)} onTocar={() => tocar('email')}
          error={errorEmail} placeholder="vos@email.com" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={120} required
          ayuda={
            mail === 'verificando' ? <span className="tuob-chequeo" role="status"><LoaderCircle size={14} className="tuob-girando" aria-hidden /> Verificando el email…</span>
              : mail === 'libre' ? <span className="tuob-chequeo" data-ok="true" role="status"><Check size={14} strokeWidth={3} aria-hidden /> Email disponible. Con este entrás al panel.</span>
              : 'Con este email vas a entrar al panel.'
          } />
        <div className="tuob-fila2">
          <Entrada id="tuob-clave" label="Contraseña" type={verClave ? 'text' : 'password'} valor={d.clave} onCambio={v => poner('clave', v)} onTocar={() => tocar('clave')}
            error={error('clave')} ayuda="8 caracteres o más." placeholder="Elegí una contraseña" autoComplete="new-password" required accion={ojo} />
          <Entrada id="tuob-clave2" label="Repetí la contraseña" type={verClave ? 'text' : 'password'} valor={d.clave2} onCambio={v => poner('clave2', v)} onTocar={() => tocar('clave2')}
            error={error('clave2')} placeholder="La misma, otra vez" autoComplete="new-password" required
            ayuda={coinciden ? <span className="tuob-chequeo" data-ok="true"><Check size={14} strokeWidth={3} aria-hidden /> Coinciden</span> : 'Para evitar un error de tipeo.'} />
        </div>
        <div className="tuob-campo">
          <div className="tuob-check">
            <input id="tuob-acepta" type="checkbox" checked={d.acepta} onChange={e => { poner('acepta', e.target.checked); tocar('acepta') }}
              aria-invalid={errorAcepta ? true : undefined} aria-describedby={errorAcepta ? 'tuob-acepta-error' : undefined} />
            <span>
              <label htmlFor="tuob-acepta">Acepto los</label>{' '}
              <a href="/terminos" target="_blank" rel="noopener noreferrer">términos y condiciones</a> y la{' '}
              <a href="/privacidad" target="_blank" rel="noopener noreferrer">política de privacidad</a> de Órbita.
            </span>
          </div>
          {errorAcepta && <MensajeError id="tuob-acepta-error">{errorAcepta}</MensajeError>}
        </div>
      </div>
    </div>
  )
}
