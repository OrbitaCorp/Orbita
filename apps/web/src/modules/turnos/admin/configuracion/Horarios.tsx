// Horario de atención del negocio: el marco dentro del cual cada profesional o
// sala tiene su propio horario (eso se edita en Equipo). Días con corte al
// mediodía, feriados y vacaciones, que son lo que más se olvida y más turnos
// mal dados genera.
//
// Al lado de cada día va una franja de 6 a 24 h con lo que está abierto
// pintado: la semana se lee de un vistazo, sin sumar horas de cabeza.
import { Clock, CalendarX, Plane, Plus, Trash2, Copy, Scissors } from 'lucide-react'
import { temaDe } from '@/modules/turnos/storefront/tema'
import { DIAS } from '@/modules/turnos/datos'
import { useBorrador, Encabezado, SecCard, Switch, Segmentado, Campo, Dos, BarraGuardar, BotonBorde, FilaSwitch, Chip, Vacio, type PropsTab } from './ui'
import { vozDe } from './datos'

type Rango = [string, string]
interface Dia { abierto: boolean; rangos: Rango[] }
interface Especial { id: string; fecha: string; motivo: string; tipo: 'cerrado' | 'especial'; rango: Rango }

// La franja dibuja de 6:00 a 24:00: antes de las 6 no abre casi nadie y así
// los horarios reales ocupan más ancho.
const DESDE = 6 * 60
const HASTA = 24 * 60

