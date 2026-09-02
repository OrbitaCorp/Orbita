// src/modules/propuestas/prototipos/Simulador.tsx — Prototipo de "¿Y si…?":
// simulador conversacional de futuros del negocio con Orbi. Todo local:
// el "parseo" de la pregunta es por palabras clave y la proyección es un
// modelo heurístico determinístico (elasticidad + estacionalidad semanal +
// ruido con semilla). Demo interna, no producto.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowRight, BarChart3, BookmarkPlus, Check, ChevronDown, ChevronUp, CircleHelp, Eye,
  Play, RotateCcw, Sparkles, Trash2, X,
} from 'lucide-react'
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Boton, C, Chip, Etiqueta, FONT, FONT_DISPLAY, FONT_MONO, OrbiAvatar, Tarjeta, formatoARS } from '../ui'

// ─── Constantes del negocio ──────────────────────────────────────────────────

const ACENTO = '#2DD4BF'
const BASE_COLOR = '#7C8DB0'
const NEGOCIO = 'Casa Ramos · indumentaria'

const CATS = ['Remeras', 'Jeans', 'Camperas', 'Gorras', 'Accesorios'] as const
type Cat = (typeof CATS)[number]

/** Precio promedio, unidades por día, margen bruto y elasticidad precio observada. */
const CAT_INFO: Record<Cat, { precio: number; uds: number; margen: number; elast: number; productos: number }> = {
  Remeras:    { precio: 18500, uds: 9.0, margen: 0.48, elast: -0.6, productos: 26 },
  Jeans:      { precio: 42000, uds: 4.0, margen: 0.45, elast: -0.5, productos: 18 },
  Camperas:   { precio: 78000, uds: 1.6, margen: 0.42, elast: -0.4, productos: 11 },
  Gorras:     { precio: 12000, uds: 3.5, margen: 0.55, elast: -0.9, productos: 14 },
  Accesorios: { precio: 7500,  uds: 6.0, margen: 0.60, elast: -0.7, productos: 22 },
}

/** Factor por día de la semana (0 = domingo). Los sábados venden más. */
const ESTACION = [0.6, 0.85, 0.9, 0.95, 1.0, 1.15, 1.45]
const TENDENCIA_DIARIA = 0.0005
const DIAS_HIST = 21
const DIAS_FUT = 90
const N_DIAS = DIAS_HIST + DIAS_FUT
const CLIENTES_BASE = 118
const INACTIVOS = 140
const COSTO_SABADO = 45000
const CUOTAS_EF: Record<number, { uds: number; fin: number }> = { 3: { uds: 0.12, fin: 0.03 }, 6: { uds: 0.15, fin: 0.045 }, 12: { uds: 0.18, fin: 0.06 } }

