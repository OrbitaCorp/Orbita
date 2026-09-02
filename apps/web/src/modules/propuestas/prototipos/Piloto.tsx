// src/modules/propuestas/prototipos/Piloto.tsx — Propuesta 7: Piloto
// Automático. Orbi arma el plan de vuelo de la semana (5 acciones ya
// redactadas), el dueño aprueba / edita / descarta con un toque, el plan se
// ejecuta solo (semana en vuelo) y el domingo siguiente Orbi reporta qué
// funcionó y qué aprendió. Todo simulado localmente, sin backend ni LLM.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Percent, MessageCircle, Package, CalendarCheck, Megaphone, Check, X, Pencil,
  RotateCcw, Rocket, ShieldCheck, TrendingUp, Users, Boxes, ChevronRight, Undo2,
  Minus, Plus, Sparkles, Zap, Store, Eye, Clock, type LucideIcon,
} from 'lucide-react'
import { C, FONT, FONT_DISPLAY, FONT_MONO, Tarjeta, Chip, Boton, Etiqueta, OrbiAvatar, formatoARS } from '../ui'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Tipo = 'descuento' | 'mensaje' | 'stock' | 'recordatorio' | 'contenido'
type Estado = 'pendiente' | 'aprobada' | 'descartada'
type Fase = 'intro' | 'plan' | 'vuelo' | 'reporte'

type Detalle =
  | { tipo: 'descuento'; producto: string; codigoBase: string; precio: number; stock: number; diasSinVenta: number; margen: number }
  | { tipo: 'mensaje'; clientes: number; ticket: number; diasInactivos: number }
  | { tipo: 'stock'; producto: string; proveedor: string; precio: number; costo: number; quedan: number; porSemana: number }
  | { tipo: 'recordatorio'; turnos: number; precio: number; ausenciasTipicas: number }
  | { tipo: 'contenido'; producto: string; unidades: number; precio: number; visitas: number }

interface AccionDef {
  id: string
  dia: number // 0 = Lun … 6 = Dom
  hora: number
  minuto: number
  titulo: string
  corto: string
  riesgo: 'bajo' | 'medio'
  detalle: Detalle
  param: number | string
  /** Cuánto rindió "de verdad" vs. lo estimado (simulado). */
  factorReal: number
  notaReal: string
  /** Ajuste que Orbi hizo por lo aprendido la semana anterior. */
  etiqueta?: string
}

interface Accion extends AccionDef {
  estado: Estado
  auto: boolean
  editando: boolean
  paramPrevio: number | string
}

interface Semana {
  numero: number
  ventasBase: number
  variacionBase: number
  acciones: AccionDef[]
  aprendizajes: string[]
}

interface Impacto { pesos: number; clientes: number; unidades: number; resumen: string }
interface Resultado { pesos: number; clientes: number; unidades: number; ok: boolean; texto: string }
interface Evento { t: number; texto: string; color: string; destacado?: boolean }

// ─── Datos ───────────────────────────────────────────────────────────────────

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DURACION_VUELO = 8000

const TIPOS: Record<Tipo, { nombre: string; color: string; Icono: LucideIcon }> = {
  descuento: { nombre: 'Descuento', color: '#3B82F6', Icono: Percent },
  mensaje: { nombre: 'Mensaje', color: '#8B5CF6', Icono: MessageCircle },
  stock: { nombre: 'Stock', color: '#F59E0B', Icono: Package },
  recordatorio: { nombre: 'Recordatorio', color: '#34D399', Icono: CalendarCheck },
  contenido: { nombre: 'Contenido', color: '#F472B6', Icono: Megaphone },
}

const SEMANAS: Semana[] = [
  {
    numero: 36,
    ventasBase: 412000,
    variacionBase: 6,
    acciones: [
      {
        id: 's1-desc', dia: 1, hora: 10, minuto: 0, titulo: '20% en remeras básicas', corto: 'Remeras 20%', riesgo: 'medio',
        detalle: { tipo: 'descuento', producto: 'remeras básicas', codigoBase: 'REMERAS', precio: 3900, stock: 38, diasSinVenta: 40, margen: 52 },
        param: 20, factorReal: 1.22, notaReal: 'Rindió más de lo que calculé: el 20% alcanzó para moverlas.',
      },
      {
        id: 's1-cont', dia: 2, hora: 12, minuto: 0, titulo: 'Post: llegaron las camperas livianas', corto: 'Post camperas', riesgo: 'bajo',
        detalle: { tipo: 'contenido', producto: 'camperas livianas', unidades: 24, precio: 14000, visitas: 320 },
        param: 'Llegaron las camperas livianas para el entretiempo: 24 unidades, 4 colores, talles S a XXL. Vení a probártelas o pedilas por la tienda con envío en el día.',
        factorReal: 1.5, notaReal: 'Trajo 480 visitas, bastante más de lo que estimé.',
      },
      {
        id: 's1-msg', dia: 3, hora: 11, minuto: 0, titulo: 'Mensaje a 31 clientes que no vuelven', corto: 'Msj inactivos', riesgo: 'medio',
        detalle: { tipo: 'mensaje', clientes: 31, ticket: 12800, diasInactivos: 60 },
        param: 'Hola {nombre}, soy Caro de Casa Ramos. Hace un tiempo que no te vemos y entraron cosas nuevas que te pueden gustar. Si pasás esta semana tenés envío gratis con el código VOLVE. Te esperamos.',
        factorReal: 0.6, notaReal: 'Lo abrieron 12 de 31, casi todos después de las 18. Lo mandé a las 11: mal horario.',
      },
      {
        id: 's1-stock', dia: 4, hora: 9, minuto: 0, titulo: 'Reponer jean Mom, talles 38 a 42', corto: 'Reponer jean', riesgo: 'medio',
        detalle: { tipo: 'stock', producto: 'Jean Mom', proveedor: 'Textil Norte SRL', precio: 9800, costo: 5200, quedan: 4, porSemana: 5 },
        param: 12, factorReal: 1, notaReal: 'La orden llegó el viernes. El sábado se vendieron 6 sin quiebre.',
      },
      {
        id: 's1-rec', dia: 5, hora: 9, minuto: 0, titulo: 'Recordatorio a los 8 turnos de arreglos', corto: 'Turnos sáb', riesgo: 'bajo',
        detalle: { tipo: 'recordatorio', turnos: 8, precio: 6500, ausenciasTipicas: 2 },
        param: 'Hola {nombre}, te recordamos tu turno de arreglos hoy a las {hora} en Casa Ramos (Av. Rivadavia 4120). Respondé SÍ para confirmar o avisanos si no llegás.',
        factorReal: 1, notaReal: 'Confirmaron los 8. Cero ausencias.',
      },
    ],
    aprendizajes: [
      'Los que abrieron el mensaje del jueves lo hicieron después de las 18. La semana que viene lo mando a las 18:30.',
      'El 20% en remeras alcanzó de sobra: con los buzos pruebo 15% y cuido el margen.',
      'Los posts de novedades traen más visitas de lo que calculaba: subo la estimación.',
    ],
  },
  {
    numero: 37,
    ventasBase: 0, // se completa con lo que vendió en la semana 36
    variacionBase: 0,
    acciones: [
      {
        id: 's2-desc', dia: 1, hora: 10, minuto: 0, titulo: '15% en buzos oversize', corto: 'Buzos 15%', riesgo: 'medio',
        detalle: { tipo: 'descuento', producto: 'buzos oversize', codigoBase: 'BUZOS', precio: 9800, stock: 28, diasSinVenta: 33, margen: 48 },
        param: 15, factorReal: 1.1, notaReal: 'Con 15% se movieron igual: el margen que cuidé es ganancia.', etiqueta: 'Aprendido: 15% en vez de 20%',
      },
      {
        id: 's2-cont', dia: 2, hora: 12, minuto: 0, titulo: 'Post: looks con jean Mom', corto: 'Post looks', riesgo: 'bajo',
        detalle: { tipo: 'contenido', producto: 'jean Mom', unidades: 12, precio: 9800, visitas: 420 },
        param: 'Tres looks con el jean Mom que volvió a stock: con remera básica, con buzo oversize y con campera liviana. Todo disponible en la tienda con envío en el día.',
        factorReal: 1.2, notaReal: 'De nuevo por encima de lo estimado.', etiqueta: 'Aprendido: subí la estimación de visitas',
      },
      {
        id: 's2-msg', dia: 3, hora: 18, minuto: 30, titulo: 'Mensaje a 26 clientes que no vuelven', corto: 'Msj inactivos', riesgo: 'medio',
        detalle: { tipo: 'mensaje', clientes: 26, ticket: 12800, diasInactivos: 60 },
        param: 'Hola {nombre}, soy Caro de Casa Ramos. Volvió el jean Mom y hay buzos nuevos. Si pasás esta semana tenés envío gratis con el código VOLVE. Te esperamos.',
        factorReal: 1.4, notaReal: 'Lo abrieron 19 de 26. El horario era el problema.', etiqueta: 'Aprendido: va a las 18:30',
      },
      {
        id: 's2-stock', dia: 4, hora: 9, minuto: 0, titulo: 'Reponer remeras básicas', corto: 'Reponer remeras', riesgo: 'medio',
        detalle: { tipo: 'stock', producto: 'Remeras básicas', proveedor: 'Algodonera Sur', precio: 3900, costo: 1900, quedan: 9, porSemana: 8 },
        param: 24, factorReal: 1, notaReal: 'Llegaron el viernes, justo para el fin de semana.', etiqueta: 'Las liquidaste: hay que reponer',
      },
      {
        id: 's2-rec', dia: 5, hora: 9, minuto: 0, titulo: 'Recordatorio a los 11 turnos de arreglos', corto: 'Turnos sáb', riesgo: 'bajo',
        detalle: { tipo: 'recordatorio', turnos: 11, precio: 6500, ausenciasTipicas: 2 },
        param: 'Hola {nombre}, te recordamos tu turno de arreglos hoy a las {hora} en Casa Ramos (Av. Rivadavia 4120). Respondé SÍ para confirmar o avisanos si no llegás.',
        factorReal: 1, notaReal: 'Confirmaron 11 de 11.',
      },
    ],
    aprendizajes: [
      'El mensaje a las 18:30 casi duplicó la apertura: queda como horario fijo.',
      'Con 15% los buzos se movieron igual que las remeras con 20%: el margen que cuidé es ganancia.',
    ],
  },
]

