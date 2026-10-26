// Ingresos: cuánto entró, cuántas reservas, qué seña falta cobrar y qué tan
// ocupado está el negocio, en el período elegido. Una serie por semana y
// otra por unidad, con el acento del sistema: alcanza para leerlo de un
// vistazo y queda igual en claro y en oscuro.
//
// Sin useMemo: son cuentas chicas y react-compiler ya memoiza el componente;
// a mano no se podía, porque las listas se arman en cada render.
import { useState } from 'react'
import { diasEntre, fechaCorta, moverMes, sumarDias, diaSemana, type ISO } from '@/lib/reservas/fechas'
import { pesos } from '@/lib/reservas/precio'
import { HOY, bloquesDe, fechaDeReserva, unidadesDe, type NegocioAlquiler, type Reserva } from '../datos'
import { Barras, Encabezado, Filtros, Kpi, Segmentado } from '@/design-system/reservas/piezas'

type Periodo = 'mes' | 'anterior' | 'trimestre'
const PERIODOS: { id: Periodo; label: string }[] = [{ id: 'mes', label: 'Este mes' }, { id: 'anterior', label: 'Mes pasado' }, { id: 'trimestre', label: 'Últimos 3 meses' }]

/** Primer y último día del período, contando desde el mes de HOY. Los tres meses son este y los dos anteriores. */
function periodoDe(p: Periodo): [ISO, ISO] {
  const primero = moverMes(HOY, 0)
  const finDeMes = sumarDias(moverMes(HOY, 1), -1)
  if (p === 'mes') return [primero, finDeMes]
  if (p === 'anterior') return [moverMes(HOY, -1), sumarDias(primero, -1)]
  return [moverMes(HOY, -2), finDeMes]
}

export default function Ingresos({ negocio, reservas }: { negocio: NegocioAlquiler; reservas: Reserva[] }) {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [desde, hasta] = periodoDe(periodo)
  const enPeriodo = reservas.filter(r => { const f = fechaDeReserva(r); return f >= desde && f <= hasta })
  const cobradas = enPeriodo.filter(r => r.estado === 'confirmada' || r.estado === 'completada')
  const facturado = cobradas.reduce((s, r) => s + r.total, 0)
  const senaPendiente = enPeriodo.filter(r => r.estado === 'pendiente').reduce((s, r) => s + r.sena, 0)
  const saldoPendiente = cobradas.filter(r => !r.saldoPagado && fechaDeReserva(r) < HOY).reduce((s, r) => s + (r.total - r.sena), 0)
  const ocupacion = calcularOcupacion(negocio, cobradas, desde, hasta)

  // Por semana: las semanas del período, con el lunes como rótulo.
  const semanas: { rotulo: string; valor: number }[] = []
  for (let lunes = sumarDias(desde, -diaSemana(desde)); lunes <= hasta; lunes = sumarDias(lunes, 7)) {
    const fin = sumarDias(lunes, 7)
    semanas.push({ rotulo: fechaCorta(lunes).slice(4), valor: cobradas.filter(r => fechaDeReserva(r) >= lunes && fechaDeReserva(r) < fin).reduce((s, r) => s + r.total, 0) })
  }
  const suma = (lista: Reserva[]) => lista.reduce((s, r) => s + r.total, 0)
  // En el salón, por bloque (tarde, noche…) con los nombres que salen de su configuración.
  const porParte = negocio.tipo === 'bloque'
    ? bloquesDe(negocio).map(b => ({ rotulo: b.nombre, valor: suma(cobradas.filter(r => r.bloqueId === b.id)) }))
    : unidadesDe(negocio).map(u => ({ rotulo: u.nombre, valor: suma(cobradas.filter(r => r.unidadId === u.id)) }))

  return (
    <div className="rv-pagina">
      <Encabezado rotulo={`${fechaCorta(desde)} al ${fechaCorta(hasta)}`} titulo="Ingresos" bajada="Lo facturado cuenta las reservas confirmadas y realizadas. La seña pendiente es plata que todavía no entró."
        acciones={<Filtros resumen={PERIODOS.find(p => p.id === periodo)?.label}><Segmentado label="Período" valor={periodo} onChange={setPeriodo} opciones={PERIODOS} /></Filtros>} />
      <div className="rv-kpis" style={{ marginBottom: 16 }}>
        <Kpi i={0} label="Facturado" valor={pesos(facturado)} nota={`${cobradas.length} ${cobradas.length === 1 ? 'reserva' : 'reservas'}`} />
        <Kpi i={1} label="Ocupación" valor={`${Math.round(ocupacion * 100)}%`} nota={negocio.tipo === 'estadia' ? 'noches ocupadas hasta hoy' : negocio.tipo === 'bloque' ? 'bloques tomados hasta hoy' : 'horas reservadas hasta hoy'} />
        <Kpi i={2} label="Seña pendiente" valor={pesos(senaPendiente)} nota={senaPendiente ? 'si no se paga, el lugar se libera' : 'todo al día'} />
        <Kpi i={3} label="Saldo por cobrar" valor={pesos(saldoPendiente)} nota="de reservas ya realizadas" />
      </div>
      <div className="rv-grid rv-grid--2">
        <section className="rv-card rv-card--pad">
          <h2 className="rv-h2" style={{ marginBottom: 4 }}>Por semana</h2>
          <p className="rv-ayuda" style={{ marginBottom: 10 }}>Semana por semana, por la fecha de la reserva.</p>
          <Barras datos={semanas} formato={pesos} label="Facturado por semana" />
        </section>
        <section className="rv-card rv-card--pad">
          <h2 className="rv-h2" style={{ marginBottom: 4 }}>Por {negocio.tipo === 'estadia' ? 'propiedad' : negocio.tipo === 'bloque' ? 'bloque' : 'cancha'}</h2>
          <p className="rv-ayuda" style={{ marginBottom: 10 }}>Qué parte del total aporta cada una.</p>
          <Barras datos={porParte} formato={pesos} label={negocio.tipo === 'bloque' ? 'Facturado por bloque' : 'Facturado por unidad'} />
        </section>
      </div>
    </div>
  )
}