const DIAS_SEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function hoyLocal(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
const HOY = hoyLocal()
const PROXIMO_LUNES = ((8 - HOY.getDay()) % 7) || 7

function sumarDias(base: Date, n: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}
function fechaCorta(d: Date): string { return `${d.getDate()} ${MESES[d.getMonth()]}` }
function fechaLarga(d: Date): string { return `${DIAS_SEM[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}` }
function aISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dd}`
}
function deISO(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Math.round((d.getTime() - HOY.getTime()) / 86400000)
}
function compacto(n: number): string {
  const abs = Math.abs(n)
  const signo = n < 0 ? '-' : ''
  if (abs >= 1e6) return `${signo}$${(abs / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} M`
  if (abs >= 1e3) return `${signo}$${Math.round(abs / 1e3).toLocaleString('es-AR')} mil`
  return `${signo}$${Math.round(abs)}`
}

/** Generador con semilla (mulberry32) para que la demo se repita igual. */
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
const RUIDO: number[] = (() => {
  const r = mulberry32(20260902)
  return Array.from({ length: N_DIAS * CATS.length }, () => 1 + (r() * 2 - 1) * 0.07)
})()

// ─── Escenarios ──────────────────────────────────────────────────────────────

type Tipo = 'precio' | 'cuotas' | 'dejar' | 'sabados' | 'promo'

interface Params {
  tipo: Tipo
  /** Precio: % de cambio (negativo = baja). Promo: % de descuento (50 = 2x1). */
  pct: number
  categoria: Cat
  /** Precio: aplicar a todo el catálogo. */
  todo: boolean
  /** Días desde hoy en que arranca la decisión. */
  desde: number
  cuotas: number
}

interface Kpis { ingresos: number; unidades: number; margen: number; clientes: number }
interface Punto { d: number; base: number; esc: number | null; banda: [number, number] | null }

const TIPO_INFO: Record<Tipo, { nombre: string; confianza: 'alta' | 'media' | 'baja'; banda: number }> = {
  precio:  { nombre: 'Cambio de precio', confianza: 'media', banda: 1 },
  cuotas:  { nombre: 'Cuotas sin interés', confianza: 'media', banda: 1.1 },
  dejar:   { nombre: 'Dejar de vender', confianza: 'alta', banda: 0.8 },
  sabados: { nombre: 'Abrir los sábados', confianza: 'baja', banda: 1.4 },
  promo:   { nombre: 'Promo a inactivos', confianza: 'baja', banda: 1.5 },
}

function sustituta(c: Cat): Cat { return c === 'Accesorios' ? 'Gorras' : 'Accesorios' }
function conversionPromo(pct: number): number { return 0.04 + 0.08 * (pct / 50) }
function esDosPorUno(p: Params): boolean { return p.pct >= 50 }

/** Participación de una categoría en los ingresos (para escalar efectos). */
const SHARE: Record<Cat, number> = (() => {
  const tot = CATS.reduce((s, c) => s + CAT_INFO[c].precio * CAT_INFO[c].uds, 0)
  return Object.fromEntries(CATS.map(c => [c, (CAT_INFO[c].precio * CAT_INFO[c].uds) / tot])) as Record<Cat, number>
})()

function proyectar(p: Params | null): { serie: Punto[]; base: Kpis; esc: Kpis } {
  const bruto = { base: [] as number[], esc: [] as number[], p10: [] as number[], p90: [] as number[] }
  const acc = { base: { ingresos: 0, unidades: 0, margen: 0 }, esc: { ingresos: 0, unidades: 0, margen: 0 } }
  const promoConv = p ? conversionPromo(p.pct) : 0
  const promoTicket = 22000

  for (let i = 0; i < N_DIAS; i++) {
    const d = i - DIAS_HIST
    const dow = sumarDias(HOY, d).getDay()
    const activo = !!p && d >= p.desde
    const rampa = p ? Math.max(0, Math.min(1, (d - p.desde + 1) / 4)) : 0
    let ingB = 0, udsB = 0, mgB = 0, ingE = 0, udsE = 0, mgE = 0

    CATS.forEach((c, k) => {
      const info = CAT_INFO[c]
      const uds = info.uds * ESTACION[dow] * (1 + TENDENCIA_DIARIA * d) * RUIDO[i * CATS.length + k]
      const precio = info.precio
      const costo = precio * (1 - info.margen)
      ingB += uds * precio; udsB += uds; mgB += uds * (precio - costo)

      let u = uds, pr = precio, extraCosto = 0
      if (activo && p) {
        switch (p.tipo) {
          case 'precio':
            if (p.todo || p.categoria === c) {
              pr = precio * (1 + p.pct / 100)
              u = Math.max(0, uds * (1 + info.elast * (p.pct / 100) * rampa))
            }
            break
          case 'cuotas': {
            const ef = CUOTAS_EF[p.cuotas] ?? CUOTAS_EF[3]
            u = uds * (1 + ef.uds * rampa)
            extraCosto = pr * ef.fin
            break
          }
          case 'dejar':
            if (p.categoria === c) u = 0
            else if (sustituta(p.categoria) === c) u = uds * (1 + 0.02 * rampa)
            break
          case 'sabados':
            if (dow === 6) u = uds * (1 + 0.4 * rampa)
            break
          case 'promo': {
            const enSemana = d >= p.desde && d < p.desde + 7
            if (enSemana) extraCosto = pr * 0.04
            break
          }
        }
      }
      ingE += u * pr; udsE += u; mgE += u * (pr - costo - extraCosto)
    })

    if (activo && p) {
      if (p.tipo === 'sabados' && dow === 6) mgE -= COSTO_SABADO
      if (p.tipo === 'promo') {
        const vuelven = INACTIVOS * promoConv
        if (d < p.desde + 7) {
          const porDia = (vuelven / 7) * (ESTACION[dow] / 1.0)
          if (esDosPorUno(p)) { ingE += porDia * promoTicket; udsE += porDia * 2; mgE += porDia * promoTicket * 0.02 }
          else { ingE += porDia * promoTicket * (1 - p.pct / 100); udsE += porDia; mgE += porDia * promoTicket * (0.5 - p.pct / 100) }
        } else if (d < p.desde + 60) {
          const recurrentes = vuelven * 0.3 / 53
          ingE += recurrentes * promoTicket; udsE += recurrentes; mgE += recurrentes * promoTicket * 0.5
        }
      }
    }

    const ancho = p ? (0.03 + 0.0024 * Math.max(0, d)) * TIPO_INFO[p.tipo].banda : 0
    bruto.base.push(ingB); bruto.esc.push(ingE)
    bruto.p10.push(ingE * (1 - ancho)); bruto.p90.push(ingE * (1 + ancho * 0.9))
    if (d >= 0) {
      acc.base.ingresos += ingB; acc.base.unidades += udsB; acc.base.margen += mgB
      acc.esc.ingresos += ingE; acc.esc.unidades += udsE; acc.esc.margen += mgE
    }
  }

  const serie: Punto[] = bruto.base.map((_, i) => {
    const d = i - DIAS_HIST
    return { d, base: bruto.base[i], esc: d >= 0 ? bruto.esc[i] : null, banda: d >= 0 ? [bruto.p10[i], bruto.p90[i]] : null }
  })

  let clientes = CLIENTES_BASE
  if (p) {
    const share = p.tipo === 'precio' && p.todo ? 1 : SHARE[p.categoria]
    switch (p.tipo) {
      case 'precio': clientes += Math.round(-p.pct * 0.35 * share); break
      case 'cuotas': clientes += Math.round(CLIENTES_BASE * 0.09 * (1 + ((p.cuotas - 3) / 9) * 0.4)); break
      case 'dejar': clientes -= Math.round(60 * share); break
      case 'sabados': clientes += 7; break
      case 'promo': clientes += Math.round(INACTIVOS * promoConv) + Math.round(INACTIVOS * promoConv * 0.3); break
    }
  }
  return {
    serie,
    base: { ...acc.base, clientes: CLIENTES_BASE },
    esc: p ? { ...acc.esc, clientes } : { ...acc.base, clientes: CLIENTES_BASE },
  }
}

/** Promedio móvil de 7 días para leer la tendencia sin el serrucho semanal. */
function suavizar(serie: Punto[]): Punto[] {
  const media = (arr: (number | null)[], i: number): number | null => {
    let s = 0, n = 0
    for (let j = Math.max(0, i - 6); j <= i; j++) { const v = arr[j]; if (v != null) { s += v; n++ } }
    return n ? s / n : null
  }
  const base = serie.map(s => s.base)
  const esc = serie.map(s => (s.esc ?? s.base))
  const p10 = serie.map(s => (s.banda ? s.banda[0] : s.base))
  const p90 = serie.map(s => (s.banda ? s.banda[1] : s.base))
  return serie.map((s, i) => ({
    d: s.d,
    base: media(base, i) ?? s.base,
    esc: s.d >= 0 ? media(esc, i) : null,
    banda: s.d >= 0 ? [media(p10, i) ?? s.base, media(p90, i) ?? s.base] : null,
  }))
}

// ─── Interpretación de la pregunta (palabras clave, sin LLM) ─────────────────

function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
function detectarCategoria(t: string): Cat | null {
  if (/remera/.test(t)) return 'Remeras'
  if (/jean|pantalon/.test(t)) return 'Jeans'
  if (/campera|abrigo|buzo/.test(t)) return 'Camperas'
  if (/gorra/.test(t)) return 'Gorras'
  if (/accesorio|cinto|bufanda|medias/.test(t)) return 'Accesorios'
  return null
}
function detectarPct(t: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(%|por ?ciento|porciento)/.exec(t)
  return m ? Number(m[1].replace(',', '.')) : null
}

type Interpretacion = { ok: true; params: Params; nota: string | null } | { ok: false }

function interpretar(texto: string): Interpretacion {
  const t = normalizar(texto)
  const cat = detectarCategoria(t)
  const pct = detectarPct(t)
  const base: Params = { tipo: 'precio', pct: 10, categoria: cat ?? 'Remeras', todo: false, desde: PROXIMO_LUNES, cuotas: 3 }

  if (/cuota/.test(t)) {
    const m = /(\d+)\s*cuota/.exec(t)
    const n = m ? Number(m[1]) : 3
    return { ok: true, params: { ...base, tipo: 'cuotas', cuotas: [3, 6, 12].includes(n) ? n : 3 }, nota: m ? null : 'No dijiste cuántas cuotas: tomé 3.' }
  }
  if (/inactiv|2x1|2 x 1|dos por uno|no compran|no vienen|dormid|perdid|viejos clientes|hace rato/.test(t)) {
    const dosPorUno = /2x1|2 x 1|dos por uno/.test(t)
    return { ok: true, params: { ...base, tipo: 'promo', pct: dosPorUno ? 50 : (pct ?? 20) }, nota: dosPorUno || pct != null ? null : 'No dijiste qué promo: tomé 20% de descuento. Si querés, subilo a 2x1.' }
  }
  if (/dej(o|ar|e) de vender|saco|sacar|elimin|retir|no vend|discontinu|cierro la categoria/.test(t)) {
    if (!cat) return { ok: false }
    return { ok: true, params: { ...base, tipo: 'dejar', categoria: cat, desde: 0 }, nota: null }
  }
  if (/sabado/.test(t) && /abr|atiend|trabaj|hor/.test(t)) {
    return { ok: true, params: { ...base, tipo: 'sabados', desde: ((6 - HOY.getDay() + 7) % 7) || 7 }, nota: null }
  }
  if (pct != null || /sub(o|ir|a)|aument|baj(o|ar|a)|rebaj|descuento|precio|remarc/.test(t)) {
    const baja = /baj(o|ar|a)|rebaj|descuento|reduc/.test(t)
    const valor = pct ?? 10
    return {
      ok: true,
      params: { ...base, tipo: 'precio', pct: baja ? -valor : valor, categoria: cat ?? 'Remeras', todo: !cat },
      nota: pct == null && !cat ? 'No dijiste cuánto ni qué: tomé 10% en todo el catálogo.' : pct == null ? 'No dijiste cuánto: tomé 10%.' : !cat ? 'No dijiste qué categoría: lo aplico a todo el catálogo.' : null,
    }
  }
  return { ok: false }
}

// ─── Textos de Orbi ──────────────────────────────────────────────────────────

function nombreCorto(p: Params): string {
  switch (p.tipo) {
    case 'precio': return `${p.pct > 0 ? '+' : ''}${p.pct}% ${p.todo ? 'todo' : p.categoria}`
    case 'cuotas': return `${p.cuotas} cuotas`
    case 'dejar': return `Sin ${p.categoria}`
    case 'sabados': return 'Sábados abiertos'
    case 'promo': return esDosPorUno(p) ? '2x1 inactivos' : `-${p.pct}% inactivos`
  }
}
function descripcionAccion(p: Params): string {
  const f = fechaLarga(sumarDias(HOY, p.desde))
  switch (p.tipo) {
    case 'precio': return `cambio de precio ${p.pct > 0 ? '+' : ''}${p.pct}% en ${p.todo ? 'todo el catálogo' : p.categoria} desde el ${f}`
    case 'cuotas': return `${p.cuotas} cuotas sin interés en el checkout desde el ${f}`
    case 'dejar': return `pausar la categoría ${p.categoria} (ocultar ${CAT_INFO[p.categoria].productos} productos) desde el ${f}`
    case 'sabados': return `horario de sábados 10 a 18 en el local desde el ${f}`
    case 'promo': return `promo ${esDosPorUno(p) ? '2x1' : `-${p.pct}%`} para ${INACTIVOS} clientes inactivos, por WhatsApp el ${f}`
  }
}
function supuestoOrbi(p: Params): string {
  switch (p.tipo) {
    case 'precio': {
      const objeto = p.todo ? 'el catálogo' : p.categoria.toLowerCase()
      const e = p.todo ? 0.6 : Math.abs(CAT_INFO[p.categoria].elast)
      return p.pct >= 0
        ? `Uso la elasticidad que vi en tus últimos 6 meses: cada 10% de suba, ${objeto} vende ${Math.round(e * 10)}% menos unidades.`
        : `Uso la elasticidad que vi en tus últimos 6 meses: cada 10% de baja, ${objeto} vende ${Math.round(e * 10)}% más unidades, pero cada una deja menos.`
    }
    case 'cuotas': {
      const ef = CUOTAS_EF[p.cuotas] ?? CUOTAS_EF[3]
      return `Cuando probaste cuotas en mayo las unidades subieron 12%. Con ${p.cuotas} cuotas cuento +${Math.round(ef.uds * 100)}% de unidades y ${(ef.fin * 100).toLocaleString('es-AR')} puntos de costo financiero sobre el margen.`
    }
    case 'dejar': return `Saco los ingresos de ${p.categoria} y sumo 2% en ${sustituta(p.categoria)} por sustitución: parte de esa gente compra otra cosa. El resto se va.`
    case 'sabados': return `Tu tienda online ya vende 45% más los sábados. Abrir el local suma cerca de 8% de ingresos semanales, menos ${formatoARS(COSTO_SABADO)} por sábado de personal.`
    case 'promo': {
      const conv = conversionPromo(p.pct)
      return `Tenés ${INACTIVOS} clientes que no compran hace más de 60 días. Con ${esDosPorUno(p) ? 'un 2x1' : `un ${p.pct}%`}, en tu historial vuelve el ${Math.round(conv * 100)}%: unos ${Math.round(INACTIVOS * conv)}. Esa semana el margen baja 4 puntos.`
    }
  }
}
function lecturaOrbi(p: Params, base: Kpis, esc: Kpis): string {
  const dIng = esc.ingresos - base.ingresos
  const dMg = esc.margen - base.margen
  const dU = esc.unidades - base.unidades
  const mg = compacto(Math.abs(dMg))
  if (dMg > 0 && dIng >= 0) return `Te conviene: en 90 días ganás ${mg} más de margen${dU < 0 ? ` aunque vendas ${Math.round(Math.abs(dU))} unidades menos` : ''}.`
  if (dMg > 0 && dIng < 0) return `Facturás ${compacto(Math.abs(dIng))} menos pero te quedan ${mg} más de margen. Ganás plata con menos trabajo.`
  if (dMg < 0 && dIng > 0) return `Vendés más (${compacto(dIng)} extra) pero el margen baja ${mg}. Sirve si buscás volumen o clientes nuevos, no plata ahora.`
  if (p.tipo === 'dejar') return `Perdés ${mg} de margen en 90 días. Solo tiene sentido si ${p.categoria} te ocupa espacio o tiempo que vale más que eso.`
  return `Perdés ${mg} de margen en 90 días. Yo no lo haría así; probá con otro número.`
}

const PREGUNTAS_RAPIDAS = [
  '¿Y si subo 10% las remeras?',
  '¿Y si hago 3 cuotas sin interés?',
  '¿Y si dejo de vender gorras?',
  '¿Y si abro los sábados?',
  '¿Y si mando un 2x1 a los clientes inactivos?',
]

const SUPUESTOS_GENERALES = [
  'Base: ventas reales de los últimos 6 meses (1.842 ventas, 5 categorías), proyectadas 90 días con una tendencia leve de +0,05% diario.',
  'Estacionalidad semanal observada: los sábados venden 45% más que un día promedio; los domingos, 40% menos.',
  'Elasticidad precio por categoría (unidades por cada 10% de suba): Remeras -6%, Jeans -5%, Camperas -4%, Gorras -9%, Accesorios -7%.',
  'Cuotas sin interés: 3 cuotas +12% de unidades y 3 puntos de costo financiero; 6 cuotas +15% y 4,5 pts; 12 cuotas +18% y 6 pts.',
  'Dejar de vender una categoría: se pierden sus ingresos; 2% de sustitución en la categoría más cercana.',
  'Abrir los sábados: +40% de unidades en cada sábado (≈ +8% semanal), menos $45.000 de personal por sábado.',
  'Promo a inactivos: 140 clientes sin compras en 60 días; conversión 12% con 2x1 (menos con descuentos chicos); 30% de los que vuelven repiten en 2 meses.',
  'Banda de incertidumbre: se ensancha 0,24% por día y se amplía en decisiones sin historial propio (sábados, promos).',
  'Los efectos entran gradualmente en los primeros 4 días desde que aplicás la decisión.',
]

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Conteo animado hacia `objetivo` (easing cubic-out). Arranca en `inicial` la primera vez. */
function useConteo(objetivo: number, inicial: number, dur = 900): number {
  const [valor, setValor] = useState(inicial)
  const desdeRef = useRef(inicial)
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

const CSS_SM = `
  @keyframes sm-glow { 0%, 100% { box-shadow: 0 0 0 3px rgba(45,212,191,.18), 0 0 30px rgba(45,212,191,.12); } 50% { box-shadow: 0 0 0 3px rgba(45,212,191,.32), 0 0 44px rgba(45,212,191,.22); } }
  @keyframes sm-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.04); opacity: 1; } 100% { transform: scale(1); } }
  @keyframes sm-slide-in { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: none; } }
  @keyframes sm-toast { 0% { opacity: 0; transform: translateY(12px) scale(.96); } 12% { opacity: 1; transform: none; } 85% { opacity: 1; } 100% { opacity: 0; transform: translateY(6px); } }
  @keyframes sm-scan { 0% { left: -30%; } 100% { left: 110%; } }
  .sm-chip { transition: transform .18s cubic-bezier(.2,.8,.2,1), background .18s, border-color .18s, color .18s; cursor: pointer; }
  .sm-chip:hover { transform: translateY(-2px); background: rgba(45,212,191,.14) !important; border-color: rgba(45,212,191,.55) !important; color: #F8FAFC !important; }
  .sm-pop { animation: sm-pop .4s cubic-bezier(.2,.8,.2,1) both; }
  .sm-slide-in { animation: sm-slide-in .45s cubic-bezier(.2,.8,.2,1) both; }
  .sm-range { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 99px; background: linear-gradient(90deg, rgba(45,212,191,.7), rgba(139,92,246,.7)); outline: none; cursor: pointer; }
  .sm-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #F8FAFC; border: 3px solid #2DD4BF; box-shadow: 0 2px 10px rgba(0,0,0,.4); transition: transform .15s; }
  .sm-range::-webkit-slider-thumb:hover { transform: scale(1.15); }
  .sm-range::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #F8FAFC; border: 3px solid #2DD4BF; box-shadow: 0 2px 10px rgba(0,0,0,.4); }
  .sm-select { background: rgba(2,6,23,.6); border: 1px solid rgba(148,163,184,.25); color: #F8FAFC; border-radius: 10px; padding: 8px 10px; font: inherit; font-size: 13px; outline: none; width: 100%; color-scheme: dark; }
  .sm-select:focus { border-color: #2DD4BF; box-shadow: 0 0 0 3px rgba(45,212,191,.2); }
  .sm-kpi { transition: transform .22s cubic-bezier(.2,.8,.2,1), border-color .22s, box-shadow .22s; }
  .sm-kpi:hover { transform: translateX(-3px); border-color: rgba(45,212,191,.4) !important; box-shadow: 0 10px 30px rgba(0,0,0,.35); }
`

// ─── Piezas pequeñas ─────────────────────────────────────────────────────────

function Pensando() {
  return (
    <div className="pr-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', marginTop: 14 }}>
      <OrbiAvatar size={30} />
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '10px 14px', borderRadius: 14, background: C.surface2, border: `1px solid ${C.border}` }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: C.orbiLight, animation: `pr-typing 1.1s ${i * 0.15}s infinite` }} />
        ))}
      </div>
      <span style={{ fontSize: 13, color: C.muted }}>Orbi cruza tus ventas con el escenario…</span>
    </div>
  )
}

function Interruptor({ activo, onChange, etiqueta }: { activo: boolean; onChange: (v: boolean) => void; etiqueta: string }) {
  return (
    <button type="button" onClick={() => onChange(!activo)} className="pr-btn" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', color: C.body, fontFamily: FONT, fontSize: 13, padding: 0 }}>
      <span style={{ width: 38, height: 22, borderRadius: 99, background: activo ? ACENTO : 'rgba(148,163,184,.25)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 3, left: activo ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s cubic-bezier(.2,.8,.2,1)', boxShadow: '0 1px 4px rgba(0,0,0,.4)' }} />
      </span>
      {etiqueta}
    </button>
  )
}

function Campo({ etiqueta, children, valor }: { etiqueta: string; children: ReactNode; valor?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted }}>
        {etiqueta}
        {valor && <span style={{ color: ACENTO, fontFamily: FONT_MONO, letterSpacing: 0, textTransform: 'none' }}>{valor}</span>}
      </span>
      {children}
    </label>
  )
}

function Delta({ valor, pct, invertir = false }: { valor: number; pct: number; invertir?: boolean }) {
  const bueno = invertir ? valor <= 0 : valor >= 0
  const color = Math.abs(pct) < 0.05 ? C.muted : bueno ? C.success : C.error
  const signo = valor > 0 ? '+' : valor < 0 ? '-' : ''
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 8, color, background: `${color}1A`, fontFamily: FONT_MONO }}>
      {signo}{Math.abs(pct).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%
    </span>
  )
}

function KpiCard({ etiqueta, base, esc, formato, invertir, retardo }: { etiqueta: string; base: number; esc: number; formato: (n: number) => string; invertir?: boolean; retardo: number }) {
  const v = useConteo(esc, base)
  const delta = esc - base
  const pct = base ? (delta / base) * 100 : 0
  return (
    <div className="sm-kpi sm-slide-in" style={{ animationDelay: `${retardo}ms`, padding: '12px 14px', borderRadius: 14, background: C.surface2, border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted }}>{etiqueta}</span>
        <Delta valor={delta} pct={pct} invertir={invertir} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: C.subtle, fontFamily: FONT_MONO, textDecoration: Math.abs(pct) >= 0.05 ? 'line-through' : 'none' }}>{formato(base)}</span>
        <ArrowRight size={12} color={C.subtle} />
        <span style={{ fontSize: 22, fontWeight: 800, fontFamily: FONT_DISPLAY, letterSpacing: '-0.02em', color: C.text, fontVariantNumeric: 'tabular-nums' }}>{formato(v)}</span>
      </div>
    </div>
  )
}

function TooltipSim({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: Punto }> }) {
  if (!active || !payload || !payload.length || !payload[0].payload) return null
  const p = payload[0].payload
  const fecha = sumarDias(HOY, p.d)
  return (
    <div style={{ background: 'rgba(7,11,22,.96)', border: `1px solid ${C.borderStrong}`, borderRadius: 12, padding: '10px 12px', fontSize: 12.5, fontFamily: FONT, color: C.body, boxShadow: '0 10px 30px rgba(0,0,0,.5)', minWidth: 210 }}>
      <div style={{ fontWeight: 700, color: C.text, marginBottom: 6 }}>{fechaLarga(fecha)}{p.d < 0 ? ' · real' : p.d === 0 ? ' · hoy' : ` · en ${p.d} días`}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}><span style={{ color: BASE_COLOR }}>{p.d < 0 ? 'Vendiste' : 'Si no hacés nada'}</span><span style={{ fontFamily: FONT_MONO }}>{formatoARS(p.base)}</span></div>
      {p.esc != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginTop: 2 }}><span style={{ color: ACENTO }}>Con la decisión</span><span style={{ fontFamily: FONT_MONO, color: C.text }}>{formatoARS(p.esc)}</span></div>
      )}
      {p.banda && (
        <div style={{ marginTop: 4, color: C.subtle, fontSize: 11.5 }}>Rango probable: {compacto(p.banda[0])} – {compacto(p.banda[1])}</div>
      )}
    </div>
  )
}

function TooltipBarras({ active, payload, label }: { active?: boolean; payload?: ReadonlyArray<{ name?: string; value?: number; color?: string }>; label?: string }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div style={{ background: 'rgba(7,11,22,.96)', border: `1px solid ${C.borderStrong}`, borderRadius: 12, padding: '8px 12px', fontSize: 12.5, fontFamily: FONT, color: C.body }}>
      <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>{label}</div>
      {payload.map(it => (
        <div key={it.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}><span style={{ color: it.color }}>{it.name}</span><span style={{ fontFamily: FONT_MONO }}>{formatoARS(it.value ?? 0)}</span></div>
      ))}
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────

type Fase = 'vacio' | 'pensando' | 'listo' | 'aclarar'

interface Guardado { id: number; nombre: string; descripcion: string; color: string; params: Params; kpis: Kpis; programado: boolean }

const COLORES_GUARDADOS = [ACENTO, '#A78BFA', '#FBBF24']

export default function Simulador() {
  const [texto, setTexto] = useState('')
  const [foco, setFoco] = useState(false)
  const [fase, setFase] = useState<Fase>('vacio')
  const [pregunta, setPregunta] = useState('')
  const [pendiente, setPendiente] = useState<Interpretacion | null>(null)
  const [params, setParams] = useState<Params | null>(null)
  const [nota, setNota] = useState<string | null>(null)
  const [claveGrafico, setClaveGrafico] = useState(0)
  const [suavizado, setSuavizado] = useState(true)
  const [guardados, setGuardados] = useState<Guardado[]>([])
  const [modal, setModal] = useState<Guardado | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [verSupuestos, setVerSupuestos] = useState(false)

  // Orbi "piensa" ~800 ms y después muestra lo que entendió.
  useEffect(() => {
    if (fase !== 'pensando' || !pendiente) return
    const t = setTimeout(() => {
      if (pendiente.ok) {
        setParams(pendiente.params)
        setNota(pendiente.nota)
        setClaveGrafico(k => k + 1)
        setFase('listo')
      } else {
        setFase('aclarar')
      }
    }, 800)
    return () => clearTimeout(t)
  }, [fase, pendiente])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(t)
  }, [toast])

  const proy = useMemo(() => proyectar(params), [params])
  const serieVisible = useMemo(() => (suavizado ? suavizar(proy.serie) : proy.serie), [proy, suavizado])

  function preguntar(q: string) {
    const limpio = q.trim()
    if (!limpio) return
    setPregunta(limpio)
    setTexto(limpio)
    setPendiente(interpretar(limpio))
    setFase('pensando')
  }
  function actualizar(cambio: Partial<Params>) {
    setParams(p => (p ? { ...p, ...cambio } : p))
    setNota(null)
  }
  function guardar() {
    if (!params || guardados.length >= 3) return
    const id = Date.now()
    setGuardados(g => [...g, { id, nombre: nombreCorto(params), descripcion: descripcionAccion(params), color: COLORES_GUARDADOS[g.length], params, kpis: proy.esc, programado: false }])
    setToast('Escenario guardado para comparar')
  }
  function quitar(id: number) {
    setGuardados(g => g.filter(x => x.id !== id).map((x, i) => ({ ...x, color: COLORES_GUARDADOS[i] })))
  }
  function ver(g: Guardado) {
    setParams(g.params)
    setNota(null)
    setPregunta(`Escenario guardado: ${g.nombre}`)
    setClaveGrafico(k => k + 1)
    setFase('listo')
  }
  function confirmar() {
    if (!modal) return
    setGuardados(g => g.map(x => (x.id === modal.id ? { ...x, programado: true } : x)))
    setModal(null)
    setToast('Listo, programado')
  }
  function reiniciar() {
    setTexto(''); setFase('vacio'); setPregunta(''); setPendiente(null); setParams(null); setNota(null)
    setGuardados([]); setModal(null); setToast(null); setVerSupuestos(false); setSuavizado(true)
    setClaveGrafico(k => k + 1)
  }

  const ticks = useMemo(() => { const t: number[] = []; for (let d = -14; d <= DIAS_FUT - 1; d += 7) t.push(d); return t }, [])
  const yaGuardado = !!params && guardados.some(g => JSON.stringify(g.params) === JSON.stringify(params))
  const confianza = params ? TIPO_INFO[params.tipo].confianza : 'media'
  const colorConf = confianza === 'alta' ? C.success : confianza === 'media' ? C.warning : C.error

  const datosBarras = useMemo(() => [
    { nombre: 'Sin cambios', Ingresos: Math.round(proy.base.ingresos), Margen: Math.round(proy.base.margen) },
    ...guardados.map(g => ({ nombre: g.nombre, Ingresos: Math.round(g.kpis.ingresos), Margen: Math.round(g.kpis.margen) })),
  ], [guardados, proy.base])

  return (
    <div style={{ position: 'relative', padding: '26px 28px 28px', minHeight: 600, fontFamily: FONT, color: C.text, overflow: 'hidden' }}>
      <style>{CSS_SM}</style>

      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <Etiqueta color={ACENTO}>Reportes · ¿Y si…?</Etiqueta>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{NEGOCIO}</span>
            <Chip color={C.muted} style={{ fontWeight: 600 }}>6 meses de historial · 1.842 ventas</Chip>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Chip color={colorConf}>Confianza {confianza}</Chip>
          <Boton variante="fantasma" tam="sm" onClick={reiniciar}><RotateCcw size={13} /> Reiniciar</Boton>
        </div>
      </div>

      {/* Campo de pregunta */}
      <form onSubmit={e => { e.preventDefault(); preguntar(texto) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px 12px 16px', borderRadius: 18, background: 'rgba(2,6,23,.55)', border: `1px solid ${foco ? ACENTO : C.borderStrong}`, animation: foco ? 'sm-glow 2.4s ease-in-out infinite' : 'none', transition: 'border-color .2s', position: 'relative', overflow: 'hidden' }}>
          {fase === 'pensando' && <span aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, width: '30%', background: `linear-gradient(90deg, transparent, ${ACENTO}22, transparent)`, animation: 'sm-scan 1.2s linear infinite', pointerEvents: 'none' }} />}
          <OrbiAvatar size={38} />
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onFocus={() => setFoco(true)}
            onBlur={() => setFoco(false)}
            placeholder="Preguntale a Orbi qué pasaría si…"
            aria-label="Preguntale a Orbi qué pasaría si"
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: C.text, fontSize: 18, fontFamily: FONT, fontWeight: 500, padding: '6px 0' }}
          />
          <Boton type="submit" color={ACENTO} disabled={!texto.trim() || fase === 'pensando'} style={{ color: '#062A27' }}>
            <Sparkles size={15} /> Simular
          </Boton>
        </div>
      </form>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        {PREGUNTAS_RAPIDAS.map(q => (
          <button key={q} type="button" className="sm-chip" onClick={() => preguntar(q)} style={{ padding: '7px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, color: C.body, background: 'rgba(148,163,184,.08)', border: `1px solid ${C.border}`, fontFamily: FONT }}>
            {q}
          </button>
        ))}
      </div>

      {fase === 'vacio' && (
        <div className="pr-fade-in" style={{ marginTop: 40, padding: '30px 20px', textAlign: 'center', color: C.muted, fontSize: 14, border: `1px dashed ${C.border}`, borderRadius: 18 }}>
          <div style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: '50%', alignItems: 'center', justifyContent: 'center', background: `${ACENTO}14`, border: `1px solid ${ACENTO}44`, marginBottom: 12, animation: 'pr-float 4s ease-in-out infinite' }}>
            <BarChart3 size={24} color={ACENTO} />
          </div>
          <div style={{ color: C.body, fontWeight: 600, fontSize: 15 }}>Los reportes miran para atrás. Acá preguntás para adelante.</div>
          <div style={{ marginTop: 4 }}>Escribí una pregunta o tocá una de arriba. Orbi la corre contra tus ventas reales y te muestra dos futuros.</div>
        </div>
      )}

      {fase === 'pensando' && <Pensando />}

      {fase === 'aclarar' && (
        <Tarjeta className="pr-fade-up" style={{ marginTop: 16, padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <OrbiAvatar size={32} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, color: C.body, lineHeight: 1.5 }}>
              No llegué a entender qué querés cambiar con <span style={{ color: C.text, fontStyle: 'italic' }}>&ldquo;{pregunta}&rdquo;</span>. Por ahora simulo precios, cuotas, dejar de vender una categoría, abrir los sábados y promos a inactivos. ¿Era alguna de estas?
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <Boton variante="suave" color={ACENTO} tam="sm" onClick={() => preguntar('¿Y si subo 10% las remeras?')}><CircleHelp size={13} /> Un cambio de precio en una categoría</Boton>
              <Boton variante="suave" color={C.orbiLight} tam="sm" onClick={() => preguntar('¿Y si mando un 2x1 a los clientes inactivos?')}><CircleHelp size={13} /> Una promo para clientes inactivos</Boton>
            </div>
          </div>
        </Tarjeta>
      )}

      {fase === 'listo' && params && (
        <>
          {/* Entendí esto */}
          <Tarjeta className="pr-fade-up" style={{ marginTop: 16, padding: '16px 18px', display: 'grid', gridTemplateColumns: 'minmax(280px, 1.1fr) minmax(300px, 1fr)', gap: 20 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: C.subtle, fontStyle: 'italic', marginBottom: 8 }}>&ldquo;{pregunta}&rdquo;</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Etiqueta color={ACENTO}>Entendí esto</Etiqueta>
                <Chip color={ACENTO}>{TIPO_INFO[params.tipo].nombre}</Chip>
                {(params.tipo === 'precio' || params.tipo === 'dejar') && <Chip color={C.primaryLight}>{params.tipo === 'precio' && params.todo ? 'Todo el catálogo' : params.categoria}</Chip>}
                <Chip color={C.muted}>desde {fechaLarga(sumarDias(HOY, params.desde))}</Chip>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <OrbiAvatar size={26} />
                <div style={{ fontSize: 13.5, color: C.body, lineHeight: 1.55 }}>
                  {supuestoOrbi(params)}
                  {nota && <div style={{ marginTop: 6, color: C.warning, fontSize: 12.5 }}>{nota}</div>}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', alignContent: 'start' }}>
              {params.tipo === 'precio' && (
                <Campo etiqueta="Cambio de precio" valor={`${params.pct > 0 ? '+' : ''}${params.pct}%`}>
                  <input className="sm-range" type="range" min={-30} max={30} step={1} value={params.pct} onChange={e => actualizar({ pct: Number(e.target.value) })} />
                </Campo>
              )}
              {params.tipo === 'promo' && (
                <Campo etiqueta="Descuento" valor={esDosPorUno(params) ? '2x1' : `-${params.pct}%`}>
                  <input className="sm-range" type="range" min={10} max={50} step={5} value={params.pct} onChange={e => actualizar({ pct: Number(e.target.value) })} />
                </Campo>
              )}
              {params.tipo === 'cuotas' && (
                <Campo etiqueta="Cuotas">
                  <select className="sm-select" value={params.cuotas} onChange={e => actualizar({ cuotas: Number(e.target.value) })}>
                    {[3, 6, 12].map(n => <option key={n} value={n}>{n} cuotas sin interés</option>)}
                  </select>
                </Campo>
              )}
              {(params.tipo === 'precio' || params.tipo === 'dejar') && (
                <Campo etiqueta="Categoría">
                  <select className="sm-select" value={params.categoria} disabled={params.tipo === 'precio' && params.todo} onChange={e => actualizar({ categoria: e.target.value as Cat })} style={{ opacity: params.tipo === 'precio' && params.todo ? 0.5 : 1 }}>
                    {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Campo>
              )}
              <Campo etiqueta="Desde">
                <input className="sm-select" type="date" value={aISO(sumarDias(HOY, params.desde))} min={aISO(HOY)} max={aISO(sumarDias(HOY, 60))} onChange={e => { const n = deISO(e.target.value); if (n != null) actualizar({ desde: Math.max(0, Math.min(60, n)) }) }} />
              </Campo>
              {params.tipo === 'precio' && (
                <div style={{ display: 'flex', alignItems: 'end', paddingBottom: 6 }}>
                  <Interruptor activo={params.todo} onChange={v => actualizar({ todo: v })} etiqueta="Aplicar a todo el catálogo" />
                </div>
              )}
            </div>
          </Tarjeta>

          {/* Gráfico + KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 16, marginTop: 16, alignItems: 'stretch' }}>
            <Tarjeta className="pr-fade-up" style={{ padding: '16px 14px 8px 8px', animationDelay: '80ms', minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '0 6px 10px 12px' }}>
                <div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15 }}>Próximos 90 días · ingresos por día</div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 12, color: C.muted }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 18, height: 0, borderTop: `2px dashed ${BASE_COLOR}` }} /> Si no hacés nada</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 18, height: 3, borderRadius: 2, background: ACENTO }} /> Con la decisión</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 18, height: 10, borderRadius: 3, background: `${ACENTO}33`, border: `1px solid ${ACENTO}55` }} /> Rango probable (p10–p90)</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10, background: 'rgba(2,6,23,.5)', border: `1px solid ${C.border}` }}>
                  {([true, false] as const).map(v => (
                    <button key={String(v)} type="button" className="pr-btn" onClick={() => setSuavizado(v)} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: FONT, border: 'none', color: suavizado === v ? C.text : C.muted, background: suavizado === v ? 'rgba(148,163,184,.18)' : 'transparent' }}>
                      {v ? 'Suavizado' : 'Diario'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ width: '100%' }}>
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart key={`g-${claveGrafico}`} data={serieVisible} margin={{ top: 18, right: 18, bottom: 4, left: 4 }}>
                    <defs>
                      <linearGradient id="sm-banda" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={ACENTO} stopOpacity={0.12} />
                        <stop offset="100%" stopColor={ACENTO} stopOpacity={0.3} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(148,163,184,.1)" vertical={false} />
                    <ReferenceArea x1={-DIAS_HIST} x2={0} fill="rgba(148,163,184,.05)" stroke="none" label={{ value: 'Historial', position: 'insideTopLeft', fill: C.subtle, fontSize: 11 }} />
                    <XAxis dataKey="d" type="number" domain={[-DIAS_HIST, DIAS_FUT - 1]} ticks={ticks} tickFormatter={(d: number) => fechaCorta(sumarDias(HOY, d))} tick={{ fill: C.subtle, fontSize: 11, fontFamily: FONT }} axisLine={{ stroke: C.border }} tickLine={false} />
                    <YAxis tickFormatter={(v: number) => compacto(v)} tick={{ fill: C.subtle, fontSize: 11, fontFamily: FONT_MONO }} axisLine={false} tickLine={false} width={70} domain={['auto', 'auto']} />
                    <Tooltip content={<TooltipSim />} cursor={{ stroke: 'rgba(148,163,184,.35)', strokeDasharray: '3 3' }} />
                    <Area type="monotone" dataKey="banda" stroke="none" fill="url(#sm-banda)" isAnimationActive animationDuration={1400} animationBegin={200} connectNulls={false} activeDot={false} />
                    <Line type="monotone" dataKey="base" stroke={BASE_COLOR} strokeWidth={1.8} strokeDasharray="5 4" dot={false} isAnimationActive animationDuration={900} activeDot={{ r: 3, fill: BASE_COLOR, stroke: 'none' }} />
                    <Line type="monotone" dataKey="esc" stroke={ACENTO} strokeWidth={2.6} dot={false} isAnimationActive animationDuration={1400} animationBegin={200} connectNulls={false} activeDot={{ r: 5, fill: ACENTO, stroke: C.bg, strokeWidth: 2 }} />
                    <ReferenceLine x={0} stroke={C.body} strokeDasharray="4 4" label={{ value: params.desde === 0 ? 'Hoy · aplicás' : 'Hoy', position: 'insideTopRight', fill: C.body, fontSize: 11, fontWeight: 700 }} />
                    {params.desde > 0 && (
                      <ReferenceLine x={params.desde} stroke={ACENTO} strokeDasharray="4 4" label={{ value: 'Aplicás la decisión', position: 'insideTopRight', fill: ACENTO, fontSize: 11, fontWeight: 700 }} />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Tarjeta>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
              <div className="sm-slide-in" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 14, background: `linear-gradient(135deg, ${C.primary}22, ${C.orbi}22)`, border: `1px solid ${C.orbi}44` }}>
                <OrbiAvatar size={24} />
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, fontWeight: 500 }}>{lecturaOrbi(params, proy.base, proy.esc)}</div>
              </div>
              <KpiCard etiqueta="Ingresos 90 días" base={proy.base.ingresos} esc={proy.esc.ingresos} formato={compacto} retardo={60} />
              <KpiCard etiqueta="Unidades" base={proy.base.unidades} esc={proy.esc.unidades} formato={n => Math.round(n).toLocaleString('es-AR')} retardo={120} />
              <KpiCard etiqueta="Margen bruto" base={proy.base.margen} esc={proy.esc.margen} formato={compacto} retardo={180} />
              <KpiCard etiqueta="Clientes que vuelven" base={proy.base.clientes} esc={proy.esc.clientes} formato={n => String(Math.round(n))} retardo={240} />
              <div className="sm-slide-in" style={{ animationDelay: '300ms', fontSize: 12.5, color: C.muted, lineHeight: 1.5, padding: '4px 4px 0' }}>
                Con lo que tenés de historial, la confianza de esta proyección es <span style={{ color: colorConf, fontWeight: 700 }}>{confianza}</span>: 6 meses de datos{confianza === 'baja' ? ' y ninguna vez que hayas hecho esto antes' : confianza === 'alta' ? ', y esto es casi aritmética' : ''}.
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                <Boton color={ACENTO} onClick={guardar} disabled={guardados.length >= 3 || yaGuardado} style={{ flex: 1, color: '#062A27' }}>
                  {yaGuardado ? <><Check size={15} /> Guardado</> : <><BookmarkPlus size={15} /> Guardar escenario</>}
                </Boton>
                <Boton variante="fantasma" onClick={() => { const g: Guardado = { id: -1, nombre: nombreCorto(params), descripcion: descripcionAccion(params), color: ACENTO, params, kpis: proy.esc, programado: false }; setModal(g) }}>
                  <Play size={14} /> Aplicar
                </Boton>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Comparar */}
      {guardados.length > 0 && (
        <Tarjeta className="pr-fade-up" style={{ marginTop: 16, padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Etiqueta color={C.orbiLight}>Comparar</Etiqueta>
              <span style={{ fontSize: 12, color: C.subtle, fontFamily: FONT_MONO }}>{guardados.length}/3</span>
            </div>
            {guardados.length < 2 && <span style={{ fontSize: 12.5, color: C.muted }}>Guardá otro escenario para verlos lado a lado.</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: guardados.length >= 2 ? 'minmax(300px, 1fr) minmax(320px, 1.1fr)' : '1fr', gap: 18, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {guardados.map(g => (
                <div key={g.id} className="sm-pop pr-hover-lift" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 14, background: C.surface2, border: `1px solid ${g.color}44` }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: g.color, boxShadow: `0 0 12px ${g.color}`, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, fontFamily: FONT_DISPLAY, fontSize: 14 }}>{g.nombre}</span>
                      {g.programado && <Chip color={C.success} style={{ fontSize: 11, padding: '2px 8px' }}><Check size={11} /> Programado</Chip>}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2, fontFamily: FONT_MONO }}>
                      Ingresos {compacto(g.kpis.ingresos)} · Margen {compacto(g.kpis.margen)}
                      <span style={{ color: g.kpis.margen >= proy.base.margen ? C.success : C.error, marginLeft: 6 }}>
                        ({g.kpis.margen >= proy.base.margen ? '+' : '-'}{compacto(Math.abs(g.kpis.margen - proy.base.margen))})
                      </span>
                    </div>
                  </div>
                  <button type="button" className="pr-btn" onClick={() => ver(g)} title="Ver en el gráfico" style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.body, borderRadius: 9, padding: 6, display: 'inline-flex' }}><Eye size={14} /></button>
                  <Boton tam="sm" color={g.color} onClick={() => setModal(g)} disabled={g.programado} style={{ color: '#062A27' }}><Play size={12} /> Aplicar</Boton>
                  <button type="button" className="pr-btn" onClick={() => quitar(g.id)} title="Quitar" style={{ background: 'transparent', border: 'none', color: C.subtle, padding: 4, display: 'inline-flex' }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            {guardados.length >= 2 && (
              <div className="pr-fade-in" style={{ width: '100%', minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 4, display: 'flex', gap: 14 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: ACENTO }} /> Ingresos 90 días</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: C.orbiLight }} /> Margen bruto</span>
                </div>
                <ResponsiveContainer width="100%" height={40 * datosBarras.length + 24}>
                  <BarChart data={datosBarras} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }} barCategoryGap={8} barGap={3}>
                    <XAxis type="number" hide domain={[0, 'auto']} />
                    <YAxis type="category" dataKey="nombre" width={118} tick={{ fill: C.body, fontSize: 12, fontFamily: FONT }} axisLine={false} tickLine={false} />
                    <Tooltip content={<TooltipBarras />} cursor={{ fill: 'rgba(148,163,184,.08)' }} />
                    <Bar dataKey="Ingresos" fill={ACENTO} radius={[0, 6, 6, 0]} isAnimationActive animationDuration={800} />
                    <Bar dataKey="Margen" fill={C.orbiLight} radius={[0, 6, 6, 0]} isAnimationActive animationDuration={800} animationBegin={120} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </Tarjeta>
      )}

      {/* Supuestos */}
      {fase === 'listo' && (
        <div style={{ marginTop: 14 }}>
          <button type="button" className="pr-btn" onClick={() => setVerSupuestos(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: C.muted, fontSize: 13, fontWeight: 600, fontFamily: FONT, padding: '6px 4px' }}>
            {verSupuestos ? <ChevronUp size={15} /> : <ChevronDown size={15} />} {verSupuestos ? 'Ocultar supuestos' : 'Ver supuestos'}
          </button>
          {verSupuestos && (
            <Tarjeta className="pr-fade-up" style={{ padding: '14px 18px', marginTop: 6 }}>
              <div style={{ fontSize: 12.5, color: C.subtle, marginBottom: 10 }}>Todo lo que Orbi asume para esta proyección. Es un modelo heurístico, no una bola de cristal: cambiá los números si conocés mejor tu negocio.</div>
              <ul className="pr-scroll" style={{ margin: 0, padding: '0 0 0 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '6px 24px', fontSize: 13, color: C.body, lineHeight: 1.5 }}>
                {SUPUESTOS_GENERALES.map((s, i) => <li key={i} style={{ paddingLeft: 2 }}>{s}</li>)}
              </ul>
            </Tarjeta>
          )}
        </div>
      )}

      {/* Modal Aplicar */}
      {modal && (
        <div className="pr-fade-in" onClick={() => setModal(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(7,11,22,.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, padding: 24 }}>
          <Tarjeta className="sm-pop" style={{ width: 'min(520px, 100%)', padding: '22px 24px', background: 'rgba(15,23,42,.96)', boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}>
            <div onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <OrbiAvatar size={30} />
                  <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16 }}>Orbi va a crear</span>
                </div>
                <button type="button" className="pr-btn" onClick={() => setModal(null)} style={{ background: 'transparent', border: 'none', color: C.muted, padding: 4, display: 'inline-flex' }}><X size={16} /></button>
              </div>
              <div style={{ padding: '14px 16px', borderRadius: 12, background: `${modal.color}14`, border: `1px solid ${modal.color}44`, fontSize: 15, color: C.text, lineHeight: 1.5, fontWeight: 500 }}>
                {modal.descripcion.charAt(0).toUpperCase() + modal.descripcion.slice(1)}.
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 12, lineHeight: 1.5 }}>
                Queda programado en {modal.params.tipo === 'promo' ? 'Mensajes' : modal.params.tipo === 'sabados' ? 'Configuración del local' : modal.params.tipo === 'cuotas' ? 'Pagos' : 'Catálogo'} y lo podés deshacer hasta el día anterior. Estimado a 90 días: margen {compacto(modal.kpis.margen)}.
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
                <Boton variante="fantasma" onClick={() => setModal(null)}>Cancelar</Boton>
                <Boton color={ACENTO} onClick={confirmar} style={{ color: '#062A27' }}><Check size={15} /> Confirmar</Boton>
              </div>
            </div>
          </Tarjeta>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div key={toast + String(guardados.length)} style={{ position: 'absolute', right: 22, bottom: 22, zIndex: 30, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 14, background: 'rgba(15,23,42,.96)', border: `1px solid ${C.success}55`, boxShadow: `0 12px 40px rgba(0,0,0,.5), 0 0 24px ${C.success}22`, animation: 'sm-toast 2.8s ease both', fontSize: 14, fontWeight: 600 }}>
          <span style={{ width: 24, height: 24, borderRadius: '50%', background: `${C.success}22`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Check size={14} color={C.success} /></span>
          {toast}
        </div>
      )}
    </div>
  )
}
