import { useCallback, useEffect, useRef, useState } from 'react'
import { Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { platformApi, type CasillaCorreo, type CasillaCorreoInput, type CorreoEnviado } from '@/lib/platform/api'
import { Toast, type ToastVariant } from '@/design-system/components/Toast'
import {
  useFetch, Card, Table, Chip, Loader, ErrorBox, Empty, PageHeader, ModalShell, Field, dateTime,
  btnGhost, btnGhostSm, btnPrimary, inputStyle,
} from './ui'

// Correo: escribirle a alguien de afuera (un proveedor, un hotel, un posible
// cliente) con la plantilla de Órbita, desde una de las casillas del equipo y
// con su firma. No es para campañas: un destinatario por correo.
//
// El cuerpo se escribe como texto. Una línea en blanco separa párrafos, las
// líneas que arrancan con "- " arman una lista y **así** va en negrita (ver
// apps/api/src/mail/correo-directo.ts). La vista previa la arma el backend
// con el mismo código que el envío, así lo que se ve es lo que llega.

type Aviso = { variant: ToastVariant; title: string; description?: string }
type Borrador = { senderId: string; to: string; subject: string; body: string }

const CLAVE_BORRADOR = 'orbita:superadmin:correo-borrador'
const ESTADO: Record<CorreoEnviado['status'], { texto: string; tono: 'green' | 'red' | 'gray' }> = {
  SENT: { texto: 'Enviado', tono: 'green' },
  FAILED: { texto: 'No salió', tono: 'red' },
  SIMULATED: { texto: 'Simulado', tono: 'gray' },
}

function leerBorrador(): Partial<Borrador> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(CLAVE_BORRADOR) ?? '{}') as Partial<Borrador>
  } catch {
    return {}
  }
}

const dominioDe = (email: string) => email.split('@')[1] ?? ''
const textarea: React.CSSProperties = { ...inputStyle, height: 'auto', minHeight: 300, padding: '11px 13px', lineHeight: 1.6, resize: 'vertical', width: '100%' }

