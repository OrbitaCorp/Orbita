// src/modules/propuestas/prototipos/PrecioCongelado.tsx — Prototipo #4
// "Precio Congelado": el cliente clava un precio 72 hs con una seña del 10%
// mientras el dueño programa la suba de lista. La línea de tiempo de abajo
// es EL control: mueve precios, cuentas regresivas y métricas de las dos
// pantallas a la vez.
//
// DEMO INTERNA — autocontenido: sin fetch, sin storage, sin imágenes.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent as PointerEventReact } from 'react'
import { Snowflake, CalendarClock, Users, Coins, Target, ShoppingBag, RotateCcw, Play, Pause, ChevronRight, Lightbulb, Clock, Check, X, ArrowRight, History, Bell, Lock, FastForward } from 'lucide-react'
import { C, FONT, FONT_DISPLAY, FONT_MONO, Tarjeta, Chip, Boton, Etiqueta, Pantalla, formatoARS } from '../ui'

// ─── Constantes ──────────────────────────────────────────────────────────────

const HIELO = '#7DD3FC'
const HIELO_TEXTO = '#0369A1'
const HIELO_FONDO = '#E0F2FE'
const ACENTO = '#A78BFA'
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
/** Todo el tiempo se mide en horas desde el Lun 1 a las 00:00. */
const T0 = 18.5 // Lun 1, 18:30 — "ahora" al arrancar
const TMAX = 166 // Dom 7, 22:00
const HORAS_SEMANA = 168
const DURACION = 72
const PORC_SENA = 0.1
const CLIENTA = 'Sofía Ramírez'

const CSS = `
  @keyframes pc-congelar { from { opacity: 0; transform: scale(1.03); filter: blur(8px); } to { opacity: 1; transform: none; filter: blur(0); } }
  @keyframes pc-brillo { 0% { transform: translateX(-140%) skewX(-18deg); } 100% { transform: translateX(260%) skewX(-18deg); } }
  @keyframes pc-flash { 0% { background: rgba(251,191,36,.38); } 100% { background: transparent; } }
  @keyframes pc-toast { 0% { opacity: 0; transform: translateY(-8px) scale(.98); } 10% { opacity: 1; transform: none; } 85% { opacity: 1; } 100% { opacity: 0; } }
  @keyframes pc-latido { 0%, 100% { box-shadow: 0 0 0 0 rgba(125,211,252,.55); } 50% { box-shadow: 0 0 0 8px rgba(125,211,252,0); } }
  @keyframes pc-derretir { from { opacity: 1; } to { opacity: .35; } }
  .pc-rango { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 99px; outline: none; cursor: pointer; }
  .pc-rango::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #fff; border: 3px solid ${ACENTO}; box-shadow: 0 2px 8px rgba(0,0,0,.2); cursor: grab; }
  .pc-rango::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #fff; border: 3px solid ${ACENTO}; cursor: grab; }
  .pc-fila { transition: background .35s; }
  .pc-aplicado { animation: pc-flash 1.4s ease both; }
  .pc-tab { cursor: pointer; border: 0; background: transparent; font: inherit; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 0; flex: 1; }
  .pc-chip-dia { cursor: pointer; border: 1px solid #E2E8F0; background: #fff; font: inherit; font-weight: 700; font-size: 12px; padding: 5px 0; border-radius: 8px; color: #475569; transition: all .15s; }
  .pc-chip-dia:hover { border-color: ${ACENTO}; color: #6D28D9; }
  .pc-chip-dia[data-activo="1"] { background: ${ACENTO}; border-color: ${ACENTO}; color: #fff; }
  .pc-chip-dia:disabled { opacity: .35; cursor: not-allowed; }
`

// ─── Tipos y datos ──────────────────────────────────────────────────────────

interface Producto { id: string; nombre: string; detalle: string; base: number; emoji: string; fondo: string; hist: { dia: number; precio: number }[] }
type Estado = 'activo' | 'comprado' | 'vencido'
interface Congelamiento { id: string; cliente: string; productoId: string; precio: number; desde: number; comprado?: number; mio?: boolean }
interface CompraDirecta { productoId: string; precio: number; t: number }
interface Trayecto extends Congelamiento { estado: Estado }

const PRODUCTOS: Producto[] = [
  { id: 'botas', nombre: 'Botas Patagonia cuero', detalle: 'Talle 38 · Marrón', base: 89000, emoji: '🥾', fondo: 'linear-gradient(135deg, #78350F, #B45309 60%, #D97706)', hist: [{ dia: -90, precio: 69900 }, { dia: -62, precio: 74900 }, { dia: -35, precio: 79900 }, { dia: -14, precio: 84500 }, { dia: -3, precio: 89000 }] },
  { id: 'zapatillas', nombre: 'Zapatillas urbanas', detalle: 'Talle 38 · Blancas', base: 62000, emoji: '👟', fondo: 'linear-gradient(135deg, #1E3A8A, #3B82F6 60%, #60A5FA)', hist: [{ dia: -90, precio: 48900 }, { dia: -58, precio: 52900 }, { dia: -30, precio: 56900 }, { dia: -12, precio: 59900 }, { dia: -3, precio: 62000 }] },
  { id: 'mocasines', nombre: 'Mocasines Nápoli', detalle: 'Talle 41 · Negro', base: 74500, emoji: '👞', fondo: 'linear-gradient(135deg, #0F172A, #334155)', hist: [{ dia: -90, precio: 59900 }, { dia: -45, precio: 66900 }, { dia: -10, precio: 74500 }] },
  { id: 'sandalias', nombre: 'Sandalias Verano', detalle: 'Talle 37 · Camel', base: 38900, emoji: '👡', fondo: 'linear-gradient(135deg, #9A3412, #F97316)', hist: [{ dia: -90, precio: 31900 }, { dia: -40, precio: 35900 }, { dia: -8, precio: 38900 }] },
  { id: 'borcegos', nombre: 'Borcegos Trekking', detalle: 'Talle 42 · Negro', base: 112000, emoji: '🥾', fondo: 'linear-gradient(135deg, #14532D, #16A34A)', hist: [{ dia: -90, precio: 89900 }, { dia: -50, precio: 99900 }, { dia: -20, precio: 112000 }] },
]

