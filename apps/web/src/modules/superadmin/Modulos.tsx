import {
  useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, type KeyboardEvent as TeclaEvent,
} from 'react'
import { useRouter } from 'next/router'
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, CircleDashed, Clock, FilePlus2, Folder, Laptop, Plus, Share2, Undo2, X,
} from 'lucide-react'
import { Chip, Empty, ErrorBox, PageHeader, btnGhost, btnPrimary, inputStyle } from './ui'
import { MarkdownInforme, MD_CSS, srcSeguro } from './MarkdownInforme'
import { CICLO, PERSONAS, PLANES, type ConPlan, type Persona, type PlanModulo, type Tarea } from './modulos/plan'
import { AVISO_SESION, ENTRADAS, type Entrada, type TipoEntrada } from './modulos/entradas'
import { DECISIONES } from './modulos/decisiones'
import { CARPETAS_COMPARTIDAS, REGLAS_COMPARTIDO } from './modulos/compartido'
import { accionesModulos, idTarea, useEstadoModulos, type EstadoModulos, type Horizonte } from './modulos/estado'

// Módulos (super admin → Interno → Módulos): el plan de trabajo de los módulos
// nuevos (Turnos, Gimnasio y Alquileres), su auditoría y sus decisiones.
//
// Solo visual, sin API (pedido de Ale, 26/10/2026): los datos son archivos de
// la web, en ./modulos/ (plan.ts, entradas.ts y decisiones.ts), y lo que cada
// uno tilda, confirma o carga, y el horizonte elegido, queda en su navegador
// (estado.ts). La pantalla lo avisa: "Se guarda en este navegador".
//
// Reglas:
//   - Una tarea se tilda solo con su entrada de auditoría.
//   - Una entrada generada en sesión queda "Pendiente de confirmación" hasta
//     que la confirma su responsable, y confirmarla tilda las tareas que
//     documenta: es el mismo "lo hice yo", no hay que decirlo dos veces. Una
//     entrada con `confirmada` en el código está confirmada para todos.
//   - Una decisión abierta (decisiones.ts) no se confirma: la decide quien
//     figura, y entonces pasa a entradas.ts como decisión tomada.
//   - En 1 mes las tareas se reubican por `semana1m` y las que quedan afuera
//     van a "Queda para el próximo ciclo"; lo hecho no se pierde al cambiar.
//   - El estado de cada semana (pendiente, en curso, hecha, atrasada) sale de
//     sus tareas; no se guarda en ningún lado.
//
// Vive en la URL como el resto del superadmin:
// ?seccion=modulos&modulo=gimnasio&vista=auditoria.

type Slug = 'tienda' | ConPlan
type Vista = 'plan' | 'auditoria' | 'resumen'
type EstadoTarea = 'hecha' | 'por-confirmar' | 'pendiente'

export interface DefModulo { slug: Slug; nombre: string; persona: Persona | null }

// El orden de las tarjetas. Tienda no tiene plan: ya está en producción.
const MODULOS: DefModulo[] = [
  { slug: 'tienda', nombre: 'Tienda', persona: null },
  { slug: 'turnos', nombre: 'Turnos', persona: 'Mateo' },
  { slug: 'gimnasio', nombre: 'Gimnasio', persona: 'Ale' },
  { slug: 'alquileres', nombre: 'Alquileres', persona: 'Alan' },
]
const esConPlan = (v: unknown): v is ConPlan => v === 'turnos' || v === 'gimnasio' || v === 'alquileres'

const VISTAS: { id: Vista; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'auditoria', label: 'Auditoría' },
  { id: 'resumen', label: 'Resumen' },
]

// El tipo de cada entrada. Las decisiones son las tomadas (entradas.ts) y las
// abiertas (decisiones.ts): las dos van en el mismo filtro.
const TIPOS: { id: TipoEntrada; label: string; filtro: string }[] = [
  { id: 'tarea', label: 'Tarea', filtro: 'Tarea hecha' },
  { id: 'diseño', label: 'Diseño', filtro: 'Cambio de diseño' },
  { id: 'decisión', label: 'Decisión', filtro: 'Decisión' },
]

// ─── Fechas (ISO AAAA-MM-DD, siempre en UTC para no correrse un día) ─────────

const DIA_MS = 86_400_000
const RE_ISO = /^\d{4}-\d{2}-\d{2}$/
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

function aUtc(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}
function sumarDias(iso: string, n: number): string {
  return new Date(aUtc(iso) + n * DIA_MS).toISOString().slice(0, 10)
}
function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / DIA_MS)
}
// Lunes = 0 … domingo = 6. El 1/1/1970 fue jueves.
function indiceDia(iso: string): number {
  return (Math.floor(aUtc(iso) / DIA_MS) + 3) % 7
}
const lunesDe = (inicio: string, semana: number) => sumarDias(inicio, (semana - 1) * 7)
const corta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const larga = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const conDia = (iso: string) => `${DIAS_LARGOS[indiceDia(iso)]} ${larga(iso)}`

// "Hoy" en el navegador. Sale de un store externo y no de un new Date() en el
// render: en el servidor no hay hoy (null → "…" hasta hidratar) y la regla de
// pureza del React Compiler no se rompe. Se vuelve a mirar cada minuto, así
// una pestaña que queda abierta de un día para otro se pone al día sola.
function hoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function suscribirHoy(avisar: () => void) {
  const id = window.setInterval(avisar, 60_000)
  return () => window.clearInterval(id)
}
const hoyServidor = () => null

// El aviso con que nace toda entrada generada en sesión (AVISO_SESION, en
// entradas.ts). Es texto fijo del informe: una vez confirmada la entrada,
// "pendiente de confirmación" ya no es cierto.
const AVISO_CONFIRMADA = '> **Generada en sesión y confirmada por el responsable.**'
export function informeVisible(informe: string, confirmada: boolean): string {
  return confirmada ? informe.replace(AVISO_SESION, AVISO_CONFIRMADA) : informe
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// ─── Modelo derivado de un módulo ─────────────────────────────────────────────

// Todas las entradas: las del código (entradas.ts y decisiones.ts) y las
// cargadas en este navegador. Si una cargada acá repite la key de una del
// código, vale la del código.
export function todasLasEntradas(estado: EstadoModulos): Entrada[] {
  const delCodigo = [...ENTRADAS, ...DECISIONES]
  const keys = new Set(delCodigo.map((e) => e.key))
  return [...delCodigo, ...estado.nuevas.filter((e) => !keys.has(e.key))]
}

// Confirmada para todos (en el código) o en este navegador; null = pendiente.
export interface Confirmacion { dia: string; local: boolean }
export function confirmacionDe(e: Entrada, estado: EstadoModulos): Confirmacion | null {
  if (e.abierta) return null
  if (e.confirmada) return { dia: e.confirmada, local: false }
  const dia = estado.confirmadas[e.key]
  return dia ? { dia, local: true } : null
}

export interface DatosModulos { planes: PlanModulo[]; entradas: Entrada[]; estado: EstadoModulos }

interface TareaVista {
  // La tarea con su `auditoria` resuelta: la del plan o la vinculada en este navegador.
  tarea: Tarea
  hecha: boolean
  // Hecha para todos: su entrada está confirmada en el código.
  fija: boolean
  // Fecha y semana en el horizonte elegido; null = fuera del ciclo de 1 mes.
  dia: string | null
  semana: number | null
  entrada: Entrada | null
  // Su entrada ya está confirmada (en el código o en este navegador).
  confirmada: boolean
  estado: EstadoTarea
  atraso: number
}

interface Semana { n: number; titulo: string; desde: string; hasta: string; tareas: TareaVista[]; comprimidas: number[] }

interface Modulo {
  def: DefModulo
  plan: PlanModulo | null
  horizonte: Horizonte
  fin: string
  semanas: Semana[]
  // Las tareas que entran en el horizonte elegido, y todas (con las de afuera).
  tareas: TareaVista[]
  todas: TareaVista[]
  fuera: TareaVista[]
  entradas: Entrada[]
  abiertas: Entrada[]
  hechas: number
  porConfirmar: number
  atrasadas: TareaVista[]
  diasAtraso: number
}

function vistaDeTarea(base: Tarea, modulo: ConPlan, horizonte: Horizonte, porKey: Map<string, Entrada>, estado: EstadoModulos, hoy: string | null): TareaVista {
  const auditoria = base.auditoria ?? estado.vinculos[idTarea(modulo, base.id)]
  const tarea = auditoria ? { ...base, auditoria } : base
  // Una decisión abierta no documenta tareas: si alguna apuntara a una, no cuenta.
  const encontrada = auditoria ? (porKey.get(auditoria) ?? null) : null
  const entrada = encontrada && !encontrada.abierta ? encontrada : null
  const fija = !!entrada?.confirmada
  const hecha = fija || estado.tildadas[idTarea(modulo, base.id)] === true
  const confirmada = !!entrada && (!!entrada.confirmada || !!estado.confirmadas[entrada.key])
  const est: EstadoTarea = hecha ? 'hecha' : entrada ? 'por-confirmar' : 'pendiente'
  let dia: string | null = base.dia
  let semana: number | null = base.semana
  if (horizonte === '1m') {
    // En 1 mes la tarea va a su semana1m, el mismo día de la semana.
    semana = base.semana1m
    dia = semana === null ? null : sumarDias(lunesDe(CICLO.lunes, semana), indiceDia(base.dia))
  }
  // Atrasada = sin hacer ni documentar y con la fecha ya pasada. Lo
  // documentado en sesión ya está hecho: le falta la firma, no el trabajo.
  const atraso = est === 'pendiente' && dia && hoy && dia < hoy ? diasEntre(dia, hoy) : 0
  return { tarea, hecha, fija, dia, semana, entrada, confirmada, estado: est, atraso }
}

export function armarModulo(def: DefModulo, datos: DatosModulos, hoy: string | null): Modulo {
  const plan = datos.planes.find((p) => p.modulo === def.slug) ?? null
  const horizonte: Horizonte = plan ? (datos.estado.horizonte[plan.modulo] ?? '2m') : '2m'
  const fin = horizonte === '1m' ? CICLO.fin1m : CICLO.fin2m
  const porKey = new Map(datos.entradas.map((e) => [e.key, e]))
  const entradas = datos.entradas
    .filter((e) => e.modulo === def.slug)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.titulo.localeCompare(b.titulo))
  const todas = plan ? plan.tareas.map((t) => vistaDeTarea(t, plan.modulo, horizonte, porKey, datos.estado, hoy)) : []
  const tareas = todas.filter((t) => t.semana !== null)
  const cantidad = Math.max(1, Math.ceil((diasEntre(CICLO.lunes, fin) + 1) / 7))
  const titulos = plan ? (horizonte === '1m' ? plan.semanas1m : plan.semanas) : []
  const semanas: Semana[] = []
  for (let n = 1; n <= cantidad; n++) {
    const desde = lunesDe(CICLO.lunes, n)
    const deLaSemana = tareas
      .filter((t) => t.semana === n)
      .sort((a, b) => (a.dia ?? '').localeCompare(b.dia ?? '') || a.tarea.dia.localeCompare(b.tarea.dia))
    const comprimidas = Array.from(new Set(deLaSemana.map((t) => t.tarea.semana).filter((s) => s !== n))).sort((a, b) => a - b)
    semanas.push({ n, titulo: titulos[n - 1]?.trim() || `Semana ${n}`, desde, hasta: sumarDias(desde, 4), tareas: deLaSemana, comprimidas })
  }
  const atrasadas = tareas.filter((t) => t.atraso > 0).sort((a, b) => b.atraso - a.atraso)
  return {
    def, plan, horizonte, fin, semanas, tareas, todas, entradas, atrasadas,
    fuera: todas.filter((t) => t.semana === null),
    abiertas: entradas.filter((e) => e.abierta),
    hechas: tareas.filter((t) => t.estado === 'hecha').length,
    porConfirmar: tareas.filter((t) => t.estado === 'por-confirmar').length,
    diasAtraso: atrasadas[0]?.atraso ?? 0,
  }
}

