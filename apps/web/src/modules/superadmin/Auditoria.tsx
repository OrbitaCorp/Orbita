import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import {
  platformApi,
  type AuditArea, type AuditEstado, type AuditItemRow, type AuditListado, type AuditSeveridad,
  type CreateAuditItemInput, type UpdateAuditItemInput,
} from '@/lib/platform/api'
import {
  Card, Chip, ConfirmModal, Empty, ErrorBox, Field, Loader, ModalShell, PageHeader,
  btnGhost, btnGhostSm, btnPrimary, inputStyle, dateTime,
} from './ui'

// Auditoría interna del equipo (super admin → Auditoría).
//
// Un solo tablero para TODO lo que hay que revisar de Órbita: los módulos de
// la API, del panel y de la tienda, las revisiones transversales y los
// hallazgos que dejaron las auditorías anteriores. Cada ítem tiene estado,
// responsable, link al informe, notas y una lista de verificaciones para
// tildar. Lo edita todo el equipo a la vez: la lista se vuelve a pedir cada
// 20 s y al volver a la pestaña, así lo que tildó otro aparece solo.
//
// La lista base sale del seed del backend (platform/audit/audit-seed.ts); lo
// que se carga acá nunca se pisa desde el seed.

const AREAS: { id: AuditArea | 'TODO'; label: string }[] = [
  { id: 'TODO', label: 'Todo' },
  { id: 'BACKEND', label: 'Backend' },
  { id: 'FRONTEND', label: 'Frontend' },
  { id: 'TRANSVERSAL', label: 'Transversal' },
  { id: 'HALLAZGO', label: 'Hallazgos' },
]

const ESTADOS: { id: AuditEstado; label: string; tone: 'gray' | 'amber' | 'green' }[] = [
  { id: 'PENDIENTE', label: 'Pendiente', tone: 'gray' },
  { id: 'EN_CURSO', label: 'En curso', tone: 'amber' },
  { id: 'HECHO', label: 'Hecho', tone: 'green' },
]

const SEVERIDAD: Record<AuditSeveridad, { label: string; tone: 'red' | 'amber' | 'blue' | 'gray' | 'violet' }> = {
  CRITICA: { label: 'Crítica', tone: 'red' },
  ALTA: { label: 'Alta', tone: 'red' },
  MEDIA: { label: 'Media', tone: 'amber' },
  BAJA: { label: 'Baja', tone: 'blue' },
  INFO: { label: 'Info', tone: 'gray' },
}

const AREA_LABEL: Record<AuditArea, string> = { BACKEND: 'Backend', FRONTEND: 'Frontend', TRANSVERSAL: 'Transversal', HALLAZGO: 'Hallazgo' }

const REFRESCO_MS = 20_000

