import { useState } from 'react'
import { ArrowLeft, Lock, Sparkles } from 'lucide-react'
import { ApiError, updateWhatsappBot, type BotModalidad, type BotModo, type MenuEstilo, type WhatsappBotEstado } from '@/lib/api'
import { MenuEditor, CSS_MENU } from './MenuEditor'
import { errorDelMenu, menuCambio, opcionesParaGuardar } from './menuBot'

// Mensajes → WhatsApp → "Orbi en WhatsApp": el panel donde el dueño enciende a Orbi como atención al público de su
// número, elige CÓMO atiende (todo con IA, menú + IA, o solo menú), en qué chats contesta, le deja indicaciones y ve cuánto
// lleva gastado del cupo del mes. Es una función del paquete Avanzado. Usa los colores de WhatsApp Web (variables --wa-*).

interface Props {
  bot: WhatsappBotEstado
  onCambio: (b: WhatsappBotEstado) => void
  onVolver: () => void
  onToast: (m: string) => void
}

const MAX_INSTRUCCIONES = 1000

const MODALIDADES: { id: BotModalidad; titulo: string; texto: string }[] = [
  { id: 'CONVERSACIONAL', titulo: 'Conversación', texto: 'Orbi contesta todo con inteligencia artificial, como una persona del equipo.' },
  { id: 'MENU_Y_CONVERSACION', titulo: 'Menú y conversación', texto: 'Saluda con un menú de opciones (catálogo, pedidos, promos…) y después conversa con IA.' },
  { id: 'SOLO_MENU', titulo: 'Solo menú', texto: 'Contesta únicamente con el menú y respuestas fijas. No usa IA: no gasta cupo.' },
]

