import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, PauseCircle, RefreshCw } from 'lucide-react'
import { platformApi } from '@/lib/platform/api'
import {
  useFetch, Card, Table, PageHeader, Loader, ErrorBox, Chip, ModalShell, Field,
  btnGhost, btnPrimary, inputStyle, dateTime,
} from './ui'

// Estado de Orbi (IA) — apex orbita.site/superadmin?seccion=orbi.
// Si el proveedor de IA falla de forma sostenida (o se agota el saldo), Orbi se
// apaga solo para TODOS los negocios y se avisa por mail a los admins. No se
// enciende solo: se rehabilita desde acá, y antes de reabrir se hace una
// llamada de prueba real al proveedor.

/** Cómo se lee cada causa. Las que no se arreglan solas llevan el enlace a donde se resuelven. */
export const MOTIVOS: Record<string, { label: string; ayuda?: { texto: string; url: string } }> = {
  PROVIDER_CREDITS: {
    label: 'Se agotó el saldo de la cuenta de Gemini',
    ayuda: { texto: 'Recargá el saldo en AI Studio', url: 'https://aistudio.google.com/billing' },
  },
  PROVIDER_AUTH: {
    label: 'Gemini rechazó la clave (inválida, revocada o sin permiso)',
    ayuda: { texto: 'Revisá la clave en AI Studio', url: 'https://aistudio.google.com/app/apikey' },
  },
  MODEL_NOT_FOUND: { label: 'El modelo de IA configurado ya no existe en Gemini' },
  PROVIDER_QUOTA: { label: 'Gemini está limitando las llamadas (cuota)' },
  PROVIDER_DOWN: { label: 'Gemini no responde (caída o problema de red)' },
  REQUEST_INVALID: { label: 'Gemini rechaza las consultas de Orbi' },
  INTERNAL: { label: 'Orbi falla por un error interno' },
  MANUAL: { label: 'Un administrador lo puso en mantenimiento' },
}
const motivoDe = (c: string | null) => (c ? MOTIVOS[c]?.label ?? c : '—')
const DONDE: Record<string, string> = { panel: 'Panel', wizard: 'Alta de negocio' }

