// Configuración del negocio de Alquileres: datos, horarios, reglas de reserva,
// lo propio de cada modo (canchas y precios por franja, paquetes y extras del
// salón, propiedades y bloqueos) y los calendarios externos (.ics). Cada
// pestaña es un formulario con borrador y botón de guardar; lo guardado va al
// almacén de la demo y se ve en el sitio y en la agenda.
//
// En celular las pestañas son la tira de chips estándar del panel (ds-tira de
// globals.css) y cada fila de campos se apila: nada de anchos fijos que no
// entren en 390 px.
import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/router'
import { Download, Link2, Plus, Trash2, Upload } from 'lucide-react'
import { DIAS_CORTOS, duracionTxt, fechaCorta, hhmm, rangoTxt, sumarDias } from '@/lib/reservas/fechas'
import { armarBloques } from '@/lib/reservas/disponibilidad'
import { descargarICS, generarICS, leerICS, type EventoICS } from '@/lib/reservas/ics'
import { HOY, TIPOS, cuenta, unidadesDe, type Bloqueo, type CalendarioExterno, type NegocioAlquiler, type Paquete, type Propiedad, type Reserva, type Unidad } from '../datos'
import { deCalendario } from '../datos/negocio'
import { Mapa } from '../storefront/Sitio'
import { Campo, Area, Encabezado, EtiquetaDemo, Nota, Seccion, Selector } from '@/design-system/reservas/piezas'

interface P {
  negocio: NegocioAlquiler
  reservas: Reserva[]
  onGuardar: (cambio: Partial<NegocioAlquiler>, aviso?: string) => void
  onCalendario: (c: CalendarioExterno, bloqueos: Bloqueo[]) => void
  onQuitarCalendario: (id: string) => void
}

type Tab = 'negocio' | 'horarios' | 'reglas' | 'unidades' | 'precios' | 'salon' | 'propiedades' | 'calendarios'

/** Id para lo que se agrega. Solo desde handlers: Date.now no va en el render. */
const idNuevo = (prefijo: string) => `${prefijo}${Date.now().toString(36)}`

const CSS = `
  .alc { display: flex; gap: 20px; align-items: flex-start; }
  .alc-nav { width: 200px; flex-shrink: 0; display: flex; flex-direction: column; gap: 2px; position: sticky; top: calc(var(--rv-tope, 0px) + 80px); }
  .alc-nav button { min-height: 40px; padding: 0 12px; border-radius: 8px; border: none; background: transparent; color: var(--color-body); font: inherit; font-size: 13.5px; font-weight: 500; text-align: left; cursor: pointer; }
  .alc-nav button[aria-current='page'] { background: var(--color-primary-bg); color: var(--color-primary); font-weight: 600; }
  .alc-nav button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
  .alc-cuerpo { flex: 1; min-width: 0; }
  .alc-fila { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) 120px auto; gap: 8px; align-items: end; }
  .alc-fila--extra { grid-template-columns: minmax(0, 1fr) 140px auto; }
  .alc-fila--paquete { grid-template-columns: minmax(0, 1fr) 110px 140px auto; }
  .alc-fila--temporada { grid-template-columns: minmax(0, 1fr) 150px 150px 140px auto; }
  .alc-paquete { display: flex; flex-direction: column; gap: 8px; }
  .alc-dias { display: flex; flex-wrap: wrap; gap: 6px; }
  .alc-horas { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
  .alc-fotos { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
  .alc-fotos img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 8px; display: block; background: var(--color-surface-alt); }
  .alc .als-mapa { aspect-ratio: 16 / 9; border-radius: 12px; overflow: hidden; border: 1px solid var(--color-border); background: var(--color-surface-alt); }
  .alc .als-mapa iframe { width: 100%; height: 100%; border: 0; display: block; }
  .alc-bloqueos { margin: 0 0 4px 28px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--color-body); }
  .alc-bloqueos li { display: flex; flex-wrap: wrap; gap: 2px 10px; }
  .alc-bloqueos li span:first-child { font-weight: 600; color: var(--color-text); }
  @media (max-width: 768px) {
    /* stretch: con flex-start, en columna el cuerpo tomaba el ancho de su contenido
       (un título que no se corta, la tira de propiedades) y la página corría de costado. */
    .alc { flex-direction: column; align-items: stretch; }
    /* La tira estándar (ds-tira) pone las píldoras; acá solo el sentido y los 44 px de alto. */
    .alc-nav { position: static; width: 100%; flex-direction: row; padding-bottom: 4px; }
    .alc-nav .ds-tira-chip { min-height: 44px !important; }
    /* El nombre arriba con el tachito al lado (solo en un renglón quedaba huérfano) y el resto de a dos,
       en dos mitades enteras: con una tercera columna para el tachito, las fechas no entraban. */
    .alc-fila, .alc-fila--extra, .alc-fila--paquete, .alc-fila--temporada { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); padding-bottom: 14px; border-bottom: 1px solid var(--color-border); }
    .alc-fila > :first-child { grid-column: 1 / -1; grid-row: 1; margin-right: 54px; }
    .alc-fila > button:last-child { grid-column: 2; grid-row: 1; justify-self: end; }
    .alc-fila > :nth-child(2n + 2):not(:last-child) { grid-column: 1; }
    .alc-fila > :nth-child(2n + 3):not(:last-child) { grid-column: 2; }
    .alc-paquete { padding-bottom: 14px; border-bottom: 1px solid var(--color-border); }
    .alc-paquete .alc-fila { padding-bottom: 0; border-bottom: none; }
    .alc-bloqueos { margin-left: 0; }
  }
`

