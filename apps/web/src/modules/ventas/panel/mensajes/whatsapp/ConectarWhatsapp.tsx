import { Button } from '@/design-system/components/Button'
import { IconoWhatsapp } from './WhatsAppWeb'

// Lo que se ve en Mensajes → WhatsApp cuando todavía no hay una cuenta conectada (o cuando WhatsApp no está habilitado
// para el negocio): explica qué es, qué hace falta y deja conectar. Las dos pantallas comparten la misma tarjeta.

interface Props {
  /** `no-disponible`: el negocio todavía no tiene WhatsApp habilitado (no se ofrece conectar). */
  caso: 'sin-conectar' | 'no-disponible'
  onConectar: () => void
}

const PASOS = [
  { titulo: 'Tené a mano los datos de tu app de Meta', texto: 'En developers.facebook.com, dentro de tu app, en WhatsApp → API Setup: el ID del número de teléfono, el ID de la cuenta de WhatsApp Business y un token de acceso.' },
  { titulo: 'Pegalos en Órbita', texto: 'Tocá el botón de abajo y completá los tres datos. El token se guarda cifrado y no se vuelve a mostrar.' },
  { titulo: 'Atendé tus chats desde acá', texto: 'Los mensajes de tus clientes llegan a esta pantalla, con el aspecto de WhatsApp Web, y tus respuestas salen por tu número.' },
]

export function ConectarWhatsapp({ caso, onConectar }: Props) {
  return (
    <section className="cw-raiz" aria-label="Conectar WhatsApp">
      <style>{CSS}</style>
      <div className="cw-icono" aria-hidden><IconoWhatsapp size={34} /></div>

      {caso === 'no-disponible' ? (
        <>
          <h2 className="cw-titulo">WhatsApp todavía no está disponible para tu negocio</h2>
          <p className="cw-texto">
            Estamos habilitando WhatsApp Business de a poco. Cuando esté listo para tu negocio, vas a poder conectar tu número acá y atender a tus clientes con un chat igual al de WhatsApp Web.
          </p>
        </>
      ) : (
        <>
          <h2 className="cw-titulo">Conectá tu cuenta de WhatsApp Business</h2>
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
          <Button size="lg" onClick={onConectar} className="cw-boton">Conectar cuenta de WhatsApp Business</Button>
          <p className="cw-nota">
            Usa la API oficial de WhatsApp Business de Meta. WhatsApp solo permite responder dentro de las 24 horas del último mensaje del cliente.
          </p>
        </>
      )}
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
.cw-raiz .cw-boton { min-width: 280px; justify-content: center; background: #00a884; border-color: #00a884; }
.cw-nota { margin: 14px 0 0; max-width: 52ch; font-size: 12.5px; line-height: 1.5; color: var(--color-muted); }
@media (max-width: 520px) { .cw-raiz { padding: 28px 18px 24px; } .cw-raiz .cw-boton { width: 100%; min-width: 0; } }
`
