// Agenda por día, por semana o por mes.
//
// Día: una columna por profesional o espacio (en celular, uno a la vez, elegido
// con la tira de chips del estándar .ds-tira). Semana: los días que abre el
// negocio para quien se elija en esa misma tira. Mes: el calendario entero con
// cuántos turnos tiene cada día y de quién son; tocar un día lo abre.
//
// La grilla sigue el horario del negocio: va de la primera apertura al último
// cierre, y lo que queda fuera de la atención (antes de abrir, el corte del
// mediodía, el día que alguien no viene) se ve rayado y no se puede agendar ahí.
//
// La hora actual es el satélite de la agenda: una línea azul con su punto
// latiendo y la hora en una etiqueta. Lo que ya pasó queda apenas velado, así
// el ojo cae solo en lo que falta del día.
//
// Las flechas mueven de a un día, una semana o un mes, y "Hoy" vuelve al día de
// la demo. Tocar un espacio libre de una columna abre "Nuevo turno" con esa
// hora y esa agenda ya elegidas.
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Plus, Coins, MoonStar } from 'lucide-react'
import { ESTADO_TURNO, DIAS, DIAS_CORTOS, horaTxt, type Recurso, type Cliente, type RubroTurnos } from '@/modules/turnos/datos'
import { AHORA_DEMO, diasAbiertos, extremos, minutosAbiertos, tramosDelDia, type Semana, type Tramo } from '@/modules/turnos/horario'
import { Cabecera, Sigla } from '@/modules/turnos/_shared/orbita/piezas'
import { fechaCorta, fechaDe, fechaLarga, grillaDelMes, indiceDia, lunesDe, mesTxt, mismoMes, moverMes, rangoSemana, type NuevoTurnoPre, type TurnoAgenda } from './agendaDemo'

const PX_HORA = 92
type Vista = 'dia' | 'semana' | 'mes'
const VISTAS: [Vista, string][] = [['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']]

interface Props {
  rubro: RubroTurnos
  /** El horario del negocio: de acá salen el rango de la grilla y los días que abre. */
  semana: Semana
  recursos: Recurso[]
  /** Turnos de un día, contado desde hoy (0 = hoy, 1 = mañana, -1 = ayer). */
  turnosDelDia: (dia: number) => TurnoAgenda[]
  /** En qué tramos atiende una agenda un día (contado desde hoy). [] = ese día no atiende. */
  jornada: (recursoId: string, dia: number) => Tramo[]
  clientes: Cliente[]
  /** Quien mira puede dar turnos. */
  puedeAgendar: boolean
  onAbrir: (t: TurnoAgenda) => void
  onNuevo: (pre?: NuevoTurnoPre) => void
}

/** Lo que queda fuera de la atención entre `desde` y `hasta`: antes de abrir, el corte del mediodía y después de cerrar. */
function bandasCerradas(tramos: Tramo[], desde: number, hasta: number): { a: number; b: number; corte: boolean }[] {
  if (tramos.length === 0) return [{ a: desde, b: hasta, corte: false }]
  const out: { a: number; b: number; corte: boolean }[] = []
  let libre = desde
  tramos.forEach(([x, y], i) => {
    if (x > libre) out.push({ a: libre, b: x, corte: i > 0 })
    libre = Math.max(libre, y)
  })
  if (libre < hasta) out.push({ a: libre, b: hasta, corte: false })
  return out
}