export function TabCorreo({ puedeEnviar }: { puedeEnviar: boolean }) {
  const [tickCasillas, setTickCasillas] = useState(0)
  const [tickEnviados, setTickEnviados] = useState(0)
  const { data: casillas, error: errorCasillas } = useFetch(() => platformApi.correoCasillas(), [tickCasillas])
  const { data: enviados, error: errorEnviados } = useFetch(() => platformApi.correosEnviados(), [tickEnviados])

  // El borrador sobrevive a un cambio de sección o a recargar la página: un
  // correo largo no se pierde por un clic en el sidebar. Se lee al montar (la
  // sección solo se dibuja en el navegador, con la sesión ya cargada).
  const [inicial] = useState(leerBorrador)
  const [elegida, setElegida] = useState(inicial.senderId ?? '')
  const [to, setTo] = useState(inicial.to ?? '')
  const [subject, setSubject] = useState(inicial.subject ?? '')
  const [body, setBody] = useState(inicial.body ?? '')

  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [gestionando, setGestionando] = useState(false)
  const [abierto, setAbierto] = useState<CorreoEnviado | null>(null)

  // La casilla elegida puede haberse borrado (o no haber elegido ninguna
  // todavía): en ese caso vale la primera.
  const casilla = casillas?.find((c) => c.id === elegida) ?? casillas?.[0] ?? null
  const senderId = casilla?.id ?? ''

  useEffect(() => {
    try {
      window.localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({ senderId, to, subject, body }))
    } catch { /* sin localStorage no hay borrador, nada más */ }
  }, [senderId, to, subject, body])

  // Vista previa: se pide medio segundo después de dejar de escribir. `turno`
  // descarta la respuesta de un pedido viejo que llegue después de uno nuevo.
  const turno = useRef(0)
  useEffect(() => {
    if (!senderId) return
    const mio = ++turno.current
    const t = setTimeout(() => {
      platformApi.correoVistaPrevia({ senderId, body })
        .then((r) => { if (turno.current === mio) setHtml(r.html) })
        .catch(() => { if (turno.current === mio) setHtml(null) })
    }, 500)
    return () => clearTimeout(t)
  }, [senderId, body, tickCasillas])

  useEffect(() => {
    if (!aviso || aviso.variant === 'error') return
    const t = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(t)
  }, [aviso])

  const recargarCasillas = useCallback(() => setTickCasillas((k) => k + 1), [])

  function revisar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!casilla) { setError('Elegí desde qué casilla sale.'); return }
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to.trim())) { setError('Escribí un solo email de destino, válido.'); return }
    if (subject.trim().length < 3) { setError('Ponele un asunto.'); return }
    if (body.trim().length < 10) { setError('El mensaje está vacío.'); return }
    setConfirmando(true)
  }

  async function enviar() {
    if (!casilla) return
    setEnviando(true)
    try {
      const r = await platformApi.enviarCorreo({ senderId: casilla.id, to: to.trim(), subject: subject.trim(), body })
      setConfirmando(false)
      setTickEnviados((k) => k + 1)
      if (!r.sent) {
        setAviso({ variant: 'error', title: 'El correo no salió', description: r.error ?? 'El proveedor de correo lo rechazó.' })
        return
      }
      setAviso(r.simulated
        ? { variant: 'success', title: 'Envío simulado', description: 'Este entorno no tiene proveedor de correo: quedó registrado, pero no salió.' }
        : { variant: 'success', title: `Enviado a ${to.trim()}`, description: `Las respuestas llegan a ${casilla.email}.` })
      setTo(''); setSubject(''); setBody('')
    } catch (err) {
      setConfirmando(false)
      setAviso({ variant: 'error', title: 'El correo no salió', description: err instanceof Error ? err.message : undefined })
    } finally {
      setEnviando(false)
    }
  }

  function usarComoBorrador(c: CorreoEnviado) {
    const misma = casillas?.find((x) => x.email === c.fromEmail)
    if (misma) setElegida(misma.id)
    setTo(c.to); setSubject(c.subject); setBody(c.body)
    setAbierto(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (errorCasillas) return <ErrorBox msg="No se pudo cargar Correo. Si la API se desplegó hace poco, puede que todavía no tenga esta sección." />
  if (!casillas) return <Loader />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Correo"
        subtitle="Escribile a alguien de afuera con la plantilla de Órbita, desde una de las casillas del equipo y con su firma. Las respuestas llegan a esa casilla."
        action={<button onClick={() => setGestionando(true)} className="ds-hover" style={btnGhost}>Casillas y firmas</button>}
      />

      <div className="sa-correo" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
        <style>{`@media (max-width: 1040px) { .sa-correo { grid-template-columns: minmax(0,1fr) !important; } }`}</style>

        <Card title="Redactar">
          {casillas.length === 0 ? (
            <Empty text="Todavía no hay ninguna casilla. Agregá una en «Casillas y firmas» para empezar a escribir." />
          ) : (
            <form onSubmit={revisar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="De" hint={casilla?.verified === false ? undefined : 'Sale desde esta casilla y con su firma.'}>
                <select value={senderId} onChange={(e) => setElegida(e.target.value)} className="ds-field" style={{ ...inputStyle, width: '100%' }}>
                  {casillas.map((c) => <option key={c.id} value={c.id}>{c.name} &lt;{c.email}&gt;</option>)}
                </select>
              </Field>
              {casilla?.verified === false && (
                <p role="status" style={{ margin: '-6px 0 0', fontSize: 12, color: 'var(--color-warning)', lineHeight: 1.5 }}>
                  El dominio {dominioDe(casilla.email)} no está verificado en Resend: hasta verificarlo, lo que mandes desde esta casilla va a ser rechazado.
                </p>
              )}

              <Field label="Para">
                <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="nombre@empresa.com" autoComplete="off" className="ds-field" style={{ ...inputStyle, width: '100%' }} />
              </Field>

              <Field label="Asunto">
                <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className="ds-field" style={{ ...inputStyle, width: '100%' }} />
              </Field>

              <Field label="Mensaje" hint="Una línea en blanco separa párrafos. Las líneas que empiezan con «- » arman una lista y **así** queda en negrita. La firma se agrega sola.">
                <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={20000} className="ds-field" style={textarea} />
              </Field>

              {error && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: 'var(--color-error)' }}>{error}</p>}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                  {puedeEnviar ? 'El borrador se guarda solo en este navegador.' : 'Solo un super administrador puede enviar.'}
                </span>
                <button type="submit" disabled={!puedeEnviar} className="ds-hover" style={{ ...btnPrimary, ...(puedeEnviar ? {} : { opacity: 0.5, cursor: 'default' }) }}>
                  <Send size={15} strokeWidth={2} /> Enviar
                </button>
              </div>
            </form>
          )}
        </Card>

        <Card title="Vista previa" subtitle={subject.trim() ? `Asunto: ${subject.trim()}` : 'Así le llega a quien lo recibe'}>
          {!senderId ? (
            <Empty text="Elegí una casilla para ver cómo queda." />
          ) : html === null ? (
            <Loader />
          ) : (
            <iframe
              title="Vista previa del correo"
              srcDoc={html}
              sandbox=""
              style={{ width: '100%', height: 640, border: '1px solid var(--color-border)', borderRadius: 12, display: 'block', background: '#fff' }}
            />
          )}
        </Card>
      </div>

      {errorEnviados ? (
        <ErrorBox msg="No se pudieron cargar los enviados." />
      ) : !enviados ? (
        <Loader />
      ) : (
        <Card title="Enviados" subtitle="Los últimos 100 correos que salieron desde acá" noPad={enviados.length > 0}>
          {enviados.length === 0 ? (
            <Empty text="Todavía no se envió ningún correo desde esta sección." />
          ) : (
            <Table
              head={['Fecha', 'De', 'Para', 'Asunto', 'Estado']}
              rows={enviados.map((c) => ({
                key: c.id,
                onClick: () => setAbierto(c),
                cells: [
                  dateTime(c.createdAt),
                  c.fromEmail,
                  c.to,
                  <span key="a" style={{ fontWeight: 600, color: 'var(--color-text)' }}>{c.subject}</span>,
                  <Chip key="e" text={ESTADO[c.status].texto} tone={ESTADO[c.status].tono} dot />,
                ],
              }))}
            />
          )}
        </Card>
      )}

      {confirmando && casilla && (
        <ModalShell title="Enviar el correo" onClose={() => { if (!enviando) setConfirmando(false) }} cerrarAlClickAfuera={false}>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '8px 14px', fontSize: 13.5 }}>
            <dt style={{ color: 'var(--color-muted)' }}>De</dt>
            <dd style={{ margin: 0, color: 'var(--color-text)', overflowWrap: 'anywhere' }}>{casilla.name} &lt;{casilla.email}&gt;</dd>
            <dt style={{ color: 'var(--color-muted)' }}>Para</dt>
            <dd style={{ margin: 0, color: 'var(--color-text)', fontWeight: 600, overflowWrap: 'anywhere' }}>{to.trim()}</dd>
            <dt style={{ color: 'var(--color-muted)' }}>Asunto</dt>
            <dd style={{ margin: 0, color: 'var(--color-text)', overflowWrap: 'anywhere' }}>{subject.trim()}</dd>
          </dl>
          <p style={{ margin: '16px 0 0', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Sale ahora y no se puede deshacer.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <button type="button" onClick={() => setConfirmando(false)} disabled={enviando} className="ds-hover" style={btnGhost}>Volver</button>
            <button type="button" onClick={() => void enviar()} disabled={enviando} className="ds-hover" style={{ ...btnPrimary, ...(enviando ? { opacity: 0.6, cursor: 'default' } : {}) }}>
              {enviando ? 'Enviando…' : 'Enviar ahora'}
            </button>
          </div>
        </ModalShell>
      )}

      {abierto && (
        <ModalShell title={abierto.subject} onClose={() => setAbierto(null)}>
          <div style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.6, overflowWrap: 'anywhere' }}>
            De {abierto.fromName} &lt;{abierto.fromEmail}&gt; para {abierto.to}<br />
            {dateTime(abierto.createdAt)} · lo envió {abierto.adminName}
          </div>
          {abierto.status === 'FAILED' && (
            <div style={{ marginTop: 12 }}><ErrorBox msg={`No salió: ${abierto.error ?? 'el proveedor de correo lo rechazó.'}`} /></div>
          )}
          <div style={{ marginTop: 14, padding: '12px 14px', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {abierto.body}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <button type="button" onClick={() => setAbierto(null)} className="ds-hover" style={btnGhost}>Cerrar</button>
            <button type="button" onClick={() => usarComoBorrador(abierto)} className="ds-hover" style={btnPrimary}>Usar como borrador</button>
          </div>
        </ModalShell>
      )}

      {gestionando && (
        <ModalCasillas casillas={casillas} puedeEditar={puedeEnviar} onClose={() => setGestionando(false)} onCambio={recargarCasillas} />
      )}

      {aviso && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
          <Toast variant={aviso.variant} title={aviso.title} description={aviso.description} onClose={() => setAviso(null)} />
        </div>
      )}
    </div>
  )
}

