import { useState } from 'react'
import { ArrowLeft, Lock, Sparkles } from 'lucide-react'
import { ApiError, updateWhatsappBot, type BotModo, type WhatsappBotEstado } from '@/lib/api'

// Mensajes → WhatsApp → "Orbi en WhatsApp": el panel donde el dueño enciende a Orbi como atención al público de su
// número, elige en qué chats contesta, le deja indicaciones y ve cuánto lleva gastado del cupo del mes. Es una función del
// paquete Avanzado. Usa los colores de WhatsApp Web (variables --wa-*), igual que el resto de la bandeja.

interface Props {
  bot: WhatsappBotEstado
  onCambio: (b: WhatsappBotEstado) => void
  onVolver: () => void
  onToast: (m: string) => void
}

const MAX_INSTRUCCIONES = 1000

export function OrbiWhatsapp({ bot, onCambio, onVolver, onToast }: Props) {
  const [guardando, setGuardando] = useState(false)
  const [instrucciones, setInstrucciones] = useState(bot.instrucciones ?? '')
  const [tope, setTope] = useState(bot.topeCreditos === null ? '' : String(bot.topeCreditos))

  const guardar = async (cambios: Parameters<typeof updateWhatsappBot>[0], aviso?: string) => {
    setGuardando(true)
    try {
      onCambio(await updateWhatsappBot(cambios))
      if (aviso) onToast(aviso)
    } catch (e) {
      onToast(e instanceof ApiError && e.status < 500 ? e.message : 'No se pudo guardar el cambio')
    } finally {
      setGuardando(false)
    }
  }

  const topeNumero = tope.trim() === '' ? null : Number(tope)
  const topeValido = topeNumero === null || (Number.isInteger(topeNumero) && topeNumero >= 0)
  const hayCambios = (instrucciones.trim() || null) !== (bot.instrucciones ?? null) || topeNumero !== bot.topeCreditos
  const bloqueado = !bot.disponible || !bot.conectado
  const { cupo } = bot

  return (
    <div className="orb-raiz">
      <style>{CSS}</style>
      <header className="wa-cabecera orb-cabecera">
        <button type="button" className="wa-icono orb-volver" onClick={onVolver} aria-label="Volver a los chats"><ArrowLeft size={20} /></button>
        <span className="orb-icono" aria-hidden><Sparkles size={18} /></span>
        <div className="wa-cuenta">
          <p className="wa-cuenta-titulo">Orbi en WhatsApp</p>
          <p className="wa-cuenta-sub">Atención al público con inteligencia artificial</p>
        </div>
      </header>

      <div className="orb-cuerpo">
        <p className="orb-texto">
          Conectá a Orbi a tu WhatsApp y atiende a tus clientes por vos: les cuenta qué productos tenés, precios, stock, formas de pago, envíos y en qué estado está su pedido, siempre con los datos reales de tu tienda. Ante la duda no inventa: te pasa el chat.
        </p>

        {!bot.disponible && (
          <div className="orb-aviso" role="status">
            <Lock size={16} aria-hidden />
            <span>Orbi en WhatsApp es una función avanzada del <strong>paquete Avanzado</strong>. Cuando lo tengas activo, la encendés desde acá.</span>
          </div>
        )}
        {bot.disponible && !bot.conectado && (
          <div className="orb-aviso" role="status"><span>Primero conectá tu cuenta de WhatsApp Business.</span></div>
        )}

        <section className="orb-bloque">
          <div className="orb-fila">
            <div>
              <p className="orb-titulo">Orbi atiende mi WhatsApp</p>
              <p className="orb-ayuda">Interruptor general. Apagado, Orbi no contesta en ningún chat.</p>
            </div>
            <button
              type="button" role="switch" aria-checked={bot.enabled} aria-label="Orbi atiende mi WhatsApp"
              className={`orb-switch${bot.enabled ? ' orb-switch-on' : ''}`}
              disabled={guardando || (bloqueado && !bot.enabled)}
              onClick={() => void guardar({ enabled: !bot.enabled }, bot.enabled ? 'Orbi dejó de atender WhatsApp' : 'Orbi ya atiende WhatsApp')}
            ><i /></button>
          </div>
        </section>

        <section className="orb-bloque" aria-disabled={!bot.enabled}>
          <p className="orb-titulo">En qué chats contesta</p>
          <label className={`orb-opcion${bot.modo === 'SELECCIONADOS' ? ' orb-opcion-sel' : ''}`}>
            <input type="radio" name="orbi-modo" checked={bot.modo === 'SELECCIONADOS'} disabled={guardando || bloqueado} onChange={() => void guardar({ modo: 'SELECCIONADOS' as BotModo })} />
            <span><strong>Solo los que yo active</strong> (recomendado)<small>Dentro de cada chat tocás “Activar Orbi”. Los demás los atendés vos.</small></span>
          </label>
          <label className={`orb-opcion${bot.modo === 'TODOS' ? ' orb-opcion-sel' : ''}`}>
            <input type="radio" name="orbi-modo" checked={bot.modo === 'TODOS'} disabled={guardando || bloqueado} onChange={() => void guardar({ modo: 'TODOS' as BotModo })} />
            <span><strong>Todos los chats</strong><small>Orbi contesta a cualquiera que escriba, salvo en los chats donde lo apagues.</small></span>
          </label>
          <p className="orb-ayuda orb-nota">
            Cuando escribís vos en un chat (desde el panel o desde el celular), Orbi se calla en ese chat y <strong>no vuelve solo</strong>: lo reactivás con un clic cuando quieras. Así nunca se pisan tus respuestas con las suyas.
          </p>
        </section>

        <section className="orb-bloque">
          <label className="orb-titulo" htmlFor="orbi-indicaciones">Qué querés que sepa Orbi</label>
          <p className="orb-ayuda">Opcional: tono, promociones del mes, políticas propias. Orbi lo tiene en cuenta en cada respuesta.</p>
          <textarea
            id="orbi-indicaciones" className="orb-campo" rows={4} maxLength={MAX_INSTRUCCIONES} value={instrucciones}
            onChange={(e) => setInstrucciones(e.target.value)} disabled={bloqueado}
            placeholder="Ej.: Hablá de vos. Este mes hay 10% de descuento pagando en efectivo."
          />
          <p className="orb-contador">{instrucciones.length}/{MAX_INSTRUCCIONES}</p>
        </section>

        <section className="orb-bloque">
          <p className="orb-titulo">Cupo de este mes</p>
          <div className="orb-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={cupo.porcentaje} aria-label="Cupo usado">
            <i style={{ width: `${cupo.porcentaje}%` }} className={cupo.porcentaje >= 90 ? 'orb-barra-alta' : ''} />
          </div>
          <p className="orb-ayuda">
            Usaste <strong>{cupo.usados.toLocaleString('es-AR')}</strong> de {cupo.limite.toLocaleString('es-AR')} créditos ({cupo.porcentaje}%). Se renueva el 1° de cada mes. Si se agota, Orbi deja de contestar y te avisa en los chats.
          </p>
          <label className="orb-titulo orb-chico" htmlFor="orbi-tope">Tope propio (opcional)</label>
          <input
            id="orbi-tope" className="orb-campo orb-campo-chico" inputMode="numeric" value={tope} disabled={bloqueado}
            onChange={(e) => setTope(e.target.value.replace(/[^0-9]/g, ''))} placeholder={`Hasta ${cupo.total.toLocaleString('es-AR')}`}
          />
          <p className="orb-ayuda">Si querés gastar menos que tu cupo, poné acá un número menor.</p>
        </section>

        <button type="button" className="orb-guardar" disabled={guardando || bloqueado || !hayCambios || !topeValido} onClick={() => void guardar({ instrucciones: instrucciones.trim() || null, topeCreditos: topeNumero }, 'Cambios guardados')}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

const CSS = `
.orb-raiz { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--wa-cabecera); }
.orb-cabecera { gap: 10px; }
.orb-volver { display: none; }
.orb-icono { width: 36px; height: 36px; flex-shrink: 0; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; background: var(--wa-verde); }
.orb-cuerpo { flex: 1; min-height: 0; overflow-y: auto; padding: 20px max(16px, 6%) 28px; display: flex; flex-direction: column; gap: 12px; }
.orb-texto { margin: 0; max-width: 62ch; font-size: 14px; line-height: 1.6; color: var(--wa-texto-2); }
.orb-aviso { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 8px; font-size: 13.5px; line-height: 1.5; color: var(--wa-aviso-texto); background: var(--wa-aviso); }
.orb-aviso svg { flex-shrink: 0; margin-top: 2px; }
.orb-bloque { padding: 16px 18px; border-radius: 10px; background: var(--wa-panel); box-shadow: var(--wa-sombra); display: flex; flex-direction: column; gap: 8px; }
.orb-bloque[aria-disabled="true"] { opacity: 0.6; }
.orb-fila { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.orb-titulo { margin: 0; font-size: 15px; font-weight: 500; color: var(--wa-texto); }
.orb-chico { margin-top: 6px; font-size: 14px; }
.orb-ayuda { margin: 0; font-size: 13px; line-height: 1.5; color: var(--wa-texto-2); }
.orb-ayuda strong { font-weight: 600; color: var(--wa-texto); }
.orb-nota { margin-top: 4px; }
.orb-switch { position: relative; width: 44px; height: 26px; flex-shrink: 0; padding: 0; border: none; border-radius: 13px; cursor: pointer; background: #8696a0; transition: background-color 150ms; }
.orb-switch i { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform 150ms; }
.orb-switch-on { background: var(--wa-verde); }
.orb-switch-on i { transform: translateX(18px); }
.orb-switch:disabled { opacity: 0.5; cursor: not-allowed; }
.orb-opcion { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border: 1px solid var(--wa-borde); border-radius: 8px; cursor: pointer; font-size: 14px; color: var(--wa-texto); }
.orb-opcion-sel { border-color: var(--wa-verde); }
.orb-opcion input { margin-top: 4px; accent-color: var(--wa-verde); }
.orb-opcion small { display: block; margin-top: 2px; font-size: 12.5px; line-height: 1.45; color: var(--wa-texto-2); }
.orb-campo { width: 100%; box-sizing: border-box; padding: 9px 12px; border: 1px solid var(--wa-borde); border-radius: 8px; resize: vertical; background: var(--wa-entrada); font: inherit; font-size: 14px; line-height: 1.5; color: var(--wa-texto); }
.orb-campo-chico { width: 180px; }
.orb-campo:disabled { opacity: 0.6; cursor: not-allowed; }
.orb-contador { margin: 0; text-align: right; font-size: 12px; color: var(--wa-texto-2); }
.orb-barra { height: 8px; border-radius: 4px; overflow: hidden; background: var(--wa-borde); }
.orb-barra i { display: block; height: 100%; border-radius: 4px; background: var(--wa-verde); transition: width 300ms; }
.orb-barra .orb-barra-alta { background: var(--wa-error); }
.orb-guardar { align-self: flex-start; height: 40px; padding: 0 22px; border: none; border-radius: 20px; cursor: pointer; font-size: 14.5px; font-weight: 500; color: #fff; background: var(--wa-verde); }
.orb-guardar:disabled { opacity: 0.4; cursor: not-allowed; }
@media (max-width: 768px) { .orb-volver { display: inline-flex; } .orb-fila { align-items: flex-start; } }
@media (prefers-reduced-motion: reduce) { .orb-switch, .orb-switch i, .orb-barra i { transition: none; } }
`
