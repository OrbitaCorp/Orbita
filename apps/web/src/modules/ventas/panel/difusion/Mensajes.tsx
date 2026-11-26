import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, ImagePlus, Search, SendHorizontal, Settings2, ShoppingBag, Sparkles, UserRound, X } from 'lucide-react'
import {
  ApiError, getInstagramBot, getInstagramCharlas, getInstagramMensajes, pedirRespuestaAOrbi, responderInstagram, setInstagramCharlaBot,
  type InstagramCharla, type InstagramEstado, type InstagramMensaje, type OrbiCanalEstado,
} from '@/lib/api'
import { orbiAtiende } from '../_shared/orbiAtencion'
import { AjustesModal } from './AjustesModal'
import { OrbiInstagram } from './OrbiInstagram'
import { Compuerta } from './Compuerta'
import { EnviarProductoModal } from './EnviarProductoModal'
import { PanelDelCliente } from './PanelDelCliente'
import { RespuestasRapidas } from './RespuestasRapidas'
import { cuandoFue, diaDe, horaDe, iniciales } from './formatoMensajes'
import { SugerenciasDeOrbi } from './SugerenciasDeOrbi'

// Difusión → Mensajes: los mensajes directos de Instagram del negocio, con el aspecto de la bandeja de
// Instagram. Lista de charlas a la izquierda y la conversación a la derecha; se responde con texto y/o una foto.
//
// Instagram solo deja contestar dentro de las 24 horas del último mensaje del cliente: pasado el plazo la
// charla se puede leer pero no responder, y la pantalla lo dice. Se actualiza sola cada pocos segundos.
//
// Orbi puede atender estas charlas (paquete Avanzado, igual que en WhatsApp): se configura con el botón de Orbi de la
// cabecera, se enciende o apaga en cada charla, y cuando se calla (contestaste vos, o te pasó la charla) lo dice arriba
// del campo de texto con el botón para reactivarlo. Sus mensajes llevan "Orbi" junto a la hora.

const MAX_FOTO_BYTES = 10 * 1024 * 1024
const FOTOS_ACEPTADAS = ['image/jpeg', 'image/png', 'image/webp']
const REFRESCO_LISTA_MS = 10_000
const REFRESCO_CHARLA_MS = 5_000
const MAX_TEXTO = 1000

interface Props {
  estado: InstagramEstado | null
  /** Abre el modal de conexión de Instagram (si todavía no está conectado). */
  onAbrirConexion: () => void
}

export function Mensajes({ estado, onAbrirConexion }: Props) {
  return (
    <Compuerta estado={estado} permiso="mensajes" onAbrirConexion={onAbrirConexion}>
      {(usuario) => <Bandeja usuario={usuario} />}
    </Compuerta>
  )
}

// Solo corre mientras la pestaña se ve: no tiene sentido consultar con la pantalla escondida.
function useRefresco(accion: () => void, cadaMs: number) {
  const guardada = useRef(accion)
  guardada.current = accion
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') guardada.current() }, cadaMs)
    const alVolver = () => { if (document.visibilityState === 'visible') guardada.current() }
    document.addEventListener('visibilitychange', alVolver)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver) }
  }, [cadaMs])
}

// ─── Bandeja ───────────────────────────────────────────────────────────────────

