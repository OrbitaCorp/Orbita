// src/modules/propuestas/prototipos/FotoCatalogo.tsx — Prototipo 8:
// "Catálogo en una Foto". El dueño saca una foto del estante, Orbi
// detecta cada producto, lee la etiqueta de precio, propone nombre,
// categoría y descripción, y el dueño revisa una grilla y publica.
//
// Todo es simulado: la "foto" es una góndola dibujada con CSS/SVG y la
// detección es una línea de tiempo con datos precargados. Un solo
// intervalo (el "reloj") maneja toda la secuencia: cada cosa que se ve
// (recuadros, OCR, tarjetas, descripciones tipeadas) es una función del
// tiempo transcurrido. Sin fetch, sin modelos, sin localStorage.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Camera, Check, LoaderCircle, X, RotateCcw, LayoutGrid, Sparkles, ScanLine, Search,
  Leaf, Wrench, TriangleAlert, Circle, Timer, Zap, Store, Tag,
} from 'lucide-react'
import { C, FONT, FONT_DISPLAY, FONT_MONO, Tarjeta, Chip, Boton, Etiqueta, Pantalla, OrbiAvatar, formatoARS } from '../ui'

// ─── Tipos y datos ───────────────────────────────────────────────────────────

type Fase = 'inicio' | 'escaneo' | 'revision' | 'publicando' | 'publicado'
type EscenaId = 'dietetica' | 'ferreteria'
type Tipo = 'bolsa' | 'frasco' | 'lata' | 'caja' | 'botella' | 'balde' | 'rollo' | 'martillo' | 'cinta' | 'blister'

interface Producto {
  id: string
  nombre: string
  /** Precio real impreso en la etiqueta. */
  precio: number
  /** Lo que "leyó" Orbi (puede diferir si la etiqueta está fea). */
  precioLeido: number
  confianza: number
  categoria: string
  descripcion: string
  tipo: Tipo
  c1: string
  c2: string
  etiqueta: string
  tinta: string
  marca: string
  sub: string
  /** Alto del producto en % del alto de la foto. */
  alto: number
  /** La etiqueta tiene un brillo que la hace difícil de leer. */
  brillo?: boolean
}

interface Escena {
  id: EscenaId
  negocio: string
  rubro: string
  lugar: string
  categorias: string[]
  productos: Producto[]
}

interface Item {
  id: string
  nombre: string
  precioTexto: string
  categoria: string
  revisado: boolean
  quitado: boolean
}

interface Conector { key: string; x1: number; y1: number; x2: number; y2: number }
interface Vuelo { dx: number; dy: number }

const ESCENAS: Record<EscenaId, Escena> = {
  dietetica: {
    id: 'dietetica',
    negocio: 'Dietética Semilla',
    rubro: 'Dietética',
    lugar: 'Góndola 2 · Desayuno y snacks',
    categorias: ['Desayuno', 'Snacks', 'Endulzantes', 'Untables', 'Infusiones', 'Semillas', 'Aceites', 'Otros'],
    productos: [
      { id: 'granola', nombre: 'Granola con miel 500g', precio: 5900, precioLeido: 5900, confianza: 96, categoria: 'Desayuno', descripcion: 'Granola artesanal con miel y almendras. Ideal para el desayuno, sin azúcar agregada.', tipo: 'bolsa', c1: '#D9A45B', c2: '#8C5A22', etiqueta: '#FFF4DC', tinta: '#5B3A12', marca: 'Semilla', sub: 'Granola · 500g', alto: 33 },
      { id: 'frutos', nombre: 'Frutos secos mix 250g', precio: 7400, precioLeido: 7400, confianza: 94, categoria: 'Snacks', descripcion: 'Mix de nueces, almendras y castañas tostadas sin sal. Para picar o sumar a la ensalada.', tipo: 'frasco', c1: '#B7783A', c2: '#5E3A18', etiqueta: '#F8EAD2', tinta: '#4A2C0E', marca: 'Mix', sub: 'Frutos secos', alto: 26 },
      { id: 'miel', nombre: 'Miel pura 500g', precio: 6200, precioLeido: 6200, confianza: 97, categoria: 'Endulzantes', descripcion: 'Miel pura de abeja, sin pasteurizar. De apicultores de Entre Ríos.', tipo: 'frasco', c1: '#F2B233', c2: '#B0690A', etiqueta: '#FFF8E1', tinta: '#7A4A05', marca: 'Colmena', sub: 'Miel pura · 500g', alto: 28 },
      { id: 'mani', nombre: 'Pasta de maní 350g', precio: 4800, precioLeido: 4300, confianza: 71, categoria: 'Untables', descripcion: 'Pasta de maní 100% maní tostado, sin aceite de palma ni azúcar. Cremosa y natural.', tipo: 'frasco', c1: '#A86B3C', c2: '#5C3517', etiqueta: '#3B2A1E', tinta: '#F8EAD2', marca: 'Manisol', sub: 'Pasta · 350g', alto: 24, brillo: true },
      { id: 'matcha', nombre: 'Té matcha 100g', precio: 8900, precioLeido: 8900, confianza: 92, categoria: 'Infusiones', descripcion: 'Matcha en polvo grado ceremonial. Rinde 40 tazas, ideal para lattes.', tipo: 'lata', c1: '#5FA66B', c2: '#2C5E36', etiqueta: '#EAF6E4', tinta: '#1F4A27', marca: 'Kioto', sub: 'Matcha · 100g', alto: 27 },
      { id: 'barritas', nombre: 'Barritas de cereal x6', precio: 3600, precioLeido: 3600, confianza: 95, categoria: 'Snacks', descripcion: 'Seis barritas de avena con chips de chocolate. Sin TACC, para llevar a todos lados.', tipo: 'caja', c1: '#F08A4B', c2: '#B8501E', etiqueta: '#FFF1E6', tinta: '#8A3A12', marca: 'Nutrí', sub: 'Barritas x6', alto: 30 },
      { id: 'chia', nombre: 'Semillas de chía 250g', precio: 2900, precioLeido: 2900, confianza: 93, categoria: 'Semillas', descripcion: 'Semillas de chía seleccionadas, fuente de omega 3 y fibra. Para yogures, licuados y panificados.', tipo: 'bolsa', c1: '#4B5563', c2: '#1F2937', etiqueta: '#E5E7EB', tinta: '#111827', marca: 'Semilla', sub: 'Chía · 250g', alto: 30 },
      { id: 'coco', nombre: 'Aceite de coco 300ml', precio: 7100, precioLeido: 7100, confianza: 90, categoria: 'Aceites', descripcion: 'Aceite de coco virgen prensado en frío. Para cocinar, hornear y cuidar la piel.', tipo: 'botella', c1: '#F5EFE0', c2: '#C9B78F', etiqueta: '#2F6B4F', tinta: '#F1FAF4', marca: 'Cocoa', sub: 'Aceite · 300ml', alto: 34 },
    ],
  },
  ferreteria: {
    id: 'ferreteria',
    negocio: 'Ferretería El Tornillo',
    rubro: 'Ferretería',
    lugar: 'Estante 4 · Herramientas',
    categorias: ['Herramientas manuales', 'Herramientas eléctricas', 'Medición', 'Pinturas', 'Fijaciones', 'Seguridad', 'Eléctrico', 'Otros'],
    productos: [
      { id: 'martillo', nombre: 'Martillo carpintero 16 oz', precio: 9800, precioLeido: 9800, confianza: 95, categoria: 'Herramientas manuales', descripcion: 'Martillo de carpintero con mango de madera y cabeza forjada. Para clavar y sacar clavos sin esfuerzo.', tipo: 'martillo', c1: '#C8CDD6', c2: '#5B6472', etiqueta: '#B07B3F', tinta: '#3B2A1E', marca: 'Yunque', sub: '16 oz', alto: 34 },
      { id: 'cinta', nombre: 'Cinta métrica 5 m', precio: 4200, precioLeido: 4200, confianza: 93, categoria: 'Medición', descripcion: 'Cinta métrica de 5 metros con freno y clip para el cinturón. Hoja de acero con recubrimiento.', tipo: 'cinta', c1: '#FACC15', c2: '#B45309', etiqueta: '#1F2937', tinta: '#FDE68A', marca: 'Metro', sub: '5 m', alto: 24 },
      { id: 'destornilladores', nombre: 'Destornilladores x6', precio: 6500, precioLeido: 6500, confianza: 91, categoria: 'Herramientas manuales', descripcion: 'Juego de seis destornilladores planos y Phillips con mango ergonómico. Puntas imantadas.', tipo: 'blister', c1: '#EF4444', c2: '#7F1D1D', etiqueta: '#FEE2E2', tinta: '#7F1D1D', marca: 'Torque', sub: 'Juego x6', alto: 33 },
      { id: 'pintura', nombre: 'Pintura látex 4 L', precio: 18900, precioLeido: 18900, confianza: 96, categoria: 'Pinturas', descripcion: 'Látex interior blanco mate de 4 litros. Rinde 40 m² por mano, lavable y sin olor.', tipo: 'balde', c1: '#F1F5F9', c2: '#94A3B8', etiqueta: '#2563EB', tinta: '#EFF6FF', marca: 'Muralla', sub: 'Látex · 4 L', alto: 32 },
      { id: 'taladro', nombre: 'Taladro percutor 650 W', precio: 54900, precioLeido: 54900, confianza: 94, categoria: 'Herramientas eléctricas', descripcion: 'Taladro percutor de 650 W con mandril de 13 mm y velocidad variable. Incluye maletín.', tipo: 'caja', c1: '#1E293B', c2: '#0F172A', etiqueta: '#22C55E', tinta: '#052E16', marca: 'Voltio', sub: 'Taladro 650 W', alto: 32 },
      { id: 'tornillos', nombre: 'Tornillos caja x100', precio: 2300, precioLeido: 2800, confianza: 68, categoria: 'Fijaciones', descripcion: 'Caja de cien tornillos autoperforantes 8 x 1". Para madera y chapa fina.', tipo: 'caja', c1: '#D6C6A8', c2: '#9C8560', etiqueta: '#FFFBEB', tinta: '#57431A', marca: 'Fijatex', sub: 'x100', alto: 22, brillo: true },
      { id: 'guantes', nombre: 'Guantes de trabajo', precio: 3100, precioLeido: 3100, confianza: 92, categoria: 'Seguridad', descripcion: 'Guantes de trabajo reforzados con palma antideslizante. Talle único, lavables.', tipo: 'blister', c1: '#F59E0B', c2: '#78350F', etiqueta: '#FEF3C7', tinta: '#78350F', marca: 'Manos', sub: 'Par · talle único', alto: 30 },
      { id: 'aisladora', nombre: 'Cinta aisladora 20 m', precio: 1500, precioLeido: 1500, confianza: 90, categoria: 'Eléctrico', descripcion: 'Cinta aisladora negra de 20 metros, ignífuga. Para empalmes y aislación básica.', tipo: 'rollo', c1: '#334155', c2: '#020617', etiqueta: '#FDE047', tinta: '#1F2937', marca: 'Aisla', sub: '20 m', alto: 20 },
    ],
  },
}

