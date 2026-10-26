import {
  useCallback, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, type KeyboardEvent as TeclaEvent,
} from 'react'
import { useRouter } from 'next/router'
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, CircleDashed, Clock, FilePlus2, Plus, RefreshCw, X,
} from 'lucide-react'
import {
  platformApi,
  type AuditAdminRef, type AuditCheck, type AuditItemRow, type AuditListado, type CreateAuditItemInput,
} from '@/lib/platform/api'
import { Chip, Empty, ErrorBox, Loader, PageHeader, btnGhost, btnPrimary, inputStyle, dateTime } from './ui'
import { MarkdownInforme, MD_CSS, srcSeguro } from './MarkdownInforme'

// Módulos (super admin → Interno → Módulos): el plan de trabajo de los módulos
// nuevos (Turnos, Gimnasio y Alquileres) y su auditoría.
//
// No tiene backend propio: el tablero de auditoría (PlatformAuditItem) es el
// almacén. Cada módulo con plan es UN ítem `modulo.<slug>.plan` cuyos checks
// son las tareas diarias (día, quién, criterio de listo, semana en cada
// horizonte), y cada cosa hecha es una entrada `auditoria.<slug>.<fecha>-<slug>`
// con su informe en Markdown. Los siembra la API (platform/audit/modulos-seed.ts
// y modulos-entradas.ts) y la pestaña Auditoría los deja afuera de sus números
// con esDeModulos.
//
// Reglas que viven acá y en la API a la vez:
//   - Una tarea se tilda solo si su entrada está cargada (la API lo exige).
//   - Una entrada generada en sesión queda "Pendiente de confirmación" hasta
//     que la confirma su responsable, y confirmarla tilda la tarea que
//     documenta: es el mismo "lo hice yo", no hay que decirlo dos veces.
//   - El horizonte (2 meses o 1 mes) se guarda en `notas` del plan. En 1 mes
//     las tareas se reubican por `semana1m` y las que quedan afuera van a
//     "Queda para el próximo ciclo"; lo hecho no se pierde al cambiar.
//   - El estado de cada semana (pendiente, en curso, hecha, atrasada) sale de
//     sus tareas; no se guarda en ningún lado.
//
// Vive en la URL como el resto del superadmin:
// ?seccion=modulos&modulo=gimnasio&vista=auditoria.

type Slug = 'tienda' | 'turnos' | 'gimnasio' | 'alquileres'
type ConPlan = Exclude<Slug, 'tienda'>
type Persona = 'Ale' | 'Mateo' | 'Alan'
type Vista = 'plan' | 'auditoria' | 'resumen'
type Horizonte = '2m' | '1m'
type TipoEntrada = 'tarea' | 'diseño' | 'decisión'
type EstadoTarea = 'hecha' | 'por-confirmar' | 'sin-cargar' | 'pendiente'

interface DefModulo { slug: Slug; nombre: string; persona: Persona | null }

// El orden de las tarjetas. Tienda no tiene plan: ya está en producción.
const MODULOS: DefModulo[] = [
  { slug: 'tienda', nombre: 'Tienda', persona: null },
  { slug: 'turnos', nombre: 'Turnos', persona: 'Mateo' },
  { slug: 'gimnasio', nombre: 'Gimnasio', persona: 'Ale' },
  { slug: 'alquileres', nombre: 'Alquileres', persona: 'Alan' },
]
const PERSONAS: Persona[] = ['Ale', 'Mateo', 'Alan']
const esConPlan = (v: unknown): v is ConPlan => v === 'turnos' || v === 'gimnasio' || v === 'alquileres'

const VISTAS: { id: Vista; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'auditoria', label: 'Auditoría' },
  { id: 'resumen', label: 'Resumen' },
]

// El tipo de una entrada va al final de su grupo ("Módulo · Turnos · diseño").
// Una decisión de módulo NO crea un ítem decision.*: esos son lo que la
// Auditoría general tiene pendiente de decidir (cuentan en su botón
// Decisiones) y la key decision. no se puede elegir desde el alta. Lo de acá
// ya está decidido: va como entrada auditoria.* con la sección "Decisión y
// porqué".
const TIPOS: { id: TipoEntrada; label: string; filtro: string }[] = [
  { id: 'tarea', label: 'Tarea', filtro: 'Tarea hecha' },
  { id: 'diseño', label: 'Diseño', filtro: 'Cambio de diseño' },
  { id: 'decisión', label: 'Decisión', filtro: 'Decisión' },
]

// Mismo ciclo que modulos-seed.ts: vale si el plan llega sin notas o con notas
// editadas a mano.
const CICLO = { inicio: '2026-10-26', fin2m: '2026-12-18', fin1m: '2026-11-20' }
// Los dos checks de toda entrada, igual que CHECKS_ENTRADA en
// modulos-entradas.ts: el primero lo tilda "Confirmar".
const CHECKS_ENTRADA = ['Confirmada por el responsable', 'Revisada por Ale']

const REFRESCO_MS = 20_000

// Los planes de Módulos y sus entradas viven en la misma tabla que el
// inventario de la auditoría, pero no son parte de él: Auditoria.tsx y
// DocumentoAuditoria.tsx los sacan antes de contar. Mismo criterio que
// esDeModulos en platform-audit.service.ts.
export function esDeModulos(key: string): boolean {
  return key.startsWith('modulo.') || key.startsWith('auditoria.')
}

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
const semanaDe = (inicio: string, dia: string) => Math.floor(diasEntre(inicio, dia) / 7) + 1
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

