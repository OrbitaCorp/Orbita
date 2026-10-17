import { MessageSquare } from 'lucide-react'
import type { WhatsappEstado } from '@/lib/api'
import { IconoWhatsapp } from '../whatsapp/WhatsAppWeb'
import type { CanalDeMensajes } from '../whatsapp/utilidades'

// Arriba de Mensajes: se elige qué bandeja ver. "Mensajes del sistema" son los del chat de la tienda online;
// "WhatsApp" es el número de WhatsApp Business conectado. Cada opción explica qué es, y la de WhatsApp dice si hay
// una cuenta conectada. Al elegir, cambia la bandeja de abajo.

export type EstadoDeWhatsapp = 'cargando' | 'no-disponible' | WhatsappEstado

interface Props {
  canal: CanalDeMensajes
  onCanal: (c: CanalDeMensajes) => void
  /** Cuántos chats sin leer tiene cada bandeja. */
  sinLeer: Record<CanalDeMensajes, number>
  whatsapp: EstadoDeWhatsapp
}

export function SelectorDeCanal({ canal, onCanal, sinLeer, whatsapp }: Props) {
  const conectado = typeof whatsapp === 'object' && whatsapp.connected
  const lineaWhatsapp =
    whatsapp === 'cargando' ? 'Mirando tu cuenta…'
      : whatsapp === 'no-disponible' ? 'Todavía no está disponible para tu negocio'
        : conectado ? `Conectado · ${whatsapp.displayPhone ?? whatsapp.phoneNumberId}`
          : 'Sin conectar · conectá tu cuenta de WhatsApp Business'

  const opciones: { id: CanalDeMensajes; titulo: string; texto: string; linea: string; icono: React.ReactNode; punto: boolean }[] = [
    {
      id: 'sistema',
      titulo: 'Mensajes del sistema',
      texto: 'Los que te escriben tus clientes desde el chat de tu tienda online. El cliente los ve en su perfil de la tienda y le llegan tus respuestas ahí mismo.',
      linea: 'Siempre disponible',
      icono: <MessageSquare size={20} strokeWidth={1.8} />,
      punto: false,
    },
    {
      id: 'whatsapp',
      titulo: 'WhatsApp',
      texto: 'Los chats de tu número de WhatsApp Business, con el mismo aspecto que WhatsApp Web. Respondés desde acá y tu cliente lo recibe en su WhatsApp.',
      linea: lineaWhatsapp,
      icono: <IconoWhatsapp size={20} />,
      punto: conectado,
    },
  ]

  return (
    <div className="sel-raiz" role="tablist" aria-label="Qué mensajes ver">
      <style>{CSS}</style>
      {opciones.map((o) => {
        const activo = canal === o.id
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={activo}
            className={`sel-opcion${activo ? ' sel-opcion-activa' : ''}`}
            onClick={() => onCanal(o.id)}
          >
            <span className="sel-icono" aria-hidden>{o.icono}</span>
            <span className="sel-texto">
              <span className="sel-fila">
                <span className="sel-titulo">{o.titulo}</span>
                {sinLeer[o.id] > 0 && <span className="sel-cuenta" aria-label={`${sinLeer[o.id]} sin leer`}>{sinLeer[o.id]}</span>}
              </span>
              <span className="sel-descripcion">{o.texto}</span>
              <span className="sel-linea">
                {o.punto && <i className="sel-punto" aria-hidden />}
                {o.linea}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

const CSS = `
.sel-raiz { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.sel-opcion { display: flex; align-items: flex-start; gap: 14px; padding: 14px 16px; text-align: left; font-family: inherit; cursor: pointer; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 14px; transition: border-color 150ms, background-color 150ms, box-shadow 150ms; }
.sel-opcion:hover { border-color: var(--color-muted); }
.sel-opcion:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.sel-opcion-activa, .sel-opcion-activa:hover { border-color: var(--color-text); box-shadow: 0 0 0 1px var(--color-text); }
.sel-icono { width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; color: var(--color-muted); background: var(--color-surface-alt); border: 1px solid var(--color-border); }
.sel-opcion-activa .sel-icono { color: var(--color-text); }
.sel-texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.sel-fila { display: flex; align-items: center; gap: 8px; }
.sel-titulo { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; color: var(--color-text); }
.sel-cuenta { min-width: 20px; height: 20px; padding: 0 6px; box-sizing: border-box; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--color-on-primary); background: var(--color-primary); }
.sel-descripcion { font-size: 12.5px; line-height: 1.5; color: var(--color-muted); }
.sel-linea { display: inline-flex; align-items: center; gap: 6px; margin-top: 2px; font-size: 12.5px; font-weight: 500; color: var(--color-text); }
.sel-punto { width: 8px; height: 8px; border-radius: 50%; background: var(--color-success); box-shadow: 0 0 0 3px rgba(16,185,129,0.16); }
@media (max-width: 768px) { .sel-raiz { grid-template-columns: minmax(0, 1fr); gap: 8px; } .sel-descripcion { display: none; } .sel-opcion { padding: 12px 14px; } }
@media (prefers-reduced-motion: reduce) { .sel-opcion { transition: none; } }
`
