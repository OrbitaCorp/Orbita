import { useEffect, useRef, useState } from 'react'
import { Button } from '@/design-system/components/Button'
import { Modal } from '@/design-system/components/Modal'
import { ApiError, getInstagramAjustes, saveInstagramAjustes, type InstagramAjustes } from '@/lib/api'
import { nombreCortoDelDia } from './fechaLocal'

// Ajustes de Difusión, en una ventana: las respuestas automáticas de los mensajes (bienvenida y ausencia) y la
// moderación de comentarios (palabras que se ocultan solas). Se abre desde Mensajes o desde Comentarios con solo
// la parte que le toca a cada pantalla; guarda todo junto, así que lo de la otra parte no se pierde.

interface Props {
  parte: 'mensajes' | 'comentarios'
  onCerrar: () => void
}

const DIAS = [1, 2, 3, 4, 5, 6, 0] // lunes primero
const MAX_TEXTO = 500

export function AjustesModal({ parte, onCerrar }: Props) {
  const [ajustes, setAjustes] = useState<InstagramAjustes | null>(null)
  const [palabras, setPalabras] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const montado = useRef(true)
  useEffect(() => () => { montado.current = false }, [])

  useEffect(() => {
    let cancelado = false
    getInstagramAjustes()
      .then((a) => { if (!cancelado) { setAjustes(a); setPalabras(a.moderacion.palabras.join('\n')) } })
      .catch((e) => { if (!cancelado) setError(e instanceof ApiError ? e.message : 'No se pudieron cargar los ajustes.') })
    return () => { cancelado = true }
  }, [])

  const guardar = async () => {
    if (!ajustes) return
    setGuardando(true); setError(null)
    try {
      await saveInstagramAjustes({
        ...ajustes,
        moderacion: { ...ajustes.moderacion, palabras: palabras.split('\n').map((p) => p.trim()).filter((p) => p.length >= 2).slice(0, 50) },
      })
      if (montado.current) onCerrar()
    } catch (e) {
      if (montado.current) { setError(e instanceof ApiError ? e.message : 'No se pudieron guardar los ajustes. Probá de nuevo.'); setGuardando(false) }
    }
  }

  const cambiar = (parcial: Partial<InstagramAjustes>) => setAjustes((a) => (a ? { ...a, ...parcial } : a))

  return (
    <Modal
      isOpen
      onClose={() => { if (!guardando) onCerrar() }}
      dismissable={!guardando}
      title={parte === 'mensajes' ? 'Respuestas automáticas' : 'Moderación de comentarios'}
      maxWidth={520}
      footer={(
        <>
          <Button variant="secondary" disabled={guardando} onClick={onCerrar}>Cancelar</Button>
          <Button loading={guardando} disabled={!ajustes} onClick={guardar}>Guardar</Button>
        </>
      )}
    >
      <style>{CSS}</style>
      {!ajustes && !error && <p className="aj-suave">Cargando…</p>}
      {ajustes && parte === 'mensajes' && (
        <div className="aj-grupo">
          <section className="aj-bloque">
            <Interruptor
              id="aj-bienvenida"
              activo={ajustes.bienvenida.activa}
              titulo="Mensaje de bienvenida"
              ayuda="Se manda una sola vez, cuando alguien te escribe por primera vez."
              onCambio={(activa) => cambiar({ bienvenida: { ...ajustes.bienvenida, activa } })}
            />
            {ajustes.bienvenida.activa && (
              <Texto
                etiqueta="Texto de la bienvenida"
                valor={ajustes.bienvenida.texto}
                placeholder="¡Hola! Gracias por escribirnos 😊 En un momento te respondemos."
                onCambio={(texto) => cambiar({ bienvenida: { ...ajustes.bienvenida, texto } })}
              />
            )}
          </section>

          <section className="aj-bloque">
            <Interruptor
              id="aj-ausencia"
              activo={ajustes.ausencia.activa}
              titulo="Mensaje de ausencia"
              ayuda="Se manda cuando te escriben fuera de tu horario de atención, como mucho una vez cada 12 horas por persona."
              onCambio={(activa) => cambiar({ ausencia: { ...ajustes.ausencia, activa } })}
            />
            {ajustes.ausencia.activa && (
              <>
                <Texto
                  etiqueta="Texto de ausencia"
                  valor={ajustes.ausencia.texto}
                  placeholder="Ahora no estamos, pero mañana te respondemos primera hora."
                  onCambio={(texto) => cambiar({ ausencia: { ...ajustes.ausencia, texto } })}
                />
                <p className="aj-etiqueta">Tu horario de atención (hora de Argentina)</p>
                <div className="aj-horario">
                  <label>Desde <input type="time" value={ajustes.ausencia.desde} onChange={(e) => cambiar({ ausencia: { ...ajustes.ausencia, desde: e.target.value } })} /></label>
                  <label>Hasta <input type="time" value={ajustes.ausencia.hasta} onChange={(e) => cambiar({ ausencia: { ...ajustes.ausencia, hasta: e.target.value } })} /></label>
                </div>
                <div className="aj-dias" role="group" aria-label="Días que atendés">
                  {DIAS.map((d) => {
                    const activo = ajustes.ausencia.dias.includes(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={activo}
                        className={`aj-dia${activo ? ' aj-dia-activo' : ''}`}
                        onClick={() => cambiar({ ausencia: { ...ajustes.ausencia, dias: activo ? ajustes.ausencia.dias.filter((x) => x !== d) : [...ajustes.ausencia.dias, d] } })}
                      >
                        {nombreCortoDelDia(d)}
                      </button>
                    )
                  })}
                </div>
                <p className="aj-suave" style={{ margin: '8px 0 0' }}>Los días que no marcás se consideran fuera de horario.</p>
              </>
            )}
          </section>

          <p className="aj-suave">Orbi nunca contesta solo a un mensaje viejo ni a lo que escribió tu propio negocio, para no entrar en bucles con otras cuentas que también responden solas.</p>
        </div>
      )}

      {ajustes && parte === 'comentarios' && (
        <div className="aj-grupo">
          <section className="aj-bloque">
            <Interruptor
              id="aj-moderacion"
              activo={ajustes.moderacion.activa}
              titulo="Ocultar comentarios con ciertas palabras"
              ayuda="Se ocultan solos (cada pocos minutos y cada vez que abrís Comentarios). Quien lo escribió lo sigue viendo, y podés volver a mostrarlos cuando quieras."
              onCambio={(activa) => cambiar({ moderacion: { ...ajustes.moderacion, activa } })}
            />
            {ajustes.moderacion.activa && (
              <>
                <label className="aj-etiqueta" htmlFor="aj-palabras">Palabras o frases (una por línea)</label>
                <textarea
                  id="aj-palabras"
                  className="aj-texto"
                  rows={6}
                  value={palabras}
                  onChange={(e) => setPalabras(e.target.value)}
                  placeholder={'estafa\nno llega nunca\nganá dinero rápido'}
                />
                <p className="aj-suave" style={{ margin: '6px 0 0' }}>No distingue mayúsculas ni tildes. Hasta 50 palabras. Elegí con cuidado: una palabra muy común oculta comentarios que no querías ocultar.</p>
              </>
            )}
          </section>
        </div>
      )}
      {error && <p className="aj-error" role="alert">{error}</p>}
    </Modal>
  )
}

