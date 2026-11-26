import { Button } from '@/design-system/components/Button'
import type { EstadoDeConexion } from './useConexionIntegrada'
import { IconoWhatsapp } from './WhatsAppWeb'
import { VideoDeFuncion } from '@/modules/demo/SoloConTienda'

// Lo que se ve en Mensajes → WhatsApp cuando todavía no hay una cuenta conectada (o cuando WhatsApp no está habilitado
// para el negocio): explica qué es, qué se necesita y deja conectar con el botón de Meta, sin pegar datos a mano.
// Sin conectar, a la izquierda va el video de cómo funciona (el de la demo) y a la derecha cómo conectar; abajo,
// a todo el ancho, lo que hay que tener en cuenta. En pantallas angostas se apila, el video primero.

interface Props {
  /** `no-disponible`: el negocio todavía no tiene WhatsApp habilitado (no se ofrece conectar). */
  caso: 'sin-conectar' | 'no-disponible'
  estado?: EstadoDeConexion
  error?: string | null
  aviso?: string | null
  /** Abre el flujo de Meta. */
  onConectar: () => void
  /** Abre el formulario manual (para cuentas de prueba de Meta). */
  onManual?: () => void
  /** Corta la espera de la ventana de Meta (si se cerró con la X, Meta no siempre avisa). */
  onCancelar?: () => void
}

const PASOS = [
  { titulo: 'Tocá el botón de abajo', texto: 'Se abre una ventana de Meta, la empresa dueña de WhatsApp.' },
  { titulo: 'Iniciá sesión con Facebook y conectá tu número', texto: 'Escribís el número de tu app WhatsApp Business, Meta te manda un código y lo ingresás en la app. Te pregunta si querés traer el historial de tus chats.' },
  { titulo: 'Seguí usando tu app y atendé también desde acá', texto: 'Tu app WhatsApp Business del celular sigue funcionando igual: lo que escribas ahí también se ve en Órbita, y lo que respondas desde Órbita le llega a tu cliente.' },
]

export function ConectarWhatsapp({ caso, estado = 'libre', error, aviso, onConectar, onManual, onCancelar }: Props) {
  const ocupado = estado !== 'libre'
  if (caso === 'no-disponible') {
    return (
      <section className="cw-raiz" aria-label="Conectar WhatsApp">
        <style>{CSS}</style>
        <div className="cw-icono" aria-hidden><IconoWhatsapp size={34} /></div>
        <h2 className="cw-titulo">WhatsApp todavía no está disponible para tu negocio</h2>
        <p className="cw-texto">
          Estamos habilitando WhatsApp Business de a poco. Cuando esté listo para tu negocio, vas a poder conectar tu número acá y atender a tus clientes con un chat igual al de WhatsApp Web.
        </p>
      </section>
    )
  }

  return (
    <section className="cw-raiz cw-partido" aria-label="Conectar WhatsApp">
      <style>{CSS}</style>
      <div className="cw-video"><VideoDeFuncion funcion="whatsapp" /></div>
      <div className="cw-lado">
          <h2 className="cw-titulo">Conectá tu WhatsApp Business</h2>
          <p className="cw-texto">
            Atendé a tus clientes por WhatsApp sin salir de Órbita: los chats llegan acá, con el mismo aspecto que WhatsApp Web, y respondés desde el panel por tu propio número.
          </p>
          <ol className="cw-pasos">
            {PASOS.map((p, i) => (
              <li key={p.titulo}>
                <span className="cw-numero" aria-hidden>{i + 1}</span>
                <span>
                  <strong>{p.titulo}</strong>
                  <span className="cw-paso-texto">{p.texto}</span>
                </span>
              </li>
            ))}
          </ol>

          <Button size="lg" loading={ocupado} onClick={onConectar} className="cw-boton">
            {estado === 'meta' ? 'Completá el proceso en la ventana de Meta…' : estado === 'guardando' ? 'Conectando tu cuenta…' : 'Conectar cuenta de WhatsApp Business'}
          </Button>
          {estado === 'meta' && onCancelar && (
            <button type="button" className="cw-manual" onClick={onCancelar}>¿Cerraste la ventana de Meta? Cancelar y volver a intentar</button>
          )}
          {error && <p className="cw-error" role="alert">{error}</p>}
          {aviso && <p className="cw-aviso" role="status">{aviso}</p>}
      </div>

      <div className="cw-abajo">
          <ul className="cw-limites" aria-label="Qué tener en cuenta">
            <li>Necesitás la app <strong>WhatsApp Business</strong> (actualizada) en tu celular; el WhatsApp personal no sirve.</li>
            <li>Los chats de <strong>grupos</strong> no se traen a Órbita.</li>
            <li>Al conectar, se desvinculan <strong>WhatsApp Web y Desktop</strong>; los volvés a usar con Órbita.</li>
            <li>Usá tu app seguido: si pasan unas dos semanas sin abrirla en el celular, Meta corta la conexión.</li>
            <li>WhatsApp solo permite responder dentro de las <strong>24 horas</strong> del último mensaje del cliente.</li>
          </ul>
          {onManual && (
            <button type="button" className="cw-manual" onClick={onManual}>¿Tenés una cuenta de prueba de Meta? Conectala a mano</button>
          )}
      </div>
    </section>
  )
}

