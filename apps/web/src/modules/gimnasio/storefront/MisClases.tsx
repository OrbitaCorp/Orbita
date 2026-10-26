// "Mis clases": lo que ve un socio al entrar con su celular. Su plan (qué
// tiene, cuándo vence, cuántas clases le quedan), las próximas clases con
// check-in y cancelación, la lista de espera y el historial de asistencia.
// En la demo se entra como Sofía (s1) y también se ven las reservas hechas
// desde el sitio en este navegador.
import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarPlus, Check, Hourglass, QrCode, X } from 'lucide-react'
import { diasEntre, fechaCorta, fechaLarga, fechaRelativa, hhmm } from '@/lib/reservas/fechas'
import { descargarICS, generarICS } from '@/lib/reservas/ics'
import { AHORA, ESTADO_INSCRIPCION, ESTADO_PLAN, HOY, actividadDe, estadoPlanDe, idSocioDemo, planDe, profeDe, topeSemanal, type Inscripcion, type NegocioGym, type Socio } from '../datos'
import { Chip, Modal, useAviso } from '@/design-system/reservas/piezas'
import Sitio, { ruta } from './Sitio'
import { CSS_RESERVA } from './Reserva'

interface P { negocio: NegocioGym; inscripciones: Inscripcion[]; socios: Socio[]; onCancelar: (id: string) => void; onCheckIn: (id: string) => void }

// En celular: el botón de reservar de arriba sobra (va el fijo al pie) y la
// asistencia baja a su propia fila, alineada a la izquierda (a la derecha y
// angosta quedaba desacomodada debajo del plan).
const CSS = `
  @media (max-width: 768px) { .gim-reservar { display: none; } }
  @media (max-width: 560px) {
    .gim-asistencia { flex: 1 1 100%; text-align: left !important; display: flex; align-items: baseline; gap: 6px 10px; flex-wrap: wrap; padding-top: 12px; border-top: 1px solid var(--color-border); }
  }
`

