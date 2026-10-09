import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { platformApi, type MarketingCanales, type TiktokCreador, type TiktokEstado, type TiktokPublicacion } from '@/lib/platform/api'
import { Toast, type ToastVariant } from '@/design-system/components/Toast'
import { InstagramBandeja } from './InstagramBandeja'
import {
  useFetch, Card, Table, Chip, Loader, ErrorBox, Empty, PageHeader, ConfirmModal, dateTime,
  btnGhost, btnGhostSm, btnPrimary, inputStyle,
} from './ui'

// Marketing: los canales de la empresa para llegar a más gente (TikTok, Instagram y WhatsApp).
// Arriba, una tarjeta por canal con su estado; abajo, el detalle del canal elegido.
//
// TikTok es el único que se maneja desde acá: se conecta la cuenta de la empresa y se publican videos. Instagram y
// WhatsApp se conectan por negocio desde su bandeja de mensajes: esta pantalla muestra su estado y qué falta.
//
// Publicar en TikTok:
// La pantalla de publicar sigue las reglas de TikTok para la Content Posting API (es lo que revisan
// en la auditoría): se muestra con qué cuenta se publica, la visibilidad se elige a mano (sin valor
// por defecto) entre las que TikTok permite en ese momento, los comentarios, dúos y stitch arrancan
// apagados, el contenido comercial se declara, y antes de publicar se muestra la declaración de
// consentimiento. Qué hace cada llamada: apps/api/src/marketing/tiktok/tiktok.service.ts.

type Aviso = { variant: ToastVariant; title: string; description?: string }

const PRIVACIDAD: Record<string, string> = {
  PUBLIC_TO_EVERYONE: 'Todos',
  MUTUAL_FOLLOW_FRIENDS: 'Amigos (se siguen entre sí)',
  FOLLOWER_OF_CREATOR: 'Seguidores',
  SELF_ONLY: 'Solo yo',
  BORRADOR: 'Borrador',
}
const ESTADO: Record<string, { texto: string; tono: 'green' | 'red' | 'amber' | 'gray' }> = {
  PROCESSING_UPLOAD: { texto: 'Subiendo', tono: 'amber' },
  PROCESSING_DOWNLOAD: { texto: 'Procesando', tono: 'amber' },
  SEND_TO_USER_INBOX: { texto: 'En borradores', tono: 'gray' },
  PUBLISH_COMPLETE: { texto: 'Publicado', tono: 'green' },
  FAILED: { texto: 'Falló', tono: 'red' },
}
const EN_PROCESO = new Set(['PROCESSING_UPLOAD', 'PROCESSING_DOWNLOAD'])
const URL_MUSICA = 'https://www.tiktok.com/legal/page/global/music-usage-confirmation/en'
const URL_MARCA = 'https://www.tiktok.com/legal/page/global/bc-policy/en'

const textarea: React.CSSProperties = { ...inputStyle, height: 'auto', minHeight: 96, padding: '11px 13px', lineHeight: 1.5, resize: 'vertical', width: '100%' }

type Canal = 'tiktok' | 'instagram' | 'whatsapp'
type Tono = 'green' | 'amber' | 'gray'
type Estado = { texto: string; tono: Tono }