export default function Agenda({ rubro, semana, recursos, turnosDelDia, jornada, clientes, puedeAgendar, onAbrir, onNuevo }: Props) {
  const [vista, setVista] = useState<Vista>('dia')
  const [dia, setDia] = useState(0)
  const [elegido, setElegido] = useState(recursos[0]?.id)
  const [enMes, setEnMes] = useState('todos')
  // Si el elegido ya no está (se sacó del equipo), se muestra el primero.
  const recursoMovil = recursos.some(r => r.id === elegido) ? elegido : recursos[0]?.id
  const filtroMes = enMes !== 'todos' && recursos.some(r => r.id === enMes) ? enMes : 'todos'
  const nombreCliente = (id: string) => clientes.find(c => c.id === id)?.nombre ?? '—'
  const esPersona = rubro.modo === 'profesional'
  const abre = (d: number) => tramosDelDia(semana, indiceDia(d)).length > 0

  // Hoy (sábado) es el día real de la demo; los demás días los arma PanelTurnos.
  const lunes = lunesDe(dia)
  const abiertos = diasAbiertos(semana)
  const diasSemana = abiertos.length ? abiertos : [0, 1, 2, 3, 4, 5]
  const turnos = turnosDelDia(dia)
  const deLaSemana = diasSemana.map(i => turnosDelDia(lunes + i))
  const celdas = vista === 'mes' ? grillaDelMes(dia) : []
  const recursosMes = filtroMes === 'todos' ? recursos : recursos.filter(r => r.id === filtroMes)
  const delMes = (d: number) => turnosDelDia(d).filter(t => filtroMes === 'todos' || t.recursoId === filtroMes)

  const cols = vista === 'dia'
    ? recursos.map(r => ({ key: r.id, titulo: r.nombre, sub: r.rol, color: r.color, lista: turnos.filter(t => t.recursoId === r.id), recursoId: r.id, dia, esDia: false, tramos: jornada(r.id, dia) }))
    : vista === 'semana'
      ? diasSemana.map((i, k) => ({ key: DIAS_CORTOS[i], titulo: DIAS_CORTOS[i], sub: fechaCorta(lunes + i), color: recursos.find(r => r.id === recursoMovil)?.color ?? '#3B82F6', lista: deLaSemana[k].filter(t => t.recursoId === recursoMovil), recursoId: recursoMovil, dia: lunes + i, esDia: true, tramos: recursoMovil ? jornada(recursoMovil, lunes + i) : [] }))
      : []

  const aLaVista = vista === 'dia' ? turnos
    : vista === 'semana' ? deLaSemana.flat().filter(t => t.recursoId === recursoMovil)
      : celdas.filter(d => mismoMes(d, dia)).flatMap(delMes)
  const activos = aLaVista.filter(t => t.estado !== 'cancelado')
  const sinConfirmar = aLaVista.filter(t => t.estado === 'pendiente').length
  const hoyALaVista = vista === 'dia' ? dia === 0 : vista === 'semana' ? lunes <= 0 && lunes + 6 >= 0 : mismoMes(dia, 0)
  const cerradoHoy = vista === 'dia' && !abre(dia)

  // La grilla va de la primera apertura al último cierre de la semana (en horas
  // enteras). Si hay un turno fuera de eso, se estira para que se vea.
  const [abreSemana, cierraSemana] = extremos(semana)
  const enGrilla = vista === 'mes' ? [] : cols.flatMap(c => c.lista)
  const desde = Math.floor(Math.min(abreSemana, ...enGrilla.map(t => t.inicio)) / 60) * 60
  const hasta = Math.ceil(Math.max(cierraSemana, ...enGrilla.map(t => t.inicio + t.duracion)) / 60) * 60
  const y = (min: number) => ((min - desde) / 60) * PX_HORA
  const horas = Array.from({ length: (hasta - desde) / 60 }, (_, i) => desde + i * 60)

  // La grilla abre parada en "ahora" (con un poco de aire arriba), no en la apertura.
  const grilla = useRef<HTMLDivElement>(null)
  useEffect(() => { grilla.current?.scrollTo({ top: Math.max(0, ((AHORA_DEMO - desde) / 60) * PX_HORA - 190) }) }, [vista, desde])

  const mover = (sentido: 1 | -1) => setDia(d => (vista === 'mes' ? moverMes(d, sentido) : d + sentido * (vista === 'semana' ? 7 : 1)))
  const unidad = vista === 'dia' ? 'Día' : vista === 'semana' ? 'Semana' : 'Mes'

  // Tocar el fondo de una columna (no un turno ni una franja cerrada) agenda en esa media hora.
  const agendarEn = (e: MouseEvent<HTMLDivElement>, recursoId: string | undefined, d: number, tramos: Tramo[]) => {
    if (e.target !== e.currentTarget || !recursoId) return
    const px = e.clientY - e.currentTarget.getBoundingClientRect().top
    const inicio = desde + Math.floor((px / PX_HORA) * 2) * 30
    if (!tramos.some(([a, b]) => inicio >= a && inicio < b) || (d === 0 && inicio + 30 <= AHORA_DEMO)) return
    onNuevo({ recursoId, inicio, dia: d })
  }

  const chip = (id: string, activo: boolean, contenido: ReactNode, onClick: () => void) => (
    <button key={id} type="button" onClick={onClick} aria-pressed={activo} className="ds-hover ds-tira-chip" data-activa={activo} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 14px', borderRadius: 999, border: activo ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)', background: activo ? 'var(--color-primary-bg)' : 'var(--color-bg)', color: activo ? 'var(--color-primary)' : 'var(--color-body)', fontSize: 13, fontWeight: activo ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'border-color 160ms ease, background 160ms ease, color 160ms ease' }}>
      {contenido}
    </button>
  )

  return (
    <div className="panel-page">
      <style>{`
        .tu-ag-grid { display: grid; grid-template-columns: 60px repeat(var(--tu-cols), minmax(160px, 1fr)); }
        .tu-ag-bloque { transition: box-shadow 180ms ease, transform 200ms cubic-bezier(0.22, 1, 0.36, 1), filter 180ms ease; animation: tuAgEntra 420ms cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: calc(var(--i, 0) * 35ms); }
        @keyframes tuAgEntra { from { opacity: 0; transform: scale(0.96) translateY(6px) } to { opacity: var(--op, 1); transform: none } }
        @media (hover: hover) {
          .tu-ag-bloque:hover { box-shadow: 0 8px 24px color-mix(in srgb, var(--c) 30%, transparent), 0 0 0 1px color-mix(in srgb, var(--c) 55%, transparent); transform: translateY(-1px) scale(1.012); z-index: 3; filter: saturate(1.15); }
          .tu-ag-col[data-libre="true"]:hover { background-color: color-mix(in srgb, var(--color-primary) 3%, transparent); }
        }
        .tu-ag-bloque:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; z-index: 3; }
        .tu-ag-col { transition: background-color 200ms ease; }
        .tu-ag-col[data-libre="true"] { cursor: cell; }
        .tu-ag-col > [aria-hidden] { pointer-events: none; }
        /* Fuera de la atención: rayado, con su motivo si hay lugar para leerlo. */
        .tu-ag-banda { position: absolute; left: 0; right: 0; display: grid; place-items: center; overflow: hidden; cursor: default; background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-border-strong) 42%, transparent) 0 1px, transparent 1px 9px), color-mix(in srgb, var(--color-surface-alt) 50%, var(--color-bg)); }
        .tu-ag-banda > span { max-width: calc(100% - 12px); padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 500; color: var(--color-muted); background: var(--color-bg); border: 1px solid var(--color-border); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tu-ag-movil { display: none; }
        .tu-ag-resumen { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }

        /* Mes */
        .tu-ag-mes-cab, .tu-ag-mes { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
        .tu-ag-mes-cab { background: var(--color-surface); border-bottom: 1px solid var(--color-border); border-radius: 16px 16px 0 0; }
        .tu-ag-mes-cab > span { padding: 10px 12px; }
        .tu-ag-celda { position: relative; min-height: 116px; padding: 9px 10px 16px; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; text-align: left; border: none; border-right: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); background: var(--color-bg); font-family: inherit; color: inherit; cursor: pointer; transition: background 160ms ease; }
        .tu-ag-celda:nth-child(7n) { border-right: none; }
        .tu-ag-mes > .tu-ag-celda:nth-last-child(-n+7) { border-bottom: none; }
        .tu-ag-mes > .tu-ag-celda:nth-last-child(7) { border-bottom-left-radius: 16px; }
        .tu-ag-mes > .tu-ag-celda:last-child { border-bottom-right-radius: 16px; }
        .tu-ag-celda[data-fuera='true'] { background: var(--color-surface); }
        .tu-ag-celda[data-fuera='true'] > * { opacity: 0.5; }
        .tu-ag-celda[data-cerrado='true'] { background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-border-strong) 34%, transparent) 0 1px, transparent 1px 9px), color-mix(in srgb, var(--color-surface-alt) 45%, var(--color-bg)); }
        .tu-ag-celda[data-pasado='true'] .tu-ag-celda-total, .tu-ag-celda[data-pasado='true'] .tu-ag-celda-quien { opacity: 0.62; }
        .tu-ag-celda-num { min-width: 26px; height: 26px; padding: 0 6px; border-radius: 8px; display: grid; place-items: center; font-family: var(--tuo-mono); font-size: 13px; font-weight: 600; color: var(--color-text); font-variant-numeric: tabular-nums; }
        .tu-ag-celda[data-hoy='true'] { box-shadow: inset 0 0 0 2px var(--color-primary); }
        .tu-ag-celda[data-hoy='true'] .tu-ag-celda-num { background: var(--tuo-grad); color: #fff; box-shadow: 0 4px 12px rgba(37,99,235,0.35); }
        .tu-ag-celda-total { font-size: 12.5px; color: var(--color-body); }
        .tu-ag-celda-total > b { font-family: var(--tuo-mono); font-weight: 600; color: var(--color-text); }
        .tu-ag-celda-quien { display: flex; flex-wrap: wrap; gap: 3px 9px; font-family: var(--tuo-mono); font-size: 11.5px; color: var(--color-muted); font-variant-numeric: tabular-nums; }
        .tu-ag-celda-quien > span { display: inline-flex; align-items: center; gap: 4px; }
        .tu-ag-celda-quien i { width: 7px; height: 7px; border-radius: 50%; }
        .tu-ag-celda-nota { font-size: 11.5px; color: var(--color-muted); }
        .tu-ag-celda-ocup { position: absolute; left: 10px; right: 10px; bottom: 7px; height: 3px; border-radius: 999px; background: var(--color-surface-alt); overflow: hidden; }
        .tu-ag-celda-ocup > i { display: block; height: 100%; border-radius: 999px; background: var(--tuo-grad); }
        @media (hover: hover) { .tu-ag-celda:hover { background: color-mix(in srgb, var(--color-primary) 6%, var(--color-bg)); } }
        .tu-ag-celda:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; z-index: 1; }

        @media (max-width: 768px) {
          .tu-ag-movil { display: flex; }
          .tu-ag-grid[data-vista="dia"] { grid-template-columns: 50px 1fr; }
          .tu-ag-grid[data-vista="dia"] [data-recurso]:not([data-visible="true"]) { display: none !important; }
          .tu-ag-grid[data-vista="semana"] { grid-template-columns: 44px repeat(var(--tu-cols), minmax(96px, 1fr)); }
          .tu-ag-leyenda { display: none !important; }
          .tu-ag-nav { height: 44px; min-width: 44px; }
          .tu-ag-seg { display: flex; flex: 1; }
          .tu-ag-seg > button { height: 44px; flex: 1; }
          .tu-ag-nuevo { height: 44px; }
          .tu-ag-mes-cab > span { padding: 8px 0; text-align: center; font-size: 9.5px; }
          .tu-ag-celda { min-height: 66px; padding: 6px 2px 12px; align-items: center; gap: 2px; }
          .tu-ag-celda-total > span, .tu-ag-celda-quien { display: none; }
          .tu-ag-celda-nota { font-size: 9.5px; }
          .tu-ag-celda-ocup { left: 6px; right: 6px; bottom: 5px; }
        }
        @media (prefers-reduced-motion: reduce) { .tu-ag-bloque, .tu-ag-bloque:hover { transition: none; transform: none; animation: none; } .tu-ag-celda { transition: none; } }
      `}</style>

      <Cabecera
        rotulo={vista === 'dia' ? fechaLarga(dia) : vista === 'semana' ? rangoSemana(lunes, diasSemana[diasSemana.length - 1]) : mesTxt(dia)}
        titulo={rubro.modo === 'cancha' ? 'Reservas' : 'Agenda'}
        acciones={<>
          <div className="tuo-seg tu-ag-seg" role="group" aria-label="Vista de la agenda">
            {VISTAS.map(([v, l]) => <button key={v} type="button" onClick={() => setVista(v)} aria-pressed={vista === v}>{l}</button>)}
          </div>
          {puedeAgendar && <button type="button" onClick={() => onNuevo({ dia: Math.max(0, dia), recursoId: recursoMovil })} className="tuo-btn tuo-btn--primario tu-ag-nuevo"><Plus size={16} /> Nuevo turno</button>}
        </>}
      />

      {/* Lo que se ve, en números + navegación de fecha */}
      <div className="tuo-entra" style={{ ['--i' as string]: 1, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => mover(-1)} aria-label={`${unidad} anterior`} className="tuo-btn tuo-btn--icono tuo-btn--sm tu-ag-nav"><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => setDia(0)} aria-pressed={hoyALaVista} className="tuo-btn tuo-btn--sm tu-ag-nav">Hoy</button>
          <button type="button" onClick={() => mover(1)} aria-label={`${unidad} siguiente`} className="tuo-btn tuo-btn--icono tuo-btn--sm tu-ag-nav"><ChevronRight size={16} /></button>
        </div>
        <span role="status" className="tuo-chip tuo-chip--primario"><b className="tuo-num">{activos.length}</b> turno{activos.length === 1 ? '' : 's'}</span>
        {cerradoHoy && <span className="tuo-chip"><MoonStar size={13} /> {DIAS[indiceDia(dia)]}: cerrado</span>}
        {sinConfirmar > 0 && <span className="tuo-chip tuo-chip--aviso"><b className="tuo-num">{sinConfirmar}</b> sin confirmar</span>}
        {vista !== 'mes' && (
          <span className="tu-ag-leyenda" style={{ marginLeft: 'auto', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {(['confirmado', 'pendiente', 'en-curso', 'ausente'] as const).map(e => (
              <span key={e} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-muted)' }}>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: ESTADO_TURNO[e].dot }} />{ESTADO_TURNO[e].label}
              </span>
            ))}
          </span>
        )}
      </div>

      {/* A quién se mira: en celular para el día, siempre para la semana; en el mes, además, a todos juntos */}
      {recursos.length > 1 && (
        <div key={vista === 'mes' ? 'mes' : 'agenda'} className={`ds-tira${vista === 'dia' ? ' tu-ag-movil' : ''}`} style={{ display: vista === 'dia' ? undefined : 'flex', gap: 8, marginBottom: 12, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {vista === 'mes' && chip('todos', filtroMes === 'todos', 'Todos', () => setEnMes('todos'))}
          {recursos.map(r => {
            const activo = vista === 'mes' ? r.id === filtroMes : r.id === recursoMovil
            return chip(r.id, activo, <><span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }} />{r.nombre}</>, () => (vista === 'mes' ? setEnMes(r.id) : setElegido(r.id)))
          })}
        </div>
      )}

      {vista === 'mes' ? (
        <div className="tuo-card tuo-entra" style={{ ['--i' as string]: 2 }}>
          <div className="tu-ag-mes-cab tuo-rotulo" aria-hidden>
            {DIAS_CORTOS.map(d => <span key={d}>{d}</span>)}
          </div>
          <div className="tu-ag-mes">
            {celdas.map(d => {
              const abierto = abre(d)
              const noAtiende = abierto && filtroMes !== 'todos' && jornada(filtroMes, d).length === 0
              const lista = delMes(d).filter(t => t.estado !== 'cancelado')
              const porQuien = recursosMes.map(r => ({ r, n: lista.filter(t => t.recursoId === r.id).length })).filter(x => x.n > 0)
              const minutos = recursosMes.reduce((s, r) => s + minutosAbiertos(jornada(r.id, d)), 0)
              const ocupacion = minutos ? Math.min(1, lista.reduce((s, t) => s + t.duracion, 0) / minutos) : 0
              const motivo = !abierto ? 'Cerrado' : noAtiende ? 'No atiende' : ''
              return (
                <button key={d} type="button" className="tu-ag-celda" data-hoy={d === 0} data-fuera={!mismoMes(d, dia)} data-cerrado={!abierto || noAtiende} data-pasado={d < 0}
                  onClick={() => { setDia(d); setVista('dia') }}
                  aria-label={`${fechaLarga(d)}: ${motivo || `${lista.length} turno${lista.length === 1 ? '' : 's'}`}. Ver el día`}>
                  <span className="tu-ag-celda-num">{fechaDe(d).getDate()}</span>
                  {motivo ? <span className="tu-ag-celda-nota">{motivo}</span> : lista.length === 0 ? <span className="tu-ag-celda-nota">Sin turnos</span> : (
                    <>
                      <span className="tu-ag-celda-total"><b>{lista.length}</b><span> turno{lista.length === 1 ? '' : 's'}</span></span>
                      {filtroMes === 'todos' && recursos.length > 1 && (
                        <span className="tu-ag-celda-quien" aria-hidden>
                          {porQuien.map(({ r, n }) => <span key={r.id} title={r.nombre}><i style={{ background: r.color }} />{n}</span>)}
                        </span>
                      )}
                      <span className="tu-ag-celda-ocup" aria-hidden><i style={{ width: `${ocupacion * 100}%` }} /></span>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div ref={grilla} className="tuo-card tuo-entra" style={{ ['--i' as string]: 2, overflow: 'auto', maxHeight: 'calc(100vh - 300px)', minHeight: 440 }}>
          <div className="tu-ag-grid" data-vista={vista} style={{ ['--tu-cols' as string]: cols.length, minWidth: 'min-content' }}>
            {/* Cabeceras */}
            <div style={{ position: 'sticky', top: 0, left: 0, zIndex: 6, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }} />
            {cols.map(c => {
              const n = c.lista.filter(t => t.estado !== 'cancelado').length
              const destacada = c.esDia && c.dia === 0
              return (
                <div key={c.key} data-recurso data-visible={vista === 'semana' || c.recursoId === recursoMovil} style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: destacada ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg))' : 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}>
                  {!c.esDia && <Sigla nombre={c.titulo} color={c.color} size={34} Icon={esPersona ? undefined : rubro.Icon} />}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: destacada ? 'var(--color-primary)' : 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.titulo}{destacada ? ' · hoy' : ''}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.sub}</div>
                  </div>
                  <span className="tuo-num" title={`${n} turnos`} style={{ minWidth: 24, height: 22, padding: '0 7px', borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600, color: c.color, background: `color-mix(in srgb, ${c.color} 14%, transparent)` }}>{n}</span>
                </div>
              )
            })}

            {/* Columna de horas */}
            <div style={{ position: 'sticky', left: 0, zIndex: 4, background: 'var(--color-bg)', borderRight: '1px solid var(--color-border)', height: y(hasta) }}>
              {horas.map(hh => {
                const actual = hoyALaVista && hh <= AHORA_DEMO && hh + 60 > AHORA_DEMO
                return <div key={hh} className="tuo-num" style={{ height: PX_HORA, fontSize: 11, color: actual ? 'var(--color-primary)' : 'var(--color-subtle)', fontWeight: actual ? 600 : 400, textAlign: 'right', padding: '5px 10px 0 0' }}>{horaTxt(hh)}</div>
              })}
              {hoyALaVista && AHORA_DEMO >= desde && AHORA_DEMO <= hasta && <span className="tuo-num" aria-hidden style={{ position: 'absolute', right: 4, top: y(AHORA_DEMO) - 10, height: 20, padding: '0 6px', borderRadius: 6, display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 600, color: '#fff', background: 'var(--tuo-grad)', boxShadow: '0 4px 12px rgba(37,99,235,0.4)' }}>{horaTxt(AHORA_DEMO)}</span>}
            </div>

            {/* Columnas */}
            {cols.map((c, ci) => {
              const hoy = c.dia === 0
              const libre = puedeAgendar && c.dia >= 0 && c.tramos.length > 0
              const cerrado = c.tramos.length === 0
              return (
              <div key={c.key} className="tu-ag-col" data-recurso data-visible={vista === 'semana' || c.recursoId === recursoMovil} data-libre={libre}
                onClick={libre ? e => agendarEn(e, c.recursoId, c.dia, c.tramos) : undefined} title={libre ? 'Tocá un horario libre para agendar' : undefined} style={{
                position: 'relative', height: y(hasta), borderRight: '1px solid var(--color-border)',
                backgroundImage: `linear-gradient(to bottom, var(--color-border) 0, var(--color-border) 1px, transparent 1px), linear-gradient(to bottom, transparent ${PX_HORA / 2}px, color-mix(in srgb, var(--color-border) 45%, transparent) ${PX_HORA / 2}px, color-mix(in srgb, var(--color-border) 45%, transparent) ${PX_HORA / 2 + 1}px, transparent ${PX_HORA / 2 + 1}px)`,
                backgroundSize: `100% ${PX_HORA}px`,
              }}>
                {/* Cuando no se atiende: antes de abrir, el corte del mediodía, después de cerrar, o el día entero */}
                {bandasCerradas(c.tramos, desde, hasta).map(b => (
                  <div key={b.a} className="tu-ag-banda" style={{ top: y(b.a), height: y(b.b) - y(b.a), alignItems: cerrado ? 'start' : undefined, paddingTop: cerrado ? 18 : undefined }}>
                    {cerrado ? <span>{!abre(c.dia) ? 'Cerrado' : esPersona ? 'No atiende este día' : 'No se usa este día'}</span>
                      : b.corte && y(b.b) - y(b.a) >= 34 ? <span>Cerrado de {horaTxt(b.a)} a {horaTxt(b.b)}</span> : null}
                  </div>
                ))}
                {/* Lo que ya pasó del día */}
                {c.dia <= 0 && <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 0, height: hoy ? Math.max(0, y(AHORA_DEMO)) : '100%', background: 'color-mix(in srgb, var(--color-surface-alt) 38%, transparent)', pointerEvents: 'none' }} />}
                {hoy && AHORA_DEMO >= desde && AHORA_DEMO <= hasta && (
                  <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: y(AHORA_DEMO) - 1, height: 2, background: 'linear-gradient(90deg, #3B82F6, #818CF8)', boxShadow: '0 0 12px rgba(59,130,246,0.7)', zIndex: 1 }}>
                    {(ci === 0 || c.esDia) && <span className="tuo-late" style={{ position: 'absolute', left: -5, top: -4, width: 10, height: 10, borderRadius: '50%', background: '#93C5FD', boxShadow: '0 0 0 3px rgba(59,130,246,0.35)' }} />}
                  </div>
                )}
                {c.lista.map((t, k) => {
                  const est = ESTADO_TURNO[t.estado]
                  const apagado = t.estado === 'cancelado' || t.estado === 'completado'
                  const alto = Math.max(24, (t.duracion / 60) * PX_HORA - 4)
                  // Turnos cortos (< ~30 min): hora y nombre en una sola línea para que no se corten.
                  const corto = alto < 50
                  const enCurso = t.estado === 'en-curso'
                  return (
                    <button key={t.id} onClick={e => { e.stopPropagation(); onAbrir(t) }} className="tu-ag-bloque" title={`${horaTxt(t.inicio)} · ${nombreCliente(t.clienteId)} · ${t.servicio} · ${est.label}`} style={{
                      ['--c' as string]: c.color, ['--i' as string]: Math.min(k + ci * 2, 14), ['--op' as string]: apagado ? 0.62 : 1,
                      position: 'absolute', left: 6, right: 6, top: y(t.inicio) + 2, height: alto, overflow: 'hidden', zIndex: 2,
                      display: 'flex', flexDirection: corto ? 'row' : 'column', alignItems: corto ? 'center' : 'flex-start', gap: corto ? 7 : 2, padding: corto ? '0 10px 0 12px' : '6px 10px 6px 12px', textAlign: 'left',
                      borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                      border: t.estado === 'pendiente' ? `1.5px dashed ${est.dot}` : `1px solid color-mix(in srgb, ${c.color} ${apagado ? 14 : 30}%, transparent)`,
                      background: `linear-gradient(135deg, color-mix(in srgb, ${c.color} ${apagado ? 7 : 18}%, var(--color-bg)), color-mix(in srgb, ${c.color} ${apagado ? 4 : 9}%, var(--color-bg)))`,
                      opacity: apagado ? 0.62 : 1,
                      boxShadow: enCurso ? `0 0 0 1.5px ${c.color}, 0 8px 24px color-mix(in srgb, ${c.color} 35%, transparent)` : undefined,
                    }}>
                      <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: c.color, opacity: apagado ? 0.5 : 1 }} />
                      <span className="tuo-num" style={{ display: 'flex', alignItems: 'center', gap: 6, width: corto ? 'auto' : '100%', flexShrink: 0, fontSize: 11, color: 'var(--color-muted)' }}>
                        {horaTxt(t.inicio)}{!corto && ` – ${horaTxt(t.inicio + t.duracion)}`}
                        {!corto && <span aria-hidden className={enCurso ? 'tuo-late' : undefined} style={{ width: 7, height: 7, borderRadius: '50%', background: est.dot, marginLeft: 'auto', flexShrink: 0 }} />}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', flex: corto ? 1 : undefined, minWidth: 0, textDecoration: t.estado === 'cancelado' ? 'line-through' : undefined }}>
                        {nombreCliente(t.clienteId)}
                      </span>
                      {corto && <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: est.dot, flexShrink: 0 }} />}
                      {alto > 58 && (
                        <span style={{ fontSize: 11.5, color: 'var(--color-body)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {t.servicio}
                          {rubro.sena > 0 && t.senaPagada && <Coins size={11} aria-label="Seña pagada" style={{ flexShrink: 0, color: 'var(--color-success)' }} />}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
