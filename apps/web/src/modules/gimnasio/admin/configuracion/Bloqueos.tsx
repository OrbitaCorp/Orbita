// Días sin clases: feriados, vacaciones o cierres. Esos días no se puede
// reservar y la grilla no se muestra. Los que trae un calendario externo
// (.ics) se ven acá pero se quitan desde Calendarios.
//
// Lo que ya estaba reservado esos días no se cancela solo (tampoco en la API:
// POST /reservas/bloqueos devuelve cuántas reservas quedaron adentro). Al
// guardar, el aviso dice cuántas son; después, cada día sin clases que todavía
// tiene reservas en pie lo dice en su fila, con el botón para ir a ese día y
// liberar los lugares: el aviso de un momento no alcanza para acordarse.
//
// Agregar y quitar esperan la respuesta: el formulario no se cierra (ni la
// fila se va) hasta saber que quedó guardado. Si la API dice que no, lo
// cargado sigue ahí.
import { useState } from 'react'
import { ArrowRight, CalendarOff, Check, Link2, Plus, Trash2 } from 'lucide-react'
import { diaSemana, maxFecha, rangoTxt, sumarDias, type ISO } from '@/lib/reservas/fechas'
import { reservadasEntre, type Inscripcion, type NegocioGym } from '../../datos'
import { useReloj } from '../../datos/reloj'
import { Campo, Encabezado, Modal, Vacio } from '@/design-system/reservas/piezas'
import type { PropsConfig } from '../piezas'

interface P extends PropsConfig {
  inscripciones: Inscripcion[]
  /** Hasta qué día están leídas las inscripciones (null: todas). De un día sin clases más lejano no se cuentan las reservas. */
  leidoHasta: ISO | null
  /** Ir a ese día en Clases, a ver quién quedó anotado. */
  onVerDia: (dia: ISO) => void
}

/** Cuántas clases de la grilla caen en [desde, hasta). */
function clasesEntre(n: NegocioGym, desde: ISO, hasta: ISO) {
  let total = 0
  for (let f = desde; f < hasta; f = sumarDias(f, 1)) total += n.clases.filter(c => c.dia === diaSemana(f)).length
  return total
}

/** El primer día de [desde, hasta) que todavía tiene una reserva en pie, o null. */
function primerDiaConReservas(inscripciones: Inscripcion[], desde: ISO, hasta: ISO): ISO | null {
  let primero: ISO | null = null
  for (const i of inscripciones) {
    if (i.estado !== 'reservada' || i.fecha < desde || i.fecha >= hasta) continue
    if (!primero || i.fecha < primero) primero = i.fecha
  }
  return primero
}

const CSS = `
  .gbl-ico { width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0; display: grid; place-items: center; background: var(--color-surface-alt); color: var(--color-muted); }
  /* La fecha es el título: en celular, con el chip y Quitar al lado, "20 de noviembre" quedaba "20 de noviem…"; mejor en dos líneas que cortada. */
  .gbl-item .rv-item-titulo { white-space: normal; }
  /* Las reservas que quedaron adentro: en tinta de aviso (AA sobre el fondo de la tarjeta), debajo del motivo. */
  .gbl-enpie { display: block; margin-top: 4px; font-size: 12.5px; line-height: 1.45; color: var(--chip-warning-fg); }
  .gbl-enpie b { font-weight: 600; }
  .gbl-acciones { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  /* En celular las acciones bajan a su renglón, a lo ancho: al costado dejaban al texto en una columna de 120 px. */
  @media (max-width: 560px) {
    .gbl-item { flex-wrap: wrap; }
    .gbl-acciones { flex: 1 1 100%; padding-left: 48px; }
    .gbl-acciones > .rv-btn { flex: 1; }
  }
`