export function TabMarketing({ puedePublicar }: { puedePublicar: boolean }) {
  const router = useRouter()
  const [tick, setTick] = useState(0)
  const { data: tiktok, loading: cargandoTiktok } = useFetch(() => platformApi.tiktokEstado(), [tick])
  const [tickCanales, setTickCanales] = useState(0)
  const { data: canales } = useFetch(() => platformApi.marketingCanales(), [tickCanales])
  const [canal, setCanal] = useState<Canal>('tiktok')
  const [aviso, setAviso] = useState<Aviso | null>(null)

  // TikTok vuelve a esta pantalla con el resultado de la conexión en la dirección.
  useEffect(() => {
    const r = router.query.tiktok
    if (r === 'conectado') setAviso({ variant: 'success', title: 'Cuenta de TikTok conectada' })
    else if (r === 'error') setAviso({ variant: 'error', title: 'No se pudo conectar TikTok', description: 'Probá de nuevo. Si sigue igual, revisá que la dirección de redirección de la app sea la correcta.' })
    if (r) { setCanal('tiktok'); void router.replace('/superadmin?seccion=marketing', undefined, { shallow: true }) }
  }, [router.query.tiktok]) // eslint-disable-line react-hooks/exhaustive-deps

  // Qué dice cada tarjeta de un vistazo. El estado siempre va en palabras: el color solo lo acompaña.
  const estadoTiktok: Estado = !tiktok ? { texto: cargandoTiktok ? 'Cargando…' : 'No disponible', tono: 'gray' }
    : !tiktok.configurado ? { texto: 'Sin configurar', tono: 'gray' }
    : tiktok.conectado ? { texto: 'Conectado', tono: 'green' } : { texto: 'Sin conectar', tono: 'gray' }
  const lineaTiktok = !tiktok ? '' : !tiktok.configurado ? 'Faltan los datos de la app' : tiktok.cuenta?.nombre ?? 'Todavía no hay una cuenta'

  const ig = canales?.instagram
  const estadoInstagram: Estado = !canales ? { texto: 'Cargando…', tono: 'gray' } : ig?.conectado ? { texto: 'Conectado', tono: 'green' } : { texto: 'Sin conectar', tono: 'gray' }
  const sinLeer = ig?.conectado ? ig.mensajesSinLeer : 0
  const lineaInstagram = !canales ? '' : ig?.conectado
    ? `${ig.usuario ? `@${ig.usuario}` : 'Cuenta conectada'}${sinLeer > 0 ? ` · ${sinLeer} sin leer` : ''}`
    : 'Todavía no hay una cuenta'

  // WhatsApp todavía no se usa: hace falta una cuenta de WhatsApp Business con un número de la empresa.
  const estadoWhatsapp: Estado = { texto: 'Próximamente', tono: 'gray' }
  const lineaWhatsapp = 'Requiere una cuenta Business'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`
        .mk-canal { transition: border-color 150ms, background-color 150ms; }
        .mk-canal:hover { border-color: var(--color-muted); }
        .mk-canal[aria-pressed="true"] { border-color: var(--color-primary); }
        .mk-canal:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .mk-canal { transition: none; } }
      `}</style>

      <PageHeader title="Marketing" subtitle="Los canales de la empresa para llegar a más gente: conexión, publicaciones y mensajes" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        <CanalTarjeta nombre="TikTok" para="Videos de la marca" estado={estadoTiktok} linea={lineaTiktok} activo={canal === 'tiktok'} onElegir={() => setCanal('tiktok')} />
        <CanalTarjeta nombre="Instagram" para="Mensajes directos y, más adelante, publicaciones" estado={estadoInstagram} linea={lineaInstagram} activo={canal === 'instagram'} onElegir={() => setCanal('instagram')} />
        <CanalTarjeta nombre="WhatsApp" para="Atención por mensajes a clientes y contactos" estado={estadoWhatsapp} linea={lineaWhatsapp} activo={canal === 'whatsapp'} onElegir={() => setCanal('whatsapp')} />
      </div>

      {canal === 'tiktok' && <PanelTiktok estado={tiktok} puedePublicar={puedePublicar} refrescar={tick} onCambio={() => setTick((n) => n + 1)} setAviso={setAviso} />}
      {canal === 'instagram' && <PanelInstagram canales={canales} puedeVer={puedePublicar} onCambio={() => setTickCanales((n) => n + 1)} />}
      {canal === 'whatsapp' && <PanelWhatsapp />}

      {aviso && <Toast variant={aviso.variant} title={aviso.title} description={aviso.description} onClose={() => setAviso(null)} />}
    </div>
  )
}