function Bandeja({ usuario }: { usuario: string | null }) {
  const router = useRouter()
  const [charlas, setCharlas] = useState<InstagramCharla[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // ?charla= abre una charla directo (el link del correo de Orbi cuando te pasa una charla), hasta que se elija otra.
  const [elegida, setAbierta] = useState<string | null | undefined>(undefined)
  const abierta = elegida === undefined ? (typeof router.query.charla === 'string' ? router.query.charla : null) : elegida
  // La configuración de Orbi solo la ven el dueño y los administradores: para el resto queda en null y no se muestra.
  const [bot, setBot] = useState<OrbiCanalEstado | null>(null)
  const [orbiAbierto, setOrbiAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [soloSinLeer, setSoloSinLeer] = useState(false)
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false)
  const montado = useRef(true)
  useEffect(() => { montado.current = true; return () => { montado.current = false } }, [])

  const cargar = useCallback(() => {
    getInstagramCharlas()
      .then((c) => { if (montado.current) { setCharlas(c); setError(null) } })
      .catch((e) => { if (montado.current) setError(e instanceof ApiError ? e.message : 'No se pudieron cargar los mensajes.') })
  }, [])
  useEffect(() => { cargar() }, [cargar])
  useRefresco(cargar, REFRESCO_LISTA_MS)
  useEffect(() => {
    getInstagramBot().then((b) => { if (montado.current) setBot(b) }).catch(() => undefined)
  }, [])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (charlas ?? []).filter((c) => (!soloSinLeer || c.noLeida) && (!q || c.nombre.toLowerCase().includes(q)))
  }, [charlas, busqueda, soloSinLeer])
  const sinLeer = (charlas ?? []).filter((c) => c.noLeida).length
  const actual = charlas?.find((c) => c.id === abierta) ?? null

  const alLeer = (id: string) => setCharlas((cs) => cs?.map((c) => (c.id === id ? { ...c, noLeida: false } : c)) ?? cs)

  return (
    <div className="msg-raiz">
      <style>{CSS}</style>
      <div className={`msg-caja${abierta ? ' msg-caja-hilo' : ''}`}>
        <aside className="msg-lista" aria-label="Conversaciones">
          <header className="msg-lista-cabecera">
            <div className="msg-titulo-fila">
              <h2 className="msg-usuario">{usuario ? `@${usuario}` : 'Mensajes'}</h2>
              {bot?.disponible && (
                <button
                  type="button" className={`msg-orbi-config${bot.enabled ? ' msg-orbi-config-on' : ''}`} onClick={() => setOrbiAbierto(true)}
                  aria-label="Orbi en Instagram" title={bot.enabled ? 'Orbi atiende tus mensajes: configurarlo' : 'Que Orbi atienda tus mensajes'}
                >
                  <Sparkles size={15} strokeWidth={1.9} aria-hidden /> Orbi
                </button>
              )}
              <button type="button" className="msg-ajustes" onClick={() => setAjustesAbiertos(true)} aria-label="Respuestas automáticas" title="Respuestas automáticas">
                <Settings2 size={18} strokeWidth={1.8} />
              </button>
            </div>
            <label className="msg-buscador">
              <Search size={15} strokeWidth={2} aria-hidden />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar" aria-label="Buscar conversación" />
            </label>
            <div className="msg-filtros" role="group" aria-label="Filtrar">
              <button type="button" aria-pressed={!soloSinLeer} className={!soloSinLeer ? 'msg-filtro-activo' : ''} onClick={() => setSoloSinLeer(false)}>Todos</button>
              <button type="button" aria-pressed={soloSinLeer} className={soloSinLeer ? 'msg-filtro-activo' : ''} onClick={() => setSoloSinLeer(true)}>
                Sin leer{sinLeer > 0 ? ` (${sinLeer})` : ''}
              </button>
            </div>
          </header>

          <ul className="msg-charlas">
            {charlas === null && !error && <li className="msg-vacio">Cargando…</li>}
            {error && <li className="msg-vacio msg-vacio-error" role="alert">{error}</li>}
            {charlas !== null && charlas.length === 0 && (
              <li className="msg-vacio">
                Todavía no te escribió nadie por Instagram. Cuando alguien te mande un mensaje directo, aparece acá.
              </li>
            )}
            {charlas !== null && charlas.length > 0 && visibles.length === 0 && (
              <li className="msg-vacio">{soloSinLeer && !busqueda ? 'No tenés mensajes sin leer.' : 'No hay conversaciones con ese nombre.'}</li>
            )}
            {visibles.map((c) => (
              <li key={c.id}>
                <button type="button" className={`msg-charla${c.id === abierta ? ' msg-charla-activa' : ''}`} onClick={() => setAbierta(c.id)} aria-current={c.id === abierta}>
                  <Avatar nombre={c.nombre} anillo={c.noLeida} />
                  <span className="msg-charla-texto">
                    <span className={`msg-charla-nombre${c.noLeida ? ' msg-negrita' : ''}`}>{c.nombre}</span>
                    <span className={`msg-charla-ultimo${c.noLeida ? ' msg-negrita' : ''}`}>
                      {c.bot?.estado === 'DERIVADO' && <span className="msg-negrita">Necesita atención · </span>}
                      {c.ultimoDe === 'negocio' ? 'Vos: ' : ''}{c.ultimo || 'Sin mensajes'}
                      <span className="msg-charla-cuando"> · {cuandoFue(c.fecha)}</span>
                    </span>
                  </span>
                  {c.noLeida && <span className="msg-punto" role="img" aria-label="Sin leer" />}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="msg-hilo" aria-label="Conversación">
          {actual ? (
            <Hilo
              key={actual.id}
              charla={actual}
              bot={bot}
              onConfigurarOrbi={() => setOrbiAbierto(true)}
              onVolver={() => setAbierta(null)}
              onLeida={alLeer}
              onCambio={cargar}
              // Al unir con un cliente que ya tenía charla, esta pasa a ser la de él.
              onVinculado={(id) => { setAbierta(id); cargar() }}
            />
          ) : (
            <div className="msg-sin-hilo">
              <span className="msg-sin-hilo-icono" aria-hidden><SendHorizontal size={26} strokeWidth={1.6} /></span>
              <p className="msg-sin-hilo-titulo">Tus mensajes</p>
              <p className="msg-suave">Elegí una conversación para leerla y responder.</p>
            </div>
          )}
        </section>
      </div>
      {ajustesAbiertos && <AjustesModal parte="mensajes" onCerrar={() => setAjustesAbiertos(false)} />}
      {orbiAbierto && bot && <OrbiInstagram bot={bot} onCambio={(b) => { setBot(b); cargar() }} onCerrar={() => setOrbiAbierto(false)} />}
    </div>
  )
}

function Avatar({ nombre, anillo = false, tam = 44 }: { nombre: string; anillo?: boolean; tam?: number }) {
  return (
    <span className={`msg-avatar${anillo ? ' msg-avatar-anillo' : ''}`} style={{ width: tam, height: tam }} aria-hidden>
      <span style={{ fontSize: Math.round(tam * 0.36) }}>{iniciales(nombre)}</span>
    </span>
  )
}

// ─── Conversación ──────────────────────────────────────────────────────────────

interface HiloProps {
  charla: InstagramCharla
  /** La configuración de Orbi (null si no se pudo leer: quien no es dueño ni administrador). */
  bot: OrbiCanalEstado | null
  onConfigurarOrbi: () => void
  onVolver: () => void
  onLeida: (id: string) => void
  onCambio: () => void
  onVinculado: (conversationId: string) => void
}

const CLAVE_PANEL = 'difusion-panel-cliente'

function Hilo({ charla, bot, onConfigurarOrbi, onVolver, onLeida, onCambio, onVinculado }: HiloProps) {
  const [mensajes, setMensajes] = useState<InstagramMensaje[] | null>(null)
  const [hasta, setHasta] = useState<string | null>(charla.puedeResponderHasta)
  const [estadoOrbi, setEstadoOrbi] = useState<InstagramCharla['bot'] | undefined>(charla.bot)
  const [cambiandoOrbi, setCambiandoOrbi] = useState(false)
  const [texto, setTexto] = useState('')
  const [foto, setFoto] = useState<{ archivo: File; vista: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())
  const [panelAbierto, setPanelAbierto] = useState(() => {
    try { return window.localStorage.getItem(CLAVE_PANEL) === '1' } catch { return false }
  })
  const [mandandoProducto, setMandandoProducto] = useState(false)
  const fin = useRef<HTMLDivElement>(null)
  const cerca = useRef(true)
  const lista = useRef<HTMLDivElement>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const montado = useRef(true)
  useEffect(() => { montado.current = true; return () => { montado.current = false } }, [])
  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto.vista) }, [foto])

  const cargar = useCallback(() => {
    getInstagramMensajes(charla.id)
      .then((r) => {
        if (!montado.current) return
        setMensajes((previos) => (previos && previos.length === r.mensajes.length && previos.at(-1)?.id === r.mensajes.at(-1)?.id ? previos : r.mensajes))
        setHasta(r.puedeResponderHasta)
        if (r.bot) setEstadoOrbi(r.bot)
        onLeida(charla.id)
      })
      .catch(() => undefined)
  }, [charla.id, onLeida])
  useEffect(() => { cargar() }, [cargar])
  useRefresco(cargar, REFRESCO_CHARLA_MS)
  // El plazo de 24 h se vence con el tiempo, aunque no llegue nada nuevo.
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 30_000); return () => clearInterval(t) }, [])

  // Al llegar mensajes nuevos se baja solo si ya se estaba mirando lo último.
  useEffect(() => { if (cerca.current) fin.current?.scrollIntoView({ block: 'end' }) }, [mensajes])
  const alScrollear = () => {
    const el = lista.current
    if (el) cerca.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const puedeResponder = hasta !== null && new Date(hasta).getTime() > ahora
  const largo = texto.length
  const puedeEnviar = puedeResponder && !enviando && largo <= MAX_TEXTO && (texto.trim().length > 0 || foto !== null)

  const elegirFoto = (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    if (!FOTOS_ACEPTADAS.includes(archivo.type)) { setError('Mandá una foto JPG, PNG o WebP.'); return }
    if (archivo.size > MAX_FOTO_BYTES) { setError('La foto pesa más de 10 MB.'); return }
    setError(null)
    setFoto({ archivo, vista: URL.createObjectURL(archivo) })
  }

  const alternarPanel = () => {
    setPanelAbierto((a) => {
      try { window.localStorage.setItem(CLAVE_PANEL, a ? '0' : '1') } catch { /* sin almacenamiento: no se recuerda */ }
      return !a
    })
  }

  const enviar = async () => {
    if (!puedeEnviar) return
    setEnviando(true); setError(null)
    try {
      const nuevos = await responderInstagram(charla.id, { texto, foto: foto?.archivo })
      if (!montado.current) return
      cerca.current = true
      setMensajes((previos) => [...(previos ?? []), ...nuevos])
      setTexto(''); setFoto(null)
      onCambio()
    } catch (e) {
      if (montado.current) setError(e instanceof ApiError ? e.message : 'No se pudo enviar el mensaje. Probá de nuevo.')
    } finally {
      if (montado.current) setEnviando(false)
    }
  }

  // Orbi en esta charla: ON la atiende (también la reactiva si estaba pausada o derivada), OFF la deja para una persona.
  const atiendeOrbi = orbiAtiende(bot, estadoOrbi?.estado)
  const orbiCallado = estadoOrbi?.estado === 'PAUSADO' || estadoOrbi?.estado === 'DERIVADO'
  const cambiarOrbi = async (estado: 'ON' | 'OFF') => {
    setCambiandoOrbi(true); setError(null)
    try {
      const r = await setInstagramCharlaBot(charla.id, estado)
      if (!montado.current) return
      setEstadoOrbi({ estado: r.botEstado, motivo: null })
      onCambio()
    } catch (e) {
      if (montado.current) setError(e instanceof ApiError ? e.message : 'No se pudo cambiar a Orbi en esta charla.')
    } finally {
      if (montado.current) setCambiandoOrbi(false)
    }
  }

  const alTeclear = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void enviar() }
  }

  // Cada mensaje sabe si empieza un día nuevo y si es el último de una racha de la misma persona.
  const filas = (mensajes ?? []).map((m, i, todos) => ({
    m,
    dia: i === 0 || diaDe(todos[i - 1].creado) !== diaDe(m.creado) ? diaDe(m.creado) : null,
    cierraRacha: i === todos.length - 1 || todos[i + 1].de !== m.de || diaDe(todos[i + 1].creado) !== diaDe(m.creado),
  }))
  const ultimoPropio = [...(mensajes ?? [])].reverse().find((m) => m.de === 'negocio')

  return (
    <div className="msg-hilo-fila">
    <div className="msg-hilo-interno">
      <header className="msg-hilo-cabecera">
        <button type="button" className="msg-volver" onClick={onVolver} aria-label="Volver a las conversaciones"><ArrowLeft size={20} /></button>
        <Avatar nombre={charla.nombre} tam={36} />
        <div className="msg-hilo-nombre">
          <p className="msg-hilo-titulo">{charla.nombre}</p>
          <p className="msg-hilo-sub">
            {puedeResponder && hasta ? `Podés responder hasta las ${horaDe(hasta)}` : 'Pasó el plazo de 24 horas para responder'}
          </p>
        </div>
        {bot?.disponible && (
          <button
            type="button" className={`msg-cliente-boton msg-orbi-boton${atiendeOrbi ? ' msg-cliente-boton-activo' : ''}`} disabled={cambiandoOrbi}
            aria-pressed={atiendeOrbi} aria-label={atiendeOrbi ? 'Orbi atiende' : 'Activar Orbi'}
            onClick={() => (bot.enabled ? void cambiarOrbi(atiendeOrbi ? 'OFF' : 'ON') : onConfigurarOrbi())}
            title={!bot.enabled ? 'Primero encendé a Orbi para Instagram' : atiendeOrbi ? 'Orbi está contestando acá: tocá para atenderla vos' : 'Que Orbi atienda esta charla'}
          >
            <Sparkles size={15} aria-hidden /> <span className="msg-boton-texto">{atiendeOrbi ? 'Orbi atiende' : 'Activar Orbi'}</span>
          </button>
        )}
        <button type="button" className={`msg-cliente-boton${panelAbierto ? ' msg-cliente-boton-activo' : ''}`} aria-pressed={panelAbierto} aria-label="Cliente" onClick={alternarPanel}>
          <UserRound size={15} aria-hidden /> <span className="msg-boton-texto">Cliente</span>
        </button>
      </header>

      <div className="msg-mensajes" ref={lista} onScroll={alScrollear}>
        {mensajes === null && <p className="msg-suave msg-centro">Cargando…</p>}
        {mensajes?.length === 0 && <p className="msg-suave msg-centro">Todavía no hay mensajes en esta conversación.</p>}
        {filas.map(({ m, dia, cierraRacha }) => (
          <div key={m.id}>
            {dia && <p className="msg-dia">{dia}</p>}
            <div className={`msg-fila msg-fila-${m.de}${cierraRacha ? ' msg-fila-cierra' : ''}`}>
              {m.de === 'cliente' && (cierraRacha ? <Avatar nombre={charla.nombre} tam={26} /> : <span className="msg-avatar-hueco" />)}
              <div className="msg-columna">
                {m.adjuntos.map((a, i) => (
                  <Adjunto key={i} adjunto={a} propio={m.de === 'negocio'} />
                ))}
                {m.texto && <p className={`msg-burbuja msg-burbuja-${m.de}`} title={`${diaDe(m.creado)}, ${horaDe(m.creado)}`}>{m.texto}</p>}
                {cierraRacha && <span className="msg-hora">{m.viaOrbi ? 'Orbi · ' : ''}{horaDe(m.creado)}{m.id === ultimoPropio?.id && m.estado === 'sent' ? ' · Enviado' : ''}</span>}
              </div>
            </div>
          </div>
        ))}
        <div ref={fin} />
      </div>

      <footer className="msg-compositor">
        {!puedeResponder && (
          <p className="msg-plazo" role="status">
            Instagram solo deja responder dentro de las 24 horas del último mensaje del cliente. Cuando {charla.nombre} te vuelva a escribir vas a poder contestarle.
          </p>
        )}
        {orbiCallado && (
          <div className="msg-orbi-aviso" role="status">
            <p>
              {estadoOrbi?.estado === 'DERIVADO' ? 'Orbi te pasó esta charla' : 'Orbi dejó de contestar acá'}
              {estadoOrbi?.motivo ? `: ${estadoOrbi.motivo}` : '.'}
            </p>
            {bot?.enabled && (
              <button type="button" className="msg-cliente-boton" disabled={cambiandoOrbi} onClick={() => void cambiarOrbi('ON')}>Reactivar Orbi</button>
            )}
          </div>
        )}
        {error && <p className="msg-error" role="alert">{error}</p>}
        {puedeResponder && (mensajes?.length ?? 0) > 0 && (
          <div className="msg-sugerencias">
            <SugerenciasDeOrbi
              compacto
              pedir={async () => (await pedirRespuestaAOrbi({ tipo: 'mensaje', conversationId: charla.id })).sugerencias}
              onElegir={setTexto}
              disabled={enviando}
            />
          </div>
        )}
        {foto && (
          <div className="msg-adjuntando">
            <img src={foto.vista} alt="Foto para enviar" />
            <button type="button" aria-label="Quitar la foto" onClick={() => setFoto(null)}><X size={13} strokeWidth={2.5} /></button>
          </div>
        )}
        <div className={`msg-entrada${puedeResponder ? '' : ' msg-entrada-apagada'}`}>
          <button type="button" className="msg-adjuntar" disabled={!puedeResponder || enviando} onClick={() => entrada.current?.click()} aria-label="Adjuntar una foto">
            <ImagePlus size={20} strokeWidth={1.8} />
          </button>
          <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={elegirFoto} />
          <RespuestasRapidas cliente={charla.nombre} disabled={!puedeResponder || enviando} onElegir={(t) => setTexto(t.slice(0, MAX_TEXTO))} />
          <button type="button" className="msg-adjuntar" disabled={!puedeResponder || enviando} onClick={() => setMandandoProducto(true)} aria-label="Mandar un producto" title="Mandar un producto">
            <ShoppingBag size={19} strokeWidth={1.8} />
          </button>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={alTeclear}
            disabled={!puedeResponder}
            placeholder={puedeResponder ? 'Escribí un mensaje…' : 'No se puede responder todavía'}
            rows={1}
            aria-label="Mensaje"
          />
          <button type="button" className="msg-enviar" disabled={!puedeEnviar} onClick={() => void enviar()} aria-label="Enviar">
            {enviando ? <span className="msg-giro" aria-hidden /> : <SendHorizontal size={19} strokeWidth={2} />}
          </button>
        </div>
        {largo > MAX_TEXTO - 100 && <p className={`msg-contador${largo > MAX_TEXTO ? ' msg-contador-excedido' : ''}`}>{largo} / {MAX_TEXTO}</p>}
      </footer>
    </div>

    {panelAbierto && <PanelDelCliente charlaId={charla.id} onVinculado={onVinculado} />}
    {mandandoProducto && (
      <EnviarProductoModal
        charlaId={charla.id}
        cliente={charla.nombre}
        onCerrar={() => setMandandoProducto(false)}
        onEnviado={(nuevos) => { cerca.current = true; setMensajes((previos) => [...(previos ?? []), ...nuevos]); onCambio() }}
      />
    )}
    </div>
  )
}

