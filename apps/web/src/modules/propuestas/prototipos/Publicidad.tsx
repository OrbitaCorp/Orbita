// src/modules/propuestas/prototipos/Publicidad.tsx — Prototipo de
// "Publicidad de un Toque": el dueño conecta Google y Meta una vez, toca
// "Promocionar" en un producto, elige presupuesto y días, y Orbi arma el
// anuncio, lo publica en los dos lados, reparte el presupuesto según lo que
// rinde y reporta en pesos. Todo local y determinístico (semilla fija).
// Demo interna, no producto.

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  BadgeCheck, Bookmark, Check, ChevronRight, CreditCard, Ellipsis, Eye, Heart, Link2, LoaderCircle,
  Megaphone, MessageCircle, Pause, Pencil, Play, Repeat, Rocket, RotateCcw, Search, Send, ShieldCheck,
  ShoppingBag, Sparkles, Star, TrendingUp, TriangleAlert, Users, Wand, Zap,
} from 'lucide-react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Boton, C, Chip, Etiqueta, FONT, FONT_DISPLAY, FONT_MONO, OrbiAvatar, Pantalla, Tarjeta, formatoARS } from '../ui'

// ─── Constantes del negocio ──────────────────────────────────────────────────

const ACENTO = '#FB923C'
const GOOGLE = '#4285F4'
const META = '#F472B6'
const VENTAS_COLOR = '#34D399'
const NEGOCIO = 'Casa Ramos · indumentaria'
const DOMINIO = 'casaramos.orbita.site'
const CUENTA_GOOGLE = '384-221-9901'
const CUENTA_META = '1029 4471 8802'
const CLIENTES = 1240
const PRODUCTOS_FEED = 84

type Forma = 'campera' | 'remera' | 'jean' | 'buzo'
interface Producto { id: string; nombre: string; precio: number; genero: 'f' | 'm'; grad: string; tinta: string; slug: string; forma: Forma }

const PRODUCTOS: Producto[] = [
  { id: 'campera', nombre: 'Campera de jean oversize', precio: 24000, genero: 'f', grad: 'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 60%, #93C5FD 100%)', tinta: 'rgba(255,255,255,.92)', slug: 'campera-jean-oversize', forma: 'campera' },
  { id: 'remera', nombre: 'Remera básica', precio: 8500, genero: 'f', grad: 'linear-gradient(135deg, #F8FAFC 0%, #CBD5E1 70%, #94A3B8 100%)', tinta: 'rgba(15,23,42,.82)', slug: 'remera-basica', forma: 'remera' },
  { id: 'jean', nombre: 'Jean recto', precio: 19000, genero: 'm', grad: 'linear-gradient(135deg, #312E81 0%, #4F46E5 60%, #818CF8 100%)', tinta: 'rgba(255,255,255,.92)', slug: 'jean-recto', forma: 'jean' },
  { id: 'buzo', nombre: 'Buzo canguro', precio: 16000, genero: 'm', grad: 'linear-gradient(135deg, #7C2D12 0%, #EA580C 60%, #FDBA74 100%)', tinta: 'rgba(255,255,255,.92)', slug: 'buzo-canguro', forma: 'buzo' },
]
function productoPorId(id: string | null): Producto | null { return PRODUCTOS.find(p => p.id === id) ?? null }

type Objetivo = 'ventas' | 'visitas' | 'seguidores'
type Dias = 3 | 7 | 14
const OBJETIVOS: { id: Objetivo; nombre: string; icono: ReactNode }[] = [
  { id: 'ventas', nombre: 'Ventas', icono: <ShoppingBag size={13} /> },
  { id: 'visitas', nombre: 'Visitas', icono: <Eye size={13} /> },
  { id: 'seguidores', nombre: 'Seguidores', icono: <Users size={13} /> },
]
const DIAS_OPCIONES: Dias[] = [3, 7, 14]
const F_DIAS: Record<Dias, number> = { 3: 0.9, 7: 1, 14: 1.08 }

// ─── Modelo (determinístico y simple) ────────────────────────────────────────

interface Estimacion {
  personas: number; visMin: number; visMax: number; venMin: number; venMax: number
  retMin: number; retMax: number; segMin: number; segMax: number; ticket: number; total: number
}

/** Alcance y resultados estimados. Formula lineal con el presupuesto; el precio del producto mueve la conversión. */
function estimar(p: Producto, presupuesto: number, dias: Dias, objetivo: Objetivo): Estimacion {
  const personas = presupuesto * 0.47 * F_DIAS[dias]
  const ctr = objetivo === 'visitas' ? 1.4 : 1
  const visMin = personas * 0.004 * ctr
  const visMax = personas * 0.0065 * ctr
  const factorPrecio = Math.pow(24000 / p.precio, 0.3)
  const convObj = objetivo === 'ventas' ? 0.11 : objetivo === 'visitas' ? 0.06 : 0.045
  const conv = convObj * factorPrecio
  const venMin = visMin * conv
  const venMax = visMax * conv
  const ticket = p.precio * 0.5 + 5500
  const retMin = (venMin * ticket) / presupuesto
  const retMax = (venMax * ticket) / presupuesto
  const segMin = personas * 0.013
  const segMax = personas * 0.02
  const total = Math.round((presupuesto * retMax * 1.005) / 1000) * 1000
  return { personas, visMin, visMax, venMin, venMax, retMin, retMax, segMin, segMax, ticket, total }
}

