// src/modules/propuestas/prototipos/CarritoColectivo.tsx — Prototipo
// interactivo de la propuesta "Carrito Colectivo": un carrito con varios
// dueños, cada uno paga lo suyo por Mercado Pago, el grupo desbloquea un
// precio y el negocio recibe un solo pedido consolidado.
//
// Autocontenido: estado local, timers con cleanup, sin fetch ni storage.

import { useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Check, Copy, MessageCircle, Plus, X, Users, Truck, Sparkles, Clock, RotateCcw, Play,
  CreditCard, PackageCheck, TrendingUp, ShoppingCart, Lock, Zap,
} from 'lucide-react'
import { C, FONT, FONT_DISPLAY, FONT_MONO, Boton, Chip, Etiqueta, Pantalla, Tarjeta, formatoARS } from '../ui'

// ─── Datos de ejemplo ────────────────────────────────────────────────────────

type PersonaId = 'vos' | 'sofi' | 'juli' | 'nico' | 'cami'

interface Persona { id: PersonaId; nombre: string; color: string; inicial: string }

const PERSONAS: Persona[] = [
  { id: 'vos', nombre: 'Vos', color: '#3B82F6', inicial: 'V' },
  { id: 'sofi', nombre: 'Sofi', color: '#F472B6', inicial: 'S' },
  { id: 'juli', nombre: 'Juli', color: '#F59E0B', inicial: 'J' },
  { id: 'nico', nombre: 'Nico', color: '#34D399', inicial: 'N' },
  { id: 'cami', nombre: 'Cami', color: '#A78BFA', inicial: 'C' },
]
const PERSONA: Record<PersonaId, Persona> = Object.fromEntries(PERSONAS.map(p => [p.id, p])) as Record<PersonaId, Persona>

interface Producto { id: string; nombre: string; precio: number; icono: string }

const PRODUCTOS: Producto[] = [
  { id: 'granola', nombre: 'Granola 500g', precio: 5900, icono: '🥣' },
  { id: 'mix', nombre: 'Mix de frutos secos', precio: 7400, icono: '🥜' },
  { id: 'miel', nombre: 'Miel pura', precio: 6200, icono: '🍯' },
  { id: 'mani', nombre: 'Pasta de maní', precio: 4800, icono: '🫙' },
  { id: 'matcha', nombre: 'Té matcha', precio: 8900, icono: '🍵' },
  { id: 'barritas', nombre: 'Barritas x6', precio: 3600, icono: '🍫' },
]
const PROD: Record<string, Producto> = Object.fromEntries(PRODUCTOS.map(p => [p.id, p]))

/** Qué agrega cada persona cuando se simula que se suma. */
const SIMULACION: Record<PersonaId, string[]> = {
  vos: ['granola', 'miel'],
  sofi: ['mix', 'barritas'],
  juli: ['matcha'],
  nico: ['mani', 'granola'],
  cami: ['miel'],
}

const OBJ_PERSONAS = 5
const OBJ_MONTO = 60000
const DESCUENTO = 0.15
const TICKET_INDIVIDUAL = 17300
const VENCE_INICIAL = 23 * 3600 + 59 * 60 + 12
const LINK = 'semilla.orbita.site/c/K7Q2'
const DIRECCION = 'Av. Córdoba 1234, piso 6 (oficina)'

// ─── Estado ──────────────────────────────────────────────────────────────────

interface Item { id: number; persona: PersonaId; producto: string; cant: number }
type EstadoPago = 'pendiente' | 'procesando' | 'pagado'

interface Estado {
  items: Item[]
  pagos: Record<PersonaId, EstadoPago>
  desbloqueado: boolean
  /** Contador de "momentos desbloqueado" para disparar el festejo. */
  festejo: number
  siguienteId: number
}

type Accion =
  | { tipo: 'agregar'; persona: PersonaId; producto: string }
  | { tipo: 'quitar'; id: number }
  | { tipo: 'pago'; persona: PersonaId; estado: EstadoPago }
  | { tipo: 'reset' }

function estadoInicial(): Estado {
  return {
    items: [
      { id: 1, persona: 'vos', producto: 'granola', cant: 1 },
      { id: 2, persona: 'vos', producto: 'miel', cant: 1 },
    ],
    pagos: { vos: 'pendiente', sofi: 'pendiente', juli: 'pendiente', nico: 'pendiente', cami: 'pendiente' },
    desbloqueado: false,
    festejo: 0,
    siguienteId: 3,
  }
}

function montoLista(items: Item[]): number {
  return items.reduce((a, i) => a + PROD[i.producto].precio * i.cant, 0)
}
function cantPersonas(items: Item[]): number {
  return new Set(items.map(i => i.persona)).size
}
function objetivoAlcanzado(items: Item[]): boolean {
  return cantPersonas(items) >= OBJ_PERSONAS || montoLista(items) >= OBJ_MONTO
}

function reducer(s: Estado, a: Accion): Estado {
  switch (a.tipo) {
    case 'agregar': {
      if (s.pagos[a.persona] === 'pagado') return s
      const existente = s.items.find(i => i.persona === a.persona && i.producto === a.producto)
      const items = existente
        ? s.items.map(i => (i === existente ? { ...i, cant: i.cant + 1 } : i))
        : [...s.items, { id: s.siguienteId, persona: a.persona, producto: a.producto, cant: 1 }]
      const recienDesbloqueado = !s.desbloqueado && objetivoAlcanzado(items)
      return {
        ...s,
        items,
        siguienteId: existente ? s.siguienteId : s.siguienteId + 1,
        desbloqueado: s.desbloqueado || recienDesbloqueado,
        festejo: recienDesbloqueado ? s.festejo + 1 : s.festejo,
      }
    }
    case 'quitar': {
      const it = s.items.find(i => i.id === a.id)
      if (!it || s.pagos[it.persona] === 'pagado') return s
      const items = it.cant > 1
        ? s.items.map(i => (i.id === a.id ? { ...i, cant: i.cant - 1 } : i))
        : s.items.filter(i => i.id !== a.id)
      return { ...s, items }
    }
    case 'pago':
      return { ...s, pagos: { ...s.pagos, [a.persona]: a.estado } }
    case 'reset':
      return estadoInicial()
  }
}

// ─── CSS propio ──────────────────────────────────────────────────────────────