/** Congelamientos de otros clientes, repartidos en la semana para que la historia tenga vida. */
const SEMILLA: Congelamiento[] = [
  { id: 's1', cliente: 'Martín Acosta', productoId: 'mocasines', precio: 74500, desde: 10.25, comprado: 68 },
  { id: 's2', cliente: 'Valentina Ríos', productoId: 'borcegos', precio: 112000, desde: 12.67 },
  { id: 's3', cliente: 'Julián Paz', productoId: 'sandalias', precio: 38900, desde: 16.08, comprado: 35 },
  { id: 's4', cliente: 'Camila Sosa', productoId: 'zapatillas', precio: 62000, desde: 17.83 },
  { id: 's5', cliente: 'Lucas Ferreyra', productoId: 'borcegos', precio: 112000, desde: 33.5, comprado: 104 },
  { id: 's6', cliente: 'Agustina Molina', productoId: 'botas', precio: 89000, desde: 62, comprado: 130 },
  { id: 's7', cliente: 'Nico Bravo', productoId: 'zapatillas', precio: 66960, desde: 110 },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
/** Redondea a cuartos de hora para que los relojes no muestren minutos raros. */
const ajustar = (h: number) => Math.round(h * 4) / 4
const pad = (n: number) => String(n).padStart(2, '0')

function fmtTiempo(h: number): string {
  if (h >= HORAS_SEMANA) return 'la semana que viene'
  const d = Math.min(6, Math.floor(h / 24))
  const resto = h - d * 24
  const hh = Math.floor(resto)
  const mm = Math.round((resto - hh) * 60)
  return `${DIAS[d]} ${d + 1}, ${pad(hh)}:${pad(mm)}`
}

function fmtRestante(h: number): string {
  if (h <= 0) return 'vencido'
  const d = Math.floor(h / 24)
  const hh = Math.floor(h % 24)
  const mm = Math.round((h % 1) * 60)
  if (d > 0) return `${d} d ${hh} h`
  if (hh > 0) return `${hh} h ${pad(mm)} min`
  return `${mm} min`
}

const iniciales = (n: string) => n.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()

function estadoDe(c: Congelamiento, t: number): Estado {
  if (c.comprado !== undefined && t >= c.comprado) return 'comprado'
  if (t >= c.desde + DURACION) return 'vencido'
  return 'activo'
}

const productoDe = (id: string) => PRODUCTOS.find(p => p.id === id) ?? PRODUCTOS[0]

// ─── Piezas chicas ───────────────────────────────────────────────────────────

/** Número que interpola suavemente entre valores (para precios y métricas). */
function NumeroAnimado({ valor, formato = formatoARS, style }: { valor: number; formato?: (n: number) => string; style?: CSSProperties }) {
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

/** Copo de nieve SVG, seis brazos. */
function Copo({ style }: { style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={HIELO} strokeWidth="1.6" strokeLinecap="round" style={style} aria-hidden>
      {[0, 60, 120].map(a => (
        <g key={a} transform={`rotate(${a} 12 12)`}>
          <line x1="12" y1="2" x2="12" y2="22" />
          <path d="M12 5.5l-2.4 2.4M12 5.5l2.4 2.4M12 18.5l-2.4-2.4M12 18.5l2.4-2.4" />
        </g>
      ))}
    </svg>
  )
}

/** Capa de escarcha sobre la tarjeta del precio: borde celeste, cristales y brillo. */
function Escarcha({ derretida = false }: { derretida?: boolean }) {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none', overflow: 'hidden', animation: derretida ? 'pc-derretir .6s ease both' : 'pc-congelar .7s cubic-bezier(.2,.8,.2,1) both', border: `2px solid ${derretida ? '#CBD5E1' : HIELO}`, boxShadow: derretida ? 'none' : `0 0 0 4px rgba(125,211,252,.16), inset 0 0 44px rgba(186,230,253,.6)`, background: 'linear-gradient(160deg, rgba(224,242,254,.85), rgba(186,230,253,.25) 45%, rgba(224,242,254,.8))' }}>
      {!derretida && <div style={{ position: 'absolute', top: 0, bottom: 0, width: '35%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.75), transparent)', animation: 'pc-brillo 3.2s ease-in-out .6s infinite' }} />}
      <Copo style={{ position: 'absolute', top: 6, left: 8, width: 22, height: 22, opacity: .85, animation: 'pr-twinkle 3s ease-in-out infinite' }} />
      <Copo style={{ position: 'absolute', top: 10, right: 12, width: 14, height: 14, opacity: .7, animation: 'pr-twinkle 4s ease-in-out .8s infinite' }} />
      <Copo style={{ position: 'absolute', bottom: 8, right: 30, width: 30, height: 30, opacity: .6, animation: 'pr-twinkle 3.6s ease-in-out .3s infinite' }} />
      <Copo style={{ position: 'absolute', bottom: 12, left: 40, width: 12, height: 12, opacity: .6, animation: 'pr-twinkle 2.8s ease-in-out 1.2s infinite' }} />
    </div>
  )
}

/** Mini gráfico de la historia de precio (escalones) con proyección a la lista nueva. */
function GraficoHistoria({ puntos, futuro, hoyDia, aplicada }: { puntos: { dia: number; precio: number }[]; futuro: { dia: number; precio: number }; hoyDia: number; aplicada: boolean }) {
  const W = 300, H = 84, L = 8, R = 8, T = 12, B = 18
  const xMin = -90, xMax = 8
  const precios = [...puntos.map(p => p.precio), futuro.precio]
  const yMin = Math.min(...precios) * 0.96, yMax = Math.max(...precios) * 1.03
  const x = (d: number) => L + ((d - xMin) / (xMax - xMin)) * (W - L - R)
  const y = (p: number) => T + (1 - (p - yMin) / (yMax - yMin)) * (H - T - B)
  const serie = aplicada ? [...puntos, futuro] : puntos
  const ultimo = serie[serie.length - 1] ?? puntos[0] ?? futuro
  let d = ''
  serie.forEach((p, i) => {
    if (i === 0) d += `M ${x(p.dia)} ${y(p.precio)}`
    else d += ` H ${x(p.dia)} V ${y(p.precio)}`
  })
  d += ` H ${x(Math.max(ultimo.dia, hoyDia))}`
  const proy = `M ${x(hoyDia)} ${y(ultimo.precio)} H ${x(futuro.dia)} V ${y(futuro.precio)}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} aria-hidden>
      <defs>
        <linearGradient id="pc-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={ACENTO} stopOpacity=".22" /><stop offset="1" stopColor={ACENTO} stopOpacity="0" /></linearGradient>
      </defs>
      <path d={`${d} V ${H - B} H ${x(puntos[0]?.dia ?? xMin)} Z`} fill="url(#pc-area)" />
      <path d={d} fill="none" stroke={ACENTO} strokeWidth="2" strokeLinejoin="round" />
      {!aplicada && <path d={proy} fill="none" stroke={C.warning} strokeWidth="1.6" strokeDasharray="3 3" />}
      <line x1={x(hoyDia)} x2={x(hoyDia)} y1={T - 4} y2={H - B + 2} stroke="#94A3B8" strokeDasharray="2 3" strokeWidth="1" />
      {puntos.map(p => <circle key={p.dia} cx={x(p.dia)} cy={y(p.precio)} r="3" fill="#fff" stroke={ACENTO} strokeWidth="2" />)}
      <circle cx={x(futuro.dia)} cy={y(futuro.precio)} r="3.4" fill={aplicada ? C.warning : '#fff'} stroke={C.warning} strokeWidth="2" strokeDasharray={aplicada ? undefined : '2 2'} />
      <text x={x(hoyDia)} y={H - 5} textAnchor="middle" fontSize="9" fill="#64748B" fontFamily={FONT}>hoy</text>
      <text x={x(xMin)} y={H - 5} textAnchor="start" fontSize="9" fill="#94A3B8" fontFamily={FONT}>hace 90 días</text>
      <text x={x(futuro.dia)} y={y(futuro.precio) - 7} textAnchor="end" fontSize="9" fontWeight="700" fill="#B45309" fontFamily={FONT}>{formatoARS(futuro.precio)}</text>
    </svg>
  )
}

function Metrica({ icono, etiqueta, valor, sub, color }: { icono: ReactNode; etiqueta: string; valor: ReactNode; sub: string; color: string }) {
  return (
    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14, padding: '12px 14px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        <span style={{ color }}>{icono}</span>{etiqueta}
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: '#0F172A', marginTop: 4, lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
    </div>
  )
}

function ChipEstado({ estado, protegido }: { estado: Estado; protegido: boolean }) {
  if (estado === 'comprado') return <Chip color="#059669"><Check size={12} />compró</Chip>
  if (estado === 'vencido') return <Chip color="#DC2626"><X size={12} />venció</Chip>
  if (protegido) return <Chip color={HIELO_TEXTO} style={{ animation: 'pc-latido 2.2s ease-in-out infinite' }}><Snowflake size={12} />protegido</Chip>
  return <Chip color="#6D28D9"><Clock size={12} />activo</Chip>
}

// ─── Línea de tiempo (el control principal) ──────────────────────────────────

const X0 = 40, X1 = 960, Y0 = 96, YC = 30, Y_CARRIL = 134
const xDe = (h: number) => X0 + (h / HORAS_SEMANA) * (X1 - X0)
const yDe = (h: number) => { const u = h / HORAS_SEMANA; return (1 - u) * (1 - u) * Y0 + 2 * (1 - u) * u * YC + u * u * Y0 }
const RUTA = `M ${X0} ${Y0} Q ${(X0 + X1) / 2} ${YC} ${X1} ${Y0}`

function LineaTiempo({ t, tLista, pct, aplicada, trayectos, onArrastrar }: { t: number; tLista: number; pct: number; aplicada: boolean; trayectos: Trayecto[]; onArrastrar: (h: number) => void }) {
  const svgRef = useRef<SVGSVGElement>(null)

  const filas = useMemo(() => {
    const carriles: number[] = []
    return [...trayectos].sort((a, b) => a.desde - b.desde).map(tr => {
      const fin = tr.estado === 'comprado' && tr.comprado !== undefined ? tr.comprado : tr.desde + DURACION
      let i = carriles.findIndex(f => f <= tr.desde)
      if (i < 0) { i = carriles.length; carriles.push(0) }
      carriles[i] = fin + 3
      return { ...tr, fin, carril: i }
    })
  }, [trayectos])
  const nCarriles = Math.max(2, filas.reduce((m, f) => Math.max(m, f.carril + 1), 0))
  const alto = Y_CARRIL + nCarriles * 10 + 4

  const desdeEvento = (e: PointerEventReact<SVGSVGElement>) => {
    const el = svgRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const xv = ((e.clientX - r.left) / r.width) * 1000
    onArrastrar(((xv - X0) / (X1 - X0)) * HORAS_SEMANA)
  }

  const xp = xDe(t), yp = yDe(t)
  const xe = xDe(tLista), ye = yDe(tLista)
  const xEtq = clamp(xe, X0 + 62, X1 - 62)
  const xPl = clamp(xp, X0 + 56, X1 - 56)
  const colorEvento = aplicada ? C.success : C.warning

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 1000 ${alto}`}
      style={{ width: '100%', height: 'auto', display: 'block', cursor: 'ew-resize', touchAction: 'none', userSelect: 'none', fontFamily: FONT }}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); desdeEvento(e) }}
      onPointerMove={e => { if (e.buttons & 1) desdeEvento(e) }}
      role="slider"
      aria-label="Línea de tiempo de la semana"
      aria-valuemin={T0}
      aria-valuemax={TMAX}
      aria-valuenow={t}
      aria-valuetext={fmtTiempo(t)}
    >
      <defs>
        <linearGradient id="pc-grad-arco" x1="0" x2="1"><stop offset="0" stopColor={C.primary} /><stop offset="1" stopColor={ACENTO} /></linearGradient>
        <radialGradient id="pc-grad-planeta" cx=".35" cy=".3" r=".85"><stop offset="0" stopColor="#DDD6FE" /><stop offset=".45" stopColor="#8B5CF6" /><stop offset="1" stopColor="#1D4ED8" /></radialGradient>
        <filter id="pc-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      {/* Días alternados */}
      {DIAS.map((_, d) => d % 2 === 0 ? <rect key={d} x={xDe(d * 24)} y={0} width={xDe(24) - xDe(0)} height={alto} fill="rgba(148,163,184,.05)" rx={6} /> : null)}
      {/* Pasado (antes de T0) */}
      <rect x={xDe(0)} y={0} width={xDe(T0) - xDe(0)} height={alto} fill="rgba(2,6,23,.35)" rx={6} />

      {/* Órbita base + recorrido */}
      <path d={RUTA} stroke="rgba(148,163,184,.25)" strokeWidth={2} fill="none" strokeDasharray="4 7" />
      <path d={RUTA} stroke="url(#pc-grad-arco)" strokeWidth={3.5} fill="none" pathLength={HORAS_SEMANA} strokeDasharray={`${Math.max(0, t - T0)} ${HORAS_SEMANA}`} strokeDashoffset={-T0} strokeLinecap="round" style={{ filter: 'url(#pc-glow)' }} />

      {/* Ticks y nombres de día */}
      {DIAS.map((nombre, d) => (
        <g key={nombre}>
          <circle cx={xDe(d * 24)} cy={yDe(d * 24)} r={3} fill={C.bg} stroke={t >= d * 24 ? ACENTO : 'rgba(148,163,184,.5)'} strokeWidth={1.5} />
          <text x={xDe(d * 24 + 12)} y={Y0 + 22} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={Math.floor(t / 24) === d ? C.text : 'rgba(148,163,184,.75)'}>{nombre} {d + 1}</text>
        </g>
      ))}
      <circle cx={xDe(HORAS_SEMANA)} cy={yDe(HORAS_SEMANA)} r={3} fill={C.bg} stroke="rgba(148,163,184,.5)" strokeWidth={1.5} />

      {/* Evento: lista nueva */}
      <line x1={xe} y1={22} x2={xe} y2={ye} stroke={colorEvento} strokeDasharray="3 4" strokeWidth={1.5} />
      <rect x={xEtq - 62} y={2} width={124} height={20} rx={10} fill={aplicada ? 'rgba(52,211,153,.14)' : 'rgba(251,191,36,.14)'} stroke={colorEvento} strokeOpacity={.6} />
      <text x={xEtq} y={16} textAnchor="middle" fontSize={11} fontWeight={800} fill={colorEvento}>{aplicada ? `Lista +${pct}% aplicada` : `Lista nueva +${pct}%`}</text>
      <path d={`M ${xe} ${ye - 7} L ${xe + 6} ${ye} L ${xe} ${ye + 7} L ${xe - 6} ${ye} Z`} fill={colorEvento} style={{ filter: 'url(#pc-glow)' }} />

      {/* Trayectorias de congelamiento */}
      {filas.map(f => {
        const finVis = Math.min(f.fin, HORAS_SEMANA)
        const y = Y_CARRIL + f.carril * 10
        const color = f.mio ? HIELO : 'rgba(125,211,252,.5)'
        const solidoHasta = clamp(t, f.desde, finVis)
        return (
          <g key={f.id} opacity={f.estado === 'vencido' ? .45 : 1}>
            <rect x={xDe(f.desde)} y={y} width={Math.max(0, xDe(finVis) - xDe(f.desde))} height={7} rx={3.5} fill={color} opacity={.25} />
            <rect x={xDe(f.desde)} y={y} width={Math.max(0, xDe(solidoHasta) - xDe(f.desde))} height={7} rx={3.5} fill={color} />
            {f.estado === 'comprado' && <circle cx={xDe(finVis)} cy={y + 3.5} r={4.5} fill={C.success} stroke={C.bg} strokeWidth={1.5} />}
            {f.estado === 'vencido' && <circle cx={xDe(finVis)} cy={y + 3.5} r={4} fill={C.bg} stroke={C.error} strokeWidth={1.5} />}
            {f.mio && <text x={xDe(f.desde) - 5} y={y + 6.5} textAnchor="end" fontSize={9} fontWeight={800} fill={HIELO}>VOS</text>}
          </g>
        )
      })}

      {/* Planeta "hoy" */}
      <circle cx={xp} cy={yp} r={14} fill="none" stroke={ACENTO} strokeWidth={1.5} opacity={.7} style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'pr-ping 2.2s ease-out infinite' }} />
      <circle cx={xp} cy={yp} r={10} fill="url(#pc-grad-planeta)" style={{ filter: 'url(#pc-glow)' }} />
      <ellipse cx={xp} cy={yp} rx={17} ry={5} fill="none" stroke="rgba(255,255,255,.6)" strokeWidth={1.2} transform={`rotate(-18 ${xp} ${yp})`} />
      <rect x={xPl - 56} y={yp - 42} width={112} height={22} rx={11} fill="rgba(7,11,22,.9)" stroke={ACENTO} strokeOpacity={.7} />
      <text x={xPl} y={yp - 27} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={C.text} fontFamily={FONT_MONO}>{fmtTiempo(t)}</text>
    </svg>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function PrecioCongelado() {
  const [t, setT] = useState(T0)
  const [pct, setPct] = useState(8)
  const [diaLista, setDiaLista] = useState(4)
  const [congelados, setCongelados] = useState<Congelamiento[]>(SEMILLA)
  const [comprasDirectas, setComprasDirectas] = useState<CompraDirecta[]>([])
  const [productoSel, setProductoSel] = useState('botas')
  const [pestana, setPestana] = useState<'producto' | 'perfil'>('producto')
  const [reproduciendo, setReproduciendo] = useState(false)
  const [toast, setToast] = useState<{ id: number; texto: string; color: string } | null>(null)
  const animRef = useRef(0)
  const toastRef = useRef(0)
  const tRef = useRef(t)

  useEffect(() => { tRef.current = t }, [t])
  useEffect(() => () => { cancelAnimationFrame(animRef.current); window.clearTimeout(toastRef.current) }, [])

  // Reproducción automática de la semana
  useEffect(() => {
    if (!reproduciendo) return
    const id = window.setInterval(() => {
      if (tRef.current >= TMAX) { setReproduciendo(false); return }
      setT(prev => Math.min(TMAX, prev + 0.5))
    }, 45)
    return () => window.clearInterval(id)
  }, [reproduciendo])

  const tLista = diaLista * 24 + 9
  const aplicada = t >= tLista
  const precioDe = (p: Producto, en: number = t) => (en >= tLista ? Math.round(p.base * (1 + pct / 100)) : p.base)

  // ── Acciones de tiempo ──
  const fijarT = (h: number) => {
    cancelAnimationFrame(animRef.current)
    setReproduciendo(false)
    setT(ajustar(clamp(h, T0, TMAX)))
  }
  const irA = (destino: number) => {
    cancelAnimationFrame(animRef.current)
    setReproduciendo(false)
    const desde = t
    const hasta = clamp(destino, T0, TMAX)
    if (Math.abs(hasta - desde) < 0.01) return
    const inicio = performance.now()
    const dur = Math.min(1200, 350 + Math.abs(hasta - desde) * 10)
    const paso = (ahora: number) => {
      const u = Math.min(1, (ahora - inicio) / dur)
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2
      setT(ajustar(desde + (hasta - desde) * e))
      if (u < 1) animRef.current = requestAnimationFrame(paso)
    }
    animRef.current = requestAnimationFrame(paso)
  }

  const avisar = (texto: string, color = HIELO) => {
    window.clearTimeout(toastRef.current)
    setToast(prev => ({ id: (prev?.id ?? 0) + 1, texto, color }))
    toastRef.current = window.setTimeout(() => setToast(null), 3400)
  }

  // ── Acciones del cliente ──
  const congelar = (p: Producto) => {
    const precio = precioDe(p)
    setCongelados(prev => [
      ...prev.filter(c => !(c.mio && c.productoId === p.id && c.desde >= t)),
      { id: `mio-${p.id}-${t}`, cliente: CLIENTA, productoId: p.id, precio, desde: t, mio: true },
    ])
    setComprasDirectas(prev => prev.filter(x => !(x.productoId === p.id && x.t >= t)))
    avisar(`${CLIENTA} congeló ${p.nombre} a ${formatoARS(precio)} · seña de ${formatoARS(precio * PORC_SENA)} cobrada por MP`)
  }
  const comprarCongelado = (c: Congelamiento) => {
    setCongelados(prev => prev.map(x => (x.id === c.id ? { ...x, comprado: t } : x)))
    avisar(`${CLIENTA} compró ${productoDe(c.productoId).nombre} con precio congelado: pagó ${formatoARS(c.precio * (1 - PORC_SENA))}`, C.success)
  }
  const comprarDirecto = (p: Producto) => {
    const precio = precioDe(p)
    setComprasDirectas(prev => [...prev.filter(x => !(x.productoId === p.id && x.t >= t)), { productoId: p.id, precio, t }])
    avisar(`${CLIENTA} compró ${p.nombre} a ${formatoARS(precio)} (precio de lista)`, C.success)
  }
  const reiniciar = () => {
    cancelAnimationFrame(animRef.current)
    window.clearTimeout(toastRef.current)
    setReproduciendo(false)
    setT(T0); setPct(8); setDiaLista(4)
    setCongelados(SEMILLA); setComprasDirectas([])
    setProductoSel('botas'); setPestana('producto'); setToast(null)
  }

  // ── Derivados ──
  const visibles = useMemo<Trayecto[]>(
    () => congelados.filter(c => c.desde <= t).map(c => ({ ...c, estado: estadoDe(c, t) })).sort((a, b) => b.desde - a.desde),
    [congelados, t],
  )
  const activos = visibles.filter(v => v.estado === 'activo')
  const comprados = visibles.filter(v => v.estado === 'comprado')
  const vencidos = visibles.filter(v => v.estado === 'vencido')
  const clientesUnicos = new Set(visibles.map(v => v.cliente)).size
  const senas = visibles.reduce((s, v) => s + v.precio * PORC_SENA, 0)
  const senasRetenidas = vencidos.reduce((s, v) => s + v.precio * PORC_SENA, 0)
  const senasDescontadas = comprados.reduce((s, v) => s + v.precio * PORC_SENA, 0)
  const resueltos = comprados.length + vencidos.length
  const conversion = resueltos > 0 ? Math.round((comprados.length / resueltos) * 100) : 71
  const misCong = visibles.filter(v => v.mio)

  const producto = productoDe(productoSel)
  const miCong = misCong.find(c => c.productoId === producto.id) // ya vienen ordenados por desde desc
  const compraDirecta = comprasDirectas.find(x => x.productoId === producto.id && x.t <= t)
  const precioHoy = precioDe(producto)
  const precioNuevo = Math.round(producto.base * (1 + pct / 100))

  const pista = (() => {
    if (misCong.length === 0 && !aplicada) return 'Tocá "Congelar precio 72 hs" en el celular. Después arrastrá el planeta hasta el viernes y mirá qué pasa cuando sube la lista.'
    const activo = misCong.find(m => m.estado === 'activo')
    if (activo && !aplicada) return `Precio clavado hasta ${fmtTiempo(activo.desde + DURACION)}. Avanzá hasta el ${DIAS[diaLista]} ${diaLista + 1} a las 09:00: la lista sube +${pct}% pero tu precio no se mueve.`
    if (activo && aplicada) return 'La lista ya subió y tu precio sigue protegido. Tocá "Comprar ahora": pagás el precio viejo menos la seña que ya dejaste.'
    if (misCong.some(m => m.estado === 'comprado')) return 'Compra cerrada al precio congelado. Probá cambiar el % o el día de la lista en el panel y volvé a recorrer la semana.'
    if (misCong.some(m => m.estado === 'vencido')) return 'Venció el congelamiento sin compra: la seña quedó para el negocio y el precio pasó al nuevo. Podés volver a congelar.'
    return 'La lista ya subió. Igual podés congelar: el precio de hoy queda clavado por si viene otra suba.'
  })()

  return (
    <div style={{ position: 'relative', padding: 26, minHeight: 600, fontFamily: FONT, color: C.body }}>
      <style>{CSS}</style>

      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ width: 36, height: 36, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${ACENTO}, ${HIELO})`, color: '#fff', boxShadow: `0 8px 24px ${ACENTO}55` }}><Snowflake size={18} /></span>
          <div>
            <Etiqueta color={ACENTO}>Zapatería Lorena · semana del 1 al 7</Etiqueta>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: '-0.01em' }}>El dueño sube la lista, la clienta congela el precio</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Chip color={C.text} style={{ fontFamily: FONT_MONO, background: 'rgba(15,23,42,.8)' }}><Clock size={12} />Ahora: {fmtTiempo(t)}</Chip>
          <Boton variante="fantasma" tam="sm" onClick={reiniciar}><RotateCcw size={13} />Reiniciar</Boton>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div key={toast.id} style={{ position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 30, padding: '10px 16px', borderRadius: 12, background: 'rgba(15,23,42,.96)', border: `1px solid ${toast.color}66`, boxShadow: `0 12px 40px rgba(0,0,0,.5), 0 0 0 1px ${toast.color}22`, color: C.text, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, animation: 'pc-toast 3.4s ease both', maxWidth: 560, pointerEvents: 'none' }}>
          <Bell size={14} color={toast.color} />{toast.texto}
        </div>
      )}

      {/* Dos columnas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 24, alignItems: 'start' }}>
        {/* ── IZQUIERDA: panel del dueño ── */}
        <Pantalla tipo="panel">
          <div style={{ padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748B' }}>
                <span>Catálogo</span><ChevronRight size={14} /><span style={{ color: '#0F172A', fontWeight: 700 }}>Precios</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748B' }}>
                <span style={{ width: 22, height: 22, borderRadius: 7, background: 'linear-gradient(135deg,#78350F,#D97706)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🥾</span>
                Zapatería Lorena
              </div>
            </div>

            {/* Métricas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <Metrica icono={<Users size={14} />} color={ACENTO} etiqueta="Congelaron" valor={<NumeroAnimado valor={clientesUnicos} formato={n => String(n)} />} sub={`${activos.length} activos ahora · ${comprados.length} compraron`} />
              <Metrica icono={<Target size={14} />} color={C.primary} etiqueta="Congelado → compra" valor={<NumeroAnimado valor={conversion} formato={n => `${n}%`} />} sub={resueltos > 0 ? `${comprados.length} de ${resueltos} resueltos esta semana` : '71% histórico · esta semana sin resolver'} />
              <Metrica icono={<Coins size={14} />} color="#059669" etiqueta="Ingreso por señas" valor={<NumeroAnimado valor={senas} />} sub={`${formatoARS(senasRetenidas)} quedaron · ${formatoARS(senasDescontadas)} descontadas`} />
            </div>

            {/* Actualización programada */}
            <div style={{ border: `1px solid ${aplicada ? '#A7F3D0' : '#FDE68A'}`, background: aplicada ? '#ECFDF5' : '#FFFBEB', borderRadius: 14, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CalendarClock size={18} color={aplicada ? '#059669' : '#B45309'} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>{aplicada ? 'Actualización aplicada' : 'Actualización programada'}: +{pct}% el {DIAS[diaLista]} {diaLista + 1}</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{aplicada ? `Se aplicó el ${fmtTiempo(tLista)}. Los congelados mantienen su precio.` : `Se aplica el ${fmtTiempo(tLista)} sobre 5 productos. Los que congelen antes, no la pagan.`}</div>
                  </div>
                </div>
                <Chip color={aplicada ? '#059669' : '#B45309'}>{aplicada ? <><Check size={12} />aplicada</> : <><Clock size={12} />en {fmtRestante(tLista - t)}</>}</Chip>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 14, marginTop: 12 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700 }}>Aumento</span>
                    <span style={{ fontFamily: FONT_MONO, fontWeight: 800, color: '#6D28D9' }}>+{pct}%</span>
                  </div>
                  <input
                    type="range" min={3} max={20} step={1} value={pct} className="pc-rango" aria-label="Porcentaje de aumento"
                    onChange={e => setPct(Number(e.target.value))}
                    style={{ background: `linear-gradient(90deg, ${ACENTO} ${((pct - 3) / 17) * 100}%, #E2E8F0 ${((pct - 3) / 17) * 100}%)` }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Día de aplicación (09:00)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                    {DIAS.map((d, i) => (
                      <button key={d} type="button" className="pc-chip-dia" data-activo={i === diaLista ? '1' : '0'} disabled={i * 24 + 9 <= T0} onClick={() => setDiaLista(i)}>{d}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tabla de impacto */}
              <div style={{ marginTop: 12, background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 24px 1fr 1fr', gap: 8, padding: '7px 12px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.06em', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <span>Producto</span><span style={{ textAlign: 'right' }}>Precio hoy</span><span /><span style={{ textAlign: 'right' }}>Lista nueva</span><span style={{ textAlign: 'right' }}>Congelados</span>
                </div>
                {PRODUCTOS.map(p => {
                  const nActivos = activos.filter(a => a.productoId === p.id).length
                  return (
                    <div key={p.id} className={`pc-fila ${aplicada ? 'pc-aplicado' : ''}`} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 24px 1fr 1fr', gap: 8, padding: '8px 12px', alignItems: 'center', fontSize: 13, borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ width: 24, height: 24, borderRadius: 7, background: p.fondo, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{p.emoji}</span>
                        <span style={{ fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</span>
                      </span>
                      <span style={{ textAlign: 'right', fontFamily: FONT_MONO, fontWeight: 700, color: aplicada ? '#B45309' : '#0F172A' }}><NumeroAnimado valor={precioDe(p)} /></span>
                      <ArrowRight size={14} color="#94A3B8" />
                      <span style={{ textAlign: 'right', fontFamily: FONT_MONO, fontWeight: 700, color: aplicada ? '#94A3B8' : '#B45309', textDecoration: aplicada ? 'line-through' : 'none' }}><NumeroAnimado valor={Math.round(p.base * (1 + pct / 100))} /></span>
                      <span style={{ textAlign: 'right' }}>
                        {nActivos > 0
                          ? <Chip color={aplicada ? HIELO_TEXTO : '#6D28D9'} style={{ padding: '2px 8px' }}><Snowflake size={11} />{nActivos}{aplicada ? ' protegido' : ''}</Chip>
                          : <span style={{ color: '#94A3B8' }}>—</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Congelamientos */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Snowflake size={16} color={HIELO_TEXTO} />Congelamientos activos: <NumeroAnimado valor={activos.length} formato={n => String(n)} style={{ color: '#6D28D9' }} />
                </div>
                <div style={{ fontSize: 12.5, color: '#475569' }}>Señas cobradas: <strong style={{ color: '#059669', fontFamily: FONT_MONO }}><NumeroAnimado valor={senas} /></strong></div>
              </div>
              <div className="pr-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 268, overflowY: 'auto', paddingRight: 2 }}>
                {visibles.length === 0 && <div style={{ fontSize: 13, color: '#94A3B8', padding: 12, textAlign: 'center' }}>Todavía nadie congeló nada.</div>}
                {visibles.map(v => {
                  const p = productoDe(v.productoId)
                  const restante = v.desde + DURACION - t
                  const protegido = v.estado === 'activo' && aplicada
                  const frac = clamp(restante / DURACION, 0, 1)
                  return (
                    <div key={v.id} className="pr-fade-up" style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 12, background: protegido ? HIELO_FONDO : v.mio ? '#F5F3FF' : '#F8FAFC', border: `1px solid ${protegido ? HIELO : v.mio ? '#DDD6FE' : '#E2E8F0'}`, opacity: v.estado === 'vencido' ? .7 : 1 }}>
                      <span style={{ width: 32, height: 32, borderRadius: '50%', background: v.mio ? `linear-gradient(135deg, ${ACENTO}, ${HIELO})` : 'linear-gradient(135deg, #CBD5E1, #94A3B8)', color: '#fff', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{iniciales(v.cliente)}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <strong>{v.cliente}</strong>{v.mio && <span style={{ color: '#6D28D9', fontWeight: 700 }}> (vos)</span>} · {p.emoji} {p.nombre} a <span style={{ fontFamily: FONT_MONO, fontWeight: 700 }}>{formatoARS(v.precio)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, fontSize: 11.5, color: '#64748B' }}>
                          <span>seña {formatoARS(v.precio * PORC_SENA)}</span>
                          <span>·</span>
                          {v.estado === 'activo' ? (
                            <>
                              <span style={{ flex: 1, height: 4, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden', maxWidth: 140 }}>
                                <span style={{ display: 'block', height: '100%', width: `${frac * 100}%`, background: protegido ? HIELO_TEXTO : ACENTO, transition: 'width .25s' }} />
                              </span>
                              <span style={{ fontFamily: FONT_MONO }}>quedan {fmtRestante(restante)}</span>
                            </>
                          ) : v.estado === 'comprado' ? (
                            <span>compró el {fmtTiempo(v.comprado ?? t)} · seña descontada</span>
                          ) : (
                            <span>venció el {fmtTiempo(v.desde + DURACION)} · seña queda en caja</span>
                          )}
                        </div>
                      </div>
                      <ChipEstado estado={v.estado} protegido={protegido} />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </Pantalla>

        {/* ── DERECHA: celular de la clienta ── */}
        <Pantalla tipo="celular">
          <div className="pr-scroll" style={{ height: 660, overflowY: 'auto', paddingBottom: 66 }}>
            {/* Barra superior */}
            <div style={{ padding: '46px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14, color: '#0F172A' }}>Zapatería Lorena</div>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${ACENTO}, ${HIELO})`, color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{iniciales(CLIENTA)}</div>
            </div>

            {pestana === 'producto' ? (
              <div key={producto.id} className="pr-fade-in" style={{ padding: '0 16px' }}>
                {/* Selector de producto */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {PRODUCTOS.slice(0, 2).map(p => (
                    <button key={p.id} type="button" className="pr-btn" onClick={() => setProductoSel(p.id)} style={{ flex: 1, padding: '6px 8px', borderRadius: 10, border: `1px solid ${p.id === productoSel ? ACENTO : '#E2E8F0'}`, background: p.id === productoSel ? '#F5F3FF' : '#fff', color: p.id === productoSel ? '#6D28D9' : '#475569', fontSize: 12, fontWeight: 700, fontFamily: FONT }}>
                      {p.emoji} {p.nombre.split(' ')[0]}
                    </button>
                  ))}
                </div>

                {/* Imagen */}
                <div style={{ height: 118, borderRadius: 16, background: producto.fondo, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 58, position: 'relative', overflow: 'hidden' }}>
                  <span style={{ animation: 'pr-float 4s ease-in-out infinite', filter: 'drop-shadow(0 10px 16px rgba(0,0,0,.35))' }}>{producto.emoji}</span>
                  {miCong?.estado === 'activo' && <span style={{ position: 'absolute', top: 8, left: 8 }}><Chip color="#fff" style={{ background: 'rgba(3,105,161,.75)', borderColor: 'transparent' }}><Snowflake size={11} />precio congelado</Chip></span>}
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16, color: '#0F172A', letterSpacing: '-0.01em' }}>{producto.nombre}</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>{producto.detalle}</div>
                </div>

                {/* Tarjeta de precio */}
                <div style={{ position: 'relative', marginTop: 10, borderRadius: 16, border: '1px solid #E2E8F0', background: '#fff', padding: 14, minHeight: 92 }}>
                  {miCong?.estado === 'activo' && <Escarcha />}
                  {miCong?.estado === 'vencido' && !compraDirecta && <Escarcha derretida />}
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    {miCong?.estado === 'activo' ? (
                      <>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: HIELO_TEXTO, textTransform: 'uppercase', letterSpacing: '.06em', display: 'flex', alignItems: 'center', gap: 5 }}><Lock size={12} />Tu precio</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>{formatoARS(miCong.precio)}</div>
                          {aplicada && precioHoy > miCong.precio && <div style={{ fontSize: 12, color: '#B45309', fontWeight: 700 }}>los demás pagan <s>{formatoARS(precioHoy)}</s></div>}
                        </div>
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: HIELO_TEXTO, fontWeight: 600 }}>
                          <Clock size={13} />Congelado hasta {fmtTiempo(miCong.desde + DURACION)} · quedan <span style={{ fontFamily: FONT_MONO }}>{fmtRestante(miCong.desde + DURACION - t)}</span>
                        </div>
                        <div style={{ marginTop: 6, height: 5, borderRadius: 99, background: 'rgba(3,105,161,.15)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${clamp((miCong.desde + DURACION - t) / DURACION, 0, 1) * 100}%`, background: `linear-gradient(90deg, ${HIELO_TEXTO}, ${HIELO})`, transition: 'width .25s' }} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.06em' }}>Precio {aplicada ? 'de lista (actualizado)' : 'hoy'}</div>
                        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}><NumeroAnimado valor={precioHoy} /></div>
                        {!aplicada ? (
                          <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 999, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309', fontSize: 11.5, fontWeight: 700 }}>
                            <History size={12} />Sube el {DIAS[diaLista].toLowerCase()}: {formatoARS(producto.base)} → {formatoARS(precioNuevo)}
                          </div>
                        ) : (
                          <div style={{ marginTop: 4, fontSize: 11.5, color: '#B45309', fontWeight: 700 }}>Subió +{pct}% el {DIAS[diaLista].toLowerCase()} {diaLista + 1} (antes {formatoARS(producto.base)})</div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Historia de precio */}
                <div style={{ marginTop: 10, borderRadius: 14, border: '1px solid #E2E8F0', padding: '10px 10px 4px', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 2 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><History size={12} />Historia de precio · 90 días</span>
                    <span style={{ color: '#94A3B8', fontWeight: 600 }}>sin trampa</span>
                  </div>
                  <GraficoHistoria puntos={producto.hist} futuro={{ dia: tLista / 24, precio: precioNuevo }} hoyDia={t / 24} aplicada={aplicada} />
                </div>

                {/* Estados y acciones */}
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {miCong?.estado === 'comprado' ? (
                    <div className="pr-fade-up" style={{ borderRadius: 14, background: '#ECFDF5', border: '1px solid #A7F3D0', padding: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#065F46', fontSize: 14 }}><Check size={16} />Listo, Sofía. Pagaste {formatoARS(miCong.precio * (1 - PORC_SENA))}</div>
                      <div style={{ fontSize: 12, color: '#047857', marginTop: 4, lineHeight: 1.5 }}>
                        Precio congelado {formatoARS(miCong.precio)} − seña {formatoARS(miCong.precio * PORC_SENA)} que ya dejaste.
                        {aplicada && precioHoy > miCong.precio && <> Hoy la lista está en {formatoARS(precioHoy)}: <strong>te ahorraste {formatoARS(precioHoy - miCong.precio)}</strong>.</>}
                      </div>
                    </div>
                  ) : compraDirecta ? (
                    <div className="pr-fade-up" style={{ borderRadius: 14, background: '#ECFDF5', border: '1px solid #A7F3D0', padding: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#065F46', fontSize: 14 }}><Check size={16} />Compraste a {formatoARS(compraDirecta.precio)}</div>
                      <div style={{ fontSize: 12, color: '#047857', marginTop: 4 }}>Precio de lista del {fmtTiempo(compraDirecta.t)}, sin congelar.</div>
                    </div>
                  ) : miCong?.estado === 'activo' ? (
                    <>
                      <Boton color={HIELO_TEXTO} style={{ width: '100%' }} onClick={() => comprarCongelado(miCong)}>
                        <ShoppingBag size={15} />Comprar ahora · pagás {formatoARS(miCong.precio * (1 - PORC_SENA))}
                      </Boton>
                      <div style={{ fontSize: 11.5, color: '#64748B', textAlign: 'center' }}>{formatoARS(miCong.precio)} − seña {formatoARS(miCong.precio * PORC_SENA)} ya pagada. Si no comprás antes del {fmtTiempo(miCong.desde + DURACION).split(',')[0]}, la seña queda para el negocio.</div>
                    </>
                  ) : (
                    <>
                      {miCong?.estado === 'vencido' && (
                        <div className="pr-fade-up" style={{ borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA', padding: '8px 10px', fontSize: 12, color: '#991B1B', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <X size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                          <span><strong>Venció tu precio congelado</strong> ({formatoARS(miCong.precio)}): la seña de {formatoARS(miCong.precio * PORC_SENA)} quedó para el negocio. Ahora el precio es {formatoARS(precioHoy)}.</span>
                        </div>
                      )}
                      <Boton color={HIELO_TEXTO} style={{ width: '100%', background: `linear-gradient(135deg, ${HIELO_TEXTO}, #0EA5E9)` }} onClick={() => congelar(producto)}>
                        <Snowflake size={15} />Congelar precio 72 hs por {formatoARS(precioHoy * PORC_SENA)}
                      </Boton>
                      <Boton variante="fantasma" style={{ width: '100%', color: '#0F172A', borderColor: '#CBD5E1' }} onClick={() => comprarDirecto(producto)}>
                        <ShoppingBag size={15} />Comprar ahora a {formatoARS(precioHoy)}
                      </Boton>
                      <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', lineHeight: 1.45 }}>La seña (10%) se paga por Mercado Pago y se descuenta si comprás dentro de las 72 hs. Congelar no reserva stock.</div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="pr-fade-in" style={{ padding: '0 16px' }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, color: '#0F172A', letterSpacing: '-0.01em' }}>Mis precios congelados</div>
                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>Cada uno vale 72 hs desde que lo congelaste.</div>
                {misCong.length === 0 && (
                  <div style={{ borderRadius: 14, border: '1px dashed #CBD5E1', padding: 22, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                    <Snowflake size={22} style={{ margin: '0 auto 6px', display: 'block', color: HIELO }} />
                    Todavía no congelaste ningún precio.
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {misCong.map(c => {
                    const p = productoDe(c.productoId)
                    const restante = c.desde + DURACION - t
                    const protegido = c.estado === 'activo' && aplicada
                    const listaHoy = precioDe(p)
                    return (
                      <div key={c.id} className="pr-fade-up" style={{ borderRadius: 14, border: `1px solid ${c.estado === 'activo' ? HIELO : '#E2E8F0'}`, background: c.estado === 'activo' ? HIELO_FONDO : '#F8FAFC', padding: 10, opacity: c.estado === 'vencido' ? .75 : 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 36, height: 36, borderRadius: 10, background: p.fondo, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{p.emoji}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{p.nombre}</div>
                            <div style={{ fontSize: 12, color: '#475569' }}>
                              <span style={{ fontFamily: FONT_MONO, fontWeight: 800, color: c.estado === 'activo' ? HIELO_TEXTO : '#0F172A' }}>{formatoARS(c.precio)}</span>
                              {protegido && listaHoy > c.precio && <span style={{ color: '#B45309' }}> · lista hoy {formatoARS(listaHoy)}</span>}
                            </div>
                          </div>
                          <ChipEstado estado={c.estado} protegido={protegido} />
                        </div>
                        {c.estado === 'activo' && (
                          <>
                            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: HIELO_TEXTO, fontWeight: 600 }}>
                              <span>Hasta {fmtTiempo(c.desde + DURACION)}</span>
                              <span style={{ fontFamily: FONT_MONO }}>quedan {fmtRestante(restante)}</span>
                            </div>
                            <div style={{ marginTop: 4, height: 5, borderRadius: 99, background: 'rgba(3,105,161,.15)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${clamp(restante / DURACION, 0, 1) * 100}%`, background: `linear-gradient(90deg, ${HIELO_TEXTO}, ${HIELO})`, transition: 'width .25s' }} />
                            </div>
                            <Boton tam="sm" color={HIELO_TEXTO} style={{ width: '100%', marginTop: 8 }} onClick={() => comprarCongelado(c)}>
                              <ShoppingBag size={13} />Comprar · pagás {formatoARS(c.precio * (1 - PORC_SENA))}
                            </Boton>
                          </>
                        )}
                        {c.estado === 'comprado' && <div style={{ marginTop: 6, fontSize: 11.5, color: '#047857' }}>Compraste el {fmtTiempo(c.comprado ?? t)} · pagaste {formatoARS(c.precio * (1 - PORC_SENA))}</div>}
                        {c.estado === 'vencido' && <div style={{ marginTop: 6, fontSize: 11.5, color: '#991B1B' }}>Venció el {fmtTiempo(c.desde + DURACION)} · la seña de {formatoARS(c.precio * PORC_SENA)} quedó para el negocio</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Barra de pestañas */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 60, background: 'rgba(255,255,255,.96)', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'stretch', padding: '0 8px 6px', zIndex: 4 }}>
            <button type="button" className="pc-tab" onClick={() => setPestana('producto')} style={{ color: pestana === 'producto' ? '#6D28D9' : '#94A3B8' }}>
              <ShoppingBag size={18} /><span style={{ fontSize: 10.5, fontWeight: 700 }}>Producto</span>
            </button>
            <button type="button" className="pc-tab" onClick={() => setPestana('perfil')} style={{ color: pestana === 'perfil' ? '#6D28D9' : '#94A3B8', position: 'relative' }}>
              <Snowflake size={18} /><span style={{ fontSize: 10.5, fontWeight: 700 }}>Mis congelados</span>
              {misCong.filter(m => m.estado === 'activo').length > 0 && <span style={{ position: 'absolute', top: 2, right: 'calc(50% - 22px)', minWidth: 16, height: 16, borderRadius: 99, background: HIELO_TEXTO, color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{misCong.filter(m => m.estado === 'activo').length}</span>}
            </button>
          </div>
        </Pantalla>
      </div>

      {/* ── LÍNEA DE TIEMPO ── */}
      <Tarjeta style={{ marginTop: 24, padding: '16px 18px 12px', background: 'rgba(15,23,42,.55)', borderColor: `${ACENTO}33` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <Etiqueta color={ACENTO} style={{ whiteSpace: 'nowrap' }}>Línea de tiempo · arrastrá el planeta</Etiqueta>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12.5, color: C.body, lineHeight: 1.4 }}>
              <Lightbulb size={14} color={C.warning} style={{ flexShrink: 0, marginTop: 2 }} /><span>{pista}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Boton variante="suave" tam="sm" color={ACENTO} onClick={() => irA(t + 24)} disabled={t >= TMAX}><FastForward size={13} />Avanzar un día</Boton>
            <Boton variante="suave" tam="sm" color={C.warning} onClick={() => irA(tLista)} disabled={aplicada}><CalendarClock size={13} />Saltar a la lista nueva</Boton>
            <Boton variante={reproduciendo ? 'primario' : 'fantasma'} tam="sm" color={C.primary} onClick={() => { cancelAnimationFrame(animRef.current); if (t >= TMAX) setT(T0); setReproduciendo(r => !r) }}>
              {reproduciendo ? <><Pause size={13} />Pausar</> : <><Play size={13} />Reproducir la semana</>}
            </Boton>
          </div>
        </div>
        <LineaTiempo t={t} tLista={tLista} pct={pct} aplicada={aplicada} trayectos={visibles} onArrastrar={fijarT} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11.5, color: C.muted, marginTop: 4, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 18, height: 6, borderRadius: 99, background: HIELO }} />tu congelamiento</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 18, height: 6, borderRadius: 99, background: 'rgba(125,211,252,.5)' }} />otros clientes</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 99, background: C.success }} />compró</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 99, border: `1.5px solid ${C.error}` }} />venció sin comprar</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, background: C.warning, transform: 'rotate(45deg)' }} />lista nueva ({fmtTiempo(tLista)})</span>
          <span style={{ marginLeft: 'auto', fontFamily: FONT_MONO }}>cada congelamiento dura {DURACION} hs</span>
        </div>
      </Tarjeta>
    </div>
  )
}