export default function Configuracion({ negocio, reservas, onGuardar, onCalendario, onQuitarCalendario }: P) {
  const router = useRouter()
  const tipo = negocio.tipo
  const tabs: { id: Tab; label: string }[] = [
    { id: 'negocio', label: 'Datos del negocio' },
    ...(tipo !== 'estadia' ? [{ id: 'horarios' as Tab, label: 'Horarios' }] : []),
    { id: 'reglas', label: 'Reglas de reserva' },
    ...(tipo === 'cancha' ? [{ id: 'unidades' as Tab, label: 'Canchas y extras' }, { id: 'precios' as Tab, label: 'Precios por horario' }] : []),
    ...(tipo === 'bloque' ? [{ id: 'salon' as Tab, label: 'Salón, paquetes y extras' }] : []),
    ...(tipo === 'estadia' ? [{ id: 'propiedades' as Tab, label: 'Propiedades' }] : []),
    { id: 'calendarios', label: 'Calendarios (.ics)' },
  ]
  const q = typeof router.query.tab === 'string' ? router.query.tab : ''
  const tab: Tab = tabs.some(t => t.id === q) ? (q as Tab) : 'negocio'
  const ir = (t: Tab) => router.replace({ pathname: router.pathname, query: { ...router.query, tab: t } }, undefined, { shallow: true, scroll: false })
  return (
    <div className="rv-pagina">
      <style>{CSS}</style>
      <Encabezado rotulo={TIPOS[tipo].label} titulo="Configuración" bajada="Lo que cambiás acá se ve en tu sitio y en la agenda al instante." />
      <div className="alc">
        <nav className="alc-nav ds-tira" aria-label="Secciones de configuración">
          {tabs.map(t => <button key={t.id} type="button" className="ds-tira-chip" data-activa={t.id === tab} aria-current={t.id === tab ? 'page' : undefined} onClick={() => ir(t.id)}>{t.label}</button>)}
        </nav>
        <div className="alc-cuerpo" key={tab}>
          {tab === 'negocio' && <Negocio negocio={negocio} onGuardar={onGuardar} />}
          {tab === 'horarios' && <Horarios negocio={negocio} onGuardar={onGuardar} />}
          {tab === 'reglas' && <Reglas negocio={negocio} onGuardar={onGuardar} />}
          {tab === 'unidades' && <Unidades negocio={negocio} onGuardar={onGuardar} />}
          {tab === 'precios' && <Precios negocio={negocio} onGuardar={onGuardar} />}
          {tab === 'salon' && <SalonCfg negocio={negocio} onGuardar={onGuardar} />}
          {tab === 'propiedades' && <Propiedades negocio={negocio} onGuardar={onGuardar} />}
          {tab === 'calendarios' && <Calendarios negocio={negocio} reservas={reservas} onCalendario={onCalendario} onQuitarCalendario={onQuitarCalendario} />}
        </div>
      </div>
    </div>
  )
}

type Form = { negocio: NegocioAlquiler; onGuardar: P['onGuardar'] }

function Guardar({ children, onClick, cambiado }: { children?: ReactNode; onClick: () => void; cambiado: boolean }) {
  return (
    <div className="rv-entre" style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-border)' }}>
      <span className="rv-ayuda">{children ?? (cambiado ? 'Tenés cambios sin guardar.' : 'Todo guardado.')}</span>
      <button type="button" className="rv-btn rv-btn--primario" onClick={onClick} disabled={!cambiado}>Guardar cambios</button>
    </div>
  )
}

const num = (s: string) => Math.max(0, Math.round(Number(s.replace(/\D/g, '')) || 0))

function Negocio({ negocio, onGuardar }: Form) {
  const [v, setV] = useState({ nombre: negocio.nombre, descripcion: negocio.descripcion, telefono: negocio.telefono, direccion: negocio.direccion, ciudad: negocio.ciudad })
  const cambiado = JSON.stringify(v) !== JSON.stringify({ nombre: negocio.nombre, descripcion: negocio.descripcion, telefono: negocio.telefono, direccion: negocio.direccion, ciudad: negocio.ciudad })
  return (
    <Seccion titulo="Datos del negocio" bajada="Aparecen en tu sitio, en cada confirmación y en el pie de cada reserva.">
      <div className="rv-pila">
        <Campo label="Nombre" value={v.nombre} onChange={x => setV({ ...v, nombre: x })} maxLength={60} />
        <Area label="Descripción corta" value={v.descripcion} onChange={x => setV({ ...v, descripcion: x })} maxLength={240} ayuda="Es lo primero que se lee en la portada." />
        <div className="rv-dos">
          <Campo label="Teléfono" value={v.telefono} onChange={x => setV({ ...v, telefono: x })} inputMode="tel" />
          <Campo label="Ciudad" value={v.ciudad} onChange={x => setV({ ...v, ciudad: x })} />
        </div>
        <Campo label="Dirección" value={v.direccion} onChange={x => setV({ ...v, direccion: x })} />
      </div>
      <Guardar cambiado={cambiado} onClick={() => onGuardar({ ...v, nombre: v.nombre.trim() || negocio.nombre })} />
    </Seccion>
  )
}

