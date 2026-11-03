import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { platformApi, PlatformApiError, type IgConversacion, type IgMensaje } from '@/lib/platform/api'
import { Card, Loader, Empty, btnPrimary, inputStyle } from './ui'

// La bandeja de mensajes directos de Instagram de la empresa (@orbita.site), dentro de Marketing → Instagram.
// Lista de conversaciones a la izquierda, la charla y la caja de respuesta a la derecha; en pantallas angostas se
// ve de a una (la lista, o la charla con un botón para volver). Se actualiza sola cada 20 segundos.
//
// Contestar sale por Instagram con el mismo servicio de la bandeja de los negocios (apps/api/src/marketing/
// instagram-bandeja.service.ts): Instagram solo deja contestar dentro de las 24 horas del último mensaje de la persona.
// Es de superadmin: son conversaciones privadas con gente de afuera.

const REFRESCO_MS = 20_000
const MAX_TEXTO = 1000

const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString()
function fechaCorta(iso: string): string {
  const d = new Date(iso)
  return mismoDia(d, new Date())
    ? d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' })
}

function Avatar({ nombre, url, tamano = 36 }: { nombre: string; url: string | null; tamano?: number }) {
  if (url) return <img src={url} alt="" width={tamano} height={tamano} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <span aria-hidden style={{ width: tamano, height: tamano, borderRadius: '50%', background: 'var(--color-surface-alt)', color: 'var(--color-muted)', fontSize: tamano * 0.4, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {nombre.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

export function InstagramBandeja({ permitido, onCambio }: { permitido: boolean; onCambio?: () => void }) {
  const [lista, setLista] = useState<IgConversacion[] | null>(null)
  const [errorLista, setErrorLista] = useState('')
  const [abierta, setAbierta] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<IgMensaje[] | null>(null)
  const [cargandoHilo, setCargandoHilo] = useState(false)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState('')
  const fin = useRef<HTMLDivElement>(null)

  const cargarLista = useCallback(async () => {
    try {
      setLista(await platformApi.igConversaciones())
      setErrorLista('')
    } catch (e) {
      setErrorLista(e instanceof PlatformApiError && e.status === 404 ? 'No se encontró el negocio al que está conectada la cuenta.' : 'No se pudieron cargar los mensajes.')
    }
  }, [])

  const cargarHilo = useCallback(async (id: string, silencioso: boolean) => {
    if (!silencioso) setCargandoHilo(true)
    try {
      setMensajes(await platformApi.igMensajes(id))
      // Abrir una conversación la marca leída: se refresca la lista para que desaparezca el punto.
      void cargarLista()
      onCambio?.()
    } catch {
      if (!silencioso) setMensajes([])
    } finally {
      if (!silencioso) setCargandoHilo(false)
    }
  }, [cargarLista, onCambio])

  useEffect(() => { if (permitido) void cargarLista() }, [permitido, cargarLista])

  // Se actualiza sola, pero solo con la pestaña a la vista.
  useEffect(() => {
    if (!permitido) return
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void cargarLista()
      if (abierta) void cargarHilo(abierta, true)
    }, REFRESCO_MS)
    return () => clearInterval(id)
  }, [permitido, abierta, cargarLista, cargarHilo])

  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }) }, [mensajes?.length, abierta])

  const abrir = (id: string) => {
    setAbierta(id); setMensajes(null); setTexto(''); setErrorEnvio('')
    void cargarHilo(id, false)
  }

  const enviar = async () => {
    const t = texto.trim()
    if (!abierta || !t || enviando) return
    setEnviando(true); setErrorEnvio('')
    try {
      const nuevo = await platformApi.igResponder(abierta, t)
      setMensajes((m) => [...(m ?? []), nuevo])
      setTexto('')
      void cargarLista()
    } catch (e) {
      setErrorEnvio(e instanceof PlatformApiError ? e.message : 'No se pudo enviar el mensaje.')
    } finally {
      setEnviando(false)
    }
  }

  if (!permitido) {
    return <Card title="Mensajes directos"><Empty text="Solo los superadmin pueden ver y contestar los mensajes de la cuenta de la empresa." /></Card>
  }

  const actual = lista?.find((c) => c.id === abierta) ?? null
  const sinLeer = (lista ?? []).filter((c) => c.sinLeer).length

  return (
    <Card
      title="Mensajes directos"
      subtitle={sinLeer > 0 ? `${sinLeer} ${sinLeer === 1 ? 'conversación sin leer' : 'conversaciones sin leer'}` : 'Las personas que le escriben a la cuenta de Instagram de Órbita'}
      noPad
    >
      <style>{`
        .igb { display: grid; grid-template-columns: 320px minmax(0, 1fr); height: min(640px, 72vh); min-height: 420px; }
        .igb-lista { border-right: 1px solid var(--color-border); overflow-y: auto; }
        .igb-volver { display: none; }
        .igb-item { width: 100%; display: flex; gap: 11px; align-items: flex-start; text-align: left; padding: 13px 16px; border: none; border-bottom: 1px solid var(--color-border); background: transparent; cursor: pointer; font-family: inherit; min-height: 64px; }
        .igb-item:hover { background: var(--color-surface); }
        .igb-item[aria-current="true"] { background: var(--color-surface-alt); }
        .igb-item:focus-visible, .igb-volver:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
        @media (max-width: 800px) {
          .igb { grid-template-columns: 1fr; }
          .igb-lista { border-right: none; }
          .igb[data-abierta="true"] .igb-lista { display: none; }
          .igb[data-abierta="false"] .igb-hilo { display: none; }
          .igb-volver { display: inline-flex; }
        }
      `}</style>

      <div className="igb" data-abierta={abierta ? 'true' : 'false'}>
        <div className="igb-lista" role="list" aria-label="Conversaciones de Instagram">
          {errorLista && !lista ? <div style={{ padding: 20, fontSize: 13, color: 'var(--color-error)' }}>{errorLista}</div>
            : !lista ? <Loader />
            : lista.length === 0 ? <div style={{ padding: 22, fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>Todavía no hay mensajes. Cuando alguien le escriba a la cuenta, la conversación va a aparecer acá.</div>
            : lista.map((c) => (
              <button
                key={c.id}
                type="button"
                role="listitem"
                className="igb-item"
                aria-current={c.id === abierta}
                aria-label={`${c.nombre}${c.sinLeer ? ', sin leer' : ''}`}
                onClick={() => abrir(c.id)}
              >
                <Avatar nombre={c.nombre} url={c.avatar} />
                <span style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13.5, fontWeight: c.sinLeer ? 700 : 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--color-muted)', flexShrink: 0 }}>{fechaCorta(c.ultimo?.fecha ?? c.actualizadaEl)}</span>
                  </span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12.5, color: c.sinLeer ? 'var(--color-text)' : 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {c.ultimo ? `${c.ultimo.esMio ? 'Vos: ' : ''}${c.ultimo.texto}` : 'Sin mensajes'}
                    </span>
                    {c.sinLeer && <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />}
                  </span>
                </span>
              </button>
            ))}
        </div>

        <div className="igb-hilo" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {!abierta ? (
            <div style={{ margin: 'auto', padding: 24, fontSize: 13.5, color: 'var(--color-muted)', textAlign: 'center' }}>Elegí una conversación para leerla y contestar.</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                <button type="button" className="igb-volver ds-hover" onClick={() => setAbierta(null)} aria-label="Volver a la lista" style={{ alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-body)' }}>
                  <ArrowLeft size={18} />
                </button>
                {actual && <Avatar nombre={actual.nombre} url={actual.avatar} tamano={32} />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{actual?.nombre ?? 'Conversación'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>Instagram</div>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }} aria-live="polite">
                {cargandoHilo || !mensajes ? <Loader />
                  : mensajes.length === 0 ? <div style={{ margin: 'auto', fontSize: 13, color: 'var(--color-muted)' }}>Sin mensajes.</div>
                  : mensajes.map((m) => {
                    const mio = m.sender === 'STORE'
                    return (
                      <div key={m.id} style={{ alignSelf: mio ? 'flex-end' : 'flex-start', maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: mio ? 'flex-end' : 'flex-start', gap: 3 }}>
                        <div style={{ padding: '9px 13px', borderRadius: 14, fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: mio ? 'var(--color-primary)' : 'var(--color-surface-alt)', color: mio ? 'var(--color-on-primary)' : 'var(--color-text)' }}>{m.text}</div>
                        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{fechaCorta(m.createdAt)}</span>
                      </div>
                    )
                  })}
                <div ref={fin} />
              </div>

              <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {errorEnvio && <div role="alert" style={{ fontSize: 12.5, color: 'var(--color-error)' }}>{errorEnvio}</div>}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar() } }}
                    maxLength={MAX_TEXTO}
                    rows={2}
                    placeholder="Escribí una respuesta…"
                    aria-label="Respuesta"
                    style={{ ...inputStyle, height: 'auto', minHeight: 44, padding: '10px 13px', lineHeight: 1.45, resize: 'none', flex: 1 }}
                  />
                  <button type="button" onClick={enviar} disabled={!texto.trim() || enviando} style={{ ...btnPrimary, height: 44, opacity: !texto.trim() || enviando ? 0.5 : 1, cursor: !texto.trim() || enviando ? 'not-allowed' : 'pointer' }}>
                    {enviando ? 'Enviando…' : 'Enviar'}
                  </button>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>Instagram solo deja contestar dentro de las 24 horas del último mensaje de la persona. Enter envía; Shift + Enter hace un salto de línea.</div>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
