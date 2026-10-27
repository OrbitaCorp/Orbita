// Ingresos del gimnasio: lo que entró por planes y clases sueltas, cuántos
// socios están al día, cuántos vencen esta semana y qué tan llenas van las
// clases, cada indicador comparado con el período anterior. Las ventas se
// cuentan por la fecha en que arrancó el plan: la compra del plan de ahora y,
// para atrás, una renovación por vigencia desde que la persona es socia (su
// alta).
//
// Los gráficos son de una sola serie y una sola tinta (el acento): barras
// finas por semana y filas con su barra por plan, por actividad y por día.
// Ningún número depende del color ni del hover: cada fila lo dice en texto.
import { useMemo, useState } from 'react'
import { BellRing, HandCoins, Percent, UserCheck } from 'lucide-react'
import { DIAS_SEMANA, diaSemana, diasEntre, fechaCorta, minFecha, rangoTxt, sumarDias, type ISO } from '@/lib/reservas/fechas'
import { pesos } from '@/lib/reservas/precio'
import { HOY, cupoDe, estadoPlanDe, planDe, rubroPorKey, type Inscripcion, type NegocioGym, type Socio } from '../datos'
import { Barras, Encabezado, Segmentado } from '@/design-system/reservas/piezas'
import { KpiGym } from './piezas'

type Periodo = 'mes' | 'anterior' | 'trimestre'
const PERIODOS: { id: Periodo; label: string }[] = [{ id: 'mes', label: 'Este mes' }, { id: 'anterior', label: 'Mes pasado' }, { id: 'trimestre', label: 'Últimos 3 meses' }]

/** El primer día del mes anterior al de `primero` (que es un día 1). */
const mesAnterior = (primero: string) => `${sumarDias(primero, -1).slice(0, 7)}-01`

// Las filas con barra (por plan, por actividad, por día): nombre, valor y una
// barra fina debajo, de mayor a menor. En columnas los nombres se cortaban.
const CSS = `
  .gii-filas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
  .gii-fila { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 12px; align-items: baseline; font-size: 13.5px; }
  .gii-fila > span:first-child { color: var(--color-body); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gii-fila > b { color: var(--color-text); font-weight: 600; }
  .gii-fila > b small { font-family: inherit; font-weight: 500; color: var(--color-muted); margin-left: 4px; }
  .gii-barra { grid-column: 1 / -1; height: 8px; border-radius: 4px; background: var(--color-surface-alt); overflow: hidden; }
  .gii-barra > i { display: block; height: 100%; border-radius: 4px; background: var(--color-primary); }
  .gii-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 14px; }
  @media (max-width: 900px) { .gii-grid { grid-template-columns: minmax(0, 1fr); } }
`

interface Venta { fecha: string; monto: number; planId: string }

/** Las ventas entre dos fechas: cada plan vendido o renovado (por la fecha en que arrancó) y cada clase suelta reservada. */
function ventasEntre(negocio: NegocioGym, socios: Socio[], inscripciones: Inscripcion[], desde: ISO, hasta: ISO): Venta[] {
  const out: Venta[] = []
  // Se agrupa por id de plan y no por nombre: dos planes pueden llamarse igual.
  for (const s of socios) {
    const p = planDe(negocio, s.planId)
    if (!p || !s.desde || p.precio <= 0) continue
    const primera = s.alta && s.alta < s.desde ? s.alta : s.desde
    for (let f = s.desde; f >= primera && f >= desde; f = sumarDias(f, -p.vigenciaDias)) {
      if (f <= hasta) out.push({ fecha: f, monto: p.precio, planId: p.id })
    }
  }
  // La lista de espera no cuenta: esa clase todavía no se cobró.
  for (const i of inscripciones) {
    const p = planDe(negocio, i.planId)
    if (p?.tipo === 'suelta' && i.estado !== 'cancelada' && i.estado !== 'espera' && i.creada >= desde && i.creada <= hasta) out.push({ fecha: i.creada, monto: p.precio, planId: p.id })
  }
  return out
}

