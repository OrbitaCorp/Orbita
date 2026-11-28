// Estadísticas de la estadía: qué tan ocupadas estuvieron las propiedades,
// cuánto entró y por dónde (directo, el sitio propio, Airbnb), a qué precio
// por noche, y qué falta cobrar. Es la pantalla que en canchas y salones se
// llama Ingresos.
//
// Las cuentas están en datos/estadisticas.ts (una función pura con sus tests);
// acá solo se muestran. Lo que hay que saber para leerla:
//
// - Todo se mide por noches, del inicio del período hasta hoy, y la plata de
//   cada estadía se reparte entre sus noches. Lo ya reservado para el resto
//   del período va aparte.
// - Un período que no terminó se compara contra los mismos días del anterior:
//   medio mes contra un mes entero daría siempre en baja.
// - Lo de Airbnb sale de dos lados: las noches, del calendario conectado; la
//   plata y el huésped, de las ganancias importadas (Ganancias de Airbnb). Si hay
//   noches del calendario sin su plata, se dice cuántas.
// - Pesos y otras monedas no se suman.
//
// Sin useMemo: son cuentas chicas y react-compiler ya memoiza el componente.
import { useState } from 'react'
import { AlertTriangle, BedDouble, CalendarClock, Gauge, HandCoins, Moon, Tag, Wallet } from 'lucide-react'
import { diasEntre, fechaCorta, rangoTxt, sumarDias } from '@/lib/reservas/fechas'
import { pesos } from '@/lib/reservas/precio'
import { Barras, Encabezado, Filtros, Kpi, Nota, Segmentado } from '@/design-system/reservas/piezas'
import { HOY, clientePorId, cuenta, type Cliente, type NegocioAlquiler, type Reserva } from '../datos'
import { estadisticasDeEstadia } from '../datos/estadisticas'
import { LlegadasYSalidas, PERIODOS, PorCobrar, VS, periodoAnterior, periodoDe, porCobrarDe, variacion, type Periodo } from './Ingresos'

/** Contra qué se compara un período que todavía no terminó. */
const VS_HASTA_HOY: Record<Periodo, string> = { mes: 'los mismos días del mes pasado', anterior: VS.anterior, trimestre: 'los mismos días de los 3 meses anteriores' }

const numero = (n: number, decimales = 1) => n.toLocaleString('es-AR', { maximumFractionDigits: decimales })
/** Un monto en una moneda que no es el peso: "USD 1.240". */
const enMoneda = (moneda: string, monto: number) => `${moneda} ${numero(monto, 2)}`

interface P {
  negocio: NegocioAlquiler
  reservas: Reserva[]
  clientes: Cliente[]
  onAbrirReserva: (id: string) => void
  /** Solo el panel real: lleva a "Ganancias de Airbnb", donde se importan. */
  onImportarGanancias?: () => void
}