const CSS = `
  @keyframes cc-pop { from { opacity: 0; transform: translateY(8px) scale(.97); } to { opacity: 1; transform: none; } }
  @keyframes cc-caer { 0% { transform: translateY(-30px) rotate(0deg); opacity: 0; } 12% { opacity: 1; } 100% { transform: translateY(720px) rotate(240deg); opacity: 0; } }
  @keyframes cc-flash { 0% { opacity: .95; transform: scale(.85); } 100% { opacity: 0; transform: scale(1.5); } }
  @keyframes cc-toast { from { opacity: 0; transform: translateY(-16px) scale(.96); } to { opacity: 1; transform: none; } }
  @keyframes cc-bump { 0% { transform: scale(1); } 40% { transform: scale(1.3); } 100% { transform: scale(1); } }
  @keyframes cc-tachar { from { width: 0; } to { width: 100%; } }
  @keyframes cc-listo { 0% { transform: scale(.5); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
  @keyframes cc-halo { 0% { box-shadow: 0 0 0 0 rgba(52,211,153,.55); } 100% { box-shadow: 0 0 0 14px rgba(52,211,153,0); } }
  @keyframes cc-brillo { 0% { background-position: -300px 0; } 100% { background-position: 300px 0; } }
  @keyframes cc-vivo { 0%, 100% { opacity: .5; } 50% { opacity: 1; } }
  @keyframes cc-ping { 0% { transform: scale(1); opacity: .7; } 100% { transform: scale(2.2); opacity: 0; } }
  @keyframes cc-girar { to { transform: rotate(360deg); } }
  .cc-pop { animation: cc-pop .45s cubic-bezier(.2,.8,.2,1) both; }
  .cc-tab { transition: transform .2s cubic-bezier(.2,.8,.2,1), opacity .2s; cursor: pointer; background: none; border: 0; padding: 0; font-family: inherit; }
  .cc-tab:hover { transform: translateY(-2px); }
  .cc-add { transition: transform .15s, background .15s, color .15s; cursor: pointer; }
  .cc-add:hover { background: #3B82F6 !important; color: #fff !important; }
  .cc-add:active { transform: scale(.94); }
  .cc-add:disabled { opacity: .4; cursor: not-allowed; }
  .cc-quitar { opacity: 0; transition: opacity .15s; }
  .cc-fila:hover .cc-quitar { opacity: 1; }
  @media (prefers-reduced-motion: reduce) { .cc-pop { animation: none; } }
`

// ─── Piezas chicas ───────────────────────────────────────────────────────────

/** Número que "rueda" hacia el valor nuevo. */
function NumeroRodante({ valor, style }: { valor: number; style?: CSSProperties }) {
  const [mostrado, setMostrado] = useState(valor)
  const anterior = useRef(valor)
  useEffect(() => {
    const desde = anterior.current
    const hasta = valor
    anterior.current = valor
    if (desde === hasta) return
    const inicio = performance.now()
    const dur = 800
    let raf = 0
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      setMostrado(Math.round(desde + (hasta - desde) * e))
      if (p < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [valor])
  return <span style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{formatoARS(mostrado)}</span>
}

/** Precio con tachado animado cuando hay precio de grupo. */
function Precio({ lista, desbloqueado, tam = 13, color = '#0F172A' }: { lista: number; desbloqueado: boolean; tam?: number; color?: string }) {
  const grupo = Math.round(lista * (1 - DESCUENTO))
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
      {desbloqueado && (
        <span style={{ position: 'relative', fontSize: tam - 2, color: '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>
          {formatoARS(lista)}
          <span style={{ position: 'absolute', left: 0, top: '52%', height: 1.5, background: '#F87171', animation: 'cc-tachar .5s ease both' }} />
        </span>
      )}
      <NumeroRodante valor={desbloqueado ? grupo : lista} style={{ fontSize: tam, fontWeight: 700, color: desbloqueado ? '#059669' : color }} />
    </span>
  )
}

function Avatar({ persona, size = 32, pagado, apagado, anillo }: { persona: Persona; size?: number; pagado?: boolean; apagado?: boolean; anillo?: string }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <span
        style={{
          width: size, height: size, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: apagado ? '#CBD5E1' : `linear-gradient(135deg, ${persona.color}, ${persona.color}AA)`,
          color: '#fff', fontWeight: 800, fontSize: size * 0.42, fontFamily: FONT_DISPLAY,
          boxShadow: anillo ? `0 0 0 2px #fff, 0 0 0 4px ${anillo}` : 'none',
          transition: 'background .3s, box-shadow .2s',
        }}
      >
        {persona.inicial}
      </span>
      {pagado && (
        <span style={{ position: 'absolute', right: -3, bottom: -3, width: size * 0.42, height: size * 0.42, borderRadius: '50%', background: '#10B981', border: '2px solid #fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', animation: 'cc-listo .4s cubic-bezier(.2,.8,.2,1) both' }}>
          <Check size={size * 0.24} color="#fff" strokeWidth={4} />
        </span>
      )}
    </span>
  )
}

/** Anillo doble: afuera personas, adentro monto. */
function Anillo({ personas, monto, desbloqueado, destello }: { personas: number; monto: number; desbloqueado: boolean; destello: boolean }) {
  const R1 = 50, R2 = 39
  const L1 = 2 * Math.PI * R1, L2 = 2 * Math.PI * R2
  const p1 = desbloqueado ? 1 : Math.min(1, personas / OBJ_PERSONAS)
  const p2 = desbloqueado ? 1 : Math.min(1, monto / OBJ_MONTO)
  const trans = 'stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1), stroke .4s'
  return (
    <div style={{ position: 'relative', width: 124, height: 124, flexShrink: 0 }}>
      <svg width={124} height={124} viewBox="0 0 124 124" style={{ display: 'block', filter: desbloqueado ? 'drop-shadow(0 0 8px rgba(16,185,129,.55))' : 'none', transition: 'filter .6s' }}>
        <defs>
          <linearGradient id="cc-g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={desbloqueado ? '#10B981' : '#3B82F6'} />
            <stop offset="100%" stopColor={desbloqueado ? '#34D399' : '#8B5CF6'} />
          </linearGradient>
          <linearGradient id="cc-g2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={desbloqueado ? '#059669' : '#F59E0B'} />
            <stop offset="100%" stopColor={desbloqueado ? '#6EE7B7' : '#FBBF24'} />
          </linearGradient>
        </defs>
        <g transform="rotate(-90 62 62)">
          <circle cx={62} cy={62} r={R1} fill="none" stroke="#E2E8F0" strokeWidth={9} />
          <circle cx={62} cy={62} r={R1} fill="none" stroke="url(#cc-g1)" strokeWidth={9} strokeLinecap="round" strokeDasharray={L1} strokeDashoffset={L1 * (1 - p1)} style={{ transition: trans }} />
          <circle cx={62} cy={62} r={R2} fill="none" stroke="#F1F5F9" strokeWidth={7} />
          <circle cx={62} cy={62} r={R2} fill="none" stroke="url(#cc-g2)" strokeWidth={7} strokeLinecap="round" strokeDasharray={L2} strokeDashoffset={L2 * (1 - p2)} style={{ transition: trans }} />
        </g>
        {destello && <circle cx={62} cy={62} r={56} fill="none" stroke="#34D399" strokeWidth={4} style={{ transformOrigin: '62px 62px', animation: 'cc-flash .9s ease-out both' }} />}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
        {desbloqueado ? (
          <Sparkles size={22} color="#10B981" style={{ animation: 'cc-listo .5s cubic-bezier(.2,.8,.2,1) both' }} />
        ) : (
          <>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>{personas}<span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>/{OBJ_PERSONAS}</span></span>
            <span style={{ fontSize: 10.5, color: '#B45309', fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{formatoARS(monto)}</span>
          </>
        )}
      </div>
    </div>
  )
}

const ESTRELLAS = Array.from({ length: 30 }, (_, i) => ({
  x: (i * 37 + 11) % 100,
  delay: (i % 9) * 0.13,
  size: 8 + (i % 4) * 4,
  dur: 2.2 + (i % 5) * 0.35,
  color: ['#34D399', '#FBBF24', '#60A5FA', '#F472B6'][i % 4],
}))

function Estrellas() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 20 }}>
      {ESTRELLAS.map((e, i) => (
        <span key={i} style={{ position: 'absolute', top: -20, left: `${e.x}%`, fontSize: e.size, color: e.color, animation: `cc-caer ${e.dur}s ease-in ${e.delay}s both`, textShadow: `0 0 8px ${e.color}` }}>✦</span>
      ))}
    </div>
  )
}