/**
 * Ocupación: anotados sobre cupo en las clases del período que ya pasaron. Por actividad,
 * también. Antes de `primerDia` (el primer día con historial: la demo trae un mes para atrás,
 * y un negocio real lo tiene desde que usa Órbita) la grilla no cuenta: si no, el período
 * anterior salía en cero y la variación inventaba una suba. Sin clases con historial, `total`
 * es null y no se compara.
 */
function ocupacionEntre(negocio: NegocioGym, inscripciones: Inscripcion[], desde: ISO, hasta: ISO, primerDia: ISO) {
  const fin = hasta < HOY ? hasta : HOY
  const porActividad = new Map<string, { anotados: number; cupo: number }>()
  let anotados = 0, cupo = 0
  for (let f = desde < primerDia ? primerDia : desde; f <= fin; f = sumarDias(f, 1)) {
    for (const c of negocio.clases.filter(x => x.dia === diaSemana(f))) {
      const k = cupoDe(c, f, inscripciones)
      anotados += k.anotados; cupo += k.cupo
      const a = porActividad.get(c.actividadId) ?? { anotados: 0, cupo: 0 }
      porActividad.set(c.actividadId, { anotados: a.anotados + k.anotados, cupo: a.cupo + k.cupo })
    }
  }
  return { total: cupo ? anotados / cupo : null, porActividad }
}

/** Variación en % contra el valor anterior (solo se llama con `antes` > 0: sin anterior no se inventa un %). */
const variacion = (ahora: number, antes: number) => ((ahora - antes) / antes) * 100