const HORAS = Array.from({ length: 25 }, (_, i) => ({ id: i * 60, label: i === 24 ? '24:00' : hhmm(i * 60) }))

function Horarios({ negocio, onGuardar }: Form) {
  const [v, setV] = useState(negocio.apertura)
  const cambiado = JSON.stringify(v) !== JSON.stringify(negocio.apertura)
  const toggle = (d: number) => setV({ ...v, dias: v.dias.includes(d) ? v.dias.filter(x => x !== d) : [...v.dias, d].sort() })
  return (
    <Seccion titulo="Horarios" bajada={negocio.tipo === 'bloque' ? 'Los días que abre el salón y el horario dentro del que se arman los bloques.' : 'Los días y el horario en que se puede reservar.'}>
      <div className="rv-rotulo" style={{ marginBottom: 8 }}>Días</div>
      <div className="alc-dias" role="group" aria-label="Días que abre">
        {DIAS_CORTOS.map((d, i) => <button key={d} type="button" className="rv-chip rv-chip--borde" aria-pressed={v.dias.includes(i)} onClick={() => toggle(i)}>{d}</button>)}
      </div>
      <div className="rv-dos" style={{ marginTop: 14 }}>
        <Selector label="Abre" valor={v.desde} onChange={x => setV({ ...v, desde: x, hasta: Math.max(v.hasta, x + 60) })} opciones={HORAS.slice(0, 24)} />
        <Selector label="Cierra" valor={v.hasta} onChange={x => setV({ ...v, hasta: x })} opciones={HORAS.filter(h => h.id > v.desde)} />
      </div>
      <Guardar cambiado={cambiado && v.dias.length > 0} onClick={() => onGuardar({ apertura: v })}>{v.dias.length === 0 ? 'Marcá al menos un día.' : undefined}</Guardar>
    </Seccion>
  )
}

function Reglas({ negocio, onGuardar }: Form) {
  const [v, setV] = useState({ senaPct: negocio.senaPct, cancelaHastaHoras: negocio.cancelaHastaHoras, pasoMin: negocio.pasoMin, duracionMin: negocio.duracionMin, maxFranjas: negocio.maxFranjas })
  const cambiado = JSON.stringify(v) !== JSON.stringify({ senaPct: negocio.senaPct, cancelaHastaHoras: negocio.cancelaHastaHoras, pasoMin: negocio.pasoMin, duracionMin: negocio.duracionMin, maxFranjas: negocio.maxFranjas })
  const tipo = negocio.tipo
  return (
    <Seccion titulo="Reglas de reserva" bajada="Cuánto se paga al reservar y hasta cuándo se puede cancelar.">
      <div className="rv-dos">
        <Selector label="Seña al reservar" ayuda="Se registra a mano. El resto, en el lugar." valor={v.senaPct} onChange={x => setV({ ...v, senaPct: x })} opciones={[0, 20, 30, 50, 100].map(p => ({ id: p, label: p === 0 ? 'Sin seña' : p === 100 ? 'Se paga todo' : `${p}%` }))} />
        <Selector label="Cancelación sin cargo" ayuda="Hasta cuánto antes se devuelve la seña." valor={v.cancelaHastaHoras} onChange={x => setV({ ...v, cancelaHastaHoras: x })} opciones={[2, 6, 12, 24, 48, 72, 168].map(h => ({ id: h, label: h < 24 ? `${h} horas antes` : `${h / 24} ${h / 24 === 1 ? 'día' : 'días'} antes` }))} />
      </div>
      {tipo === 'cancha' && (
        <>
          <div className="rv-dos" style={{ marginTop: 12 }}>
            <Selector label="Duración mínima" ayuda="Un turno: lo menos que se puede reservar." valor={v.duracionMin} onChange={x => setV({ ...v, duracionMin: x, pasoMin: Math.min(v.pasoMin, x) })} opciones={[30, 60, 90, 120].map(m => ({ id: m, label: duracionTxt(m) }))} />
            <Selector label="Saltos de horario" ayuda="Cada cuánto arranca un turno: 9:00, 9:30, 10:00…" valor={v.pasoMin} onChange={x => setV({ ...v, pasoMin: x })} opciones={[15, 30, 60, 90, 120].filter(m => m <= v.duracionMin).map(m => ({ id: m, label: `Cada ${duracionTxt(m)}` }))} />
          </div>
          <div className="rv-dos" style={{ marginTop: 12 }}>
            <Selector label="Turnos seguidos" ayuda="Cuántos puede tomar la misma persona de una vez." valor={v.maxFranjas} onChange={x => setV({ ...v, maxFranjas: x })} opciones={[1, 2, 3, 4].map(n => ({ id: n, label: n === 1 ? 'Solo uno' : `Hasta ${n} (${duracionTxt(v.duracionMin * n)})` }))} />
          </div>
        </>
      )}
      <Guardar cambiado={cambiado} onClick={() => onGuardar(v)} />
    </Seccion>
  )
}

