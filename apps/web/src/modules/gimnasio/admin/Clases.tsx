// Las clases del panel: el día (quién viene a cada clase, check-in, lista de
// espera, anotar a alguien a mano) y la grilla semanal (qué clase hay cada
// día, con profe, sala y cupo). La grilla se repite todas las semanas; lo que
// se cambia acá se ve en el sitio al instante.
import { useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Hourglass, Plus, Trash2, UserPlus, X } from 'lucide-react'
import { DIAS_CORTOS, DIAS_SEMANA, diaSemana, fechaLarga, fechaRelativa, hhmm, sumarDias, type ISO } from '@/lib/reservas/fechas'
import { AHORA, HOY, actividadDe, clasesDelDia, cupoDe, diaBloqueado, profeDe, rubroPorKey, socioPorId, topeSemanal, type ClaseSemanal, type Inscripcion, type NegocioGym, type Socio } from '../datos'
import { Chip, Encabezado, Modal, Nota, Selector, Sigla, Vacio, Campo } from '@/design-system/reservas/piezas'
import { BarraCupo } from '../storefront/Sitio'

interface P {
  negocio: NegocioGym
  inscripciones: Inscripcion[]
  socios: Socio[]
  onCambiar: (id: string, cambio: Partial<Inscripcion>, aviso?: string) => void
  onCancelar: (id: string, aviso?: string) => void
  onInscribir: (i: Inscripcion, aviso?: string) => void
  onGuardarGrilla: (clases: ClaseSemanal[], aviso?: string) => void
}

const CSS = `
  /* La tira de días ocupa lo que dejan las flechas y scrollea adentro: en celular no empuja la página. */
  .gic-dias { display: flex; flex: 0 1 auto; min-width: 0; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 4px; margin: -4px 0; }
  .gic-dias::-webkit-scrollbar { display: none; }
  .gic-dia { flex: 0 0 auto; min-width: 64px; min-height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); font: inherit; color: var(--color-body); cursor: pointer; }
  .gic-dia b { font-family: var(--rv-mono); font-size: 16px; color: var(--color-text); }
  .gic-dia small { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  .gic-dia[aria-pressed='true'] { background: var(--color-primary); border-color: transparent; color: var(--color-on-primary); }
  .gic-dia[aria-pressed='true'] b { color: inherit; }
  .gic-dia:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .gic-lista { display: flex; flex-direction: column; gap: 10px; }
  .gic-clase { display: grid; grid-template-columns: 72px minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--color-border); background: var(--color-bg); text-align: left; font: inherit; color: inherit; cursor: pointer; width: 100%; }
  .gic-clase:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  @media (hover: hover) { .gic-clase:hover { border-color: var(--color-border-strong); } }
  .gic-clase[data-pasada='true'] { background: var(--color-surface); }
  .gic-hora { font-family: var(--rv-mono); font-size: 17px; font-weight: 600; color: var(--color-text); }
  .gic-hora small { display: block; font-size: 11px; font-weight: 500; color: var(--color-muted); }
  .gic-grilla { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
  .gic-col { border: 1px solid var(--color-border); border-radius: 12px; padding: 10px; min-width: 0; background: var(--color-bg); }
  .gic-col-cab { font-size: 13px; font-weight: 700; color: var(--color-text); margin-bottom: 8px; display: flex; justify-content: space-between; }
  .gic-chip { display: block; width: 100%; text-align: left; padding: 7px 8px; border-radius: 8px; border: none; border-left: 3px solid var(--tono, var(--color-primary)); background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 12.5px; line-height: 1.3; margin-bottom: 6px; cursor: pointer; }
  .gic-chip b { display: block; font-family: var(--rv-mono); font-weight: 600; }
  .gic-chip span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-body); }
  .gic-chip:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
  .gic-mas { width: 100%; min-height: 36px; border-radius: 8px; border: 1px dashed var(--color-border-strong); background: transparent; color: var(--color-muted); font: inherit; font-size: 12.5px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px; }
  .gic-mas:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .gic-asistencia { display: flex; flex-direction: column; }
  .gic-persona { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-top: 1px solid var(--color-border); }
  .gic-persona:first-child { border-top: none; }
  .gic-persona-acciones { display: flex; gap: 6px; flex-shrink: 0; }
  .gic-tabs { display: none; }
  @media (max-width: 960px) { .gic-grilla { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 768px) {
    .gic-grilla { grid-template-columns: minmax(0, 1fr); }
    .gic-col[data-oculto='true'] { display: none; }
    /* El padding deja lugar al anillo de foco, que la tira (overflow) recortaba. */
    .gic-tabs { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 4px; margin: -4px -4px 6px; }
    .gic-tabs::-webkit-scrollbar { display: none; }
    .gic-clase { grid-template-columns: 64px minmax(0, 1fr); }
    .gic-clase > :last-child { grid-column: 1 / -1; }
    .gic-persona { flex-wrap: wrap; }
    .gic-persona-acciones { width: 100%; }
    .gic-persona-acciones > .rv-btn { flex: 1; }
    .gic-mas { min-height: 44px; }
  }
`

