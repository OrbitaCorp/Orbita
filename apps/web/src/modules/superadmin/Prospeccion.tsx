import { useState } from 'react'
import { platformApi, type Prospecto, type ProspectoEstado, type ProspectoNivel } from '@/lib/platform/api'
import type { ToastVariant } from '@/design-system/components/Toast'
import { useFetch, Card, Table, Chip, Loader, ErrorBox, Empty, ConfirmModal, dateTime, btnGhost, btnGhostSm, btnPrimary, inputStyle } from './ui'

// Marketing → Prospección: se consultan cuentas de Instagram (API de Meta, solo cuentas profesionales), el sistema las
// puntúa con el criterio de cliente ideal y cada superadmin pide a SU Claude que las analice y redacte un mensaje.
// Claude trabaja por el conector MCP del servidor (apps/api/src/marketing/prospeccion/mcp/): lee el lote y guarda el
// análisis, pero no envía nada. Los mensajes los revisa y los manda una persona, a mano.

type Aviso = { variant: ToastVariant; title: string; description?: string }

const URL_CONECTOR = 'https://api.orbita.site/api/v1/mcp/prospeccion'
const MAX_CUENTAS = 20

const ESTADOS: { id: ProspectoEstado; texto: string }[] = [
  { id: 'NUEVO', texto: 'Nuevo' },
  { id: 'CONTACTADO', texto: 'Contactado' },
  { id: 'RESPONDIO', texto: 'Respondió' },
  { id: 'DEMO', texto: 'Demo' },
  { id: 'CLIENTE', texto: 'Cliente' },
  { id: 'DESCARTADO', texto: 'Descartado' },
  { id: 'NO_CONTACTAR', texto: 'No contactar' },
]

const tonoNivel = (n: ProspectoNivel): 'green' | 'amber' | 'gray' => (n === 'A' ? 'green' : n === 'B' ? 'amber' : 'gray')
const num = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('es-AR'))

function instruccionParaClaude(loteId: string) {
  return [
    `Analizá el lote ${loteId} de la Prospección de Órbita con el conector «Órbita Prospección».`,
    '1. Leé el criterio (prospeccion_criterio) y el lote (prospeccion_obtener_lote), empezando por los niveles A y B, de a 10 cuentas.',
    '2. Para cada cuenta decidí el subrubro, si vende productos, por dónde vende, qué señales de dolor tiene, el nivel final y por qué, y escribí un mensaje corto y humano, sin promesas que no estén en la guía.',
    '3. Guardá el análisis con prospeccion_guardar_analisis.',
    'No envíes ni contactes a nadie: los mensajes los revisa y los manda una persona.',
  ].join('\n')
}

const copiar = async (texto: string, setAviso: (a: Aviso) => void, que: string) => {
  try {
    await navigator.clipboard.writeText(texto)
    setAviso({ variant: 'success', title: `${que} copiado` })
  } catch {
    setAviso({ variant: 'error', title: 'No se pudo copiar', description: 'Seleccionalo y copialo a mano.' })
  }
}

