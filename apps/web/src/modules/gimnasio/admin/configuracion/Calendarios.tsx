// Calendarios (.ics). Sin sincronización en vivo con Google: eso necesita su
// API y un backend. Lo que sí: exportar la grilla de las próximas cuatro
// semanas como .ics (real) e importar la URL .ics de un calendario externo
// (simulado: no hace ningún fetch, usa un calendario de ejemplo que trae dos
// días sin clases).
import { useState } from 'react'
import { Download, Link2, Trash2, Upload } from 'lucide-react'
import { diaSemana, rangoTxt, sumarDias } from '@/lib/reservas/fechas'
import { descargarICS, generarICS, leerICS } from '@/lib/reservas/ics'
import { HOY, type BloqueoGym, type CalendarioExterno } from '../../datos'
import { Campo, Encabezado, EtiquetaDemo, Nota, Seccion } from '@/design-system/reservas/piezas'
import type { PropsConfig } from '../piezas'

const ICS_EJEMPLO = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ejemplo//Calendario externo//ES',
  `BEGIN:VEVENT\r\nUID:ext-1@ejemplo\r\nDTSTART;VALUE=DATE:${sumarDias(HOY, 10).replace(/-/g, '')}\r\nDTEND;VALUE=DATE:${sumarDias(HOY, 11).replace(/-/g, '')}\r\nSUMMARY:Competencia fuera del box\r\nEND:VEVENT`,
  `BEGIN:VEVENT\r\nUID:ext-2@ejemplo\r\nDTSTART;VALUE=DATE:${sumarDias(HOY, 24).replace(/-/g, '')}\r\nDTEND;VALUE=DATE:${sumarDias(HOY, 26).replace(/-/g, '')}\r\nSUMMARY:Mantenimiento\r\nEND:VEVENT`,
  'END:VCALENDAR',
].join('\r\n')

export default function Calendarios({ negocio, onGuardar }: PropsConfig) {
  const [url, setUrl] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const exportar = () => {
    const eventos: Parameters<typeof generarICS>[0] = []
    for (let d = 0; d < 28; d++) {
      const f = sumarDias(HOY, d)
      if (negocio.bloqueos.some(b => b.desde <= f && f < b.hasta)) continue
      for (const c of negocio.clases.filter(x => x.dia === diaSemana(f))) {
        const a = negocio.actividades.find(x => x.id === c.actividadId)
        eventos.push({ uid: `${c.id}-${f}@orbita`, titulo: `${a?.nombre ?? 'Clase'} · ${negocio.profes.find(p => p.id === c.profeId)?.nombre ?? 'sin profe'}`, inicio: { fecha: f, minuto: c.inicio }, fin: { fecha: f, minuto: c.inicio + (a?.duracion ?? 60) }, lugar: `${c.sala} · ${negocio.direccion}` })
      }
    }
    descargarICS(generarICS(eventos, { nombre: `Clases · ${negocio.nombre}` }), `clases-${negocio.slug}.ics`)
  }
  const importar = () => {
    if (!/^https?:\/\/\S+\.ics(\?\S*)?$/i.test(url.trim())) { setError('Pegá una URL que termine en .ics, como la que da Google Calendar.'); return }
    setError('')
    const id = `ce${Date.now().toString(36)}`
    const bloqueos: BloqueoGym[] = leerICS(ICS_EJEMPLO).map((e, i) => ({ id: `${id}-${i}`, desde: e.desde, hasta: e.hasta, motivo: `${nombre.trim() || 'Calendario externo'}: ${e.titulo}`, origen: 'ical' }))
    const cal: CalendarioExterno = { id, nombre: nombre.trim() || 'Calendario externo', url: url.trim(), ultimaSync: HOY }
    onGuardar({ calendariosExternos: [...negocio.calendariosExternos, cal], bloqueos: [...negocio.bloqueos, ...bloqueos] }, `Calendario conectado: ${bloqueos.length} días sin clases`, 'Demo: sincronización simulada.')
    setUrl(''); setNombre('')
  }
  const quitar = (id: string) => onGuardar({ calendariosExternos: negocio.calendariosExternos.filter(c => c.id !== id), bloqueos: negocio.bloqueos.filter(b => !b.id.startsWith(`${id}-`)) }, 'Calendario desconectado')
  return (
    <div className="rv-pagina rv-pagina--form">
      <Encabezado rotulo="Negocio" titulo="Calendarios (.ics)" bajada="La grilla en Google Calendar o en el celular de cada profe, y los cierres de un calendario externo como días sin clases." />
      <div className="rv-pila">
        <Nota tono="info">Sin sincronización en vivo con Google Calendar: eso necesita su API y un servidor. Se resuelve con iCal (.ics), que entienden Google, Apple y Outlook.</Nota>
        <Seccion titulo="Exportar" bajada="Descargá la grilla de las próximas cuatro semanas y cargala en Google Calendar o en el celular de cada profe.">
          <button type="button" className="rv-btn" onClick={exportar}><Download size={15} aria-hidden /> Descargar calendario (.ics)</button>
        </Seccion>
        <Seccion titulo="Importar" bajada="Pegá la URL .ics de un calendario externo. Los días que trae quedan sin clases." acciones={<EtiquetaDemo />}>
          <div className="rv-pila">
            <Campo label="Nombre" value={nombre} onChange={setNombre} placeholder="Google · Cierres del box" />
            <Campo label="URL del calendario" value={url} onChange={setUrl} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" error={error || undefined} ayuda="En la demo no se descarga nada: se cargan dos días de ejemplo." />
            <button type="button" className="rv-btn rv-btn--primario" style={{ alignSelf: 'flex-start' }} onClick={importar}><Upload size={15} aria-hidden /> Importar</button>
          </div>
          {negocio.calendariosExternos.length > 0 && (
            <div className="rv-lista" style={{ marginTop: 16, borderTop: '1px solid var(--color-border)' }}>
              {negocio.calendariosExternos.map(c => (
                <div key={c.id} className="rv-item">
                  <Link2 size={16} aria-hidden style={{ color: 'var(--color-subtle)', flexShrink: 0 }} />
                  <span className="rv-item-cuerpo"><span className="rv-item-titulo">{c.nombre}</span><span className="rv-item-sub">{negocio.bloqueos.filter(b => b.id.startsWith(`${c.id}-`)).map(b => rangoTxt(b.desde, sumarDias(b.hasta, -1))).join(' · ') || 'Sin días'} · última sincronización {rangoTxt(c.ultimaSync, c.ultimaSync)}</span></span>
                  <button type="button" className="rv-btn rv-btn--sm" onClick={() => quitar(c.id)}><Trash2 size={15} aria-hidden /> Quitar</button>
                </div>
              ))}
            </div>
          )}
        </Seccion>
      </div>
    </div>
  )
}