// Línea de tiempo (ms desde que se toca el obturador).
const T_FLASH = 350
const T_SCAN = 1500
const T_FIN = 5000
const T_PUBLICANDO = 1700
const T_CIERRE = 3200
const CENTROS = [14, 38, 62, 86]

function tDeteccion(i: number) {
  const fila = Math.floor(i / 4)
  const col = i % 4
  return (fila === 0 ? 760 : 1420) + col * 130
}
const tTarjeta = (i: number) => tDeteccion(i) + 320
const tOcr = (i: number) => tDeteccion(i) + 380
const tDescripcion = (i: number) => tDeteccion(i) + 1000

/** Dónde está cada producto en la foto (en % del ancho/alto). */
function posicion(i: number, alto: number) {
  const fila = Math.floor(i / 4)
  const col = i % 4
  const estante = fila === 0 ? 45.5 : 91.5
  const centro = CENTROS[col]
  const w = alto * 0.577
  return { x: centro - w / 2, y: estante - alto, w, h: alto, estante, centro }
}

function parsearPrecio(texto: string) {
  const n = Number(texto.replace(/\D/g, ''))
  return Number.isFinite(n) ? n : 0
}

function itemsDe(escena: Escena): Item[] {
  return escena.productos.map(p => ({ id: p.id, nombre: p.nombre, precioTexto: formatoARS(p.precioLeido), categoria: p.categoria, revisado: false, quitado: false }))
}

const CSS = `
  @keyframes fc-flash { 0% { opacity: 1; } 100% { opacity: 0; } }
  @keyframes fc-scan { 0% { top: -10%; } 100% { top: 106%; } }
  @keyframes fc-conector { 0% { stroke-dashoffset: 100; opacity: 1; } 55% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 0; } }
  @keyframes fc-viajar { 0% { transform: translate(0, 0) scale(1); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) scale(.06); opacity: 0; } }
  @keyframes fc-ocr { 0% { background-position: -120% 0; } 100% { background-position: 220% 0; } }
  @keyframes fc-barra { from { width: 0; } to { width: var(--w); } }
  @keyframes fc-pop { 0% { transform: scale(.5); opacity: 0; } 60% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
  @keyframes fc-obturador { 0% { transform: scale(1); } 50% { transform: scale(.82); } 100% { transform: scale(1); } }
  @keyframes fc-latido { 0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,.55); } 50% { box-shadow: 0 0 0 10px rgba(139,92,246,0); } }
  @keyframes fc-glow { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
  @keyframes fc-rejilla { from { opacity: 0; } to { opacity: 1; } }
  .fc-viajar { animation: fc-viajar .72s cubic-bezier(.55,-.05,.3,1) both; }
  .fc-pop { animation: fc-pop .45s cubic-bezier(.2,.8,.2,1) both; }
  .fc-obturador:hover .fc-obt-int { transform: scale(.92); }
  .fc-obturador:active .fc-obt-int { transform: scale(.8); }
  .fc-obt-int { transition: transform .15s; }
  .fc-select { background: rgba(2,6,23,.6); border: 1px solid rgba(148,163,184,.25); color: #F8FAFC; border-radius: 8px; padding: 5px 8px; font: inherit; font-size: 12px; outline: none; width: 100%; }
  .fc-select:focus { border-color: #60A5FA; box-shadow: 0 0 0 3px rgba(59,130,246,.25); }
  .fc-mini { background: rgba(2,6,23,.6); border: 1px solid rgba(148,163,184,.25); color: #F8FAFC; border-radius: 8px; padding: 5px 8px; font: inherit; font-size: 12.5px; outline: none; width: 100%; transition: border-color .2s, box-shadow .2s; }
  .fc-mini:focus { border-color: #60A5FA; box-shadow: 0 0 0 3px rgba(59,130,246,.25); }
  .fc-quitar { opacity: .45; transition: opacity .15s, color .15s; }
  .fc-quitar:hover { opacity: 1; color: #F87171; }
  @media (prefers-reduced-motion: reduce) { .fc-viajar, .fc-pop { animation-duration: .01s; } }
`

// ─── Ilustración de los productos (SVG) ──────────────────────────────────────

function Rotulo({ x, y, w, h, p, r = 5, fs = 8.5 }: { x: number; y: number; w: number; h: number; p: Producto; r?: number; fs?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={r} fill={p.etiqueta} />
      <rect x={x} y={y} width={w} height={h} rx={r} fill="url(#fc-brillo-rot)" opacity={0.5} />
      <text x={x + w / 2} y={y + h * 0.47} textAnchor="middle" fontSize={fs} fontWeight={800} fill={p.tinta} fontFamily={FONT_DISPLAY} letterSpacing="-0.02em">{p.marca}</text>
      <text x={x + w / 2} y={y + h * 0.78} textAnchor="middle" fontSize={fs * 0.72} fontWeight={600} fill={p.tinta} opacity={0.78} fontFamily={FONT}>{p.sub}</text>
    </g>
  )
}

