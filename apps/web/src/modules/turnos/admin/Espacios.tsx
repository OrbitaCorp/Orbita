// Los espacios donde se atiende: canchas, cabinas, consultorios o salas. Cada
// tarjeta muestra de un vistazo cómo viene el día de ese espacio: el anillo de
// ocupación, la jornada en línea (con el corte del mediodía a la vista) y los
// días que se usa.
//
// En los rubros donde cada turno es con una persona (barbería, consultorio) esta
// pantalla no existe: la agenda es de cada persona y se maneja desde Equipo.
// Crear y editar abren un modal; la lista vive en PanelTurnos, así el espacio
// que se suma acá aparece en la agenda y al dar un turno.
import { useState } from 'react'
import { Plus, Clock, CalendarDays, Pencil, Check, UserRound, MoonStar } from 'lucide-react'
import { DIAS_CORTOS, horaTxt, horarioDeRecurso, type Recurso, type RubroTurnos, type Turno } from '@/modules/turnos/datos'
import { AHORA_DEMO, minutosAbiertos, tramosTxt, type Semana, type Tramo } from '@/modules/turnos/horario'
import { Anillo } from '@/modules/turnos/_shared/orbita/OrbitaDia'
import { Cabecera, Sigla } from '@/modules/turnos/_shared/orbita/piezas'
import { Campo } from './configuracion/ui'
import { Modal, ErrorCampo, Borrar, CamposAgenda, TiraJornada, agendaDeForm, agendaFormDe, errorAgenda } from './piezasPanel'
import { COLORES_EQUIPO, type Persona } from './equipoDemo'

