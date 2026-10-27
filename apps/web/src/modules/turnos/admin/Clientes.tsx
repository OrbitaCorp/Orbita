// Clientes (o pacientes) con su historial de turnos: una lista con buscador y
// filtros rápidos, como la de Tienda, y la ficha de cada uno en un modal.
//
// La lista vive en PanelTurnos: quien se agrega acá aparece al dar un turno.
// El historial de la ficha sale de la misma agenda (los turnos pasados de esa
// persona), no de una lista aparte: lo que se ve acá es lo que se ve en Agenda.
// Desde la ficha se le agenda un turno (el mismo "Nuevo turno" de la agenda) o
// se le escribe por WhatsApp (simulado: la demo no le manda nada a nadie).
//
// Lo que se ve depende del rol de quien mira: sin permiso para ver contactos el
// teléfono va tapado y no hay WhatsApp; sin permiso para ver los números del
// negocio, tampoco cuánto gastó cada uno.
import { useState } from 'react'
import { Phone, MessageCircle, ShieldCheck, ChevronRight, CalendarPlus, CalendarClock, UserPlus, Check, Lock } from 'lucide-react'
import { Avatar } from '@/design-system/components/Avatar'
import { Encabezado, Vacio } from '@/design-system/reservas/piezas'
import { horaTxt, pesos, esSalud, type Cliente, type RubroTurnos } from '@/modules/turnos/datos'
import { ChipEstado } from '@/modules/turnos/_shared/components/ChipEstado'
import { Campo, Segmentado } from './configuracion/ui'
import { Modal, ErrorCampo, Buscador } from './piezasPanel'
import { cuandoTxt, fechaCorta, sinAcentos, tieneTelefono, type TurnoAgenda } from '../datos/agenda'
import { taparTelefono } from '../datos/equipo'

export const pluralCliente = (r: RubroTurnos) => esSalud(r) ? 'Pacientes' : 'Clientes'

/** Cuántos turnos pasados se ven en la ficha antes de "Ver todos". */
const A_LA_VISTA = 5

type Filtro = 'todos' | 'frecuentes' | 'nuevos'
const nivel = (c: Cliente) => c.visitas >= 10 ? { txt: 'Frecuente', clase: 'rv-chip--primario' } : c.visitas <= 2 ? { txt: 'Nuevo', clase: 'rv-chip--ok' } : null

const CSS = `
  .tu-cli-filtros { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .tu-cli-filtros > .tu-buscar { flex: 1 1 240px; }
  .tu-cli-head, .tu-cli-fila { grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr) 80px 80px 120px 18px; gap: 14px; }
  .tu-cli-head { display: grid; }
  .tu-cli-fila { display: grid; align-items: center; }
  .tu-cli-quien { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .tu-cli-quien > span { min-width: 0; }
  .tu-cli-quien b { font-size: 14px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-cli-quien small { display: block; font-size: 12px; color: var(--color-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
  .tu-cli-nombre { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .tu-cli-dato { font-size: 13px; color: var(--color-body); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-cli-flecha { color: var(--color-subtle); }
  .tu-cli-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 16px; }
  .tu-cli-tile { padding: 11px 12px; border-radius: var(--rv-r-sm); background: var(--color-surface); border: 1px solid var(--color-border); min-width: 0; }
  .tu-cli-tile > small { display: block; font-size: 11px; color: var(--color-muted); margin-bottom: 3px; }
  .tu-cli-tile > b { display: block; font-size: 14.5px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-cli-nota { margin: 0 0 18px; padding-left: 12px; border-left: 2px solid var(--color-border-strong); font-size: 13px; line-height: 1.5; color: var(--color-body); }
  .tu-cli-prox { display: flex; align-items: center; gap: 12px; width: 100%; padding: 11px 14px; margin-bottom: 20px; }
  .tu-cli-prox-ico { width: 36px; height: 36px; border-radius: 8px; flex: 0 0 36px; display: grid; place-items: center; color: var(--color-primary); background: var(--color-primary-bg); }
  .tu-cli-prox > span:not(.tu-cli-prox-ico) { flex: 1; min-width: 0; }
  .tu-cli-prox b { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); }
  .tu-cli-prox small { display: block; font-size: 12.5px; color: var(--color-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-cli-hist { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 0; border: none; border-top: 1px solid var(--color-border); border-radius: 0; background: none; font: inherit; font-size: 13px; color: inherit; text-align: left; cursor: pointer; }
  .tu-cli-hist:first-of-type { border-top: none; }
  .tu-cli-hist:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; border-radius: 6px; }
  .tu-cli-hist-cuando { width: 44px; flex-shrink: 0; color: var(--color-muted); }
  .tu-cli-hist-que { flex: 1; min-width: 0; color: var(--color-text); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-cli-hist-que > small { display: block; font-size: 12px; font-weight: 400; color: var(--color-muted); }
  .tu-cli-hist-precio { flex-shrink: 0; color: var(--color-muted); }
  @media (max-width: 480px) { .tu-cli-hist-precio { display: none; } }
  @media (max-width: 900px) {
    .tu-cli-head { display: none; }
    .tu-cli-fila { grid-template-columns: minmax(0, 1fr) auto 18px; row-gap: 4px; }
    .tu-cli-tel, .tu-cli-ult { display: none; }
    .tu-cli-vis { grid-column: 1; grid-row: 2; padding-left: 52px; }
    .tu-cli-extra { grid-column: 2; grid-row: 1; justify-self: end; }
    .tu-cli-flecha { grid-column: 3; grid-row: 1; }
  }
  @media (max-width: 768px) {
    .tu-cli-filtros > .rv-seg { width: 100%; display: flex; }
    .tu-cli-filtros > .rv-seg > button { flex: 1; }
  }
  @media (max-width: 480px) { .tu-cli-tiles { grid-template-columns: minmax(0, 1fr); } }
`

