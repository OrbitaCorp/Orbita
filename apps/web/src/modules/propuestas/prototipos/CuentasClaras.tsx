// src/modules/propuestas/prototipos/CuentasClaras.tsx — Prototipo de
// "Cuentas Claras": Orbi lee las ventas reales del negocio (tienda, POS,
// Mercado Pago) y le habla al dueño como un contador amigo: cuánto apartar,
// si se pasa de categoría y cuándo, vencimientos y la carpeta mensual.
// Todo local y determinístico: datos fijos, respuestas por plantillas.
// Demo interna, no producto.
//
// IMPORTANTE: la escala de monotributo y las alícuotas de ingresos brutos
// son DE EJEMPLO. En producto se actualizan con la tabla oficial.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle, ArrowRight, Calendar, Check, ChevronDown, ChevronUp, FileArchive,
  FileSpreadsheet, FileText, FolderOpen, Landmark, PiggyBank, Receipt, RotateCcw,
  Send, Settings2, ShieldCheck, Sparkles, TrendingUp, Wallet,
} from 'lucide-react'
import {
  Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Boton, C, Chip, Etiqueta, FONT, FONT_DISPLAY, FONT_MONO, OrbiAvatar, Tarjeta, formatoARS } from '../ui'

// ─── Constantes del negocio ──────────────────────────────────────────────────

const ACENTO = '#FCD34D'
const NEGOCIO = 'Casa Ramos · indumentaria'
const HOY_LABEL = 'vie 28 ago'
const MES_LABEL = 'agosto'
const CONTADOR_MAIL = 'contador@estudiolopez.com.ar'
const APARTADO = 158_000 // lo que ya hay en el "Fondo impuestos" de Órbita

/** ESCALA DE EJEMPLO (no oficial). Tope anual y cuota mensual ilustrativos. */
const CATEGORIAS = [
  { cat: 'A', tope: 7_800_000,  cuota: 26_600 },
  { cat: 'B', tope: 11_400_000, cuota: 30_300 },
  { cat: 'C', tope: 16_000_000, cuota: 35_400 },
  { cat: 'D', tope: 19_800_000, cuota: 45_100 },
  { cat: 'E', tope: 23_400_000, cuota: 58_300 },
  { cat: 'F', tope: 29_300_000, cuota: 78_900 },
  { cat: 'G', tope: 35_000_000, cuota: 121_000 },
  { cat: 'H', tope: 53_000_000, cuota: 735_000 },
] as const
type Cat = (typeof CATEGORIAS)[number]['cat']

/** Alícuotas de ingresos brutos DE EJEMPLO por provincia. */
const PROVINCIAS = [
  { id: 'ba',   nombre: 'Buenos Aires', iibb: 0.035 },
  { id: 'caba', nombre: 'CABA',         iibb: 0.03 },
  { id: 'cba',  nombre: 'Córdoba',      iibb: 0.03 },
  { id: 'sf',   nombre: 'Santa Fe',     iibb: 0.045 },
  { id: 'mza',  nombre: 'Mendoza',      iibb: 0.04 },
] as const
type ProvId = (typeof PROVINCIAS)[number]['id']

type Regimen = 'mono' | 'ri'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Facturación mensual real (sep 2024 → ago 2026). Los primeros 12 solo sirven para el acumulado móvil. */
const HIST_PREVIO = [1_320_000, 1_400_000, 1_510_000, 1_980_000, 1_280_000, 1_350_000, 1_500_000, 1_580_000, 1_660_000, 1_720_000, 1_800_000, 1_790_000]
const HISTORIAL = [1_860_000, 1_980_000, 2_120_000, 2_790_000, 1_740_000, 1_820_000, 2_080_000, 2_210_000, 2_360_000, 2_440_000, 2_580_000, 2_140_000]
/** Proyección base de los próximos 12 meses (sep 2026 → ago 2027), con estacionalidad. */
const PROY_BASE = [2_550_000, 2_700_000, 2_800_000, 3_450_000, 2_100_000, 2_250_000, 2_550_000, 2_700_000, 2_850_000, 2_950_000, 3_100_000, 3_000_000]
const MES_ACTUAL = HISTORIAL[HISTORIAL.length - 1]
const MESES_PROY_VISIBLES = 3
/** Primer mes del historial visible: sep 2025 (índice 8, año 25). */
const PRIMER_MES = { m: 8, a: 25 }

const MEDIOS = [
  { nombre: 'Tienda online', share: 0.40, ops: 112, color: C.primaryLight },
  { nombre: 'Mostrador (POS)', share: 0.36, ops: 203, color: ACENTO },
  { nombre: 'Mercado Pago', share: 0.24, ops: 48, color: '#38BDF8' },
]

const VENCIMIENTOS = [
  { fecha: '31 ago', nombre: 'Cierre de mes', detalle: 'Orbi arma la carpeta', dias: 3, icono: FolderOpen },
  { fecha: '15 sep', nombre: 'Ingresos brutos', detalle: 'pago mensual', dias: 18, icono: Landmark },
  { fecha: '20 sep', nombre: 'Cuota de monotributo', detalle: 'débito automático', dias: 23, icono: Receipt },
]

const DOCS = [
  { nombre: 'Ventas por medio de pago', tipo: 'CSV', detalle: '3 medios · 31 días · 363 ventas', icono: FileSpreadsheet },
  { nombre: 'IVA discriminado', tipo: 'XLSX', detalle: '21% · 10,5% · exento', icono: Receipt },
  { nombre: 'Comprobantes de Mercado Pago', tipo: 'ZIP', detalle: '48 comprobantes', icono: FileArchive },
  { nombre: 'Resumen del mes', tipo: 'PDF', detalle: '2 páginas · listo para el estudio', icono: FileText },
]

const CHIPS = [
  '¿Cuánto aparto este mes?',
  '¿Me paso de categoría?',
  '¿Me conviene ser RI?',
  '¿Qué le mando al contador?',
  '¿Qué pasa si vendo $500.000 más?',
]

// ─── Helpers puros ───────────────────────────────────────────────────────────

function compacto(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e6) return `$${(abs / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} M`
  if (abs >= 1e3) return `$${Math.round(abs / 1e3).toLocaleString('es-AR')} mil`
  return `$${Math.round(abs)}`
}
function pctStr(n: number): string { return `${Math.round(n * 100)}%` }
function mesDesde(offset: number): { corto: string; largo: string; clave: string } {
  const idx = (PRIMER_MES.m + offset) % 12
  const anio = PRIMER_MES.a + Math.floor((PRIMER_MES.m + offset) / 12)
  return { corto: MESES[idx], largo: MESES_LARGO[idx], clave: `${MESES[idx]} ${anio}` }
}
function catIdx(cat: Cat): number { return CATEGORIAS.findIndex(c => c.cat === cat) }

interface Config { regimen: Regimen; cat: Cat; prov: ProvId; otros: number }

interface Calculo {
  tope: number
  cuota: number
  usado: number
  pctUsado: number
  /** Acumulado 12 meses móviles al cierre de cada mes futuro (12). */
  acumFuturo: number[]
  /** Índice del mes futuro donde se cruza el tope, o null. */
  cruce: number | null
  /** Categoría a la que conviene recategorizar si el cruce es inminente. */
  sugerida: (typeof CATEGORIAS)[number] | null
  semaforo: 'verde' | 'ambar' | 'rojo'
  facturadoMes: number
  iibb: number
  colchon: number
  cuotaAplicable: number
  apartar: number
  pctApartado: number
  // Comparación RI
  ivaRI: number
  gananciasRI: number
  costoMono: number
  costoRI: number
}