type EstadoSemana = 'hecha' | 'atrasada' | 'en-curso' | 'pendiente'
// El primer día visible de una semana: la primera del ciclo arranca un jueves
// (CICLO.inicio) aunque se cuente desde su lunes.
const primerDia = (s: Semana) => (s.desde < CICLO.inicio ? CICLO.inicio : s.desde)
export function estadoSemana(s: Semana, hoy: string | null): EstadoSemana {
  if (s.tareas.length > 0 && s.tareas.every((t) => t.estado === 'hecha')) return 'hecha'
  if (s.tareas.some((t) => t.atraso > 0)) return 'atrasada'
  if (s.tareas.some((t) => t.estado !== 'pendiente') || (hoy !== null && hoy >= primerDia(s) && hoy <= s.hasta)) return 'en-curso'
  return 'pendiente'
}
const ESTADO_SEMANA: Record<EstadoSemana, { label: string; tone: 'green' | 'amber' | 'blue' | 'gray' }> = {
  hecha: { label: 'Hecha', tone: 'green' },
  atrasada: { label: 'Atrasada', tone: 'amber' },
  'en-curso': { label: 'En curso', tone: 'blue' },
  pendiente: { label: 'Pendiente', tone: 'gray' },
}

// La próxima semana con algo sin hacer que todavía no terminó.
export function proximoHito(m: Modulo, hoy: string | null): Semana | null {
  const abiertas = m.semanas.filter((s) => s.tareas.some((t) => t.estado !== 'hecha'))
  return abiertas.find((s) => hoy === null || s.hasta >= hoy) ?? abiertas[0] ?? null
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

// Un solo bloque para toda la sección: grilla 4 → 2 → 1, tareas como lista
// (nunca tabla) y la hoja de nueva entrada que en celular sale de abajo.
// Todo lo que se toca mide 44 px.
const CSS = `
  .mo-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
  @media (max-width: 1024px) { .mo-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 640px) { .mo-grid { grid-template-columns: minmax(0, 1fr); } }
  .mo-card { display: flex; flex-direction: column; gap: 12px; width: 100%; min-width: 0; text-align: left; padding: 16px; border-radius: 14px; border: 1px solid var(--color-border); background: var(--color-bg); box-shadow: var(--shadow-card); font: inherit; color: var(--color-body); }
  /* Tarjeta que abre el módulo: el botón es el nombre y su ::after cubre toda
     la tarjeta (un <button> no puede envolver bloques, y así el lector de
     pantalla lee el contenido en vez de un "Abrir Turnos" sin más). */
  .mo-card-clic { position: relative; }
  .mo-card-abrir { all: unset; cursor: pointer; }
  .mo-card-abrir::after { content: ''; position: absolute; inset: 0; border-radius: 14px; }
  /* En celular el botón (el nombre) mide lo que su texto, aunque el toque valga en toda la
     tarjeta: se le da el alto de un toque para que también lo sea a ojo y para el teclado. */
  @media (max-width: 768px) { .mo-card-abrir { display: inline-flex; align-items: center; min-height: 44px; } }
  .mo-card-clic:has(.mo-card-abrir:focus-visible) { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  @media (hover: hover) { .mo-card-clic:hover { border-color: var(--color-border-strong); } }
  .mo-rotulo { font-size: 12px; font-weight: 600; color: var(--color-muted); }
  .mo-datos { display: flex; flex-direction: column; gap: 4px; font-size: 13px; line-height: 1.45; }
  /* Etiqueta neutra: el Chip gris (muted sobre surface-alt) queda en 4,3:1 y
     no llega a AA con texto de 12 px. */
  .mo-etiqueta { display: inline-flex; align-items: center; height: 24px; padding: 0 9px; border-radius: 999px; background: var(--color-surface-alt); color: var(--color-body); font-size: 12px; font-weight: 600; white-space: nowrap; }
  .mo-barra { height: 6px; border-radius: 999px; background: var(--color-primary-bg); overflow: hidden; }
  .mo-barra > span { display: block; height: 100%; border-radius: 999px; background: var(--color-primary); transition: width 250ms ease; }
  .mo-barra[data-tono="atraso"] { background: var(--color-warning-bg); }
  .mo-barra[data-tono="atraso"] > span { background: var(--chip-warning-fg); }
  .mo-semaforo { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; }
  .mo-boton { min-height: 44px; height: auto !important; }
  .mo-volver { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px 0 8px; margin-left: -8px; border: none; border-radius: 10px; background: transparent; color: var(--color-body); font: inherit; font-size: 14px; font-weight: 600; }
  /* El aviso de que todo queda en este navegador: chico, en muted sobre el
     fondo (4,7:1), sin tapar nada. */
  .mo-guardado { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--color-muted); }
  .mo-guardado > svg { flex-shrink: 0; }
  .mo-seg { display: inline-flex; border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; background: var(--color-bg); }
  .mo-seg button { min-height: 44px; padding: 0 16px; border: none; background: transparent; color: var(--color-body); font: inherit; font-size: 13.5px; font-weight: 600; }
  .mo-seg button + button { border-left: 1px solid var(--color-border); }
  .mo-seg button[aria-checked="true"] { background: var(--color-primary-bg); color: var(--chip-primary-fg); }
  .mo-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--color-border); }
  .mo-tab { min-height: 44px; padding: 0 14px; border: none; border-bottom: 2px solid transparent; margin-bottom: -1px; background: transparent; color: var(--color-muted); font: inherit; font-size: 14px; font-weight: 600; white-space: nowrap; border-radius: 8px 8px 0 0; }
  /* Texto en chip-primary-fg y no en primary: el azul de marca sobre blanco
     queda en 3,7:1, abajo de AA para 14 px. El subrayado sí va en primary. */
  .mo-tab[aria-selected="true"] { color: var(--chip-primary-fg); border-bottom-color: var(--color-primary); }
  .mo-panel:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 4px; border-radius: 8px; }
  .mo-semana-cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; padding: 14px 16px; border-bottom: 1px solid var(--color-border); }
  .mo-dia { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 4px 12px; padding: 10px 16px; border-top: 1px solid var(--color-border); }
  .mo-dia:first-child { border-top: none; }
  .mo-dia-nombre { font-size: 12.5px; font-weight: 700; color: var(--color-text); padding-top: 12px; }
  .mo-dia-nombre span { display: block; font-weight: 500; color: var(--color-muted); }
  .mo-tarea { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 2px 8px; align-items: start; padding: 2px 0; }
  .mo-tarea + .mo-tarea { border-top: 1px dashed var(--color-border); padding-top: 8px; margin-top: 4px; }
  .mo-check { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 10px; }
  .mo-check input { width: 20px; height: 20px; margin: 0; accent-color: var(--color-primary); cursor: pointer; }
  .mo-check input:disabled { cursor: not-allowed; }
  .mo-check input:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .mo-tarea-texto { padding-top: 11px; min-width: 0; }
  .mo-tarea-acc { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; padding-top: 4px; }
  .mo-estado { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; }
  .mo-filtros { display: flex; gap: 8px; flex-wrap: wrap; }
  .mo-filtro { min-height: 44px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-body); font: inherit; font-size: 13px; font-weight: 600; }
  .mo-filtro[aria-pressed="true"] { background: var(--color-primary-bg); color: var(--chip-primary-fg); border-color: transparent; }
  .mo-entrada-cab { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px 16px; padding: 16px; }
  .mo-entrada-acc { display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap; justify-content: flex-end; }
  .mo-entrada-cuerpo { border-top: 1px solid var(--color-border); padding: 16px; }
  .mo-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .mo-kpi { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 14px; padding: 14px 16px; box-shadow: var(--shadow-card); min-width: 0; }
  .mo-kpi-valor { font-size: 24px; font-weight: 700; color: var(--color-text); letter-spacing: -0.02em; margin-top: 4px; overflow-wrap: anywhere; }
  .mo-fila-lista { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; padding: 12px 16px; border-top: 1px solid var(--color-border); align-items: center; }
  .mo-fila-lista:first-child { border-top: none; }
  .mo-hoja-fondo { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 16px; background: rgba(15,23,42,0.45); }
  .mo-hoja { width: min(580px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; overscroll-behavior: contain; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 16px; box-shadow: var(--shadow-card-hover); }
  .mo-hoja-cab { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 12px 12px 20px; background: var(--color-bg); border-bottom: 1px solid var(--color-border); }
  .mo-hoja-pie { position: sticky; bottom: 0; display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; background: var(--color-bg); border-top: 1px solid var(--color-border); }
  .mo-campo { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--color-text); }
  .mo-campo-ayuda { font-size: 12px; font-weight: 400; color: var(--color-muted); line-height: 1.45; }
  .mo-dos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  /* En oscuro los controles nativos traían su paleta clara: la casilla era un
     cuadro blanco y el ícono del calendario no se veía. */
  .dark .mo-check input, .dark .mo-hoja input, .dark .mo-hoja select, .dark .mo-hoja textarea { color-scheme: dark; }
  @media (max-width: 960px) { .mo-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  /* Táctil: los campos de la hoja también miden 44 px (inputStyle trae 40 inline). */
  @media (max-width: 768px) { .mo-hoja input.ds-field, .mo-hoja select.ds-field { height: 44px !important; } }
  @media (max-width: 640px) {
    .mo-dia { grid-template-columns: minmax(0, 1fr); padding: 10px 12px; }
    .mo-dia-nombre { padding-top: 2px; }
    .mo-dia-nombre span { display: inline; margin-left: 6px; }
    .mo-tarea { grid-template-columns: 44px minmax(0, 1fr); }
    .mo-tarea-acc { grid-column: 2; justify-content: flex-start; padding-top: 0; }
    .mo-semana-cab { padding: 12px; }
    .mo-entrada-cab { grid-template-columns: minmax(0, 1fr); padding: 14px 12px; }
    .mo-entrada-acc { justify-content: flex-start; }
    .mo-entrada-cuerpo { padding: 14px 12px; }
    .mo-fila-lista { padding: 12px; }
    .mo-dos { grid-template-columns: minmax(0, 1fr); }
    .mo-hoja-fondo { place-items: end stretch; padding: 0; }
    .mo-hoja { width: 100%; max-height: 92vh; max-height: 92dvh; border-radius: 16px 16px 0 0; border-bottom: none; }
    .mo-hoja-pie { padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); }
    .mo-hoja-pie > button { flex: 1; }
  }
  /* Lo compartido entre los tres módulos (<Compartido>): una tarjeta con la
     cabecera siempre a la vista y el cuerpo plegable. El ámbar es el mismo de
     los avisos: "ojo, esto les cambia a los tres". */
  .mo-compartido { gap: 0; padding: 0; overflow: hidden; }
  .mo-compartido-cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px 16px; flex-wrap: wrap; padding: 16px; }
  .mo-compartido-ver { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-bg); color: var(--color-body); font: inherit; font-size: 13px; font-weight: 600; white-space: nowrap; flex-shrink: 0; }
  .mo-compartido-ver > svg { transition: transform 200ms ease; }
  .mo-compartido-ver[aria-expanded="true"] > svg { transform: rotate(180deg); }
  .mo-compartido-cuerpo { display: grid; gap: 16px; padding: 16px; border-top: 1px solid var(--color-border); }
  /* list-style explícito: el preflight de Tailwind deja las listas sin marcador. */
  .mo-compartido-reglas { margin: 0; padding: 0 0 0 22px; display: grid; gap: 8px; list-style: decimal; font-size: 13.5px; line-height: 1.5; color: var(--color-body); }
  .mo-compartido-reglas li::marker { font-weight: 700; color: var(--chip-warning-fg); }
  .mo-compartido-lista { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .mo-compartido-item { display: grid; gap: 8px; align-content: start; min-width: 0; padding: 14px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface-alt); font-size: 13px; line-height: 1.5; color: var(--color-body); }
  .mo-compartido-ruta { display: flex; align-items: center; gap: 6px; min-width: 0; color: var(--color-text); }
  .mo-compartido-ruta > svg { flex-shrink: 0; color: var(--chip-warning-fg); }
  .mo-compartido-item code { font-family: ui-monospace, "Geist Mono", monospace; font-size: 12px; padding: 1px 6px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); color: var(--color-text); overflow-wrap: anywhere; }
  .mo-compartido-item dl { margin: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 10px; }
  .mo-compartido-item dt { font-size: 12.5px; font-weight: 600; color: var(--color-muted); }
  .mo-compartido-item dd { margin: 0; min-width: 0; }
  @media (max-width: 960px) { .mo-compartido-lista { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 640px) {
    .mo-compartido-cab, .mo-compartido-cuerpo { padding: 14px 12px; }
    .mo-compartido-ver { width: 100%; justify-content: center; }
    .mo-compartido-item dl { grid-template-columns: minmax(0, 1fr); gap: 2px; }
    .mo-compartido-item dd + dt { margin-top: 6px; }
  }
  @media (prefers-reduced-motion: reduce) { .mo-barra > span { transition: none; } .mo-compartido-ver > svg { transition: none; } }
`

// ─── Pestaña ──────────────────────────────────────────────────────────────────

interface Guardar { tarea: Tarea | null; entrada: Entrada }

export function TabModulos() {
  const router = useRouter()
  const hoy = useSyncExternalStore(suscribirHoy, hoyLocal, hoyServidor)
  const estado = useEstadoModulos()
  const entradas = todasLasEntradas(estado)
  const modulos = MODULOS.map((def) => armarModulo(def, { planes: PLANES, entradas, estado }, hoy))

  const abierto = esConPlan(router.query.modulo) ? router.query.modulo : null
  const vista: Vista = router.query.vista === 'auditoria' || router.query.vista === 'resumen' ? router.query.vista : 'plan'
  const ir = (modulo: ConPlan | null, v: Vista = 'plan') => {
    const q = modulo ? `&modulo=${modulo}${v !== 'plan' ? `&vista=${v}` : ''}` : ''
    void router.push(`/superadmin?seccion=modulos${q}`, undefined, { shallow: true })
  }

  // Al volver a la lista (con "Volver a Módulos" o con Atrás) el foco va a la
  // tarjeta del módulo de donde se venía: si no, caía en <body> y con teclado
  // o lector de pantalla había que arrancar de nuevo desde arriba.
  const anteriorRef = useRef<ConPlan | null>(null)
  useEffect(() => {
    if (!abierto && anteriorRef.current) document.getElementById(`mo-abrir-${anteriorRef.current}`)?.focus()
    anteriorRef.current = abierto
  }, [abierto])

  // Confirmar una entrada tilda las tareas que documenta, en cualquier plan.
  const confirmar = (e: Entrada) => {
    const tareas = modulos.flatMap((m) => m.todas.filter((t) => t.tarea.auditoria === e.key).map((t) => ({ modulo: m.def.slug as ConPlan, id: t.tarea.id })))
    accionesModulos.confirmar(e.key, hoy ?? hoyLocal(), tareas)
  }
  const tildar = (modulo: ConPlan, t: TareaVista, hecha: boolean) => {
    // Tildar una tarea cuya entrada sigue pendiente es confirmarla: se hace
    // por la entrada, que tilda la tarea de paso.
    if (hecha && t.entrada && !t.confirmada) return confirmar(t.entrada)
    accionesModulos.tildar(modulo, t.tarea.id, hecha)
  }
  // Alta desde la hoja: la entrada nace pendiente, como las de sesión, y si
  // vino de una tarea, la tarea queda vinculada (documentada, falta confirmar).
  const guardarEntrada = (modulo: ConPlan, { tarea, entrada }: Guardar) =>
    accionesModulos.agregar(entrada, tarea ? { modulo, id: tarea.id } : undefined)

  const actual = abierto ? modulos.find((m) => m.def.slug === abierto) : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{MD_CSS}</style>
      <style>{CSS}</style>

      {actual ? (
        <VistaModulo
          modulo={actual}
          vista={vista}
          hoy={hoy}
          estado={estado}
          keysUsadas={new Set(entradas.map((e) => e.key))}
          onIr={(v) => ir(actual.def.slug as ConPlan, v)}
          onVolver={() => ir(null)}
          onHorizonte={(h) => accionesModulos.horizonte(actual.def.slug as ConPlan, h)}
          onTildar={(t, hecha) => tildar(actual.def.slug as ConPlan, t, hecha)}
          onConfirmar={confirmar}
          onDesconfirmar={(e) => accionesModulos.desconfirmar(e.key)}
          onGuardarEntrada={(g) => guardarEntrada(actual.def.slug as ConPlan, g)}
        />
      ) : (
        <>
          <PageHeader
            title="Módulos"
            subtitle="El plan de trabajo de cada módulo nuevo, quién lo lleva y cómo viene. Cada tarea hecha tiene su entrada de auditoría."
          />
          <AvisoGuardado />
          <div className="mo-grid">
            {modulos.map((m) => (
              <TarjetaModulo key={m.def.slug} modulo={m} hoy={hoy} onAbrir={esConPlan(m.def.slug) && m.plan ? () => { window.scrollTo({ top: 0 }); ir(m.def.slug as ConPlan) } : undefined} />
            ))}
          </div>
          <Compartido />
        </>
      )}
    </div>
  )
}

