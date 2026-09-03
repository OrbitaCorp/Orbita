// ─── Super panel · pestaña Wizard ────────────────────────────────────────────
//
// Lo que pasa ANTES de que alguien sea cliente. Todo el resto del super panel
// mira negocios que ya existen; acá se mira a la gente que entró a darse de
// alta y —la mayoría— se fue por el camino, sin dejar cuenta, mail ni nombre.
//
// Tres preguntas, tres secciones, en este orden porque así se leen:
//   1. ¿Dónde se cae la gente?      → el embudo
//   2. ¿Qué dato le cuesta?          → el ranking de fricción
//   3. ¿Orbi le sirve a alguien?     → uso y calidad de la IA
//
// Los datos salen de /platform/wizard/* (ver apps/api/src/wizard-analytics).

import { useState } from 'react'
import { AlertTriangle, ThumbsDown, ThumbsUp } from 'lucide-react'
import { platformApi, type WizardFriction, type WizardFieldFriction, type WizardFunnelStep } from '@/lib/platform/api'
import { useFetch, Grid, Card, Kpi, Table, Pill, Loader, ErrorBox, Empty, PageHeader } from './ui'
import { BarDistribution, ChartSkeleton, RangePicker, useRange } from './charts'

// Nombres internos → lo que un humano entiende. Las claves son las de
// STEP_NAMES/campos del wizard (SetupUnificado.tsx).
const PASOS: Record<string, string> = {
  rubro: 'Rubro',
  subrubros: 'Qué ofrece',
  'tu-negocio': 'Tu negocio',
  ubicacion: 'Ubicación',
  cuenta: 'Tu cuenta',
  pago: 'Pago',
}

const CAMPOS: Record<string, string> = {
  nombre: 'Nombre del negocio',
  descripcion: 'Descripción',
  telefono: 'Teléfono',
  subdominio: 'Subdominio',
  direccion: 'Dirección',
  modoVenta: 'Modo de venta',
  tipoLocal: 'Forma de operar',
  ownerName: 'Nombre del dueño',
  email: 'Email',
  password: 'Contraseña',
  terms: 'Términos',
  subrubros: 'Qué ofrece',
}

const TEMAS: Record<string, string> = {
  'no-entiende-un-campo': 'No entiende un campo',
  'pide-ideas-de-nombre-o-descripcion': 'Pide ideas de nombre/descripción',
  'duda-de-precio-o-plan': 'Duda de precio o plan',
  'duda-de-que-hace-orbita': 'Qué hace Órbita',
  'problema-tecnico': 'Problema técnico',
  'quiere-que-orbi-lo-complete': 'Quiere que Orbi lo complete',
  'fuera-de-tema': 'Fuera de tema',
  otro: 'Otro',
}

const nombrePaso = (k: string) => PASOS[k] ?? k
const nombreCampo = (k: string) => CAMPOS[k] ?? k

export function TabWizard() {
  const [rango, setRango] = useRange(30)

  const { data: funnel, error: errorFunnel, loading: cargandoFunnel } = useFetch(
    () => platformApi.wizardFunnel(rango), [rango],
  )
  const { data: friccion, loading: cargandoFriccion } = useFetch(
    () => platformApi.wizardFriction(rango), [rango],
  )
  const { data: ia, loading: cargandoIa } = useFetch(() => platformApi.wizardAi(rango), [rango])
  const { data: temas } = useFetch(() => platformApi.wizardAiTopics(rango), [rango])

  if (errorFunnel) return <ErrorBox msg="No pudimos cargar la analítica del wizard." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <PageHeader
        title="Wizard de alta"
        subtitle="Qué pasa antes de que alguien sea cliente: dónde se traba y dónde abandona."
        action={<RangePicker value={rango} onChange={setRango} />}
      />

      <Grid>
        <Kpi label="Entraron al wizard" value={cargandoFunnel ? '—' : String(funnel?.sesiones ?? 0)} hint="Visitas distintas al recorrido" />
        <Kpi label="Llegaron al pago" value={cargandoFunnel ? '—' : String(funnel?.completaron ?? 0)} />
        <Kpi label="Conversión" value={cargandoFunnel ? '—' : `${funnel?.pctConversion ?? 0}%`} accent hint="De los que entran, cuántos terminan el wizard" />
        <Kpi label="Usaron a Orbi" value={cargandoIa ? '—' : `${ia?.pctAdopcion ?? 0}%`} hint={ia ? `${ia.sesionesConOrbi} sesiones le escribieron` : undefined} />
      </Grid>

      <Embudo pasos={funnel?.pasos ?? []} cargando={cargandoFunnel} />

      <Friccion datos={friccion} cargando={cargandoFriccion} />

      <SeccionIa
        ia={ia}
        cargando={cargandoIa}
        temas={temas?.temas ?? []}
        sinClasificar={temas?.sinClasificar ?? 0}
        rango={rango}
      />
    </div>
  )
}