export default function Ingresos({ negocio, inscripciones, socios }: { negocio: NegocioGym; inscripciones: Inscripcion[]; socios: Socio[] }) {
  const r = rubroPorKey(negocio.rubro)
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  // El período elegido y, para comparar, el anterior: el mes pasado para este mes, los tres
  // meses de antes para el trimestre. Si el período todavía corre, se compara el mismo tramo
  // (lo que va de noviembre contra el 1 al 14 de octubre, no contra octubre entero: a mitad
  // de mes, "Ingresos" daba una caída del 40 % que no existía).
  const { desde, hasta, desdeAnt, hastaAnt } = useMemo(() => {
    const primero = `${HOY.slice(0, 7)}-01`
    const finMes = (p: string) => sumarDias(`${sumarDias(p, 32).slice(0, 7)}-01`, -1)
    let d = primero, h = finMes(primero), dAnt = mesAnterior(primero)
    if (periodo === 'anterior') { d = mesAnterior(primero); h = finMes(d); dAnt = mesAnterior(d) }
    // Este mes y los dos anteriores (con -62 días desde el 1 se caía en el cuarto mes).
    if (periodo === 'trimestre') { d = mesAnterior(mesAnterior(primero)); dAnt = mesAnterior(mesAnterior(mesAnterior(d))) }
    const hAnt = sumarDias(d, -1)
    return { desde: d, hasta: h, desdeAnt: dAnt, hastaAnt: h <= HOY ? hAnt : minFecha(hAnt, sumarDias(dAnt, diasEntre(d, HOY))) }
  }, [periodo])
  /** "1 al 14 de octubre": con qué se compara, en las notas de los indicadores. */
  const comparado = rangoTxt(desdeAnt, hastaAnt)

  const ventas = useMemo(() => ventasEntre(negocio, socios, inscripciones, desde, hasta), [negocio, socios, inscripciones, desde, hasta])
  const ventasAnt = useMemo(() => ventasEntre(negocio, socios, inscripciones, desdeAnt, hastaAnt), [negocio, socios, inscripciones, desdeAnt, hastaAnt])
  const total = ventas.reduce((s, v) => s + v.monto, 0)
  const totalAnt = ventasAnt.reduce((s, v) => s + v.monto, 0)
  const activos = socios.filter(s => ['vigente', 'por-vencer'].includes(estadoPlanDe(s))).length
  // Quiénes estaban al día cuando arrancó el período: desde su alta venían renovando, y su plan de ahora venció después de esa fecha.
  const activosAlInicio = socios.filter(s => s.planId && s.vence && s.vence >= desde && (s.alta ?? s.desde ?? '9999') <= desde).length
  const vencen = socios.filter(s => estadoPlanDe(s) === 'por-vencer').length
  // El primer día con historial: antes no hay nada que comparar (ver ocupacionEntre).
  const primerDia = useMemo(() => inscripciones.reduce((m, i) => (i.fecha < m ? i.fecha : m), HOY), [inscripciones])
  const ocupacion = useMemo(() => ocupacionEntre(negocio, inscripciones, desde, hasta, primerDia), [negocio, inscripciones, desde, hasta, primerDia])
  const ocupacionAnt = useMemo(() => ocupacionEntre(negocio, inscripciones, desdeAnt, hastaAnt, primerDia), [negocio, inscripciones, desdeAnt, hastaAnt, primerDia])

  // Las semanas del período hasta la de hoy: las que vienen todavía no vendieron nada y en cero parecían una caída.
  const semanas = useMemo(() => {
    const out: { rotulo: string; valor: number }[] = []
    const tope = hasta < HOY ? hasta : HOY
    let lunes = sumarDias(desde, -diaSemana(desde))
    while (lunes <= tope) {
      const fin = sumarDias(lunes, 7)
      out.push({ rotulo: fechaCorta(lunes).slice(4), valor: ventas.filter(v => v.fecha >= lunes && v.fecha < fin).reduce((s, v) => s + v.monto, 0) })
      lunes = fin
    }
    return out
  }, [ventas, desde, hasta])
  const porPlan = negocio.planes.filter(p => p.precio > 0).map(p => ({ id: p.id, nombre: p.nombre, valor: ventas.filter(v => v.planId === p.id).reduce((s, v) => s + v.monto, 0) })).sort((a, b) => b.valor - a.valor)
  const maxPlan = Math.max(1, ...porPlan.map(p => p.valor))
  const porActividad = negocio.actividades.map(a => { const k = ocupacion.porActividad.get(a.id); return { id: a.id, nombre: a.nombre, pct: k?.cupo ? Math.round((k.anotados / k.cupo) * 100) : 0, clases: negocio.clases.filter(c => c.actividadId === a.id).length } }).sort((a, b) => b.pct - a.pct)
  // Asistencia por día de la semana en el período: quién vino sobre quién tenía que venir. Para ver qué día se falta más.
  const porDia = useMemo(() => {
    const fin = hasta < HOY ? hasta : HOY
    const delPeriodo = inscripciones.filter(i => i.fecha >= desde && i.fecha <= fin && (i.estado === 'asistio' || i.estado === 'ausente'))
    return [0, 1, 2, 3, 4, 5, 6].filter(d => negocio.clases.some(c => c.dia === d)).map(d => {
      const del = delPeriodo.filter(i => diaSemana(i.fecha) === d)
      const vino = del.filter(i => i.estado === 'asistio').length
      return { id: d, nombre: DIAS_SEMANA[d], pct: del.length ? Math.round((vino / del.length) * 100) : 0, vino, total: del.length }
    })
  }, [inscripciones, negocio.clases, desde, hasta])

  return (
    <div className="rv-pagina">
      <style>{CSS}</style>
      <Encabezado rotulo={`${fechaCorta(desde)} al ${fechaCorta(hasta)}`} titulo="Ingresos" bajada="Planes vendidos y renovados y clases sueltas, por la fecha en que se pagaron, comparados con el período anterior. Los cobros se registran a mano."
        acciones={<Segmentado label="Período" valor={periodo} onChange={setPeriodo} opciones={PERIODOS} />} />
      <div className="gip-kpis">
        <KpiGym i={0} label="Ingresos" valor={pesos(total)} Icon={HandCoins} delta={totalAnt > 0 ? { valor: variacion(total, totalAnt) } : undefined} nota={`${ventas.length} ${ventas.length === 1 ? 'venta' : 'ventas'} · ${totalAnt > 0 ? `vs. ${comparado}` : 'sin ventas en el período anterior'}`} />
        <KpiGym i={1} label={`${r.socios} al día`} valor={String(activos)} Icon={UserCheck} tono="ok" delta={{ valor: activos - activosAlInicio, unidades: true }} nota={`de ${socios.length} · desde que arrancó el período`} />
        <KpiGym i={2} label="Vencen en 7 días" valor={String(vencen)} Icon={BellRing} tono="aviso" nota={vencen ? 'para renovar esta semana' : 'nadie por ahora'} />
        <KpiGym i={3} label="Ocupación" valor={ocupacion.total === null ? '—' : `${Math.round(ocupacion.total * 100)}%`} Icon={Percent}
          delta={ocupacion.total !== null && ocupacionAnt.total !== null ? { valor: Math.round((ocupacion.total - ocupacionAnt.total) * 100), unidades: true } : undefined}
          nota={ocupacion.total === null ? 'todavía no pasó ninguna clase del período' : ocupacionAnt.total !== null ? `puntos vs. ${comparado} · lugares tomados sobre el cupo` : `lugares tomados sobre el cupo · sin historial antes del ${fechaCorta(primerDia)}`} />
      </div>
      <div className="gii-grid">
        <section className="rv-card rv-card--pad">
          <h2 className="rv-h2" style={{ marginBottom: 4 }}>Por semana</h2>
          <p className="rv-ayuda" style={{ marginBottom: 10 }}>Lo vendido semana por semana, hasta hoy. Tocá una columna para ver su monto.</p>
          <Barras datos={semanas} formato={pesos} label="Ingresos por semana" />
        </section>
        <section className="rv-card rv-card--pad">
          <h2 className="rv-h2" style={{ marginBottom: 4 }}>Por plan</h2>
          <p className="rv-ayuda" style={{ marginBottom: 14 }}>Qué plan aporta más en el período.</p>
          <ul className="gii-filas">
            {porPlan.map(p => (
              <li key={p.id} className="gii-fila">
                <span>{p.nombre}</span>
                <b className="rv-num">{pesos(p.valor)}</b>
                <span className="gii-barra" aria-hidden><i style={{ width: `${p.valor ? Math.max(2, Math.round((p.valor / maxPlan) * 100)) : 0}%` }} /></span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rv-card rv-card--pad">
          <h2 className="rv-h2" style={{ marginBottom: 4 }}>Ocupación por actividad</h2>
          <p className="rv-ayuda" style={{ marginBottom: 14 }}>Lugares tomados sobre el cupo, en las clases que ya pasaron. Lo que se llena pide más horarios.</p>
          <ul className="gii-filas">
            {porActividad.map(a => (
              <li key={a.id} className="gii-fila">
                <span>{a.nombre}</span>
                <b className="rv-num">{a.pct}%<small>{a.clases} {a.clases === 1 ? 'clase/sem' : 'clases/sem'}</small></b>
                <span className="gii-barra" aria-hidden><i style={{ width: `${Math.max(a.pct ? 2 : 0, a.pct)}%` }} /></span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rv-card rv-card--pad">
          <h2 className="rv-h2" style={{ marginBottom: 4 }}>Asistencia por día</h2>
          <p className="rv-ayuda" style={{ marginBottom: 14 }}>Quién vino sobre quién tenía reservado, por día de la semana. Donde baja, conviene el recordatorio.</p>
          <ul className="gii-filas">
            {porDia.map(d => (
              <li key={d.id} className="gii-fila">
                <span>{d.nombre}</span>
                <b className="rv-num">{d.total ? `${d.pct}%` : '—'}<small>{d.vino} de {d.total}</small></b>
                <span className="gii-barra" aria-hidden><i style={{ width: `${Math.max(d.pct ? 2 : 0, d.pct)}%` }} /></span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