function calcular(cfg: Config, pct: number): Calculo {
  const k = 1 + pct / 100
  const prov = PROVINCIAS.find(p => p.id === cfg.prov) ?? PROVINCIAS[0]
  const idx = catIdx(cfg.cat)
  const tope = CATEGORIAS[idx].tope
  const cuota = CATEGORIAS[idx].cuota
  const usado = HISTORIAL.reduce((a, b) => a + b, 0) + cfg.otros * 12
  const acumFuturo: number[] = []
  let acum = usado
  for (let m = 0; m < 12; m++) {
    acum = acum - HISTORIAL[m] + PROY_BASE[m] * k
    acumFuturo.push(acum)
  }
  const cruceIdx = acumFuturo.findIndex(v => v > tope)
  const cruce = cfg.regimen === 'ri' ? null : cruceIdx === -1 ? null : cruceIdx
  const inminente = cruce !== null && cruce < MESES_PROY_VISIBLES
  let sugerida: Calculo['sugerida'] = null
  if (inminente) {
    const objetivo = acumFuturo[MESES_PROY_VISIBLES - 1]
    sugerida = CATEGORIAS.find((c, i) => i > idx && c.tope >= objetivo) ?? CATEGORIAS[CATEGORIAS.length - 1]
  }
  const pctUsado = usado / tope
  const semaforo: Calculo['semaforo'] =
    cfg.regimen === 'ri' ? 'verde'
    : inminente || pctUsado > 1 ? 'rojo'
    : cruce !== null || pctUsado > 0.75 ? 'ambar'
    : 'verde'

  const facturadoMes = MES_ACTUAL + cfg.otros
  const iibb = facturadoMes * prov.iibb
  const ivaRI = facturadoMes * 0.21 * 0.45 // IVA débito menos crédito estimado (55%)
  const gananciasRI = facturadoMes * 0.06
  const cuotaAplicable = cfg.regimen === 'ri' ? 0 : (sugerida ? sugerida.cuota : cuota)
  const colchon = facturadoMes * 0.02
  const apartar = cfg.regimen === 'ri' ? ivaRI + gananciasRI + iibb + colchon : cuotaAplicable + iibb + colchon
  const pctApartado = Math.min(1, APARTADO / apartar)
  return {
    tope, cuota, usado, pctUsado, acumFuturo, cruce, sugerida, semaforo,
    facturadoMes, iibb, colchon, cuotaAplicable, apartar, pctApartado,
    ivaRI, gananciasRI,
    costoMono: cuota + iibb,
    costoRI: ivaRI + gananciasRI + iibb,
  }
}

interface PuntoGrafico { clave: string; corto: string; real: number | null; proy: number | null; acum: number | null; acumProy: number | null; futuro: boolean }

function armarSerie(cfg: Config, calc: Calculo, pct: number): PuntoGrafico[] {
  const k = 1 + pct / 100
  const todos = [...HIST_PREVIO, ...HISTORIAL].map(v => v + cfg.otros)
  const puntos: PuntoGrafico[] = []
  for (let i = 0; i < HISTORIAL.length; i++) {
    const fin = HIST_PREVIO.length + i
    const acum = todos.slice(fin - 11, fin + 1).reduce((a, b) => a + b, 0)
    const ultimo = i === HISTORIAL.length - 1
    const { corto, clave } = mesDesde(i)
    puntos.push({ clave, corto, real: todos[fin], proy: null, acum, acumProy: ultimo ? acum : null, futuro: false })
  }
  for (let m = 0; m < MESES_PROY_VISIBLES; m++) {
    const { corto, clave } = mesDesde(HISTORIAL.length + m)
    puntos.push({ clave, corto, real: null, proy: PROY_BASE[m] * k + cfg.otros, acum: null, acumProy: calc.acumFuturo[m], futuro: true })
  }
  return puntos
}

/** Interpreta un monto tipo "500.000", "500k", "1,5 M", "medio palo". */
function parsearMonto(texto: string): number | null {
  const t = texto.toLowerCase()
  if (/medio\s+(palo|mill[oó]n)/.test(t)) return 500_000
  const m = /\$?\s*(\d[\d.]*(?:,\d+)?)\s*(k|mil|m\b|millón|millones|palo|palos)?/.exec(t)
  if (!m) return null
  const base = Number(m[1].replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(base) || base <= 0) return null
  const suf = m[2]
  if (suf === 'k' || suf === 'mil') return base * 1_000
  if (suf) return base * 1_000_000
  return base < 1000 ? base * 1_000 : base
}

type Intencion =
  | { tipo: 'apartar' } | { tipo: 'categoria' } | { tipo: 'ri' } | { tipo: 'contador' }
  | { tipo: 'vender', monto: number } | { tipo: 'vencimientos' } | { tipo: 'iibb' } | { tipo: 'hola' } | { tipo: 'nose' }

function interpretar(texto: string): Intencion {
  const t = texto.toLowerCase()
  if (/contador|carpeta|mand[aoá]|envi[aoá]|estudio/.test(t)) return { tipo: 'contador' }
  if (/responsable|inscripto|\bri\b|\biva\b/.test(t)) return { tipo: 'ri' }
  if (/vend[oaeé]|factur[oaeé]|más plata|mas plata/.test(t) && /\d|medio/.test(t)) {
    const monto = parsearMonto(t)
    if (monto) return { tipo: 'vender', monto }
  }
  if (/categor|paso|pas[oáa]s|recategor|tope|excl/.test(t)) return { tipo: 'categoria' }
  if (/apart|guard|reserv|separ|cu[aá]nto pago|impuest/.test(t)) return { tipo: 'apartar' }
  if (/venc|cu[aá]ndo|fecha|d[ií]a 20|d[ií]a 15|pagar/.test(t)) return { tipo: 'vencimientos' }
  if (/brutos|iibb|provincia|arba|agip/.test(t)) return { tipo: 'iibb' }
  if (/^\s*(hola|buenas|hey|qué tal|que tal)/.test(t)) return { tipo: 'hola' }
  return { tipo: 'nose' }
}

const CIERRE = ' Esto confirmalo con tu contador.'

