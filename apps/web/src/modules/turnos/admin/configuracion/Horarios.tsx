// Horario de atención del negocio: el marco dentro del cual cada profesional o
// sala tiene su propio horario (eso se edita en Equipo). Se carga de dos formas:
// el mismo horario para todos los días que abre, o día por día (para quien un
// día atiende distinto). Cada día tiene su mañana y su tarde, con el corte del mediodía en el medio; más abajo, feriados
// y vacaciones, que son lo que más se olvida y más turnos mal dados genera.
//
// Al lado de cada día va una franja de 6 a 24 h con lo que está abierto
// pintado: la semana se lee de un vistazo, sin sumar horas de cabeza.
//
// El horario semanal se guarda en el negocio de la demo (demo/negocioDemo.ts):
// el sitio, la reserva y la agenda lo leen de ahí. Los días especiales y las
// vacaciones siguen siendo demo en memoria.
import { useState } from 'react'
import { Clock, CalendarX, Plane, Plus, Trash2, Copy, TriangleAlert } from 'lucide-react'
import { DIAS, semanaDe } from '@/modules/turnos/datos'
import { useNegocioDemo } from '@/modules/turnos/demo/negocioDemo'
import { JORNADA_INICIAL, errorJornada, jornadaDe, jornadaTxt, minutosAbiertos, tramosDe, tramosDeJornada, tramosFrase, type Jornada, type Semana, type Tramo } from '@/modules/turnos/horario'
import { BloquesJornada, DiasSemana } from '@/modules/turnos/admin/piezasPanel'
import { useBorrador, Encabezado, SecCard, Switch, Segmentado, Campo, Dos, BarraGuardar, BotonBorde, FilaSwitch, Chip, Vacio, type PropsTab } from './ui'
import { vozDe } from './datos'
import { fechaDePartes, partesDe, sumarDias, useReloj, type Fecha } from '@/modules/turnos/reloj'

type Rango = [string, string]
/** Un día en el formulario: si abre, y su mañana y su tarde. */
interface Dia { abierto: boolean; jornada: Jornada }
interface Especial { id: string; fecha: string; motivo: string; tipo: 'cerrado' | 'especial'; rango: Rango }

// La franja dibuja de 6:00 a 24:00: antes de las 6 no abre casi nadie y así
// los horarios reales ocupan más ancho.
const DESDE = 6 * 60
const HASTA = 24 * 60

const copia = (j: Jornada): Jornada => ({ manana: { ...j.manana }, tarde: { ...j.tarde } })
/** Un día cerrado guarda la jornada de fábrica: al abrirlo ya propone mañana y tarde. */
const diasDe = (semana: Semana): Dia[] => semana.map(([, h]) => {
  const tramos = tramosDe(h)
  return { abierto: tramos.length > 0, jornada: tramos.length ? jornadaDe(tramos) : copia(JORNADA_INICIAL) }
})
const semanaDeDias = (dias: Dia[]): Semana => dias.map((d, i) => [DIAS[i], d.abierto ? jornadaTxt(d.jornada) : ''])
const tramosDia = (d: Dia): Tramo[] => (d.abierto ? tramosDeJornada(d.jornada) : [])

