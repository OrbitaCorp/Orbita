// Configuración del gimnasio: datos, horarios, actividades y salas, planes y
// precios, reglas de reserva, días sin clases y calendarios (.ics). Cada
// pestaña es un formulario con borrador y botón de guardar.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/router'
import { Download, Link2, Plus, Trash2, Upload } from 'lucide-react'
import { DIAS_CORTOS, MESES, diaSemana, hhmm, rangoTxt, sumarDias } from '@/lib/reservas/fechas'
import { descargarICS, generarICS, leerICS } from '@/lib/reservas/ics'
import { HOY, rubroPorKey, type Actividad, type BloqueoGym, type CalendarioExterno, type NegocioGym, type Plan } from '../datos'
import { Area, Campo, Encabezado, EtiquetaDemo, FilaSwitch, Nota, Seccion, Selector } from '@/design-system/reservas/piezas'

interface P { negocio: NegocioGym; onGuardar: (cambio: Partial<NegocioGym>, aviso?: string) => void }

type Tab = 'negocio' | 'horarios' | 'actividades' | 'planes' | 'reglas' | 'bloqueos' | 'calendarios'
const TABS: { id: Tab; label: string }[] = [
  { id: 'negocio', label: 'Datos del negocio' }, { id: 'horarios', label: 'Horarios' }, { id: 'actividades', label: 'Actividades y salas' },
  { id: 'planes', label: 'Planes y precios' }, { id: 'reglas', label: 'Reglas de reserva' }, { id: 'bloqueos', label: 'Días sin clases' }, { id: 'calendarios', label: 'Calendarios (.ics)' },
]

const CSS = `
  .gic-cfg { display: flex; gap: 20px; align-items: flex-start; }
  .gic-nav { width: 200px; flex-shrink: 0; display: flex; flex-direction: column; gap: 2px; position: sticky; top: calc(var(--rv-tope, 0px) + 80px); }
  .gic-nav button { min-height: 40px; padding: 0 12px; border-radius: 8px; border: none; background: transparent; color: var(--color-body); font: inherit; font-size: 13.5px; font-weight: 500; text-align: left; cursor: pointer; }
  .gic-nav button[aria-current='page'] { background: var(--color-primary-bg); color: var(--color-primary); font-weight: 600; }
  .gic-nav button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
  .gic-cuerpo { flex: 1; min-width: 0; }
  .gic-fila { display: grid; grid-template-columns: minmax(0, 1.4fr) 120px 110px auto; gap: 8px; align-items: end; }
  .gic-cfg-dias { display: flex; flex-wrap: wrap; gap: 6px; }
  @media (max-width: 768px) {
    /* stretch: con flex-start, en columna cada pestaña medía lo que su contenido (Datos del negocio quedaba angosta). */
    .gic-cfg { flex-direction: column; align-items: stretch; }
    .gic-nav { position: static; width: 100%; flex-direction: row; overflow-x: auto; scrollbar-width: none; padding-bottom: 4px; }
    .gic-nav button { flex-shrink: 0; min-height: 44px; }
    /* En dos filas por actividad hace falta ver dónde termina una y empieza la otra. */
    .gic-fila { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    .gic-fila + .gic-fila { padding-top: 14px; border-top: 1px solid var(--color-border); }
  }
`

/** "20 de noviembre" para un solo día y "24 al 26 de noviembre" para varios (rangoTxt solo da la segunda forma). */
const diasTxt = (desde: string, hastaIncluido: string) => (desde === hastaIncluido ? `${Number(desde.slice(8))} de ${MESES[Number(desde.slice(5, 7)) - 1]}` : rangoTxt(desde, hastaIncluido))
const HORAS = Array.from({ length: 25 }, (_, i) => ({ id: i * 60, label: i === 24 ? '24:00' : hhmm(i * 60) }))

