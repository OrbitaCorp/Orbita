// Grilla semanal de clases con cupo (gimnasio, crossfit, yoga, danza…).
// Escritorio: grilla de 6 días. Celular: tira de días y lista del día elegido.
// El cupo de cada clase es un anillo que se va cerrando: lleno = completa.
//
// Crear y editar abren el mismo modal, y ahí se ve quiénes están anotados: se
// puede anotar o sacar a alguien. La lista vive en PanelTurnos,
// así las actividades y las salas son las que se cargaron en el resto del panel.
import { useState } from 'react'
import { Plus, Users, Flame, CalendarRange, CalendarX, Check, UserPlus, X } from 'lucide-react'
import { Avatar } from '@/design-system/components/Avatar'
import { DIAS, DIAS_CORTOS, horaTxt, duracionTxt, type ClaseCupo, type RubroTurnos } from '@/modules/turnos/datos'
import { Anillo } from '@/modules/turnos/_shared/orbita/OrbitaDia'
import { Cabecera } from '@/modules/turnos/_shared/orbita/piezas'
import { Campo, Selector, Dos } from './configuracion/ui'
import { Modal, ErrorCampo, Borrar } from './piezasPanel'
import { useCalendarioDemo, type ClasePanel } from './agendaDemo'

function colorCupo(c: ClaseCupo) {
  const p = c.anotados / c.cupo
  return p >= 1 ? { fg: 'var(--chip-error-fg)', bg: 'var(--color-error-bg)', bar: '#EF4444', txt: 'Completa' }
    : p >= 0.8 ? { fg: 'var(--chip-warning-fg)', bg: 'var(--color-warning-bg)', bar: '#F59E0B', txt: 'Últimos lugares' }
      : { fg: 'var(--chip-success-fg)', bg: 'var(--color-success-bg)', bar: '#10B981', txt: 'Hay lugar' }
}

// Anotados de ejemplo: mientras nadie toca la lista de una clase, sale de acá
// (siempre los mismos nombres para la misma clase).
const ANOTADOS_EJEMPLO = [
  'Martina Acosta', 'Bruno Medina', 'Julieta Sosa', 'Franco Molina', 'Paula Herrera', 'Diego Rojas', 'Carolina Vega', 'Ignacio Ríos',
  'Florencia Paz', 'Tomás Correa', 'Lucía Navarro', 'Joaquín Funes', 'Micaela Ortiz', 'Santiago Luna', 'Rocío Blanco', 'Emiliano Vera',
  'Abril Castro', 'Facundo Gil', 'Delfina Soto', 'Valentín Ruiz', 'Camila Peralta', 'Gonzalo Ibarra', 'Sol Domínguez', 'Mateo Aguirre',
]
const anotadosDe = (c: ClasePanel) => c.lista ?? Array.from({ length: Math.min(c.anotados, ANOTADOS_EJEMPLO.length) }, (_, i) => ANOTADOS_EJEMPLO[(Number(c.id.replace(/\D/g, '') || 0) * 5 + i) % ANOTADOS_EJEMPLO.length])

const HORAS = Array.from({ length: 61 }, (_, i) => 6 * 60 + i * 15) // 06:00 a 21:00
const DURACIONES = [30, 45, 50, 60, 75, 90, 120, 150, 180]
const FIN_DEL_DIA = 23 * 60
const choca = (a: { inicio: number; duracion: number }, b: { inicio: number; duracion: number }) => a.inicio < b.inicio + b.duracion && a.inicio + a.duracion > b.inicio

export function TarjetaClase({ c, onClick, publica, i = 0 }: { c: ClaseCupo; onClick?: () => void; publica?: boolean; i?: number }) {
  const col = colorCupo(c)
  const libres = c.cupo - c.anotados
  return (
    <button type="button" onClick={onClick} className="tuo-card tuo-card--accion tuo-entra" aria-label={`${c.nombre}, ${horaTxt(c.inicio)}, ${c.anotados} de ${c.cupo} lugares, ${col.txt}`} style={{ ['--i' as string]: Math.min(i, 10), width: '100%', padding: 12, borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 8, boxShadow: 'none' }}>
      <span style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="tuo-num" style={{ display: 'block', fontSize: 11.5, color: 'var(--color-muted)' }}>{horaTxt(c.inicio)} – {horaTxt(c.inicio + c.duracion)}</span>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.25, marginTop: 3 }}>{c.nombre}</span>
        </span>
        <Anillo valor={c.anotados / c.cupo} color={col.bar} size={38} grosor={4} label={`${c.anotados} de ${c.cupo}`}>
          <span style={{ fontSize: 9.5 }}>{c.anotados}/{c.cupo}</span>
        </Anillo>
      </span>
      <span style={{ fontSize: 11.5, color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.profe} · {c.sala}</span>
      {publica
        ? <span className="tuo-chip" style={{ alignSelf: 'flex-start', height: 22, fontSize: 11, background: col.bg, color: col.fg }}>{libres <= 0 ? 'Lista de espera' : `${libres} lugar${libres === 1 ? '' : 'es'}`}</span>
        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: col.fg }}><span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: col.bar }} />{col.txt}</span>}
    </button>
  )
}