interface Props {
  rubro: RubroTurnos
  clientes: Cliente[]
  /** Ficha abierta. Vive en PanelTurnos para que el buscador del header también la abra. */
  selId: string | null
  onSel: (id: string | null) => void
  /** Próximo turno de alguien (de acá en adelante), si tiene. */
  proximo: (clienteId: string) => TurnoAgenda | null
  /** Los turnos pasados de alguien (atendidos o ausentes), del más reciente al más viejo. */
  historial: (clienteId: string) => TurnoAgenda[]
  onAbrirTurno: (t: TurnoAgenda) => void
  onAgregar: (c: Cliente) => void
  onAgendar: (c: Cliente) => void
  onWhatsApp: (c: Cliente) => void
  /** Quien mira puede ver los teléfonos y escribirles. */
  verContacto: boolean
  /** Puede ver cuánto gastó cada uno. */
  verNumeros: boolean
  /** Puede dar turnos y sumar gente a la lista. */
  puedeAgendar: boolean
  /** Ve solo a quienes atendió (y no a todo el negocio). */
  soloLosSuyos: boolean
}

export default function Clientes({ rubro, clientes, selId, onSel, proximo, historial, onAbrirTurno, onAgregar, onAgendar, onWhatsApp, verContacto, verNumeros, puedeAgendar, soloLosSuyos }: Props) {
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  // null: formulario cerrado; si no, el nombre con el que arranca.
  const [agregando, setAgregando] = useState<string | null>(null)
  const salud = esSalud(rubro)
  const titulo = pluralCliente(rubro)
  const sel = clientes.find(c => c.id === selId) ?? null
  // Se busca por nombre (sin importar acentos) o por un pedazo del teléfono.
  const texto = sinAcentos(q.trim())
  const digitos = q.replace(/\D/g, '')
  const lista = clientes
    .filter(c => !texto || sinAcentos(c.nombre).includes(texto) || (verContacto && digitos.length >= 3 && c.telefono.replace(/\D/g, '').includes(digitos)))
    .filter(c => filtro === 'todos' || (filtro === 'frecuentes' ? c.visitas >= 10 : c.visitas <= 2))
  const telefonoDe = (c: Cliente) => (verContacto ? c.telefono : taparTelefono(c.telefono))
  const extraCab = salud ? 'Cobertura' : verNumeros ? 'Gastado' : ''

  const agregar = (c: Cliente) => {
    onAgregar(c)
    setAgregando(null)
    // Se abre su ficha: desde ahí se le da el primer turno.
    onSel(c.id)
  }

  return (
    <div className="rv-pagina">
      <style>{CSS}</style>

      <Encabezado
        rotulo={`${clientes.length} ${clientes.length === 1 ? titulo.slice(0, -1).toLowerCase() : titulo.toLowerCase()}${soloLosSuyos ? ' · a quienes atendés' : ''}`}
        titulo={soloLosSuyos ? `Mis ${titulo.toLowerCase()}` : titulo}
        bajada="Quién viene, cada cuánto y cuándo fue la última vez. Tocá a cualquiera para ver su historial."
        acciones={puedeAgendar ? <button type="button" onClick={() => setAgregando('')} className="rv-btn rv-btn--primario"><UserPlus size={16} /> Agregar</button> : undefined}
      />

      <div className="tu-cli-filtros">
        <Buscador value={q} onChange={setQ} placeholder={verContacto ? 'Buscar por nombre o teléfono' : 'Buscar por nombre'} label={`Buscar ${titulo.toLowerCase()}`} />
        <Segmentado label="Filtrar" valor={filtro} onChange={setFiltro} opciones={[{ id: 'todos', label: 'Todos' }, { id: 'frecuentes', label: 'Frecuentes' }, { id: 'nuevos', label: 'Nuevos' }]} />
      </div>

      {lista.length === 0 ? (
        <Vacio
          titulo={q.trim() ? `Nadie coincide con “${q.trim()}”` : 'No hay nadie con ese filtro'}
          texto="Probá con otro nombre o sacá el filtro."
          accion={<div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => { setQ(''); setFiltro('todos') }} className="rv-btn">Ver todos</button>
            {puedeAgendar && q.trim() && !digitos && <button type="button" onClick={() => setAgregando(q.trim())} className="rv-btn rv-btn--primario"><UserPlus size={16} /> Agregar “{q.trim()}”</button>}
          </div>}
        />
      ) : (
        <div className="rv-card" style={{ overflow: 'hidden' }}>
          <div className="tu-fila-cab tu-cli-head" aria-hidden>
            <span>Nombre</span><span>Teléfono</span><span>Visitas</span><span>Última</span><span>{extraCab}</span><span />
          </div>
          <div className="tu-filas">
            {lista.map(c => {
              const n = nivel(c)
              return (
                <button key={c.id} type="button" onClick={() => onSel(c.id)} className="ds-hover tu-fila tu-cli-fila" aria-label={`${c.nombre}, ${c.visitas} visitas`}>
                  <span className="tu-cli-quien">
                    <Avatar name={c.nombre} size={40} />
                    <span>
                      <span className="tu-cli-nombre"><b>{c.nombre}</b>{n && <span className={`rv-chip ${n.clase}`} style={{ height: 20, padding: '0 7px', fontSize: 10.5 }}>{n.txt}</span>}</span>
                      {c.nota && <small>{c.nota}</small>}
                    </span>
                  </span>
                  <span className="tu-cli-tel tu-cli-dato rv-num">{telefonoDe(c)}</span>
                  <span className="tu-cli-vis tu-cli-dato"><b className="rv-num" style={{ color: 'var(--color-text)' }}>{c.visitas}</b> visita{c.visitas === 1 ? '' : 's'}</span>
                  <span className="tu-cli-ult tu-cli-dato rv-num">{c.ultima}</span>
                  <span className={`tu-cli-extra tu-cli-dato${salud ? '' : ' rv-num'}`} style={{ fontWeight: 500, color: 'var(--color-text)' }}>{salud ? c.obraSocial : !verNumeros ? '' : c.gastado ? pesos(c.gastado) : '—'}</span>
                  <ChevronRight size={16} className="tu-cli-flecha" aria-hidden />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {sel && (
        <FichaCliente
          key={sel.id}
          cliente={sel}
          rubro={rubro}
          proximo={proximo(sel.id)}
          historial={historial(sel.id)}
          verContacto={verContacto} verNumeros={verNumeros} puedeAgendar={puedeAgendar}
          onCerrar={() => onSel(null)}
          onAbrirTurno={onAbrirTurno}
          onAgendar={() => onAgendar(sel)}
          onWhatsApp={() => onWhatsApp(sel)}
        />
      )}

      {agregando !== null && (
        <FormCliente inicial={agregando} rubro={rubro} clientes={clientes} onCerrar={() => setAgregando(null)} onAgregar={agregar} />
      )}
    </div>
  )
}

/** Ficha de una persona: números, próximo turno, historial y acciones. */
function FichaCliente({ cliente: c, rubro, proximo, historial, verContacto, verNumeros, puedeAgendar, onCerrar, onAbrirTurno, onAgendar, onWhatsApp }: {
  cliente: Cliente; rubro: RubroTurnos; proximo: TurnoAgenda | null; historial: TurnoAgenda[]
  verContacto: boolean; verNumeros: boolean; puedeAgendar: boolean
  onCerrar: () => void; onAbrirTurno: (t: TurnoAgenda) => void; onAgendar: () => void; onWhatsApp: () => void
}) {
  const salud = esSalud(rubro)
  const pila = c.nombre.split(' ')[0]
  const [todos, setTodos] = useState(false)
  const visibles = todos ? historial : historial.slice(0, A_LA_VISTA)
  // Las ausencias que la agenda recuerda, más la que figura en la nota de la ficha.
  const ausencias = historial.filter(t => t.estado === 'ausente').length + (c.nota?.includes('Faltó') ? 1 : 0)

  return (
    <Modal
      ancho={560}
      rotulo={rubro.cliente}
      titulo={c.nombre}
      bajada={<span className="rv-num" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{verContacto ? <><Phone size={12} />{c.telefono}</> : <><Lock size={12} />{taparTelefono(c.telefono)}</>}</span>}
      icono={<Avatar name={c.nombre} size={44} />}
      onCerrar={onCerrar}
      pie={<>
        {verContacto && <button type="button" onClick={onWhatsApp} className="rv-btn" aria-label={`Escribirle a ${pila} por WhatsApp`}><MessageCircle size={16} /> WhatsApp</button>}
        {puedeAgendar
          ? <button type="button" onClick={onAgendar} className="rv-btn rv-btn--primario"><CalendarPlus size={16} /> Agendar turno</button>
          : <button type="button" onClick={onCerrar} className="rv-btn rv-btn--primario">Listo</button>}
      </>}
    >
      <div className="tu-cli-tiles">
        {[['Visitas', String(c.visitas)], ['Ausencias', String(ausencias)], salud ? ['Cobertura', c.obraSocial ?? '—'] : verNumeros ? ['Gastado', c.gastado ? pesos(c.gastado) : '—'] : ['Última visita', c.ultima]].map(([k, v]) => (
          <div key={k} className="tu-cli-tile"><small>{k}</small><b className="rv-num">{v}</b></div>
        ))}
      </div>
      {c.nota && <p className="tu-cli-nota">{c.nota}</p>}

      <div className="rv-rotulo" style={{ marginBottom: 8 }}>Próximo turno</div>
      {proximo ? (
        <button type="button" onClick={() => onAbrirTurno(proximo)} className="rv-card rv-card--accion tu-cli-prox" aria-label={`Ver el turno de ${cuandoTxt(proximo.dia ?? 0).toLowerCase()} a las ${horaTxt(proximo.inicio)}`}>
          <span className="tu-cli-prox-ico" aria-hidden><CalendarClock size={17} /></span>
          <span><b>{cuandoTxt(proximo.dia ?? 0)} · <span className="rv-num">{horaTxt(proximo.inicio)}</span></b><small>{proximo.servicio}</small></span>
          <ChevronRight size={16} color="var(--color-subtle)" aria-hidden />
        </button>
      ) : (
        <p className="rv-ayuda" style={{ margin: '0 0 20px', fontSize: 13 }}>No tiene turnos agendados.</p>
      )}

      <div className="rv-entre" style={{ marginBottom: 6 }}>
        <span className="rv-rotulo">Historial</span>
        {historial.length > 0 && <span className="rv-rotulo">{historial.length} turno{historial.length === 1 ? '' : 's'} en dos meses</span>}
      </div>
      {historial.length === 0 && <p className="rv-ayuda" style={{ margin: '4px 0 0', fontSize: 13 }}>{c.visitas > 0 ? 'En los últimos dos meses no tuvo turnos.' : 'Todavía no vino: el historial arranca con su primer turno.'}</p>}
      {/* Cada turno pasado se abre como cualquier otro de la agenda. */}
      {visibles.map(t => (
        <button key={t.id} type="button" className="ds-hover tu-cli-hist" onClick={() => onAbrirTurno(t)} aria-label={`Ver el turno del ${fechaCorta(t.dia ?? 0)}, ${t.servicio}`}>
          <span className="tu-cli-hist-cuando rv-num">{fechaCorta(t.dia ?? 0)}</span>
          <span className="tu-cli-hist-que">{t.servicio}<small className="rv-num">{horaTxt(t.inicio)}</small></span>
          {verNumeros && <span className="tu-cli-hist-precio rv-num">{pesos(t.precio)}</span>}
          <ChipEstado estado={t.estado} size="sm" />
        </button>
      ))}
      {historial.length > A_LA_VISTA && (
        <button type="button" onClick={() => setTodos(v => !v)} aria-expanded={todos} className="rv-btn rv-btn--sm rv-btn--fantasma" style={{ marginTop: 6, color: 'var(--chip-primary-fg)' }}>
          {todos ? 'Ver menos' : `Ver los ${historial.length} turnos`}
        </button>
      )}
      {salud && <p className="rv-ayuda" style={{ display: 'flex', gap: 7, margin: '16px 0 0' }}><ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} /> Datos de salud: solo visibles para el equipo del consultorio.</p>}
    </Modal>
  )
}

/** Alta de un cliente. `inicial` es el nombre con el que arranca (lo que se buscó). */
function FormCliente({ inicial, rubro, clientes, onCerrar, onAgregar }: {
  inicial: string; rubro: RubroTurnos; clientes: Cliente[]; onCerrar: () => void; onAgregar: (c: Cliente) => void
}) {
  const [nombre, setNombre] = useState(inicial)
  const [telefono, setTelefono] = useState('')
  const [cobertura, setCobertura] = useState('Particular')
  const [nota, setNota] = useState('')
  const [error, setError] = useState<{ campo: 'nombre' | 'telefono'; texto: string } | null>(null)
  const salud = esSalud(rubro)

  const guardar = () => {
    const limpio = nombre.trim().replace(/\s+/g, ' ')
    if (!limpio) { setError({ campo: 'nombre', texto: 'Escribí el nombre y el apellido.' }); return }
    const repetido = clientes.find(c => sinAcentos(c.nombre) === sinAcentos(limpio))
    if (repetido) { setError({ campo: 'nombre', texto: `Ya tenés a ${repetido.nombre} en tu lista.` }); return }
    if (telefono.trim() && !tieneTelefono(telefono)) { setError({ campo: 'telefono', texto: 'Revisá el teléfono: tiene que tener al menos 8 números.' }); return }
    onAgregar({
      id: `c${Date.now()}`, nombre: limpio, telefono: telefono.trim() || 'Sin teléfono', visitas: 0, ultima: '—', gastado: 0,
      ...(nota.trim() ? { nota: nota.trim() } : {}),
      ...(salud ? { obraSocial: cobertura.trim() || 'Particular' } : {}),
    })
  }

  return (
    <Modal
      rotulo={pluralCliente(rubro)}
      titulo={`Agregar ${rubro.cliente.toLowerCase()}`}
      bajada="Queda en tu lista y ya le podés dar un turno."
      onCerrar={onCerrar}
      onEnviar={guardar}
      pie={<>
        <button type="button" onClick={onCerrar} className="rv-btn">Cancelar</button>
        <button type="submit" className="rv-btn rv-btn--primario"><Check size={16} /> Agregar</button>
      </>}
    >
      <Campo label="Nombre y apellido" value={nombre} onChange={v => { setNombre(v); setError(null) }} placeholder="Ej.: Paula Herrera" maxLength={60} />
      {error?.campo === 'nombre' && <ErrorCampo>{error.texto}</ErrorCampo>}
      <Campo label="Teléfono" ayuda="Opcional. Ahí le llegan la confirmación y el recordatorio de cada turno." value={telefono} onChange={v => { setTelefono(v); setError(null) }} placeholder="11 5555-0000" type="tel" mono />
      {error?.campo === 'telefono' && <ErrorCampo>{error.texto}</ErrorCampo>}
      {salud && <Campo label="Cobertura" ayuda="Obra social o prepaga, con el plan. Si no tiene, Particular." value={cobertura} onChange={setCobertura} maxLength={40} />}
      <Campo label="Nota" ayuda="Opcional. Solo la ve tu equipo." value={nota} onChange={setNota} area maxLength={140} placeholder="Ej.: prefiere turnos a la tarde" />
    </Modal>
  )
}