// Lo que se marca en Módulos no sale de este navegador (modulos/estado.ts): el
// aviso queda siempre a la vista, chico, para que nadie crea que lo ve el resto.
function AvisoGuardado() {
  return (
    <p className="mo-guardado">
      <Laptop size={14} strokeWidth={2} aria-hidden /> Se guarda en este navegador: lo que tildás, confirmás o cargás acá no lo ven los demás.
    </p>
  )
}

// ─── Lo compartido entre los tres módulos ─────────────────────────────────────
// Pedido de Ale (04/11/2026): que en Módulos quede claro que lo de reservas es
// compartido, en qué carpetas están las reglas y que si alguien actualiza algo
// ahí lo actualiza para los tres, "a cada uno para que sepan". Los datos viven
// en modulos/compartido.ts. En la lista de módulos va abierta; dentro de un
// módulo, plegada, con la nota dirigida a su responsable.
function Compartido({ modulo }: { modulo?: Modulo }) {
  const [abierto, setAbierto] = useState(!modulo)
  const otros = modulo ? PLANES.filter((p) => p.modulo !== modulo.def.slug).map((p) => `${p.nombre} (${p.responsable})`) : []
  return (
    <section className="mo-card mo-compartido" aria-labelledby="mo-compartido-titulo">
      <div className="mo-compartido-cab">
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Share2 size={18} strokeWidth={2} aria-hidden style={{ color: 'var(--chip-warning-fg)', flexShrink: 0 }} />
            <h3 id="mo-compartido-titulo" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Lo compartido entre Turnos, Alquileres y Gimnasio</h3>
            <Chip text="Un cambio, los tres módulos" tone="amber" />
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-body)' }}>
            {modulo ? (
              <><strong style={{ color: 'var(--color-text)' }}>{modulo.def.nombre} no vive solo:</strong> estas {CARPETAS_COMPARTIDAS.length} carpetas son también de {otros.join(' y ')}. Lo que cambiés ahí les cambia a ellos en el acto, y lo que ellos cambien te cambia a vos. Las reglas de cada carpeta están en su README; antes de tocar, avisá.</>
            ) : (
              <>Los tres módulos son independientes (ninguno importa de otro), pero el motor de reservas, el cliente de su API, las cuentas de calendario y de plata y el kit visual son uno solo, en estas {CARPETAS_COMPARTIDAS.length} carpetas. Lo que se actualiza ahí se actualiza para los tres. Las reglas de cada una están en su README; acá, lo que todos tienen que saber.</>
            )}
          </p>
        </div>
        <button type="button" className="ds-hover mo-compartido-ver" aria-expanded={abierto} aria-controls="mo-compartido-cuerpo" onClick={() => setAbierto((a) => !a)}>
          {abierto ? 'Ocultar' : 'Ver carpetas y reglas'} <ChevronDown size={16} strokeWidth={2.2} aria-hidden />
        </button>
      </div>
      <div id="mo-compartido-cuerpo" className="mo-compartido-cuerpo" hidden={!abierto}>
        <ol className="mo-compartido-reglas" aria-label="Reglas para tocar lo compartido">
          {REGLAS_COMPARTIDO.map((r) => <li key={r}>{r}</li>)}
        </ol>
        <div className="mo-compartido-lista">
          {CARPETAS_COMPARTIDAS.map((c) => (
            <article key={c.ruta} className="mo-compartido-item" aria-label={c.nombre}>
              <div className="mo-compartido-ruta"><Folder size={15} strokeWidth={2} aria-hidden /><code>{c.ruta}</code></div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{c.nombre}</div>
              <p style={{ margin: 0 }}>{c.que}</p>
              <dl>
                <dt>Lo usan</dt><dd>{c.usan}</dd>
                <dt>Reglas</dt><dd><code>{c.reglas}</code></dd>
                <dt>Probar</dt><dd><code>{c.probar}</code></dd>
              </dl>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Tarjeta de un módulo ─────────────────────────────────────────────────────

function TarjetaModulo({ modulo: m, hoy, onAbrir }: { modulo: Modulo; hoy: string | null; onAbrir?: () => void }) {
  const enProduccion = m.def.slug === 'tienda'
  return (
    <div className={onAbrir ? 'mo-card mo-card-clic' : 'mo-card'}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
          {onAbrir
            ? <button type="button" id={`mo-abrir-${m.def.slug}`} onClick={onAbrir} className="mo-card-abrir">{m.def.nombre}</button>
            : m.def.nombre}
        </h3>
        <Chip text={enProduccion ? 'En producción' : 'En desarrollo'} tone={enProduccion ? 'green' : 'blue'} />
      </div>
      {!m.plan ? (
        <div className="mo-datos">
          <div>{enProduccion ? 'Sin responsable · en producción' : `Responsable ${m.def.persona ?? '—'}`}</div>
          <div className="mo-rotulo" style={{ fontWeight: 500 }}>Sin plan en este ciclo.</div>
        </div>
      ) : (
        <>
          {/* Los datos van juntos y aparte del progreso. Fin y horizonte en
              dos renglones: en la grilla de 4 columnas "Fin estimado … · 2
              meses" no entraba y cortaba entre el 2 y "meses". */}
          <div className="mo-datos">
            <div><span className="mo-rotulo">Responsable </span>{m.plan.responsable}</div>
            <div><span className="mo-rotulo">Fin estimado </span>{larga(m.fin)}</div>
            <div><span className="mo-rotulo">Horizonte </span>{m.horizonte === '1m' ? '1 mes' : '2 meses'}</div>
          </div>
          <Medidor hechas={m.hechas} total={m.tareas.length} atraso={m.diasAtraso > 0} etiqueta={`Progreso de ${m.def.nombre}`} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <Semaforo hoy={hoy} dias={m.diasAtraso} />
            {m.porConfirmar > 0 && <span className="mo-rotulo" style={{ fontWeight: 500 }}>{m.porConfirmar} por confirmar</span>}
          </div>
          {m.abiertas.length > 0 && (
            <span className="mo-rotulo" style={{ fontWeight: 500 }}>
              {m.abiertas.length} {m.abiertas.length === 1 ? 'decisión abierta' : 'decisiones abiertas'}
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 'auto', fontSize: 13, fontWeight: 600, color: 'var(--chip-primary-fg)' }} aria-hidden>
            Ver plan <ChevronRight size={15} strokeWidth={2.2} />
          </div>
        </>
      )}
    </div>
  )
}

// Hechas sobre planeadas. La barra va en el color de estado (azul al día,
// ámbar con atraso) y el texto dice lo mismo: el color nunca va solo.
// `compacto`: en el KPI del Resumen, que ya dice "Progreso" y el porcentaje
// arriba, solo la barra y cuántas van.
function Medidor({ hechas, total, atraso, etiqueta, compacto = false }: { hechas: number; total: number; atraso: boolean; etiqueta: string; compacto?: boolean }) {
  const pct = total ? Math.round((hechas / total) * 100) : 0
  const barra = (
    <div className="mo-barra" data-tono={atraso ? 'atraso' : undefined} role="progressbar" aria-label={etiqueta} aria-valuemin={0} aria-valuemax={total} aria-valuenow={hechas} aria-valuetext={`${hechas} de ${total} tareas hechas`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
  if (compacto) {
    return (
      <div>
        {barra}
        <div className="mo-rotulo" style={{ fontWeight: 500, marginTop: 6 }}>{hechas} de {total} tareas</div>
      </div>
    )
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6, fontSize: 13 }}>
        <span className="mo-rotulo">Progreso</span>
        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{hechas} de {total} · {pct}%</span>
      </div>
      {barra}
    </div>
  )
}

function Semaforo({ hoy, dias }: { hoy: string | null; dias: number }) {
  if (hoy === null) return <span className="mo-semaforo" style={{ color: 'var(--color-muted)' }} aria-label="Calculando atraso">…</span>
  if (dias === 0) {
    return <span className="mo-semaforo" style={{ color: 'var(--chip-success-fg)' }}><CheckCircle2 size={15} strokeWidth={2.2} aria-hidden /> Al día</span>
  }
  return (
    <span className="mo-semaforo" style={{ color: 'var(--chip-warning-fg)' }}>
      <AlertTriangle size={15} strokeWidth={2.2} aria-hidden /> Atrasado {dias} {dias === 1 ? 'día' : 'días'}
    </span>
  )
}

// ─── Vista de un módulo ───────────────────────────────────────────────────────

interface PropsVista {
  modulo: Modulo
  vista: Vista
  hoy: string | null
  estado: EstadoModulos
  keysUsadas: Set<string>
  onIr: (v: Vista) => void
  onVolver: () => void
  onHorizonte: (h: Horizonte) => void
  onTildar: (t: TareaVista, hecha: boolean) => void
  onConfirmar: (e: Entrada) => void
  onDesconfirmar: (e: Entrada) => void
  onGuardarEntrada: (g: Guardar) => void
}

function VistaModulo(p: PropsVista) {
  const { modulo: m, vista, hoy } = p
  const tituloRef = useRef<HTMLHeadingElement>(null)
  // Al entrar a un módulo el foco va al título: con lector de pantalla, la
  // vista nueva se anuncia en vez de quedar el foco en una tarjeta que ya no está.
  useEffect(() => { tituloRef.current?.focus() }, [m.def.slug])

  // Hoja de nueva entrada: null = cerrada; `tarea` = vino de "Registrar en auditoría".
  const [hoja, setHoja] = useState<{ tarea: Tarea | null } | null>(null)
  // Entrada a la que llevó "Ver entrada" desde el plan o el resumen: se abre y se muestra.
  const [enfocar, setEnfocar] = useState<string | null>(null)

  const irA = (v: Vista, entrada?: string) => {
    setEnfocar(entrada ?? null)
    p.onIr(v)
  }
  const teclaTabs = (e: TeclaEvent<HTMLDivElement>) => {
    const i = VISTAS.findIndex((v) => v.id === vista)
    const destino = e.key === 'ArrowRight' ? (i + 1) % VISTAS.length : e.key === 'ArrowLeft' ? (i + VISTAS.length - 1) % VISTAS.length : e.key === 'Home' ? 0 : e.key === 'End' ? VISTAS.length - 1 : -1
    if (destino < 0) return
    e.preventDefault()
    irA(VISTAS[destino].id)
    document.getElementById(`mo-tab-${VISTAS[destino].id}`)?.focus()
  }

  return (
    <>
      <div>
        <button type="button" onClick={p.onVolver} className="ds-hover mo-volver">
          <ArrowLeft size={18} strokeWidth={2} aria-hidden /> Volver a Módulos
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 ref={tituloRef} tabIndex={-1} style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', outline: 'none' }}>{m.def.nombre}</h2>
            <Chip text="En desarrollo" tone="blue" />
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Responsable: <strong style={{ color: 'var(--color-body)' }}>{m.plan?.responsable ?? m.def.persona ?? 'Sin responsable'}</strong>
            {m.plan && <> · Fin estimado {larga(m.fin)}</>}
          </p>
        </div>
        {m.plan && (
          <div>
            <div className="mo-rotulo" id="mo-horizonte" style={{ marginBottom: 6 }}>Horizonte</div>
            <div className="mo-seg" role="radiogroup" aria-labelledby="mo-horizonte">
              {(['2m', '1m'] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  role="radio"
                  aria-checked={m.horizonte === h}
                  data-selected={m.horizonte === h ? 'true' : undefined}
                  onClick={() => m.horizonte !== h && p.onHorizonte(h)}
                  className="ds-hover"
                >
                  {h === '2m' ? '2 meses' : '1 mes'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <AvisoGuardado />

      <Compartido modulo={m} />

      {!m.plan ? (
        <div className="mo-card">
          <Empty text="Este módulo no tiene plan en este ciclo." />
        </div>
      ) : (
        <>
          <div className="mo-tabs" role="tablist" aria-label={`Vista de ${m.def.nombre}`} onKeyDown={teclaTabs}>
            {VISTAS.map((v) => (
              <button
                key={v.id}
                id={`mo-tab-${v.id}`}
                type="button"
                role="tab"
                aria-selected={vista === v.id}
                aria-controls="mo-panel"
                tabIndex={vista === v.id ? 0 : -1}
                onClick={() => irA(v.id)}
                className="ds-hover mo-tab"
              >
                {v.label}{v.id === 'auditoria' && m.entradas.length > 0 ? ` (${m.entradas.length})` : ''}
              </button>
            ))}
          </div>
          <div id="mo-panel" role="tabpanel" aria-labelledby={`mo-tab-${vista}`} tabIndex={0} className="mo-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {vista === 'plan' && (
              <PanelPlan
                modulo={m}
                hoy={hoy}
                onTildar={p.onTildar}
                onRegistrar={(tarea) => setHoja({ tarea })}
                onVerEntrada={(key) => irA('auditoria', key)}
              />
            )}
            {vista === 'auditoria' && (
              <PanelAuditoria
                modulo={m}
                estado={p.estado}
                enfocar={enfocar}
                onConfirmar={p.onConfirmar}
                onDesconfirmar={p.onDesconfirmar}
                onNueva={() => setHoja({ tarea: null })}
              />
            )}
            {vista === 'resumen' && <PanelResumen modulo={m} hoy={hoy} onVerEntrada={(key) => irA('auditoria', key)} />}
          </div>
        </>
      )}

      {hoja && m.plan && (
        <HojaNuevaEntrada
          modulo={m}
          tarea={hoja.tarea}
          hoy={hoy}
          keysUsadas={p.keysUsadas}
          onCerrar={() => setHoja(null)}
          onGuardar={(g) => {
            p.onGuardarEntrada(g)
            setHoja(null)
          }}
        />
      )}
    </>
  )
}

// ─── Plan ─────────────────────────────────────────────────────────────────────

function PanelPlan({ modulo: m, hoy, onTildar, onRegistrar, onVerEntrada }: {
  modulo: Modulo
  hoy: string | null
  onTildar: (t: TareaVista, hecha: boolean) => void
  onRegistrar: (tarea: Tarea) => void
  onVerEntrada: (key: string) => void
}) {
  const dosMeses = m.horizonte === '2m'
  const fila = (t: TareaVista) => (
    <FilaTarea key={t.tarea.id} t={t} onTildar={onTildar} onRegistrar={onRegistrar} onVerEntrada={onVerEntrada} />
  )
  return (
    <>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.6 }}>
        Inicio <strong>{conDia(CICLO.inicio)}</strong> · Fin estimado <strong>{conDia(m.fin)}</strong> · Horizonte{' '}
        <strong>{dosMeses ? '2 meses' : '1 mes'}</strong> ({m.semanas.length} semanas).{' '}
        Una tarea se tilda con su entrada de auditoría.
      </p>

      {m.semanas.map((s) => {
        const estado = ESTADO_SEMANA[estadoSemana(s, hoy)]
        const hechas = s.tareas.filter((t) => t.estado === 'hecha').length
        return (
          <section key={s.n} className="mo-card" style={{ padding: 0, gap: 0 }} aria-labelledby={`mo-semana-${s.n}`}>
            <div className="mo-semana-cab">
              <div style={{ minWidth: 0 }}>
                <h3 id={`mo-semana-${s.n}`} style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
                  Semana {s.n} · {s.titulo}
                </h3>
                <div className="mo-rotulo" style={{ fontWeight: 500, marginTop: 3 }}>
                  {corta(primerDia(s))} al {corta(s.hasta)}
                  {s.comprimidas.length > 0 && <> · suma lo de las semanas {s.comprimidas.join(', ')} del plan de 2 meses</>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mo-rotulo">{hechas} de {s.tareas.length}</span>
                {estado.tone === 'gray' ? <span className="mo-etiqueta">{estado.label}</span> : <Chip text={estado.label} tone={estado.tone} />}
              </div>
            </div>
            <div>
              {[0, 1, 2, 3, 4].map((i) => {
                const dia = sumarDias(s.desde, i)
                // Antes del inicio del ciclo no hay días que mostrar (la semana 1 arranca un jueves).
                if (dia < CICLO.inicio) return null
                const deHoy = s.tareas.filter((t) => t.dia === dia)
                return (
                  <div key={dia} className="mo-dia">
                    <div className="mo-dia-nombre">{DIAS[i]}<span>{corta(dia)}{hoy === dia ? ' · hoy' : ''}</span></div>
                    <div style={{ minWidth: 0 }}>
                      {deHoy.length === 0
                        ? <div className="mo-rotulo" style={{ fontWeight: 500, padding: '12px 0' }}>Sin tareas</div>
                        : deHoy.map(fila)}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {m.fuera.length > 0 && (
        <section className="mo-card" style={{ padding: 0, gap: 0 }} aria-labelledby="mo-fuera">
          <div className="mo-semana-cab">
            <div>
              <h3 id="mo-fuera" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Queda para el próximo ciclo</h3>
              <div className="mo-rotulo" style={{ fontWeight: 500, marginTop: 3 }}>Con el horizonte de 1 mes estas tareas no entran. Vuelven a su semana con 2 meses.</div>
            </div>
          </div>
          <div style={{ padding: '6px 16px 10px' }}>{m.fuera.map(fila)}</div>
        </section>
      )}
    </>
  )
}

const ESTADO_TAREA: Record<EstadoTarea, { label: string; color: string; Icono: typeof CheckCircle2 }> = {
  hecha: { label: 'Hecha', color: 'var(--chip-success-fg)', Icono: CheckCircle2 },
  'por-confirmar': { label: 'Documentada · falta confirmar', color: 'var(--chip-primary-fg)', Icono: Clock },
  pendiente: { label: 'Pendiente', color: 'var(--color-muted)', Icono: CircleDashed },
}

function FilaTarea({ t, onTildar, onRegistrar, onVerEntrada }: {
  t: TareaVista
  onTildar: (t: TareaVista, hecha: boolean) => void
  onRegistrar: (tarea: Tarea) => void
  onVerEntrada: (key: string) => void
}) {
  const { tarea: c } = t
  // Se tilda con la entrada cargada; destildar siempre se puede, salvo lo que
  // quedó hecho para todos en el código.
  const habilitada = !t.fija && (t.estado === 'hecha' || t.estado === 'por-confirmar')
  // Con la entrada ya confirmada no falta confirmar nada: alguien la destildó.
  const est = t.atraso > 0
    ? { label: `Atrasada ${t.atraso} ${t.atraso === 1 ? 'día' : 'días'}`, color: 'var(--chip-warning-fg)', Icono: AlertTriangle }
    : t.estado === 'por-confirmar' && t.confirmada
      ? { ...ESTADO_TAREA['por-confirmar'], label: 'Documentada · falta tildar' }
      : ESTADO_TAREA[t.estado]
  const idEstado = `mo-est-${c.id}`
  const movida = t.dia && t.dia !== c.dia
  const ayuda = t.fija ? 'Confirmada en el código: está hecha para todos' : habilitada ? undefined : 'Se tilda cuando la tarea tiene su entrada de auditoría'
  return (
    <div className="mo-tarea">
      <label className="mo-check" title={ayuda}>
        <input
          type="checkbox"
          checked={t.hecha}
          disabled={!habilitada}
          aria-describedby={idEstado}
          aria-label={c.texto}
          onChange={(e) => onTildar(t, e.target.checked)}
        />
      </label>
      <div className="mo-tarea-texto">
        {/* textDecorationLine y no el atajo textDecoration: React avisa si se mezcla el atajo con textDecorationColor en un re-render. */}
        <div style={{ fontSize: 13.5, fontWeight: 600, color: t.hecha ? 'var(--color-muted)' : 'var(--color-text)', lineHeight: 1.45, textDecorationLine: t.hecha ? 'line-through' : 'none', textDecorationColor: 'var(--color-border-strong)' }}>
          {c.texto}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.45, marginTop: 2 }}>Listo cuando: {c.criterio}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px 10px', flexWrap: 'wrap', marginTop: 4 }}>
          <span id={idEstado} className="mo-estado" style={{ color: est.color }}>
            <est.Icono size={13} strokeWidth={2.2} aria-hidden /> {est.label}
          </span>
          {movida && <span className="mo-rotulo" style={{ fontWeight: 500 }}>En el plan de 2 meses: {corta(c.dia)}</span>}
          {!t.dia && <span className="mo-rotulo" style={{ fontWeight: 500 }}>{corta(c.dia)} en el plan de 2 meses</span>}
        </div>
      </div>
      <div className="mo-tarea-acc">
        <span className="mo-etiqueta" title="Responsable de la tarea">{c.quien}</span>
        {t.estado === 'pendiente' && (
          <button type="button" onClick={() => onRegistrar(c)} className="ds-hover mo-boton" style={{ ...btnGhost, fontSize: 13 }}>
            <FilePlus2 size={15} strokeWidth={2} aria-hidden /> Registrar en auditoría
          </button>
        )}
        {t.entrada && (
          <button type="button" onClick={() => onVerEntrada(t.entrada!.key)} className="ds-hover mo-boton" style={{ ...btnGhost, fontSize: 13 }}>
            Ver entrada
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Auditoría del módulo ─────────────────────────────────────────────────────

function PanelAuditoria({ modulo: m, estado, enfocar, onConfirmar, onDesconfirmar, onNueva }: {
  modulo: Modulo
  estado: EstadoModulos
  enfocar: string | null
  onConfirmar: (e: Entrada) => void
  onDesconfirmar: (e: Entrada) => void
  onNueva: () => void
}) {
  const [filtro, setFiltro] = useState<TipoEntrada | 'todas'>('todas')
  const visibles = m.entradas.filter((e) => filtro === 'todas' || e.tipo === filtro)
  const cuantas = (t: TipoEntrada) => m.entradas.filter((e) => e.tipo === t).length
  // Qué tareas del plan documenta cada entrada (para mostrarlo en la tarjeta).
  const tareasDe = (key: string) => m.todas.filter((t) => t.tarea.auditoria === key).map((t) => t.tarea)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div className="mo-filtros" role="group" aria-label="Filtrar por tipo">
          <button type="button" aria-pressed={filtro === 'todas'} onClick={() => setFiltro('todas')} className="ds-hover mo-filtro">Todas ({m.entradas.length})</button>
          {TIPOS.map((t) => (
            <button key={t.id} type="button" aria-pressed={filtro === t.id} onClick={() => setFiltro(t.id)} className="ds-hover mo-filtro">
              {t.filtro} ({cuantas(t.id)})
            </button>
          ))}
        </div>
        <button type="button" onClick={onNueva} className="ds-hover mo-boton" style={btnPrimary}>
          <Plus size={16} strokeWidth={2} aria-hidden /> Nueva entrada
        </button>
      </div>

      {visibles.length === 0 && (
        <div className="mo-card">
          <Empty text={m.entradas.length === 0 ? 'Este módulo todavía no tiene entradas. Cada tarea hecha, cambio de diseño o decisión va acá.' : 'No hay entradas de ese tipo.'} />
        </div>
      )}

      {visibles.map((e) => (
        <TarjetaEntrada
          key={e.key}
          entrada={e}
          confirmacion={confirmacionDe(e, estado)}
          tareas={tareasDe(e.key)}
          enfocar={enfocar === e.key}
          onConfirmar={() => onConfirmar(e)}
          onDesconfirmar={() => onDesconfirmar(e)}
        />
      ))}
    </>
  )
}

function TarjetaEntrada({ entrada: e, confirmacion, tareas, enfocar, onConfirmar, onDesconfirmar }: {
  entrada: Entrada
  confirmacion: Confirmacion | null
  tareas: Tarea[]
  enfocar: boolean
  onConfirmar: () => void
  onDesconfirmar: () => void
}) {
  const [abierta, setAbierta] = useState(enfocar)
  const ref = useRef<HTMLElement>(null)
  // "Ver entrada" desde el plan: la tarjeta llega abierta y se muestra.
  useEffect(() => {
    if (!enfocar) return
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ref.current?.scrollIntoView({ block: 'start', behavior: quieto ? 'auto' : 'smooth' })
  }, [enfocar])

  const tipo = TIPOS.find((t) => t.id === e.tipo) ?? TIPOS[0]
  const id = sinAcentos(e.key).replace(/[^a-z0-9]+/g, '-')
  const idCuerpo = `mo-entrada-${id}`
  const idTitulo = `mo-entrada-titulo-${id}`

  return (
    <article ref={ref} className="mo-card" style={{ padding: 0, gap: 0, scrollMarginTop: 80 }} aria-labelledby={idTitulo}>
      <div className="mo-entrada-cab">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {tipo.id === 'tarea'
              ? <span className="mo-etiqueta">{tipo.label}</span>
              : <Chip text={tipo.label} tone={tipo.id === 'decisión' ? 'violet' : 'blue'} />}
            {e.abierta
              ? <Chip text={`Abierta · la decide ${e.quien}`} tone="amber" />
              : confirmacion
                ? <Chip text="Confirmada" tone="green" />
                : <Chip text="Pendiente de confirmación" tone="amber" />}
          </div>
          <h3 id={idTitulo} style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.35 }}>{e.titulo}</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-body)', lineHeight: 1.5 }}>{e.foco}</p>
          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            {e.abierta ? 'La decide' : 'Lo hizo'} <strong style={{ color: 'var(--color-body)' }}>{e.quien}</strong> · {larga(e.fecha)}
            {confirmacion && <> · confirmada el {larga(confirmacion.dia)}{confirmacion.local ? ' en este navegador' : ''}</>}
            {e.origen === 'navegador' && <> · cargada en este navegador</>}
          </p>
          {tareas.length > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
              Documenta: {tareas.map((t) => t.texto).join(' · ')}
            </p>
          )}
        </div>
        <div className="mo-entrada-acc">
          {!e.abierta && !confirmacion && (
            <button type="button" onClick={onConfirmar} className="ds-hover mo-boton" style={btnPrimary}>
              <CheckCircle2 size={16} strokeWidth={2} aria-hidden /> Confirmar
            </button>
          )}
          {confirmacion?.local && (
            <button type="button" onClick={onDesconfirmar} className="ds-hover mo-boton" style={btnGhost} aria-label={`Deshacer la confirmación de ${e.titulo}`}>
              <Undo2 size={15} strokeWidth={2} aria-hidden /> Deshacer
            </button>
          )}
          <button type="button" onClick={() => setAbierta((v) => !v)} aria-expanded={abierta} aria-controls={idCuerpo} className="ds-hover mo-boton" style={btnGhost}>
            {abierta ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />} {abierta ? 'Ocultar detalle' : 'Ver detalle'}
          </button>
        </div>
      </div>
      {abierta && (
        <div id={idCuerpo} className="mo-entrada-cuerpo">
          <MarkdownInforme texto={informeVisible(e.informe, !!confirmacion)} />
        </div>
      )}
    </article>
  )
}

// ─── Resumen ──────────────────────────────────────────────────────────────────

function PanelResumen({ modulo: m, hoy, onVerEntrada }: { modulo: Modulo; hoy: string | null; onVerEntrada: (key: string) => void }) {
  const hito = proximoHito(m, hoy)
  const porPersona = PERSONAS
    .map((persona) => {
      const suyas = m.tareas.filter((t) => t.tarea.quien === persona)
      return { persona, total: suyas.length, hechas: suyas.filter((t) => t.estado === 'hecha').length, atrasadas: suyas.filter((t) => t.atraso > 0).length }
    })
    .filter((x) => x.total > 0)
  const pct = m.tareas.length ? Math.round((m.hechas / m.tareas.length) * 100) : 0

  return (
    <>
      <div className="mo-kpis">
        <div className="mo-kpi">
          <div className="mo-rotulo">Progreso</div>
          <div className="mo-kpi-valor">{pct}%</div>
          <div style={{ marginTop: 8 }}><Medidor hechas={m.hechas} total={m.tareas.length} atraso={m.diasAtraso > 0} etiqueta={`Progreso de ${m.def.nombre}`} compacto /></div>
        </div>
        <div className="mo-kpi">
          <div className="mo-rotulo">Por confirmar</div>
          <div className="mo-kpi-valor">{m.porConfirmar}</div>
          <div className="mo-rotulo" style={{ fontWeight: 500, marginTop: 6 }}>Documentadas que falta tildar</div>
        </div>
        <div className="mo-kpi">
          <div className="mo-rotulo">Atrasos</div>
          <div className="mo-kpi-valor">{hoy === null ? '…' : m.atrasadas.length}</div>
          <div style={{ marginTop: 6 }}><Semaforo hoy={hoy} dias={m.diasAtraso} /></div>
        </div>
        <div className="mo-kpi">
          <div className="mo-rotulo">Próximo hito</div>
          <div className="mo-kpi-valor" style={{ fontSize: 17, lineHeight: 1.3 }}>{hito ? `Semana ${hito.n}` : 'Todo hecho'}</div>
          <div className="mo-rotulo" style={{ fontWeight: 500, marginTop: 6 }}>{hito ? `${hito.titulo} · ${corta(hito.desde)} al ${corta(hito.hasta)}` : 'No quedan tareas en este horizonte'}</div>
        </div>
      </div>

      <section className="mo-card" style={{ padding: 0, gap: 0 }} aria-labelledby="mo-por-persona">
        <div className="mo-semana-cab"><h3 id="mo-por-persona" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Por responsable</h3></div>
        {porPersona.length === 0 && <Empty text="El plan no tiene tareas en este horizonte." />}
        {porPersona.map((x) => (
          <div key={x.persona} className="mo-fila-lista" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{x.persona}</span>
              {x.atrasadas > 0 && <span className="mo-estado" style={{ color: 'var(--chip-warning-fg)' }}><AlertTriangle size={13} aria-hidden /> {x.atrasadas} atrasada{x.atrasadas === 1 ? '' : 's'}</span>}
            </div>
            <Medidor hechas={x.hechas} total={x.total} atraso={x.atrasadas > 0} etiqueta={`Progreso de ${x.persona}`} />
          </div>
        ))}
      </section>

      {m.abiertas.length > 0 && (
        <section className="mo-card" style={{ padding: 0, gap: 0 }} aria-labelledby="mo-abiertas">
          <div className="mo-semana-cab">
            <div>
              <h3 id="mo-abiertas" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Decisiones abiertas</h3>
              <div className="mo-rotulo" style={{ fontWeight: 500, marginTop: 3 }}>No se destraban con código: las decide la persona que figura.</div>
            </div>
          </div>
          {m.abiertas.map((e) => (
            <div key={e.key} className="mo-fila-lista">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.45 }}>{e.titulo}</div>
                <div className="mo-rotulo" style={{ fontWeight: 500, marginTop: 2 }}>La decide {e.quien}</div>
              </div>
              <button type="button" onClick={() => onVerEntrada(e.key)} className="ds-hover mo-boton" style={{ ...btnGhost, fontSize: 13 }} aria-label={`Ver la decisión: ${e.titulo}`}>
                Ver
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="mo-card" style={{ padding: 0, gap: 0 }} aria-labelledby="mo-atrasos">
        <div className="mo-semana-cab"><h3 id="mo-atrasos" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Atrasos</h3></div>
        {hoy === null && <Empty text="…" />}
        {hoy !== null && m.atrasadas.length === 0 && <Empty text="Nada atrasado: todo lo que ya pasó está hecho o documentado." />}
        {hoy !== null && m.atrasadas.map((t) => (
          <div key={t.tarea.id} className="mo-fila-lista">
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.45 }}>{t.tarea.texto}</div>
              <div className="mo-rotulo" style={{ fontWeight: 500, marginTop: 2 }}>{t.dia ? conDia(t.dia) : ''} · {t.tarea.quien}</div>
            </div>
            <span className="mo-estado" style={{ color: 'var(--chip-warning-fg)', whiteSpace: 'nowrap' }}>{t.atraso} {t.atraso === 1 ? 'día' : 'días'}</span>
          </div>
        ))}
      </section>

      {hito && (
        <section className="mo-card" style={{ padding: 0, gap: 0 }} aria-labelledby="mo-hito">
          <div className="mo-semana-cab">
            <div>
              <h3 id="mo-hito" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Próximo hito: semana {hito.n} · {hito.titulo}</h3>
              <div className="mo-rotulo" style={{ fontWeight: 500, marginTop: 3 }}>{conDia(hito.desde)} al {conDia(hito.hasta)}</div>
            </div>
          </div>
          {hito.tareas.filter((t) => t.estado !== 'hecha').map((t) => (
            <div key={t.tarea.id} className="mo-fila-lista">
              <div style={{ fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.45, minWidth: 0 }}>{t.tarea.texto}</div>
              <span className="mo-rotulo" style={{ whiteSpace: 'nowrap' }}>{t.dia ? `${DIAS[indiceDia(t.dia)]} ${corta(t.dia)}` : ''}</span>
            </div>
          ))}
        </section>
      )}
    </>
  )
}

// ─── Nueva entrada (hoja) ─────────────────────────────────────────────────────

export function slugDe(texto: string): string {
  const s = sinAcentos(texto)
    .replace(/^transversal:\s*/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
  return s || 'entrada'
}

// La primera línea con texto de "qué se hizo", sin marcas de Markdown: es lo
// que se ve de la entrada sin abrirla.
export function focoDe(que: string): string {
  const linea = que.split('\n').map((l) => l.replace(/^[\s#>*\-\d.)]+/, '').replace(/[*`_]/g, '').trim()).find(Boolean) ?? ''
  return linea.length > 280 ? `${linea.slice(0, 279)}…` : linea
}

interface CapturasHoja { antes1280: string; despues1280: string; antes390: string; despues390: string }

export function armarInforme(d: { que: string; quien: Persona; fecha: string; archivos: string[]; tipo: TipoEntrada; capturas: CapturasHoja; decision: string; porque: string }): string {
  const partes = ['## Qué se hizo', d.que.trim(), '## Quién', d.quien, '## Cuándo', conDia(d.fecha)]
  if (d.archivos.length) partes.push('## Archivos', d.archivos.map((a) => `- \`${a.replace(/`/g, '')}\``).join('\n'))
  if (d.tipo === 'diseño') {
    const par = (antes: string, despues: string, ancho: string) => `![Antes · ${ancho}](${antes})\n![Después · ${ancho}](${despues})`
    const pares = [par(d.capturas.antes1280, d.capturas.despues1280, '1280')]
    if (d.capturas.antes390 && d.capturas.despues390) pares.push(par(d.capturas.antes390, d.capturas.despues390, '390'))
    partes.push('## Antes / Después', pares.join('\n\n'))
  }
  if (d.tipo === 'decisión') partes.push('## Decisión y porqué', `**Decisión:** ${d.decision.trim()}\n\n**Porqué:** ${d.porque.trim()}`)
  return partes.join('\n\n')
}

function HojaNuevaEntrada({ modulo: m, tarea, hoy, keysUsadas, onCerrar, onGuardar }: {
  modulo: Modulo
  tarea: Tarea | null
  hoy: string | null
  keysUsadas: Set<string>
  onCerrar: () => void
  onGuardar: (g: Guardar) => void
}) {
  const [tipo, setTipo] = useState<TipoEntrada>('tarea')
  const [quien, setQuien] = useState<Persona>(tarea?.quien ?? m.def.persona ?? 'Ale')
  const [fecha, setFecha] = useState(hoy ?? CICLO.inicio)
  const [titulo, setTitulo] = useState(tarea?.texto ?? '')
  const [que, setQue] = useState('')
  const [archivos, setArchivos] = useState('')
  const [capturas, setCapturas] = useState<CapturasHoja>({ antes1280: '', despues1280: '', antes390: '', despues390: '' })
  const [decision, setDecision] = useState('')
  const [porque, setPorque] = useState('')
  const [error, setError] = useState('')
  const primerCampo = useRef<HTMLInputElement>(null)

  // Escape cierra, la página de atrás no scrollea y el foco arranca en el
  // título (y vuelve a donde estaba al cerrar). Corre una sola vez: con
  // onCerrar en las deps se volvía a ejecutar en cada render y le robaba el
  // foco a quien estaba escribiendo.
  const cerrarConEscape = useEffectEvent((e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() })
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => cerrarConEscape(e)
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    primerCampo.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previo?.focus?.()
    }
  }, [])

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    const t = titulo.trim()
    if (t.length < 2) return setError('Poné un título.')
    if (t.length > 160) return setError('El título no puede pasar de 160 caracteres.')
    if (!RE_ISO.test(fecha)) return setError('Elegí la fecha en que se hizo.')
    if (que.trim().length < 3) return setError('Contá qué se hizo.')
    if (tipo === 'diseño') {
      if (!capturas.antes1280.trim() || !capturas.despues1280.trim()) return setError('Un cambio de diseño lleva las capturas de antes y después.')
      if (!capturas.antes390.trim() !== !capturas.despues390.trim()) return setError('Las capturas a 390 van de a par: antes y después.')
      const malas = Object.values(capturas).filter((u) => u.trim() && !srcSeguro(u.trim()))
      if (malas.length) return setError('Las capturas tienen que ser un link https:// o una ruta /auditoria/…')
    }
    if (tipo === 'decisión' && (!decision.trim() || !porque.trim())) return setError('Una decisión lleva la opción elegida y el porqué.')

    const base = `auditoria.${m.def.slug}.${fecha}-${slugDe(t)}`
    let key = base
    for (let n = 2; keysUsadas.has(key); n++) key = `${base}-${n}`
    const limpias = Object.fromEntries(Object.entries(capturas).map(([k, v]) => [k, v.trim()])) as unknown as CapturasHoja
    const informe = armarInforme({
      que, quien, fecha, tipo, decision, porque, capturas: limpias,
      archivos: archivos.split('\n').map((a) => a.trim()).filter(Boolean),
    })
    if (informe.length > 80_000) return setError('El informe es demasiado largo (más de 80.000 caracteres).')
    // Con una primera línea de una letra, el resumen es el título.
    const foco = focoDe(que)
    setError('')
    onGuardar({
      tarea,
      entrada: {
        key, modulo: m.def.slug as ConPlan, tipo, transversal: t.startsWith('Transversal: '), titulo: t, foco: foco.length >= 2 ? foco : t,
        quien, fecha, informe, abierta: false, origen: 'navegador', confirmada: null,
      },
    })
  }

  const campo = { ...inputStyle, width: '100%' }
  const area = { ...inputStyle, width: '100%', height: 'auto', padding: '10px 13px', lineHeight: 1.5, resize: 'vertical' as const }
  const captura = (k: keyof CapturasHoja, label: string, ayuda?: string) => (
    <label className="mo-campo">
      {label}
      <input value={capturas[k]} onChange={(e) => setCapturas((c) => ({ ...c, [k]: e.target.value }))} placeholder="/auditoria/modulos/… o https://…" inputMode="url" className="ds-field" style={campo} />
      {ayuda && <span className="mo-campo-ayuda">{ayuda}</span>}
    </label>
  )

  return (
    <div className="mo-hoja-fondo" onClick={onCerrar}>
      <div className="mo-hoja" role="dialog" aria-modal="true" aria-labelledby="mo-hoja-titulo" onClick={(e) => e.stopPropagation()}>
        <div className="mo-hoja-cab">
          <h3 id="mo-hoja-titulo" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>Nueva entrada · {m.def.nombre}</h3>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="ds-hover" style={{ width: 44, height: 44, borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--color-muted)', display: 'grid', placeItems: 'center', fontFamily: 'inherit' }}>
            <X size={18} aria-hidden />
          </button>
        </div>
        <form onSubmit={enviar}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20 }}>
            {tarea && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                Documenta la tarea <strong style={{ color: 'var(--color-body)' }}>{tarea.texto}</strong>. Al guardarla, la tarea queda vinculada y se tilda cuando se confirma la entrada.
              </p>
            )}
            <p className="mo-campo-ayuda" style={{ margin: 0 }}>
              Se guarda en este navegador. Para que la vea todo el equipo, pasala a <code>modules/superadmin/modulos/entradas.ts</code>.
            </p>
            {error && <ErrorBox msg={error} />}

            <div className="mo-campo">
              <span id="mo-tipo">Tipo</span>
              <div className="mo-seg" role="radiogroup" aria-labelledby="mo-tipo" style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
                {TIPOS.map((x) => (
                  <button key={x.id} type="button" role="radio" aria-checked={tipo === x.id} data-selected={tipo === x.id ? 'true' : undefined} onClick={() => setTipo(x.id)} className="ds-hover">{x.label}</button>
                ))}
              </div>
            </div>

            <label className="mo-campo">
              Título
              <input ref={primerCampo} value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={160} className="ds-field" style={campo} />
              <span className="mo-campo-ayuda">Si cruza módulos, empezalo con &ldquo;Transversal: &rdquo;.</span>
            </label>

            <div className="mo-dos">
              <label className="mo-campo">
                Quién lo hizo
                <select value={quien} onChange={(e) => setQuien(e.target.value as Persona)} className="ds-field" style={campo}>
                  {PERSONAS.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
                <span className="mo-campo-ayuda">Queda pendiente hasta que la confirme {quien}.</span>
              </label>
              <label className="mo-campo">
                Cuándo
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="ds-field" style={campo} />
              </label>
            </div>

            <label className="mo-campo">
              Qué se hizo
              <textarea value={que} onChange={(e) => setQue(e.target.value)} rows={5} className="ds-field" style={area} />
              <span className="mo-campo-ayuda">Markdown. La primera línea es el resumen que se ve sin abrir la entrada.</span>
            </label>

            <label className="mo-campo">
              Archivos tocados
              <textarea value={archivos} onChange={(e) => setArchivos(e.target.value)} rows={3} placeholder="apps/web/src/…/Archivo.tsx:120" spellCheck={false} className="ds-field" style={{ ...area, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }} />
              <span className="mo-campo-ayuda">Uno por renglón, con su línea: ruta:línea.</span>
            </label>

            {tipo === 'diseño' && (
              <>
                <div className="mo-dos">
                  {captura('antes1280', 'Antes · 1280')}
                  {captura('despues1280', 'Después · 1280')}
                </div>
                <div className="mo-dos">
                  {captura('antes390', 'Antes · 390 (opcional)')}
                  {captura('despues390', 'Después · 390 (opcional)', 'Las capturas van en apps/web/public/auditoria/modulos/<módulo>/.')}
                </div>
              </>
            )}

            {tipo === 'decisión' && (
              <>
                <label className="mo-campo">
                  Decisión
                  <input value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="La opción elegida" className="ds-field" style={campo} />
                </label>
                <label className="mo-campo">
                  Porqué
                  <textarea value={porque} onChange={(e) => setPorque(e.target.value)} rows={3} className="ds-field" style={area} />
                </label>
              </>
            )}
          </div>
          <div className="mo-hoja-pie">
            <button type="button" onClick={onCerrar} className="ds-hover mo-boton" style={btnGhost}>Cancelar</button>
            <button type="submit" className="ds-hover mo-boton" style={btnPrimary}>Guardar entrada</button>
          </div>
        </form>
      </div>
    </div>
  )
}
