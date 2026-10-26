// "Mis reservas": lo que el cliente ve al entrar con su celular. Las próximas
// arriba, con cancelación dentro del plazo del negocio; las pasadas abajo.
// En la demo se ven las reservas hechas desde el sitio más un par de ejemplo
// del mismo cliente, para que la pantalla nunca esté vacía.
import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarPlus, Check, Clock, MapPin, X } from 'lucide-react'
import { diasEntre, fechaLarga, hhmm, rangoTxt, sumarDias } from '@/lib/reservas/fechas'
import { pesos } from '@/lib/reservas/precio'
import { nochesEntre } from '@/lib/reservas/estadia'
import { descargarICS, generarICS } from '@/lib/reservas/ics'
import { AHORA, ESTADO_RESERVA, HOY, TIPOS, fechaDeReserva, unidadPorId, type NegocioAlquiler, type Reserva } from '../datos'
import { Modal, Chip, useAviso } from '@/design-system/reservas/piezas'
import Sitio, { ruta } from './Sitio'
import { CSS_RESERVA } from './Reserva'

/** El cliente de la demo: el que hizo reservas desde el sitio, más Sofía (k1) como ejemplo. */
const CLIENTE_DEMO = 'k1'

interface P { negocio: NegocioAlquiler; reservas: Reserva[]; onCancelar: (id: string) => void }

