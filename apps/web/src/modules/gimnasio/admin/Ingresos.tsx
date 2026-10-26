// Ingresos del gimnasio: lo que entró por planes y clases sueltas, cuántos
// socios están al día, cuántos vencen esta semana y qué tan llenas van las
// clases. Las ventas se cuentan por la fecha en que arrancó el plan.
import { useMemo, useState } from 'react'
import { diaSemana, fechaCorta, sumarDias } from '@/lib/reservas/fechas'
import { pesos } from '@/lib/reservas/precio'
import { HOY, cupoDe, estadoPlanDe, planDe, type Inscripcion, type NegocioGym, type Socio } from '../datos'
import { Barras, Encabezado, Kpi, Segmentado } from '@/design-system/reservas/piezas'

type Periodo = 'mes' | 'anterior' | 'trimestre'
const PERIODOS: { id: Periodo; label: string }[] = [{ id: 'mes', label: 'Este mes' }, { id: 'anterior', label: 'Mes pasado' }, { id: 'trimestre', label: 'Últimos 3 meses' }]

export default function Ingresos({ negocio, inscripciones, socios }: { negocio: NegocioGym; inscripciones: Inscripcion[]; socios: Socio[] }) {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [desde, hasta] = useMemo((): [string, string] => {
    const primero = `${HOY.slice(0, 7)}-01`
    const finMes = (p: string) => sumarDias(`${sumarDias(p, 32).slice(0, 7)}-01`, -1)
    if (periodo === 'mes') return [primero, finMes(primero)]
    if (periodo === 'anterior') { const p = `${sumarDias(primero, -1).slice(0, 7)}-01`; return [p, finMes(p)] }
    return [`${sumarDias(primero, -62).slice(0, 7)}-01`, finMes(primero)]
  }, [periodo])

  // Ventas: cada plan vendido (por la fecha en que arrancó) y cada clase suelta reservada.
  // Se agrupa por id de plan y no por nombre: dos planes pueden llamarse igual.
  // La lista de espera no cuenta: esa clase todavía no se cobró.
  const ventas = useMemo(() => {
    const out: { fecha: string; monto: number; planId: string }[] = []
    for (const s of socios) {
      const p = planDe(negocio, s.planId)
      if (p && s.desde && s.desde >= desde && s.desde <= hasta && p.precio > 0) out.push({ fecha: s.desde, monto: p.precio, planId: p.id })
    }
    for (const i of inscripciones) {
      const p = planDe(negocio, i.planId)
      if (p?.tipo === 'suelta' && i.estado !== 'cancelada' && i.estado !== 'espera' && i.creada >= desde && i.creada <= hasta) out.push({ fecha: i.creada, monto: p.precio, planId: p.id })
    }
    return out
  }, [socios, inscripciones, negocio, desde, hasta])
  const total = ventas.reduce((s, v) => s + v.monto, 0)
  const activos = socios.filter(s => ['vigente', 'por-vencer'].includes(estadoPlanDe(s))).length
  const vencen = socios.filter(s => estadoPlanDe(s) === 'por-vencer').length

  // Ocupación: anotados sobre cupo, en las clases del período que ya pasaron.
  const ocupacion = useMemo(() => {
    const fin = hasta < HOY ? hasta : HOY
    let anotados = 0, cupo = 0
    for (let f = desde; f <= fin; f = sumarDias(f, 1)) {
      for (const c of negocio.clases.filter(x => x.dia === diaSemana(f))) { const k = cupoDe(c, f, inscripciones); anotados += k.anotados; cupo += k.cupo }
    }
    return cupo ? anotados / cupo : 0
  }, [negocio.clases, inscripciones, desde, hasta])

  const semanas = useMemo(() => {
    const out: { rotulo: string; valor: number }[] = []
    let lunes = sumarDias(desde, -diaSemana(desde))
    while (lunes <= hasta) {
      const fin = sumarDias(lunes, 7)
      out.push({ rotulo: fechaCorta(lunes).slice(4), valor: ventas.filter(v => v.fecha >= lunes && v.fecha < fin).reduce((s, v) => s + v.monto, 0) })
      lunes = fin
    }
    return out
  }, [ventas, desde, hasta])
  const porPlan = negocio.planes.filter(p => p.precio > 0).map(p => ({ rotulo: p.nombre.replace(' por semana', '/sem'), valor: ventas.filter(v => v.planId === p.id).reduce((s, v) => s + v.monto, 0) }))

  return (
    <div className="rv-pagina">
      <Encabezado rotulo={`${fechaCorta(desde)} al ${fechaCorta(hasta)}`} titulo="Ingresos" bajada="Planes vendidos y clases sueltas, por la fecha en que se pagaron. Los cobros se registran a mano."
        acciones={<Segmentado label="Período" valor={periodo} onChange={setPeriodo} opciones={PERIODOS} />} />
      <div className="rv-kpis" style={{ marginBottom: 16 }}>
        <Kpi i={0} label="Ingresos" valor={pesos(total)} nota={`${ventas.length} ${ventas.length === 1 ? 'venta' : 'ventas'}`} />
        <Kpi i={1} label="Socios al día" valor={activos} nota={`de ${socios.length} en total`} />
        <Kpi i={2} label="Vencen en 7 días" valor={vencen} nota={vencen ? 'para renovar esta semana' : 'nadie por ahora'} />
        <Kpi i={3} label="Ocupación" valor={`${Math.round(ocupacion * 100)}%`} nota="lugares tomados sobre el cupo" />
      </div>
      <div className="rv-grid rv-grid--2">
        <section className="rv-card rv-card--pad">
          <h2 className="rv-h2" style={{ marginBottom: 4 }}>Por semana</h2>
          <p className="rv-ayuda" style={{ marginBottom: 10 }}>Lo vendido semana por semana.</p>
          <Barras datos={semanas} formato={pesos} label="Ingresos por semana" />
        </section>
        <section className="rv-card rv-card--pad">
          <h2 className="rv-h2" style={{ marginBottom: 4 }}>Por plan</h2>
          <p className="rv-ayuda" style={{ marginBottom: 10 }}>Qué plan aporta más.</p>
          <Barras datos={porPlan} formato={pesos} label="Ingresos por plan" />
        </section>
      </div>
    </div>
  )
}
