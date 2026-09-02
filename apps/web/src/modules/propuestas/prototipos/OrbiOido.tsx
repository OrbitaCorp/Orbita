// src/modules/propuestas/prototipos/OrbiOido.tsx — Prototipo "Orbi al Oído":
// POS y turnos manos libres para Barbería Sur. Todo es local: la
// "interpretación" es una lógica por palabras clave sobre un catálogo fijo,
// pensada para que parezca viva. Voz real opcional con la Web Speech API
// (solo cuando el usuario toca el botón; nunca arranca sola).

import { useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AlertCircle, CalendarCheck, Check, Ear, MessageCircle, Mic, Package, Printer, RotateCcw, Sparkles, Square } from 'lucide-react'
import { C, FONT, FONT_DISPLAY, FONT_MONO, Chip, Boton, Etiqueta, OrbiAvatar, formatoARS } from '../ui'

// ─── CSS propio ──────────────────────────────────────────────────────────────

const CSS = `
  @keyframes oo-onda { from { height: 6px; } to { height: var(--h, 40px); } }
  @keyframes oo-latido { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: .55; } }
  @keyframes oo-brillo { 0%, 100% { box-shadow: 0 0 40px rgba(52,211,153,.35), 0 14px 40px rgba(0,0,0,.45); } 50% { box-shadow: 0 0 100px rgba(52,211,153,.7), 0 14px 40px rgba(0,0,0,.45); } }
  @keyframes oo-imprimir { from { transform: translateY(-104%); } to { transform: translateY(0); } }
  @keyframes oo-sello { from { transform: rotate(-12deg) scale(2.6); opacity: 0; } 55% { transform: rotate(-12deg) scale(.9); opacity: 1; } to { transform: rotate(-12deg) scale(1); opacity: 1; } }
  @keyframes oo-pop { from { transform: scale(.3); opacity: 0; } 65% { transform: scale(1.18); opacity: 1; } to { transform: scale(1); opacity: 1; } }
  @keyframes oo-barra { from { width: 0; } }
  @keyframes oo-flujo { from { background-position: 0 0; } to { background-position: 0 28px; } }
  @keyframes oo-num { from { transform: translateY(70%); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes oo-toast { 0% { opacity: 0; transform: translate(-50%, 12px); } 10% { opacity: 1; transform: translate(-50%, 0); } 85% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, -6px); } }
  @keyframes oo-progreso { from { width: 100%; } to { width: 0%; } }
  @keyframes oo-pensar { 0%, 100% { opacity: .35; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.15); } }
  .oo-cmd { transition: transform .18s cubic-bezier(.2,.8,.2,1), border-color .18s, background .18s, box-shadow .18s; cursor: pointer; }
  .oo-cmd:hover:not(:disabled) { transform: translateY(-3px); border-color: rgba(167,139,250,.65) !important; background: rgba(139,92,246,.16) !important; box-shadow: 0 14px 40px rgba(0,0,0,.4); }
  .oo-cmd:active:not(:disabled) { transform: scale(.98); }
  .oo-cmd:disabled { opacity: .45; cursor: not-allowed; }
  @media (prefers-reduced-motion: reduce) { .oo-anim { animation: none !important; } }
`

// ─── Catálogo fijo de Barbería Sur ───────────────────────────────────────────

interface Producto {
  id: string
  nombre: string
  precio: number
  claves: string[]
  /** null = servicio, no tiene stock. */
  stock: number | null
  unidad: string
  ventaSemanal: number
}

const CATALOGO: Producto[] = [
  { id: 'corte', nombre: 'Corte clásico', precio: 6000, claves: ['corte', 'cortes', 'cortecito'], stock: null, unidad: '', ventaSemanal: 0 },
  { id: 'combo', nombre: 'Corte + barba', precio: 9000, claves: [], stock: null, unidad: '', ventaSemanal: 0 },
  { id: 'barba', nombre: 'Barba', precio: 4000, claves: ['barba', 'barbas'], stock: null, unidad: '', ventaSemanal: 0 },
  { id: 'cera', nombre: 'Cera mate', precio: 2000, claves: ['cera', 'ceras'], stock: 8, unidad: 'potes', ventaSemanal: 2 },
  { id: 'shampoo', nombre: 'Shampoo', precio: 3500, claves: ['shampoo', 'champu', 'shampu', 'champoo'], stock: 5, unidad: 'frascos', ventaSemanal: 1 },
  { id: 'medias', nombre: 'Medias negras', precio: 2500, claves: ['medias', 'media'], stock: 12, unidad: 'pares', ventaSemanal: 3 },
]

const CLIENTES = [
  { nombre: 'Juan Pérez', claves: ['juan', 'perez'] },
  { nombre: 'Lucía Ferreyra', claves: ['lucia', 'ferreyra', 'lu'] },
  { nombre: 'Tomás', claves: ['tomas', 'tomi'] },
]

const NUMEROS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
}

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'hoy', 'manana']
const FRANJAS = ['14:00', '15:00', '16:00', '17:00', '18:00', '19:00']

type Agenda = Record<string, string | null>
const AGENDA_INICIAL: Agenda = { '14:00': null, '15:00': 'Martín Sosa', '16:00': 'Diego Ruiz', '17:00': null, '18:00': null, '19:00': null }

const COMANDOS = [
  'Orbi, cobrale a Juan dos cortes y una cera',
  'Orbi, dale turno a Lucía el jueves a las 5',
  'Orbi, ¿cuántas medias negras quedan?',
  'Orbi, cobrale a Tomás corte y barba con Mercado Pago',
  'Orbi, cancelá',
]

// ─── Intérprete local por palabras clave ─────────────────────────────────────

type TipoToken = 'activacion' | 'accion' | 'cliente' | 'producto' | 'cantidad' | 'fecha' | 'pago' | null
interface Token { texto: string; tipo: TipoToken }
interface Item { producto: Producto; cantidad: number }

type Resultado =
  | { tipo: 'cobro'; frase: string; tokens: Token[]; cliente: string; items: Item[]; total: number; medio: string }
  | { tipo: 'turno'; frase: string; tokens: Token[]; cliente: string; dia: string; hora: string; servicio: string; nota: string | null }
  | { tipo: 'stock'; frase: string; tokens: Token[]; producto: Producto; cantidad: number; semanas: number | null }
  | { tipo: 'cancelar'; frase: string; tokens: Token[] }
  | { tipo: 'dale'; frase: string; tokens: Token[] }
  | { tipo: 'desconocido'; frase: string; tokens: Token[] }

function normalizar(palabra: string): string {
  return palabra.toLowerCase().normalize('NFD').replace(/[0300-036f]/g, '').replace(/[^a-z0-9]/g, '')
}

function productoPorClave(clave: string): Producto | undefined {
  return CATALOGO.find(p => p.claves.includes(clave))
}