function Pasos({ paso }: { paso: number }) {
  const pasos = ['Armar', 'Sumar gente', 'Desbloquear', 'Pagar cada uno', 'Pedido listo']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' }}>
      {pasos.map((p, i) => {
        const n = i + 1
        const hecho = n < paso
        const activo = n === paso
        const color = hecho ? C.success : activo ? C.primaryLight : C.subtle
        return (
          <div key={p} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: hecho ? '#052E16' : activo ? '#fff' : C.subtle, background: hecho ? C.success : activo ? C.primary : 'rgba(148,163,184,.12)', border: `1px solid ${hecho || activo ? 'transparent' : C.border}`, boxShadow: activo ? `0 0 0 4px ${C.primary}33` : 'none', transition: 'all .3s' }}>
                {hecho ? <Check size={12} strokeWidth={3.5} /> : n}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: activo ? 700 : 500, color, transition: 'color .3s' }}>{p}</span>
            </div>
            {i < pasos.length - 1 && <span style={{ width: 28, height: 1, margin: '0 10px', background: hecho ? C.success : C.border, transition: 'background .3s' }} />}
          </div>
        )
      })}
    </div>
  )
}

function Fila({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, ...style }}>{children}</div>
}

function formatoTiempo(seg: number): string {
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}

interface Toast { id: number; texto: string; color: string }

// ─── Prototipo ───────────────────────────────────────────────────────────────