// ─── 1. El embudo ────────────────────────────────────────────────────────────
// Barras horizontales en vez de la silueta de embudo clásica: la caída entre
// pasos es un NÚMERO que hay que poder leer, no una forma que hay que
// interpretar. Además así es navegable con teclado y lector de pantalla, que
// con un SVG con forma de copa no pasa.

function Embudo({ pasos, cargando }: { pasos: WizardFunnelStep[]; cargando: boolean }) {
  const total = pasos[0]?.sessions ?? 0
  const peor = pasos.find((p) => p.peorPaso)

  return (
    <Card
      title="Dónde se cae la gente"
      subtitle={peor ? `La peor caída está al entrar a "${nombrePaso(peor.stepName)}": se va el ${peor.pctCaida}% de los que venían.` : 'Cada paso, contra el total que entró al wizard.'}
    >
      {cargando ? <ChartSkeleton alto={280} /> : pasos.length === 0 ? (
        <Empty text="Todavía no hay visitas al wizard en este período." />
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
          {pasos.map((p, i) => (
            <li key={p.step}>
              {/* La caída va ENTRE los pasos, que es donde ocurre. */}
              {i > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 0 5px 2px', fontSize: 12,
                  color: p.peorPaso ? 'var(--color-error)' : 'var(--color-subtle)',
                  fontWeight: p.peorPaso ? 600 : 500,
                }}>
                  <span aria-hidden="true" style={{ width: 1, height: 16, background: 'var(--color-border)', marginLeft: 3 }} />
                  {p.peorPaso && <AlertTriangle size={13} strokeWidth={2.2} />}
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    −{p.perdidos} {p.perdidos === 1 ? 'persona' : 'personas'} ({p.pctCaida}%)
                  </span>
                </div>
              )}

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
                  <span style={{ fontSize: 13.5, color: 'var(--color-body)', fontWeight: p.peorPaso ? 600 : 500 }}>
                    {p.step + 1}. {nombrePaso(p.stepName)}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
                      {p.sessions}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-subtle)', fontVariantNumeric: 'tabular-nums' }}>
                      {p.pctDelTotal}%
                    </span>
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: 'var(--color-surface-alt)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${total > 0 ? Math.round((p.sessions / total) * 100) : 0}%`,
                      height: '100%', borderRadius: 999,
                      background: p.peorPaso ? 'var(--color-error)' : 'var(--chart-1)',
                      transition: 'width 300ms ease',
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

// ─── 2. Los datos más pesados ────────────────────────────────────────────────

function Friccion({ datos, cargando }: { datos: WizardFriction | null; cargando: boolean }) {
  const [abierto, setAbierto] = useState<string | null>(null)
  const campos = datos?.campos ?? []

  return (
    <Card
      title="Qué dato le cuesta más a la gente"
      subtitle="Índice 0-100 combinando errores de validación, tiempo, abandono y reintentos. Tocá una fila para ver de dónde sale el número."
      noPad
    >
      {cargando ? (
        <div style={{ padding: 18 }}><ChartSkeleton alto={200} /></div>
      ) : campos.length === 0 ? (
        // Un ranking vacío es ambiguo, así que se dice POR QUÉ está vacío: no
        // es lo mismo "nadie completó nada todavía" que "hay datos pero son
        // pocos para sacar conclusiones".
        <div style={{ padding: 18 }}>
          <Empty
            text={
              (datos?.insuficientes ?? 0) > 0
                ? `${datos!.insuficientes} ${datos!.insuficientes === 1 ? 'campo ya tiene' : 'campos ya tienen'} datos, pero ninguno llegó todavía a las ${datos!.muestraMinima} personas que hacen falta para que el número signifique algo.`
                : 'Todavía nadie completó campos del formulario en este período. Pasar de paso sin tocar ningún campo no genera datos acá.'
            }
          />
        </div>
      ) : (
        <>
          <Table
            head={['Campo', 'Paso', 'Fricción', 'Mediana', 'Con error', 'Abandonos', 'Personas']}
            alignRight={[2, 3, 4, 5, 6]}
            rows={campos.map((c) => ({
              key: c.field,
              onClick: () => setAbierto(abierto === c.field ? null : c.field),
              cells: [
                <span key="c" style={{ fontWeight: 600 }}>{nombreCampo(c.field)}</span>,
                nombrePaso(c.stepName),
                <BarraFriccion key="f" valor={c.indiceFriccion} />,
                `${c.medianaSegundos}s`,
                <PctSobre key="e" parte={c.sesionesConError} total={c.sesiones} />,
                <PctSobre key="a" parte={c.sesionesAbandonadas} total={c.sesiones} />,
                c.sesiones,
              ],
            }))}
          />
          {abierto && <Desglose campo={campos.find((c) => c.field === abierto)!} />}
        </>
      )}
    </Card>
  )
}

// El número solo no dice nada: 62 puede ser "todos se equivocan" o "todos
// tardan". El desglose evita que el índice sea una caja negra en la que hay
// que confiar a ciegas.
function Desglose({ campo }: { campo: WizardFieldFriction }) {
  const partes = [
    { label: 'Errores de validación', value: campo.desglose.errores },
    { label: 'Tiempo en el campo', value: campo.desglose.lentitud },
    { label: 'Abandonos ahí', value: campo.desglose.abandono },
    { label: 'Reintentos', value: campo.desglose.reintentos },
  ].filter((p) => p.value > 0)

  return (
    <div style={{ padding: '16px 18px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', marginBottom: 12 }}>
        De qué está hecho el {campo.indiceFriccion} de «{nombreCampo(campo.field)}»
      </div>
      {partes.length === 0
        ? <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>Este campo no muestra fricción medible.</div>
        : <BarDistribution items={partes} formatValue={(n) => `${n} pts`} />}
      <div style={{ fontSize: 11.5, color: 'var(--color-subtle)', marginTop: 12 }}>
        Sobre {campo.sesiones} personas que tocaron el campo · {campo.reintentosPromedio} ediciones promedio
      </div>
    </div>
  )
}

function BarraFriccion({ valor }: { valor: number }) {
  // Tres tramos, con etiqueta de texto además del color: el color solo no
  // puede ser el que carga el significado.
  const tono = valor >= 50 ? 'var(--color-error)' : valor >= 25 ? 'var(--color-warning)' : 'var(--chart-1)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
      <span aria-hidden="true" style={{ width: 54, height: 6, borderRadius: 999, background: 'var(--color-surface-alt)', overflow: 'hidden', display: 'inline-block' }}>
        <span style={{ display: 'block', width: `${Math.min(valor, 100)}%`, height: '100%', background: tono, borderRadius: 999 }} />
      </span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, minWidth: 30, textAlign: 'right' }}>{valor}</span>
    </span>
  )
}

