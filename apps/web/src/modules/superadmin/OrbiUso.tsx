import { Fragment, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, MessageSquareText, ShieldAlert, SlidersHorizontal } from 'lucide-react'
import {
  platformApi, type OrbiConversacionAbierta, type OrbiFichaTurno, type OrbiMotivoDeLectura, type OrbiUsoNegocio, type OrbiUsoResumen,
} from '@/lib/platform/api'
import {
  useFetch, Card, Kpi, Grid, Row2, Table, PageHeader, Loader, ErrorBox, Empty, ModalShell, Field, Pill,
  btnGhost, btnGhostSm, btnPrimary, inputStyle, dateTime,
} from './ui'
import { LineSeriesChart } from './charts'
import {
  usd, usdEje, tokens, ms, pct, etiquetaDeTools, mesesRecientes, mesActualArgentina, etiquetaDeMes, porcentajeDe,
  excedido, leerCreditos, pasosDe, contextoDe, estadoDelTurno, puntosDeSerie,
} from './orbiUsoFormato'

// Orbi → Uso (apex orbita.site/superadmin?seccion=orbi, pestaña Uso). Cuánto
// se usó Orbi en el mes y cuánto costó: por acción, por negocio, por miembro y
// por mensaje. Solo superadmin (el backend lo exige): acá se ven USD, tokens y
// créditos, que el panel del negocio nunca ve (solo porcentajes).

const mono: React.CSSProperties = { fontFamily: '"Geist Mono", monospace', fontVariantNumeric: 'tabular-nums' }
const linkBtn: React.CSSProperties = {
  border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 'inherit', fontWeight: 600, color: 'var(--color-primary)', textAlign: 'left',
}
const aviso: React.CSSProperties = {
  display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12,
  background: 'var(--color-warning-bg)', color: 'var(--chip-warning-fg)', fontSize: 13, fontWeight: 500, lineHeight: 1.5,
}
const ayudaTexto: React.CSSProperties = { fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.45 }

export function OrbiUso() {
  // Los meses se cuentan en hora argentina, igual que el backend.
  const [meses] = useState(() => mesesRecientes(mesActualArgentina(new Date())))
  const [mes, setMes] = useState(meses[0])
  const [negocio, setNegocio] = useState<{ id: string; nombre: string } | null>(null)
  const [tick, setTick] = useState(0)
  const { data, error, status, loading } = useFetch(() => platformApi.orbiUso(mes), [mes, tick])

  const selectorDeMes = (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
      Mes
      <select value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inputStyle, height: 38 }}>
        {meses.map((m) => <option key={m} value={m}>{etiquetaDeMes(m)}</option>)}
      </select>
    </label>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Uso de Orbi"
        subtitle="Mensajes, costo y créditos del mes: por acción, por negocio, por miembro y por mensaje. Los días y los meses van en hora argentina."
        action={selectorDeMes}
      />

      {negocio ? (
        <DetalleDeNegocio
          businessId={negocio.id}
          nombre={negocio.nombre}
          mes={mes}
          lecturaHabilitada={data?.lecturaHabilitada ?? false}
          onVolver={() => setNegocio(null)}
        />
      ) : loading && !data ? (
        <Loader />
      ) : error || !data ? (
        <ErrorBox
          // Los operadores ven la pestaña Orbi (Estado), pero el uso es solo del
          // superadmin (@SoloSuperadmin en la API): un 403 no es una caída.
          msg={status === 403
            ? 'Solo un super administrador puede ver el uso de Orbi.'
            : status === 404
              ? 'La API desplegada todavía no tiene el uso de Orbi: falta desplegar el backend.'
              : 'No se pudo cargar el uso de Orbi.'}
          action={<button type="button" className="ds-hover" style={btnGhost} onClick={() => setTick((k) => k + 1)}>Reintentar</button>}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, opacity: loading ? 0.55 : 1, transition: 'opacity 200ms ease' }} aria-busy={loading}>
          <Resumen data={data} onNegocio={(id, nombre) => setNegocio({ id, nombre })} cargando={loading} />
        </div>
      )}
    </div>
  )
}

// ─── Resumen del mes ──────────────────────────────────────────────────────────