export default function MisReservas({ negocio, reservas, onCancelar }: P) {
  const tipo = negocio.tipo
  const mias = reservas.filter(r => r.clienteId === CLIENTE_DEMO || r.clienteId.startsWith('kn'))
  const esPasada = (r: Reserva) => {
    if (r.entrada && r.salida) return r.salida <= HOY
    if (!r.fecha) return false
    return r.fecha < HOY || (r.fecha === HOY && (r.fin ?? 0) <= AHORA)
  }
  const proximas = mias.filter(r => !esPasada(r) && r.estado !== 'cancelada').sort((a, b) => fechaDeReserva(a).localeCompare(fechaDeReserva(b)) || (a.inicio ?? 0) - (b.inicio ?? 0))
  const pasadas = mias.filter(r => esPasada(r) || r.estado === 'cancelada').sort((a, b) => fechaDeReserva(b).localeCompare(fechaDeReserva(a)))
  const [cancelar, setCancelar] = useState<Reserva | null>(null)
  const [avisar, aviso] = useAviso()

  /** Cuántas horas faltan para la reserva (en una estadía, para la hora de entrada), para saber si todavía se puede cancelar sin cargo. */
  const horasHasta = (r: Reserva) => {
    const dias = diasEntre(HOY, fechaDeReserva(r))
    const empieza = r.entrada ? negocio.propiedades.find(p => p.id === r.unidadId)?.checkIn ?? 0 : r.inicio ?? 0
    return dias * 24 + (empieza - AHORA) / 60
  }
  const aTiempo = (r: Reserva) => horasHasta(r) >= negocio.cancelaHastaHoras
  const plazo = negocio.cancelaHastaHoras >= 24 ? `${negocio.cancelaHastaHoras / 24} ${negocio.cancelaHastaHoras / 24 === 1 ? 'día' : 'días'}` : `${negocio.cancelaHastaHoras} horas`

  const cuando = (r: Reserva) => r.entrada && r.salida ? `${rangoTxt(r.entrada, r.salida)} · ${nochesEntre(r.entrada, r.salida)} noches`
    : r.fecha && r.inicio !== undefined && r.fin !== undefined ? `${fechaLarga(r.fecha)} · ${hhmm(r.inicio)} a ${hhmm(r.fin)}` : ''
  const faltan = (r: Reserva) => {
    const n = diasEntre(HOY, fechaDeReserva(r))
    return n <= 0 ? 'Es hoy' : n === 1 ? 'Es mañana' : `Faltan ${n} días`
  }
  const calendario = (r: Reserva) => {
    const nombre = unidadPorId(negocio, r.unidadId)?.nombre ?? negocio.nombre
    const ev = r.entrada && r.salida ? { uid: `${r.id}@orbita`, titulo: `${nombre} · ${negocio.nombre}`, fecha: r.entrada, hasta: r.salida, lugar: `${negocio.direccion}, ${negocio.ciudad}` }
      : { uid: `${r.id}@orbita`, titulo: `${nombre} · ${negocio.nombre}`, inicio: { fecha: r.fecha ?? HOY, minuto: r.inicio ?? 0 }, fin: { fecha: r.fecha ?? HOY, minuto: r.fin ?? 0 }, lugar: `${negocio.direccion}, ${negocio.ciudad}` }
    descargarICS(generarICS([ev], { nombre: negocio.nombre }), `reserva-${r.id.slice(-6)}`)
  }

  return (
    <Sitio negocio={negocio} pagina="mis-reservas" cta={{ texto: TIPOS[tipo].verbo, href: ruta('reserva', tipo) }}>
      <style>{CSS_RESERVA}</style>
      <div className="als-cont" style={{ maxWidth: 760, paddingTop: 28 }}>
        <div className="rv-entre" style={{ marginBottom: 18 }}>
          <div>
            <h1 className="rv-h1">Mis reservas</h1>
            <p className="rv-bajada">Cancelás sin cargo hasta {plazo} antes{negocio.senaPct ? ': la seña se devuelve.' : '.'}</p>
          </div>
          <Link href={ruta('reserva', tipo)} className="rv-btn rv-btn--primario">{TIPOS[tipo].verbo} <ArrowRight size={16} aria-hidden /></Link>
        </div>

        {proximas.length === 0 ? (
          <div className="rv-vacio"><div className="rv-h3">No tenés reservas próximas</div><p style={{ margin: 0, fontSize: 14 }}>Cuando reserves en {negocio.nombre}, aparece acá con su código y las opciones para cambiarla.</p></div>
        ) : (
          <div className="rv-pila">
            {proximas.map((r, i) => {
              const u = unidadPorId(negocio, r.unidadId)
              return (
                <article key={r.id} className="rv-card rv-card--pad rv-entra" style={{ ['--i' as string]: i } as React.CSSProperties}>
                  <div className="rv-entre" style={{ alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="rv-fila" style={{ gap: 8 }}><Chip tono={ESTADO_RESERVA[r.estado].tono}>{ESTADO_RESERVA[r.estado].label}</Chip><span className="rv-rotulo">{faltan(r)}</span></div>
                      <h2 className="rv-h2" style={{ fontSize: 19, marginTop: 8 }}>{u?.nombre ?? negocio.nombre}</h2>
                      <p style={{ margin: '4px 0 0', fontSize: 14 }}><Clock size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> {cuando(r)}</p>
                      {r.evento && <p style={{ margin: '4px 0 0', fontSize: 14 }}>{r.evento.agasajado}{r.evento.edad ? ` · ${r.evento.edad} años` : ''} · {r.evento.invitados} invitados</p>}
                      <p style={{ margin: '4px 0 0', fontSize: 14 }}><MapPin size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> {negocio.direccion}, {negocio.ciudad}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="rv-rotulo">Código</div>
                      <b className="rv-num" style={{ fontSize: 18, letterSpacing: '0.1em', color: 'var(--color-text)' }}>{r.id.slice(-6).toUpperCase()}</b>
                      <div style={{ fontSize: 13, marginTop: 6 }}>{pesos(r.total)}{r.sena > 0 ? <> · {r.senaPagada ? `seña ${pesos(r.sena)} pagada` : 'seña pendiente'}</> : null}</div>
                    </div>
                  </div>
                  <div className="rv-fila" style={{ marginTop: 14 }}>
                    <button type="button" className="rv-btn rv-btn--sm" onClick={() => calendario(r)}><CalendarPlus size={15} aria-hidden /> Agregar al calendario</button>
                    <button type="button" className="rv-btn rv-btn--sm rv-btn--peligro" onClick={() => setCancelar(r)}><X size={15} aria-hidden /> Cancelar</button>
                    {!aTiempo(r) && <span className="rv-ayuda">Ya pasó el plazo: si cancelás, la seña no se devuelve.</span>}
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {pasadas.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <h2 className="rv-rotulo" style={{ marginBottom: 10 }}>Anteriores</h2>
            <div className="rv-card rv-lista" style={{ padding: '0 16px' }}>
              {pasadas.map(r => (
                <div key={r.id} className="rv-item">
                  <div className="rv-item-cuerpo">
                    <span className="rv-item-titulo">{unidadPorId(negocio, r.unidadId)?.nombre ?? negocio.nombre}</span>
                    <span className="rv-item-sub">{cuando(r)} · {pesos(r.total)}</span>
                  </div>
                  <Chip tono={ESTADO_RESERVA[r.estado].tono}>{ESTADO_RESERVA[r.estado].label}</Chip>
                  {r.estado !== 'cancelada' && <Link href={ruta('reserva', tipo, tipo === 'estadia' ? { propiedad: r.unidadId } : tipo === 'cancha' ? { unidad: r.unidadId } : {})} className="rv-btn rv-btn--sm">Repetir</Link>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {cancelar && (
        <Modal titulo="¿Cancelar la reserva?" onCerrar={() => setCancelar(null)}
          pie={<>
            <button type="button" className="rv-btn" onClick={() => setCancelar(null)}>No, la dejo</button>
            <button type="button" className="rv-btn rv-btn--primario" onClick={() => { onCancelar(cancelar.id); setCancelar(null); avisar('Reserva cancelada', aTiempo(cancelar) && cancelar.sena ? 'La seña se devuelve al mismo medio de pago.' : undefined) }}><Check size={16} aria-hidden /> Sí, cancelar</button>
          </>}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{unidadPorId(negocio, cancelar.unidadId)?.nombre ?? negocio.nombre} · {cuando(cancelar)}</p>
          <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.6 }}>
            {aTiempo(cancelar)
              ? `Estás a tiempo: ${cancelar.sena ? `la seña de ${pesos(cancelar.sena)} se devuelve` : 'no tiene costo'}. El lugar queda libre para otra persona.`
              : `Ya pasó el plazo de ${plazo}: ${cancelar.sena ? 'la seña no se devuelve.' : 'el negocio puede cobrarte igual.'}`}
          </p>
          <p className="rv-ayuda" style={{ marginTop: 8 }}>Hoy es {fechaLarga(HOY).toLowerCase()}, {hhmm(AHORA)}. Mañana sería el {fechaLarga(sumarDias(HOY, 1)).toLowerCase()}.</p>
        </Modal>
      )}
      {aviso}
    </Sitio>
  )
}