export function TabAuditoria({ currentAdminId }: { currentAdminId: string }) {
  const [data, setData] = useState<AuditListado | null>(null)
  const [error, setError] = useState('')
  const [refrescando, setRefrescando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [area, setArea] = useState<AuditArea | 'TODO'>('TODO')
  const [soloPendientes, setSoloPendientes] = useState(false)
  const [soloSinResponsable, setSoloSinResponsable] = useState(false)
  const [soloMios, setSoloMios] = useState(false)
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set())
  const [creando, setCreando] = useState(false)
  const cargandoRef = useRef(false)
  const tieneDatosRef = useRef(false)

  // `silencioso` = refresco de fondo: no muestra el spinner del botón y no
  // pisa la pantalla con un error si ya hay datos válidos cargados.
  const cargar = useCallback(async (silencioso: boolean) => {
    if (cargandoRef.current) return
    cargandoRef.current = true
    if (!silencioso) setRefrescando(true)
    try {
      const r = await platformApi.audit()
      tieneDatosRef.current = true
      setData(r)
      setError('')
    } catch (e) {
      if (!silencioso || !tieneDatosRef.current) setError(e instanceof Error ? e.message : 'No se pudo cargar la auditoría.')
    } finally {
      cargandoRef.current = false
      if (!silencioso) setRefrescando(false)
    }
  }, [])

  useEffect(() => {
    // setTimeout 0 y no llamada directa: el linter de React Compiler no acepta
    // que el efecto llame a algo que hace setState (mismo gotcha que el
    // tutorial del panel).
    const primera = window.setTimeout(() => void cargar(true), 0)
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void cargar(true) }, REFRESCO_MS)
    const alVolver = () => { if (document.visibilityState === 'visible') void cargar(true) }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    return () => {
      window.clearTimeout(primera)
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
    }
  }, [cargar])

  // Actualización optimista: se aplica local, se manda, y si falla se vuelve a
  // pedir la lista entera (más simple y más seguro que deshacer a mano).
  const actualizar = useCallback(async (id: string, input: UpdateAuditItemInput) => {
    try {
      const fila = await platformApi.updateAuditItem(id, input)
      setData((d) => d ? { ...d, items: d.items.map((i) => (i.id === id ? fila : i)), resumen: resumirLocal(d.items.map((i) => (i.id === id ? fila : i))) } : d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
      void cargar(true)
    }
  }, [cargar])

  const toggleAbierto = (id: string) => setAbiertos((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  const visibles = useMemo(() => {
    if (!data) return []
    const q = busqueda.trim().toLowerCase()
    return data.items.filter((i) => {
      if (area !== 'TODO' && i.area !== area) return false
      if (soloPendientes && i.estado === 'HECHO') return false
      if (soloSinResponsable && (i.responsable || i.estado === 'HECHO')) return false
      if (soloMios && i.responsable?.id !== currentAdminId) return false
      if (!q) return true
      const texto = [i.titulo, i.ruta, i.foco, i.grupo, i.notas, i.responsable?.name, ...i.checks.map((c) => c.texto)].filter(Boolean).join(' ').toLowerCase()
      return texto.includes(q)
    })
  }, [data, busqueda, area, soloPendientes, soloSinResponsable, soloMios, currentAdminId])

  // Agrupa preservando el orden del seed.
  const grupos = useMemo(() => {
    const out: { nombre: string; area: AuditArea; items: AuditItemRow[] }[] = []
    for (const it of visibles) {
      const g = out.find((x) => x.nombre === it.grupo && x.area === it.area)
      if (g) g.items.push(it)
      else out.push({ nombre: it.grupo, area: it.area, items: [it] })
    }
    return out
  }, [visibles])

  if (error && !data) return <ErrorBox msg={error} />
  if (!data) return <Loader />

  const { resumen } = data
  const pct = resumen.total ? Math.round((resumen.hechos / resumen.total) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`
        .au-fila { display: grid; grid-template-columns: 28px minmax(0, 1fr) 150px 170px 200px; gap: 12px; align-items: center; padding: 12px 16px; border-top: 1px solid var(--color-border); }
        .au-fila:first-child { border-top: none; }
        .au-detalle { padding: 4px 16px 18px 56px; border-top: 1px dashed var(--color-border); display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 20px; }
        .au-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .au-toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .au-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .au-check { display: flex; gap: 10px; align-items: flex-start; padding: 6px 0; cursor: pointer; font-size: 13px; color: var(--color-body); line-height: 1.45; }
        .au-check input { margin-top: 3px; width: 16px; height: 16px; accent-color: var(--color-primary); cursor: pointer; flex-shrink: 0; }
        .au-check.hecho { color: var(--color-muted); text-decoration: line-through; text-decoration-color: var(--color-border); }
        .au-btn-estado { height: 30px; border-radius: 999px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-body); font: inherit; font-size: 12.5px; font-weight: 600; padding: 0 12px; cursor: pointer; }
        .au-mini { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: var(--color-muted); white-space: nowrap; }
        .au-mini .barra { width: 54px; height: 5px; border-radius: 999px; background: var(--color-surface-alt); overflow: hidden; }
        .au-mini .barra > span { display: block; height: 100%; background: var(--color-primary); transition: width 200ms ease; }
        @media (max-width: 960px) {
          .au-fila { grid-template-columns: 28px minmax(0, 1fr); row-gap: 8px; }
          .au-fila > .au-col-r { grid-column: 2; }
          .au-detalle { grid-template-columns: 1fr; padding-left: 16px; }
          .au-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (prefers-reduced-motion: reduce) { .au-mini .barra > span { transition: none; } }
      `}</style>

      <PageHeader
        title="Auditoría"
        subtitle="Todo lo que hay que revisar de Órbita, quién lo toma y en qué está. Lo que tilda cada uno lo ven todos."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => void cargar(false)} className="ds-hover" style={btnGhost} aria-label="Actualizar" title="Actualizar ahora (también se actualiza solo cada 20 s)">
              <RefreshCw size={15} strokeWidth={2} style={{ animation: refrescando ? 'orbita-spin 0.7s linear infinite' : undefined }} />
              Actualizar
            </button>
            <button onClick={() => setCreando(true)} className="ds-hover" style={btnPrimary}>
              <Plus size={16} strokeWidth={2} /> Agregar ítem
            </button>
          </div>
        }
      />

      {error && <ErrorBox msg={error} />}

      <div className="au-kpis">
        <KpiProgreso label="Auditado" valor={`${resumen.hechos} / ${resumen.total}`} pct={pct} hint={`${pct}% del inventario`} />
        <KpiSimple label="En curso" valor={String(resumen.enCurso)} hint="Alguien lo está mirando" tone="amber" />
        <KpiSimple label="Sin responsable" valor={String(resumen.sinResponsable)} hint="Pendientes que nadie tomó" tone={resumen.sinResponsable ? 'red' : 'green'} />
        <KpiSimple label="Hallazgos abiertos" valor={String(resumen.hallazgosAbiertos)} hint="Críticos, altos, medios y bajos sin resolver" tone={resumen.hallazgosAbiertos ? 'red' : 'green'} />
      </div>

      <Card noPad>
        <div className="au-toolbar" style={{ padding: '12px 16px' }}>
          <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 200 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--color-muted)' }} aria-hidden />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar módulo, ruta, foco, verificación…"
              aria-label="Buscar en la auditoría"
              className="ds-field"
              style={{ ...inputStyle, width: '100%', paddingLeft: 34 }}
            />
          </div>
          <div className="au-chips" role="tablist" aria-label="Área">
            {AREAS.map((a) => {
              const activo = area === a.id
              const n = a.id === 'TODO' ? resumen.total : (resumen.porArea[a.id]?.total ?? 0)
              const h = a.id === 'TODO' ? resumen.hechos : (resumen.porArea[a.id]?.hechos ?? 0)
              return (
                <button
                  key={a.id}
                  role="tab"
                  aria-selected={activo}
                  onClick={() => setArea(a.id)}
                  className="ds-hover au-btn-estado"
                  style={activo ? { background: 'var(--color-primary-bg)', color: 'var(--color-primary)', borderColor: 'transparent' } : undefined}
                >
                  {a.label} <span style={{ fontWeight: 500, opacity: 0.8 }}>{h}/{n}</span>
                </button>
              )
            })}
          </div>
          <div className="au-chips">
            <FiltroToggle activo={soloPendientes} onClick={() => setSoloPendientes((v) => !v)}>Solo pendientes</FiltroToggle>
            <FiltroToggle activo={soloSinResponsable} onClick={() => setSoloSinResponsable((v) => !v)}>Sin responsable</FiltroToggle>
            <FiltroToggle activo={soloMios} onClick={() => setSoloMios((v) => !v)}>Los míos</FiltroToggle>
          </div>
        </div>
      </Card>

      {grupos.length === 0 && <Card><Empty text="Nada coincide con ese filtro." /></Card>}

      {grupos.map((g) => {
        const hechos = g.items.filter((i) => i.estado === 'HECHO').length
        return (
          <Card
            key={`${g.area}:${g.nombre}`}
            noPad
            title={g.nombre}
            subtitle={AREA_LABEL[g.area]}
            action={<Chip text={`${hechos}/${g.items.length}`} tone={hechos === g.items.length ? 'green' : 'gray'} />}
          >
            {g.items.map((it) => (
              <FilaItem
                key={it.id}
                item={it}
                admins={data.admins}
                abierto={abiertos.has(it.id)}
                onToggle={() => toggleAbierto(it.id)}
                onActualizar={(input) => actualizar(it.id, input)}
                onBorrado={() => void cargar(true)}
              />
            ))}
          </Card>
        )
      })}

      {creando && (
        <CrearItemModal
          grupos={Array.from(new Set(data.items.map((i) => i.grupo)))}
          onClose={() => setCreando(false)}
          onCreado={() => { setCreando(false); void cargar(true) }}
        />
      )}
    </div>
  )
}