function Resumen({ data, onNegocio, cargando }: {
  data: OrbiUsoResumen
  onNegocio: (id: string, nombre: string) => void
  cargando: boolean
}) {
  const k = data.kpis
  const puntos = puntosDeSerie(data.serie)
  return (
    <>
      <Grid small>
        <Kpi label="Mensajes" value={tokens(k.mensajes)} />
        <Kpi label="Costo" value={usd(k.costoUsd)} accent />
        <Kpi label="Créditos" value={tokens(k.creditos)} />
        <Kpi label="Tokens de entrada" value={tokens(k.promptTokens)} hint={`${pct(porcentajeDe(k.cachedTokens, k.promptTokens))} desde la caché`} />
        <Kpi label="Tokens de salida" value={tokens(k.completionTokens)} hint={`${pct(porcentajeDe(k.thinkingTokens, k.completionTokens))} de pensamiento`} />
        <Kpi label="Latencia (mediana)" value={ms(k.latenciaP50)} hint={`p95: ${ms(k.latenciaP95)} · sin los frenados por cupo`} />
        <Kpi label="Primer token (mediana)" value={ms(k.ttftP50)} hint="Hasta que se empieza a ver la respuesta" />
        <Kpi label="Errores" value={tokens(k.errores)} hint={`${pct(porcentajeDe(k.errores, k.mensajes))} de los mensajes`} />
        <Kpi label="Frenados por cupo mensual" value={tokens(k.frenadosPorCupoMensual)} hint="Sin créditos del mes (negocio o miembro). No llegaron al modelo" />
        <Kpi label="Frenados por tope diario" value={tokens(k.frenadosPorTopeDiario)} hint="Pasaron los mensajes por día del negocio. No llegaron al modelo" />
        <Kpi label="Con Groq" value={tokens(k.conGroq)} hint="Gemini falló y respondió el respaldo en alguna vuelta" />
        <Kpi
          label="Acciones propuestas"
          value={tokens(k.accionesPropuestas)}
          hint={`${tokens(k.accionesConfirmadas)} confirmadas · ${tokens(k.accionesRechazadas)} rechazadas`}
        />
        <Kpi label="Escrituras rechazadas" value={tokens(k.escriturasRechazadas)} hint="El modelo las pidió y no se pudieron proponer (permiso, demo, datos)" />
      </Grid>

      <Row2>
        <Card title="Mensajes por día">
          {puntos.length === 0 ? <Empty text="Sin mensajes este mes." /> : (
            <LineSeriesChart data={puntos} series={[{ key: 'mensajes', label: 'Mensajes' }]} cargando={cargando} />
          )}
        </Card>
        <Card title="Costo por día (USD)">
          {puntos.length === 0 ? <Empty text="Sin mensajes este mes." /> : (
            <LineSeriesChart data={puntos} series={[{ key: 'costo', label: 'Costo' }]} formatValue={(n) => usd(n)} formatTick={usdEje} cargando={cargando} />
          )}
        </Card>
      </Row2>

      <Card
        title="Qué cuesta cada acción"
        subtitle="Mensajes agrupados por la combinación de tools que usaron · las 20 más caras del mes · sin los frenados por cupo"
        noPad
      >
        <Table
          head={['Tools', 'Mensajes', 'Costo promedio', 'Costo total', 'Entrada promedio', 'Latencia promedio']}
          alignRight={[1, 2, 3, 4, 5]}
          rows={data.acciones.map((a) => ({
            key: a.tools,
            cells: [
              <span key="t" style={{ ...mono, fontSize: 12.5, wordBreak: 'break-word' }}>{etiquetaDeTools(a.tools)}</span>,
              <span key="m" style={mono}>{tokens(a.mensajes)}</span>,
              <span key="cp" style={mono}>{usd(a.costoPromedioUsd)}</span>,
              <span key="ct" style={{ ...mono, fontWeight: 700, color: 'var(--color-text)' }}>{usd(a.costoTotalUsd)}</span>,
              <span key="e" style={mono}>{tokens(Math.round(a.entradaPromedio))}</span>,
              <span key="l" style={mono}>{ms(a.latenciaPromedio)}</span>,
            ],
          }))}
        />
      </Card>

      <Card title="Negocios" subtitle="Los 50 que más gastaron en el mes · elegí uno para ver su cupo, sus miembros y sus mensajes" noPad>
        <Table
          head={['Negocio', 'Mensajes', 'Costo', 'Créditos', '% del cupo']}
          alignRight={[1, 2, 3, 4]}
          rows={data.negocios.map((n) => ({
            key: n.businessId,
            onClick: () => onNegocio(n.businessId, n.nombre),
            cells: [
              <button key="n" type="button" style={linkBtn} onClick={(e) => { e.stopPropagation(); onNegocio(n.businessId, n.nombre) }}>
                {n.nombre}
              </button>,
              <span key="m" style={mono}>{tokens(n.mensajes)}</span>,
              <span key="c" style={mono}>{usd(n.costoUsd)}</span>,
              <span key="cr" style={mono}>{tokens(n.creditos)} <span style={{ color: 'var(--color-muted)' }}>/ {tokens(n.cupo)}</span></span>,
              <PorcentajeDelCupo key="p" porcentaje={n.porcentaje} />,
            ],
          }))}
        />
      </Card>
    </>
  )
}