export default function Configuracion({ negocio, onGuardar }: P) {
  const router = useRouter()
  const q = typeof router.query.tab === 'string' ? router.query.tab : ''
  const tab: Tab = TABS.some(t => t.id === q) ? (q as Tab) : 'negocio'
  const ir = (t: Tab) => router.replace({ pathname: router.pathname, query: { ...router.query, tab: t } }, undefined, { shallow: true, scroll: false })
  // En celular las pestañas son una tira que scrollea: la elegida (también si se entra por link) queda a la vista.
  const nav = useRef<HTMLElement>(null)
  useEffect(() => {
    const tira = nav.current
    const activa = tira?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!tira || !activa || tira.scrollWidth <= tira.clientWidth) return
    const enLaTira = activa.getBoundingClientRect().left - tira.getBoundingClientRect().left + tira.scrollLeft
    tira.scrollLeft = Math.max(0, enLaTira - (tira.clientWidth - activa.offsetWidth) / 2)
  }, [tab])
  return (
    <div className="rv-pagina">
      <style>{CSS}</style>
      <Encabezado rotulo={rubroPorKey(negocio.rubro).label} titulo="Configuración" bajada="Lo que cambiás acá se ve en tu sitio y en las clases al instante." />
      <div className="gic-cfg">
        <nav ref={nav} className="gic-nav" aria-label="Secciones de configuración">
          {TABS.map(t => <button key={t.id} type="button" aria-current={t.id === tab ? 'page' : undefined} onClick={() => ir(t.id)}>{t.label}</button>)}
        </nav>
        <div className="gic-cuerpo" key={tab}>
          {tab === 'negocio' && <Negocio negocio={negocio} onGuardar={onGuardar} />}
          {tab === 'horarios' && <Horarios negocio={negocio} onGuardar={onGuardar} />}
          {tab === 'actividades' && <Actividades negocio={negocio} onGuardar={onGuardar} />}
          {tab === 'planes' && <Planes negocio={negocio} onGuardar={onGuardar} />}
          {tab === 'reglas' && <Reglas negocio={negocio} onGuardar={onGuardar} />}
          {tab === 'bloqueos' && <Bloqueos negocio={negocio} onGuardar={onGuardar} />}
          {tab === 'calendarios' && <Calendarios negocio={negocio} onGuardar={onGuardar} />}
        </div>
      </div>
    </div>
  )
}

function Guardar({ children, onClick, cambiado }: { children?: ReactNode; onClick: () => void; cambiado: boolean }) {
  return (
    <div className="rv-entre" style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-border)' }}>
      <span className="rv-ayuda">{children ?? (cambiado ? 'Tenés cambios sin guardar.' : 'Todo guardado.')}</span>
      <button type="button" className="rv-btn rv-btn--primario" onClick={onClick} disabled={!cambiado}>Guardar cambios</button>
    </div>
  )
}
const num = (s: string) => Math.max(0, Math.round(Number(s.replace(/\D/g, '')) || 0))

function Negocio({ negocio, onGuardar }: P) {
  const base = { nombre: negocio.nombre, descripcion: negocio.descripcion, telefono: negocio.telefono, direccion: negocio.direccion, ciudad: negocio.ciudad }
  const [v, setV] = useState(base)
  return (
    <Seccion titulo="Datos del negocio" bajada="Aparecen en tu sitio y en cada confirmación.">
      <div className="rv-pila">
        <Campo label="Nombre" value={v.nombre} onChange={x => setV({ ...v, nombre: x })} maxLength={60} />
        <Area label="Descripción corta" value={v.descripcion} onChange={x => setV({ ...v, descripcion: x })} maxLength={240} />
        <div className="rv-dos"><Campo label="Teléfono" value={v.telefono} onChange={x => setV({ ...v, telefono: x })} inputMode="tel" /><Campo label="Ciudad" value={v.ciudad} onChange={x => setV({ ...v, ciudad: x })} /></div>
        <Campo label="Dirección" value={v.direccion} onChange={x => setV({ ...v, direccion: x })} />
      </div>
      <Guardar cambiado={JSON.stringify(v) !== JSON.stringify(base)} onClick={() => onGuardar({ ...v, nombre: v.nombre.trim() || negocio.nombre })} />
    </Seccion>
  )
}