function CanalTarjeta({ nombre, para, estado, linea, activo, onElegir }: { nombre: string; para: string; estado: Estado; linea: string; activo: boolean; onElegir: () => void }) {
  return (
    <button
      type="button"
      className="mk-canal"
      onClick={onElegir}
      aria-pressed={activo}
      style={{
        display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
        minHeight: 132, padding: '16px 18px', borderRadius: 14, background: 'var(--color-bg)',
        border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-card)',
      }}
    >
      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{nombre}</span>
      <span style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.45 }}>{para}</span>
      <span style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
        <Chip text={estado.texto} tone={estado.tono} dot />
        <span style={{ fontSize: 12.5, color: 'var(--color-body)', minHeight: 18, overflowWrap: 'anywhere' }}>{linea}</span>
      </span>
    </button>
  )
}

// Una línea "etiqueta: valor" para los datos de la cuenta.
function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', fontSize: 13.5, padding: '9px 0', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
      <span style={{ width: 150, flexShrink: 0, color: 'var(--color-muted)', fontSize: 12.5 }}>{etiqueta}</span>
      <span style={{ color: 'var(--color-text)', minWidth: 0, overflowWrap: 'anywhere' }}>{children}</span>
    </div>
  )
}

// Una fila de "qué se puede hacer" o de un paso a seguir: título, explicación y su estado en palabras.
function Fila({ titulo, detalle, estado, ultimo }: { titulo: string; detalle: string; estado: Estado; ultimo?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 0', borderBottom: ultimo ? 'none' : '1px solid var(--color-border)', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0, flex: '1 1 320px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{titulo}</div>
        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 3, lineHeight: 1.5 }}>{detalle}</div>
      </div>
      <Chip text={estado.texto} tone={estado.tono} dot />
    </div>
  )
}

const enlaceBoton: React.CSSProperties = { ...btnGhostSm, textDecoration: 'none', height: 34 }

// ─── TikTok ─────────────────────────────────────────────────────────────────────

function PanelTiktok({ estado, puedePublicar, refrescar, onCambio, setAviso }: {
  estado: TiktokEstado | null; puedePublicar: boolean; refrescar: number; onCambio: () => void; setAviso: (a: Aviso) => void
}) {
  const [conectando, setConectando] = useState(false)
  const [desconectando, setDesconectando] = useState(false)

  const conectar = async () => {
    setConectando(true)
    try {
      const { url } = await platformApi.tiktokConectar()
      window.location.href = url
    } catch {
      setAviso({ variant: 'error', title: 'No se pudo iniciar la conexión', description: 'Revisá que los secretos de la app de TikTok estén cargados.' })
      setConectando(false)
    }
  }

  if (!estado) return <Card title="TikTok"><Loader /></Card>

  return (
    <>
      <Card title="Cuenta de TikTok" subtitle="La cuenta de la empresa con la que se publican los videos">
        {!estado.configurado ? (
          <Empty text="TikTok todavía no está configurado en este entorno: faltan los datos de la app (client key, client secret y clave de cifrado)." />
        ) : !estado.conectado || !estado.cuenta ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, color: 'var(--color-muted)' }}>Todavía no hay una cuenta conectada.</span>
            {puedePublicar && (
              <button onClick={conectar} disabled={conectando} style={{ ...btnPrimary, opacity: conectando ? 0.6 : 1 }}>
                {conectando ? 'Redirigiendo…' : 'Conectar cuenta de TikTok'}
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              {estado.cuenta.avatar && <img src={estado.cuenta.avatar} alt="" width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover' }} />}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{estado.cuenta.nombre ?? 'Cuenta de TikTok'}</div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                  Conectada el {dateTime(estado.cuenta.conectadaEl)} · permisos: {estado.cuenta.permisos.join(', ') || '—'}
                </div>
              </div>
            </div>
            {puedePublicar && <button onClick={() => setDesconectando(true)} className="ds-hover" style={btnGhostSm}>Desconectar</button>}
          </div>
        )}
      </Card>

      {estado.conectado && <Publicar puedePublicar={puedePublicar} onPublicado={onCambio} setAviso={setAviso} />}
      {estado.conectado && <Publicaciones refrescar={refrescar} />}

      {desconectando && (
        <ConfirmModal
          title="Desconectar la cuenta de TikTok"
          body="Se revoca el acceso de Órbita a la cuenta y se borra la conexión. Los videos ya publicados no se tocan. Para volver a publicar hay que conectarla de nuevo."
          confirmLabel="Desconectar"
          onCancel={() => setDesconectando(false)}
          onConfirm={async () => {
            await platformApi.tiktokDesconectar()
            setDesconectando(false)
            onCambio()
            setAviso({ variant: 'success', title: 'Cuenta de TikTok desconectada' })
          }}
        />
      )}
    </>
  )
}