function Forma({ p, uid }: { p: Producto; uid: string }) {
  const g = `fc-${uid}`
  const cil = `url(#${g}-cil)`
  const plano = `url(#${g}-plano)`
  let cuerpo: ReactNode
  switch (p.tipo) {
    case 'bolsa':
      cuerpo = (
        <>
          <path d="M18 14 L82 14 L88 118 Q88 124 82 124 L18 124 Q12 124 12 118 Z" fill={cil} />
          <path d="M18 14 L82 14 L82.6 24 L17.4 24 Z" fill="rgba(255,255,255,.22)" />
          <path d="M18 14 L82 14 L82.4 18 L17.6 18 Z" fill="rgba(0,0,0,.18)" />
          <path d="M20 30 L24 116" stroke="rgba(255,255,255,.22)" strokeWidth={5} strokeLinecap="round" />
          <Rotulo x={24} y={50} w={52} h={44} p={p} />
        </>
      )
      break
    case 'frasco':
      cuerpo = (
        <>
          <rect x={26} y={6} width={48} height={18} rx={4} fill={`url(#${g}-tapa)`} />
          <rect x={26} y={12} width={48} height={2} fill="rgba(0,0,0,.18)" />
          <rect x={30} y={22} width={40} height={8} fill="rgba(255,255,255,.25)" />
          <rect x={18} y={28} width={64} height={96} rx={12} fill={cil} />
          <rect x={18} y={28} width={64} height={96} rx={12} fill="url(#fc-vidrio)" />
          <rect x={24} y={38} width={6} height={76} rx={3} fill="rgba(255,255,255,.28)" />
          <Rotulo x={26} y={62} w={48} h={36} p={p} fs={8} />
        </>
      )
      break
    case 'lata':
      cuerpo = (
        <>
          <ellipse cx={50} cy={122} rx={30} ry={5} fill={p.c2} />
          <rect x={20} y={16} width={60} height={106} rx={2} fill={cil} />
          <rect x={20} y={46} width={60} height={50} fill={p.etiqueta} />
          <rect x={20} y={46} width={60} height={50} fill={cil} opacity={0.18} />
          <text x={50} y={68} textAnchor="middle" fontSize={9} fontWeight={800} fill={p.tinta} fontFamily={FONT_DISPLAY}>{p.marca}</text>
          <text x={50} y={82} textAnchor="middle" fontSize={6.2} fontWeight={600} fill={p.tinta} opacity={0.8} fontFamily={FONT}>{p.sub}</text>
          <ellipse cx={50} cy={16} rx={30} ry={7} fill={p.c1} />
          <ellipse cx={50} cy={16} rx={24} ry={5} fill={p.c2} opacity={0.5} />
          <ellipse cx={50} cy={16} rx={30} ry={7} fill="none" stroke="rgba(255,255,255,.45)" strokeWidth={1} />
        </>
      )
      break
    case 'caja':
      cuerpo = (
        <>
          <path d="M84 30 L92 22 L92 114 L84 122 Z" fill={p.c2} />
          <path d="M14 30 L22 22 L92 22 L84 30 Z" fill={p.c1} opacity={0.85} />
          <path d="M14 30 L22 22 L92 22 L84 30 Z" fill="rgba(255,255,255,.25)" />
          <rect x={14} y={30} width={70} height={92} fill={plano} />
          <rect x={14} y={30} width={70} height={92} fill="url(#fc-luz)" />
          {p.id === 'taladro' ? (
            <g>
              <path d="M28 92 h26 v9 h-10 v14 h-9 v-14 h-7 z" fill="#22C55E" />
              <rect x={54} y={94} width={16} height={5} rx={1} fill="#CBD5E1" />
            </g>
          ) : null}
          <Rotulo x={22} y={46} w={54} h={40} p={p} />
        </>
      )
      break
    case 'botella':
      cuerpo = (
        <>
          <rect x={40} y={4} width={20} height={13} rx={3} fill={p.c2} />
          <path d="M42 16 L58 16 L58 30 Q78 40 78 58 L78 116 Q78 124 70 124 L30 124 Q22 124 22 116 L22 58 Q22 40 42 30 Z" fill={cil} />
          <path d="M42 16 L58 16 L58 30 Q78 40 78 58 L78 116 Q78 124 70 124 L30 124 Q22 124 22 116 L22 58 Q22 40 42 30 Z" fill="url(#fc-vidrio)" />
          <rect x={28} y={56} width={5} height={58} rx={2.5} fill="rgba(255,255,255,.4)" />
          <Rotulo x={30} y={66} w={40} h={36} p={p} fs={7.5} />
        </>
      )
      break
    case 'balde':
      cuerpo = (
        <>
          <path d="M20 36 Q50 2 80 36" stroke="#94A3B8" strokeWidth={3} fill="none" strokeLinecap="round" />
          <rect x={14} y={30} width={72} height={9} rx={3} fill={p.c2} />
          <rect x={14} y={30} width={72} height={4} rx={2} fill="rgba(255,255,255,.35)" />
          <path d="M16 39 L84 39 L78 124 L22 124 Z" fill={cil} />
          <Rotulo x={24} y={56} w={52} h={44} p={p} />
        </>
      )
      break
    case 'rollo':
      cuerpo = (
        <>
          <circle cx={50} cy={76} r={46} fill={`url(#${g}-rad)`} />
          <circle cx={50} cy={76} r={46} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={1} />
          <circle cx={50} cy={76} r={40} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={6} strokeDasharray="2 3" />
          <circle cx={50} cy={76} r={21} fill="#1E293B" />
          <circle cx={50} cy={76} r={15} fill="#0B1120" />
          <Rotulo x={30} y={100} w={40} h={16} p={p} r={4} fs={6.5} />
        </>
      )
      break
    case 'martillo':
      cuerpo = (
        <>
          <rect x={43} y={34} width={14} height={90} rx={5} fill={`url(#${g}-madera)`} />
          <rect x={45} y={40} width={3} height={78} rx={1.5} fill="rgba(255,255,255,.18)" />
          <path d="M18 14 L60 14 Q68 14 68 22 L68 34 L18 34 Q12 34 12 26 L12 22 Q12 14 18 14 Z" fill={plano} />
          <path d="M60 14 Q86 8 90 30 L80 36 Q78 24 62 24 Z" fill={p.c2} />
          <path d="M18 14 L60 14 Q68 14 68 22 L18 22 Q14 22 14 18 Z" fill="rgba(255,255,255,.28)" />
          <Rotulo x={30} y={70} w={40} h={18} p={p} r={3} fs={6.5} />
        </>
      )
      break
    case 'cinta':
      cuerpo = (
        <>
          <rect x={16} y={34} width={68} height={74} rx={16} fill={plano} />
          <rect x={26} y={44} width={48} height={54} rx={12} fill={p.c2} />
          <rect x={30} y={48} width={40} height={46} rx={10} fill={`url(#${g}-plano)`} opacity={0.35} />
          <rect x={6} y={92} width={18} height={10} rx={2} fill="#CBD5E1" />
          <rect x={64} y={28} width={9} height={32} rx={3} fill="#94A3B8" />
          <Rotulo x={32} y={58} w={36} h={24} p={p} r={4} fs={7} />
        </>
      )
      break
    case 'blister':
      cuerpo = (
        <>
          <rect x={14} y={10} width={72} height={114} rx={6} fill={p.etiqueta} />
          <rect x={44} y={16} width={12} height={5} rx={2.5} fill="#3B2A1E" opacity={0.8} />
          <rect x={22} y={40} width={56} height={76} rx={8} fill={cil} opacity={0.92} />
          {p.id === 'destornilladores' ? (
            <g>
              {[0, 1, 2, 3, 4, 5].map(k => (
                <g key={k}>
                  <rect x={27 + k * 8.4} y={50} width={5} height={30} rx={2} fill={k % 2 ? '#FCD34D' : '#F87171'} />
                  <rect x={28.5 + k * 8.4} y={80} width={2} height={28} fill="#E2E8F0" />
                </g>
              ))}
            </g>
          ) : (
            <path d="M34 54 Q30 70 34 92 L40 110 Q50 118 62 108 L68 84 Q72 66 64 56 Q50 50 34 54 Z" fill="rgba(255,255,255,.2)" />
          )}
          <rect x={22} y={40} width={56} height={76} rx={8} fill="url(#fc-vidrio)" />
          <text x={50} y={32} textAnchor="middle" fontSize={8} fontWeight={800} fill={p.tinta} fontFamily={FONT_DISPLAY}>{p.marca}</text>
          <text x={50} y={122} textAnchor="middle" fontSize={6} fontWeight={600} fill={p.tinta} opacity={0.8} fontFamily={FONT}>{p.sub}</text>
        </>
      )
      break
  }
  return (
    <svg viewBox="0 0 100 130" width="100%" height="100%" preserveAspectRatio="xMidYMax meet" style={{ display: 'block', overflow: 'visible' }} aria-hidden>
      <defs>
        <linearGradient id={`${g}-cil`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={p.c2} />
          <stop offset=".3" stopColor={p.c1} />
          <stop offset=".55" stopColor={p.c1} />
          <stop offset="1" stopColor={p.c2} />
        </linearGradient>
        <linearGradient id={`${g}-plano`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={p.c1} />
          <stop offset="1" stopColor={p.c2} />
        </linearGradient>
        <linearGradient id={`${g}-tapa`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#4B5563" />
          <stop offset=".4" stopColor="#D1D5DB" />
          <stop offset="1" stopColor="#374151" />
        </linearGradient>
        <linearGradient id={`${g}-madera`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#7C4A1E" />
          <stop offset=".45" stopColor="#C58A4A" />
          <stop offset="1" stopColor="#6B3D15" />
        </linearGradient>
        <radialGradient id={`${g}-rad`} cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor={p.c1} />
          <stop offset="1" stopColor={p.c2} />
        </radialGradient>
        <linearGradient id="fc-vidrio" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".18" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".18" />
        </linearGradient>
        <linearGradient id="fc-luz" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".14" />
          <stop offset="1" stopColor="#000" stopOpacity=".2" />
        </linearGradient>
        <linearGradient id="fc-brillo-rot" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id="fc-sombra" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>
      <ellipse cx={50} cy={125} rx={40} ry={4} fill="#000" opacity={0.4} filter="url(#fc-sombra)" />
      {cuerpo}
    </svg>
  )
}

// ─── Góndola (la "foto") ─────────────────────────────────────────────────────

function Estante({ top }: { top: number }) {
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: `${top - 2.6}%`, height: '2.6%', background: 'linear-gradient(180deg, #C89A5F, #A87A44)', clipPath: 'polygon(1.5% 0, 98.5% 0, 100% 100%, 0 100%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: `${top}%`, height: '5.6%', background: 'linear-gradient(180deg, #8C5E33 0%, #6E4524 55%, #4E2F17 100%)', boxShadow: '0 6px 14px rgba(0,0,0,.45)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, rgba(0,0,0,.07) 0 2px, transparent 2px 13px)', opacity: 0.8 }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: '14%', height: '68%', background: 'linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.04))', borderTop: '1px solid rgba(255,255,255,.18)', borderBottom: '1px solid rgba(0,0,0,.35)' }} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: `${top + 5.6}%`, height: '7%', background: 'linear-gradient(180deg, rgba(0,0,0,.4), transparent)' }} />
    </>
  )
}

function EtiquetaPrecio({ p, i, ocr, leida }: { p: Producto; i: number; ocr: boolean; leida: boolean }) {
  const pos = posicion(i, p.alto)
  const texto = formatoARS(p.precio)
  const rot = i % 2 === 0 ? -1.2 : 1.4
  return (
    <div style={{ position: 'absolute', left: `${pos.centro - 5.8}%`, top: `${pos.estante + 0.9}%`, width: '11.6%', height: '4.6%', transform: `rotate(${rot}deg)` }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #FFFDF5, #F4ECD8)', borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,.45), inset 0 0 0 1px rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', outline: ocr ? '2px solid #A78BFA' : leida ? '1.5px solid rgba(52,211,153,.9)' : '0 solid transparent', outlineOffset: 1, transition: 'outline-color .3s' }}>
        <span style={{ fontFamily: FONT_MONO, fontWeight: 800, fontSize: 'clamp(8px, 1.9vw, 11.5px)', color: '#1C1917', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {p.brillo ? (
            <>{texto.slice(0, 3)}<span style={{ opacity: 0.32 }}>{texto.slice(3, 4)}</span>{texto.slice(4)}</>
          ) : texto}
        </span>
        <span style={{ position: 'absolute', left: 3, bottom: 1, fontSize: 5, color: '#78716C', fontFamily: FONT_MONO, letterSpacing: '0.1em' }}>{p.id.slice(0, 3).toUpperCase()}-{String(i + 1).padStart(2, '0')}</span>
        {p.brillo ? <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(112deg, transparent 38%, rgba(255,255,255,.95) 50%, transparent 62%)' }} /> : null}
        {ocr ? <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent 0%, rgba(167,139,250,.55) 50%, transparent 100%)', backgroundSize: '60% 100%', backgroundRepeat: 'no-repeat', animation: 'fc-ocr .7s linear infinite' }} /> : null}
      </div>
    </div>
  )
}

function Gondola({ escena, ocrActivo, leidas }: { escena: Escena; ocrActivo: Set<string>; leidas: Set<string> }) {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #57402B 0%, #3D2A1B 45%, #2A1B10 100%)', overflow: 'hidden' }}>
      {/* pared con luz cálida */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 18% -10%, rgba(255,214,160,.55), transparent 55%), radial-gradient(ellipse at 90% 40%, rgba(255,180,120,.12), transparent 50%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, rgba(255,255,255,.025) 0 1px, transparent 1px 34px), repeating-linear-gradient(180deg, rgba(0,0,0,.05) 0 1px, transparent 1px 34px)' }} />
      <Estante top={45.5} />
      <Estante top={91.5} />
      {escena.productos.map((p, i) => {
        const pos = posicion(i, p.alto)
        return (
          <div key={p.id} style={{ position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`, width: `${pos.w}%`, height: `${pos.h}%` }}>
            <Forma p={p} uid={`f-${p.id}`} />
          </div>
        )
      })}
      {escena.productos.map((p, i) => <EtiquetaPrecio key={p.id} p={p} i={i} ocr={ocrActivo.has(p.id)} leida={leidas.has(p.id)} />)}
      {/* viñeta y grano */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,.5) 100%)', pointerEvents: 'none' }} />
    </div>
  )
}

// ─── Recuadro de detección ───────────────────────────────────────────────────

type EstadoCaja = 'oculta' | 'detectando' | 'ok' | 'baja' | 'quitada' | 'publicada'

function colorCaja(e: EstadoCaja) {
  if (e === 'baja') return C.warning
  if (e === 'quitada') return C.subtle
  if (e === 'publicada') return C.success
  return C.primaryLight
}

function Recuadro({ p, i, estado, etiqueta, ocrTexto, cajaRef }: { p: Producto; i: number; estado: EstadoCaja; etiqueta: string; ocrTexto: string | null; cajaRef: (el: HTMLDivElement | null) => void }) {
  const pos = posicion(i, p.alto)
  const col = colorCaja(estado)
  const visible = estado !== 'oculta'
  const esquina = (s: CSSProperties) => <span style={{ position: 'absolute', width: 10, height: 10, borderColor: col, borderStyle: 'solid', borderWidth: 0, transition: 'border-color .3s', ...s }} />
  return (
    <div ref={cajaRef} style={{ position: 'absolute', left: `${pos.x - 1.2}%`, top: `${pos.y - 1.5}%`, width: `${pos.w + 2.4}%`, height: `${pos.h + 2.2}%`, opacity: visible ? (estado === 'quitada' ? 0.45 : 1) : 0, transition: 'opacity .3s', pointerEvents: 'none' }}>
      {visible ? (
        <>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden>
            <rect x={0} y={0} width={100} height={100} rx={3} fill={`${col}14`} stroke={col} strokeWidth={1.6} vectorEffect="non-scaling-stroke" pathLength={100} strokeDasharray="100" strokeDashoffset="100" style={{ animation: 'pr-dash .55s ease-out forwards', transition: 'stroke .3s' }} />
            <rect x={0} y={0} width={100} height={100} rx={3} fill="none" stroke={col} strokeWidth={1.2} vectorEffect="non-scaling-stroke" strokeDasharray="5 4" opacity={0.8} style={{ animation: 'pr-fade-in .3s .5s both', transition: 'stroke .3s' }} />
          </svg>
          {esquina({ left: -2, top: -2, borderLeftWidth: 2.5, borderTopWidth: 2.5, borderTopLeftRadius: 3 })}
          {esquina({ right: -2, top: -2, borderRightWidth: 2.5, borderTopWidth: 2.5, borderTopRightRadius: 3 })}
          {esquina({ left: -2, bottom: -2, borderLeftWidth: 2.5, borderBottomWidth: 2.5, borderBottomLeftRadius: 3 })}
          {esquina({ right: -2, bottom: -2, borderRightWidth: 2.5, borderBottomWidth: 2.5, borderBottomRightRadius: 3 })}
          <div className="pr-fade-up" style={{ position: 'absolute', left: -2, top: -24, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 6, background: `${col}`, color: estado === 'baja' ? '#1C1917' : '#fff', fontSize: 10, fontWeight: 800, letterSpacing: '0.01em', whiteSpace: 'nowrap', boxShadow: `0 4px 14px ${col}66`, transition: 'background .3s' }}>
            {estado === 'publicada' ? <Check size={10} strokeWidth={3} /> : estado === 'quitada' ? <X size={10} strokeWidth={3} /> : estado === 'baja' ? <TriangleAlert size={10} strokeWidth={2.5} /> : null}
            {etiqueta}
          </div>
          {ocrTexto !== null ? (
            <div className="pr-fade-in" style={{ position: 'absolute', left: '50%', top: 'calc(100% + 3px)', transform: 'translateX(-50%)', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 6, background: 'rgba(15,23,42,.92)', border: `1px solid ${C.orbiLight}`, color: C.orbiLight, fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(139,92,246,.4)', zIndex: 3 }}>
              <ScanLine size={10} />
              {ocrTexto}
              <span style={{ width: 1.5, height: 11, background: C.orbiLight, animation: 'pr-blink .6s step-end infinite' }} />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

// ─── Tarjeta de producto (grilla de revisión) ────────────────────────────────

function Confianza({ valor, color }: { valor: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'rgba(148,163,184,.15)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${valor}%`, background: `linear-gradient(90deg, ${color}99, ${color})`, borderRadius: 99, transition: 'width .6s cubic-bezier(.2,.8,.2,1), background .4s' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: FONT_MONO, minWidth: 30, textAlign: 'right', transition: 'color .3s' }}>{valor}%</span>
    </div>
  )
}

function TarjetaProducto({
  p, item, categorias, descripcionTipeada, tipeando, vuelo, indice, tarjetaRef, onCambio, onQuitar,
}: {
  p: Producto; item: Item; categorias: string[]; descripcionTipeada: string; tipeando: boolean; vuelo?: Vuelo; indice: number
  tarjetaRef: (el: HTMLDivElement | null) => void
  onCambio: (cambio: Partial<Item>) => void
  onQuitar: () => void
}) {
  const baja = !item.revisado && p.confianza < 85
  const col = item.revisado ? C.success : baja ? C.warning : C.primaryLight
  const confianza = item.revisado ? Math.max(p.confianza, 99) : p.confianza
  const estiloVuelo: CSSProperties | undefined = vuelo ? ({ '--dx': `${vuelo.dx}px`, '--dy': `${vuelo.dy}px`, animationDelay: `${indice * 70}ms` } as CSSProperties) : undefined
  return (
    <div ref={tarjetaRef} className={vuelo ? 'fc-viajar' : 'pr-fade-up'} style={{ ...estiloVuelo, transformOrigin: 'center' }}>
      <Tarjeta style={{ padding: 12, borderColor: baja ? `${C.warning}66` : item.revisado ? `${C.success}55` : C.border, boxShadow: baja ? `0 0 0 1px ${C.warning}22, 0 10px 30px rgba(251,191,36,.08)` : item.revisado ? `0 0 0 1px ${C.success}22` : 'none', transition: 'border-color .4s, box-shadow .4s', position: 'relative' }}>
        <button type="button" className="pr-btn fc-quitar" onClick={onQuitar} aria-label={`Quitar ${item.nombre}`} title="Quitar" style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 6, border: 'none', background: 'rgba(148,163,184,.12)', color: C.body, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
          <X size={12} />
        </button>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div title="Recorte de la foto" style={{ width: 50, height: 58, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(180deg, #57402B, #2A1B10)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08), 0 4px 12px rgba(0,0,0,.4)', padding: '6px 6px 3px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 0%, rgba(255,214,160,.45), transparent 60%)' }} />
            <div style={{ position: 'relative', width: '100%', height: '100%' }}><Forma p={p} uid={`m-${p.id}`} /></div>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 22 }}>
            <input className="fc-mini" aria-label="Nombre del producto" value={item.nombre} onChange={e => onCambio({ nombre: e.target.value })} style={{ fontWeight: 700 }} />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input className="fc-mini" aria-label="Precio" value={item.precioTexto} onChange={e => onCambio({ precioTexto: e.target.value, revisado: true })} style={{ width: 82, fontFamily: FONT_MONO, fontWeight: 700, borderColor: baja ? `${C.warning}99` : undefined }} />
              <Chip color={col} style={{ fontSize: 10.5, padding: '3px 8px', transition: 'all .3s' }}>
                {item.revisado ? <><Check size={10} strokeWidth={3} /> Confirmado por vos</> : baja ? <><TriangleAlert size={10} /> Revisá el precio · {p.confianza}%</> : <><Tag size={10} /> Leído de la etiqueta · {Math.min(99, p.confianza + 2)}%</>}
              </Chip>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <select className="fc-select" aria-label="Categoría" value={item.categoria} onChange={e => onCambio({ categoria: e.target.value })}>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 11.5, lineHeight: 1.45, color: C.body, minHeight: 50 }}>
          <Sparkles size={10} style={{ display: 'inline', verticalAlign: '-1px', color: C.orbiLight, marginRight: 4 }} />
          {descripcionTipeada}
          {tipeando ? <span style={{ display: 'inline-block', width: 1.5, height: 11, background: C.orbiLight, verticalAlign: '-1px', marginLeft: 1, animation: 'pr-blink .6s step-end infinite' }} /> : null}
        </p>
        <div style={{ marginTop: 8 }}><Confianza valor={confianza} color={col} /></div>
      </Tarjeta>
    </div>
  )
}

// ─── Vista final: la tienda en el celular ────────────────────────────────────

function TiendaCelular({ escena, items }: { escena: Escena; items: Item[] }) {
  const Icono = escena.id === 'dietetica' ? Leaf : Wrench
  const acento = escena.id === 'dietetica' ? '#2F6B4F' : '#B45309'
  return (
    <Pantalla tipo="celular" ancho={330}>
      <div className="pr-scroll" style={{ padding: '46px 14px 16px', maxHeight: 640, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 36, height: 36, borderRadius: 12, background: acento, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}><Icono size={18} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{escena.negocio}</div>
            <div style={{ fontSize: 11, color: '#64748B' }}>Catálogo · {items.length} productos</div>
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 12, background: '#F1F5F9', color: '#94A3B8', fontSize: 12 }}>
          <Search size={14} /> Buscar en {escena.rubro.toLowerCase()}…
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
          {['Todos', ...escena.categorias.slice(0, 3)].map((c, k) => (
            <span key={c} style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', background: k === 0 ? '#0F172A' : '#F1F5F9', color: k === 0 ? '#fff' : '#475569' }}>{c}</span>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          {items.map((it, k) => {
            const p = escena.productos.find(x => x.id === it.id)
            if (!p) return null
            return (
              <div key={it.id} className="pr-fade-up" style={{ animationDelay: `${120 + k * 70}ms`, borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden', background: '#fff' }}>
                <div style={{ position: 'relative', height: 96, background: 'linear-gradient(180deg, #FFF7E6, #F3E4C8)', padding: '10px 22px 4px' }}>
                  <div style={{ width: '100%', height: '100%' }}><Forma p={p} uid={`t-${p.id}`} /></div>
                  <span style={{ position: 'absolute', top: 6, left: 6, padding: '2px 7px', borderRadius: 999, background: '#16A34A', color: '#fff', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Nuevo</span>
                </div>
                <div style={{ padding: '8px 9px 10px' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: '#0F172A', lineHeight: 1.25, minHeight: 28, overflow: 'hidden' }}>{it.nombre}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{formatoARS(parsearPrecio(it.precioTexto))}</span>
                    <span style={{ fontSize: 9.5, color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 70 }}>{it.categoria}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <button type="button" className="pr-btn" style={{ marginTop: 14, width: '100%', padding: '11px', borderRadius: 12, border: 'none', background: C.primary, color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: FONT }}>Ver todo el catálogo</button>
      </div>
    </Pantalla>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────

const PASOS: { id: string; nombre: string }[] = [
  { id: 'foto', nombre: 'Foto' },
  { id: 'deteccion', nombre: 'Detección' },
  { id: 'revision', nombre: 'Revisión' },
  { id: 'publicado', nombre: 'Publicado' },
]

function indicePaso(f: Fase) {
  if (f === 'inicio') return 0
  if (f === 'escaneo') return 1
  if (f === 'revision' || f === 'publicando') return 2
  return 3
}

export default function FotoCatalogo() {
  const [escenaId, setEscenaId] = useState<EscenaId>('dietetica')
  const escena = ESCENAS[escenaId]
  const [fase, setFase] = useState<Fase>('inicio')
  const [reloj, setReloj] = useState(0)
  const [items, setItems] = useState<Item[]>(() => itemsDe(ESCENAS.dietetica))
  const [conectores, setConectores] = useState<Conector[]>([])
  const [vuelos, setVuelos] = useState<Record<string, Vuelo>>({})

  const t0 = useRef(0)
  const contRef = useRef<HTMLDivElement | null>(null)
  const grillaRef = useRef<HTMLDivElement | null>(null)
  const destinoRef = useRef<HTMLDivElement | null>(null)
  const cajasRef = useRef(new Map<string, HTMLDivElement>())
  const tarjetasRef = useRef(new Map<string, HTMLDivElement>())
  const conectadosRef = useRef(new Set<string>())

  // El reloj: un solo intervalo que avanza la fase que esté corriendo.
  useEffect(() => {
    if (fase !== 'escaneo' && fase !== 'publicando' && fase !== 'publicado') return
    const limite = fase === 'escaneo' ? T_FIN : fase === 'publicando' ? T_PUBLICANDO : T_CIERRE
    // El origen del reloj se marca acá (efecto) y no en los handlers: el
    // react-compiler no permite Date.now() en funciones que considera de render.
    t0.current = Date.now()
    const id = window.setInterval(() => {
      const t = Date.now() - t0.current
      if (t >= limite) {
        window.clearInterval(id)
        setReloj(limite)
        if (fase === 'escaneo') setFase('revision')
        if (fase === 'publicando') { setReloj(0); setFase('publicado') }
      } else {
        setReloj(t)
      }
    }, 40)
    return () => window.clearInterval(id)
  }, [fase])

  const completo = fase === 'revision' || fase === 'publicando' || fase === 'publicado'
  const escaneando = fase === 'escaneo'
  const productos = escena.productos
  const detectado = (i: number) => completo || (escaneando && reloj >= tDeteccion(i))
  const conTarjeta = (i: number) => completo || (escaneando && reloj >= tTarjeta(i))
  const ocrDesde = (i: number) => (escaneando ? reloj - tOcr(i) : Infinity)

  const visibles = items.filter((it, i) => !it.quitado && conTarjeta(i))
  const listos = items.filter(it => !it.quitado)
  const claveVisibles = visibles.map(v => v.id).join('|')

  // Conectores foto → tarjeta: se miden cuando aparece cada tarjeta.
  useEffect(() => {
    if (!claveVisibles || fase !== 'escaneo') return
    const raf = window.requestAnimationFrame(() => {
      const cont = contRef.current
      if (!cont) return
      const base = cont.getBoundingClientRect()
      const ids = claveVisibles.split('|')
      const nuevos: Conector[] = []
      for (const id of ids) {
        if (conectadosRef.current.has(id)) continue
        const caja = cajasRef.current.get(id)
        const tarjeta = tarjetasRef.current.get(id)
        if (!caja || !tarjeta) continue
        conectadosRef.current.add(id)
        const grilla = grillaRef.current
        if (grilla) {
          const g = grilla.getBoundingClientRect()
          const t = tarjeta.getBoundingClientRect()
          if (t.bottom > g.bottom) grilla.scrollTop += t.bottom - g.bottom + 12
        }
        const a = caja.getBoundingClientRect()
        const b = tarjeta.getBoundingClientRect()
        nuevos.push({ key: `${id}-${Date.now()}`, x1: a.right - base.left, y1: a.top + a.height / 2 - base.top, x2: b.left - base.left, y2: b.top + b.height / 2 - base.top })
      }
      if (nuevos.length) setConectores(prev => [...prev, ...nuevos])
    })
    return () => window.cancelAnimationFrame(raf)
  }, [claveVisibles, fase])

  function reiniciar(nuevaEscena: EscenaId = escenaId) {
    setEscenaId(nuevaEscena)
    setItems(itemsDe(ESCENAS[nuevaEscena]))
    setFase('inicio')
    setReloj(0)
    setConectores([])
    setVuelos({})
    conectadosRef.current = new Set()
  }

  function sacarFoto() {
    if (fase !== 'inicio') return
    conectadosRef.current = new Set()
    setConectores([])
    setReloj(0)
    setFase('escaneo')
  }

  function publicar() {
    if (fase !== 'revision' || listos.length === 0) return
    const destino = destinoRef.current?.getBoundingClientRect()
    const v: Record<string, Vuelo> = {}
    for (const it of listos) {
      const el = tarjetasRef.current.get(it.id)
      if (!el || !destino) continue
      const r = el.getBoundingClientRect()
      v[it.id] = { dx: destino.left + destino.width / 2 - (r.left + r.width / 2), dy: destino.top + destino.height / 2 - (r.top + r.height / 2) }
    }
    setVuelos(v)
    setReloj(0)
    setFase('publicando')
  }

  function cambiarItem(id: string, cambio: Partial<Item>) {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...cambio } : it)))
  }

  // Derivados del reloj para la foto y el HUD.
  const nDetectados = productos.filter((_, i) => detectado(i)).length
  const ocrActivo = new Set<string>()
  const leidas = new Set<string>()
  let nLeidos = 0
  productos.forEach((p, i) => {
    const d = ocrDesde(i)
    if (completo) { leidas.add(p.id); nLeidos++; return }
    if (d < 0) return
    const largo = formatoARS(p.precioLeido).length
    if (d < largo * 75 + 250) ocrActivo.add(p.id)
    else { leidas.add(p.id); nLeidos++ }
  })
  const descripcionDe = (i: number) => {
    const texto = productos[i].descripcion
    if (completo) return { texto, tipeando: false }
    if (!escaneando) return { texto: '', tipeando: false }
    const d = reloj - tDescripcion(i)
    if (d < 0) return { texto: '', tipeando: true }
    const n = Math.min(texto.length, Math.floor(d / 18))
    return { texto: texto.slice(0, n), tipeando: n < texto.length }
  }
  const nDescritos = completo ? productos.length : productos.filter((_, i) => { const d = descripcionDe(i); return d.texto.length > 0 && !d.tipeando }).length
  const ocrTextoDe = (i: number): string | null => {
    const d = ocrDesde(i)
    if (!escaneando || d < 0) return null
    const texto = formatoARS(productos[i].precioLeido)
    if (d > texto.length * 75 + 1400) return null
    return texto.slice(0, Math.min(texto.length, Math.floor(d / 75)))
  }
  const estadoCajaDe = (i: number): EstadoCaja => {
    if (!detectado(i)) return 'oculta'
    const it = items[i]
    if (it.quitado) return 'quitada'
    if (fase === 'publicado' || fase === 'publicando') return 'publicada'
    if (!it.revisado && productos[i].confianza < 85) return 'baja'
    if (completo) return 'ok'
    return 'detectando'
  }
  const etiquetaCajaDe = (i: number) => {
    const p = productos[i]
    const corto = p.nombre.split(' ').slice(0, 2).join(' ')
    const e = estadoCajaDe(i)
    if (e === 'publicada') return 'Publicado'
    if (e === 'quitada') return 'Quitado'
    if (e === 'baja') return `${corto} · ${p.confianza}%`
    return `${corto} · ${p.confianza}%`
  }

  const pasoActual = indicePaso(fase)
  const segundos = (fase === 'escaneo' ? reloj : fase === 'inicio' ? 0 : T_FIN) / 1000
  const nPublicados = fase === 'publicando' ? Math.min(listos.length, Math.max(0, Math.floor((reloj - 350) / 110))) : listos.length
  const cierre = `Listo, cargué ${listos.length} productos en 40 segundos. Cuando quieras, sacale fotos mejores a cada uno.`
  const cierreTipeado = fase === 'publicado' ? cierre.slice(0, Math.min(cierre.length, Math.floor((reloj - 300) / 22))) : ''
  const cierreListo = fase === 'publicado' && cierreTipeado.length >= cierre.length

  const pasoHud = (activo: boolean, hecho: boolean, titulo: string, detalle: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: hecho ? C.success : activo ? C.text : C.subtle, transition: 'color .3s' }}>
      {hecho ? <Check size={13} strokeWidth={3} /> : activo ? <LoaderCircle size={13} style={{ animation: 'pr-spin 1s linear infinite' }} /> : <Circle size={11} />}
      <span style={{ fontWeight: 700 }}>{titulo}</span>
      <span style={{ fontFamily: FONT_MONO, color: hecho ? C.success : activo ? C.primaryLight : C.subtle, marginLeft: 'auto' }}>{detalle}</span>
    </div>
  )

  return (
    <div ref={contRef} style={{ position: 'relative', padding: 26, minHeight: 600, fontFamily: FONT, color: C.body }}>
      <style>{CSS}</style>

      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <OrbiAvatar size={38} />
          <div>
            <Etiqueta color={C.orbiLight}>Orbi · visión</Etiqueta>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 19, letterSpacing: '-0.02em', color: C.text, marginTop: 2 }}>{escena.negocio}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 8, padding: 4, borderRadius: 999, background: 'rgba(148,163,184,.08)', border: `1px solid ${C.border}` }}>
          {PASOS.map((s, k) => {
            const activo = k === pasoActual
            const hecho = k < pasoActual
            return (
              <div key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: activo ? '#fff' : hecho ? C.success : C.subtle, background: activo ? `linear-gradient(135deg, ${C.primary}, ${C.orbi})` : 'transparent', transition: 'all .3s' }}>
                <span style={{ width: 16, height: 16, borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, background: activo ? 'rgba(255,255,255,.22)' : hecho ? `${C.success}22` : 'rgba(148,163,184,.12)' }}>{hecho ? <Check size={10} strokeWidth={3} /> : k + 1}</span>
                {s.nombre}
              </div>
            )
          })}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Otra foto:</span>
          <div style={{ display: 'flex', padding: 3, borderRadius: 10, background: 'rgba(148,163,184,.08)', border: `1px solid ${C.border}` }}>
            {(['dietetica', 'ferreteria'] as EscenaId[]).map(id => {
              const activo = id === escenaId
              const Icono = id === 'dietetica' ? Leaf : Wrench
              return (
                <button key={id} type="button" className="pr-btn" onClick={() => reiniciar(id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 8, border: 'none', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: activo ? C.text : C.muted, background: activo ? 'rgba(148,163,184,.18)' : 'transparent' }}>
                  <Icono size={13} /> {ESCENAS[id].rubro}
                </button>
              )
            })}
          </div>
          <Boton variante="fantasma" tam="sm" onClick={() => reiniciar()}><RotateCcw size={13} /> Reiniciar</Boton>
        </div>
      </div>

      {/* Cuerpo: foto a la izquierda, grilla a la derecha */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 55fr) minmax(0, 45fr)', gap: 22, marginTop: 20, alignItems: 'start' }}>
        {/* ── Cámara ── */}
        <div>
          <div style={{ borderRadius: 22, padding: 10, background: 'linear-gradient(160deg, #111827, #05070D)', boxShadow: '0 30px 80px rgba(0,0,0,.55), inset 0 0 0 1px rgba(148,163,184,.22)' }}>
            <div style={{ position: 'relative', aspectRatio: '4 / 3', borderRadius: 14, overflow: 'hidden', background: '#000' }}>
              <Gondola escena={escena} ocrActivo={ocrActivo} leidas={leidas} />

              {/* rejilla de escaneo */}
              {fase !== 'inicio' ? (
                <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(96,165,250,.09) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,.09) 1px, transparent 1px)', backgroundSize: '28px 28px', animation: 'fc-rejilla .6s ease both', pointerEvents: 'none', opacity: completo ? 0.5 : 1, transition: 'opacity .6s' }} />
              ) : null}

              {/* recuadros de detección */}
              {productos.map((p, i) => (
                <Recuadro
                  key={p.id}
                  p={p}
                  i={i}
                  estado={estadoCajaDe(i)}
                  etiqueta={etiquetaCajaDe(i)}
                  ocrTexto={ocrTextoDe(i)}
                  cajaRef={el => { if (el) cajasRef.current.set(p.id, el); else cajasRef.current.delete(p.id) }}
                />
              ))}

              {/* línea de escaneo */}
              {escaneando ? (
                <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, height: 3, top: '-10%', animation: `fc-scan ${T_SCAN}ms linear ${T_FLASH}ms both`, background: `linear-gradient(90deg, transparent, ${C.primaryLight}, ${C.orbiLight}, transparent)`, boxShadow: `0 0 18px 4px ${C.primary}88, 0 0 40px 8px ${C.orbi}55`, zIndex: 4, pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 2, height: 70, background: `linear-gradient(180deg, transparent, ${C.primary}33)` }} />
                </div>
              ) : null}

              {/* flash */}
              {escaneando ? <div aria-hidden style={{ position: 'absolute', inset: 0, background: '#fff', animation: `fc-flash ${T_FLASH + 150}ms ease-out both`, zIndex: 6, pointerEvents: 'none' }} /> : null}

              {/* esquinas de enfoque */}
              {(['lt', 'rt', 'lb', 'rb'] as const).map(k => (
                <span key={k} aria-hidden style={{ position: 'absolute', width: 24, height: 24, zIndex: 5, pointerEvents: 'none', [k[0] === 'l' ? 'left' : 'right']: 12, [k[1] === 't' ? 'top' : 'bottom']: 12, borderColor: escaneando ? C.primaryLight : 'rgba(255,255,255,.85)', borderStyle: 'solid', borderWidth: 0, [k[0] === 'l' ? 'borderLeftWidth' : 'borderRightWidth']: 2.5, [k[1] === 't' ? 'borderTopWidth' : 'borderBottomWidth']: 2.5, borderRadius: 4, transition: 'border-color .3s', filter: escaneando ? `drop-shadow(0 0 6px ${C.primary})` : 'none' }} />
              ))}

              {/* barra superior tipo cámara */}
              <div style={{ position: 'absolute', top: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 5, pointerEvents: 'none' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 999, background: 'rgba(2,6,23,.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', color: '#fff', fontSize: 11.5, fontWeight: 600, letterSpacing: '0.02em' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: escaneando ? C.orbiLight : fase === 'inicio' ? C.error : C.success, animation: escaneando || fase === 'inicio' ? 'pr-pulse 1.4s ease-in-out infinite' : 'none' }} />
                  {escena.lugar}
                  <span style={{ opacity: 0.6, fontFamily: FONT_MONO }}>· {segundos.toFixed(1)} s</span>
                </div>
              </div>

              {/* obturador */}
              {fase === 'inicio' ? (
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 7 }}>
                  <button type="button" className="fc-obturador pr-btn" onClick={sacarFoto} aria-label="Sacar foto" style={{ width: 66, height: 66, borderRadius: '50%', border: '3px solid #fff', background: 'rgba(255,255,255,.12)', padding: 4, cursor: 'pointer', boxShadow: '0 10px 30px rgba(0,0,0,.5)' }}>
                    <span className="fc-obt-int" style={{ display: 'block', width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, #fff, #E2E8F0)' }} />
                  </button>
                  <span style={{ color: '#fff', fontSize: 12.5, fontWeight: 700, textShadow: '0 2px 8px rgba(0,0,0,.8)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Camera size={13} /> Sacar foto</span>
                </div>
              ) : null}

              {/* HUD de detección */}
              {fase !== 'inicio' ? (
                <div className="pr-fade-up" style={{ position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 7, padding: '10px 12px', borderRadius: 12, background: 'rgba(2,6,23,.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: `1px solid ${completo ? C.success + '55' : C.orbi + '66'}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 16px', transition: 'border-color .4s' }}>
                  {pasoHud(escaneando && nDetectados < productos.length, nDetectados >= productos.length, 'Detectando', `${nDetectados}/${productos.length}`)}
                  {pasoHud(nDetectados > 0 && nLeidos < productos.length, nLeidos >= productos.length, 'Leyendo precios', `${nLeidos}/${productos.length}`)}
                  {pasoHud(nLeidos > 0 && nDescritos < productos.length, nDescritos >= productos.length, 'Redactando', `${nDescritos}/${productos.length}`)}
                </div>
              ) : null}
            </div>
          </div>

          {/* Cierre de Orbi (después de publicar) */}
          {fase === 'publicado' ? (
            <Tarjeta className="pr-fade-up" style={{ marginTop: 16, padding: 16, borderColor: `${C.orbi}55`, background: 'linear-gradient(135deg, rgba(59,130,246,.10), rgba(139,92,246,.10))' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <OrbiAvatar size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, lineHeight: 1.5, color: C.text, minHeight: 46 }}>
                    {cierreTipeado}
                    {!cierreListo ? <span style={{ display: 'inline-block', width: 2, height: 15, background: C.orbiLight, verticalAlign: '-2px', marginLeft: 2, animation: 'pr-blink .6s step-end infinite' }} /> : null}
                  </div>
                  <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '110px 1fr 70px', gap: '8px 12px', alignItems: 'center', fontSize: 12.5 }}>
                    <span style={{ color: C.muted, fontWeight: 600 }}>A mano</span>
                    <div style={{ height: 8, borderRadius: 99, background: 'rgba(148,163,184,.12)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${C.subtle}, ${C.muted})`, animation: 'fc-barra 1.6s cubic-bezier(.2,.8,.2,1) .2s both', ['--w' as string]: '100%' } as CSSProperties} />
                    </div>
                    <span style={{ fontFamily: FONT_MONO, fontWeight: 700, color: C.muted, textAlign: 'right' }}>~45 min</span>
                    <span style={{ color: C.success, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Zap size={12} /> Con foto</span>
                    <div style={{ height: 8, borderRadius: 99, background: 'rgba(148,163,184,.12)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${C.success}, ${C.primaryLight})`, boxShadow: `0 0 10px ${C.success}`, animation: 'fc-barra .8s cubic-bezier(.2,.8,.2,1) .4s both', ['--w' as string]: '2.5%' } as CSSProperties} />
                    </div>
                    <span style={{ fontFamily: FONT_MONO, fontWeight: 800, color: C.success, textAlign: 'right' }}>40 s</span>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Chip color={C.success}><Timer size={11} /> 67 veces más rápido</Chip>
                    <Chip color={C.primaryLight}><Store size={11} /> {listos.length} productos publicados</Chip>
                    <Boton variante="suave" tam="sm" color={C.orbiLight} onClick={() => reiniciar()} style={{ marginLeft: 'auto' }}><Camera size={13} /> Sacar otra foto</Boton>
                  </div>
                </div>
              </div>
            </Tarjeta>
          ) : null}
        </div>

        {/* ── Columna derecha ── */}
        <div style={{ position: 'relative', alignSelf: 'stretch', minHeight: 420 }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
            {fase === 'inicio' ? (
              <div style={{ flex: 1, borderRadius: 18, border: `1.5px dashed ${C.borderStrong}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 28, gap: 12 }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(59,130,246,.18), rgba(139,92,246,.18))', border: `1px solid ${C.orbi}44`, color: C.orbiLight, animation: 'pr-float 3.5s ease-in-out infinite' }}>
                  <LayoutGrid size={28} />
                </div>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, color: C.text, letterSpacing: '-0.02em' }}>Acá se materializan los productos</div>
                <p style={{ margin: 0, fontSize: 13.5, color: C.muted, maxWidth: 340, lineHeight: 1.5 }}>Sacá la foto del estante. Orbi detecta cada producto, lee la etiqueta de precio, redacta la descripción y recorta la imagen. Vos solo revisás.</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 4 }}>
                  <Chip color={C.primaryLight}><ScanLine size={11} /> Detecta</Chip>
                  <Chip color={C.orbiLight}><Tag size={11} /> Lee precios</Chip>
                  <Chip color={C.warning}><Sparkles size={11} /> Redacta</Chip>
                  <Chip color={C.success}><Camera size={11} /> Recorta</Chip>
                </div>
              </div>
            ) : fase === 'publicado' ? (
              <div className="pr-fade-up" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <TiendaCelular escena={escena} items={listos} />
                <div style={{ fontSize: 12, color: C.muted, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Store size={12} /> Así lo ven tus clientes en la tienda</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, minHeight: 34 }}>
                  <OrbiAvatar size={26} />
                  <div style={{ fontSize: 13, color: C.body, lineHeight: 1.35 }} className="pr-fade-in" key={completo ? 'listo' : 'trabajando'}>
                    {completo
                      ? <>Revisá los precios marcados en <span style={{ color: C.warning, fontWeight: 700 }}>ámbar</span>; el resto los leí con confianza alta. Podés editar cualquier campo.</>
                      : <>Estoy mirando la foto. Voy armando cada producto a medida que lo encuentro…</>}
                  </div>
                </div>
                <div ref={grillaRef} className="pr-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4, paddingTop: 2, paddingBottom: 6 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {items.map((it, i) => {
                      if (it.quitado || !conTarjeta(i)) return null
                      const d = descripcionDe(i)
                      return (
                        <TarjetaProducto
                          key={it.id}
                          p={productos[i]}
                          item={it}
                          categorias={escena.categorias}
                          descripcionTipeada={d.texto}
                          tipeando={d.tipeando}
                          vuelo={vuelos[it.id]}
                          indice={visibles.findIndex(v => v.id === it.id)}
                          tarjetaRef={el => { if (el) tarjetasRef.current.set(it.id, el); else tarjetasRef.current.delete(it.id) }}
                          onCambio={cambio => cambiarItem(it.id, cambio)}
                          onQuitar={() => cambiarItem(it.id, { quitado: true })}
                        />
                      )
                    })}
                  </div>
                  {completo && listos.length === 0 ? (
                    <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 13 }}>Quitaste todos los productos. Reiniciá para probar de nuevo.</div>
                  ) : null}
                </div>
                {/* barra de publicar */}
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 14, background: completo ? 'linear-gradient(135deg, rgba(59,130,246,.14), rgba(139,92,246,.14))' : C.surface, border: `1px solid ${completo ? C.primary + '55' : C.border}`, display: 'flex', alignItems: 'center', gap: 12, transition: 'all .4s' }}>
                  <div ref={destinoRef} style={{ position: 'relative', width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${C.primary}, ${C.orbi})`, color: '#fff', animation: fase === 'publicando' ? 'fc-latido .8s ease-out infinite' : 'none' }}>
                    <LayoutGrid size={18} />
                    {fase === 'publicando' ? <span style={{ position: 'absolute', inset: 0, borderRadius: 12, border: `2px solid ${C.orbiLight}`, animation: 'pr-ping .9s ease-out infinite' }} /> : null}
                    {fase === 'publicando' && nPublicados > 0 ? <span key={nPublicados} className="fc-pop" style={{ position: 'absolute', top: -8, right: -8, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 99, background: C.success, color: '#052E16', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_MONO }}>{nPublicados}</span> : null}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: C.text, fontSize: 14 }}>
                      {fase === 'publicando' ? `Guardando ${nPublicados}/${listos.length}…` : completo ? `${listos.length} productos listos` : `${visibles.length} de ${productos.length} armados…`}
                    </div>
                    <div style={{ fontSize: 11.5, color: C.muted }}>
                      {completo ? (listos.some((it, i) => !it.revisado && productos[items.indexOf(it)].confianza < 85 && i >= 0) ? 'Hay un precio para revisar, pero podés publicar igual.' : 'Todo revisado. Con stock inicial y las fotos recortadas.') : 'Orbi sigue trabajando…'}
                    </div>
                  </div>
                  <Boton onClick={publicar} disabled={fase !== 'revision' || listos.length === 0} style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.orbi})`, boxShadow: `0 8px 24px ${C.orbi}55` }}>
                    {fase === 'publicando' ? <LoaderCircle size={15} style={{ animation: 'pr-spin 1s linear infinite' }} /> : <Sparkles size={15} />}
                    Publicar en el catálogo
                  </Boton>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Conectores fugaces foto → tarjeta */}
      <svg aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 20, overflow: 'visible' }}>
        <defs>
          <linearGradient id="fc-conector-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={C.primaryLight} />
            <stop offset="1" stopColor={C.orbiLight} />
          </linearGradient>
        </defs>
        {conectores.map(c => (
          <g key={c.key}>
            <path d={`M ${c.x1} ${c.y1} C ${c.x1 + 70} ${c.y1}, ${c.x2 - 70} ${c.y2}, ${c.x2} ${c.y2}`} fill="none" stroke="url(#fc-conector-grad)" strokeWidth={1.8} strokeLinecap="round" pathLength={100} strokeDasharray="100" strokeDashoffset="100" style={{ animation: 'fc-conector 1s ease-out forwards', filter: `drop-shadow(0 0 4px ${C.orbi})` }} />
            <circle cx={c.x2} cy={c.y2} r={4} fill={C.orbiLight} style={{ animation: 'pr-ping .9s ease-out .35s both' }} />
          </g>
        ))}
      </svg>
    </div>
  )
}