const CSS = `
.cw-raiz { display: flex; flex-direction: column; align-items: center; text-align: center; max-width: 620px; margin: 0 auto; padding: 36px 28px 32px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; box-shadow: var(--shadow-card); }
.cw-icono { width: 72px; height: 72px; margin-bottom: 16px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; background: #00a884; }
.cw-titulo { margin: 0 0 8px; font-size: 21px; font-weight: 700; letter-spacing: -0.02em; color: var(--color-text); }
.cw-texto { margin: 0 0 22px; max-width: 52ch; font-size: 14px; line-height: 1.6; color: var(--color-muted); }
.cw-pasos { list-style: none; margin: 0 0 26px; padding: 0; width: 100%; display: flex; flex-direction: column; gap: 14px; text-align: left; }
.cw-pasos li { display: flex; gap: 14px; align-items: flex-start; }
.cw-numero { width: 26px; height: 26px; flex-shrink: 0; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 700; color: var(--color-muted); border: 1.5px solid var(--color-border); }
.cw-pasos strong { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); }
.cw-paso-texto { display: block; margin-top: 2px; font-size: 13px; line-height: 1.55; color: var(--color-muted); }
.cw-raiz .cw-boton { min-width: 300px; justify-content: center; background: #00a884; border-color: #00a884; }
.cw-error { margin: 12px 0 0; max-width: 52ch; font-size: 13px; line-height: 1.5; color: var(--color-error); }
.cw-aviso { margin: 12px 0 0; max-width: 52ch; font-size: 13px; line-height: 1.5; color: var(--color-text); }
.cw-limites { margin: 16px 0 0; padding: 12px 14px 12px 30px; width: 100%; box-sizing: border-box; text-align: left; border-radius: 12px; background: var(--color-surface-alt); border: 1px solid var(--color-border); display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; line-height: 1.5; color: var(--color-muted); }
.cw-limites strong { font-weight: 600; color: var(--color-text); }
.cw-manual { margin-top: 12px; border: none; background: transparent; padding: 0; cursor: pointer; font: inherit; font-size: 12.5px; color: var(--color-muted); text-decoration: underline; text-underline-offset: 3px; }
.cw-manual:hover { color: var(--color-text); }
.cw-manual:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 4px; }
/* Sin conectar: video a la izquierda, cómo conectar a la derecha, lo que hay que tener en cuenta abajo. */
.cw-partido { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 20px 28px; align-items: center; max-width: none; padding: 20px; text-align: left; }
.cw-partido .cw-video .sct-video { margin-top: 0; box-shadow: none; border: 1px solid var(--color-border); }
.cw-lado { display: flex; flex-direction: column; align-items: flex-start; }
.cw-partido .cw-titulo { font-size: 19px; }
.cw-partido .cw-texto { margin-bottom: 18px; font-size: 13.5px; }
.cw-partido .cw-pasos { margin-bottom: 20px; gap: 12px; }
.cw-partido .cw-paso-texto { font-size: 12.5px; }
.cw-partido .cw-boton { width: 100%; min-width: 0; }
.cw-abajo { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: flex-start; }
.cw-abajo .cw-limites { margin-top: 0; }
@media (max-width: 900px) { .cw-partido { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 520px) { .cw-raiz { padding: 28px 18px 24px; } .cw-partido { padding: 14px; } .cw-raiz .cw-boton { width: 100%; min-width: 0; } }
`
