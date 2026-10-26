// Ingresos del gimnasio: lo que entró por planes y clases sueltas, cuántos
// socios están al día, cuántos vencen esta semana y qué tan llenas van las
// clases. Las ventas se cuentan por la fecha en que arrancó el plan: la compra
// del plan de ahora y, para atrás, una renovación por vigencia desde que la
// persona es socia (su alta).
import { useMemo, useState } from 'react'
import { diaSemana, fechaCorta, sumarDias } from '@/lib/reservas/fechas'
import { pesos } from '@/lib/reservas/precio'
import { HOY, cupoDe, estadoPlanDe, planDe, type Inscripcion, type NegocioGym, type Socio } from '../datos'
import { Barras, Encabezado, Kpi, Segmentado } from '@/design-system/reservas/piezas'

type Periodo = 'mes' | 'anterior' | 'trimestre'
const PERIODOS: { id: Periodo; label: string }[] = [{ id: 'mes', label: 'Este mes' }, { id: 'anterior', label: 'Mes pasado' }, { id: 'trimestre', label: 'Últimos 3 meses' }]

/** El primer día del mes anterior al de `primero` (que es un día 1). */
const mesAnterior = (primero: string) => `${sumarDias(primero, -1).slice(0, 7)}-01`

// "Por plan" va en filas (nombre, monto y una barra fina), de mayor a menor:
// los nombres de los planes son largos y en columnas se cortaban.
const CSS = `
  .gii-planes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
  .gii-plan { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 12px; align-items: baseline; font-size: 13.5px; }
  .gii-plan > span:first-child { color: var(--color-body); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gii-plan > b { color: var(--color-text); font-weight: 600; }
  .gii-plan-barra { grid-column: 1 / -1; height: 8px; border-radius: 4px; background: var(--color-surface-alt); overflow: hidden; }
  .gii-plan-barra > i { display: block; height: 100%; border-radius: 4px; background: var(--color-primary); }
`

export default function Ingresos({ negocio, inscripciones, socios }: { negocio: NegocioGym; inscripciones: Inscripcion[]; socios: Socio[] }) {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [desde, hasta] = useMemo((): [string, string] => {
    const primero = `${HOY.slice(0, 7)}-01`
    const finMes = (p: string) => sumarDias(`${sumarDias(p, 32).slice(0, 7)}-01`, -1)
    if (periodo === 'mes') return [primero, finMes(primero)]
    if (periodo === 'anterior') { const p = mesAnterior(primero); return [p, finMes(p)] }
    // Este mes y los dos anteriores (con -62 días desde el 1 se caía en el cuarto mes).
    return [mesAnterior(mesAnterior(primero)), finMes(primero)]
  }, [periodo])

  // Ventas: cada plan vendido o renovado (por la fecha en que arrancó) y cada clase suelta reservada.
  // Se agrupa por id de plan y no por nombre: dos planes pueden llamarse igual.
  // La lista de espera no cuenta: esa clase todavía no se cobró.
  const ventas = useMemo(() => {
    const out: { fecha: string; monto: number; planId: string }[] = []
    for (const s of socios) {
      const p = planDe(negocio, s.planId)
      if (!p || !s.desde || p.precio <= 0) continue
      const primera = s.alta && s.alta < s.desde ? s.alta : s.desde
      for (let f = s.desde; f >= primera && f >= desde; f = sumarDias(f, -p.vigenciaDias)) {
        if (f <= hasta) out.push({ fecha: f, monto: p.precio, planId: p.id })
      }
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

  return (
    <div className="rv-pagina">
      <style>{CSS}</style>
      <Encabezado rotulo={`${fechaCorta(desde)} al ${fechaCorta(hasta)}`} titulo="Ingresos" bajada="Planes vendidos y renovados y clases sueltas, por la fecha en que se pagaron. Los cobros se registran a mano."
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
          <p className="rv-ayuda" style={{ marginBottom: 10 }}>Lo vendido semana por semana, hasta hoy. Tocá una columna para ver su monto.</p>
          <Barras datos={semanas} formato={pesos} label="Ingresos por semana" />
        </section>
        <section className="rv-card rv-card--pad">
          <h2 className="rv-h2" style={{ marginBottom: 4 }}>Por plan</h2>
          <p className="rv-ayuda" style={{ marginBottom: 14 }}>Qué plan aporta más.</p>
          <ul className="gii-planes">
            {porPlan.map(p => (
              <li key={p.id} className="gii-plan">
                <span>{p.nombre}</span>
                <b className="rv-num">{pesos(p.valor)}</b>
                <span className="gii-plan-barra" aria-hidden><i style={{ width: `${p.valor ? Math.max(2, Math.round((p.valor / maxPlan) * 100)) : 0}%` }} /></span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