// ─── Fila + detalle ───────────────────────────────────────────────────────────

function FilaItem({ item, admins, abierto, onToggle, onActualizar, onBorrado }: {
  item: AuditItemRow
  admins: { id: string; name: string }[]
  abierto: boolean
  onToggle: () => void
  onActualizar: (input: UpdateAuditItemInput) => Promise<void>
  onBorrado: () => void
}) {
  const estado = ESTADOS.find((e) => e.id === item.estado) ?? ESTADOS[0]
  const total = item.checks.length
  const pct = total ? Math.round((item.checksHechos / total) * 100) : 0
  const todosTildados = total > 0 && item.checksHechos === total && item.estado !== 'HECHO'

  return (
    <div>
      <div className="au-fila">
        <button
          onClick={onToggle}
          aria-expanded={abierto}
          aria-label={abierto ? 'Cerrar detalle' : 'Ver verificaciones'}
          className="ds-hover"
          style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--color-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={onToggle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 13.5 }}>{item.titulo}</span>
            {item.severidad && <Chip text={SEVERIDAD[item.severidad].label} tone={SEVERIDAD[item.severidad].tone} />}
            {item.ruta && <code style={{ fontSize: 11, color: 'var(--color-muted)', background: 'var(--color-surface-alt)', padding: '1px 6px', borderRadius: 5, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.ruta}</code>}
            {item.esPersonalizado && <Chip text="Agregado a mano" tone="violet" />}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 3, lineHeight: 1.45 }}>{item.foco}</div>
        </div>

        <div className="au-col-r">
          <span className="au-mini" title={`${item.checksHechos} de ${total} verificaciones`}>
            <span className="barra" aria-hidden><span style={{ width: `${pct}%` }} /></span>
            {item.checksHechos}/{total}
          </span>
        </div>

        <div className="au-col-r">
          <select
            value={item.responsable?.id ?? ''}
            onChange={(e) => void onActualizar({ responsableId: e.target.value || null })}
            aria-label="Responsable"
            className="ds-field"
            style={{ ...inputStyle, height: 34, fontSize: 12.5, width: '100%', color: item.responsable ? 'var(--color-text)' : 'var(--color-muted)' }}
          >
            <option value="">Sin responsable</option>
            {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div className="au-col-r" style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
          <SelectorEstado valor={item.estado} onChange={(estado) => void onActualizar({ estado })} />
          {item.informeUrl && (
            <a href={item.informeUrl} target="_blank" rel="noopener noreferrer" className="ds-hover" style={{ ...btnGhostSm, textDecoration: 'none' }} title={item.informeUrl}>
              <ExternalLink size={13} /> Informe
            </a>
          )}
        </div>
      </div>

      {abierto && (
        <DetalleItem item={item} estadoLabel={estado.label} todosTildados={todosTildados} onActualizar={onActualizar} onBorrado={onBorrado} />
      )}
    </div>
  )
}