// ─── Cálculo (todo local, determinístico) ────────────────────────────────────

const num = (v: number | string) => (typeof v === 'number' ? v : 0)
const str = (v: number | string) => (typeof v === 'string' ? v : '')
const pad = (n: number) => String(n).padStart(2, '0')
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

const tDe = (a: AccionDef) => (a.dia + (a.hora + a.minuto / 60) / 24) / 7
const horaAccion = (a: AccionDef) => `${DIAS[a.dia]} ${pad(a.hora)}:${pad(a.minuto)}`
function horaDe(t: number) {
  const dia = Math.min(6, Math.floor(t * 7))
  const frac = t * 7 - dia
  const h = Math.min(23, Math.floor(frac * 24))
  const m = Math.floor((frac * 24 - h) * 60)
  return `${DIAS[dia]} ${pad(h)}:${pad(m)}`
}

function codigoCupon(a: AccionDef) {
  return a.detalle.tipo === 'descuento' ? `${a.detalle.codigoBase}${num(a.param)}` : ''
}

function calcImpacto(a: AccionDef): Impacto {
  const d = a.detalle
  switch (d.tipo) {
    case 'descuento': {
      const pct = num(a.param)
      const unidades = Math.min(d.stock, Math.round(2 + pct * 0.6))
      return { pesos: unidades * d.precio * (1 - pct / 100), clientes: 0, unidades: 0, resumen: `${unidades} ventas · el margen queda en ${d.margen - pct}%` }
    }
    case 'mensaje': {
      const txt = str(a.param)
      let tasa = 0.16
      if (/%|env[ií]o|regalo/i.test(txt)) tasa += 0.05
      if (txt.length > 240) tasa -= 0.05
      if (!txt.includes('{nombre}')) tasa -= 0.03
      const clientes = Math.max(1, Math.round(d.clientes * tasa))
      return { pesos: clientes * d.ticket, clientes, unidades: 0, resumen: `${clientes} clientes vuelven (${Math.round(tasa * 100)}% de ${d.clientes})` }
    }
    case 'stock': {
      const cant = num(a.param)
      const cubre = Math.min(cant, d.porSemana * 2)
      return { pesos: cubre * d.precio, clientes: 0, unidades: cant, resumen: `${cubre} ventas que no perdés · la orden cuesta ${formatoARS(cant * d.costo)}` }
    }
    case 'recordatorio': {
      const evitadas = /confirm/i.test(str(a.param)) ? d.ausenciasTipicas : Math.max(1, d.ausenciasTipicas - 1)
      return { pesos: evitadas * d.precio, clientes: evitadas, unidades: 0, resumen: `${evitadas} ausencias menos sobre ${d.turnos} turnos` }
    }
    case 'contenido': {
      const txt = str(a.param)
      const visitas = d.visitas + (/#/.test(txt) ? 90 : 0) + (txt.length < 160 ? 40 : 0)
      const ventas = Math.max(1, Math.round(visitas * 0.007))
      return { pesos: ventas * d.precio, clientes: ventas, unidades: 0, resumen: `${visitas} visitas · ${ventas} ventas de ${d.producto}` }
    }
  }
}

function calcResultado(a: AccionDef): Resultado {
  const est = calcImpacto(a)
  const f = a.factorReal
  const d = a.detalle
  const pesos = Math.round((est.pesos * f) / 100) * 100
  const ok = f >= 0.9
  const clientes = Math.round(est.clientes * f)
  let texto = ''
  switch (d.tipo) {
    case 'descuento': {
      const unidades = Math.round(Math.min(d.stock, 2 + num(a.param) * 0.6) * f)
      texto = `${unidades} ventas con ${codigoCupon(a)}`
      break
    }
    case 'mensaje': {
      const abrieron = Math.round(d.clientes * (f >= 1 ? 0.74 : 0.39))
      texto = `${abrieron} de ${d.clientes} abrieron · ${clientes} volvieron`
      break
    }
    case 'stock':
      texto = `orden recibida · ${num(a.param)} u. en góndola · sin quiebre`
      break
    case 'recordatorio':
      texto = `${d.turnos - (f >= 1 ? 0 : 1)} confirmaron · ${f >= 1 ? 0 : 1} ausencias`
      break
    case 'contenido':
      texto = `${Math.round(d.visitas * f)} visitas · ${clientes} ventas`
      break
  }
  return { pesos, clientes, unidades: est.unidades, ok, texto }
}

function porQue(a: AccionDef) {
  const d = a.detalle
  switch (d.tipo) {
    case 'descuento': return `${cap(d.producto)}: ${d.stock} unidades, ${d.diasSinVenta} días sin venta, margen ${d.margen}%.`
    case 'mensaje': return `${d.clientes} clientes sin compras hace más de ${d.diasInactivos} días. Ticket promedio ${formatoARS(d.ticket)}.`
    case 'stock': return `${d.producto}: quedan ${d.quedan}, vendés ${d.porSemana} por semana. Se acaba el sábado.`
    case 'recordatorio': return `${d.turnos} turnos de arreglos el sábado. ${d.ausenciasTipicas} de cada ${d.turnos} faltan sin avisar.`
    case 'contenido': return `${cap(d.producto)}: ${d.unidades} unidades cargadas el lunes, todavía sin publicar.`
  }
}

function textoInicio(a: AccionDef) {
  const d = a.detalle
  switch (d.tipo) {
    case 'descuento': return `Cupón ${codigoCupon(a)} activo en ${d.producto}`
    case 'mensaje': return `Mensaje enviado a ${d.clientes} clientes por WhatsApp`
    case 'stock': return `Orden de compra enviada a ${d.proveedor} (${num(a.param)} u.)`
    case 'recordatorio': return `Recordatorio enviado a ${d.turnos} turnos`
    case 'contenido': return 'Post publicado en la tienda y en Instagram'
  }
}

function armarAcciones(sem: Semana, confianza: boolean): Accion[] {
  return sem.acciones.map(d => {
    const auto = confianza && d.riesgo === 'bajo'
    return { ...d, estado: auto ? 'aprobada' : 'pendiente', auto, editando: false, paramPrevio: d.param }
  })
}

function metricasEn(p: number, ventasBase: number, acciones: Accion[]) {
  const aprobadas = acciones.filter(a => a.estado === 'aprobada')
  let base = ventasBase * 0.99
  for (const a of acciones) {
    if (a.detalle.tipo === 'stock' && a.estado !== 'aprobada') base -= a.detalle.porSemana * a.detalle.precio * 0.5
  }
  let ventas = base * p
  let clientes = 0
  let unidades = 0
  let ejecutadas = 0
  for (const a of aprobadas) {
    const t0 = tDe(a)
    if (p >= t0) ejecutadas++
    const k = clamp01((p - t0) / 0.08)
    const r = calcResultado(a)
    if (a.detalle.tipo !== 'stock') ventas += r.pesos * k
    else unidades += r.unidades * k
    if (a.detalle.tipo !== 'descuento') clientes += r.clientes * k
  }
  return { ventas: Math.round(ventas), clientes: Math.round(clientes), unidades: Math.round(unidades), ejecutadas, total: aprobadas.length }
}

function armarEventos(acciones: Accion[]): Evento[] {
  const aprobadas = acciones.filter(a => a.estado === 'aprobada')
  const ev: Evento[] = [{ t: 0, texto: `Semana en vuelo · ${aprobadas.length} ${aprobadas.length === 1 ? 'acción programada' : 'acciones programadas'}`, color: C.muted }]
  for (const a of aprobadas) {
    const t0 = tDe(a)
    const color = TIPOS[a.detalle.tipo].color
    const r = calcResultado(a)
    ev.push({ t: t0, texto: textoInicio(a), color })
    ev.push({ t: t0 + 0.06, texto: a.detalle.tipo === 'stock' ? r.texto : `${r.texto} · ${formatoARS(r.pesos)}`, color, destacado: true })
  }
  ev.push({ t: 0.995, texto: 'Semana completa. Armando el informe del domingo…', color: C.orbiLight })
  return ev.sort((x, y) => x.t - y.t)
}

// ─── Geometría de la órbita ──────────────────────────────────────────────────

const CX = 340
const CY = 340
const R = 208
const R2 = 272
const CIRC = 2 * Math.PI * R

const angDe = (t: number) => -90 + t * 360
function polar(r: number, ang: number): [number, number] {
  const rad = (ang * Math.PI) / 180
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)]
}