export default function Horarios({ rubro, avisar }: PropsTab) {
  const voz = vozDe(rubro)
  // null = sin tocar: vale lo guardado (que llega del navegador recién después
  // de hidratar, por eso no se copia a un estado al montar).
  const { guardar: guardarDemo } = useNegocioDemo()
  const guardada = semanaDe(rubro)
  const [borrador, setBorrador] = useState<Dia[] | null>(null)
  const dias = borrador ?? diasDe(guardada)
  const semanaDirty = borrador !== null && JSON.stringify(semanaDeDias(borrador)) !== JSON.stringify(semanaDeDias(diasDe(guardada)))
  const errores = dias.map(d => (d.abierto ? errorJornada(d.jornada) : null))

  // Cómo se carga: un horario para todos los días o uno por día. Sin elegir, sale
  // de lo guardado: si todos los días que abre tienen el mismo horario, "igual".
  const primero = dias.find(d => d.abierto)
  const iguales = dias.every(d => !d.abierto || jornadaTxt(d.jornada) === jornadaTxt(primero!.jornada))
  const [modoElegido, setModo] = useState<'igual' | 'dia' | null>(null)
  const modo = modoElegido ?? (iguales ? 'igual' : 'dia')
  const comun = primero?.jornada ?? JORNADA_INICIAL
  const ponerComun = (jornada: Jornada) => setBorrador(dias.map(d => ({ ...d, jornada: copia(jornada) })))
  const ponerAbiertos = (indices: number[]) => setBorrador(dias.map((d, i) => ({ abierto: indices.includes(i), jornada: copia(comun) })))
  const cambiarModo = (m: 'igual' | 'dia') => {
    // Al pasar a "igual" con días distintos, todos toman el horario del primer día que abre.
    if (m === 'igual' && !iguales) ponerComun(comun)
    setModo(m)
  }
  const conError = errores.findIndex(Boolean)

  const { fecha: hoy } = useReloj()
  const b = useBorrador(() => {
    // Feriados de ejemplo: la próxima vez que cae cada uno, de hoy en adelante.
    const proxima = (mes: number, dia: number): Fecha => {
      const anio = partesDe(hoy).anio
      const este = fechaDePartes(anio, mes, dia)
      return este >= hoy ? este : fechaDePartes(anio + 1, mes, dia)
    }
    const especiales: Especial[] = ([
      { id: 'e1', fecha: proxima(10, 12), motivo: 'Día de la Diversidad Cultural', tipo: 'cerrado', rango: ['09:00', '13:00'] },
      { id: 'e2', fecha: proxima(11, 20), motivo: 'Día de la Soberanía', tipo: 'especial', rango: ['10:00', '14:00'] },
      { id: 'e3', fecha: proxima(12, 24), motivo: 'Nochebuena', tipo: 'especial', rango: ['09:00', '14:00'] },
      { id: 'e4', fecha: proxima(12, 25), motivo: 'Navidad', tipo: 'cerrado', rango: ['09:00', '13:00'] },
    ] satisfies Especial[]).sort((x, y) => x.fecha.localeCompare(y.fecha))
    return { especiales, vacaciones: false, vacDesde: proxima(1, 15), vacHasta: sumarDias(proxima(1, 15), 16), vacMensaje: 'Nos tomamos unos días. Volvemos el 1 de febrero con todo: ya podés reservar para esa semana.' }
  })
  const v = b.valor

  const setDia = (i: number, d: Partial<Dia>) => setBorrador(dias.map((x, k) => (k === i ? { ...x, ...d } : x)))
  // Copia el horario de un día a todos los demás días que abren.
  const copiarA = (i: number) => {
    setBorrador(dias.map((d, k) => (k !== i && d.abierto ? { ...d, jornada: copia(dias[i].jornada) } : d)))
    avisar(`Horario del ${DIAS[i].toLowerCase()} copiado`, 'Quedó igual en todos los días que abrís. Falta guardar.')
  }
  const setEsp = (id: string, e: Partial<Especial>) => b.set('especiales', v.especiales.map(x => x.id === id ? { ...x, ...e } : x))
  const agregarDia = () => b.set('especiales', [...v.especiales, { id: `n${Date.now()}`, fecha: '', motivo: '', tipo: 'cerrado', rango: ['09:00', '13:00'] }])

  const horasSemana = dias.reduce((s, d) => s + minutosAbiertos(tramosDia(d)), 0) / 60
  const abiertos = dias.filter(d => d.abierto).length

  const guardar = () => {
    if (conError >= 0) { avisar(`Revisá el ${DIAS[conError].toLowerCase()}`, errores[conError] ?? undefined); return }
    if (abiertos === 0) { avisar('Dejá al menos un día abierto', 'Para cerrar unos días sin tocar el horario están las vacaciones, más abajo.'); return }
    b.guardar()
    if (semanaDirty) guardarDemo({ horarios: { rubro: rubro.key, dias: semanaDeDias(dias) } })
    setBorrador(null); setModo(null)
    avisar('Horarios guardados', semanaDirty ? 'Tu página, la reserva y la agenda ya muestran el horario nuevo.' : 'Los días especiales y las vacaciones son una demo: la agenda no cambia.')
  }
  const descartar = () => { b.descartar(); setBorrador(null); setModo(null) }

  return (
    <div className="panel-page panel-page--form">
      <Encabezado rotulo="Tu negocio" titulo="Horarios" bajada={`Cuándo está abierto el negocio, a la mañana y a la tarde. Fuera de este horario no se pueden reservar ${voz.turnos}.`} />

      <div className="tuc-pila">
        <SecCard titulo="Horario semanal" Icon={Clock}
          badge={<Chip tono="primario"><span className="tuo-num">{Math.round(horasSemana)} h</span> · {abiertos} {abiertos === 1 ? 'día' : 'días'}</Chip>}
          bajada={rubro.modo === 'profesional' ? `Cada ${voz.recurso} puede tener un horario propio dentro de este, desde Equipo.` : 'Cada espacio puede tener un horario propio dentro de este.'}>
          <div style={{ marginBottom: 16 }}>
            <Segmentado label="Cómo cargás el horario" lleno valor={modo} onChange={cambiarModo}
              opciones={[{ id: 'igual', label: 'El mismo todos los días' }, { id: 'dia', label: 'Un horario por día' }]} />
            <p className="tuc-ayuda" style={{ marginTop: 8 }}>
              {modo === 'igual' ? 'Elegís qué días abrís y un solo horario para todos. Si algún día atendés distinto, pasá a “Un horario por día”.' : 'Cada día tiene su mañana y su tarde: sirve si, por ejemplo, el sábado atendés solo a la mañana.'}
            </p>
          </div>

          {modo === 'igual' ? (
            <div className="tuc-igual">
              <div>
                <div className="tuc-rotulo" style={{ marginBottom: 8 }}>Días que abrís</div>
                <DiasSemana dias={dias.map((d, i) => (d.abierto ? i : -1)).filter(i => i >= 0)} onChange={ponerAbiertos} etiqueta="Días que abrís" />
              </div>
              <div>
                <div className="tuc-rotulo" style={{ marginBottom: 8 }}>Horario</div>
                <BloquesJornada id="tuc-h-comun" jornada={comun} onChange={ponerComun} />
                {errorJornada(comun) ? (
                  <p role="alert" className="tuc-dia-error" style={{ marginTop: 8 }}><TriangleAlert size={14} aria-hidden /> {errorJornada(comun)}</p>
                ) : (
                  <p className="tuc-ayuda" style={{ marginTop: 8 }}>{abiertos === 0 ? 'Marcá al menos un día.' : `Abrís ${abiertos === 7 ? 'todos los días' : `${abiertos} día${abiertos === 1 ? '' : 's'} por semana`}, ${tramosFrase(tramosDeJornada(comun))}.`}</p>
                )}
              </div>
              <Franja tramos={errorJornada(comun) ? [] : tramosDeJornada(comun)} />
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {dias.map((d, i) => (
              <div key={DIAS[i]} className="tuc-dia" data-abierto={d.abierto}>
                <div className="tuc-dia-nombre">
                  <Switch on={d.abierto} onChange={x => setDia(i, { abierto: x })} label={`${DIAS[i]} abierto`} />
                  <span>{DIAS[i]}</span>
                </div>
                <div className="tuc-dia-cuerpo">
                  {!d.abierto ? (
                    <span className="tuc-dia-cerrado">Cerrado</span>
                  ) : (
                    <>
                      <BloquesJornada id={`tuc-h-${i}`} jornada={d.jornada} onChange={jornada => setDia(i, { jornada })} />
                      {errores[i] ? (
                        <p role="alert" className="tuc-dia-error"><TriangleAlert size={14} aria-hidden /> {errores[i]}</p>
                      ) : (
                        <div className="tuc-dia-pie">
                          <span>Abre {tramosFrase(tramosDia(d))}</span>
                          {abiertos > 1 && <button type="button" className="tuc-link" onClick={() => copiarA(i)}><Copy size={13} aria-hidden /> Copiar a los demás días</button>}
                        </div>
                      )}
                    </>
                  )}
                  <Franja tramos={errores[i] ? [] : tramosDia(d)} />
                </div>
              </div>
            ))}
          </div>
          )}
          <div aria-hidden className="tuc-franja-escala" data-modo={modo}><span>6</span><span>9</span><span>12</span><span>15</span><span>18</span><span>21</span><span>24</span></div>
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

      <BarraGuardar dirty={b.dirty || semanaDirty} onDescartar={descartar} onGuardar={guardar} />
    </div>
  )
}

