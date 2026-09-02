// src/modules/propuestas/prototipos/Radar.tsx — Prototipo #5 "Radar de
// Deseos": los clientes piden lo que la tienda todavía no tiene; el dueño ve
// la demanda en un radar (agrupada por palabras clave + talle, sin IA) y
// cuando consigue el producto lo "lanza": los que lo pidieron reciben aviso y
// 24 hs de prioridad para comprarlo antes de que salga público.
//
// DEMO INTERNA — autocontenido: sin fetch, sin storage, sin imágenes.

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Radar as RadarIcon, Rocket, Users, PackageCheck, Search, Send, Check, Bell, Clock, RotateCcw, ShoppingBag, ChevronLeft, Info, Zap, Eye, Crosshair } from 'lucide-react'
import { C, FONT, FONT_DISPLAY, FONT_MONO, Tarjeta, Chip, Boton, Etiqueta, Pantalla, formatoARS } from '../ui'

// ─── Constantes ──────────────────────────────────────────────────────────────

const ACENTO = '#FB7185'
const ACENTO_OSCURO = '#BE123C'
const CLIENTA = 'Sofía Ramírez'
const BARRIDO_S = 4
const W = 800, H = 560, CX = 400, CY = 286, R = 236, R_MIN = 34

const CATS = ['Calzado', 'Ropa', 'Accesorios', 'Talles especiales'] as const
type Categoria = (typeof CATS)[number]
/** Sector de cada categoría en grados, medidos desde arriba en sentido horario. */
const CAT_INFO: Record<Categoria, { color: string; desde: number; hasta: number; emoji: string }> = {
  Calzado: { color: '#FB7185', desde: 0, hasta: 180, emoji: '👟' },
  Ropa: { color: '#60A5FA', desde: 180, hasta: 240, emoji: '🧦' },
  Accesorios: { color: '#FBBF24', desde: 240, hasta: 300, emoji: '🎒' },
  'Talles especiales': { color: '#A78BFA', desde: 300, hasta: 360, emoji: '📏' },
}

const SUGERENCIAS = ['Zapatillas urbanas 44', 'Botas de lluvia', 'Talle 45', 'Botines de fútbol 42']
const TALLES = ['37', '38', '39', '40', '41', '42', '43', '44', '45', '46']

const CSS = `
  @keyframes rd-eco { 0% { transform: scale(1); opacity: .85; } 40% { transform: scale(2.8); opacity: 0; } 100% { transform: scale(2.8); opacity: 0; } }
  @keyframes rd-brillo { 0%, 10% { filter: brightness(1.9) saturate(1.3); } 45%, 100% { filter: brightness(1) saturate(1); } }
  @keyframes rd-nacer { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.25); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
  @keyframes rd-destello { 0% { transform: scale(.6); opacity: 1; } 100% { transform: scale(3.4); opacity: 0; } }
  @keyframes rd-onda { 0% { transform: scale(.06); opacity: .9; } 100% { transform: scale(1.04); opacity: 0; } }
  @keyframes rd-push { 0% { opacity: 0; transform: translateY(-90px) scale(.96); } 100% { opacity: 1; transform: none; } }
  @keyframes rd-pop { 0% { transform: scale(.4); opacity: 0; } 70% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); } }
  @keyframes rd-toast { 0% { opacity: 0; transform: translate(-50%, -8px); } 10% { opacity: 1; transform: translate(-50%, 0); } 85% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, 0); } }
  @keyframes rd-barra { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  @keyframes rd-latido { 0%, 100% { box-shadow: 0 0 0 0 rgba(251,113,133,.55); } 50% { box-shadow: 0 0 0 7px rgba(251,113,133,0); } }
  .rd-punto { cursor: pointer; }
  .rd-punto:hover .rd-nucleo { filter: brightness(1.35); }
  .rd-campo { width: 100%; border: 1px solid #E2E8F0; background: #F8FAFC; border-radius: 12px; padding: 11px 12px 11px 36px; font: inherit; font-size: 14px; color: #0F172A; outline: none; transition: border-color .15s, box-shadow .15s; }
  .rd-campo:focus { border-color: ${ACENTO}; box-shadow: 0 0 0 3px rgba(251,113,133,.2); background: #fff; }
  .rd-chip { cursor: pointer; border: 1px solid #E2E8F0; background: #fff; font: inherit; font-size: 12px; font-weight: 600; color: #475569; padding: 6px 10px; border-radius: 999px; transition: all .15s; white-space: nowrap; }
  .rd-chip:hover { border-color: ${ACENTO}; color: ${ACENTO_OSCURO}; }
  .rd-chip[data-activo="1"] { background: #FFF1F2; border-color: ${ACENTO}; color: ${ACENTO_OSCURO}; }
  .rd-talle { cursor: pointer; border: 1px solid #E2E8F0; background: #fff; font: inherit; font-size: 12px; font-weight: 700; color: #475569; width: 30px; height: 28px; border-radius: 8px; transition: all .15s; }
  .rd-talle:hover { border-color: ${ACENTO}; }
  .rd-talle[data-activo="1"] { background: ${ACENTO}; border-color: ${ACENTO}; color: #fff; }
  .rd-volver { cursor: pointer; border: 0; background: transparent; font: inherit; font-size: 12.5px; font-weight: 700; color: #64748B; display: inline-flex; align-items: center; gap: 4px; padding: 0; }
  .rd-volver:hover { color: #0F172A; }
`

// ─── Tipos ───────────────────────────────────────────────────────────────────

type EstadoDeseo = 'activo' | 'lanzando' | 'lanzado'
interface Deseo {
  id: string; nombre: string; claves: string[]; talle?: string; categoria: Categoria
  /** Grados desde arriba, horario. Fijo por deseo. */
  angulo: number
  /** Desfase (en s) respecto del barrido, para que el ping coincida con el paso del haz. */
  fase: number
  /** Orden de entrada, para escalonar la animación de nacimiento. */
  entrada: number
  personas: string[]; historial: number[]; precio: number; emoji: string
  /** Cuánto compraría el dueño "a ciegas" sin esta señal. */
  ciegas: number
  estado: EstadoDeseo
}
interface Lanzamiento {
  id: string; deseoId: string; nombre: string; emoji: string; precio: number; categoria: Categoria
  avisados: number; abrieron: number; compraron: number; metaAbrieron: number; metaCompraron: number
  ahorro: number; ciegas: number; cuando: string; hastaTexto: string; fin: number; previo?: boolean
}
type PantallaCel = 'buscar' | 'enviado' | 'ficha'

// ─── Agrupación sin IA: palabras clave normalizadas + talle ─────────────────

const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'para', 'con', 'y', 'o', 'en', 'un', 'una', 'unos', 'unas', 'que', 'no', 'tienen', 'tenes', 'quiero', 'busco', 'algo', 'talle', 'numero', 'nro', 'n', 'me', 'gustaria', 'necesito'])
const CALZADO = ['zapatilla', 'bota', 'sandalia', 'ojota', 'mocasin', 'borcego', 'zapato', 'alpargata', 'pantufla', 'chinela', 'zueco', 'botin', 'botineta', 'stiletto', 'taco', 'nautico', 'crocs', 'chatita', 'bailarina', 'guillermina', 'texana', 'plataforma', 'sneaker', 'chancleta', 'zapatilla']
const ROPA = ['media', 'remera', 'buzo', 'pantalon', 'campera', 'calza', 'short', 'cancan', 'soquete', 'bufanda', 'gorro', 'camisa', 'jean', 'pollera', 'chaleco', 'musculosa']
const ACCESORIOS = ['cordon', 'plantilla', 'cinto', 'cinturon', 'bolso', 'cartera', 'mochila', 'rinonera', 'betun', 'crema', 'cepillo', 'horma', 'talonera', 'billetera', 'bolsa', 'llavero', 'paraguas', 'calzador', 'impermeabilizante', 'protector', 'limpiador']

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const singular = (w: string) => (w.length > 5 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)