/** Generador con semilla (mulberry32) para que la campaña se repita igual. */
function mulberry32(semilla: number) {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Decision { meta: number; texto: string }
const DECISIONES_BASE: Decision[] = [
  { meta: 50, texto: 'Arranco parejo: 50% Google Shopping, 50% Instagram y Facebook.' },
  { meta: 70, texto: 'Meta vende más (3 ventas contra 1): paso 20% a Meta.' },
  { meta: 70, texto: 'Pausé la variante C: 1.900 vistas y cero clics. Sigo con A y B.' },
  { meta: 60, texto: 'Google Shopping bajó el costo por venta a la mitad: le devuelvo 10%.' },
  { meta: 60, texto: 'De 20 a 23 hs se vende el doble: concentro la puja a la noche.' },
  { meta: 65, texto: 'Meta sigue rindiendo mejor: cierro en 65% Meta.' },
  { meta: 65, texto: 'Último día: gasté el 100% del presupuesto, sin sobrantes.' },
]
const DECISIONES_EXTRA: Decision[] = [
  { meta: 55, texto: 'Fin de semana: en Google buscan más y Meta descansa. Empato en 55%.' },
  { meta: 55, texto: 'Excluí a tus 1.240 clientes: el presupuesto va solo a gente nueva.' },
  { meta: 65, texto: 'Lunes: vuelve a rendir Instagram. Subo Meta a 65%.' },
  { meta: 65, texto: 'La variante A cansó: la roté por una con la foto de espaldas.' },
  { meta: 70, texto: 'Los que entraron y no compraron ven el anuncio otra vez.' },
  { meta: 70, texto: 'Mantengo el reparto: costo por venta estable en $2.900.' },
  { meta: 70, texto: 'Anteúltimo día: guardo el 18% del presupuesto para el cierre.' },
]
function decisiones(dias: Dias): Decision[] {
  if (dias === 3) return [DECISIONES_BASE[0], DECISIONES_BASE[1], DECISIONES_BASE[6]]
  if (dias === 7) return DECISIONES_BASE
  return [...DECISIONES_BASE.slice(0, 6), ...DECISIONES_EXTRA, DECISIONES_BASE[6]]
}

interface DiaSim {
  dia: number; google: number; meta: number; ventas: number; ventasAcum: number; visitas: number
  visitasAcum: number; pedidosAcum: number; personasAcum: number; seguidoresAcum: number; metaPct: number; decision: string
}
interface Campana { producto: Producto; presupuesto: number; dias: Dias; objetivo: Objetivo; texto: string; serie: DiaSim[]; est: Estimacion }

function simular(p: Producto, presupuesto: number, dias: Dias, objetivo: Objetivo, texto: string): Campana {
  const est = estimar(p, presupuesto, dias, objetivo)
  const rng = mulberry32(presupuesto + dias * 7919 + p.precio)
  const decs = decisiones(dias)
  const porDia = presupuesto / dias
  const pesos = decs.map((_, d) => (0.55 + 0.9 * (d / (dias - 1))) * (0.85 + rng() * 0.3))
  const sumaPesos = pesos.reduce((s, w) => s + w, 0)
  let acumV = 0, acumVis = 0, acumPer = 0
  const serie: DiaSim[] = decs.map((dec, d) => {
    const ultimo = d === dias - 1
    const ventas = ultimo ? est.total - acumV : Math.round((est.total * pesos[d]) / sumaPesos / 500) * 500
    acumV += ventas
    const visitas = Math.round(porDia / (300 + rng() * 90))
    acumVis += visitas
    acumPer += Math.round(porDia * 0.47 * F_DIAS[dias])
    return {
      dia: d + 1,
      google: Math.round(porDia * (1 - dec.meta / 100)),
      meta: Math.round((porDia * dec.meta) / 100),
      ventas,
      ventasAcum: acumV,
      visitas,
      visitasAcum: acumVis,
      pedidosAcum: Math.round(acumV / est.ticket),
      personasAcum: acumPer,
      seguidoresAcum: Math.round(acumPer * 0.0165),
      metaPct: dec.meta,
      decision: dec.texto,
    }
  })
  return { producto: p, presupuesto, dias, objetivo, texto, serie, est }
}

// ─── Textos de Orbi ──────────────────────────────────────────────────────────

function gritoDe(objetivo: Objetivo): { feo: string; lindo: string } {
  if (objetivo === 'ventas') return { feo: 'ÚLTIMOS DÍAS', lindo: 'Últimos días' }
  if (objetivo === 'visitas') return { feo: 'NUEVA TEMPORADA', lindo: 'Nueva temporada' }
  return { feo: 'SOMOS CASA RAMOS', lindo: 'Somos Casa Ramos' }
}

/** Tres variantes de anuncio. La B siempre "grita" en mayúsculas (para simular el rechazo de Meta). */
function variantes(p: Producto, objetivo: Objetivo, corregido: boolean): string[] {
  const f = p.genero === 'f'
  const la = f ? 'la' : 'lo'
  const La = f ? 'La' : 'Lo'
  const esta = f ? 'esta' : 'este'
  const nombre = p.nombre
  const bajo = p.nombre.toLowerCase()
  const precio = formatoARS(p.precio)
  const g = gritoDe(objetivo)
  const grito = corregido ? g.lindo : g.feo
  switch (objetivo) {
    case 'ventas': return [
      `${nombre} a ${precio}, en 3 cuotas sin interés y con envío a todo el país. Quedan pocas unidades: tocá y lleva${la}.`,
      `${grito}: ${nombre} a ${precio} en Casa Ramos. Comprás online y ${la} tenés en tu casa en 48 hs.`,
      `¿Buscabas ${esta} ${bajo}? ${La} tenés a ${precio}, con cambio gratis si no te queda.`,
    ]
    case 'visitas': return [
      `Entró la nueva temporada a Casa Ramos: ${nombre}, remeras, jeans y más. Mirá todo el catálogo online.`,
      `${grito}: ${nombre} y todo lo que llegó esta semana. Entrá a la tienda y elegí lo tuyo.`,
      `¿Ya viste ${esta} ${bajo}? Está en la tienda con todo lo nuevo. Pasá a mirar, sin compromiso.`,
    ]
    case 'seguidores': return [
      `Casa Ramos, ropa de todos los días hecha en Argentina. Seguinos y enterate antes que nadie de cada ingreso, como ${esta} ${bajo}.`,
      `${grito}: indumentaria sin vueltas y a precio justo. Seguinos para ver lo nuevo primero.`,
      `Detrás de cada prenda hay un taller de barrio. Seguinos y mirá cómo se hace ${esta} ${bajo}.`,
    ]
  }
}

function fraseEstimacion(p: Producto, presupuesto: number, dias: Dias, objetivo: Objetivo, e: Estimacion): string {
  const esta = p.genero === 'f' ? 'esta' : 'este'
  const base = `Con ${formatoARS(presupuesto)} en ${dias} días llego a unas ${entero(e.personas)} personas parecidas a tus ${entero(CLIENTES)} clientes.`
  if (objetivo === 'ventas') return `${base} Para ${esta} ${p.nombre.toLowerCase()} espero ${Math.round(e.venMin)} a ${Math.round(e.venMax)} ventas.`
  if (objetivo === 'visitas') return `${base} Apunto a que entren a la tienda: ${Math.round(e.visMin)} a ${Math.round(e.visMax)} visitas, y alguna venta de yapa.`
  return `${base} Apunto a que sigan la cuenta: ${Math.round(e.segMin)} a ${Math.round(e.segMax)} seguidores nuevos, gente que después compra.`
}

function sugerencia(c: Campana): { producto: Producto; presupuesto: number } {
  const producto = c.producto.id === 'buzo' ? PRODUCTOS[1] : PRODUCTOS[3]
  const presupuesto = Math.min(100000, Math.round((c.presupuesto * 1.5) / 5000) * 5000)
  return { producto, presupuesto }
}

// ─── Formato ─────────────────────────────────────────────────────────────────

function entero(n: number): string { return Math.round(n).toLocaleString('es-AR') }
function veces(n: number): string { return `${n.toLocaleString('es-AR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}x` }
function compacto(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  if (n >= 1e3) return `$${Math.round(n / 1e3).toLocaleString('es-AR')} mil`
  return `$${Math.round(n)}`
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Conteo animado hacia `objetivo` (easing cubic-out). */
function useConteo(objetivo: number, dur = 700): number {
  const [valor, setValor] = useState(objetivo)
  const desdeRef = useRef(objetivo)
  useEffect(() => {
    const inicio = desdeRef.current
    if (inicio === objetivo) return
    let ultimo = inicio
    let raf = 0
    let t0 = -1
    const paso = (t: number) => {
      if (t0 < 0) t0 = t
      const k = Math.min(1, (t - t0) / dur)
      const e = 1 - Math.pow(1 - k, 3)
      ultimo = inicio + (objetivo - inicio) * e
      setValor(ultimo)
      if (k < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => { cancelAnimationFrame(raf); desdeRef.current = ultimo }
  }, [objetivo, dur])
  return valor
}

// ─── Estilos propios ─────────────────────────────────────────────────────────

const CSS_PB = `
  @keyframes pb-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.04); opacity: 1; } 100% { transform: scale(1); } }
  @keyframes pb-slide-in { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: none; } }
  @keyframes pb-check { 0% { transform: scale(0) rotate(-30deg); opacity: 0; } 70% { transform: scale(1.25) rotate(4deg); opacity: 1; } 100% { transform: scale(1) rotate(0); } }
  @keyframes pb-live { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }
  @keyframes pb-heart { 0% { transform: scale(1); } 35% { transform: scale(1.4); } 100% { transform: scale(1); } }
  @keyframes pb-barra { from { width: 0; } to { width: 100%; } }
  @keyframes pb-glow { 0%, 100% { box-shadow: 0 8px 24px rgba(251,146,60,.35); } 50% { box-shadow: 0 8px 34px rgba(251,146,60,.6); } }
  .pb-pop { animation: pb-pop .4s cubic-bezier(.2,.8,.2,1) both; }
  .pb-slide-in { animation: pb-slide-in .45s cubic-bezier(.2,.8,.2,1) both; }
  .pb-check { animation: pb-check .45s cubic-bezier(.2,.8,.2,1) both; }
  .pb-range { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 99px; background: linear-gradient(90deg, rgba(251,146,60,.75), rgba(139,92,246,.7)); outline: none; cursor: pointer; }
  .pb-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #F8FAFC; border: 3px solid #FB923C; box-shadow: 0 2px 10px rgba(0,0,0,.4); transition: transform .15s; }
  .pb-range::-webkit-slider-thumb:hover { transform: scale(1.15); }
  .pb-range::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #F8FAFC; border: 3px solid #FB923C; box-shadow: 0 2px 10px rgba(0,0,0,.4); }
  .pb-prod { transition: transform .2s cubic-bezier(.2,.8,.2,1), border-color .2s, box-shadow .2s; cursor: pointer; }
  .pb-prod:hover { transform: translateY(-3px); border-color: rgba(251,146,60,.55) !important; box-shadow: 0 14px 34px rgba(0,0,0,.4); }
  .pb-var { transition: transform .18s cubic-bezier(.2,.8,.2,1), border-color .18s, background .18s; cursor: pointer; text-align: left; }
  .pb-var:hover { transform: translateX(3px); border-color: rgba(251,146,60,.5) !important; }
  .pb-chip { transition: transform .15s, background .15s, border-color .15s, color .15s; cursor: pointer; }
  .pb-chip:hover { transform: translateY(-1px); border-color: rgba(251,146,60,.55) !important; color: #F8FAFC !important; }
  .pb-kpi { transition: transform .22s cubic-bezier(.2,.8,.2,1), border-color .22s; }
  .pb-kpi:hover { transform: translateY(-2px); border-color: rgba(251,146,60,.4) !important; }
  .pb-textarea { resize: none; line-height: 1.5; font-size: 13.5px; min-height: 74px; }
  .pb-tab { transition: color .15s, border-color .15s; cursor: pointer; }
`

// ─── Logos (dibujados, sin marcas como imagen) ───────────────────────────────

function LogoGoogle({ size = 28 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'conic-gradient(from -40deg, #EA4335 0 25%, #FBBC05 0 50%, #34A853 0 75%, #4285F4 0 100%)', flexShrink: 0 }}>
      <span style={{ width: size - 6, height: size - 6, borderRadius: '50%', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, Helvetica, sans-serif', fontWeight: 800, fontSize: size * 0.5, color: '#4285F4', lineHeight: 1 }}>G</span>
    </span>
  )
}
function LogoMeta({ size = 28 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0668E1, #0080FB)', flexShrink: 0 }}>
      <svg viewBox="0 0 24 24" fill="none" style={{ width: size * 0.7, height: size * 0.7 }}>
        <path d="M3.5 13c0-3.4 1.6-6 3.7-6 3.2 0 4.3 10 8.2 10 2.5 0 5.1-2.6 5.1-6.3 0-2.1-1.4-3.7-3.1-3.7-3.6 0-5.2 10-8.6 10C6.6 17 3.5 15.7 3.5 13z" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
function GlifoInstagram({ size = 22, color = '#0F172A' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size }}>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1" fill={color} stroke="none" />
    </svg>
  )
}

/** Silueta de la prenda para las "fotos" del catálogo. */
function Silueta({ forma, color, size = 64 }: { forma: Forma; color: string; size?: number }) {
  const p: Record<Forma, ReactNode> = {
    remera: <path d="M20 8 L8 16 L12 28 L18 26 L18 56 L46 56 L46 26 L52 28 L56 16 L44 8 C40 15 24 15 20 8 Z" fill={color} />,
    buzo: (
      <>
        <path d="M18 12 L6 22 L12 36 L18 33 L18 58 L46 58 L46 33 L52 36 L58 22 L46 12 C42 6 22 6 18 12 Z" fill={color} />
        <path d="M22 13 C24 3 40 3 42 13" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
        <rect x="24" y="42" width="16" height="10" rx="2" fill="rgba(0,0,0,.18)" />
      </>
    ),
    campera: (
      <>
        <path d="M18 10 L5 20 L11 36 L18 33 L18 58 L46 58 L46 33 L53 36 L59 20 L46 10 L40 8 L32 20 L24 8 Z" fill={color} />
        <path d="M32 20 L32 58" stroke="rgba(0,0,0,.25)" strokeWidth="2.2" />
        <path d="M24 8 L32 20 L40 8" stroke="rgba(0,0,0,.25)" strokeWidth="2" fill="none" />
      </>
    ),
    jean: (
      <>
        <path d="M16 6 H48 L50 58 H37 L32 30 L27 58 H14 Z" fill={color} />
        <path d="M16 14 H48" stroke="rgba(0,0,0,.22)" strokeWidth="2" />
      </>
    ),
  }
  return <svg viewBox="0 0 64 64" style={{ width: size, height: size, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.25))' }}>{p[forma]}</svg>
}

function FotoProducto({ p, alto, size, radio = 12, children }: { p: Producto; alto: number; size: number; radio?: number; children?: ReactNode }) {
  return (
    <div style={{ height: alto, borderRadius: radio, background: p.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,.35), transparent 55%)' }} />
      <Silueta forma={p.forma} color={p.tinta} size={size} />
      {children}
    </div>
  )
}

// ─── Piezas chicas ───────────────────────────────────────────────────────────

function Pasos({ actual }: { actual: number }) {
  const items = ['Conectar', 'Promocionar', 'En vuelo']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {items.map((t, i) => {
        const hecho = i < actual
        const activo = i === actual
        const color = hecho ? C.success : activo ? ACENTO : C.subtle
        return (
          <Fragment key={t}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: activo ? C.text : color, padding: '4px 10px 4px 5px', borderRadius: 999, background: activo ? `${ACENTO}1F` : 'transparent', border: `1px solid ${activo ? `${ACENTO}55` : 'transparent'}`, transition: 'all .25s' }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: hecho ? `${C.success}22` : activo ? ACENTO : 'rgba(148,163,184,.12)', color: hecho ? C.success : activo ? '#1F1105' : C.subtle, fontSize: 10.5, fontFamily: FONT_MONO }}>
                {hecho ? <Check size={11} strokeWidth={3} /> : i + 1}
              </span>
              {t}
            </span>
            {i < items.length - 1 && <span style={{ width: 14, height: 1, background: hecho ? `${C.success}66` : C.border }} />}
          </Fragment>
        )
      })}
    </div>
  )
}

