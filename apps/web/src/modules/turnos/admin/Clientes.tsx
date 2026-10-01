// Clientes (o pacientes, o alumnos) con su historial de turnos.
// Lista con buscador y filtros rápidos + la ficha de cada uno en un modal. La
// frecuencia de cada cliente se ve como una órbita: más visitas, más cerca del
// negocio.
//
// La lista vive en PanelTurnos: quien se agrega acá aparece al dar un turno.
// Desde la ficha se le agenda un turno (el mismo "Nuevo turno" de la agenda) o
// se le escribe por WhatsApp (simulado: la demo no le manda nada a nadie).
//
// Lo que se ve depende del rol de quien mira: sin permiso para ver contactos el
// teléfono va tapado y no hay WhatsApp; sin permiso para ver los números del
// negocio, tampoco cuánto gastó cada uno.
import { useState } from 'react'
import { Search, Phone, MessageCircle, ShieldCheck, ChevronRight, CalendarPlus, CalendarClock, Star, UserPlus, Users, Check, Lock } from 'lucide-react'
import { Avatar } from '@/design-system/components/Avatar'
import { horaTxt, pesos, esSalud, type Cliente, type RubroTurnos, type EstadoTurno } from '@/modules/turnos/datos'
import { ChipEstado } from '@/modules/turnos/_shared/components/ChipEstado'
import { Anillo } from '@/modules/turnos/_shared/orbita/OrbitaDia'
import { Cabecera } from '@/modules/turnos/_shared/orbita/piezas'
import { Campo } from './configuracion/ui'
import { Modal, ErrorCampo } from './piezasPanel'
import { cuandoTxt, sinAcentos, tieneTelefono, type ServicioPanel, type TurnoAgenda } from './agendaDemo'
import { taparTelefono } from './equipoDemo'

export const pluralCliente = (r: RubroTurnos) => esSalud(r) ? 'Pacientes' : r.modo === 'cupo' ? 'Alumnos' : 'Clientes'

const HISTORIAL: { fecha: string; estado: EstadoTurno }[] = [
  { fecha: '19/09', estado: 'completado' }, { fecha: '05/09', estado: 'completado' },
  { fecha: '22/08', estado: 'ausente' }, { fecha: '08/08', estado: 'completado' },
]

type Filtro = 'todos' | 'frecuentes' | 'nuevos'
const nivel = (c: Cliente) => c.visitas >= 10 ? { txt: 'Frecuente', clase: 'tuo-chip--primario', Icon: Star } : c.visitas <= 2 ? { txt: 'Nuevo', clase: 'tuo-chip--ok', Icon: UserPlus } : null