function interpretar(frase: string, agenda: Agenda): Resultado {
  const palabras = frase.trim().split(/\s+/).filter(Boolean)
  const normas = palabras.map(normalizar)
  const tokens: Token[] = palabras.map(texto => ({ texto, tipo: null }))

  let accion: 'cobro' | 'turno' | 'stock' | 'cancelar' | 'dale' | null = null
  let cliente: string | null = null
  const items: Item[] = []
  let cantidadPendiente: number | null = null
  let hora: number | null = null
  let dia: string | null = null
  let medio = 'Efectivo'
  let productoConsulta: Producto | null = null

  const marcar = (i: number, tipo: TipoToken) => { if (tokens[i]) tokens[i].tipo = tipo }
  const agregar = (p: Producto, cantidad: number) => {
    const existente = items.find(it => it.producto.id === p.id)
    if (existente) existente.cantidad += cantidad
    else items.push({ producto: p, cantidad })
  }

  for (let i = 0; i < normas.length; i++) {
    const w = normas[i]
    const prev = normas[i - 1] ?? ''
    const next = normas[i + 1] ?? ''
    const next2 = normas[i + 2] ?? ''

    if (w === 'orbi' || w === 'orbita') { marcar(i, 'activacion'); continue }

    if (/^(cobrale|cobrar|cobra|cobrame|cobralo|cobrarle|vendele|ticket)$/.test(w)) { accion = accion ?? 'cobro'; marcar(i, 'accion'); continue }
    if (/^(turno|turnos|agenda|agendale|agendar|agendame|reserva|reservale|anotale|anota)$/.test(w)) { accion = accion ?? 'turno'; marcar(i, 'accion'); continue }
    if (/^(cuantas|cuantos|quedan|queda|stock|tenemos|hay)$/.test(w)) { accion = accion ?? 'stock'; marcar(i, 'accion'); continue }
    if (/^(cancela|cancelar|cancelalo|cancelala|olvidalo|dejalo|anula|anulalo)$/.test(w)) { accion = 'cancelar'; marcar(i, 'accion'); continue }
    if (/^(dale|confirma|confirmar|confirmalo|listo|ok|si)$/.test(w) && accion === null) { accion = 'dale'; marcar(i, 'accion'); continue }

    const c = CLIENTES.find(cl => cl.claves.includes(w))
    if (c) { cliente = cliente ?? c.nombre; marcar(i, 'cliente'); continue }

    if (DIAS.includes(w)) { dia = dia ?? (w === 'manana' ? 'mañana' : w === 'hoy' ? 'hoy' : palabras[i].toLowerCase().replace(/[^a-záéíóúñ]/g, '')); marcar(i, 'fecha'); continue }
    if (w === 'las' && prev === 'a') { marcar(i - 1, 'fecha'); marcar(i, 'fecha'); continue }
    if (w === 'hs' || w === 'horas' || w === 'hora') { marcar(i, 'fecha'); continue }

    const numero = NUMEROS[w] ?? (/^\d{1,2}$/.test(w) ? Number(w) : null)
    if (numero !== null) {
      const esHora = prev === 'las' || next === 'hs' || next === 'horas' || next === 'hora' || (next === 'de' && next2 === 'la')
      if (esHora) { hora = hora ?? numero; marcar(i, 'fecha'); continue }
      cantidadPendiente = numero; marcar(i, 'cantidad'); continue
    }

    if (w === 'mercado' && (next === 'pago' || next === 'pag')) { medio = 'Mercado Pago'; marcar(i, 'pago'); marcar(i + 1, 'pago'); i += 1; continue }
    if (/^(mp|mercadopago|transferencia|debito|credito|tarjeta|efectivo|cash)$/.test(w)) {
      medio = w === 'efectivo' || w === 'cash' ? 'Efectivo' : w === 'transferencia' ? 'Transferencia' : w === 'tarjeta' || w === 'debito' || w === 'credito' ? 'Tarjeta' : 'Mercado Pago'
      marcar(i, 'pago'); continue
    }

    // "corte y barba" / "corte con barba" → combo del catálogo
    if ((w === 'corte' || w === 'cortes') && (next === 'y' || next === 'con' || next === 'mas') && next2.startsWith('barba')) {
      const combo = CATALOGO.find(p => p.id === 'combo')
      if (combo) { agregar(combo, cantidadPendiente ?? 1); productoConsulta = productoConsulta ?? combo }
      marcar(i, 'producto'); marcar(i + 1, 'producto'); marcar(i + 2, 'producto')
      cantidadPendiente = null; i += 2; continue
    }

    const p = productoPorClave(w)
    if (p) {
      agregar(p, cantidadPendiente ?? 1)
      productoConsulta = productoConsulta ?? p
      marcar(i, 'producto')
      if (p.id === 'medias' && (next === 'negras' || next === 'negra')) { marcar(i + 1, 'producto'); i += 1 }
      cantidadPendiente = null
      continue
    }
  }

  if (accion === 'cancelar') return { tipo: 'cancelar', frase, tokens }
  if (accion === 'dale') return { tipo: 'dale', frase, tokens }

  if (accion === 'stock') {
    if (!productoConsulta) return { tipo: 'desconocido', frase, tokens }
    const cantidad = productoConsulta.stock ?? 0
    const semanas = productoConsulta.ventaSemanal > 0 ? Math.floor(cantidad / productoConsulta.ventaSemanal) : null
    return { tipo: 'stock', frase, tokens, producto: productoConsulta, cantidad, semanas }
  }

  if (accion === 'turno' || (accion === null && cliente && hora !== null)) {
    if (!cliente) return { tipo: 'desconocido', frase, tokens }
    const libre = FRANJAS.find(f => agenda[f] === null) ?? '17:00'
    let slot = libre
    let nota: string | null = null
    if (hora === null) {
      nota = `No dijiste hora: te propongo las ${libre}, el primer hueco.`
    } else {
      const h24 = hora <= 12 ? hora + 12 : hora
      const pedido = `${String(h24).padStart(2, '0')}:00`
      if (agenda[pedido] === null) slot = pedido
      else if (pedido in agenda) nota = `Las ${pedido} está ocupado: te propongo las ${libre}.`
      else nota = `A las ${pedido} no atendemos: te propongo las ${libre}.`
    }
    return { tipo: 'turno', frase, tokens, cliente, dia: dia ?? 'jueves', hora: slot, servicio: items[0]?.producto.nombre ?? 'Corte clásico', nota }
  }

  if (accion === 'cobro' || (accion === null && items.length > 0)) {
    if (items.length === 0) return { tipo: 'desconocido', frase, tokens }
    const total = items.reduce((acc, it) => acc + it.producto.precio * it.cantidad, 0)
    return { tipo: 'cobro', frase, tokens, cliente: cliente ?? 'Cliente de mostrador', items, total, medio }
  }

  return { tipo: 'desconocido', frase, tokens }
}

// ─── Estado y reducer ────────────────────────────────────────────────────────

type Fase = 'reposo' | 'voz' | 'transcribiendo' | 'interpretando' | 'resultado' | 'confirmado'
type TipoEntrada = 'cobro' | 'turno' | 'stock' | 'cancelar' | 'error'
interface Entrada { hora: string; texto: string; tipo: TipoEntrada }

interface Estado {
  fase: Fase
  transcripcion: string
  visibles: number
  parcial: string
  resultado: Resultado | null
  stock: Record<string, number>
  agenda: Agenda
  stats: { cobros: number; turnos: number; errores: number }
  registro: Entrada[]
  aviso: string | null
  alto: boolean
}

type Accion =
  | { tipo: 'DECIR'; frase: string }
  | { tipo: 'AVANZAR' }
  | { tipo: 'INTERPRETANDO' }
  | { tipo: 'APLICAR'; hora: string }
  | { tipo: 'CONFIRMAR'; hora: string }
  | { tipo: 'VOLVER' }
  | { tipo: 'VOZ_INICIO' }
  | { tipo: 'VOZ_PARCIAL'; texto: string }
  | { tipo: 'VOZ_FIN'; texto: string | null }
  | { tipo: 'AVISO'; texto: string }
  | { tipo: 'AVISO_LIMPIAR' }
  | { tipo: 'ALTO' }
  | { tipo: 'REINICIAR' }