function Spinner({ size = 16, color = ACENTO }: { size?: number; color?: string }) {
  return <LoaderCircle size={size} color={color} style={{ animation: 'pr-spin .9s linear infinite' }} />
}

type EstadoConexion = 'idle' | 'conectando' | 'conectado'

function TarjetaConexion({ logo, nombre, detalle, cuenta, estado, onConectar }: { logo: ReactNode; nombre: string; detalle: string; cuenta: string; estado: EstadoConexion; onConectar: () => void }) {
  const ok = estado === 'conectado'
  return (
    <Tarjeta style={{ padding: 18, borderColor: ok ? `${C.success}55` : C.border, transition: 'border-color .3s', position: 'relative', overflow: 'hidden' }}>
      {estado === 'conectando' && <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, height: 2, background: `linear-gradient(90deg, ${ACENTO}, ${C.orbi})`, animation: 'pb-barra .9s linear both' }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {logo}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, fontFamily: FONT_DISPLAY }}>{nombre}</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{detalle}</div>
        </div>
      </div>
      <div style={{ marginTop: 14, minHeight: 36, display: 'flex', alignItems: 'center' }}>
        {estado === 'idle' && <Boton color={ACENTO} onClick={onConectar} style={{ color: '#1F1105' }}><Link2 size={14} /> Conectar</Boton>}
        {estado === 'conectando' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 13, color: C.body }}><Spinner /> Abriendo {nombre.split(' ')[0]} para autorizar…</span>}
        {ok && (
          <span className="pb-pop" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.success, fontWeight: 700 }}>
            <span className="pb-check" style={{ width: 22, height: 22, borderRadius: '50%', background: `${C.success}22`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Check size={13} strokeWidth={3} /></span>
            Conectado <span style={{ color: C.muted, fontWeight: 500 }}>· cuenta</span> <span style={{ fontFamily: FONT_MONO, color: C.body, fontWeight: 500 }}>{cuenta}</span>
          </span>
        )}
      </div>
    </Tarjeta>
  )
}

function Kpi({ etiqueta, valor, formato, color = C.text, retardo = 0, icono }: { etiqueta: string; valor: number; formato: (n: number) => string; color?: string; retardo?: number; icono: ReactNode }) {
  const v = useConteo(valor)
  return (
    <div className="pb-kpi pb-slide-in" style={{ animationDelay: `${retardo}ms`, padding: '10px 12px', borderRadius: 14, background: C.surface2, border: `1px solid ${C.border}`, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted }}>{icono}{etiqueta}</div>
      <div style={{ fontSize: 19, fontWeight: 800, fontFamily: FONT_DISPLAY, letterSpacing: '-0.02em', color, marginTop: 4, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formato(v)}</div>
    </div>
  )
}

function ChipOpcion({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="pb-chip" onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, fontFamily: FONT, color: activo ? '#1F1105' : C.body, background: activo ? ACENTO : 'rgba(148,163,184,.08)', border: `1px solid ${activo ? ACENTO : C.border}` }}>
      {children}
    </button>
  )
}

function Estadistica({ etiqueta, valor, color = C.text }: { etiqueta: string; valor: string; color?: string }) {
  return (
    <div style={{ padding: '8px 12px', borderRadius: 12, background: 'rgba(2,6,23,.45)', border: `1px solid ${C.border}`, minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.subtle }}>{etiqueta}</div>
      <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, color, marginTop: 2, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
    </div>
  )
}

interface PuntoGrafico { dia: string; Google: number | null; Meta: number | null; Ventas: number | null }