function Unidades({ negocio, onGuardar }: Form) {
  const [lista, setLista] = useState<Unidad[]>(negocio.unidades)
  const [extras, setExtras] = useState(negocio.extras)
  const cambiado = JSON.stringify(lista) !== JSON.stringify(negocio.unidades) || JSON.stringify(extras) !== JSON.stringify(negocio.extras)
  const editar = (id: string, c: Partial<Unidad>) => setLista(l => l.map(u => (u.id === id ? { ...u, ...c } : u)))
  return (
    <div className="rv-pila">
      <Seccion titulo="Canchas" bajada="Cada una con su precio por hora. Lo que no esté acá no se puede reservar."
        acciones={<button type="button" className="rv-btn rv-btn--sm" onClick={() => setLista([...lista, { id: idNuevo('u'), nombre: `Cancha ${lista.length + 1}`, detalle: '', tarifaHora: 40000, foto: negocio.fotoPortada }])}><Plus size={15} aria-hidden /> Agregar</button>}>
        <div className="rv-pila">
          {lista.map(u => (
            <div key={u.id} className="alc-fila">
              <Campo label="Nombre" value={u.nombre} onChange={x => editar(u.id, { nombre: x })} />
              <Campo label="Detalle" value={u.detalle} onChange={x => editar(u.id, { detalle: x })} placeholder="Fútbol 5 · techada" />
              <Campo label="Por hora" prefijo="$" value={String(u.tarifaHora)} onChange={x => editar(u.id, { tarifaHora: num(x) })} inputMode="numeric" />
              <button type="button" className="rv-btn rv-btn--icono" onClick={() => setLista(lista.filter(x => x.id !== u.id))} aria-label={`Quitar ${u.nombre}`} disabled={lista.length <= 1}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </Seccion>
      <Seccion titulo="Extras" bajada="Iluminación, pelotas, pecheras: se suman al total si el cliente los marca."
        acciones={<button type="button" className="rv-btn rv-btn--sm" onClick={() => setExtras([...extras, { id: idNuevo('e'), nombre: 'Nuevo extra', precio: 2000 }])}><Plus size={15} aria-hidden /> Agregar</button>}>
        <div className="rv-pila">
          {extras.map(e => (
            <div key={e.id} className="alc-fila alc-fila--extra">
              <Campo label="Nombre" value={e.nombre} onChange={x => setExtras(extras.map(y => (y.id === e.id ? { ...y, nombre: x } : y)))} />
              <Campo label="Precio" prefijo="$" value={String(e.precio)} onChange={x => setExtras(extras.map(y => (y.id === e.id ? { ...y, precio: num(x) } : y)))} inputMode="numeric" />
              <button type="button" className="rv-btn rv-btn--icono" onClick={() => setExtras(extras.filter(x => x.id !== e.id))} aria-label={`Quitar ${e.nombre}`}><Trash2 size={16} /></button>
            </div>
          ))}
          {extras.length === 0 && <p className="rv-ayuda" style={{ margin: 0 }}>Sin extras: el paso se saltea al reservar.</p>}
        </div>
        <Guardar cambiado={cambiado} onClick={() => onGuardar({ unidades: lista.map(u => ({ ...u, nombre: u.nombre.trim() || 'Cancha' })), extras })} />
      </Seccion>
    </div>
  )
}

function Precios({ negocio, onGuardar }: Form) {
  const [reglas, setReglas] = useState(negocio.reglasPrecio)
  const cambiado = JSON.stringify(reglas) !== JSON.stringify(negocio.reglasPrecio)
  const editar = (i: number, c: Partial<(typeof reglas)[number]>) => setReglas(reglas.map((r, k) => (k === i ? { ...r, ...c } : r)))
  const AJUSTES = [-30, -20, -15, -10, 0, 10, 15, 20, 30].map(a => ({ id: a, label: a === 0 ? 'Sin cambio' : `${a > 0 ? '+' : ''}${a}%` }))
  return (
    <Seccion titulo="Precios por horario" bajada="Un descuento en las horas que cuesta llenar y, si querés, un recargo en las de más demanda. El precio final se ve al elegir el horario."
      acciones={<button type="button" className="rv-btn rv-btn--sm" onClick={() => setReglas([...reglas, { dias: [0, 1, 2, 3, 4], desde: 9 * 60, hasta: 12 * 60, ajuste: -10 }])}><Plus size={15} aria-hidden /> Agregar franja</button>}>
      <div className="rv-pila">
        {reglas.map((r, i) => (
          <div key={i} className="rv-card rv-card--pad" style={{ background: 'var(--color-surface)' }}>
            <div className="alc-dias" role="group" aria-label="Días">
              {DIAS_CORTOS.map((d, k) => {
                // [] es "todos los días": tocar uno con todos marcados lo saca a él (antes quedaba solo ese), y el último no se
                // saca (volvería a ser [] = todos). Si se marcan los siete, se guarda [] como en los datos de ejemplo.
                const dias = r.dias.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : r.dias
                const on = dias.includes(k)
                const nuevos = on ? dias.filter(x => x !== k) : [...dias, k].sort()
                return <button key={d} type="button" className="rv-chip rv-chip--borde" aria-pressed={on} onClick={() => { if (nuevos.length) editar(i, { dias: nuevos.length === 7 ? [] : nuevos }) }}>{d}</button>
              })}
            </div>
            <div className="alc-horas" style={{ marginTop: 10 }}>
              <Selector label="Desde" valor={r.desde} onChange={x => editar(i, { desde: x, hasta: Math.max(r.hasta, x + 60) })} opciones={HORAS.slice(0, 24)} />
              <Selector label="Hasta" valor={r.hasta} onChange={x => editar(i, { hasta: x })} opciones={HORAS.filter(h => h.id > r.desde)} />
              <Selector label="Ajuste" valor={r.ajuste} onChange={x => editar(i, { ajuste: x })} opciones={AJUSTES} />
              <div className="rv-campo"><span aria-hidden>&nbsp;</span><button type="button" className="rv-btn" onClick={() => setReglas(reglas.filter((_, k) => k !== i))}><Trash2 size={15} aria-hidden /> Quitar</button></div>
            </div>
          </div>
        ))}
        {reglas.length === 0 && <p className="rv-ayuda" style={{ margin: 0 }}>Sin franjas: todas las horas valen lo mismo.</p>}
      </div>
      <Guardar cambiado={cambiado} onClick={() => onGuardar({ reglasPrecio: reglas })} />
    </Seccion>
  )
}

function SalonCfg({ negocio, onGuardar }: Form) {
  const s = negocio.salon
  const [v, setV] = useState(s ?? { capacidad: 50, duracionBloque: 240, limpieza: 60, paquetes: [] as Paquete[], extras: [], deposito: 0, fotos: [] as string[] })
  const cambiado = JSON.stringify(v) !== JSON.stringify(s)
  const paq = (id: string, c: Partial<Paquete>) => setV({ ...v, paquetes: v.paquetes.map(p => (p.id === id ? { ...p, ...c } : p)) })
  // Así quedan los bloques fijos con estos valores: lo que el cliente ve para elegir.
  const bloques = armarBloques([negocio.apertura.desde, negocio.apertura.hasta], v.duracionBloque, v.limpieza)
  const guardar = () => onGuardar({ salon: { ...v, paquetes: v.paquetes.map(p => ({ ...p, incluye: p.incluye.map(x => x.trim()).filter(Boolean) })) } })
  return (
    <div className="rv-pila">
      <Seccion titulo="El salón" bajada="Capacidad, duración de cada bloque y el tiempo de limpieza entre uno y otro.">
        <div className="rv-dos">
          <Campo label="Capacidad máxima" value={String(v.capacidad)} onChange={x => setV({ ...v, capacidad: num(x) })} inputMode="numeric" ayuda="Nadie puede reservar para más invitados que esto." />
          <Campo label="Depósito de garantía" prefijo="$" value={String(v.deposito)} onChange={x => setV({ ...v, deposito: num(x) })} inputMode="numeric" ayuda="Opcional. Solo se registra: no se cobra desde Órbita." />
        </div>
        <div className="rv-dos" style={{ marginTop: 12 }}>
          <Selector label="Cada bloque dura" valor={v.duracionBloque} onChange={x => setV({ ...v, duracionBloque: x })} opciones={[180, 240, 300, 360].map(m => ({ id: m, label: `${m / 60} horas` }))} />
          <Selector label="Limpieza entre bloques" valor={v.limpieza} onChange={x => setV({ ...v, limpieza: x })} opciones={[30, 60, 90, 120].map(m => ({ id: m, label: `${m} minutos` }))} />
        </div>
        <div style={{ marginTop: 12 }}>
          {bloques.length
            ? <Nota tono="info">Con el horario de {hhmm(negocio.apertura.desde)} a {hhmm(negocio.apertura.hasta)} quedan {bloques.length === 1 ? 'un bloque fijo' : `${bloques.length} bloques fijos`}: {bloques.map(b => `${b.nombre.toLowerCase()} de ${hhmm(b.inicio)} a ${hhmm(b.fin)}`).join(', ')}. Los {v.limpieza} minutos de limpieza del medio no se pueden reservar.</Nota>
            : <Nota tono="aviso">Con el horario de {hhmm(negocio.apertura.desde)} a {hhmm(negocio.apertura.hasta)} no entra ningún bloque de {v.duracionBloque / 60} horas: acortalos o cambiá el horario en Horarios.</Nota>}
        </div>
      </Seccion>
      <Seccion titulo="Paquetes" bajada="Por cantidad de invitados. El precio incluye mesas, sillas y vajilla."
        acciones={<button type="button" className="rv-btn rv-btn--sm" onClick={() => setV({ ...v, paquetes: [...v.paquetes, { id: idNuevo('p'), nombre: 'Nuevo paquete', hastaInvitados: Math.min(40, v.capacidad || 40), precio: 300000, incluye: ['Mesas, sillas y vajilla'] }] })}><Plus size={15} aria-hidden /> Agregar</button>}>
        <div className="rv-pila">
          {v.paquetes.map(p => (
            <div key={p.id} className="alc-paquete">
              <div className="alc-fila alc-fila--paquete">
                <Campo label="Nombre" value={p.nombre} onChange={x => paq(p.id, { nombre: x })} />
                <Campo label="Hasta" value={String(p.hastaInvitados)} onChange={x => paq(p.id, { hastaInvitados: num(x) })} inputMode="numeric" error={p.hastaInvitados > v.capacidad ? `El salón es para ${v.capacidad}` : undefined} />
                <Campo label="Precio" prefijo="$" value={String(p.precio)} onChange={x => paq(p.id, { precio: num(x) })} inputMode="numeric" />
                <button type="button" className="rv-btn rv-btn--icono" onClick={() => setV({ ...v, paquetes: v.paquetes.filter(x => x.id !== p.id) })} aria-label={`Quitar ${p.nombre}`} disabled={v.paquetes.length <= 1}><Trash2 size={16} /></button>
              </div>
              {/* Uno por renglón. Se guarda el texto tal cual mientras se escribe (si no, el renglón vacío del Enter desaparecía) y se limpia al guardar. */}
              <Area label="Qué incluye (uno por renglón)" value={p.incluye.join('\n')} onChange={x => paq(p.id, { incluye: x.split('\n') })} maxLength={400} />
            </div>
          ))}
        </div>
      </Seccion>
      <Seccion titulo="Extras" bajada="DJ, inflables, animador, mozo, torta, decoración: lo que se suma al paquete."
        acciones={<button type="button" className="rv-btn rv-btn--sm" onClick={() => setV({ ...v, extras: [...v.extras, { id: idNuevo('e'), nombre: 'Nuevo extra', precio: 20000 }] })}><Plus size={15} aria-hidden /> Agregar</button>}>
        <div className="rv-pila">
          {v.extras.map(e => (
            <div key={e.id} className="alc-fila alc-fila--extra">
              <Campo label="Nombre" value={e.nombre} onChange={x => setV({ ...v, extras: v.extras.map(y => (y.id === e.id ? { ...y, nombre: x } : y)) })} />
              <Campo label="Precio" prefijo="$" value={String(e.precio)} onChange={x => setV({ ...v, extras: v.extras.map(y => (y.id === e.id ? { ...y, precio: num(x) } : y)) })} inputMode="numeric" />
              <button type="button" className="rv-btn rv-btn--icono" onClick={() => setV({ ...v, extras: v.extras.filter(x => x.id !== e.id) })} aria-label={`Quitar ${e.nombre}`}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        <Guardar cambiado={cambiado && bloques.length > 0} onClick={guardar}>{bloques.length ? undefined : 'Con esos valores no queda ningún bloque.'}</Guardar>
      </Seccion>
    </div>
  )
}

/** Las comodidades que se ofrecen para marcar; las que el dueño ya tenga cargadas se suman. */
const COMODIDADES = ['Wi-Fi', 'Aire acondicionado', 'Calefacción', 'Pileta', 'Parrilla', 'Cocina equipada', 'Cocina', 'Estacionamiento', 'Ropa blanca', 'Ascensor', 'Lavarropas', 'TV', 'Mascotas permitidas']

function Propiedades({ negocio, onGuardar }: Form) {
  const [lista, setLista] = useState<Propiedad[]>(negocio.propiedades)
  const [abierta, setAbierta] = useState(lista[0]?.id ?? '')
  const cambiado = JSON.stringify(lista) !== JSON.stringify(negocio.propiedades)
  const p = lista.find(x => x.id === abierta)
  const editar = (c: Partial<Propiedad>) => setLista(lista.map(x => (x.id === abierta ? { ...x, ...c } : x)))
  const tarifa = (c: Partial<Propiedad['tarifa']>) => p && editar({ tarifa: { ...p.tarifa, ...c } })
  const agregar = () => {
    const id = idNuevo('c')
    setLista([...lista, { id, nombre: 'Nueva propiedad', tipo: 'Casa', descripcion: '', huespedes: 4, ambientes: 2, camas: 2, banos: 1, comodidades: ['Wi-Fi'], fotos: [negocio.fotoPortada], direccion: negocio.direccion, ciudad: negocio.ciudad, latLng: negocio.latLng, tarifa: { precioNoche: 50000, temporadas: [], finDeSemanaPct: 0, limpieza: 15000, minNoches: 1 }, checkIn: 15 * 60, checkOut: 10 * 60 }])
    setAbierta(id)
  }
  const nuevaTemporada = (nombre: string, factor: number) => p && tarifa({ temporadas: [...p.tarifa.temporadas, { id: idNuevo('t'), nombre, desde: sumarDias(HOY, 30), hasta: sumarDias(HOY, 90), precioNoche: Math.round((p.tarifa.precioNoche * factor) / 1000) * 1000 }] })
  return (
    <Seccion titulo="Propiedades" bajada="Cada una con sus datos, su precio por noche y sus temporadas, sus comodidades, su ubicación y sus fechas bloqueadas."
      acciones={<button type="button" className="rv-btn rv-btn--sm" onClick={agregar}><Plus size={15} aria-hidden /> Agregar</button>}>
      <div className="rv-seg" role="group" aria-label="Propiedad" style={{ marginBottom: 14, maxWidth: '100%', overflowX: 'auto' }}>
        {lista.map(x => <button key={x.id} type="button" aria-pressed={x.id === abierta} onClick={() => setAbierta(x.id)}>{x.nombre}</button>)}
      </div>
      {p && (
        <div className="rv-pila">
          <div className="rv-dos">
            <Campo label="Nombre" value={p.nombre} onChange={x => editar({ nombre: x })} />
            <Selector label="Tipo" valor={p.tipo} onChange={x => editar({ tipo: x })} opciones={(['Casa', 'Departamento', 'Cabaña', 'Quinta'] as const).map(t => ({ id: t, label: t }))} />
          </div>
          <Area label="Descripción" value={p.descripcion} onChange={x => editar({ descripcion: x })} maxLength={400} />
          <div className="rv-grid rv-grid--4">
            <Campo label="Huéspedes (máximo)" value={String(p.huespedes)} onChange={x => editar({ huespedes: Math.max(1, num(x)) })} inputMode="numeric" />
            <Campo label="Ambientes" value={String(p.ambientes)} onChange={x => editar({ ambientes: num(x) })} inputMode="numeric" />
            <Campo label="Camas" value={String(p.camas)} onChange={x => editar({ camas: num(x) })} inputMode="numeric" />
            <Campo label="Baños" value={String(p.banos)} onChange={x => editar({ banos: num(x) })} inputMode="numeric" />
          </div>
          <div className="rv-grid rv-grid--4">
            <Campo label="Precio por noche" prefijo="$" value={String(p.tarifa.precioNoche)} onChange={x => tarifa({ precioNoche: num(x) })} inputMode="numeric" />
            <Campo label="Limpieza" prefijo="$" value={String(p.tarifa.limpieza)} onChange={x => tarifa({ limpieza: num(x) })} inputMode="numeric" ayuda="Fija, una vez por estadía." />
            <Selector label="Mínimo de noches" valor={p.tarifa.minNoches} onChange={x => tarifa({ minNoches: x })} opciones={[1, 2, 3, 5, 7].map(n => ({ id: n, label: `${n}` }))} />
            <Selector label="Fin de semana" ayuda="Recargo de las noches del viernes y del sábado." valor={p.tarifa.finDeSemanaPct} onChange={x => tarifa({ finDeSemanaPct: x })} opciones={[0, 10, 15, 20, 30].map(n => ({ id: n, label: n ? `+${n}%` : 'Sin recargo' }))} />
          </div>
          <div className="rv-dos">
            <Selector label="Entrada desde" valor={p.checkIn} onChange={x => editar({ checkIn: x })} opciones={HORAS.slice(10, 22)} />
            <Selector label="Salida hasta" valor={p.checkOut} onChange={x => editar({ checkOut: x })} opciones={HORAS.slice(7, 14)} />
          </div>
          <div>
            <div className="rv-entre" style={{ marginBottom: 8 }}>
              <span className="rv-rotulo">Temporadas</span>
              <span className="rv-fila" style={{ gap: 6 }}>
                <button type="button" className="rv-btn rv-btn--sm" onClick={() => nuevaTemporada('Temporada alta', 1.4)}><Plus size={14} aria-hidden /> Alta</button>
                <button type="button" className="rv-btn rv-btn--sm" onClick={() => nuevaTemporada('Temporada baja', 0.8)}><Plus size={14} aria-hidden /> Baja</button>
              </span>
            </div>
            <div className="rv-pila">
              {p.tarifa.temporadas.map(t => (
                <div key={t.id} className="alc-fila alc-fila--temporada">
                  <Campo label="Nombre" value={t.nombre} onChange={x => tarifa({ temporadas: p.tarifa.temporadas.map(y => (y.id === t.id ? { ...y, nombre: x } : y)) })} />
                  <Campo label="Desde" type="date" value={t.desde} onChange={x => x && tarifa({ temporadas: p.tarifa.temporadas.map(y => (y.id === t.id ? { ...y, desde: x } : y)) })} />
                  <Campo label="Hasta" type="date" value={t.hasta} onChange={x => x && tarifa({ temporadas: p.tarifa.temporadas.map(y => (y.id === t.id ? { ...y, hasta: x } : y)) })} />
                  <Campo label="Por noche" prefijo="$" value={String(t.precioNoche)} onChange={x => tarifa({ temporadas: p.tarifa.temporadas.map(y => (y.id === t.id ? { ...y, precioNoche: num(x) } : y)) })} inputMode="numeric" />
                  <button type="button" className="rv-btn rv-btn--icono" onClick={() => tarifa({ temporadas: p.tarifa.temporadas.filter(y => y.id !== t.id) })} aria-label={`Quitar ${t.nombre}`}><Trash2 size={16} /></button>
                </div>
              ))}
              {p.tarifa.temporadas.length === 0 && <p className="rv-ayuda" style={{ margin: 0 }}>Sin temporadas: todas las noches valen lo mismo.</p>}
              {p.tarifa.temporadas.length > 1 && <p className="rv-ayuda" style={{ margin: 0 }}>Si dos temporadas se pisan, vale la más corta (por ejemplo, Carnaval adentro de la alta).</p>}
            </div>
          </div>
          <div>
            <span className="rv-rotulo">Comodidades</span>
            <div className="alc-dias" role="group" aria-label="Comodidades" style={{ marginTop: 8 }}>
              {[...new Set([...COMODIDADES, ...p.comodidades])].map(c => {
                const on = p.comodidades.includes(c)
                return <button key={c} type="button" className="rv-chip rv-chip--borde" aria-pressed={on} onClick={() => editar({ comodidades: on ? p.comodidades.filter(x => x !== c) : [...p.comodidades, c] })}>{c}</button>
              })}
            </div>
          </div>
          <div>
            <span className="rv-rotulo">Fotos</span>
            <div className="alc-fotos" style={{ marginTop: 8 }}>
              {p.fotos.map((f, i) => <img key={`${i}-${f}`} src={f} alt={`Foto ${i + 1} de ${p.nombre}`} loading="lazy" />)}
            </div>
            <p className="rv-ayuda" style={{ margin: '6px 0 0' }}>En la demo son fotos de ejemplo. La primera es la de la tarjeta en tu sitio.</p>
          </div>
          <div>
            <div className="rv-dos">
              <Campo label="Dirección" value={p.direccion} onChange={x => editar({ direccion: x })} />
              <Campo label="Ciudad" value={p.ciudad} onChange={x => editar({ ciudad: x })} />
            </div>
            <div style={{ marginTop: 10 }}><Mapa latLng={p.latLng} titulo={p.nombre} /></div>
            <p className="rv-ayuda" style={{ margin: '6px 0 0' }}>Así se ve la ubicación en tu sitio. En la demo el punto del mapa no se mueve al cambiar la dirección.</p>
          </div>
          <div>
            <span className="rv-rotulo">Fechas bloqueadas</span>
            <div className="rv-lista" style={{ marginTop: 6 }}>
              {negocio.bloqueos.filter(b => b.unidadId === p.id).map(b => <div key={b.id} className="rv-item"><span className="rv-item-cuerpo"><span className="rv-item-titulo">{rangoTxt(b.desde, b.hasta)}</span><span className="rv-item-sub">{b.motivo} · {b.origen === 'ical' ? 'calendario externo' : 'lo pusiste vos'}</span></span></div>)}
              {negocio.bloqueos.filter(b => b.unidadId === p.id).length === 0 && <p className="rv-ayuda" style={{ margin: '4px 0' }}>Ninguna. Se bloquean desde el calendario.</p>}
            </div>
          </div>
          {lista.length > 1 && <button type="button" className="rv-btn rv-btn--peligro" style={{ alignSelf: 'flex-start' }} onClick={() => { const resto = lista.filter(x => x.id !== p.id); setLista(resto); setAbierta(resto[0].id) }}><Trash2 size={15} aria-hidden /> Quitar esta propiedad</button>}
        </div>
      )}
      <Guardar cambiado={cambiado} onClick={() => onGuardar({ propiedades: lista.map(x => ({ ...x, nombre: x.nombre.trim() || 'Propiedad' })) })} />
    </Seccion>
  )
}

// ─── Calendarios externos (.ics) ─────────────────────────────────────────────
// No hay sincronización con Airbnb, Booking ni Google: eso necesita las APIs
// de cada uno y un backend. Lo que sí: exportar el calendario de cada unidad
// como .ics (real, se genera acá) e importar la URL .ics de un calendario
// externo (simulado: no hace ningún fetch, usa un calendario de ejemplo). Lo
// importado bloquea de verdad: en los tres modos, ese día no se puede reservar.

const ICS_EJEMPLO = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ejemplo//Calendario externo//ES',
  `BEGIN:VEVENT\r\nUID:ext-1@ejemplo\r\nDTSTART;VALUE=DATE:${sumarDias(HOY, 9).replace(/-/g, '')}\r\nDTEND;VALUE=DATE:${sumarDias(HOY, 12).replace(/-/g, '')}\r\nSUMMARY:Reservado\r\nEND:VEVENT`,
  `BEGIN:VEVENT\r\nUID:ext-2@ejemplo\r\nDTSTART;VALUE=DATE:${sumarDias(HOY, 20).replace(/-/g, '')}\r\nDTEND;VALUE=DATE:${sumarDias(HOY, 22).replace(/-/g, '')}\r\nSUMMARY:No disponible\r\nEND:VEVENT`,
  'END:VCALENDAR',
].join('\r\n')

/** "Cabaña Arrayán" → "cabana-arrayan.ics": sin tildes ni espacios, que algunos sistemas no aceptan. */
const nombreArchivo = (s: string) => `${s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'calendario'}.ics`

function Calendarios({ negocio, reservas, onCalendario, onQuitarCalendario }: Omit<P, 'onGuardar'>) {
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
    <div className="rv-pila">
      <Nota tono="info">Sin sincronización en vivo con Airbnb, Booking ni Google: eso necesita las APIs de cada uno y un servidor. Se resuelve con iCal (.ics), el formato que esos servicios ya usan.</Nota>
      <Seccion titulo="Exportar" bajada={`Descargá el calendario de cada ${TIPOS[negocio.tipo].unidad} con sus reservas y cargalo en Google Calendar, Airbnb o Booking.`}>
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
  )
}