function DetalleItem({ item, estadoLabel, todosTildados, onActualizar, onBorrado }: {
  item: AuditItemRow
  estadoLabel: string
  todosTildados: boolean
  onActualizar: (input: UpdateAuditItemInput) => Promise<void>
  onBorrado: () => void
}) {
  const [informe, setInforme] = useState(item.informeUrl ?? '')
  const [notas, setNotas] = useState(item.notas ?? '')
  const [nuevoCheck, setNuevoCheck] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [errorLocal, setErrorLocal] = useState('')

  // Si otro del equipo cambió el informe o las notas, se refleja acá salvo
  // que uno esté a mitad de escribir (el campo local tiene la última palabra
  // hasta que se guarda).
  const ultimoInforme = useRef(item.informeUrl ?? '')
  const ultimasNotas = useRef(item.notas ?? '')
  useEffect(() => {
    if (ultimoInforme.current !== (item.informeUrl ?? '')) { ultimoInforme.current = item.informeUrl ?? ''; setInforme(item.informeUrl ?? '') }
    if (ultimasNotas.current !== (item.notas ?? '')) { ultimasNotas.current = item.notas ?? ''; setNotas(item.notas ?? '') }
  }, [item.informeUrl, item.notas])

  const guardarTexto = async () => {
    const cambios: UpdateAuditItemInput = {}
    if ((item.informeUrl ?? '') !== informe.trim()) cambios.informeUrl = informe.trim() || null
    if ((item.notas ?? '') !== notas.trim()) cambios.notas = notas.trim() || null
    if (Object.keys(cambios).length === 0) return
    if (cambios.informeUrl && !/^https?:\/\/\S+$/i.test(cambios.informeUrl)) {
      setErrorLocal('El informe tiene que ser un link que empiece con http:// o https://')
      return
    }
    setErrorLocal('')
    setGuardando(true)
    await onActualizar(cambios)
    setGuardando(false)
  }

  const agregarCheck = async () => {
    const texto = nuevoCheck.trim()
    if (texto.length < 3) return
    setNuevoCheck('')
    await onActualizar({ nuevosChecks: [texto] })
  }

  return (
    <div className="au-detalle">
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '10px 0 4px' }}>
          Verificaciones
        </div>
        {item.checks.length === 0 && <Empty text="Este ítem no tiene verificaciones todavía." />}
        {item.checks.map((c) => (
          <label key={c.id} className={`au-check${c.hecho ? ' hecho' : ''}`}>
            <input type="checkbox" checked={c.hecho} onChange={(e) => void onActualizar({ checks: [{ id: c.id, hecho: e.target.checked }] })} />
            <span>{c.texto}</span>
          </label>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); void agregarCheck() }} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            value={nuevoCheck}
            onChange={(e) => setNuevoCheck(e.target.value)}
            placeholder="Sumar una verificación…"
            aria-label="Nueva verificación"
            className="ds-field"
            style={{ ...inputStyle, height: 34, fontSize: 12.5, flex: 1 }}
          />
          <button type="submit" disabled={nuevoCheck.trim().length < 3} className="ds-hover" style={{ ...btnGhostSm, height: 34 }}>Agregar</button>
        </form>
        {todosTildados && (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--color-success-bg)', color: 'var(--chip-success-fg)', fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <span>Todas las verificaciones están tildadas.</span>
            <button onClick={() => void onActualizar({ estado: 'HECHO' })} className="ds-hover" style={{ ...btnGhostSm, height: 30 }}>Marcar como hecho</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 10 }}>
        {errorLocal && <ErrorBox msg={errorLocal} />}
        <Field label="Informe (link)" hint="Notion, Google Docs, PR, lo que sea, mientras sea un link.">
          <input
            value={informe}
            onChange={(e) => setInforme(e.target.value)}
            onBlur={() => void guardarTexto()}
            placeholder="https://…"
            className="ds-field"
            style={{ ...inputStyle, height: 36, fontSize: 12.5 }}
          />
        </Field>
        <Field label="Notas">
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            onBlur={() => void guardarTexto()}
            rows={4}
            placeholder="Qué se encontró, qué falta, decisiones…"
            className="ds-field"
            style={{ ...inputStyle, height: 'auto', padding: '9px 13px', fontSize: 12.5, lineHeight: 1.5, resize: 'vertical' }}
          />
        </Field>
        <div style={{ fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.6 }}>
          {guardando && <div>Guardando…</div>}
          <div>Estado: <strong style={{ color: 'var(--color-body)' }}>{estadoLabel}</strong>{item.hechoPor && item.hechoAt && <> · hecho por {item.hechoPor.name} el {dateTime(item.hechoAt)}</>}</div>
          {item.actualizadoPor && <div>Última edición: {item.actualizadoPor.name} · {dateTime(item.updatedAt)}</div>}
        </div>
        {item.esPersonalizado && (
          <div>
            <button onClick={() => setBorrando(true)} className="ds-hover" style={{ ...btnGhostSm, color: 'var(--color-error)', borderColor: 'var(--color-error)' }}>
              <Trash2 size={13} /> Borrar este ítem
            </button>
          </div>
        )}
      </div>

      {borrando && (
        <ConfirmModal
          title={`¿Borrar "${item.titulo}"?`}
          body="Se pierde con sus verificaciones y notas. Solo se pueden borrar los ítems agregados a mano."
          confirmLabel="Borrar"
          onCancel={() => setBorrando(false)}
          onConfirm={async () => { await platformApi.removeAuditItem(item.id); setBorrando(false); onBorrado() }}
        />
      )}
    </div>
  )
}