export default function Estadisticas({ negocio, reservas, clientes, onAbrirReserva, onImportarGanancias }: P) {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [desde, hasta] = periodoDe(periodo)
  const [desdeAntes, hastaAntes] = periodoAnterior(periodo)
  // Hasta dónde llega el tramo, y el mismo día del período anterior: se comparan tramos del mismo largo.
  const hastaHoy = hasta < HOY ? hasta : HOY
  const completo = hastaHoy === hasta
  const ahora = estadisticasDeEstadia(negocio, reservas, desde, hasta, HOY)
  const antes = estadisticasDeEstadia(negocio, reservas, desdeAntes, hastaAntes, completo ? hastaAntes : sumarDias(desdeAntes, diasEntre(desde, hastaHoy)))
  const vs = completo ? VS[periodo] : VS_HASTA_HOY[periodo]
  const hayAntes = antes.nochesOcupadas > 0

  const { lista: porCobrar, totalSenas, totalSaldos } = porCobrarDe(reservas)
  const nombreDe = (unidadId: string) => negocio.propiedades.find(p => p.id === unidadId)?.nombre ?? ''
  /** Con qué reserva se cruza una estadía de Airbnb: quién es y sus fechas. */
  const conQuien = (reservaId: string) => {
    const r = reservas.find(x => x.id === reservaId)
    if (!r?.entrada || !r.salida) return ''
    const quien = clientePorId(r.clienteId, clientes)?.nombre
    return ` · pisa la reserva${quien ? ` de ${quien}` : ''} del ${rangoTxt(r.entrada, r.salida)}`
  }
  const importadas = negocio.ingresosExternos ?? []
  const conAirbnb = negocio.calendariosExternos.length > 0 || importadas.length > 0
  const canales = [
    { rotulo: 'Directo', valor: Math.round(ahora.porCanal.directo.ingresos), estadias: ahora.porCanal.directo.estadias },
    { rotulo: 'Tu sitio', valor: Math.round(ahora.porCanal.sitio.ingresos), estadias: ahora.porCanal.sitio.estadias },
    { rotulo: 'Airbnb', valor: Math.round(ahora.porCanal.airbnb.ingresos), estadias: ahora.porCanal.airbnb.estadias },
  ]
  const sinEstadias = canales.every(c => c.estadias === 0)
  // Noches que Airbnb tiene reservadas en el calendario y que no están en las ganancias importadas: ocupación sin plata.
  const sinPlata = ahora.nochesDeAirbnbSinImportar

  return (
    <div className="rv-pagina">
      <Encabezado rotulo={`${fechaCorta(desde)} al ${fechaCorta(hasta)}`} titulo="Estadísticas"
        bajada={`Todo se mide por noches${completo ? '' : ', del inicio del período hasta hoy'}: la plata de cada estadía se reparte entre sus noches. Cada variación es contra ${vs}.`}
        acciones={<Filtros resumen={PERIODOS.find(p => p.id === periodo)?.label}><Segmentado label="Período" valor={periodo} onChange={setPeriodo} opciones={PERIODOS} /></Filtros>} />

      {ahora.cruces.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <Nota tono="aviso">
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={15} aria-hidden /> Airbnb tiene una estadía sobre noches que también tenés reservadas acá</b>
              {ahora.cruces.map(x => (
                <span key={`${x.codigo}-${x.reservaId}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '6px 0' }}>
                  <span>{nombreDe(x.unidadId)} · {rangoTxt(x.entrada, x.salida)} · código <span className="rv-num">{x.codigo}</span>{conQuien(x.reservaId)}</span>
                  <button type="button" className="rv-btn rv-btn--sm" onClick={() => onAbrirReserva(x.reservaId)}>Ver la reserva</button>
                </span>
              ))}
              <span className="rv-ayuda" style={{ display: 'block', marginTop: 4 }}>Revisá a qué propiedad uniste ese aviso al importar, o si fue una doble reserva. Esas noches se cuentan una sola vez.</span>
            </span>
          </Nota>
        </div>
      )}

      <div className="rv-kpis" style={{ marginBottom: 14 }}>
        <Kpi i={0} label="Ocupación" Icon={Gauge} valor={`${Math.round(ahora.ocupacion * 100)}%`}
          delta={{ valor: hayAntes ? Math.round((ahora.ocupacion - antes.ocupacion) * 100) : null, unidades: true, sufijo: ' pts', vs }}
          nota={`${cuenta(ahora.nochesOcupadas, 'noche', 'noches')} de ${ahora.nochesDisponibles}${completo ? '' : ' hasta hoy'}`} />
        <Kpi i={1} label="Ingresos" Icon={HandCoins} valor={pesos(Math.round(ahora.ingresos))}
          delta={{ valor: variacion(ahora.ingresos, antes.ingresos), vs }}
          nota={`de las noches ${completo ? 'del período' : 'hasta hoy'}${conAirbnb ? ' · Airbnb, neto de comisión' : ''}`} />
        <Kpi i={2} label="Precio por noche" Icon={Tag} valor={ahora.precioPorNoche === null ? '—' : pesos(Math.round(ahora.precioPorNoche))}
          delta={{ valor: ahora.precioPorNoche !== null && antes.precioPorNoche ? variacion(ahora.precioPorNoche, antes.precioPorNoche) : null, vs }}
          nota={`ingresos ÷ ${cuenta(ahora.nochesVendidas, 'noche vendida', 'noches vendidas')}`} />
        <Kpi i={3} label="Por noche disponible" Icon={Moon} valor={ahora.ingresoPorNocheDisponible === null ? '—' : pesos(Math.round(ahora.ingresoPorNocheDisponible))}
          delta={{ valor: ahora.ingresoPorNocheDisponible !== null && antes.ingresoPorNocheDisponible ? variacion(ahora.ingresoPorNocheDisponible, antes.ingresoPorNocheDisponible) : null, vs }}
          nota="ingresos ÷ noches disponibles" />
      </div>

      {(ahora.porVenir.noches > 0 || ahora.otrasMonedas.length > 0 || sinPlata > 0) && (
        <div className="rv-pila" style={{ marginBottom: 14 }}>
          {ahora.porVenir.noches > 0 && (
            <Nota tono="info"><span>Ya reservado para lo que queda del período: <b>{pesos(Math.round(ahora.porVenir.ingresos))}</b> en {cuenta(ahora.porVenir.noches, 'noche', 'noches')}. Todavía no cuenta arriba.</span></Nota>
          )}
          {ahora.otrasMonedas.length > 0 && (
            <Nota tono="info"><span>Además, Airbnb te pagó {ahora.otrasMonedas.map(o => `${enMoneda(o.moneda, o.neto)} por ${cuenta(o.estadias, 'estadía', 'estadías')}`).join(' y ')}. No se suma a los pesos ni entra en los promedios; sus noches sí cuentan como ocupadas.</span></Nota>
          )}
          {sinPlata > 0 && (
            <Nota tono="info">
              <span style={{ flex: 1, minWidth: 0 }}>Hay {cuenta(sinPlata, 'noche de Airbnb', 'noches de Airbnb')} sin su plata: {sinPlata === 1 ? 'cuenta como ocupada' : 'cuentan como ocupadas'}, pero lo que cobraste por {sinPlata === 1 ? 'ella' : 'ellas'} no está importado.</span>
              {onImportarGanancias && <button type="button" className="rv-btn rv-btn--sm" onClick={onImportarGanancias}>Importar ganancias</button>}
            </Nota>
          )}
        </div>
      )}

      <div className="rv-grid rv-grid--2" style={{ marginBottom: 14 }}>
        <section className="rv-card rv-card--pad">
          <h2 className="rv-h2" style={{ marginBottom: 4 }}>De dónde vienen</h2>
          <p className="rv-ayuda" style={{ marginBottom: 10 }}>
            {sinEstadias ? 'Sin estadías en estas noches.' : `${cuenta(canales[0].estadias, 'estadía directa', 'estadías directas')} · ${canales[1].estadias} por tu sitio · ${canales[2].estadias} por Airbnb.`}
          </p>
          <Barras datos={canales.map(({ rotulo, valor }) => ({ rotulo, valor }))} formato={pesos} label="Ingresos por canal" />
        </section>
        <section className="rv-card rv-card--pad">
          <h2 className="rv-h2" style={{ marginBottom: 4 }}>Por propiedad</h2>
          <p className="rv-ayuda" style={{ marginBottom: 10 }}>Cuánto se ocupó cada una, qué dejó y a qué precio por noche.</p>
          <div className="rv-lista">
            {ahora.porPropiedad.map(p => (
              <div key={p.unidadId} className="rv-item" style={{ cursor: 'default' }}>
                <span className="rv-item-cuerpo">
                  <span className="rv-item-titulo">{p.nombre}</span>
                  <span className="rv-item-sub">{Math.round(p.ocupacion * 100)}% ocupada · {cuenta(p.nochesOcupadas, 'noche', 'noches')} de {p.nochesDisponibles}{p.precioPorNoche !== null ? ` · ${pesos(Math.round(p.precioPorNoche))} por noche` : ''}</span>
                </span>
                <span className="rv-num" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{pesos(Math.round(p.ingresos))}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="rv-kpis" style={{ marginBottom: 14 }}>
        <Kpi i={0} label="Estadía promedio" Icon={BedDouble} valor={ahora.estadiaPromedio === null ? '—' : `${numero(ahora.estadiaPromedio)} ${ahora.estadiaPromedio === 1 ? 'noche' : 'noches'}`} nota="de las estadías con noches en el período" />
        <Kpi i={1} label="Anticipación" Icon={CalendarClock} valor={ahora.anticipacionPromedio === null ? '—' : `${numero(ahora.anticipacionPromedio, 0)} ${Math.round(ahora.anticipacionPromedio) === 1 ? 'día' : 'días'}`} nota="entre que reservan y entran · solo reservas propias" />
        <Kpi i={2} label="Por cobrar" Icon={Wallet} valor={pesos(totalSenas + totalSaldos)} nota={porCobrar.length ? `${pesos(totalSenas)} de señas · ${pesos(totalSaldos)} de saldos` : 'todo cobrado'} />
      </div>

      <div className="rv-grid rv-grid--2">
        <PorCobrar negocio={negocio} reservas={reservas} clientes={clientes} onAbrirReserva={onAbrirReserva} />
        <LlegadasYSalidas negocio={negocio} reservas={reservas} clientes={clientes} onAbrirReserva={onAbrirReserva} />
      </div>

      {onImportarGanancias && importadas.length === 0 && negocio.calendariosExternos.length > 0 && sinPlata === 0 && (
        <div style={{ marginTop: 14 }}>
          <Nota tono="info">
            <span style={{ flex: 1, minWidth: 0 }}>De Airbnb acá se ven las noches, no la plata. Importá tus ganancias para sumar lo que cobraste y las estadías de antes de conectar el calendario.</span>
            <button type="button" className="rv-btn rv-btn--sm" onClick={onImportarGanancias}>Importar ganancias</button>
          </Nota>
        </div>
      )}
    </div>
  )
}
