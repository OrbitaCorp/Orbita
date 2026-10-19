import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Archive, ArrowLeft, EllipsisVertical, FileText, ImagePlus, Search, SendHorizontal, Smile, Sparkles, X } from 'lucide-react'
import {
  ApiError, getConversationMessages, getWhatsappBot, sendConversationImage, sendConversationMessage, setConversationBot,
  type ChatMessage, type ConversationRow, type WhatsappBotEstado, type WhatsappEstado,
} from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { resolverVariables, type Plantilla } from '../mock/mensajes.mock'
import { OrbiWhatsapp } from './OrbiWhatsapp'
import {
  armarFilas, colorDeAvatar, errorDeFoto, estadoDeEntrega, fotoDelMensaje, hora, iniciales, marcaDeBot, marcaDeLaLista, orbiAtiende, pieDeFoto, puedeResponderHasta,
  TIPOS_DE_FOTO, vistaPreviaDeLaLista, type EstadoDeEntrega,
} from './utilidades'

// Mensajes → WhatsApp: la bandeja de WhatsApp con el aspecto de WhatsApp Web (el de escritorio): lista de chats a la
// izquierda, con buscador y filtros; el chat a la derecha, con su fondo, las burbujas verdes y blancas con colita, los
// tildes de entrega, los separadores de día y la barra de escribir abajo. Los colores y las medidas son los de
// WhatsApp a propósito (no los del panel), en claro y en oscuro.
//
// Lo que hace es real: lee y manda por la API de WhatsApp Business (texto y fotos, solo dentro de las 24 horas del
// último mensaje del cliente, que es la regla de WhatsApp), muestra las fotos que llegan, archiva, y abre la ficha del
// cliente. El audio, el video y los documentos no se ven: llegan como una etiqueta.

const POLL_MS = 2500
const MAX_TEXTO = 4096
// El pie de una foto puede tener hasta 1024 caracteres.
const MAX_PIE = 1024
const EMOJIS = [
  '😀', '😃', '😄', '😁', '😊', '🙂', '😉', '😍', '🥰', '😘', '😎', '🤗', '🤩', '😅', '😂', '🤣',
  '🙏', '👍', '👌', '👏', '🙌', '💪', '🤝', '👋', '❤️', '🧡', '💛', '💚', '💙', '🔥', '✨', '🎉',
  '🛍️', '📦', '🚚', '💳', '✅', '⭐', '🕐', '📍', '😢', '😮', '🤔', '😬', '🙈', '💯', '🎁', '👀',
]

interface Props {
  charlas: ConversationRow[]
  estado: Extract<WhatsappEstado, { connected: true }>
  convId: string | null
  plantillas: Plantilla[]
  onAbrir: (id: string) => void
  onCerrar: () => void
  onArchivar: (id: string) => void
  onPerfil: (customerId: string) => void
  onToast: (m: string) => void
  /** Abre la ventana para ver o desconectar la cuenta. */
  onAdministrar: () => void
  /** Se mandó un mensaje: que la lista se actualice. */
  onEnviado: () => void
}

type Filtro = 'todos' | 'no-leidos' | 'archivados'