export default function MisClases({ negocio, inscripciones, socios, onCancelar, onCheckIn }: P) {
  const idYo = idSocioDemo(negocio.rubro)
  const mios = socios.filter(s => s.id === idYo || s.id.startsWith('sn'))
  const yo = socios.find(s => s.id === idYo) ?? mios[0]
  const claseDe = (i: Inscripcion) => negocio.clases.find(c => c.id === i.claseId)
  // Las de una clase que el dueño quitó de la grilla ya no tienen hora ni actividad: no se muestran.
  const mias = inscripciones.filter(i => mios.some(s => s.id === i.socioId) && !!claseDe(i))
  const inicioDe = (i: Inscripcion) => claseDe(i)?.inicio ?? 0
  const esPasada = (i: Inscripcion) => i.fecha < HOY || (i.fecha === HOY && inicioDe(i) + (actividadDe(negocio, claseDe(i)?.actividadId ?? '')?.duracion ?? 60) <= AHORA)
  const proximas = mias.filter(i => !esPasada(i) && (i.estado === 'reservada' || i.estado === 'espera')).sort((a, b) => a.fecha.localeCompare(b.fecha) || inicioDe(a) - inicioDe(b))
  const historial = mias.filter(i => esPasada(i) || i.estado === 'cancelada' || i.estado === 'asistio' || i.estado === 'ausente').sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 12)
  const [cancelar, setCancelar] = useState<Inscripcion | null>(null)
  const [avisar, aviso] = useAviso()
  const plan = yo ? planDe(negocio, yo.planId) : null
  const estado = yo ? estadoPlanDe(yo) : 'sin-plan'
  // Membresía de X por semana: cuántas lleva esta semana (el tope lo controla la reserva).
  const semana = yo ? topeSemanal(negocio, yo, HOY, inscripciones) : null
  const asistidas = mias.filter(i => i.estado === 'asistio').length
  const faltas = mias.filter(i => i.estado === 'ausente').length

  /** Check-in: desde `checkInMin` minutos antes hasta que termina la clase, solo el día de la clase. */
  const puedeCheckIn = (i: Inscripcion) => {
    const c = claseDe(i)
    if (!c || i.fecha !== HOY || i.estado !== 'reservada') return false
    const dur = actividadDe(negocio, c.actividadId)?.duracion ?? 60
    return AHORA >= c.inicio - negocio.checkInMin && AHORA < c.inicio + dur
  }
  const horasHasta = (i: Inscripcion) => diasEntre(HOY, i.fecha) * 24 + (inicioDe(i) - AHORA) / 60
  const aTiempo = (i: Inscripcion) => horasHasta(i) >= negocio.cancelaHastaHoras
  const calendario = (i: Inscripcion) => {
    const c = claseDe(i)
    if (!c) return
    const act = actividadDe(negocio, c.actividadId)
    descargarICS(generarICS([{ uid: `${i.id}@orbita`, titulo: `${act?.nombre ?? 'Clase'} · ${negocio.nombre}`, inicio: { fecha: i.fecha, minuto: c.inicio }, fin: { fecha: i.fecha, minuto: c.inicio + (act?.duracion ?? 60) }, lugar: `${negocio.direccion}, ${negocio.ciudad}` }], { nombre: negocio.nombre }), `clase-${i.id.slice(-6)}`)
  }

  return (
    <Sitio negocio={negocio} pagina="mis-clases" cta={{ texto: 'Reservar clase', href: ruta('reserva', negocio.rubro) }}>
      <style>{CSS_RESERVA + CSS}</style>
      <div className="gis-cont" style={{ maxWidth: 760, paddingTop: 28 }}>
        <div className="rv-entre" style={{ marginBottom: 18 }}>
          <div>
            <h1 className="rv-h1">Mis clases</h1>
            <p className="rv-bajada">Hola, {yo?.nombre.split(' ')[0]}. Cancelás hasta {negocio.cancelaHastaHoras} h antes sin perder la clase.</p>
          </div>
          <Link href={ruta('reserva', negocio.rubro)} className="rv-btn rv-btn--primario gim-reservar">Reservar clase <ArrowRight size={16} aria-hidden /></Link>
        </div>

        {yo && (
          <section className="rv-card rv-card--pad rv-entra" style={{ marginBottom: 18 }} aria-label="Tu plan">
            <div className="rv-entre">
              <div style={{ minWidth: 0 }}>
                <div className="rv-fila" style={{ gap: 8 }}><span className="rv-rotulo">Tu plan</span><Chip tono={ESTADO_PLAN[estado].tono}>{ESTADO_PLAN[estado].label}</Chip></div>
                <h2 className="rv-h2" style={{ fontSize: 19, marginTop: 6 }}>{plan?.nombre ?? 'Sin plan'}</h2>
                <p style={{ margin: '4px 0 0', fontSize: 14 }}>
                  {plan && yo.vence ? <>{estado === 'vencido' ? 'Venció' : 'Vence'} el <b>{fechaLarga(yo.vence).toLowerCase()}</b>{yo.clasesRestantes !== null ? <> · te quedan <b>{yo.clasesRestantes}</b> clases</> : semana ? <> · esta semana usaste <b>{semana.usadas} de {semana.porSemana}</b></> : <> · clases libres</>}.</> : 'Elegí un plan al reservar tu próxima clase.'}
                </p>
              </div>
              <div className="gim-asistencia" style={{ textAlign: 'right' }}>
                <div className="rv-rotulo">Asistencia</div>
                <div><b className="rv-num" style={{ fontSize: 22, color: 'var(--color-text)' }}>{asistidas}</b> <span className="rv-ayuda">{asistidas === 1 ? 'clase' : 'clases'}</span></div>
                <div className="rv-ayuda">{asistidas + faltas ? `${Math.round((asistidas / (asistidas + faltas)) * 100)}% de las reservadas` : 'todavía sin clases'}</div>
              </div>
            </div>
            {(estado === 'por-vencer' || estado === 'vencido' || estado === 'agotado') && <p className="rv-nota rv-nota--aviso" style={{ marginTop: 12 }}>{estado === 'por-vencer' ? 'Tu plan vence pronto: renovalo al reservar y no perdés tu lugar.' : 'Tu plan ya no vale: elegí uno nuevo al reservar.'}</p>}
          </section>
        )}

        <h2 className="rv-rotulo" style={{ marginBottom: 10 }}>Próximas</h2>
        {proximas.length === 0 ? (
          <div className="rv-vacio"><div className="rv-h3">No tenés clases reservadas</div><p style={{ margin: 0, fontSize: 14 }}>Cuando reserves en {negocio.nombre}, aparece acá con el check-in y las opciones para cambiarla.</p></div>
        ) : (
          <div className="rv-pila">
            {proximas.map((i, k) => {
              const c = claseDe(i)
              const act = c ? actividadDe(negocio, c.actividadId) : null
              const espera = i.estado === 'espera'
              return (
                <article key={i.id} className="rv-card rv-card--pad rv-entra" style={{ ['--i' as string]: k } as React.CSSProperties}>
                  <div className="rv-entre" style={{ alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="rv-fila" style={{ gap: 8 }}><Chip tono={ESTADO_INSCRIPCION[i.estado].tono}>{espera ? <><Hourglass size={12} aria-hidden /> En lista de espera</> : 'Reservada'}</Chip><span className="rv-rotulo">{fechaRelativa(i.fecha, HOY)}</span></div>
                      <h3 className="rv-h2" style={{ fontSize: 19, marginTop: 8 }}>{act?.nombre}</h3>
                      <p style={{ margin: '4px 0 0', fontSize: 14 }}>{fechaLarga(i.fecha)} · <span className="rv-num">{hhmm(c?.inicio ?? 0)}</span> · {c ? profeDe(negocio, c.profeId)?.nombre : ''} · {c?.sala}</p>
                    </div>
                    {puedeCheckIn(i) && <button type="button" className="rv-btn rv-btn--primario" onClick={() => { onCheckIn(i.id); avisar('Check-in hecho', `¡Buena clase, ${yo?.nombre.split(' ')[0]}!`) }}><QrCode size={16} aria-hidden /> Check-in</button>}
                  </div>
                  <div className="rv-fila" style={{ marginTop: 14 }}>
                    {!espera && <button type="button" className="rv-btn rv-btn--sm" onClick={() => calendario(i)}><CalendarPlus size={15} aria-hidden /> Agregar al calendario</button>}
                    <button type="button" className="rv-btn rv-btn--sm rv-btn--peligro" onClick={() => setCancelar(i)}><X size={15} aria-hidden /> {espera ? 'Salir de la lista' : 'Cancelar'}</button>
                    {!espera && !aTiempo(i) && <span className="rv-ayuda">Ya pasó el plazo: si cancelás, la clase se descuenta igual.</span>}
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {historial.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <h2 className="rv-rotulo" style={{ marginBottom: 10 }}>Anteriores</h2>
            <div className="rv-card rv-lista" style={{ padding: '0 16px' }}>
              {historial.map(i => {
                const c = claseDe(i)
                return (
                  <div key={i.id} className="rv-item">
                    <div className="rv-item-cuerpo">
                      <span className="rv-item-titulo">{c ? actividadDe(negocio, c.actividadId)?.nombre : ''}</span>
                      <span className="rv-item-sub">{fechaCorta(i.fecha)} · {hhmm(c?.inicio ?? 0)}</span>
                    </div>
                    <Chip tono={ESTADO_INSCRIPCION[i.estado].tono}>{ESTADO_INSCRIPCION[i.estado].label}</Chip>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>

      {cancelar && (
        <Modal titulo={cancelar.estado === 'espera' ? '¿Salir de la lista de espera?' : '¿Cancelar la clase?'} onCerrar={() => setCancelar(null)}
          pie={<>
            <button type="button" className="rv-btn" onClick={() => setCancelar(null)}>No, la dejo</button>
            <button type="button" className="rv-btn rv-btn--primario" onClick={() => { onCancelar(cancelar.id); setCancelar(null); avisar(cancelar.estado === 'espera' ? 'Saliste de la lista' : 'Clase cancelada', cancelar.estado !== 'espera' && aTiempo(cancelar) ? 'No se descuenta de tu plan.' : undefined) }}><Check size={16} aria-hidden /> Sí</button>
          </>}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{actividadDe(negocio, claseDe(cancelar)?.actividadId ?? '')?.nombre} · {fechaLarga(cancelar.fecha).toLowerCase()} a las <span className="rv-num">{hhmm(inicioDe(cancelar))}</span></p>
          <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.6 }}>
            {cancelar.estado === 'espera' ? 'Dejás de esperar un lugar en esta clase.' : aTiempo(cancelar) ? 'Estás a tiempo: la clase no se descuenta y el lugar pasa a quien esté en la lista de espera.' : `Ya pasó el plazo de ${negocio.cancelaHastaHoras} horas: la clase se descuenta igual, pero el lugar queda libre para otra persona.`}
          </p>
        </Modal>
      )}
      {aviso}
    </Sitio>
  )
}