export default function Clases(p: P) {
  const [vista, setVista] = useState<'dia' | 'grilla'>('dia')
  const r = rubroPorKey(p.negocio.rubro)
  const hoy = clasesDelDia(p.negocio, HOY)
  const esperandoHoy = hoy.reduce((s, c) => s + cupoDe(c, HOY, p.inscripciones).espera, 0)
  return (
    <div className="rv-pagina">
      <style>{CSS}</style>
      <Encabezado rotulo={fechaLarga(HOY)} titulo="Clases"
        bajada={esperandoHoy ? `${esperandoHoy} ${esperandoHoy === 1 ? 'persona espera' : 'personas esperan'} lugar en una clase de hoy. Si alguien cancela, pasa solo.` : `${hoy.length} clases hoy. Nadie en lista de espera.`}
        acciones={<div className="rv-seg" role="group" aria-label="Vista"><button type="button" aria-pressed={vista === 'dia'} onClick={() => setVista('dia')}>Día</button><button type="button" aria-pressed={vista === 'grilla'} onClick={() => setVista('grilla')}>Grilla semanal</button></div>} />
      {vista === 'dia' ? <Dia {...p} socioTxt={r.socio} /> : <Grilla negocio={p.negocio} inscripciones={p.inscripciones} onGuardar={p.onGuardarGrilla} />}
    </div>
  )
}

// ─── El día ──────────────────────────────────────────────────────────────────

function Dia({ negocio, inscripciones, socios, onCambiar, onCancelar, onInscribir, socioTxt }: P & { socioTxt: string }) {
  const [dia, setDia] = useState<ISO>(HOY)
  const [abierta, setAbierta] = useState<string | null>(null)
  const desde = sumarDias(dia, -3)
  const bloqueo = diaBloqueado(negocio, dia)
  const clases = clasesDelDia(negocio, dia)
  const clase = abierta ? clases.find(c => c.id === abierta) ?? null : null
  const pasada = (c: ClaseSemanal) => dia < HOY || (dia === HOY && c.inicio + (actividadDe(negocio, c.actividadId)?.duracion ?? 60) <= AHORA)
  return (
    <>
      <div className="rv-fila" style={{ marginBottom: 14, flexWrap: 'nowrap' }}>
        <button type="button" className="rv-btn rv-btn--icono rv-btn--sm" onClick={() => setDia(sumarDias(dia, -7))} aria-label="Semana anterior"><ChevronLeft size={16} /></button>
        <div className="gic-dias" role="group" aria-label="Día">
          {Array.from({ length: 7 }, (_, i) => sumarDias(desde, i)).map(f => (
            <button key={f} type="button" className="gic-dia" aria-pressed={f === dia} onClick={() => setDia(f)} aria-label={fechaLarga(f)}><small>{f === HOY ? 'Hoy' : DIAS_CORTOS[diaSemana(f)]}</small><b>{Number(f.slice(-2))}</b></button>
          ))}
        </div>
        <button type="button" className="rv-btn rv-btn--icono rv-btn--sm" onClick={() => setDia(sumarDias(dia, 7))} aria-label="Semana siguiente"><ChevronRight size={16} /></button>
        {dia !== HOY && <button type="button" className="rv-btn rv-btn--sm" onClick={() => setDia(HOY)}>Hoy</button>}
      </div>
      {bloqueo ? <Vacio titulo="Sin clases" texto={`${fechaLarga(dia)}: ${bloqueo.motivo}.`} /> : clases.length === 0 ? <Vacio titulo="Sin clases" texto={`${fechaLarga(dia)}: no hay clases en la grilla.`} /> : (
        <div className="gic-lista">
          {clases.map(c => {
            const k = cupoDe(c, dia, inscripciones)
            const suyas = inscripciones.filter(i => i.claseId === c.id && i.fecha === dia)
            const vinieron = suyas.filter(i => i.estado === 'asistio').length
            return (
              <button key={c.id} type="button" className="gic-clase" data-pasada={pasada(c)} onClick={() => setAbierta(c.id)}>
                <span className="gic-hora">{hhmm(c.inicio)}<small>{c.actividad?.duracion} min</small></span>
                <span style={{ minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 15, color: 'var(--color-text)' }}>{c.actividad?.nombre}</b>
                  <span className="rv-ayuda">{c.profe?.nombre} · {c.sala}</span>
                  <BarraCupo anotados={k.anotados} cupo={k.cupo} />
                </span>
                <span className="rv-fila" style={{ gap: 6, justifyContent: 'flex-end' }}>
                  {k.espera > 0 && <Chip tono="aviso"><Hourglass size={12} aria-hidden /> {k.espera} en espera</Chip>}
                  {pasada(c) && <Chip tono={vinieron ? 'ok' : 'gris'}>{vinieron} de {k.anotados} vinieron</Chip>}
                </span>
              </button>
            )
          })}
        </div>
      )}
      {clase && <DetalleClase negocio={negocio} clase={clase} fecha={dia} inscripciones={inscripciones} socios={socios} pasada={pasada(clase)} socioTxt={socioTxt} onCerrar={() => setAbierta(null)} onCambiar={onCambiar} onCancelar={onCancelar} onInscribir={onInscribir} />}
    </>
  )
}