const ESTRELLAS = Array.from({ length: 46 }, (_, i) => ({
  x: (i * 173 + 91) % 680,
  y: (i * 251 + 37) % 680,
  r: i % 5 === 0 ? 1.6 : 0.9,
  d: (i % 7) * 0.6,
}))

const CSS = `
  @keyframes pl-vuelo { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes pl-trail { from { stroke-dashoffset: ${CIRC.toFixed(1)}; } to { stroke-dashoffset: 0; } }
  @keyframes pl-parpadeo { 0%, 100% { opacity: 1; } 50% { opacity: .2; } }
  @keyframes pl-pop { 0% { transform: scale(.4); opacity: 0; } 65% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
  @keyframes pl-subir { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @keyframes pl-glow { 0%, 100% { opacity: .35; } 50% { opacity: .8; } }
  @keyframes pl-barra { from { width: 0; } to { width: 100%; } }
  .pl-range { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 99px; background: rgba(148,163,184,.25); outline: none; }
  .pl-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #fff; border: 3px solid #3B82F6; box-shadow: 0 0 0 4px rgba(59,130,246,.25); cursor: pointer; }
  .pl-range::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: #fff; border: 3px solid #3B82F6; cursor: pointer; }
`

// ─── Componente principal ────────────────────────────────────────────────────