function TooltipCampana({ active, payload, label }: { active?: boolean; payload?: ReadonlyArray<{ name?: string; value?: number | null; color?: string }>; label?: string }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div style={{ background: 'rgba(7,11,22,.96)', border: `1px solid ${C.borderStrong}`, borderRadius: 12, padding: '8px 12px', fontSize: 12.5, fontFamily: FONT, color: C.body, boxShadow: '0 10px 30px rgba(0,0,0,.5)' }}>
      <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>{label}</div>
      {payload.map(it => (
        <div key={it.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
          <span style={{ color: it.color }}>{it.name === 'Ventas' ? 'Ventas acumuladas' : `Gasto ${it.name}`}</span>
          <span style={{ fontFamily: FONT_MONO }}>{formatoARS(it.value ?? 0)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Celular: el anuncio como lo ve la gente ─────────────────────────────────

type Pestana = 'instagram' | 'google'

function BarraEstado({ oscuro = false }: { oscuro?: boolean }) {
  const color = oscuro ? '#fff' : '#0F172A'
  return (
    <div style={{ height: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 22px 4px', fontSize: 12, fontWeight: 700, color }}>
      <span>9:41</span>
      <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 5 }}>
        <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 1.5 }}>{[4, 6, 8, 10].map(h => <span key={h} style={{ width: 3, height: h, borderRadius: 1, background: color }} />)}</span>
        <span style={{ width: 22, height: 10, borderRadius: 3, border: `1.5px solid ${color}`, position: 'relative' }}><span style={{ position: 'absolute', left: 1.5, top: 1.5, bottom: 1.5, width: 13, borderRadius: 1.5, background: color }} /></span>
      </span>
    </div>
  )
}

function Estrellas() {
  return <span style={{ display: 'inline-flex', gap: 1 }}>{[0, 1, 2, 3, 4].map(i => <Star key={i} size={11} fill="#FBBC05" color="#FBBC05" />)}</span>
}

function VistaInstagram({ producto, texto, objetivo, likes }: { producto: Producto | null; texto: string; objetivo: Objetivo; likes: number }) {
  const cta = objetivo === 'ventas' ? 'Comprar' : objetivo === 'visitas' ? 'Ver tienda' : 'Seguir'
  return (
    <div className="pr-fade-in" style={{ background: '#fff', minHeight: 620 }}>
      <BarraEstado />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px 8px' }}>
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, letterSpacing: '-0.03em', fontStyle: 'italic' }}>Instagram</span>
        <span style={{ display: 'inline-flex', gap: 14 }}><Heart size={22} /><Send size={21} /></span>
      </div>
      <div style={{ display: 'flex', gap: 12, padding: '2px 14px 10px', overflow: 'hidden' }}>
        {['Tu historia', 'lulu.ok', 'ferbarber', 'cafenom', 'ana_'].map((n, i) => (
          <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{ width: 50, height: 50, borderRadius: '50%', padding: 2, background: i === 0 ? '#E2E8F0' : 'linear-gradient(45deg, #F58529, #DD2A7B, #8134AF)' }}>
              <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: '50%', background: '#fff', padding: 2 }}><span style={{ display: 'block', width: '100%', height: '100%', borderRadius: '50%', background: `hsl(${(i * 67) % 360} 45% 80%)` }} /></span>
            </span>
            <span style={{ fontSize: 9.5, color: '#334155' }}>{n}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid #F1F5F9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px' }}>
          <span style={{ width: 34, height: 34, borderRadius: '50%', padding: 2, background: 'linear-gradient(45deg, #F58529, #DD2A7B, #8134AF)', flexShrink: 0 }}>
            <span style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#0F172A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 11, fontFamily: FONT_DISPLAY, border: '2px solid #fff' }}>CR</span>
          </span>
          <div style={{ flex: 1, lineHeight: 1.2 }}>
            <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>casaramos <BadgeCheck size={13} color="#fff" fill="#0095F6" strokeWidth={2.5} /></div>
            <div style={{ fontSize: 11, color: '#64748B' }}>Publicidad</div>
          </div>
          <Ellipsis size={18} />
        </div>
        {producto ? (
          <FotoProducto p={producto} alto={250} size={130} radio={0}>
            <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(15,23,42,.55)', padding: '3px 8px', borderRadius: 999 }}>1/3</span>
            <span style={{ position: 'absolute', left: 12, bottom: 12, right: 12, color: '#fff', fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16, textShadow: '0 2px 10px rgba(0,0,0,.45)', letterSpacing: '-0.01em' }}>{producto.nombre}</span>
          </FotoProducto>
        ) : (
          <div style={{ height: 250, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, margin: '0 12px', border: '2px dashed #CBD5E1', borderRadius: 14, color: '#64748B', fontSize: 12.5, textAlign: 'center', padding: 20 }}>
            <Megaphone size={26} color="#94A3B8" />
            Tocá Promocionar en un producto y acá ves el anuncio tal cual lo ve la gente.
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#0095F6', color: '#fff', fontWeight: 700, fontSize: 13.5 }}>
          {cta} <ChevronRight size={16} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 4px' }}>
          <span style={{ display: 'inline-flex', gap: 14 }}>
            <Heart key={likes} size={22} color="#E11D48" fill="#E11D48" style={{ animation: 'pb-heart .5s ease' }} />
            <MessageCircle size={22} /><Send size={21} />
          </span>
          <Bookmark size={22} />
        </div>
        <div style={{ padding: '2px 12px', fontSize: 12.5, fontWeight: 700 }}>Le gusta a {entero(likes)} personas</div>
        <div style={{ padding: '4px 12px', fontSize: 12.5, lineHeight: 1.45, color: '#0F172A', minHeight: 54 }}>
          <span style={{ fontWeight: 700 }}>casaramos</span> {texto}
          {producto && texto.length > 0 && <span style={{ color: '#94A3B8' }}> #casaramos #{producto.slug.split('-')[0]}</span>}
        </div>
        <div style={{ padding: '2px 12px 12px', fontSize: 11.5, color: '#64748B' }}>Ver los 12 comentarios · hace 2 h</div>
      </div>
    </div>
  )
}

function VistaGoogle({ producto, objetivo }: { producto: Producto | null; objetivo: Objetivo }) {
  const consulta = producto ? producto.nombre.toLowerCase() : 'ropa online'
  const otros = PRODUCTOS.filter(p => p.id !== producto?.id).slice(0, 2)
  const cta = objetivo === 'seguidores' ? 'Conocé Casa Ramos' : objetivo === 'visitas' ? 'Ver la tienda' : 'Comprar'
  return (
    <div className="pr-fade-in" style={{ background: '#fff', minHeight: 620 }}>
      <BarraEstado />
      <div style={{ textAlign: 'center', padding: '4px 0 8px', fontFamily: 'Arial, Helvetica, sans-serif', fontWeight: 800, fontSize: 23, letterSpacing: '-0.02em' }}>
        <span style={{ color: '#4285F4' }}>G</span><span style={{ color: '#EA4335' }}>o</span><span style={{ color: '#FBBC05' }}>o</span><span style={{ color: '#4285F4' }}>g</span><span style={{ color: '#34A853' }}>l</span><span style={{ color: '#EA4335' }}>e</span>
      </div>
      <div style={{ margin: '0 14px', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 999, background: '#F1F5F9', fontSize: 13.5, color: '#0F172A' }}>
        <Search size={16} color="#64748B" /><span style={{ flex: 1 }}>{consulta}</span>
      </div>
      <div style={{ display: 'flex', gap: 16, padding: '12px 18px 0', fontSize: 12.5, color: '#475569', borderBottom: '1px solid #E2E8F0' }}>
        {['Todo', 'Shopping', 'Imágenes', 'Mapas'].map((t, i) => <span key={t} style={{ paddingBottom: 8, borderBottom: i === 0 ? '2.5px solid #1A73E8' : '2.5px solid transparent', color: i === 0 ? '#1A73E8' : undefined, fontWeight: i === 0 ? 700 : 500 }}>{t}</span>)}
      </div>
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>Patrocinado <span style={{ fontWeight: 400, color: '#64748B' }}>· {DOMINIO}</span></div>
        {producto ? (
          <div className="pb-pop" style={{ marginTop: 8, border: '1px solid #E2E8F0', borderRadius: 14, padding: 10, display: 'flex', gap: 12, boxShadow: '0 4px 14px rgba(15,23,42,.06)' }}>
            <div style={{ width: 96, flexShrink: 0 }}><FotoProducto p={producto} alto={96} size={58} radio={10} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: '#1A0DAB', fontWeight: 600, lineHeight: 1.25 }}>{producto.nombre} · Casa Ramos</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>{formatoARS(producto.precio)}</div>
              <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>{DOMINIO}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, fontSize: 11.5, color: '#475569' }}><Estrellas /> 4,8 (124)</div>
              <div style={{ fontSize: 11.5, color: '#188038', fontWeight: 600, marginTop: 3 }}>Envío gratis · En stock</div>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 8, height: 118, border: '2px dashed #CBD5E1', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontSize: 12.5, textAlign: 'center', padding: 16 }}>Elegí un producto y acá aparece el resultado de Shopping.</div>
        )}
        {producto && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 999, border: '1px solid #1A73E8', color: '#1A73E8', fontSize: 13, fontWeight: 700 }}>
            {cta} <ChevronRight size={15} />
          </div>
        )}
        <div style={{ marginTop: 14, fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>También de {DOMINIO}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          {otros.map(p => (
            <div key={p.id} style={{ flex: 1, border: '1px solid #E2E8F0', borderRadius: 12, padding: 8 }}>
              <FotoProducto p={p} alto={64} size={36} radio={8} />
              <div style={{ fontSize: 11, marginTop: 6, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{formatoARS(p.precio)}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, opacity: 0.55 }}>
          <div style={{ fontSize: 11, color: '#64748B' }}>casaramos.orbita.site › catalogo</div>
          <div style={{ fontSize: 13.5, color: '#1A0DAB', marginTop: 2 }}>Casa Ramos · Indumentaria | Tienda online</div>
          <div style={{ fontSize: 11.5, color: '#475569', marginTop: 2 }}>Remeras, jeans, camperas y buzos. Envíos a todo el país y 3 cuotas sin interés.</div>
        </div>
      </div>
    </div>
  )
}

function Celular({ pestana, setPestana, producto, texto, objetivo, likes, enVuelo }: { pestana: Pestana; setPestana: (p: Pestana) => void; producto: Producto | null; texto: string; objetivo: Objetivo; likes: number; enVuelo: { dia: number; total: number; vistas: number } | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'inline-flex', padding: 4, borderRadius: 999, background: 'rgba(2,6,23,.55)', border: `1px solid ${C.border}`, gap: 2 }}>
        {([
          { id: 'instagram' as Pestana, nombre: 'Instagram', icono: <GlifoInstagram size={14} color={pestana === 'instagram' ? '#1F1105' : C.body} /> },
          { id: 'google' as Pestana, nombre: 'Google', icono: <LogoGoogle size={15} /> },
        ]).map(t => (
          <button key={t.id} type="button" className="pb-tab pr-btn" onClick={() => setPestana(t.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 999, border: 'none', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: pestana === t.id ? '#1F1105' : C.body, background: pestana === t.id ? ACENTO : 'transparent' }}>
            {t.icono} {t.nombre}
          </button>
        ))}
      </div>
      <div style={{ position: 'relative' }}>
        <Pantalla tipo="celular" ancho={330}>
          {pestana === 'instagram'
            ? <VistaInstagram key="ig" producto={producto} texto={texto} objetivo={objetivo} likes={likes} />
            : <VistaGoogle key="g" producto={producto} objetivo={objetivo} />}
          {enVuelo && (
            <div className="pb-pop" style={{ position: 'absolute', left: 14, right: 14, bottom: 14, padding: '9px 12px', borderRadius: 14, background: 'rgba(7,11,22,.92)', color: '#F8FAFC', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 10px 30px rgba(0,0,0,.4)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.success, animation: 'pb-live 1.2s ease-in-out infinite', flexShrink: 0 }} />
              <span style={{ fontWeight: 700 }}>En vuelo · día {enVuelo.dia} de {enVuelo.total}</span>
              <span style={{ marginLeft: 'auto', fontFamily: FONT_MONO, color: C.muted }}>{entero(enVuelo.vistas)} vistas</span>
            </div>
          )}
        </Pantalla>
      </div>
      <div style={{ fontSize: 12, color: C.subtle, textAlign: 'center' }}>Así lo ve la gente. Cambiá el texto o el producto y se actualiza al toque.</div>
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────

type Fase2 = 'publicando' | 'vuelo'
type Rechazo = 'ninguno' | 'rechazado' | 'arreglando' | 'aprobado'

const PASOS_PUBLICACION = ['Creando la campaña en Google Ads (Shopping)', 'Creando el conjunto de anuncios en Meta (Instagram + Facebook)', 'Revisión de políticas de las dos plataformas']

export default function Publicidad() {
  // Paso 0 · conexión
  const [paso, setPaso] = useState(0)
  const [google, setGoogle] = useState<EstadoConexion>('idle')
  const [meta, setMeta] = useState<EstadoConexion>('idle')
  const [checks, setChecks] = useState(0)

  // Paso 1 · promocionar
  const [productoId, setProductoId] = useState<string | null>(null)
  const [objetivo, setObjetivo] = useState<Objetivo>('ventas')
  const [presupuesto, setPresupuesto] = useState(20000)
  const [dias, setDias] = useState<Dias>(7)
  const [elegida, setElegida] = useState(0)
  const [textoAnuncio, setTextoAnuncio] = useState('')
  const [editado, setEditado] = useState(false)
  const [corregido, setCorregido] = useState(false)
  const [tipeo, setTipeo] = useState<{ clave: string; n: number }>({ clave: '', n: 0 })
  const [pestana, setPestana] = useState<Pestana>('instagram')

  // Paso 2 · en vuelo
  const [campana, setCampana] = useState<Campana | null>(null)
  const [fase2, setFase2] = useState<Fase2>('publicando')
  const [pubPaso, setPubPaso] = useState(0)
  const [dia, setDia] = useState(0)
  const [corriendo, setCorriendo] = useState(true)
  const [rechazo, setRechazo] = useState<Rechazo>('ninguno')

  const producto = productoPorId(productoId)
  const ambos = google === 'conectado' && meta === 'conectado'

  // OAuth simulado: 900 ms y queda conectado.
  useEffect(() => {
    if (google !== 'conectando') return
    const t = setTimeout(() => setGoogle('conectado'), 900)
    return () => clearTimeout(t)
  }, [google])
  useEffect(() => {
    if (meta !== 'conectando') return
    const t = setTimeout(() => setMeta('conectado'), 900)
    return () => clearTimeout(t)
  }, [meta])
  // Checklist automática cuando están los dos.
  useEffect(() => {
    if (!ambos || checks >= 3) return
    const t = setTimeout(() => setChecks(c => c + 1), 550)
    return () => clearTimeout(t)
  }, [ambos, checks])

  // Orbi redacta: máquina de escribir sobre las tres variantes, en serie.
  const textos = useMemo(() => (producto ? variantes(producto, objetivo, corregido) : []), [producto, objetivo, corregido])
  const claveTipeo = producto ? `${producto.id}|${objetivo}|${corregido}` : ''
  const totalChars = useMemo(() => textos.reduce((s, t) => s + t.length, 0), [textos])
  const nTipeado = tipeo.clave === claveTipeo ? tipeo.n : 0
  const tipeoListo = nTipeado >= totalChars
  useEffect(() => {
    if (!claveTipeo || tipeoListo) return
    const id = setInterval(() => {
      setTipeo(t => {
        const prev = t.clave === claveTipeo ? t.n : 0
        return { clave: claveTipeo, n: Math.min(totalChars, prev + 3) }
      })
    }, 16)
    return () => clearInterval(id)
  }, [claveTipeo, tipeoListo, totalChars])
  function tramo(i: number): string {
    let off = 0
    for (let k = 0; k < i; k++) off += textos[k].length
    return textos[i].slice(0, Math.max(0, Math.min(textos[i].length, nTipeado - off)))
  }
  const indiceEscribiendo = (() => {
    let off = 0
    for (let i = 0; i < textos.length; i++) { off += textos[i].length; if (nTipeado < off) return i }
    return -1
  })()

  // Publicación: tres pasos de ~550 ms y arranca el vuelo.
  useEffect(() => {
    if (paso !== 2 || fase2 !== 'publicando') return
    const t = setTimeout(() => {
      if (pubPaso < PASOS_PUBLICACION.length) setPubPaso(p => p + 1)
      else setFase2('vuelo')
    }, 550)
    return () => clearTimeout(t)
  }, [paso, fase2, pubPaso])
  // Línea de tiempo: un día por segundo, pausable.
  const totalDias = campana?.dias ?? 7
  useEffect(() => {
    if (paso !== 2 || fase2 !== 'vuelo' || !corriendo || dia >= totalDias) return
    const t = setTimeout(() => setDia(d => d + 1), 1000)
    return () => clearTimeout(t)
  }, [paso, fase2, corriendo, dia, totalDias])
  // Rechazo: reenvío en 900 ms.
  useEffect(() => {
    if (rechazo !== 'arreglando') return
    const t = setTimeout(() => setRechazo('aprobado'), 900)
    return () => clearTimeout(t)
  }, [rechazo])

  // ─── Handlers ──────────────────────────────────────────────────────────────
  function elegirProducto(id: string) {
    const p = productoPorId(id)
    if (!p) return
    setProductoId(id)
    setElegida(0)
    setEditado(false)
    setTextoAnuncio(variantes(p, objetivo, corregido)[0])
  }
  function elegirObjetivo(o: Objetivo) {
    setObjetivo(o)
    setElegida(0)
    setEditado(false)
    if (producto) setTextoAnuncio(variantes(producto, o, corregido)[0])
  }
  function elegirVariante(i: number) {
    setElegida(i)
    setEditado(false)
    setTextoAnuncio(textos[i])
  }
  function lanzar() {
    if (!producto) return
    setCampana(simular(producto, presupuesto, dias, objetivo, textoAnuncio))
    setFase2('publicando'); setPubPaso(0); setDia(0); setCorriendo(true); setRechazo('ninguno')
    setPaso(2)
  }
  function arreglarRechazo() {
    const g = gritoDe(objetivo)
    setCorregido(true)
    setTextoAnuncio(t => t.replace(g.feo, g.lindo))
    setCampana(c => (c ? { ...c, texto: c.texto.replace(g.feo, g.lindo) } : c))
    setRechazo('arreglando')
  }
  function repetirConSugerencia() {
    if (!campana) return
    const s = sugerencia(campana)
    setProductoId(s.producto.id); setPresupuesto(s.presupuesto); setDias(7); setObjetivo('ventas')
    setElegida(0); setEditado(false); setTextoAnuncio(variantes(s.producto, 'ventas', corregido)[0])
    setCampana(null); setPaso(1); setPestana('instagram')
  }
  function reiniciar() {
    setPaso(0); setGoogle('idle'); setMeta('idle'); setChecks(0)
    setProductoId(null); setObjetivo('ventas'); setPresupuesto(20000); setDias(7)
    setElegida(0); setTextoAnuncio(''); setEditado(false); setCorregido(false); setTipeo({ clave: '', n: 0 }); setPestana('instagram')
    setCampana(null); setFase2('publicando'); setPubPaso(0); setDia(0); setCorriendo(true); setRechazo('ninguno')
  }

  // ─── Derivados ─────────────────────────────────────────────────────────────
  const est = useMemo(() => (producto ? estimar(producto, presupuesto, dias, objetivo) : null), [producto, presupuesto, dias, objetivo])
  const personasAnim = useConteo(est ? est.personas : 0, 500)

  const textoPreview = paso === 2 && campana ? campana.texto : editado ? textoAnuncio : (textos[elegida] ? tramo(elegida) : '')
  const productoPreview = paso === 2 && campana ? campana.producto : producto
  const objetivoPreview = paso === 2 && campana ? campana.objetivo : objetivo

  const actual: DiaSim | null = campana && dia > 0 ? campana.serie[Math.min(dia, campana.dias) - 1] : null
  const gastado = campana ? campana.serie.slice(0, dia).reduce((s, x) => s + x.google + x.meta, 0) : 0
  const ventasAcum = actual ? actual.ventasAcum : 0
  const retorno = gastado > 0 ? ventasAcum / gastado : 0
  const terminada = !!campana && fase2 === 'vuelo' && dia >= campana.dias
  const metaPct = actual ? actual.metaPct : 50
  const likes = 128 + (actual ? actual.visitasAcum * 4 : 0)

  const datosGrafico = useMemo<PuntoGrafico[]>(() => {
    if (!campana) return []
    return campana.serie.map((s, i) => (i < dia
      ? { dia: `Día ${s.dia}`, Google: s.google, Meta: s.meta, Ventas: s.ventasAcum }
      : { dia: `Día ${s.dia}`, Google: null, Meta: null, Ventas: null }))
  }, [campana, dia])
  const porDia = campana ? campana.presupuesto / campana.dias : 1
  const sug = campana ? sugerencia(campana) : null
  const g = gritoDe(objetivoPreview)

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', padding: '26px 28px 28px', minHeight: 600, fontFamily: FONT, color: C.text }}>
      <style>{CSS_PB}</style>

      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <Etiqueta color={ACENTO}>Catálogo · Promocionar</Etiqueta>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{NEGOCIO}</span>
            {google === 'conectado' && <Chip color={GOOGLE}><LogoGoogle size={13} /> {CUENTA_GOOGLE}</Chip>}
            {meta === 'conectado' && <Chip color={META}><LogoMeta size={13} /> Meta conectado</Chip>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Pasos actual={paso} />
          <Boton variante="fantasma" tam="sm" onClick={reiniciar}><RotateCcw size={13} /> Reiniciar</Boton>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 58fr) minmax(0, 42fr)', gap: 26, alignItems: 'start' }}>
        {/* ─── Panel del dueño ─── */}
        <div style={{ minWidth: 0 }}>

          {paso === 0 && (
            <div className="pr-fade-up">
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Conectá tus cuentas una sola vez</div>
                <div style={{ fontSize: 13.5, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>Después de esto nunca más entrás a Google Ads ni al Administrador de Anuncios: promocionás desde el catálogo y Orbi hace el resto.</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <TarjetaConexion logo={<LogoGoogle size={36} />} nombre="Google Ads" detalle="Shopping y Búsqueda, con tu Merchant Center." cuenta={CUENTA_GOOGLE} estado={google} onConectar={() => setGoogle('conectando')} />
                <TarjetaConexion logo={<LogoMeta size={36} />} nombre="Meta (Instagram + Facebook)" detalle="Feed, historias y reels, con tu catálogo." cuenta={CUENTA_META} estado={meta} onConectar={() => setMeta('conectando')} />
              </div>

              <Tarjeta style={{ marginTop: 12, padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <OrbiAvatar size={26} />
                  <div style={{ fontSize: 13.5, color: C.body }}>{ambos ? 'Listo, dejo todo preparado yo:' : 'Cuando conectes las dos, preparo todo solo:'}</div>
                </div>
                {[`Pixel instalado en la tienda (${DOMINIO})`, `Feed de ${PRODUCTOS_FEED} productos enviado a Merchant Center y al Catálogo de Meta`, `Público armado: ${entero(CLIENTES)} clientes y gente parecida`].map((t, i) => {
                  const hecho = checks > i
                  const activo = ambos && checks === i
                  return (
                    <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', fontSize: 13.5, color: hecho ? C.text : C.subtle, transition: 'color .3s' }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: hecho ? `${C.success}22` : 'rgba(148,163,184,.1)', border: `1px solid ${hecho ? `${C.success}66` : C.border}`, color: C.success, flexShrink: 0 }}>
                        {hecho ? <span className="pb-check" style={{ display: 'inline-flex' }}><Check size={12} strokeWidth={3} /></span> : activo ? <Spinner size={12} /> : null}
                      </span>
                      {t}
                    </div>
                  )
                })}
              </Tarjeta>

              <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 12, background: `${C.warning}12`, border: `1px solid ${C.warning}33`, fontSize: 12.5, color: C.body, lineHeight: 1.5 }}>
                <CreditCard size={15} color={C.warning} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>La tarjeta la cargás en tu cuenta de Google y de Meta: la pauta la pagás vos, directo a ellos. Órbita cobra solo la gestión.</span>
              </div>

              {checks >= 3 && (
                <div className="pr-fade-up" style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <Boton color={ACENTO} tam="lg" onClick={() => setPaso(1)} style={{ color: '#1F1105' }}>Ir a promocionar <ChevronRight size={16} /></Boton>
                </div>
              )}
            </div>
          )}

          {paso === 1 && (
            <div className="pr-fade-up">
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>Tu catálogo</div>
                <span style={{ fontSize: 12.5, color: C.subtle }}>{PRODUCTOS_FEED} productos · mostrando 4</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                {PRODUCTOS.map(p => {
                  const sel = p.id === productoId
                  return (
                    <div key={p.id} className="pb-prod" onClick={() => elegirProducto(p.id)} style={{ padding: 8, borderRadius: 16, background: C.surface, border: `1px solid ${sel ? ACENTO : C.border}`, boxShadow: sel ? `0 0 0 3px ${ACENTO}33, 0 14px 34px rgba(0,0,0,.35)` : 'none' }}>
                      <FotoProducto p={p} alto={86} size={50}>
                        {sel && <span className="pb-pop" style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%', background: ACENTO, color: '#1F1105', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} strokeWidth={3} /></span>}
                      </FotoProducto>
                      <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 8, lineHeight: 1.25, minHeight: 32 }}>{p.nombre}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                        <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.body }}>{formatoARS(p.precio)}</span>
                      </div>
                      <Boton variante={sel ? 'primario' : 'suave'} color={ACENTO} tam="sm" onClick={() => elegirProducto(p.id)} style={{ width: '100%', marginTop: 8, color: sel ? '#1F1105' : ACENTO }}><Megaphone size={12} /> {sel ? 'Elegido' : 'Promocionar'}</Boton>
                    </div>
                  )
                })}
              </div>

              {!producto && (
                <div className="pr-fade-in" style={{ marginTop: 14, padding: '18px 16px', textAlign: 'center', color: C.muted, fontSize: 13.5, border: `1px dashed ${C.border}`, borderRadius: 16 }}>
                  Tocá <b style={{ color: C.text }}>Promocionar</b> en un producto. Orbi arma el anuncio, elige el público y publica en Google y Meta a la vez.
                </div>
              )}

              {producto && est && (
                <Tarjeta className="pr-fade-up" style={{ marginTop: 14, padding: '16px 18px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 22px' }}>
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>Objetivo</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {OBJETIVOS.map(o => <ChipOpcion key={o.id} activo={objetivo === o.id} onClick={() => elegirObjetivo(o.id)}>{o.icono} {o.nombre}</ChipOpcion>)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>Días</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {DIAS_OPCIONES.map(d => <ChipOpcion key={d} activo={dias === d} onClick={() => setDias(d)}>{d} días</ChipOpcion>)}
                      </div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted }}>Presupuesto total</span>
                        <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 800, color: ACENTO, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{formatoARS(presupuesto)} <span style={{ fontSize: 12, color: C.subtle, fontWeight: 600, fontFamily: FONT }}>· {formatoARS(presupuesto / dias)} por día</span></span>
                      </div>
                      <input className="pb-range" type="range" min={5000} max={100000} step={1000} value={presupuesto} onChange={e => setPresupuesto(Number(e.target.value))} aria-label="Presupuesto total" />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.subtle, fontFamily: FONT_MONO, marginTop: 4 }}><span>$5.000</span><span>$100.000</span></div>
                    </div>
                  </div>

                  {/* Estimación viva */}
                  <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(59,130,246,.08), rgba(139,92,246,.1))', border: `1px solid ${C.orbi}33` }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <OrbiAvatar size={26} />
                      <div style={{ fontSize: 13.5, color: C.body, lineHeight: 1.5, flex: 1 }}>{fraseEstimacion(producto, presupuesto, dias, objetivo, est)}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                      <Estadistica etiqueta="Personas" valor={`≈ ${entero(personasAnim)}`} />
                      <Estadistica etiqueta="Visitas" valor={`${Math.round(est.visMin)} a ${Math.round(est.visMax)}`} />
                      {objetivo === 'seguidores'
                        ? <Estadistica etiqueta="Seguidores" valor={`${Math.round(est.segMin)} a ${Math.round(est.segMax)}`} color={C.orbiLight} />
                        : <Estadistica etiqueta="Ventas" valor={`${Math.round(est.venMin)} a ${Math.round(est.venMax)}`} color={VENTAS_COLOR} />}
                      {objetivo === 'seguidores'
                        ? <Estadistica etiqueta="Por seguidor" valor={`${formatoARS(presupuesto / est.segMax)} a ${formatoARS(presupuesto / est.segMin)}`} />
                        : <Estadistica etiqueta="Retorno est." valor={`${veces(est.retMin)} a ${veces(est.retMax)}`} color={ACENTO} />}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                      <Chip color={C.muted} style={{ fontWeight: 500 }}><Users size={11} /> Público: tus {entero(CLIENTES)} clientes y parecidos</Chip>
                      <Chip color={C.muted} style={{ fontWeight: 500 }}><Link2 size={11} /> Landing: {DOMINIO}/{producto.slug}</Chip>
                    </div>
                  </div>

                  {/* Variantes */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles size={12} color={C.orbiLight} /> Orbi redactó 3 anuncios · elegí uno</div>
                      {!tipeoListo && <span style={{ fontSize: 11.5, color: C.orbiLight, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Spinner size={11} color={C.orbiLight} /> escribiendo…</span>}
                    </div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {textos.map((t, i) => {
                        const sel = elegida === i
                        const parcial = tramo(i)
                        return (
                          <button key={`${claveTipeo}-${i}`} type="button" className="pb-var" onClick={() => elegirVariante(i)} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 12px', borderRadius: 12, background: sel ? `${ACENTO}14` : 'rgba(2,6,23,.35)', border: `1px solid ${sel ? `${ACENTO}77` : C.border}`, color: C.body, fontFamily: FONT, fontSize: 13, lineHeight: 1.45, minHeight: 40 }}>
                            <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, fontFamily: FONT_MONO, background: sel ? ACENTO : 'rgba(148,163,184,.15)', color: sel ? '#1F1105' : C.muted }}>{'ABC'[i]}</span>
                            <span style={{ flex: 1 }}>
                              {parcial}
                              {indiceEscribiendo === i && <span style={{ display: 'inline-block', width: 2, height: 13, background: C.orbiLight, marginLeft: 2, verticalAlign: 'middle', animation: 'pr-blink .8s step-end infinite' }} />}
                            </span>
                            {sel && <Check size={14} color={ACENTO} style={{ flexShrink: 0, marginTop: 2 }} />}
                          </button>
                        )
                      })}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: C.subtle, marginBottom: 5 }}><Pencil size={11} /> Podés retocar el texto elegido{editado && <span style={{ color: ACENTO }}>· editado</span>}</div>
                      <textarea className="pr-input pb-textarea" value={textoAnuncio} onChange={e => { setTextoAnuncio(e.target.value); setEditado(true) }} aria-label="Texto del anuncio" />
                    </div>
                  </div>

                  <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 12.5, color: C.subtle, display: 'flex', alignItems: 'center', gap: 6 }}><ShieldCheck size={13} color={C.success} /> Se publica con la foto y el precio del catálogo. Podés frenar cuando quieras.</div>
                    <Boton color={ACENTO} tam="lg" onClick={lanzar} disabled={!textoAnuncio.trim()} style={{ color: '#1F1105', animation: 'pb-glow 2.2s ease-in-out infinite' }}>
                      <Rocket size={17} /> Lanzar en Google y Meta
                    </Boton>
                  </div>
                </Tarjeta>
              )}
            </div>
          )}

          {paso === 2 && campana && (
            <div className="pr-fade-up">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}><FotoProducto p={campana.producto} alto={40} size={24} radio={10} /></div>
                  <div>
                    <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>{campana.producto.nombre}</div>
                    <div style={{ fontSize: 12.5, color: C.muted }}>{formatoARS(campana.presupuesto)} · {campana.dias} días · objetivo {OBJETIVOS.find(o => o.id === campana.objetivo)?.nombre.toLowerCase()}</div>
                  </div>
                </div>
                {fase2 === 'vuelo' && (
                  <Chip color={terminada ? C.success : ACENTO}>
                    {terminada ? <Check size={12} strokeWidth={3} /> : <span style={{ width: 7, height: 7, borderRadius: '50%', background: ACENTO, animation: 'pb-live 1.2s ease-in-out infinite' }} />}
                    {terminada ? 'Campaña terminada' : corriendo ? 'En vuelo' : 'En pausa'}
                  </Chip>
                )}
              </div>

              {fase2 === 'publicando' && (
                <Tarjeta className="pr-fade-in" style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <OrbiAvatar size={28} />
                    <div style={{ fontSize: 14, color: C.body }}>Publicando en los dos lados a la vez…</div>
                  </div>
                  {PASOS_PUBLICACION.map((t, i) => {
                    const hecho = pubPaso > i
                    const activo = pubPaso === i
                    return (
                      <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', fontSize: 13.5, color: hecho ? C.text : activo ? C.body : C.subtle }}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: hecho ? `${C.success}22` : 'rgba(148,163,184,.1)', color: C.success, flexShrink: 0 }}>
                          {hecho ? <span className="pb-check" style={{ display: 'inline-flex' }}><Check size={12} strokeWidth={3} /></span> : activo ? <Spinner size={12} /> : null}
                        </span>
                        {t}
                      </div>
                    )
                  })}
                </Tarjeta>
              )}

              {fase2 === 'vuelo' && (
                <>
                  {/* Línea de tiempo */}
                  <Tarjeta style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <button type="button" className="pr-btn" onClick={() => setCorriendo(c => !c)} disabled={terminada} aria-label={corriendo ? 'Pausar' : 'Reanudar'} style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${ACENTO}66`, background: `${ACENTO}1F`, color: ACENTO, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {corriendo && !terminada ? <Pause size={15} /> : <Play size={15} />}
                    </button>
                    <div style={{ flex: 1, position: 'relative', height: 34, minWidth: 0 }}>
                      <div style={{ position: 'absolute', left: 6, right: 6, top: 8, height: 2, background: 'rgba(148,163,184,.18)', borderRadius: 2 }} />
                      <div style={{ position: 'absolute', left: 6, top: 8, height: 2, width: `calc((100% - 12px) * ${Math.max(0, dia - 1) / Math.max(1, campana.dias - 1)})`, background: `linear-gradient(90deg, ${ACENTO}, ${C.orbi})`, borderRadius: 2, transition: 'width .6s cubic-bezier(.2,.8,.2,1)' }} />
                      {campana.serie.map((s, i) => {
                        const hecho = dia > s.dia
                        const activo = dia === s.dia
                        return (
                          <div key={s.dia} style={{ position: 'absolute', left: `calc(6px + (100% - 12px) * ${i / Math.max(1, campana.dias - 1)})`, top: 0, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: activo ? 18 : 12, height: activo ? 18 : 12, marginTop: activo ? 0 : 3, borderRadius: '50%', background: hecho ? ACENTO : activo ? C.text : C.bg2, border: `2px solid ${hecho || activo ? ACENTO : C.borderStrong}`, boxShadow: activo ? `0 0 0 4px ${ACENTO}33` : 'none', transition: 'all .3s' }} />
                            <span style={{ fontSize: 10, fontFamily: FONT_MONO, color: activo ? C.text : hecho ? C.body : C.subtle }}>{s.dia}</span>
                          </div>
                        )
                      })}
                    </div>
                    <Chip color={C.muted} style={{ fontFamily: FONT_MONO, fontWeight: 600 }}>Día {dia} / {campana.dias}</Chip>
                  </Tarjeta>

                  {/* Contadores */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                    <Kpi etiqueta="Gastado" valor={gastado} formato={formatoARS} icono={<CreditCard size={11} />} />
                    <Kpi etiqueta="Ventas" valor={ventasAcum} formato={formatoARS} color={VENTAS_COLOR} retardo={40} icono={<ShoppingBag size={11} />} />
                    <Kpi etiqueta="Retorno" valor={retorno} formato={veces} color={ACENTO} retardo={80} icono={<TrendingUp size={11} />} />
                    <Kpi etiqueta="Visitas" valor={actual ? actual.visitasAcum : 0} formato={entero} retardo={120} icono={<Eye size={11} />} />
                    {campana.objetivo === 'seguidores'
                      ? <Kpi etiqueta="Seguidores" valor={actual ? actual.seguidoresAcum : 0} formato={entero} color={C.orbiLight} retardo={160} icono={<Users size={11} />} />
                      : <Kpi etiqueta="Pedidos" valor={actual ? actual.pedidosAcum : 0} formato={entero} retardo={160} icono={<Zap size={11} />} />}
                  </div>

                  {/* Gráfico + reparto/log */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: 10, marginTop: 10 }}>
                    <Tarjeta style={{ padding: '12px 10px 6px 4px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 8px 6px 14px', fontSize: 11.5, color: C.muted }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: GOOGLE }} /> Gasto Google</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: META }} /> Gasto Meta</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 2, background: VENTAS_COLOR }} /> Ventas acumuladas</span>
                      </div>
                      <div style={{ width: '100%' }}>
                        <ResponsiveContainer width="100%" height={200}>
                          <ComposedChart data={datosGrafico} margin={{ top: 8, right: 6, bottom: 0, left: 0 }} barCategoryGap="30%">
                            <CartesianGrid stroke="rgba(148,163,184,.1)" vertical={false} />
                            <XAxis dataKey="dia" tick={{ fill: C.subtle, fontSize: 10.5, fontFamily: FONT }} axisLine={{ stroke: C.border }} tickLine={false} interval={campana.dias > 7 ? 1 : 0} />
                            <YAxis yAxisId="gasto" domain={[0, Math.ceil((porDia * 1.15) / 500) * 500]} tickFormatter={compacto} tick={{ fill: C.subtle, fontSize: 10.5, fontFamily: FONT_MONO }} axisLine={false} tickLine={false} width={52} />
                            <YAxis yAxisId="ventas" orientation="right" domain={[0, Math.ceil((campana.est.total * 1.05) / 5000) * 5000]} tickFormatter={compacto} tick={{ fill: VENTAS_COLOR, fontSize: 10.5, fontFamily: FONT_MONO }} axisLine={false} tickLine={false} width={56} />
                            <Tooltip content={<TooltipCampana />} cursor={{ fill: 'rgba(148,163,184,.06)' }} />
                            <Bar yAxisId="gasto" dataKey="Google" stackId="g" fill={GOOGLE} isAnimationActive animationDuration={450} />
                            <Bar yAxisId="gasto" dataKey="Meta" stackId="g" fill={META} radius={[5, 5, 0, 0]} isAnimationActive animationDuration={450} />
                            <Line yAxisId="ventas" type="monotone" dataKey="Ventas" stroke={VENTAS_COLOR} strokeWidth={2.4} dot={{ r: 3, fill: VENTAS_COLOR, stroke: 'none' }} activeDot={{ r: 5, fill: VENTAS_COLOR, stroke: C.bg, strokeWidth: 2 }} isAnimationActive animationDuration={450} connectNulls={false} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </Tarjeta>

                    <Tarjeta style={{ padding: '12px 14px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted }}>Reparto del presupuesto</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700, marginTop: 8 }}>
                        <span style={{ color: GOOGLE, display: 'inline-flex', alignItems: 'center', gap: 6 }}><LogoGoogle size={14} /> Google {100 - metaPct}%</span>
                        <span style={{ color: META, display: 'inline-flex', alignItems: 'center', gap: 6 }}>Meta {metaPct}% <LogoMeta size={14} /></span>
                      </div>
                      <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', marginTop: 6, background: 'rgba(148,163,184,.12)' }}>
                        <span style={{ width: `${100 - metaPct}%`, background: GOOGLE, transition: 'width .7s cubic-bezier(.2,.8,.2,1)' }} />
                        <span style={{ flex: 1, background: META, transition: 'width .7s cubic-bezier(.2,.8,.2,1)' }} />
                      </div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted, marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}><OrbiAvatar size={16} /> Decisiones de Orbi</div>
                      <div className="pr-scroll" style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 132, overflowY: 'auto', fontFamily: FONT_MONO, fontSize: 11.5, lineHeight: 1.4 }}>
                        {dia === 0 && <div style={{ color: C.subtle }}>esperando el primer día…</div>}
                        {campana.serie.slice(0, dia).map((s, i) => (
                          <div key={s.dia} className={i === dia - 1 ? 'pb-slide-in' : undefined} style={{ display: 'flex', gap: 8, color: i === dia - 1 ? C.orbiLight : `${C.orbiLight}99` }}>
                            <span style={{ color: C.subtle, flexShrink: 0 }}>d{s.dia}</span>
                            <span>{s.decision}</span>
                          </div>
                        ))}
                        {rechazo === 'aprobado' && (
                          <div className="pb-slide-in" style={{ display: 'flex', gap: 8, color: C.success }}>
                            <span style={{ color: C.subtle, flexShrink: 0 }}>d{Math.max(1, dia)}</span>
                            <span>Variante B corregida y aprobada por Meta.</span>
                          </div>
                        )}
                      </div>
                    </Tarjeta>
                  </div>

                  {/* Incidencias: rechazo simulable */}
                  <div style={{ marginTop: 10 }}>
                    {rechazo === 'ninguno' && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 14px', borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 12.5, color: C.muted }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={14} color={C.success} /> Sin incidencias: los 3 anuncios aprobados en Google y Meta.</span>
                        <Boton variante="fantasma" tam="sm" onClick={() => setRechazo('rechazado')}><TriangleAlert size={12} /> Simular un rechazo</Boton>
                      </div>
                    )}
                    {rechazo !== 'ninguno' && (
                      <Tarjeta className="pb-pop" style={{ padding: '14px 16px', borderColor: rechazo === 'aprobado' ? `${C.success}55` : `${C.error}55`, background: rechazo === 'aprobado' ? `${C.success}0D` : `${C.error}0D` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <LogoMeta size={22} />
                          <span style={{ fontWeight: 700, fontSize: 13.5, color: rechazo === 'aprobado' ? C.success : C.error }}>
                            {rechazo === 'aprobado' ? 'Anuncio B aprobado de nuevo' : 'Meta rechazó el anuncio B'}
                          </span>
                          <Chip color={rechazo === 'aprobado' ? C.success : C.error} style={{ fontWeight: 600 }}>{rechazo === 'aprobado' ? 'resuelto en 1 toque' : 'política: texto con mayúsculas excesivas'}</Chip>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 10 }}>
                          <OrbiAvatar size={26} />
                          <div style={{ fontSize: 13.5, color: C.body, lineHeight: 1.5, flex: 1 }}>
                            {rechazo === 'aprobado'
                              ? <>Listo: lo reenvié con &ldquo;{g.lindo}&rdquo; y Meta lo aprobó. Los tres anuncios corren de nuevo y no perdiste presupuesto.</>
                              : <>Meta no deja gritar: &ldquo;{g.feo}&rdquo; en mayúsculas les parece spam. Lo paso a &ldquo;{g.lindo}&rdquo; y lo reenvío; suelen aprobarlo en menos de una hora. Mientras tanto A y C siguen corriendo, no perdiste nada.</>}
                          </div>
                          {rechazo === 'rechazado' && <Boton color={ACENTO} tam="sm" onClick={arreglarRechazo} style={{ color: '#1F1105', flexShrink: 0 }}><Wand size={13} /> Arreglar y reenviar</Boton>}
                          {rechazo === 'arreglando' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: C.body, flexShrink: 0 }}><Spinner size={13} /> Reenviando a Meta…</span>}
                        </div>
                      </Tarjeta>
                    )}
                  </div>

                  {/* Cierre */}
                  {terminada && sug && (
                    <Tarjeta className="pr-fade-up" style={{ marginTop: 12, padding: '18px 20px', border: `1px solid ${VENTAS_COLOR}55`, background: `linear-gradient(135deg, ${VENTAS_COLOR}12, ${C.orbi}12)` }}>
                      <Etiqueta color={VENTAS_COLOR}>Reporte en pesos</Etiqueta>
                      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 6, lineHeight: 1.2 }}>
                        Gastaste <span style={{ color: C.text }}>{formatoARS(campana.presupuesto)}</span> y vendiste <span style={{ color: VENTAS_COLOR }}>{formatoARS(ventasAcum)}</span> <span style={{ color: ACENTO }}>({veces(retorno)})</span>
                      </div>
                      <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
                        {entero(actual?.pedidosAcum ?? 0)} pedidos · {entero(actual?.visitasAcum ?? 0)} visitas · {entero(actual?.personasAcum ?? 0)} personas alcanzadas · costo por venta {formatoARS(campana.presupuesto / Math.max(1, actual?.pedidosAcum ?? 1))}
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 14, padding: '12px 14px', borderRadius: 14, background: 'rgba(2,6,23,.45)', border: `1px solid ${C.orbi}33` }}>
                        <OrbiAvatar size={28} />
                        <div style={{ flex: 1, fontSize: 13.5, color: C.body, lineHeight: 1.5 }}>
                          Para la próxima: el <b style={{ color: C.text }}>{sug.producto.nombre}</b> tuvo el mejor costo por venta de tu tienda esta semana (la gente que entró por el anuncio también se lo llevó). Promocionalo con <b style={{ color: ACENTO }}>{formatoARS(sug.presupuesto)}</b> la semana que viene, 7 días, objetivo ventas.
                        </div>
                        <Boton color={C.orbi} onClick={repetirConSugerencia} style={{ flexShrink: 0 }}><Repeat size={14} /> Repetir con la sugerencia</Boton>
                      </div>
                    </Tarjeta>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ─── Lo que ve la gente ─── */}
        <div style={{ minWidth: 0, position: 'sticky', top: 16 }}>
          <Celular
            pestana={pestana}
            setPestana={setPestana}
            producto={productoPreview}
            texto={textoPreview}
            objetivo={objetivoPreview}
            likes={likes}
            enVuelo={paso === 2 && campana && fase2 === 'vuelo' && dia > 0 ? { dia: Math.min(dia, campana.dias), total: campana.dias, vistas: actual ? actual.personasAcum : 0 } : null}
          />
        </div>
      </div>
    </div>
  )
}