function responder(intencion: Intencion, cfg: Config, calc: Calculo, pct: number): string {
  const prov = PROVINCIAS.find(p => p.id === cfg.prov) ?? PROVINCIAS[0]
  const F = formatoARS
  const esRI = cfg.regimen === 'ri'
  const conPct = pct > 0 ? ` con +${pct}%` : ''
  switch (intencion.tipo) {
    case 'hola':
      return 'Hola. Soy Orbi y miro tus ventas con ojos de contador. Preguntame cuánto apartar, si te pasás de categoría o qué mandarle a tu contador.'
    case 'apartar': {
      const faltan = Math.max(0, calc.apartar - APARTADO)
      const detalle = esRI
        ? `${F(calc.ivaRI)} de IVA estimado, ${F(calc.gananciasRI)} de anticipo de ganancias, ${F(calc.iibb)} de ingresos brutos de ${prov.nombre} y ${F(calc.colchon)} de colchón`
        : `${F(calc.cuotaAplicable)} de la cuota ${calc.sugerida ? `${calc.sugerida.cat} (si recategorizás)` : cfg.cat}, ${F(calc.iibb)} de ingresos brutos de ${prov.nombre} (${(prov.iibb * 100).toLocaleString('es-AR')}% de ejemplo) y ${F(calc.colchon)} de colchón`
      const fondo = faltan > 0 ? `Ya tenés ${F(APARTADO)} en el fondo: te faltan ${F(faltan)} antes del 20.` : `Con los ${F(APARTADO)} del fondo ya lo tenés cubierto.`
      return `En ${MES_LABEL} facturaste ${F(calc.facturadoMes)}. Apartá ${F(calc.apartar)}: ${detalle}. ${fondo}${CIERRE}`
    }
    case 'categoria': {
      if (esRI) return 'Como responsable inscripto no tenés tope de categoría: lo que cuida el margen es el IVA y ganancias, no la escala. Si querés comparar con monotributo, preguntame si te conviene.'
      if (calc.cruce === null) return `Tranquilo: llevás ${F(calc.usado)} de ${F(calc.tope)} en 12 meses (${pctStr(calc.pctUsado)}). A este ritmo${conPct} no te pasás de ${cfg.cat} en el próximo año.`
      const mes = mesDesde(HISTORIAL.length + calc.cruce)
      if (calc.sugerida) {
        if (calc.sugerida.cat === cfg.cat) return `Ojo: ${conPct ? `con +${pct}% ` : ''}te pasás del tope del monotributo en ${mes.largo}. Ahí ya no hay categoría que te salve: hay que pensar en responsable inscripto.${CIERRE}`
        return `Ojo: ${conPct ? `con +${pct}% ` : ''}te pasás de ${cfg.cat} en ${mes.largo}: llegás a ${compacto(calc.acumFuturo[calc.cruce])} contra un tope de ${compacto(calc.tope)}. Te conviene recategorizar a ${calc.sugerida.cat}: la cuota sube ${F(calc.sugerida.cuota - calc.cuota)} por mes pero evitás la exclusión.${CIERRE}`
      }
      return `Vas por el ${pctStr(calc.pctUsado)} del tope de ${cfg.cat}. Si seguís así${conPct} te pasás en ${mes.largo}: tenés tiempo, pero conviene ir mirándolo. La próxima recategorización es en enero.`
    }
    case 'ri': {
      if (esRI) return `Hoy como responsable inscripto pagás cerca de ${F(calc.costoRI)} por mes entre IVA, ganancias y brutos. Como monotributista ${cfg.cat} serían unos ${F(calc.costoMono)}, pero con tope de ${compacto(calc.tope)} al año y sin factura A para tus clientes empresa.${CIERRE}`
      const topeH = CATEGORIAS[CATEGORIAS.length - 1].tope
      return `Hoy como monotributista ${cfg.cat} pagás cerca de ${F(calc.costoMono)} por mes (cuota + brutos). Como responsable inscripto serían unos ${F(calc.costoRI)}: IVA ${F(calc.ivaRI)}, anticipo de ganancias ${F(calc.gananciasRI)} y brutos ${F(calc.iibb)}. Te conviene cuando vendas a empresas que necesitan factura A o te pases de H (${compacto(topeH)}).${CIERRE}`
    }
    case 'contador':
      return `Para ${MES_LABEL} tu contador necesita las ventas por medio de pago, el IVA discriminado, los 48 comprobantes de Mercado Pago y un resumen en PDF. Lo armo en un toque: tocá “Armar carpeta de ${MES_LABEL}” acá abajo y se lo mando a ${CONTADOR_MAIL}.`
    case 'vender': {
      const nuevoPct = Math.min(80, Math.max(0, Math.round((intencion.monto / MES_ACTUAL) * 100 / 5) * 5))
      const nuevo = calcular(cfg, nuevoPct)
      const escenario = nuevo.cruce === null
        ? `seguís adentro de ${cfg.cat} todo el año`
        : nuevo.sugerida
          ? `te pasás de ${cfg.cat} en ${mesDesde(HISTORIAL.length + nuevo.cruce).largo} y convendría recategorizar a ${nuevo.sugerida.cat}`
          : `te pasás de ${cfg.cat} en ${mesDesde(HISTORIAL.length + nuevo.cruce).largo}`
      const apartarNuevo = nuevo.apartar + intencion.monto * ((PROVINCIAS.find(p => p.id === cfg.prov)?.iibb ?? 0.035) + 0.02)
      return `Si vendés ${F(intencion.monto)} más por mes (+${nuevoPct}%), ${escenario}. Ese mes apartás ${F(apartarNuevo)} en vez de ${F(calc.apartar)}. Te lo dejé puesto en el slider para que lo veas en el gráfico.${esRI ? '' : CIERRE}`
    }
    case 'vencimientos':
      return `Lo que viene: el 31 cierra ${MES_LABEL} y te armo la carpeta; el 15 de septiembre vencen ingresos brutos de ${prov.nombre} (~${F(calc.iibb)}); el 20 la cuota ${esRI ? 'no aplica: sos RI, ahí vence el IVA' : `de monotributo ${cfg.cat}, ${F(calc.cuota)}`}. Te aviso tres días antes de cada uno.`
    case 'iibb':
      return `Para ingresos brutos en ${prov.nombre} uso una alícuota de ejemplo del ${(prov.iibb * 100).toLocaleString('es-AR')}% sobre lo facturado: este mes son unos ${F(calc.iibb)}. La real depende de tu rubro y del régimen de la provincia.${CIERRE}`
    case 'nose':
      return 'No llegué a entender. Puedo decirte cuánto apartar, si te pasás de categoría, si te conviene ser RI, qué mandarle al contador o qué pasa si vendés más. ¿Cuál de esas?'
  }
}

function comentarioSlider(cfg: Config, calc: Calculo, pct: number): string {
  if (cfg.regimen === 'ri') return `Con +${pct}% no hay tope que cuidar: sos responsable inscripto. Lo que sube es el IVA a pagar, unos ${formatoARS(calc.ivaRI * (1 + pct / 100))} por mes.`
  if (calc.cruce === null) return pct === 0
    ? `A este ritmo te quedás en ${cfg.cat} todo el año. Tenés margen para crecer sin pensar en la escala.`
    : `Con +${pct}% seguís adentro de ${cfg.cat} los próximos 12 meses. Buen momento para crecer.`
  const mes = mesDesde(HISTORIAL.length + calc.cruce)
  if (calc.sugerida) {
    if (calc.sugerida.cat === cfg.cat) return `Con +${pct}% te pasás del tope del monotributo en ${mes.largo}. Ahí hay que ver responsable inscripto con tu contador.`
    return `${pct > 0 ? `A +${pct}%` : 'A este ritmo'} te pasás de ${cfg.cat} en ${mes.largo}: te conviene recategorizar a ${calc.sugerida.cat}, la cuota sube ${formatoARS(calc.sugerida.cuota - calc.cuota)} pero evitás la exclusión.`
  }
  return `${pct > 0 ? `Con +${pct}%` : 'A este ritmo'} te pasás de ${cfg.cat} en ${mes.largo}. Falta, pero conviene ir apartando un poco más desde ahora.`
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Conteo animado hacia `objetivo` (easing cubic-out). */
function useConteo(objetivo: number, inicial: number, dur = 1000): number {
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

const CSS_CC2 = `
  @keyframes cc2-pop { 0% { transform: scale(.9); opacity: 0; } 60% { transform: scale(1.03); opacity: 1; } 100% { transform: scale(1); } }
  @keyframes cc2-msg { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
  @keyframes cc2-doc { 0% { opacity: 0; transform: translateY(22px) rotate(-2deg) scale(.96); } 60% { opacity: 1; transform: translateY(-3px) rotate(.5deg) scale(1.01); } 100% { opacity: 1; transform: none; } }
  @keyframes cc2-toast { 0% { opacity: 0; transform: translateY(12px) scale(.96); } 12% { opacity: 1; transform: none; } 85% { opacity: 1; } 100% { opacity: 0; transform: translateY(6px); } }
  @keyframes cc2-glow-rojo { 0%, 100% { box-shadow: 0 0 0 0 rgba(248,113,113,.0); } 50% { box-shadow: 0 0 0 4px rgba(248,113,113,.18), 0 0 30px rgba(248,113,113,.18); } }
  @keyframes cc2-glow-oro { 0%, 100% { box-shadow: 0 0 0 0 rgba(252,211,77,0); } 50% { box-shadow: 0 0 0 4px rgba(252,211,77,.16), 0 0 30px rgba(252,211,77,.14); } }
  @keyframes cc2-barra { from { width: 0; } }
  @keyframes cc2-vuela { 0% { transform: translate(0,0) rotate(0); opacity: 1; } 100% { transform: translate(40px,-30px) rotate(12deg); opacity: 0; } }
  @keyframes cc2-tilde { 0% { transform: scale(0); } 70% { transform: scale(1.3); } 100% { transform: scale(1); } }
  .cc2-msg { animation: cc2-msg .35s cubic-bezier(.2,.8,.2,1) both; }
  .cc2-pop { animation: cc2-pop .4s cubic-bezier(.2,.8,.2,1) both; }
  .cc2-doc { animation: cc2-doc .5s cubic-bezier(.2,.8,.2,1) both; }
  .cc2-tilde { animation: cc2-tilde .35s cubic-bezier(.2,.8,.2,1) both; }
  .cc2-chip { transition: transform .18s cubic-bezier(.2,.8,.2,1), background .18s, border-color .18s, color .18s; cursor: pointer; }
  .cc2-chip:hover { transform: translateY(-2px); background: rgba(252,211,77,.14) !important; border-color: rgba(252,211,77,.55) !important; color: #F8FAFC !important; }
  .cc2-chip:disabled { opacity: .5; cursor: not-allowed; transform: none; }
  .cc2-range { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 99px; background: linear-gradient(90deg, rgba(52,211,153,.8), rgba(251,191,36,.8) 55%, rgba(248,113,113,.9)); outline: none; cursor: pointer; }
  .cc2-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #F8FAFC; border: 3px solid #FCD34D; box-shadow: 0 2px 10px rgba(0,0,0,.45); transition: transform .15s; }
  .cc2-range::-webkit-slider-thumb:hover { transform: scale(1.15); }
  .cc2-range::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: #F8FAFC; border: 3px solid #FCD34D; box-shadow: 0 2px 10px rgba(0,0,0,.45); }
  .cc2-select { background: rgba(2,6,23,.6); border: 1px solid rgba(148,163,184,.25); color: #F8FAFC; border-radius: 10px; padding: 9px 10px; font: inherit; font-size: 13px; outline: none; width: 100%; color-scheme: dark; }
  .cc2-select:focus { border-color: #FCD34D; box-shadow: 0 0 0 3px rgba(252,211,77,.2); }
  .cc2-kpi { transition: transform .22s cubic-bezier(.2,.8,.2,1), border-color .22s, box-shadow .22s; }
  .cc2-kpi:hover { transform: translateY(-3px); box-shadow: 0 14px 40px rgba(0,0,0,.4); }
  .cc2-seg { transition: background .2s, color .2s; cursor: pointer; }
  .cc2-input { background: transparent; border: none; outline: none; color: #F8FAFC; font: inherit; flex: 1; min-width: 0; }
  .cc2-input::placeholder { color: #64748B; }
`

// ─── Piezas pequeñas ─────────────────────────────────────────────────────────

const COLOR_SEMAFORO = { verde: C.success, ambar: C.warning, rojo: C.error } as const
const TEXTO_SEMAFORO = { verde: 'Todo en orden', ambar: 'Atención', rojo: 'Alerta' } as const

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted }}>{etiqueta}</span>
      {children}
    </label>
  )
}