interface Props {
  rubro: RubroTurnos
  clases: ClasePanel[]
  /** Lo que se puede elegir al armar una clase: las actividades y las salas cargadas en el panel. */
  actividades: string[]
  salas: string[]
  /** Los alumnos del negocio: a quiénes se puede anotar a mano. */
  alumnos: string[]
  /** Quiénes dan clases, por su nombre de pila: salen del equipo. */
  profes: string[]
  /** `aviso` reemplaza el título del aviso ("Anotaste a…", "Sacaste a…"). */
  onGuardar: (c: ClasePanel, aviso?: string) => void
  onBorrar: (id: string) => void
  titulo?: string
}

export default function Clases({ rubro, clases, actividades, salas, alumnos, profes, onGuardar, onBorrar, titulo = 'Clases de la semana' }: Props) {
  // La semana en curso, de lunes a sábado. Arranca parada en hoy (el domingo no tiene columna: el sábado).
  const { ahora, fechaCorta, lunesDe, numeroDia, rangoSemana } = useCalendarioDemo()
  const lunes = lunesDe(0)
  const [dia, setDia] = useState(Math.min(ahora.diaSemana, 5))
  // La clase del panel: una nueva (sin id) o el id de una que existe. La que
  // existe se lee siempre de la lista, así el panel ve a quien se anota.
  const [abierta, setAbierta] = useState<ClasePanel | null>(null)
  const actual = abierta?.id ? clases.find(c => c.id === abierta.id) ?? null : abierta
  const total = clases.reduce((s, c) => s + c.anotados, 0)
  const cupos = clases.reduce((s, c) => s + c.cupo, 0)
  const llenas = clases.filter(c => c.anotados >= c.cupo).length

  // Una clase nueva arranca en el día que se está mirando y en el primer horario libre de la sala.
  const nueva = (d = dia) => {
    const sala = salas[0] ?? 'Salón principal'
    const inicio = HORAS.find(m => m >= 7 * 60 && !clases.some(c => c.dia === d && c.sala === sala && choca({ inicio: m, duracion: 60 }, c))) ?? 18 * 60
    setAbierta({ id: '', dia: d, inicio, duracion: 60, nombre: actividades[0] ?? '', profe: profes[0] ?? '', cupo: 12, anotados: 0, sala, lista: [] })
  }

  return (
    <div className="panel-page">
      <style>{`
        .tu-cl-grid { display: grid; grid-template-columns: repeat(6, minmax(150px, 1fr)); gap: 12px; overflow-x: auto; padding-bottom: 4px; }
        .tu-cl-tira { display: none; }
        .tu-cl-datos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
        .tu-cl-vacio { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 64px; padding: 12px; border-radius: 14px; border: 1.5px dashed var(--color-border-strong); background: transparent; color: var(--color-muted); font-family: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: border-color 180ms ease, background 180ms ease, color 180ms ease; }
        @media (hover: hover) { .tu-cl-vacio:hover { border-color: var(--color-primary); background: var(--color-primary-bg); color: var(--color-primary); } }
        .tu-cl-vacio:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
        .tu-cl-anotado + .tu-cl-anotado { border-top: 1px solid var(--color-border); }
        .tu-cl-anotar { height: 42px; flex-shrink: 0; }
        @media (max-width: 768px) {
          .tu-cl-tira { display: flex; }
          .tu-cl-grid { grid-template-columns: 1fr; overflow-x: visible; }
          /* !important: las columnas y sus títulos llevan display inline, que le gana a la hoja. */
          .tu-cl-grid > [data-dia]:not([data-visible="true"]) { display: none !important; }
          .tu-cl-grid [data-dia-titulo] { display: none !important; }
          .tu-cl-datos { gap: 8px; }
          .tu-cl-datos > div { padding: 12px !important; }
          .tu-cl-anotar { height: 46px; }
          .tu-cl-sacar { width: 44px !important; height: 44px !important; }
        }
      `}</style>
      <Cabecera
        rotulo={rangoSemana(lunes, 5)}
        titulo={titulo}
        bajada="Cada clase tiene su cupo. Cuando se completa, los que lleguen tarde entran a la lista de espera."
        acciones={<button type="button" onClick={() => nueva()} className="tuo-btn tuo-btn--primario"><Plus size={16} /> Nueva clase</button>}
      />

      <div className="tu-cl-datos">
        {([[CalendarRange, 'Clases', String(clases.length), '#3B82F6'], [Users, 'Reservas', String(total), '#10B981'], [Flame, 'Completas', String(llenas), '#EF4444']] as const).map(([Icon, l, v, c], i) => (
          <div key={l} className="tuo-card tuo-entra" style={{ ['--i' as string]: i + 1, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0, color: c, background: `color-mix(in srgb, ${c} 14%, transparent)` }}><Icon size={17} strokeWidth={1.8} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--tuo-fh)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--color-text)', lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>{l}{l === 'Reservas' ? ` de ${cupos}` : ''}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="ds-tira tu-cl-tira" style={{ gap: 8, marginBottom: 12, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {DIAS_CORTOS.slice(0, 6).map((d, i) => {
          const a = i === dia
          return <button key={d} type="button" onClick={() => setDia(i)} aria-pressed={a} className="ds-hover ds-tira-chip" data-activa={a} style={{ flexShrink: 0, height: 34, padding: '0 14px', borderRadius: 999, border: a ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)', background: a ? 'var(--color-primary-bg)' : 'var(--color-bg)', color: a ? 'var(--color-primary)' : 'var(--color-body)', fontSize: 13, fontWeight: a ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>{d} {numeroDia(lunes + i)}</button>
        })}
      </div>

      <div className="tu-cl-grid">
        {DIAS.slice(0, 6).map((d, i) => {
          const hoy = i === ahora.diaSemana
          const delDia = clases.filter(c => c.dia === i).sort((a, b) => a.inicio - b.inicio)
          return (
            <div key={d} data-dia data-visible={i === dia} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
              <div data-dia-titulo style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '9px 12px', borderRadius: 10, background: hoy ? 'var(--tuo-grad)' : 'var(--color-surface-alt)', color: hoy ? '#fff' : 'var(--color-text)', fontSize: 13, fontWeight: 600, boxShadow: hoy ? '0 6px 16px rgba(37,99,235,0.3)' : undefined }}>
                {d} <span className="tuo-num" style={{ fontWeight: 400, fontSize: 11.5, color: hoy ? 'rgba(255,255,255,0.82)' : 'var(--color-muted)' }}>{fechaCorta(lunes + i)}</span>
              </div>
              {delDia.map((c, k) => <TarjetaClase key={c.id} c={c} i={k + i} onClick={() => setAbierta(c)} />)}
              {delDia.length === 0 && (
                <button type="button" onClick={() => nueva(i)} className="tu-cl-vacio">
                  <Plus size={16} strokeWidth={1.8} /> Sin clases: agregar una
                </button>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 18, flexWrap: 'wrap', fontSize: 12, color: 'var(--color-muted)' }}>
        {[['#10B981', 'Hay lugar'], ['#F59E0B', 'Más del 80%'], ['#EF4444', 'Completa']].map(([c, t]) => <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', border: `2.5px solid ${c}` }} />{t}</span>)}
      </div>

      {actual && (
        <FormClase
          key={actual.id || 'nueva'}
          clase={actual}
          rubro={rubro}
          clases={clases}
          actividades={actividades}
          salas={salas}
          alumnos={alumnos}
          profes={profes}
          onCerrar={() => setAbierta(null)}
          onGuardar={c => { onGuardar(c); setAbierta(null) }}
          onCambiarLista={onGuardar}
          onBorrar={id => { onBorrar(id); setAbierta(null) }}
        />
      )}
    </div>
  )
}

/** Alta y edición de una clase, con sus anotados. Sin `id` es una nueva. */
function FormClase({ clase, rubro, clases, actividades, salas, alumnos, profes, onCerrar, onGuardar, onCambiarLista, onBorrar }: {
  clase: ClasePanel; rubro: RubroTurnos; clases: ClasePanel[]; actividades: string[]; salas: string[]; alumnos: string[]; profes: string[]
  onCerrar: () => void; onGuardar: (c: ClasePanel) => void; onCambiarLista: (c: ClasePanel, aviso: string) => void; onBorrar: (id: string) => void
}) {
  const { lunesDe, numeroDia } = useCalendarioDemo()
  const lunes = lunesDe(0)
  const [nombre, setNombre] = useState(clase.nombre)
  const [dia, setDia] = useState(clase.dia)
  const [inicio, setInicio] = useState(clase.inicio)
  const [duracion, setDuracion] = useState(clase.duracion)
  const [profe, setProfe] = useState(clase.profe)
  const [sala, setSala] = useState(clase.sala)
  const [cupo, setCupo] = useState(String(clase.cupo))
  const [error, setError] = useState('')
  const [elegido, setElegido] = useState('')
  const esNueva = !clase.id
  // Lo que ya no está en el panel (una actividad borrada, por ejemplo) sigue como opción de esta clase.
  const unicos = (l: string[]) => [...new Set(l.filter(Boolean))]
  const opcionesActividad = unicos([...actividades, clase.nombre]).map(a => ({ id: a, label: a }))
  const opcionesSala = unicos([...salas, clase.sala]).map(s => ({ id: s, label: s }))
  // Quién la da: la gente del equipo que da clases, más quienes ya figuran en la grilla.
  const opcionesProfe = unicos([...profes, ...clases.map(c => c.profe), clase.profe]).map(p => ({ id: p, label: p }))
  const horas = (HORAS.includes(clase.inicio) ? HORAS : [...HORAS, clase.inicio].sort((a, b) => a - b)).map(m => ({ id: m, label: horaTxt(m) }))
  const duraciones = (DURACIONES.includes(clase.duracion) ? DURACIONES : [...DURACIONES, clase.duracion].sort((a, b) => a - b)).map(d => ({ id: d, label: duracionTxt(d) }))

  // Anotados: se leen de la clase como está ahora (anotar o sacar se guarda al toque).
  const anotados = anotadosDe(clase)
  const disponibles = alumnos.filter(n => !anotados.includes(n))
  const aAnotar = disponibles.includes(elegido) ? elegido : disponibles[0] ?? ''
  const lleno = anotados.length >= clase.cupo

  const cambiarLista = (lista: string[], aviso: string) => onCambiarLista({ ...clase, lista, anotados: lista.length }, aviso)

  const guardar = () => {
    const n = Math.round(Number(cupo.replace(',', '.')))
    if (!nombre) { setError('Elegí la actividad.'); return }
    if (!profe.trim()) { setError(`Elegí quién da la clase (${rubro.profesional.toLowerCase()}).`); return }
    if (!Number.isFinite(n) || n < 1) { setError('El cupo tiene que ser de al menos 1 lugar.'); return }
    if (n < anotados.length) { setError(`Ya hay ${anotados.length} anotados: el cupo no puede ser menor. Sacá a alguien primero.`); return }
    if (inicio + duracion > FIN_DEL_DIA) { setError(`Tiene que terminar antes de las ${horaTxt(FIN_DEL_DIA)}. Empezala antes o acortala.`); return }
    const pisa = clases.find(o => o.id !== clase.id && o.dia === dia && o.sala === sala && choca({ inicio, duracion }, o))
    if (pisa) { setError(`${sala} ya tiene ${pisa.nombre} de ${horaTxt(pisa.inicio)} a ${horaTxt(pisa.inicio + pisa.duracion)}. Cambiá el horario o la sala.`); return }
    onGuardar({ ...clase, id: clase.id || `k${Date.now()}`, nombre, dia, inicio, duracion, profe: profe.trim(), sala, cupo: n })
  }

  if (esNueva && actividades.length === 0) {
    return (
      <Modal rotulo="Clases" titulo="Nueva clase" onCerrar={onCerrar} pie={<button type="button" onClick={onCerrar} className="tuo-btn tuo-btn--primario">Entendido</button>}>
        <div style={{ textAlign: 'center', padding: '28px 8px' }}>
          <CalendarX size={24} color="var(--color-subtle)" />
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-text)', marginTop: 10 }}>Todavía no se puede armar una clase</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 4, lineHeight: 1.5 }}>Hace falta al menos una actividad cargada. Sumala desde “Actividades”.</div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      ancho={560}
      rotulo="Clases"
      titulo={esNueva ? 'Nueva clase' : clase.nombre}
      bajada={esNueva ? 'Aparece en la grilla y en tu página de reservas.' : `${DIAS[clase.dia]} ${numeroDia(lunes + clase.dia)} · ${horaTxt(clase.inicio)} a ${horaTxt(clase.inicio + clase.duracion)} · ${clase.sala}`}
      onCerrar={onCerrar}
      onEnviar={guardar}
      pie={<>
        <button type="button" onClick={onCerrar} className="tuo-btn">Cancelar</button>
        <button type="submit" className="tuo-btn tuo-btn--primario"><Check size={16} /> {esNueva ? 'Crear clase' : 'Guardar cambios'}</button>
      </>}
    >
      <Selector label="Actividad" valor={nombre} onChange={v => { setNombre(v); setError('') }} opciones={opcionesActividad} />
      <Dos>
        <Selector label="Día" valor={dia} onChange={v => { setDia(v); setError('') }} opciones={DIAS.slice(0, 6).map((d, i) => ({ id: i, label: `${d} ${numeroDia(lunes + i)}` }))} />
        <Selector label="Empieza" valor={inicio} onChange={v => { setInicio(v); setError('') }} opciones={horas} />
      </Dos>
      <Dos>
        <Selector label="Duración" valor={duracion} onChange={v => { setDuracion(v); setError('') }} opciones={duraciones} />
        <Selector label="Sala" valor={sala} onChange={v => { setSala(v); setError('') }} opciones={opcionesSala} />
      </Dos>
      <Dos>
        {opcionesProfe.length > 0
          ? <Selector label={rubro.profesional} valor={profe} onChange={v => { setProfe(v); setError('') }} opciones={opcionesProfe} />
          : <Campo label={rubro.profesional} value={profe} onChange={v => { setProfe(v); setError('') }} placeholder="Ej.: Caro" maxLength={30} />}
        <Campo label="Cupo" type="number" mono sufijo="lugares" value={cupo} onChange={v => { setCupo(v); setError('') }} placeholder="12" />
      </Dos>
      {error && <ErrorCampo>{error}</ErrorCampo>}

      {!esNueva && (
        <section aria-label="Anotados" style={{ marginTop: 6, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <span className="tuc-rotulo">Anotados</span>
            <span className="tuo-num" style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>{anotados.length} de {clase.cupo}</span>
          </div>
          {anotados.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '0 0 12px' }}>Todavía no se anotó nadie.</p>
            : (
              <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0, borderRadius: 12, border: '1px solid var(--color-border)', maxHeight: 260, overflowY: 'auto' }}>
                {anotados.map(a => (
                  <li key={a} className="tu-cl-anotado" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 6px 5px 12px' }}>
                    <Avatar name={a} size={28} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a}</span>
                    <button type="button" onClick={() => cambiarLista(anotados.filter(x => x !== a), `Sacaste a ${a.split(' ')[0]} de la clase`)} aria-label={`Sacar a ${a} de la clase`} className="tuo-btn tuo-btn--icono tuo-btn--sm tuo-btn--fantasma tu-cl-sacar"><X size={15} /></button>
                  </li>
                ))}
              </ul>
            )}
          {lleno ? (
            <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0, lineHeight: 1.5 }}>La clase está completa: quien quiera venir entra a la lista de espera desde tu página. Para anotar a alguien más, subí el cupo y guardá los cambios.</p>
          ) : disponibles.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0 }}>Todos tus alumnos ya están anotados.</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <Selector label="Anotar a alguien" valor={aAnotar} onChange={setElegido} opciones={disponibles.map(n => ({ id: n, label: n }))} style={{ flex: 1, marginBottom: 0 }} />
              <button type="button" onClick={() => cambiarLista([...anotados, aAnotar], `Anotaste a ${aAnotar.split(' ')[0]}`)} className="tuo-btn tu-cl-anotar"><UserPlus size={15} /> Anotar</button>
            </div>
          )}
        </section>
      )}

      {!esNueva && (
        <Borrar
          etiqueta="Eliminar clase"
          pregunta={<>¿Eliminar <b>{clase.nombre}</b> del {DIAS[clase.dia].toLowerCase()} a las {horaTxt(clase.inicio)}? {anotados.length > 0 ? `Les avisamos a los ${anotados.length} anotados que se suspende.` : 'No tiene anotados.'}</>}
          onBorrar={() => onBorrar(clase.id)}
        />
      )}
    </Modal>
  )
}
