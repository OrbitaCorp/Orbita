// Los espacios donde se atiende: cabinas, consultorios o equipos. Cada
// tarjeta muestra de un vistazo cómo viene el día de ese espacio: cuánto está
// tomado, la jornada en línea (con el corte del mediodía a la vista) y los
// días que se usa.
//
// En los rubros donde cada turno es con una persona (barbería, consultorio) esta
// pantalla no existe: la agenda es de cada persona y se maneja desde Equipo.
// Crear y editar abren un modal; la lista vive en PanelTurnos, así el espacio
// que se suma acá aparece en la agenda y al dar un turno.
import { useState } from 'react'
import { Plus, Clock, CalendarDays, Pencil, Check, UserRound, MoonStar } from 'lucide-react'
import { Encabezado } from '@/design-system/reservas/piezas'
import { DIAS_CORTOS, horaTxt, horarioDeRecurso, type Recurso, type RubroTurnos, type Turno } from '@/modules/turnos/datos'
import { AHORA_DEMO, minutosAbiertos, tramosTxt, type Semana, type Tramo } from '@/modules/turnos/horario'
import { Campo } from './configuracion/ui'
import { Modal, ErrorCampo, Borrar, CamposAgenda, TiraJornada, IconoRecurso, agendaDeForm, agendaFormDe, errorAgenda } from './piezasPanel'
import { COLORES_EQUIPO, type Persona } from '../datos/equipo'

// Las tarjetas de una agenda (una persona en Equipo, un espacio acá): la misma grilla y las mismas piezas.
export const CSS_ESPACIOS = `
  .tu-eq-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
  .tu-eq-card { display: flex; flex-direction: column; }
  .tu-eq-cab { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .tu-eq-cab > div { flex: 1; min-width: 0; }
  .tu-eq-cab b { display: block; font-size: 15px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-eq-cab small { display: block; font-size: 12.5px; color: var(--color-muted); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-eq-ocup { flex-shrink: 0; text-align: right; }
  .tu-eq-ocup > b { display: block; font-family: var(--rv-mono); font-size: 16px; font-weight: 600; color: var(--color-text); font-variant-numeric: tabular-nums; }
  .tu-eq-ocup > small { display: block; font-size: 11px; color: var(--color-muted); }
  .tu-eq-dias { display: flex; gap: 4px; margin: 14px 0 12px; }
  .tu-eq-dias > span { flex: 1; height: 28px; border-radius: 6px; display: grid; place-items: center; font-size: 11px; font-weight: 600; border: 1px solid var(--color-border); color: var(--color-muted); }
  .tu-eq-dias > span[data-on='true'] { color: var(--color-text); background: color-mix(in srgb, var(--c) 14%, transparent); border-color: transparent; }
  .tu-eq-datos { display: flex; flex-direction: column; gap: 7px; font-size: 13px; color: var(--color-body); }
  .tu-eq-datos > span { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .tu-eq-datos > span > svg { flex-shrink: 0; color: var(--color-muted); }
  .tu-eq-nuevo { min-height: 180px; border-radius: var(--rv-r); border: 1px dashed var(--color-border-strong); background: transparent; color: var(--color-muted); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; }
  @media (hover: hover) { .tu-eq-nuevo:hover { border-color: var(--color-primary); color: var(--color-primary); } }
  .tu-eq-nuevo:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .tu-eq-pie { display: flex; gap: 8px; margin-top: auto; padding-top: 14px; border-top: 1px solid var(--color-border); }
  .tu-eq-pie > .rv-btn { flex: 1; }
  @media (max-width: 480px) { .tu-eq-grid { grid-template-columns: minmax(0, 1fr); } }
`

/**
 * Cómo viene el día de una agenda (una persona o un espacio): la jornada en
 * línea, los días que atiende, su horario y el próximo turno. Lo comparten las
 * tarjetas de Equipo y las de esta pantalla.
 */