export default function Horarios({ rubro, avisar }: PropsTab) {
  const voz = vozDe(rubro)
  const b = useBorrador(() => {
    const t = temaDe(rubro)
    const dias: Dia[] = t.horarios.map(([, h], i) => {
      if (!h) return { abierto: false, rangos: [['09:00', '18:00']] }
      const [desde, hasta] = h.split('–').map(s => s.trim()) as Rango
      // Salud y belleza suelen cortar al mediodía de lunes a viernes.
      const corte = (rubro.familia === 'salud' || rubro.key === 'peluqueria') && i < 5
      return { abierto: true, rangos: corte ? [[desde, '13:00'], ['15:00', hasta]] : [[desde, hasta]] }
    })
    const especiales: Especial[] = [
      { id: 'e1', fecha: '2026-10-12', motivo: 'Día de la Diversidad Cultural', tipo: 'cerrado', rango: ['09:00', '13:00'] },
      { id: 'e2', fecha: '2026-11-20', motivo: 'Día de la Soberanía', tipo: 'especial', rango: ['10:00', '14:00'] },
      { id: 'e3', fecha: '2026-12-24', motivo: 'Nochebuena', tipo: 'especial', rango: ['09:00', '14:00'] },
      { id: 'e4', fecha: '2026-12-25', motivo: 'Navidad', tipo: 'cerrado', rango: ['09:00', '13:00'] },
    ]
    return { dias, especiales, vacaciones: false, vacDesde: '2027-01-15', vacHasta: '2027-01-31', vacMensaje: 'Nos tomamos unos días. Volvemos el 1 de febrero con todo: ya podés reservar para esa semana.' }
  })
  const v = b.valor

  const setDia = (i: number, d: Partial<Dia>) => b.set('dias', v.dias.map((x, k) => k === i ? { ...x, ...d } : x))
  const setRango = (i: number, r: number, pos: 0 | 1, val: string) =>
    setDia(i, { rangos: v.dias[i].rangos.map((x, k) => k === r ? (pos === 0 ? [val, x[1]] : [x[0], val]) as Rango : x) })
  const copiarLunes = () => b.set('dias', v.dias.map((d, i) => i > 0 && i < 5 ? { ...v.dias[0], rangos: v.dias[0].rangos.map(r => [...r] as Rango) } : d))
  const setEsp = (id: string, e: Partial<Especial>) => b.set('especiales', v.especiales.map(x => x.id === id ? { ...x, ...e } : x))
  const agregarDia = () => b.set('especiales', [...v.especiales, { id: `n${Date.now()}`, fecha: '', motivo: '', tipo: 'cerrado', rango: ['09:00', '13:00'] }])

  const horasSemana = v.dias.reduce((s, d) => s + (d.abierto ? d.rangos.reduce((a, [x, y]) => a + Math.max(0, min(y) - min(x)), 0) : 0), 0) / 60
  const abiertos = v.dias.filter(d => d.abierto).length

  return (
    <div className="panel-page panel-page--form">
      <Encabezado rotulo="Tu negocio" titulo="Horarios" bajada={`Cuándo está abierto el negocio. Fuera de este horario no se pueden reservar ${voz.turnos}.`} />

      <div className="tuc-pila">
        <SecCard titulo="Horario semanal" Icon={Clock}
          badge={<Chip tono="primario"><span className="tuo-num">{Math.round(horasSemana)} h</span> · {abiertos} días</Chip>}
          bajada={rubro.modo === 'profesional' ? `Cada ${voz.recurso} puede tener un horario propio dentro de este, desde Equipo.` : 'Cada espacio puede tener un horario propio dentro de este.'}>
          {v.dias[0].abierto && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
              <BotonBorde Icon={Copy} onClick={copiarLunes}>Copiar el lunes a mar–vie</BotonBorde>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {v.dias.map((d, i) => (
              <div key={DIAS[i]} className="tuc-dia" data-abierto={d.abierto}>
                <div className="tuc-dia-nombre">
                  <Switch on={d.abierto} onChange={x => setDia(i, { abierto: x })} label={`${DIAS[i]} abierto`} />
                  <span>{DIAS[i]}</span>
                </div>
                <div style={{ flex: '1 1 250px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {!d.abierto ? (
                    <span style={{ display: 'flex', alignItems: 'center', minHeight: 40, fontSize: 13.5, color: 'var(--color-muted)' }}>Cerrado</span>
                  ) : d.rangos.map((r, k) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Hora value={r[0]} onChange={x => setRango(i, k, 0, x)} label={`${DIAS[i]}, turno ${k + 1}, desde`} />
                      <span aria-hidden style={{ color: 'var(--color-subtle)' }}>–</span>
                      <Hora value={r[1]} onChange={x => setRango(i, k, 1, x)} label={`${DIAS[i]}, turno ${k + 1}, hasta`} />
                      {k === 1 ? (
                        <button type="button" className="tuc-icono tuc-icono--peligro" aria-label={`Quitar el corte del ${DIAS[i].toLowerCase()}`} title="Quitar el corte" onClick={() => setDia(i, { rangos: [d.rangos[0]] })}><Trash2 size={15} aria-hidden /></button>
                      ) : d.rangos.length === 1 ? (
                        <button type="button" onClick={() => setDia(i, { rangos: [[r[0], '13:00'], ['15:00', r[1]]] })} className="tuc-link"><Scissors size={13} aria-hidden /> Agregar corte</button>
                      ) : null}
                    </div>
                  ))}
                  <Franja dia={d} />
                </div>
              </div>
            ))}
          </div>
          <div aria-hidden className="tuc-franja-escala"><span>6</span><span>9</span><span>12</span><span>15</span><span>18</span><span>21</span><span>24</span></div>
        </SecCard>

        <SecCard titulo="Días especiales y feriados" Icon={CalendarX} badge={v.especiales.length > 0 ? <Chip><span className="tuo-num">{v.especiales.length}</span> cargados</Chip> : undefined}
          bajada={`Cerrás o cambiás el horario de un día puntual. Los ${voz.turnos} ya reservados para ese día te los avisamos para reprogramar.`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {v.especiales.map(e => (
              <div key={e.id} className="tuc-renglon tuc-especial">
                <input type="date" aria-label="Fecha" value={e.fecha} onChange={x => setEsp(e.id, { fecha: x.target.value })} className="tuc-input tuc-mono" style={{ width: 158 }} />
                <input aria-label="Motivo" placeholder="Motivo (opcional)" value={e.motivo} onChange={x => setEsp(e.id, { motivo: x.target.value })} className="tuc-input" style={{ flex: '1 1 160px', minWidth: 0 }} />
                <Segmentado label="Tipo de día" valor={e.tipo} onChange={x => setEsp(e.id, { tipo: x })} opciones={[{ id: 'cerrado', label: 'Cerrado' }, { id: 'especial', label: 'Otro horario' }]} />
                {e.tipo === 'especial' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Hora value={e.rango[0]} onChange={x => setEsp(e.id, { rango: [x, e.rango[1]] })} label="Desde" />
                    <span aria-hidden style={{ color: 'var(--color-subtle)' }}>–</span>
                    <Hora value={e.rango[1]} onChange={x => setEsp(e.id, { rango: [e.rango[0], x] })} label="Hasta" />
                  </div>
                )}
                <button type="button" className="tuc-icono tuc-icono--peligro" style={{ marginLeft: 'auto' }} aria-label={`Quitar ${e.motivo || 'día especial'}`} title="Quitar" onClick={() => b.set('especiales', v.especiales.filter(x => x.id !== e.id))}><Trash2 size={15} aria-hidden /></button>
              </div>
            ))}
            {v.especiales.length === 0 && (
              <Vacio Icon={CalendarX} titulo="Sin días especiales" accion={<BotonBorde Icon={Plus} onClick={agregarDia}>Agregar el primero</BotonBorde>}>
                Cargá los feriados en los que cerrás o atendés en otro horario, así nadie reserva un día que no abrís.
              </Vacio>
            )}
          </div>
          {v.especiales.length > 0 && <BotonBorde Icon={Plus} style={{ marginTop: 12 }} onClick={agregarDia}>Agregar día</BotonBorde>}
        </SecCard>

        <SecCard titulo="Vacaciones" Icon={Plane} bajada="Cerrás la agenda por unos días sin tocar el horario de siempre.">
          <FilaSwitch titulo="Me voy de vacaciones" ayuda={`Entre esas fechas no se pueden reservar ${voz.turnos} y tu sitio muestra el aviso.`} on={v.vacaciones} onChange={x => b.set('vacaciones', x)}>
            <Dos>
              <Campo label="Desde" type="date" value={v.vacDesde} onChange={x => b.set('vacDesde', x)} mono />
              <Campo label="Hasta" type="date" value={v.vacHasta} onChange={x => b.set('vacHasta', x)} mono />
            </Dos>
            <Campo label="Aviso en tu sitio" value={v.vacMensaje} onChange={x => b.set('vacMensaje', x)} area maxLength={160} style={{ marginBottom: 0 }} />
          </FilaSwitch>
        </SecCard>
      </div>

      <BarraGuardar dirty={b.dirty} onDescartar={b.descartar} onGuardar={() => { b.guardar(); avisar('Horarios guardados', 'Es una demo: la agenda no cambia de verdad.') }} />
    </div>
  )
}

