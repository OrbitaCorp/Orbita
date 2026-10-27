// Agenda por día, por semana o por mes.
//
// Día: una columna por profesional o espacio (en celular, uno a la vez, elegido
// con la tira de chips del estándar .ds-tira). Semana: los días que abre el
// negocio para quien se elija en esa misma tira. Mes: el calendario con los
// primeros turnos de cada día a la vista; tocar un día lo elige y al lado se ven
// todos sus turnos (doble clic o "Ver el día" abre la grilla de ese día).
//
// La grilla sigue el horario del negocio: va de la primera apertura al último
// cierre, y lo que queda fuera de la atención (antes de abrir, el corte del
// mediodía, el día que alguien no viene) se ve rayado y no se puede agendar ahí.
//
// La hora actual es una línea del color del acento con su hora en una etiqueta.
// Lo que ya pasó queda apenas velado, así el ojo cae solo en lo que falta del día.
//
// Las flechas mueven de a un día, una semana o un mes, y "Hoy" vuelve al día de
// la demo. Tocar un espacio libre de una columna abre "Nuevo turno" con esa
// hora y esa agenda ya elegidas.
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Coins, MoonStar } from 'lucide-react'
import { Encabezado, Sigla } from '@/design-system/reservas/piezas'
import { ESTADO_TURNO, DIAS, DIAS_CORTOS, horaTxt, type Recurso, type Cliente, type RubroTurnos } from '@/modules/turnos/datos'
import { AHORA_DEMO, diasAbiertos, extremos, minutosAbiertos, tramosDelDia, tramosFrase, type Semana, type Tramo } from '@/modules/turnos/horario'
import { IconoRecurso } from './piezasPanel'
import { fechaCorta, fechaDe, fechaLarga, grillaDelMes, indiceDia, lunesDe, mesTxt, mismoMes, moverMes, rangoSemana, type NuevoTurnoPre, type TurnoAgenda } from '../datos/agenda'

const PX_HORA = 92
type Vista = 'dia' | 'semana' | 'mes'
const VISTAS: [Vista, string][] = [['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']]