export function WhatsAppWeb({ charlas, estado, convId, plantillas, onAbrir, onCerrar, onArchivar, onPerfil, onToast, onAdministrar, onEnviado }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const activa = charlas.find((c) => c.id === convId) ?? null
  // Orbi como atención al público: su configuración (null si no se pudo leer, por ejemplo un miembro sin permiso) y si se
  // está viendo el panel para configurarlo.
  const [bot, setBot] = useState<WhatsappBotEstado | null>(null)
  const [verOrbi, setVerOrbi] = useState(false)
  useEffect(() => { getWhatsappBot().then(setBot).catch(() => setBot(null)) }, [])

  useEffect(() => {
    if (!menu) return
    const afuera = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false) }
    const tecla = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('mousedown', afuera)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', afuera); document.removeEventListener('keydown', tecla) }
  }, [menu])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return charlas.filter((c) => {
      if (filtro === 'archivados' ? !c.isArchived : c.isArchived) return false
      if (filtro === 'no-leidos' && !c.isUnread) return false
      return !q || c.customerName.toLowerCase().includes(q) || (c.lastMessage?.text ?? '').toLowerCase().includes(q)
    })
  }, [charlas, busqueda, filtro])
  const noLeidos = charlas.filter((c) => c.isUnread && !c.isArchived).length
  const archivadas = charlas.filter((c) => c.isArchived).length

  return (
    <div className={`wa-raiz${activa || (verOrbi && bot) ? ' wa-con-chat' : ''}`}>
      <style>{CSS}</style>

      <aside className="wa-lista" aria-label="Chats de WhatsApp">
        <header className="wa-cabecera">
          <span className="wa-avatar wa-avatar-propio" aria-hidden><IconoWhatsapp size={22} /></span>
          <div className="wa-cuenta">
            <p className="wa-cuenta-titulo">WhatsApp</p>
            <p className="wa-cuenta-sub">{estado.displayPhone ?? estado.phoneNumberId}</p>
          </div>
          <div className="wa-menu-caja" ref={menuRef}>
            <button type="button" className="wa-icono" aria-label="Menú" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><EllipsisVertical size={20} /></button>
            {menu && (
              <div className="wa-menu" role="menu">
                {bot && <button type="button" role="menuitem" onClick={() => { setMenu(false); setVerOrbi(true); onCerrar() }}>Orbi en WhatsApp</button>}
                <button type="button" role="menuitem" onClick={() => { setMenu(false); onAdministrar() }}>Administrar la cuenta conectada</button>
              </div>
            )}
          </div>
        </header>

        <div className="wa-buscar-caja">
          <label className="wa-buscar">
            <Search size={16} aria-hidden />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar un chat" aria-label="Buscar un chat" />
            {busqueda && <button type="button" aria-label="Borrar la búsqueda" onClick={() => setBusqueda('')}><X size={15} /></button>}
          </label>
        </div>

        <div className="wa-filtros" role="group" aria-label="Filtrar chats">
          <button type="button" aria-pressed={filtro === 'todos'} className={filtro === 'todos' ? 'wa-filtro-activo' : ''} onClick={() => setFiltro('todos')}>Todos</button>
          <button type="button" aria-pressed={filtro === 'no-leidos'} className={filtro === 'no-leidos' ? 'wa-filtro-activo' : ''} onClick={() => setFiltro('no-leidos')}>
            No leídos{noLeidos > 0 ? ` ${noLeidos}` : ''}
          </button>
          {archivadas > 0 && (
            <button type="button" aria-pressed={filtro === 'archivados'} className={filtro === 'archivados' ? 'wa-filtro-activo' : ''} onClick={() => setFiltro('archivados')}>Archivados</button>
          )}
        </div>

        <ul className="wa-chats">
          {charlas.length === 0 && (
            <li className="wa-vacio">Todavía no te escribió nadie por WhatsApp. Cuando un cliente te mande un mensaje, el chat aparece acá.</li>
          )}
          {charlas.length > 0 && visibles.length === 0 && (
            <li className="wa-vacio">{busqueda ? 'No se encontró ningún chat.' : filtro === 'no-leidos' ? 'No tenés chats sin leer.' : 'No hay chats acá.'}</li>
          )}
          {visibles.map((c) => {
            const m = c.lastMessage
            const entrega = m ? estadoDeEntrega(m) : null
            return (
              <li key={c.id}>
                <button type="button" className={`wa-fila${c.id === convId ? ' wa-fila-activa' : ''}`} onClick={() => { setVerOrbi(false); onAbrir(c.id) }} aria-current={c.id === convId}>
                  <Avatar nombre={c.customerName} foto={c.customerAvatar} />
                  <span className="wa-fila-cuerpo">
                    <span className="wa-fila-arriba">
                      <span className="wa-fila-nombre">{c.customerName}</span>
                      {marcaDeBot(bot, c.bot) === 'atencion' && <span className="wa-marca wa-marca-atencion">Necesita atención</span>}
                      {marcaDeBot(bot, c.bot) === 'orbi' && <span className="wa-marca">Orbi</span>}
                      <span className={`wa-fila-hora${c.isUnread ? ' wa-fila-hora-nueva' : ''}`}>{marcaDeLaLista(m?.createdAt ?? c.updatedAt)}</span>
                    </span>
                    <span className="wa-fila-abajo">
                      <span className="wa-fila-preview">
                        {entrega && <Tildes estado={entrega} chico />}
                        <span>{vistaPreviaDeLaLista(m)}</span>
                      </span>
                      {c.isUnread && <span className="wa-punto" role="img" aria-label="Sin leer" />}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <section className="wa-chat" aria-label="Chat">
        {verOrbi && bot ? (
          <OrbiWhatsapp bot={bot} onCambio={(b) => { setBot(b); onEnviado() }} onVolver={() => setVerOrbi(false)} onToast={onToast} />
        ) : activa ? (
          <Chat
            key={activa.id}
            charla={activa}
            plantillas={plantillas}
            onVolver={onCerrar}
            onArchivar={() => onArchivar(activa.id)}
            onPerfil={() => onPerfil(activa.customerId)}
            onToast={onToast}
            onEnviado={onEnviado}
            bot={bot}
            onConfigurarOrbi={() => { setVerOrbi(true); onCerrar() }}
          />
        ) : (
          <div className="wa-bienvenida">
            <span className="wa-bienvenida-icono" aria-hidden><IconoWhatsapp size={44} /></span>
            <h2>WhatsApp en Órbita</h2>
            <p>Tus clientes te escriben a <strong>{estado.displayPhone ?? 'tu número de WhatsApp Business'}</strong> y vos les respondés desde acá, sin salir del panel.</p>
            <p className="wa-bienvenida-nota">Elegí un chat de la lista para empezar. WhatsApp solo permite responder dentro de las 24 horas del último mensaje del cliente.</p>
            {bot && (
              <button type="button" className="wa-orbi-cta" onClick={() => setVerOrbi(true)}>
                <Sparkles size={16} aria-hidden />
                {bot.enabled ? 'Configurar Orbi en WhatsApp' : 'Conectá a Orbi a tu WhatsApp'}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Chat ──────────────────────────────────────────────────────────────────────

interface ChatProps {
  charla: ConversationRow
  plantillas: Plantilla[]
  onVolver: () => void
  onArchivar: () => void
  onPerfil: () => void
  onToast: (m: string) => void
  onEnviado: () => void
  /** La configuración de Orbi para WhatsApp (null si no se pudo leer). */
  bot: WhatsappBotEstado | null
  /** Abre el panel para encender a Orbi en general (se usa cuando todavía está apagado). */
  onConfigurarOrbi: () => void
}

type Panel = 'emojis' | 'plantillas' | null

function Chat({ charla, plantillas, onVolver, onArchivar, onPerfil, onToast, onEnviado, bot, onConfigurarOrbi }: ChatProps) {
  const { user } = useAuth()
  const tienda = user && 'business' in user ? user.business.name : undefined
  const [mensajes, setMensajes] = useState<ChatMessage[] | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [panel, setPanel] = useState<Panel>(null)
  // La foto elegida para mandar (con su vista previa) y la foto abierta en grande.
  const [foto, setFoto] = useState<{ archivo: File; vista: string } | null>(null)
  const [visor, setVisor] = useState<string | null>(null)
  const selector = useRef<HTMLInputElement>(null)
  // Orbi en este chat: se enciende, se apaga o se reactiva a mano.
  const [cambiandoBot, setCambiandoBot] = useState(false)
  const atiendeOrbi = orbiAtiende(bot, charla.bot?.estado)
  const estadoBot = charla.bot?.estado
  const [ahora, setAhora] = useState(() => Date.now())
  const lista = useRef<HTMLDivElement>(null)
  const cerca = useRef(true)
  const entrada = useRef<HTMLTextAreaElement>(null)
  const barra = useRef<HTMLDivElement>(null)
  const montado = useRef(true)
  // En desarrollo React monta, desmonta y vuelve a montar: por eso se vuelve a poner en true al montar.
  useEffect(() => { montado.current = true; return () => { montado.current = false } }, [])
  // La vista previa es una dirección temporal del navegador: se libera al cambiar de foto o al salir.
  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto.vista) }, [foto])
  useEffect(() => {
    if (!visor) return
    const tecla = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setVisor(null) }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [visor])

  // Mensajes reales + sondeo mientras el chat está abierto (y al volver a la pestaña, que el navegador frena).
  useEffect(() => {
    // Bandeja de WhatsApp: solo los mensajes de WhatsApp (los del chat de la tienda están en Mensajes locales).
    const cargar = () => getConversationMessages(charla.id, 'WHATSAPP').then((r) => { if (montado.current) setMensajes(r) }).catch(() => undefined)
    void cargar()
    const t = setInterval(cargar, POLL_MS)
    const alVolver = () => { if (document.visibilityState === 'visible') void cargar() }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver); window.removeEventListener('focus', alVolver) }
  }, [charla.id])
  // El plazo de 24 h se vence con el tiempo, aunque no llegue nada.
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 30_000); return () => clearInterval(t) }, [])

  // Se baja solo si ya se estaba mirando lo último.
  useEffect(() => {
    const el = lista.current
    if (el && cerca.current) el.scrollTop = el.scrollHeight
  }, [mensajes])
  const alScrollear = () => {
    const el = lista.current
    if (el) cerca.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90
  }

  // Los paneles de emojis y plantillas se cierran al tocar afuera o con Escape.
  useEffect(() => {
    if (!panel) return
    const afuera = (e: MouseEvent) => { if (barra.current && !barra.current.contains(e.target as Node)) setPanel(null) }
    const tecla = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setPanel(null) }
    document.addEventListener('mousedown', afuera)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', afuera); document.removeEventListener('keydown', tecla) }
  }, [panel])

  const hasta = useMemo(() => puedeResponderHasta(mensajes ?? [], ahora), [mensajes, ahora])
  const puedeResponder = hasta !== null
  const limite = foto ? MAX_PIE : MAX_TEXTO
  const puedeEnviar = puedeResponder && !enviando && (foto !== null || texto.trim().length > 0) && texto.length <= limite
  const filas = useMemo(() => armarFilas(mensajes ?? []), [mensajes])

  const enviar = async () => {
    if (!puedeEnviar) return
    setEnviando(true)
    try {
      const nuevo = foto
        ? await sendConversationImage(charla.id, { foto: foto.archivo, texto })
        : await sendConversationMessage(charla.id, { text: texto.trim(), canal: 'WHATSAPP' })
      if (!montado.current) return
      cerca.current = true
      setMensajes((previos) => [...(previos ?? []), nuevo])
      setTexto('')
      setFoto(null)
      setPanel(null)
      onEnviado()
    } catch (e) {
      // Los rechazos de WhatsApp (ventana vencida, número inválido) traen el motivo: se muestra.
      onToast(e instanceof ApiError && e.status < 500 ? e.message : foto ? 'No se pudo enviar la foto' : 'No se pudo enviar el mensaje')
    } finally {
      if (montado.current) setEnviando(false)
    }
  }

  const alTeclear = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void enviar() }
  }
  const cambiarOrbi = async (estado: 'ON' | 'OFF') => {
    setCambiandoBot(true)
    try {
      await setConversationBot(charla.id, estado)
      onEnviado()
      onToast(estado === 'ON' ? 'Orbi atiende este chat' : 'Orbi dejó este chat: lo atendés vos')
    } catch (e) {
      onToast(e instanceof ApiError && e.status < 500 ? e.message : 'No se pudo cambiar a Orbi en este chat')
    } finally {
      if (montado.current) setCambiandoBot(false)
    }
  }
  const poner = (t: string) => { setTexto((a) => `${a}${t}`.slice(0, limite)); entrada.current?.focus() }

  const elegirFoto = (archivo: File | undefined) => {
    if (!archivo) return
    const motivo = errorDeFoto(archivo)
    if (motivo) { onToast(motivo); return }
    setFoto({ archivo, vista: URL.createObjectURL(archivo) })
    setTexto((t) => t.slice(0, MAX_PIE))
    setPanel(null)
    entrada.current?.focus()
  }

  return (
    <div className="wa-chat-interno">
      <header className="wa-cabecera wa-cabecera-chat">
        <button type="button" className="wa-icono wa-volver" onClick={onVolver} aria-label="Volver a los chats"><ArrowLeft size={20} /></button>
        <button type="button" className="wa-chat-persona" onClick={onPerfil} title="Ver la ficha del cliente">
          <Avatar nombre={charla.customerName} foto={charla.customerAvatar} />
          <span className="wa-cuenta">
            <span className="wa-cuenta-titulo">{charla.customerName}</span>
            <span className="wa-cuenta-sub">
              {mensajes === null ? ' ' : puedeResponder && hasta ? `Podés responder hasta las ${hora(hasta)}` : 'Pasaron más de 24 horas desde su último mensaje'}
            </span>
          </span>
        </button>
        {bot && (
          <button
            type="button" className={`wa-orbi-btn${atiendeOrbi ? ' wa-orbi-btn-on' : ''}`} disabled={cambiandoBot}
            aria-pressed={atiendeOrbi}
            onClick={() => (bot.enabled ? void cambiarOrbi(atiendeOrbi ? 'OFF' : 'ON') : onConfigurarOrbi())}
            title={!bot.enabled ? 'Primero encendé a Orbi para WhatsApp' : atiendeOrbi ? 'Orbi está contestando acá: tocá para atenderlo vos' : 'Que Orbi atienda este chat'}
          >
            <Sparkles size={15} aria-hidden />
            <span>{atiendeOrbi ? 'Orbi atiende' : 'Activar Orbi'}</span>
          </button>
        )}
        <button type="button" className="wa-icono" onClick={onArchivar} aria-label={charla.isArchived ? 'Desarchivar el chat' : 'Archivar el chat'} title={charla.isArchived ? 'Desarchivar' : 'Archivar'}>
          <Archive size={19} />
        </button>
      </header>

      {bot?.enabled && (estadoBot === 'PAUSADO' || estadoBot === 'DERIVADO') && (
        <div className={`wa-orbi-aviso${estadoBot === 'DERIVADO' ? ' wa-orbi-aviso-atencion' : ''}`} role="status">
          <span>
            <strong>{estadoBot === 'DERIVADO' ? 'Orbi pidió que lo atienda una persona.' : 'Orbi está en pausa en este chat.'}</strong>{' '}
            {charla.bot?.motivo ?? ''}
          </span>
          <button type="button" disabled={cambiandoBot} onClick={() => void cambiarOrbi('ON')}>Reactivar Orbi</button>
        </div>
      )}

      <div className="wa-mensajes" ref={lista} onScroll={alScrollear}>
        <p className="wa-aviso-info">Los mensajes salen por tu número de WhatsApp Business y llegan a tu cliente como cualquier otro chat.</p>
        {mensajes === null && <p className="wa-centro">Cargando…</p>}
        {mensajes?.length === 0 && <p className="wa-centro">Todavía no hay mensajes en este chat.</p>}
        {filas.map(({ mensaje: m, dia, primeroDeRacha }) => {
          const propio = m.sender === 'STORE'
          const entrega = estadoDeEntrega(m)
          return (
            <div key={m.id}>
              {dia && <p className="wa-dia"><span>{dia}</span></p>}
              <div className={`wa-linea ${propio ? 'wa-linea-propia' : 'wa-linea-ajena'}${primeroDeRacha ? ' wa-linea-primera' : ''}`}>
                <div className={`wa-burbuja ${propio ? 'wa-burbuja-propia' : 'wa-burbuja-ajena'}${fotoDelMensaje(m) ? ' wa-burbuja-con-foto' : ''}${primeroDeRacha ? ' wa-burbuja-colita' : ''}${entrega === 'fallo' ? ' wa-burbuja-fallo' : ''}`}>
                  {fotoDelMensaje(m) ? (
                    <>
                      <button type="button" className="wa-foto" onClick={() => setVisor(fotoDelMensaje(m))} aria-label="Ver la foto en grande">
                        <img src={fotoDelMensaje(m) ?? ''} alt={pieDeFoto(m) || 'Foto'} loading="lazy" />
                      </button>
                      {pieDeFoto(m) && <span className="wa-burbuja-texto wa-foto-pie">{pieDeFoto(m)}</span>}
                      <span className={`wa-burbuja-meta${pieDeFoto(m) ? ' wa-foto-pie' : ' wa-meta-sobre-foto'}`}>
                        {hora(m.createdAt)}
                        {entrega && <Tildes estado={entrega} />}
                      </span>
                    </>
                  ) : (
                    <>
                      {m.viaOrbi && <span className="wa-orbi-tag"><Sparkles size={11} aria-hidden /> Orbi</span>}
                      <span className="wa-burbuja-texto">{m.text}</span>
                      <span className="wa-burbuja-meta">
                        {hora(m.createdAt)}
                        {entrega && <Tildes estado={entrega} />}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {entrega === 'fallo' && <p className="wa-fallo">No se pudo entregar este mensaje.</p>}
            </div>
          )
        })}
      </div>

      {!puedeResponder && mensajes !== null && (
        <p className="wa-plazo" role="status">
          Pasaron más de 24 horas desde el último mensaje de {charla.customerName}. WhatsApp solo permite responder dentro de ese plazo: cuando te vuelva a escribir vas a poder contestarle.
        </p>
      )}

      {foto && (
        <div className="wa-foto-previa" role="group" aria-label="Foto para mandar">
          <img src={foto.vista} alt="Vista previa de la foto" />
          <p>Se manda como foto. Lo que escribas abajo va de pie de foto (hasta {MAX_PIE} caracteres).</p>
          <button type="button" className="wa-icono" onClick={() => setFoto(null)} aria-label="Quitar la foto"><X size={20} /></button>
        </div>
      )}

      <div className="wa-barra" ref={barra}>
        {panel === 'emojis' && (
          <div className="wa-panel" role="dialog" aria-label="Emojis">
            <div className="wa-emojis">
              {EMOJIS.map((e) => <button key={e} type="button" onClick={() => poner(e)} aria-label={`Emoji ${e}`}>{e}</button>)}
            </div>
          </div>
        )}
        {panel === 'plantillas' && (
          <div className="wa-panel wa-panel-plantillas" role="dialog" aria-label="Respuestas rápidas">
            {plantillas.length === 0 ? (
              <p className="wa-panel-vacio">Todavía no tenés plantillas. Creálas en Mensajes → Plantillas y aparecen acá.</p>
            ) : (
              <ul>
                {plantillas.map((p) => {
                  const t = resolverVariables(p.texto, { nombre: charla.customerName, tienda })
                  return (
                    <li key={p.id}>
                      <button type="button" onClick={() => { setTexto(t.slice(0, MAX_TEXTO)); setPanel(null); entrada.current?.focus() }}>
                        <span className="wa-panel-nombre">{p.nombre}</span>
                        <span className="wa-panel-texto">{t}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
        <button type="button" className={`wa-icono${panel === 'emojis' ? ' wa-icono-activo' : ''}`} disabled={!puedeResponder} aria-label="Emojis" aria-expanded={panel === 'emojis'} onClick={() => setPanel((p) => (p === 'emojis' ? null : 'emojis'))}>
          <Smile size={24} />
        </button>
        <button type="button" className={`wa-icono${panel === 'plantillas' ? ' wa-icono-activo' : ''}`} disabled={!puedeResponder} aria-label="Respuestas rápidas" aria-expanded={panel === 'plantillas'} onClick={() => setPanel((p) => (p === 'plantillas' ? null : 'plantillas'))}>
          <FileText size={22} />
        </button>
        <input ref={selector} type="file" accept={TIPOS_DE_FOTO.join(',')} hidden onChange={(e) => { elegirFoto(e.target.files?.[0]); e.target.value = '' }} />
        <button type="button" className="wa-icono" disabled={!puedeResponder || enviando} aria-label="Mandar una foto" title="Mandar una foto" onClick={() => selector.current?.click()}>
          <ImagePlus size={22} />
        </button>
        <textarea
          ref={entrada}
          className="wa-escribir"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={alTeclear}
          disabled={!puedeResponder}
          rows={1}
          placeholder={!puedeResponder ? 'No se puede responder todavía' : foto ? 'Agregá un pie de foto' : 'Escribe un mensaje'}
          aria-label="Escribe un mensaje"
        />
        <button type="button" className="wa-enviar" disabled={!puedeEnviar} onClick={() => void enviar()} aria-label="Enviar">
          {enviando ? <span className="wa-giro" aria-hidden /> : <SendHorizontal size={22} />}
        </button>
      </div>

      {visor && (
        <div className="wa-visor" role="dialog" aria-modal="true" aria-label="Foto" onClick={() => setVisor(null)}>
          <button type="button" className="wa-visor-cerrar" onClick={() => setVisor(null)} aria-label="Cerrar"><X size={24} /></button>
          <img src={visor} alt="Foto del chat" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

// ─── Piezas ────────────────────────────────────────────────────────────────────

function Avatar({ nombre, foto }: { nombre: string; foto?: string | null }) {
  return foto ? (
    <img className="wa-avatar" src={foto} alt="" />
  ) : (
    <span className="wa-avatar" style={{ background: colorDeAvatar(nombre) }} aria-hidden>{iniciales(nombre)}</span>
  )
}

/** Los tildes de WhatsApp: uno gris (enviado), dos grises (entregado), dos azules (leído), o un aviso (no se entregó). */
function Tildes({ estado, chico = false }: { estado: Exclude<EstadoDeEntrega, null>; chico?: boolean }) {
  const medida = chico ? 16 : 17
  if (estado === 'fallo') {
    return <svg className="wa-tildes wa-tildes-fallo" width={medida} height={medida} viewBox="0 0 16 16" role="img" aria-label="No entregado"><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="M8 4.2v4.6M8 11.4v.1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" /></svg>
  }
  const doble = estado !== 'enviado'
  return (
    <svg className={`wa-tildes${estado === 'leido' ? ' wa-tildes-leido' : ''}`} width={medida} height={medida * 0.7} viewBox="0 0 18 12" role="img" aria-label={estado === 'enviado' ? 'Enviado' : estado === 'entregado' ? 'Entregado' : 'Leído'}>
      <path d="M1.5 6.4 5 9.9 11.6 1.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      {doble && <path d="M7.4 9.1l.5.8L14.5 1.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}

export function IconoWhatsapp({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.22-8.23 8.22Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  )
}

// ─── Estilos ───────────────────────────────────────────────────────────────────

// El fondo del chat de WhatsApp: un empapelado de dibujitos finos que se repite.
const DIBUJITOS = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><g fill="none" stroke="COLOR" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="30" cy="34" r="8"/><path d="M96 24l6 12 13 2-9.5 9 2.5 13-12-6.5-12 6.5 2.5-13-9.5-9 13-2z"/><path d="M160 30c0-7 11-7 11 0 0 7-11 13-11 13s-11-6-11-13c0-7 11-7 11 0z"/><rect x="24" y="100" width="20" height="15" rx="4"/><path d="M96 108h26M96 118h16"/><circle cx="160" cy="112" r="7"/><path d="M34 168c7-10 17-10 24 0"/><path d="M110 170l7 7 12-15"/><path d="M170 160l10 10M180 160l-10 10"/></g></svg>`
const patron = (color: string) => `url("data:image/svg+xml;utf8,${encodeURIComponent(DIBUJITOS.replace('COLOR', color))}")`

const CSS = `
.wa-raiz {
  --wa-panel: #ffffff; --wa-cabecera: #f0f2f5; --wa-borde: #e9edef; --wa-chat: #efeae2; --wa-patron: ${patron('rgba(11,20,26,0.07)')};
  --wa-entrante: #ffffff; --wa-saliente: #d9fdd3; --wa-texto: #111b21; --wa-texto-2: #667781; --wa-verde: #00a884; --wa-visto: #53bdeb;
  --wa-hover: #f5f6f6; --wa-seleccion: #f0f2f5; --wa-pildora: #ffffff; --wa-pildora-texto: #54656f; --wa-aviso: #ffeecd; --wa-aviso-texto: #54656f;
  --wa-entrada: #ffffff; --wa-icono: #54656f; --wa-error: #ea0038; --wa-sombra: 0 1px 0.5px rgba(11,20,26,0.13);
  display: flex; height: calc(100dvh - 270px); min-height: 480px; overflow: hidden; border: 1px solid var(--wa-borde); border-radius: 12px; background: var(--wa-panel);
  color: var(--wa-texto); font-family: "Segoe UI", Helvetica, Arial, sans-serif;
}
.dark .wa-raiz {
  --wa-panel: #111b21; --wa-cabecera: #202c33; --wa-borde: #222d34; --wa-chat: #0b141a; --wa-patron: ${patron('rgba(233,237,239,0.045)')};
  --wa-entrante: #202c33; --wa-saliente: #005c4b; --wa-texto: #e9edef; --wa-texto-2: #8696a0; --wa-visto: #53bdeb;
  --wa-hover: #202c33; --wa-seleccion: #2a3942; --wa-pildora: #182229; --wa-pildora-texto: #8696a0; --wa-aviso: #182229; --wa-aviso-texto: #ffd279;
  --wa-entrada: #2a3942; --wa-icono: #aebac1; --wa-sombra: 0 1px 0.5px rgba(11,20,26,0.4);
}
.wa-raiz button { font-family: inherit; }
.wa-raiz *:focus-visible { outline: 2px solid var(--wa-verde); outline-offset: -2px; }

/* ── Lista ── */
.wa-lista { width: 34%; min-width: 300px; max-width: 420px; flex-shrink: 0; display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--wa-borde); background: var(--wa-panel); }
.wa-cabecera { height: 59px; flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 0 16px; background: var(--wa-cabecera); }
.wa-cuenta { flex: 1; min-width: 0; display: flex; flex-direction: column; text-align: left; }
.wa-cuenta-titulo { margin: 0; font-size: 16px; font-weight: 400; line-height: 21px; color: var(--wa-texto); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wa-cuenta-sub { margin: 0; font-size: 13px; line-height: 20px; color: var(--wa-texto-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wa-avatar { width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 500; color: #fff; object-fit: cover; }
.wa-avatar-propio { background: var(--wa-verde); }
.wa-icono { width: 40px; height: 40px; flex-shrink: 0; padding: 0; border: none; border-radius: 50%; background: transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: var(--wa-icono); transition: background-color 150ms; }
.wa-icono:hover:not(:disabled), .wa-icono-activo { background: rgba(11,20,26,0.07); }
.dark .wa-icono:hover:not(:disabled), .dark .wa-icono-activo { background: rgba(255,255,255,0.08); }
.wa-icono:disabled { opacity: 0.4; cursor: not-allowed; }
.wa-menu-caja { position: relative; }
.wa-menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 20; min-width: 230px; padding: 8px 0; border-radius: 3px; background: var(--wa-pildora); box-shadow: 0 2px 5px rgba(11,20,26,0.26), 0 2px 10px rgba(11,20,26,0.16); }
.dark .wa-menu { background: #233138; }
.wa-menu button { width: 100%; padding: 0 24px; height: 40px; border: none; background: transparent; cursor: pointer; text-align: left; font-size: 14.5px; color: var(--wa-texto); }
.wa-menu button:hover { background: var(--wa-hover); }
.dark .wa-menu button:hover { background: #111b21; }

.wa-buscar-caja { padding: 8px 12px; background: var(--wa-panel); }
.wa-buscar { display: flex; align-items: center; gap: 22px; height: 35px; padding: 0 12px; border-radius: 8px; background: var(--wa-cabecera); color: var(--wa-icono); }
.wa-buscar input { flex: 1; min-width: 0; border: none; outline: none !important; background: transparent; font: inherit; font-size: 14px; color: var(--wa-texto); }
.wa-buscar input::placeholder { color: var(--wa-texto-2); }
.wa-buscar button { border: none; background: transparent; cursor: pointer; padding: 0; display: inline-flex; color: var(--wa-icono); }
.wa-filtros { display: flex; gap: 6px; padding: 4px 12px 10px; overflow-x: auto; }
.wa-filtros button { flex-shrink: 0; height: 28px; padding: 0 12px; border: 1px solid var(--wa-borde); border-radius: 14px; background: var(--wa-panel); cursor: pointer; font-size: 13.5px; color: var(--wa-texto-2); transition: background-color 150ms; }
.wa-filtros button:hover { background: var(--wa-hover); }
.wa-filtros .wa-filtro-activo { background: #d9fdd3; border-color: #d9fdd3; color: #0a332c; font-weight: 500; }
.dark .wa-filtros .wa-filtro-activo { background: #0a332c; border-color: #0a332c; color: #00a884; }

.wa-chats { list-style: none; margin: 0; padding: 0; flex: 1; min-height: 0; overflow-y: auto; }
.wa-vacio { padding: 28px 24px; text-align: center; font-size: 13.5px; line-height: 1.5; color: var(--wa-texto-2); }
.wa-fila { width: 100%; height: 72px; display: flex; align-items: center; gap: 15px; padding: 0 15px; border: none; background: transparent; cursor: pointer; text-align: left; }
.wa-fila:hover { background: var(--wa-hover); }
.wa-fila-activa, .wa-fila-activa:hover { background: var(--wa-seleccion); }
.wa-fila .wa-avatar { width: 49px; height: 49px; font-size: 17px; }
.wa-fila-cuerpo { flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 2px; border-bottom: 1px solid var(--wa-borde); }
.wa-fila:last-child .wa-fila-cuerpo { border-bottom: none; }
.wa-fila-arriba, .wa-fila-abajo { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
.wa-fila-nombre { font-size: 17px; line-height: 21px; color: var(--wa-texto); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wa-fila-hora { flex-shrink: 0; font-size: 12px; color: var(--wa-texto-2); }
.wa-fila-hora-nueva { color: var(--wa-verde); }
.wa-fila-preview { display: flex; align-items: center; gap: 3px; min-width: 0; font-size: 14px; line-height: 20px; color: var(--wa-texto-2); }
.wa-fila-preview span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wa-punto { width: 12px; height: 12px; flex-shrink: 0; border-radius: 50%; background: #25d366; }

/* ── Chat ── */
.wa-chat { flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--wa-chat); }
.wa-chat-interno { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.wa-cabecera-chat { gap: 8px; padding-left: 10px; }
.wa-chat-persona { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 0 6px; height: 100%; border: none; background: transparent; cursor: pointer; text-align: left; }
.wa-volver { display: none; }
.wa-mensajes { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 7% 10px; background-color: var(--wa-chat); background-image: var(--wa-patron); background-size: 200px 200px; }
.wa-aviso-info { width: fit-content; max-width: 90%; margin: 0 auto 12px; padding: 6px 12px; border-radius: 7.5px; text-align: center; font-size: 12.5px; line-height: 1.45; color: var(--wa-aviso-texto); background: var(--wa-aviso); box-shadow: var(--wa-sombra); }
.wa-centro { margin: 24px 0; text-align: center; font-size: 13px; color: var(--wa-texto-2); }
.wa-dia { display: flex; justify-content: center; margin: 12px 0; }
.wa-dia span { padding: 5px 12px; border-radius: 7.5px; font-size: 12.5px; text-transform: uppercase; color: var(--wa-pildora-texto); background: var(--wa-pildora); box-shadow: var(--wa-sombra); }
.wa-linea { display: flex; margin-top: 2px; }
.wa-linea-primera { margin-top: 10px; }
.wa-linea-propia { justify-content: flex-end; }
.wa-linea-ajena { justify-content: flex-start; }
.wa-burbuja { position: relative; max-width: 65%; padding: 6px 7px 8px 9px; border-radius: 7.5px; font-size: 14.2px; line-height: 19px; color: var(--wa-texto); box-shadow: var(--wa-sombra); overflow-wrap: anywhere; white-space: pre-wrap; }
.wa-burbuja-ajena { background: var(--wa-entrante); }
.wa-burbuja-propia { background: var(--wa-saliente); }
.wa-burbuja-fallo { box-shadow: 0 0 0 1px var(--wa-error); }
.wa-burbuja-ajena.wa-burbuja-colita { border-top-left-radius: 0; }
.wa-burbuja-propia.wa-burbuja-colita { border-top-right-radius: 0; }
.wa-burbuja-ajena.wa-burbuja-colita::before, .wa-burbuja-propia.wa-burbuja-colita::before { content: ''; position: absolute; top: 0; width: 8px; height: 13px; }
.wa-burbuja-ajena.wa-burbuja-colita::before { left: -8px; background: var(--wa-entrante); clip-path: polygon(100% 0, 0 0, 100% 100%); }
.wa-burbuja-propia.wa-burbuja-colita::before { right: -8px; background: var(--wa-saliente); clip-path: polygon(0 0, 100% 0, 0 100%); }
.wa-burbuja-texto { white-space: pre-wrap; }
.wa-burbuja-meta { float: right; display: inline-flex; align-items: center; gap: 3px; margin: 7px 0 -5px 12px; font-size: 11px; line-height: 15px; color: var(--wa-texto-2); white-space: nowrap; }
.wa-tildes { color: var(--wa-texto-2); flex-shrink: 0; }
.wa-tildes-leido { color: var(--wa-visto); }
.wa-tildes-fallo { color: var(--wa-error); }
.wa-fallo { margin: 2px 0 0; text-align: right; font-size: 11.5px; color: var(--wa-error); }

.wa-burbuja-con-foto { padding: 3px 3px 6px; }
.wa-foto { display: block; padding: 0; border: none; border-radius: 6px; overflow: hidden; background: transparent; cursor: zoom-in; line-height: 0; }
.wa-foto img { display: block; max-width: min(330px, 100%); max-height: 340px; width: auto; height: auto; min-width: 140px; object-fit: cover; }
.wa-foto-pie { display: block; padding: 4px 6px 0; }
.wa-burbuja-con-foto .wa-burbuja-meta.wa-foto-pie { display: flex; justify-content: flex-end; padding: 0 4px; margin: 0; float: none; }
.wa-meta-sobre-foto { position: absolute; right: 8px; bottom: 8px; margin: 0 !important; padding: 1px 6px; border-radius: 10px; color: #fff !important; background: rgba(11,20,26,0.5); }
.wa-meta-sobre-foto .wa-tildes { color: #fff; }
.wa-meta-sobre-foto .wa-tildes-leido { color: var(--wa-visto); }
.wa-foto-previa { flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: var(--wa-cabecera); border-top: 1px solid var(--wa-borde); }
.wa-foto-previa img { width: 64px; height: 64px; flex-shrink: 0; border-radius: 8px; object-fit: cover; }
.wa-foto-previa p { flex: 1; min-width: 0; margin: 0; font-size: 13px; line-height: 1.45; color: var(--wa-texto-2); }
.wa-visor { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(11,20,26,0.92); cursor: zoom-out; }
.wa-visor img { max-width: 100%; max-height: 100%; border-radius: 4px; cursor: default; }
.wa-visor-cerrar { position: absolute; top: 14px; right: 14px; width: 44px; height: 44px; border: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: #fff; background: rgba(255,255,255,0.12); }
.wa-visor-cerrar:hover { background: rgba(255,255,255,0.22); }
.wa-plazo { margin: 0; padding: 10px 24px; text-align: center; font-size: 13px; line-height: 1.5; color: var(--wa-aviso-texto); background: var(--wa-aviso); }
.wa-barra { position: relative; flex-shrink: 0; display: flex; align-items: flex-end; gap: 6px; padding: 10px 16px; background: var(--wa-cabecera); }
.wa-escribir { flex: 1; min-width: 0; max-height: 120px; padding: 9px 12px; border: none; border-radius: 8px; outline: none !important; resize: none; background: var(--wa-entrada); font: inherit; font-size: 15px; line-height: 20px; color: var(--wa-texto); field-sizing: content; }
.wa-escribir::placeholder { color: var(--wa-texto-2); }
.wa-escribir:disabled { opacity: 0.7; cursor: not-allowed; }
.wa-enviar { width: 42px; height: 42px; flex-shrink: 0; padding: 0; border: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: #fff; background: var(--wa-verde); transition: opacity 150ms; }
.wa-enviar:disabled { opacity: 0.4; cursor: not-allowed; }
.wa-giro { width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; animation: wa-giro 0.8s linear infinite; }
@keyframes wa-giro { to { transform: rotate(360deg); } }

.wa-panel { position: absolute; left: 16px; bottom: calc(100% + 6px); z-index: 15; max-width: calc(100% - 32px); border-radius: 10px; background: var(--wa-pildora); box-shadow: 0 2px 5px rgba(11,20,26,0.26), 0 2px 10px rgba(11,20,26,0.16); overflow: hidden; }
.dark .wa-panel { background: #233138; }
.wa-emojis { display: grid; grid-template-columns: repeat(8, 38px); gap: 2px; padding: 8px; }
.wa-emojis button { width: 38px; height: 38px; border: none; border-radius: 8px; background: transparent; cursor: pointer; font-size: 22px; line-height: 1; }
.wa-emojis button:hover { background: var(--wa-hover); }
.wa-panel-plantillas { width: 360px; max-height: 320px; overflow-y: auto; }
.wa-panel-plantillas ul { list-style: none; margin: 0; padding: 6px; }
.wa-panel-plantillas li button { width: 100%; display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border: none; border-radius: 8px; background: transparent; cursor: pointer; text-align: left; }
.wa-panel-plantillas li button:hover { background: var(--wa-hover); }
.wa-panel-nombre { font-size: 14px; font-weight: 600; color: var(--wa-texto); }
.wa-panel-texto { font-size: 13px; line-height: 1.4; color: var(--wa-texto-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.wa-panel-vacio { margin: 0; padding: 18px 16px; font-size: 13px; line-height: 1.5; color: var(--wa-texto-2); }

.wa-bienvenida { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 32px; text-align: center; background: var(--wa-cabecera); border-bottom: 6px solid var(--wa-verde); }
.wa-bienvenida-icono { width: 88px; height: 88px; margin-bottom: 8px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; background: var(--wa-verde); }
.wa-bienvenida h2 { margin: 0; font-size: 28px; font-weight: 300; letter-spacing: -0.01em; color: var(--wa-texto); }
.wa-bienvenida p { margin: 0; max-width: 460px; font-size: 14.5px; line-height: 1.55; color: var(--wa-texto-2); }
.wa-bienvenida strong { font-weight: 600; color: var(--wa-texto); }
.wa-bienvenida-nota { font-size: 13px !important; }

.wa-marca { flex-shrink: 0; padding: 1px 7px; border-radius: 9px; font-size: 11px; font-weight: 500; color: var(--wa-verde); background: rgba(0,168,132,0.12); }
.wa-marca-atencion { color: #b45309; background: rgba(245,158,11,0.18); }
.dark .wa-marca-atencion { color: #fbbf24; }
.wa-fila-arriba .wa-fila-nombre { flex: 1; min-width: 0; }
.wa-orbi-btn { flex-shrink: 0; height: 32px; padding: 0 12px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--wa-borde); border-radius: 16px; cursor: pointer; font-size: 13px; color: var(--wa-texto-2); background: var(--wa-panel); }
.wa-orbi-btn:hover:not(:disabled) { background: var(--wa-hover); }
.wa-orbi-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.wa-orbi-btn-on { color: #fff; border-color: var(--wa-verde); background: var(--wa-verde); }
.wa-orbi-btn-on:hover:not(:disabled) { background: #029374; }
.wa-orbi-aviso { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 16px; font-size: 13px; line-height: 1.45; color: var(--wa-aviso-texto); background: var(--wa-aviso); }
.wa-orbi-aviso button { flex-shrink: 0; height: 30px; padding: 0 14px; border: none; border-radius: 15px; cursor: pointer; font-size: 13px; font-weight: 500; color: #fff; background: var(--wa-verde); }
.wa-orbi-aviso button:disabled { opacity: 0.5; cursor: not-allowed; }
.wa-orbi-tag { display: inline-flex; align-items: center; gap: 3px; margin-bottom: 2px; font-size: 11px; font-weight: 600; color: var(--wa-verde); }
.wa-orbi-cta { margin-top: 10px; height: 40px; padding: 0 20px; display: inline-flex; align-items: center; gap: 8px; border: none; border-radius: 20px; cursor: pointer; font-size: 14.5px; font-weight: 500; color: #fff; background: var(--wa-verde); }
@media (max-width: 768px) {
  .wa-orbi-btn span { display: none; }
  .wa-orbi-btn { width: 36px; padding: 0; justify-content: center; }
  .wa-raiz { height: calc(100dvh - 240px); min-height: 420px; }
  .wa-lista { width: 100%; max-width: none; border-right: none; }
  .wa-chat { display: none; }
  .wa-con-chat .wa-lista { display: none; }
  .wa-con-chat .wa-chat { display: flex; }
  .wa-volver { display: inline-flex; }
  .wa-mensajes { padding: 12px 4% 8px; }
  .wa-burbuja { max-width: 82%; }
  .wa-escribir { font-size: 16px; }
  .wa-barra { gap: 2px; padding: 8px 8px; }
  .wa-barra .wa-icono { width: 34px; height: 34px; }
  .wa-enviar { width: 40px; height: 40px; }
  .wa-emojis { grid-template-columns: repeat(auto-fill, minmax(36px, 1fr)); width: calc(100vw - 32px); max-width: 320px; }
  .wa-foto-previa { padding: 8px 10px; }
  .wa-panel-plantillas { width: calc(100vw - 48px); }
}
@media (prefers-reduced-motion: reduce) { .wa-icono, .wa-filtros button, .wa-enviar { transition: none; } .wa-giro { animation: none; } }
`