function Segmentado<T extends string>({ valor, opciones, onChange }: { valor: T; opciones: { id: T; nombre: string }[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10, background: 'rgba(2,6,23,.6)', border: `1px solid ${C.border}` }}>
      {opciones.map(o => (
        <button key={o.id} type="button" className="cc2-seg" onClick={() => onChange(o.id)} style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: FONT, border: 'none', color: valor === o.id ? '#1F2937' : C.muted, background: valor === o.id ? ACENTO : 'transparent' }}>
          {o.nombre}
        </button>
      ))}
    </div>
  )
}

function Burbuja({ rol, children, retardo = 0 }: { rol: 'orbi' | 'yo'; children: ReactNode; retardo?: number }) {
  const esOrbi = rol === 'orbi'
  return (
    <div className="cc2-msg" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', justifyContent: esOrbi ? 'flex-start' : 'flex-end', animationDelay: `${retardo}ms` }}>
      {esOrbi && <OrbiAvatar size={26} />}
      <div style={{ maxWidth: '86%', padding: '10px 13px', borderRadius: esOrbi ? '14px 14px 14px 4px' : '14px 14px 4px 14px', fontSize: 13.5, lineHeight: 1.5, color: esOrbi ? C.body : C.text, background: esOrbi ? C.surface2 : `linear-gradient(135deg, ${C.primary}, ${C.orbi})`, border: esOrbi ? `1px solid ${C.border}` : 'none' }}>
        {children}
      </div>
    </div>
  )
}

function Escribiendo() {
  return (
    <div className="cc2-msg" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <OrbiAvatar size={26} />
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '10px 13px', borderRadius: '14px 14px 14px 4px', background: C.surface2, border: `1px solid ${C.border}` }}>
        {[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: C.orbiLight, animation: `pr-typing 1.1s ${i * 0.15}s infinite` }} />)}
      </div>
      <span style={{ fontSize: 12, color: C.subtle }}>escribiendo…</span>
    </div>
  )
}

function TooltipGrafico({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: PuntoGrafico }> }) {
  if (!active || !payload || !payload.length || !payload[0].payload) return null
  const p = payload[0].payload
  const mensual = p.futuro ? p.proy : p.real
  const acum = p.futuro ? p.acumProy : p.acum
  return (
    <div style={{ background: 'rgba(7,11,22,.96)', border: `1px solid ${C.borderStrong}`, borderRadius: 12, padding: '10px 12px', fontSize: 12.5, fontFamily: FONT, color: C.body, boxShadow: '0 10px 30px rgba(0,0,0,.5)', minWidth: 200 }}>
      <div style={{ fontWeight: 700, color: C.text, marginBottom: 6 }}>{p.clave}{p.futuro ? ' · proyección' : ''}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}><span style={{ color: ACENTO }}>{p.futuro ? 'Proyectado' : 'Facturado'}</span><span style={{ fontFamily: FONT_MONO }}>{formatoARS(mensual ?? 0)}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginTop: 2 }}><span style={{ color: C.orbiLight }}>12 meses móviles</span><span style={{ fontFamily: FONT_MONO, color: C.text }}>{compacto(acum ?? 0)}</span></div>
    </div>
  )
}

// ─── Estado del chat ─────────────────────────────────────────────────────────

interface Mensaje { id: number; rol: 'orbi' | 'yo'; texto: string }

const CONFIG_INICIAL: Config = { regimen: 'mono', cat: 'F', prov: 'ba', otros: 0 }

type FaseCarpeta = 'idle' | 'armando' | 'lista' | 'enviando' | 'enviada'

// ─── Componente principal ────────────────────────────────────────────────────

export default function CuentasClaras() {
  const [clave, setClave] = useState(0)
  return <CuentasClarasInner key={clave} onReiniciar={() => setClave(k => k + 1)} />
}