function Horarios({ negocio, onGuardar }: P) {
  const [v, setV] = useState(negocio.apertura)
  const toggle = (d: number) => setV({ ...v, dias: v.dias.includes(d) ? v.dias.filter(x => x !== d) : [...v.dias, d].sort() })
  return (
    <Seccion titulo="Horarios" bajada="Los días y el horario dentro del que se arman las clases.">
      <div className="rv-rotulo" style={{ marginBottom: 8 }}>Días</div>
      <div className="gic-cfg-dias" role="group" aria-label="Días que abre">{DIAS_CORTOS.map((d, i) => <button key={d} type="button" className="rv-chip rv-chip--borde" aria-pressed={v.dias.includes(i)} onClick={() => toggle(i)}>{d}</button>)}</div>
      <div className="rv-dos" style={{ marginTop: 14 }}>
        {/* Si abre a la hora en que cerraba (o después), el cierre se corre: si no, el selector de "Cierra" quedaba con un valor que no está entre sus opciones. */}
        <Selector label="Abre" valor={v.desde} onChange={x => setV({ ...v, desde: x, hasta: v.hasta > x ? v.hasta : Math.min(24 * 60, x + 60) })} opciones={HORAS.slice(0, 24)} />
        <Selector label="Cierra" valor={v.hasta} onChange={x => setV({ ...v, hasta: x })} opciones={HORAS.filter(h => h.id > v.desde)} />
      </div>
      <Guardar cambiado={JSON.stringify(v) !== JSON.stringify(negocio.apertura) && v.dias.length > 0} onClick={() => onGuardar({ apertura: v })}>{v.dias.length === 0 ? 'Marcá al menos un día.' : undefined}</Guardar>
    </Seccion>
  )
}