// ─── Casillas y firmas ───────────────────────────────────────────────────────

const VACIA: CasillaCorreoInput = { email: '', name: '', jobTitle: '', phone: '', signatureImageUrl: null, signatureBanner: false }

function ModalCasillas({ casillas, puedeEditar, onClose, onCambio }: {
  casillas: CasillaCorreo[]
  puedeEditar: boolean
  onClose: () => void
  onCambio: () => void
}) {
  // null = la lista; 'nueva' o un id = el formulario.
  const [editando, setEditando] = useState<string | null>(null)
  const [borrando, setBorrando] = useState<string | null>(null)
  const [error, setError] = useState('')
  const actual = editando && editando !== 'nueva' ? casillas.find((c) => c.id === editando) ?? null : null

  async function borrar(id: string) {
    setError('')
    setBorrando(id)
    try {
      await platformApi.borrarCasillaCorreo(id)
      onCambio()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar la casilla.')
    } finally {
      setBorrando(null)
    }
  }

  if (editando) {
    return (
      <ModalShell title={actual ? actual.email : 'Nueva casilla'} onClose={onClose} cerrarAlClickAfuera={false}>
        <FormCasilla casilla={actual} onVolver={() => setEditando(null)} onGuardada={() => { onCambio(); setEditando(null) }} />
      </ModalShell>
    )
  }

  const iconBtn: React.CSSProperties = { width: 30, height: 30, borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-body)', display: 'grid', placeItems: 'center', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }

  return (
    <ModalShell title="Casillas y firmas" onClose={onClose}>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
        Las direcciones desde las que se puede escribir. El dominio de cada una tiene que estar verificado en Resend para que el correo salga.
      </p>
      {casillas.length === 0 ? (
        <Empty text="No hay casillas cargadas." />
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
          {casillas.map((c, i) => (
            <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid var(--color-border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name}{c.jobTitle ? ` · ${c.jobTitle}` : ''}{c.verified === false ? ' · dominio sin verificar' : ''}
                </div>
              </div>
              {puedeEditar && (
                <>
                  <button type="button" onClick={() => setEditando(c.id)} aria-label={`Editar ${c.email}`} className="ds-hover" style={iconBtn}><Pencil size={14} /></button>
                  <button type="button" onClick={() => void borrar(c.id)} disabled={borrando === c.id} aria-label={`Borrar ${c.email}`} className="ds-hover" style={{ ...iconBtn, opacity: borrando === c.id ? 0.5 : 1 }}><Trash2 size={14} /></button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--color-error)' }}>{error}</p>}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 18 }}>
        {puedeEditar
          ? <button type="button" onClick={() => setEditando('nueva')} className="ds-hover" style={btnGhost}><Plus size={15} strokeWidth={2} /> Agregar casilla</button>
          : <span />}
        <button type="button" onClick={onClose} className="ds-hover" style={btnPrimary}>Listo</button>
      </div>
    </ModalShell>
  )
}

// Las tarjetas de firma del equipo son de 1120 × 344 (3,3 a 1); un logo o una
// firma escaneada rara vez pasa de 2,5 a 1.
function esApaisada(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const src = URL.createObjectURL(file)
    const img = new Image()
    const listo = (valor: boolean) => { URL.revokeObjectURL(src); resolve(valor) }
    img.onload = () => listo(img.naturalHeight > 0 && img.naturalWidth / img.naturalHeight >= 2.5)
    img.onerror = () => listo(false)
    img.src = src
  })
}

function FormCasilla({ casilla, onVolver, onGuardada }: { casilla: CasillaCorreo | null; onVolver: () => void; onGuardada: () => void }) {
  const [v, setV] = useState<CasillaCorreoInput>(() => casilla
    ? { email: casilla.email, name: casilla.name, jobTitle: casilla.jobTitle ?? '', phone: casilla.phone ?? '', signatureImageUrl: casilla.signatureImageUrl, signatureBanner: casilla.signatureBanner }
    : VACIA)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const archivo = useRef<HTMLInputElement>(null)
  const campo = (k: 'email' | 'name' | 'jobTitle' | 'phone') => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }))

  async function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setSubiendo(true)
    try {
      const [{ url }, apaisada] = await Promise.all([platformApi.subirImagenFirma(file), esApaisada(file)])
      // Una imagen bien apaisada es una tarjeta de firma, no un logo: se marca
      // sola como firma completa (se puede destildar).
      setV((x) => ({ ...x, signatureImageUrl: url, signatureBanner: apaisada }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la imagen.')
    } finally {
      setSubiendo(false)
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!v.email.includes('@')) { setError('Escribí el email de la casilla.'); return }
    if (v.name.trim().length < 2) { setError('Escribí con qué nombre firma.'); return }
    setGuardando(true)
    try {
      if (casilla) await platformApi.editarCasillaCorreo(casilla.id, v)
      else await platformApi.crearCasillaCorreo(v)
      onGuardada()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la casilla.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Email" hint="Desde acá sale el correo y acá llegan las respuestas.">
        <input type="email" value={v.email} onChange={campo('email')} placeholder="nombre@orbita.site" className="ds-field" style={inputStyle} />
      </Field>
      <Field label="Nombre" hint="El que ve quien recibe el correo, y el que va en la firma.">
        <input value={v.name} onChange={campo('name')} maxLength={60} className="ds-field" style={inputStyle} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
        <Field label="Cargo (opcional)">
          <input value={v.jobTitle ?? ''} onChange={campo('jobTitle')} maxLength={60} placeholder="CEO" className="ds-field" style={{ ...inputStyle, width: '100%' }} />
        </Field>
        <Field label="Teléfono (opcional)">
          <input value={v.phone ?? ''} onChange={campo('phone')} maxLength={40} className="ds-field" style={{ ...inputStyle, width: '100%' }} />
        </Field>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 7 }}>Imagen de la firma (opcional)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {v.signatureImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.signatureImageUrl} alt="Imagen de la firma" style={{ ...(v.signatureBanner ? { width: '100%', height: 'auto' } : { height: 48, width: 'auto', maxWidth: 140 }), border: '1px solid var(--color-border)', borderRadius: 8, background: '#fff' }} />
          )}
          <input ref={archivo} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => void subir(e)} style={{ display: 'none' }} />
          <button type="button" onClick={() => archivo.current?.click()} disabled={subiendo} className="ds-hover" style={btnGhostSm}>
            {subiendo ? 'Subiendo…' : v.signatureImageUrl ? 'Cambiar' : 'Subir imagen'}
          </button>
          {v.signatureImageUrl && (
            <button type="button" onClick={() => setV((x) => ({ ...x, signatureImageUrl: null, signatureBanner: false }))} className="ds-hover" style={btnGhostSm}>Quitar</button>
          )}
        </div>
        <p style={{ margin: '7px 0 0', fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.45 }}>
          {v.signatureBanner
            ? 'La imagen se muestra a todo el ancho del correo y reemplaza al nombre, el cargo y el teléfono de arriba.'
            : 'Un logo o tu firma escaneada. Va a la izquierda del nombre, a 48 px de alto.'}
        </p>
        {v.signatureImageUrl && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 10, fontSize: 13, color: 'var(--color-body)', cursor: 'pointer' }}>
            <input type="checkbox" checked={v.signatureBanner} onChange={(e) => setV((x) => ({ ...x, signatureBanner: e.target.checked }))} />
            Usar la imagen como firma completa
          </label>
        )}
      </div>

      {error && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: 'var(--color-error)' }}>{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
        <button type="button" onClick={onVolver} className="ds-hover" style={btnGhost}>Volver</button>
        <button type="submit" disabled={guardando || subiendo} className="ds-hover" style={{ ...btnPrimary, ...(guardando || subiendo ? { opacity: 0.6, cursor: 'default' } : {}) }}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