// Rojo desde el 100 %, y además con la palabra: el color nunca va solo.
function PorcentajeDelCupo({ porcentaje }: { porcentaje: number }) {
  const pasado = excedido(porcentaje)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
      {pasado && <Pill text="Cupo agotado" tone="red" />}
      <span style={{ ...mono, fontWeight: pasado ? 700 : 500, color: pasado ? 'var(--color-error)' : 'var(--color-body)' }}>{pct(porcentaje)}</span>
    </span>
  )
}

// ─── Detalle de un negocio ────────────────────────────────────────────────────

function DetalleDeNegocio({ businessId, nombre, mes, lecturaHabilitada, onVolver }: {
  businessId: string
  nombre: string
  mes: string
  lecturaHabilitada: boolean
  onVolver: () => void
}) {
  const [tick, setTick] = useState(0)
  const { data, error, loading } = useFetch(() => platformApi.orbiUsoNegocio(businessId, mes), [businessId, mes, tick])
  const [ajustando, setAjustando] = useState(false)
  const [miembro, setMiembro] = useState<{ id: string; nombre: string } | null>(null)
  const fichasRef = useRef<HTMLDivElement>(null)

  function filtrarPorMiembro(id: string, nombreMiembro: string) {
    setMiembro({ id, nombre: nombreMiembro })
    fichasRef.current?.scrollIntoView({ block: 'start' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button type="button" onClick={onVolver} className="ds-hover" style={btnGhostSm}>
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden /> Todos los negocios
        </button>
        <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: 'var(--color-text)' }}>{data?.nombre ?? nombre}</h3>
        <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>{etiquetaDeMes(mes)}</span>
      </div>

      {loading && !data ? <Loader /> : error || !data ? (
        <ErrorBox
          msg="No se pudo cargar el detalle del negocio."
          action={<button type="button" className="ds-hover" style={btnGhost} onClick={() => setTick((k) => k + 1)}>Reintentar</button>}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, opacity: loading ? 0.55 : 1, transition: 'opacity 200ms ease' }} aria-busy={loading}>
          <Cupo data={data} onAjustar={() => setAjustando(true)} />

          <Card title="Ajustes de cupo del mes" subtitle="Créditos sumados o restados a mano por un superadmin" noPad>
            {data.ajustes.length === 0 ? <Empty text="Sin ajustes este mes." /> : (
              <Table
                head={['Fecha', 'Créditos', 'Motivo', 'Quién']}
                alignRight={[1]}
                rows={data.ajustes.map((a) => ({
                  key: a.id,
                  cells: [
                    dateTime(a.fecha),
                    <span key="c" style={{ ...mono, fontWeight: 700, color: 'var(--color-text)' }}>{a.creditos > 0 ? `+${tokens(a.creditos)}` : tokens(a.creditos)}</span>,
                    <span key="m" style={{ wordBreak: 'break-word' }}>{a.motivo}</span>,
                    a.admin,
                  ],
                }))}
              />
            )}
          </Card>

          <Card title="Miembros" subtitle="Elegí uno para ver solo sus mensajes" noPad>
            {data.miembros.length === 0 ? <Empty text="Nadie usó Orbi en este negocio este mes." /> : (
              <Table
                head={['Miembro', 'Mensajes', 'Créditos', 'Costo', 'Entrada', 'Salida', 'Latencia (mediana)', 'Tope propio']}
                alignRight={[1, 2, 3, 4, 5, 6, 7]}
                rows={data.miembros.map((m) => ({
                  key: m.memberId,
                  onClick: () => filtrarPorMiembro(m.memberId, m.nombre),
                  cells: [
                    <button
                      key="n" type="button" style={linkBtn} aria-pressed={miembro?.id === m.memberId}
                      onClick={(e) => { e.stopPropagation(); filtrarPorMiembro(m.memberId, m.nombre) }}
                    >
                      {m.nombre}{miembro?.id === m.memberId ? ' (filtrando)' : ''}
                    </button>,
                    <span key="me" style={mono}>{tokens(m.mensajes)}</span>,
                    <span key="cr" style={mono}>{tokens(m.creditos)}</span>,
                    <span key="c" style={mono}>{usd(m.costoUsd)}</span>,
                    <span key="e" style={mono}>{tokens(m.promptTokens)}</span>,
                    <span key="s" style={mono}>{tokens(m.completionTokens)}</span>,
                    <span key="l" style={mono}>{ms(m.latenciaP50)}</span>,
                    m.topePorcentaje == null ? <span key="t" style={{ color: 'var(--color-muted)' }}>Sin tope</span> : <span key="t" style={mono}>{m.topePorcentaje} %</span>,
                  ],
                }))}
              />
            )}
          </Card>

          <div ref={fichasRef} style={{ scrollMarginTop: 16 }}>
            <Fichas
              businessId={businessId}
              mes={mes}
              miembro={miembro}
              onTodos={() => setMiembro(null)}
              lecturaHabilitada={lecturaHabilitada}
            />
          </div>
        </div>
      )}

      {ajustando && data && (
        <AjustarCupo
          negocio={data}
          onCerrar={() => setAjustando(false)}
          onHecho={() => { setAjustando(false); setTick((k) => k + 1) }}
        />
      )}
    </div>
  )
}