function analizar(texto: string, talleElegido: string | null): { claves: string[]; talle?: string; categoria: Categoria } {
  const limpio = normalizar(texto).replace(/[^a-z0-9ñ\s]/g, ' ')
  let talle = talleElegido ?? undefined
  const palabras: string[] = []
  for (const w of limpio.split(/\s+/).filter(Boolean)) {
    if (/^\d{2}$/.test(w)) { const n = Number(w); if (n >= 20 && n <= 50 && !talle) talle = w; continue }
    if (/^\d+$/.test(w) || STOP.has(w)) continue
    palabras.push(singular(w))
  }
  const claves = [...new Set(palabras)]
  const nTalle = talle ? Number(talle) : 0
  let categoria: Categoria = 'Calzado'
  if (claves.some(k => ROPA.includes(k))) categoria = 'Ropa'
  else if (claves.some(k => ACCESORIOS.includes(k))) categoria = 'Accesorios'
  else if (nTalle >= 45 || (nTalle > 0 && nTalle <= 34) || (claves.length === 0 && talle)) categoria = 'Talles especiales'
  else if (claves.some(k => CALZADO.includes(k))) categoria = 'Calzado'
  return { claves, talle, categoria }
}

/** 0..1: cuánto se parece un deseo existente a un pedido nuevo. Talle distinto = 0. */
function afinidad(a: Deseo, b: { claves: string[]; talle?: string }): number {
  if ((a.talle ?? '') !== (b.talle ?? '')) return 0
  if (a.claves.length === 0 && b.claves.length === 0) return 1
  if (a.claves.length === 0 || b.claves.length === 0) return 0
  const comunes = b.claves.filter(k => a.claves.includes(k)).length
  return comunes / Math.min(a.claves.length, b.claves.length)
}

function anguloNuevo(cat: Categoria, n: number): number {
  const { desde, hasta } = CAT_INFO[cat]
  const span = hasta - desde
  return desde + span * 0.12 + ((n * 0.382) % 1) * span * 0.76
}

function capitalizar(texto: string, talle?: string): string {
  const base = texto.trim().replace(/\s+/g, ' ')
  const conMayus = base.charAt(0).toUpperCase() + base.slice(1)
  return talle && !base.includes(talle) ? `${conMayus} ${talle}` : conMayus
}

// ─── Datos de ejemplo ────────────────────────────────────────────────────────

const NOMBRES = ['Martín Acosta', 'Valentina Ríos', 'Julián Paz', 'Camila Sosa', 'Lucas Ferreyra', 'Agustina Molina', 'Nico Bravo', 'Florencia Díaz', 'Tomás Giménez', 'Micaela Torres', 'Bruno Castro', 'Lucía Fernández', 'Matías Romero', 'Paula Herrera', 'Joaquín Silva', 'Carla Benítez', 'Franco Ojeda', 'Milagros Ruiz', 'Santiago Vega', 'Belén Córdoba', 'Ezequiel Luna', 'Antonella Medina', 'Gonzalo Aguirre', 'Rocío Peralta', 'Iván Suárez', 'Josefina Castillo', 'Damián Ledesma', 'Malena Ríos', 'Federico Cabrera', 'Abril Navarro', 'Ramiro Godoy', 'Celeste Ponce', 'Facundo Ibarra', 'Ludmila Farías']
const gente = (desde: number, n: number) => Array.from({ length: n }, (_, i) => NOMBRES[(desde + i) % NOMBRES.length] ?? 'Cliente')
const iniciales = (n: string) => n.split(' ').map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase()
const pad = (n: number) => String(n).padStart(2, "0")
/** Relojes envueltos para llamarlos solo desde handlers y effects (nunca en render). */
const relojMs = () => Date.now()
const relojFino = () => performance.now()

function semilla(id: string, nombre: string, angulo: number, desde: number, n: number, historial: number[], precio: number, emoji: string, ciegas: number, entrada: number): Deseo {
  const a = analizar(nombre, null)
  return { id, nombre, claves: a.claves, talle: a.talle, categoria: a.categoria, angulo, fase: 0, entrada, personas: gente(desde, n), historial, precio, emoji, ciegas, estado: 'activo' }
}

const SEMILLA: Deseo[] = [
  semilla('zap44', 'Zapatillas urbanas negras 44', 30, 0, 14, [0, 1, 0, 0, 1, 0, 1], 68900, '👟', 40, 0),
  semilla('botas', 'Botas de lluvia', 105, 14, 9, [0, 0, 1, 1, 0, 1, 1], 54900, '🥾', 30, 1),
  semilla('t45', 'Talle 45', 335, 23, 7, [1, 0, 0, 1, 0, 0, 1], 59900, '📏', 20, 2),
  semilla('sand', 'Sandalias de cuero', 55, 30, 5, [0, 0, 0, 1, 0, 1, 0], 46900, '👡', 24, 3),
  semilla('medias', 'Medias lisas negras', 210, 35, 4, [0, 1, 0, 0, 0, 1, 0], 6900, '🧦', 60, 4),
  semilla('ojotas', 'Ojotas hombre', 140, 39, 3, [0, 0, 0, 0, 1, 0, 1], 18900, '🩴', 30, 5),
  semilla('cordones', 'Cordones de colores', 255, 42, 2, [0, 0, 0, 0, 0, 1, 0], 2900, '🎒', 80, 6),
  semilla('moc', 'Mocasines', 12, 44, 2, [0, 0, 1, 0, 0, 0, 0], 72900, '👞', 20, 7),
]

const LANZADOS_PREVIOS: Lanzamiento[] = [
  { id: 'prev1', deseoId: 'prev-borcegos', nombre: 'Borcegos negros 43', emoji: '🥾', precio: 71900, categoria: 'Calzado', avisados: 11, abrieron: 9, compraron: 8, metaAbrieron: 9, metaCompraron: 8, ahorro: 672300, ciegas: 28, cuando: 'hace 12 días', hastaTexto: 'ya público', fin: 0, previo: true },
]

// ─── Geometría del radar ─────────────────────────────────────────────────────

