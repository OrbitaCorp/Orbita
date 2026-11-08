import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import {
  platformApi,
  type BorradorSeguimiento,
  type CasillaCorreo,
  type EtapaSeguimiento,
  type FilaSeguimiento,
  type PlantillaSeguimiento,
} from '@/lib/platform/api'
import {
  useFetch, Card, Table, Chip, Loader, ErrorBox, Empty, ModalShell, Field, PageHeader,
  btnGhost, btnGhostSm, btnPrimary, inputStyle,
} from './ui'

// Superadmin → Seguimiento: en qué etapa está cada tienda (la calcula la API
// con sus datos: productos, si está publicada, pedidos, último acceso del
// dueño, suscripción) y el correo de seguimiento de esa etapa, con un botón
// para que el dueño te escriba por WhatsApp al número de la casilla. Se manda
// uno por uno, revisándolo antes: no hay envío automático.

// Color solo donde el dato lo pide: rojo lo que corta la tienda, ámbar lo que
// está por cortarse o se frenó, verde lo que anda. El armado va en gris.
const TONO: Record<EtapaSeguimiento, 'red' | 'amber' | 'green' | 'gray'> = {
  baja: 'red',
  pago_pendiente: 'red',
  pausada: 'amber',
  por_vencer: 'amber',
  se_enfrio: 'amber',
  bienvenida: 'gray',
  sin_productos: 'gray',
  sin_publicar: 'gray',
  sin_ventas: 'gray',
  vendiendo: 'green',
}

type Filtro = 'pendientes' | 'todas' | EtapaSeguimiento

export function TabSeguimiento({ puedeEnviar, adminEmail }: { puedeEnviar: boolean; adminEmail: string }) {
  const [recarga, setRecarga] = useState(0)
  const { data: filas, error } = useFetch(() => platformApi.seguimiento(), [recarga])
  const { data: plantillas } = useFetch(() => platformApi.seguimientoPlantillas(), [])
  const { data: casillas } = useFetch(() => platformApi.correoCasillas(), [])
  const [filtro, setFiltro] = useState<Filtro>('pendientes')
  const [busqueda, setBusqueda] = useState('')
  const [escribiendo, setEscribiendo] = useState<FilaSeguimiento | null>(null)
  const [aviso, setAviso] = useState('')

  const nombreEtapa = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of plantillas ?? []) m.set(p.etapa, p.nombre)
    return (e: string | null) => (e ? m.get(e) ?? e : '')
  }, [plantillas])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (filas ?? []).filter((f) => {
      if (filtro === 'pendientes' && !f.pendiente) return false
      if (filtro !== 'pendientes' && filtro !== 'todas' && f.etapa !== filtro) return false
      if (!q) return true
      return [f.name, f.subdomain, f.owner?.name ?? '', f.owner?.email ?? ''].some((t) => t.toLowerCase().includes(q))
    })
  }, [filas, filtro, busqueda])

  if (error) return <ErrorBox msg="No se pudo cargar el seguimiento." />
  if (!filas || !plantillas) return <Loader />

  const cuenta = (e: EtapaSeguimiento) => filas.filter((f) => f.etapa === e).length
  const opciones: { id: Filtro; texto: string; n: number }[] = [
    { id: 'pendientes', texto: 'Pendientes', n: filas.filter((f) => f.pendiente).length },
    { id: 'todas', texto: 'Todas', n: filas.length },
    ...plantillas.map((p) => ({ id: p.etapa as Filtro, texto: p.nombre, n: cuenta(p.etapa) })).filter((o) => o.n > 0),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Seguimiento"
        subtitle="En qué etapa está cada tienda y a quién le falta un correo. Cada correo lleva un botón para que el dueño te escriba por WhatsApp."
      />

      {aviso && (
        <div role="status" style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--color-success-bg)', color: 'var(--chip-success-fg)', fontSize: 13.5, fontWeight: 600 }}>
          {aviso}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div role="group" aria-label="Filtrar por etapa" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {opciones.map((o) => {
            const activo = filtro === o.id
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={activo}
                onClick={() => setFiltro(o.id)}
                className="ds-hover"
                style={{
                  ...btnGhostSm,
                  background: activo ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                  color: activo ? 'var(--color-primary)' : 'var(--color-body)',
                  borderColor: activo ? 'var(--color-primary)' : 'var(--color-border)',
                }}
              >
                {o.texto}
                <span style={{ fontFamily: '"Geist Mono", monospace', fontWeight: 500, color: activo ? 'var(--color-primary)' : 'var(--color-muted)' }}>{o.n}</span>
              </button>
            )
          })}
        </div>
        <div style={{ position: 'relative', width: '100%', maxWidth: 440 }}>
          <Search size={16} strokeWidth={1.75} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)', pointerEvents: 'none' }} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por negocio, dirección web o dueño…"
            aria-label="Buscar"
            className="ds-field"
            style={{ ...inputStyle, width: '100%', paddingLeft: 38 }}
          />
        </div>
      </div>

      <Card noPad>
        {visibles.length === 0 ? (
          <Empty text={filtro === 'pendientes' ? 'No hay seguimientos pendientes: a todas las tiendas ya les escribiste por su etapa actual.' : 'No hay tiendas con este filtro.'} />
        ) : (
          <Table
            head={['Negocio', 'Etapa', 'Avance', 'Último seguimiento', '']}
            alignRight={[4]}
            rows={visibles.map((f) => ({
              key: f.id,
              cells: [
                <div key="n">
                  <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>{f.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                    {f.owner ? `${f.owner.name} · ${f.owner.email}` : 'Sin dueño con email'}
                  </div>
                </div>,
                <Chip key="e" text={nombreEtapa(f.etapa)} tone={TONO[f.etapa]} dot />,
                <div key="a" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                  <div style={{ color: 'var(--color-body)' }}>
                    {plural(f.productos, 'producto', 'productos')} · {plural(f.pedidos, 'pedido', 'pedidos')}
                  </div>
                  <div style={{ color: 'var(--color-muted)' }}>
                    {f.owner?.lastAccessAt ? `Entró ${hace(f.owner.lastAccessAt)}` : 'Nunca entró al panel'}
                  </div>
                </div>,
                f.ultimoSeguimiento ? (
                  <div key="u" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                    <div style={{ color: 'var(--color-body)' }}>{capitalizar(hace(f.ultimoSeguimiento.fecha))}</div>
                    <div style={{ color: 'var(--color-muted)' }}>
                      {nombreEtapa(f.ultimoSeguimiento.etapa)}
                      {f.ultimoSeguimiento.cantidad > 1 ? ` · ${f.ultimoSeguimiento.cantidad} en total` : ''}
                    </div>
                  </div>
                ) : <span key="u" style={{ fontSize: 12.5, color: 'var(--color-subtle)' }}>Nunca</span>,
                <button
                  key="b"
                  type="button"
                  onClick={() => { setAviso(''); setEscribiendo(f) }}
                  disabled={!f.owner}
                  title={f.owner ? undefined : 'Este negocio no tiene un dueño con email'}
                  className="ds-hover"
                  style={{ ...btnGhostSm, opacity: f.owner ? 1 : 0.5, cursor: f.owner ? 'pointer' : 'not-allowed' }}
                >
                  Escribir
                </button>,
              ],
            }))}
          />
        )}
        <div style={{ padding: '12px 18px', fontSize: 12.5, color: 'var(--color-muted)', borderTop: '1px solid var(--color-border)' }}>
          {visibles.length === 1 ? '1 tienda' : `${visibles.length} tiendas`}
          {filtro === 'pendientes' ? ' sin un correo por su etapa en los últimos 30 días' : ''}
        </div>
      </Card>

      <Card title="Cómo se elige la etapa" subtitle="Se mira en este orden y gana la primera que se cumple. La demo pública no aparece.">
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, lineHeight: 1.55, color: 'var(--color-body)' }}>
          {plantillas.map((p) => (
            <li key={p.etapa}>
              <strong style={{ color: 'var(--color-text)' }}>{p.nombre}:</strong> {p.cuando}
            </li>
          ))}
        </ol>
      </Card>

      {escribiendo && (
        <EscribirSeguimiento
          fila={escribiendo}
          plantillas={plantillas}
          casillas={casillas ?? []}
          adminEmail={adminEmail}
          puedeEnviar={puedeEnviar}
          onClose={() => setEscribiendo(null)}
          onEnviado={(texto) => { setEscribiendo(null); setAviso(texto); setRecarga((k) => k + 1) }}
        />
      )}
    </div>
  )
}

