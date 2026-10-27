// Días bloqueados (canchas y salón) o Bloqueos (estadía): todo lo que el dueño
// cerró y lo que trajo un calendario externo, en una lista: los que vienen y
// los que ya pasaron. Desde acá se agregan (el mismo modal que usa la agenda) y
// se quitan los propios; los de un calendario externo se quitan desconectando
// el calendario en Calendarios (.ics).
import { useState } from 'react'
import { ArrowRight, Ban, Link2, Trash2 } from 'lucide-react'
import { diasEntre, fechaCorta, rangoTxt } from '@/lib/reservas/fechas'
import { Chip, Nota, Seccion, Vacio } from '@/design-system/reservas/piezas'
import { HOY, TIPOS, cuenta, unidadesDe, type Bloqueo, type NegocioAlquiler, type Reserva } from '../../datos'
import { BloquearDia, BloquearFechas } from '../Bloquear'
import type { Vista } from '../navegacion'
import { PaginaForm } from './comun'

interface P {
  negocio: NegocioAlquiler
  reservas: Reserva[]
  onBloqueo: (b: Bloqueo) => void
  onQuitarBloqueo: (id: string) => void
  onIr: (vista: Vista) => void
}

/** Varios bloqueos iguales (el torneo que cierra las cuatro canchas) se muestran como uno solo, con el nombre de lo que cierran ya armado. */
interface Grupo { clave: string; ids: string[]; que: string; desde: string; hasta: string; motivo: string; origen: Bloqueo['origen'] }

// Afuera de Bloqueos: definida adentro sería un componente nuevo en cada render y React la remontaría.
function Fila({ g, onQuitar }: { g: Grupo; onQuitar: (ids: string[]) => void }) {
  // Un bloqueo de un día ("Torneo interno", sábado 21) se lee como fecha; uno de varias noches, como rango.
  const unDia = diasEntre(g.desde, g.hasta) === 1
  return (
    <div className="rv-item" style={{ flexWrap: 'wrap' }}>
      <span className="rv-num" style={{ flex: '0 0 auto', minWidth: 150, fontSize: 13.5, color: 'var(--color-text)' }}>{unDia ? fechaCorta(g.desde) : rangoTxt(g.desde, g.hasta)}</span>
      <span className="rv-item-cuerpo"><span className="rv-item-titulo" style={{ whiteSpace: 'normal' }}>{g.que}</span><span className="rv-item-sub">{g.motivo}</span></span>
      {g.origen === 'ical' ? <Chip tono="gris"><Link2 size={12} aria-hidden /> Calendario externo</Chip> : <button type="button" className="rv-btn rv-btn--sm" onClick={() => onQuitar(g.ids)}><Trash2 size={15} aria-hidden /> Quitar</button>}
    </div>
  )
}

export default function Bloqueos({ negocio, reservas, onBloqueo, onQuitarBloqueo, onIr }: P) {
  const [abrir, setAbrir] = useState(false)
  const tipo = negocio.tipo
  const unidades = unidadesDe(negocio)
  const nombre = (id: string) => unidades.find(u => u.id === id)?.nombre ?? id
  const crudos: (Omit<Grupo, 'que'> & { unidades: string[] })[] = []
  for (const b of negocio.bloqueos) {
    const clave = `${b.desde}|${b.hasta}|${b.motivo}|${b.origen}|${b.calendarioId ?? ''}`
    const g = crudos.find(x => x.clave === clave)
    if (g) { g.ids.push(b.id); g.unidades.push(nombre(b.unidadId)) } else crudos.push({ clave, ids: [b.id], unidades: [nombre(b.unidadId)], desde: b.desde, hasta: b.hasta, motivo: b.motivo, origen: b.origen })
  }
  const grupos: Grupo[] = crudos.map(g => ({ ...g, que: tipo === 'bloque' ? 'El salón' : tipo === 'cancha' && g.unidades.length === negocio.unidades.length && negocio.unidades.length > 1 ? 'Todas las canchas' : g.unidades.join(', ') }))
  const proximos = grupos.filter(g => g.hasta > HOY).sort((a, b) => a.desde.localeCompare(b.desde))
  const pasados = grupos.filter(g => g.hasta <= HOY).sort((a, b) => b.desde.localeCompare(a.desde))
  const deDias = tipo !== 'estadia'
  const quitar = (ids: string[]) => ids.forEach(id => onQuitarBloqueo(id))
  return (
    <PaginaForm rotulo={TIPOS[tipo].label} titulo={deDias ? 'Días bloqueados' : 'Bloqueos'}
      bajada={tipo === 'cancha' ? 'Mantenimiento, torneos, feriados: los días en que una cancha (o todas) no se puede reservar.' : tipo === 'bloque' ? 'Feriados, eventos propios, arreglos: los días en que nadie puede reservar el salón.' : 'Mantenimiento, uso propio o lo que se alquiló por otro lado: las noches que no se pueden reservar.'}
      acciones={<button type="button" className="rv-btn rv-btn--primario" onClick={() => setAbrir(true)}><Ban size={15} aria-hidden /> {deDias ? 'Bloquear un día' : 'Bloquear fechas'}</button>}>
      <div className="rv-pila">
        <Seccion titulo="Próximos" bajada={proximos.length ? `${cuenta(proximos.length, 'bloqueo', 'bloqueos')} por delante.` : 'Nada bloqueado por delante.'}>
          {proximos.length ? <div className="rv-lista">{proximos.map(g => <Fila key={g.clave} g={g} onQuitar={quitar} />)}</div> : <Vacio titulo={deDias ? 'Ningún día bloqueado' : 'Ninguna noche bloqueada'} texto="Todo lo que abre se puede reservar." />}
        </Seccion>
        {pasados.length > 0 && (
          <Seccion titulo="Pasados" bajada="Quedan como historial.">
            <div className="rv-lista">{pasados.map(g => <Fila key={g.clave} g={g} onQuitar={quitar} />)}</div>
          </Seccion>
        )}
        {negocio.calendariosExternos.length > 0 && (
          <Nota><span style={{ flex: 1, minWidth: 0 }}>Lo que trae un calendario externo se quita desconectando ese calendario.</span><button type="button" className="rv-btn rv-btn--sm" onClick={() => onIr('calendarios')}>Calendarios (.ics) <ArrowRight size={14} aria-hidden /></button></Nota>
        )}
      </div>
      {abrir && (deDias
        ? <BloquearDia negocio={negocio} reservas={reservas} onCerrar={() => setAbrir(false)} onBloqueos={bs => { bs.forEach(b => onBloqueo(b)); setAbrir(false) }} />
        : <BloquearFechas negocio={negocio} reservas={reservas} onCerrar={() => setAbrir(false)} onBloqueo={b => { onBloqueo(b); setAbrir(false) }} />)}
    </PaginaForm>
  )
}
