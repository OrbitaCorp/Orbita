// Ingresos: cuánto entró, cuántas reservas, qué tan ocupado está el negocio y
// qué falta cobrar, en el período elegido y contra el período anterior. Dos
// series con un solo color (el acento del sistema): por semana y por cancha,
// bloque o propiedad; una tercera según el modo (las franjas más reservadas
// en canchas, los paquetes en el salón, las llegadas y salidas en la estadía);
// y la lista de lo que falta cobrar, que abre cada reserva para registrar el
// pago. Las variaciones se miden contra el período anterior del mismo largo;
// sin datos previos no se inventa un porcentaje.
//
// Sin useMemo: son cuentas chicas y react-compiler ya memoiza el componente;
// a mano no se podía, porque las listas se arman en cada render.
import { useState } from 'react'
import { CalendarCheck, Gauge, HandCoins, LogIn, LogOut, Wallet } from 'lucide-react'
import { diaSemana, diasEntre, fechaCorta, fechaRelativa, hhmm, moverMes, rangoTxt, sumarDias, type ISO } from '@/lib/reservas/fechas'
import { pesos } from '@/lib/reservas/precio'
import { Barras, Chip, Encabezado, Filtros, Kpi, Segmentado } from '@/design-system/reservas/piezas'
import { HOY, bloquesDe, clientePorId, cuenta, fechaDeReserva, tituloEvento, unidadPorId, unidadesDe, type Cliente, type NegocioAlquiler, type Reserva } from '../datos'

type Periodo = 'mes' | 'anterior' | 'trimestre'
const PERIODOS: { id: Periodo; label: string }[] = [{ id: 'mes', label: 'Este mes' }, { id: 'anterior', label: 'Mes pasado' }, { id: 'trimestre', label: 'Últimos 3 meses' }]
const VS: Record<Periodo, string> = { mes: 'el mes pasado', anterior: 'el mes anterior', trimestre: 'los 3 meses anteriores' }

/** Primer y último día del período, contando desde el mes de HOY. Los tres meses son este y los dos anteriores. */
function periodoDe(p: Periodo): [ISO, ISO] {
  const primero = moverMes(HOY, 0)
  const finDeMes = sumarDias(moverMes(HOY, 1), -1)
  if (p === 'mes') return [primero, finDeMes]
  if (p === 'anterior') return [moverMes(HOY, -1), sumarDias(primero, -1)]
  return [moverMes(HOY, -2), finDeMes]
}

/** El período de antes, del mismo largo: contra ese se mide la variación. */
function periodoAnterior(p: Periodo): [ISO, ISO] {
  if (p === 'mes') return [moverMes(HOY, -1), sumarDias(moverMes(HOY, 0), -1)]
  if (p === 'anterior') return [moverMes(HOY, -2), sumarDias(moverMes(HOY, -1), -1)]
  return [moverMes(HOY, -5), sumarDias(moverMes(HOY, -2), -1)]
}

/** Variación en %, o null si antes no hubo nada: no se inventa un porcentaje contra cero. */
const variacion = (ahora: number, antes: number) => (antes > 0 ? ((ahora - antes) / antes) * 100 : null)

function resumir(n: NegocioAlquiler, reservas: Reserva[], desde: ISO, hasta: ISO) {
  const enPeriodo = reservas.filter(r => { const f = fechaDeReserva(r); return f >= desde && f <= hasta })
  const cobradas = enPeriodo.filter(r => r.estado === 'confirmada' || r.estado === 'completada')
  return { cobradas, facturado: cobradas.reduce((s, r) => s + r.total, 0), ocupacion: calcularOcupacion(n, cobradas, desde, hasta) }
}