function EscribirSeguimiento({ fila, plantillas, casillas, adminEmail, puedeEnviar, onClose, onEnviado }: {
  fila: FilaSeguimiento
  plantillas: PlantillaSeguimiento[]
  casillas: CasillaCorreo[]
  adminEmail: string
  puedeEnviar: boolean
  onClose: () => void
  onEnviado: (aviso: string) => void
}) {
  // Por defecto, la casilla de quien está usando el panel; si no tiene una, la
  // primera con WhatsApp cargado.
  const inicial = casillas.find((c) => c.email === adminEmail.toLowerCase()) ?? casillas.find((c) => c.whatsapp) ?? casillas[0]
  const [senderId, setSenderId] = useState(inicial?.id ?? '')
  const [etapa, setEtapa] = useState<EtapaSeguimiento>(fila.etapa)
  const [borrador, setBorrador] = useState<BorradorSeguimiento | null>(null)
  const [asunto, setAsunto] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [html, setHtml] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Cambiar la etapa o la casilla vuelve a armar el borrador desde la plantilla.
  useEffect(() => {
    if (!senderId) return
    let vivo = true
    platformApi.seguimientoBorrador({ businessId: fila.id, etapa, senderId })
      .then((b) => { if (vivo) { setBorrador(b); setAsunto(b.subject); setCuerpo(b.body) } })
      .catch((e) => { if (vivo) setError(e instanceof Error ? e.message : 'No se pudo armar el correo.') })
    return () => { vivo = false }
  }, [fila.id, etapa, senderId])

  // Vista previa: espera a que se deje de escribir un momento.
  useEffect(() => {
    if (!senderId || !borrador) return
    let vivo = true
    const t = setTimeout(() => {
      platformApi.seguimientoVistaPrevia({ businessId: fila.id, etapa, senderId, body: cuerpo })
        .then((r) => { if (vivo) setHtml(r.html) })
        .catch(() => {})
    }, 400)
    return () => { vivo = false; clearTimeout(t) }
  }, [fila.id, etapa, senderId, cuerpo, borrador])

  async function enviar() {
    setError('')
    if (asunto.trim().length < 3) { setError('Escribí un asunto.'); return }
    if (cuerpo.trim().length < 10) { setError('El mensaje es muy corto.'); return }
    setEnviando(true)
    try {
      const r = await platformApi.enviarSeguimiento({ businessId: fila.id, etapa, senderId, subject: asunto.trim(), body: cuerpo })
      if (!r.sent) { setError(r.error ?? 'El proveedor de correo rechazó el envío.'); setEnviando(false); return }
      onEnviado(r.simulated
        ? `Correo a ${fila.name} registrado (en este entorno no sale de verdad).`
        : `Le escribiste a ${fila.owner?.name ?? fila.name} (${borrador?.to}).`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar.')
      setEnviando(false)
    }
  }

  const sinWhatsapp = !!borrador && !borrador.whatsapp
  const sinCasillas = casillas.length === 0

  return (
    <ModalShell title={`Seguimiento a ${fila.name}`} onClose={onClose} cerrarAlClickAfuera={false} ancho={1040}>
      <style>{`@media (max-width: 900px) { .sg-escribir { grid-template-columns: minmax(0,1fr) !important; } }`}</style>
      {sinCasillas ? (
        <ErrorBox msg="No hay casillas de correo. Creá una en Correo → Casillas, con su número de WhatsApp." />
      ) : (
        <div className="sg-escribir" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 22, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && <ErrorBox msg={error} />}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
              <Field label="Desde">
                <select value={senderId} onChange={(e) => { setError(''); setSenderId(e.target.value) }} className="ds-field" style={{ ...inputStyle, width: '100%' }}>
                  {casillas.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}
                </select>
              </Field>
              <Field label="Plantilla">
                <select value={etapa} onChange={(e) => { setError(''); setEtapa(e.target.value as EtapaSeguimiento) }} className="ds-field" style={{ ...inputStyle, width: '100%' }}>
                  {plantillas.map((p) => (
                    <option key={p.etapa} value={p.etapa}>{p.nombre}{p.etapa === fila.etapa ? ' (su etapa)' : ''}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Para">
              <input value={borrador?.to ?? fila.owner?.email ?? ''} readOnly className="ds-field" style={{ ...inputStyle, color: 'var(--color-muted)' }} />
            </Field>
            <Field label="Asunto">
              <input value={asunto} onChange={(e) => setAsunto(e.target.value)} maxLength={200} className="ds-field" style={inputStyle} />
            </Field>
            <Field label="Mensaje" hint="La firma de la casilla y el botón de WhatsApp se agregan solos. Una línea en blanco separa párrafos; «- » al principio arma una lista.">
              <textarea
                value={cuerpo}
                onChange={(e) => setCuerpo(e.target.value)}
                rows={13}
                className="ds-field"
                style={{ ...inputStyle, height: 'auto', padding: '11px 13px', lineHeight: 1.55, resize: 'vertical' }}
              />
            </Field>
            {borrador?.whatsapp && (
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.55 }}>
                El botón «{borrador.whatsapp.texto}» abre un chat con +{borrador.whatsapp.numero} y le deja escrito: «{borrador.whatsapp.mensaje}»
              </p>
            )}
            {sinWhatsapp && (
              <ErrorBox msg="Esta casilla no tiene número de WhatsApp, así que el correo no llevaría el botón. Cargalo en Correo → Casillas o elegí otra casilla." />
            )}
            {!puedeEnviar && (
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-muted)' }}>Podés ver el correo, pero enviarlo es de un superadmin.</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={onClose} className="ds-hover" style={btnGhost}>Cancelar</button>
              <button
                type="button"
                onClick={enviar}
                disabled={!puedeEnviar || enviando || !borrador || sinWhatsapp}
                className="ds-hover"
                style={{ ...btnPrimary, opacity: !puedeEnviar || !borrador || sinWhatsapp ? 0.55 : 1 }}
              >
                {enviando ? 'Enviando…' : 'Enviar correo'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Vista previa</div>
            {html ? (
              <iframe
                title="Vista previa del correo"
                srcDoc={html}
                style={{ width: '100%', height: 620, border: '1px solid var(--color-border)', borderRadius: 12, display: 'block', background: '#fff' }}
              />
            ) : <Loader />}
          </div>
        </div>
      )}
    </ModalShell>
  )
}

function plural(n: number, uno: string, varios: string) {
  return `${n.toLocaleString('es-AR')} ${n === 1 ? uno : varios}`
}

function hace(iso: string) {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000))
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 60) return `hace ${dias} días`
  const meses = Math.floor(dias / 30)
  return `hace ${meses} meses`
}

function capitalizar(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1)
}