const STOCK_INICIAL: Record<string, number> = Object.fromEntries(CATALOGO.filter(p => p.stock !== null).map(p => [p.id, p.stock ?? 0]))

const ESTADO_INICIAL: Estado = {
  fase: 'reposo', transcripcion: '', visibles: 0, parcial: '', resultado: null,
  stock: STOCK_INICIAL, agenda: AGENDA_INICIAL,
  stats: { cobros: 14, turnos: 6, errores: 0 }, registro: [], aviso: null, alto: false,
}

function contarPalabras(s: string): number { return s.trim() ? s.trim().split(/\s+/).length : 0 }

function confirmar(estado: Estado, hora: string): Estado {
  const r = estado.resultado
  if (!r) return estado
  if (r.tipo === 'cobro') {
    const stock = { ...estado.stock }
    for (const it of r.items) if (it.producto.id in stock) stock[it.producto.id] = Math.max(0, stock[it.producto.id] - it.cantidad)
    return {
      ...estado, fase: 'confirmado', stock, transcripcion: r.frase, visibles: contarPalabras(r.frase),
      stats: { ...estado.stats, cobros: estado.stats.cobros + 1 },
      registro: [{ hora, texto: `Cobro · ${r.cliente} · ${formatoARS(r.total)} · ${r.medio}`, tipo: 'cobro' }, ...estado.registro],
    }
  }
  if (r.tipo === 'turno') {
    return {
      ...estado, fase: 'confirmado', agenda: { ...estado.agenda, [r.hora]: r.cliente }, transcripcion: r.frase, visibles: contarPalabras(r.frase),
      stats: { ...estado.stats, turnos: estado.stats.turnos + 1 },
      registro: [{ hora, texto: `Turno · ${r.cliente} · ${r.dia} ${r.hora}`, tipo: 'turno' }, ...estado.registro],
    }
  }
  return estado
}

function reducer(estado: Estado, accion: Accion): Estado {
  switch (accion.tipo) {
    case 'DECIR':
      return { ...estado, fase: 'transcribiendo', transcripcion: accion.frase, visibles: 0, parcial: '', aviso: null, resultado: estado.fase === 'confirmado' ? null : estado.resultado }
    case 'AVANZAR':
      return { ...estado, visibles: estado.visibles + 1 }
    case 'INTERPRETANDO':
      return { ...estado, fase: 'interpretando' }
    case 'APLICAR': {
      const r = interpretar(estado.transcripcion, estado.agenda)
      if (r.tipo === 'cancelar') {
        return { ...estado, fase: 'reposo', resultado: null, transcripcion: '', aviso: 'Listo, cancelado', registro: [{ hora: accion.hora, texto: estado.resultado ? `Cancelado · ${estado.resultado.tipo}` : 'Cancelar · nada pendiente', tipo: 'cancelar' }, ...estado.registro] }
      }
      if (r.tipo === 'dale') {
        const pendiente = estado.resultado && (estado.resultado.tipo === 'cobro' || estado.resultado.tipo === 'turno')
        if (pendiente) return confirmar(estado, accion.hora)
        return { ...estado, fase: 'reposo', transcripcion: '', aviso: 'No hay nada para confirmar todavía' }
      }
      if (r.tipo === 'stock') {
        const cantidad = estado.stock[r.producto.id] ?? r.cantidad
        const semanas = r.producto.ventaSemanal > 0 ? Math.floor(cantidad / r.producto.ventaSemanal) : null
        return { ...estado, fase: 'resultado', resultado: { ...r, cantidad, semanas }, registro: [{ hora: accion.hora, texto: `Stock · ${r.producto.nombre} · ${cantidad}`, tipo: 'stock' }, ...estado.registro] }
      }
      if (r.tipo === 'desconocido') {
        return { ...estado, fase: 'resultado', resultado: r, stats: { ...estado.stats, errores: estado.stats.errores + 1 }, registro: [{ hora: accion.hora, texto: `No entendido · "${r.frase.slice(0, 28)}${r.frase.length > 28 ? '…' : ''}"`, tipo: 'error' }, ...estado.registro] }
      }
      return { ...estado, fase: 'resultado', resultado: r }
    }
    case 'CONFIRMAR':
      return confirmar(estado, accion.hora)
    case 'VOLVER':
      return { ...estado, fase: 'reposo', resultado: null, transcripcion: '', visibles: 0 }
    case 'VOZ_INICIO':
      return { ...estado, fase: 'voz', parcial: '', aviso: null, transcripcion: '', visibles: 0, resultado: estado.fase === 'confirmado' ? null : estado.resultado }
    case 'VOZ_PARCIAL':
      return { ...estado, parcial: accion.texto }
    case 'VOZ_FIN': {
      if (estado.fase !== 'voz') return estado
      if (!accion.texto) return { ...estado, fase: 'reposo', parcial: '', aviso: 'No te escuché. Probá de nuevo, más cerca del micrófono.' }
      return { ...estado, fase: 'transcribiendo', transcripcion: accion.texto, visibles: contarPalabras(accion.texto), parcial: '' }
    }
    case 'AVISO':
      return { ...estado, aviso: accion.texto }
    case 'AVISO_LIMPIAR':
      return { ...estado, aviso: null }
    case 'ALTO':
      return { ...estado, alto: !estado.alto }
    case 'REINICIAR':
      return ESTADO_INICIAL
    default:
      return estado
  }
}

// ─── Voz real (Web Speech API), tipada mínimamente ───────────────────────────

interface AlternativaVoz { readonly transcript: string }
interface ResultadoVoz { readonly isFinal: boolean; readonly length: number; readonly [index: number]: AlternativaVoz }
interface EventoVoz { readonly resultIndex: number; readonly results: { readonly length: number; readonly [index: number]: ResultadoVoz } }
interface Reconocedor {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: EventoVoz) => void) | null
  onerror: ((e: { readonly error: string }) => void) | null
  onend: (() => void) | null
}
type ReconocedorCtor = new () => Reconocedor