function Adjunto({ adjunto, propio }: { adjunto: InstagramMensaje['adjuntos'][number]; propio: boolean }) {
  if (adjunto.tipo === 'image') {
    return (
      <a className={`msg-foto${propio ? ' msg-foto-propia' : ''}`} href={adjunto.url} target="_blank" rel="noopener noreferrer" aria-label="Abrir la foto">
        <img src={adjunto.url} alt="Foto del mensaje" loading="lazy" />
      </a>
    )
  }
  if (adjunto.tipo === 'video') {
    return <video className={`msg-video${propio ? ' msg-foto-propia' : ''}`} src={adjunto.url} controls preload="metadata" />
  }
  if (adjunto.tipo === 'audio') return <audio className="msg-audio" src={adjunto.url} controls preload="none" />
  return <a className={`msg-burbuja msg-burbuja-${propio ? 'negocio' : 'cliente'}`} href={adjunto.url} target="_blank" rel="noopener noreferrer">Abrir archivo</a>
}

// ─── Estilos ───────────────────────────────────────────────────────────────────

const CSS = `
.msg-raiz { margin-top: 16px; }
.msg-caja { container: bandeja / inline-size; display: grid; grid-template-columns: clamp(260px, 32%, 340px) minmax(0, 1fr); height: clamp(520px, calc(100vh - 300px), 760px); overflow: hidden; border: 1px solid var(--color-border); border-radius: 16px; background: var(--color-surface); box-shadow: var(--shadow-card); }
.msg-suave { margin: 0; font-size: 13px; line-height: 1.5; color: var(--color-muted); }
.msg-centro { text-align: center; padding: 24px 0; }
.msg-negrita { font-weight: 700; color: var(--color-text) !important; }

.msg-lista { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--color-border); }
.msg-lista-cabecera { padding: 16px 16px 10px; }
.msg-titulo-fila { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
.msg-ajustes { width: 34px; height: 34px; flex-shrink: 0; padding: 0; border: none; border-radius: 50%; background: transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: var(--color-muted); transition: background-color 150ms, color 150ms; }
.msg-ajustes:hover { color: var(--color-text); background: var(--color-surface-alt); }
.msg-ajustes:focus-visible, .msg-cliente-boton:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.msg-cliente-boton { margin-left: auto; flex-shrink: 0; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: 16px; background: var(--color-surface); cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 500; color: var(--color-muted); transition: background-color 150ms, color 150ms; }
.msg-cliente-boton:hover { color: var(--color-text); background: var(--color-surface-alt); }
.msg-cliente-boton:disabled { opacity: 0.5; cursor: not-allowed; }
.msg-orbi-boton + .msg-cliente-boton { margin-left: 0; }
.msg-orbi-config { display: inline-flex; align-items: center; gap: 5px; height: 32px; margin-left: auto; padding: 0 11px; border: 1px solid var(--color-border); border-radius: 16px; background: var(--color-surface); cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 500; color: var(--color-muted); transition: background-color 150ms, color 150ms; }
.msg-orbi-config:hover { color: var(--color-text); background: var(--color-surface-alt); }
.msg-orbi-config-on { color: var(--color-text); border-color: var(--color-muted); }
.msg-orbi-config:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.msg-orbi-aviso { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 0 10px; padding: 8px 8px 8px 12px; border-radius: 10px; background: var(--color-surface-alt); }
.msg-orbi-aviso p { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--color-text); }
.msg-cliente-boton-activo, .msg-cliente-boton-activo:hover { color: var(--color-text); background: var(--color-surface-alt); border-color: var(--color-muted); }
.msg-hilo-fila { position: relative; flex: 1; min-height: 0; display: flex; }
.msg-usuario { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.msg-buscador { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 12px; border-radius: 10px; background: var(--color-surface-alt); color: var(--color-muted); border: 1px solid transparent; transition: border-color 150ms, background-color 150ms; }
.msg-buscador:focus-within { border-color: var(--color-primary); background: var(--color-surface); }
.msg-buscador input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font: inherit; font-size: 16px; color: var(--color-text); }
.msg-filtros { display: flex; gap: 6px; margin-top: 10px; }
.msg-filtros button { height: 30px; padding: 0 12px; border: none; border-radius: 15px; background: var(--color-surface-alt); cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 500; color: var(--color-muted); transition: background-color 150ms, color 150ms; }
.msg-filtros button:hover { color: var(--color-text); }
.msg-filtros .msg-filtro-activo { background: var(--color-text); color: var(--color-surface); }
.msg-filtros button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

.msg-charlas { list-style: none; margin: 0; padding: 4px 8px 12px; flex: 1; min-height: 0; overflow-y: auto; }
.msg-vacio { padding: 28px 14px; text-align: center; font-size: 13px; line-height: 1.55; color: var(--color-muted); }
.msg-vacio-error { color: var(--color-error); }
.msg-charla { width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 10px; border: none; border-radius: 12px; background: transparent; cursor: pointer; font: inherit; text-align: left; transition: background-color 150ms; }
.msg-charla:hover { background: var(--color-surface-alt); }
.msg-charla-activa, .msg-charla-activa:hover { background: var(--color-surface-alt); }
.msg-charla:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
.msg-charla-texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.msg-charla-nombre { font-size: 14px; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.msg-charla-ultimo { font-size: 13px; color: var(--color-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.msg-charla-cuando { color: var(--color-muted); font-weight: 400; }
.msg-punto { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; background: var(--color-primary); }

.msg-avatar { flex-shrink: 0; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; background: linear-gradient(135deg, #8a94a6, #5b6578); }
.msg-avatar-anillo { background: linear-gradient(45deg, #f09433, #dc2743 55%, #bc1888); box-shadow: 0 0 0 2px var(--color-surface), 0 0 0 4px #dc2743; margin: 3px; }

.msg-hilo { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.msg-sin-hilo { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 24px; text-align: center; }
.msg-sin-hilo-icono { width: 64px; height: 64px; margin-bottom: 8px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: var(--color-text); border: 2px solid var(--color-text); }
.msg-sin-hilo-titulo { margin: 0; font-size: 18px; font-weight: 600; color: var(--color-text); }
.msg-hilo-interno { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.msg-hilo-cabecera { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
.msg-volver { display: none; width: 36px; height: 36px; margin-left: -8px; padding: 0; border: none; border-radius: 50%; background: transparent; cursor: pointer; align-items: center; justify-content: center; color: var(--color-text); }
.msg-hilo-nombre { flex: 1; min-width: 0; }
.msg-hilo-titulo { margin: 0; font-size: 14.5px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.msg-hilo-sub { margin: 1px 0 0; font-size: 12px; color: var(--color-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.msg-hilo-interno { container: hilo / inline-size; }

.msg-mensajes { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 16px 16px; display: flex; flex-direction: column; }
.msg-dia { margin: 18px 0 10px; text-align: center; font-size: 12px; color: var(--color-muted); }
.msg-fila { display: flex; align-items: flex-end; gap: 8px; margin-top: 2px; }
.msg-fila-cierra { margin-bottom: 8px; }
.msg-fila-negocio { justify-content: flex-end; }
.msg-avatar-hueco { width: 26px; flex-shrink: 0; }
.msg-columna { max-width: min(70%, 420px); display: flex; flex-direction: column; gap: 2px; }
.msg-fila-negocio .msg-columna { align-items: flex-end; }
.msg-burbuja { margin: 0; padding: 9px 14px; border-radius: 20px; font-size: 14.5px; line-height: 1.4; white-space: pre-wrap; overflow-wrap: anywhere; text-decoration: none; }
.msg-burbuja-cliente { background: var(--color-surface-alt); color: var(--color-text); border: 1px solid var(--color-border); }
.msg-burbuja-negocio { color: #fff; background: linear-gradient(135deg, #7b5cff, #b44bd6 60%, #e0467c); }
.msg-hora { font-size: 11px; color: var(--color-muted); padding: 0 6px; }
.msg-foto, .msg-video { display: block; overflow: hidden; border-radius: 18px; border: 1px solid var(--color-border); background: var(--color-surface-alt); }
.msg-foto img, .msg-video { display: block; max-width: 100%; max-height: 320px; width: auto; height: auto; object-fit: contain; }
.msg-audio { max-width: 100%; }

.msg-compositor { padding: 10px 16px 14px; border-top: 1px solid var(--color-border); }
.msg-plazo { margin: 0 0 10px; padding: 10px 12px; border-radius: 10px; font-size: 12.5px; line-height: 1.5; color: var(--color-muted); background: var(--color-surface-alt); }
.msg-error { margin: 0 0 8px; font-size: 12.5px; color: var(--color-error); }
.msg-sugerencias { margin-bottom: 8px; }
.msg-adjuntando { position: relative; width: 84px; height: 84px; margin-bottom: 8px; }
.msg-adjuntando img { width: 100%; height: 100%; object-fit: cover; border-radius: 12px; border: 1px solid var(--color-border); }
.msg-adjuntando button { position: absolute; top: -6px; right: -6px; width: 22px; height: 22px; padding: 0; border: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: #fff; background: rgba(0,0,0,0.7); }
.msg-entrada { display: flex; align-items: flex-end; gap: 6px; padding: 5px 6px 5px 6px; border: 1px solid var(--color-border); border-radius: 24px; background: var(--color-surface); transition: border-color 150ms; }
.msg-entrada:focus-within { border-color: var(--color-muted); }
.msg-entrada-apagada { background: var(--color-surface-alt); }
.msg-entrada textarea { flex: 1; min-width: 0; max-height: 120px; padding: 8px 4px; border: none; outline: none; resize: none; background: transparent; font: inherit; font-size: 16px; line-height: 1.4; color: var(--color-text); field-sizing: content; }
.msg-entrada textarea:disabled { cursor: not-allowed; }
.msg-adjuntar, .msg-enviar { width: 36px; height: 36px; flex-shrink: 0; padding: 0; border: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; background: transparent; color: var(--color-muted); transition: background-color 150ms, color 150ms; }
.msg-adjuntar:hover:not(:disabled) { color: var(--color-text); background: var(--color-surface-alt); }
.msg-enviar { color: #fff; background: var(--color-primary); }
.msg-enviar:disabled, .msg-adjuntar:disabled { opacity: 0.4; cursor: not-allowed; }
.msg-adjuntar:focus-visible, .msg-enviar:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.msg-contador { margin: 4px 8px 0; text-align: right; font-size: 11.5px; color: var(--color-muted); }
.msg-contador-excedido { color: var(--color-error); font-weight: 600; }
.msg-giro { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; animation: msg-giro 0.8s linear infinite; }
@keyframes msg-giro { to { transform: rotate(360deg); } }

@media (max-width: 760px) {
  .msg-caja { grid-template-columns: minmax(0, 1fr); height: calc(100vh - 220px); min-height: 460px; }
  .msg-caja .msg-hilo { display: none; }
  .msg-caja-hilo .msg-lista { display: none; }
  .msg-caja-hilo .msg-hilo { display: flex; }
  .msg-lista { border-right: none; }
  .msg-volver { display: inline-flex; }
  .msg-columna { max-width: 80%; }
}
/* Sin lugar para las tres columnas, la ficha del cliente se abre encima del chat en vez de achicarlo. */
@container bandeja (max-width: 1080px) {
  .msg-hilo-fila > .pc-raiz { position: absolute; top: 0; right: 0; bottom: 0; z-index: 20; width: min(300px, 100%); box-shadow: -16px 0 32px rgba(15, 23, 42, 0.14); }
}
/* Chat angosto: los botones de la cabecera quedan solo con el ícono. */
@container hilo (max-width: 460px) {
  .msg-boton-texto { display: none; }
  .msg-hilo-cabecera .msg-cliente-boton { padding: 0 9px; }
}
@media (prefers-reduced-motion: reduce) { .msg-giro { animation: none; } .msg-charla, .msg-buscador, .msg-filtros button { transition: none; } }
`