export const CSS_ESPACIOS = `
  .tu-eq-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
  .tu-eq-card { overflow: hidden; transition: border-color 180ms ease, box-shadow 240ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1); }
  .tu-eq-card[data-toca='true'] { cursor: pointer; }
  .tu-eq-filo { position: absolute; left: 0; right: 0; top: 0; height: 3px; }
  @media (hover: hover) {
    .tu-eq-card:hover { border-color: color-mix(in srgb, var(--c) 50%, var(--color-border)); box-shadow: var(--shadow-card-hover), 0 0 0 1px color-mix(in srgb, var(--c) 20%, transparent); }
    .tu-eq-card[data-toca='true']:hover { transform: translateY(-3px); }
  }
  .tu-eq-dias { display: flex; gap: 4px; margin: 14px 0 12px; }
  .tu-eq-dias > span { flex: 1; height: 30px; border-radius: 8px; display: grid; place-items: center; font-size: 11px; font-weight: 600; border: 1px solid var(--color-border); color: var(--color-subtle); }
  .tu-eq-dias > span[data-on='true'] { color: var(--color-text); background: color-mix(in srgb, var(--c) 14%, transparent); border-color: color-mix(in srgb, var(--c) 28%, transparent); }
  .tu-eq-datos { display: flex; flex-direction: column; gap: 7px; font-size: 13px; color: var(--color-body); }
  .tu-eq-datos > span { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .tu-eq-datos > span > svg { flex-shrink: 0; color: var(--color-muted); }
  .tu-eq-nuevo { min-height: 180px; border-radius: 16px; border: 1.5px dashed var(--color-border-strong); background: transparent; color: var(--color-muted); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; font-size: 13.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: border-color 180ms ease, background 180ms ease, color 180ms ease; }
  @media (hover: hover) { .tu-eq-nuevo:hover { border-color: var(--color-primary); background: var(--color-primary-bg); color: var(--color-primary); } }
  .tu-eq-nuevo:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  @media (max-width: 768px) { .tu-eq-editar { width: 44px !important; height: 44px !important; } }
  @media (max-width: 480px) { .tu-eq-grid { grid-template-columns: minmax(0, 1fr); } }
  @media (prefers-reduced-motion: reduce) { .tu-eq-card, .tu-eq-card:hover, .tu-eq-nuevo { transition: none; transform: none !important; } }
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
      <div className="tuo-rotulo" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span>Hoy</span><span>{tramos.length === 0 ? `No ${verbo}` : `${lista.length} turno${lista.length === 1 ? '' : 's'}`}</span>
      </div>
      <TiraJornada rango={rango} tramos={tramos} turnos={lista} color={r.color} ahora={AHORA_DEMO} label={tramos.length ? `Jornada de ${r.nombre}: ${lista.length} turnos` : `${r.nombre} hoy no ${verbo}`} />
      <div className="tu-eq-dias" role="img" aria-label={`Días que ${verbo}: ${r.dias}`}>
        {DIAS_CORTOS.map((d, i) => <span key={d} aria-hidden data-on={r.atiende.includes(i)}>{d[0]}</span>)}
      </div>
      <div className="tu-eq-datos">
        <span><Clock size={14} /> <span className="tuo-num" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{(tramos.length ? tramosTxt(tramos) : horarioDeRecurso(r, semana)) || 'Sin horario'}</span></span>
        <span>
          {tramos.length === 0 ? <><MoonStar size={14} /> Hoy no {verbo}</>
            : <><CalendarDays size={14} /> {sigue ? <>Próximo a las <b className="tuo-num" style={{ color: 'var(--color-text)' }}>{horaTxt(sigue.inicio)}</b></> : 'Sin más turnos por hoy'}</>}
        </span>
      </div>
    </>
  )
}

/** Cómo se llaman los espacios del rubro: es el título de la pantalla y el ítem del menú. */
export const espaciosTxt = (r: RubroTurnos) =>
  r.modo === 'cancha' ? 'Canchas' : r.modo === 'cupo' ? 'Salas' : r.familia === 'salud' ? 'Consultorios' : r.familia === 'deporte' ? 'Equipos EMS' : 'Cabinas'

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
  const cancha = rubro.modo === 'cancha'
  const titulo = espaciosTxt(rubro)
  const uno = cancha ? 'una cancha' : rubro.modo === 'cupo' ? 'una sala' : rubro.familia === 'salud' ? 'un consultorio' : rubro.familia === 'deporte' ? 'un equipo' : 'una cabina'
  const tipo = cancha ? 'Cancha' : 'Espacio'
  const nuevo = () => setEditando({ id: '', nombre: '', rol: tipo, color: COLORES_EQUIPO.find(c => !recursos.some(r => r.color === c)) ?? COLORES_EQUIPO[recursos.length % COLORES_EQUIPO.length], horario: '', atiende: [], dias: '' })

  return (
    <div className="panel-page">
      <Cabecera
        rotulo={`${recursos.length} ${recursos.length === 1 ? 'espacio' : 'espacios'}`}
        titulo={titulo}
        bajada={cancha ? 'Cada cancha tiene sus días y su horario. Al reservar, tus clientes eligen la que esté libre.' : 'Cada espacio tiene sus días y su horario, siempre dentro del horario del negocio. Los turnos se dan en el que esté libre.'}
        acciones={<button type="button" onClick={nuevo} className="tuo-btn tuo-btn--primario"><Plus size={16} /> Agregar {uno}</button>}
      />

      <div className="tu-eq-grid">
        {recursos.map((r, idx) => {
          const tramos = jornada(r.id)
          const pct = ocupacionDe(r.id, turnos, tramos)
          const quien = personas.filter(p => p.recursoId === r.id)
          // Toda la tarjeta abre la edición; con teclado, el lápiz.
          return (
            <article key={r.id} onClick={() => setEditando(r)} data-toca="true" className="tuo-card tuo-card--pad tu-eq-card tuo-entra" style={{ ['--c' as string]: r.color, ['--i' as string]: idx + 1 }}>
              <span aria-hidden className="tu-eq-filo" style={{ background: `linear-gradient(90deg, ${r.color}, color-mix(in srgb, ${r.color} 20%, transparent))` }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <Sigla nombre={r.nombre} color={r.color} size={48} Icon={rubro.Icon} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--tuo-fh)', fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nombre}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.rol}</div>
                </div>
                <Anillo valor={pct} color={r.color} size={46} grosor={4.5} label={`Ocupación de hoy: ${Math.round(pct * 100)}%`} />
                <button type="button" onClick={e => { e.stopPropagation(); setEditando(r) }} aria-label={`Editar ${r.nombre}`} className="tuo-btn tuo-btn--icono tuo-btn--sm tu-eq-editar"><Pencil size={14} /></button>
              </div>
              <ResumenAgenda recurso={r} semana={semana} turnos={turnos} tramos={tramos} rango={rango} verbo="se usa" />
              {quien.length > 0 && (
                <div className="tu-eq-datos" style={{ marginTop: 7 }}>
                  <span><UserRound size={14} /> Atiende {quien.map(p => p.nombre.split(' ')[0]).join(' y ')}</span>
                </div>
              )}
            </article>
          )
        })}

        <button type="button" onClick={nuevo} className="tu-eq-nuevo tuo-entra" style={{ ['--i' as string]: recursos.length + 1 }}>
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
function FormEspacio({ inicial, semana, titulo, uno, turnosHoy, unico, onCerrar, onGuardar, onBorrar }: {
  inicial: Recurso; semana: Semana; titulo: string; uno: string; turnosHoy: number; unico: boolean
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
        <button type="button" onClick={onCerrar} className="tuo-btn">Cancelar</button>
        <button type="submit" className="tuo-btn tuo-btn--primario"><Check size={16} /> {esNuevo ? 'Agregar' : 'Guardar cambios'}</button>
      </>}
    >
      <Campo label="Nombre" value={nombre} onChange={v => { setNombre(v); setError('') }} placeholder="Ej.: Cancha 4" maxLength={40} />
      <Campo label="Tipo" ayuda="Se muestra debajo del nombre: techada, de pádel, con camilla…" value={rol} onChange={setRol} maxLength={30} />
      <CamposAgenda id="tu-espacio" valor={agenda} onChange={a => { setAgenda(a); setError('') }} semana={semana} />
      {error && <ErrorCampo>{error}</ErrorCampo>}

      {!esNuevo && (unico ? (
        <p style={{ fontSize: 12.5, color: 'var(--color-muted)', margin: '8px 0 0', lineHeight: 1.5 }}>No se puede eliminar: la agenda necesita al menos un espacio.</p>
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
