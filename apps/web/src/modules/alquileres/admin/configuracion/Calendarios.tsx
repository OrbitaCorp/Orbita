// Calendarios externos (.ics). No hay sincronización con Airbnb, Booking ni
// Google: eso necesita las APIs de cada uno y un backend. Lo que sí: exportar
// el calendario de cada unidad como .ics (real, se genera acá) e importar la
// URL .ics de un calendario externo (simulado: no hace ningún fetch, usa un
// calendario de ejemplo). Lo importado bloquea de verdad: en los tres modos,
// ese día no se puede reservar.
import { useState } from 'react'
import { Download, Link2, Trash2, Upload } from 'lucide-react'
import { fechaCorta, rangoTxt, sumarDias } from '@/lib/reservas/fechas'
import { descargarICS, generarICS, leerICS, type EventoICS } from '@/lib/reservas/ics'
import { EtiquetaDemo, Campo, Nota, Seccion, Selector } from '@/design-system/reservas/piezas'
import { HOY, TIPOS, cuenta, palabrasDe, unidadesDe, type Bloqueo, type CalendarioExterno, type NegocioAlquiler, type Reserva } from '../../datos'
import { deCalendario } from '../../datos/negocio'
import { PaginaForm, idNuevo } from './comun'

interface P {
  negocio: NegocioAlquiler
  reservas: Reserva[]
  onCalendario: (c: CalendarioExterno, bloqueos: Bloqueo[]) => void
  onQuitarCalendario: (id: string) => void
}

const ICS_EJEMPLO = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ejemplo//Calendario externo//ES',
  `BEGIN:VEVENT\r\nUID:ext-1@ejemplo\r\nDTSTART;VALUE=DATE:${sumarDias(HOY, 9).replace(/-/g, '')}\r\nDTEND;VALUE=DATE:${sumarDias(HOY, 12).replace(/-/g, '')}\r\nSUMMARY:Reservado\r\nEND:VEVENT`,
  `BEGIN:VEVENT\r\nUID:ext-2@ejemplo\r\nDTSTART;VALUE=DATE:${sumarDias(HOY, 20).replace(/-/g, '')}\r\nDTEND;VALUE=DATE:${sumarDias(HOY, 22).replace(/-/g, '')}\r\nSUMMARY:No disponible\r\nEND:VEVENT`,
  'END:VCALENDAR',
].join('\r\n')

/** "Cabaña Arrayán" → "cabana-arrayan.ics": sin tildes ni espacios, que algunos sistemas no aceptan. */
const nombreArchivo = (s: string) => `${s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'calendario'}.ics`