// ─── Piezas chicas ────────────────────────────────────────────────────────────

function SelectorEstado({ valor, onChange }: { valor: AuditEstado; onChange: (e: AuditEstado) => void }) {
  const actual = ESTADOS.find((e) => e.id === valor) ?? ESTADOS[0]
  const colores = { gray: { bg: 'var(--color-surface-alt)', fg: 'var(--color-muted)' }, amber: { bg: 'var(--color-warning-bg)', fg: 'var(--chip-warning-fg)' }, green: { bg: 'var(--color-success-bg)', fg: 'var(--chip-success-fg)' } }[actual.tone]
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value as AuditEstado)}
      aria-label="Estado"
      className="ds-field au-btn-estado"
      style={{ background: colores.bg, color: colores.fg, borderColor: 'transparent', paddingRight: 26, appearance: 'auto' }}
    >
      {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
    </select>
  )
}

function FiltroToggle({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className="ds-hover au-btn-estado"
      style={activo ? { background: 'var(--color-text)', color: 'var(--color-bg)', borderColor: 'transparent' } : undefined}
    >
      {children}
    </button>
  )
}

function KpiProgreso({ label, valor, pct, hint }: { label: string; valor: string; pct: number; hint: string }) {
  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '14px 16px', boxShadow: 'var(--shadow-card)' }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', marginTop: 4 }}>{valor}</div>
      <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ height: 6, borderRadius: 999, background: 'var(--color-surface-alt)', overflow: 'hidden', margin: '8px 0 6px' }}>
        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: 'var(--color-primary)', transition: 'width 250ms ease' }} />
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>{hint}</div>
    </div>
  )
}