function Cupo({ data, onAjustar }: { data: OrbiUsoNegocio; onAjustar: () => void }) {
  const { cupo } = data
  return (
    <Card
      title="Cupo del mes"
      subtitle={cupo.avanzado ? 'Con el paquete Avanzado' : 'Plan base, sin el paquete Avanzado'}
      action={
        <button type="button" className="ds-hover" style={btnPrimary} onClick={onAjustar}>
          <SlidersHorizontal size={15} aria-hidden /> Ajustar cupo
        </button>
      }
    >
      <Grid small>
        <Kpi label="Usados" value={tokens(data.usados)} hint={`de ${tokens(cupo.total)} créditos`} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Kpi label="% del cupo" value={pct(data.porcentaje)} />
          {excedido(data.porcentaje) && <span><Pill text="Cupo agotado" tone="red" /></span>}
        </div>
        <Kpi label="Base" value={tokens(cupo.base)} />
        <Kpi label="Ajustes" value={cupo.ajustes > 0 ? `+${tokens(cupo.ajustes)}` : tokens(cupo.ajustes)} />
        <Kpi label="Total" value={tokens(cupo.total)} accent />
      </Grid>
    </Card>
  )
}

// ─── Fichas de mensajes ───────────────────────────────────────────────────────

// Primera página por efecto y las siguientes con "Ver más". Cada página guarda
// la clave del filtro con el que se pidió: `cargando` sale de comparar esa clave
// con la actual (sin setState dentro del efecto), y una respuesta que llega
// tarde de otro filtro se descarta.
interface PaginaDeFichas { clave: string; turnos: OrbiFichaTurno[]; siguiente: string | null; error: string }

function useFichas(businessId: string, mes: string, memberId: string | null) {
  const [intento, setIntento] = useState(0)
  const [pagina, setPagina] = useState<PaginaDeFichas | null>(null)
  const [cargandoMas, setCargandoMas] = useState(false)
  const clave = `${businessId}|${mes}|${memberId ?? ''}|${intento}`

  useEffect(() => {
    let cancelado = false
    platformApi.orbiUsoTurnos({ businessId, mes, memberId: memberId ?? undefined })
      .then((r) => { if (!cancelado) setPagina({ clave, turnos: r.turnos, siguiente: r.siguiente, error: '' }) })
      .catch(() => { if (!cancelado) setPagina({ clave, turnos: [], siguiente: null, error: 'No se pudieron cargar los mensajes.' }) })
    return () => { cancelado = true }
  }, [businessId, mes, memberId, clave])

  const vigente = pagina?.clave === clave ? pagina : null

  async function verMas() {
    if (!vigente?.siguiente) return
    const pedida = vigente.clave
    setCargandoMas(true)
    try {
      const r = await platformApi.orbiUsoTurnos({ businessId, mes, memberId: memberId ?? undefined, antesDe: vigente.siguiente })
      setPagina((p) => {
        if (!p || p.clave !== pedida) return p
        const vistos = new Set(p.turnos.map((t) => t.id))
        return { ...p, turnos: [...p.turnos, ...r.turnos.filter((t) => !vistos.has(t.id))], siguiente: r.siguiente, error: '' }
      })
    } catch {
      setPagina((p) => (p && p.clave === pedida ? { ...p, error: 'No se pudieron cargar más mensajes.' } : p))
    } finally {
      setCargandoMas(false)
    }
  }

  return {
    turnos: vigente?.turnos ?? [],
    siguiente: vigente?.siguiente ?? null,
    cargando: vigente === null,
    cargandoMas,
    error: vigente?.error ?? '',
    verMas,
    reintentar: () => setIntento((n) => n + 1),
  }
}