export function ResumenAgenda({ recurso: r, semana, turnos, tramos, rango, verbo }: {
  recurso: Recurso; semana: Semana; turnos: Turno[]; tramos: Tramo[]; rango: Tramo; /** "atiende" para una persona, "se usa" para un espacio. */ verbo: string
}) {
  const lista = turnos.filter(t => t.recursoId === r.id && t.estado !== 'cancelado')
  const sigue = lista.filter(t => t.inicio > AHORA_DEMO).sort((a, b) => a.inicio - b.inicio)[0]
  return (
    <>
      <div className="rv-rotulo" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span>Hoy</span><span>{tramos.length === 0 ? `No ${verbo}` : `${lista.length} turno${lista.length === 1 ? '' : 's'}`}</span>
      </div>
      <TiraJornada rango={rango} tramos={tramos} turnos={lista} color={r.color} ahora={AHORA_DEMO} label={tramos.length ? `Jornada de ${r.nombre}: ${lista.length} turnos` : `${r.nombre} hoy no ${verbo}`} />
      <div className="tu-eq-dias" role="img" aria-label={`Días que ${verbo}: ${r.dias}`} style={{ ['--c' as string]: r.color }}>
        {DIAS_CORTOS.map((d, i) => <span key={d} aria-hidden data-on={r.atiende.includes(i)}>{d[0]}</span>)}
      </div>
      <div className="tu-eq-datos">
        <span><Clock size={14} /> <span className="rv-num" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{(tramos.length ? tramosTxt(tramos) : horarioDeRecurso(r, semana)) || 'Sin horario'}</span></span>
        <span>
          {tramos.length === 0 ? <><MoonStar size={14} /> Hoy no {verbo}</>
            : <><CalendarDays size={14} /> {sigue ? <>Próximo a las <b className="rv-num" style={{ color: 'var(--color-text)' }}>{horaTxt(sigue.inicio)}</b></> : 'Sin más turnos por hoy'}</>}
        </span>
      </div>
    </>
  )
}

/** Cuánto de la jornada de hoy está tomado, para la esquina de la tarjeta. */
export function Ocupacion({ valor }: { valor: number }) {
  return <span className="tu-eq-ocup"><b>{Math.round(valor * 100)}%</b><small>ocupado hoy</small></span>
}

/** Cómo se llaman los espacios del rubro: es el título de la pantalla y el ítem del menú. */
export const espaciosTxt = (r: RubroTurnos) =>
  r.familia === 'salud' ? 'Consultorios' : r.familia === 'deporte' ? 'Equipos EMS' : 'Cabinas'

/** Cuánto de la jornada de hoy está tomado (0 a 1). */
export const ocupacionDe = (recursoId: string, turnos: Turno[], tramos: Tramo[]) => {
  const abierto = minutosAbiertos(tramos)
  if (!abierto) return 0
  return Math.min(1, turnos.filter(t => t.recursoId === recursoId && t.estado !== 'cancelado').reduce((s, t) => s + t.duracion, 0) / abierto)
}

interface Props {
  rubro: RubroTurnos
  semana: Semana
  recursos: Recurso[]
  /** Los turnos de hoy. */
  turnos: Turno[]
  /** En qué tramos se usa cada espacio hoy. */
  jornada: (recursoId: string) => Tramo[]
  /** De la primera apertura al último cierre del negocio hoy. */
  rango: Tramo
  /** Quién atiende en cada espacio (rubros por cabina). */
  personas: Persona[]
  onGuardar: (r: Recurso) => void
  onBorrar: (id: string) => void
}

export default function Espacios({ rubro, semana, recursos, turnos, jornada, rango, personas, onGuardar, onBorrar }: Props) {
  const [editando, setEditando] = useState<Recurso | null>(null)
  const titulo = espaciosTxt(rubro)
  const uno = rubro.familia === 'salud' ? 'un consultorio' : rubro.familia === 'deporte' ? 'un equipo' : 'una cabina'
  // El ejemplo del campo Nombre al agregar uno: "Cabina 4", "Consultorio 4".
  const ejemplo = `${rubro.familia === 'salud' ? 'Consultorio' : rubro.familia === 'deporte' ? 'Equipo' : 'Cabina'} ${recursos.length + 1}`
  const nuevo = () => setEditando({ id: '', nombre: '', rol: 'Espacio', color: COLORES_EQUIPO.find(c => !recursos.some(r => r.color === c)) ?? COLORES_EQUIPO[recursos.length % COLORES_EQUIPO.length], horario: '', atiende: [], dias: '' })

  return (
    <div className="rv-pagina">
      <Encabezado
        rotulo={`${recursos.length} ${recursos.length === 1 ? 'espacio' : 'espacios'}`}
        titulo={titulo}
        bajada="Cada espacio tiene sus días y su horario, siempre dentro del horario del negocio. Los turnos se dan en el que esté libre."
        acciones={<button type="button" onClick={nuevo} className="rv-btn rv-btn--primario"><Plus size={16} /> Agregar {uno}</button>}
      />

      <div className="tu-eq-grid">
        {recursos.map(r => {
          const tramos = jornada(r.id)
          const pct = ocupacionDe(r.id, turnos, tramos)
          const quien = personas.filter(p => p.recursoId === r.id)
          return (
            <article key={r.id} className="rv-card rv-card--pad tu-eq-card">
              <div className="tu-eq-cab">
                <IconoRecurso color={r.color} Icon={rubro.Icon} size={44} />
                <div><b>{r.nombre}</b><small>{r.rol}</small></div>
                <Ocupacion valor={pct} />
              </div>
              <ResumenAgenda recurso={r} semana={semana} turnos={turnos} tramos={tramos} rango={rango} verbo="se usa" />
              {quien.length > 0 && (
                <div className="tu-eq-datos" style={{ marginTop: 7 }}>
                  <span><UserRound size={14} /> Atiende {quien.map(p => p.nombre.split(' ')[0]).join(' y ')}</span>
                </div>
              )}
              <div className="tu-eq-pie">
                <button type="button" className="rv-btn rv-btn--sm" onClick={() => setEditando(r)} aria-label={`Editar ${r.nombre}`}><Pencil size={14} /> Editar</button>
              </div>
            </article>
          )
        })}

        <button type="button" onClick={nuevo} className="tu-eq-nuevo">
          <Plus size={22} strokeWidth={1.6} />
          Agregar {uno}
        </button>
      </div>

      {editando && (
        <FormEspacio
          key={editando.id || 'nuevo'}
          inicial={editando}
          semana={semana}
          titulo={titulo}
          uno={uno}
          ejemplo={ejemplo}
          turnosHoy={turnos.filter(t => t.recursoId === editando.id && t.estado !== 'cancelado').length}
          unico={recursos.length <= 1}
          onCerrar={() => setEditando(null)}
          onGuardar={r => { onGuardar(r); setEditando(null) }}
          onBorrar={id => { onBorrar(id); setEditando(null) }}
        />
      )}
    </div>
  )
}