function KpiSimple({ label, valor, hint, tone }: { label: string; valor: string; hint: string; tone: 'amber' | 'red' | 'green' }) {
  const color = { amber: '#D97706', red: 'var(--color-error)', green: '#059669' }[tone]
  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '14px 16px', boxShadow: 'var(--shadow-card)' }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: valor === '0' ? 'var(--color-text)' : color, letterSpacing: '-0.02em', marginTop: 4 }}>{valor}</div>
      <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 6 }}>{hint}</div>
    </div>
  )
}

// El resumen lo calcula el backend al listar; después de editar una fila se
// recalcula acá para no esperar al próximo refresco. Misma cuenta que
// PlatformAuditService.resumir.
function resumirLocal(items: AuditItemRow[]): AuditListado['resumen'] {
  const porArea: AuditListado['resumen']['porArea'] = {}
  let hechos = 0, enCurso = 0, sinResponsable = 0, hallazgosAbiertos = 0
  for (const it of items) {
    const a = (porArea[it.area] ??= { total: 0, hechos: 0, enCurso: 0 })
    a.total += 1
    if (it.estado === 'HECHO') { hechos += 1; a.hechos += 1 }
    if (it.estado === 'EN_CURSO') { enCurso += 1; a.enCurso += 1 }
    if (!it.responsable && it.estado !== 'HECHO') sinResponsable += 1
    if (it.area === 'HALLAZGO' && it.estado !== 'HECHO' && it.severidad !== 'INFO') hallazgosAbiertos += 1
  }
  return { total: items.length, hechos, enCurso, pendientes: items.length - hechos - enCurso, sinResponsable, hallazgosAbiertos, porArea }
}