export function TabOrbi() {
  const [tick, setTick] = useState(0)
  const refrescar = () => setTick((k) => k + 1)
  // Se vuelve a pedir cada 30 s con la pestaña visible: si otro admin lo
  // rehabilita, o se apaga solo, la pantalla no se queda mostrando lo viejo.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') refrescar()
    }, 30_000)
    return () => clearInterval(t)
  }, [])
  const { data, error, loading } = useFetch(() => platformApi.orbiEstado(), [tick])

  const [rehabilitando, setRehabilitando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pidiendoMantenimiento, setPidiendoMantenimiento] = useState(false)

  async function rehabilitar() {
    setRehabilitando(true)
    setResultado(null)
    try {
      const r = await platformApi.orbiRehabilitar()
      setResultado(
        r.ok
          ? { ok: true, texto: 'Orbi volvió a estar activo. La llamada de prueba a Gemini salió bien.' }
          : { ok: false, texto: `Sigue en mantenimiento: ${motivoDe(r.categoria)}. ${r.detalle}` },
      )
      refrescar()
    } catch (e) {
      setResultado({ ok: false, texto: e instanceof Error ? e.message : 'No se pudo rehabilitar. Probá de nuevo.' })
    } finally {
      setRehabilitando(false)
    }
  }

  if (loading && !data) return <Loader />
  if (error || !data) {
    return (
      <>
        <PageHeader title="Orbi" />
        <ErrorBox msg="No se pudo cargar el estado de Orbi." action={<button type="button" className="ds-hover" style={btnGhost} onClick={refrescar}>Reintentar</button>} />
      </>
    )
  }

  const { estado, fallasUltimaHora, ultimasFallas } = data
  const enMantenimiento = estado.status === 'MAINTENANCE'
  const ayuda = estado.reason ? MOTIVOS[estado.reason]?.ayuda : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Orbi"
        subtitle="El asistente de IA del panel y del alta de negocios. Si Gemini falla de forma sostenida, se apaga para todos los negocios y se avisa por mail a los admins."
        action={
          <button type="button" className="ds-hover" style={btnGhost} onClick={refrescar} aria-label="Actualizar el estado">
            <RefreshCw size={15} aria-hidden /> Actualizar
          </button>
        }
      />

      <Card>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0, flex: '1 1 320px' }}>
            {enMantenimiento
              ? <AlertTriangle size={26} color="var(--color-error)" aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
              : <CheckCircle2 size={26} color="var(--color-success, #10B981)" aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
                  {enMantenimiento ? 'En mantenimiento' : 'Activo'}
                </span>
                {/* Estado también en texto y forma, no solo en color. */}
                <Chip text={enMantenimiento ? 'Los negocios ven un aviso' : 'Atendiendo con normalidad'} tone={enMantenimiento ? 'red' : 'green'} dot />
              </div>
              {enMantenimiento ? (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.5 }}>
                  <div><strong style={{ color: 'var(--color-text)' }}>Qué pasó:</strong> {motivoDe(estado.reason)}</div>
                  {estado.detail && (
                    <div style={{ fontFamily: '"Geist Mono", monospace', fontSize: 12, color: 'var(--color-muted)', wordBreak: 'break-word' }}>{estado.detail}</div>
                  )}
                  <div style={{ color: 'var(--color-muted)', fontSize: 12.5 }}>
                    Desde {estado.trippedAt ? dateTime(estado.trippedAt) : '—'} ·{' '}
                    {estado.trippedBy === 'auto' ? 'se apagó solo' : 'lo puso un administrador'}
                  </div>
                  {ayuda && (
                    <a href={ayuda.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', width: 'fit-content' }}>
                      {ayuda.texto} <ExternalLink size={13} aria-hidden />
                    </a>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                  Última respuesta buena de Gemini: {estado.lastOkAt ? dateTime(estado.lastOkAt) : 'sin registro todavía'}.
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {enMantenimiento ? (
              <button type="button" className="ds-hover" disabled={rehabilitando} style={{ ...btnPrimary, opacity: rehabilitando ? 0.7 : 1 }} onClick={() => void rehabilitar()}>
                {rehabilitando ? 'Probando con Gemini…' : 'Rehabilitar Orbi'}
              </button>
            ) : (
              <button type="button" className="ds-hover" style={btnGhost} onClick={() => setPidiendoMantenimiento(true)}>
                <PauseCircle size={15} aria-hidden /> Poner en mantenimiento
              </button>
            )}
          </div>
        </div>

        {enMantenimiento && (
          <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Al rehabilitar se hace una llamada real a Gemini. Si no contesta, Orbi sigue en mantenimiento y acá ves el motivo. No se rehabilita solo.
          </p>
        )}

        {/* aria-live: el resultado de rehabilitar tiene que anunciarse, no solo aparecer. */}
        <div role="status" aria-live="polite">
          {resultado && (
            <div style={{ marginTop: 14 }}>
              {resultado.ok
                ? <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--color-success-bg)', color: 'var(--chip-success-fg)', fontSize: 13.5, fontWeight: 500 }}>{resultado.texto}</div>
                : <ErrorBox msg={resultado.texto} />}
            </div>
          )}
        </div>
      </Card>

      <Card
        title="Últimas fallas del proveedor"
        subtitle={`${fallasUltimaHora} en la última hora · solo se guardan 30 días, sin texto de las personas`}
        noPad
      >
        <Table
          head={['Cuándo', 'Dónde', 'Qué pasó', 'Detalle']}
          rows={ultimasFallas.map((f, i) => ({
            key: `${f.createdAt}-${i}`,
            cells: [
              dateTime(f.createdAt),
              DONDE[f.surface] ?? f.surface,
              <span key="m">{motivoDe(f.category)}{f.httpStatus ? <span style={{ color: 'var(--color-muted)' }}> · {f.httpStatus}</span> : null}</span>,
              <span key="d" style={{ fontFamily: '"Geist Mono", monospace', fontSize: 12, color: 'var(--color-muted)', wordBreak: 'break-word' }}>{f.detail}</span>,
            ],
          }))}
          alignRight={[]}
        />
      </Card>

      {pidiendoMantenimiento && (
        <PonerEnMantenimiento
          onCerrar={() => setPidiendoMantenimiento(false)}
          onHecho={() => {
            setPidiendoMantenimiento(false)
            setResultado(null)
            refrescar()
          }}
        />
      )}
    </div>
  )
}

function PonerEnMantenimiento({ onCerrar, onHecho }: { onCerrar: () => void; onHecho: () => void }) {
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  return (
    <ModalShell title="Poner a Orbi en mantenimiento" onClose={onCerrar}>
      <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.55 }}>
        Ningún negocio va a poder usar a Orbi (ni el panel ni el alta de negocios) hasta que lo rehabilites. Se avisa por mail a todos los admins.
      </p>
      <Field label="Motivo (opcional)" hint="Lo ven los admins en el mail y en esta pantalla.">
        <input
          style={inputStyle}
          value={motivo}
          maxLength={200}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej.: cambio de modelo de IA"
        />
      </Field>
      {error && <div style={{ marginTop: 14 }}><ErrorBox msg={error} /></div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
        <button type="button" className="ds-hover" style={btnGhost} onClick={onCerrar}>Cancelar</button>
        <button
          type="button"
          className="ds-hover"
          disabled={enviando}
          style={{ ...btnPrimary, background: 'var(--color-error)', opacity: enviando ? 0.7 : 1 }}
          onClick={async () => {
            setEnviando(true)
            setError('')
            try {
              await platformApi.orbiMantenimiento(motivo.trim() || undefined)
              onHecho()
            } catch (e) {
              setError(e instanceof Error ? e.message : 'No se pudo poner en mantenimiento.')
              setEnviando(false)
            }
          }}
        >
          {enviando ? 'Poniendo…' : 'Poner en mantenimiento'}
        </button>
      </div>
    </ModalShell>
  )
}