export function OrbiWhatsapp({ bot, onCambio, onVolver, onToast }: Props) {
  const [guardando, setGuardando] = useState(false)
  const [instrucciones, setInstrucciones] = useState(bot.instrucciones ?? '')
  const [tope, setTope] = useState(bot.topeCreditos === null ? '' : String(bot.topeCreditos))
  const [estilo, setEstilo] = useState<MenuEstilo>(bot.menuEstilo)
  const [bienvenida, setBienvenida] = useState(bot.bienvenida ?? '')
  const [opciones, setOpciones] = useState(bot.menuOpciones)
  const [maxUnidades, setMaxUnidades] = useState(String(bot.maxUnidades))
  const [maxMonto, setMaxMonto] = useState(String(bot.maxMonto))

  const guardar = async (cambios: Parameters<typeof updateWhatsappBot>[0], aviso?: string, sincronizarFormulario = false) => {
    setGuardando(true)
    try {
      const nuevo = await updateWhatsappBot(cambios)
      onCambio(nuevo)
      // Solo se vuelve a llenar el formulario con lo guardado cuando lo que se guardó es el formulario: un interruptor no pisa lo que se está escribiendo.
      if (sincronizarFormulario) {
        setInstrucciones(nuevo.instrucciones ?? ''); setTope(nuevo.topeCreditos === null ? '' : String(nuevo.topeCreditos))
        setEstilo(nuevo.menuEstilo); setBienvenida(nuevo.bienvenida ?? ''); setOpciones(nuevo.menuOpciones)
        setMaxUnidades(String(nuevo.maxUnidades)); setMaxMonto(String(nuevo.maxMonto))
      }
      if (aviso) onToast(aviso)
    } catch (e) {
      onToast(e instanceof ApiError && e.status < 500 ? e.message : 'No se pudo guardar el cambio')
    } finally {
      setGuardando(false)
    }
  }

  const topeNumero = tope.trim() === '' ? null : Number(tope)
  const topeValido = topeNumero === null || (Number.isInteger(topeNumero) && topeNumero >= 0)
  const conMenu = bot.modalidad !== 'CONVERSACIONAL'
  const errorMenu = conMenu ? errorDelMenu(opciones, estilo) : null
  const cambioMenu = estilo !== bot.menuEstilo || (bienvenida.trim() || null) !== (bot.bienvenida ?? null) || menuCambio(opciones, bot.menuOpciones)
  const unidadesNum = Number(maxUnidades)
  const montoNum = Number(maxMonto)
  const topesValidos = Number.isInteger(unidadesNum) && unidadesNum >= 1 && unidadesNum <= 1000 && Number.isInteger(montoNum) && montoNum >= 1000
  const cambioTopes = unidadesNum !== bot.maxUnidades || montoNum !== bot.maxMonto
  const hayCambios = (instrucciones.trim() || null) !== (bot.instrucciones ?? null) || topeNumero !== bot.topeCreditos || cambioMenu || cambioTopes
  const bloqueado = !bot.disponible || !bot.conectado
  const { cupo } = bot

  const guardarCambios = () =>
    void guardar(
      {
        instrucciones: instrucciones.trim() || null,
        topeCreditos: topeNumero,
        ...(cambioTopes ? { maxUnidades: unidadesNum, maxMonto: montoNum } : {}),
        ...(cambioMenu ? { menuEstilo: estilo, bienvenida: bienvenida.trim() || null, menuOpciones: opcionesParaGuardar(opciones) } : {}),
      },
      'Cambios guardados',
      true,
    )

  return (
    <div className="orb-raiz">
      <style>{CSS}{CSS_MENU}</style>
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
          Conectá a Orbi a tu WhatsApp y atiende a tus clientes por vos: les cuenta qué productos tenés, precios, stock, promos, formas de pago, envíos y en qué estado está su pedido, siempre con los datos reales de tu tienda. Ante la duda no inventa: te pasa el chat.
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
          <p className="orb-titulo">Cómo atiende Orbi</p>
          {MODALIDADES.map((m) => (
            <label key={m.id} className={`orb-opcion${bot.modalidad === m.id ? ' orb-opcion-sel' : ''}`}>
              <input type="radio" name="orbi-modalidad" checked={bot.modalidad === m.id} disabled={guardando || bloqueado} onChange={() => void guardar({ modalidad: m.id })} />
              <span><strong>{m.titulo}</strong><small>{m.texto}</small></span>
            </label>
          ))}
        </section>

        {conMenu && (
          <section className="orb-bloque">
            <p className="orb-titulo">Estilo del menú</p>
            <div className="orb-estilos" role="radiogroup" aria-label="Estilo del menú">
              <label className={`orb-opcion${estilo === 'LISTA' ? ' orb-opcion-sel' : ''}`}>
                <input type="radio" name="orbi-estilo" checked={estilo === 'LISTA'} disabled={guardando || bloqueado} onChange={() => setEstilo('LISTA')} />
                <span><strong>Lista</strong><small>Un botón que abre las opciones (hasta 10).</small></span>
              </label>
              <label className={`orb-opcion${estilo === 'BOTONES' ? ' orb-opcion-sel' : ''}`}>
                <input type="radio" name="orbi-estilo" checked={estilo === 'BOTONES'} disabled={guardando || bloqueado} onChange={() => setEstilo('BOTONES')} />
                <span><strong>Botones</strong><small>Hasta 3 botones a la vista.</small></span>
              </label>
            </div>
            <MenuEditor
              estilo={estilo} bienvenida={bienvenida} bienvenidaPorDefecto={bot.bienvenidaPorDefecto} opciones={opciones} deshabilitado={bloqueado}
              onBienvenida={setBienvenida} onOpciones={setOpciones}
            />
            {errorMenu && <p className="orb-error" role="alert">{errorMenu}</p>}
          </section>
        )}

        {bot.modalidad !== 'SOLO_MENU' && (
          <section className="orb-bloque">
            <div className="orb-fila">
              <div>
                <p className="orb-titulo">Orbi puede tomar pedidos</p>
                <p className="orb-ayuda">
                  Cuando un cliente quiere comprar, Orbi arma el pedido con los datos reales de tu tienda, se lo muestra para que confirme y lo deja <strong>pendiente</strong> con “Coordinar por WhatsApp”: el equipo cierra el pago y la entrega. Orbi nunca cobra ni pide datos de pago.
                </p>
              </div>
              <button
                type="button" role="switch" aria-checked={bot.tomaPedidos} aria-label="Orbi puede tomar pedidos"
                className={`orb-switch${bot.tomaPedidos ? ' orb-switch-on' : ''}`}
                disabled={guardando || bloqueado || (!bot.pedidos.disponible && !bot.tomaPedidos)}
                onClick={() => void guardar({ tomaPedidos: !bot.tomaPedidos }, bot.tomaPedidos ? 'Orbi dejó de tomar pedidos' : 'Orbi ya puede tomar pedidos')}
              ><i /></button>
            </div>
            {!bot.pedidos.disponible && bot.pedidos.motivo && <p className="orb-error" role="status">{bot.pedidos.motivo}</p>}
            {(bot.tomaPedidos || bot.pedidos.disponible) && (
              <div className="orb-topes">
                <label htmlFor="orbi-max-unidades">
                  <span className="orb-titulo orb-chico">Máximo de unidades por pedido</span>
                  <input id="orbi-max-unidades" className="orb-campo orb-campo-chico" inputMode="numeric" value={maxUnidades} disabled={bloqueado} onChange={(e) => setMaxUnidades(e.target.value.replace(/[^0-9]/g, ''))} />
                </label>
                <label htmlFor="orbi-max-monto">
                  <span className="orb-titulo orb-chico">Monto máximo por pedido ($)</span>
                  <input id="orbi-max-monto" className="orb-campo orb-campo-chico" inputMode="numeric" value={maxMonto} disabled={bloqueado} onChange={(e) => setMaxMonto(e.target.value.replace(/[^0-9]/g, ''))} />
                </label>
              </div>
            )}
            {(bot.tomaPedidos || bot.pedidos.disponible) && <p className="orb-ayuda">Si alguien pide más que esto, Orbi no arma el pedido y te pasa el chat. Cuando Orbi deja un pedido pendiente, te llega un correo y queda en <strong>Ventas</strong> como cualquier otro.</p>}
          </section>
        )}
        {bot.modalidad === 'SOLO_MENU' && (
          <section className="orb-bloque">
            <p className="orb-titulo">Pedidos por chat</p>
            <p className="orb-ayuda">Para que Orbi tome pedidos, elegí “Conversación” o “Menú y conversación”: en “Solo menú” no usa inteligencia artificial y no puede armar pedidos.</p>
          </section>
        )}

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

        {bot.modalidad !== 'SOLO_MENU' && (
          <section className="orb-bloque">
            <label className="orb-titulo" htmlFor="orbi-indicaciones">Qué querés que sepa Orbi</label>
            <p className="orb-ayuda">Opcional: tono, promociones del mes, políticas propias. Orbi lo tiene en cuenta en cada respuesta con IA.</p>
            <textarea
              id="orbi-indicaciones" className="orb-campo" rows={4} maxLength={MAX_INSTRUCCIONES} value={instrucciones}
              onChange={(e) => setInstrucciones(e.target.value)} disabled={bloqueado}
              placeholder="Ej.: Hablá de vos. Este mes hay 10% de descuento pagando en efectivo."
            />
            <p className="orb-contador">{instrucciones.length}/{MAX_INSTRUCCIONES}</p>
          </section>
        )}

        <section className="orb-bloque">
          <p className="orb-titulo">Cupo de este mes</p>
          <div className="orb-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={cupo.porcentaje} aria-label="Cupo usado">
            <i style={{ width: `${cupo.porcentaje}%` }} className={cupo.porcentaje >= 90 ? 'orb-barra-alta' : ''} />
          </div>
          <p className="orb-ayuda">
            Usaste <strong>{cupo.usados.toLocaleString('es-AR')}</strong> de {cupo.limite.toLocaleString('es-AR')} créditos ({cupo.porcentaje}%). Se renueva el 1° de cada mes. Si se agota, Orbi deja de contestar con IA y te avisa en los chats; el menú sigue funcionando.
          </p>
          <label className="orb-titulo orb-chico" htmlFor="orbi-tope">Tope propio (opcional)</label>
          <input
            id="orbi-tope" className="orb-campo orb-campo-chico" inputMode="numeric" value={tope} disabled={bloqueado}
            onChange={(e) => setTope(e.target.value.replace(/[^0-9]/g, ''))} placeholder={`Hasta ${cupo.total.toLocaleString('es-AR')}`}
          />
          <p className="orb-ayuda">Si querés gastar menos que tu cupo, poné acá un número menor.</p>
        </section>

        <button type="button" className="orb-guardar" disabled={guardando || bloqueado || !hayCambios || !topeValido || !topesValidos || !!errorMenu} onClick={guardarCambios}>
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
.orb-error { margin: 0; font-size: 13px; line-height: 1.5; color: var(--wa-error); }
.orb-switch { position: relative; width: 44px; height: 26px; flex-shrink: 0; padding: 0; border: none; border-radius: 13px; cursor: pointer; background: #8696a0; transition: background-color 150ms; }
.orb-switch i { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform 150ms; }
.orb-switch-on { background: var(--wa-verde); }
.orb-switch-on i { transform: translateX(18px); }
.orb-switch:disabled { opacity: 0.5; cursor: not-allowed; }
.orb-opcion { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border: 1px solid var(--wa-borde); border-radius: 8px; cursor: pointer; font-size: 14px; color: var(--wa-texto); }
.orb-opcion-sel { border-color: var(--wa-verde); }
.orb-opcion input { margin-top: 4px; accent-color: var(--wa-verde); }
.orb-opcion small { display: block; margin-top: 2px; font-size: 12.5px; line-height: 1.45; color: var(--wa-texto-2); }
.orb-topes { display: flex; flex-wrap: wrap; gap: 14px; }
.orb-topes label { display: flex; flex-direction: column; gap: 4px; }
.orb-estilos { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.orb-campo { width: 100%; box-sizing: border-box; padding: 9px 12px; border: 1px solid var(--wa-borde); border-radius: 8px; resize: vertical; background: var(--wa-entrada); font: inherit; font-size: 14px; line-height: 1.5; color: var(--wa-texto); }
.orb-campo-chico { width: 180px; }
.orb-campo:disabled { opacity: 0.6; cursor: not-allowed; }
.orb-contador { margin: 0; text-align: right; font-size: 12px; color: var(--wa-texto-2); }
.orb-barra { height: 8px; border-radius: 4px; overflow: hidden; background: var(--wa-borde); }
.orb-barra i { display: block; height: 100%; border-radius: 4px; background: var(--wa-verde); transition: width 300ms; }
.orb-barra .orb-barra-alta { background: var(--wa-error); }
.orb-guardar { align-self: flex-start; height: 40px; padding: 0 22px; border: none; border-radius: 20px; cursor: pointer; font-size: 14.5px; font-weight: 500; color: #fff; background: var(--wa-verde); }
.orb-guardar:disabled { opacity: 0.4; cursor: not-allowed; }
@media (max-width: 768px) { .orb-volver { display: inline-flex; } .orb-fila { align-items: flex-start; } .orb-estilos { grid-template-columns: minmax(0, 1fr); } }
@media (prefers-reduced-motion: reduce) { .orb-switch, .orb-switch i, .orb-barra i { transition: none; } }
`