// ─── Instagram ──────────────────────────────────────────────────────────────────

function PanelInstagram({ canales, puedeVer, onCambio }: { canales: MarketingCanales | null; puedeVer: boolean; onCambio: () => void }) {
  if (!canales) return <Card title="Instagram"><Loader /></Card>
  const { instagram: ig, negocio } = canales
  // Reconectar la cuenta (si venció el acceso) se hace desde la bandeja del negocio al que está atada.
  const bandeja = negocio ? `https://${negocio.subdominio}.orbita.site/admin/ventas/mensajes` : null

  return (
    <>
      <Card
        title="Cuenta de Instagram"
        subtitle="La cuenta de la empresa conectada a Órbita"
        action={bandeja && (!ig.conectado || ig.diasRestantes < 10)
          ? <a href={bandeja} target="_blank" rel="noreferrer" className="ds-hover" style={enlaceBoton}>{ig.conectado ? 'Renovar la conexión' : 'Conectar la cuenta'}</a>
          : undefined}
      >
        {ig.conectado ? (
          <div>
            <Dato etiqueta="Cuenta">
              {ig.usuario ? <a href={`https://www.instagram.com/${ig.usuario}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>@{ig.usuario}</a> : 'Cuenta conectada'}
            </Dato>
            <Dato etiqueta="Acceso">
              {ig.diasRestantes > 0 ? `Vigente por ${ig.diasRestantes} ${ig.diasRestantes === 1 ? 'día' : 'días'}` : 'Vencido: hay que volver a conectar la cuenta'}
              <span style={{ color: 'var(--color-muted)' }}> · se renueva solo cada noche</span>
            </Dato>
          </div>
        ) : (
          <Empty text={negocio ? 'Todavía no hay una cuenta de Instagram conectada. Se conecta desde la bandeja de mensajes del negocio de la empresa.' : 'No se encontró el negocio al que van conectadas las cuentas de la empresa.'} />
        )}
      </Card>

      {ig.conectado && <InstagramBandeja permitido={puedeVer} onCambio={onCambio} />}

      <Card title="Qué se puede hacer" subtitle="Lo que está disponible hoy y lo que depende de la revisión de Meta">
        <Fila
          titulo="Recibir y contestar mensajes directos"
          detalle="Los mensajes que llegan a la cuenta aparecen en la bandeja de arriba y se contestan desde ahí."
          estado={ig.conectado ? { texto: 'Disponible', tono: 'green' } : { texto: 'Sin conectar', tono: 'gray' }}
        />
        <Fila
          titulo="Publicar fotos y Reels"
          detalle="Necesita el permiso de publicación de Instagram, que Meta da después de revisar la app."
          estado={{ texto: 'Pendiente de Meta', tono: 'amber' }}
        />
        <Fila
          titulo="Métricas de la cuenta"
          detalle="Alcance, seguidores e interacciones. Depende de la misma revisión."
          estado={{ texto: 'Pendiente de Meta', tono: 'amber' }}
          ultimo
        />
      </Card>
    </>
  )
}

// ─── WhatsApp ───────────────────────────────────────────────────────────────────

function PanelWhatsapp() {
  return (
    <Card title="WhatsApp" subtitle="Atención por mensajes a clientes y contactos">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 560 }}>
        <div><Chip text="Próximamente" tone="gray" dot /></div>
        <div style={{ fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.6 }}>
          Para usar WhatsApp con la cuenta de la empresa hace falta una cuenta de WhatsApp Business con un número exclusivo. Cuando la tengamos, los mensajes van a llegar y contestarse desde esta pantalla, igual que los de Instagram.
        </div>
      </div>
    </Card>
  )
}

// Elegir el video: se sube un archivo de la computadora (directo a R2, con barra de avance) o se pega una dirección https.
function SelectorDeVideo({ url, onUrl, onOcupado, duracionMaxMin }: { url: string; onUrl: (u: string) => void; onOcupado: (o: boolean) => void; duracionMaxMin: number }) {
  const [archivo, setArchivo] = useState<{ nombre: string; mb: string } | null>(null)
  const [progreso, setProgreso] = useState<number | null>(null)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const elegir = async (f: File) => {
    setError('')
    if (!TIPOS_DE_VIDEO.includes(f.type)) { setError('Tiene que ser un video mp4, mov o webm.'); return }
    if (f.size > MAX_VIDEO_MB * 1024 * 1024) { setError(`El video no puede pasar de ${MAX_VIDEO_MB} MB.`); return }
    onOcupado(true)
    setProgreso(0)
    try {
      const { uploadUrl, publicUrl } = await platformApi.tiktokUrlDeSubida(f.type)
      await subirArchivo(uploadUrl, f, setProgreso)
      setArchivo({ nombre: f.name, mb: (f.size / 1048576).toFixed(1) })
      onUrl(publicUrl)
    } catch (e) {
      setArchivo(null)
      onUrl('')
      setError(e instanceof Error && e.message ? e.message : 'No se pudo subir el video. Probá de nuevo.')
    } finally {
      setProgreso(null)
      onOcupado(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Video</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void elegir(f) }} />
        <button type="button" onClick={() => input.current?.click()} disabled={progreso !== null} className="ds-hover" style={{ ...btnGhostSm, height: 38, opacity: progreso !== null ? 0.6 : 1 }}>
          {progreso !== null ? 'Subiendo…' : archivo ? 'Cambiar el archivo' : 'Subir desde mi computadora'}
        </button>
        {progreso !== null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--color-muted)' }}>
            <span style={{ width: 120, height: 6, borderRadius: 3, background: 'var(--color-surface-alt)', overflow: 'hidden' }}>
              <span style={{ display: 'block', width: `${progreso}%`, height: '100%', background: 'var(--color-primary)', transition: 'width 150ms' }} />
            </span>
            {progreso}%
          </span>
        )}
        {progreso === null && archivo && <span style={{ fontSize: 12.5, color: 'var(--color-body)' }}>{archivo.nombre} · {archivo.mb} MB</span>}
      </div>
      {error && <span role="alert" style={{ fontSize: 12.5, color: 'var(--color-error)' }}>{error}</span>}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, fontWeight: 400, color: 'var(--color-muted)' }}>
        O pegá la dirección de un video (https)
        <input value={url} onChange={(e) => { setArchivo(null); onUrl(e.target.value) }} placeholder="https://…/video.mp4" style={inputStyle} />
      </label>
      <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>mp4, mov o webm, hasta {MAX_VIDEO_MB} MB. Duración máxima de la cuenta: {duracionMaxMin} min.</span>
    </div>
  )
}

const TIPOS_DE_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm']
const MAX_VIDEO_MB = 200

/** PUT del archivo a la dirección firmada de R2, con avance (fetch todavía no informa el progreso de una subida). */
function subirArchivo(uploadUrl: string, archivo: File, onProgreso: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', archivo.type)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgreso(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`El almacenamiento rechazó el archivo (${xhr.status}).`)))
    xhr.onerror = () => reject(new Error('Se cortó la subida. Revisá la conexión y probá de nuevo.'))
    xhr.send(archivo)
  })
}

// ─── Publicar un video ──────────────────────────────────────────────────────────

function Interruptor({ marcado, onChange, texto, deshabilitado }: { marcado: boolean; onChange: (v: boolean) => void; texto: string; deshabilitado?: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: deshabilitado ? 'var(--color-muted)' : 'var(--color-text)', cursor: deshabilitado ? 'not-allowed' : 'pointer' }}>
      <input type="checkbox" checked={marcado} disabled={deshabilitado} onChange={(e) => onChange(e.target.checked)} style={{ width: 16, height: 16 }} />
      {texto}
    </label>
  )
}

function Publicar({ puedePublicar, onPublicado, setAviso }: { puedePublicar: boolean; onPublicado: () => void; setAviso: (a: Aviso) => void }) {
  const { data: creador, error } = useFetch<TiktokCreador>(() => platformApi.tiktokCreador(), [])
  const [videoUrl, setVideoUrl] = useState('')
  const [title, setTitle] = useState('')
  // Sin valor por defecto: TikTok pide que la visibilidad la elija una persona.
  const [privacidad, setPrivacidad] = useState('')
  const [comentarios, setComentarios] = useState(false)
  const [duetos, setDuetos] = useState(false)
  const [stitch, setStitch] = useState(false)
  const [declara, setDeclara] = useState(false)
  const [tuMarca, setTuMarca] = useState(false)
  const [deMarca, setDeMarca] = useState(false)
  const [ia, setIa] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [subiendo, setSubiendo] = useState(false) // se está subiendo el archivo elegido
  // Directo: se publica desde acá. Borrador: el video llega a los borradores de TikTok y una persona lo termina en la app.
  const [modo, setModo] = useState<'directo' | 'borrador'>('directo')

  if (error) return <Card title="Publicar un video"><ErrorBox msg="No se pudo consultar a TikTok qué se puede hacer con la cuenta. Puede que haya que volver a conectarla." /></Card>
  if (!creador) return <Card title="Publicar un video"><Loader /></Card>

  const sinTipoDeMarca = declara && !tuMarca && !deMarca
  // Un video de marca no puede ser privado: TikTok lo rechaza.
  const marcaYPrivado = declara && (tuMarca || deMarca) && privacidad === 'SELF_ONLY'
  const urlValida = videoUrl.startsWith('https://') && !subiendo
  const listo = modo === 'borrador'
    ? puedePublicar && !enviando && urlValida
    : puedePublicar && !enviando && urlValida && title.trim().length > 0 && !!privacidad && !sinTipoDeMarca && !marcaYPrivado

  const publicar = async () => {
    setEnviando(true)
    try {
      if (modo === 'borrador') {
        await platformApi.tiktokBorrador(videoUrl.trim())
        setAviso({ variant: 'success', title: 'Video enviado a los borradores de TikTok', description: 'Abrí TikTok con la cuenta de la empresa, buscá la notificación o los borradores y terminá de publicarlo desde ahí.' })
        setVideoUrl('')
        onPublicado()
        return
      }
      await platformApi.tiktokPublicar({
        title: title.trim(), videoUrl: videoUrl.trim(), privacyLevel: privacidad,
        disableComment: !comentarios, disableDuet: !duetos, disableStitch: !stitch,
        brandOrganic: declara && tuMarca, brandContent: declara && deMarca, isAigc: ia,
      })
      setAviso({ variant: 'success', title: 'Video enviado a TikTok', description: 'Se está procesando. El estado se actualiza abajo.' })
      setVideoUrl(''); setTitle(''); setPrivacidad(''); setComentarios(false); setDuetos(false); setStitch(false)
      setDeclara(false); setTuMarca(false); setDeMarca(false); setIa(false)
      onPublicado()
    } catch (e) {
      setAviso({ variant: 'error', title: 'No se pudo publicar', description: e instanceof Error ? e.message : undefined })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card title="Publicar un video" subtitle="Se baja de la dirección que pongas y se sube a TikTok">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 680 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5 }}>
          {creador.avatar && <img src={creador.avatar} alt="" width={28} height={28} style={{ borderRadius: '50%', objectFit: 'cover' }} />}
          <span style={{ color: 'var(--color-muted)' }}>Publicás como</span>
          <strong style={{ color: 'var(--color-text)' }}>{creador.nombre || creador.usuario}</strong>
          {creador.usuario && <span style={{ color: 'var(--color-muted)' }}>@{creador.usuario}</span>}
        </div>

        <div role="group" aria-label="Cómo enviarlo" style={{ display: 'inline-flex', background: 'var(--color-surface-alt)', borderRadius: 10, padding: 3, alignSelf: 'flex-start' }}>
          {([['directo', 'Publicar directo'], ['borrador', 'Enviar a borradores']] as const).map(([id, texto]) => (
            <button key={id} type="button" onClick={() => setModo(id)} aria-pressed={modo === id} className="ds-hover"
              style={{ height: 30, padding: '0 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: modo === id ? 600 : 500, background: modo === id ? 'var(--color-bg)' : 'transparent', color: modo === id ? 'var(--color-text)' : 'var(--color-muted)' }}>
              {texto}
            </button>
          ))}
        </div>
        {modo === 'borrador' && (
          <div style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            El video llega a los borradores de la cuenta. El título, la visibilidad y el resto los completa una persona en la app de TikTok antes de publicarlo.
          </div>
        )}

        <SelectorDeVideo url={videoUrl} onUrl={setVideoUrl} onOcupado={setSubiendo} duracionMaxMin={Math.round(creador.duracionMaximaSeg / 60)} />

        {modo === 'directo' && (<>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
          Título
          <textarea value={title} onChange={(e) => setTitle(e.target.value)} maxLength={2200} placeholder="Descripción y #hashtags" style={textarea} />
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-muted)', textAlign: 'right' }}>{title.length} / 2200</span>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
          Quién puede ver este video
          <select value={privacidad} onChange={(e) => setPrivacidad(e.target.value)} style={inputStyle}>
            <option value="">Elegí una opción…</option>
            {creador.privacidades.map((p) => <option key={p} value={p}>{PRIVACIDAD[p] ?? p}</option>)}
          </select>
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-muted)' }}>
            Mientras la app de TikTok no pase su auditoría, solo se puede publicar con la opción &quot;Solo yo&quot;.
          </span>
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Permitir que los demás</div>
          <Interruptor marcado={comentarios} onChange={setComentarios} texto="Comenten" deshabilitado={creador.comentariosDeshabilitados} />
          <Interruptor marcado={duetos} onChange={setDuetos} texto="Hagan un dúo" deshabilitado={creador.duetosDeshabilitados} />
          <Interruptor marcado={stitch} onChange={setStitch} texto="Hagan un stitch" deshabilitado={creador.stitchDeshabilitado} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <Interruptor marcado={declara} onChange={(v) => { setDeclara(v); if (!v) { setTuMarca(false); setDeMarca(false) } }} texto="Divulgar contenido comercial: este video promociona un negocio" />
          {declara && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, paddingLeft: 26 }}>
              <Interruptor marcado={tuMarca} onChange={setTuMarca} texto="Tu marca: promocionás tu propio negocio (es el caso de los videos de Órbita)" />
              <Interruptor marcado={deMarca} onChange={setDeMarca} texto="Contenido de marca: es una promoción pagada por un tercero" />
              {sinTipoDeMarca && <span style={{ fontSize: 12.5, color: 'var(--color-error)' }}>Elegí al menos una de las dos opciones.</span>}
              {marcaYPrivado && <span style={{ fontSize: 12.5, color: 'var(--color-error)' }}>Un video de marca no puede ser privado: TikTok lo rechaza.</span>}
              <span style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>Se va a marcar el video como &quot;{deMarca ? 'Asociación pagada' : 'Promocional'}&quot;.</span>
            </div>
          )}
        </div>

        <Interruptor marcado={ia} onChange={setIa} texto="Este video fue generado o editado con IA" />

        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
          Al publicar aceptás la <a href={URL_MUSICA} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>Confirmación de uso de música de TikTok</a>
          {declara && deMarca && <> y la <a href={URL_MARCA} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>Política de contenido de marca</a></>}.
          {' '}El video puede tardar unos minutos en aparecer en la cuenta después de enviarlo.
        </div>

        </>)}

        <div>
          <button onClick={publicar} disabled={!listo} style={{ ...btnPrimary, opacity: listo ? 1 : 0.5, cursor: listo ? 'pointer' : 'not-allowed' }}>
            {enviando ? 'Enviando a TikTok…' : modo === 'borrador' ? 'Enviar a borradores' : 'Publicar en TikTok'}
          </button>
        </div>
      </div>
    </Card>
  )
}

// ─── Historial ──────────────────────────────────────────────────────────────────

function Publicaciones({ refrescar }: { refrescar: number }) {
  const [tick, setTick] = useState(0)
  const { data: posts, error } = useFetch<TiktokPublicacion[]>(() => platformApi.tiktokPublicaciones(), [refrescar, tick])
  const [actualizando, setActualizando] = useState<string | null>(null)

  // Mientras TikTok procesa un video, se le pregunta cada tanto cómo va.
  const pendientes = (posts ?? []).filter((p) => EN_PROCESO.has(p.status)).map((p) => p.publishId)
  useEffect(() => {
    if (pendientes.length === 0) return
    const id = setInterval(async () => {
      await Promise.all(pendientes.slice(0, 5).map((pid) => platformApi.tiktokEstadoPublicacion(pid).catch(() => null)))
      setTick((n) => n + 1)
    }, 6000)
    return () => clearInterval(id)
  }, [pendientes.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const actualizar = async (publishId: string) => {
    setActualizando(publishId)
    try { await platformApi.tiktokEstadoPublicacion(publishId) } catch { /* el estado anterior se queda */ }
    setActualizando(null)
    setTick((n) => n + 1)
  }

  return (
    <Card title="Videos enviados" subtitle="Lo último que se mandó a TikTok desde Órbita" noPad>
      {error ? <ErrorBox msg="No se pudo cargar el historial." /> : !posts ? <Loader /> : posts.length === 0 ? <Empty text="Todavía no se envió ningún video." /> : (
        <Table
          head={['Fecha', 'Título', 'Visibilidad', 'Estado', '']}
          alignRight={[4]}
          rows={posts.map((p) => {
            const e = ESTADO[p.status] ?? { texto: p.status, tono: 'gray' as const }
            return {
              key: p.id,
              cells: [
                dateTime(p.createdAt),
                <span key="t" style={{ display: 'block', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.title}>{p.title}</span>,
                PRIVACIDAD[p.privacyLevel] ?? p.privacyLevel,
                <span key="e" style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
                  <Chip text={e.texto} tone={e.tono} dot />
                  {p.failReason && <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>{p.failReason}</span>}
                </span>,
                <button key="a" onClick={() => actualizar(p.publishId)} disabled={actualizando === p.publishId} className="ds-hover" style={btnGhost}>
                  {actualizando === p.publishId ? 'Consultando…' : 'Actualizar'}
                </button>,
              ],
            }
          })}
        />
      )}
    </Card>
  )
}