function Actividades({ negocio, onGuardar }: P) {
  const [lista, setLista] = useState<Actividad[]>(negocio.actividades)
  const [salas, setSalas] = useState(negocio.salas.join(', '))
  const [profes, setProfes] = useState(negocio.profes.map(p => p.nombre).join(', '))
  const cambiado = JSON.stringify(lista) !== JSON.stringify(negocio.actividades) || salas !== negocio.salas.join(', ') || profes !== negocio.profes.map(p => p.nombre).join(', ')
  const editar = (id: string, c: Partial<Actividad>) => setLista(l => l.map(a => (a.id === id ? { ...a, ...c } : a)))
  const COLORES = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DB2777', '#0891B2']
  const guardar = () => {
    const nuevasSalas = salas.split(',').map(s => s.trim()).filter(Boolean)
    const nombresProfes = profes.split(',').map(s => s.trim()).filter(Boolean)
    const nuevosProfes = nombresProfes.map((nombre, i) => negocio.profes.find(p => p.nombre === nombre) ?? { id: `p${Date.now().toString(36)}${i}`, nombre })
    // Las clases que apuntan a una sala o un profe que ya no existe pasan al primero.
    const clases = negocio.clases.map(c => ({ ...c, sala: nuevasSalas.includes(c.sala) ? c.sala : nuevasSalas[0] ?? c.sala, profeId: nuevosProfes.some(p => p.id === c.profeId) ? c.profeId : nuevosProfes[0]?.id ?? c.profeId })).filter(c => lista.some(a => a.id === c.actividadId))
    onGuardar({ actividades: lista.map(a => ({ ...a, nombre: a.nombre.trim() || 'Actividad' })), salas: nuevasSalas.length ? nuevasSalas : negocio.salas, profes: nuevosProfes.length ? nuevosProfes : negocio.profes, clases })
  }
  return (
    <div className="rv-pila">
      <Seccion titulo="Actividades" bajada="Lo que se dicta, con duración y cupo por defecto. El cupo se puede ajustar clase por clase en la grilla."
        acciones={<button type="button" className="rv-btn rv-btn--sm" onClick={() => setLista([...lista, { id: `a${Date.now().toString(36)}`, nombre: 'Nueva actividad', duracion: 60, cupo: 12, color: COLORES[lista.length % COLORES.length] }])}><Plus size={15} aria-hidden /> Agregar</button>}>
        <div className="rv-pila">
          {lista.map(a => (
            <div key={a.id} className="gic-fila">
              <Campo label="Nombre" value={a.nombre} onChange={x => editar(a.id, { nombre: x })} />
              <Selector label="Dura" valor={a.duracion} onChange={x => editar(a.id, { duracion: x })} opciones={[30, 45, 50, 60, 75, 90, 120, 150].map(m => ({ id: m, label: `${m} min` }))} />
              <Campo label="Cupo" value={String(a.cupo)} onChange={x => editar(a.id, { cupo: Math.max(1, num(x)) })} inputMode="numeric" />
              <button type="button" className="rv-btn rv-btn--icono" onClick={() => setLista(lista.filter(x => x.id !== a.id))} aria-label={`Quitar ${a.nombre}`} disabled={lista.length <= 1}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </Seccion>
      <Seccion titulo="Salas y profes" bajada="Separados por coma. Cada clase de la grilla tiene una sala y un profe.">
        <div className="rv-dos">
          <Campo label="Salas" value={salas} onChange={setSalas} placeholder="Salón principal, Sala 2" />
          <Campo label="Profes" value={profes} onChange={setProfes} placeholder="Caro, Nico, Flor" />
        </div>
        <Guardar cambiado={cambiado} onClick={guardar} />
      </Seccion>
    </div>
  )
}

function Planes({ negocio, onGuardar }: P) {
  const [lista, setLista] = useState<Plan[]>(negocio.planes)
  const editar = (id: string, c: Partial<Plan>) => setLista(l => l.map(p => (p.id === id ? { ...p, ...c } : p)))
  const TIPO: Record<Plan['tipo'], string> = { prueba: 'Prueba (una vez por persona)', suelta: 'Clase suelta', pack: 'Pack de clases', membresia: 'Membresía mensual' }
  return (
    <Seccion titulo="Planes y precios" bajada="La clase de prueba es gratis y vale una vez por persona. Las membresías se renuevan cada mes."
      acciones={<button type="button" className="rv-btn rv-btn--sm" onClick={() => setLista([...lista, { id: `pl${Date.now().toString(36)}`, tipo: 'membresia', nombre: 'Nuevo plan', precio: 50000, porSemana: 2, vigenciaDias: 30, activo: true }])}><Plus size={15} aria-hidden /> Agregar</button>}>
      <div className="rv-pila">
        {lista.map(p => (
          <div key={p.id} className="rv-card rv-card--pad" style={{ background: 'var(--color-surface)' }}>
            <div className="rv-entre" style={{ marginBottom: 10 }}><span className="rv-rotulo">{TIPO[p.tipo]}</span>{p.tipo !== 'prueba' && <button type="button" className="rv-btn rv-btn--sm rv-btn--fantasma" onClick={() => setLista(lista.filter(x => x.id !== p.id))}><Trash2 size={14} aria-hidden /> Quitar</button>}</div>
            <div className="rv-grid rv-grid--3">
              <Campo label="Nombre" value={p.nombre} onChange={x => editar(p.id, { nombre: x })} />
              {p.tipo !== 'prueba' && <Campo label="Precio" prefijo="$" value={String(p.precio)} onChange={x => editar(p.id, { precio: num(x) })} inputMode="numeric" />}
              {p.tipo === 'pack' && <Campo label="Clases" value={String(p.clases ?? 0)} onChange={x => editar(p.id, { clases: Math.max(1, num(x)) })} inputMode="numeric" />}
              {p.tipo === 'membresia' && <Selector label="Por semana" valor={p.porSemana ?? 0} onChange={x => editar(p.id, { porSemana: x })} opciones={[0, 1, 2, 3, 4, 5].map(n => ({ id: n, label: n ? `${n} clases` : 'Libre' }))} />}
              {(p.tipo === 'pack' || p.tipo === 'membresia') && <Selector label="Vigencia" valor={p.vigenciaDias} onChange={x => editar(p.id, { vigenciaDias: x })} opciones={[30, 60, 90, 180].map(d => ({ id: d, label: `${d} días` }))} />}
            </div>
            <FilaSwitch titulo="Se ofrece en el sitio" ayuda={p.tipo === 'pack' || p.tipo === 'membresia' ? 'Apagado, los socios que ya lo tienen lo siguen usando.' : 'Apagado, no aparece en el sitio ni al reservar.'} on={p.activo} onChange={x => editar(p.id, { activo: x })} />
          </div>
        ))}
      </div>
      <Guardar cambiado={JSON.stringify(lista) !== JSON.stringify(negocio.planes)} onClick={() => onGuardar({ planes: lista })} />
    </Seccion>
  )
}

function Reglas({ negocio, onGuardar }: P) {
  const base = { anticipacionDias: negocio.anticipacionDias, cancelaHastaHoras: negocio.cancelaHastaHoras, checkInMin: negocio.checkInMin }
  const [v, setV] = useState(base)
  return (
    <Seccion titulo="Reglas de reserva" bajada="Hasta cuándo se reserva, hasta cuándo se cancela sin perder la clase y desde cuándo se hace check-in.">
      <div className="rv-grid rv-grid--3">
        <Selector label="Se reserva hasta" valor={v.anticipacionDias} onChange={x => setV({ ...v, anticipacionDias: x })} opciones={[3, 7, 14, 21, 30].map(d => ({ id: d, label: `${d} días adelante` }))} />
        <Selector label="Cancelación sin cargo" valor={v.cancelaHastaHoras} onChange={x => setV({ ...v, cancelaHastaHoras: x })} opciones={[1, 2, 4, 6, 12, 24].map(h => ({ id: h, label: `hasta ${h} h antes` }))} />
        <Selector label="Check-in desde" valor={v.checkInMin} onChange={x => setV({ ...v, checkInMin: x })} opciones={[15, 30, 45, 60].map(m => ({ id: m, label: `${m} min antes` }))} />
      </div>
      <Guardar cambiado={JSON.stringify(v) !== JSON.stringify(base)} onClick={() => onGuardar(v)} />
    </Seccion>
  )
}

function Bloqueos({ negocio, onGuardar }: P) {
  const [desde, setDesde] = useState(sumarDias(HOY, 7))
  const [hasta, setHasta] = useState(sumarDias(HOY, 8))
  const [motivo, setMotivo] = useState('Cerrado')
  const agregar = () => {
    if (!desde || !hasta || hasta <= desde) return
    onGuardar({ bloqueos: [...negocio.bloqueos, { id: `bg${Date.now().toString(36)}`, desde, hasta, motivo: motivo.trim() || 'Cerrado', origen: 'dueno' }] }, 'Días sin clases guardados')
  }
  return (
    <Seccion titulo="Días sin clases" bajada="Feriados, vacaciones o cierres: esos días no se puede reservar y la grilla no se muestra.">
      <div className="rv-lista" style={{ marginBottom: 14 }}>
        {negocio.bloqueos.map(b => (
          <div key={b.id} className="rv-item">
            <span className="rv-item-cuerpo"><span className="rv-item-titulo">{diasTxt(b.desde, sumarDias(b.hasta, -1))}</span><span className="rv-item-sub">{b.motivo} · {b.origen === 'ical' ? 'calendario externo' : 'lo pusiste vos'}</span></span>
            {b.origen === 'dueno' && <button type="button" className="rv-btn rv-btn--sm" onClick={() => onGuardar({ bloqueos: negocio.bloqueos.filter(x => x.id !== b.id) }, 'Bloqueo quitado')}><Trash2 size={14} aria-hidden /> Quitar</button>}
          </div>
        ))}
        {negocio.bloqueos.length === 0 && <p className="rv-ayuda" style={{ margin: '4px 0' }}>Ninguno.</p>}
      </div>
      <div className="rv-grid rv-grid--3" style={{ alignItems: 'end' }}>
        <Campo label="Desde" type="date" value={desde} onChange={setDesde} />
        <Campo label="Hasta (sin incluir)" type="date" value={hasta} onChange={setHasta} />
        <Campo label="Motivo" value={motivo} onChange={setMotivo} />
      </div>
      <button type="button" className="rv-btn rv-btn--primario" style={{ marginTop: 12 }} onClick={agregar} disabled={!desde || !hasta || hasta <= desde}><Plus size={15} aria-hidden /> Agregar</button>
    </Seccion>
  )
}

// ─── Calendarios (.ics) ──────────────────────────────────────────────────────
// Sin sincronización en vivo con Google: eso necesita su API y un backend. Lo
// que sí: exportar la grilla de las próximas cuatro semanas como .ics (real) e
// importar la URL .ics de un calendario externo (simulado: no hace ningún
// fetch, usa un calendario de ejemplo que trae dos días sin clases).

const ICS_EJEMPLO = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ejemplo//Calendario externo//ES',
  `BEGIN:VEVENT\r\nUID:ext-1@ejemplo\r\nDTSTART;VALUE=DATE:${sumarDias(HOY, 10).replace(/-/g, '')}\r\nDTEND;VALUE=DATE:${sumarDias(HOY, 11).replace(/-/g, '')}\r\nSUMMARY:Competencia fuera del box\r\nEND:VEVENT`,
  `BEGIN:VEVENT\r\nUID:ext-2@ejemplo\r\nDTSTART;VALUE=DATE:${sumarDias(HOY, 24).replace(/-/g, '')}\r\nDTEND;VALUE=DATE:${sumarDias(HOY, 26).replace(/-/g, '')}\r\nSUMMARY:Mantenimiento\r\nEND:VEVENT`,
  'END:VCALENDAR',
].join('\r\n')

function Calendarios({ negocio, onGuardar }: P) {
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
        eventos.push({ uid: `${c.id}-${f}@orbita`, titulo: `${a?.nombre ?? 'Clase'} · ${negocio.profes.find(p => p.id === c.profeId)?.nombre ?? ''}`, inicio: { fecha: f, minuto: c.inicio }, fin: { fecha: f, minuto: c.inicio + (a?.duracion ?? 60) }, lugar: `${c.sala} · ${negocio.direccion}` })
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
    onGuardar({ calendariosExternos: [...negocio.calendariosExternos, cal], bloqueos: [...negocio.bloqueos, ...bloqueos] }, `Calendario conectado: ${bloqueos.length} días sin clases. Demo: sincronización simulada.`)
    setUrl(''); setNombre('')
  }
  const quitar = (id: string) => onGuardar({ calendariosExternos: negocio.calendariosExternos.filter(c => c.id !== id), bloqueos: negocio.bloqueos.filter(b => !b.id.startsWith(`${id}-`)) }, 'Calendario desconectado')
  return (
    <div className="rv-pila">
      <Nota tono="info">Sin sincronización en vivo con Google Calendar: eso necesita su API y un servidor. Se resuelve con iCal (.ics).</Nota>
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
                <span className="rv-item-cuerpo"><span className="rv-item-titulo">{c.nombre}</span><span className="rv-item-sub">{negocio.bloqueos.filter(b => b.id.startsWith(`${c.id}-`)).map(b => diasTxt(b.desde, sumarDias(b.hasta, -1))).join(' · ') || 'Sin días'} · última sincronización {diasTxt(c.ultimaSync, c.ultimaSync)}</span></span>
                <button type="button" className="rv-btn rv-btn--sm" onClick={() => quitar(c.id)}><Trash2 size={15} aria-hidden /> Quitar</button>
              </div>
            ))}
          </div>
        )}
      </Seccion>
    </div>
  )
}
