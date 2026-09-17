import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, MailCheck, ShieldAlert } from 'lucide-react'
import {
  panelEstadoVerificacionEmail, panelEnviarCodigoVerificacion, panelConfirmarEmail,
  ApiError, type EstadoVerificacionEmail,
} from '@/lib/api'

// Aviso de "confirmá tu email" dentro de Mi perfil (hallazgo
// `alta-sin-verificar-email`).
//
// Por qué vive acá y no en el wizard (decisión del 2026-09-16): pedir un
// código en el medio del alta le suma fricción justo antes de cobrar, y el
// riesgo que cubre es bajo. El member nace sin verificar con 7 días y lo
// resuelve cuando quiere, desde donde ya está trabajando.
//
// Vencido el plazo NO pasa nada automático: el aviso se pone rojo y listo.
// Bloquear el panel de un negocio que ya paga por un email sin confirmar hace
// más daño del que evita.

export function VerificarEmail({ onVerificado }: { onVerificado: () => void }) {
  const [estado, setEstado] = useState<EstadoVerificacionEmail | null>(null)
  const [code, setCode] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [espera, setEspera] = useState(0)
  // Se queda en pantalla después de confirmar. Antes el aviso simplemente
  // desaparecía y no quedaba claro si había andado: el éxito tiene que
  // decirse, no deducirse de que algo dejó de estar.
  const [verificado, setVerificado] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async () => {
    try {
      const e = await panelEstadoVerificacionEmail()
      setEstado(e)
      setEspera(e.esperaParaReenviar)
    } catch {
      // Silencioso a propósito: es un aviso, no la pantalla. Si la API no
      // contesta, Mi perfil tiene que seguir andando igual.
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  // Cuenta regresiva para poder pedir otro código.
  useEffect(() => {
    if (espera <= 0) return
    const id = window.setInterval(() => setEspera((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(id)
  }, [espera])

  const enviar = async () => {
    setEnviando(true); setError(''); setAviso('')
    try {
      const r = await panelEnviarCodigoVerificacion()
      setAviso(`Te mandamos un código a ${r.email}. Llega en un minuto; si no, mirá el correo no deseado.`)
      setEspera(60)
      await cargar()
      inputRef.current?.focus()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo enviar el código')
    } finally {
      setEnviando(false)
    }
  }

  const confirmar = async (valor: string) => {
    setConfirmando(true); setError(''); setAviso('')
    try {
      await panelConfirmarEmail(valor)
      setVerificado(true)
      onVerificado()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo confirmar el código')
      setCode('')
      inputRef.current?.focus()
    } finally {
      setConfirmando(false)
    }
  }

  if (verificado) {
    return (
      <section
        role="status"
        style={{
          display: 'flex', alignItems: 'center', gap: 11,
          border: '1px solid var(--color-success)', borderRadius: 14,
          background: 'var(--color-success-bg)', padding: '14px 18px', marginBottom: 16,
        }}
      >
        <CheckCircle2 size={19} strokeWidth={2.2} color="var(--color-success)" style={{ flexShrink: 0 }} aria-hidden />
        <div>
          <strong style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
            Listo, tu email quedó verificado
          </strong>
          <span style={{ fontSize: 13, color: 'var(--color-body)', lineHeight: 1.5 }}>
            {estado?.email ? `Confirmamos ${estado.email}. ` : ''}Si alguna vez perdés el acceso, ahora podemos devolverte la cuenta.
          </span>
        </div>
      </section>
    )
  }

  if (!estado || estado.emailVerified) return null

  const dias = estado.diasRestantes
  const vencido = dias !== null && dias < 0
  const acento = vencido ? 'var(--color-error)' : 'var(--color-warning)'
  const fondo = vencido ? 'var(--color-error-bg)' : 'rgba(245,158,11,0.10)'

  return (
    <section
      aria-labelledby="verif-email-titulo"
      style={{
        border: `1px solid ${acento}`, borderRadius: 14, background: fondo,
        padding: '16px 18px', marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {vencido
          ? <ShieldAlert size={18} strokeWidth={2.2} color={acento} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
          : <MailCheck size={18} strokeWidth={2.2} color={acento} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 id="verif-email-titulo" style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)' }}>
            Confirmá tu email
          </h3>
          <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--color-body)', lineHeight: 1.55 }}>
            Es el mail con el que entrás al panel: confirmarlo es lo que nos deja devolverte la cuenta si
            alguna vez perdés el acceso.{' '}
            {dias === null ? null : vencido ? (
              <strong style={{ color: acento }}>El plazo venció hace {Math.abs(dias)} {Math.abs(dias) === 1 ? 'día' : 'días'}.</strong>
            ) : (
              <>Te {dias === 1 ? 'queda' : 'quedan'} <strong style={{ color: 'var(--color-text)' }}>{dias} {dias === 1 ? 'día' : 'días'}</strong>.</>
            )}
          </p>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 13 }}>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 5 }}>
                Código de 6 números
              </span>
              <input
                ref={inputRef}
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setCode(v)
                  setError('')
                  // Se confirma solo al sexto dígito, porque tipear seis
                  // números y después buscar un botón es un paso al pedo. Pero
                  // el botón EXISTE igual (abajo): si el intento automático
                  // falla, o si el código se pega de una, tiene que haber algo
                  // visible para tocar — si no, el campo queda lleno y mudo.
                  if (v.length === 6 && !confirmando) void confirmar(v)
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6 && !confirmando) void confirmar(code) }}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                aria-label="Código de verificación de 6 números"
                disabled={confirmando}
                className="ds-field"
                style={{
                  width: 148, height: 40, padding: '0 13px', borderRadius: 10,
                  border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                  color: 'var(--color-text)', outline: 'none',
                  fontSize: 17, fontWeight: 700, letterSpacing: '0.22em',
                  fontFamily: '"Geist Mono", Consolas, monospace',
                }}
              />
            </label>

            {/* El auto-confirmado al sexto dígito no alcanza como única
                salida: si falla, o si el código se pega, el campo queda lleno
                y sin nada que tocar. */}
            <button
              type="button"
              onClick={() => void confirmar(code)}
              disabled={code.length !== 6 || confirmando}
              className="ds-hover"
              style={{
                height: 40, padding: '0 18px', borderRadius: 10, fontFamily: 'inherit',
                fontSize: 13.5, fontWeight: 600, border: 'none',
                background: code.length === 6 && !confirmando ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                color: code.length === 6 && !confirmando ? 'var(--color-on-primary)' : 'var(--color-subtle)',
                cursor: code.length === 6 && !confirmando ? 'pointer' : 'default',
              }}
            >
              {confirmando ? 'Confirmando…' : 'Confirmar'}
            </button>

            <button
              type="button"
              onClick={() => void enviar()}
              disabled={enviando || espera > 0}
              className="ds-hover"
              style={{
                height: 40, padding: '0 16px', borderRadius: 10, fontFamily: 'inherit',
                fontSize: 13.5, fontWeight: 600,
                border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                color: espera > 0 || enviando ? 'var(--color-muted)' : 'var(--color-text)',
                cursor: espera > 0 || enviando ? 'default' : 'pointer',
              }}
            >
              {enviando ? 'Enviando…'
                : espera > 0 ? `Reenviar en ${espera}s`
                : estado.hayCodigoVigente ? 'Enviar otro código'
                : 'Enviarme el código'}
            </button>
          </div>

          {aviso && <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--color-body)', lineHeight: 1.5 }}>{aviso}</p>}
          {error && <p role="alert" style={{ margin: '10px 0 0', fontSize: 12.5, fontWeight: 600, color: 'var(--color-error)', lineHeight: 1.5 }}>{error}</p>}
        </div>
      </div>
    </section>
  )
}