function Interruptor({ id, activo, titulo, ayuda, onCambio }: { id: string; activo: boolean; titulo: string; ayuda: string; onCambio: (v: boolean) => void }) {
  return (
    <div className="aj-interruptor">
      <div>
        <label className="aj-titulo" htmlFor={id}>{titulo}</label>
        <p className="aj-suave" style={{ margin: '2px 0 0' }}>{ayuda}</p>
      </div>
      <button id={id} type="button" role="switch" aria-checked={activo} className={`aj-switch${activo ? ' aj-switch-activo' : ''}`} onClick={() => onCambio(!activo)}>
        <span />
      </button>
    </div>
  )
}

function Texto({ etiqueta, valor, placeholder, onCambio }: { etiqueta: string; valor: string; placeholder: string; onCambio: (v: string) => void }) {
  return (
    <>
      <p className="aj-etiqueta">{etiqueta}</p>
      <textarea className="aj-texto" rows={3} maxLength={MAX_TEXTO} value={valor} placeholder={placeholder} aria-label={etiqueta} onChange={(e) => onCambio(e.target.value)} />
      <p className="aj-contador">{valor.length} / {MAX_TEXTO}</p>
    </>
  )
}

const CSS = `
.aj-grupo { display: flex; flex-direction: column; gap: 14px; }
.aj-bloque { padding: 14px 16px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); }
.aj-suave { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--color-muted); }
.aj-error { margin: 12px 0 0; font-size: 12.5px; color: var(--color-error); }
.aj-interruptor { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.aj-titulo { font-size: 14px; font-weight: 600; color: var(--color-text); }
.aj-switch { position: relative; width: 42px; height: 24px; flex-shrink: 0; padding: 0; border: none; border-radius: 12px; cursor: pointer; background: var(--color-border); transition: background-color 150ms; }
.aj-switch span { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: transform 150ms; }
.aj-switch-activo { background: var(--color-primary); }
.aj-switch-activo span { transform: translateX(18px); }
.aj-switch:focus-visible, .aj-dia:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.aj-etiqueta { display: block; margin: 14px 0 6px; font-size: 13px; font-weight: 600; color: var(--color-text); }
.aj-texto { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface-alt); font: inherit; font-size: 16px; line-height: 1.45; color: var(--color-text); resize: vertical; outline: none; }
.aj-texto:focus { border-color: var(--color-primary); background: var(--color-surface); box-shadow: 0 0 0 3px var(--color-primary-bg); }
.aj-contador { margin: 4px 0 0; text-align: right; font-size: 11.5px; color: var(--color-muted); }
.aj-horario { display: flex; gap: 14px; flex-wrap: wrap; }
.aj-horario label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-muted); }
.aj-horario input { height: 38px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface-alt); font: inherit; font-size: 16px; color: var(--color-text); }
.aj-dias { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.aj-dia { min-width: 44px; height: 34px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 17px; background: var(--color-surface); cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 500; text-transform: capitalize; color: var(--color-muted); }
.aj-dia-activo { color: var(--color-surface); background: var(--color-text); border-color: var(--color-text); }
@media (prefers-reduced-motion: reduce) { .aj-switch, .aj-switch span { transition: none; } }
`