const CSS = `
  .tu-ag-barra { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
  .tu-ag-nav { display: flex; gap: 6px; }
  /* En una pastilla con fondo: la barra de la agenda queda sobre la banda del panel. */
  .tu-ag-leyenda { margin-left: auto; display: flex; gap: 14px; flex-wrap: wrap; padding: 6px 12px; border-radius: 999px; background: var(--color-bg); border: 1px solid var(--color-border); }
  .tu-ag-leyenda > span { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-muted); }
  .tu-ag-leyenda i { width: 8px; height: 8px; border-radius: 50%; }
  .tu-ag-tira { display: flex; gap: 8px; margin-bottom: 12px; overflow-x: auto; scrollbar-width: none; }
  .tu-ag-tira > .rv-chip > i { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .tu-ag-movil { display: none; }
  .tu-ag-marco { overflow: auto; max-height: calc(100vh - 300px); min-height: 440px; }
  .tu-ag-grid { display: grid; grid-template-columns: 60px repeat(var(--tu-cols), minmax(160px, 1fr)); min-width: min-content; }
  .tu-ag-cab { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: var(--color-bg); border-bottom: 1px solid var(--color-border); border-right: 1px solid var(--color-border); }
  .tu-ag-cab[data-hoy='true'] { background: var(--color-primary-bg); }
  .tu-ag-cab > div { min-width: 0; flex: 1; }
  .tu-ag-cab b { display: block; font-size: 13.5px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* Sobre primary-bg (la columna de hoy) el acento puro y el gris no llegan a AA: chip-primary-fg y body. */
  .tu-ag-cab[data-hoy='true'] b { color: var(--chip-primary-fg); }
  .tu-ag-cab small { display: block; font-size: 11.5px; color: var(--color-muted); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-ag-cab[data-hoy='true'] small { color: var(--color-body); }
  .tu-ag-cab-n { min-width: 24px; height: 22px; padding: 0 7px; border-radius: 999px; display: grid; place-items: center; font-size: 11px; font-weight: 600; color: var(--color-body); background: var(--color-surface-alt); }
  .tu-ag-horas { position: sticky; left: 0; z-index: 4; background: var(--color-bg); border-right: 1px solid var(--color-border); }
  .tu-ag-hora-rot { font-size: 11.5px; color: var(--color-muted); text-align: right; padding: 5px 10px 0 0; }
  .tu-ag-hora-rot[data-actual='true'] { color: var(--chip-primary-fg); font-weight: 600; }
  /* La etiqueta de "ahora": tinta del acento sobre el fondo, con borde (el blanco sobre el acento no llega a AA a 10,5 px). */
  .tu-ag-ahora-etq { position: absolute; right: 4px; height: 20px; padding: 0 6px; border-radius: 6px; display: grid; place-items: center; font-size: 10.5px; font-weight: 600; color: var(--chip-primary-fg); background: var(--color-bg); border: 1px solid var(--color-primary); }
  .tu-ag-col { position: relative; border-right: 1px solid var(--color-border); }
  .tu-ag-col[data-libre="true"] { cursor: cell; }
  .tu-ag-col > [aria-hidden] { pointer-events: none; }
  @media (hover: hover) { .tu-ag-col[data-libre="true"]:hover { background-color: color-mix(in srgb, var(--color-primary) 3%, transparent); } }
  /* Fuera de la atención: rayado, con su motivo si hay lugar para leerlo. */
  .tu-ag-banda { position: absolute; left: 0; right: 0; display: grid; place-items: center; overflow: hidden; cursor: default; background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-border-strong) 42%, transparent) 0 1px, transparent 1px 9px), color-mix(in srgb, var(--color-surface-alt) 50%, var(--color-bg)); }
  .tu-ag-banda > span { max-width: calc(100% - 12px); padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 500; color: var(--color-muted); background: var(--color-bg); border: 1px solid var(--color-border); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-ag-pasado { position: absolute; left: 0; right: 0; top: 0; background: color-mix(in srgb, var(--color-surface-alt) 38%, transparent); pointer-events: none; }
  .tu-ag-ahora { position: absolute; left: 0; right: 0; height: 2px; background: var(--color-primary); z-index: 1; }
  .tu-ag-ahora > i { position: absolute; left: -5px; top: -4px; width: 10px; height: 10px; border-radius: 50%; background: var(--color-primary); }
  /* Un turno en la grilla: su color a la izquierda, la hora arriba y el nombre. */
  .tu-ag-bloque { position: absolute; left: 6px; right: 6px; overflow: hidden; z-index: 2; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 6px 10px 6px 12px; text-align: left; border-radius: var(--rv-r-sm); cursor: pointer; font: inherit; border: 1px solid color-mix(in srgb, var(--c) 30%, transparent); background: color-mix(in srgb, var(--c) 14%, var(--color-bg)); }
  .tu-ag-bloque[data-corto='true'] { flex-direction: row; align-items: center; gap: 7px; padding: 0 10px 0 12px; }
  .tu-ag-bloque[data-apagado='true'] { opacity: 0.62; border-color: color-mix(in srgb, var(--c) 14%, transparent); background: color-mix(in srgb, var(--c) 6%, var(--color-bg)); }
  .tu-ag-bloque[data-pendiente='true'] { border: 1.5px dashed var(--color-warning); }
  .tu-ag-bloque[data-en-curso='true'] { box-shadow: 0 0 0 1.5px var(--c); }
  .tu-ag-bloque::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--c); }
  .tu-ag-bloque:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; z-index: 3; }
  @media (hover: hover) { .tu-ag-bloque:hover { border-color: color-mix(in srgb, var(--c) 60%, transparent); z-index: 3; } }
  .tu-ag-hora { display: flex; align-items: center; gap: 6px; width: 100%; flex-shrink: 0; font-size: 11px; color: var(--color-muted); }
  .tu-ag-bloque[data-corto='true'] .tu-ag-hora { width: auto; }
  .tu-ag-punto { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-left: auto; }
  .tu-ag-nombre { font-size: 13px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; min-width: 0; }
  .tu-ag-bloque[data-corto='true'] .tu-ag-nombre { flex: 1; }
  .tu-ag-serv { font-size: 11.5px; color: var(--color-body); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; display: flex; align-items: center; gap: 4px; }

  /* Mes: el calendario a la izquierda y, a la derecha, el día elegido con sus turnos. */
  .tu-ag-mes-wrap { display: grid; grid-template-columns: minmax(0, 1fr) 328px; gap: 16px; align-items: start; }
  .tu-ag-mes-cab, .tu-ag-mes { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
  .tu-ag-mes-cab { border-bottom: 1px solid var(--color-border); }
  .tu-ag-mes-cab > span { padding: 12px 12px 10px; text-align: right; }
  .tu-ag-mes { gap: 1px; background: var(--color-border); border-radius: 0 0 var(--rv-r) var(--rv-r); overflow: hidden; }
  .tu-ag-celda { position: relative; min-height: 128px; min-width: 0; padding: 8px 8px 12px; display: flex; flex-direction: column; align-items: stretch; gap: 3px; text-align: left; border: none; background: var(--color-bg); font: inherit; color: inherit; cursor: pointer; }
  .tu-ag-celda[data-fuera='true'] { background: var(--color-surface); }
  .tu-ag-celda[data-fuera='true'] > * { opacity: 0.45; }
  .tu-ag-celda[data-cerrado='true'] { background: color-mix(in srgb, var(--color-surface-alt) 55%, var(--color-bg)); }
  .tu-ag-celda[data-pasado='true'] .tu-ag-pill { opacity: 0.6; }
  .tu-ag-celda-cab { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 3px; }
  .tu-ag-celda-num { min-width: 26px; height: 26px; padding: 0 6px; border-radius: 999px; display: grid; place-items: center; font-family: var(--rv-mono); font-size: 13px; font-weight: 600; color: var(--color-text); font-variant-numeric: tabular-nums; margin-left: auto; order: 2; }
  /* Hoy va tintado y con anillo, no lleno: el número en blanco sobre el acento no llega a AA a 13 px. */
  .tu-ag-celda[data-hoy='true'] .tu-ag-celda-num { background: var(--color-primary-bg); color: var(--chip-primary-fg); box-shadow: inset 0 0 0 1.5px var(--color-primary); }
  .tu-ag-celda[data-sel='true'] { box-shadow: inset 0 0 0 2px var(--color-primary); background: color-mix(in srgb, var(--color-primary) 5%, var(--color-bg)); z-index: 1; }
  .tu-ag-celda-total { font-size: 11px; font-weight: 500; color: var(--color-body); white-space: nowrap; }
  .tu-ag-pill { display: flex; align-items: center; gap: 5px; min-width: 0; height: 21px; padding: 0 6px 0 0; border-radius: 6px; overflow: hidden; font-size: 11.5px; color: var(--color-text); background: color-mix(in srgb, var(--c) 13%, var(--color-bg)); }
  .tu-ag-pill::before { content: ''; align-self: stretch; width: 3px; flex-shrink: 0; background: var(--c); }
  .tu-ag-pill > b { font-family: var(--rv-mono); font-size: 10.5px; font-weight: 500; color: var(--color-body); font-variant-numeric: tabular-nums; flex-shrink: 0; }
  .tu-ag-pill > span { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
  .tu-ag-pill[data-pendiente='true'] { background: transparent; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 45%, var(--color-border)); }
  .tu-ag-celda-mas { font-size: 11px; font-weight: 600; color: var(--chip-primary-fg); padding-left: 8px; }
  .tu-ag-celda-nota { font-size: 11.5px; color: var(--color-body); }
  .tu-ag-celda-puntos { display: none; }
  .tu-ag-celda-ocup { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: transparent; overflow: hidden; }
  .tu-ag-celda-ocup > i { display: block; height: 100%; background: var(--color-primary); opacity: 0.85; }
  @media (hover: hover) { .tu-ag-celda:not([data-sel='true']):hover { background: color-mix(in srgb, var(--color-primary) 4%, var(--color-bg)); } }
  .tu-ag-celda:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; z-index: 2; }

  /* El día elegido */
  .tu-ag-diasel { position: sticky; top: 16px; display: flex; flex-direction: column; max-height: calc(100vh - 140px); overflow: hidden; }
  .tu-ag-diasel-cab { padding: 16px 16px 14px; border-bottom: 1px solid var(--color-border); }
  .tu-ag-diasel-sub { margin-top: 3px; font-size: 12.5px; color: var(--color-muted); }
  .tu-ag-diasel-acc { display: flex; gap: 8px; margin-top: 12px; }
  .tu-ag-diasel-acc > .rv-btn { flex: 1; }
  .tu-ag-diasel-lista { list-style: none; margin: 0; padding: 8px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
  .tu-ag-fila { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 52px; padding: 7px 10px 7px 0; border: none; border-radius: var(--rv-r-sm); background: none; font: inherit; color: inherit; text-align: left; cursor: pointer; overflow: hidden; }
  .tu-ag-fila::before { content: ''; align-self: stretch; width: 3px; border-radius: 3px; flex-shrink: 0; background: var(--c); }
  .tu-ag-fila-hora { width: 44px; flex-shrink: 0; font-size: 12.5px; font-weight: 600; color: var(--color-text); }
  .tu-ag-fila-txt { flex: 1; min-width: 0; }
  .tu-ag-fila-txt > b { display: block; font-size: 13.5px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-ag-fila-txt > span { display: block; font-size: 12px; color: var(--color-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-ag-fila-est { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .tu-ag-fila[data-apagado='true'] { opacity: 0.55; }
  .tu-ag-fila:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
  .tu-ag-diasel-vacio { padding: 30px 20px; text-align: center; font-size: 13px; line-height: 1.5; color: var(--color-muted); }
  .tu-ag-diasel-vacio > svg { display: block; margin: 0 auto 10px; color: var(--color-subtle); }
  @media (max-width: 1180px) {
    .tu-ag-mes-wrap { grid-template-columns: minmax(0, 1fr); }
    .tu-ag-diasel { position: static; max-height: none; }
  }

  @media (max-width: 768px) {
    .tu-ag-movil { display: flex; }
    .tu-ag-leyenda { display: none; }
    /* La tira de agendas sigue el .ds-tira-chip de Tienda, pero con 44 px de alto y la activa tintada
       (primary-bg + tinta del acento + borde) en vez de llena: el blanco sobre el acento a 13 px da 3,7:1. */
    .tu-ag-tira > .ds-tira-chip { min-height: 44px !important; }
    .tu-ag-tira > .ds-tira-chip[data-activa='true'] { background: var(--color-primary-bg) !important; border-color: var(--color-primary) !important; color: var(--chip-primary-fg) !important; }
    /* Día / Semana / Mes ocupa su propio renglón: compartiéndolo con las flechas quedaba recortado a 390. */
    .tu-ag-barra > .rv-seg { display: flex; flex: 1 1 100%; }
    .tu-ag-barra > .rv-seg > button { flex: 1; }
    /* Un turno corto (20 min) mide menos que un dedo: en celular cada bloque tiene al menos 44 px.
       Los turnos arrancan en punto o y media, así que el que sigue nunca queda tapado. */
    .tu-ag-bloque { min-height: 44px; }
    /* La semana en el celular tiene columnas de ~96 px: el nombre no entra. Ahí cada turno muestra
       la hora y su estado; el resto está en el detalle (y en el nombre accesible del botón). */
    .tu-ag-grid[data-vista="semana"] .tu-ag-bloque { flex-direction: row; align-items: center; padding: 0 8px 0 10px; }
    .tu-ag-grid[data-vista="semana"] .tu-ag-nombre, .tu-ag-grid[data-vista="semana"] .tu-ag-serv, .tu-ag-grid[data-vista="semana"] .tu-ag-fin { display: none; }
    .tu-ag-grid[data-vista="semana"] .tu-ag-hora { flex: 1 1 auto; width: auto; }
    .tu-ag-grid[data-vista="dia"] { grid-template-columns: 50px 1fr; }
    .tu-ag-grid[data-vista="dia"] [data-recurso]:not([data-visible="true"]) { display: none; }
    .tu-ag-grid[data-vista="semana"] { grid-template-columns: 44px repeat(var(--tu-cols), minmax(96px, 1fr)); }
    .tu-ag-mes-cab > span { padding: 8px 0; text-align: center; font-size: 9.5px; }
    .tu-ag-celda { min-height: 62px; padding: 6px 2px 9px; align-items: center; gap: 4px; }
    .tu-ag-celda-cab { margin: 0; }
    .tu-ag-celda-num { margin: 0; }
    .tu-ag-pill, .tu-ag-celda-mas, .tu-ag-celda-total, .tu-ag-celda-nota { display: none; }
    .tu-ag-celda-puntos { display: flex; gap: 3px; justify-content: center; flex-wrap: wrap; max-width: 34px; }
    .tu-ag-celda-puntos > i { width: 6px; height: 6px; border-radius: 50%; }
  }
`

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
  const colorDe = (recursoId: string) => recursos.find(x => x.id === recursoId)?.color ?? '#3B82F6'
  // El día elegido en el mes, con sus turnos en orden: es lo que muestra el panel de al lado.
  const delDiaSel = vista === 'mes' ? delMes(dia).sort((a, b) => a.inicio - b.inicio) : []

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
    <button key={id} type="button" onClick={onClick} aria-pressed={activo} className="rv-chip rv-chip--borde ds-tira-chip" data-activa={activo} style={{ flexShrink: 0 }}>
      {contenido}
    </button>
  )

  return (
    <div className="rv-pagina">
      <style>{CSS}</style>

      <Encabezado
        rotulo={vista === 'dia' ? fechaLarga(dia) : vista === 'semana' ? rangoSemana(lunes, diasSemana[diasSemana.length - 1]) : mesTxt(dia)}
        titulo="Agenda"
        acciones={puedeAgendar ? <button type="button" onClick={() => onNuevo({ dia: Math.max(0, dia), recursoId: recursoMovil })} className="rv-btn rv-btn--primario"><Plus size={16} /> Nuevo turno</button> : undefined}
      />

      {/* Vista, navegación de fecha y lo que se ve en números */}
      <div className="tu-ag-barra">
        <div className="rv-seg" role="group" aria-label="Vista de la agenda">
          {VISTAS.map(([v, l]) => <button key={v} type="button" onClick={() => setVista(v)} aria-pressed={vista === v}>{l}</button>)}
        </div>
        <div className="tu-ag-nav">
          <button type="button" onClick={() => mover(-1)} aria-label={`${unidad} anterior`} className="rv-btn rv-btn--icono"><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => setDia(0)} aria-pressed={hoyALaVista} className="rv-btn">Hoy</button>
          <button type="button" onClick={() => mover(1)} aria-label={`${unidad} siguiente`} className="rv-btn rv-btn--icono"><ChevronRight size={16} /></button>
        </div>
        <span role="status" className="rv-chip rv-chip--primario"><b className="rv-num">{activos.length}</b> turno{activos.length === 1 ? '' : 's'}</span>
        {cerradoHoy && <span className="rv-chip"><MoonStar size={13} /> {DIAS[indiceDia(dia)]}: cerrado</span>}
        {sinConfirmar > 0 && <span className="rv-chip rv-chip--aviso"><b className="rv-num">{sinConfirmar}</b> sin confirmar</span>}
        {vista !== 'mes' && (
          <span className="tu-ag-leyenda">
            {(['confirmado', 'pendiente', 'en-curso', 'ausente'] as const).map(e => (
              <span key={e}><i aria-hidden style={{ background: ESTADO_TURNO[e].dot }} />{ESTADO_TURNO[e].label}</span>
            ))}
          </span>
        )}
      </div>

      {/* A quién se mira: en celular para el día, siempre para la semana; en el mes, además, a todos juntos */}
      {recursos.length > 1 && (
        <div key={vista === 'mes' ? 'mes' : 'agenda'} className={`ds-tira tu-ag-tira${vista === 'dia' ? ' tu-ag-movil' : ''}`} role="group" aria-label={vista === 'mes' ? 'De quién se ve el mes' : 'Qué agenda se ve'}>
          {vista === 'mes' && chip('todos', filtroMes === 'todos', 'Todos', () => setEnMes('todos'))}
          {recursos.map(r => {
            const activo = vista === 'mes' ? r.id === filtroMes : r.id === recursoMovil
            return chip(r.id, activo, <><i aria-hidden style={{ background: r.color }} />{r.nombre}</>, () => (vista === 'mes' ? setEnMes(r.id) : setElegido(r.id)))
          })}
        </div>
      )}

      {vista === 'mes' ? (
        <div className="tu-ag-mes-wrap">
          <div className="rv-card" style={{ overflow: 'hidden' }}>
            <div className="tu-ag-mes-cab rv-rotulo" aria-hidden>
              {DIAS_CORTOS.map(d => <span key={d}>{d}</span>)}
            </div>
            <div className="tu-ag-mes">
              {celdas.map(d => {
                const abierto = abre(d)
                const noAtiende = abierto && filtroMes !== 'todos' && jornada(filtroMes, d).length === 0
                const lista = delMes(d).filter(t => t.estado !== 'cancelado').sort((x, z) => x.inicio - z.inicio)
                const minutos = recursosMes.reduce((s, r) => s + minutosAbiertos(jornada(r.id, d)), 0)
                const ocupacion = minutos ? Math.min(1, lista.reduce((s, t) => s + t.duracion, 0) / minutos) : 0
                const motivo = !abierto ? 'Cerrado' : noAtiende ? 'No atiende' : ''
                const muestra = lista.length > 3 ? lista.slice(0, 2) : lista
                return (
                  <button key={d} type="button" className="tu-ag-celda" data-hoy={d === 0} data-sel={d === dia} data-fuera={!mismoMes(d, dia)} data-cerrado={!abierto || noAtiende} data-pasado={d < 0}
                    aria-pressed={d === dia} onClick={() => setDia(d)} onDoubleClick={() => { setDia(d); setVista('dia') }}
                    aria-label={`${fechaLarga(d)}: ${motivo || `${lista.length} turno${lista.length === 1 ? '' : 's'}`}`}>
                    <span className="tu-ag-celda-cab">
                      <span className="tu-ag-celda-num">{fechaDe(d).getDate()}</span>
                      {lista.length > 0 && <span className="tu-ag-celda-total">{lista.length} turno{lista.length === 1 ? '' : 's'}</span>}
                    </span>
                    {lista.length === 0 && motivo && <span className="tu-ag-celda-nota">{motivo}</span>}
                    {muestra.map(t => (
                      <span key={t.id} className="tu-ag-pill" data-pendiente={t.estado === 'pendiente'} style={{ ['--c' as string]: colorDe(t.recursoId) }}>
                        <b>{horaTxt(t.inicio)}</b><span>{nombreCliente(t.clienteId).split(' ')[0]}</span>
                      </span>
                    ))}
                    {lista.length > muestra.length && <span className="tu-ag-celda-mas">+{lista.length - muestra.length} más</span>}
                    <span className="tu-ag-celda-puntos" aria-hidden>
                      {lista.slice(0, 4).map(t => <i key={t.id} style={{ background: colorDe(t.recursoId) }} />)}
                    </span>
                    {ocupacion > 0 && <span className="tu-ag-celda-ocup" aria-hidden><i style={{ width: `${ocupacion * 100}%` }} /></span>}
                  </button>
                )
              })}
            </div>
          </div>

          <aside className="rv-card tu-ag-diasel" aria-label={`Turnos del ${fechaLarga(dia)}`}>
            <div className="tu-ag-diasel-cab">
              <div className="rv-h2">{fechaLarga(dia)}{dia === 0 ? ' · hoy' : ''}</div>
              <div className="tu-ag-diasel-sub">
                {!abre(dia) ? 'El negocio está cerrado' : `${delDiaSel.length} turno${delDiaSel.length === 1 ? '' : 's'}${filtroMes !== 'todos' ? ` de ${recursosMes[0]?.nombre ?? ''}` : ''} · abre ${tramosFrase(tramosDelDia(semana, indiceDia(dia)))}`}
              </div>
              <div className="tu-ag-diasel-acc">
                <button type="button" className="rv-btn rv-btn--sm" onClick={() => setVista('dia')}><CalendarDays size={14} /> Ver el día</button>
                {puedeAgendar && dia >= 0 && abre(dia) && <button type="button" className="rv-btn rv-btn--sm rv-btn--primario" onClick={() => onNuevo({ dia, recursoId: filtroMes !== 'todos' ? filtroMes : undefined })}><Plus size={14} /> Nuevo turno</button>}
              </div>
            </div>
            {delDiaSel.length === 0 ? (
              <div className="tu-ag-diasel-vacio">
                {abre(dia) ? <CalendarDays size={26} strokeWidth={1.5} aria-hidden /> : <MoonStar size={26} strokeWidth={1.5} aria-hidden />}
                {!abre(dia) ? `Los ${DIAS[indiceDia(dia)].toLowerCase()} no se atiende.` : dia < 0 ? 'Ese día no hubo turnos.' : 'Todavía no hay turnos para este día.'}
              </div>
            ) : (
              <ul className="tu-ag-diasel-lista">
                {delDiaSel.map(t => (
                  <li key={t.id}>
                    <button type="button" className="ds-hover tu-ag-fila" data-apagado={t.estado === 'cancelado' || t.estado === 'completado'} style={{ ['--c' as string]: colorDe(t.recursoId) }} onClick={() => onAbrir(t)}>
                      <span className="tu-ag-fila-hora rv-num">{horaTxt(t.inicio)}</span>
                      <span className="tu-ag-fila-txt">
                        <b style={{ textDecoration: t.estado === 'cancelado' ? 'line-through' : undefined }}>{nombreCliente(t.clienteId)}</b>
                        <span>{t.servicio}{recursos.length > 1 && filtroMes === 'todos' ? ` · ${recursos.find(x => x.id === t.recursoId)?.nombre.split(' ')[0] ?? ''}` : ''}</span>
                      </span>
                      <span className="tu-ag-fila-est" title={ESTADO_TURNO[t.estado].label} aria-label={ESTADO_TURNO[t.estado].label} role="img" style={{ background: ESTADO_TURNO[t.estado].dot }} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      ) : (
        <div ref={grilla} className="rv-card tu-ag-marco">
          <div className="tu-ag-grid" data-vista={vista} style={{ ['--tu-cols' as string]: cols.length }}>
            {/* Cabeceras */}
            <div style={{ position: 'sticky', top: 0, left: 0, zIndex: 6, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }} />
            {cols.map(c => {
              const n = c.lista.filter(t => t.estado !== 'cancelado').length
              const destacada = c.esDia && c.dia === 0
              return (
                <div key={c.key} data-recurso data-visible={vista === 'semana' || c.recursoId === recursoMovil} className="tu-ag-cab" data-hoy={destacada}>
                  {!c.esDia && (esPersona ? <Sigla nombre={c.titulo} color={c.color} size={34} /> : <IconoRecurso color={c.color} Icon={rubro.Icon} size={34} />)}
                  <div>
                    <b>{c.titulo}{destacada ? ' · hoy' : ''}</b>
                    <small>{c.sub}</small>
                  </div>
                  <span className="tu-ag-cab-n rv-num" title={`${n} turnos`}>{n}</span>
                </div>
              )
            })}

            {/* Columna de horas */}
            <div className="tu-ag-horas" style={{ height: y(hasta) }}>
              {horas.map(hh => {
                const actual = hoyALaVista && hh <= AHORA_DEMO && hh + 60 > AHORA_DEMO
                return <div key={hh} className="rv-num tu-ag-hora-rot" data-actual={actual} style={{ height: PX_HORA }}>{horaTxt(hh)}</div>
              })}
              {hoyALaVista && AHORA_DEMO >= desde && AHORA_DEMO <= hasta && <span className="rv-num tu-ag-ahora-etq" aria-hidden style={{ top: y(AHORA_DEMO) - 10 }}>{horaTxt(AHORA_DEMO)}</span>}
            </div>

            {/* Columnas */}
            {cols.map((c, ci) => {
              const hoy = c.dia === 0
              const libre = puedeAgendar && c.dia >= 0 && c.tramos.length > 0
              const cerrado = c.tramos.length === 0
              return (
              <div key={c.key} className="tu-ag-col" data-recurso data-visible={vista === 'semana' || c.recursoId === recursoMovil} data-libre={libre}
                onClick={libre ? e => agendarEn(e, c.recursoId, c.dia, c.tramos) : undefined} title={libre ? 'Tocá un horario libre para agendar' : undefined} style={{
                height: y(hasta),
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
                {c.dia <= 0 && <div aria-hidden className="tu-ag-pasado" style={{ height: hoy ? Math.max(0, y(AHORA_DEMO)) : '100%' }} />}
                {hoy && AHORA_DEMO >= desde && AHORA_DEMO <= hasta && (
                  <div aria-hidden className="tu-ag-ahora" style={{ top: y(AHORA_DEMO) - 1 }}>
                    {(ci === 0 || c.esDia) && <i />}
                  </div>
                )}
                {c.lista.map(t => {
                  const est = ESTADO_TURNO[t.estado]
                  const apagado = t.estado === 'cancelado' || t.estado === 'completado'
                  const alto = Math.max(24, (t.duracion / 60) * PX_HORA - 4)
                  // Turnos cortos (< ~30 min): hora y nombre en una sola línea para que no se corten.
                  const corto = alto < 50
                  return (
                    <button key={t.id} type="button" onClick={e => { e.stopPropagation(); onAbrir(t) }} className="tu-ag-bloque" data-corto={corto} data-apagado={apagado} data-pendiente={t.estado === 'pendiente'} data-en-curso={t.estado === 'en-curso'}
                      title={`${horaTxt(t.inicio)} · ${nombreCliente(t.clienteId)} · ${t.servicio} · ${est.label}`} aria-label={`${horaTxt(t.inicio)}, ${nombreCliente(t.clienteId)}, ${t.servicio}, ${est.label}`}
                      style={{ ['--c' as string]: c.color, top: y(t.inicio) + 2, height: alto }}>
                      <span className="rv-num tu-ag-hora">
                        {horaTxt(t.inicio)}{!corto && <span className="tu-ag-fin">{` – ${horaTxt(t.inicio + t.duracion)}`}</span>}
                        {!corto && <span aria-hidden className="tu-ag-punto" style={{ background: est.dot }} />}
                      </span>
                      <span className="tu-ag-nombre" style={{ textDecoration: t.estado === 'cancelado' ? 'line-through' : undefined }}>{nombreCliente(t.clienteId)}</span>
                      {corto && <span aria-hidden className="tu-ag-punto" style={{ background: est.dot, marginLeft: 0 }} />}
                      {alto > 58 && (
                        <span className="tu-ag-serv">
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