function CuentasClarasInner({ onReiniciar }: { onReiniciar: () => void }) {
  const [cfg, setCfg] = useState<Config>(CONFIG_INICIAL)
  const [configAbierta, setConfigAbierta] = useState(true)
  const [configLista, setConfigLista] = useState(false)
  const [pct, setPct] = useState(0)
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { id: 1, rol: 'orbi', texto: 'Hola, Ramos. Contame estas 4 cosas y no te pregunto más: qué régimen tenés, en qué categoría estás, de qué provincia sos y si facturás algo por fuera de Órbita.' },
  ])
  const [pendiente, setPendiente] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [carpeta, setCarpeta] = useState<FaseCarpeta>('idle')
  const [docsListos, setDocsListos] = useState(0)
  const [resaltar, setResaltar] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(2)

  const calc = useMemo(() => calcular(cfg, pct), [cfg, pct])
  const serie = useMemo(() => armarSerie(cfg, calc, pct), [cfg, calc, pct])
  const prov = PROVINCIAS.find(p => p.id === cfg.prov) ?? PROVINCIAS[0]
  const colorSem = COLOR_SEMAFORO[calc.semaforo]
  const facturadoAnimado = useConteo(calc.facturadoMes, 0)
  const apartarAnimado = useConteo(calc.apartar, 0, 700)

  // Orbi "escribe" ~900 ms y después contesta.
  useEffect(() => {
    if (pendiente === null) return
    const t = setTimeout(() => {
      const id = idRef.current++
      setMensajes(m => [...m, { id, rol: 'orbi', texto: pendiente }])
      setPendiente(null)
    }, 900)
    return () => clearTimeout(t)
  }, [pendiente])

  // Scroll del chat al último mensaje.
  useEffect(() => {
    const el = chatRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [mensajes.length, pendiente])

  // Carpeta: los documentos se apilan de a uno.
  useEffect(() => {
    if (carpeta !== 'armando') return
    if (docsListos >= DOCS.length) {
      const t = setTimeout(() => setCarpeta('lista'), 500)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setDocsListos(n => n + 1), 620)
    return () => clearTimeout(t)
  }, [carpeta, docsListos])

  useEffect(() => {
    if (carpeta !== 'enviando') return
    const t = setTimeout(() => { setCarpeta('enviada'); setToast(`Enviado a ${CONTADOR_MAIL}`) }, 1100)
    return () => clearTimeout(t)
  }, [carpeta])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!resaltar) return
    const t = setTimeout(() => setResaltar(false), 2400)
    return () => clearTimeout(t)
  }, [resaltar])

  function preguntar(q: string) {
    const limpio = q.trim()
    if (!limpio || pendiente !== null) return
    const id = idRef.current++
    setMensajes(m => [...m, { id, rol: 'yo', texto: limpio }])
    setTexto('')
    const intencion = interpretar(limpio)
    let calcRespuesta = calc
    if (intencion.tipo === 'vender') {
      const nuevoPct = Math.min(80, Math.max(0, Math.round((intencion.monto / MES_ACTUAL) * 100 / 5) * 5))
      setPct(nuevoPct)
      calcRespuesta = calcular(cfg, nuevoPct)
    }
    if (intencion.tipo === 'contador') setResaltar(true)
    setPendiente(responder(intencion, cfg, calcRespuesta, intencion.tipo === 'vender' ? pct : pct))
  }
  function confirmarConfig() {
    setConfigAbierta(false)
    if (!configLista) {
      setConfigLista(true)
      setPendiente(`Listo, con eso me arreglo. Leo tus ventas de tienda, mostrador y Mercado Pago y te aviso antes de cada vencimiento. ${cfg.regimen === 'mono' ? `Vas por el ${pctStr(calc.pctUsado)} del tope de ${cfg.cat}.` : 'Como RI no tenés tope, pero sí IVA todos los meses.'} Preguntame lo que quieras.`)
    } else {
      setToast('Configuración guardada')
    }
  }
  function armarCarpeta() {
    setDocsListos(0)
    setCarpeta('armando')
  }

  const mesCruce = calc.cruce !== null && calc.cruce < MESES_PROY_VISIBLES ? mesDesde(HISTORIAL.length + calc.cruce).clave : null
  const maxAcum = Math.max(calc.tope, ...serie.map(p => Math.max(p.acum ?? 0, p.acumProy ?? 0))) * 1.12
  const proyFinal = calc.acumFuturo[MESES_PROY_VISIBLES - 1]
  const pctProy = Math.min(1.08, proyFinal / calc.tope)
  const pctApartadoColor = calc.pctApartado >= 1 ? C.success : calc.pctApartado >= 0.6 ? C.warning : C.error
  const yaTieneCuota = APARTADO >= calc.cuotaAplicable
  const comentario = comentarioSlider(cfg, calc, pct)

  return (
    <div style={{ position: 'relative', padding: '26px 28px 28px', minHeight: 600, fontFamily: FONT, color: C.text, overflow: 'hidden' }}>
      <style>{CSS_CC2}</style>

      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <Etiqueta color={ACENTO}>Reportes · Cuentas Claras</Etiqueta>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{NEGOCIO}</span>
            <Chip color={C.muted} style={{ fontWeight: 600 }}>{cfg.regimen === 'mono' ? `Monotributo ${cfg.cat}` : 'Responsable inscripto'} · {prov.nombre}</Chip>
            <Chip color={C.muted} style={{ fontWeight: 600 }}><Calendar size={11} /> Hoy {HOY_LABEL}</Chip>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Chip color={colorSem}><span style={{ width: 8, height: 8, borderRadius: '50%', background: colorSem, boxShadow: `0 0 10px ${colorSem}` }} /> {TEXTO_SEMAFORO[calc.semaforo]}</Chip>
          <Boton variante="fantasma" tam="sm" onClick={onReiniciar}><RotateCcw size={13} /> Reiniciar</Boton>
        </div>
      </div>

      {/* Tira de alerta */}
      <div key={`${calc.cuotaAplicable}-${calc.semaforo}`} className="pr-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, marginBottom: 16, background: `${pctApartadoColor}12`, border: `1px solid ${pctApartadoColor}44`, flexWrap: 'wrap' }}>
        <AlertTriangle size={16} color={pctApartadoColor} />
        <span style={{ fontSize: 13.5, color: C.text, fontWeight: 600 }}>
          {cfg.regimen === 'mono' ? (
            <>Vence el 20 sep: cuota de monotributo <span style={{ fontFamily: FONT_MONO, color: ACENTO }}>{formatoARS(calc.cuotaAplicable)}</span>{calc.sugerida && calc.sugerida.cat !== cfg.cat ? ` si recategorizás a ${calc.sugerida.cat}` : ''}</>
          ) : (
            <>Vence el 20 sep: IVA estimado <span style={{ fontFamily: FONT_MONO, color: ACENTO }}>{formatoARS(calc.ivaRI)}</span></>
          )}
          <span style={{ color: C.subtle }}> · </span>Vence el 15 sep: ingresos brutos <span style={{ fontFamily: FONT_MONO, color: ACENTO }}>{formatoARS(calc.iibb)}</span>
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: C.body }}>
          Tenés apartado el <b style={{ color: pctApartadoColor, fontFamily: FONT_MONO }}>{pctStr(calc.pctApartado)}</b>
          <span style={{ width: 110, height: 6, borderRadius: 99, background: 'rgba(148,163,184,.15)', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${calc.pctApartado * 100}%`, background: pctApartadoColor, borderRadius: 99, transition: 'width .5s cubic-bezier(.2,.8,.2,1)' }} />
          </span>
        </span>
      </div>

      {/* Configuración rápida */}
      <Tarjeta style={{ padding: configAbierta ? '16px 18px' : '10px 18px', marginBottom: 16, transition: 'padding .2s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Settings2 size={16} color={ACENTO} />
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14.5 }}>Configuración rápida</span>
          {!configAbierta && (
            <div className="pr-fade-in" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Chip color={C.muted}>{cfg.regimen === 'mono' ? 'Monotributo' : 'Resp. inscripto'}</Chip>
              {cfg.regimen === 'mono' && <Chip color={C.muted}>Categoría {cfg.cat}</Chip>}
              <Chip color={C.muted}>{prov.nombre}</Chip>
              <Chip color={C.muted}>Otros ingresos {cfg.otros > 0 ? `${formatoARS(cfg.otros)}/mes` : 'ninguno'}</Chip>
            </div>
          )}
          <span style={{ marginLeft: 'auto' }}>
            {configAbierta
              ? <Boton tam="sm" color={ACENTO} onClick={confirmarConfig} style={{ color: '#1F2937' }}><Check size={13} /> Listo, no me preguntes más</Boton>
              : <button type="button" className="pr-btn" onClick={() => setConfigAbierta(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: C.muted, fontSize: 12.5, fontWeight: 600, fontFamily: FONT }}><ChevronDown size={14} /> Editar</button>}
          </span>
        </div>
        {configAbierta && (
          <div className="pr-fade-in" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 1fr', gap: 14, marginTop: 14, alignItems: 'end' }}>
            <Campo etiqueta="Régimen">
              <Segmentado<Regimen> valor={cfg.regimen} onChange={v => setCfg(c => ({ ...c, regimen: v }))} opciones={[{ id: 'mono', nombre: 'Monotributo' }, { id: 'ri', nombre: 'Resp. inscripto' }]} />
            </Campo>
            <Campo etiqueta="Categoría actual">
              <select className="cc2-select" value={cfg.cat} disabled={cfg.regimen === 'ri'} onChange={e => setCfg(c => ({ ...c, cat: e.target.value as Cat }))} style={{ opacity: cfg.regimen === 'ri' ? 0.5 : 1 }}>
                {CATEGORIAS.map(c => <option key={c.cat} value={c.cat}>{c.cat} · hasta {compacto(c.tope)}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Provincia">
              <select className="cc2-select" value={cfg.prov} onChange={e => setCfg(c => ({ ...c, prov: e.target.value as ProvId }))}>
                {PROVINCIAS.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Otros ingresos por fuera de Órbita (mes)">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(2,6,23,.6)', border: `1px solid ${C.border}`, borderRadius: 10, padding: '0 10px' }}>
                <span style={{ color: C.subtle, fontFamily: FONT_MONO }}>$</span>
                <input className="cc2-input" type="text" inputMode="numeric" placeholder="0" aria-label="Otros ingresos mensuales" value={cfg.otros ? cfg.otros.toLocaleString('es-AR') : ''} onChange={e => { const n = Number(e.target.value.replace(/\D/g, '')); setCfg(c => ({ ...c, otros: Math.min(20_000_000, Number.isFinite(n) ? n : 0) })) }} style={{ padding: '9px 0', fontSize: 13, fontFamily: FONT_MONO }} />
              </div>
            </Campo>
          </div>
        )}
      </Tarjeta>

      {/* Cuerpo: semáforo + gráfico | chat */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(340px, 2fr)', gap: 16, alignItems: 'stretch' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          {/* Semáforo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Tarjeta className="cc2-kpi pr-fade-up" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Wallet size={14} color={C.primaryLight} />
                <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted }}>Facturaste este mes</span>
              </div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{formatoARS(facturadoAnimado)}</div>
              <div style={{ fontSize: 11.5, color: C.subtle, marginBottom: 8 }}>{MES_LABEL} · al día 28 · 363 ventas</div>
              <div style={{ display: 'flex', height: 6, borderRadius: 99, overflow: 'hidden', gap: 2, marginBottom: 8 }}>
                {MEDIOS.map(m => <span key={m.nombre} style={{ width: `${m.share * 100}%`, background: m.color, animation: 'cc2-barra .9s cubic-bezier(.2,.8,.2,1) both' }} />)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {MEDIOS.map(m => (
                  <div key={m.nombre} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.body }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: m.color }} />{m.nombre}</span>
                    <span style={{ fontFamily: FONT_MONO, color: C.muted }}>{formatoARS(MES_ACTUAL * m.share)}</span>
                  </div>
                ))}
                {cfg.otros > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.body }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: C.subtle }} />Fuera de Órbita</span>
                    <span style={{ fontFamily: FONT_MONO, color: C.muted }}>{formatoARS(cfg.otros)}</span>
                  </div>
                )}
              </div>
            </Tarjeta>

            <Tarjeta className="cc2-kpi pr-fade-up" style={{ padding: '14px 16px', animationDelay: '70ms', borderColor: `${ACENTO}55`, background: `linear-gradient(160deg, ${ACENTO}14, ${C.surface})` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <PiggyBank size={14} color={ACENTO} />
                <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted }}>Apartá para impuestos</span>
              </div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: ACENTO, fontVariantNumeric: 'tabular-nums' }}>{formatoARS(apartarAnimado)}</div>
              <div style={{ fontSize: 11.5, color: C.subtle, marginBottom: 8 }}>
                {cfg.regimen === 'mono'
                  ? `cuota ${calc.sugerida ? calc.sugerida.cat : cfg.cat} + brutos ${prov.nombre} + colchón 2%`
                  : 'IVA neto + anticipo ganancias + brutos + colchón'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: C.body }}>
                {cfg.regimen === 'mono' ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cuota {calc.sugerida ? `${calc.sugerida.cat} (sugerida)` : cfg.cat}</span><span style={{ fontFamily: FONT_MONO, color: C.muted }}>{formatoARS(calc.cuotaAplicable)}</span></div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>IVA estimado</span><span style={{ fontFamily: FONT_MONO, color: C.muted }}>{formatoARS(calc.ivaRI)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ganancias (anticipo)</span><span style={{ fontFamily: FONT_MONO, color: C.muted }}>{formatoARS(calc.gananciasRI)}</span></div>
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ingresos brutos ({(prov.iibb * 100).toLocaleString('es-AR')}%)</span><span style={{ fontFamily: FONT_MONO, color: C.muted }}>{formatoARS(calc.iibb)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Colchón</span><span style={{ fontFamily: FONT_MONO, color: C.muted }}>{formatoARS(calc.colchon)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, paddingTop: 6, borderTop: `1px solid ${C.border}` }}>
                  <span style={{ color: C.muted }}>Ya en el fondo</span><span style={{ fontFamily: FONT_MONO, color: yaTieneCuota ? C.success : C.warning }}>{formatoARS(APARTADO)}</span>
                </div>
              </div>
            </Tarjeta>

            <Tarjeta className="cc2-kpi pr-fade-up" style={{ padding: '14px 16px', animationDelay: '140ms', borderColor: `${colorSem}66`, animation: calc.semaforo === 'rojo' ? 'cc2-glow-rojo 2.4s ease-in-out infinite' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <TrendingUp size={14} color={colorSem} />
                <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted }}>Margen de categoría</span>
                <span style={{ marginLeft: 'auto', width: 10, height: 10, borderRadius: '50%', background: colorSem, boxShadow: `0 0 12px ${colorSem}`, transition: 'background .3s' }} />
              </div>
              {cfg.regimen === 'mono' ? (
                <>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{compacto(calc.usado)} <span style={{ fontSize: 14, color: C.muted, fontWeight: 600 }}>de {compacto(calc.tope)}</span></div>
                  <div style={{ fontSize: 11.5, color: C.subtle, marginBottom: 10 }}>12 meses móviles · {pctStr(calc.pctUsado)} del tope {cfg.cat}</div>
                  <div style={{ position: 'relative', height: 10, borderRadius: 99, background: 'rgba(148,163,184,.14)', overflow: 'visible' }}>
                    <span style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, pctProy * 100)}%`, borderRadius: 99, background: `${colorSem}44`, border: `1px dashed ${colorSem}`, boxSizing: 'border-box', transition: 'width .5s cubic-bezier(.2,.8,.2,1), background .3s' }} />
                    <span style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, calc.pctUsado * 100)}%`, borderRadius: 99, background: `linear-gradient(90deg, ${C.success}, ${colorSem})`, transition: 'width .5s cubic-bezier(.2,.8,.2,1)' }} />
                    <span style={{ position: 'absolute', right: 0, top: -3, width: 2, height: 16, background: C.error, borderRadius: 2 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: C.muted, marginTop: 8 }}>
                    <span>En 3 meses{pct > 0 ? ` (+${pct}%)` : ''}: <b style={{ color: colorSem, fontFamily: FONT_MONO }}>{compacto(proyFinal)}</b></span>
                    <span style={{ color: colorSem, fontWeight: 700 }}>{calc.cruce === null ? 'sin cruce' : `cruza en ${mesDesde(HISTORIAL.length + calc.cruce).corto}`}</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.success }}>Sin tope</div>
                  <div style={{ fontSize: 12.5, color: C.body, lineHeight: 1.5, marginTop: 4 }}>Como responsable inscripto no hay categoría que cuidar. Lo que sube con las ventas es el IVA: hoy unos <b style={{ fontFamily: FONT_MONO }}>{formatoARS(calc.ivaRI)}</b> por mes.</div>
                </>
              )}
              <div style={{ fontSize: 10.5, color: C.subtle, marginTop: 8 }}>Escala de ejemplo, se actualiza con la oficial.</div>
            </Tarjeta>
          </div>

          {/* Slider ¿Y si vendo más? */}
          <Tarjeta className="pr-fade-up" style={{ padding: '14px 18px', animationDelay: '200ms' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(0, 1.4fr)', gap: 18, alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14.5 }}>¿Y si vendo más?</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 700, color: pct === 0 ? C.muted : ACENTO }}>+{pct}%</span>
                </div>
                <input className="cc2-range" type="range" min={0} max={80} step={5} value={pct} aria-label="Cuánto más vendés" onChange={e => setPct(Number(e.target.value))} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.subtle, marginTop: 6, fontFamily: FONT_MONO }}>
                  <span>+0%</span><span>+40%</span><span>+80%</span>
                </div>
              </div>
              <div key={`${calc.cruce}-${calc.sugerida?.cat ?? ''}-${cfg.regimen}`} className="cc2-pop" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, background: `linear-gradient(135deg, ${C.primary}1A, ${C.orbi}1A)`, border: `1px solid ${C.orbi}44` }}>
                <OrbiAvatar size={24} />
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, fontWeight: 500 }}>{comentario}</div>
              </div>
            </div>
          </Tarjeta>

          {/* Gráfico */}
          <Tarjeta className="pr-fade-up" style={{ padding: '16px 14px 10px 8px', animationDelay: '260ms', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '0 6px 8px 12px' }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15 }}>Últimos 12 meses + 3 proyectados</div>
              <div style={{ display: 'flex', gap: 14, fontSize: 12, color: C.muted, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: ACENTO }} /> Facturado</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: `${ACENTO}33`, border: `1px dashed ${ACENTO}` }} /> Proyección</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 18, height: 3, borderRadius: 2, background: C.orbiLight }} /> 12 meses móviles</span>
                {cfg.regimen === 'mono' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 18, height: 0, borderTop: `2px dashed ${C.error}` }} /> Tope {cfg.cat}</span>}
              </div>
            </div>
            <div style={{ width: '100%' }}>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={serie} margin={{ top: 16, right: 12, bottom: 0, left: 0 }} barCategoryGap="28%">
                  <defs>
                    <linearGradient id="cc2-barra" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACENTO} stopOpacity={1} />
                      <stop offset="100%" stopColor={ACENTO} stopOpacity={0.45} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,.1)" vertical={false} />
                  <XAxis dataKey="clave" tickFormatter={(v: string) => (v.startsWith('ene') || v.startsWith('sep 25') ? v : v.split(' ')[0])} tick={{ fill: C.subtle, fontSize: 11, fontFamily: FONT }} axisLine={{ stroke: C.border }} tickLine={false} />
                  <YAxis yAxisId="mes" tickFormatter={(v: number) => compacto(v)} tick={{ fill: C.subtle, fontSize: 11, fontFamily: FONT_MONO }} axisLine={false} tickLine={false} width={64} domain={[0, 'auto']} />
                  <YAxis yAxisId="acum" orientation="right" tickFormatter={(v: number) => compacto(v)} tick={{ fill: C.orbiLight, fontSize: 11, fontFamily: FONT_MONO }} axisLine={false} tickLine={false} width={64} domain={[0, maxAcum]} />
                  <Tooltip content={<TooltipGrafico />} cursor={{ fill: 'rgba(148,163,184,.07)' }} />
                  <Bar yAxisId="mes" dataKey="real" fill="url(#cc2-barra)" radius={[5, 5, 0, 0]} isAnimationActive animationDuration={900} />
                  <Bar yAxisId="mes" dataKey="proy" fill={`${ACENTO}33`} stroke={ACENTO} strokeDasharray="4 3" radius={[5, 5, 0, 0]} isAnimationActive animationDuration={700} animationBegin={500} />
                  <Line yAxisId="acum" type="monotone" dataKey="acum" stroke={C.orbiLight} strokeWidth={2.4} dot={false} isAnimationActive animationDuration={1100} activeDot={{ r: 4, fill: C.orbiLight, stroke: C.bg, strokeWidth: 2 }} />
                  <Line yAxisId="acum" type="monotone" dataKey="acumProy" stroke={C.orbiLight} strokeWidth={2.4} strokeDasharray="6 5" dot={{ r: 3, fill: C.bg, stroke: C.orbiLight, strokeWidth: 2 }} isAnimationActive animationDuration={700} animationBegin={800} connectNulls={false} activeDot={{ r: 4, fill: C.orbiLight, stroke: C.bg, strokeWidth: 2 }} />
                  {cfg.regimen === 'mono' && (
                    <ReferenceLine yAxisId="acum" y={calc.tope} stroke={C.error} strokeDasharray="5 4" strokeWidth={1.5} label={{ value: `Tope ${cfg.cat} · ${compacto(calc.tope)}`, position: 'insideTopLeft', fill: C.error, fontSize: 11, fontWeight: 700 }} />
                  )}
                  {mesCruce && (
                    <ReferenceLine yAxisId="mes" x={mesCruce} stroke={C.error} strokeWidth={1.5} label={{ value: 'Te pasás', position: 'insideTopRight', fill: C.error, fontSize: 11, fontWeight: 700 }} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Próximos vencimientos */}
            <div style={{ margin: '8px 6px 4px 12px', padding: '12px 14px', borderRadius: 12, background: 'rgba(2,6,23,.45)', border: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Calendar size={13} color={C.muted} />
                <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted }}>Próximos vencimientos</span>
                <span style={{ fontSize: 12, color: C.subtle, marginLeft: 4 }}>{VENCIMIENTOS.map(v => v.fecha).join(' · ')}</span>
              </div>
              <div style={{ position: 'relative', height: 2, background: 'rgba(148,163,184,.18)', margin: '0 12px 30px', borderRadius: 2 }}>
                {VENCIMIENTOS.map((v, i) => {
                  const Icono = v.icono
                  const x = (v.dias / 30) * 100
                  const color = i === 0 ? C.primaryLight : v.dias <= 20 ? C.warning : ACENTO
                  return (
                    <div key={v.fecha} className="cc2-pop" style={{ position: 'absolute', left: `${x}%`, top: -7, transform: 'translateX(-50%)', animationDelay: `${300 + i * 120}ms`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 16, height: 16, borderRadius: '50%', background: color, boxShadow: `0 0 12px ${color}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        <span aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color, animation: `pr-ping 2.4s ${i * 0.5}s ease-out infinite`, opacity: .6 }} />
                        <Icono size={9} color="#0F172A" style={{ position: 'relative' }} />
                      </span>
                      <span style={{ fontSize: 11.5, color: C.text, fontWeight: 700, whiteSpace: 'nowrap' }}>{v.fecha} · {v.nombre}</span>
                      <span style={{ fontSize: 11, color, fontFamily: FONT_MONO, whiteSpace: 'nowrap', marginTop: -3 }}>en {v.dias} días</span>
                    </div>
                  )
                })}
                <span style={{ position: 'absolute', left: 0, top: -4, width: 10, height: 10, borderRadius: '50%', background: C.text, transform: 'translateX(-50%)' }} />
                <span style={{ position: 'absolute', left: 0, top: 10, fontSize: 10.5, color: C.subtle, transform: 'translateX(-50%)' }}>hoy</span>
              </div>
            </div>
          </Tarjeta>
        </div>

        {/* Chat con Orbi */}
        <Tarjeta className="pr-fade-up" style={{ display: 'flex', flexDirection: 'column', padding: 0, animationDelay: '120ms', minHeight: 520, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: `linear-gradient(135deg, ${C.primary}14, ${C.orbi}14)` }}>
            <OrbiAvatar size={32} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15 }}>Orbi · tu contador amigo</div>
              <div style={{ fontSize: 12, color: C.muted }}>Lee tienda, mostrador y Mercado Pago · responde en criollo</div>
            </div>
            <Chip color={C.orbiLight} style={{ fontSize: 11 }}><Sparkles size={11} /> Orienta</Chip>
          </div>
          <div ref={chatRef} className="pr-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mensajes.map(m => <Burbuja key={m.id} rol={m.rol}>{m.texto}</Burbuja>)}
            {pendiente !== null && <Escribiendo />}
          </div>
          <div style={{ padding: '10px 14px 14px', borderTop: `1px solid ${C.border}` }}>
            <div className="pr-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 8 }}>
              {CHIPS.map(q => (
                <button key={q} type="button" className="cc2-chip" disabled={pendiente !== null} onClick={() => preguntar(q)} style={{ flexShrink: 0, padding: '6px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: C.body, background: 'rgba(148,163,184,.08)', border: `1px solid ${C.border}`, fontFamily: FONT }}>
                  {q}
                </button>
              ))}
            </div>
            <form onSubmit={e => { e.preventDefault(); preguntar(texto) }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 14px', borderRadius: 14, background: 'rgba(2,6,23,.6)', border: `1px solid ${C.borderStrong}` }}>
              <input className="cc2-input" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Preguntale a Orbi: ¿qué pasa si vendo 1 palo más?" aria-label="Preguntale a Orbi" style={{ fontSize: 13.5, padding: '6px 0' }} />
              <Boton type="submit" tam="sm" color={C.orbi} disabled={!texto.trim() || pendiente !== null}><Send size={13} /> Enviar</Boton>
            </form>
          </div>
        </Tarjeta>
      </div>

      {/* Carpeta para el contador */}
      <Tarjeta className="pr-fade-up" style={{ marginTop: 16, padding: '18px 20px', animationDelay: '320ms', borderColor: resaltar ? `${ACENTO}88` : undefined, animation: resaltar ? 'cc2-glow-oro 1.2s ease-in-out 2' : undefined, transition: 'border-color .3s' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.9fr)', gap: 22, alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <FolderOpen size={16} color={ACENTO} />
              <Etiqueta color={ACENTO}>Carpeta para el contador</Etiqueta>
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Todo lo de {MES_LABEL}, en un botón</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 14 }}>Orbi junta las ventas de tienda, mostrador y Mercado Pago, discrimina el IVA de cada comprobante y arma un resumen que tu contador entiende sin llamarte.</div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
              {carpeta === 'idle' && <Boton color={ACENTO} onClick={armarCarpeta} style={{ color: '#1F2937' }}><FolderOpen size={15} /> Armar carpeta de {MES_LABEL}</Boton>}
              {carpeta === 'armando' && <Boton color={ACENTO} disabled style={{ color: '#1F2937' }}><span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(31,41,55,.3)', borderTopColor: '#1F2937', animation: 'pr-spin .8s linear infinite' }} /> Armando… {docsListos}/{DOCS.length}</Boton>}
              {(carpeta === 'lista' || carpeta === 'enviando') && (
                <Boton color={C.success} onClick={() => setCarpeta('enviando')} disabled={carpeta === 'enviando'} style={{ color: '#052E1C' }}>
                  <Send size={15} style={{ animation: carpeta === 'enviando' ? 'cc2-vuela .9s ease-in forwards' : undefined }} /> Enviar a {CONTADOR_MAIL}
                </Boton>
              )}
              {carpeta === 'enviada' && (
                <>
                  <Chip color={C.success} style={{ padding: '8px 12px', fontSize: 13 }}><Check size={13} /> Enviada a {CONTADOR_MAIL}</Chip>
                  <Boton variante="fantasma" tam="sm" onClick={() => { setCarpeta('idle'); setDocsListos(0) }}><RotateCcw size={12} /> Armar de nuevo</Boton>
                </>
              )}
              {carpeta !== 'idle' && carpeta !== 'armando' && <span style={{ fontSize: 12.5, color: C.subtle }}>4 archivos · 1,8 MB</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: carpeta === 'idle' ? 0 : 212 }}>
              {carpeta === 'idle' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {DOCS.map(d => {
                    const Icono = d.icono
                    return (
                      <div key={d.nombre} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, border: `1px dashed ${C.border}`, color: C.subtle, fontSize: 12.5 }}>
                        <Icono size={15} /> <span>{d.nombre}</span><span style={{ marginLeft: 'auto', fontFamily: FONT_MONO, fontSize: 11 }}>{d.tipo}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                DOCS.slice(0, Math.max(docsListos, carpeta === 'armando' ? docsListos : DOCS.length)).map((d, i) => {
                  const Icono = d.icono
                  const listo = carpeta !== 'armando' || i < docsListos
                  return (
                    <div key={d.nombre} className="cc2-doc" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: C.surface2, border: `1px solid ${listo ? `${C.success}55` : C.border}`, marginLeft: i * 6, boxShadow: '0 8px 24px rgba(0,0,0,.25)' }}>
                      <span style={{ width: 34, height: 34, borderRadius: 9, background: `${ACENTO}1F`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: ACENTO, flexShrink: 0 }}><Icono size={17} /></span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{d.nombre} <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.subtle, fontWeight: 500 }}>.{d.tipo.toLowerCase()}</span></div>
                        <div style={{ fontSize: 12, color: C.muted }}>{d.detalle}</div>
                      </div>
                      {listo && <span className="cc2-tilde" style={{ width: 22, height: 22, borderRadius: '50%', background: `${C.success}22`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Check size={13} color={C.success} /></span>}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Vista previa del resumen */}
          <div className={carpeta === 'idle' ? undefined : 'cc2-pop'} style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: 12, padding: '18px 20px', boxShadow: '0 20px 60px rgba(0,0,0,.45), inset 0 0 0 1px rgba(148,163,184,.25)', fontFamily: FONT, opacity: carpeta === 'idle' ? 0.55 : 1, transition: 'opacity .4s', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 14, right: 16, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 800 }}>Vista previa · PDF</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: `linear-gradient(135deg, ${C.primary}, ${C.orbi})`, display: 'inline-block' }} />
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15 }}>Resumen de {MES_LABEL} 2026</span>
            </div>
            <div style={{ fontSize: 11.5, color: '#64748B', marginBottom: 12 }}>{NEGOCIO} · {cfg.regimen === 'mono' ? `Monotributo ${cfg.cat}` : 'Responsable inscripto'} · {prov.nombre} · generado por Órbita el {HOY_LABEL}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: '#64748B', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  <th style={{ textAlign: 'left', padding: '4px 0', borderBottom: '1px solid #E2E8F0', fontWeight: 700 }}>Medio de pago</th>
                  <th style={{ textAlign: 'right', padding: '4px 0', borderBottom: '1px solid #E2E8F0', fontWeight: 700 }}>Ventas</th>
                  <th style={{ textAlign: 'right', padding: '4px 0', borderBottom: '1px solid #E2E8F0', fontWeight: 700 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {MEDIOS.map(m => (
                  <tr key={m.nombre}>
                    <td style={{ padding: '5px 0', borderBottom: '1px solid #F1F5F9' }}>{m.nombre}</td>
                    <td style={{ padding: '5px 0', borderBottom: '1px solid #F1F5F9', textAlign: 'right', fontFamily: FONT_MONO, color: '#64748B' }}>{m.ops}</td>
                    <td style={{ padding: '5px 0', borderBottom: '1px solid #F1F5F9', textAlign: 'right', fontFamily: FONT_MONO }}>{formatoARS(MES_ACTUAL * m.share)}</td>
                  </tr>
                ))}
                {cfg.otros > 0 && (
                  <tr>
                    <td style={{ padding: '5px 0', borderBottom: '1px solid #F1F5F9' }}>Declarado fuera de Órbita</td>
                    <td style={{ padding: '5px 0', borderBottom: '1px solid #F1F5F9', textAlign: 'right', fontFamily: FONT_MONO, color: '#64748B' }}>–</td>
                    <td style={{ padding: '5px 0', borderBottom: '1px solid #F1F5F9', textAlign: 'right', fontFamily: FONT_MONO }}>{formatoARS(cfg.otros)}</td>
                  </tr>
                )}
                <tr style={{ fontWeight: 800 }}>
                  <td style={{ padding: '6px 0' }}>Total facturado</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: FONT_MONO, color: '#64748B' }}>363</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: FONT_MONO }}>{formatoARS(calc.facturadoMes)}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 10.5, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>IVA discriminado {cfg.regimen === 'mono' ? '(informativo)' : ''}</div>
                <div style={{ fontSize: 12.5, marginTop: 2 }}>Neto <b style={{ fontFamily: FONT_MONO }}>{formatoARS(calc.facturadoMes / 1.21)}</b></div>
                <div style={{ fontSize: 12.5 }}>IVA 21% <b style={{ fontFamily: FONT_MONO }}>{formatoARS(calc.facturadoMes - calc.facturadoMes / 1.21)}</b></div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <div style={{ fontSize: 10.5, color: '#92400E', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>A pagar en septiembre</div>
                <div style={{ fontSize: 12.5, marginTop: 2 }}>{cfg.regimen === 'mono' ? `Cuota ${cfg.cat}` : 'IVA estimado'} <b style={{ fontFamily: FONT_MONO }}>{formatoARS(cfg.regimen === 'mono' ? calc.cuota : calc.ivaRI)}</b></div>
                <div style={{ fontSize: 12.5 }}>Ing. brutos <b style={{ fontFamily: FONT_MONO }}>{formatoARS(calc.iibb)}</b></div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 10.5, color: '#94A3B8' }}>
              <ShieldCheck size={12} /> Orbi orienta, no reemplaza a tu contador. Escala y alícuotas de ejemplo.
            </div>
          </div>
        </div>
      </Tarjeta>

      {/* Disclaimer permanente */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12, color: C.subtle, flexWrap: 'wrap' }}>
        <ShieldCheck size={13} color={C.muted} />
        <span><b style={{ color: C.muted }}>Orbi orienta, no reemplaza a tu contador.</b> Escala de monotributo y alícuotas de ingresos brutos de ejemplo: se actualizan con la oficial.</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>Fondo impuestos en Órbita: <b style={{ fontFamily: FONT_MONO, color: C.body }}>{formatoARS(APARTADO)}</b> <ArrowRight size={11} /> te faltan <b style={{ fontFamily: FONT_MONO, color: pctApartadoColor }}>{formatoARS(Math.max(0, calc.apartar - APARTADO))}</b></span>
      </div>

      {/* Toast */}
      {toast && (
        <div key={toast} style={{ position: 'absolute', right: 22, bottom: 22, zIndex: 30, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 14, background: 'rgba(15,23,42,.96)', border: `1px solid ${C.success}55`, boxShadow: `0 12px 40px rgba(0,0,0,.5), 0 0 24px ${C.success}22`, animation: 'cc2-toast 2.8s ease both', fontSize: 14, fontWeight: 600 }}>
          <span style={{ width: 24, height: 24, borderRadius: '50%', background: `${C.success}22`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Check size={14} color={C.success} /></span>
          {toast}
        </div>
      )}
    </div>
  )
}