const min = (h: string) => { const [a, c] = h.split(':').map(Number); return (a || 0) * 60 + (c || 0) }

function Hora({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return <input type="time" step={900} aria-label={label} value={value} onChange={e => onChange(e.target.value)} className="tuc-input tuc-mono" style={{ width: 118 }} />
}

/** El día de 6 a 24 h con lo abierto pintado. Es un apoyo visual: los horarios exactos están en los campos. */
function Franja({ dia }: { dia: Dia }) {
  const pct = (m: number) => `${((Math.min(HASTA, Math.max(DESDE, m)) - DESDE) / (HASTA - DESDE)) * 100}%`
  return (
    <div aria-hidden className="tuc-franja">
      {dia.abierto && dia.rangos.map(([x, y], k) => min(y) > min(x) && (
        <span key={k} style={{ left: pct(min(x)), width: `calc(${pct(min(y))} - ${pct(min(x))})` }} />
      ))}
    </div>
  )
}

export const CSS_HORARIOS = `
  .tuc-dia { display: flex; align-items: flex-start; gap: 12px; padding: 14px 0; flex-wrap: wrap; border-top: 1px solid var(--color-border); }
  .tuc-dia:first-child { border-top: none; padding-top: 0; }
  .tuc-dia-nombre { display: flex; align-items: center; gap: 12px; width: 150px; flex-shrink: 0; min-height: 40px; font-size: 14px; font-weight: 600; color: var(--color-text); transition: color 200ms ease; }
  .tuc-dia[data-abierto='false'] .tuc-dia-nombre { color: var(--color-muted); }
  .tuc-franja { position: relative; height: 6px; border-radius: 999px; background: var(--color-surface-alt); overflow: hidden; }
  .tuc-franja > span { position: absolute; top: 0; bottom: 0; border-radius: 999px; background: var(--tuo-grad); transition: left 320ms var(--tuo-ease, ease), width 320ms var(--tuo-ease, ease); }
  .tuc-franja-escala { display: flex; justify-content: space-between; margin: 4px 0 0 162px; font-family: var(--tuo-mono, monospace); font-size: 10.5px; color: var(--color-subtle); font-variant-numeric: tabular-nums; }
  .tuc-especial { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 12px; }
  @media (max-width: 768px) {
    .tuc-dia-nombre { width: 100%; }
    .tuc-franja-escala { margin-left: 0; }
  }
  @media (prefers-reduced-motion: reduce) { .tuc-franja > span { transition: none; } }
`