function PctSobre({ parte, total }: { parte: number; total: number }) {
  const pct = total > 0 ? Math.round((parte / total) * 100) : 0
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {parte} <span style={{ color: 'var(--color-subtle)', fontSize: 12 }}>({pct}%)</span>
    </span>
  )
}

// ─── 3. Orbi dentro del wizard ───────────────────────────────────────────────

function SeccionIa({ ia, cargando, temas, sinClasificar, rango }: {
  ia: import('@/lib/platform/api').WizardAiOverview | null
  cargando: boolean
  temas: { topic: string; turnos: number; pctBienRespondidas: number }[]
  sinClasificar: number
  rango: 7 | 30 | 90 | 180
}) {
  if (cargando) return <Card title="Orbi en el wizard"><ChartSkeleton alto={200} /></Card>
  if (!ia || ia.turnos === 0) {
    return (
      <Card title="Orbi en el wizard">
        <Empty text="Nadie le escribió a Orbi en este período." />
      </Card>
    )
  }

  const diferencia = Math.round((ia.conversionConOrbi - ia.conversionSinOrbi) * 10) / 10

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <Card
        title="Orbi en el wizard"
        subtitle="Cuánto lo usan y si les sirve. La conversión comparada es la única métrica que dice si vale la pena."
      >
        <Grid small>
          <Kpi label="Preguntas totales" value={String(ia.turnos)} hint={`${ia.turnosPorSesion} por persona que lo usó`} />
          <Kpi label="Abrieron el panel" value={String(ia.aperturas)} hint={`${ia.sesionesConOrbi} llegaron a escribir`} />
          <Kpi
            label="Conversión con Orbi"
            value={`${ia.conversionConOrbi}%`}
            accent={diferencia > 0}
            hint={`Sin Orbi: ${ia.conversionSinOrbi}% · ${diferencia >= 0 ? '+' : ''}${diferencia} puntos`}
          />
          <Kpi label="Respuesta (mediana)" value={`${(ia.latenciaP50Ms / 1000).toFixed(1)}s`} hint={`El 5% más lento: ${(ia.latenciaP95Ms / 1000).toFixed(1)}s`} />
        </Grid>

        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--color-border)' }}>
          <Señal
            titulo="Sugerencias que sobrevivieron"
            valor={`${ia.pctSugerenciasQueSobrevivieron}%`}
            detalle={`${ia.sugerenciasAplicadas} aplicadas · ${ia.sugerenciasPisadas} pisadas a mano después`}
          />
          <Señal
            titulo="Votos de los usuarios"
            valor={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <ThumbsUp size={15} strokeWidth={2.2} /> {ia.pulgarArriba}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--color-error)' }}>
                  <ThumbsDown size={15} strokeWidth={2.2} /> {ia.pulgarAbajo}
                </span>
              </span>
            }
            detalle="Vota poca gente: leelo como señal de los casos fuertes, no como promedio"
          />
        </div>
      </Card>

      <Card
        title="De qué le habla la gente a Orbi"
        subtitle={sinClasificar > 0 ? `${sinClasificar} preguntas todavía sin clasificar (se etiquetan de madrugada).` : undefined}
      >
        {temas.length === 0 ? (
          <Empty text="Todavía no hay preguntas clasificadas." />
        ) : (
          <>
            <BarDistribution items={temas.map((t) => ({ label: TEMAS[t.topic] ?? t.topic, value: t.turnos }))} />
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>
                Y qué tan bien las responde
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {temas.map((t) => (
                  <Pill
                    key={t.topic}
                    text={`${TEMAS[t.topic] ?? t.topic}: ${t.pctBienRespondidas}%`}
                    tone={t.pctBienRespondidas >= 70 ? 'green' : t.pctBienRespondidas >= 40 ? 'amber' : 'red'}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </Card>

      <UltimasPreguntas rango={rango} />
    </div>
  )
}

function Señal({ titulo, valor, detalle }: { titulo: string; valor: React.ReactNode; detalle: string }) {
  return (
    <div style={{ minWidth: 200 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 6 }}>{titulo}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
      <div style={{ fontSize: 11.5, color: 'var(--color-subtle)', marginTop: 4, maxWidth: 320, lineHeight: 1.4 }}>{detalle}</div>
    </div>
  )
}

// Leer 20 preguntas reales enseña más que cualquier gráfico. Van al final
// porque son el detalle, no el titular.
function UltimasPreguntas({ rango }: { rango: 7 | 30 | 90 | 180 }) {
  const { data, loading } = useFetch(() => platformApi.wizardAiQuestions(rango), [rango])

  if (loading) return <Card title="Últimas preguntas"><Loader /></Card>

  return (
    <Card title="Últimas preguntas" subtitle="Con mail y teléfono tapados automáticamente. Nunca se guarda lo que la gente tipea en el formulario." noPad>
      <Table
        head={['Pregunta', 'Paso', 'Tema', '¿Respondió?', 'Voto']}
        alignRight={[3, 4]}
        rows={(data ?? []).map((q) => ({
          key: q.id,
          cells: [
            <span key="q" style={{ display: 'block', maxWidth: 460, lineHeight: 1.45 }}>{q.question}</span>,
            q.stepName ? nombrePaso(q.stepName) : '—',
            q.topic ? (TEMAS[q.topic] ?? q.topic) : <span style={{ color: 'var(--color-subtle)' }}>sin clasificar</span>,
            q.answeredWell === null ? '—' : <Pill text={q.answeredWell ? 'Sí' : 'No'} tone={q.answeredWell ? 'green' : 'red'} />,
            q.rating === 1 ? <ThumbsUp size={14} strokeWidth={2.2} /> : q.rating === -1 ? <ThumbsDown size={14} strokeWidth={2.2} color="var(--color-error)" /> : '—',
          ],
        }))}
      />
    </Card>
  )
}