export default function Bloqueos({ negocio, inscripciones, leidoHasta, onVerDia, onGuardar }: P) {
  const { hoy } = useReloj()
  const [nuevo, setNuevo] = useState(false)
  // El que se está quitando: su botón queda en espera hasta que contesta (y los demás no se tocan en el medio).
  const [quitando, setQuitando] = useState<string | null>(null)
  const lista = [...negocio.bloqueos].sort((a, b) => a.desde.localeCompare(b.desde))
  const quitar = async (id: string) => {
    if (quitando) return
    setQuitando(id)
    await onGuardar({ bloqueos: negocio.bloqueos.filter(x => x.id !== id) }, 'Días sin clases quitados')
    setQuitando(null)
  }
  return (
    <div className="rv-pagina rv-pagina--form">
      <style>{CSS}</style>
      <Encabezado rotulo="Reservas" titulo="Días sin clases" bajada="Feriados, vacaciones o cierres: esos días no se puede reservar y la grilla no se muestra en el sitio."
        acciones={<button type="button" className="rv-btn rv-btn--primario" onClick={() => setNuevo(true)}><Plus size={16} aria-hidden /> Agregar días</button>} />
      {lista.length === 0 ? <Vacio titulo="Ningún día sin clases" texto="Cuando cierres por un feriado o vacaciones, cargalo acá." accion={<button type="button" className="rv-btn" onClick={() => setNuevo(true)}><Plus size={15} aria-hidden /> Agregar días</button>} /> : (
        <div className="rv-card" style={{ padding: '0 16px' }}>
          <div className="rv-lista">
            {lista.map(b => {
              const n = clasesEntre(negocio, b.desde, b.hasta)
              const pasado = b.hasta <= hoy
              // Lo que queda por delante de este cierre (lo de ayer ya pasó), si esos días están leídos.
              const desde = maxFecha(b.desde, hoy)
              const seSabe = !pasado && (leidoHasta === null || sumarDias(b.hasta, -1) <= leidoHasta)
              const enPie = seSabe ? reservadasEntre(inscripciones, desde, b.hasta) : 0
              const primerDia = enPie ? primerDiaConReservas(inscripciones, desde, b.hasta) : null
              return (
                <div key={b.id} className="rv-item gbl-item">
                  <span className="gbl-ico" aria-hidden>{b.origen === 'ical' ? <Link2 size={16} /> : <CalendarOff size={16} />}</span>
                  <span className="rv-item-cuerpo">
                    <span className="rv-item-titulo">{rangoTxt(b.desde, sumarDias(b.hasta, -1))}</span>
                    <span className="rv-item-sub">{b.motivo} · {b.origen === 'ical' ? 'calendario externo' : 'lo cargaste vos'}{pasado ? ' · ya pasó' : ''} · {n} {n === 1 ? 'clase' : 'clases'}</span>
                    {enPie > 0 && <span className="gbl-enpie"><b>{enPie} {enPie === 1 ? 'reserva sigue' : 'reservas siguen'} en pie.</b> No se cancelan solas: avisales y liberá su lugar.</span>}
                  </span>
                  {(primerDia || b.origen === 'dueno') && (
                    <span className="gbl-acciones">
                      {primerDia && <button type="button" className="rv-btn rv-btn--sm" onClick={() => onVerDia(primerDia)} aria-label={`Ver las reservas en pie de ${b.motivo}`}>Ver el día <ArrowRight size={14} aria-hidden /></button>}
                      {b.origen === 'dueno' && <button type="button" className="rv-btn rv-btn--sm" onClick={() => void quitar(b.id)} disabled={quitando !== null} aria-busy={quitando === b.id || undefined} aria-label={`Quitar ${b.motivo}`}><Trash2 size={14} aria-hidden /> {quitando === b.id ? 'Quitando…' : 'Quitar'}</button>}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {nuevo && (
        <NuevoBloqueo negocio={negocio} inscripciones={inscripciones} leidoHasta={leidoHasta} onCerrar={() => setNuevo(false)}
          onAgregar={(desde, hasta, motivo) => onGuardar({ bloqueos: [...negocio.bloqueos, { id: `bg${Date.now().toString(36)}`, desde, hasta, motivo, origen: 'dueno' }] }, 'Días sin clases guardados')} />
      )}
    </div>
  )
}

/**
 * Cargar días sin clases. El formulario queda abierto hasta saber que se
 * guardó: si la API lo rechaza, lo cargado no se pierde.
 */
function NuevoBloqueo({ negocio, inscripciones, leidoHasta, onCerrar, onAgregar }: {
  negocio: NegocioGym; inscripciones: Inscripcion[]; leidoHasta: ISO | null; onCerrar: () => void
  onAgregar: (desde: ISO, hastaExcluido: ISO, motivo: string) => Promise<boolean>
}) {
  const { hoy } = useReloj()
  const [desde, setDesde] = useState(sumarDias(hoy, 7))
  // En pantalla el "hasta" incluye el día; se guarda como [desde, hasta) igual que un calendario.
  const [hasta, setHasta] = useState(sumarDias(hoy, 7))
  const [motivo, setMotivo] = useState('Cerrado')
  const [guardando, setGuardando] = useState(false)
  const valido = !!desde && !!hasta && hasta >= desde
  const afecta = valido ? clasesEntre(negocio, desde, sumarDias(hasta, 1)) : 0
  // Las reservas que ya hay esos días, si están leídas: se avisa antes de guardar, no solo después.
  const seSabe = valido && (leidoHasta === null || hasta <= leidoHasta)
  const adentro = seSabe ? reservadasEntre(inscripciones, maxFecha(desde, hoy), sumarDias(hasta, 1)) : 0
  const agregar = async () => {
    if (!valido || guardando) return
    setGuardando(true)
    if (await onAgregar(desde, sumarDias(hasta, 1), motivo.trim() || 'Cerrado')) onCerrar()
    else setGuardando(false)
  }
  return (
    <Modal titulo="Agregar días sin clases" bajada="Un día o varios seguidos. Si alguien ya tenía lugar esos días, su reserva no se cancela sola: avisales." onCerrar={onCerrar} onEnviar={() => void agregar()}
      pie={<><button type="button" className="rv-btn" onClick={onCerrar}>Cancelar</button><button type="submit" className="rv-btn rv-btn--primario" disabled={!valido || guardando} aria-busy={guardando || undefined}><Check size={15} aria-hidden /> {guardando ? 'Guardando…' : 'Agregar'}</button></>}>
      <div className="rv-pila">
        <div className="rv-dos">
          <Campo label="Desde" type="date" value={desde} onChange={setDesde} min={hoy} />
          <Campo label="Hasta (incluido)" type="date" value={hasta} onChange={setHasta} min={desde || hoy} error={desde && hasta && hasta < desde ? 'Tiene que ser el mismo día o después.' : undefined} />
        </div>
        <Campo label="Motivo" value={motivo} onChange={setMotivo} placeholder="Feriado, vacaciones, mantenimiento" maxLength={60} ayuda="Se muestra en el sitio ese día." />
        {valido && <p className="rv-ayuda" style={{ margin: 0 }}>{rangoTxt(desde, hasta)}: {afecta ? `${afecta} ${afecta === 1 ? 'clase de la grilla no se da' : 'clases de la grilla no se dan'}.` : 'no hay clases en la grilla esos días.'}</p>}
        {adentro > 0 && <p className="rv-nota rv-nota--aviso" role="status" style={{ margin: 0 }}><span className="rv-nota-txt"><b>{adentro} {adentro === 1 ? 'reserva ya está tomada' : 'reservas ya están tomadas'} esos días.</b> Siguen en pie después de guardar: avisales y liberá su lugar desde cada clase.</span></p>}
      </div>
    </Modal>
  )
}
