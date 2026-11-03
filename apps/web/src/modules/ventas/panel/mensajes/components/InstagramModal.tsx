import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, Clock, ExternalLink, Play, X } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { parseVideoEmbed } from '@/lib/storefront/utils'
import { ApiError, disconnectInstagram, requestInstagramAccess, startInstagramConnect, type InstagramEstado } from '@/lib/api'

// Modal de Instagram: el único lugar desde donde se pide acceso, se conecta y se desconecta (lo abre
// el botón de la bandeja de Mensajes y la pantalla de Difusión).
//
// Mientras la app de Meta no tenga acceso avanzado, solo conectan las cuentas que el equipo sumó como
// evaluadoras, así que el recorrido son tres pasos que se ven siempre: 1) dejar el @usuario,
// 2) esperar que confirmemos la cuenta, 3) aceptar la invitación y conectar. El estado de la API
// decide en cuál está la persona.
//
// Ojo con el orden: la invitación de Instagram recién existe cuando el equipo suma la cuenta como
// evaluadora y toca "Habilitar" en el superadmin. Mientras el pedido está pendiente (paso 2) NO se le
// manda a Instagram a buscarla: no va a encontrar nada. La invitación se explica en el paso 3.

const PASOS_EVALUADOR = 'Configuración → Apps y sitios web → Invitaciones de prueba'

// Página de Instagram "Apps y sitios web", donde está la pestaña de invitaciones de prueba. Sin los
// parámetros de seguimiento (fbclid y compañía) que trae el link copiado del navegador.
const URL_INVITACIONES = 'https://www.instagram.com/accounts/manage_access/'

// Video que muestra dónde aceptar la invitación de prueba en Instagram. Pegá acá la dirección de
// YouTube, Vimeo o un archivo .mp4/.webm y aparece en el paso 3; mientras sea null, el espacio dice
// "Próximamente". Se borra junto con PASOS_EVALUADOR cuando Meta apruebe el acceso avanzado.
const VIDEO_EVALUADOR_URL: string | null = null

const TITULOS_PASOS = ['Dejá tu usuario', 'Confirmamos tu cuenta', 'Aceptá la invitación y conectá']

// Glifo de Instagram (Feather). lucide-react ya no trae íconos de marcas.
function GlifoInstagram({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

// El degradé de la marca solo va en el logo: es el dato (de qué red se trata), no decoración.
export function Marca({ size = 48 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, borderRadius: size * 0.3, flexShrink: 0, color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
        boxShadow: '0 6px 16px -6px rgba(220, 39, 67, 0.55)',
      }}
    >
      <GlifoInstagram size={size * 0.5} />
    </span>
  )
}

interface Props {
  estado: InstagramEstado | null
  /** ?ig=… de la vuelta del login (conectado | sin-suscripcion | error). */
  resultado?: string | null
  /** Pantalla desde la que se abrió: a ella se vuelve al terminar el login de Instagram. */
  desde?: 'mensajes' | 'difusion'
  onCerrar: () => void
  onCambio: () => void
}