export function PanelProspeccion({ puedeEditar, setAviso }: { puedeEditar: boolean; setAviso: (a: Aviso) => void }) {
  const [tick, setTick] = useState(0)
  const { data: lotes, loading: cargandoLotes, error: errorLotes } = useFetch(() => platformApi.prospeccionLotes(), [tick])
  const [loteId, setLoteId] = useState<string | null>(null)
  const [tickLote, setTickLote] = useState(0)
  const { data: lote, loading: cargandoLote, error: errorLote } = useFetch(
    () => (loteId ? platformApi.prospeccionLote(loteId) : Promise.resolve(null)),
    [loteId, tickLote],
  )
  const [texto, setTexto] = useState('')
  const [consultando, setConsultando] = useState(false)
  const [elegido, setElegido] = useState<string | null>(null)
  const [desconectar, setDesconectar] = useState(false)

  const cuentas = texto.split(/[\s,;]+/).filter(Boolean)
  const consultar = async () => {
    setConsultando(true)
    try {
      const r = await platformApi.prospeccionConsultar(cuentas)
      setAviso({
        variant: r.aviso ? 'error' : 'success',
        title: `${r.conDatos} ${r.conDatos === 1 ? 'cuenta consultada' : 'cuentas consultadas'}`,
        description: r.aviso ?? (r.sinDatos.length ? `${r.sinDatos.length} sin datos (cuentas personales, privadas o inexistentes).` : undefined),
      })
      setTexto('')
      setTick((n) => n + 1)
      setLoteId(r.lote.id)
      setElegido(null)
    } catch (e) {
      setAviso({ variant: 'error', title: 'No se pudo consultar', description: e instanceof Error ? e.message : undefined })
    } finally {
      setConsultando(false)
    }
  }

  const cambiar = async (p: Prospecto, cambios: { estado?: ProspectoEstado; notas?: string }) => {
    try {
      await platformApi.prospeccionActualizar(p.id, cambios)
      setTickLote((n) => n + 1)
    } catch (e) {
      setAviso({ variant: 'error', title: 'No se pudo guardar', description: e instanceof Error ? e.message : undefined })
    }
  }

  const prospecto = lote?.prospectos.find((p) => p.usuario === elegido) ?? null

  return (
    <>
      <Card title="Cuentas a consultar" subtitle={`Pegá usuarios o direcciones de perfil de Instagram, hasta ${MAX_CUENTAS} por vez. Solo se ven las cuentas profesionales (de empresa o creador).`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={'@tienda_uno\nhttps://www.instagram.com/tienda_dos/'}
            aria-label="Cuentas de Instagram"
            style={{ ...inputStyle, height: 'auto', minHeight: 96, padding: '11px 13px', lineHeight: 1.5, resize: 'vertical', width: '100%' }}
          />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={consultar} disabled={!puedeEditar || consultando || cuentas.length === 0 || cuentas.length > MAX_CUENTAS} style={{ ...btnPrimary, opacity: !cuentas.length || cuentas.length > MAX_CUENTAS || consultando ? 0.6 : 1 }}>
              {consultando ? 'Consultando…' : 'Consultar cuentas'}
            </button>
            <span style={{ fontSize: 12.5, color: cuentas.length > MAX_CUENTAS ? 'var(--color-error)' : 'var(--color-muted)' }}>
              {cuentas.length} {cuentas.length === 1 ? 'cuenta' : 'cuentas'}{cuentas.length > MAX_CUENTAS ? `: el máximo es ${MAX_CUENTAS}` : ''}
            </span>
          </div>
        </div>
      </Card>

      <Card title="Lotes" subtitle="Cada consulta queda guardada como un lote">
        {cargandoLotes ? <Loader /> : errorLotes || !lotes ? (
          <ErrorBox msg="No se pudieron leer los lotes." action={<button type="button" onClick={() => setTick((n) => n + 1)} style={btnGhostSm}>Reintentar</button>} />
        ) : lotes.length === 0 ? <Empty text="Todavía no hay lotes. Pegá algunas cuentas arriba para empezar." /> : (
          <Table
            head={['Fecha', 'Cuentas', 'Niveles', 'Analizadas']}
            alignRight={[1, 3]}
            rows={lotes.map((l) => ({
              key: l.id,
              onClick: () => { setLoteId(l.id); setElegido(null) },
              cells: [
                <span key="f" style={{ fontWeight: l.id === loteId ? 700 : 400, color: 'var(--color-text)' }}>{dateTime(l.createdAt)}</span>,
                <span key="c">{l.cuentas}{l.sinDatos ? <span style={{ color: 'var(--color-muted)' }}> (+{l.sinDatos} sin datos)</span> : null}</span>,
                <span key="n" style={{ color: 'var(--color-muted)' }}>{(['A', 'B', 'C', 'D'] as const).filter((n) => l.niveles[n]).map((n) => `${n} ${l.niveles[n]}`).join(' · ') || '—'}</span>,
                <span key="a">{l.analizadas} / {l.cuentas}</span>,
              ],
            }))}
          />
        )}
      </Card>

      {loteId && (
        <Card
          title="Cuentas del lote"
          subtitle={lote ? `Criterio del ${lote.versionCriterio}` : undefined}
          action={<button type="button" onClick={() => setTickLote((n) => n + 1)} className="ds-hover" style={{ ...btnGhostSm, height: 34 }}>Actualizar</button>}
        >
          {cargandoLote ? <Loader /> : errorLote || !lote ? <ErrorBox msg="No se pudo leer el lote." /> : (
            <>
              <Table
                head={['Cuenta', 'Nivel', 'Puntaje', 'Seguidores', 'Subrubro', 'Estado', 'Claude']}
                alignRight={[2, 3]}
                rows={lote.prospectos.map((p) => ({
                  key: p.id,
                  onClick: () => setElegido(p.usuario === elegido ? null : p.usuario),
                  cells: [
                    <span key="u" style={{ fontWeight: p.usuario === elegido ? 700 : 500, color: 'var(--color-text)' }}>@{p.usuario}</span>,
                    <Chip key="n" text={p.analisis ? `${p.evaluacion.nivel} → ${p.analisis.nivel_final}` : p.evaluacion.nivel} tone={tonoNivel(p.analisis?.nivel_final ?? p.evaluacion.nivel)} />,
                    num(p.evaluacion.puntaje),
                    num(p.datos.seguidores),
                    p.analisis?.subrubro ?? p.evaluacion.subrubro ?? '—',
                    ESTADOS.find((e) => e.id === p.estado)?.texto ?? p.estado,
                    p.analizadoAt ? 'Analizada' : <span key="x" style={{ color: 'var(--color-muted)' }}>Pendiente</span>,
                  ],
                }))}
              />
              {lote.sinDatos.length > 0 && (
                <p style={{ margin: '14px 0 0', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.55 }}>
                  Sin datos: {lote.sinDatos.map((s) => `@${s.usuario} (${s.motivo})`).join(', ')}.
                </p>
              )}
            </>
          )}
        </Card>
      )}

      {prospecto && <DetalleProspecto key={prospecto.id} p={prospecto} puedeEditar={puedeEditar} onCambiar={(c) => cambiar(prospecto, c)} setAviso={setAviso} />}

      <Card title="Analizar con Claude" subtitle="Cada persona usa su propio Claude: no hay clave de API ni nada que instalar">
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.6 }}>
          <li>
            Una sola vez, en Claude: Configuración → Conectores → «Agregar conector personalizado», con esta dirección. Claude va a abrir esta pantalla del panel para que lo autorices con tu cuenta de la organización.
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
              <code style={{ padding: '7px 10px', borderRadius: 8, background: 'var(--color-surface-alt)', color: 'var(--color-text)', fontSize: 12.5, overflowWrap: 'anywhere' }}>{URL_CONECTOR}</code>
              <button type="button" onClick={() => copiar(URL_CONECTOR, setAviso, 'La dirección')} className="ds-hover" style={btnGhostSm}>Copiar</button>
            </div>
          </li>
          <li>
            Elegí un lote arriba y abrí Claude con la instrucción lista. Si no se completa sola, copiala y pegala en una conversación nueva.
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <button
                type="button"
                disabled={!loteId}
                onClick={() => loteId && window.open(`https://claude.ai/new?q=${encodeURIComponent(instruccionParaClaude(loteId))}`, '_blank', 'noopener')}
                style={{ ...btnPrimary, opacity: loteId ? 1 : 0.6 }}
              >Abrir Claude con este lote</button>
              <button type="button" disabled={!loteId} onClick={() => loteId && copiar(instruccionParaClaude(loteId), setAviso, 'La instrucción')} className="ds-hover" style={{ ...btnGhost, opacity: loteId ? 1 : 0.6 }}>Copiar la instrucción</button>
            </div>
          </li>
          <li>Cuando Claude termine, tocá «Actualizar» en el lote: vas a ver el análisis y el mensaje sugerido de cada cuenta. Revisalo y mandalo vos desde Instagram.</li>
        </ol>
        {puedeEditar && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5, maxWidth: 520 }}>El acceso de Claude dura hasta que lo cortes. Desconectar cierra todos los Claude conectados con tu usuario.</span>
            <button type="button" onClick={() => setDesconectar(true)} className="ds-hover" style={btnGhostSm}>Desconectar Claude</button>
          </div>
        )}
      </Card>

      {desconectar && (
        <ConfirmModal
          title="Desconectar Claude"
          body="Se corta el acceso de todos los Claude conectados con tu usuario. El análisis ya guardado no se toca. Para volver a usarlo hay que autorizar la conexión otra vez desde Claude."
          confirmLabel="Desconectar"
          onCancel={() => setDesconectar(false)}
          onConfirm={async () => {
            const r = await platformApi.mcpDesconectar()
            setDesconectar(false)
            setAviso({ variant: 'success', title: r.revocados ? 'Claude desconectado' : 'No había conexiones activas' })
          }}
        />
      )}
    </>
  )
}