export default function CarritoColectivo() {
  const [estado, dispatch] = useReducer(reducer, undefined, estadoInicial)
  const [activa, setActiva] = useState<PersonaId>('vos')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [mostrarWsp, setMostrarWsp] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [recien, setRecien] = useState<PersonaId | null>(null)
  const [simulando, setSimulando] = useState(false)
  const [restante, setRestante] = useState(VENCE_INICIAL)
  const [festejoVisto, setFestejoVisto] = useState(0)
  const timers = useRef<number[]>([])
  const toastId = useRef(0)

  const { items, pagos, desbloqueado, festejo } = estado
  const festejando = festejo > festejoVisto

  // Cuenta regresiva decorativa (real).
  useEffect(() => {
    const t = window.setInterval(() => setRestante(r => Math.max(0, r - 1)), 1000)
    return () => window.clearInterval(t)
  }, [])

  // El festejo dura 3,2 s.
  useEffect(() => {
    if (festejo === 0) return
    const t = window.setTimeout(() => setFestejoVisto(festejo), 3200)
    return () => window.clearTimeout(t)
  }, [festejo])

  // Limpieza de todos los timers al desmontar.
  useEffect(() => {
    const lista = timers.current
    return () => { lista.forEach(id => window.clearTimeout(id)) }
  }, [])

  const programar = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }

  const avisar = (texto: string, color = C.primary) => {
    toastId.current += 1
    const id = toastId.current
    setToasts(t => [...t.slice(-2), { id, texto, color }])
    programar(() => setToasts(t => t.filter(x => x.id !== id)), 2600)
  }

  // ── Derivados ──
  const precioDe = (p: Producto) => (desbloqueado ? Math.round(p.precio * (1 - DESCUENTO)) : p.precio)
  const personasConItems = PERSONAS.filter(p => items.some(i => i.persona === p.id))
  const tieneItems = (pid: PersonaId) => items.some(i => i.persona === pid)
  const parteDe = (pid: PersonaId) => items.filter(i => i.persona === pid).reduce((a, i) => a + precioDe(PROD[i.producto]) * i.cant, 0)
  const subtotalLista = montoLista(items)
  const total = items.reduce((a, i) => a + precioDe(PROD[i.producto]) * i.cant, 0)
  const ahorro = subtotalLista - total
  const pagados = personasConItems.filter(p => pagos[p.id] === 'pagado').length
  const todoPagado = personasConItems.length >= 2 && pagados === personasConItems.length
  const paso = todoPagado ? 5 : pagados > 0 ? 4 : desbloqueado ? 3 : personasConItems.length >= 2 ? 2 : 1
  const yo = PERSONA[activa]
  const miParte = parteDe(activa)
  const miPago = pagos[activa]
  const faltanSumarse = PERSONAS.filter(p => !tieneItems(p.id))
  const deben = personasConItems.filter(p => pagos[p.id] !== 'pagado')
  const unidades = items.reduce((a, i) => a + i.cant, 0)
  const pctVsIndividual = Math.round((total / TICKET_INDIVIDUAL - 1) * 100)

  // ── Acciones ──
  const agregar = (productoId: string) => {
    dispatch({ tipo: 'agregar', persona: activa, producto: productoId })
  }

  const simularSumarse = () => {
    if (simulando || faltanSumarse.length === 0) return
    setSimulando(true)
    faltanSumarse.forEach((p, i) => {
      programar(() => {
        setRecien(p.id)
        avisar(`${p.nombre} se sumó al carrito`, p.color)
        SIMULACION[p.id].forEach((prod, j) => {
          programar(() => dispatch({ tipo: 'agregar', persona: p.id, producto: prod }), 250 + j * 420)
        })
        programar(() => setRecien(null), 1500)
      }, 300 + i * 1500)
    })
    programar(() => setSimulando(false), 300 + faltanSumarse.length * 1500)
  }

  const pagar = (pid: PersonaId, delay = 0) => {
    programar(() => dispatch({ tipo: 'pago', persona: pid, estado: 'procesando' }), delay)
    programar(() => {
      dispatch({ tipo: 'pago', persona: pid, estado: 'pagado' })
      avisar(`${PERSONA[pid].nombre} pagó su parte`, '#10B981')
    }, delay + 950)
  }

  const pagarTodos = () => {
    deben.forEach((p, i) => pagar(p.id, i * 800))
  }

  const copiarLink = () => {
    setCopiado(true)
    programar(() => setCopiado(false), 1400)
  }

  const reiniciar = () => {
    timers.current.forEach(id => window.clearTimeout(id))
    timers.current = []
    dispatch({ tipo: 'reset' })
    setActiva('vos')
    setToasts([])
    setMostrarWsp(false)
    setCopiado(false)
    setRecien(null)
    setSimulando(false)
    setRestante(VENCE_INICIAL)
    setFestejoVisto(0)
  }

  // ── Estilos de la pantalla clara (celular / panel) ──
  const txt = '#0F172A', muted = '#64748B', linea = '#E2E8F0', suave = '#F8FAFC'
  const tarjetaClara: CSSProperties = { background: '#fff', border: `1px solid ${linea}`, borderRadius: 14 }

  return (
    <div style={{ position: 'relative', padding: 26, minHeight: 600, fontFamily: FONT, color: C.text, overflow: 'hidden' }}>
      <style>{CSS}</style>
      {festejando && <Estrellas />}

      {/* ── Cabecera ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <Etiqueta color="#34D399" style={{ marginBottom: 6 }}>Dietética Semilla · tienda en Órbita</Etiqueta>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Carrito de la oficina</span>
            <Chip color={desbloqueado ? C.success : C.warning}>
              {desbloqueado ? <><Sparkles size={12} /> Precio de grupo activo</> : <><Users size={12} /> {personasConItems.length} de {OBJ_PERSONAS} personas</>}
            </Chip>
            <Chip color={restante < 3600 ? C.error : C.muted} style={{ fontFamily: FONT_MONO, fontWeight: 600 }}>
              <Clock size={12} /> Vence en {formatoTiempo(restante)}
            </Chip>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Boton tam="sm" variante="suave" color="#34D399" onClick={simularSumarse} disabled={simulando || faltanSumarse.length === 0}>
            <Play size={13} /> {simulando ? 'Se están sumando…' : 'Simular que se suman'}
          </Boton>
          <Boton tam="sm" variante="suave" color="#38BDF8" onClick={pagarTodos} disabled={deben.length === 0 || personasConItems.length < 2}>
            <CreditCard size={13} /> Simular que pagan todos
          </Boton>
          <Boton tam="sm" variante="fantasma" onClick={reiniciar} style={{ padding: '7px 10px' }}>
            <RotateCcw size={13} /> Reiniciar
          </Boton>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <Pasos paso={paso} />
      </div>

      {/* ── Cuerpo: celular + panel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 400px) minmax(0, 1fr)', gap: 26, alignItems: 'start' }}>

        {/* IZQUIERDA: la vista de cada persona */}
        <div>
          {/* Pestañas de personas */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
            {PERSONAS.map(p => {
              const sel = p.id === activa
              const pag = pagos[p.id] === 'pagado'
              const n = items.filter(i => i.persona === p.id).reduce((a, i) => a + i.cant, 0)
              return (
                <button key={p.id} type="button" className="cc-tab" onClick={() => setActiva(p.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, opacity: sel ? 1 : 0.7, transform: sel ? 'translateY(-2px)' : 'none' }}>
                  <span style={{ position: 'relative', display: 'inline-flex' }}>
                    {recien === p.id && <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: p.color, animation: 'cc-ping 1s ease-out infinite' }} />}
                    <span style={{ position: 'relative', borderRadius: '50%', boxShadow: sel ? `0 0 0 2px ${C.bg}, 0 0 0 4px ${p.color}` : 'none', transition: 'box-shadow .2s' }}>
                      <Avatar persona={p} size={40} pagado={pag} apagado={n === 0} />
                    </span>
                    {n > 0 && !pag && (
                      <span key={n} style={{ position: 'absolute', top: -4, right: -6, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 99, background: '#0F172A', border: `1.5px solid ${p.color}`, color: '#fff', fontSize: 10.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', animation: 'cc-bump .35s ease' }}>{n}</span>
                    )}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: sel ? 800 : 600, color: sel ? p.color : C.muted }}>{p.nombre}</span>
                </button>
              )
            })}
          </div>

          <Pantalla tipo="celular" ancho={372}>
            {/* Toasts (notificaciones) */}
            <div style={{ position: 'absolute', top: 44, left: 12, right: 12, zIndex: 6, display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'none' }}>
              {toasts.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(15,23,42,.92)', color: '#fff', borderRadius: 12, padding: '9px 12px', fontSize: 12.5, fontWeight: 600, boxShadow: '0 10px 30px rgba(0,0,0,.35)', animation: 'cc-toast .35s cubic-bezier(.2,.8,.2,1) both', borderLeft: `3px solid ${t.color}` }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                  {t.texto}
                </div>
              ))}
            </div>

            <div className="pr-scroll" style={{ height: 680, overflowY: 'auto', overflowX: 'hidden', paddingTop: 44, background: suave, position: 'relative' }}>
              {/* Cabecera del carrito */}
              <div style={{ padding: '10px 16px 12px', background: '#fff', borderBottom: `1px solid ${linea}` }}>
                <Fila>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 30, height: 30, borderRadius: 10, background: 'linear-gradient(135deg, #16A34A, #84CC16)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🌱</span>
                    <div>
                      <div style={{ fontSize: 11, color: muted, fontWeight: 600 }}>Dietética Semilla</div>
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: txt, fontFamily: FONT_DISPLAY, letterSpacing: '-0.01em' }}>Carrito de la oficina</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: muted, whiteSpace: 'nowrap' }}>creado por <b style={{ color: '#3B82F6' }}>Vos</b></span>
                </Fila>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                  <button type="button" className="cc-add" onClick={copiarLink} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, border: `1px dashed ${copiado ? '#10B981' : '#CBD5E1'}`, background: copiado ? '#ECFDF5' : suave, borderRadius: 10, padding: '7px 10px', fontFamily: FONT_MONO, fontSize: 11.5, color: copiado ? '#059669' : '#334155', minWidth: 0, transition: 'all .2s' }}>
                    {copiado ? <Check size={12} /> : <Copy size={12} />}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{copiado ? 'Link copiado' : LINK}</span>
                  </button>
                  <button type="button" className="pr-btn" onClick={() => setMostrarWsp(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: mostrarWsp ? '#128C7E' : '#25D366', color: '#fff', border: 0, borderRadius: 10, padding: '8px 11px', fontSize: 12, fontWeight: 700, fontFamily: FONT, whiteSpace: 'nowrap' }}>
                    <MessageCircle size={13} /> {mostrarWsp ? 'Cerrar' : 'Compartir por WhatsApp'}
                  </button>
                </div>

                {mostrarWsp && (
                  <div className="cc-pop" style={{ marginTop: 10, background: '#E5DDD5', borderRadius: 12, padding: 10, backgroundImage: 'radial-gradient(rgba(0,0,0,.035) 1px, transparent 1px)', backgroundSize: '8px 8px' }}>
                    <div style={{ fontSize: 10.5, color: '#54656F', marginBottom: 6, fontWeight: 600 }}>Vista previa · Grupo &quot;Oficina piso 6&quot;</div>
                    <div style={{ background: '#DCF8C6', borderRadius: '12px 2px 12px 12px', padding: '8px 10px', fontSize: 12.5, color: '#111B21', lineHeight: 1.45, boxShadow: '0 1px 1px rgba(0,0,0,.08)', marginLeft: 24, position: 'relative' }}>
                      Chicas, armé un carrito en Dietética Semilla para pedir todas juntas. Cada una agrega lo suyo y paga lo suyo. Si llegamos a 5 personas o $60.000 <b>todas tenemos 15% off</b> y el envío viene una sola vez a la oficina.
                      <div style={{ marginTop: 6, color: '#027EB5', textDecoration: 'underline', fontWeight: 600 }}>https://{LINK}</div>
                      <div style={{ marginTop: 6, background: '#fff', borderRadius: 8, padding: '6px 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, #16A34A, #84CC16)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🛒</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700 }}>Carrito colectivo · Dietética Semilla</div>
                          <div style={{ fontSize: 10.5, color: '#54656F' }}>Sumate y pagá tu parte con Mercado Pago</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 10, color: '#667781', marginTop: 4 }}>14:32 ✓✓</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Viendo como */}
              <div style={{ padding: '10px 16px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar persona={yo} size={22} />
                    <span style={{ fontSize: 12, color: muted }}>Estás viendo como <b style={{ color: yo.color }}>{yo.nombre}</b></span>
                  </div>
                  {/* Quién pagó */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {PERSONAS.map((p, i) => (
                      <span key={p.id} title={`${p.nombre}: ${pagos[p.id] === 'pagado' ? 'pagó' : 'falta'}`} style={{ marginLeft: i === 0 ? 0 : -6, borderRadius: '50%', boxShadow: '0 0 0 2px #F8FAFC', display: 'inline-flex', transition: 'transform .2s' }}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: pagos[p.id] === 'pagado' ? '#10B981' : '#CBD5E1', color: '#fff', fontSize: 9.5, fontWeight: 800, transition: 'background .35s' }}>
                          {pagos[p.id] === 'pagado' ? <Check size={11} strokeWidth={4} /> : p.inicial}
                        </span>
                      </span>
                    ))}
                    <span style={{ fontSize: 10.5, color: muted, marginLeft: 6, fontWeight: 600 }}>{pagados}/{personasConItems.length} pagaron</span>
                  </div>
                </div>
              </div>

              {/* Objetivo */}
              <div style={{ margin: '10px 16px 0', ...tarjetaClara, padding: 12, display: 'flex', alignItems: 'center', gap: 12, borderColor: desbloqueado ? '#A7F3D0' : linea, background: desbloqueado ? 'linear-gradient(135deg, #ECFDF5, #F0FDF4)' : '#fff', transition: 'all .5s' }}>
                <Anillo personas={personasConItems.length} monto={subtotalLista} desbloqueado={desbloqueado} destello={festejando} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  {desbloqueado ? (
                    <div className="cc-pop">
                      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#059669' }}>Desbloqueado</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: txt, fontFamily: FONT_DISPLAY, marginTop: 2, lineHeight: 1.2 }}>Precio de grupo: 15% off para todos</div>
                      <div style={{ fontSize: 11.5, color: '#047857', marginTop: 4 }}>Entre todos ahorran <b><NumeroRodante valor={ahorro} /></b></div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3B82F6' }}>Objetivo del grupo</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: txt, marginTop: 2, lineHeight: 1.3 }}>Precio de grupo al llegar a <span style={{ color: '#3B82F6' }}>{OBJ_PERSONAS} personas</span> o <span style={{ color: '#B45309' }}>{formatoARS(OBJ_MONTO)}</span></div>
                      <div style={{ fontSize: 11.5, color: muted, marginTop: 4 }}>
                        Faltan <b style={{ color: txt }}>{Math.max(0, OBJ_PERSONAS - personasConItems.length)} personas</b> o <b style={{ color: txt }}>{formatoARS(Math.max(0, OBJ_MONTO - subtotalLista))}</b>
                      </div>
                    </>
                  )}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 10.5, color: restante < 3600 ? '#DC2626' : muted, fontFamily: FONT_MONO, fontWeight: 600 }}>
                    <Clock size={10} /> Vence en {formatoTiempo(restante)}
                  </div>
                </div>
              </div>

              {/* Banner desbloqueado */}
              {desbloqueado && (
                <div className="cc-pop" style={{ margin: '10px 16px 0', borderRadius: 12, padding: '10px 12px', color: '#fff', background: 'linear-gradient(135deg, #059669, #10B981 60%, #34D399)', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 10px 30px rgba(16,185,129,.35)', position: 'relative', overflow: 'hidden' }}>
                  <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(100deg, transparent 30%, rgba(255,255,255,.28) 50%, transparent 70%)', backgroundSize: '300px 100%', animation: 'cc-brillo 1.6s ease-in-out 2' }} />
                  <Zap size={18} style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: 12.5, lineHeight: 1.3, position: 'relative' }}>
                    <b>Precio de grupo desbloqueado:</b> todos ahorran <b><NumeroRodante valor={ahorro} /></b>. Los precios ya bajaron en el carrito.
                  </div>
                </div>
              )}

              {/* Catálogo */}
              <div style={{ padding: '14px 16px 0' }}>
                <Fila style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: txt }}>Agregá lo tuyo</span>
                  {miPago === 'pagado' ? (
                    <span style={{ fontSize: 10.5, color: muted, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Lock size={10} /> Ya pagaste, tu parte está cerrada</span>
                  ) : (
                    <span style={{ fontSize: 10.5, color: muted }}>se agrega a nombre de <b style={{ color: yo.color }}>{yo.nombre}</b></span>
                  )}
                </Fila>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {PRODUCTOS.map(p => (
                    <div key={p.id} style={{ ...tarjetaClara, padding: '8px 9px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 30, height: 30, borderRadius: 9, background: suave, border: `1px solid ${linea}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{p.icono}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: txt, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
                          <Precio lista={p.precio} desbloqueado={desbloqueado} tam={12.5} />
                        </div>
                      </div>
                      <button type="button" className="cc-add" onClick={() => agregar(p.id)} disabled={miPago === 'pagado'} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, border: `1px solid #BFDBFE`, background: '#EFF6FF', color: '#1D4ED8', borderRadius: 8, padding: '5px 8px', fontSize: 11.5, fontWeight: 700, fontFamily: FONT }}>
                        <Plus size={12} strokeWidth={3} /> Agregar
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Carrito del grupo */}
              <div style={{ padding: '16px 16px 0' }}>
                <Fila style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: txt, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ShoppingCart size={13} /> Carrito del grupo
                    <span key={unidades} style={{ background: '#0F172A', color: '#fff', borderRadius: 99, fontSize: 10.5, padding: '1px 7px', animation: 'cc-bump .35s ease' }}>{unidades}</span>
                  </span>
                  <span style={{ fontSize: 11, color: muted }}>{personasConItems.length} {personasConItems.length === 1 ? 'persona' : 'personas'}</span>
                </Fila>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {personasConItems.map(p => {
                    const esYo = p.id === activa
                    const pag = pagos[p.id]
                    return (
                      <div key={p.id} className="cc-pop" style={{ ...tarjetaClara, overflow: 'hidden', borderColor: esYo ? `${p.color}66` : linea, boxShadow: esYo ? `0 0 0 3px ${p.color}1A` : 'none', transition: 'border-color .2s, box-shadow .2s' }}>
                        <Fila style={{ padding: '8px 10px', background: esYo ? `${p.color}0D` : suave, borderBottom: `1px solid ${linea}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar persona={p} size={24} pagado={pag === 'pagado'} />
                            <span style={{ fontSize: 12.5, fontWeight: 800, color: txt }}>{p.nombre}{esYo && p.id !== 'vos' ? ' (vos)' : ''}</span>
                            {pag === 'pagado' && <span style={{ fontSize: 10, fontWeight: 800, color: '#059669', background: '#D1FAE5', borderRadius: 99, padding: '1px 7px' }}>Pagado</span>}
                            {pag === 'procesando' && <span style={{ fontSize: 10, fontWeight: 700, color: '#0369A1', background: '#E0F2FE', borderRadius: 99, padding: '1px 7px' }}>Procesando…</span>}
                          </div>
                          <span style={{ fontSize: 11.5, color: muted }}>{esYo ? 'tu parte' : 'su parte'}: <NumeroRodante valor={parteDe(p.id)} style={{ fontWeight: 800, color: txt, fontSize: 12.5 }} /></span>
                        </Fila>
                        {items.filter(i => i.persona === p.id).map(it => {
                          const prod = PROD[it.producto]
                          return (
                            <div key={it.id} className="cc-fila cc-pop" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderTop: `1px solid ${suave}` }}>
                              <span style={{ fontSize: 15, width: 22, textAlign: 'center' }}>{prod.icono}</span>
                              <span style={{ flex: 1, fontSize: 12, color: txt, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {prod.nombre} {it.cant > 1 && <span style={{ color: muted, fontWeight: 700 }}>×{it.cant}</span>}
                              </span>
                              <Precio lista={prod.precio * it.cant} desbloqueado={desbloqueado} tam={12.5} />
                              {esYo && pag !== 'pagado' && (
                                <button type="button" className="cc-quitar" onClick={() => dispatch({ tipo: 'quitar', id: it.id })} aria-label="Quitar" style={{ border: 0, background: '#FEE2E2', color: '#B91C1C', borderRadius: 6, width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                                  <X size={11} strokeWidth={3} />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>

                <Fila style={{ marginTop: 10, padding: '0 4px' }}>
                  <span style={{ fontSize: 11.5, color: muted }}>Total del grupo</span>
                  <Precio lista={subtotalLista} desbloqueado={desbloqueado} tam={14} />
                </Fila>
                <Fila style={{ padding: '4px 4px 0' }}>
                  <span style={{ fontSize: 11.5, color: muted, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Truck size={11} /> Envío</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#059669' }}>1 solo envío · lo dividen entre todos</span>
                </Fila>
                <div style={{ height: 14 }} />
              </div>

              {/* Pago individual (pegado abajo) */}
              <div style={{ position: 'sticky', bottom: 0, background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(8px)', borderTop: `1px solid ${linea}`, padding: '10px 16px 14px' }}>
                {miParte === 0 ? (
                  <div style={{ textAlign: 'center', fontSize: 12, color: muted, padding: '8px 0' }}>Agregá algo del catálogo para pagar tu parte.</div>
                ) : miPago === 'pagado' ? (
                  <div className="cc-pop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', borderRadius: 12, padding: '11px 12px', fontSize: 13, fontWeight: 800 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#10B981', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', animation: 'cc-listo .45s cubic-bezier(.2,.8,.2,1) both' }}><Check size={13} strokeWidth={4} /></span>
                    Pagado · {formatoARS(miParte)} con Mercado Pago
                  </div>
                ) : (
                  <>
                    <Fila style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 11.5, color: muted }}>Tu parte {desbloqueado && <span style={{ color: '#059669', fontWeight: 700 }}>· con precio de grupo</span>}</span>
                      <NumeroRodante valor={miParte} style={{ fontSize: 15, fontWeight: 800, color: txt, fontFamily: FONT_DISPLAY }} />
                    </Fila>
                    <button type="button" className="pr-btn" onClick={() => pagar(activa)} disabled={miPago === 'procesando'} style={{ width: '100%', border: 0, borderRadius: 12, padding: '12px 14px', background: '#009EE3', color: '#fff', fontSize: 13.5, fontWeight: 800, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 8px 22px rgba(0,158,227,.35)' }}>
                      {miPago === 'procesando' ? (
                        <><span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', animation: 'cc-girar .7s linear infinite' }} /> Procesando el pago…</>
                      ) : (
                        <>Pagar mi parte <NumeroRodante valor={miParte} /> con <span style={{ background: '#fff', color: '#009EE3', borderRadius: 6, padding: '1px 6px', fontSize: 11.5, fontWeight: 900, letterSpacing: '-0.01em' }}>Mercado Pago</span></>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </Pantalla>
        </div>

        {/* DERECHA: el panel del dueño */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Etiqueta color={C.muted}>Lo que ve el dueño · Panel de Órbita</Etiqueta>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: C.muted }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.success, animation: 'cc-vivo 1.6s ease-in-out infinite' }} /> se actualiza en vivo
            </span>
          </div>

          <Pantalla tipo="panel">
            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', minHeight: 640 }}>
              {/* Nav lateral */}
              <div style={{ background: '#0F172A', color: '#CBD5E1', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px 14px' }}>
                  <span style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg, #16A34A, #84CC16)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🌱</span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>Semilla</span>
                </div>
                {['Inicio', 'Pedidos', 'Catálogo', 'Clientes', 'Descuentos', 'Envíos'].map(n => (
                  <div key={n} style={{ padding: '7px 10px', borderRadius: 8, fontSize: 12.5, fontWeight: n === 'Pedidos' ? 800 : 500, background: n === 'Pedidos' ? 'rgba(59,130,246,.18)' : 'transparent', color: n === 'Pedidos' ? '#93C5FD' : '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {n}
                    {n === 'Pedidos' && <span style={{ background: '#3B82F6', color: '#fff', fontSize: 10, borderRadius: 99, padding: '1px 6px', fontWeight: 800 }}>1</span>}
                  </div>
                ))}
              </div>

              {/* Contenido */}
              <div style={{ padding: '18px 20px 20px', background: '#F8FAFC', minWidth: 0 }}>
                <Fila style={{ marginBottom: 14 }}>
                  <div>
                    <div style={{ fontFamily: FONT_DISPLAY, fontSize: 19, fontWeight: 800, color: txt, letterSpacing: '-0.02em' }}>Pedidos</div>
                    <div style={{ fontSize: 12, color: muted }}>Hoy · 2 de septiembre</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['Todos', 'Colectivos'].map(f => (
                      <span key={f} style={{ fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 99, background: f === 'Colectivos' ? '#0F172A' : '#fff', color: f === 'Colectivos' ? '#fff' : '#475569', border: `1px solid ${f === 'Colectivos' ? '#0F172A' : linea}` }}>{f}</span>
                    ))}
                  </div>
                </Fila>

                {/* Pedido consolidado */}
                <div style={{ ...tarjetaClara, borderRadius: 16, overflow: 'hidden', borderColor: todoPagado ? '#6EE7B7' : linea, boxShadow: todoPagado ? '0 0 0 4px rgba(16,185,129,.12), 0 14px 40px rgba(16,185,129,.15)' : '0 6px 20px rgba(15,23,42,.05)', transition: 'all .5s' }}>
                  <div style={{ padding: '14px 16px', borderBottom: `1px solid ${linea}`, background: todoPagado ? 'linear-gradient(135deg, #ECFDF5, #fff)' : '#fff', transition: 'background .5s' }}>
                    <Fila>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Users size={18} /></span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14.5, fontWeight: 800, color: txt, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            #1042 <span style={{ color: '#CBD5E1' }}>·</span> Carrito colectivo <span style={{ color: '#CBD5E1' }}>·</span> {personasConItems.length} {personasConItems.length === 1 ? 'persona' : 'personas'}
                          </div>
                          <div style={{ fontSize: 11.5, color: muted, marginTop: 2 }}>Creado por Vos · {unidades} unidades · link {LINK.split('/').pop()}</div>
                        </div>
                      </div>
                      {todoPagado ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg, #059669, #10B981)', borderRadius: 99, padding: '6px 12px', animation: 'cc-listo .55s cubic-bezier(.2,.8,.2,1) both, cc-halo 1.4s ease-out .3s 2', whiteSpace: 'nowrap' }}>
                          <PackageCheck size={14} /> Listo para preparar
                        </span>
                      ) : (
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#B45309', background: '#FEF3C7', borderRadius: 99, padding: '5px 10px', whiteSpace: 'nowrap' }}>
                          Esperando pagos · {pagados} de {personasConItems.length}
                        </span>
                      )}
                    </Fila>

                    {/* Barra de pagos */}
                    <div style={{ marginTop: 12 }}>
                      <Fila style={{ marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: muted, fontWeight: 600 }}>Estado de pagos</span>
                        <span style={{ fontSize: 11, color: txt, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{pagados} de {personasConItems.length} pagaron · <NumeroRodante valor={personasConItems.filter(p => pagos[p.id] === 'pagado').reduce((a, p) => a + parteDe(p.id), 0)} /> cobrados</span>
                      </Fila>
                      <div style={{ display: 'flex', gap: 3, height: 8 }}>
                        {PERSONAS.map(p => {
                          const con = tieneItems(p.id)
                          const pag = pagos[p.id]
                          return <span key={p.id} style={{ flex: 1, borderRadius: 4, background: !con ? '#F1F5F9' : pag === 'pagado' ? '#10B981' : pag === 'procesando' ? '#7DD3FC' : '#E2E8F0', transition: 'background .4s', border: con && pag !== 'pagado' ? `1px dashed ${p.color}88` : '1px solid transparent' }} />
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Desglose por persona */}
                  <div style={{ padding: '6px 16px' }}>
                    {personasConItems.length === 0 && <div style={{ padding: '18px 0', fontSize: 12.5, color: muted, textAlign: 'center' }}>Todavía nadie agregó nada.</div>}
                    {personasConItems.map(p => {
                      const pag = pagos[p.id]
                      const suyos = items.filter(i => i.persona === p.id)
                      return (
                        <div key={p.id} className="cc-pop" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${suave}` }}>
                          <Avatar persona={p} size={28} pagado={pag === 'pagado'} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: txt }}>{p.nombre === 'Vos' ? 'Vos (organiza)' : p.nombre}</div>
                            <div style={{ fontSize: 11, color: muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{suyos.map(i => `${PROD[i.producto].nombre}${i.cant > 1 ? ` ×${i.cant}` : ''}`).join(' · ')}</div>
                          </div>
                          <NumeroRodante valor={parteDe(p.id)} style={{ fontSize: 13, fontWeight: 800, color: txt }} />
                          <span style={{ width: 84, textAlign: 'center', fontSize: 10.5, fontWeight: 800, borderRadius: 99, padding: '3px 0', background: pag === 'pagado' ? '#D1FAE5' : pag === 'procesando' ? '#E0F2FE' : '#F1F5F9', color: pag === 'pagado' ? '#047857' : pag === 'procesando' ? '#0369A1' : '#64748B', transition: 'all .3s' }}>
                            {pag === 'pagado' ? 'Pagado' : pag === 'procesando' ? 'Procesando' : 'Pendiente'}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Totales + envío */}
                  <div style={{ padding: '10px 16px 14px', background: suave, borderTop: `1px solid ${linea}` }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4, columnGap: 12, fontSize: 12, color: muted }}>
                      <span>Subtotal a precio de lista</span><span style={{ textAlign: 'right', color: txt, fontVariantNumeric: 'tabular-nums' }}>{formatoARS(subtotalLista)}</span>
                      <span style={{ color: desbloqueado ? '#059669' : muted, fontWeight: desbloqueado ? 700 : 500 }}>Precio de grupo (−15%) {!desbloqueado && <span style={{ fontWeight: 500 }}>· todavía no</span>}</span>
                      <span style={{ textAlign: 'right', color: desbloqueado ? '#059669' : muted, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>−<NumeroRodante valor={ahorro} /></span>
                      <span style={{ fontSize: 13.5, fontWeight: 800, color: txt, marginTop: 4 }}>Total del pedido</span>
                      <NumeroRodante valor={total} style={{ fontSize: 16, fontWeight: 800, color: txt, fontFamily: FONT_DISPLAY, marginTop: 2, textAlign: 'right' }} />
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1px solid ${linea}`, borderRadius: 10, padding: '8px 10px' }}>
                      <span style={{ width: 30, height: 30, borderRadius: 8, background: '#EFF6FF', color: '#1D4ED8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Truck size={15} /></span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: txt }}>1 solo envío <span style={{ color: muted, fontWeight: 500 }}>en vez de {Math.max(personasConItems.length, 1)}</span></div>
                        <div style={{ fontSize: 11.5, color: muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{DIRECCION} · recibe Vos</div>
                      </div>
                    </div>
                    {todoPagado && (
                      <div className="cc-pop" style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                        <span className="pr-btn" style={{ flex: 1, textAlign: 'center', background: '#0F172A', color: '#fff', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><PackageCheck size={14} /> Marcar como preparando</span>
                        <span className="pr-btn" style={{ background: '#fff', color: '#334155', border: `1px solid ${linea}`, borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontWeight: 700 }}>Imprimir remito</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pedido anterior, para dar contexto */}
                <div style={{ ...tarjetaClara, marginTop: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.6 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, background: '#F1F5F9', color: '#64748B', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><ShoppingCart size={14} /></span>
                  <div style={{ flex: 1, fontSize: 12, color: txt }}><b>#1041</b> <span style={{ color: '#CBD5E1' }}>·</span> Pedido individual <span style={{ color: '#CBD5E1' }}>·</span> Marta González</div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: txt }}>{formatoARS(14200)}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: '#047857', background: '#D1FAE5', borderRadius: 99, padding: '3px 8px' }}>Entregado</span>
                </div>

                {/* Mini métricas */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12 }}>
                  <div style={{ ...tarjetaClara, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10.5, color: muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ticket del grupo</div>
                    <NumeroRodante valor={total} style={{ display: 'block', fontSize: 18, fontWeight: 800, color: txt, fontFamily: FONT_DISPLAY, marginTop: 4 }} />
                    <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>vs. individual {formatoARS(TICKET_INDIVIDUAL)}</div>
                  </div>
                  <div style={{ ...tarjetaClara, padding: '10px 12px', borderColor: pctVsIndividual > 0 ? '#A7F3D0' : linea }}>
                    <div style={{ fontSize: 10.5, color: muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4 }}><TrendingUp size={11} /> Vs. individual</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: pctVsIndividual > 0 ? '#059669' : '#B91C1C', fontFamily: FONT_DISPLAY, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{pctVsIndividual > 0 ? '+' : ''}{pctVsIndividual}%</div>
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ height: 5, borderRadius: 3, background: '#CBD5E1', width: `${Math.min(100, (TICKET_INDIVIDUAL / Math.max(total, TICKET_INDIVIDUAL)) * 100)}%`, transition: 'width .8s' }} />
                      <span style={{ height: 5, borderRadius: 3, background: 'linear-gradient(90deg, #3B82F6, #10B981)', width: `${Math.min(100, (total / Math.max(total, TICKET_INDIVIDUAL)) * 100)}%`, transition: 'width .8s' }} />
                    </div>
                  </div>
                  <div style={{ ...tarjetaClara, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10.5, color: muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Envíos</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: txt, fontFamily: FONT_DISPLAY, marginTop: 4 }}>1 <span style={{ fontSize: 12, color: muted, fontWeight: 600 }}>en vez de {Math.max(personasConItems.length, 1)}</span></div>
                    <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{personasConItems.length > 1 ? `${personasConItems.length - 1} viajes menos` : 'mismo destino'}</div>
                  </div>
                </div>
              </div>
            </div>
          </Pantalla>

          <Tarjeta style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: `${C.warning}22`, color: C.warning, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Clock size={15} /></span>
            <div style={{ fontSize: 12.5, color: C.body, lineHeight: 1.45 }}>
              <b style={{ color: C.text }}>Si el grupo no llega antes de que venza</b> ({formatoTiempo(restante)}): cada uno paga el precio de lista y el envío se cobra igual una sola vez. Si llegan después de que alguien ya pagó, Mercado Pago le devuelve la diferencia.
            </div>
          </Tarjeta>
        </div>
      </div>
    </div>
  )
}