export function InstagramModal({ estado, resultado = null, desde = 'mensajes', onCerrar, onCambio }: Props) {
  const tituloId = useId()
  const [montado, setMontado] = useState(false)
  useEffect(() => { setMontado(true) }, [])

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [onCerrar])

  const conectado = estado?.connected === true

  // Mientras la cuenta no está conectada, el estado se vuelve a pedir solo cada 20 segundos (con la
  // pestaña a la vista): si el equipo habilita el negocio con el modal abierto, pasa del paso 2 al 3
  // sin tener que cerrarlo y abrirlo. Es lo único que se puede sincronizar: Instagram no avisa si
  // la persona aceptó la invitación (eso se verifica al conectar).
  const alCambiar = useRef(onCambio)
  useEffect(() => { alCambiar.current = onCambio })
  useEffect(() => {
    if (conectado) return
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') alCambiar.current()
    }, 20_000)
    return () => clearInterval(t)
  }, [conectado])

  // Sin portal en el servidor: el modal siempre se abre desde un clic, pero Next renderiza primero.
  if (!montado) return null

  return createPortal(
    <div className="igm-fondo" onClick={onCerrar}>
      <style>{CSS}</style>
      <div className="igm-panel" role="dialog" aria-modal="true" aria-labelledby={tituloId} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="igm-cerrar" onClick={onCerrar} aria-label="Cerrar">
          <X size={18} strokeWidth={2} />
        </button>

        {conectado && estado?.connected ? (
          <Conectado username={estado.username} tituloId={tituloId} onCambio={onCambio} onCerrar={onCerrar} />
        ) : (
          <>
            <header className="igm-cabecera">
              <Marca />
              <h2 id={tituloId} className="igm-titulo">Conectá tu Instagram</h2>
              <p className="igm-bajada">Recibí y respondé tus mensajes directos desde la bandeja de Órbita, y muy pronto publicá tus productos.</p>
            </header>
            {resultado === 'sin-suscripcion' && (
              <p className="igm-aviso" role="alert">
                Se conectó la cuenta, pero no se pudo activar el aviso de mensajes nuevos: no vas a recibir mensajes hasta que se resuelva. Probá desconectar y volver a conectar.
              </p>
            )}
            {resultado === 'error' && (
              <p className="igm-aviso" role="alert">
                No se pudo completar la conexión con Instagram. Si decía que no tenías permiso, falta aceptar la invitación de prueba: aceptala y volvé a tocar Verificar y conectar.
              </p>
            )}
            <div className="igm-cuerpo">
              {estado === null ? <p className="igm-suave">Cargando…</p> : <Recorrido estado={estado} desde={desde} onCambio={onCambio} />}
            </div>
            <Incluye />
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ─── Recorrido de tres pasos ───────────────────────────────────────────────────

function Recorrido({ estado, desde, onCambio }: { estado: InstagramEstado; desde: 'mensajes' | 'difusion'; onCambio: () => void }) {
  const solicitud = estado.habilitado === false ? estado.solicitud : null
  const [editando, setEditando] = useState(false)
  // 0 = dejar usuario, 1 = esperar, 2 = conectar.
  const actual = estado.habilitado === false ? (solicitud && !editando ? 1 : 0) : 2

  return (
    <ol className="igm-pasos">
      {TITULOS_PASOS.map((titulo, i) => {
        const hecho = i < actual
        const activo = i === actual
        return (
          <li key={titulo} className={`igm-paso${activo ? ' igm-activo' : ''}${hecho ? ' igm-hecho' : ''}`}>
            <span className="igm-bolita" aria-hidden>{hecho ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
            <div className="igm-paso-texto">
              <p className="igm-paso-titulo">
                {titulo}
                {hecho && i === 0 && solicitud && !editando && <span className="igm-usuario"> · @{solicitud.username}</span>}
              </p>
              {activo && i === 0 && <PedirUsuario inicial={solicitud?.username ?? ''} onEnviado={() => { setEditando(false); onCambio() }} />}
              {activo && i === 1 && solicitud && <PendienteDeConfirmacion usuario={solicitud.username} />}
              {hecho && i === 0 && solicitud && !editando && (
                <button type="button" className="igm-enlace" onClick={() => setEditando(true)}>Cambiar usuario</button>
              )}
            </div>
            {/* El paso 3 es el cierre del recorrido: su contenido ocupa todo el ancho del modal y va centrado,
                en vez de quedar corrido a la derecha de la columna de los números. */}
            {activo && i === 2 && <div className="igm-paso-ancho"><ConectarCuenta desde={desde} /></div>}
          </li>
        )
      })}
    </ol>
  )
}

function PedirUsuario({ inicial, onEnviado }: { inicial: string; onEnviado: () => void }) {
  const [usuario, setUsuario] = useState(inicial)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const campoId = useId()

  const enviar = async () => {
    setTrabajando(true); setError(null)
    try {
      await requestInstagramAccess(usuario)
      onEnviado()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo enviar el pedido. Probá de nuevo.')
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <form className="igm-form" onSubmit={(e) => { e.preventDefault(); if (usuario.trim() && !trabajando) enviar() }}>
      <p className="igm-suave">Escribí el usuario de la cuenta que vas a conectar. Tiene que ser <strong>profesional</strong> (de empresa o de creador).</p>
      <label htmlFor={campoId} className="igm-etiqueta">Usuario de Instagram</label>
      <div className="igm-campo">
        <span className="igm-arroba" aria-hidden>@</span>
        <input
          id={campoId}
          value={usuario.replace(/^@/, '')}
          onChange={(e) => setUsuario(e.target.value)}
          placeholder="tu_tienda"
          maxLength={60}
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
        />
      </div>
      {error && <p className="igm-error" role="alert">{error}</p>}
      <Button type="submit" size="lg" loading={trabajando} disabled={!usuario.trim()} style={{ width: '100%', justifyContent: 'center' }}>Pedir acceso</Button>
    </form>
  )
}

// Paso 2: el pedido está en nuestras manos. Todavía no hay invitación en Instagram, así que se le dice
// de frente que no busque nada ahí (ver el comentario de arriba).
function PendienteDeConfirmacion({ usuario }: { usuario: string }) {
  return (
    <div>
      <p className="igm-suave">
        Tu pedido con <strong>@{usuario}</strong> está <strong>pendiente de confirmación</strong>. Estamos sumando tu cuenta como cuenta de prueba de la app de Órbita.
      </p>
      <div className="igm-nota">
        <Clock size={15} strokeWidth={2} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
        <p>
          Todavía <strong>no te mandamos la invitación</strong>, así que no hace falta que busques nada en Instagram por ahora.
          Cuando la enviemos, este paso se completa y acá mismo te explicamos cómo aceptarla. Volvé a abrir esta ventana más tarde.
        </p>
      </div>
    </div>
  )
}

// Espacio del video de "dónde aceptar la invitación". Sin URL cargada (VIDEO_EVALUADOR_URL) muestra
// el lugar reservado; con URL, el reproductor.
function VideoTutorial() {
  const video = parseVideoEmbed(VIDEO_EVALUADOR_URL)
  const titulo = 'Cómo aceptar la invitación de prueba en Instagram'
  return (
    <figure className="igm-video">
      {video?.tipo === 'file' ? (
        <video src={video.src} controls preload="metadata" playsInline aria-label={titulo} />
      ) : video ? (
        <iframe src={video.src} title={titulo} loading="lazy" allow="fullscreen; picture-in-picture" allowFullScreen />
      ) : (
        <div className="igm-video-vacio">
          <span className="igm-video-play" aria-hidden><Play size={16} strokeWidth={2} fill="currentColor" /></span>
          <p className="igm-video-titulo">Video tutorial</p>
          <p className="igm-video-texto">Próximamente: te mostramos paso a paso a dónde ir para aceptar la invitación.</p>
        </div>
      )}
    </figure>
  )
}

function ConectarCuenta({ desde }: { desde: 'mensajes' | 'difusion' }) {
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const conectar = async () => {
    setTrabajando(true); setError(null)
    try {
      const { url } = await startInstagramConnect(desde)
      window.location.href = url
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo iniciar la conexión. Probá de nuevo.')
      setTrabajando(false)
    }
  }

  return (
    <div className="igm-form igm-centro">
      <p className="igm-suave">
        Te enviamos a tu Instagram la invitación de prueba de la app de Órbita. Aceptala desde <strong>{PASOS_EVALUADOR}</strong>.
        Cuando la hayas aceptado, tocá <strong>Verificar y conectar</strong>: Instagram te muestra tu cuenta (si ya la tenés abierta en el navegador, no te pide la contraseña) y le das permiso a Órbita para{' '}
        {desde === 'mensajes'
          ? 'leer y responder tus mensajes directos.'
          : 'leer y responder tus mensajes directos y publicar tus productos cuando vos lo confirmes. Los permisos se piden una sola vez.'}
      </p>
      <a className="igm-externo" href={URL_INVITACIONES} target="_blank" rel="noopener noreferrer">
        Abrir invitaciones en Instagram <ExternalLink size={15} strokeWidth={2} aria-hidden />
        <span className="igm-solo-lector"> (se abre en una pestaña nueva)</span>
      </a>
      <VideoTutorial />
      {error && <p className="igm-error" role="alert">{error}</p>}
      <Button size="lg" loading={trabajando} onClick={conectar} style={{ width: '100%', justifyContent: 'center' }}>Verificar y conectar</Button>
      <p className="igm-suave igm-pie">
        Si Instagram te dice que no tenés permiso, es que todavía falta aceptar la invitación: aceptala y volvé a tocar acá.
      </p>
    </div>
  )
}

// ─── Ya conectado ──────────────────────────────────────────────────────────────

function Conectado({ username, tituloId, onCambio, onCerrar }: { username: string | null; tituloId: string; onCambio: () => void; onCerrar: () => void }) {
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const desconectar = async () => {
    setTrabajando(true); setError(null)
    try {
      await disconnectInstagram()
      onCambio()
      onCerrar()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo desconectar. Probá de nuevo.')
      setTrabajando(false)
    }
  }

  return (
    <>
      <header className="igm-cabecera">
        <Marca />
        <h2 id={tituloId} className="igm-titulo">Instagram conectado</h2>
        <p className="igm-bajada">Los mensajes directos que te lleguen por Instagram aparecen en la bandeja de Mensajes y tus respuestas salen por el mismo canal.</p>
      </header>
      <div className="igm-cuerpo">
        <div className="igm-cuenta">
          <span className="igm-punto" aria-hidden />
          <div>
            <p className="igm-cuenta-nombre">{username ? `@${username}` : 'Cuenta de Instagram'}</p>
            <p className="igm-suave" style={{ margin: 0 }}>Conectada</p>
          </div>
        </div>
        <p className="igm-suave">Instagram solo permite responder dentro de las 24 horas del último mensaje del cliente.</p>
        {error && <p className="igm-error" role="alert">{error}</p>}
        <div className="igm-acciones">
          <Button variant="secondary" size="lg" onClick={onCerrar} style={{ flex: 1, justifyContent: 'center' }}>Listo</Button>
          <button type="button" className="igm-peligro" disabled={trabajando} onClick={desconectar}>
            {trabajando ? 'Desconectando…' : 'Desconectar'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Lo que incluye ────────────────────────────────────────────────────────────

function Incluye() {
  return (
    <footer className="igm-incluye">
      <Fila icono={<Check size={14} strokeWidth={2.5} />}>Mensajes directos en tu bandeja</Fila>
      <Fila icono={<Clock size={14} strokeWidth={2} />} suave>Publicar productos, comentarios y estadísticas · próximamente</Fila>
    </footer>
  )
}

function Fila({ icono, suave, children }: { icono: ReactNode; suave?: boolean; children: ReactNode }) {
  return (
    <p className={`igm-fila${suave ? ' igm-fila-suave' : ''}`}>
      <span aria-hidden>{icono}</span>
      {children}
    </p>
  )
}

// ─── Estilos ───────────────────────────────────────────────────────────────────

const CSS = `
.igm-fondo {
  position: fixed; inset: 0; z-index: 300; padding: 20px; overflow-y: auto;
  display: flex; align-items: safe center; justify-content: center;
  background: rgba(15, 23, 42, 0.42);
  -webkit-backdrop-filter: blur(12px) saturate(1.15); backdrop-filter: blur(12px) saturate(1.15);
  animation: igm-fade 180ms ease-out;
}
.igm-panel {
  position: relative; width: 100%; max-width: 460px; box-sizing: border-box;
  background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 22px;
  box-shadow: 0 28px 70px -18px rgba(15, 23, 42, 0.45), 0 2px 10px rgba(15, 23, 42, 0.08);
  animation: igm-pop 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.igm-cerrar {
  position: absolute; top: 12px; right: 12px; width: 36px; height: 36px; border: none; border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
  background: transparent; color: var(--color-muted); transition: background-color 150ms, color 150ms;
}
.igm-cerrar:hover { background: var(--color-surface-alt); color: var(--color-text); }
.igm-cabecera {
  padding: 28px 28px 20px; border-radius: 22px 22px 0 0;
  background: linear-gradient(180deg, var(--color-surface-alt), var(--color-surface));
}
.igm-titulo { margin: 16px 0 6px; font-size: 21px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; color: var(--color-text); }
.igm-bajada { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--color-muted); max-width: 38ch; }
.igm-cuerpo { padding: 4px 28px 24px; }
.igm-aviso { margin: 0 28px 4px; padding: 10px 12px; border-radius: 10px; font-size: 12.5px; line-height: 1.5; color: var(--color-text); background: var(--color-surface-alt); border: 1px solid var(--color-border); }
.igm-suave { margin: 0 0 12px; font-size: 13px; line-height: 1.55; color: var(--color-muted); }
.igm-suave strong, .igm-nota strong { color: var(--color-text); font-weight: 600; }

.igm-pasos { list-style: none; margin: 0; padding: 0; }
.igm-paso { position: relative; display: grid; grid-template-columns: 28px 1fr; column-gap: 14px; padding-bottom: 18px; }
.igm-paso:last-child { padding-bottom: 0; }
.igm-paso:not(:last-child)::before {
  content: ''; position: absolute; left: 13px; top: 30px; bottom: 2px; width: 2px; border-radius: 2px; background: var(--color-border);
}
.igm-hecho:not(:last-child)::before { background: var(--color-success); opacity: 0.55; }
.igm-bolita {
  width: 28px; height: 28px; border-radius: 50%; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
  font-size: 12.5px; font-weight: 700; border: 2px solid var(--color-border); color: var(--color-muted); background: var(--color-surface);
}
.igm-activo .igm-bolita { border-color: var(--color-primary); color: var(--color-primary); box-shadow: 0 0 0 4px var(--color-primary-bg); }
.igm-hecho .igm-bolita { border-color: var(--color-success); background: var(--color-success); color: #fff; }
.igm-paso-texto { min-width: 0; padding-top: 3px; }
.igm-paso-ancho { grid-column: 1 / -1; min-width: 0; margin-top: 4px; }
.igm-activo:last-child .igm-paso-titulo { margin-bottom: 0; }
.igm-paso-titulo { margin: 0 0 8px; font-size: 14px; font-weight: 600; line-height: 1.3; color: var(--color-muted); }
.igm-activo .igm-paso-titulo, .igm-hecho .igm-paso-titulo { color: var(--color-text); }
.igm-paso:not(.igm-activo) .igm-paso-titulo { margin-bottom: 0; }
.igm-hecho .igm-paso-titulo { margin-bottom: 2px; }
.igm-usuario { font-weight: 500; color: var(--color-muted); }

.igm-form { display: flex; flex-direction: column; }
.igm-etiqueta { margin: 0 0 6px; font-size: 12px; font-weight: 600; color: var(--color-text); }
.igm-campo {
  display: flex; align-items: center; height: 48px; padding: 0 14px; margin-bottom: 14px; box-sizing: border-box;
  border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface-alt);
  transition: border-color 150ms, box-shadow 150ms, background-color 150ms;
}
.igm-campo:focus-within { border-color: var(--color-primary); background: var(--color-surface); box-shadow: 0 0 0 4px var(--color-primary-bg); }
.igm-arroba { margin-right: 4px; font-size: 15px; font-weight: 600; color: var(--color-muted); }
.igm-campo input { flex: 1; min-width: 0; height: 100%; border: none; outline: none; background: transparent; font: inherit; font-size: 16px; color: var(--color-text); }
.igm-campo input::placeholder { color: var(--color-muted); opacity: 0.7; }
.igm-error { margin: -4px 0 12px; font-size: 12.5px; line-height: 1.4; color: var(--color-error); }

.igm-nota { display: flex; gap: 8px; margin: 0 0 12px; padding: 10px 12px; border-radius: 10px; font-size: 12.5px; line-height: 1.5; color: var(--color-muted); background: var(--color-surface-alt); }
.igm-nota p { margin: 0; }
.igm-video { position: relative; aspect-ratio: 16 / 9; margin: 0 0 12px; overflow: hidden; border-radius: 12px; border: 1px solid var(--color-border); background: var(--color-surface-alt); }
.igm-video video, .igm-video iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: #000; }
.igm-video-vacio { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 12px; text-align: center; }
.igm-video-play { width: 38px; height: 38px; margin-bottom: 6px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: var(--color-muted); background: var(--color-surface); border: 1px solid var(--color-border); }
.igm-video-titulo { margin: 0; font-size: 13px; font-weight: 600; color: var(--color-text); }
.igm-video-texto { margin: 0; max-width: 30ch; font-size: 12px; line-height: 1.45; color: var(--color-muted); }
.igm-centro, .igm-centro .igm-suave, .igm-centro .igm-error { text-align: center; }
.igm-pie { margin: 10px 0 0; font-size: 12px; }
.igm-externo {
  display: flex; align-items: center; justify-content: center; gap: 8px; height: 46px; margin: 0 0 12px; box-sizing: border-box;
  border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); text-decoration: none;
  font-size: 14px; font-weight: 600; color: var(--color-text); transition: background-color 150ms, border-color 150ms;
}
.igm-externo:hover { background: var(--color-surface-alt); border-color: var(--color-muted); }
.igm-externo:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.igm-solo-lector { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.igm-enlace { align-self: flex-start; padding: 6px 0; border: none; background: transparent; cursor: pointer; font: inherit; font-size: 12.5px; color: var(--color-primary); text-decoration: none; }
.igm-enlace:hover { text-decoration: underline; text-underline-offset: 3px; }

.igm-incluye { display: flex; flex-direction: column; gap: 8px; padding: 16px 28px 22px; border-top: 1px solid var(--color-border); border-radius: 0 0 22px 22px; }
.igm-fila { display: flex; align-items: flex-start; gap: 9px; margin: 0; font-size: 12.5px; line-height: 1.4; color: var(--color-text); }
.igm-fila > span { display: inline-flex; margin-top: 1px; flex-shrink: 0; }
.igm-fila-suave { color: var(--color-muted); }

.igm-cuenta { display: flex; align-items: center; gap: 12px; padding: 14px 16px; margin-bottom: 14px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface-alt); }
.igm-cuenta-nombre { margin: 0 0 1px; font-size: 15px; font-weight: 600; color: var(--color-text); }
.igm-punto { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; background: var(--color-success); box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.16); }
.igm-acciones { display: flex; align-items: center; gap: 10px; }
.igm-peligro { height: 48px; padding: 0 16px; border: none; border-radius: 10px; background: transparent; cursor: pointer; font: inherit; font-size: 14px; font-weight: 600; color: var(--color-error); transition: background-color 150ms; }
.igm-peligro:hover:not(:disabled) { background: var(--color-error-bg); }
.igm-peligro:disabled { opacity: 0.6; cursor: not-allowed; }

.igm-cerrar:focus-visible, .igm-enlace:focus-visible, .igm-peligro:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

@keyframes igm-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes igm-pop { from { opacity: 0; transform: translateY(10px) scale(0.98) } to { opacity: 1; transform: none } }
@media (prefers-reduced-motion: reduce) { .igm-fondo, .igm-panel { animation: none; } .igm-campo, .igm-cerrar, .igm-peligro { transition: none; } }
@media (max-width: 520px) {
  .igm-fondo { padding: 12px; }
  .igm-panel { border-radius: 18px; }
  .igm-cabecera { padding: 22px 20px 16px; border-radius: 18px 18px 0 0; }
  .igm-cuerpo { padding: 4px 20px 20px; }
  .igm-aviso { margin: 0 20px 4px; }
  .igm-incluye { padding: 14px 20px 18px; border-radius: 0 0 18px 18px; }
}
`