function obtenerReconocedor(): ReconocedorCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: ReconocedorCtor; webkitSpeechRecognition?: ReconocedorCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function horaAhora(): string {
  return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

// ─── Colores de las entidades ────────────────────────────────────────────────

const COLOR_TOKEN: Record<Exclude<TipoToken, null>, string> = {
  activacion: C.orbiLight,
  accion: C.muted,
  cliente: C.primaryLight,
  producto: C.success,
  cantidad: C.warning,
  fecha: C.orbiLight,
  pago: '#F472B6',
}

const COLOR_ENTRADA: Record<TipoEntrada, string> = {
  cobro: C.success, turno: C.orbiLight, stock: C.warning, cancelar: C.muted, error: C.error,
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function OrbiOido() {
  const [estado, dispatch] = useReducer(reducer, ESTADO_INICIAL)
  const [vozDisponible, setVozDisponible] = useState<boolean>(() => obtenerReconocedor() !== null)
  const recRef = useRef<Reconocedor | null>(null)

  const { fase, transcripcion, visibles, parcial, resultado, stock, agenda, stats, registro, aviso, alto } = estado
  const k = alto ? 1.22 : 1
  const escuchando = fase === 'voz' || fase === 'transcribiendo' || fase === 'interpretando'
  const compacto = fase === 'resultado' || fase === 'confirmado'
  const palabras = transcripcion.trim() ? transcripcion.trim().split(/\s+/) : []
  const resaltar = compacto && resultado !== null && resultado.frase === transcripcion

  // Máquina de tiempos: transcripción palabra por palabra → interpretación → resultado.
  useEffect(() => {
    if (fase === 'transcribiendo') {
      const total = contarPalabras(transcripcion)
      if (visibles < total) {
        const palabra = transcripcion.trim().split(/\s+/)[visibles] ?? ''
        const t = window.setTimeout(() => dispatch({ tipo: 'AVANZAR' }), 60 + Math.min(palabra.length * 24, 190))
        return () => window.clearTimeout(t)
      }
      const t = window.setTimeout(() => dispatch({ tipo: 'INTERPRETANDO' }), 160)
      return () => window.clearTimeout(t)
    }
    if (fase === 'interpretando') {
      const t = window.setTimeout(() => dispatch({ tipo: 'APLICAR', hora: horaAhora() }), 420)
      return () => window.clearTimeout(t)
    }
    if (fase === 'confirmado') {
      const t = window.setTimeout(() => dispatch({ tipo: 'VOLVER' }), 5200)
      return () => window.clearTimeout(t)
    }
    return undefined
  }, [fase, visibles, transcripcion])

  useEffect(() => {
    if (!aviso) return undefined
    const t = window.setTimeout(() => dispatch({ tipo: 'AVISO_LIMPIAR' }), 2800)
    return () => window.clearTimeout(t)
  }, [aviso])

  // Si el componente se va, el micrófono se apaga.
  useEffect(() => () => { recRef.current?.abort(); recRef.current = null }, [])

  const decir = (frase: string) => {
    if (fase === 'voz') { recRef.current?.abort(); recRef.current = null }
    dispatch({ tipo: 'DECIR', frase })
  }

  const probarVoz = () => {
    if (fase === 'voz') { recRef.current?.stop(); return }
    const Ctor = obtenerReconocedor()
    if (!Ctor) { setVozDisponible(false); return }
    try {
      const rec = new Ctor()
      rec.lang = 'es-AR'
      rec.continuous = false
      rec.interimResults = true
      rec.maxAlternatives = 1
      let final = ''
      let ultimoParcial = ''
      rec.onresult = (e: EventoVoz) => {
        let interino = ''
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i]
          const texto = r[0]?.transcript ?? ''
          if (r.isFinal) final += texto
          else interino += texto
        }
        ultimoParcial = (final + interino).trim()
        dispatch({ tipo: 'VOZ_PARCIAL', texto: ultimoParcial })
      }
      rec.onerror = (e: { readonly error: string }) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setVozDisponible(false)
      }
      rec.onend = () => {
        recRef.current = null
        dispatch({ tipo: 'VOZ_FIN', texto: (final.trim() || ultimoParcial) || null })
      }
      recRef.current = rec
      dispatch({ tipo: 'VOZ_INICIO' })
      rec.start()
    } catch {
      setVozDisponible(false)
      dispatch({ tipo: 'VOZ_FIN', texto: null })
    }
  }

  const tocarMic = () => {
    if (vozDisponible) probarVoz()
    else dispatch({ tipo: 'AVISO', texto: 'Tu navegador no tiene voz: tocá una frase de abajo para simular' })
  }

  const reiniciar = () => {
    recRef.current?.abort()
    recRef.current = null
    dispatch({ tipo: 'REINICIAR' })
  }

  const ocupado = fase === 'transcribiendo' || fase === 'interpretando'
  const micTam = Math.round((compacto ? 64 : 120) * k)
  const textoEscucha = fase === 'voz' ? 'Escuchando tu voz…' : ocupado ? 'Escuchando' : "Decí 'Orbi' para activar"

  // ─── Sub-vistas ───

  const renderTranscripcion = () => {
    const fs = Math.round(40 * k)
    const cursor = <span className="oo-anim" style={{ display: 'inline-block', width: 4, height: fs * 0.9, background: C.orbiLight, marginLeft: 6, verticalAlign: '-0.12em', borderRadius: 2, animation: 'pr-blink 1s steps(2) infinite' }} />
    if (fase === 'voz') {
      return (
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: fs, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em', color: parcial ? C.text : C.subtle, minHeight: fs * 1.2 }}>
          {parcial || 'Hablá ahora…'}{cursor}
        </div>
      )
    }
    if (palabras.length === 0) {
      return (
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: fs, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em', color: C.subtle, minHeight: fs * 1.2 }}>
          Tocá una frase de abajo{vozDisponible ? ' o probá con tu voz' : ''}.
        </div>
      )
    }
    if (resaltar && resultado) {
      return (
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: fs, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.02em', color: C.text, minHeight: fs * 1.2, display: 'flex', flexWrap: 'wrap', gap: '0 .28em' }}>
          {resultado.tokens.map((tk, i) => {
            const col = tk.tipo ? COLOR_TOKEN[tk.tipo] : null
            const esActivacion = tk.tipo === 'activacion'
            return (
              <span key={i} className="oo-anim" style={{
                display: 'inline-block', padding: col && !esActivacion ? '0 .18em' : 0, borderRadius: 10,
                color: esActivacion ? 'transparent' : col ?? C.text,
                background: esActivacion ? 'linear-gradient(135deg, #60A5FA, #A78BFA)' : col && tk.tipo !== 'accion' ? `${col}22` : 'transparent',
                WebkitBackgroundClip: esActivacion ? 'text' : undefined, backgroundClip: esActivacion ? 'text' : undefined,
                boxShadow: col && tk.tipo !== 'accion' && !esActivacion ? `inset 0 -4px 0 ${col}88` : undefined,
                textDecoration: tk.tipo === 'accion' ? 'underline' : undefined, textDecorationColor: `${C.muted}88`, textUnderlineOffset: '0.18em',
                animation: `pr-fade-up .4s cubic-bezier(.2,.8,.2,1) ${i * 45}ms both`,
              }}>{tk.texto}</span>
            )
          })}
        </div>
      )
    }
    return (
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: fs, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em', color: C.text, minHeight: fs * 1.2 }}>
        {palabras.slice(0, visibles).map((p, i) => (
          <span key={i} className="oo-anim" style={{ display: 'inline-block', marginRight: '.28em', animation: 'pr-fade-up .25s ease both' }}>{p}</span>
        ))}
        {(fase === 'transcribiendo' || fase === 'interpretando') && cursor}
      </div>
    )
  }

  const renderLeyenda = () => {
    if (!resaltar || !resultado) return null
    const presentes = new Set(resultado.tokens.map(t => t.tipo).filter((t): t is Exclude<TipoToken, null> => t !== null && t !== 'activacion' && t !== 'accion'))
    const nombres: Record<string, string> = { cliente: 'Cliente', producto: 'Producto', cantidad: 'Cantidad', fecha: 'Fecha y hora', pago: 'Medio de pago' }
    return (
      <div className="pr-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
        {Array.from(presentes).map(t => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONT_MONO, fontSize: Math.round(12 * k), color: COLOR_TOKEN[t] }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: COLOR_TOKEN[t] }} />{nombres[t]}
          </span>
        ))}
      </div>
    )
  }

  const renderConector = () => (
    <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0 12px' }}>
      <div className="oo-anim" style={{ width: 3, height: 34, borderRadius: 2, marginLeft: 22, backgroundImage: `linear-gradient(${C.orbiLight} 50%, transparent 50%)`, backgroundSize: '3px 14px', animation: 'oo-flujo .6s linear infinite', opacity: .8 }} />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FONT_MONO, fontSize: Math.round(12 * k), color: C.orbiLight }}>
        <OrbiAvatar size={20} /> Orbi entendió
      </span>
    </div>
  )

  const renderInterpretando = () => (
    <div className="pr-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
      <OrbiAvatar size={28} />
      <span style={{ fontFamily: FONT, fontSize: Math.round(18 * k), color: C.orbiLight, fontWeight: 600 }}>Orbi está interpretando</span>
      <span style={{ display: 'inline-flex', gap: 5 }}>
        {[0, 1, 2].map(i => <span key={i} className="oo-anim" style={{ width: 8, height: 8, borderRadius: 99, background: C.orbiLight, animation: `oo-pensar .9s ease-in-out ${i * 0.15}s infinite` }} />)}
      </span>
    </div>
  )

  const renderCobro = (r: Extract<Resultado, { tipo: 'cobro' }>) => {
    const listo = fase === 'confirmado'
    const cera = r.items.find(it => it.producto.id === 'cera')
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 18, alignItems: 'stretch' }}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, background: 'rgba(2,6,23,.55)', border: `1px solid ${C.border}`, padding: `${20 * k}px ${24 * k}px`, minHeight: 250 * k }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Etiqueta color={C.primaryLight} style={{ fontSize: Math.round(12 * k) }}>Ticket</Etiqueta>
            <Chip color={r.medio === 'Mercado Pago' ? '#F472B6' : C.muted} style={{ fontSize: Math.round(12 * k) }}>{r.medio}</Chip>
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: Math.round(30 * k), fontWeight: 800, color: C.primaryLight, letterSpacing: '-0.02em', marginBottom: 10 }}>{r.cliente}</div>
          {r.items.map((it, i) => (
            <div key={it.producto.id} className="oo-anim" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: `${8 * k}px 0`, borderTop: `1px dashed ${C.border}`, fontFamily: FONT, fontSize: Math.round(26 * k), fontWeight: 600, color: C.text, animation: `pr-fade-up .4s ${120 + i * 90}ms both` }}>
              <span><span style={{ color: C.warning, fontFamily: FONT_MONO }}>{it.cantidad} ×</span> <span style={{ color: C.success }}>{it.producto.nombre}</span></span>
              <span style={{ fontFamily: FONT_MONO, fontVariantNumeric: 'tabular-nums' }}>{formatoARS(it.producto.precio * it.cantidad)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: `2px solid ${C.borderStrong}`, marginTop: 6, paddingTop: 12 * k }}>
            <span style={{ fontFamily: FONT, fontSize: Math.round(22 * k), color: C.muted, fontWeight: 700 }}>Total</span>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: Math.round(42 * k), fontWeight: 900, color: C.text, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{formatoARS(r.total)}</span>
          </div>

          {listo && (
            <div aria-hidden className="oo-anim" style={{ position: 'absolute', inset: 0, background: '#F8FAFC', color: '#0F172A', padding: `${18 * k}px ${22 * k}px`, animation: 'oo-imprimir 1.1s cubic-bezier(.2,.8,.2,1) both', fontFamily: FONT_MONO, borderBottom: '3px dashed #CBD5E1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: Math.round(12 * k), color: '#64748B', letterSpacing: '.08em' }}><span>BARBERÍA SUR</span><span>{registro[0]?.hora}</span></div>
              <div style={{ fontSize: Math.round(14 * k), marginTop: 8, color: '#334155' }}>{r.cliente}</div>
              {r.items.map(it => (
                <div key={it.producto.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: Math.round(15 * k), marginTop: 4 }}>
                  <span>{it.cantidad} x {it.producto.nombre}</span><span>{formatoARS(it.producto.precio * it.cantidad)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: Math.round(22 * k), fontWeight: 800, marginTop: 10, borderTop: '1px solid #CBD5E1', paddingTop: 8 }}><span>TOTAL</span><span>{formatoARS(r.total)}</span></div>
              <div style={{ fontSize: Math.round(12 * k), color: '#64748B', marginTop: 8 }}>{r.medio} · gracias por venir</div>
              <div className="oo-anim" style={{ position: 'absolute', right: 18 * k, bottom: 14 * k, padding: '6px 16px', border: `4px solid ${'#059669'}`, color: '#059669', borderRadius: 10, fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: Math.round(34 * k), letterSpacing: '.08em', animation: 'oo-sello .5s cubic-bezier(.2,.8,.2,1) .9s both', transform: 'rotate(-12deg)' }}>COBRADO</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!listo ? (
            <>
              <button type="button" className="pr-btn oo-anim" onClick={() => dispatch({ tipo: 'CONFIRMAR', hora: horaAhora() })} style={{ flex: 1, minHeight: 190 * k, borderRadius: 26, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #34D399 0%, #10B981 60%, #059669 100%)', color: '#022C22', fontFamily: FONT_DISPLAY, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, animation: 'oo-brillo 2.2s ease-in-out infinite', position: 'relative', overflow: 'hidden' }}>
                <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, transparent 30%, rgba(255,255,255,.28) 50%, transparent 70%)', backgroundSize: '800px 100%', animation: 'pr-shimmer 2.8s linear infinite' }} />
                <span style={{ fontSize: Math.round(44 * k), fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, position: 'relative' }}>Cobrar {formatoARS(r.total)}</span>
                <span style={{ fontSize: Math.round(18 * k), fontWeight: 600, opacity: .8, position: 'relative' }}>o decí &lsquo;dale&rsquo;</span>
              </button>
              <button type="button" className="pr-btn" onClick={() => decir('Dale')} disabled={ocupado} style={{ minHeight: 56 * k, borderRadius: 16, background: `${C.orbi}22`, border: `1px solid ${C.orbi}66`, color: C.orbiLight, fontFamily: FONT, fontWeight: 800, fontSize: Math.round(20 * k), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <Mic size={Math.round(20 * k)} /> Decir &lsquo;dale&rsquo;
              </button>
            </>
          ) : (
            <div className="pr-fade-up" style={{ flex: 1, borderRadius: 26, background: 'rgba(52,211,153,.10)', border: `1px solid ${C.success}55`, padding: `${20 * k}px ${22 * k}px`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className="oo-anim" style={{ width: 56 * k, height: 56 * k, borderRadius: '50%', background: C.success, color: '#022C22', display: 'grid', placeItems: 'center', animation: 'oo-pop .5s cubic-bezier(.2,.8,.2,1) both' }}><Check size={Math.round(34 * k)} strokeWidth={3} /></span>
                <div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: Math.round(30 * k), fontWeight: 900, color: C.text, letterSpacing: '-0.02em' }}>Cobrado</div>
                  <div style={{ fontFamily: FONT, fontSize: Math.round(16 * k), color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}><Printer size={16} /> Imprimiendo el ticket</div>
                </div>
              </div>
              <div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: 12 }}>
                <Etiqueta color={C.warning} style={{ fontSize: Math.round(11 * k), marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Package size={13} /> Inventario</Etiqueta>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {r.items.filter(it => it.producto.stock !== null).map(it => (
                    <div key={it.producto.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: FONT_MONO, fontSize: Math.round(16 * k), color: C.body }}>
                      <span style={{ flex: 1 }}>{it.producto.nombre}</span>
                      <span style={{ color: C.subtle, textDecoration: 'line-through' }}>{stock[it.producto.id] + it.cantidad}</span>
                      <span style={{ color: C.subtle }}>→</span>
                      <span className="oo-anim" style={{ display: 'inline-block', color: C.warning, fontWeight: 800, fontSize: Math.round(22 * k), animation: 'oo-num .5s cubic-bezier(.2,.8,.2,1) .6s both' }}>{stock[it.producto.id]}</span>
                    </div>
                  ))}
                  {!cera && r.items.every(it => it.producto.stock === null) && (
                    <div style={{ fontFamily: FONT_MONO, fontSize: Math.round(13 * k), color: C.subtle }}>Solo servicios: no mueve stock.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderTurno = (r: Extract<Resultado, { tipo: 'turno' }>) => {
    const listo = fase === 'confirmado'
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.15fr)', gap: 18, alignItems: 'stretch' }}>
        <div style={{ borderRadius: 20, background: 'rgba(2,6,23,.55)', border: `1px solid ${C.border}`, padding: `${16 * k}px ${18 * k}px` }}>
          <Etiqueta color={C.orbiLight} style={{ fontSize: Math.round(12 * k), marginBottom: 10 }}>Agenda · {r.dia}</Etiqueta>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {FRANJAS.map((f, i) => {
              const quien = agenda[f]
              const propuesta = f === r.hora
              const ocupada = quien !== null
              return (
                <div key={f} className="oo-anim" style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: `${8 * k}px ${12 * k}px`, borderRadius: 12,
                  background: propuesta ? (listo ? `${C.success}22` : `${C.orbi}2A`) : ocupada ? 'rgba(148,163,184,.10)' : 'transparent',
                  border: `1px solid ${propuesta ? (listo ? C.success : C.orbiLight) : ocupada ? 'rgba(148,163,184,.2)' : C.border}`,
                  boxShadow: propuesta && !listo ? `0 0 28px ${C.orbi}55` : undefined,
                  animation: `pr-fade-up .35s ${i * 55}ms both${propuesta && !listo ? ', pr-pulse 1.8s ease-in-out .4s infinite' : ''}`,
                }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: Math.round(20 * k), fontWeight: 800, color: propuesta ? (listo ? C.success : C.orbiLight) : ocupada ? C.subtle : C.body, width: 62 * k }}>{f}</span>
                  <span style={{ fontFamily: FONT, fontSize: Math.round(16 * k), color: ocupada ? C.muted : propuesta ? C.text : C.subtle, fontWeight: propuesta ? 700 : 500, flex: 1 }}>
                    {quien ?? (propuesta ? r.cliente : 'Libre')}
                  </span>
                  {ocupada && !propuesta && <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.subtle, letterSpacing: '.08em' }}>OCUPADO</span>}
                  {propuesta && (listo ? <Check size={18} color={C.success} strokeWidth={3} /> : <Sparkles size={16} color={C.orbiLight} />)}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ borderRadius: 20, background: 'rgba(2,6,23,.55)', border: `1px solid ${C.border}`, padding: `${18 * k}px ${22 * k}px` }}>
            <Etiqueta color={C.orbiLight} style={{ fontSize: Math.round(12 * k), marginBottom: 8 }}>Turno nuevo</Etiqueta>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: Math.round(30 * k), fontWeight: 800, letterSpacing: '-0.02em', color: C.text, lineHeight: 1.2 }}>
              <span style={{ color: C.primaryLight }}>{r.cliente}</span> · <span style={{ color: C.orbiLight }}>{r.dia} {r.hora}</span> · <span style={{ color: C.success }}>{r.servicio}</span>
            </div>
            {r.nota && <div style={{ marginTop: 8, fontFamily: FONT, fontSize: Math.round(15 * k), color: C.warning, display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={15} /> {r.nota}</div>}
          </div>
          {!listo ? (
            <div style={{ display: 'flex', gap: 12, flex: 1 }}>
              <button type="button" className="pr-btn oo-anim" onClick={() => dispatch({ tipo: 'CONFIRMAR', hora: horaAhora() })} style={{ flex: 1, minHeight: 150 * k, borderRadius: 26, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #34D399 0%, #10B981 60%, #059669 100%)', color: '#022C22', fontFamily: FONT_DISPLAY, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, animation: 'oo-brillo 2.2s ease-in-out infinite' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, fontSize: Math.round(44 * k), fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}><CalendarCheck size={Math.round(40 * k)} strokeWidth={2.4} /> Agendar</span>
                <span style={{ fontSize: Math.round(18 * k), fontWeight: 600, opacity: .8 }}>o decí &lsquo;dale&rsquo;</span>
              </button>
              <button type="button" className="pr-btn" onClick={() => decir('Dale')} disabled={ocupado} style={{ width: 150 * k, borderRadius: 16, background: `${C.orbi}22`, border: `1px solid ${C.orbi}66`, color: C.orbiLight, fontFamily: FONT, fontWeight: 800, fontSize: Math.round(18 * k), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Mic size={Math.round(24 * k)} /> Decir &lsquo;dale&rsquo;
              </button>
            </div>
          ) : (
            <div className="pr-fade-up" style={{ flex: 1, borderRadius: 26, background: 'rgba(52,211,153,.10)', border: `1px solid ${C.success}55`, padding: `${18 * k}px ${22 * k}px`, display: 'flex', alignItems: 'center', gap: 16 }}>
              <span className="oo-anim" style={{ width: 72 * k, height: 72 * k, borderRadius: '50%', background: C.success, color: '#022C22', display: 'grid', placeItems: 'center', flexShrink: 0, animation: 'oo-pop .5s cubic-bezier(.2,.8,.2,1) both' }}><Check size={Math.round(44 * k)} strokeWidth={3} /></span>
              <div>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: Math.round(30 * k), fontWeight: 900, color: C.text, letterSpacing: '-0.02em' }}>Agendado</div>
                <div className="pr-fade-in" style={{ fontFamily: FONT, fontSize: Math.round(18 * k), color: C.body, display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, animationDelay: '.5s' }}><MessageCircle size={18} color="#25D366" /> Le mandé el recordatorio por WhatsApp</div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderStock = (r: Extract<Resultado, { tipo: 'stock' }>) => {
    const p = r.producto
    const nombre = p.nombre.toLowerCase()
    const unidad = p.unidad || 'unidades'
    let texto: string
    if (p.stock === null) texto = `${p.nombre} es un servicio: no tiene stock, lo hacés vos.`
    else if (r.cantidad === 0) texto = `No queda nada de ${nombre}. Conviene reponer hoy.`
    else if (r.semanas === null) texto = `Quedan ${r.cantidad} ${unidad} de ${nombre}.`
    else if (r.semanas >= 4) { const meses = Math.round(r.semanas / 4); texto = `Quedan ${r.cantidad} ${unidad} de ${nombre}. Se venden ${p.ventaSemanal} por semana: te alcanzan para ${meses === 1 ? 'un mes' : `${meses} meses`}.` }
    else texto = `Quedan ${r.cantidad} ${unidad} de ${nombre}. Se venden ${p.ventaSemanal} por semana: te alcanzan para ${r.semanas === 1 ? 'una semana' : `${r.semanas} semanas`}. Andá pensando en reponer.`
    const max = Math.max(20, (p.stock ?? 0) + 4)
    const pct = Math.max(0, Math.min(100, (r.cantidad / max) * 100))
    const col = r.semanas !== null && r.semanas < 2 ? C.error : C.warning
    return (
      <div style={{ borderRadius: 20, background: 'rgba(2,6,23,.55)', border: `1px solid ${C.border}`, padding: `${22 * k}px ${26 * k}px`, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <OrbiAvatar size={Math.round(44 * k)} />
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: Math.round(36 * k), fontWeight: 800, letterSpacing: '-0.02em', color: C.text, lineHeight: 1.2 }}>{texto}</div>
        </div>
        {p.stock !== null && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT_MONO, fontSize: Math.round(13 * k), color: C.muted, marginBottom: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Package size={14} /> {p.nombre}</span>
              <span><span style={{ color: col, fontWeight: 800, fontSize: Math.round(18 * k) }}>{r.cantidad}</span> / {max}</span>
            </div>
            <div style={{ position: 'relative', height: 22 * k, borderRadius: 999, background: 'rgba(148,163,184,.12)', overflow: 'hidden' }}>
              <div className="oo-anim" style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${col}, ${col}AA)`, boxShadow: `0 0 24px ${col}66`, animation: 'oo-barra 1s cubic-bezier(.2,.8,.2,1) both' }} />
              {p.ventaSemanal > 0 && Array.from({ length: Math.floor(max / p.ventaSemanal) }, (_, i) => (
                <span key={i} aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: `${((i + 1) * p.ventaSemanal / max) * 100}%`, width: 1, background: 'rgba(7,11,22,.6)' }} />
              ))}
            </div>
            {p.ventaSemanal > 0 && <div style={{ fontFamily: FONT_MONO, fontSize: Math.round(12 * k), color: C.subtle, marginTop: 6 }}>Cada raya es una semana de venta ({p.ventaSemanal} por semana)</div>}
          </div>
        )}
      </div>
    )
  }

  const renderDesconocido = () => (
    <div style={{ borderRadius: 20, background: `${C.error}10`, border: `1px solid ${C.error}55`, padding: `${22 * k}px ${26 * k}px`, display: 'flex', gap: 16, alignItems: 'center' }}>
      <span style={{ width: 52 * k, height: 52 * k, borderRadius: '50%', background: `${C.error}22`, color: C.error, display: 'grid', placeItems: 'center', flexShrink: 0 }}><AlertCircle size={Math.round(30 * k)} /></span>
      <div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: Math.round(32 * k), fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>No entendí.</div>
        <div style={{ fontFamily: FONT, fontSize: Math.round(20 * k), color: C.body, marginTop: 4 }}>Probá: <span style={{ color: C.orbiLight, fontWeight: 700 }}>&lsquo;cobrale a Juan dos cortes&rsquo;</span></div>
      </div>
    </div>
  )

  const renderResultado = (): ReactNode => {
    if (!resultado || !compacto) return null
    let cuerpo: ReactNode = null
    if (resultado.tipo === 'cobro') cuerpo = renderCobro(resultado)
    else if (resultado.tipo === 'turno') cuerpo = renderTurno(resultado)
    else if (resultado.tipo === 'stock') cuerpo = renderStock(resultado)
    else if (resultado.tipo === 'desconocido') cuerpo = renderDesconocido()
    if (!cuerpo) return null
    return (
      <div className="pr-fade-up" style={{ position: 'relative' }}>
        {renderConector()}
        {cuerpo}
        {fase === 'confirmado' && (
          <div aria-hidden style={{ height: 3, marginTop: 12, borderRadius: 2, background: 'rgba(148,163,184,.12)', overflow: 'hidden' }}>
            <div className="oo-anim" style={{ height: '100%', background: C.success, animation: 'oo-progreso 5.2s linear both' }} />
          </div>
        )}
      </div>
    )
  }

  const renderMic = () => {
    const alturaMax = compacto ? 22 : 46
    return (
      <div style={{ display: 'flex', flexDirection: compacto ? 'row' : 'column', alignItems: 'center', gap: compacto ? 18 : 22, transition: 'gap .4s' }}>
        <div style={{ position: 'relative', width: micTam, height: micTam, transition: 'width .45s cubic-bezier(.2,.8,.2,1), height .45s cubic-bezier(.2,.8,.2,1)', flexShrink: 0 }}>
          {escuchando && [0, 1, 2].map(i => (
            <span key={i} aria-hidden className="oo-anim" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${C.orbiLight}`, opacity: 0, animation: `pr-ping 1.9s cubic-bezier(0,0,.2,1) ${i * 0.62}s infinite` }} />
          ))}
          <button
            type="button" className="pr-btn" onClick={tocarMic} aria-label={fase === 'voz' ? 'Dejar de escuchar' : 'Micrófono'}
            style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '50%', border: 'none', display: 'grid', placeItems: 'center', color: '#fff', background: escuchando ? 'linear-gradient(135deg, #3B82F6, #8B5CF6)' : 'rgba(30,41,59,.9)', boxShadow: escuchando ? `0 0 ${micTam * 0.6}px rgba(139,92,246,.6), inset 0 0 0 2px rgba(255,255,255,.2)` : 'inset 0 0 0 2px rgba(148,163,184,.3)', transition: 'background .4s, box-shadow .4s' }}
          >
            {fase === 'voz' ? <Square size={Math.round(micTam * 0.34)} fill="currentColor" strokeWidth={0} /> : <Mic size={Math.round(micTam * 0.42)} strokeWidth={2.2} />}
          </button>
        </div>

        <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: compacto ? 3 : 5, height: alturaMax * k, transition: 'height .4s' }}>
          {Array.from({ length: 28 }, (_, i) => {
            const base = 10 + ((i * 37) % 29)
            const h = Math.round((base / 46) * alturaMax * k)
            const estilo = { ['--h' as string]: `${Math.max(h, 8)}px` } as CSSProperties
            return (
              <span key={i} className="oo-anim" style={{
                ...estilo, width: compacto ? 3 : 5, borderRadius: 99, height: 6,
                background: escuchando ? `linear-gradient(180deg, ${C.primaryLight}, ${C.orbiLight})` : 'rgba(148,163,184,.28)',
                animation: escuchando ? `oo-onda ${0.55 + (i % 5) * 0.11}s ease-in-out ${i * 0.04}s infinite alternate` : 'none',
                transition: 'background .3s, height .3s',
              }} />
            )
          })}
        </div>

        {!compacto && vozDisponible && (
          <button type="button" className="pr-btn" onClick={probarVoz} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: `${10 * k}px ${18 * k}px`, borderRadius: 999, background: fase === 'voz' ? `${C.error}22` : `${C.orbi}1F`, border: `1px solid ${fase === 'voz' ? C.error : C.orbi}66`, color: fase === 'voz' ? C.error : C.orbiLight, fontFamily: FONT, fontWeight: 700, fontSize: Math.round(15 * k) }}>
            {fase === 'voz' ? <><Square size={14} fill="currentColor" strokeWidth={0} /> Dejar de escuchar</> : <><Mic size={16} /> Probar con tu voz</>}
          </button>
        )}
      </div>
    )
  }

  // ─── Layout ───

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: 600, padding: 26, boxSizing: 'border-box', fontFamily: FONT, color: C.text, background: alto ? '#000' : 'transparent', borderRadius: 22, transition: 'background .3s' }}>
      <style>{CSS}</style>

      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Chip color={C.orbiLight} style={{ fontSize: Math.round(13 * k), padding: '6px 14px' }}><Ear size={14} /> Barbería Sur · Modo Oído</Chip>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: FONT_MONO, fontSize: Math.round(13 * k), color: escuchando ? C.orbiLight : C.subtle, transition: 'color .3s' }}>
            <span style={{ position: 'relative', width: 12, height: 12, display: 'inline-block' }}>
              <span className="oo-anim" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: escuchando ? C.orbi : C.subtle, boxShadow: escuchando ? `0 0 14px ${C.orbi}` : 'none', animation: escuchando ? 'oo-latido 1s ease-in-out infinite' : 'none', transition: 'background .3s' }} />
            </span>
            {textoEscucha}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="pr-btn" onClick={() => dispatch({ tipo: 'ALTO' })} aria-pressed={alto} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'transparent', border: `1px solid ${alto ? C.warning : C.borderStrong}`, borderRadius: 999, padding: '6px 12px 6px 8px', color: alto ? C.warning : C.body, fontFamily: FONT, fontSize: 13, fontWeight: 700 }}>
            <span style={{ width: 34, height: 20, borderRadius: 999, background: alto ? C.warning : 'rgba(148,163,184,.25)', position: 'relative', transition: 'background .25s' }}>
              <span style={{ position: 'absolute', top: 2, left: alto ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: alto ? '#0F172A' : '#F8FAFC', transition: 'left .25s cubic-bezier(.2,.8,.2,1)' }} />
            </span>
            Alto contraste
          </button>
          <Boton variante="fantasma" tam="sm" onClick={reiniciar}><RotateCcw size={13} /> Reiniciar</Boton>
        </div>
      </div>

      {/* Cuerpo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 290px', gap: 22, alignItems: 'stretch' }}>
        {/* Escenario */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          <div style={{ borderRadius: 20, border: `1px solid ${alto ? C.borderStrong : C.border}`, background: alto ? '#000' : 'rgba(15,23,42,.45)', padding: `${22 * k}px ${26 * k}px`, minHeight: 380, display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden' }}>
            {!compacto && (
              <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: escuchando ? `radial-gradient(circle at 50% 70%, ${C.orbi}2E 0%, transparent 55%)` : 'transparent', transition: 'background .6s' }} />
            )}
            <div style={{ position: 'relative' }}>
              {renderTranscripcion()}
              {fase === 'interpretando' ? renderInterpretando() : renderLeyenda()}
            </div>

            {compacto ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>{renderMic()}</div>
                {renderResultado()}
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 0', position: 'relative' }}>
                {renderMic()}
              </div>
            )}
          </div>

          {/* Comandos simulados */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Etiqueta color={C.muted} style={{ fontSize: 11 }}>Decir:</Etiqueta>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.subtle }}>simulá una frase (o usá tu voz de verdad)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10 }}>
              {COMANDOS.map(frase => (
                <button key={frase} type="button" className="oo-cmd" onClick={() => decir(frase)} disabled={ocupado} style={{ textAlign: 'left', minHeight: 78 * k, padding: `${12 * k}px ${14 * k}px`, borderRadius: 16, background: 'rgba(139,92,246,.07)', border: `1px solid ${alto ? C.borderStrong : C.border}`, color: C.text, fontFamily: FONT, fontSize: Math.round(15 * k), fontWeight: 600, lineHeight: 1.3, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Mic size={16} color={C.orbiLight} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>&ldquo;{frase}&rdquo;</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Registro lateral */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={{ borderRadius: 20, border: `1px solid ${alto ? C.borderStrong : C.border}`, background: alto ? '#000' : 'rgba(15,23,42,.45)', padding: 16, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Etiqueta color={C.muted} style={{ fontSize: 11, marginBottom: 10 }}>Hoy por voz</Etiqueta>
            <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: C.body, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span><b style={{ color: C.success, fontSize: 18 }}>{stats.cobros}</b> cobros</span><span style={{ color: C.subtle }}>·</span>
              <span><b style={{ color: C.orbiLight, fontSize: 18 }}>{stats.turnos}</b> turnos</span><span style={{ color: C.subtle }}>·</span>
              <span><b style={{ color: stats.errores > 0 ? C.error : C.muted, fontSize: 18 }}>{stats.errores}</b> errores</span>
            </div>
            <div style={{ borderTop: `1px dashed ${C.border}`, margin: '12px 0 10px' }} />
            <Etiqueta color={C.muted} style={{ fontSize: 11, marginBottom: 8 }}>En esta sesión</Etiqueta>
            <div className="pr-scroll" style={{ overflowY: 'auto', maxHeight: 300, display: 'flex', flexDirection: 'column', gap: 6, fontFamily: FONT_MONO, fontSize: 12, flex: 1 }}>
              {registro.length === 0 && <div style={{ color: C.subtle, lineHeight: 1.5 }}>Todavía no dijiste nada. Cada comando queda acá con su hora.</div>}
              {registro.map((e, i) => (
                <div key={`${e.hora}-${i}-${e.texto}`} className="pr-fade-up" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', lineHeight: 1.4 }}>
                  <span style={{ color: C.subtle, flexShrink: 0 }}>{e.hora}</span>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: COLOR_ENTRADA[e.tipo], marginTop: 6, flexShrink: 0 }} />
                  <span style={{ color: C.body, wordBreak: 'break-word' }}>{e.texto}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: `1px dashed ${C.border}`, margin: '12px 0 10px' }} />
            <Etiqueta color={C.muted} style={{ fontSize: 11, marginBottom: 8 }}>Inventario</Etiqueta>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: FONT_MONO, fontSize: 12 }}>
              {CATALOGO.filter(p => p.stock !== null).map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', color: C.body }}>
                  <span>{p.nombre}</span>
                  <span style={{ color: (stock[p.id] ?? 0) < (p.stock ?? 0) ? C.warning : C.muted, fontWeight: 700 }}>{stock[p.id]} {p.unidad}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderRadius: 16, border: `1px solid ${C.orbi}44`, background: `${C.orbi}12`, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Ear size={16} color={C.orbiLight} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontFamily: FONT, fontSize: 12.5, color: C.body, lineHeight: 1.45 }}>
              Orbi solo escucha después de la palabra <b style={{ color: C.orbiLight }}>&lsquo;Orbi&rsquo;</b>. El indicador muestra cuándo.
            </div>
          </div>
        </div>
      </div>

      {/* Aviso flotante */}
      {aviso && (
        <div key={aviso} role="status" className="oo-anim" style={{ position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)', padding: '12px 22px', borderRadius: 999, background: 'rgba(15,23,42,.95)', border: `1px solid ${C.borderStrong}`, boxShadow: '0 20px 60px rgba(0,0,0,.5)', fontFamily: FONT_DISPLAY, fontSize: Math.round(20 * k), fontWeight: 700, color: C.text, whiteSpace: 'nowrap', animation: 'oo-toast 2.8s ease both', zIndex: 5, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <OrbiAvatar size={22} /> {aviso}
        </div>
      )}
    </div>
  )
}
