// Días sin clases: feriados, vacaciones o cierres. Esos días no se puede
// reservar y la grilla no se muestra. Los que trae un calendario externo
// (.ics) se ven acá pero se quitan desde Calendarios.
import { useState } from 'react'
import { CalendarOff, Check, Link2, Plus, Trash2 } from 'lucide-react'
import { diaSemana, rangoTxt, sumarDias, type ISO } from '@/lib/reservas/fechas'
import { HOY, type NegocioGym } from '../../datos'
import { Campo, Chip, Encabezado, Modal, Vacio } from '@/design-system/reservas/piezas'
import type { PropsConfig } from '../piezas'

/** Cuántas clases de la grilla caen en [desde, hasta). */
function clasesEntre(n: NegocioGym, desde: ISO, hasta: ISO) {
  let total = 0
  for (let f = desde; f < hasta; f = sumarDias(f, 1)) total += n.clases.filter(c => c.dia === diaSemana(f)).length
  return total
}

const CSS = `
  .gbl-ico { width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0; display: grid; place-items: center; background: var(--color-surface-alt); color: var(--color-muted); }
  /* La fecha es el título: en celular, con el chip y Quitar al lado, "20 de noviembre" quedaba "20 de noviem…"; mejor en dos líneas que cortada. */
  .gbl-item .rv-item-titulo { white-space: normal; }
`

export default function Bloqueos({ negocio, onGuardar }: PropsConfig) {
  const [nuevo, setNuevo] = useState(false)
  const lista = [...negocio.bloqueos].sort((a, b) => a.desde.localeCompare(b.desde))
  const quitar = (id: string) => onGuardar({ bloqueos: negocio.bloqueos.filter(x => x.id !== id) }, 'Días sin clases quitados')
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
              const pasado = b.hasta <= HOY
              return (
                <div key={b.id} className="rv-item gbl-item">
                  <span className="gbl-ico" aria-hidden>{b.origen === 'ical' ? <Link2 size={16} /> : <CalendarOff size={16} />}</span>
                  <span className="rv-item-cuerpo">
                    <span className="rv-item-titulo">{rangoTxt(b.desde, sumarDias(b.hasta, -1))}</span>
                    <span className="rv-item-sub">{b.motivo} · {b.origen === 'ical' ? 'calendario externo' : 'lo cargaste vos'}{pasado ? ' · ya pasó' : ''}</span>
                  </span>
                  <Chip tono={n ? 'gris' : 'borde'}>{n} {n === 1 ? 'clase' : 'clases'}</Chip>
                  {b.origen === 'dueno' && <button type="button" className="rv-btn rv-btn--sm" onClick={() => quitar(b.id)} aria-label={`Quitar ${b.motivo}`}><Trash2 size={14} aria-hidden /> Quitar</button>}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {nuevo && <NuevoBloqueo negocio={negocio} onCerrar={() => setNuevo(false)} onAgregar={(desde, hasta, motivo) => { onGuardar({ bloqueos: [...negocio.bloqueos, { id: `bg${Date.now().toString(36)}`, desde, hasta, motivo, origen: 'dueno' }] }, 'Días sin clases guardados'); setNuevo(false) }} />}
    </div>
  )
}

function NuevoBloqueo({ negocio, onCerrar, onAgregar }: { negocio: NegocioGym; onCerrar: () => void; onAgregar: (desde: ISO, hastaExcluido: ISO, motivo: string) => void }) {
  const [desde, setDesde] = useState(sumarDias(HOY, 7))
  // En pantalla el "hasta" incluye el día; se guarda como [desde, hasta) igual que un calendario.
  const [hasta, setHasta] = useState(sumarDias(HOY, 7))
  const [motivo, setMotivo] = useState('Cerrado')
  const valido = !!desde && !!hasta && hasta >= desde
  const afecta = valido ? clasesEntre(negocio, desde, sumarDias(hasta, 1)) : 0
  return (
    <Modal titulo="Agregar días sin clases" bajada="Un día o varios seguidos. Quien ya tenía reservado esos días lo ve cancelado." onCerrar={onCerrar}
      pie={<><button type="button" className="rv-btn" onClick={onCerrar}>Cancelar</button><button type="button" className="rv-btn rv-btn--primario" onClick={() => onAgregar(desde, sumarDias(hasta, 1), motivo.trim() || 'Cerrado')} disabled={!valido}><Check size={15} aria-hidden /> Agregar</button></>}>
      <div className="rv-pila">
        <div className="rv-dos">
          <Campo label="Desde" type="date" value={desde} onChange={setDesde} />
          <Campo label="Hasta (incluido)" type="date" value={hasta} onChange={setHasta} error={desde && hasta && hasta < desde ? 'Tiene que ser el mismo día o después.' : undefined} />
        </div>
        <Campo label="Motivo" value={motivo} onChange={setMotivo} placeholder="Feriado, vacaciones, mantenimiento" maxLength={60} ayuda="Se muestra en el sitio ese día." />
        {valido && <p className="rv-ayuda" style={{ margin: 0 }}>{rangoTxt(desde, hasta)}: {afecta ? `${afecta} ${afecta === 1 ? 'clase de la grilla no se da' : 'clases de la grilla no se dan'}.` : 'no hay clases en la grilla esos días.'}</p>}
      </div>
    </Modal>
  )
}