export default function Piloto() {
  const [semanaIdx, setSemanaIdx] = useState(0)
  const [fase, setFase] = useState<Fase>('intro')
  const [modoConfianza, setModoConfianza] = useState(false)
  const [acciones, setAcciones] = useState<Accion[]>(() => armarAcciones(SEMANAS[0], false))
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [parpadeoId, setParpadeoId] = useState<string | null>(null)
  const [progreso, setProgreso] = useState(0)
  const [historial, setHistorial] = useState<{ ventas: number; variacion: number } | null>(null)

  const semana = SEMANAS[semanaIdx]
  const ventasBase = semanaIdx === 0 ? semana.ventasBase : historial?.ventas ?? 480000
  const variacionBase = semanaIdx === 0 ? semana.variacionBase : historial?.variacion ?? 12

  // Semana en vuelo: un intervalo avanza el progreso 0→1 en 8 s.
  useEffect(() => {
    if (fase !== 'vuelo') return
    const inicio = performance.now()
    let fin: ReturnType<typeof setTimeout> | undefined
    const id = setInterval(() => {
      const p = Math.min(1, (performance.now() - inicio) / DURACION_VUELO)
      setProgreso(p)
      if (p >= 1) {
        clearInterval(id)
        fin = setTimeout(() => setFase('reporte'), 1200)
      }
    }, 40)
    return () => { clearInterval(id); if (fin) clearTimeout(fin) }
  }, [fase])

  // El satélite editado parpadea un ratito.
  useEffect(() => {
    if (!parpadeoId) return
    const t = setTimeout(() => setParpadeoId(null), 1100)
    return () => clearTimeout(t)
  }, [parpadeoId])

  const aprobadas = acciones.filter(a => a.estado === 'aprobada')
  const impactoTotal = aprobadas.reduce((s, a) => s + calcImpacto(a).pesos, 0)
  const metricas = metricasEn(fase === 'reporte' ? 1 : progreso, ventasBase, acciones)
  const final = metricasEn(1, ventasBase, acciones)
  const variacionFinal = Math.round((final.ventas / ventasBase - 1) * 100)
  const eventos = armarEventos(acciones)
  const registros = eventos.filter(e => e.t <= progreso).reverse()

  const actualizar = (id: string, fn: (a: Accion) => Accion) => setAcciones(prev => prev.map(a => (a.id === id ? fn(a) : a)))
  const aprobar = (id: string) => actualizar(id, a => ({ ...a, estado: 'aprobada', auto: false, editando: false }))
  const descartar = (id: string) => actualizar(id, a => ({ ...a, estado: 'descartada', auto: false, editando: false }))
  const restaurar = (id: string) => actualizar(id, a => ({ ...a, estado: 'pendiente' }))
  const editar = (id: string) => actualizar(id, a => ({ ...a, editando: true, paramPrevio: a.param }))
  const cambiarParam = (id: string, v: number | string) => actualizar(id, a => ({ ...a, param: v }))
  const cancelar = (id: string) => actualizar(id, a => ({ ...a, editando: false, param: a.paramPrevio }))
  const guardar = (id: string) => { actualizar(id, a => ({ ...a, editando: false, estado: 'aprobada', auto: false })); setParpadeoId(id) }

  const toggleConfianza = () => {
    const on = !modoConfianza
    setModoConfianza(on)
    setAcciones(prev => prev.map(a => {
      if (a.riesgo !== 'bajo') return a
      if (on) return a.estado === 'pendiente' ? { ...a, estado: 'aprobada', auto: true } : a
      return a.auto ? { ...a, estado: 'pendiente', auto: false } : a
    }))
  }

  const ejecutar = () => { setHoverId(null); setProgreso(0); setFase('vuelo') }

  const siguienteSemana = () => {
    setHistorial({ ventas: final.ventas, variacion: variacionFinal })
    setSemanaIdx(1)
    setAcciones(armarAcciones(SEMANAS[1], modoConfianza))
    setProgreso(0)
    setHoverId(null)
    setFase('intro')
  }

  const reiniciar = () => {
    setSemanaIdx(0)
    setAcciones(armarAcciones(SEMANAS[0], false))
    setModoConfianza(false)
    setHistorial(null)
    setProgreso(0)
    setHoverId(null)
    setParpadeoId(null)
    setFase('intro')
  }

  // Texto de Orbi según la fase.
  let textoOrbi = ''
  if (fase === 'intro') {
    textoOrbi = semanaIdx === 0
      ? `Buen domingo. Miré la semana pasada: vendiste ${formatoARS(ventasBase)} (+${variacionBase}%), pero las remeras básicas llevan 40 días sin rotar y 31 clientes hace más de 2 meses que no vuelven. Te armé 5 movidas para esta semana.`
      : `Buen domingo. La semana pasada vendiste ${formatoARS(ventasBase)} (${variacionBase >= 0 ? '+' : ''}${variacionBase}%). Aprendí un par de cosas y ajusté el plan: el mensaje va el jueves a las 18:30, y las remeras que liquidaste hay que reponerlas. Te armé 5 movidas.`
  } else if (fase === 'plan') {
    textoOrbi = 'Cada movida tiene el porqué, el impacto estimado y lo que va a salir, tal cual. Aprobá, editá o descartá con un toque. Lo aprobado se ejecuta solo, a su hora.'
  } else if (fase === 'vuelo') {
    textoOrbi = 'Semana en vuelo. Voy ejecutando lo que aprobaste y te cuento en vivo.'
  } else {
    textoOrbi = `Buen domingo otra vez. Vendiste ${formatoARS(final.ventas)} (${variacionFinal >= 0 ? '+' : ''}${variacionFinal}% contra la semana anterior). Esto fue lo que pasó con cada movida:`
  }

  const faseChip = fase === 'intro' || fase === 'plan'
    ? { texto: 'Domingo · planificación', color: C.orbiLight }
    : fase === 'vuelo' ? { texto: 'Semana en vuelo', color: C.primaryLight } : { texto: 'Domingo siguiente · informe', color: C.success }

  return (
    <div style={{ padding: 26, minHeight: 600, fontFamily: FONT, color: C.body, position: 'relative' }}>
      <style>{CSS}</style>

      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Chip color={C.primaryLight}><Store size={12} /> Casa Ramos · indumentaria</Chip>
          <Etiqueta color={C.muted}>Plan de vuelo · Semana {semana.numero}</Etiqueta>
          <Chip key={fase} color={faseChip.color} style={{ animation: 'pl-subir .4s ease both' }}>
            {fase === 'vuelo' && <span style={{ width: 7, height: 7, borderRadius: 99, background: faseChip.color, animation: 'pr-blink 1s infinite' }} />}
            {faseChip.texto}
          </Chip>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Interruptor activo={modoConfianza} onToggle={toggleConfianza} deshabilitado={fase === 'vuelo' || fase === 'reporte'} />
          <Boton variante="fantasma" tam="sm" onClick={reiniciar}><RotateCcw size={13} /> Reiniciar</Boton>
        </div>
      </div>

      {/* Orbi */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 18 }}>
        <OrbiAvatar size={38} />
        <div style={{ flex: 1, background: 'linear-gradient(135deg, rgba(59,130,246,.12), rgba(139,92,246,.14))', border: '1px solid rgba(139,92,246,.32)', borderRadius: '4px 18px 18px 18px', padding: '14px 18px', minHeight: 54 }}>
          <Maquina texto={textoOrbi} />
          {fase === 'intro' && (
            <div style={{ marginTop: 12, animation: 'pr-fade-up .5s ease both', animationDelay: '.6s' }}>
              <Boton onClick={() => setFase('plan')}><Eye size={15} /> Ver plan <ChevronRight size={15} /></Boton>
            </div>
          )}
        </div>
      </div>

      {/* Cuerpo: órbita a la izquierda, acciones a la derecha */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 55fr) minmax(0, 45fr)', gap: 24, marginTop: 20, alignItems: 'start' }}>
        <div>
          <Orbita acciones={acciones} fase={fase} progreso={progreso} hoverId={hoverId} onHover={setHoverId} parpadeoId={parpadeoId} ventas={metricas.ventas} />
          {fase === 'plan' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 6, animation: 'pr-fade-up .5s ease both', animationDelay: '.5s' }}>
              <Boton tam="lg" disabled={aprobadas.length === 0} onClick={ejecutar} style={{ minWidth: 280 }}>
                <Rocket size={18} /> Ejecutar plan{aprobadas.length > 0 ? ` · ${aprobadas.length} ${aprobadas.length === 1 ? 'acción' : 'acciones'}` : ''}
              </Boton>
              <div style={{ fontSize: 12, color: C.subtle }}>{aprobadas.length === 0 ? 'Aprobá al menos una movida para despegar.' : 'Cada acción sale sola, a su día y su hora.'}</div>
            </div>
          )}
          {fase === 'intro' && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              {(Object.keys(TIPOS) as Tipo[]).map(t => (
                <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: C.muted }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: TIPOS[t].color }} />{TIPOS[t].nombre}
                </span>
              ))}
            </div>
          )}
          {fase === 'vuelo' && (
            <div style={{ marginTop: 6, padding: '0 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: C.subtle, fontFamily: FONT_MONO, marginBottom: 6 }}>
                {DIAS.map(d => <span key={d}>{d}</span>)}
              </div>
              <div style={{ height: 4, borderRadius: 99, background: 'rgba(148,163,184,.15)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progreso * 100}%`, background: `linear-gradient(90deg, ${C.primary}, ${C.orbi})`, borderRadius: 99 }} />
              </div>
            </div>
          )}
          {fase === 'reporte' && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 6, fontSize: 11.5, color: C.muted }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: C.success }} /> Rindió como se esperaba o mejor</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: C.error }} /> Por debajo de lo estimado</span>
            </div>
          )}
        </div>

        <div className="pr-scroll" style={{ maxHeight: 720, overflowY: 'auto', paddingRight: 6 }}>
          {fase === 'intro' && <ResumenPrevio acciones={acciones} ventasBase={ventasBase} variacionBase={variacionBase} />}

          {fase === 'plan' && (
            <>
              <div style={{ position: 'sticky', top: 0, zIndex: 3, padding: '10px 14px', marginBottom: 12, borderRadius: 14, background: 'rgba(7,11,22,.92)', border: `1px solid ${C.border}`, backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, animation: 'pr-fade-up .4s ease both' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {acciones.map(a => (
                      <span key={a.id} style={{ width: 9, height: 9, borderRadius: 99, transition: 'background .3s', background: a.estado === 'aprobada' ? TIPOS[a.detalle.tipo].color : a.estado === 'descartada' ? 'rgba(148,163,184,.15)' : 'rgba(148,163,184,.4)' }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{aprobadas.length} de {acciones.length} aprobadas</span>
                </div>
                <span key={Math.round(impactoTotal)} style={{ fontSize: 13, color: C.muted, animation: 'pl-subir .35s ease both' }}>
                  impacto estimado <b style={{ color: C.success, fontFamily: FONT_MONO }}>+{formatoARS(impactoTotal)}</b>
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {acciones.map((a, i) => (
                  <TarjetaAccion
                    key={a.id} a={a} indice={i} resaltada={hoverId === a.id}
                    onHover={setHoverId} onAprobar={aprobar} onEditar={editar} onDescartar={descartar} onRestaurar={restaurar}
                    onCambiarParam={cambiarParam} onGuardar={guardar} onCancelar={cancelar}
                  />
                ))}
              </div>
            </>
          )}

          {fase === 'vuelo' && (
            <div style={{ animation: 'pr-fade-up .5s ease both' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <Metrica icono={TrendingUp} color={C.primaryLight} valor={formatoARS(metricas.ventas)} etiqueta="Ventas de la semana" />
                <Metrica icono={Users} color={C.orbiLight} valor={String(metricas.clientes)} etiqueta="Clientes que volvieron" />
                <Metrica icono={Boxes} color={TIPOS.stock.color} valor={`${metricas.unidades} u.`} etiqueta="Stock repuesto" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 2px 8px' }}>
                <Etiqueta color={C.muted}>Registro en vivo</Etiqueta>
                <span style={{ fontSize: 12, color: C.subtle, fontFamily: FONT_MONO }}>{metricas.ejecutadas}/{metricas.total} ejecutadas · {horaDe(progreso)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {registros.map(e => (
                  <div key={`${e.t}-${e.texto}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 12px', borderRadius: 12, background: e.destacado ? `${e.color}14` : C.surface, border: `1px solid ${e.destacado ? `${e.color}55` : C.border}`, animation: 'pr-fade-up .4s ease both' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: e.color, marginTop: 5, flexShrink: 0, boxShadow: `0 0 8px ${e.color}` }} />
                    <span style={{ fontSize: 12, color: C.subtle, fontFamily: FONT_MONO, whiteSpace: 'nowrap', marginTop: 1 }}>{horaDe(e.t)}</span>
                    <span style={{ fontSize: 13, color: e.destacado ? C.text : C.body, lineHeight: 1.4 }}>{e.texto}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {fase === 'reporte' && (
            <Informe
              acciones={acciones} final={final} variacion={variacionFinal} aprendizajes={semana.aprendizajes}
              esUltima={semanaIdx === SEMANAS.length - 1} onSiguiente={siguienteSemana} onReiniciar={reiniciar}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Órbita semanal (SVG) ────────────────────────────────────────────────────

function Orbita({ acciones, fase, progreso, hoverId, onHover, parpadeoId, ventas }: {
  acciones: Accion[]; fase: Fase; progreso: number; hoverId: string | null; onHover: (id: string | null) => void; parpadeoId: string | null; ventas: number
}) {
  const enVuelo = fase === 'vuelo' || fase === 'reporte'
  const mostrarSatelites = fase !== 'intro'
  return (
    <svg viewBox="0 0 680 680" style={{ width: '100%', maxWidth: 640, height: 'auto', display: 'block', margin: '0 auto', overflow: 'visible' }}>
      <defs>
        <radialGradient id="pl-planeta" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="45%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1E1B4B" />
        </radialGradient>
        <linearGradient id="pl-estela" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#60A5FA" stopOpacity="0" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity=".95" />
        </linearGradient>
        <linearGradient id="pl-trail-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>

      {ESTRELLAS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" style={{ animation: `pr-twinkle ${3 + (i % 4)}s ease-in-out infinite`, animationDelay: `${s.d}s` }} />
      ))}

      {/* anillos */}
      <circle cx={CX} cy={CY} r={R2} fill="none" stroke="rgba(148,163,184,.12)" strokeDasharray="2 6" />
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(148,163,184,.28)" strokeWidth={1.5} />
      <circle cx={CX} cy={CY} r={R + 40} fill="none" stroke="rgba(59,130,246,.06)" strokeWidth={80} />

      {enVuelo && (
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="url(#pl-trail-grad)" strokeWidth={3} strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={CIRC} transform={`rotate(-90 ${CX} ${CY})`}
          style={{ animation: `pl-trail ${DURACION_VUELO}ms linear forwards`, filter: 'drop-shadow(0 0 6px rgba(96,165,250,.7))' }} />
      )}

      {/* días */}
      {DIAS.map((d, i) => {
        const [x, y] = polar(R, angDe(i / 7))
        const pasado = (fase === 'vuelo' && progreso * 7 >= i + 0.02) || fase === 'reporte'
        const esDom = i === 6
        return (
          <g key={d}>
            <circle cx={x} cy={y} r={16} fill={pasado ? 'rgba(59,130,246,.4)' : 'rgba(11,17,32,.96)'} stroke={esDom ? C.orbi : pasado ? C.primaryLight : 'rgba(148,163,184,.5)'} strokeWidth={1.6} style={{ transition: 'fill .4s, stroke .4s' }} />
            <text x={x} y={y + 4} textAnchor="middle" fontSize={10.5} fontWeight={700} fill={pasado ? '#fff' : esDom ? C.orbiLight : C.muted} fontFamily={FONT}>{d}</text>
          </g>
        )
      })}

      {/* satélites (acciones) */}
      {mostrarSatelites && acciones.map((a, i) => {
        const t = tDe(a)
        const [x, y] = polar(R2, angDe(t))
        const [dx, dy] = polar(R, angDe(a.dia / 7))
        const meta = TIPOS[a.detalle.tipo]
        const Icono = meta.Icono
        const descartada = a.estado === 'descartada'
        const aprobada = a.estado === 'aprobada'
        const ux = (x - CX) / R2
        const uy = (y - CY) / R2
        const ejecutada = aprobada && ((fase === 'vuelo' && progreso >= t) || fase === 'reporte')
        const hover = hoverId === a.id
        const res = fase === 'reporte' && aprobada ? calcResultado(a) : null
        return (
          <g key={a.id} style={{ transition: 'transform .9s ease-in, opacity .8s ease-in', transform: descartada ? `translate(${ux * 170}px, ${uy * 170}px)` : 'none', opacity: descartada ? 0 : 1, pointerEvents: descartada ? 'none' : 'auto' }}>
            <line x1={dx} y1={dy} x2={x} y2={y} stroke={meta.color} strokeOpacity={aprobada ? 0.6 : 0.28} strokeWidth={aprobada ? 1.6 : 1} strokeDasharray={aprobada ? undefined : '3 4'} style={{ transition: 'stroke-opacity .4s' }} />
            <g style={{ animation: 'pl-pop .55s cubic-bezier(.2,.8,.2,1) both', animationDelay: `${120 + i * 110}ms`, transformBox: 'fill-box', transformOrigin: 'center' }}>
              <g
                onMouseEnter={() => onHover(a.id)} onMouseLeave={() => onHover(null)}
                style={{ cursor: 'pointer', transition: 'transform .2s', transform: hover ? 'scale(1.12)' : 'scale(1)', transformBox: 'fill-box', transformOrigin: 'center', animation: parpadeoId === a.id ? 'pl-parpadeo .3s ease 3' : undefined }}
              >
                {aprobada && <circle cx={x} cy={y} r={31} fill={meta.color} opacity={0.16} style={{ animation: 'pr-pulse 2.4s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }} />}
                {hover && !aprobada && <circle cx={x} cy={y} r={29} fill={meta.color} opacity={0.12} />}
                {ejecutada && <circle cx={x} cy={y} r={22} fill="none" stroke={meta.color} strokeWidth={2.5} style={{ animation: 'pr-ping 1s ease-out forwards', transformBox: 'fill-box', transformOrigin: 'center' }} />}
                <circle cx={x} cy={y} r={21} fill={aprobada ? meta.color : 'rgba(11,17,32,.96)'} stroke={aprobada ? '#fff' : meta.color} strokeOpacity={aprobada ? 0.4 : 0.9} strokeWidth={1.6} strokeDasharray={aprobada ? undefined : '5 4'}
                  style={{ transition: 'fill .4s', filter: aprobada ? `drop-shadow(0 0 10px ${meta.color}AA)` : undefined }} />
                <Icono x={x - 10} y={y - 10} width={20} height={20} color={aprobada ? '#fff' : meta.color} strokeWidth={2.2} />
                {a.auto && aprobada && (
                  <g>
                    <circle cx={x - 16} cy={y - 16} r={8.5} fill={C.success} stroke={C.bg} strokeWidth={2} />
                    <ShieldCheck x={x - 21} y={y - 21} width={10} height={10} color="#052E16" strokeWidth={3} />
                  </g>
                )}
                {res && (
                  <g style={{ animation: 'pl-pop .5s ease both', transformBox: 'fill-box', transformOrigin: 'center' }}>
                    <circle cx={x + 16} cy={y - 16} r={9.5} fill={res.ok ? C.success : C.error} stroke={C.bg} strokeWidth={2} />
                    {res.ok
                      ? <Check x={x + 10.5} y={y - 21.5} width={11} height={11} color="#052E16" strokeWidth={3.2} />
                      : <X x={x + 10.5} y={y - 21.5} width={11} height={11} color="#450A0A" strokeWidth={3.2} />}
                  </g>
                )}
                <text x={x} y={y + 38} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={aprobada ? C.text : C.muted} fontFamily={FONT}>{a.corto}</text>
                <text x={x} y={y + 51} textAnchor="middle" fontSize={9.5} fill={C.subtle} fontFamily={FONT_MONO}>{horaAccion(a)}</text>
              </g>
            </g>
          </g>
        )
      })}

      {/* planeta central */}
      <ellipse cx={CX} cy={CY} rx={102} ry={24} fill="none" stroke="rgba(96,165,250,.45)" strokeWidth={2} transform={`rotate(-18 ${CX} ${CY})`} />
      <circle cx={CX} cy={CY} r={64} fill="url(#pl-planeta)" style={{ filter: 'drop-shadow(0 0 34px rgba(59,130,246,.4))' }} />
      <path d={`M ${CX - 102} ${CY} A 102 24 0 0 0 ${CX + 102} ${CY}`} fill="none" stroke="rgba(147,197,253,.75)" strokeWidth={2.5} transform={`rotate(-18 ${CX} ${CY})`} />
      {enVuelo ? (
        <g>
          <text x={CX} y={CY - 2} textAnchor="middle" fontSize={19} fontWeight={800} fill="#fff" fontFamily={FONT_MONO}>{formatoARS(ventas)}</text>
          <text x={CX} y={CY + 16} textAnchor="middle" fontSize={9.5} fontWeight={700} letterSpacing="0.1em" fill="rgba(255,255,255,.7)" fontFamily={FONT}>VENTAS SEMANA</text>
        </g>
      ) : (
        <g>
          <text x={CX} y={CY - 1} textAnchor="middle" fontSize={15} fontWeight={800} fill="#fff" fontFamily={FONT_DISPLAY}>Casa Ramos</text>
          <text x={CX} y={CY + 16} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,.7)" fontFamily={FONT}>indumentaria</text>
        </g>
      )}

      {/* aguja / cometa */}
      {enVuelo && (
        <g transform={`rotate(-90 ${CX} ${CY})`}>
          <g style={{ transformOrigin: `${CX}px ${CY}px`, transformBox: 'view-box', animation: `pl-vuelo ${DURACION_VUELO}ms linear forwards` }}>
            <path d={`M ${polar(R, -18).join(' ')} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="url(#pl-estela)" strokeWidth={5} strokeLinecap="round" />
            <circle cx={CX + R} cy={CY} r={17} fill={C.primaryLight} opacity={0.22} style={{ animation: 'pl-glow 1s ease-in-out infinite' }} />
            <circle cx={CX + R} cy={CY} r={7.5} fill="#fff" style={{ filter: 'drop-shadow(0 0 9px #93C5FD)' }} />
          </g>
        </g>
      )}
    </svg>
  )
}

// ─── Tarjeta de acción ───────────────────────────────────────────────────────

function TarjetaAccion({ a, indice, resaltada, onHover, onAprobar, onEditar, onDescartar, onRestaurar, onCambiarParam, onGuardar, onCancelar }: {
  a: Accion; indice: number; resaltada: boolean
  onHover: (id: string | null) => void
  onAprobar: (id: string) => void; onEditar: (id: string) => void; onDescartar: (id: string) => void; onRestaurar: (id: string) => void
  onCambiarParam: (id: string, v: number | string) => void; onGuardar: (id: string) => void; onCancelar: (id: string) => void
}) {
  const meta = TIPOS[a.detalle.tipo]
  const Icono = meta.Icono
  const imp = calcImpacto(a)
  const descartada = a.estado === 'descartada'
  const aprobada = a.estado === 'aprobada'

  return (
    <Tarjeta
      className={descartada ? undefined : 'pr-hover-lift'}
      style={{
        padding: descartada ? '12px 16px' : 16,
        borderColor: resaltada ? meta.color : aprobada ? `${meta.color}66` : C.border,
        boxShadow: resaltada ? `0 0 0 1px ${meta.color}55, 0 14px 44px ${meta.color}22` : undefined,
        opacity: descartada ? 0.55 : 1,
        animation: 'pr-fade-up .5s cubic-bezier(.2,.8,.2,1) both',
        animationDelay: `${120 + indice * 110}ms`,
        transition: 'border-color .25s, box-shadow .25s, opacity .4s',
      }}
    >
      <div onMouseEnter={() => onHover(a.id)} onMouseLeave={() => onHover(null)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Chip color={meta.color}><Icono size={12} /> {meta.nombre}</Chip>
            <span style={{ fontSize: 12, color: C.muted, fontFamily: FONT_MONO, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> {horaAccion(a)}</span>
          </div>
          {aprobada && a.auto && <Chip color={C.success}><ShieldCheck size={12} /> Auto-aprobada · bajo riesgo</Chip>}
          {aprobada && !a.auto && <Chip color={C.success}><Check size={12} /> Aprobada</Chip>}
          {descartada && <Chip color={C.subtle}>Descartada</Chip>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 800, color: descartada ? C.muted : C.text, letterSpacing: '-0.01em', textDecoration: descartada ? 'line-through' : 'none' }}>{a.titulo}</div>
          {descartada && <Boton variante="suave" tam="sm" color={C.primaryLight} onClick={() => onRestaurar(a.id)}><Undo2 size={13} /> Restaurar</Boton>}
        </div>

        {!descartada && (
          <>
            {a.etiqueta && (
              <div style={{ marginTop: 8 }}>
                <Chip color={C.orbiLight}><Sparkles size={12} /> {a.etiqueta}</Chip>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
              <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(2,6,23,.45)', border: `1px solid ${C.border}` }}>
                <Etiqueta color={C.subtle} style={{ marginBottom: 4 }}>Por qué</Etiqueta>
                <div style={{ fontSize: 12.5, color: C.body, lineHeight: 1.45 }}>{porQue(a)}</div>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 12, background: `${meta.color}10`, border: `1px solid ${meta.color}33` }}>
                <Etiqueta color={C.subtle} style={{ marginBottom: 4 }}>{a.detalle.tipo === 'stock' ? 'Ventas que protegés' : 'Impacto estimado'}</Etiqueta>
                <div key={Math.round(imp.pesos)} style={{ fontSize: 17, fontWeight: 800, color: C.success, fontFamily: FONT_MONO, animation: 'pl-subir .3s ease both' }}>+{formatoARS(imp.pesos)}</div>
                <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.4, marginTop: 2 }}>{imp.resumen}</div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <Etiqueta color={C.subtle} style={{ marginBottom: 6 }}>Sale así</Etiqueta>
              <VistaPrevia a={a} />
            </div>

            {a.editando && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: `1px solid ${meta.color}66`, background: `${meta.color}0D`, animation: 'pr-fade-up .3s ease both' }}>
                <Editor a={a} onCambiar={v => onCambiarParam(a.id, v)} />
                <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                  <Boton variante="fantasma" tam="sm" onClick={() => onCancelar(a.id)}>Cancelar</Boton>
                  <Boton tam="sm" color={meta.color} onClick={() => onGuardar(a.id)}><Check size={13} /> Guardar y aprobar</Boton>
                </div>
              </div>
            )}

            {!a.editando && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {aprobada
                  ? <Boton variante="suave" tam="sm" color={C.success} style={{ cursor: 'default' }}><Check size={13} /> Aprobada</Boton>
                  : <Boton tam="sm" color={meta.color} onClick={() => onAprobar(a.id)}><Check size={13} /> Aprobar</Boton>}
                <Boton variante="fantasma" tam="sm" onClick={() => onEditar(a.id)}><Pencil size={13} /> Editar</Boton>
                <Boton variante="fantasma" tam="sm" onClick={() => onDescartar(a.id)} style={{ marginLeft: 'auto', color: C.muted }}><X size={13} /> Descartar</Boton>
              </div>
            )}
          </>
        )}
      </div>
    </Tarjeta>
  )
}

// ─── Editor inline ───────────────────────────────────────────────────────────

function Editor({ a, onCambiar }: { a: Accion; onCambiar: (v: number | string) => void }) {
  const d = a.detalle
  if (d.tipo === 'descuento') {
    const pct = num(a.param)
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontSize: 12.5, color: C.muted }}>Porcentaje de descuento</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: FONT_MONO }}>{pct}%</span>
        </div>
        <input className="pl-range" type="range" min={5} max={40} step={5} value={pct} onChange={e => onCambiar(Number(e.target.value))} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.subtle, marginTop: 4 }}><span>5%</span><span>Orbi recalcula el impacto en vivo</span><span>40%</span></div>
      </div>
    )
  }
  if (d.tipo === 'stock') {
    const cant = num(a.param)
    const paso = (delta: number) => onCambiar(Math.max(4, Math.min(40, cant + delta)))
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12.5, color: C.muted }}>Cantidad a reponer</div>
          <div style={{ fontSize: 11.5, color: C.subtle, marginTop: 2 }}>Vendés {d.porSemana} por semana. Cubrís {Math.round((cant / d.porSemana) * 10) / 10} semanas.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" className="pr-btn" onClick={() => paso(-2)} style={botonPaso}><Minus size={14} /></button>
          <span style={{ minWidth: 56, textAlign: 'center', fontSize: 22, fontWeight: 800, color: C.text, fontFamily: FONT_MONO }}>{cant}</span>
          <button type="button" className="pr-btn" onClick={() => paso(2)} style={botonPaso}><Plus size={14} /></button>
        </div>
      </div>
    )
  }
  const txt = str(a.param)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, color: C.muted }}>{d.tipo === 'contenido' ? 'Texto del post' : 'Texto del mensaje'}</span>
        <span style={{ fontSize: 11.5, color: txt.length > 240 ? C.warning : C.subtle, fontFamily: FONT_MONO }}>{txt.length} caracteres</span>
      </div>
      <textarea className="pr-input" rows={4} value={txt} onChange={e => onCambiar(e.target.value)} style={{ resize: 'vertical', fontSize: 13, lineHeight: 1.45 }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {d.tipo === 'mensaje' && <Chip color={txt.includes('{nombre}') ? C.success : C.warning} style={{ fontWeight: 600 }}>{'{nombre}'} personaliza</Chip>}
        {d.tipo === 'mensaje' && <Chip color={/%|env[ií]o|regalo/i.test(txt) ? C.success : C.subtle} style={{ fontWeight: 600 }}>Con beneficio: más respuesta</Chip>}
        {d.tipo === 'recordatorio' && <Chip color={/confirm/i.test(txt) ? C.success : C.warning} style={{ fontWeight: 600 }}>Pedir confirmación baja ausencias</Chip>}
        {d.tipo === 'contenido' && <Chip color={txt.length < 160 ? C.success : C.subtle} style={{ fontWeight: 600 }}>Corto rinde más</Chip>}
        <Chip color={txt.length > 240 ? C.warning : C.success} style={{ fontWeight: 600 }}>{txt.length > 240 ? 'Muy largo: baja la respuesta' : 'Largo justo'}</Chip>
      </div>
    </div>
  )
}