function DetalleClase({ negocio, clase, fecha, inscripciones, socios, pasada, socioTxt, onCerrar, onCambiar, onCancelar, onInscribir }: {
  negocio: NegocioGym; clase: ClaseSemanal; fecha: ISO; inscripciones: Inscripcion[]; socios: Socio[]; pasada: boolean; socioTxt: string
  onCerrar: () => void; onCambiar: P['onCambiar']; onCancelar: P['onCancelar']; onInscribir: P['onInscribir']
}) {
  const act = actividadDe(negocio, clase.actividadId)
  const k = cupoDe(clase, fecha, inscripciones)
  const suyas = inscripciones.filter(i => i.claseId === clase.id && i.fecha === fecha && i.estado !== 'cancelada')
  const anotados = suyas.filter(i => i.estado !== 'espera').sort((a, b) => (socioPorId(a.socioId, socios)?.nombre ?? '').localeCompare(socioPorId(b.socioId, socios)?.nombre ?? ''))
  const espera = suyas.filter(i => i.estado === 'espera').sort((a, b) => a.creada.localeCompare(b.creada) || a.id.localeCompare(b.id))
  const [anotar, setAnotar] = useState('')
  const libres = socios.filter(s => !suyas.some(i => i.socioId === s.id))
  // El dueño puede anotar a quien quiera, pero se le avisa si a esa persona ya no le quedan clases esa semana o en el pack.
  const elegido = anotar ? socioPorId(anotar, socios) : undefined
  const tope = elegido ? topeSemanal(negocio, elegido, fecha, inscripciones) : null
  const sinPack = elegido?.clasesRestantes !== null && elegido?.clasesRestantes !== undefined && elegido.clasesRestantes <= 0
  const agregar = () => {
    const s = socioPorId(anotar, socios)
    if (!s) return
    onInscribir({ id: `n${Date.now().toString(36)}`, claseId: clase.id, fecha, socioId: s.id, estado: k.lleno ? 'espera' : 'reservada', creada: HOY, planId: s.planId }, k.lleno ? `${s.nombre.split(' ')[0]} quedó en lista de espera` : `${s.nombre.split(' ')[0]} anotado`)
    setAnotar('')
  }
  return (
    <Modal titulo={act?.nombre ?? 'Clase'} bajada={`${fechaRelativa(fecha, HOY) === 'Hoy' ? 'Hoy' : fechaLarga(fecha)} · ${hhmm(clase.inicio)} a ${hhmm(clase.inicio + (act?.duracion ?? 60))} · ${profeDe(negocio, clase.profeId)?.nombre} · ${clase.sala}`} onCerrar={onCerrar} ancho={600}
      pie={<button type="button" className="rv-btn" onClick={onCerrar}>Cerrar</button>}>
      <BarraCupo anotados={k.anotados} cupo={k.cupo} />
      <div className="rv-entre" style={{ margin: '16px 0 6px' }}>
        <h3 className="rv-h3">{pasada ? 'Asistencia' : 'Anotados'} ({anotados.length})</h3>
        {pasada && <span className="rv-ayuda">{anotados.filter(i => i.estado === 'asistio').length} vinieron · {anotados.filter(i => i.estado === 'ausente').length} faltaron</span>}
      </div>
      <div className="gic-asistencia">
        {anotados.map(i => {
          const s = socioPorId(i.socioId, socios)
          return (
            <div key={i.id} className="gic-persona">
              <Sigla nombre={s?.nombre ?? '?'} size={32} />
              <span style={{ flex: 1, minWidth: 0 }}><b style={{ display: 'block', fontSize: 14, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s?.nombre ?? '—'}</b><span className="rv-ayuda">{s?.telefono}</span></span>
              <span className="gic-persona-acciones">
                {i.estado === 'asistio' ? <Chip tono="ok"><Check size={12} aria-hidden /> Vino</Chip> : i.estado === 'ausente' ? <Chip tono="error">Faltó</Chip> : null}
                {i.estado !== 'asistio' && <button type="button" className="rv-btn rv-btn--sm" onClick={() => onCambiar(i.id, { estado: 'asistio' }, `Check-in de ${s?.nombre.split(' ')[0] ?? ''}`)}><Check size={14} aria-hidden /> Check-in</button>}
                {pasada && i.estado !== 'ausente' && <button type="button" className="rv-btn rv-btn--sm rv-btn--fantasma" onClick={() => onCambiar(i.id, { estado: 'ausente' })}>Faltó</button>}
                {!pasada && i.estado === 'reservada' && <button type="button" className="rv-btn rv-btn--sm rv-btn--fantasma" onClick={() => onCancelar(i.id, `Se liberó el lugar de ${s?.nombre.split(' ')[0] ?? ''}`)} aria-label={`Sacar a ${s?.nombre}`}><X size={14} /></button>}
              </span>
            </div>
          )
        })}
        {anotados.length === 0 && <p className="rv-ayuda" style={{ margin: '6px 0' }}>Nadie anotado todavía.</p>}
      </div>
      {espera.length > 0 && (
        <>
          <h3 className="rv-h3" style={{ margin: '16px 0 6px' }}><Hourglass size={14} aria-hidden style={{ verticalAlign: '-2px', color: 'var(--color-warning)' }} /> Lista de espera ({espera.length})</h3>
          <div className="gic-asistencia">
            {espera.map((i, n) => {
              const s = socioPorId(i.socioId, socios)
              return (
                <div key={i.id} className="gic-persona">
                  <span className="rv-num" style={{ width: 24, color: 'var(--color-muted)' }}>{n + 1}.</span>
                  <span style={{ flex: 1, minWidth: 0 }}><b style={{ display: 'block', fontSize: 14, color: 'var(--color-text)' }}>{s?.nombre}</b><span className="rv-ayuda">Pasa solo cuando alguien cancela</span></span>
                  <span className="gic-persona-acciones">
                    {!k.lleno && <button type="button" className="rv-btn rv-btn--sm rv-btn--primario" onClick={() => onCambiar(i.id, { estado: 'reservada' }, `${s?.nombre.split(' ')[0] ?? ''} ya tiene lugar`)}>Darle el lugar</button>}
                    <button type="button" className="rv-btn rv-btn--sm rv-btn--fantasma" onClick={() => onCancelar(i.id, 'Sacado de la lista')} aria-label={`Sacar a ${s?.nombre} de la lista`}><X size={14} /></button>
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
      {!pasada && (
        <>
          <div className="rv-fila" style={{ marginTop: 18, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}><Selector label={`Anotar ${socioTxt.toLowerCase()}`} valor={anotar} onChange={setAnotar} opciones={[{ id: '', label: 'Elegí a alguien' }, ...libres.map(s => ({ id: s.id, label: s.nombre }))]} /></div>
            <button type="button" className="rv-btn" onClick={agregar} disabled={!anotar}><UserPlus size={15} aria-hidden /> {k.lleno ? 'A la lista de espera' : 'Anotar'}</button>
          </div>
          {elegido && (tope?.lleno || sinPack) && (
            <div style={{ marginTop: 10 }}>
              <Nota tono="aviso">{tope?.lleno ? `${elegido.nombre.split(' ')[0]} ya usó sus ${tope.porSemana} clases de esa semana. Si lo anotás igual, cobrale la clase aparte.` : `A ${elegido.nombre.split(' ')[0]} no le quedan clases en el pack. Si lo anotás igual, cobrale la clase aparte o renovale el pack desde su ficha.`}</Nota>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

// ─── La grilla semanal ───────────────────────────────────────────────────────

function Grilla({ negocio, inscripciones, onGuardar }: { negocio: NegocioGym; inscripciones: Inscripcion[]; onGuardar: P['onGuardarGrilla'] }) {
  const [dia, setDia] = useState(0)
  const [editando, setEditando] = useState<Partial<ClaseSemanal> | null>(null)
  const porDia = useMemo(() => Array.from({ length: 6 }, (_, d) => negocio.clases.filter(c => c.dia === d).sort((a, b) => a.inicio - b.inicio)), [negocio.clases])
  // Cuánto se llena cada clase de la grilla, en promedio, en las últimas 4 semanas: para ver cuáles funcionan.
  const promedio = (c: ClaseSemanal) => {
    const fechas = Array.from({ length: 4 }, (_, k) => sumarDias(HOY, -(diaSemana(HOY) - c.dia) - k * 7)).filter(f => f <= HOY)
    const vals = fechas.map(f => cupoDe(c, f, inscripciones).anotados / Math.max(1, c.cupo))
    return vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) : 0
  }
  return (
    <>
      {/* En celular la grilla muestra un día por vez: estos botones eligen cuál (en escritorio se ven los seis). */}
      <div className="gic-tabs" role="group" aria-label="Día de la grilla">
        {DIAS_CORTOS.slice(0, 6).map((d, i) => <button key={d} type="button" aria-pressed={i === dia} className="rv-chip rv-chip--borde" onClick={() => setDia(i)}>{d}</button>)}
      </div>
      <div className="gic-grilla">
        {porDia.map((clases, d) => (
          <div key={d} className="gic-col" data-oculto={d !== dia}>
            <div className="gic-col-cab"><span>{DIAS_SEMANA[d]}</span><span className="rv-ayuda">{clases.length}</span></div>
            {clases.map(c => {
              const act = actividadDe(negocio, c.actividadId)
              return (
                <button key={c.id} type="button" className="gic-chip" style={{ ['--tono' as string]: act?.color } as React.CSSProperties} onClick={() => setEditando(c)} aria-label={`${act?.nombre} ${hhmm(c.inicio)}, editar`}>
                  <b>{hhmm(c.inicio)}</b><span>{act?.nombre}</span><span className="rv-ayuda">{profeDe(negocio, c.profeId)?.nombre} · cupo {c.cupo} · {promedio(c)}% lleno</span>
                </button>
              )
            })}
            <button type="button" className="gic-mas" onClick={() => setEditando({ dia: d, inicio: negocio.apertura.desde, actividadId: negocio.actividades[0]?.id, profeId: negocio.profes[0]?.id, sala: negocio.salas[0], cupo: negocio.actividades[0]?.cupo ?? 10 })}><Plus size={14} aria-hidden /> Clase</button>
          </div>
        ))}
      </div>
      {editando && (
        <EditarClase negocio={negocio} clase={editando} onCerrar={() => setEditando(null)}
          onGuardar={c => { const existe = negocio.clases.some(x => x.id === c.id); onGuardar(existe ? negocio.clases.map(x => (x.id === c.id ? c : x)) : [...negocio.clases, c], existe ? 'Clase actualizada' : 'Clase agregada a la grilla'); setEditando(null) }}
          onBorrar={id => { onGuardar(negocio.clases.filter(x => x.id !== id), 'Clase quitada de la grilla'); setEditando(null) }} />
      )}
    </>
  )
}

function EditarClase({ negocio, clase, onCerrar, onGuardar, onBorrar }: { negocio: NegocioGym; clase: Partial<ClaseSemanal>; onCerrar: () => void; onGuardar: (c: ClaseSemanal) => void; onBorrar: (id: string) => void }) {
  // Una clase nueva todavía no tiene id: se le da al guardar (Date.now() en el render rompe la pureza del componente).
  const [v, setV] = useState<ClaseSemanal>({ id: clase.id ?? '', actividadId: clase.actividadId ?? negocio.actividades[0]?.id ?? '', dia: clase.dia ?? 0, inicio: clase.inicio ?? negocio.apertura.desde, profeId: clase.profeId ?? negocio.profes[0]?.id ?? '', sala: clase.sala ?? negocio.salas[0] ?? '', cupo: clase.cupo ?? 10 })
  const esNueva = !clase.id
  const act = actividadDe(negocio, v.actividadId)
  const dura = act?.duracion ?? 60
  // Las horas del horario del negocio de 15 en 15; si la clase quedó fuera (se cambió el horario), su hora también va, para que el selector la muestre.
  const enHorario = Array.from({ length: Math.floor((negocio.apertura.hasta - negocio.apertura.desde) / 15) }, (_, i) => negocio.apertura.desde + i * 15)
  const horas = enHorario.includes(v.inicio) ? enHorario : [...enHorario, v.inicio].sort((a, b) => a - b)
  const dias = DIAS_SEMANA.map((d, i) => ({ id: i, label: d })).filter(x => negocio.apertura.dias.includes(x.id) || x.id === v.dia)
  // Dos clases en la misma sala no pueden pisarse, y la clase tiene que terminar antes del cierre.
  const choca = negocio.clases.find(c => c.id !== v.id && c.dia === v.dia && c.sala === v.sala && c.inicio < v.inicio + dura && v.inicio < c.inicio + (actividadDe(negocio, c.actividadId)?.duracion ?? 60))
  const fuera = v.inicio < negocio.apertura.desde || v.inicio + dura > negocio.apertura.hasta || !negocio.apertura.dias.includes(v.dia)
  const guardar = () => onGuardar(esNueva ? { ...v, id: `k${Date.now().toString(36)}` } : v)
  return (
    <Modal titulo={esNueva ? 'Nueva clase' : 'Editar clase'} bajada="Se repite todas las semanas el mismo día y a la misma hora." onCerrar={onCerrar}
      pie={<>
        {!esNueva && <button type="button" className="rv-btn rv-btn--peligro rv-modal-izq" onClick={() => onBorrar(v.id)}><Trash2 size={15} aria-hidden /> Quitar</button>}
        <button type="button" className="rv-btn" onClick={onCerrar}>Cancelar</button>
        <button type="button" className="rv-btn rv-btn--primario" disabled={!!choca || fuera} onClick={guardar}><Check size={15} aria-hidden /> Guardar</button>
      </>}>
      <div className="rv-pila">
        <Selector label="Actividad" valor={v.actividadId} onChange={id => { const a = actividadDe(negocio, id); setV({ ...v, actividadId: id, cupo: a?.cupo ?? v.cupo }) }} opciones={negocio.actividades.map(a => ({ id: a.id, label: `${a.nombre} · ${a.duracion} min` }))} />
        <div className="rv-dos">
          <Selector label="Día" valor={v.dia} onChange={d => setV({ ...v, dia: d })} opciones={dias} />
          <Selector label="Hora" valor={v.inicio} onChange={h => setV({ ...v, inicio: h })} opciones={horas.map(h => ({ id: h, label: hhmm(h) }))} />
        </div>
        <div className="rv-dos">
          <Selector label="Profe" valor={v.profeId} onChange={id => setV({ ...v, profeId: id })} opciones={negocio.profes.map(p => ({ id: p.id, label: p.nombre }))} />
          <Selector label="Sala" valor={v.sala} onChange={s => setV({ ...v, sala: s })} opciones={negocio.salas.map(s => ({ id: s, label: s }))} />
        </div>
        <Campo label="Cupo" value={String(v.cupo)} onChange={x => setV({ ...v, cupo: Math.max(1, Number(x.replace(/\D/g, '')) || 1) })} inputMode="numeric" ayuda="Cuántos lugares tiene esta clase. Si se pasa, el resto queda en lista de espera." />
        {choca && <p className="rv-error" role="alert" style={{ margin: 0 }}>Se pisa con {actividadDe(negocio, choca.actividadId)?.nombre} de las {hhmm(choca.inicio)} en {choca.sala}.</p>}
        {!choca && fuera && <p className="rv-error" role="alert" style={{ margin: 0 }}>{negocio.apertura.dias.includes(v.dia) ? `Queda fuera del horario: abrís de ${hhmm(negocio.apertura.desde)} a ${hhmm(negocio.apertura.hasta)} y esta clase va de ${hhmm(v.inicio)} a ${hhmm(v.inicio + dura)}.` : `Ese día no abrís: elegí otro día o cambiá los horarios en Configuración.`}</p>}
      </div>
    </Modal>
  )
}