// ─── Alta de un ítem a mano ───────────────────────────────────────────────────

function CrearItemModal({ grupos, onClose, onCreado }: { grupos: string[]; onClose: () => void; onCreado: () => void }) {
  const [area, setArea] = useState<AuditArea>('BACKEND')
  const [grupo, setGrupo] = useState(grupos[0] ?? '')
  const [titulo, setTitulo] = useState('')
  const [ruta, setRuta] = useState('')
  const [foco, setFoco] = useState('')
  const [severidad, setSeveridad] = useState<AuditSeveridad | ''>('')
  const [checks, setChecks] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const lista = checks.split('\n').map((s) => s.trim()).filter((s) => s.length >= 3)
    if (!titulo.trim() || !grupo.trim() || !foco.trim()) { setError('Completá grupo, título y qué hay que mirar.'); return }
    if (lista.length === 0) { setError('Sumá al menos una verificación (una por línea).'); return }
    setError('')
    setGuardando(true)
    try {
      const input: CreateAuditItemInput = {
        area, grupo: grupo.trim(), titulo: titulo.trim(), ruta: ruta.trim() || null, foco: foco.trim(),
        severidad: area === 'HALLAZGO' && severidad ? severidad : null, checks: lista,
      }
      await platformApi.createAuditItem(input)
      onCreado()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear.')
      setGuardando(false)
    }
  }

  return (
    <ModalShell onClose={onClose} title="Agregar ítem a la auditoría">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBox msg={error} />}
        <Field label="Área">
          <select value={area} onChange={(e) => setArea(e.target.value as AuditArea)} className="ds-field" style={inputStyle}>
            {AREAS.filter((a) => a.id !== 'TODO').map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </Field>
        <Field label="Grupo" hint="Elegí uno existente o escribí uno nuevo.">
          <input list="au-grupos" value={grupo} onChange={(e) => setGrupo(e.target.value)} className="ds-field" style={inputStyle} />
          <datalist id="au-grupos">{grupos.map((g) => <option key={g} value={g} />)}</datalist>
        </Field>
        <Field label="Título">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="ds-field" style={inputStyle} />
        </Field>
        <Field label="Ruta (opcional)">
          <input value={ruta} onChange={(e) => setRuta(e.target.value)} placeholder="apps/api/src/…" className="ds-field" style={inputStyle} />
        </Field>
        {area === 'HALLAZGO' && (
          <Field label="Severidad">
            <select value={severidad} onChange={(e) => setSeveridad(e.target.value as AuditSeveridad | '')} className="ds-field" style={inputStyle}>
              <option value="">Sin severidad</option>
              {(Object.keys(SEVERIDAD) as AuditSeveridad[]).map((s) => <option key={s} value={s}>{SEVERIDAD[s].label}</option>)}
            </select>
          </Field>
        )}
        <Field label="Qué hay que mirar">
          <textarea value={foco} onChange={(e) => setFoco(e.target.value)} rows={3} className="ds-field" style={{ ...inputStyle, height: 'auto', padding: '9px 13px', lineHeight: 1.5, resize: 'vertical' }} />
        </Field>
        <Field label="Verificaciones" hint="Una por línea.">
          <textarea value={checks} onChange={(e) => setChecks(e.target.value)} rows={4} className="ds-field" style={{ ...inputStyle, height: 'auto', padding: '9px 13px', lineHeight: 1.5, resize: 'vertical' }} />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <button type="button" onClick={onClose} className="ds-hover" style={btnGhost}>Cancelar</button>
          <button type="submit" disabled={guardando} className="ds-hover" style={btnPrimary}>{guardando ? 'Creando…' : 'Crear'}</button>
        </div>
      </form>
    </ModalShell>
  )
}