const botonPaso: CSSProperties = { width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.borderStrong}`, background: 'rgba(2,6,23,.5)', color: C.text, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }

// ─── Vistas previas (lo que sale, tal cual) ─────────────────────────────────

function VistaPrevia({ a }: { a: Accion }) {
  const d = a.detalle
  switch (d.tipo) {
    case 'descuento':
      return (
        <div style={{ display: 'flex', borderRadius: 12, overflow: 'hidden', border: `1px dashed ${TIPOS.descuento.color}88`, background: 'linear-gradient(135deg, rgba(59,130,246,.18), rgba(30,41,59,.5))' }}>
          <div style={{ padding: '12px 14px', flex: 1 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.12em', color: C.primaryLight }}>CUPÓN · CASA RAMOS</div>
            <div key={codigoCupon(a)} style={{ fontSize: 24, fontWeight: 900, color: '#fff', fontFamily: FONT_MONO, letterSpacing: '.06em', marginTop: 2, animation: 'pl-subir .3s ease both' }}>{codigoCupon(a)}</div>
            <div style={{ fontSize: 12, color: C.body, marginTop: 2 }}>{num(a.param)}% en {d.producto} · válido de {DIAS[a.dia].toLowerCase()} a domingo · en tienda y en el local</div>
          </div>
          <div style={{ width: 74, borderLeft: `1px dashed ${TIPOS.descuento.color}88`, display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 900, color: C.primaryLight, fontFamily: FONT_DISPLAY }}>{num(a.param)}%</div>
        </div>
      )
    case 'mensaje':
    case 'recordatorio':
      return (
        <div style={{ borderRadius: 12, padding: 12, background: 'rgba(11,20,16,.7)', border: '1px solid rgba(37,211,102,.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#25D366', fontWeight: 700, marginBottom: 8 }}><MessageCircle size={12} /> WhatsApp · Casa Ramos → {d.tipo === 'mensaje' ? `${d.clientes} clientes` : `${d.turnos} turnos`}</div>
          <div style={{ display: 'inline-block', maxWidth: '92%', background: '#005C4B', color: '#E9FDF3', borderRadius: '2px 12px 12px 12px', padding: '8px 12px', fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
            {str(a.param).replace('{nombre}', 'Caro').replace('{hora}', '15:30')}
            <div style={{ textAlign: 'right', fontSize: 10, color: 'rgba(233,253,243,.6)', marginTop: 4 }}>{pad(a.hora)}:{pad(a.minuto)} ✓✓</div>
          </div>
        </div>
      )
    case 'stock':
      return (
        <div style={{ borderRadius: 12, padding: 12, background: 'rgba(2,6,23,.45)', border: `1px solid ${TIPOS.stock.color}44` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: TIPOS.stock.color, fontWeight: 700, marginBottom: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Package size={12} /> Orden de compra · {d.proveedor}</span>
            <span style={{ fontFamily: FONT_MONO }}>OC-{a.id === 's1-stock' ? '0418' : '0431'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '4px 14px', fontSize: 12.5, color: C.body, fontFamily: FONT_MONO }}>
            <span style={{ color: C.subtle, fontSize: 10.5 }}>ARTÍCULO</span><span style={{ color: C.subtle, fontSize: 10.5 }}>CANT.</span><span style={{ color: C.subtle, fontSize: 10.5 }}>UNIT.</span><span style={{ color: C.subtle, fontSize: 10.5 }}>TOTAL</span>
            <span>{d.producto} · talles surtidos</span>
            <span key={num(a.param)} style={{ color: C.text, fontWeight: 700, animation: 'pl-subir .3s ease both' }}>{num(a.param)}</span>
            <span>{formatoARS(d.costo)}</span>
            <span style={{ color: C.text, fontWeight: 700 }}>{formatoARS(num(a.param) * d.costo)}</span>
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>Entrega solicitada: viernes antes de las 12. Se manda por mail al proveedor y queda en Inventario como “en camino”.</div>
        </div>
      )
    case 'contenido':
      return (
        <div style={{ display: 'flex', gap: 12, borderRadius: 12, padding: 12, background: 'rgba(2,6,23,.45)', border: `1px solid ${TIPOS.contenido.color}44` }}>
          <div style={{ width: 96, height: 96, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(160deg, #F472B6 0%, #8B5CF6 60%, #1E1B4B 100%)', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,.35), transparent 50%)' }} />
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 12, color: '#fff', textAlign: 'center', lineHeight: 1.2, padding: 6, position: 'relative' }}>NUEVO<br />{cap(d.producto)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: TIPOS.contenido.color, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Megaphone size={12} /> Banner de la tienda + Instagram</div>
            <div style={{ fontSize: 12.5, color: C.body, lineHeight: 1.45, marginTop: 6 }}>{str(a.param)}</div>
          </div>
        </div>
      )
  }
}

// ─── Panel del domingo antes de ver el plan ──────────────────────────────────

function ResumenPrevio({ acciones, ventasBase, variacionBase }: { acciones: Accion[]; ventasBase: number; variacionBase: number }) {
  const filas: { color: string; Icono: LucideIcon; texto: string }[] = [
    { color: C.primaryLight, Icono: TrendingUp, texto: `Semana pasada: ${formatoARS(ventasBase)} en ventas (${variacionBase >= 0 ? '+' : ''}${variacionBase}%).` },
    ...acciones.map(a => {
      const d = a.detalle
      const meta = TIPOS[d.tipo]
      let texto = ''
      switch (d.tipo) {
        case 'descuento': texto = `${cap(d.producto)}: ${d.stock} u. sin venta hace ${d.diasSinVenta} días.`; break
        case 'mensaje': texto = `${d.clientes} clientes sin compras hace más de ${d.diasInactivos} días.`; break
        case 'stock': texto = `${d.producto}: quedan ${d.quedan}, vendés ${d.porSemana} por semana.`; break
        case 'recordatorio': texto = `${d.turnos} turnos de arreglos el sábado.`; break
        case 'contenido': texto = `${cap(d.producto)}: ${d.unidades} u. nuevas sin publicar.`; break
      }
      return { color: meta.color, Icono: meta.Icono, texto }
    }),
  ]
  return (
    <Tarjeta style={{ padding: 18, animation: 'pr-fade-up .5s ease both' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Etiqueta color={C.orbiLight}>Lo que Orbi miró</Etiqueta>
        <span style={{ fontSize: 11.5, color: C.subtle, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Zap size={12} color={C.warning} /> ventas · stock · clientes · turnos</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {filas.map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 12, background: 'rgba(2,6,23,.4)', border: `1px solid ${C.border}`, animation: 'pr-fade-up .45s ease both', animationDelay: `${150 + i * 90}ms` }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: `${f.color}22`, color: f.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}><f.Icono size={15} /></span>
            <span style={{ fontSize: 13, color: C.body }}>{f.texto}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 12, background: 'linear-gradient(90deg, rgba(59,130,246,.12), rgba(139,92,246,.12))', border: '1px solid rgba(139,92,246,.25)', fontSize: 12.5, color: C.body, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Sparkles size={14} color={C.orbiLight} /> 5 movidas listas, cada una con su texto, su día y su hora. Tocá “Ver plan”.
      </div>
    </Tarjeta>
  )
}

// ─── Informe del domingo siguiente ──────────────────────────────────────────

function Informe({ acciones, final, variacion, aprendizajes, esUltima, onSiguiente, onReiniciar }: {
  acciones: Accion[]; final: { ventas: number; clientes: number; unidades: number }; variacion: number; aprendizajes: string[]
  esUltima: boolean; onSiguiente: () => void; onReiniciar: () => void
}) {
  const aprobadas = acciones.filter(a => a.estado === 'aprobada')
  const noEjecutadas = acciones.filter(a => a.estado !== 'aprobada')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'pr-fade-up .5s ease both' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <Metrica icono={TrendingUp} color={C.primaryLight} valor={formatoARS(final.ventas)} etiqueta={`Ventas · ${variacion >= 0 ? '+' : ''}${variacion}%`} />
        <Metrica icono={Users} color={C.orbiLight} valor={String(final.clientes)} etiqueta="Clientes que volvieron" />
        <Metrica icono={Boxes} color={TIPOS.stock.color} valor={`${final.unidades} u.`} etiqueta="Stock repuesto" />
      </div>

      <Etiqueta color={C.muted} style={{ marginTop: 4 }}>Resultado por movida · real vs. estimado</Etiqueta>
      {aprobadas.map((a, i) => {
        const meta = TIPOS[a.detalle.tipo]
        const est = calcImpacto(a)
        const res = calcResultado(a)
        const pct = Math.round((res.pesos / Math.max(1, est.pesos) - 1) * 100)
        return (
          <Tarjeta key={a.id} style={{ padding: 14, borderColor: res.ok ? `${C.success}44` : `${C.error}55`, animation: 'pr-fade-up .45s ease both', animationDelay: `${150 + i * 110}ms` }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ width: 30, height: 30, borderRadius: 99, flexShrink: 0, display: 'grid', placeItems: 'center', background: res.ok ? C.success : C.error, color: res.ok ? '#052E16' : '#450A0A', boxShadow: `0 0 14px ${res.ok ? C.success : C.error}66` }}>
                {res.ok ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Chip color={meta.color}><meta.Icono size={12} /> {meta.nombre}</Chip>
                    <span style={{ fontSize: 11.5, color: C.subtle, fontFamily: FONT_MONO }}>{horaAccion(a)}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: pct >= 0 ? C.success : C.error, fontFamily: FONT_MONO }}>{pct >= 0 ? '+' : ''}{pct}% vs. estimado</span>
                </div>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 800, color: C.text, marginTop: 6 }}>{a.titulo}</div>
                <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12.5, flexWrap: 'wrap' }}>
                  <span style={{ color: C.muted }}>Estimado <b style={{ color: C.body, fontFamily: FONT_MONO }}>{formatoARS(est.pesos)}</b></span>
                  <span style={{ color: C.muted }}>Real <b style={{ color: res.ok ? C.success : C.error, fontFamily: FONT_MONO }}>{formatoARS(res.pesos)}</b></span>
                  <span style={{ color: C.body }}>{res.texto}</span>
                </div>
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.45, fontStyle: 'italic' }}>{a.notaReal}</div>
              </div>
            </div>
          </Tarjeta>
        )
      })}
      {noEjecutadas.length > 0 && (
        <div style={{ fontSize: 12.5, color: C.subtle, padding: '4px 2px' }}>
          Sin ejecutar: {noEjecutadas.map(a => a.titulo.toLowerCase()).join(' · ')}.
        </div>
      )}

      <div style={{ padding: 16, borderRadius: 16, border: '1px solid rgba(139,92,246,.35)', background: 'linear-gradient(135deg, rgba(59,130,246,.1), rgba(139,92,246,.14))', animation: 'pr-fade-up .5s ease both', animationDelay: `${200 + aprobadas.length * 110}ms` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <OrbiAvatar size={24} />
          <Etiqueta color={C.orbiLight}>Qué aprendí</Etiqueta>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {aprendizajes.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13.5, color: C.text, lineHeight: 1.5 }}>
              <Sparkles size={15} color={C.orbiLight} style={{ flexShrink: 0, marginTop: 3 }} />
              <span>{t}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          {esUltima
            ? <Boton onClick={onReiniciar} color={C.orbi}><RotateCcw size={15} /> Volver al primer domingo</Boton>
            : <Boton onClick={onSiguiente} color={C.orbi}><Sparkles size={15} /> Ver el plan de la semana que viene <ChevronRight size={15} /></Boton>}
        </div>
      </div>
    </div>
  )
}

// ─── Piezas chicas ───────────────────────────────────────────────────────────

function Metrica({ icono: Icono, color, valor, etiqueta }: { icono: LucideIcon; color: string; valor: string; etiqueta: string }) {
  return (
    <Tarjeta style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color, fontSize: 11, fontWeight: 700 }}><Icono size={13} /> {etiqueta}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: C.text, fontFamily: FONT_MONO, marginTop: 6, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
    </Tarjeta>
  )
}

function Interruptor({ activo, onToggle, deshabilitado }: { activo: boolean; onToggle: () => void; deshabilitado: boolean }) {
  return (
    <button type="button" onClick={onToggle} disabled={deshabilitado} title="Aprobar automáticamente las acciones de bajo riesgo" className="pr-btn"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '6px 10px 6px 12px', borderRadius: 999, border: `1px solid ${activo ? `${C.success}66` : C.borderStrong}`, background: activo ? `${C.success}14` : 'transparent', color: C.body, fontFamily: FONT }}>
      <ShieldCheck size={14} color={activo ? C.success : C.muted} />
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: activo ? C.text : C.body }}>Modo confianza</span>
        <span style={{ fontSize: 10.5, color: C.subtle }}>aprueba solo lo de bajo riesgo</span>
      </span>
      <span style={{ width: 36, height: 20, borderRadius: 999, background: activo ? C.success : 'rgba(148,163,184,.3)', position: 'relative', transition: 'background .25s', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 2, left: activo ? 18 : 2, width: 16, height: 16, borderRadius: 99, background: '#fff', transition: 'left .25s cubic-bezier(.2,.8,.2,1)', boxShadow: '0 1px 3px rgba(0,0,0,.4)' }} />
      </span>
    </button>
  )
}

/** Efecto máquina de escribir para la burbuja de Orbi. */
function Maquina({ texto }: { texto: string }) {
  const [tip, setTip] = useState({ texto: '', n: 0 })
  useEffect(() => {
    const id = setInterval(() => {
      setTip(s => {
        const n = s.texto === texto ? s.n : 0
        if (n >= texto.length) { clearInterval(id); return s.texto === texto ? s : { texto, n } }
        return { texto, n: n + 3 }
      })
    }, 16)
    return () => clearInterval(id)
  }, [texto])
  const n = tip.texto === texto ? tip.n : 0
  const completo = n >= texto.length
  return (
    <div style={{ fontSize: 15, lineHeight: 1.55, color: C.text, minHeight: 23 }}>
      {texto.slice(0, n)}
      {!completo && <span style={{ display: 'inline-block', width: 8, height: 15, marginLeft: 2, verticalAlign: '-2px', background: C.orbiLight, borderRadius: 2, animation: 'pr-blink .8s infinite' }} />}
    </div>
  )
}

// Evita el warning de "declarado y sin usar" si algún ícono queda solo para el registro.
export type { ReactNode as _PilotoReactNode }