/** Alta y edición de un espacio. Sin `id` es uno nuevo. */
function FormEspacio({ inicial, semana, titulo, uno, ejemplo, turnosHoy, unico, onCerrar, onGuardar, onBorrar }: {
  inicial: Recurso; semana: Semana; titulo: string; uno: string; ejemplo: string; turnosHoy: number; unico: boolean
  onCerrar: () => void; onGuardar: (r: Recurso) => void; onBorrar: (id: string) => void
}) {
  const esNuevo = !inicial.id
  const [nombre, setNombre] = useState(inicial.nombre)
  const [rol, setRol] = useState(inicial.rol)
  const [agenda, setAgenda] = useState(() => agendaFormDe(esNuevo ? null : inicial, semana))
  const [error, setError] = useState('')

  const guardar = () => {
    if (!nombre.trim()) { setError('Ponele un nombre.'); return }
    const mal = errorAgenda(agenda)
    if (mal) { setError(mal); return }
    onGuardar({ ...inicial, id: inicial.id || `r${Date.now()}`, nombre: nombre.trim(), rol: rol.trim() || inicial.rol, ...agendaDeForm(agenda) })
  }

  return (
    <Modal
      rotulo={titulo}
      titulo={esNuevo ? `Agregar ${uno}` : inicial.nombre}
      bajada={esNuevo ? 'Queda con su propia columna en la agenda.' : undefined}
      onCerrar={onCerrar}
      onEnviar={guardar}
      pie={<>
        <button type="button" onClick={onCerrar} className="rv-btn">Cancelar</button>
        <button type="submit" className="rv-btn rv-btn--primario"><Check size={16} /> {esNuevo ? 'Agregar' : 'Guardar cambios'}</button>
      </>}
    >
      <Campo label="Nombre" value={nombre} onChange={v => { setNombre(v); setError('') }} placeholder={`Ej.: ${ejemplo}`} maxLength={40} />
      <Campo label="Tipo" ayuda="Se muestra debajo del nombre: con camilla, planta baja, doble…" value={rol} onChange={setRol} maxLength={30} />
      <CamposAgenda id="tu-espacio" valor={agenda} onChange={a => { setAgenda(a); setError('') }} semana={semana} />
      {error && <ErrorCampo>{error}</ErrorCampo>}

      {!esNuevo && (unico ? (
        <p className="rv-ayuda" style={{ margin: '8px 0 0' }}>No se puede eliminar: la agenda necesita al menos un espacio.</p>
      ) : (
        <Borrar
          etiqueta="Eliminar"
          pregunta={<>¿Eliminar <b>{inicial.nombre}</b> de la agenda? {turnosHoy > 0 ? `Sus ${turnosHoy} turno${turnosHoy === 1 ? '' : 's'} de hoy dejan de verse: reprogramalos antes.` : 'No tiene turnos para hoy.'}</>}
          onBorrar={() => onBorrar(inicial.id)}
        />
      ))}
    </Modal>
  )
}