export default function Calendarios({ negocio, reservas, onCalendario, onQuitarCalendario }: P) {
  const unidades = unidadesDe(negocio)
  const [unidadId, setUnidadId] = useState(unidades[0]?.id ?? '')
  const [url, setUrl] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const exportar = (id: string) => {
    const u = unidades.find(x => x.id === id)
    const suyas = reservas.filter(r => r.unidadId === id && r.estado !== 'cancelada')
    const eventos: EventoICS[] = suyas.map(r => r.entrada && r.salida
      ? { uid: `${r.id}@orbita`, titulo: 'Reservado', fecha: r.entrada, hasta: r.salida }
      : { uid: `${r.id}@orbita`, titulo: r.evento ? `Evento: ${r.evento.agasajado}` : 'Reservado', inicio: { fecha: r.fecha ?? HOY, minuto: r.inicio ?? 0 }, fin: { fecha: r.fecha ?? HOY, minuto: r.fin ?? 0 } })
    // Lo que bloqueó el dueño sale como "No disponible", así el otro sistema tampoco lo vende. Lo que vino de un calendario externo no se reexporta.
    const propios: EventoICS[] = negocio.bloqueos.filter(b => b.unidadId === id && b.origen === 'dueno').map(b => ({ uid: `${b.id}@orbita`, titulo: 'No disponible', fecha: b.desde, hasta: b.hasta }))
    descargarICS(generarICS([...eventos, ...propios], { nombre: `${u?.nombre ?? negocio.nombre} · ${negocio.nombre}` }), nombreArchivo(u?.nombre ?? negocio.nombre))
  }
  const importar = () => {
    // Airbnb y Google dan una URL que termina en .ics; la de Booking termina en ical.html?t=…: valen las dos.
    const u = url.trim()
    if (!/^https?:\/\/\S+$/i.test(u) || !/\.ics\b|ical/i.test(u)) { setError('Pegá la URL del calendario (.ics o iCal) que te dan Airbnb, Booking o Google.'); return }
    setError('')
    const id = idNuevo('ce')
    // Un evento con hora ocupa su día entero: el bloqueo es de días.
    const bloqueos: Bloqueo[] = leerICS(ICS_EJEMPLO).map((e, i) => ({ id: `${id}-${i}`, unidadId, desde: e.desde, hasta: e.hasta > e.desde ? e.hasta : sumarDias(e.desde, 1), motivo: `${nombre.trim() || 'Calendario externo'}: ${e.titulo}`, origen: 'ical', calendarioId: id }))
    onCalendario({ id, unidadId, nombre: nombre.trim() || 'Calendario externo', url: url.trim(), ultimaSync: HOY }, bloqueos)
    setUrl(''); setNombre('')
  }
  return (
    <PaginaForm rotulo={TIPOS[negocio.tipo].label} titulo="Calendarios (.ics)" bajada="Exportá tus reservas a Google Calendar, Airbnb o Booking, e importá lo que tengas reservado por otro lado para que acá quede bloqueado.">
      <div className="rv-pila">
        <Nota tono="info"><span>Sin sincronización en vivo con Airbnb, Booking ni Google: eso necesita las APIs de cada uno y un servidor. Se resuelve con iCal (.ics), el formato que esos servicios ya usan.</span></Nota>
        <Seccion titulo="Exportar" bajada={`Descargá el calendario de cada ${palabrasDe(negocio).unidad} con sus reservas y cargalo en Google Calendar, Airbnb o Booking.`}>
          <div className="rv-lista">
            {unidades.map(u => (
              <div key={u.id} className="rv-item" style={{ flexWrap: 'wrap' }}>
                <span className="rv-item-cuerpo" style={{ minWidth: 140 }}><span className="rv-item-titulo">{u.nombre}</span><span className="rv-item-sub">{cuenta(reservas.filter(r => r.unidadId === u.id && r.estado !== 'cancelada').length, 'reserva', 'reservas')}</span></span>
                <button type="button" className="rv-btn rv-btn--sm" onClick={() => exportar(u.id)}><Download size={15} aria-hidden /> Descargar calendario (.ics)</button>
              </div>
            ))}
          </div>
        </Seccion>
        <Seccion titulo="Importar" bajada="Pegá la URL .ics de un calendario externo. Las fechas que trae quedan bloqueadas." acciones={<EtiquetaDemo />}>
          <div className="rv-pila">
            <div className="rv-dos">
              <Selector label="Para" valor={unidadId} onChange={setUnidadId} opciones={unidades.map(u => ({ id: u.id, label: u.nombre }))} />
              <Campo label="Nombre" value={nombre} onChange={setNombre} placeholder="Airbnb · Cabaña Lapacho" />
            </div>
            <Campo label="URL del calendario" value={url} onChange={setUrl} placeholder="https://www.airbnb.com/calendar/ical/…ics" error={error || undefined} ayuda="En la demo no se descarga nada: se cargan dos bloqueos de ejemplo." inputMode="text" />
            <button type="button" className="rv-btn rv-btn--primario" style={{ alignSelf: 'flex-start' }} onClick={importar}><Upload size={15} aria-hidden /> Importar</button>
          </div>
          {negocio.calendariosExternos.length > 0 && (
            <div className="rv-lista" style={{ marginTop: 16, borderTop: '1px solid var(--color-border)' }}>
              {negocio.calendariosExternos.map(c => {
                const suyos = negocio.bloqueos.filter(b => b.origen === 'ical' && deCalendario(b, c.id))
                return (
                  <div key={c.id} style={{ padding: '4px 0 10px' }}>
                    <div className="rv-item">
                      <Link2 size={16} aria-hidden style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
                      {/* El título se parte en dos renglones si hace falta: cortado con "…" no se leía a qué propiedad va. */}
                      <span className="rv-item-cuerpo"><span className="rv-item-titulo" style={{ whiteSpace: 'normal' }}>{c.nombre} → {unidades.find(u => u.id === c.unidadId)?.nombre}</span><span className="rv-item-sub">Última sincronización: {fechaCorta(c.ultimaSync)} · {suyos.length} {suyos.length === 1 ? 'bloqueo' : 'bloqueos'}</span></span>
                      <button type="button" className="rv-btn rv-btn--sm" onClick={() => onQuitarCalendario(c.id)}><Trash2 size={15} aria-hidden /> Quitar</button>
                    </div>
                    {suyos.length > 0
                      ? <ul className="alc-bloqueos" aria-label={`Bloqueos que trae ${c.nombre}`}>{suyos.map(b => <li key={b.id}><span>{rangoTxt(b.desde, b.hasta)}</span><span>{b.motivo}</span></li>)}</ul>
                      : <p className="rv-ayuda" style={{ margin: '0 0 0 28px' }}>No trae fechas bloqueadas.</p>}
                  </div>
                )
              })}
            </div>
          )}
        </Seccion>
      </div>
    </PaginaForm>
  )
}