const th: React.CSSProperties = {
  padding: '11px 12px', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', background: 'var(--color-surface)',
  whiteSpace: 'nowrap', borderBottom: '1px solid var(--color-border)', textAlign: 'right',
}
const td: React.CSSProperties = { padding: '11px 12px', color: 'var(--color-body)', verticalAlign: 'middle', lineHeight: 1.45, textAlign: 'right', whiteSpace: 'nowrap' }
const COLUMNAS_FICHA = ['Fecha', 'Miembro', 'Pantalla', 'Tools', 'Vueltas', 'Entrada', 'Caché', 'Salida', 'Pensamiento', 'Primer token', 'Total', 'Costo', 'Estado']
const A_LA_IZQUIERDA = new Set(['Fecha', 'Miembro', 'Pantalla', 'Tools', 'Estado'])

function Fichas({ businessId, mes, miembro, onTodos, lecturaHabilitada }: {
  businessId: string
  mes: string
  miembro: { id: string; nombre: string } | null
  onTodos: () => void
  lecturaHabilitada: boolean
}) {
  const f = useFichas(businessId, mes, miembro?.id ?? null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [leyendo, setLeyendo] = useState<string | null>(null)

  return (
    <Card
      title="Mensajes"
      subtitle={`${miembro ? `Solo de ${miembro.nombre}` : 'De todos los miembros'} · del más nuevo al más viejo · abrí uno para ver sus vueltas al modelo`}
      action={miembro ? <button type="button" className="ds-hover" style={btnGhostSm} onClick={onTodos}>Ver de todos</button> : undefined}
      noPad
    >
      {f.cargando ? <Loader /> : f.error && f.turnos.length === 0 ? (
        <div style={{ padding: 18 }}>
          <ErrorBox msg={f.error} action={<button type="button" className="ds-hover" style={btnGhost} onClick={f.reintentar}>Reintentar</button>} />
        </div>
      ) : f.turnos.length === 0 ? <Empty text="Sin mensajes en este mes." /> : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 40 }}><span className="sr-only">Detalle</span></th>
                  {COLUMNAS_FICHA.map((c) => <th key={c} style={{ ...th, textAlign: A_LA_IZQUIERDA.has(c) ? 'left' : 'right' }}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {f.turnos.map((t) => {
                  const expandida = abierta === t.id
                  const estado = estadoDelTurno(t.status)
                  const idDetalle = `ficha-${t.id}`
                  return (
                    <Fragment key={t.id}>
                      <tr style={{ borderBottom: expandida ? 'none' : '1px solid var(--color-border)' }}>
                        <td style={{ ...td, textAlign: 'left', paddingRight: 0 }}>
                          <button
                            type="button"
                            className="ds-hover"
                            aria-expanded={expandida}
                            aria-controls={idDetalle}
                            aria-label={`${expandida ? 'Ocultar' : 'Ver'} el detalle del mensaje del ${dateTime(t.fecha)}`}
                            onClick={() => setAbierta(expandida ? null : t.id)}
                            style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-body)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                          >
                            <ChevronRight size={15} aria-hidden style={{ transform: expandida ? 'rotate(90deg)' : 'none', transition: 'transform 150ms ease' }} />
                          </button>
                        </td>
                        <td style={{ ...td, textAlign: 'left' }}>{dateTime(t.fecha)}</td>
                        <td style={{ ...td, textAlign: 'left' }}>{t.miembro}</td>
                        <td style={{ ...td, textAlign: 'left' }}>{t.section ?? t.module ?? '—'}</td>
                        <td style={{ ...td, textAlign: 'left', whiteSpace: 'normal', minWidth: 160 }}>
                          <span style={{ ...mono, fontSize: 12 }}>{etiquetaDeTools(t.toolsUsed.join(' + '))}</span>
                        </td>
                        <td style={{ ...td, ...mono }}>{t.rounds}</td>
                        <td style={{ ...td, ...mono }}>{tokens(t.promptTokens)}</td>
                        <td style={{ ...td, ...mono }}>{tokens(t.cachedTokens)}</td>
                        <td style={{ ...td, ...mono }}>{tokens(t.completionTokens)}</td>
                        <td style={{ ...td, ...mono }}>{tokens(t.thinkingTokens)}</td>
                        <td style={{ ...td, ...mono }}>{ms(t.ttftMs)}</td>
                        <td style={{ ...td, ...mono }}>{ms(t.latencyMs)}</td>
                        <td style={{ ...td, ...mono, fontWeight: 700, color: 'var(--color-text)' }}>{usd(t.costUsd)}</td>
                        <td style={{ ...td, textAlign: 'left' }}><Pill text={estado.label} tone={estado.tone} /></td>
                      </tr>
                      {expandida && (
                        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td colSpan={COLUMNAS_FICHA.length + 1} id={idDetalle} style={{ padding: '4px 18px 18px', background: 'var(--color-surface)' }}>
                            <DetalleDeFicha t={t} lecturaHabilitada={lecturaHabilitada} onAbrirConversacion={setLeyendo} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 18px' }}>
            <span style={ayudaTexto}>{tokens(f.turnos.length)} mensajes cargados{f.siguiente ? '' : ' · no hay más en este mes'}</span>
            {f.siguiente && (
              <button type="button" className="ds-hover" style={{ ...btnGhost, opacity: f.cargandoMas ? 0.7 : 1 }} disabled={f.cargandoMas} onClick={() => void f.verMas()}>
                {f.cargandoMas ? 'Cargando…' : 'Ver más'}
              </button>
            )}
          </div>
          {f.error && <div style={{ padding: '0 18px 18px' }}><ErrorBox msg={f.error} /></div>}
        </>
      )}

      {leyendo && <AbrirConversacion conversationId={leyendo} onCerrar={() => setLeyendo(null)} />}
    </Card>
  )
}

const TIPO_DE_TOOL: Record<string, string> = { lectura: 'Lectura', propuesta: 'Propuesta', rechazada: 'Rechazada' }

function DetalleDeFicha({ t, lecturaHabilitada, onAbrirConversacion }: {
  t: OrbiFichaTurno
  lecturaHabilitada: boolean
  onAbrirConversacion: (conversationId: string) => void
}) {
  const pasos = pasosDe(t.steps)
  const contexto = contextoDe(t.contextChars)
  const motivoDeshabilitado = 'conv-deshabilitada-' + t.id
  const dato = (label: string, valor: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 11.5, color: 'var(--color-muted)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--color-text)', ...mono, wordBreak: 'break-word', whiteSpace: 'normal' }}>{valor}</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 12, whiteSpace: 'normal', textAlign: 'left' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        {dato('Modelo', t.model ?? '—')}
        {dato('Proveedor', t.provider ?? '—')}
        {dato('Módulo', t.module ?? '—')}
        {dato('Créditos', tokens(t.credits))}
        {dato('Costo de tools', usd(t.toolsCostUsd))}
        {dato('Acciones', `${t.actionsProposed} propuestas · ${t.actionsConfirmed} confirmadas · ${t.actionsRejected} rechazadas`)}
        {dato('Escrituras rechazadas', t.writesRejected)}
        {t.errorCategory && dato('Tipo de error', t.errorCategory)}
      </div>

      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>Contexto de la primera vuelta (caracteres)</div>
        {contexto ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
            {dato('Instrucciones', tokens(contexto.system))}
            {dato('Tools', tokens(contexto.tools))}
            {dato('Historial', tokens(contexto.history))}
            {dato('Mensaje', tokens(contexto.message))}
            {dato('Total', tokens(contexto.system + contexto.tools + contexto.history + contexto.message))}
          </div>
        ) : <span style={ayudaTexto}>Este mensaje no tiene el tamaño del contexto guardado.</span>}
      </div>

      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>Vueltas al modelo</div>
        {pasos.length === 0 ? <span style={ayudaTexto}>Este mensaje no tiene las vueltas guardadas.</span> : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-bg)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr>
                  {['#', 'Proveedor · modelo', 'Entrada', 'Caché', 'Salida', 'Pensamiento', 'Duración', 'Tools'].map((h, i) => (
                    <th key={h} style={{ ...th, padding: '8px 10px', textAlign: i === 0 || i === 1 || i === 7 ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pasos.map((p) => (
                  <tr key={p.n} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td style={{ ...td, ...mono, padding: '8px 10px', textAlign: 'left' }}>{p.n}</td>
                    <td style={{ ...td, padding: '8px 10px', textAlign: 'left' }}>{[p.provider, p.model].filter(Boolean).join(' · ') || '—'}</td>
                    <td style={{ ...td, ...mono, padding: '8px 10px' }}>{tokens(p.promptTokens)}</td>
                    <td style={{ ...td, ...mono, padding: '8px 10px' }}>{tokens(p.cachedTokens)}</td>
                    <td style={{ ...td, ...mono, padding: '8px 10px' }}>{tokens(p.completionTokens)}</td>
                    <td style={{ ...td, ...mono, padding: '8px 10px' }}>{tokens(p.thinkingTokens)}</td>
                    <td style={{ ...td, ...mono, padding: '8px 10px' }}>{ms(p.ms)}</td>
                    <td style={{ ...td, padding: '8px 10px', textAlign: 'left', whiteSpace: 'normal', minWidth: 200 }}>
                      {p.tools.length === 0 ? <span style={{ color: 'var(--color-muted)' }}>Sin tools</span> : (
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {p.tools.map((tool, i) => (
                            <li key={`${tool.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ ...mono, fontSize: 12 }}>{tool.name}</span>
                              <Pill text={TIPO_DE_TOOL[tool.tipo] ?? tool.tipo} tone={tool.tipo === 'rechazada' ? 'amber' : tool.tipo === 'propuesta' ? 'violet' : 'gray'} />
                              <span style={{ ...mono, fontSize: 12, color: 'var(--color-muted)' }}>{ms(tool.ms)}</span>
                              {!tool.ok && <Pill text="Falló" tone="red" />}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {t.conversationId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={lecturaHabilitada ? 'ds-hover' : undefined}
            style={{ ...btnGhost, ...(lecturaHabilitada ? {} : { opacity: 0.55, cursor: 'not-allowed' }) }}
            disabled={!lecturaHabilitada}
            aria-describedby={lecturaHabilitada ? undefined : motivoDeshabilitado}
            onClick={() => t.conversationId && onAbrirConversacion(t.conversationId)}
          >
            <MessageSquareText size={15} aria-hidden /> Abrir conversación
          </button>
          {!lecturaHabilitada && (
            <span id={motivoDeshabilitado} style={ayudaTexto}>Deshabilitado hasta actualizar la política de privacidad</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Modales ──────────────────────────────────────────────────────────────────

function AjustarCupo({ negocio, onCerrar, onHecho }: { negocio: OrbiUsoNegocio; onCerrar: () => void; onHecho: () => void }) {
  const [creditosTexto, setCreditosTexto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const creditos = leerCreditos(creditosTexto)
  const motivoLimpio = motivo.trim()
  // Mismas reglas que AjusteCupoDto (entero, motivo de 5 a 300 caracteres).
  const falta = creditos === null
    ? 'Escribí cuántos créditos sumar (ej. 500) o restar (ej. -200). Tiene que ser un número entero distinto de cero.'
    : motivoLimpio.length < 5
      ? 'Escribí el motivo (al menos 5 caracteres).'
      : null
  const totalNuevo = creditos === null ? null : Math.max(0, negocio.cupo.total + creditos)

  async function confirmar() {
    if (creditos === null || falta) return
    setEnviando(true)
    setError('')
    try {
      await platformApi.orbiAjustarCupo({ businessId: negocio.businessId, mes: negocio.mes, creditos, motivo: motivoLimpio })
      onHecho()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo ajustar el cupo.')
      setEnviando(false)
    }
  }

  return (
    <ModalShell title={`Ajustar cupo de ${negocio.nombre}`} onClose={onCerrar}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.55 }}>
          Suma o resta créditos al cupo de <strong>{etiquetaDeMes(negocio.mes)}</strong>. Hoy el cupo es de {tokens(negocio.cupo.total)} créditos y van usados {tokens(negocio.usados)}.
        </p>
        <Field label="Créditos" hint="Positivo suma, negativo resta. Solo vale para este mes.">
          <input
            style={inputStyle}
            inputMode="numeric"
            value={creditosTexto}
            onChange={(e) => setCreditosTexto(e.target.value)}
            placeholder="Ej.: 500 o -200"
            aria-invalid={creditosTexto !== '' && creditos === null}
          />
        </Field>
        {totalNuevo !== null && (
          <div role="status" style={{ fontSize: 13, color: 'var(--color-body)' }}>
            El cupo del mes pasa de <strong style={mono}>{tokens(negocio.cupo.total)}</strong> a <strong style={mono}>{tokens(totalNuevo)}</strong> créditos.
          </div>
        )}
        <Field label="Motivo" hint={`Queda en el registro junto al ajuste. ${motivoLimpio.length}/300`}>
          <textarea
            style={{ ...inputStyle, height: 84, padding: '10px 13px', resize: 'vertical', lineHeight: 1.45 }}
            value={motivo}
            maxLength={300}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej.: compensación por la caída del 2/10"
          />
        </Field>
        <div style={aviso}>
          <ShieldAlert size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          <span>Queda registrado con tu nombre, la fecha, los créditos y el motivo.</span>
        </div>
        {error && <ErrorBox msg={error} />}
        {falta && <span style={ayudaTexto}>{falta}</span>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="ds-hover" style={btnGhost} onClick={onCerrar}>Cancelar</button>
          <button
            type="button"
            className="ds-hover"
            disabled={!!falta || enviando}
            title={falta ?? undefined}
            style={{ ...btnPrimary, opacity: falta || enviando ? 0.55 : 1, cursor: falta ? 'not-allowed' : 'pointer' }}
            onClick={() => void confirmar()}
          >
            {enviando ? 'Ajustando…' : 'Ajustar cupo'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

const MOTIVOS_DE_LECTURA: { value: OrbiMotivoDeLectura; label: string; ayuda: string }[] = [
  { value: 'soporte', label: 'Soporte', ayuda: 'El negocio pidió ayuda con algo que pasó en esta conversación.' },
  { value: 'abuso', label: 'Abuso', ayuda: 'Hay indicios de uso indebido de Orbi.' },
  { value: 'calidad', label: 'Calidad', ayuda: 'Revisar una respuesta de Orbi que salió mal.' },
]

function AbrirConversacion({ conversationId, onCerrar }: { conversationId: string; onCerrar: () => void }) {
  const [motivo, setMotivo] = useState<OrbiMotivoDeLectura | null>(null)
  const [detalle, setDetalle] = useState('')
  const [ticket, setTicket] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [conversacion, setConversacion] = useState<OrbiConversacionAbierta | null>(null)

  const detalleLimpio = detalle.trim()
  // Mismas reglas que AbrirConversacionDto: motivo, detalle de 10 a 500 (recortado), ticket hasta 100.
  const falta = !motivo
    ? 'Elegí el motivo.'
    : detalleLimpio.length < 10
      ? `Contá por qué la abrís (al menos 10 caracteres, van ${detalleLimpio.length}).`
      : null

  async function confirmar() {
    if (!motivo || falta) return
    setEnviando(true)
    setError('')
    try {
      const r = await platformApi.orbiAbrirConversacion(conversationId, { motivo, detalle: detalleLimpio, ticket: ticket.trim() || undefined })
      setConversacion(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir la conversación.')
    } finally {
      setEnviando(false)
    }
  }

  if (conversacion) {
    return (
      <ModalShell title={conversacion.titulo ?? 'Conversación con Orbi'} onClose={onCerrar}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={ayudaTexto}>El texto sale redactado: emails, teléfonos, documentos y tarjetas aparecen tapados. Tu lectura ya quedó registrada.</span>
          {conversacion.mensajes.length === 0 ? <Empty text="La conversación no tiene mensajes de texto." /> : (
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {conversacion.mensajes.map((m, i) => (
                <li
                  key={i}
                  style={{
                    padding: '10px 12px', borderRadius: 12, border: '1px solid var(--color-border)',
                    background: m.rol === 'user' ? 'var(--color-surface)' : 'var(--color-bg)',
                    marginLeft: m.rol === 'user' ? 24 : 0, marginRight: m.rol === 'user' ? 0 : 24,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 4 }}>
                    <span>{m.rol === 'user' ? 'Persona del negocio' : 'Orbi'}</span>
                    {m.fecha && <span>{dateTime(m.fecha)}</span>}
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--color-text)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.texto}</div>
                </li>
              ))}
            </ol>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="ds-hover" style={btnGhost} onClick={onCerrar}>Cerrar</button>
          </div>
        </div>
      </ModalShell>
    )
  }

  return (
    <ModalShell title="Abrir conversación" onClose={onCerrar}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8, padding: 0 }}>Motivo</legend>
          {MOTIVOS_DE_LECTURA.map((m) => (
            <label key={m.value} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: 13.5, color: 'var(--color-text)' }}>
              <input type="radio" name="motivo-lectura" value={m.value} checked={motivo === m.value} onChange={() => setMotivo(m.value)} style={{ marginTop: 3 }} />
              <span>
                <strong>{m.label}</strong>
                <span style={{ display: 'block', ...ayudaTexto }}>{m.ayuda}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Field label="Detalle" hint={`Por qué esta conversación en concreto. Mínimo 10 caracteres. ${detalleLimpio.length}/500`}>
          <textarea
            style={{ ...inputStyle, height: 84, padding: '10px 13px', resize: 'vertical', lineHeight: 1.45 }}
            value={detalle}
            maxLength={500}
            onChange={(e) => setDetalle(e.target.value)}
            placeholder="Ej.: el negocio reportó que Orbi le cambió un precio que no pidió"
          />
        </Field>
        <Field label="Ticket (opcional)" hint="Número de consulta de soporte o de Jira, si hay.">
          <input style={inputStyle} value={ticket} maxLength={100} onChange={(e) => setTicket(e.target.value)} placeholder="Ej.: RBT-412" />
        </Field>
        <div style={aviso}>
          <ShieldAlert size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          <span>Esta lectura queda registrada con tu nombre, la fecha y el motivo.</span>
        </div>
        {error && <ErrorBox msg={error} />}
        {falta && <span style={ayudaTexto}>{falta}</span>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="ds-hover" style={btnGhost} onClick={onCerrar}>Cancelar</button>
          <button
            type="button"
            className="ds-hover"
            disabled={!!falta || enviando}
            title={falta ?? undefined}
            style={{ ...btnPrimary, opacity: falta || enviando ? 0.55 : 1, cursor: falta ? 'not-allowed' : 'pointer' }}
            onClick={() => void confirmar()}
          >
            {enviando ? 'Abriendo…' : 'Abrir y registrar la lectura'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