// ─── Lectura de los ítems ─────────────────────────────────────────────────────

interface NotasPlan { horizonte: Horizonte; inicio: string; fin2m: string; fin1m: string; semanas: string[] }

function crudoDe(notas: string | null): Record<string, unknown> {
  if (!notas) return {}
  try {
    const v: unknown = JSON.parse(notas)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function leerNotasPlan(notas: string | null): NotasPlan {
  const c = crudoDe(notas)
  const iso = (v: unknown, def: string) => (typeof v === 'string' && RE_ISO.test(v) ? v : def)
  return {
    horizonte: c.horizonte === '1m' ? '1m' : '2m',
    inicio: iso(c.inicio, CICLO.inicio),
    fin2m: iso(c.fin2m, CICLO.fin2m),
    fin1m: iso(c.fin1m, CICLO.fin1m),
    semanas: Array.isArray(c.semanas) ? c.semanas.map((s) => (typeof s === 'string' ? s : '')) : [],
  }
}

const tipoDe = (e: AuditItemRow): TipoEntrada => {
  const t = e.grupo.split(' · ')[2]
  return t === 'diseño' || t === 'decisión' ? t : 'tarea'
}
const fechaDe = (e: AuditItemRow): string | null => /^auditoria\.[a-z0-9-]+\.(\d{4}-\d{2}-\d{2})-/.exec(e.key)?.[1] ?? null
const quienDe = (e: AuditItemRow): string | null => {
  const q = crudoDe(e.notas).quien
  return typeof q === 'string' && q.trim() ? q : (e.responsable?.name ?? e.hechoPor?.name ?? null)
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
// Mismo criterio que elegirResponsable en la API: una palabra del nombre que
// empiece con el nombre de pila ("Alan Vega" es Alan; "Valeria" no es Ale).
const esLaPersona = (nombre: string, persona: string) =>
  sinAcentos(nombre).split(/[^a-z0-9]+/).some((p) => p.startsWith(sinAcentos(persona)))

// "Alan Vega" si la cuenta es suya; "Ale · CPO" si usa la de su cargo.
function nombreResponsable(persona: Persona | null, admin: AuditAdminRef | null): string {
  if (!persona) return 'Sin responsable'
  if (!admin) return persona
  return esLaPersona(admin.name, persona) ? admin.name : `${persona} · ${admin.name}`
}

// ─── Modelo derivado de un módulo ─────────────────────────────────────────────

interface TareaVista {
  check: AuditCheck
  // Fecha y semana en el horizonte elegido; null = fuera del ciclo o sin fecha.
  dia: string | null
  semana: number | null
  entrada: AuditItemRow | null
  estado: EstadoTarea
  atraso: number
}

interface Semana { n: number; titulo: string; desde: string; hasta: string; tareas: TareaVista[]; comprimidas: number[] }

interface Modulo {
  def: DefModulo
  plan: AuditItemRow | null
  notas: NotasPlan
  fin: string
  semanas: Semana[]
  tareas: TareaVista[]
  fuera: TareaVista[]
  sinFecha: TareaVista[]
  entradas: AuditItemRow[]
  hechas: number
  porConfirmar: number
  atrasadas: TareaVista[]
  diasAtraso: number
}

function vistaDeTarea(c: AuditCheck, notas: NotasPlan, porKey: Map<string, AuditItemRow>, hoy: string | null): TareaVista {
  const entrada = c.auditoria ? (porKey.get(c.auditoria) ?? null) : null
  const estado: EstadoTarea = c.hecho ? 'hecha' : c.auditoria ? (entrada ? 'por-confirmar' : 'sin-cargar') : 'pendiente'
  let dia: string | null = null
  let semana: number | null = null
  if (c.dia) {
    const s2 = c.semana ?? semanaDe(notas.inicio, c.dia)
    if (notas.horizonte === '2m') {
      dia = c.dia
      semana = s2
    } else {
      // En 1 mes la tarea va a su semana1m, el mismo día de la semana. Sin el
      // dato, la misma regla que el seed: 1 a 4 iguales, el resto a la 4.
      const s1 = c.semana1m === undefined ? Math.min(s2, 4) : c.semana1m
      if (s1 !== null) {
        semana = s1
        dia = sumarDias(lunesDe(notas.inicio, s1), indiceDia(c.dia))
      }
    }
  }
  // Atrasada = sin hacer ni documentar y con la fecha ya pasada. Lo
  // documentado en sesión ya está hecho: le falta la firma, no el trabajo.
  const atraso = estado === 'pendiente' && dia && hoy && dia < hoy ? diasEntre(dia, hoy) : 0
  return { check: c, dia, semana, entrada, estado, atraso }
}

export function armarModulo(def: DefModulo, items: AuditItemRow[], porKey: Map<string, AuditItemRow>, hoy: string | null): Modulo {
  const plan = items.find((i) => i.key === `modulo.${def.slug}.plan`) ?? null
  const notas = leerNotasPlan(plan?.notas ?? null)
  const fin = notas.horizonte === '1m' ? notas.fin1m : notas.fin2m
  const entradas = items
    .filter((i) => i.key.startsWith(`auditoria.${def.slug}.`))
    .sort((a, b) => (fechaDe(b) ?? '').localeCompare(fechaDe(a) ?? '') || a.titulo.localeCompare(b.titulo))
  const vistas = (plan?.checks ?? []).map((c) => vistaDeTarea(c, notas, porKey, hoy))
  const tareas = vistas.filter((t) => t.semana !== null)
  const cantidad = Math.max(1, Math.ceil((diasEntre(notas.inicio, fin) + 1) / 7))
  const semanas: Semana[] = []
  for (let n = 1; n <= cantidad; n++) {
    const desde = lunesDe(notas.inicio, n)
    const deLaSemana = tareas
      .filter((t) => t.semana === n)
      .sort((a, b) => (a.dia ?? '').localeCompare(b.dia ?? '') || (a.check.dia ?? '').localeCompare(b.check.dia ?? ''))
    const comprimidas = Array.from(new Set(deLaSemana.map((t) => t.check.semana ?? n).filter((s) => s !== n))).sort((a, b) => a - b)
    semanas.push({ n, titulo: notas.semanas[n - 1]?.trim() || `Semana ${n}`, desde, hasta: sumarDias(desde, 4), tareas: deLaSemana, comprimidas })
  }
  const atrasadas = tareas.filter((t) => t.atraso > 0).sort((a, b) => b.atraso - a.atraso)
  return {
    def, plan, notas, fin, semanas, tareas, entradas, atrasadas,
    fuera: vistas.filter((t) => t.semana === null && t.check.dia),
    sinFecha: vistas.filter((t) => !t.check.dia),
    hechas: tareas.filter((t) => t.estado === 'hecha').length,
    porConfirmar: tareas.filter((t) => t.estado === 'por-confirmar' || t.estado === 'sin-cargar').length,
    diasAtraso: atrasadas[0]?.atraso ?? 0,
  }
}

type EstadoSemana = 'hecha' | 'atrasada' | 'en-curso' | 'pendiente'
export function estadoSemana(s: Semana, hoy: string | null): EstadoSemana {
  if (s.tareas.length > 0 && s.tareas.every((t) => t.estado === 'hecha')) return 'hecha'
  if (s.tareas.some((t) => t.atraso > 0)) return 'atrasada'
  if (s.tareas.some((t) => t.estado !== 'pendiente') || (hoy !== null && hoy >= s.desde && hoy <= s.hasta)) return 'en-curso'
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
  .mo-card-clic:has(.mo-card-abrir:focus-visible) { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  @media (hover: hover) { .mo-card-clic:hover { border-color: var(--color-border-strong); } }
  .mo-rotulo { font-size: 12px; font-weight: 600; color: var(--color-muted); }
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
  @media (max-width: 960px) { .mo-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
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
  @media (prefers-reduced-motion: reduce) { .mo-barra > span { transition: none; } }
`

// ─── Pestaña ──────────────────────────────────────────────────────────────────

interface Guardar { tarea: AuditCheck | null; plan: AuditItemRow | null; quien: Persona; input: CreateAuditItemInput }

export function TabModulos({ currentAdminId }: { currentAdminId: string }) {
  const router = useRouter()
  const hoy = useSyncExternalStore(suscribirHoy, hoyLocal, hoyServidor)
  const [data, setData] = useState<AuditListado | null>(null)
  const [error, setError] = useState('')
  const [refrescando, setRefrescando] = useState(false)
  const [guardando, setGuardando] = useState<string | null>(null)
  const cargandoRef = useRef(false)
  const tieneDatosRef = useRef(false)

  // Mismo patrón que Auditoria.tsx: refresco de fondo cada 20 s y al volver a
  // la pestaña (lo que tilda otro aparece solo); `silencioso` no pisa la
  // pantalla con un error si ya hay datos.
  const cargar = useCallback(async (silencioso: boolean) => {
    if (cargandoRef.current) return
    cargandoRef.current = true
    if (!silencioso) setRefrescando(true)
    try {
      const r = await platformApi.audit()
      tieneDatosRef.current = true
      setData(r)
      setError('')
    } catch (e) {
      if (!silencioso || !tieneDatosRef.current) setError(e instanceof Error ? e.message : 'No se pudo cargar Módulos.')
    } finally {
      cargandoRef.current = false
      if (!silencioso) setRefrescando(false)
    }
  }, [])

  useEffect(() => {
    // setTimeout 0 y no la llamada directa: el linter del React Compiler no
    // acepta un efecto que dispare setState sincrónico (igual que Auditoría).
    const primera = window.setTimeout(() => void cargar(true), 0)
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void cargar(true) }, REFRESCO_MS)
    const alVolver = () => { if (document.visibilityState === 'visible') void cargar(true) }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    return () => {
      window.clearTimeout(primera)
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
    }
  }, [cargar])

  const abierto = esConPlan(router.query.modulo) ? router.query.modulo : null
  const vista: Vista = router.query.vista === 'auditoria' || router.query.vista === 'resumen' ? router.query.vista : 'plan'
  const ir = (modulo: ConPlan | null, v: Vista = 'plan') => {
    const q = modulo ? `&modulo=${modulo}${v !== 'plan' ? `&vista=${v}` : ''}` : ''
    void router.push(`/superadmin?seccion=modulos${q}`, undefined, { shallow: true })
  }

  if (error && !data) return <ErrorBox msg={error} action={<button onClick={() => void cargar(false)} className="ds-hover mo-boton" style={btnGhost}>Reintentar</button>} />
  if (!data) return <Loader />

  const porKey = new Map(data.items.map((i) => [i.key, i]))
  const modulos = MODULOS.map((def) => armarModulo(def, data.items, porKey, hoy))
  const planDe = (p: Persona) => modulos.find((m) => m.def.persona === p)?.plan ?? null
  const adminDe = (p: Persona) => planDe(p)?.responsable ?? null

  const aplicar = (fila: AuditItemRow) => setData((d) => (d ? { ...d, items: d.items.map((i) => (i.id === fila.id ? fila : i)) } : d))
  const fallo = (e: unknown, texto: string) => {
    setError(e instanceof Error ? `${texto}: ${e.message}` : texto)
    void cargar(true)
  }

  // Pasa la entrada a HECHO, tilda "Confirmada por el responsable" y las
  // tareas que documenta: la API registra quién y cuándo (hechoPor/hechoAt).
  const confirmarEntrada = async (entrada: AuditItemRow) => {
    setGuardando(entrada.id)
    setError('')
    try {
      const c1 = entrada.checks.find((c) => c.texto === CHECKS_ENTRADA[0])
      aplicar(await platformApi.updateAuditItem(entrada.id, { estado: 'HECHO', ...(c1 ? { checks: [{ id: c1.id, hecho: true }] } : {}) }))
      for (const m of modulos) {
        const toggles = (m.plan?.checks ?? []).filter((c) => c.auditoria === entrada.key && !c.hecho).map((c) => ({ id: c.id, hecho: true, auditoria: entrada.key }))
        if (m.plan && toggles.length) aplicar(await platformApi.updateAuditItem(m.plan.id, { checks: toggles }))
      }
    } catch (e) {
      fallo(e, 'No se pudo confirmar la entrada')
    } finally {
      setGuardando(null)
    }
  }

  const tildar = async (plan: AuditItemRow, t: TareaVista, hecho: boolean) => {
    // Tildar una tarea cuya entrada sigue pendiente es confirmarla: se hace
    // por la entrada, que tilda la tarea de paso.
    if (hecho && t.entrada && t.entrada.estado !== 'HECHO') return confirmarEntrada(t.entrada)
    setGuardando(t.check.id)
    setError('')
    try {
      const toggle = hecho && t.check.auditoria ? { id: t.check.id, hecho, auditoria: t.check.auditoria } : { id: t.check.id, hecho }
      aplicar(await platformApi.updateAuditItem(plan.id, { checks: [toggle] }))
    } catch (e) {
      fallo(e, 'No se pudo guardar la tarea')
    } finally {
      setGuardando(null)
    }
  }

  const cambiarHorizonte = async (plan: AuditItemRow, horizonte: Horizonte) => {
    // Se conserva todo lo que haya en notas (ciclo, títulos): solo cambia el horizonte.
    const notas = JSON.stringify({ ...crudoDe(plan.notas), horizonte })
    aplicar({ ...plan, notas })
    try {
      aplicar(await platformApi.updateAuditItem(plan.id, { notas }))
    } catch (e) {
      fallo(e, 'No se pudo guardar el horizonte')
    }
  }

  // Alta desde el modal. La entrada nace pendiente con el responsable de la
  // tarea; si quien la carga es ese responsable, se confirma en el acto. Si
  // vino de una tarea, la tarea queda vinculada (y tildada si se confirmó).
  const guardarEntrada = async ({ tarea, plan, quien, input }: Guardar) => {
    const admin = adminDe(quien)
    const fila = await platformApi.createAuditItem({ ...input, responsableId: admin?.id ?? null })
    setData((d) => (d ? { ...d, items: [...d.items, fila] } : d))
    const confirmar = admin?.id === currentAdminId
    try {
      if (confirmar) {
        const c1 = fila.checks.find((c) => c.texto === CHECKS_ENTRADA[0])
        aplicar(await platformApi.updateAuditItem(fila.id, { estado: 'HECHO', ...(c1 ? { checks: [{ id: c1.id, hecho: true }] } : {}) }))
      }
      if (tarea && plan) aplicar(await platformApi.updateAuditItem(plan.id, { checks: [{ id: tarea.id, hecho: confirmar, auditoria: fila.key }] }))
    } catch (e) {
      fallo(e, 'La entrada se guardó, pero no se pudo vincular o confirmar')
    }
  }

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
          error={error}
          guardando={guardando}
          keysUsadas={new Set(porKey.keys())}
          confirmaAlGuardar={(quien) => adminDe(quien)?.id === currentAdminId}
          onIr={(v) => ir(actual.def.slug as ConPlan, v)}
          onVolver={() => ir(null)}
          onHorizonte={(h) => actual.plan && void cambiarHorizonte(actual.plan, h)}
          onTildar={(t, hecho) => actual.plan && void tildar(actual.plan, t, hecho)}
          onConfirmar={(e) => void confirmarEntrada(e)}
          onGuardarEntrada={guardarEntrada}
        />
      ) : (
        <>
          <PageHeader
            title="Módulos"
            subtitle="El plan de trabajo de cada módulo nuevo, quién lo lleva y cómo viene. Cada tarea hecha tiene su entrada de auditoría."
            action={
              <button onClick={() => void cargar(false)} className="ds-hover mo-boton" style={btnGhost} title="Actualizar ahora (también se actualiza solo cada 20 s)">
                <RefreshCw size={15} strokeWidth={2} style={{ animation: refrescando ? 'orbita-spin 0.7s linear infinite' : undefined }} aria-hidden />
                Actualizar
              </button>
            }
          />
          {error && <ErrorBox msg={error} />}
          <div className="mo-grid">
            {modulos.map((m) => (
              <TarjetaModulo key={m.def.slug} modulo={m} hoy={hoy} onAbrir={esConPlan(m.def.slug) && m.plan ? () => { window.scrollTo({ top: 0 }); ir(m.def.slug as ConPlan) } : undefined} />
            ))}
          </div>
        </>
      )}
    </div>
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
            ? <button type="button" onClick={onAbrir} className="mo-card-abrir">{m.def.nombre}</button>
            : m.def.nombre}
        </h3>
        <Chip text={enProduccion ? 'En producción' : 'En desarrollo'} tone={enProduccion ? 'green' : 'blue'} />
      </div>
      {enProduccion ? (
        <>
          <div style={{ fontSize: 13 }}>Sin responsable · en producción</div>
          <div className="mo-rotulo" style={{ fontWeight: 500 }}>Sin plan en este ciclo: ya está en producción.</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13 }}>
            <span className="mo-rotulo">Responsable </span>{nombreResponsable(m.def.persona, m.plan?.responsable ?? null)}
          </div>
          {m.plan ? (
            <>
              <div style={{ fontSize: 13 }}>
                <span className="mo-rotulo">Fin estimado </span>{larga(m.fin)} · {m.notas.horizonte === '1m' ? '1 mes' : '2 meses'}
              </div>
              <Medidor hechas={m.hechas} total={m.tareas.length} atraso={m.diasAtraso > 0} etiqueta={`Progreso de ${m.def.nombre}`} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <Semaforo hoy={hoy} dias={m.diasAtraso} />
                {m.porConfirmar > 0 && <span className="mo-rotulo" style={{ fontWeight: 500 }}>{m.porConfirmar} por confirmar</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 'auto', fontSize: 13, fontWeight: 600, color: 'var(--chip-primary-fg)' }} aria-hidden>
                Ver plan <ChevronRight size={15} strokeWidth={2.2} />
              </div>
            </>
          ) : (
            <div className="mo-rotulo" style={{ fontWeight: 500, lineHeight: 1.45 }}>
              Plan sin cargar: aparece cuando la API con el seed de Módulos esté desplegada.
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Hechas sobre planeadas. La barra va en el color de estado (azul al día,
// ámbar con atraso) y el texto dice lo mismo: el color nunca va solo.
function Medidor({ hechas, total, atraso, etiqueta }: { hechas: number; total: number; atraso: boolean; etiqueta: string }) {
  const pct = total ? Math.round((hechas / total) * 100) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6, fontSize: 13 }}>
        <span className="mo-rotulo">Progreso</span>
        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{hechas} de {total} · {pct}%</span>
      </div>
      <div className="mo-barra" data-tono={atraso ? 'atraso' : undefined} role="progressbar" aria-label={etiqueta} aria-valuemin={0} aria-valuemax={total} aria-valuenow={hechas} aria-valuetext={`${hechas} de ${total} tareas hechas`}>
        <span style={{ width: `${pct}%` }} />
      </div>
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
  error: string
  guardando: string | null
  keysUsadas: Set<string>
  // Si quien hizo la tarea es el admin con la sesión abierta: su entrada se
  // confirma al guardarla.
  confirmaAlGuardar: (quien: Persona) => boolean
  onIr: (v: Vista) => void
  onVolver: () => void
  onHorizonte: (h: Horizonte) => void
  onTildar: (t: TareaVista, hecho: boolean) => void
  onConfirmar: (e: AuditItemRow) => void
  onGuardarEntrada: (g: Guardar) => Promise<void>
}

function VistaModulo(p: PropsVista) {
  const { modulo: m, vista, hoy } = p
  const tituloRef = useRef<HTMLHeadingElement>(null)
  // Al entrar a un módulo el foco va al título: con lector de pantalla, la
  // vista nueva se anuncia en vez de quedar el foco en una tarjeta que ya no está.
  useEffect(() => { tituloRef.current?.focus() }, [m.def.slug])

  // Hoja de nueva entrada: null = cerrada; `tarea` = vino de "Registrar en auditoría".
  const [hoja, setHoja] = useState<{ tarea: AuditCheck | null } | null>(null)
  // Entrada a la que llevó "Ver entrada" desde el plan: se abre y se muestra.
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
            Responsable: <strong style={{ color: 'var(--color-body)' }}>{nombreResponsable(m.def.persona, m.plan?.responsable ?? null)}</strong>
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
                  aria-checked={m.notas.horizonte === h}
                  data-selected={m.notas.horizonte === h ? 'true' : undefined}
                  onClick={() => m.notas.horizonte !== h && p.onHorizonte(h)}
                  className="ds-hover"
                >
                  {h === '2m' ? '2 meses' : '1 mes'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {p.error && <ErrorBox msg={p.error} />}

      {!m.plan ? (
        <div className="mo-card">
          <Empty text="Plan sin cargar: aparece cuando la API con el seed de Módulos esté desplegada." />
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
                guardando={p.guardando}
                onTildar={p.onTildar}
                onRegistrar={(tarea) => setHoja({ tarea })}
                onVerEntrada={(key) => irA('auditoria', key)}
              />
            )}
            {vista === 'auditoria' && (
              <PanelAuditoria
                modulo={m}
                guardando={p.guardando}
                enfocar={enfocar}
                onConfirmar={p.onConfirmar}
                onNueva={() => setHoja({ tarea: null })}
              />
            )}
            {vista === 'resumen' && <PanelResumen modulo={m} hoy={hoy} />}
          </div>
        </>
      )}

      {hoja && m.plan && (
        <HojaNuevaEntrada
          modulo={m}
          tarea={hoja.tarea}
          hoy={hoy}
          keysUsadas={p.keysUsadas}
          confirmaAlGuardar={p.confirmaAlGuardar}
          onCerrar={() => setHoja(null)}
          onGuardar={async (g) => {
            await p.onGuardarEntrada({ ...g, plan: m.plan })
            setHoja(null)
          }}
        />
      )}
    </>
  )
}

// ─── Plan ─────────────────────────────────────────────────────────────────────

function PanelPlan({ modulo: m, hoy, guardando, onTildar, onRegistrar, onVerEntrada }: {
  modulo: Modulo
  hoy: string | null
  guardando: string | null
  onTildar: (t: TareaVista, hecho: boolean) => void
  onRegistrar: (tarea: AuditCheck) => void
  onVerEntrada: (key: string) => void
}) {
  const dosMeses = m.notas.horizonte === '2m'
  const fila = (t: TareaVista) => (
    <FilaTarea key={t.check.id} t={t} guardando={guardando === t.check.id || (!!t.entrada && guardando === t.entrada.id)} onTildar={onTildar} onRegistrar={onRegistrar} onVerEntrada={onVerEntrada} />
  )
  return (
    <>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.6 }}>
        Inicio <strong>{conDia(m.notas.inicio)}</strong> · Fin estimado <strong>{conDia(m.fin)}</strong> · Horizonte{' '}
        <strong>{dosMeses ? '2 meses' : '1 mes'}</strong> ({m.semanas.length} semanas).{' '}
        Una tarea se tilda con su entrada de auditoría cargada.
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
                  {corta(s.desde)} al {corta(s.hasta)}
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

      {m.sinFecha.length > 0 && (
        <section className="mo-card" style={{ padding: 0, gap: 0 }} aria-labelledby="mo-sin-fecha">
          <div className="mo-semana-cab">
            <h3 id="mo-sin-fecha" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Sin fecha</h3>
          </div>
          <div style={{ padding: '6px 16px 10px' }}>{m.sinFecha.map(fila)}</div>
        </section>
      )}
    </>
  )
}

const ESTADO_TAREA: Record<EstadoTarea, { label: string; color: string; Icono: typeof CheckCircle2 }> = {
  hecha: { label: 'Hecha', color: 'var(--chip-success-fg)', Icono: CheckCircle2 },
  'por-confirmar': { label: 'Documentada · falta confirmar', color: 'var(--chip-primary-fg)', Icono: Clock },
  'sin-cargar': { label: 'Documentada en sesión · falta cargar la entrada', color: 'var(--color-muted)', Icono: Clock },
  pendiente: { label: 'Pendiente', color: 'var(--color-muted)', Icono: CircleDashed },
}

function FilaTarea({ t, guardando, onTildar, onRegistrar, onVerEntrada }: {
  t: TareaVista
  guardando: boolean
  onTildar: (t: TareaVista, hecho: boolean) => void
  onRegistrar: (tarea: AuditCheck) => void
  onVerEntrada: (key: string) => void
}) {
  const { check: c } = t
  // Se tilda con la entrada cargada; destildar siempre se puede.
  const habilitada = !guardando && (t.estado === 'hecha' || t.estado === 'por-confirmar')
  const est = t.atraso > 0
    ? { label: `Atrasada ${t.atraso} ${t.atraso === 1 ? 'día' : 'días'}`, color: 'var(--chip-warning-fg)', Icono: AlertTriangle }
    : ESTADO_TAREA[t.estado]
  const idEstado = `mo-est-${c.id}`
  const movida = t.dia && c.dia && t.dia !== c.dia
  return (
    <div className="mo-tarea">
      <label className="mo-check" title={habilitada ? undefined : 'Se tilda cuando la tarea tiene su entrada de auditoría cargada'}>
        <input
          type="checkbox"
          checked={c.hecho}
          disabled={!habilitada}
          aria-describedby={idEstado}
          aria-label={c.texto}
          onChange={(e) => onTildar(t, e.target.checked)}
        />
      </label>
      <div className="mo-tarea-texto">
        <div style={{ fontSize: 13.5, fontWeight: 600, color: c.hecho ? 'var(--color-muted)' : 'var(--color-text)', lineHeight: 1.45, textDecoration: c.hecho ? 'line-through' : undefined, textDecorationColor: 'var(--color-border-strong)' }}>
          {c.texto}
        </div>
        {c.criterio && (
          <div style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.45, marginTop: 2 }}>Listo cuando: {c.criterio}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px 10px', flexWrap: 'wrap', marginTop: 4 }}>
          <span id={idEstado} className="mo-estado" style={{ color: est.color }}>
            <est.Icono size={13} strokeWidth={2.2} aria-hidden /> {est.label}
          </span>
          {movida && <span className="mo-rotulo" style={{ fontWeight: 500 }}>En el plan de 2 meses: {corta(c.dia!)}</span>}
          {!t.dia && c.dia && <span className="mo-rotulo" style={{ fontWeight: 500 }}>{corta(c.dia)} en el plan de 2 meses</span>}
        </div>
      </div>
      <div className="mo-tarea-acc">
        {c.quien && <span className="mo-etiqueta" title="Responsable de la tarea">{c.quien}</span>}
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

function PanelAuditoria({ modulo: m, guardando, enfocar, onConfirmar, onNueva }: {
  modulo: Modulo
  guardando: string | null
  enfocar: string | null
  onConfirmar: (e: AuditItemRow) => void
  onNueva: () => void
}) {
  const [filtro, setFiltro] = useState<TipoEntrada | 'todas'>('todas')
  const visibles = m.entradas.filter((e) => filtro === 'todas' || tipoDe(e) === filtro)
  const cuantas = (t: TipoEntrada) => m.entradas.filter((e) => tipoDe(e) === t).length
  // Qué tareas del plan documenta cada entrada (para mostrarlo en la tarjeta).
  const tareasDe = (key: string) => (m.plan?.checks ?? []).filter((c) => c.auditoria === key)

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
          key={e.id}
          entrada={e}
          tareas={tareasDe(e.key)}
          guardando={guardando === e.id}
          enfocar={enfocar === e.key}
          onConfirmar={() => onConfirmar(e)}
        />
      ))}
    </>
  )
}

function TarjetaEntrada({ entrada: e, tareas, guardando, enfocar, onConfirmar }: {
  entrada: AuditItemRow
  tareas: AuditCheck[]
  guardando: boolean
  enfocar: boolean
  onConfirmar: () => void
}) {
  const [abierta, setAbierta] = useState(enfocar)
  const ref = useRef<HTMLElement>(null)
  // "Ver entrada" desde el plan: la tarjeta llega abierta y se muestra.
  useEffect(() => {
    if (!enfocar) return
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ref.current?.scrollIntoView({ block: 'start', behavior: quieto ? 'auto' : 'smooth' })
  }, [enfocar])

  const tipo = TIPOS.find((t) => t.id === tipoDe(e)) ?? TIPOS[0]
  const confirmada = e.estado === 'HECHO'
  const fecha = fechaDe(e)
  const quien = quienDe(e)
  const idCuerpo = `mo-entrada-${e.id}`
  const idTitulo = `mo-entrada-titulo-${e.id}`

  return (
    <article ref={ref} className="mo-card" style={{ padding: 0, gap: 0, scrollMarginTop: 80 }} aria-labelledby={idTitulo}>
      <div className="mo-entrada-cab">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {tipo.id === 'tarea'
              ? <span className="mo-etiqueta">{tipo.label}</span>
              : <Chip text={tipo.label} tone={tipo.id === 'decisión' ? 'violet' : 'blue'} />}
            {confirmada
              ? <Chip text="Confirmada" tone="green" />
              : <Chip text="Pendiente de confirmación" tone="amber" />}
          </div>
          <h3 id={idTitulo} style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.35 }}>{e.titulo}</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-body)', lineHeight: 1.5 }}>{e.foco}</p>
          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            {quien ? <>Lo hizo <strong style={{ color: 'var(--color-body)' }}>{quien}</strong></> : 'Sin responsable'}
            {fecha && <> · {larga(fecha)}</>}
            {confirmada && e.hechoPor && e.hechoAt && <> · confirmada por {e.hechoPor.name} el {dateTime(e.hechoAt)}</>}
          </p>
          {tareas.length > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
              Documenta: {tareas.map((t) => t.texto).join(' · ')}
            </p>
          )}
        </div>
        <div className="mo-entrada-acc">
          {!confirmada && (
            <button type="button" onClick={onConfirmar} disabled={guardando} className="ds-hover mo-boton" style={{ ...btnPrimary, opacity: guardando ? 0.6 : 1 }}>
              <CheckCircle2 size={16} strokeWidth={2} aria-hidden /> {guardando ? 'Confirmando…' : 'Confirmar'}
            </button>
          )}
          <button type="button" onClick={() => setAbierta((v) => !v)} aria-expanded={abierta} aria-controls={idCuerpo} className="ds-hover mo-boton" style={btnGhost}>
            {abierta ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />} {abierta ? 'Ocultar detalle' : 'Ver detalle'}
          </button>
        </div>
      </div>
      {abierta && (
        <div id={idCuerpo} className="mo-entrada-cuerpo">
          {e.informe ? <MarkdownInforme texto={e.informe} /> : <Empty text="Esta entrada no tiene informe." />}
        </div>
      )}
    </article>
  )
}

// ─── Resumen ──────────────────────────────────────────────────────────────────

function PanelResumen({ modulo: m, hoy }: { modulo: Modulo; hoy: string | null }) {
  const hito = proximoHito(m, hoy)
  const porPersona = PERSONAS
    .map((persona) => {
      const suyas = m.tareas.filter((t) => t.check.quien === persona)
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
          <div style={{ marginTop: 8 }}><Medidor hechas={m.hechas} total={m.tareas.length} atraso={m.diasAtraso > 0} etiqueta={`Progreso de ${m.def.nombre}`} /></div>
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

      <section className="mo-card" style={{ padding: 0, gap: 0 }} aria-labelledby="mo-atrasos">
        <div className="mo-semana-cab"><h3 id="mo-atrasos" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Atrasos</h3></div>
        {hoy === null && <Empty text="…" />}
        {hoy !== null && m.atrasadas.length === 0 && <Empty text="Nada atrasado: todo lo que ya pasó está hecho o documentado." />}
        {hoy !== null && m.atrasadas.map((t) => (
          <div key={t.check.id} className="mo-fila-lista">
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.45 }}>{t.check.texto}</div>
              <div className="mo-rotulo" style={{ fontWeight: 500, marginTop: 2 }}>{t.dia ? conDia(t.dia) : ''}{t.check.quien ? ` · ${t.check.quien}` : ''}</div>
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
            <div key={t.check.id} className="mo-fila-lista">
              <div style={{ fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.45, minWidth: 0 }}>{t.check.texto}</div>
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

interface Capturas { antes1280: string; despues1280: string; antes390: string; despues390: string }

export function armarInforme(d: { que: string; quien: Persona; fecha: string; archivos: string[]; tipo: TipoEntrada; capturas: Capturas; decision: string; porque: string }): string {
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

function HojaNuevaEntrada({ modulo: m, tarea, hoy, keysUsadas, confirmaAlGuardar, onCerrar, onGuardar }: {
  modulo: Modulo
  tarea: AuditCheck | null
  hoy: string | null
  keysUsadas: Set<string>
  confirmaAlGuardar: (quien: Persona) => boolean
  onCerrar: () => void
  onGuardar: (g: Omit<Guardar, 'plan'>) => Promise<void>
}) {
  const quienInicial = (PERSONAS as string[]).includes(tarea?.quien ?? '') ? (tarea!.quien as Persona) : (m.def.persona ?? 'Ale')
  const [tipo, setTipo] = useState<TipoEntrada>('tarea')
  const [quien, setQuien] = useState<Persona>(quienInicial)
  const [fecha, setFecha] = useState(hoy ?? CICLO.inicio)
  const [titulo, setTitulo] = useState(tarea?.texto ?? '')
  const [que, setQue] = useState('')
  const [archivos, setArchivos] = useState('')
  const [capturas, setCapturas] = useState<Capturas>({ antes1280: '', despues1280: '', antes390: '', despues390: '' })
  const [decision, setDecision] = useState('')
  const [porque, setPorque] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const primerCampo = useRef<HTMLInputElement>(null)

  // Escape cierra, la página de atrás no scrollea y el foco arranca en el
  // título (y vuelve a donde estaba al cerrar). Corre una sola vez: con
  // onCerrar en las deps se volvía a ejecutar en cada refresco de fondo y le
  // robaba el foco a quien estaba escribiendo.
  const cerrarConEscape = useEffectEvent((e: KeyboardEvent) => { if (e.key === 'Escape' && !guardando) onCerrar() })
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

  const enviar = async (e: React.FormEvent) => {
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
    const limpias = Object.fromEntries(Object.entries(capturas).map(([k, v]) => [k, v.trim()])) as unknown as Capturas
    const informe = armarInforme({
      que, quien, fecha, tipo, decision, porque, capturas: limpias,
      archivos: archivos.split('\n').map((a) => a.trim()).filter(Boolean),
    })
    if (informe.length > 80_000) return setError('El informe es demasiado largo (más de 80.000 caracteres).')

    // El DTO pide al menos 2 caracteres de foco: con una primera línea de una
    // letra, va el título.
    const foco = focoDe(que)
    setError('')
    setGuardando(true)
    try {
      await onGuardar({
        tarea,
        quien,
        input: {
          key,
          area: t.startsWith('Transversal: ') ? 'TRANSVERSAL' : 'FRONTEND',
          grupo: `Módulo · ${m.def.nombre} · ${tipo}`,
          titulo: t,
          foco: foco.length >= 2 ? foco : t,
          checks: CHECKS_ENTRADA,
          informe,
          estado: 'PENDIENTE',
          notas: JSON.stringify({ quien, tipo, ...(tarea && m.plan ? { plan: m.plan.key, tarea: tarea.id } : {}) }),
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la entrada.')
      setGuardando(false)
    }
  }

  const campo = { ...inputStyle, width: '100%' }
  const area = { ...inputStyle, width: '100%', height: 'auto', padding: '10px 13px', lineHeight: 1.5, resize: 'vertical' as const }
  const captura = (k: keyof Capturas, label: string, ayuda?: string) => (
    <label className="mo-campo">
      {label}
      <input value={capturas[k]} onChange={(e) => setCapturas((c) => ({ ...c, [k]: e.target.value }))} placeholder="/auditoria/modulos/… o https://…" inputMode="url" className="ds-field" style={campo} />
      {ayuda && <span className="mo-campo-ayuda">{ayuda}</span>}
    </label>
  )

  return (
    <div className="mo-hoja-fondo" onClick={guardando ? undefined : onCerrar}>
      <div className="mo-hoja" role="dialog" aria-modal="true" aria-labelledby="mo-hoja-titulo" onClick={(e) => e.stopPropagation()}>
        <div className="mo-hoja-cab">
          <h3 id="mo-hoja-titulo" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>Nueva entrada · {m.def.nombre}</h3>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="ds-hover" style={{ width: 44, height: 44, borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--color-muted)', display: 'grid', placeItems: 'center', fontFamily: 'inherit' }}>
            <X size={18} aria-hidden />
          </button>
        </div>
        <form onSubmit={(e) => void enviar(e)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20 }}>
            {tarea && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                Documenta la tarea <strong style={{ color: 'var(--color-body)' }}>{tarea.texto}</strong>. Al guardarla, la tarea queda vinculada; si la confirmás vos, queda tildada.
              </p>
            )}
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
                <span className="mo-campo-ayuda">
                  {confirmaAlGuardar(quien) ? 'Sos vos: queda confirmada al guardarla.' : `Queda pendiente hasta que la confirme ${quien}.`}
                </span>
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
            <button type="button" onClick={onCerrar} disabled={guardando} className="ds-hover mo-boton" style={btnGhost}>Cancelar</button>
            <button type="submit" disabled={guardando} className="ds-hover mo-boton" style={{ ...btnPrimary, opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando…' : 'Guardar entrada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