function Hora({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return <input type="time" step={900} aria-label={label} value={value} onChange={e => onChange(e.target.value)} className="tuc-input tuc-mono" style={{ width: 118 }} />
}

/** El día de 6 a 24 h con lo abierto pintado. Es un apoyo visual: los horarios exactos están en los campos. */
function Franja({ tramos }: { tramos: Tramo[] }) {
  const pct = (m: number) => `${((Math.min(HASTA, Math.max(DESDE, m)) - DESDE) / (HASTA - DESDE)) * 100}%`
  return (
    <div aria-hidden className="tuc-franja">
      {tramos.map(([x, y]) => <span key={x} style={{ left: pct(x), width: `calc(${pct(y)} - ${pct(x)})` }} />)}
    </div>
  )
}

export const CSS_HORARIOS = `
  .tuc-dia { display: flex; align-items: flex-start; gap: 12px; padding: 14px 0; flex-wrap: wrap; border-top: 1px solid var(--color-border); }
  .tuc-dia:first-child { border-top: none; padding-top: 0; }
  .tuc-dia-nombre { display: flex; align-items: center; gap: 12px; width: 150px; flex-shrink: 0; min-height: 54px; font-size: 14px; font-weight: 600; color: var(--color-text); transition: color 200ms ease; }
  .tuc-dia[data-abierto='false'] .tuc-dia-nombre { color: var(--color-muted); min-height: 40px; }
  .tuc-igual { display: flex; flex-direction: column; gap: 16px; }
  .tuc-dia-cuerpo { flex: 1 1 320px; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .tuc-dia-cerrado { display: flex; align-items: center; min-height: 40px; font-size: 13.5px; color: var(--color-muted); }
  .tuc-dia-pie { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: 12.5px; color: var(--color-muted); }
  .tuc-dia-error { display: flex; align-items: center; gap: 6px; margin: 0; min-height: 32px; font-size: 12.5px; font-weight: 500; color: var(--color-error); }
  .tuc-franja { position: relative; height: 6px; border-radius: 999px; background: var(--color-surface-alt); overflow: hidden; }
  .tuc-franja > span { position: absolute; top: 0; bottom: 0; border-radius: 999px; background: var(--tuo-grad); transition: left 320ms var(--tuo-ease, ease), width 320ms var(--tuo-ease, ease); }
  .tuc-franja-escala { display: flex; justify-content: space-between; margin: 4px 0 0 162px; font-family: var(--tuo-mono, monospace); font-size: 10.5px; color: var(--color-subtle); font-variant-numeric: tabular-nums; }
  .tuc-franja-escala[data-modo='igual'] { margin-left: 0; }
  .tuc-especial { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 12px; }
  @media (max-width: 768px) {
    .tuc-dia-nombre, .tuc-dia[data-abierto='false'] .tuc-dia-nombre { width: 100%; min-height: 40px; }
    .tuc-franja-escala { margin-left: 0; }
  }
  @media (prefers-reduced-motion: reduce) { .tuc-franja > span { transition: none; } }
`