function DetalleProspecto({ p, puedeEditar, onCambiar, setAviso }: {
  p: Prospecto; puedeEditar: boolean; onCambiar: (c: { estado?: ProspectoEstado; notas?: string }) => void; setAviso: (a: Aviso) => void
}) {
  const [notas, setNotas] = useState(p.notas ?? '')
  const a = p.analisis
  const dato = (etiqueta: string, valor: React.ReactNode) => (
    <div style={{ display: 'flex', gap: 14, fontSize: 13.5, padding: '9px 0', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
      <span style={{ width: 150, flexShrink: 0, color: 'var(--color-muted)', fontSize: 12.5 }}>{etiqueta}</span>
      <span style={{ color: 'var(--color-text)', minWidth: 0, flex: 1, overflowWrap: 'anywhere' }}>{valor}</span>
    </div>
  )
  return (
    <Card
      title={`@${p.usuario}`}
      subtitle={p.datos.nombre ?? undefined}
      action={<a href={`https://www.instagram.com/${p.usuario}`} target="_blank" rel="noreferrer" className="ds-hover" style={{ ...btnGhostSm, height: 34, textDecoration: 'none' }}>Abrir en Instagram</a>}
    >
      {dato('Bio', p.datos.bio || '—')}
      {dato('Enlace', p.datos.web ?? '—')}
      {dato('Seguidores', `${num(p.datos.seguidores)} · ${num(p.datos.publicaciones)} publicaciones`)}
      {dato('Actividad', `${p.datos.postsPorSemana == null ? '—' : `${p.datos.postsPorSemana} por semana`}${p.datos.diasDesdeUltimo == null ? '' : ` · última hace ${p.datos.diasDesdeUltimo} días`}`)}
      {dato('Criterio', `${p.evaluacion.nivel} · ${num(p.evaluacion.puntaje)} puntos · ${p.evaluacion.accion}. ${p.evaluacion.motivo}`)}

      {a ? (
        <>
          {dato('Análisis de Claude', `${a.subrubro} (confianza ${a.confianza}) · nivel ${a.nivel_final}. ${a.motivo}`)}
          {dato('Cómo vende', `${a.vende_productos === null ? 'No está claro si vende productos' : a.vende_productos ? 'Vende productos' : 'No vende productos'}${a.canal_venta ? ` · ${a.canal_venta}` : ''}`)}
          {a.senales_dolor.length > 0 && dato('Señales de dolor', a.senales_dolor.join(' · '))}
          {dato('Ángulo', a.angulo || '—')}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 6 }}>Mensaje sugerido (revisalo antes de mandarlo)</div>
            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--color-surface-alt)', color: 'var(--color-text)', fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{a.mensaje_sugerido || 'Claude no dejó un mensaje para esta cuenta.'}</div>
            {a.mensaje_sugerido && <button type="button" onClick={() => copiar(a.mensaje_sugerido, setAviso, 'El mensaje')} className="ds-hover" style={{ ...btnGhostSm, marginTop: 8 }}>Copiar el mensaje</button>}
          </div>
        </>
      ) : (
        <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>Claude todavía no analizó esta cuenta.</p>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 18 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: 'var(--color-muted)' }}>
          Estado
          <select value={p.estado} disabled={!puedeEditar} onChange={(e) => onCambiar({ estado: e.target.value as ProspectoEstado })} style={{ ...inputStyle, minWidth: 170 }}>
            {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.texto}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: 'var(--color-muted)', flex: '1 1 280px' }}>
          Notas
          <textarea
            value={notas}
            disabled={!puedeEditar}
            onChange={(e) => setNotas(e.target.value)}
            onBlur={() => { if (notas !== (p.notas ?? '')) onCambiar({ notas }) }}
            maxLength={2000}
            style={{ ...inputStyle, height: 'auto', minHeight: 70, padding: '10px 13px', lineHeight: 1.5, resize: 'vertical' }}
          />
        </label>
      </div>
    </Card>
  )
}