/** Qué parte de lo disponible se reservó: horas, bloques o noches, según el modo. Solo mira hasta hoy. */
function calcularOcupacion(n: NegocioAlquiler, cobradas: Reserva[], desde: ISO, hasta: ISO): number {
  const fin = hasta < HOY ? hasta : HOY
  const dias = Math.max(0, diasEntre(desde, fin) + 1)
  if (!dias) return 0
  if (n.tipo === 'estadia') {
    // Las noches van de `desde` a `fin` inclusive: la de `fin` también cuenta, por eso el tope es el día siguiente.
    const tope = sumarDias(fin, 1)
    const disponibles = dias * n.propiedades.length
    const ocupadas = cobradas.reduce((s, r) => s + (r.entrada && r.salida ? Math.max(0, diasEntre(r.entrada < desde ? desde : r.entrada, r.salida > tope ? tope : r.salida)) : 0), 0)
    return disponibles ? Math.min(1, ocupadas / disponibles) : 0
  }
  const abiertos = Array.from({ length: dias }, (_, i) => sumarDias(desde, i)).filter(f => n.apertura.dias.includes(diaSemana(f))).length
  if (n.tipo === 'bloque' && n.salon) {
    const disponibles = abiertos * bloquesDe(n).length
    return disponibles ? Math.min(1, cobradas.filter(r => (r.fecha ?? '') <= fin).length / disponibles) : 0
  }
  const horasDisponibles = (abiertos * (n.apertura.hasta - n.apertura.desde) * n.unidades.length) / 60
  const horasReservadas = cobradas.filter(r => (r.fecha ?? '') <= fin).reduce((s, r) => s + ((r.fin ?? 0) - (r.inicio ?? 0)) / 60, 0)
  return horasDisponibles ? Math.min(1, horasReservadas / horasDisponibles) : 0
}