interface Props {
  rubro: RubroTurnos
  clientes: Cliente[]
  servicios: ServicioPanel[]
  /** Ficha abierta. Vive en PanelTurnos para que el buscador del header también la abra. */
  selId: string | null
  onSel: (id: string | null) => void
  /** Próximo turno de alguien (de acá en adelante), si tiene. */
  proximo: (clienteId: string) => TurnoAgenda | null
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

export default function Clientes({ rubro, clientes, servicios, selId, onSel, proximo, onAbrirTurno, onAgregar, onAgendar, onWhatsApp, verContacto, verNumeros, puedeAgendar, soloLosSuyos }: Props) {
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  // null: formulario cerrado; si no, el nombre con el que arranca.
  const [agregando, setAgregando] = useState<string | null>(null)
  const salud = esSalud(rubro)
  const titulo = pluralCliente(rubro)
  const sel = clientes.find(c => c.id === selId) ?? null
  const maxVisitas = Math.max(...clientes.map(c => c.visitas), 1)
  // Se busca por nombre (sin importar acentos) o por un pedazo del teléfono.
  const texto = sinAcentos(q.trim())
  const digitos = q.replace(/\D/g, '')
  const lista = clientes
    .filter(c => !texto || sinAcentos(c.nombre).includes(texto) || (verContacto && digitos.length >= 3 && c.telefono.replace(/\D/g, '').includes(digitos)))
    .filter(c => filtro === 'todos' || (filtro === 'frecuentes' ? c.visitas >= 10 : c.visitas <= 2))
  const telefonoDe = (c: Cliente) => (verContacto ? c.telefono : taparTelefono(c.telefono))
  // El historial de ejemplo usa los servicios que hay hoy (si se borraron todos, los del rubro).
  const nombresServicio = (servicios.length ? servicios : rubro.servicios).map(s => s.nombre)

  const agregar = (c: Cliente) => {
    onAgregar(c)
    setAgregando(null)
    // Se abre su ficha: desde ahí se le da el primer turno.
    onSel(c.id)
  }

  return (
    <div className="panel-page">
      <style>{`
        .tu-cli-fila { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr) 150px 96px 120px 18px; gap: 14px; align-items: center; width: 100%; min-height: 70px; padding: 10px 20px; border: none; border-bottom: 1px solid var(--color-border); background: transparent; text-align: left; font-family: inherit; color: inherit; }
        .tu-cli-fila:last-child { border-bottom: none; }
        .tu-cli-head { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr) 150px 96px 120px 18px; gap: 14px; padding: 12px 20px; border-bottom: 1px solid var(--color-border); background: var(--color-surface); border-radius: 16px 16px 0 0; }
        .tu-cli-flecha { color: var(--color-subtle); transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1), color 160ms ease; }
        .tu-cli-avatar { transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1); }
        .tu-cli-barra { transition: width 700ms cubic-bezier(0.22, 1, 0.36, 1); }
        @media (hover: hover) {
          .tu-cli-fila:hover .tu-cli-flecha { transform: translateX(3px); color: var(--color-primary); }
          .tu-cli-fila:hover .tu-cli-avatar { transform: scale(1.08); }
        }
        .tu-cli-barra-sup { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        @media (max-width: 900px) {
          .tu-cli-head { display: none; }
          .tu-cli-fila { grid-template-columns: minmax(0, 1fr) auto 18px; row-gap: 4px; padding: 12px 14px; }
          .tu-cli-tel, .tu-cli-ult { display: none !important; }
          .tu-cli-vis { grid-column: 1; grid-row: 2; padding-left: 52px; }
          .tu-cli-extra { grid-column: 2; grid-row: 1; justify-self: end; }
          .tu-cli-flecha { grid-column: 3; grid-row: 1; }
        }
        @media (max-width: 768px) {
          .tu-cli-barra-sup .tuo-buscar { max-width: none; }
          .tu-cli-barra-sup .tuo-buscar > input { height: 44px; font-size: 16px; }
          .tu-cli-barra-sup .tuo-seg > button { height: 44px; }
        }
        @media (prefers-reduced-motion: reduce) { .tu-cli-flecha, .tu-cli-avatar, .tu-cli-barra { transition: none; } }
      `}</style>

      <Cabecera
        rotulo={soloLosSuyos ? 'A quienes atendés' : 'Tu comunidad'}
        titulo={soloLosSuyos ? `Mis ${titulo.toLowerCase()}` : titulo}
        contador={clientes.length}
        bajada="Quién viene, cada cuánto y cuándo fue la última vez. Tocá a cualquiera para ver su historial."
        acciones={puedeAgendar ? <button type="button" onClick={() => setAgregando('')} className="tuo-btn tuo-btn--primario"><UserPlus size={16} /> Agregar</button> : undefined}
      />

      <div className="tu-cli-barra-sup tuo-entra" style={{ ['--i' as string]: 1 }}>
        <label className="tuo-buscar">
          <Search size={15} />
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={verContacto ? 'Buscar por nombre o teléfono' : 'Buscar por nombre'} aria-label={`Buscar ${titulo.toLowerCase()}`} />
        </label>
        <div className="tuo-seg" role="group" aria-label="Filtrar">
          {([['todos', 'Todos'], ['frecuentes', 'Frecuentes'], ['nuevos', 'Nuevos']] as const).map(([id, l]) => <button key={id} type="button" aria-pressed={filtro === id} onClick={() => setFiltro(id)}>{l}</button>)}
        </div>
      </div>

      <div className="tuo-card tuo-entra" style={{ ['--i' as string]: 2 }}>
        <div className="tu-cli-head tuo-rotulo">
          <span>Nombre</span><span>Teléfono</span><span>Visitas</span><span>Última</span><span>{salud ? 'Cobertura' : verNumeros ? 'Gastado' : ''}</span><span />
        </div>
        {lista.length === 0 && (
          <div role="status" style={{ padding: '44px 20px', textAlign: 'center' }}>
            <Users size={22} color="var(--color-subtle)" />
            <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-text)', marginTop: 10 }}>{q.trim() ? `Nadie coincide con “${q.trim()}”` : 'No hay nadie con ese filtro'}</div>
            <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 4 }}>Probá con otro nombre o sacá el filtro.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
              <button type="button" onClick={() => { setQ(''); setFiltro('todos') }} className="tuo-btn" style={{ height: 44 }}>Ver todos</button>
              {puedeAgendar && q.trim() && !digitos && <button type="button" onClick={() => setAgregando(q.trim())} className="tuo-btn tuo-btn--primario" style={{ height: 44 }}><UserPlus size={16} /> Agregar “{q.trim()}”</button>}
            </div>
          </div>
        )}
        {lista.map((c, i) => {
          const n = nivel(c)
          return (
            <button key={c.id} type="button" onClick={() => onSel(c.id)} className="tu-cli-fila tuo-fila tuo-entra" style={{ ['--i' as string]: Math.min(i + 2, 10) }} aria-label={`${c.nombre}, ${c.visitas} visitas`}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span className="tu-cli-avatar" style={{ display: 'inline-flex', flexShrink: 0 }}><Avatar name={c.nombre} size={40} /></span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</span>
                    {n && <span className={`tuo-chip ${n.clase}`} style={{ height: 20, padding: '0 7px', fontSize: 10.5 }}><n.Icon size={10} /> {n.txt}</span>}
                  </span>
                  {c.nota && <span style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{c.nota}</span>}
                </span>
              </span>
              <span className="tu-cli-tel tuo-num" style={{ fontSize: 13, color: 'var(--color-body)' }}>{telefonoDe(c)}</span>
              <span className="tu-cli-vis" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span className="tuo-num" style={{ width: 22, fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{c.visitas}</span>
                <span aria-hidden style={{ flex: 1, maxWidth: 110, height: 5, borderRadius: 999, background: 'var(--color-surface-alt)', overflow: 'hidden' }}>
                  <span className="tu-cli-barra" style={{ display: 'block', width: `${(c.visitas / maxVisitas) * 100}%`, height: '100%', borderRadius: 999, background: 'var(--tuo-grad)' }} />
                </span>
              </span>
              <span className="tu-cli-ult tuo-num" style={{ fontSize: 13, color: 'var(--color-body)' }}>{c.ultima}</span>
              <span className={salud ? 'tu-cli-extra' : 'tu-cli-extra tuo-num'} style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{salud ? c.obraSocial : !verNumeros ? '' : c.gastado ? pesos(c.gastado) : '—'}</span>
              <ChevronRight size={16} className="tu-cli-flecha" aria-hidden />
            </button>
          )
        })}
      </div>

      {sel && (
        <FichaCliente
          key={sel.id}
          cliente={sel}
          rubro={rubro}
          maxVisitas={maxVisitas}
          nombresServicio={nombresServicio}
          proximo={proximo(sel.id)}
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
function FichaCliente({ cliente: c, rubro, maxVisitas, nombresServicio, proximo, verContacto, verNumeros, puedeAgendar, onCerrar, onAbrirTurno, onAgendar, onWhatsApp }: {
  cliente: Cliente; rubro: RubroTurnos; maxVisitas: number; nombresServicio: string[]; proximo: TurnoAgenda | null
  verContacto: boolean; verNumeros: boolean; puedeAgendar: boolean
  onCerrar: () => void; onAbrirTurno: (t: TurnoAgenda) => void; onAgendar: () => void; onWhatsApp: () => void
}) {
  const salud = esSalud(rubro)
  const pila = c.nombre.split(' ')[0]
  const historial = HISTORIAL.slice(0, Math.min(4, c.visitas))

  return (
    <Modal
      ancho={560}
      rotulo={rubro.cliente}
      titulo={c.nombre}
      bajada={<span className="tuo-num" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{verContacto ? <><Phone size={12} />{c.telefono}</> : <><Lock size={12} />{taparTelefono(c.telefono)}</>}</span>}
      icono={<Anillo valor={c.visitas / maxVisitas} size={64} grosor={4} color="#60A5FA" label={`${c.visitas} visitas`}><Avatar name={c.nombre} size={48} /></Anillo>}
      onCerrar={onCerrar}
      pie={<>
        {verContacto && <button type="button" onClick={onWhatsApp} className="tuo-btn" aria-label={`Escribirle a ${pila} por WhatsApp`}><MessageCircle size={16} /> WhatsApp</button>}
        {puedeAgendar
          ? <button type="button" onClick={onAgendar} className="tuo-btn tuo-btn--primario"><CalendarPlus size={16} /> Agendar turno</button>
          : <button type="button" onClick={onCerrar} className="tuo-btn tuo-btn--primario">Listo</button>}
      </>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 16 }}>
        {[['Visitas', String(c.visitas)], ['Ausencias', c.nota?.includes('Faltó') ? '1' : '0'], salud ? ['Cobertura', c.obraSocial ?? '—'] : verNumeros ? ['Gastado', c.gastado ? pesos(c.gastado) : '—'] : ['Última visita', c.ultima]].map(([k, v], i) => (
          <div key={k} className="tuo-entra" style={{ ['--i' as string]: i + 1, padding: '11px 12px', borderRadius: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 3 }}>{k}</div>
            <div className="tuo-num" style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</div>
          </div>
        ))}
      </div>
      {c.nota && <p style={{ fontSize: 13, color: 'var(--color-body)', margin: '0 0 18px', paddingLeft: 12, borderLeft: '2px solid var(--color-border-strong)', lineHeight: 1.5 }}>{c.nota}</p>}

      <div className="tuo-rotulo" style={{ marginBottom: 8 }}>Próximo turno</div>
      {proximo ? (
        <button type="button" onClick={() => onAbrirTurno(proximo)} className="tuo-card tuo-card--accion" aria-label={`Ver el turno de ${cuandoTxt(proximo.dia ?? 0).toLowerCase()} a las ${horaTxt(proximo.inicio)}`}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', marginBottom: 20, boxShadow: 'none' }}>
          <span aria-hidden style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', color: 'var(--color-primary)', background: 'var(--tuo-grad-suave)' }}><CalendarClock size={17} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{cuandoTxt(proximo.dia ?? 0)} · <span className="tuo-num">{horaTxt(proximo.inicio)}</span></span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{proximo.servicio}</span>
          </span>
          <ChevronRight size={16} color="var(--color-subtle)" aria-hidden />
        </button>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '0 0 20px' }}>No tiene turnos agendados.</p>
      )}

      <div className="tuo-rotulo" style={{ marginBottom: 6 }}>Historial</div>
      {historial.length === 0 && <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '4px 0 0' }}>Todavía no vino: el historial arranca con su primer turno.</p>}
      {historial.map((hh, i, arr) => (
        <div key={i} className="tuo-entra" style={{ ['--i' as string]: i + 3, position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0 11px 22px', fontSize: 13 }}>
          <span aria-hidden style={{ position: 'absolute', left: 4, top: i === 0 ? '50%' : 0, bottom: i === arr.length - 1 ? '50%' : 0, width: 1, background: 'var(--color-border)' }} />
          <span aria-hidden style={{ position: 'absolute', left: 0, top: '50%', width: 9, height: 9, marginTop: -4.5, borderRadius: '50%', background: hh.estado === 'ausente' ? 'var(--color-error)' : 'var(--color-primary)', border: '2px solid var(--color-bg)' }} />
          <span className="tuo-num" style={{ color: 'var(--color-muted)', width: 44 }}>{hh.fecha}</span>
          <span style={{ flex: 1, minWidth: 0, color: 'var(--color-text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombresServicio[i % nombresServicio.length]}</span>
          <ChipEstado estado={hh.estado} size="sm" />
        </div>
      ))}
      {salud && <p style={{ display: 'flex', gap: 7, fontSize: 12, color: 'var(--color-muted)', marginTop: 16, lineHeight: 1.5 }}><ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} /> Datos de salud: solo visibles para el equipo del consultorio.</p>}
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
        <button type="button" onClick={onCerrar} className="tuo-btn">Cancelar</button>
        <button type="submit" className="tuo-btn tuo-btn--primario"><Check size={16} /> Agregar</button>
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