export default function Ingresos({ negocio, reservas, clientes, onAbrirReserva }: { negocio: NegocioAlquiler; reservas: Reserva[]; clientes: Cliente[]; onAbrirReserva: (id: string) => void }) {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [desde, hasta] = periodoDe(periodo)
  const [desdeAntes, hastaAntes] = periodoAnterior(periodo)
  const ahora = resumir(negocio, reservas, desde, hasta)
  const antes = resumir(negocio, reservas, desdeAntes, hastaAntes)
  const tipo = negocio.tipo
  const nombre = (r: Reserva) => clientePorId(r.clienteId, clientes)?.nombre ?? '—'
  const donde = (r: Reserva) => unidadPorId(negocio, r.unidadId)?.nombre ?? negocio.nombre
  const cuando = (r: Reserva) => (r.entrada && r.salida ? rangoTxt(r.entrada, r.salida) : `${fechaCorta(r.fecha ?? HOY)} ${hhmm(r.inicio ?? 0)}`)

  // Lo que falta cobrar, de cualquier fecha: señas que no entraron (si no se pagan, la reserva se cae) y saldos de reservas ya realizadas.
  const senas = reservas.filter(r => r.estado === 'pendiente' && fechaDeReserva(r) >= HOY).map(r => ({ r, que: 'Seña', monto: r.sena }))
  const saldos = reservas.filter(r => r.estado === 'confirmada' && !r.saldoPagado && r.total - r.sena > 0 && fechaDeReserva(r) < HOY).map(r => ({ r, que: 'Saldo', monto: r.total - r.sena }))
  const porCobrar = [...senas, ...saldos].sort((a, b) => fechaDeReserva(a.r).localeCompare(fechaDeReserva(b.r)))
  const totalSenas = senas.reduce((s, x) => s + x.monto, 0)
  const totalSaldos = saldos.reduce((s, x) => s + x.monto, 0)

  // Por semana: las semanas del período, con el lunes como rótulo.
  const semanas: { rotulo: string; valor: number }[] = []
  for (let lunes = sumarDias(desde, -diaSemana(desde)); lunes <= hasta; lunes = sumarDias(lunes, 7)) {
    const fin = sumarDias(lunes, 7)
    semanas.push({ rotulo: fechaCorta(lunes).slice(4), valor: ahora.cobradas.filter(r => fechaDeReserva(r) >= lunes && fechaDeReserva(r) < fin).reduce((s, r) => s + r.total, 0) })
  }
  const suma = (lista: Reserva[]) => lista.reduce((s, r) => s + r.total, 0)
  // En el salón, por bloque (tarde, noche…) con los nombres que salen de su configuración.
  const porParte = tipo === 'bloque'
    ? bloquesDe(negocio).map(b => ({ rotulo: b.nombre, valor: suma(ahora.cobradas.filter(r => r.bloqueId === b.id)) }))
    : unidadesDe(negocio).map(u => ({ rotulo: u.nombre, valor: suma(ahora.cobradas.filter(r => r.unidadId === u.id)) }))
  // Canchas: horas reservadas por franja de tres horas (para afinar Precios por horario). Salón: cuántos eventos por paquete.
  const franjas: { rotulo: string; valor: number }[] = []
  if (tipo === 'cancha') {
    for (let h = negocio.apertura.desde; h < negocio.apertura.hasta; h += 180) {
      const fin = Math.min(h + 180, negocio.apertura.hasta)
      const minutos = ahora.cobradas.reduce((s, r) => s + Math.max(0, Math.min(r.fin ?? 0, fin) - Math.max(r.inicio ?? 0, h)), 0)
      franjas.push({ rotulo: `${h / 60}–${fin / 60}`, valor: Math.round(minutos / 60) })
    }
  }
  const paquetes = tipo === 'bloque' ? (negocio.salon?.paquetes ?? []).map(p => ({ rotulo: p.nombre.replace('Hasta ', 'Hasta '), valor: ahora.cobradas.filter(r => r.paqueteId === p.id).length })) : []
  // Estadía: llegadas y salidas de los próximos siete días.
  const enSemana = (f: ISO) => { const d = diasEntre(HOY, f); return d >= 0 && d < 7 }
  const movimientos = tipo === 'estadia'
    ? reservas.filter(r => r.estado !== 'cancelada' && r.entrada && r.salida)
      .flatMap(r => [...(enSemana(r.entrada!) ? [{ r, llega: true, f: r.entrada! }] : []), ...(enSemana(r.salida!) ? [{ r, llega: false, f: r.salida! }] : [])])
      .sort((a, b) => a.f.localeCompare(b.f) || Number(b.llega) - Number(a.llega))
    : []
  const horaDe = (r: Reserva, llega: boolean) => { const p = negocio.propiedades.find(x => x.id === r.unidadId); return hhmm(llega ? p?.checkIn ?? 15 * 60 : p?.checkOut ?? 10 * 60) }

  const ocupacionNota = tipo === 'estadia' ? 'de las noches hasta hoy' : tipo === 'bloque' ? 'de los bloques hasta hoy' : 'de las horas abiertas hasta hoy'

  return (
    <div className="rv-pagina">
      <Encabezado rotulo={`${fechaCorta(desde)} al ${fechaCorta(hasta)}`} titulo="Ingresos" bajada="Lo facturado cuenta las reservas confirmadas y realizadas, por la fecha de la reserva. Cada variación es contra el período anterior."
        acciones={<Filtros resumen={PERIODOS.find(p => p.id === periodo)?.label}><Segmentado label="Período" valor={periodo} onChange={setPeriodo} opciones={PERIODOS} /></Filtros>} />
      <div className="rv-kpis" style={{ marginBottom: 14 }}>
        <Kpi i={0} label="Facturado" Icon={HandCoins} valor={pesos(ahora.facturado)} delta={{ valor: variacion(ahora.facturado, antes.facturado), vs: VS[periodo] }} />
        <Kpi i={1} label={tipo === 'bloque' ? 'Eventos' : 'Reservas'} Icon={CalendarCheck} valor={ahora.cobradas.length} delta={{ valor: antes.cobradas.length ? ahora.cobradas.length - antes.cobradas.length : null, unidades: true, vs: VS[periodo] }} />
        <Kpi i={2} label="Ocupación" Icon={Gauge} valor={`${Math.round(ahora.ocupacion * 100)}%`} delta={{ valor: antes.cobradas.length ? Math.round((ahora.ocupacion - antes.ocupacion) * 100) : null, unidades: true, sufijo: ' pts', vs: VS[periodo] }} nota={ocupacionNota} />
        <Kpi i={3} label="Por cobrar" Icon={Wallet} valor={pesos(totalSenas + totalSaldos)} nota={porCobrar.length ? `${pesos(totalSenas)} de señas · ${pesos(totalSaldos)} de saldos` : 'todo cobrado'} />
      </div>
      <div className="rv-grid rv-grid--2" style={{ marginBottom: 14 }}>
        <section className="rv-card rv-card--pad">
          <h2 className="rv-h2" style={{ marginBottom: 4 }}>Por semana</h2>
          <p className="rv-ayuda" style={{ marginBottom: 10 }}>Semana por semana, por la fecha de la reserva.</p>
          <Barras datos={semanas} formato={pesos} label="Facturado por semana" />
        </section>
        <section className="rv-card rv-card--pad">
          <h2 className="rv-h2" style={{ marginBottom: 4 }}>Por {tipo === 'estadia' ? 'propiedad' : tipo === 'bloque' ? 'bloque' : 'cancha'}</h2>
          <p className="rv-ayuda" style={{ marginBottom: 10 }}>Qué parte del total aporta cada {tipo === 'estadia' ? 'una' : tipo === 'bloque' ? 'uno' : 'una'}.</p>
          <Barras datos={porParte} formato={pesos} label={tipo === 'bloque' ? 'Facturado por bloque' : 'Facturado por unidad'} />
        </section>
      </div>
      <div className="rv-grid rv-grid--2">
        <section className="rv-card rv-card--pad">
          <div className="ala-cab-lista">
            <div style={{ minWidth: 0 }}><h2 className="rv-h2">Por cobrar</h2><p className="rv-ayuda" style={{ margin: '2px 0 0' }}>Señas que no entraron y saldos de reservas ya realizadas. Tocá una para registrar el pago.</p></div>
            <Chip tono={porCobrar.length ? 'aviso' : 'ok'}>{porCobrar.length ? pesos(totalSenas + totalSaldos) : 'Al día'}</Chip>
          </div>
          {porCobrar.length === 0 ? <p className="rv-ayuda" style={{ margin: 0 }}>No hay nada pendiente de cobro.</p> : (
            <div className="rv-lista">
              {porCobrar.slice(0, 8).map(({ r, que, monto }) => (
                <button key={`${que}-${r.id}`} type="button" className="rv-item" onClick={() => onAbrirReserva(r.id)}>
                  <span className="rv-item-cuerpo"><span className="rv-item-titulo">{tipo === 'bloque' ? tituloEvento(r.evento) : nombre(r)}</span><span className="rv-item-sub">{donde(r)} · {cuando(r)}</span></span>
                  <span className="rv-num" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{pesos(monto)}</span>
                  <Chip tono={que === 'Seña' ? 'aviso' : 'gris'}>{que}</Chip>
                </button>
              ))}
              {porCobrar.length > 8 && <p className="rv-ayuda" style={{ margin: '8px 0 0' }}>Y {cuenta(porCobrar.length - 8, 'más', 'más')}: están en la agenda.</p>}
            </div>
          )}
        </section>
        {tipo === 'cancha' && (
          <section className="rv-card rv-card--pad">
            <h2 className="rv-h2" style={{ marginBottom: 4 }}>Horas reservadas por franja</h2>
            <p className="rv-ayuda" style={{ marginBottom: 10 }}>En qué horarios se llenan las canchas: sirve para armar Precios por horario.</p>
            <Barras datos={franjas} formato={v => cuenta(v, 'hora', 'horas')} label="Horas reservadas por franja horaria" />
          </section>
        )}
        {tipo === 'bloque' && (
          <section className="rv-card rv-card--pad">
            <h2 className="rv-h2" style={{ marginBottom: 4 }}>Por paquete</h2>
            <p className="rv-ayuda" style={{ marginBottom: 10 }}>Cuántos eventos eligieron cada paquete.</p>
            <Barras datos={paquetes} formato={v => cuenta(v, 'evento', 'eventos')} label="Eventos por paquete" />
          </section>
        )}
        {tipo === 'estadia' && (
          <section className="rv-card rv-card--pad">
            <div className="ala-cab-lista"><div style={{ minWidth: 0 }}><h2 className="rv-h2">Llegadas y salidas</h2><p className="rv-ayuda" style={{ margin: '2px 0 0' }}>Los próximos siete días, en todas las propiedades.</p></div></div>
            {movimientos.length === 0 ? <p className="rv-ayuda" style={{ margin: 0 }}>Sin llegadas ni salidas esta semana.</p> : (
              <div className="rv-lista">
                {movimientos.slice(0, 10).map(({ r, llega, f }) => (
                  <button key={`${llega ? 'in' : 'out'}-${r.id}`} type="button" className="rv-item" onClick={() => onAbrirReserva(r.id)}>
                    <span className="rv-kpi-ico" aria-hidden style={{ width: 30, height: 30, ...(llega ? {} : { background: 'var(--color-surface-alt)', color: 'var(--color-muted)' }) }}>{llega ? <LogIn size={15} strokeWidth={1.7} /> : <LogOut size={15} strokeWidth={1.7} />}</span>
                    <span className="rv-item-cuerpo"><span className="rv-item-titulo">{nombre(r)}</span><span className="rv-item-sub">{donde(r)} · {cuenta(r.huespedes ?? 1, 'huésped', 'huéspedes')} · {horaDe(r, llega)}</span></span>
                    <Chip tono={llega ? 'ok' : 'gris'}>{llega ? 'Llega' : 'Sale'} {fechaRelativa(f, HOY).toLowerCase()}</Chip>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
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