function posicion(cantidad: number, cMax: number, angulo: number) {
  const u = Math.min(1, cantidad / cMax)
  const f = 0.5 * u + 0.5 * Math.sqrt(u)
  const d = R_MIN + (R - R_MIN) * (1 - f)
  const rad = (angulo * Math.PI) / 180
  const ux = Math.sin(rad), uy = -Math.cos(rad)
  return { x: CX + d * ux, y: CY + d * uy, ux, uy }
}
const radioDe = (c: number) => 7 + Math.sqrt(c) * 3.6
const polar = (a: number, r: number) => { const rad = (a * Math.PI) / 180; return { x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) } }
function arco(a0: number, a1: number, r: number) {
  const p0 = polar(a0, r), p1 = polar(a1, r)
  return `M ${CX} ${CY} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p1.x} ${p1.y} Z`
}
function fmtCuenta(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

// ─── Piezas chicas ───────────────────────────────────────────────────────────

function NumeroAnimado({ valor, formato = (n: number) => String(n), style }: { valor: number; formato?: (n: number) => string; style?: CSSProperties }) {
  const [mostrado, setMostrado] = useState(valor)
  const previo = useRef(valor)
  useEffect(() => {
    const desde = previo.current
    const hasta = valor
    if (desde === hasta) return
    const inicio = performance.now()
    let raf = 0
    const paso = (ahora: number) => {
      const u = Math.min(1, (ahora - inicio) / 600)
      const e = 1 - Math.pow(1 - u, 3)
      setMostrado(Math.round(desde + (hasta - desde) * e))
      if (u < 1) raf = requestAnimationFrame(paso)
      else previo.current = hasta
    }
    raf = requestAnimationFrame(paso)
    return () => { cancelAnimationFrame(raf); previo.current = hasta }
  }, [valor])
  return <span style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{formato(mostrado)}</span>
}

function Metrica({ icono, etiqueta, valor, sub, color }: { icono: ReactNode; etiqueta: string; valor: ReactNode; sub: string; color: string }) {
  return (
    <Tarjeta style={{ padding: '12px 14px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
        <span style={{ color, display: 'inline-flex' }}>{icono}</span>{etiqueta}
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: C.text, marginTop: 4, lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
    </Tarjeta>
  )
}

function Contador({ icono, n, etiqueta, color }: { icono: ReactNode; n: number; etiqueta: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: C.body }}>
      <span style={{ color, display: 'inline-flex' }}>{icono}</span>
      <NumeroAnimado valor={n} style={{ fontWeight: 800, color: C.text, fontFamily: FONT_MONO }} />
      {etiqueta}
    </span>
  )
}

function Pasos({ paso }: { paso: number }) {
  const items = ['Pedir', 'Lanzar', 'Prioridad']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {items.map((t, i) => {
        const n = i + 1
        const hecho = paso > n, activo = paso === n
        const color = hecho ? C.success : activo ? ACENTO : C.subtle
        return (
          <Fragment key={t}>
            {i > 0 && <span style={{ width: 14, height: 1, background: hecho || activo ? color : C.border }} />}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px 4px 5px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color, background: activo ? `${ACENTO}1F` : 'transparent', border: `1px solid ${activo ? `${ACENTO}66` : C.border}`, transition: 'all .3s' }}>
              <span style={{ width: 16, height: 16, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, background: hecho ? C.success : activo ? ACENTO : 'transparent', color: hecho || activo ? '#fff' : C.subtle, border: hecho || activo ? 'none' : `1px solid ${C.subtle}` }}>{hecho ? <Check size={10} /> : n}</span>
              {t}
            </span>
          </Fragment>
        )
      })}
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function Radar() {
  const [deseos, setDeseos] = useState<Deseo[]>(SEMILLA)
  const [lanzamientos, setLanzamientos] = useState<Lanzamiento[]>(LANZADOS_PREVIOS)
  const [sel, setSel] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [destello, setDestello] = useState<{ id: number; deseoId: string } | null>(null)
  const [texto, setTexto] = useState('')
  const [talle, setTalle] = useState<string | null>(null)
  const [pantalla, setPantalla] = useState<PantallaCel>('buscar')
  const [enviado, setEnviado] = useState<{ deseoId: string; nuevo: boolean; repetido: boolean } | null>(null)
  const [notif, setNotif] = useState<{ id: number; lanzId: string } | null>(null)
  const [fichaId, setFichaId] = useState<string | null>(null)
  const [ahora, setAhora] = useState(0)
  const [compras, setCompras] = useState<string[]>([])
  const [toast, setToast] = useState<{ id: number; texto: string; color: string } | null>(null)

  const t0 = useRef(0)
  const timers = useRef<Set<number>>(new Set())
  const contador = useRef(0)
  const hoverTimer = useRef(0)
  const toastTimer = useRef(0)

  useEffect(() => {
    t0.current = relojFino()
    const activos = timers.current
    return () => { activos.forEach(id => { window.clearTimeout(id); window.clearInterval(id) }); activos.clear() }
  }, [])

  // Cuenta regresiva de la prioridad (decorativa, pero real).
  useEffect(() => {
    if (pantalla !== 'ficha') return
    const id = window.setInterval(() => setAhora(relojMs()), 1000)
    return () => window.clearInterval(id)
  }, [pantalla])

  // ── Timers con limpieza ──
  const luego = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.current.delete(id); fn() }, ms)
    timers.current.add(id)
    return id
  }
  const cada = (fn: (tick: number) => boolean, ms: number) => {
    let tick = 0
    const id = window.setInterval(() => { tick += 1; if (fn(tick)) { window.clearInterval(id); timers.current.delete(id) } }, ms)
    timers.current.add(id)
  }
  const avisar = (t: string, color = ACENTO) => {
    window.clearTimeout(toastTimer.current)
    timers.current.delete(toastTimer.current)
    setToast(prev => ({ id: (prev?.id ?? 0) + 1, texto: t, color }))
    toastTimer.current = luego(() => setToast(null), 3800)
  }
  const entrarHover = (id: string) => { window.clearTimeout(hoverTimer.current); timers.current.delete(hoverTimer.current); setHover(id) }
  const salirHover = () => { window.clearTimeout(hoverTimer.current); timers.current.delete(hoverTimer.current); hoverTimer.current = luego(() => setHover(null), 260) }

  // ── Acciones del cliente ──
  const pedir = (crudo: string, talleElegido: string | null) => {
    const limpio = crudo.trim()
    if (!limpio && !talleElegido) return
    const a = analizar(limpio || `talle ${talleElegido ?? ''}`, talleElegido)
    if (a.claves.length === 0 && !a.talle) return
    const candidatos = deseos.filter(d => d.estado === 'activo').map(d => ({ d, s: afinidad(d, a) })).filter(x => x.s >= 0.6)
    candidatos.sort((x, y) => y.s - x.s || y.d.personas.length - x.d.personas.length)
    const existente = candidatos[0]?.d
    let deseoId: string
    if (existente) {
      const repetido = existente.personas.includes(CLIENTA)
      deseoId = existente.id
      setDeseos(prev => prev.map(d => d.id !== existente.id ? d : { ...d, personas: repetido ? d.personas : [...d.personas, CLIENTA], historial: repetido ? d.historial : d.historial.map((h, i) => (i === 6 ? h + 1 : h)) }))
      setEnviado({ deseoId, nuevo: false, repetido })
      avisar(repetido ? `${CLIENTA} volvió a pedir "${existente.nombre}": ya estaba en el grupo` : `Pedido "${limpio || `Talle ${a.talle ?? ''}`}" → agrupado con "${existente.nombre}" · ahora ${existente.personas.length + 1} personas`)
    } else {
      contador.current += 1
      const n = contador.current
      const nombre = capitalizar(limpio || 'Talle', talleElegido ?? a.talle)
      const fase = ((relojFino() - t0.current) % (BARRIDO_S * 1000)) / 1000
      deseoId = `d${n}`
      const nuevo: Deseo = { id: deseoId, nombre, claves: a.claves, talle: a.talle, categoria: a.categoria, angulo: anguloNuevo(a.categoria, n), fase, entrada: 0, personas: [CLIENTA], historial: [0, 0, 0, 0, 0, 0, 1], precio: 45900, emoji: CAT_INFO[a.categoria].emoji, ciegas: 12, estado: 'activo' }
      setDeseos(prev => [...prev, nuevo])
      setEnviado({ deseoId, nuevo: true, repetido: false })
      avisar(`Nuevo deseo en el radar: "${nombre}" · sector ${a.categoria}`)
    }
    setSel(deseoId)
    setDestello(prev => {
      const id = (prev?.id ?? 0) + 1
      luego(() => setDestello(cur => (cur?.id === id ? null : cur)), 1500)
      return { id, deseoId }
    })
    setPantalla('enviado')
    setTexto('')
    setTalle(null)
  }

  const abrirFicha = (lanzId: string) => {
    setNotif(null)
    setFichaId(lanzId)
    setAhora(relojMs())
    setPantalla('ficha')
    setLanzamientos(prev => prev.map(l => (l.id === lanzId && l.abrieron >= l.metaAbrieron ? { ...l, abrieron: Math.min(l.avisados, l.abrieron + 1), metaAbrieron: Math.min(l.avisados, l.metaAbrieron + 1) } : l)))
  }

  const comprar = (lz: Lanzamiento) => {
    setCompras(prev => [...prev, lz.id])
    setLanzamientos(prev => prev.map(l => (l.id === lz.id ? { ...l, compraron: Math.min(l.avisados, l.compraron + 1), metaCompraron: Math.min(l.avisados, l.metaCompraron + 1) } : l)))
    avisar(`${CLIENTA} compró con prioridad "${lz.nombre}" · ${formatoARS(lz.precio)}`, C.success)
  }

  // ── Acciones del dueño ──
  const lanzar = (id: string) => {
    const d = deseos.find(x => x.id === id)
    if (!d || d.estado !== 'activo') return
    const n = d.personas.length
    const ahoraMs = relojMs()
    const fecha = new Date(ahoraMs)
    contador.current += 1
    const lanzId = `l${contador.current}`
    const lz: Lanzamiento = {
      id: lanzId, deseoId: id, nombre: d.nombre, emoji: d.emoji, precio: d.precio, categoria: d.categoria,
      avisados: n, abrieron: 0, compraron: 0, metaAbrieron: Math.max(1, Math.round(n * 0.64)), metaCompraron: Math.max(1, Math.round(n * 0.43)),
      ahorro: Math.max(0, d.ciegas - n) * Math.round(d.precio * 0.55), ciegas: d.ciegas, cuando: 'recién', hastaTexto: `mañana ${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`, fin: ahoraMs + 24 * 3600 * 1000,
    }
    setDeseos(prev => prev.map(x => (x.id === id ? { ...x, estado: 'lanzando' } : x)))
    setLanzamientos(prev => [lz, ...prev])
    setSel(null)
    setHover(null)
    avisar(`Lanzado "${d.nombre}": aviso enviado a ${n} personas con prioridad 24 hs`, C.success)
    luego(() => setDeseos(prev => prev.map(x => (x.id === id ? { ...x, estado: 'lanzado' } : x))), 1300)
    luego(() => setNotif(prev => ({ id: (prev?.id ?? 0) + 1, lanzId })), 1000)
    cada(tick => {
      setLanzamientos(prev => prev.map(l => {
        if (l.id !== lanzId) return l
        return { ...l, abrieron: Math.min(l.metaAbrieron, l.abrieron + (tick % 3 === 0 ? 2 : 1)), compraron: tick > 4 && tick % 2 === 0 ? Math.min(l.metaCompraron, l.compraron + 1) : l.compraron }
      }))
      return tick >= 24
    }, 380)
  }

  const reiniciar = () => {
    timers.current.forEach(id => { window.clearTimeout(id); window.clearInterval(id) })
    timers.current.clear()
    contador.current = 0
    setDeseos(SEMILLA); setLanzamientos(LANZADOS_PREVIOS)
    setSel(null); setHover(null); setDestello(null)
    setTexto(''); setTalle(null); setPantalla('buscar'); setEnviado(null)
    setNotif(null); setFichaId(null); setCompras([]); setToast(null)
  }

  // ── Derivados ──
  const visibles = deseos.filter(d => d.estado !== 'lanzado')
  const cMax = Math.max(16, ...visibles.map(d => d.personas.length))
  const puntos = visibles.map(d => {
    const n = d.personas.length
    const p = posicion(n, cMax, d.angulo)
    return { d, n, ...p, r: radioDe(n), color: CAT_INFO[d.categoria].color, gi: CATS.indexOf(d.categoria) }
  })
  const activos = puntos.filter(p => p.d.estado === 'activo')
  const lanzando = puntos.filter(p => p.d.estado === 'lanzando')
  const mostradoId = sel ?? hover
  const puntoSel = activos.find(p => p.d.id === mostradoId)
  const ordenados = [...activos].sort((a, b) => (a.d.id === mostradoId ? 1 : 0) - (b.d.id === mostradoId ? 1 : 0))

  const deseosActivos = deseos.filter(d => d.estado === 'activo')
  const personasEsperando = deseosActivos.reduce((s, d) => s + d.personas.length, 0)
  const totalAhorro = lanzamientos.reduce((s, l) => s + l.ahorro, 0)
  const misPedidos = deseos.filter(d => d.personas.includes(CLIENTA))
  const lanzNotif = notif ? lanzamientos.find(l => l.id === notif.lanzId) : undefined
  const lanzFicha = fichaId ? lanzamientos.find(l => l.id === fichaId) : undefined
  const enviadoDeseo = enviado ? deseos.find(d => d.id === enviado.deseoId) : undefined
  const lanzadosNuevos = lanzamientos.filter(l => !l.previo)

  const paso = compras.length > 0 ? 4 : pantalla === 'ficha' || notif || lanzadosNuevos.length > 0 ? 3 : misPedidos.length > 0 ? 2 : 1
  const pista = (() => {
    if (paso === 1) return 'Sos la clienta: tocá una sugerencia en el celular y mandá el pedido. El punto destella en el radar y el contador sube.'
    if (paso === 2) return 'Ahora sos el dueño: tocá el punto grande "Zapatillas urbanas negras 44" y dale a "Lo conseguí → Lanzar".'
    if (paso === 3 && pantalla === 'ficha') return 'La clienta tiene 24 hs antes de que salga público. Tocá "Comprar" y mirá el panel de Lanzamientos.'
    if (paso === 3) return 'El planeta salió disparado y la notificación llegó al celular. Tocá "Comprar con prioridad".'
    return 'Ciclo completo: pidió, el dueño compró con datos, ella compró primero. Probá "Botines de fútbol 42" para ver nacer un punto en el borde.'
  })()

  // Tarjeta flotante del punto: a la izquierda si está en la mitad derecha.
  const tarjetaIzq = puntoSel ? puntoSel.x > CX : false
  const tarjetaX = puntoSel ? (tarjetaIzq ? puntoSel.x - puntoSel.r - 14 : puntoSel.x + puntoSel.r + 14) : 0
  const tarjetaY = puntoSel ? Math.min(H - 150, Math.max(150, puntoSel.y)) : 0

  return (
    <div style={{ position: 'relative', padding: 26, minHeight: 600, fontFamily: FONT, color: C.body }}>
      <style>{CSS}</style>

      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{ width: 38, height: 38, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${ACENTO}, ${C.orbi})`, color: '#fff', boxShadow: `0 8px 24px ${ACENTO}55`, flexShrink: 0 }}><RadarIcon size={19} /></span>
          <div style={{ minWidth: 0 }}>
            <Etiqueta color={ACENTO}>Zapatería Lorena · Radar de deseos</Etiqueta>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: '-0.01em' }}>Los clientes piden, el dueño compra con datos y lanza con prioridad</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12.5, color: C.muted, marginTop: 3, lineHeight: 1.4 }}><Zap size={13} color={C.warning} style={{ flexShrink: 0, marginTop: 2 }} /><span>{pista}</span></div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Pasos paso={paso} />
          <Boton variante="fantasma" tam="sm" onClick={reiniciar}><RotateCcw size={13} />Reiniciar</Boton>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div key={toast.id} style={{ position: 'absolute', top: 18, left: '50%', zIndex: 30, padding: '10px 16px', borderRadius: 12, background: 'rgba(15,23,42,.96)', border: `1px solid ${toast.color}66`, boxShadow: `0 12px 40px rgba(0,0,0,.5), 0 0 0 1px ${toast.color}22`, color: C.text, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, animation: 'rd-toast 3.8s ease both', maxWidth: 600, pointerEvents: 'none' }}>
          <Bell size={14} color={toast.color} style={{ flexShrink: 0 }} />{toast.texto}
        </div>
      )}

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr)) minmax(0, 1.35fr)', gap: 10, marginBottom: 16 }}>
        <Metrica icono={<Crosshair size={14} />} color={ACENTO} etiqueta="Deseos activos" valor={<NumeroAnimado valor={deseosActivos.length} />} sub={`${CATS.filter(c => deseosActivos.some(d => d.categoria === c)).length} sectores con pedidos`} />
        <Metrica icono={<Users size={14} />} color={C.primaryLight} etiqueta="Personas esperando" valor={<NumeroAnimado valor={personasEsperando} />} sub={`${deseosActivos.reduce((s, d) => s + d.historial.reduce((a, b) => a + b, 0), 0)} pedidos en los últimos 7 días`} />
        <Metrica icono={<PackageCheck size={14} />} color={C.success} etiqueta="Stock comprado con datos" valor={<NumeroAnimado valor={totalAhorro} formato={formatoARS} />} sub={`ahorrados vs. comprar a ciegas · ${lanzamientos.length} lanzamiento${lanzamientos.length === 1 ? '' : 's'}`} />
        <Tarjeta style={{ padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
          <Info size={15} color={C.orbiLight} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 11.5, lineHeight: 1.45, color: C.muted }}>
            <span style={{ fontWeight: 800, color: C.body }}>Cómo se agrupa: </span>palabras clave normalizadas + talle, sin IA. <span style={{ fontFamily: FONT_MONO, color: C.orbiLight }}>&quot;zapatillas urbanas 44&quot;</span> cae en el mismo grupo que <span style={{ fontFamily: FONT_MONO, color: C.orbiLight }}>&quot;Zapatillas urbanas negras 44&quot;</span>.
          </div>
        </Tarjeta>
      </div>

      {/* Dos columnas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 22, alignItems: 'start' }}>
        {/* ── IZQUIERDA: radar del dueño ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={{ position: 'relative', borderRadius: 18, border: `1px solid ${C.border}`, overflow: 'hidden', background: `radial-gradient(circle at 50% 51%, rgba(251,113,133,.13), rgba(7,11,22,0) 58%), linear-gradient(180deg, rgba(15,23,42,.55), rgba(7,11,22,.35))` }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', fontFamily: FONT, minHeight: 540 }} onClick={() => setSel(null)} role="img" aria-label="Radar de deseos de los clientes">
              <defs>
                {CATS.map((c, i) => (
                  <radialGradient key={c} id={`rd-g${i}`} cx=".35" cy=".3" r=".85">
                    <stop offset="0" stopColor="#fff" stopOpacity=".95" />
                    <stop offset=".38" stopColor={CAT_INFO[c].color} />
                    <stop offset="1" stopColor={CAT_INFO[c].color} stopOpacity=".7" />
                  </radialGradient>
                ))}
                <filter id="rd-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>

              {/* Tintes de sector */}
              {CATS.map(c => <path key={c} d={arco(CAT_INFO[c].desde, CAT_INFO[c].hasta, R)} fill={CAT_INFO[c].color} opacity={0.045} />)}

              {/* Anillos y ejes */}
              {[0.25, 0.5, 0.75, 1].map(k => <circle key={k} cx={CX} cy={CY} r={R * k} fill="none" stroke={`rgba(251,113,133,${k === 1 ? 0.35 : 0.16})`} strokeWidth={k === 1 ? 1.5 : 1} strokeDasharray={k === 1 ? undefined : '3 6'} />)}
              <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="rgba(148,163,184,.14)" />
              <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="rgba(148,163,184,.14)" />
              {[240, 300].map(a => { const p = polar(a, R); return <line key={a} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="rgba(148,163,184,.14)" strokeDasharray="2 5" /> })}

              {/* Etiquetas de sector */}
              {CATS.map(c => {
                const info = CAT_INFO[c]
                const p = polar((info.desde + info.hasta) / 2, R + 26)
                return <text key={c} x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fontWeight={800} letterSpacing=".12em" fill={info.color} opacity={0.9}>{c.toUpperCase()}</text>
              })}

              {/* Centro */}
              <circle cx={CX} cy={CY} r={9} fill="none" stroke={ACENTO} strokeWidth={1.2} opacity={0.6} style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'pr-ping 2.4s ease-out infinite' }} />
              <circle cx={CX} cy={CY} r={3.5} fill={ACENTO} style={{ filter: 'url(#rd-glow)' }} />

              {/* Ondas de lanzamiento */}
              {lanzando.map(p => (
                <g key={`onda-${p.d.id}`}>
                  <circle cx={CX} cy={CY} r={R} fill="none" stroke={p.color} strokeWidth={2.5} style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'rd-onda 1.5s ease-out both' }} />
                  <circle cx={CX} cy={CY} r={R} fill="none" stroke={p.color} strokeWidth={1.5} style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'rd-onda 1.5s ease-out .28s both' }} />
                  <circle cx={CX} cy={CY} r={R} fill={p.color} opacity={0.12} style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'rd-onda 1.2s ease-out both' }} />
                </g>
              ))}

              {/* Deseos */}
              {ordenados.map(p => {
                const { d, n, x, y, r, color, gi } = p
                const delay = (d.angulo / 360) * BARRIDO_S - d.fase
                const izq = x < CX
                const seleccionado = d.id === sel
                const mio = d.personas.includes(CLIENTA)
                return (
                  <g
                    key={d.id}
                    className="rd-punto"
                    style={{ transform: `translate(${x}px, ${y}px)`, transition: 'transform .9s cubic-bezier(.2,.8,.2,1)' }}
                    onPointerEnter={() => entrarHover(d.id)}
                    onPointerLeave={salirHover}
                    onClick={e => { e.stopPropagation(); setSel(prev => (prev === d.id ? null : d.id)) }}
                  >
                    <circle r={r} fill={color} opacity={0.3} style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: `rd-eco ${BARRIDO_S}s ease-out infinite`, animationDelay: `${delay}s` }} />
                    {destello?.deseoId === d.id && <circle key={destello.id} r={r} fill="none" stroke="#fff" strokeWidth={2.5} style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'rd-destello 1.3s ease-out both' }} />}
                    {seleccionado && <circle r={r + 6} fill="none" stroke="#fff" strokeWidth={1.2} strokeDasharray="4 5" opacity={0.8} style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'pr-spin 8s linear infinite' }} />}
                    <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: `rd-nacer .7s cubic-bezier(.2,.8,.2,1) ${d.entrada * 0.07}s both` }}>
                      <circle className="rd-nucleo" r={r} fill={`url(#rd-g${gi})`} stroke={seleccionado ? '#fff' : 'rgba(255,255,255,.4)'} strokeWidth={seleccionado ? 2 : 1} style={{ filter: 'url(#rd-glow)', animation: `rd-brillo ${BARRIDO_S}s linear infinite`, animationDelay: `${delay}s`, transition: 'r .6s, filter .15s' }} />
                      <text y={4} textAnchor="middle" fontSize={r > 12 ? 11.5 : 10} fontWeight={800} fill="#fff" style={{ pointerEvents: 'none' }}>{n}</text>
                    </g>
                    <text x={izq ? -(r + 7) : r + 7} y={4} textAnchor={izq ? 'end' : 'start'} fontSize={11.5} fontWeight={seleccionado ? 800 : 600} fill={seleccionado ? C.text : C.body} style={{ pointerEvents: 'none', transition: 'fill .2s' }}>
                      {d.nombre}{mio && <tspan fill={ACENTO} fontWeight={800}> · vos</tspan>}
                    </text>
                  </g>
                )
              })}

              {/* Planeta lanzado: sale disparado hacia afuera con estela */}
              {lanzando.map(p => {
                const { d, n, x, y, r, ux, uy, gi, color } = p
                const dx = ux * (R + 110), dy = uy * (R + 110)
                return (
                  <g key={`lz-${d.id}`} style={{ transform: `translate(${x}px, ${y}px)` }}>
                    <g>
                      <animateTransform attributeName="transform" type="translate" from="0 0" to={`${dx} ${dy}`} dur="1.25s" begin="0s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.55 0 0.85 0.4" />
                      <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.82;1" dur="1.25s" begin="0s" fill="freeze" />
                      <defs>
                        <linearGradient id={`rd-estela-${d.id}`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={-ux * 110} y2={-uy * 110}>
                          <stop offset="0" stopColor={color} stopOpacity=".9" />
                          <stop offset="1" stopColor={color} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <line x1={0} y1={0} x2={-ux * 110} y2={-uy * 110} stroke={`url(#rd-estela-${d.id})`} strokeWidth={r * 1.4} strokeLinecap="round" />
                      <circle r={r * 1.15} fill={`url(#rd-g${gi})`} style={{ filter: 'url(#rd-glow)' }} />
                      <ellipse rx={r * 1.9} ry={r * 0.55} fill="none" stroke="rgba(255,255,255,.75)" strokeWidth={1.5} transform="rotate(-22)" />
                      <text y={4} textAnchor="middle" fontSize={11.5} fontWeight={800} fill="#fff">{n}</text>
                    </g>
                  </g>
                )
              })}
            </svg>

            {/* Barrido: sector cónico + haz, rotando sobre el círculo del radar */}
            <div aria-hidden style={{ position: 'absolute', left: `${((CX - R) / W) * 100}%`, top: `${((CY - R) / H) * 100}%`, width: `${((2 * R) / W) * 100}%`, aspectRatio: '1 / 1', borderRadius: '50%', pointerEvents: 'none', animation: `pr-spin ${BARRIDO_S}s linear infinite`, background: 'conic-gradient(from 0deg, rgba(251,113,133,0) 0deg, rgba(251,113,133,0) 275deg, rgba(251,113,133,.05) 300deg, rgba(251,113,133,.42) 360deg)', mixBlendMode: 'screen' }}>
              <div style={{ position: 'absolute', left: '50%', top: 0, width: 2, height: '50%', marginLeft: -1, background: `linear-gradient(180deg, ${ACENTO}, rgba(251,113,133,.15))`, boxShadow: `0 0 10px ${ACENTO}` }} />
            </div>

            {/* Sobreimpresos */}
            <div style={{ position: 'absolute', top: 12, left: 14, display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.success, boxShadow: `0 0 10px ${C.success}`, animation: 'pr-blink 1.6s ease-in-out infinite' }} />
              <Etiqueta color={C.body}>Radar · en vivo</Etiqueta>
            </div>
            <div style={{ position: 'absolute', top: 12, right: 14, pointerEvents: 'none' }}>
              <Chip color={C.muted} style={{ background: 'rgba(7,11,22,.6)' }}>{visibles.length} grupos · {personasEsperando} personas</Chip>
            </div>
            <div style={{ position: 'absolute', bottom: 12, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, pointerEvents: 'none', fontSize: 11, color: C.subtle }}>
              <span>Más cerca del centro = más pedido · tamaño = cantidad de personas · barrido cada {BARRIDO_S} s</span>
              <span style={{ display: 'flex', gap: 10 }}>
                {CATS.map(c => <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: CAT_INFO[c].color }} />{c}</span>)}
              </span>
            </div>

            {/* Tarjeta flotante del deseo */}
            {puntoSel && (
              <div
                key={puntoSel.d.id}
                className="pr-fade-in"
                onPointerEnter={() => entrarHover(puntoSel.d.id)}
                onPointerLeave={salirHover}
                onClick={e => e.stopPropagation()}
                style={{ position: 'absolute', left: `${(tarjetaX / W) * 100}%`, top: `${(tarjetaY / H) * 100}%`, transform: `translate(${tarjetaIzq ? '-100%' : '0'}, -50%)`, width: 264, zIndex: 4 }}
              >
                <Tarjeta style={{ padding: 14, background: 'rgba(15,23,42,.96)', borderColor: `${puntoSel.color}66`, boxShadow: `0 18px 50px rgba(0,0,0,.55), 0 0 0 1px ${puntoSel.color}22` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Chip color={puntoSel.color}>{puntoSel.d.categoria}{puntoSel.d.talle && ` · talle ${puntoSel.d.talle}`}</Chip>
                    <span style={{ fontSize: 10.5, color: C.subtle, fontFamily: FONT_MONO, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{puntoSel.d.claves.length > 0 ? puntoSel.d.claves.join(' · ') : 'solo talle'}</span>
                  </div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 800, color: C.text, marginTop: 8, letterSpacing: '-0.01em' }}>{puntoSel.d.nombre}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 800, color: puntoSel.color, lineHeight: 1 }}><NumeroAnimado valor={puntoSel.n} /></span>
                    <span style={{ fontSize: 12.5, color: C.body }}>personas lo piden</span>
                    <Chip color={C.success} style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: 11 }}>últimos 7 días +{puntoSel.d.historial.reduce((a, b) => a + b, 0)}</Chip>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 10 }}>
                    {puntoSel.d.personas.slice(0, 6).map((nombre, i) => {
                      const esMio = nombre === CLIENTA
                      return <span key={nombre} title={nombre} style={{ width: 24, height: 24, borderRadius: '50%', marginLeft: i === 0 ? 0 : -6, border: `2px solid ${C.bg2}`, background: esMio ? `linear-gradient(135deg, ${ACENTO}, ${C.orbi})` : `linear-gradient(135deg, ${puntoSel.color}AA, ${puntoSel.color}55)`, color: '#fff', fontSize: 9, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: esMio ? `0 0 0 2px ${ACENTO}55` : 'none' }}>{iniciales(nombre)}</span>
                    })}
                    {puntoSel.n > 6 && <span style={{ marginLeft: 6, fontSize: 11.5, color: C.muted }}>+{puntoSel.n - 6}</span>}
                    {puntoSel.d.personas.includes(CLIENTA) && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: ACENTO }}>incluye a Sofía</span>}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 30 }}>
                      {puntoSel.d.historial.map((h, i) => {
                        const max = Math.max(1, ...puntoSel.d.historial)
                        return <span key={i} style={{ flex: 1, height: `${Math.max(8, (h / max) * 100)}%`, borderRadius: 3, background: h > 0 ? puntoSel.color : 'rgba(148,163,184,.18)', opacity: h > 0 ? 0.55 + 0.45 * (h / max) : 1, transformOrigin: 'bottom', animation: `rd-barra .5s cubic-bezier(.2,.8,.2,1) ${i * 0.04}s both` }} />
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.subtle, marginTop: 4 }}><span>hace 7 días</span><span>hoy</span></div>
                  </div>
                  <Boton color={puntoSel.color} style={{ width: '100%', marginTop: 12 }} onClick={() => lanzar(puntoSel.d.id)}><Rocket size={14} />Lo conseguí → Lanzar</Boton>
                  <div style={{ fontSize: 10.5, color: C.subtle, textAlign: 'center', marginTop: 6 }}>Avisa a {puntoSel.n} personas · 24 hs de prioridad antes de salir público</div>
                </Tarjeta>
              </div>
            )}
          </div>

          {/* Lanzamientos */}
          <Tarjeta style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14, color: C.text }}>
                <Rocket size={16} color={ACENTO} />Lanzamientos<Chip color={ACENTO} style={{ padding: '2px 8px' }}>{lanzamientos.length}</Chip>
              </div>
              <span style={{ fontSize: 11.5, color: C.muted }}>Los que lo pidieron reciben aviso y compran 24 hs antes que el resto.</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lanzamientos.map(l => {
                const color = CAT_INFO[l.categoria].color
                const conversion = l.avisados > 0 ? l.compraron / l.avisados : 0
                const compreYo = compras.includes(l.id)
                return (
                  <div key={l.id} className="pr-fade-up" style={{ display: 'grid', gridTemplateColumns: '38px minmax(0, 1fr) auto', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 12, background: l.previo ? 'rgba(30,41,59,.4)' : `${color}14`, border: `1px solid ${l.previo ? C.border : `${color}55`}` }}>
                    <span style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg, ${color}66, ${color}22)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{l.emoji}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 800, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {l.nombre}
                        <Chip color={l.previo ? C.muted : C.success} style={{ padding: '1px 7px', fontSize: 10.5 }}>{l.previo ? l.cuando : <><Clock size={10} />prioridad hasta {l.hastaTexto}</>}</Chip>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
                        <Contador icono={<Bell size={12} />} n={l.avisados} etiqueta="avisados" color={C.primaryLight} />
                        <Contador icono={<Eye size={12} />} n={l.abrieron} etiqueta="abrieron" color={C.warning} />
                        <Contador icono={<ShoppingBag size={12} />} n={l.compraron} etiqueta="compraron" color={C.success} />
                        {compreYo && <Chip color={ACENTO} style={{ padding: '1px 7px', fontSize: 10.5 }}>+ Sofía con prioridad</Chip>}
                      </div>
                      <div style={{ marginTop: 6, height: 4, borderRadius: 99, background: 'rgba(148,163,184,.15)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${conversion * 100}%`, background: `linear-gradient(90deg, ${color}, ${C.success})`, transition: 'width .5s cubic-bezier(.2,.8,.2,1)' }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: FONT_MONO, fontWeight: 800, fontSize: 14, color: C.success }}><NumeroAnimado valor={l.ahorro} formato={formatoARS} /></div>
                      <div style={{ fontSize: 10.5, color: C.muted, whiteSpace: 'nowrap' }}>ahorrados · compró {l.avisados}, no {l.ciegas}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Tarjeta>
        </div>

        {/* ── DERECHA: celular de la clienta ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Pantalla tipo="celular">
            {/* Notificación push */}
            {notif && lanzNotif && (
              <div key={notif.id} style={{ position: 'absolute', top: 44, left: 10, right: 10, zIndex: 6, borderRadius: 18, background: 'rgba(255,255,255,.97)', boxShadow: '0 14px 38px rgba(15,23,42,.3), 0 0 0 1px rgba(15,23,42,.06)', padding: 12, animation: 'rd-push .65s cubic-bezier(.2,.8,.2,1) both' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, background: `linear-gradient(135deg, ${ACENTO}, ${C.orbi})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><RadarIcon size={12} color="#fff" /></span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: '#64748B', letterSpacing: '.08em', textTransform: 'uppercase' }}>Zapatería Lorena</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10.5, color: '#94A3B8' }}>ahora</span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', marginTop: 6 }}>Zapatería Lorena consiguió {lanzNotif.nombre}</div>
                <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.45, marginTop: 2 }}>Tenés prioridad hasta {lanzNotif.hastaTexto}. Lo ven solo las {lanzNotif.avisados} personas que lo pidieron; después sale público.</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <Boton color={ACENTO} tam="sm" style={{ flex: 1 }} onClick={() => abrirFicha(lanzNotif.id)}><Zap size={13} />Comprar con prioridad</Boton>
                  <Boton variante="fantasma" tam="sm" style={{ color: '#475569', borderColor: '#E2E8F0' }} onClick={() => setNotif(null)}>Después</Boton>
                </div>
              </div>
            )}

            <div className="pr-scroll" style={{ height: 660, overflowY: 'auto', paddingBottom: 20 }}>
              {/* Barra superior */}
              <div style={{ padding: '46px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14, color: '#0F172A' }}>Zapatería Lorena</div>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${ACENTO}, ${C.orbi})`, color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{iniciales(CLIENTA)}</div>
              </div>

              {pantalla === 'buscar' && (
                <div key="buscar" className="pr-fade-in" style={{ padding: '0 16px' }}>
                  <div style={{ borderRadius: 16, padding: 14, background: `linear-gradient(135deg, ${ACENTO_OSCURO}, ${ACENTO} 55%, ${C.orbi})`, color: '#fff', position: 'relative', overflow: 'hidden' }}>
                    <span style={{ position: 'absolute', right: -18, top: -18, width: 90, height: 90, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,.25)' }} />
                    <span style={{ position: 'absolute', right: 2, top: 2, width: 50, height: 50, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,.25)' }} />
                    <Etiqueta color="rgba(255,255,255,.8)">Pedí algo que no encontrás</Etiqueta>
                    <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 800, marginTop: 4, letterSpacing: '-0.01em' }}>¿Buscás algo que no tenemos?</div>
                    <div style={{ fontSize: 12, opacity: 0.92, marginTop: 4, lineHeight: 1.45 }}>Dejalo en dos palabras. Si lo conseguimos te avisamos y comprás antes que nadie.</div>
                  </div>

                  <form onSubmit={e => { e.preventDefault(); pedir(texto, talle) }} style={{ marginTop: 12 }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                      <input className="rd-campo" placeholder="Ej: botines de fútbol" value={texto} onChange={e => setTexto(e.target.value)} aria-label="Qué buscás" />
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {SUGERENCIAS.map(s => <button key={s} type="button" className="rd-chip" data-activo={texto === s ? '1' : '0'} onClick={() => setTexto(s)}>{s}</button>)}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 11.5, fontWeight: 700, color: '#64748B' }}>Talle <span style={{ fontWeight: 500, color: '#94A3B8' }}>(opcional)</span></div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                      {TALLES.map(t => <button key={t} type="button" className="rd-talle" data-activo={talle === t ? '1' : '0'} onClick={() => setTalle(prev => (prev === t ? null : t))}>{t}</button>)}
                    </div>
                    <Boton type="submit" color={ACENTO} style={{ width: '100%', marginTop: 12 }} disabled={!texto.trim() && !talle}><Send size={14} />Pedir</Boton>
                  </form>

                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>Tus pedidos</div>
                    {misPedidos.length === 0 && <div style={{ fontSize: 12, color: '#94A3B8', padding: '10px 0' }}>Todavía no pediste nada.</div>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {misPedidos.map(d => {
                        const lanzado = d.estado !== 'activo'
                        const lz = lanzamientos.find(l => l.deseoId === d.id)
                        return (
                          <div key={d.id} className="pr-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, background: lanzado ? '#ECFDF5' : '#F8FAFC', border: `1px solid ${lanzado ? '#A7F3D0' : '#E2E8F0'}` }}>
                            <span style={{ fontSize: 18 }}>{d.emoji}</span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.nombre}</div>
                              <div style={{ fontSize: 11, color: lanzado ? '#047857' : '#64748B' }}>{lanzado ? 'Conseguido · tenés prioridad' : `En el radar · ${d.personas.length} ${d.personas.length === 1 ? 'persona lo pide' : 'personas lo piden'}`}</div>
                            </div>
                            {lanzado && lz && <Boton tam="sm" color="#059669" onClick={() => abrirFicha(lz.id)}>Ver</Boton>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {pantalla === 'enviado' && enviado && enviadoDeseo && (
                <div key="enviado" className="pr-fade-in" style={{ padding: '18px 16px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <span style={{ width: 64, height: 64, borderRadius: '50%', background: '#ECFDF5', border: '2px solid #A7F3D0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#059669', animation: 'rd-pop .6s cubic-bezier(.2,.8,.2,1) both' }}><Check size={30} strokeWidth={2.5} /></span>
                  </div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 19, fontWeight: 800, color: '#0F172A', textAlign: 'center', marginTop: 12 }}>Listo, Sofía.</div>
                  <div style={{ fontSize: 13.5, color: '#475569', textAlign: 'center', lineHeight: 1.5, marginTop: 4 }}>Te avisamos si lo conseguimos y vas a tener prioridad para comprarlo.</div>
                  <div style={{ marginTop: 16, borderRadius: 14, background: '#FFF1F2', border: '1px solid #FECDD3', padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 800, color: ACENTO_OSCURO }}><RadarIcon size={14} />En el radar del negocio</div>
                    <div style={{ fontSize: 12.5, color: '#881337', marginTop: 4, lineHeight: 1.45 }}>
                      {enviado.nuevo
                        ? <>Sos la primera en pedir <strong>{enviadoDeseo.nombre}</strong>. Nació un punto nuevo en el sector {enviadoDeseo.categoria}.</>
                        : enviado.repetido
                          ? <>Ya habías pedido <strong>{enviadoDeseo.nombre}</strong>: seguís en la lista con otras {enviadoDeseo.personas.length - 1} personas.</>
                          : <>Se sumó a otras <strong>{enviadoDeseo.personas.length - 1} personas</strong> que piden <strong>{enviadoDeseo.nombre}</strong>. Cuanta más gente, más cerca del centro.</>}
                    </div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: '#9F1239', marginTop: 6 }}>agrupado por: {enviadoDeseo.claves.length > 0 ? enviadoDeseo.claves.join(' · ') : 'solo talle'}{enviadoDeseo.talle && ` + talle ${enviadoDeseo.talle}`}</div>
                  </div>
                  <Boton variante="fantasma" style={{ width: '100%', marginTop: 14, color: '#475569', borderColor: '#E2E8F0' }} onClick={() => setPantalla('buscar')}>Pedir otra cosa</Boton>
                  <div style={{ fontSize: 11.5, color: '#94A3B8', textAlign: 'center', marginTop: 10 }}>Ahora mirá el radar: el dueño ve tu pedido en vivo.</div>
                </div>
              )}

              {pantalla === 'ficha' && lanzFicha && (
                <div key={lanzFicha.id} className="pr-fade-in" style={{ padding: '0 16px' }}>
                  <button type="button" className="rd-volver" onClick={() => setPantalla('buscar')}><ChevronLeft size={14} />Volver</button>
                  <div style={{ marginTop: 8, height: 150, borderRadius: 16, background: `linear-gradient(135deg, ${ACENTO_OSCURO}, ${CAT_INFO[lanzFicha.categoria].color} 70%, ${C.orbi})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, position: 'relative', overflow: 'hidden' }}>
                    <span style={{ animation: 'pr-float 4s ease-in-out infinite', filter: 'drop-shadow(0 12px 18px rgba(0,0,0,.35))' }}>{lanzFicha.emoji}</span>
                    <span style={{ position: 'absolute', top: 10, left: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: 'rgba(15,23,42,.8)', color: '#fff', fontSize: 11.5, fontWeight: 800, fontFamily: FONT_MONO, animation: 'rd-latido 2.2s ease-in-out infinite' }}>
                      <Clock size={12} />Prioridad · {fmtCuenta(lanzFicha.fin - ahora)}
                    </span>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>{lanzFicha.nombre}</div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 1.45 }}>Solo para quienes lo pidieron, hasta {lanzFicha.hastaTexto}. Después sale público en la tienda.</div>
                  </div>
                  <div style={{ marginTop: 12, borderRadius: 14, border: '1px solid #E2E8F0', padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.06em' }}>Precio</div>
                      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>{formatoARS(lanzFicha.precio)}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 11.5, color: '#475569', lineHeight: 1.4 }}>
                      <div style={{ fontWeight: 800, color: ACENTO_OSCURO }}>{lanzFicha.avisados} reservadas</div>
                      <div>una por persona</div>
                    </div>
                  </div>
                  {compras.includes(lanzFicha.id) ? (
                    <div className="pr-fade-up" style={{ marginTop: 12, borderRadius: 14, background: '#ECFDF5', border: '1px solid #A7F3D0', padding: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#065F46', fontSize: 14 }}><Check size={16} />Compra confirmada</div>
                      <div style={{ fontSize: 12, color: '#047857', marginTop: 4, lineHeight: 1.5 }}>Pedido #4821 · {formatoARS(lanzFicha.precio)} con Mercado Pago. Lo retirás en el local o te lo enviamos. Compraste antes de que saliera público.</div>
                    </div>
                  ) : (
                    <>
                      <Boton color={ACENTO} style={{ width: '100%', marginTop: 12 }} onClick={() => comprar(lanzFicha)}><ShoppingBag size={15} />Comprar · {formatoARS(lanzFicha.precio)}</Boton>
                      <div style={{ fontSize: 11.5, color: '#64748B', textAlign: 'center', marginTop: 8 }}>Pago con Mercado Pago · retiro en el local o envío</div>
                    </>
                  )}
                </div>
              )}
            </div>
          </Pantalla>
          <div style={{ fontSize: 11.5, color: C.subtle, textAlign: 'center', lineHeight: 1.45 }}>Celular de {CLIENTA}, clienta de la tienda. Ella pide; el radar de la izquierda reacciona en vivo.</div>
        </div>
      </div>
    </div>
  )
}
